import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import {
  BetterListFieldKind,
  BetterListFieldMapping,
  IBetterListAudienceIdentity,
  IBetterListFieldInfo,
  IBetterListFieldMappings,
  IBetterListPersonFieldMapping,
  IBetterListRelationshipTarget,
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

export interface IParsedSharePointListUrl {
  webUrl: string;
  serverRelativeUrl: string;
}

const INTERNAL_NAME_PATTERN: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;
const GUID_PATTERN: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RICH_TEXT_MODE_PATTERN: RegExp = /\bRichTextMode=(?:"([^"]*)"|'([^']*)')/i;

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

export function parseSharePointListUrl(value: string, currentWebUrl: string): IParsedSharePointListUrl {
  const input: string = value.trim();
  if (!input) {
    throw new Error('Enter a SharePoint list URL.');
  }
  const base: URL = new URL(currentWebUrl);
  if (!/^https:\/\//i.test(input)) {
    throw new Error('Enter the full HTTPS URL of a SharePoint list.');
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Enter a valid SharePoint list URL.');
  }
  if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password) {
    throw new Error('The list URL must use HTTPS and belong to this SharePoint tenant.');
  }
  let path: string;
  try {
    path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
  } catch {
    throw new Error('The SharePoint list URL contains invalid path encoding.');
  }
  const listsMarker: number = path.toLocaleLowerCase().lastIndexOf('/lists/');
  if (listsMarker < 0) {
    throw new Error('Enter a list URL containing /Lists/<list-name>.');
  }
  const listName: string = path.slice(listsMarker + '/lists/'.length).split('/')[0]?.trim() || '';
  if (!listName) {
    throw new Error('The SharePoint list URL does not include a list name.');
  }
  const webPath: string = path.slice(0, listsMarker);
  return {
    webUrl: `${base.origin}${webPath}`.replace(/\/$/, ''),
    serverRelativeUrl: `${webPath}/Lists/${listName}`
  };
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
    .concat(mappings.filterFields || [])
    .concat((mappings.metadata || []).map((entry) => entry.mapping));
}

function queryParts(mappings: IBetterListFieldMappings): { select: readonly string[]; expand: readonly string[] } {
  const select: Set<string> = new Set<string>(['Id']);
  const expand: Set<string> = new Set<string>();
  allMappings(mappings).forEach((mapping: BetterListFieldMapping) => {
    const name: string = validatedInternalName(mapping.queryName || mapping.internalName);
    if (mapping.kind === 'lookup' || mapping.kind === 'person') {
      expand.add(name);
      if (mapping.kind === 'lookup') {
        select.add(`${name}/Id`);
        select.add(`${name}/Title`);
        if (mapping.lookupValueField) {
          select.add(`${name}/${validatedInternalName(mapping.lookupValueQueryName || mapping.lookupValueField)}`);
        }
      }
      if (mapping.kind === 'person') {
        const propertyName = personQueryProperty(mapping);
        select.add(`${name}/${propertyName}`);
        if (mapping === mappings.audience) {
          select.add(`${name}/Id`);
          select.add(`${name}/Title`);
          select.add(`${name}/EMail`);
        }
      }
    } else {
      select.add(name);
    }
  });
  return { select: Array.from(select), expand: Array.from(expand) };
}

function personQueryProperty(mapping: IBetterListPersonFieldMapping): string {
  const target = mapping.relationship?.target;
  if (target?.resolution === 'userInfoBatch') return 'Id';
  if (mapping.valueProperty === 'id' || target?.internalName.toLocaleLowerCase() === 'id') return 'Id';
  if (mapping.valueProperty === 'email' || target?.internalName.toLocaleLowerCase() === 'email') return 'EMail';
  // Name/LoginName and all optional User Information properties are intentionally
  // resolved by user id rather than projected from SP.FieldUser.
  if (mapping.valueProperty === 'loginName') return 'Id';
  return 'Title';
}

function richTextModeFromSchema(schemaXml: string): string | undefined {
  const match = schemaXml.match(RICH_TEXT_MODE_PATTERN);
  return match?.[1] || match?.[2] || undefined;
}

function mappingsNeedSchemaResolution(mappings: IBetterListFieldMappings): boolean {
  return allMappings(mappings).some((mapping) => {
    const source = mapping.sourceInternalName || mapping.internalName;
    const legacyTextMapping = mapping !== mappings.title &&
      mapping.richText === undefined &&
      (mapping.kind === 'text' || mapping.kind === 'lookup');
    return legacyTextMapping ||
      source.startsWith('_') ||
      Boolean(mapping.queryName && mapping.queryName !== source) ||
      (mapping.kind === 'person' && (
        mapping.valueProperty === 'loginName' ||
        mapping.relationship?.target.resolution === 'userInfoBatch'
      ));
  });
}

function resolveFieldMappings(
  mappings: IBetterListFieldMappings,
  fields: readonly IBetterListFieldInfo[]
): IBetterListFieldMappings {
  const byInternalName = new Map(
    fields.map((field) => [field.internalName.toLocaleLowerCase(), field] as const)
  );
  const resolve = (
    mapping: BetterListFieldMapping | undefined,
    required: boolean = false
  ): BetterListFieldMapping | undefined => {
    if (!mapping) return undefined;
    const sourceInternalName = mapping.sourceInternalName || mapping.fieldPath?.split(/[/.]/)[0] || mapping.internalName;
    const field = byInternalName.get(sourceInternalName.toLocaleLowerCase());
    if (!field) return required ? mapping : undefined;
    const relationshipKind = mapping.kind === 'person' || mapping.kind === 'lookup' ? mapping.kind : undefined;
    let targetInternalName: string | undefined;
    if (mapping.kind === 'person') {
      targetInternalName = mapping.personValueField ||
        mapping.relationship?.target.internalName ||
        mapping.lookupValueField ||
        legacyPersonTarget(mapping);
    } else if (mapping.kind === 'lookup') {
      targetInternalName = mapping.lookupValueField || mapping.relationship?.target.internalName || field.lookupField || 'Title';
    }
    const target = relationshipKind && targetInternalName
      ? resolveRelationshipTarget(mapping, relationshipKind, targetInternalName)
      : undefined;
    return {
      ...mapping,
      internalName: sourceInternalName,
      sourceInternalName,
      fieldPath: targetInternalName ? `${sourceInternalName}/${targetInternalName}` : sourceInternalName,
      queryName: field.entityPropertyName || sourceInternalName,
      fieldType: mapping.fieldType || field.typeAsString,
      richText: mapping.richText ?? field.richText,
      ...(relationshipKind && target ? {
        relationship: {
          ...mapping.relationship,
          kind: relationshipKind,
          lookupListId: field.lookupListId || mapping.relationship?.lookupListId,
          target
        }
      } : {}),
      ...(mapping.kind === 'person' && target ? {
        personValueField: target.internalName,
        personValueQueryName: target.queryName
      } : {}),
      ...(mapping.kind === 'lookup' && target ? {
        lookupValueField: target.internalName,
        lookupValueQueryName: target.queryName
      } : {})
    };
  };
  const title = resolve(mappings.title, true) || mappings.title;
  return {
    title,
    description: resolve(mappings.description),
    url: resolve(mappings.url),
    urlLabel: resolve(mappings.urlLabel),
    category: resolve(mappings.category),
    organization: resolve(mappings.organization),
    organizationShortName: resolve(mappings.organizationShortName),
    featured: resolve(mappings.featured),
    sortOrder: resolve(mappings.sortOrder),
    active: resolve(mappings.active, Boolean(mappings.active)),
    audience: resolve(mappings.audience) as IBetterListFieldMappings['audience'],
    icon: resolve(mappings.icon),
    tab: resolve(mappings.tab),
    group: resolve(mappings.group),
    filterFields: (mappings.filterFields || [])
      .map((mapping) => resolve(mapping))
      .filter((mapping): mapping is BetterListFieldMapping => Boolean(mapping)),
    metadata: (mappings.metadata || [])
      .map((entry) => {
        const mapping = resolve(entry.mapping);
        return mapping ? { ...entry, mapping } : undefined;
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  };
}

function legacyPersonTarget(mapping: IBetterListPersonFieldMapping): string {
  if (mapping.valueProperty === 'id') return 'Id';
  if (mapping.valueProperty === 'email') return 'EMail';
  if (mapping.valueProperty === 'loginName') return 'Name';
  return 'Title';
}

function resolveRelationshipTarget(
  mapping: BetterListFieldMapping,
  kind: 'lookup' | 'person',
  targetInternalName: string
): IBetterListRelationshipTarget {
  const current = mapping.relationship?.target;
  const normalized = targetInternalName.toLocaleLowerCase();
  const safePersonProjection = normalized === 'id' || normalized === 'title' || normalized === 'email';
  const resolution = kind === 'person' && !safePersonProjection ? 'userInfoBatch' : 'expanded';
  return {
    internalName: targetInternalName,
    label: current?.label || targetInternalName,
    kind: current?.kind || 'text',
    queryName: current?.queryName ||
      (mapping.kind === 'lookup'
        ? mapping.lookupValueQueryName
        : mapping.kind === 'person'
          ? mapping.personValueQueryName || mapping.lookupValueQueryName
          : undefined) ||
      targetInternalName,
    queryable: kind === 'lookup' || safePersonProjection,
    resolution,
    richText: current?.richText
  };
}

function materializeQueryAliases(
  row: Readonly<Record<string, unknown>>,
  mappings: IBetterListFieldMappings
): Record<string, unknown> {
  let result: Record<string, unknown> = row as Record<string, unknown>;
  allMappings(mappings).forEach((mapping) => {
    const queryName = mapping.queryName || mapping.internalName;
    const value = result[queryName];
    let materialized = value;
    const targetInternalName = mapping.relationship?.target.internalName ||
      (mapping.kind === 'lookup'
        ? mapping.lookupValueField
        : mapping.kind === 'person'
          ? mapping.personValueField || mapping.lookupValueField
          : undefined);
    const targetQueryName = mapping.relationship?.target.queryName ||
      (mapping.kind === 'lookup'
        ? mapping.lookupValueQueryName
        : mapping.kind === 'person'
          ? mapping.personValueQueryName || mapping.lookupValueQueryName
          : undefined);
    if (
      (mapping.kind === 'lookup' || mapping.kind === 'person') &&
      targetInternalName &&
      targetQueryName &&
      targetInternalName !== targetQueryName
    ) {
      materialized = materializeExpandedAlias(
        value,
        targetQueryName,
        targetInternalName
      );
    }
    if (queryName !== mapping.internalName || materialized !== value) {
      if (result === row) {
        result = { ...row };
      }
      if (queryName === mapping.internalName && materialized !== value) {
        result[mapping.internalName] = materialized;
      } else if (result[mapping.internalName] === undefined) {
        result[mapping.internalName] = materialized;
      }
    }
  });
  return result;
}

function materializeExpandedAlias(value: unknown, queryName: string, internalName: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => materializeExpandedAlias(entry, queryName, internalName));
  }
  if (!isRecord(value)) {
    return value;
  }
  if (Array.isArray(value.results)) {
    return {
      ...value,
      results: value.results.map((entry) => materializeExpandedAlias(entry, queryName, internalName))
    };
  }
  return value[internalName] === undefined && value[queryName] !== undefined
    ? { ...value, [internalName]: value[queryName] }
    : value;
}

function unsupportedSelectPath(error: unknown, select: readonly string[]): string | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/(?:field or property|query to field)\s+'([^']+)'/i);
  const rejected = match?.[1]?.toLocaleLowerCase();
  if (!rejected) return undefined;
  return select.find((path) => {
    const candidate = path.toLocaleLowerCase();
    return candidate === rejected ||
      candidate.endsWith(`/${rejected}`) ||
      candidate.startsWith(`${rejected}/`);
  });
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

function expandedRelationshipEntries(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  if (Array.isArray(value.results)) return value.results.filter(isRecord);
  return [value];
}

function collectRelationshipIds(value: unknown): readonly number[] {
  return expandedRelationshipEntries(value)
    .map((entry) => Number(entry.Id ?? entry.ID ?? entry.id))
    .filter((id) => Number.isFinite(id));
}

function enrichExpandedPersonValue(
  value: unknown,
  usersById: ReadonlyMap<number, Record<string, unknown>>,
  target: IBetterListRelationshipTarget
): unknown {
  const queryName = target.queryName || target.internalName;
  const enrich = (entry: unknown): unknown => {
    if (!isRecord(entry)) return entry;
    const id = Number(entry.Id ?? entry.ID ?? entry.id);
    const user = Number.isFinite(id) ? usersById.get(id) : undefined;
    const resolved = user?.[queryName] ?? user?.[target.internalName] ?? null;
    return entry[target.internalName] === resolved ? entry : { ...entry, [target.internalName]: resolved };
  };
  if (Array.isArray(value)) return value.map(enrich);
  if (!isRecord(value)) return value;
  if (Array.isArray(value.results)) return { ...value, results: value.results.map(enrich) };
  return enrich(value);
}

export class SharePointBetterListDataSource implements IBetterListDataSource {
  private readonly _client: SPHttpClient;
  private readonly _webUrl: string;
  private readonly _fieldCache = new Map<string, Promise<readonly IBetterListFieldInfo[]>>();

  public constructor(spHttpClient: SPHttpClient, webUrl: string) {
    this._client = spHttpClient;
    this._webUrl = webUrl.replace(/\/$/, '');
  }

  public async discoverLists(): Promise<readonly IBetterListListInfo[]> {
    const select: string = 'Id,Title,ItemCount,BaseTemplate';
    const url: string = `${this._webUrl}/_api/web/lists?$select=${select}&$filter=Hidden eq false and BaseType eq 0&$orderby=Title`;
    const rows: readonly Record<string, unknown>[] = await this._getAllPages(url, this._webUrl);
    return rows.map((row: Record<string, unknown>): IBetterListListInfo => ({
      id: toStringValue(row.Id),
      title: toStringValue(row.Title),
      itemCount: toNumber(row.ItemCount),
      baseTemplate: toNumber(row.BaseTemplate),
      webUrl: this._webUrl
    }));
  }

  public async resolveListUrl(value: string): Promise<IBetterListListInfo> {
    const parsed: IParsedSharePointListUrl = parseSharePointListUrl(value, this._webUrl);
    const listArgument: string = encodeURIComponent(`'${escapeODataString(parsed.serverRelativeUrl)}'`).replace(/'/g, '%27');
    const select: string = 'Id,Title,ItemCount,BaseType,BaseTemplate,RootFolder/ServerRelativeUrl';
    const url: string =
      `${parsed.webUrl}/_api/web/GetList(@listUrl)` +
      `?@listUrl=${listArgument}&$select=${select}&$expand=RootFolder`;
    const payload: unknown = await this._getJson(url);
    const root: Record<string, unknown> = isRecord(payload) ? payload : {};
    const row: Record<string, unknown> = isRecord(root.d) ? root.d : root;
    const rootFolder: Record<string, unknown> = isRecord(row.RootFolder) ? row.RootFolder : {};
    const id: string = toStringValue(row.Id);
    const title: string = toStringValue(row.Title);
    if (!id || !title) {
      throw new Error('SharePoint returned incomplete metadata for that list URL.');
    }
    if (toNumber(row.BaseType, -1) !== 0) {
      throw new Error('The URL must point to a SharePoint list, not a document library.');
    }
    return {
      id,
      title,
      itemCount: toNumber(row.ItemCount),
      baseTemplate: toNumber(row.BaseTemplate),
      webUrl: parsed.webUrl,
      serverRelativeUrl: toStringValue(rootFolder.ServerRelativeUrl) || parsed.serverRelativeUrl
    };
  }

  public async discoverFields(list: IBetterListListReference): Promise<readonly IBetterListFieldInfo[]> {
    const webUrl: string = this._webUrlFor(list);
    const cacheKey = `${webUrl}/${listPath(list)}`.toLocaleLowerCase();
    const cached = this._fieldCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const request = this._discoverFields(list, webUrl);
    this._fieldCache.set(cacheKey, request);
    try {
      return await request;
    } catch (error) {
      this._fieldCache.delete(cacheKey);
      throw error;
    }
  }

  private async _discoverFields(
    list: IBetterListListReference,
    webUrl: string
  ): Promise<readonly IBetterListFieldInfo[]> {
    const select: string = [
      'Id',
      'InternalName',
      'EntityPropertyName',
      'Title',
      'TypeAsString',
      'SchemaXml',
      'Hidden',
      'ReadOnlyField',
      'Required',
      'AllowMultipleValues',
      'LookupList',
      'LookupField'
    ].join(',');
    const url: string =
      `${webUrl}/_api/web/${listPath(list)}/fields` +
      `?$select=${select}&$filter=Hidden eq false&$orderby=Title`;
    const rows: readonly Record<string, unknown>[] = await this._getAllPages(url, webUrl);
    const byInternalName = new Map<string, IBetterListFieldInfo>();
    rows.forEach((row: Record<string, unknown>) => {
      const internalName = toStringValue(row.InternalName);
      if (!internalName) {
        return;
      }
      const schemaXml = toStringValue(row.SchemaXml);
      byInternalName.set(internalName.toLocaleLowerCase(), {
        id: toStringValue(row.Id),
        internalName,
        entityPropertyName: toStringValue(row.EntityPropertyName) || internalName,
        title: toStringValue(row.Title) || internalName,
        typeAsString: toStringValue(row.TypeAsString),
        hidden: toBoolean(row.Hidden),
        readOnly: toBoolean(row.ReadOnlyField),
        required: toBoolean(row.Required),
        allowMultipleValues: toBoolean(row.AllowMultipleValues),
        richText: /\bRichText=(?:"|')TRUE(?:"|')/i.test(schemaXml),
        richTextMode: richTextModeFromSchema(schemaXml),
        lookupListId: toStringValue(row.LookupList) || undefined,
        lookupField: toStringValue(row.LookupField) || undefined
      });
    });
    return Array.from(byInternalName.values());
  }

  public async loadItems(request: IBetterListLoadRequest): Promise<IBetterListLoadResult> {
    const webUrl: string = this._webUrlFor(request.list);
    // Hydrate legacy mappings that predate schema-authored rich-text metadata,
    // plus any authored/stale alias and relationship mappings, against the live schema.
    const fields = mappingsNeedSchemaResolution(request.mappings)
      ? await this.discoverFields(request.list)
      : undefined;
    const mappings = fields ? resolveFieldMappings(request.mappings, fields) : request.mappings;
    const parts: { select: readonly string[]; expand: readonly string[] } = queryParts(mappings);
    const requiredSelect = queryParts({
      title: mappings.title,
      active: mappings.active
    }).select;
    const rows = await this._loadItemsWithUnsupportedFieldRecovery(
      webUrl,
      request.list,
      parts.select,
      parts.expand,
      requiredSelect
    );
    const enrichedRows = await this._resolveOptionalPersonProperties(webUrl, rows, mappings);
    const materializedRows = enrichedRows.map((row) => materializeQueryAliases(row, mappings));
    const identity: IBetterListAudienceIdentity = mappings.audience
      ? await this._loadAudienceIdentity(webUrl)
      : { groupIds: [] };
    const normalized: readonly IBetterListItem[] = materializedRows.map((row: Record<string, unknown>) =>
      normalizeItem(row, mappings)
    );
    return { items: filterVisibleItems(normalized, identity), audienceIdentity: identity };
  }

  private async _loadItemsWithUnsupportedFieldRecovery(
    webUrl: string,
    list: IBetterListListReference,
    initialSelect: readonly string[],
    initialExpand: readonly string[],
    requiredSelect: readonly string[]
  ): Promise<readonly Record<string, unknown>[]> {
    const select = initialSelect.slice();
    const expand = initialExpand.slice();
    const required = new Set(requiredSelect);
    for (let attempt = 0; attempt < initialSelect.length; attempt += 1) {
      const query: string[] = [`$select=${select.join(',')}`, '$top=5000'];
      if (expand.length > 0) {
        query.push(`$expand=${expand.join(',')}`);
      }
      const url = `${webUrl}/_api/web/${listPath(list)}/items?${query.join('&')}`;
      try {
        return await this._getAllPages(url, webUrl);
      } catch (error) {
        const invalid = unsupportedSelectPath(error, select);
        if (!invalid || required.has(invalid)) {
          throw error;
        }
        select.splice(select.indexOf(invalid), 1);
        const relationshipRoot = invalid.indexOf('/') >= 0 ? invalid.split('/')[0] : undefined;
        if (
          relationshipRoot &&
          !select.some((path) => path.indexOf(`${relationshipRoot}/`) === 0)
        ) {
          const expandIndex = expand.indexOf(relationshipRoot);
          if (expandIndex >= 0) expand.splice(expandIndex, 1);
        }
      }
    }
    throw new Error('SharePoint rejected every configured field in the Better List query.');
  }

  private async _resolveOptionalPersonProperties(
    webUrl: string,
    rows: readonly Record<string, unknown>[],
    mappings: IBetterListFieldMappings
  ): Promise<readonly Record<string, unknown>[]> {
    const batchMappings = allMappings(mappings).filter(
      (mapping): mapping is IBetterListPersonFieldMapping =>
        mapping.kind === 'person' &&
        mapping.relationship?.target.resolution === 'userInfoBatch' &&
        Boolean(mapping.relationship.lookupListId)
    );
    if (batchMappings.length === 0) return rows;

    let result = rows.slice();
    const byLookupList = new Map<string, IBetterListPersonFieldMapping[]>();
    batchMappings.forEach((mapping) => {
      const lookupListId = mapping.relationship?.lookupListId;
      if (!lookupListId) return;
      const current = byLookupList.get(lookupListId) || [];
      current.push(mapping);
      byLookupList.set(lookupListId, current);
    });

    for (const [lookupListId, listMappings] of Array.from(byLookupList.entries())) {
      const ids = new Set<number>();
      result.forEach((row) => listMappings.forEach((mapping) => {
        collectRelationshipIds(row[mapping.queryName || mapping.internalName]).forEach((id) => ids.add(id));
      }));
      if (ids.size === 0) continue;

      const targetFields = await this.discoverFields({ id: lookupListId, webUrl });
      const targetAliases = new Map(targetFields.map((field) => [
        field.internalName.toLocaleLowerCase(),
        field.entityPropertyName || field.internalName
      ] as const));
      const resolvedTargets = new Map<IBetterListPersonFieldMapping, IBetterListRelationshipTarget>();
      listMappings.forEach((mapping) => {
        const target = mapping.relationship?.target;
        if (!target) return;
        resolvedTargets.set(mapping, {
          ...target,
          queryName: targetAliases.get(target.internalName.toLocaleLowerCase()) || target.queryName || target.internalName
        });
      });
      const optionalSelect = Array.from(new Set(Array.from(resolvedTargets.values()).map((target) =>
        validatedInternalName(target.queryName || target.internalName)
      )));
      const users = await this._loadUserInformationRows(
        webUrl,
        lookupListId,
        Array.from(ids),
        optionalSelect
      );
      const byId = new Map<number, Record<string, unknown>>();
      users.forEach((user) => {
        const id = Number(user.Id);
        if (Number.isFinite(id)) byId.set(id, user);
      });

      result = result.map((row) => {
        let next = row;
        listMappings.forEach((mapping) => {
          const root = mapping.queryName || mapping.internalName;
          const target = resolvedTargets.get(mapping);
          if (!target) return;
          const enriched = enrichExpandedPersonValue(row[root], byId, target);
          if (enriched !== row[root]) {
            if (next === row) next = { ...row };
            next[root] = enriched;
          }
        });
        return next;
      });
    }
    return result;
  }

  private async _loadUserInformationRows(
    webUrl: string,
    lookupListId: string,
    ids: readonly number[],
    optionalSelect: readonly string[]
  ): Promise<readonly Record<string, unknown>[]> {
    const select = ['Id'].concat(optionalSelect);
    const filter = ids.map((id) => `Id eq ${id}`).join(' or ');
    for (let attempt = 0; attempt < select.length; attempt += 1) {
      const url =
        `${webUrl}/_api/web/lists(guid'${normalizeGuid(lookupListId)}')/items` +
        `?$select=${select.join(',')}&$filter=${filter}&$top=5000`;
      try {
        return await this._getAllPages(url, webUrl);
      } catch (error) {
        const invalid = unsupportedSelectPath(error, select);
        if (!invalid || invalid === 'Id') throw error;
        select.splice(select.indexOf(invalid), 1);
      }
    }
    return [];
  }

  private async _loadAudienceIdentity(webUrl: string): Promise<IBetterListAudienceIdentity> {
    const userUrl: string = `${webUrl}/_api/web/currentuser?$select=Id,Title,Email,LoginName,UserPrincipalName`;
    const groupsUrl: string = `${webUrl}/_api/web/currentuser/groups?$select=Id&$top=5000`;
    const results: [unknown, readonly Record<string, unknown>[]] = await Promise.all([
      this._getJson(userUrl),
      this._getAllPages(groupsUrl, webUrl)
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

  private _webUrlFor(list: IBetterListListReference): string {
    if (!list.webUrl?.trim()) {
      return this._webUrl;
    }
    const candidate: URL = new URL(list.webUrl);
    const base: URL = new URL(this._webUrl);
    if (candidate.protocol !== 'https:' || candidate.origin !== base.origin || candidate.username || candidate.password) {
      throw new Error('The source list web must use HTTPS and belong to this SharePoint tenant.');
    }
    return `${candidate.origin}${candidate.pathname}`.replace(/\/$/, '');
  }

  private async _getAllPages(initialUrl: string, webUrl: string): Promise<readonly Record<string, unknown>[]> {
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
      nextUrl = page.nextLink ? absoluteNextLink(page.nextLink, webUrl) : undefined;
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
