import {
  betterListDefaultSortOptions,
  createBetterListSortableFieldOptions,
  getBetterListDefaultSortFieldPath,
  normalizeBetterListDefaultSort,
  normalizeBetterListDefaultSortSelection
} from './defaultSorting';
import type { IBetterListFieldDescriptor } from './fieldMappingAuthoring';

const fields: readonly IBetterListFieldDescriptor[] = [
  { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
  { internalName: 'Modified', title: 'Modified', typeAsString: 'DateTime' },
  { internalName: 'ViewsLifeTime', title: 'Popularity', typeAsString: 'Number' },
  { internalName: 'ViewsRecent', title: 'Trending', typeAsString: 'Number' },
  { internalName: 'Priority', title: 'Priority', typeAsString: 'Number' },
  { internalName: 'Notes', title: 'Notes', typeAsString: 'Note', richText: true },
  { internalName: 'Tags', title: 'Tags', typeAsString: 'MultiChoice', allowMultipleValues: true }
];

describe('default sorting authoring', () => {
  it('exposes the requested default-sort choices in order', () => {
    expect(betterListDefaultSortOptions).toEqual([
      { label: 'None (default list order)', value: 'listOrder' },
      { label: 'A to Z', value: 'titleAscending' },
      { label: 'Popularity', value: 'popularity' },
      { label: 'Trending', value: 'trending' },
      { label: 'Recently updated', value: 'recentlyUpdated' },
      { label: 'Column (select)...', value: 'column' }
    ]);
  });

  it('normalizes missing or unsupported values to list ordering', () => {
    expect(normalizeBetterListDefaultSort(undefined)).toBe('listOrder');
    expect(normalizeBetterListDefaultSort('unsupported')).toBe('listOrder');
    expect(normalizeBetterListDefaultSort('trending')).toBe('trending');
  });

  it('resolves built-in and authored sort fields', () => {
    expect(getBetterListDefaultSortFieldPath('recentlyUpdated', '', fields)).toBe('Modified');
    expect(getBetterListDefaultSortFieldPath('popularity', '', fields)).toBe('ViewsLifeTime');
    expect(getBetterListDefaultSortFieldPath('trending', '', fields)).toBe('ViewsRecent');
    expect(getBetterListDefaultSortFieldPath('column', 'Priority', fields)).toBe('Priority');
    expect(getBetterListDefaultSortFieldPath('listOrder', '', fields)).toBeUndefined();
  });

  it('offers scalar sortable fields and excludes rich-text and multi-value fields', () => {
    const options = createBetterListSortableFieldOptions(fields);
    expect(options.map((option) => option.fieldPath)).toEqual([
      'Title',
      'Modified',
      'ViewsLifeTime',
      'ViewsRecent',
      'Priority'
    ]);
  });

  it('reconciles unavailable authored columns to list ordering', () => {
    expect(normalizeBetterListDefaultSortSelection('column', 'Priority', fields)).toEqual({
      defaultSort: 'column',
      defaultSortColumn: 'Priority'
    });
    expect(normalizeBetterListDefaultSortSelection('column', 'RemovedColumn', fields)).toEqual({
      defaultSort: 'listOrder',
      defaultSortColumn: ''
    });
    expect(normalizeBetterListDefaultSortSelection('titleAscending', 'Priority', fields)).toEqual({
      defaultSort: 'titleAscending',
      defaultSortColumn: ''
    });
  });
});
