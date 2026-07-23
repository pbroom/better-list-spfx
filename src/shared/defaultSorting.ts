import type { BetterListDefaultSort } from './betterListTypes';
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
  { label: 'List ordering', value: 'listOrder' },
  { label: 'A to Z', value: 'titleAscending' },
  { label: 'Popularity', value: 'popularity' },
  { label: 'Trending', value: 'trending' },
  { label: 'Recently updated', value: 'recentlyUpdated' },
  { label: 'Column (select)...', value: 'column' }
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
