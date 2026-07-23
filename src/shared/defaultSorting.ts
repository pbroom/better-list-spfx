import type {
  BetterListDefaultSort,
  BetterListViewerSortOption
} from './betterListTypes';
import {
  createBetterListFieldPathCatalog,
  IBetterListFieldDescriptor,
  IBetterListFieldPathOption
} from './fieldMappingAuthoring';

export interface IBetterListDefaultSortOption {
  label: string;
  value: BetterListDefaultSort;
}

export interface IBetterListDefaultSortSelection {
  defaultSort: BetterListDefaultSort;
  defaultSortColumn: string;
}

export const betterListDefaultSortOptions: readonly IBetterListDefaultSortOption[] = [
  { label: 'None (default list order)', value: 'listOrder' },
  { label: 'A to Z', value: 'titleAscending' },
  { label: 'Popularity', value: 'popularity' },
  { label: 'Trending', value: 'trending' },
  { label: 'Recently updated', value: 'recentlyUpdated' },
  { label: 'Column', value: 'column' }
];

export interface IBetterListViewerSortChoice {
  label: string;
  value: BetterListViewerSortOption;
}

export interface IBetterListViewerSortConfiguration {
  version: 2;
  enabled: readonly BetterListViewerSortOption[];
  columns: readonly string[];
}

export const betterListViewerSortChoices: readonly IBetterListViewerSortChoice[] = [
  ...betterListDefaultSortOptions
];

export const defaultBetterListViewerSortOptions: readonly BetterListViewerSortOption[] = [
  'listOrder',
  'titleAscending',
  'popularity',
  'trending',
  'recentlyUpdated'
];

export const betterListPopularityFieldNames: readonly string[] = [
  'ViewsLifeTime',
  'ViewCount',
  'LikesCount',
  '_LikeCount'
];

export const betterListTrendingFieldNames: readonly string[] = [
  'ViewsRecent',
  'ViewsLastWeek',
  'TrendingScore'
];

export function normalizeBetterListDefaultSort(value: unknown): BetterListDefaultSort {
  return betterListDefaultSortOptions.some((option) => option.value === value)
    ? (value as BetterListDefaultSort)
    : 'listOrder';
}

export function normalizeBetterListViewerSortOptions(
  value: unknown
): readonly BetterListViewerSortOption[] {
  return normalizeBetterListViewerSortConfiguration(value).enabled;
}

export function getBetterListViewerSortValueKey(
  mode: BetterListViewerSortOption,
  fieldPath = ''
): string {
  return mode === 'column' ? `column:${fieldPath}` : `mode:${mode}`;
}

export function normalizeBetterListViewerSortConfiguration(
  value: unknown
): IBetterListViewerSortConfiguration {
  let candidate: unknown = value;
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      return createDefaultBetterListViewerSortConfiguration();
    }
  }

  if (Array.isArray(candidate)) {
    return {
      version: 2,
      enabled: normalizeViewerSortModes(candidate),
      columns: []
    };
  }

  if (!isRecord(candidate)) {
    return createDefaultBetterListViewerSortConfiguration();
  }

  if (candidate.version === 1) {
    if (!Array.isArray(candidate.enabled)) {
      return createDefaultBetterListViewerSortConfiguration();
    }
    const migrated = candidate.enabled.map((entry) =>
      entry === 'ascending' ? 'titleAscending' : entry === 'descending' ? undefined : entry
    );
    return {
      version: 2,
      enabled: normalizeViewerSortModes(migrated),
      columns: []
    };
  }

  if (candidate.version !== 2 || !Array.isArray(candidate.enabled)) {
    return createDefaultBetterListViewerSortConfiguration();
  }

  return {
    version: 2,
    enabled: normalizeViewerSortModes(candidate.enabled),
    columns: normalizeViewerSortColumns(candidate.columns)
  };
}

export function serializeBetterListViewerSortOptions(
  enabled: unknown,
  columns?: unknown
): string {
  const configuration = columns === undefined
    ? normalizeBetterListViewerSortConfiguration(enabled)
    : {
        version: 2 as const,
        enabled: normalizeViewerSortModes(enabled),
        columns: normalizeViewerSortColumns(columns)
      };
  return JSON.stringify(configuration);
}

function createDefaultBetterListViewerSortConfiguration(): IBetterListViewerSortConfiguration {
  return {
    version: 2,
    enabled: defaultBetterListViewerSortOptions.slice(),
    columns: []
  };
}

function normalizeViewerSortModes(value: unknown): readonly BetterListViewerSortOption[] {
  const enabled = Array.isArray(value) ? value : [];
  return betterListViewerSortChoices
    .filter((choice) => enabled.indexOf(choice.value) >= 0)
    .map((choice) => choice.value);
}

function normalizeViewerSortColumns(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  return value.reduce<string[]>((columns, entry) => {
    if (typeof entry !== 'string') {
      return columns;
    }
    const column = entry.trim();
    const key = column.toLocaleLowerCase();
    if (!column || seen.has(key)) {
      return columns;
    }
    seen.add(key);
    columns.push(column);
    return columns;
  }, []);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createBetterListSortableFieldOptions(
  fields: readonly IBetterListFieldDescriptor[]
): readonly IBetterListFieldPathOption[] {
  return createBetterListFieldPathCatalog(fields).filter((option) => {
    const field = option.targetField || option.field;
    const type = field.typeAsString.toLocaleLowerCase();
    const sourceIsMultiValue = option.field.allowMultipleValues === true ||
      option.field.typeAsString.toLocaleLowerCase().indexOf('multi') >= 0;
    const supported =
      type.indexOf('text') >= 0 ||
      type.indexOf('choice') >= 0 ||
      type.indexOf('number') >= 0 ||
      type.indexOf('currency') >= 0 ||
      type.indexOf('counter') >= 0 ||
      type.indexOf('date') >= 0 ||
      type.indexOf('boolean') >= 0 ||
      type.indexOf('url') >= 0;
    return supported && !sourceIsMultiValue && field.richText !== true && type.indexOf('note') < 0;
  });
}

export function normalizeBetterListDefaultSortSelection(
  defaultSort: unknown,
  defaultSortColumn: unknown,
  fields: readonly IBetterListFieldDescriptor[]
): IBetterListDefaultSortSelection {
  const mode = normalizeBetterListDefaultSort(defaultSort);
  if (mode !== 'column') {
    return { defaultSort: mode, defaultSortColumn: '' };
  }
  const column = typeof defaultSortColumn === 'string' ? defaultSortColumn : '';
  const available = createBetterListSortableFieldOptions(fields)
    .some((option) => option.fieldPath === column);
  return available
    ? { defaultSort: mode, defaultSortColumn: column }
    : { defaultSort: 'listOrder', defaultSortColumn: '' };
}

export function getBetterListDefaultSortFieldPath(
  mode: BetterListDefaultSort,
  column: string,
  fields: readonly IBetterListFieldDescriptor[]
): string | undefined {
  if (mode === 'column') {
    return column || undefined;
  }
  const names = mode === 'recentlyUpdated'
    ? ['Modified']
    : mode === 'popularity'
      ? betterListPopularityFieldNames
      : mode === 'trending'
        ? betterListTrendingFieldNames
        : [];
  if (names.length === 0) {
    return undefined;
  }
  const normalizedNames = names.map((name) => name.toLocaleLowerCase());
  const field = fields.find((candidate) =>
    normalizedNames.indexOf(candidate.internalName.toLocaleLowerCase()) >= 0 ||
    Boolean(candidate.queryName && normalizedNames.indexOf(candidate.queryName.toLocaleLowerCase()) >= 0)
  );
  return field?.fieldPath || field?.internalName;
}
