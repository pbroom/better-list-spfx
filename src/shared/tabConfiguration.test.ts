import {
  addTabFilterMappings,
  alignTabQueryFieldKinds,
  createDefaultTabs,
  parseTabConfiguration,
  serializeTabConfiguration
} from './tabConfiguration';
import { createBetterListLoadSignature } from './authoringLoadSignature';
import { IBetterListTabConfig } from './betterListTypes';

describe('Better List tab configuration', () => {
  it('parses and serializes tab-scoped grouping and item-layout overrides', () => {
    const serialized = JSON.stringify([
      {
        id: 'custom',
        label: 'Custom',
        filter: { kind: 'all' },
        groupingOverride: {
          mode: 'custom',
          column: 'Organization/Title',
          collapsible: false,
          icons: { version: 1, showIcons: false, overrides: [] },
          filter: {
            kind: 'query',
            expression: 'Department = Research',
            fields: [{
              name: 'Department',
              kind: 'person',
              fieldPath: 'Organization/Department',
              mapping: {
                kind: 'person',
                internalName: 'Organization',
                fieldPath: 'Organization/Department',
                sourceInternalName: 'Organization',
                queryName: 'OrganizationEntity',
                personValueField: 'Department',
                personValueQueryName: 'DepartmentAlias',
                relationship: {
                  kind: 'person',
                  target: {
                    internalName: 'Department',
                    label: 'Department',
                    kind: 'text',
                    queryName: 'DepartmentAlias',
                    queryable: false,
                    resolution: 'userInfoBatch'
                  }
                }
              }
            }]
          }
        },
        itemLayoutOverride: {
          itemProperties: ['Title', 'Description'],
          rows: [['Description'], ['Title']],
          links: { Title: 'URL' }
        }
      },
      {
        id: 'ungrouped',
        label: 'Ungrouped',
        filter: { kind: 'all' },
        groupingOverride: { mode: 'none' }
      }
    ]);

    const tabs = parseTabConfiguration(serialized);

    expect(tabs[0].groupingOverride).toMatchObject({
      mode: 'custom',
      column: 'Organization/Title',
      collapsible: false,
      filter: {
        kind: 'query',
        expression: 'Department = Research',
        fields: [{
          fieldPath: 'Organization/Department',
          mapping: {
            fieldPath: 'Organization/Department',
            sourceInternalName: 'Organization',
            queryName: 'OrganizationEntity',
            personValueField: 'Department',
            personValueQueryName: 'DepartmentAlias',
            relationship: {
              kind: 'person',
              target: {
                internalName: 'Department',
                queryName: 'DepartmentAlias',
                resolution: 'userInfoBatch'
              }
            }
          }
        }]
      }
    });
    expect(tabs[0].itemLayoutOverride).toEqual({
      itemProperties: ['Title', 'Description'],
      rows: [['Description'], ['Title']],
      links: { Title: 'URL' }
    });
    expect(tabs[1].groupingOverride).toEqual({ mode: 'none', icons: undefined });
    expect(parseTabConfiguration(serializeTabConfiguration(tabs))).toEqual(tabs);
  });

  it('leaves missing tab-scoped settings undefined for legacy inheritance', () => {
    const [tab] = parseTabConfiguration('[{"id":"all","label":"All","filter":{"kind":"all"}}]');
    expect(tab.groupingOverride).toBeUndefined();
    expect(tab.itemLayoutOverride).toBeUndefined();
  });

  it('upgrades legacy Person target aliases while parsing saved filters', () => {
    const [tab] = parseTabConfiguration(JSON.stringify([{
      id: 'legacy-person',
      label: 'Legacy person',
      filter: {
        kind: 'query',
        expression: 'Department = Research',
        fields: [{
          name: 'Department',
          kind: 'person',
          fieldPath: 'PoC.Department',
          mapping: {
            kind: 'person',
            internalName: 'PoC',
            lookupValueField: 'Department',
            lookupValueQueryName: 'DepartmentAlias'
          }
        }]
      }
    }]));

    expect(tab.filter).toMatchObject({
      fields: [{
        mapping: {
          personValueField: 'Department',
          personValueQueryName: 'DepartmentAlias'
        }
      }]
    });
  });

  it('round trips an unlimited tab array', () => {
    const tabs = createDefaultTabs().concat([
      {
        id: 'communications',
        label: 'Communications',
        filter: { kind: 'equals' as const, field: 'category' as const, value: 'Communications' },
        tabIcon: 'communications' as const,
        tabIconOverride: { kind: 'icon' as const, library: 'solar-duotone' as const, name: 'star-bold-duotone', color: '#245a8d' },
        showItemCount: true,
        maxItems: 6,
        group: { field: 'organization' as const },
        sort: [{ field: 'title' as const, direction: 'ascending' as const, mode: 'text' as const }],
        icon: { mode: 'fixed' as const, value: 'MegaphoneLoud' },
        layout: { columns: 1 as const, density: 'compact' as const }
      }
    ]);

    const parsed = parseTabConfiguration(serializeTabConfiguration(tabs));
    expect(parsed).toHaveLength(2);
    expect(parsed[1]).toMatchObject({
      tabIcon: 'communications',
      tabIconOverride: { kind: 'icon', library: 'solar-duotone', name: 'star-bold-duotone', color: '#245a8d' },
      showItemCount: true,
      maxItems: 6
    });
  });

  it('normalizes rich tab icons and drops unsafe image choices', () => {
    const parsed = parseTabConfiguration(JSON.stringify([
      {
        id: 'image',
        label: 'Image',
        filter: { kind: 'all' },
        tabIconOverride: { kind: 'image', url: '/sites/example/SiteAssets/icon.png' }
      },
      {
        id: 'unsafe',
        label: 'Unsafe',
        filter: { kind: 'all' },
        tabIconOverride: { kind: 'image', url: 'ftp://example.com/icon.png' }
      },
      {
        id: 'none',
        label: 'None',
        filter: { kind: 'all' },
        tabIconOverride: { kind: 'none' }
      }
    ]));

    expect(parsed[0].tabIconOverride).toEqual({ kind: 'image', url: '/sites/example/SiteAssets/icon.png' });
    expect(parsed[1].tabIconOverride).toBeUndefined();
    expect(parsed[2].tabIconOverride).toEqual({ kind: 'none' });
  });

  it('uses defaults when no serialized configuration exists', () => {
    expect(parseTabConfiguration(undefined).map((tab) => tab.id)).toEqual(['all']);
    expect(createDefaultTabs()[0].group).toBeUndefined();
  });

  it('round trips an arbitrary discovered source-field criterion', () => {
    const serialized = serializeTabConfiguration([
      {
        id: 'north',
        label: 'North',
        filter: {
          kind: 'sourceEquals',
          fieldPath: 'Region',
          mapping: { kind: 'text', internalName: 'Region', displayName: 'Region' },
          value: 'North'
        }
      }
    ]);

    expect(parseTabConfiguration(serialized)[0].filter).toMatchObject({
      kind: 'sourceEquals',
      fieldPath: 'Region',
      value: 'North'
    });
    expect(
      addTabFilterMappings(
        { title: { kind: 'text', internalName: 'Title' } },
        parseTabConfiguration(serialized)
      ).filterFields
    ).toEqual([{ kind: 'text', internalName: 'Region', displayName: 'Region' }]);
  });

  it('round trips a compound query and includes only referenced source mappings', () => {
    const tabs = parseTabConfiguration(serializeTabConfiguration([
      {
        id: 'featured-north',
        label: 'Featured north',
        filter: {
          kind: 'query',
          expression: 'Featured = true AND Region = "North"',
          fields: [
            { name: 'Featured', kind: 'boolean', field: 'featured' },
            {
              name: 'Region',
              kind: 'text',
              fieldPath: 'Region',
              mapping: { kind: 'text', internalName: 'Region', displayName: 'Region' }
            }
          ]
        }
      }
    ]));

    expect(tabs[0].filter).toMatchObject({ kind: 'query', expression: 'Featured = true AND Region = "North"' });
    expect(addTabFilterMappings({ title: { kind: 'text', internalName: 'Title' } }, tabs).filterFields).toEqual([
      { kind: 'text', internalName: 'Region', displayName: 'Region' }
    ]);
  });

  it('uses current mapping kinds instead of stale serialized query metadata', () => {
    const [sourceTab] = parseTabConfiguration(JSON.stringify([
      {
        id: 'north',
        label: 'North',
        filter: {
          kind: 'query',
          expression: 'Region = "North"',
          fields: [{
            name: 'Region',
            kind: 'boolean',
            fieldPath: 'Region',
            mapping: { kind: 'text', internalName: 'Region' }
          }]
        }
      }
    ]));
    expect(sourceTab.filter).toMatchObject({ fields: [{ kind: 'text' }] });

    const semanticTab = alignTabQueryFieldKinds({
      id: 'priorities',
      label: 'Priorities',
      filter: {
        kind: 'query',
        expression: 'Priority > 2',
        fields: [{ name: 'Priority', kind: 'text', field: 'sortOrder' }]
      }
    }, { sortOrder: { kind: 'number', internalName: 'Priority' } });
    expect(semanticTab.filter).toMatchObject({ fields: [{ kind: 'number' }] });
  });

  it('reloads only when a filter references a new relationship target', () => {
    const mappings = { title: { kind: 'text' as const, internalName: 'Title' } };
    const makeTab = (expression: string, target: string): IBetterListTabConfig => ({
      id: 'people',
      label: 'People',
      filter: {
        kind: 'query' as const,
        expression,
        fields: [{
          name: target,
          kind: 'person' as const,
          fieldPath: `PoC/${target}`,
          mapping: {
            kind: 'person' as const,
            internalName: 'PoC',
            fieldPath: `PoC/${target}`,
            personValueField: target,
            personValueQueryName: target,
            relationship: {
              kind: 'person' as const,
              target: {
                internalName: target,
                label: target,
                kind: 'text' as const,
                queryName: target,
                queryable: false,
                resolution: 'userInfoBatch' as const
              }
            }
          }
        }]
      }
    });

    const list = { id: 'services', title: 'Services' };
    const signature = (tab: IBetterListTabConfig): string => createBetterListLoadSignature(
      list,
      addTabFilterMappings(mappings, [tab])
    );
    const engineering = signature(makeTab('Department = Engineering', 'Department'));
    const research = signature(makeTab('Department = Research', 'Department'));
    const location = signature(makeTab('Location = HQ', 'Location'));

    expect(research).toBe(engineering);
    expect(location).not.toBe(engineering);
  });

  it('rejects duplicate ids and multi-condition rule shapes', () => {
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"all"}},{"id":"X","label":"Two","filter":{"kind":"all"}}]')).toThrow(/unique/i);
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"and","conditions":[]}}]')).toThrow(/field-equals-value/i);
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"all"},"maxItems":0}]')).toThrow(/positive integer/i);
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"all"},"tabIcon":"rocket"}]')).toThrow(/supported/i);
  });
});
