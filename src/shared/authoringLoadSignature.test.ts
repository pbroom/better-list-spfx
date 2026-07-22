import { BetterListRequestEpoch, createBetterListLoadSignature } from './authoringLoadSignature';
import { addTabFilterMappings } from './tabConfiguration';
import { IBetterListFieldMappings, IBetterListTabConfig } from './betterListTypes';

const mappings: IBetterListFieldMappings = {
  title: { internalName: 'Title', kind: 'text' },
  featured: { internalName: 'Featured', kind: 'boolean' }
};

describe('createBetterListLoadSignature', () => {
  it('ignores tab presentation, order, and filter literals while tracking referenced fields', () => {
    const featuredField = {
      name: 'Featured',
      kind: 'boolean' as const,
      field: 'featured' as const
    };
    const baseTabs: readonly IBetterListTabConfig[] = [
      {
        id: 'featured',
        label: 'Featured',
        filter: {
          kind: 'query',
          expression: 'Featured = true',
          fields: [featuredField]
        }
      },
      { id: 'all', label: 'All items', filter: { kind: 'all' } }
    ];
    const list = {
      id: 'services',
      title: 'Services',
      webUrl: 'https://contoso.sharepoint.com/sites/example'
    };
    const base = createBetterListLoadSignature(list, addTabFilterMappings(mappings, baseTabs));
    const presentationOnlyTabs: readonly IBetterListTabConfig[] = [
      {
        ...baseTabs[1],
        label: 'Everything',
        maxItems: 12,
        showItemCount: true
      },
      {
        ...baseTabs[0],
        label: 'Pinned',
        filter: {
          kind: 'query',
          expression: 'Featured = false',
          fields: [featuredField]
        }
      }
    ];

    expect(createBetterListLoadSignature(list, addTabFilterMappings(mappings, presentationOnlyTabs))).toBe(base);

    const active = { internalName: 'Active', kind: 'boolean' as const };
    const withNewField = addTabFilterMappings({ ...mappings, active }, [
      {
        ...baseTabs[0],
        filter: {
          kind: 'query',
          expression: 'Active = true',
          fields: [
            {
              name: 'Active',
              kind: 'boolean',
              field: 'active',
              mapping: active
            }
          ]
        }
      }
    ]);
    expect(createBetterListLoadSignature(list, withNewField)).not.toBe(base);
  });
});

describe('BetterListRequestEpoch', () => {
  it('suppresses a deferred response after a newer request completes', async () => {
    const epoch = new BetterListRequestEpoch();
    const applied: string[] = [];
    let resolveFirst: ((value: string) => void) | undefined;
    let resolveSecond: ((value: string) => void) | undefined;
    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<string>((resolve) => {
      resolveSecond = resolve;
    });
    const load = async (value: Promise<string>): Promise<void> => {
      const request = epoch.begin();
      const result = await value;
      if (epoch.isCurrent(request)) applied.push(result);
    };

    const firstLoad = load(first);
    const secondLoad = load(second);
    resolveSecond?.('newest');
    await secondLoad;
    resolveFirst?.('stale');
    await firstLoad;

    expect(applied).toEqual(['newest']);
  });
});
