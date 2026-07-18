import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import {
  BetterListFieldKind,
  BetterListFieldMapping,
  IBetterListAudienceIdentity,
  IBetterListFieldInfo,
  IBetterListFieldMappings,
  IBetterListItem,
  IBetterListListInfo,
  IBetterListListReference,
  IBetterListLoadRequest,
  IBetterListLoadResult,
  filterVisibleItems,
  normalizeItem
} from '../../../shared';
import { IBetterListDataSource } from './IBetterListDataSource';

interface IODataPage {
  values: readonly Record<string, unknown>[];
  nextLink?: string;
}

const INTERNAL_NAME_PATTERN: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;
const GUID_PATTERN: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function toNumber(value: unknown, fallback: number = 0): number {
  const result: number = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeGuid(value: string): string {
  const guid: string = value.trim().replace(/^\{/, '').replace(/\}$/, '');
  if (!GUID_PATTERN.test(guid)) {
    throw new Error(`"${value}" is not a valid SharePoint list id.`);
  }
  return guid;
}

function listPath(list: IBetterListListReference): string {
  if (list.id && list.id.trim()) {
    return `lists(guid'${normalizeGuid(list.id)}')`;
  }
  if (list.title && list.title.trim()) {
    return `lists/getbytitle('${escapeODataString(list.title.trim())}')`;
  }
  throw new Error('Select a SharePoint list before loading fields or items.');
}

function validatedInternalName(value: string): string {
  const name: string = value.trim();
  if (!INTERNAL_NAME_PATTERN.test(name)) {
    throw new Error(`"${value}" is not a valid SharePoint internal field name.`);
  }
  return name;
}

function allMappings(mappings: IBetterListFieldMappings): readonly BetterListFieldMapping[] {
  const fixed: readonly (BetterListFieldMapping | undefined)[] = [
    mappings.title,
    mappings.description,
    mappings.url,
    mappings.urlLabel,
    mappings.category,
    mappings.organization,
    mappings.organizationShortName,
    mappings.featured,
    mappings.sortOrder,
    mappings.active,
    mappings.audience,
    mappings.icon,
    mappings.tab,
    mappings.group
  ];
  return fixed
    .filter((mapping: BetterListFieldMapping | undefined): mapping is BetterListFieldMapping => !!mapping)
    .concat((mappings.metadata || []).map((entry) => entry.mapping));
}

function queryParts(mappings: IBetterListFieldMappings): { select: readonly string[]; expand: readonly string[] } {
  const select: Set<string> = new Set<string>(['Id']);
  const expand: Set<string> = new Set<string>();
  allMappings(mappings).forEach((mapping: BetterListFieldMapping) => {
    const name: string = validatedInternalName(mapping.internalName);
    if (mapping.kind === 'lookup' || mapping.kind === 'person') {
      expand.add(name);
      select.add(`${name}/Id`);
      select.add(`${name}/Title`);
      if (mapping.kind === 'lookup' && mapping.lookupValueField) {
        select.add(`${name}/${validatedInternalName(mapping.lookupValueField)}`);
      }
      if (mapping.kind === 'person') {
        select.add(`${name}/EMail`);
        select.add(`${name}/LoginName`);
        select.add(`${name}/PrincipalType`);
      }
    } else {
      select.add(name);
    }
  });
  return { select: Array.from(select), expand: Array.from(expand) };
}

function pageFromPayload(payload: unknown): IODataPage {
  const root: Record<string, unknown> = isRecord(payload) ? payload : {};
  const d: Record<string, unknown> = isRecord(root.d) ? root.d : root;
  const rawValues: unknown = Array.isArray(d.value) ? d.value : Array.isArray(d.results) ? d.results : [];
  const values: readonly Record<string, unknown>[] = (rawValues as readonly unknown[]).filter(isRecord);
  const nextLink: unknown = d['@odata.nextLink'] ?? d['odata.nextLink'] ?? d.__next;
  return { values, nextLink: typeof nextLink === 'string' && nextLink ? nextLink : undefined };
}

function absoluteNextLink(nextLink: string, webUrl: string): string {
  if (/^https?:\/\//i.test(nextLink)) {
    return nextLink;
  }
  if (nextLink.charAt(0) === '/') {
    const originMatch: RegExpMatchArray | null = webUrl.match(/^https?:\/\/[^/]+/i);
    return originMatch ? `${originMatch[0]}${nextLink}` : nextLink;
  }
  return `${webUrl.replace(/\/$/, '')}/${nextLink.replace(/^\//, '')}`;
}

function oDataError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback;
  }
  const error: unknown = payload.error ?? (isRecord(payload.d) ? payload.d.error : undefined);
  if (isRecord(error)) {
    const message: unknown = error.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    if (isRecord(message) && typeof message.value === 'string' && message.value.trim()) {
      return message.value;
    }
  }
  return fallback;
}

export function inferBetterListFieldKind(typeAsString: string): BetterListFieldKind | undefined {
  const type: string = typeAsString.toLocaleLowerCase();
  if (type === 'url') return 'url';
  if (type === 'lookup' || type === 'lookupmulti') return 'lookup';
  if (type === 'user' || type === 'usermulti') return 'person';
  if (type === 'boolean') return 'boolean';
  if (type === 'number' || type === 'currency' || type === 'counter') return 'number';
  if (type === 'datetime') return 'dateTime';
  if (type === 'text' || type === 'note' || type === 'choice' || type === 'multichoice' || type === 'computed') return 'text';
  return undefined;
}

export class SharePointBetterListDataSource implements IBetterListDataSource {
  private readonly _client: SPHttpClient;
  private readonly _webUrl: string;

  public constructor(spHttpClient: SPHttpClient, webUrl: string) {
    this._client = spHttpClient;
    this._webUrl = webUrl.replace(/\/$/, '');
  }

  public async discoverLists(): Promise<readonly IBetterListListInfo[]> {
    const select: string = 'Id,Title,ItemCount,BaseTemplate';
    const url: string = `${this._webUrl}/_api/web/lists?$select=${select}&$filter=Hidden eq false and BaseType eq 0&$orderby=Title`;
    const rows: readonly Record<string, unknown>[] = await this._getAllPages(url);
    return rows.map((row: Record<string, unknown>): IBetterListListInfo => ({
      id: toStringValue(row.Id),
      title: toStringValue(row.Title),
      itemCount: toNumber(row.ItemCount),
      baseTemplate: toNumber(row.BaseTemplate)
    }));
  }

  public async discoverFields(list: IBetterListListReference): Promise<readonly IBetterListFieldInfo[]> {
    const select: string = [
      'Id',
      'InternalName',
      'Title',
      'TypeAsString',
      'Hidden',
      'ReadOnlyField',
      'Required',
      'AllowMultipleValues',
      'LookupList',
      'LookupField'
    ].join(',');
    const url: string =
      `${this._webUrl}/_api/web/${listPath(list)}/fields` +
      `?$select=${select}&$filter=Hidden eq false&$orderby=Title`;
    const rows: readonly Record<string, unknown>[] = await this._getAllPages(url);
    return rows.map((row: Record<string, unknown>): IBetterListFieldInfo => ({
      id: toStringValue(row.Id),
      internalName: toStringValue(row.InternalName),
      title: toStringValue(row.Title),
      typeAsString: toStringValue(row.TypeAsString),
      hidden: toBoolean(row.Hidden),
      readOnly: toBoolean(row.ReadOnlyField),
      required: toBoolean(row.Required),
      allowMultipleValues: toBoolean(row.AllowMultipleValues),
      lookupListId: toStringValue(row.LookupList) || undefined,
      lookupField: toStringValue(row.LookupField) || undefined
    }));
  }

  public async loadItems(request: IBetterListLoadRequest): Promise<IBetterListLoadResult> {
    const parts: { select: readonly string[]; expand: readonly string[] } = queryParts(request.mappings);
    const query: string[] = [`$select=${parts.select.join(',')}`, '$top=5000'];
    if (parts.expand.length > 0) {
      query.push(`$expand=${parts.expand.join(',')}`);
    }
    const url: string = `${this._webUrl}/_api/web/${listPath(request.list)}/items?${query.join('&')}`;
    const rows: readonly Record<string, unknown>[] = await this._getAllPages(url);
    const identity: IBetterListAudienceIdentity = request.mappings.audience
      ? await this._loadAudienceIdentity()
      : { groupIds: [] };
    const normalized: readonly IBetterListItem[] = rows.map((row: Record<string, unknown>) =>
      normalizeItem(row, request.mappings)
    );
    return { items: filterVisibleItems(normalized, identity), audienceIdentity: identity };
  }

  private async _loadAudienceIdentity(): Promise<IBetterListAudienceIdentity> {
    const userUrl: string = `${this._webUrl}/_api/web/currentuser?$select=Id,Title,Email,LoginName,UserPrincipalName`;
    const groupsUrl: string = `${this._webUrl}/_api/web/currentuser/groups?$select=Id&$top=5000`;
    const results: [unknown, readonly Record<string, unknown>[]] = await Promise.all([
      this._getJson(userUrl),
      this._getAllPages(groupsUrl)
    ]);
    const userRoot: Record<string, unknown> = isRecord(results[0]) ? results[0] : {};
    const user: Record<string, unknown> = isRecord(userRoot.d) ? userRoot.d : userRoot;
    return {
      userId: Number.isFinite(Number(user.Id)) ? Number(user.Id) : undefined,
      title: toStringValue(user.Title) || undefined,
      email: toStringValue(user.Email) || undefined,
      loginName: toStringValue(user.LoginName ?? user.UserPrincipalName) || undefined,
      groupIds: results[1]
        .map((group: Record<string, unknown>) => Number(group.Id))
        .filter((id: number) => Number.isFinite(id))
    };
  }

  private async _getAllPages(initialUrl: string): Promise<readonly Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let nextUrl: string | undefined = initialUrl;
    const visited: Set<string> = new Set<string>();
    while (nextUrl) {
      if (visited.has(nextUrl)) {
        throw new Error('SharePoint returned a repeating pagination link.');
      }
      visited.add(nextUrl);
      const page: IODataPage = pageFromPayload(await this._getJson(nextUrl));
      rows.push(...page.values);
      nextUrl = page.nextLink ? absoluteNextLink(page.nextLink, this._webUrl) : undefined;
    }
    return rows;
  }

  private async _getJson(url: string): Promise<unknown> {
    const response: SPHttpClientResponse = await this._client.get(url, SPHttpClient.configurations.v1, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });
    const text: string = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) as unknown : {};
    } catch {
      payload = {};
    }
    if (!response.ok) {
      const fallback: string =
        `SharePoint request failed with HTTP ${response.status}` +
        (response.statusText ? ` (${response.statusText})` : '') +
        '.';
      throw new Error(oDataError(payload, text.trim() || fallback));
    }
    return payload;
  }
}
