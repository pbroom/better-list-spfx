import * as React from 'react';
import * as ReactDom from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import {
  GroupOrderEditorDialog,
  mergeGroupOrder,
  moveGroupRow,
  serializeGroupOrder
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

  it('preserves undiscovered persisted groups when applying dialog edits', async () => {
    const container = document.createElement('div');
    const onApply = jest.fn();
    const onOpenChange = jest.fn();
    const value = [
      { key: 'alpha' },
      { key: 'temporarily-absent', hidden: true },
      { key: 'beta', hidden: true }
    ];

    await act(async () => {
      ReactDom.render(
        React.createElement(GroupOrderEditorDialog, {
          groups: groups.slice(0, 2),
          value,
          onApply,
          onOpenChange
        }),
        container
      );
      await Promise.resolve();
    });
    const applyButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Apply'
    );
    expect(applyButton).toBeDefined();

    await act(async () => {
      Simulate.click(applyButton as HTMLButtonElement);
    });

    expect(onApply).toHaveBeenCalledWith(value);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    ReactDom.unmountComponentAtNode(container);
  });

  it('keeps undiscovered entries anchored while discovered groups are reordered', () => {
    const rows = moveGroupRow(
      mergeGroupOrder(groups.slice(0, 2), [{ key: 'alpha' }, { key: 'beta' }]),
      'beta',
      -1,
      ['alpha', 'beta']
    );
    expect(serializeGroupOrder(rows, [
      { key: 'alpha' },
      { key: 'temporarily-absent', hidden: true },
      { key: 'beta' }
    ])).toEqual([
      { key: 'beta' },
      { key: 'temporarily-absent', hidden: true },
      { key: 'alpha' }
    ]);
  });
});
