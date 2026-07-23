import {
  mergeGroupOrder,
  moveGroupRow
} from './GroupOrderEditorDialog';

describe('GroupOrderEditorDialog helpers', () => {
  const groups = [
    { key: 'alpha', label: 'Alpha', itemCount: 2 },
    { key: 'beta', label: 'Beta', itemCount: 4 },
    { key: 'gamma', label: 'Gamma', itemCount: 1 }
  ];

  it('merges saved visibility and ordering with newly discovered groups', () => {
    expect(mergeGroupOrder(groups, [
      { key: 'beta', hidden: true },
      { key: 'alpha' }
    ])).toEqual([
      { ...groups[1], hidden: true },
      { ...groups[0], hidden: false },
      { ...groups[2], hidden: false }
    ]);
  });

  it('reorders matching rows without disturbing rows excluded by search', () => {
    const rows = mergeGroupOrder(groups, []);
    expect(moveGroupRow(rows, 'gamma', -1, ['alpha', 'gamma']).map((row) => row.key))
      .toEqual(['gamma', 'beta', 'alpha']);
  });
});
