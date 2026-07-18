import { createDefaultTabs, parseTabConfiguration, serializeTabConfiguration } from './tabConfiguration';

describe('Better List tab configuration', () => {
  it('round trips an unlimited tab array', () => {
    const tabs = createDefaultTabs().concat([
      {
        id: 'communications',
        label: 'Communications',
        filter: { kind: 'equals' as const, field: 'category' as const, value: 'Communications' },
        group: { field: 'organization' as const },
        sort: [{ field: 'title' as const, direction: 'ascending' as const, mode: 'text' as const }],
        icon: { mode: 'fixed' as const, value: 'MegaphoneLoud' },
        layout: { columns: 1 as const, density: 'compact' as const }
      }
    ]);

    expect(parseTabConfiguration(serializeTabConfiguration(tabs))).toHaveLength(2);
  });

  it('uses defaults when no serialized configuration exists', () => {
    expect(parseTabConfiguration(undefined).map((tab) => tab.id)).toEqual(['all']);
    expect(createDefaultTabs()[0].group).toBeUndefined();
  });

  it('rejects duplicate ids and multi-condition rule shapes', () => {
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"all"}},{"id":"X","label":"Two","filter":{"kind":"all"}}]')).toThrow(/unique/i);
    expect(() => parseTabConfiguration('[{"id":"x","label":"One","filter":{"kind":"and","conditions":[]}}]')).toThrow(/field-equals-value/i);
  });
});
