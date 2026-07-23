import {
  IBetterListAudienceIdentity,
  IBetterListFieldMappings,
  IBetterListItem
} from './betterListTypes';
import {
  applyBetterListGroupOrder,
  filterVisibleItems,
  groupItems,
  groupItemsBySourceField,
  normalizeFieldValue,
  normalizeItem,
  processItems,
  searchItems,
  sourceMatchesFilter
} from './itemProcessing';

const mappings: IBetterListFieldMappings = {
  title: { internalName: 'Title', kind: 'text' },
  description: { internalName: 'Description', kind: 'text' },
  url: { internalName: 'Link', kind: 'url' },
  category: { internalName: 'Category', kind: 'lookup', lookupValueField: 'Title' },
  organization: { internalName: 'Organization', kind: 'lookup', lookupValueField: 'Title' },
  featured: { internalName: 'Featured', kind: 'boolean' },
  sortOrder: { internalName: 'OrderPriority', kind: 'number' },
  active: { internalName: 'Active', kind: 'boolean' },
  audience: { internalName: 'Audience', kind: 'person', multi: true },
  metadata: [{ key: 'owner', label: 'Owner', mapping: { internalName: 'Owner', kind: 'person', valueProperty: 'title' } }]
};

describe('Better List item processing', () => {
  it('applies a saved group order, hides configured groups, and appends new groups', () => {
    const groups = [
      { key: 'alpha', label: 'Alpha', items: [] },
      { key: 'beta', label: 'Beta', items: [] },
      { key: 'gamma', label: 'Gamma', items: [] }
    ];

    expect(applyBetterListGroupOrder(groups, [
      { key: 'beta' },
      { key: 'alpha', hidden: true },
      { key: 'stale', hidden: true }
    ]).map((group) => group.key)).toEqual(['beta', 'gamma']);
  });

  it('normalizes lookup, hyperlink, person, boolean, and metadata fields', () => {
    const item: IBetterListItem = normalizeItem(
      {
        Id: 7,
        Title: 'Acquisition Request',
        Description: 'Create and submit acquisition request.',
        Link: { Url: 'https://example.test/request', Description: 'Start request' },
        Category: { Id: 2, Title: 'General' },
        Organization: { Id: 4, Title: 'Advanced Projects Office' },
        Featured: 1,
        OrderPriority: '10',
        Active: true,
        Audience: { results: [{ Id: 12, Title: 'M/EX Members', PrincipalType: 8 }] },
        Owner: { Id: 3, Title: 'Ada Lovelace', EMail: 'ada@example.test' }
      },
      mappings
    );

    expect(item.id).toBe(7);
    expect(item.values.category).toBe('General');
    expect(item.url).toBe('https://example.test/request');
    expect(item.urlLabel).toBe('Start request');
    expect(item.featured).toBe(true);
    expect(item.sortOrder).toBe(10);
    expect(item.audience).toEqual([{ id: 12, title: 'M/EX Members', principalType: 8 }]);
    expect(item.metadata[0].value).toBe('Ada Lovelace');
  });

  it('normalizes a discovered Person target property and preserves missing users as null', () => {
    const item = normalizeItem(
      {
        Id: 8,
        Title: 'Relationship targets',
        PoC: { results: [{ Id: 3, Department: 'State' }, { Id: 9, Department: null }] }
      },
      {
        title: { internalName: 'Title', kind: 'text' },
        metadata: [{
          key: 'PoC/Department',
          label: 'PoC → Department',
          mapping: {
            internalName: 'PoC',
            fieldPath: 'PoC/Department',
            kind: 'person',
            personValueField: 'Department',
            multi: true,
            relationship: {
              kind: 'person',
              target: {
                internalName: 'Department',
                label: 'Department',
                kind: 'text',
                queryable: false,
                resolution: 'userInfoBatch'
              }
            }
          }
        }]
      }
    );

    expect(item.metadata[0].value).toEqual(['State']);
  });

  it('normalizes SharePoint rich text and hyperlink descriptions to plain text', () => {
    const richText = '<div class="ExternalClass123">First&nbsp;paragraph</div><p>Second &amp; final</p>';
    const item = normalizeItem(
      {
        Id: 9,
        Title: 'Rich text item',
        Description: richText,
        LabelLink: { Url: 'https://example.test', Description: '<strong>Open&nbsp;service</strong>' }
      },
      {
        title: { internalName: 'Title', kind: 'text' },
        description: { internalName: 'Description', kind: 'text', richText: true },
        urlLabel: { internalName: 'LabelLink', kind: 'url', valueProperty: 'description' }
      }
    );

    expect(item.description).toBe('First paragraph Second & final');
    expect(item.urlLabel).toBe('Open service');
    expect(item.values.description).toBe('First paragraph Second & final');
  });

  it('uses schema-authored rich-text metadata for any item element', () => {
    const item = normalizeItem(
      {
        Id: 11,
        Title: 'Metadata item',
        Summary: '<div class="ExternalClass123">First&nbsp;summary</div><p>Final</p>',
        Category: {
          Description: '<p>General&nbsp;services</p><script>ignored()</script>'
        },
        Literal: 'Use <code> literally'
      },
      {
        title: { internalName: 'Title', kind: 'text' },
        metadata: [
          {
            key: 'Summary',
            label: 'Summary',
            mapping: { internalName: 'Summary', kind: 'text', richText: true }
          },
          {
            key: 'Category.Description',
            label: 'Category → Description',
            mapping: {
              internalName: 'Category',
              kind: 'lookup',
              lookupValueField: 'Description',
              richText: true
            }
          },
          {
            key: 'Literal',
            label: 'Literal',
            mapping: { internalName: 'Literal', kind: 'text' }
          }
        ]
      }
    );

    expect(item.metadata.map((entry) => entry.value)).toEqual([
      'First summary Final',
      'General services',
      'Use <code> literally'
    ]);
  });

  it('normalizes empty, single, and multi lookup and Person shapes consistently', () => {
    const singleLookup = { internalName: 'Category', kind: 'lookup' as const, lookupValueField: 'Title' };
    const multiLookup = { ...singleLookup, multi: true };
    const singlePerson = { internalName: 'Owner', kind: 'person' as const, valueProperty: 'title' as const };
    const multiPerson = { ...singlePerson, multi: true };

    expect(normalizeFieldValue(undefined, singleLookup)).toBeNull();
    expect(normalizeFieldValue({ results: [] }, multiLookup)).toEqual([]);
    expect(normalizeFieldValue({ Title: 'General' }, singleLookup)).toBe('General');
    expect(normalizeFieldValue({ results: [{ Title: 'General' }, null, { Title: '' }] }, multiLookup))
      .toEqual(['General']);
    expect(normalizeFieldValue(null, singlePerson)).toBeNull();
    expect(normalizeFieldValue({ Title: 'Ada Lovelace' }, singlePerson)).toBe('Ada Lovelace');
    expect(normalizeFieldValue({ results: [{ Title: 'Ada' }, { Title: 'Grace' }] }, multiPerson))
      .toEqual(['Ada', 'Grace']);
  });

  it('preserves tag-like substrings in ordinary text and lookup values', () => {
    const item = normalizeItem(
      {
        Id: 10,
        Title: 'Use <code> literally',
        Category: { Title: 'Policy <draft>' }
      },
      {
        title: { internalName: 'Title', kind: 'text' },
        category: { internalName: 'Category', kind: 'lookup', lookupValueField: 'Title' }
      }
    );

    expect(item.title).toBe('Use <code> literally');
    expect(item.values.category).toBe('Policy <draft>');
    expect(searchItems([item], '<code>')).toEqual([item]);
  });

  it('preserves markup-looking content in an ordinary description field', () => {
    const item = normalizeItem(
      {
        Id: 12,
        Title: 'Literal description',
        Description: '<div class="example">Keep this literal</div>'
      },
      {
        title: { internalName: 'Title', kind: 'text' },
        description: { internalName: 'Description', kind: 'text', richText: false }
      }
    );

    expect(item.description).toBe('<div class="example">Keep this literal</div>');
    expect(item.values.description).toBe('<div class="example">Keep this literal</div>');
  });

  it('normalizes a selected column from the lookup target row', () => {
    const item = normalizeItem(
      {
        Id: 8,
        Title: 'Travel Management',
        Category: {
          Id: 2,
          Title: 'General',
          Description: 'General services and resources'
        }
      },
      {
        title: { internalName: 'Title', kind: 'text' },
        metadata: [
          {
            key: 'Category.Description',
            label: 'Category → Description',
            mapping: {
              internalName: 'Category',
              kind: 'lookup',
              lookupValueField: 'Description'
            }
          }
        ]
      }
    );

    expect(item.metadata[0].value).toBe('General services and resources');
  });

  it('removes inactive items and trims audience by current user and SharePoint group ids', () => {
    const identity: IBetterListAudienceIdentity = { userId: 5, email: 'person@example.test', groupIds: [12] };
    const items: readonly IBetterListItem[] = [
      normalizeItem({ Id: 1, Title: 'Open', Active: true }, mappings),
      normalizeItem({ Id: 2, Title: 'Group', Active: true, Audience: [{ Id: 12, Title: 'Members' }] }, mappings),
      normalizeItem({ Id: 3, Title: 'User', Active: true, Audience: [{ Id: 5, Title: 'Person' }] }, mappings),
      normalizeItem({ Id: 4, Title: 'Hidden', Active: true, Audience: [{ Id: 99, Title: 'Other' }] }, mappings),
      normalizeItem({ Id: 5, Title: 'Inactive', Active: false }, mappings)
    ];

    expect(filterVisibleItems(items, identity).map((item: IBetterListItem) => item.title)).toEqual(['Open', 'Group', 'User']);
  });

  it('uses the authored active column and treats missing mapped values as inactive', () => {
    const activeMappings: IBetterListFieldMappings = {
      title: { internalName: 'Title', kind: 'text' },
      active: { internalName: 'Published', kind: 'boolean' }
    };
    const items = [
      normalizeItem({ Id: 1, Title: 'Published', Published: true }, activeMappings),
      normalizeItem({ Id: 2, Title: 'Draft', Published: false }, activeMappings),
      normalizeItem({ Id: 3, Title: 'Unclassified' }, activeMappings)
    ];

    expect(filterVisibleItems(items, { groupIds: [] }).map((item) => item.title)).toEqual(['Published']);
    expect(normalizeItem({ Id: 4, Title: 'Legacy' }, { title: activeMappings.title }).active).toBe(true);
  });

  it('filters, searches, sorts, and groups without mutating input', () => {
    const items: readonly IBetterListItem[] = [
      normalizeItem({ Id: 2, Title: 'Second', Description: 'beta', Category: { Title: 'Policy' }, Featured: true, OrderPriority: 2, Active: true }, mappings),
      normalizeItem({ Id: 1, Title: 'First', Description: 'alpha', Category: { Title: 'General' }, Featured: true, OrderPriority: 1, Active: true }, mappings),
      normalizeItem({ Id: 3, Title: 'Third', Description: 'gamma', Category: { Title: 'Policy' }, Featured: false, OrderPriority: 0, Active: true }, mappings)
    ];
    const processed: readonly IBetterListItem[] = processItems(items, {
      id: 'featured',
      label: 'Featured',
      filter: { kind: 'equals', field: 'featured', value: true },
      group: { field: 'category' },
      sort: [{ field: 'sortOrder', mode: 'number' }]
    });

    expect(processed.map((item: IBetterListItem) => item.title)).toEqual(['First', 'Second']);
    expect(searchItems(processed, 'beta')).toHaveLength(1);
    expect(groupItems(processed, { field: 'category' }).map((group) => group.label)).toEqual(['General', 'Policy']);
    expect(items[0].title).toBe('Second');
  });

  it('filters on an authored source field that is not assigned to a semantic slot', () => {
    const items: readonly IBetterListItem[] = [
      normalizeItem({ Id: 1, Title: 'North', Region: 'North', Active: true }, mappings),
      normalizeItem({ Id: 2, Title: 'South', Region: 'South', Active: true }, mappings)
    ];

    const processed = processItems(items, {
      id: 'north',
      label: 'North',
      filter: {
        kind: 'sourceEquals',
        fieldPath: 'Region',
        mapping: { kind: 'text', internalName: 'Region', displayName: 'Region' },
        value: 'north'
      }
    });

    expect(processed.map((item) => item.title)).toEqual(['North']);
  });

  it('filters with a compound query across semantic and source fields', () => {
    const items: readonly IBetterListItem[] = [
      normalizeItem({ Id: 1, Title: 'North request', Region: 'North', Featured: true, Active: true }, mappings),
      normalizeItem({ Id: 2, Title: 'South request', Region: 'South', Featured: true, Active: true }, mappings),
      normalizeItem({ Id: 3, Title: 'North notice', Region: 'North', Featured: false, Active: true }, mappings)
    ];

    const processed = processItems(items, {
      id: 'featured-north',
      label: 'Featured north',
      filter: {
        kind: 'query',
        expression: 'Featured = true AND Region = "North"',
        fields: [
          { name: 'Featured', kind: 'boolean', field: 'featured' },
          { name: 'Region', kind: 'text', fieldPath: 'Region', mapping: { kind: 'text', internalName: 'Region' } }
        ]
      }
    });

    expect(processed.map((item) => item.title)).toEqual(['North request']);
  });

  it('keeps explicit null ordering independent of sort direction', () => {
    const items: readonly IBetterListItem[] = [
      normalizeItem({ Id: 1, Title: 'Missing', Active: true }, mappings),
      normalizeItem({ Id: 2, Title: 'Ten', OrderPriority: 10, Active: true }, mappings),
      normalizeItem({ Id: 3, Title: 'Two', OrderPriority: 2, Active: true }, mappings)
    ];

    expect(processItems(items, {
      id: 'descending',
      label: 'Descending',
      filter: { kind: 'all' },
      sort: [{ field: 'sortOrder', mode: 'number', direction: 'descending', nulls: 'last' }]
    }).map((item: IBetterListItem) => item.title)).toEqual(['Ten', 'Two', 'Missing']);
  });

  it('sorts prefixed group values while hiding the sort prefix', () => {
    const items: readonly IBetterListItem[] = [
      normalizeItem({ Id: 1, Title: 'Announcements', Category: { Title: '3 | Communications' } }, mappings),
      normalizeItem({ Id: 2, Title: 'Request', Category: { Title: '1 | General' } }, mappings)
    ];

    expect(groupItems(items, { field: 'category' }).map((group) => group.label)).toEqual([
      'General',
      'Communications'
    ]);
  });

  it('matches any member of multi-value Person and lookup item filters', () => {
    const items = [
      normalizeItem({
        Id: 1,
        Title: 'Shared service',
        PoC: { results: [{ Title: 'Ada' }, { Title: 'Grace' }] },
        Topics: { results: [{ Title: 'Policy' }, { Title: 'Travel' }] }
      }, { title: mappings.title }),
      normalizeItem({ Id: 2, Title: 'Other service', PoC: { results: [{ Title: 'Linus' }] } }, { title: mappings.title })
    ];
    const filtered = processItems(items, {
      id: 'relations',
      label: 'Relations',
      filter: {
        kind: 'query',
        expression: 'PoC = Grace AND Topics = Travel',
        fields: [
          {
            name: 'PoC',
            kind: 'person',
            fieldPath: 'PoC/Title',
            mapping: {
              kind: 'person',
              internalName: 'PoC',
              fieldPath: 'PoC/Title',
              personValueField: 'Title',
              multi: true
            }
          },
          {
            name: 'Topics',
            kind: 'lookup',
            fieldPath: 'Topics.Title',
            mapping: { kind: 'lookup', internalName: 'Topics', lookupValueField: 'Title', multi: true }
          }
        ]
      }
    });

    expect(filtered.map((item) => item.title)).toEqual(['Shared service']);
  });

  it('expands multi-value grouping into distinct memberships and filters relationship groups', () => {
    const shared = normalizeItem({
      Id: 1,
      Title: 'Shared service',
      PoC: {
        results: [
          { Id: 7, Title: 'Ada', Department: 'Engineering' },
          { Id: 8, Title: 'Grace', Department: 'Research' },
          { Id: 8, Title: 'Grace', Department: 'Research' }
        ]
      }
    }, { title: mappings.title });
    const researchOnly = {
      kind: 'query' as const,
      expression: 'Department = Research',
      fields: [{
        name: 'Department',
        kind: 'person' as const,
        fieldPath: 'PoC/Department',
        mapping: {
          kind: 'person' as const,
          internalName: 'PoC',
          fieldPath: 'PoC/Department',
          personValueField: 'Department',
          relationship: {
            kind: 'person' as const,
            target: {
              internalName: 'Department',
              label: 'Department',
              kind: 'text' as const,
              queryable: false,
              resolution: 'userInfoBatch' as const
            }
          },
          multi: true
        }
      }]
    };

    const allGroups = groupItemsBySourceField([shared], 'PoC/Title');
    const filteredGroups = groupItemsBySourceField([shared], 'PoC/Title', researchOnly);

    expect(allGroups.map((group) => [group.label, group.items.length])).toEqual([
      ['Ada', 1],
      ['Grace', 1]
    ]);
    expect(filteredGroups.map((group) => group.label)).toEqual(['Grace']);
    expect(filteredGroups[0].source).toEqual({ PoC: { Id: 8, Title: 'Grace', Department: 'Research' } });
  });

  it('groups by normalized metadata instead of raw rich-text markup', () => {
    const item = normalizeItem(
      {
        Id: 14,
        Title: 'Rich group',
        Summary: '<div class="ExternalClassFixture"><p>General&nbsp;services</p></div>'
      },
      {
        title: { internalName: 'Title', kind: 'text' },
        metadata: [{
          key: 'Summary',
          label: 'Summary',
          mapping: { internalName: 'Summary', kind: 'text', richText: true }
        }]
      }
    );

    expect(groupItemsBySourceField([item], 'Summary', { kind: 'all' }, 'Other', true)[0].label)
      .toBe('General services');
  });

  it('keeps normalized multi-lookup group labels aligned when an earlier target value is empty', () => {
    const item = normalizeItem(
      {
        Id: 15,
        Title: 'Lookup groups',
        Category: [
          { Id: 1, Description: '' },
          { Id: 2, Description: '<p>Second&nbsp;group</p>' }
        ]
      },
      {
        title: { internalName: 'Title', kind: 'text' },
        metadata: [{
          key: 'Category/Description',
          label: 'Category description',
          mapping: {
            internalName: 'Category',
            fieldPath: 'Category/Description',
            kind: 'lookup',
            lookupValueField: 'Description',
            richText: true,
            multi: true
          }
        }]
      }
    );

    expect(groupItemsBySourceField([item], 'Category.Description', { kind: 'all' }, 'Other', true)
      .map((group) => group.label)).toEqual(['Other', 'Second group']);
  });

  it('treats missing relationship properties as null in group filters', () => {
    expect(sourceMatchesFilter(
      { PoC: { Id: 7, Title: 'Ada' } },
      {
        kind: 'query',
        expression: 'Department IS EMPTY',
        fields: [{
          name: 'Department',
          kind: 'person',
          fieldPath: 'PoC/Department',
          mapping: {
            kind: 'person',
            internalName: 'PoC',
            fieldPath: 'PoC/Department',
            personValueField: 'Department',
            relationship: {
              kind: 'person',
              target: {
                internalName: 'Department',
                label: 'Department',
                kind: 'text',
                queryable: false,
                resolution: 'userInfoBatch'
              }
            }
          }
        }]
      }
    )).toBe(true);
  });
});
