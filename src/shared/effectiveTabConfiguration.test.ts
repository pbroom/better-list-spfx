import {
  createBetterListGroupingOverride,
  resolveBetterListTabConfigurations
} from './effectiveTabConfiguration';
import { IBetterListTabConfig } from './betterListTypes';

const legacy = {
  grouping: {
    column: 'Category',
    collapsible: true,
    icons: { version: 1 as const, showIcons: true, overrides: [] }
  },
  itemLayout: {
    itemProperties: ['Title', 'Description'],
    rows: [['Title'], ['Description']],
    links: {}
  }
};

describe('resolveBetterListTabConfigurations', () => {
  it('cascades inherited values and preserves independent override provenance', () => {
    const tabs: readonly IBetterListTabConfig[] = [
      { id: 'one', label: 'One', filter: { kind: 'all' } },
      {
        id: 'two',
        label: 'Two',
        filter: { kind: 'all' },
        groupingOverride: {
          mode: 'custom',
          column: 'Organization/Title',
          collapsible: false,
          icons: { version: 1, showIcons: false, overrides: [] },
          groupOrder: [
            { key: 'organization:42' },
            { key: 'organization:7', hidden: true }
          ],
          filter: {
            kind: 'query',
            expression: 'Organization/Department = Engineering',
            fields: [{
              name: 'Organization/Department',
              kind: 'lookup',
              fieldPath: 'Organization/Department',
              mapping: {
                kind: 'lookup',
                internalName: 'Organization',
                lookupValueField: 'Department'
              }
            }]
          }
        }
      },
      { id: 'three', label: 'Three', filter: { kind: 'all' } }
    ];

    const resolved = resolveBetterListTabConfigurations(tabs, legacy);

    expect(resolved[0].grouping.column).toBe('Category');
    expect(resolved[0].groupingInherited).toBe(true);
    expect(resolved[1].grouping.column).toBe('Organization/Title');
    expect(resolved[1].grouping.collapsible).toBe(false);
    expect(resolved[1].grouping.filter).toMatchObject({
      kind: 'query',
      expression: 'Organization/Department = Engineering'
    });
    expect(resolved[1].grouping.groupOrder).toEqual([
      { key: 'organization:42' },
      { key: 'organization:7', hidden: true }
    ]);
    expect(resolved[1].itemLayoutInherited).toBe(true);
    expect(resolved[2].grouping.column).toBe('Organization/Title');
    expect(resolved[2].grouping.filter).toEqual(resolved[1].grouping.filter);
    expect(resolved[2].grouping.groupOrder).toEqual(resolved[1].grouping.groupOrder);
    expect(resolved[2].inheritedFromTabId).toBe('two');
  });

  it('distinguishes explicit no grouping from inheritance', () => {
    const tabs: readonly IBetterListTabConfig[] = [
      { id: 'one', label: 'One', filter: { kind: 'all' } },
      { id: 'two', label: 'Two', filter: { kind: 'all' }, groupingOverride: { mode: 'none' } },
      { id: 'three', label: 'Three', filter: { kind: 'all' } }
    ];

    const resolved = resolveBetterListTabConfigurations(tabs, legacy);

    expect(resolved[1].grouping.column).toBe('');
    expect(resolved[1].groupingInherited).toBe(false);
    expect(resolved[2].grouping.column).toBe('');
  });

  it('keeps an explicit empty item layout instead of restoring Title', () => {
    const tabs: readonly IBetterListTabConfig[] = [
      {
        id: 'one',
        label: 'One',
        filter: { kind: 'all' },
        itemLayoutOverride: { itemProperties: [], rows: [], links: {} }
      }
    ];

    const [resolved] = resolveBetterListTabConfigurations(tabs, legacy);

    expect(resolved.itemLayout.itemProperties).toEqual([]);
    expect(resolved.itemLayout.rows).toEqual([]);
    expect(resolved.itemLayoutInherited).toBe(false);
  });

  it('cascades item layout overrides independently from grouping overrides', () => {
    const tabs: readonly IBetterListTabConfig[] = [
      { id: 'one', label: 'One', filter: { kind: 'all' } },
      {
        id: 'two',
        label: 'Two',
        filter: { kind: 'all' },
        itemLayoutOverride: {
          itemProperties: ['Title', 'Owner.Title'],
          rows: [['Owner.Title', 'Title']],
          links: { Title: 'ServiceUrl' }
        }
      },
      {
        id: 'three',
        label: 'Three',
        filter: { kind: 'all' },
        groupingOverride: { mode: 'none' }
      }
    ];

    const resolved = resolveBetterListTabConfigurations(tabs, legacy);

    expect(resolved[1].itemLayout.rows).toEqual([['Owner.Title', 'Title']]);
    expect(resolved[2].itemLayout.rows).toEqual([['Owner.Title', 'Title']]);
    expect(resolved[2].itemLayout.links).toEqual({ Title: 'ServiceUrl' });
    expect(resolved[2].itemLayoutInherited).toBe(true);
    expect(resolved[2].groupingInherited).toBe(false);
  });

  it('recomputes inheritance from array order after a source tab is removed', () => {
    const overridden: IBetterListTabConfig = {
      id: 'override',
      label: 'Override',
      filter: { kind: 'all' },
      groupingOverride: { mode: 'custom', column: 'Organization/Title', collapsible: true }
    };
    const inheriting: IBetterListTabConfig = { id: 'inheriting', label: 'Inheriting', filter: { kind: 'all' } };

    const withSource = resolveBetterListTabConfigurations([overridden, inheriting], legacy);
    const withoutSource = resolveBetterListTabConfigurations([inheriting], legacy);

    expect(withSource[1].grouping.column).toBe('Organization/Title');
    expect(withoutSource[0].grouping.column).toBe('Category');
  });

  it('creates explicit none and custom grouping snapshots', () => {
    expect(createBetterListGroupingOverride({ ...legacy.grouping, column: '' })).toEqual({ mode: 'none' });
    expect(createBetterListGroupingOverride(legacy.grouping)).toMatchObject({
      mode: 'custom',
      column: 'Category',
      collapsible: true
    });
  });
});
