import {
  IBetterListAudienceIdentity,
  IBetterListFieldMappings,
  IBetterListItem
} from './betterListTypes';
import {
  filterVisibleItems,
  groupItems,
  normalizeItem,
  processItems,
  searchItems
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

  it('filters, searches, sorts, and groups without mutating input', () => {
    const items: readonly IBetterListItem[] = [
      normalizeItem({ Id: 2, Title: 'Second', Description: 'beta', Category: { Title: 'Policy' }, Featured: true, OrderPriority: 2 }, mappings),
      normalizeItem({ Id: 1, Title: 'First', Description: 'alpha', Category: { Title: 'General' }, Featured: true, OrderPriority: 1 }, mappings),
      normalizeItem({ Id: 3, Title: 'Third', Description: 'gamma', Category: { Title: 'Policy' }, Featured: false, OrderPriority: 0 }, mappings)
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

  it('keeps explicit null ordering independent of sort direction', () => {
    const items: readonly IBetterListItem[] = [
      normalizeItem({ Id: 1, Title: 'Missing' }, mappings),
      normalizeItem({ Id: 2, Title: 'Ten', OrderPriority: 10 }, mappings),
      normalizeItem({ Id: 3, Title: 'Two', OrderPriority: 2 }, mappings)
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
});
