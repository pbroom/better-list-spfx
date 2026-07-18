import {
  BetterListFieldSlot,
  BetterListFilter,
  IBetterListGroup,
  IBetterListIconOverride,
  IBetterListLayoutOverride,
  IBetterListSort,
  IBetterListTabConfig
} from './betterListTypes';

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
  throw new Error('A tab filter must be all items or one mapped field-equals-value condition.');
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
