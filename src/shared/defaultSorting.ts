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
  version: 1;
  enabled: readonly BetterListViewerSortOption[];
}

export const betterListViewerSortChoices: readonly IBetterListViewerSortChoice[] = [
  { label: 'A → Z', value: 'ascending' },
  { label: 'Z → A', value: 'descending' }
];

export const defaultBetterListViewerSortOptions: readonly BetterListViewerSortOption[] =
  betterListViewerSortChoices.map((choice) => choice.value);

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
  let candidate = value;
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      return defaultBetterListViewerSortOptions.slice();
    }
  }
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    candidate = (candidate as { enabled?: unknown }).enabled;
  }
  if (!Array.isArray(candidate)) {
    return defaultBetterListViewerSortOptions.slice();
  }
  const enabled = candidate as readonly unknown[];
  return betterListViewerSortChoices
    .filter((choice) => enabled.indexOf(choice.value) >= 0)
    .map((choice) => choice.value);
}

export function serializeBetterListViewerSortOptions(value: unknown): string {
  const configuration: IBetterListViewerSortConfiguration = {
    version: 1,
    enabled: normalizeBetterListViewerSortOptions(value)
  };
  return JSON.stringify(configuration);
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
