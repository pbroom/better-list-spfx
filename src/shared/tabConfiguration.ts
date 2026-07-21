import {
  BetterListFieldSlot,
  BetterListFieldMapping,
  BetterListFilter,
  BetterListTabIcon,
  IBetterListGroup,
  IBetterListFieldMappings,
  IBetterListIconOverride,
  IBetterListLayoutOverride,
  IBetterListQueryField,
  IBetterListSort,
  IBetterListTabConfig
} from './betterListTypes';
import { normalizeBetterListIconOverride } from './groupIconConfiguration';

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

function isFieldSlot(value: unknown): value is BetterListFieldSlot {
  return typeof value === 'string' && FIELD_SLOTS.indexOf(value as BetterListFieldSlot) >= 0;
}

function isFieldKind(value: unknown): value is IBetterListQueryField['kind'] {
  return value === 'text' || value === 'number' || value === 'boolean' || value === 'dateTime' || value === 'url' || value === 'lookup' || value === 'person';
}

function readQueryField(value: unknown): IBetterListQueryField {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim() || !isFieldKind(value.kind)) {
    throw new Error('Each query field must include a name and supported field type.');
  }
  if (isFieldSlot(value.field)) {
    return { name: value.name.trim(), kind: value.kind, field: value.field };
  }
  if (typeof value.fieldPath === 'string' && value.fieldPath.trim()) {
    const mapping = readSourceMapping(value.mapping);
    return {
      name: value.name.trim(),
      kind: mapping.kind,
      fieldPath: value.fieldPath.trim(),
      mapping
    };
  }
  throw new Error('Each query field must reference a mapped or source field.');
}

function readFilter(value: unknown): BetterListFilter {
  if (value === undefined || value === null || (isRecord(value) && value.kind === 'all')) {
    return { kind: 'all' };
  }
  if (!isRecord(value)) {
    throw new Error('A tab filter must be all items or one mapped field-equals-value condition.');
  }
  if (
    value.kind === 'equals' &&
    isFieldSlot(value.field) &&
    (value.value === null || ['string', 'number', 'boolean'].indexOf(typeof value.value) >= 0)
  ) {
    return {
      kind: 'equals',
      field: value.field,
      value: value.value as string | number | boolean | null
    };
  }
  if (
    value.kind === 'sourceEquals' &&
    typeof value.fieldPath === 'string' &&
    value.fieldPath.trim() &&
    (value.value === null || ['string', 'number', 'boolean'].indexOf(typeof value.value) >= 0)
  ) {
    return {
      kind: 'sourceEquals',
      fieldPath: value.fieldPath.trim(),
      mapping: readSourceMapping(value.mapping),
      value: value.value as string | number | boolean | null
    };
  }
  if (value.kind === 'query' && typeof value.expression === 'string' && value.expression.trim() && Array.isArray(value.fields)) {
    const fields = value.fields.map(readQueryField);
    return { kind: 'query', expression: value.expression, fields };
  }
  throw new Error('A tab filter must be all items or one field-equals-value condition.');
}

function readSourceMapping(value: unknown): BetterListFieldMapping {
  if (!isRecord(value) || typeof value.internalName !== 'string' || !value.internalName.trim()) {
    throw new Error('A source-field tab filter must include a valid field mapping.');
  }
  const displayName = typeof value.displayName === 'string' ? value.displayName : undefined;
  const common = { internalName: value.internalName.trim(), displayName };
  if (value.kind === 'text' || value.kind === 'number' || value.kind === 'boolean' || value.kind === 'dateTime') {
    return { ...common, kind: value.kind };
  }
  if (value.kind === 'url') {
    return {
      ...common,
      kind: 'url',
      valueProperty: value.valueProperty === 'description' ? 'description' : 'url'
    };
  }
  if (value.kind === 'lookup') {
    return {
      ...common,
      kind: 'lookup',
      valueProperty: value.valueProperty === 'id' ? 'id' : 'title',
      lookupValueField: typeof value.lookupValueField === 'string' ? value.lookupValueField : undefined,
      multi: value.multi === true
    };
  }
  if (value.kind === 'person') {
    const valueProperty =
      value.valueProperty === 'id' ||
      value.valueProperty === 'email' ||
      value.valueProperty === 'loginName'
        ? value.valueProperty
        : 'title';
    return { ...common, kind: 'person', valueProperty, multi: value.multi === true };
  }
  throw new Error('A source-field tab filter must use a supported field type.');
}

function readGroup(value: unknown): IBetterListGroup | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value) || !isFieldSlot(value.field)) {
    throw new Error('A tab group must reference a mapped Better List field.');
  }
  return {
    field: value.field,
    direction: value.direction === 'descending' ? 'descending' : 'ascending',
    ungroupedLabel: typeof value.ungroupedLabel === 'string' ? value.ungroupedLabel : undefined
  };
}

function readSort(value: unknown): readonly IBetterListSort[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error('A tab sort override must be an array.');
  }
  return value.map((candidate: unknown): IBetterListSort => {
    if (!isRecord(candidate) || !isFieldSlot(candidate.field)) {
      throw new Error('Each sort entry must reference a mapped Better List field.');
    }
    const mode: IBetterListSort['mode'] =
      candidate.mode === 'text' || candidate.mode === 'number' || candidate.mode === 'dateTime'
        ? candidate.mode
        : 'auto';
    return {
      field: candidate.field,
      direction: candidate.direction === 'descending' ? 'descending' : 'ascending',
      mode,
      nulls: candidate.nulls === 'first' ? 'first' : 'last'
    };
  });
}

function readIcon(value: unknown): IBetterListIconOverride | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value) || (value.mode !== 'none' && value.mode !== 'field' && value.mode !== 'fixed')) {
    throw new Error('A tab icon override must use none, field, or fixed mode.');
  }
  if (value.mode === 'field' && !isFieldSlot(value.field)) {
    throw new Error('A field icon override must reference a mapped Better List field.');
  }
  if (value.mode === 'fixed' && typeof value.value !== 'string') {
    throw new Error('A fixed icon override must supply an icon value.');
  }
  return {
    mode: value.mode,
    field: isFieldSlot(value.field) ? value.field : undefined,
    value: typeof value.value === 'string' ? value.value : undefined
  };
}

function readLayout(value: unknown): IBetterListLayoutOverride | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error('A tab layout override must be an object.');
  }
  const columns: 1 | 2 | 3 | undefined =
    value.columns === 1 || value.columns === 2 || value.columns === 3 ? value.columns : undefined;
  return {
    columns,
    density: value.density === 'compact' || value.density === 'comfortable' ? value.density : undefined,
    collapsible: typeof value.collapsible === 'boolean' ? value.collapsible : undefined,
    initiallyExpanded: typeof value.initiallyExpanded === 'boolean' ? value.initiallyExpanded : undefined,
    showDescriptions: typeof value.showDescriptions === 'boolean' ? value.showDescriptions : undefined,
    showSearch: typeof value.showSearch === 'boolean' ? value.showSearch : undefined
  };
}

function readTabIcon(value: unknown): BetterListTabIcon | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === 'list' || value === 'communications' || value === 'policy' || value === 'support') {
    return value;
  }
  throw new Error('A tab icon must use one of the supported Better List icons.');
}

function readMaxItems(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  throw new Error('A tab maximum item count must be a positive integer.');
}

function readTab(value: unknown, index: number): IBetterListTabConfig {
  if (!isRecord(value)) {
    throw new Error(`Tab ${index + 1} must be an object.`);
  }
  const id: string = typeof value.id === 'string' ? value.id.trim() : '';
  const label: string = typeof value.label === 'string' ? value.label.trim() : '';
  if (!id || !label) {
    throw new Error(`Tab ${index + 1} must have a non-empty id and label.`);
  }
  return {
    id,
    label,
    filter: readFilter(value.filter),
    tabIcon: readTabIcon(value.tabIcon),
    tabIconOverride: normalizeBetterListIconOverride(value.tabIconOverride),
    showItemCount: value.showItemCount === true,
    maxItems: readMaxItems(value.maxItems),
    group: readGroup(value.group),
    sort: readSort(value.sort),
    icon: readIcon(value.icon),
    layout: readLayout(value.layout)
  };
}

export function parseTabConfiguration(serialized: string | undefined): readonly IBetterListTabConfig[] {
  if (!serialized || !serialized.trim()) {
    return createDefaultTabs();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (error) {
    const detail: string = error instanceof Error ? error.message : String(error);
    throw new Error(`The Better List tab configuration is not valid JSON: ${detail}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('The Better List tab configuration must contain at least one tab.');
  }
  const tabs: readonly IBetterListTabConfig[] = parsed.map(readTab);
  const ids: Set<string> = new Set<string>();
  tabs.forEach((tab: IBetterListTabConfig) => {
    const key: string = tab.id.toLocaleLowerCase();
    if (ids.has(key)) {
      throw new Error(`Tab ids must be unique; "${tab.id}" is duplicated.`);
    }
    ids.add(key);
  });
  return tabs;
}

export function serializeTabConfiguration(tabs: readonly IBetterListTabConfig[]): string {
  if (tabs.length === 0) {
    throw new Error('Better List requires at least one tab.');
  }
  return JSON.stringify(tabs);
}

export function alignTabQueryFieldKinds(
  tab: IBetterListTabConfig,
  mappings: Partial<IBetterListFieldMappings>
): IBetterListTabConfig {
  if (tab.filter.kind !== 'query') {
    return tab;
  }
  const fields = tab.filter.fields.map((field) => {
    const currentKind = field.field ? mappings[field.field]?.kind : field.mapping?.kind;
    return currentKind && currentKind !== field.kind ? { ...field, kind: currentKind } : field;
  });
  return { ...tab, filter: { ...tab.filter, fields } };
}

export function createDefaultTabs(): readonly IBetterListTabConfig[] {
  return [
    {
      id: 'all',
      label: 'All items',
      filter: { kind: 'all' },
      sort: [{ field: 'sortOrder', direction: 'ascending', mode: 'number', nulls: 'last' }],
      icon: { mode: 'none' },
      layout: { columns: 2, collapsible: false, initiallyExpanded: true, showDescriptions: true, showSearch: true }
    }
  ];
}

export function addTabFilterMappings(
  mappings: IBetterListFieldMappings,
  tabs: readonly IBetterListTabConfig[]
): IBetterListFieldMappings {
  const filterFields = tabs.reduce((collected: BetterListFieldMapping[], tab): BetterListFieldMapping[] => {
    if (tab.filter.kind === 'sourceEquals') {
      collected.push(tab.filter.mapping);
    } else if (tab.filter.kind === 'query') {
      tab.filter.fields.forEach((field) => {
        if (field.mapping) {
          collected.push(field.mapping);
        }
      });
    }
    return collected;
  }, []);
  const uniqueFilterFields = filterFields.filter(
    (mapping, index) => filterFields.findIndex((candidate) => candidate.internalName === mapping.internalName && candidate.kind === mapping.kind) === index
  );
  return uniqueFilterFields.length > 0 ? { ...mappings, filterFields: uniqueFilterFields } : mappings;
}
