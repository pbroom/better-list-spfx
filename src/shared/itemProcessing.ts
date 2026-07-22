/* eslint-disable @rushstack/no-new-null */

import {
  BetterListComparableValue,
  BetterListFieldMapping,
  BetterListFieldSlot,
  BetterListFieldValue,
  BetterListFilter,
  IBetterListAudienceIdentity,
  IBetterListAudiencePrincipal,
  IBetterListFieldMappings,
  IBetterListGroup,
  IBetterListGroupResult,
  IBetterListItem,
  IBetterListMetadataValue,
  IBetterListQueryField,
  IBetterListSort,
  IBetterListTabConfig
} from './betterListTypes';
import { compileBetterListFilterQuery } from './filterQuery';
import { parseBetterListFieldPath } from './fieldMappingAuthoring';
import { formatItemPropertyValue, readItemPropertyValue } from './itemPropertyConfiguration';
import { toPlainText } from './plainText';

const FIELD_SLOTS: readonly BetterListFieldSlot[] = [
  'title',
  'description',
  'url',
  'urlLabel',
  'category',
  'organization',
  'organizationShortName',
  'featured',
  'sortOrder',
  'active',
  'audience',
  'icon',
  'tab',
  'group'
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapCollection(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value.results)) {
    return value.results;
  }
  return value === undefined || value === null ? [] : [value];
}

function scalar(value: unknown): BetterListComparableValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

function property(value: unknown, names: readonly string[]): unknown {
  if (!isRecord(value)) {
    return undefined;
  }
  for (const name of names) {
    if (value[name] !== undefined && value[name] !== null) {
      return value[name];
    }
  }
  return undefined;
}

export function normalizeFieldValue(value: unknown, mapping: BetterListFieldMapping): BetterListFieldValue {
  const normalized = normalizeRawFieldValue(value, mapping);
  return mapping.richText ? normalizeRichTextValue(normalized) : normalized;
}

function normalizeRawFieldValue(value: unknown, mapping: BetterListFieldMapping): BetterListFieldValue {
  if (mapping.kind === 'url') {
    const key: string = mapping.valueProperty === 'description' ? 'Description' : 'Url';
    const normalized = scalar(isRecord(value) ? property(value, [key, key.toLocaleLowerCase()]) : value);
    return mapping.valueProperty === 'description' && typeof normalized === 'string'
      ? toPlainText(normalized)
      : normalized;
  }
  if (mapping.kind === 'lookup') {
    const values: readonly unknown[] = unwrapCollection(value);
    const normalized: readonly BetterListComparableValue[] = values.map((entry: unknown) => {
      if (mapping.valueProperty === 'id') {
        return scalar(property(entry, ['Id', 'ID', 'id']));
      }
      const lookupValueField: string = mapping.lookupValueField || 'Title';
      const candidate = property(entry, [lookupValueField, 'Title', 'LookupValue', 'title']);
      return scalar(candidate ?? (isRecord(entry) ? undefined : entry));
    }).filter(isPresentComparableValue);
    return mapping.multi || normalized.length > 1 ? normalized : normalized[0] ?? null;
  }
  if (mapping.kind === 'person') {
    const values: readonly unknown[] = unwrapCollection(value);
    const normalized: readonly BetterListComparableValue[] = values.map((entry: unknown) => {
      const targetField = mapping.personValueField ||
        mapping.relationship?.target.internalName ||
        mapping.lookupValueField;
      const normalizedTarget = targetField?.toLocaleLowerCase();
      if (
        targetField &&
        normalizedTarget !== 'id' &&
        normalizedTarget !== 'title' &&
        normalizedTarget !== 'email' &&
        normalizedTarget !== 'loginname' &&
        normalizedTarget !== 'name'
      ) {
        return scalar(property(entry, [
          targetField,
          mapping.personValueQueryName || mapping.lookupValueQueryName || targetField
        ]));
      }
      if (mapping.valueProperty === 'id') {
        return scalar(property(entry, ['Id', 'ID', 'id']));
      }
      if (mapping.valueProperty === 'email') {
        return scalar(property(entry, ['EMail', 'Email', 'email']));
      }
      if (mapping.valueProperty === 'loginName') {
        return scalar(property(entry, ['LoginName', 'Name', 'loginName']));
      }
      const candidate = property(entry, ['Title', 'title', 'LookupValue']);
      return scalar(candidate ?? (isRecord(entry) ? undefined : entry));
    }).filter(isPresentComparableValue);
    return mapping.multi || normalized.length > 1 ? normalized : normalized[0] ?? null;
  }
  if (mapping.kind === 'number') {
    const numberValue: number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  if (mapping.kind === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const text: string = value.trim().toLocaleLowerCase();
      if (text === 'true' || text === 'yes' || text === '1') {
        return true;
      }
      if (text === 'false' || text === 'no' || text === '0' || text === '') {
        return false;
      }
    }
    return null;
  }
  if (mapping.kind === 'dateTime') {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return typeof value === 'string' || typeof value === 'number' ? value : null;
  }
  const normalized = scalar(value);
  return normalized;
}

function isPresentComparableValue(value: BetterListComparableValue): boolean {
  return value !== null && value !== '';
}

function normalizeRichTextValue(value: BetterListFieldValue): BetterListFieldValue {
  if (Array.isArray(value)) {
    return value.map((entry) => typeof entry === 'string' ? toPlainText(entry) : entry);
  }
  return typeof value === 'string' ? toPlainText(value) : value;
}

export function normalizeAudiencePrincipals(value: unknown): readonly IBetterListAudiencePrincipal[] {
  return unwrapCollection(value)
    .map((entry: unknown): IBetterListAudiencePrincipal | undefined => {
      if (typeof entry === 'number') {
        return { id: entry };
      }
      if (typeof entry === 'string') {
        return { title: entry, loginName: entry };
      }
      if (!isRecord(entry)) {
        return undefined;
      }
      const rawId: unknown = property(entry, ['Id', 'ID', 'id', 'LookupId']);
      const id: number | undefined = typeof rawId === 'number' ? rawId : Number.isFinite(Number(rawId)) ? Number(rawId) : undefined;
      const rawPrincipalType: unknown = property(entry, ['PrincipalType', 'principalType']);
      const principalType: number | undefined =
        typeof rawPrincipalType === 'number'
          ? rawPrincipalType
          : Number.isFinite(Number(rawPrincipalType))
            ? Number(rawPrincipalType)
            : undefined;
      return {
        id,
        title: toOptionalString(property(entry, ['Title', 'title', 'LookupValue'])),
        email: toOptionalString(property(entry, ['EMail', 'Email', 'email'])),
        loginName: toOptionalString(property(entry, ['LoginName', 'Name', 'loginName'])),
        principalType
      };
    })
    .filter((entry: IBetterListAudiencePrincipal | undefined): entry is IBetterListAudiencePrincipal => !!entry);
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const text: string = String(value).trim();
  return text || undefined;
}

function firstValue(value: BetterListFieldValue | undefined): BetterListComparableValue | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value as BetterListComparableValue | undefined;
}

function asString(value: BetterListFieldValue | undefined): string | undefined {
  const first: BetterListComparableValue | undefined = firstValue(value);
  return first === undefined || first === null ? undefined : String(first);
}

function asBoolean(value: BetterListFieldValue | undefined, fallback: boolean): boolean {
  const first: BetterListComparableValue | undefined = firstValue(value);
  return typeof first === 'boolean' ? first : fallback;
}

function asNumber(value: BetterListFieldValue | undefined): number | undefined {
  const first: BetterListComparableValue | undefined = firstValue(value);
  const result: number = typeof first === 'number' ? first : Number(first);
  return Number.isFinite(result) ? result : undefined;
}

export function normalizeItem(
  source: Readonly<Record<string, unknown>>,
  mappings: IBetterListFieldMappings
): IBetterListItem {
  const values: Partial<Record<BetterListFieldSlot, BetterListFieldValue>> = {};
  FIELD_SLOTS.forEach((slot: BetterListFieldSlot) => {
    const mapping: BetterListFieldMapping | undefined = mappings[slot];
    if (mapping) {
      const normalized = normalizeFieldValue(source[mapping.internalName], mapping);
      values[slot] = normalized;
    }
  });

  const title: string = asString(values.title) || 'Untitled item';
  const audienceValue: unknown = mappings.audience ? source[mappings.audience.internalName] : undefined;
  const hyperlink: unknown = mappings.url ? source[mappings.url.internalName] : undefined;
  const derivedUrlLabel: string | undefined = isRecord(hyperlink)
    ? toOptionalString(property(hyperlink, ['Description', 'description']))
    : undefined;
  const rawId: unknown = source.Id ?? source.ID ?? source.id;
  const id: number | string =
    typeof rawId === 'number' || typeof rawId === 'string' ? rawId : `item-${title}`;

  return {
    id,
    title,
    description: asString(values.description),
    url: asString(values.url),
    urlLabel: asString(values.urlLabel) || derivedUrlLabel,
    featured: asBoolean(values.featured, false),
    sortOrder: asNumber(values.sortOrder),
    active: mappings.active ? asBoolean(values.active, false) : true,
    audience: normalizeAudiencePrincipals(audienceValue),
    metadata: (mappings.metadata || []).map((entry): IBetterListMetadataValue => ({
      key: entry.key,
      label: entry.label,
      value: normalizeFieldValue(source[entry.mapping.internalName], entry.mapping)
    })),
    values,
    source
  };
}

function normalizedComparable(value: BetterListComparableValue): string | number | boolean | null {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : value;
}

function equals(value: BetterListFieldValue | undefined, expected: BetterListComparableValue): boolean {
  const values: readonly BetterListComparableValue[] = Array.isArray(value) ? value : [value ?? null];
  const normalizedExpected: string | number | boolean | null = normalizedComparable(expected);
  return values.some((candidate: BetterListComparableValue) => normalizedComparable(candidate) === normalizedExpected);
}

export function itemMatchesFilter(item: IBetterListItem, filter: BetterListFilter): boolean {
  return createFilterMatcher(filter)(item);
}

export function sourceMatchesFilter(
  source: Readonly<Record<string, unknown>>,
  filter: BetterListFilter
): boolean {
  if (filter.kind === 'all') {
    return true;
  }
  if (filter.kind === 'query') {
    const query = compileBetterListFilterQuery(filter.expression, filter.fields);
    return Boolean(query?.((field) =>
      field.mapping ? normalizeFieldValue(source[field.mapping.internalName], field.mapping) : undefined
    ));
  }
  if (filter.kind === 'sourceEquals') {
    return equals(normalizeFieldValue(source[filter.mapping.internalName], filter.mapping), filter.value);
  }
  return false;
}

function queryFieldValue(item: IBetterListItem, field: IBetterListQueryField): BetterListFieldValue | undefined {
  if (field.field) {
    return item.values[field.field];
  }
  return field.mapping ? normalizeFieldValue(item.source[field.mapping.internalName], field.mapping) : undefined;
}

function createFilterMatcher(filter: BetterListFilter): (item: IBetterListItem) => boolean {
  if (filter.kind === 'all') {
    return () => true;
  }
  if (filter.kind === 'query') {
    const query = compileBetterListFilterQuery(filter.expression, filter.fields);
    return query ? (item) => query((field) => queryFieldValue(item, field)) : () => false;
  }
  if (filter.kind === 'sourceEquals') {
    return (item) => equals(normalizeFieldValue(item.source[filter.mapping.internalName], filter.mapping), filter.value);
  }
  return (item) => equals(item.values[filter.field], filter.value);
}

function canonicalIdentity(value: string | undefined): string | undefined {
  return value ? value.trim().toLocaleLowerCase() : undefined;
}

export function isItemVisibleToAudience(
  item: IBetterListItem,
  identity: IBetterListAudienceIdentity
): boolean {
  if (item.audience.length === 0) {
    return true;
  }
  const allowedIds: Set<number> = new Set<number>(identity.groupIds);
  if (identity.userId !== undefined) {
    allowedIds.add(identity.userId);
  }
  const loginName: string | undefined = canonicalIdentity(identity.loginName);
  const email: string | undefined = canonicalIdentity(identity.email);
  return item.audience.some((principal: IBetterListAudiencePrincipal) => {
    if (principal.id !== undefined && allowedIds.has(principal.id)) {
      return true;
    }
    const principalLogin: string | undefined = canonicalIdentity(principal.loginName);
    const principalEmail: string | undefined = canonicalIdentity(principal.email);
    return (!!loginName && principalLogin === loginName) || (!!email && (principalEmail === email || principalLogin === email));
  });
}

export function filterVisibleItems(
  items: readonly IBetterListItem[],
  identity: IBetterListAudienceIdentity
): readonly IBetterListItem[] {
  return items.filter((item: IBetterListItem) => item.active && isItemVisibleToAudience(item, identity));
}

export function searchItems(items: readonly IBetterListItem[], query: string): readonly IBetterListItem[] {
  const needle: string = query.trim().toLocaleLowerCase();
  if (!needle) {
    return items;
  }
  return items.filter((item: IBetterListItem) => {
    const searchable: readonly (BetterListFieldValue | undefined)[] = [
      item.values.title,
      item.values.description,
      item.values.category,
      item.values.organization,
      item.values.organizationShortName
    ];
    return searchable.some((value: BetterListFieldValue | undefined) => {
      const values: readonly BetterListComparableValue[] = Array.isArray(value) ? value : [value ?? null];
      return values.some((entry: BetterListComparableValue) =>
        entry !== null && String(entry).toLocaleLowerCase().indexOf(needle) >= 0
      );
    });
  });
}

function compareValues(
  left: BetterListFieldValue | undefined,
  right: BetterListFieldValue | undefined,
  sort: IBetterListSort
): number {
  const a: BetterListComparableValue | undefined = firstValue(left);
  const b: BetterListComparableValue | undefined = firstValue(right);
  const aEmpty: boolean = a === undefined || a === null || a === '';
  const bEmpty: boolean = b === undefined || b === null || b === '';
  if (aEmpty || bEmpty) {
    if (aEmpty && bEmpty) {
      return 0;
    }
    const emptyResult: number = sort.nulls === 'first' ? -1 : 1;
    return aEmpty ? emptyResult : -emptyResult;
  }
  if (sort.mode === 'number') {
    return Number(a) - Number(b);
  }
  if (sort.mode === 'dateTime') {
    return new Date(String(a)).getTime() - new Date(String(b)).getTime();
  }
  if (sort.mode === 'auto' && typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (sort.mode === 'auto' && typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortItems(
  items: readonly IBetterListItem[],
  sorts: readonly IBetterListSort[] | undefined
): readonly IBetterListItem[] {
  const effectiveSorts: readonly IBetterListSort[] = sorts && sorts.length > 0
    ? sorts
    : [{ field: 'sortOrder', direction: 'ascending', mode: 'number', nulls: 'last' }];
  return items.slice().sort((left: IBetterListItem, right: IBetterListItem): number => {
    for (const sort of effectiveSorts) {
      const leftValue: BetterListComparableValue | undefined = firstValue(left.values[sort.field]);
      const rightValue: BetterListComparableValue | undefined = firstValue(right.values[sort.field]);
      const leftEmpty: boolean = leftValue === undefined || leftValue === null || leftValue === '';
      const rightEmpty: boolean = rightValue === undefined || rightValue === null || rightValue === '';
      if (leftEmpty !== rightEmpty) {
        return leftEmpty === (sort.nulls !== 'first') ? 1 : -1;
      }
      const comparison: number = compareValues(left.values[sort.field], right.values[sort.field], sort);
      if (comparison !== 0 && Number.isFinite(comparison)) {
        return sort.direction === 'descending' ? -comparison : comparison;
      }
    }
    const titleComparison: number = left.title.localeCompare(right.title, undefined, { numeric: true, sensitivity: 'base' });
    return titleComparison !== 0 ? titleComparison : String(left.id).localeCompare(String(right.id));
  });
}

export function groupItems(
  items: readonly IBetterListItem[],
  group: IBetterListGroup | undefined
): readonly IBetterListGroupResult[] {
  if (!group) {
    return [{ key: 'all', label: '', items }];
  }
  const ungroupedLabel: string = group.ungroupedLabel || 'Other';
  const buckets: Map<string, { label: string; sortLabel: string; items: IBetterListItem[] }> = new Map();
  items.forEach((item: IBetterListItem) => {
    const sortLabel: string = asString(item.values[group.field]) || ungroupedLabel;
    const label: string = stripSortPrefix(sortLabel);
    const key: string = label.trim().toLocaleLowerCase() || '__ungrouped__';
    const bucket: { label: string; sortLabel: string; items: IBetterListItem[] } | undefined = buckets.get(key);
    if (bucket) {
      bucket.items.push(item);
    } else {
      buckets.set(key, { label, sortLabel, items: [item] });
    }
  });
  const direction: number = group.direction === 'descending' ? -1 : 1;
  return Array.from(buckets.entries())
    .sort((left, right) => direction * left[1].sortLabel.localeCompare(right[1].sortLabel, undefined, { numeric: true, sensitivity: 'base' }))
    .map(([key, bucket]) => ({ key, label: bucket.label, items: bucket.items }));
}

export function groupItemsBySourceField(
  items: readonly IBetterListItem[],
  fieldPath: string,
  filter: BetterListFilter = { kind: 'all' },
  ungroupedLabel: string = 'Other',
  richText: boolean = false
): readonly IBetterListGroupResult[] {
  const root = parseBetterListFieldPath(fieldPath).source;
  const buckets = new Map<string, {
    label: string;
    sortLabel: string;
    source: Readonly<Record<string, unknown>>;
    items: IBetterListItem[];
  }>();

  items.forEach((item) => {
    const rootValue = readItemPropertyValue(item.source, root);
    const memberships = unwrapCollection(rootValue);
    const effectiveMemberships = memberships.length > 0 ? memberships : [undefined];
    const normalizedGroupValue = item.metadata.find((entry) => entry.key === fieldPath)?.value;
    const normalizedMemberships = normalizedGroupValue === undefined ? [] : unwrapCollection(normalizedGroupValue);
    const itemMemberships = new Set<string>();

    effectiveMemberships.forEach((membership, membershipIndex) => {
      const source = { [root]: membership } as Readonly<Record<string, unknown>>;
      const normalizedMembership = normalizedMemberships[membershipIndex];
      const sortLabel = (
        normalizedMembership === undefined
          ? formatItemPropertyValue(source, fieldPath, richText)
          : formatItemPropertyValue({ value: normalizedMembership }, 'value')
      ) || ungroupedLabel;
      const label = stripSortPrefix(sortLabel);
      const key = groupMembershipKey(root, membership, label);
      if (itemMemberships.has(key)) {
        return;
      }
      itemMemberships.add(key);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.items.push(item);
      } else {
        buckets.set(key, { label, sortLabel, source, items: [item] });
      }
    });
  });

  return Array.from(buckets.entries())
    .filter(([, bucket]) => sourceMatchesFilter(bucket.source, filter))
    .sort((left, right) => left[1].sortLabel.localeCompare(right[1].sortLabel, undefined, {
      numeric: true,
      sensitivity: 'base'
    }))
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      items: bucket.items,
      source: bucket.source
    }));
}

function groupMembershipKey(root: string, membership: unknown, label: string): string {
  if (isRecord(membership)) {
    const identity = property(membership, ['Id', 'ID', 'id', 'LookupId']);
    if (identity !== undefined && identity !== null && identity !== '') {
      return `${root.toLocaleLowerCase()}:${String(identity).toLocaleLowerCase()}`;
    }
  }
  return label.trim().toLocaleLowerCase() || '__ungrouped__';
}

function stripSortPrefix(value: string): string {
  const match: RegExpMatchArray | null = value.match(/^\s*\d+(?:\.\d+)?\s*\|\s*(.+)$/);
  return match?.[1]?.trim() || value;
}

export function processItems(
  items: readonly IBetterListItem[],
  tab: IBetterListTabConfig,
  query: string = ''
): readonly IBetterListItem[] {
  const matchesFilter = createFilterMatcher(tab.filter);
  return sortItems(
    searchItems(items.filter((item: IBetterListItem) => item.active && matchesFilter(item)), query),
    tab.sort
  );
}
