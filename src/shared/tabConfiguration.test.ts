import {
  addTabFilterMappings,
  alignTabQueryFieldKinds,
  createDefaultTabs,
  parseTabConfiguration,
  serializeTabConfiguration
} from './tabConfiguration';

describe('Better List tab configuration', () => {
  it('round trips an unlimited tab array', () => {
    const tabs = createDefaultTabs().concat([
      {
        id: 'communications',
        label: 'Communications',
        filter: { kind: 'equals' as const, field: 'category' as const, value: 'Communications' },
        tabIcon: 'communications' as const,
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
    expect(parsed[1]).toMatchObject({ tabIcon: 'communications', showItemCount: true, maxItems: 6 });
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

  it('rejects duplicate ids and multi-condition rule shapes', () => {
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"all"}},{"id":"X","label":"Two","filter":{"kind":"all"}}]')).toThrow(/unique/i);
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"and","conditions":[]}}]')).toThrow(/field-equals-value/i);
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"all"},"maxItems":0}]')).toThrow(/positive integer/i);
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"all"},"tabIcon":"rocket"}]')).toThrow(/supported/i);
  });
});
