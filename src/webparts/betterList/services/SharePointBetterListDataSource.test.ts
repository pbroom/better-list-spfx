import type { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

jest.mock('@microsoft/sp-http', () => ({
  SPHttpClient: { configurations: { v1: {} } }
}));

import {
  SharePointBetterListDataSource,
  escapeODataString,
  parseSharePointListUrl
} from './SharePointBetterListDataSource';

function response(payload: unknown, ok: boolean = true, status: number = 200): SPHttpClientResponse {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    text: () => Promise.resolve(JSON.stringify(payload))
  } as unknown as SPHttpClientResponse;
}

describe('SharePointBetterListDataSource', () => {
  it('escapes list titles and follows absolute or relative OData pagination links', async () => {
    const urls: string[] = [];
    const client: SPHttpClient = {
      get: (url: string) => {
        urls.push(url);
        return Promise.resolve(urls.length === 1
          ? response({ value: [{ Id: 1, Title: 'One' }], '@odata.nextLink': '/sites/example/_api/next-page' })
          : response({ value: [{ Id: 2, Title: 'Two' }] }));
      }
    } as unknown as SPHttpClient;
    const source: SharePointBetterListDataSource = new SharePointBetterListDataSource(
      client,
      'https://contoso.sharepoint.com/sites/example/'
    );

    const result = await source.loadItems({
      list: { title: "Owner's Services" },
      mappings: { title: { internalName: 'Title', kind: 'text' } }
    });

    expect(result.items.map((item) => item.title)).toEqual(['One', 'Two']);
    expect(urls[0]).toContain("getbytitle('Owner''s Services')");
    expect(urls[1]).toBe('https://contoso.sharepoint.com/sites/example/_api/next-page');
  });

  it('surfaces the SharePoint OData error message', async () => {
    const client: SPHttpClient = {
      get: () => Promise.resolve(response({ error: { message: { value: 'The list does not exist.' } } }, false, 404))
    } as unknown as SPHttpClient;
    const source: SharePointBetterListDataSource = new SharePointBetterListDataSource(
      client,
      'https://contoso.sharepoint.com/sites/example'
    );

    await expect(source.discoverLists()).rejects.toThrow('The list does not exist.');
  });

  it('selects and expands a configured column from the lookup target row', async () => {
    const urls: string[] = [];
    const client: SPHttpClient = {
      get: (url: string) => {
        urls.push(url);
        return Promise.resolve(
          response({
            value: [
              {
                Id: 1,
                Title: 'Acquisition Request',
                Category: {
                  Id: 7,
                  Title: 'General',
                  Description: 'General services and resources'
                }
              }
            ]
          })
        );
      }
    } as unknown as SPHttpClient;
    const source = new SharePointBetterListDataSource(
      client,
      'https://contoso.sharepoint.com/sites/example'
    );

    const result = await source.loadItems({
      list: { id: 'c3fa8d8c-2270-4dc4-9f7e-1f83fef461fd' },
      mappings: {
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
    });

    expect(urls[0]).toContain('$select=Id,Title,Category/Id,Category/Title,Category/Description');
    expect(urls[0]).toContain('$expand=Category');
    expect(result.items[0].metadata[0].value).toBe('General services and resources');
  });

  it('queries an authored active column and omits items that are not active', async () => {
    const urls: string[] = [];
    const client: SPHttpClient = {
      get: (url: string) => {
        urls.push(url);
        return Promise.resolve(response({
          value: [
            { Id: 1, Title: 'Published', Published: true },
            { Id: 2, Title: 'Draft', Published: false }
          ]
        }));
      }
    } as unknown as SPHttpClient;
    const source = new SharePointBetterListDataSource(
      client,
      'https://contoso.sharepoint.com/sites/example'
    );

    const result = await source.loadItems({
      list: { title: 'Services' },
      mappings: {
        title: { internalName: 'Title', kind: 'text' },
        active: { internalName: 'Published', kind: 'boolean' }
      }
    });

    expect(urls[0]).toContain('$select=Id,Title,Published');
    expect(result.items.map((item) => item.title)).toEqual(['Published']);
  });

  it('doubles apostrophes for OData string literals', () => {
    expect(escapeODataString("Director's Services")).toBe("Director''s Services");
  });

  it('parses a same-origin list or view URL into its containing web and list root', () => {
    expect(parseSharePointListUrl(
      'https://contoso.sharepoint.com/sites/example/sub/Lists/Team%20Services/AllItems.aspx?view=1#top',
      'https://contoso.sharepoint.com/sites/example'
    )).toEqual({
      webUrl: 'https://contoso.sharepoint.com/sites/example/sub',
      serverRelativeUrl: '/sites/example/sub/Lists/Team Services'
    });
  });

  it.each([
    ['', 'Enter a SharePoint list URL'],
    ['/sites/example/Lists/Services', 'full HTTPS URL'],
    ['http://contoso.sharepoint.com/sites/example/Lists/Services', 'HTTPS'],
    ['https://other.sharepoint.com/sites/example/Lists/Services', 'belong to this SharePoint tenant'],
    ['https://contoso.sharepoint.com/sites/example/SitePages/Home.aspx', '/Lists/<list-name>']
  ])('rejects an unsupported list URL: %s', (value, message) => {
    expect(() => parseSharePointListUrl(value, 'https://contoso.sharepoint.com/sites/example')).toThrow(message);
  });

  it('resolves authoritative list metadata before accepting a pasted URL', async () => {
    const urls: string[] = [];
    const client: SPHttpClient = {
      get: (url: string) => {
        urls.push(url);
        return Promise.resolve(response({
          Id: 'c3fa8d8c-2270-4dc4-9f7e-1f83fef461fd',
          Title: 'Team Services',
          ItemCount: 12,
          BaseType: 0,
          BaseTemplate: 100,
          RootFolder: { ServerRelativeUrl: '/sites/example/sub/Lists/Team Services' }
        }));
      }
    } as unknown as SPHttpClient;
    const source = new SharePointBetterListDataSource(client, 'https://contoso.sharepoint.com/sites/example');

    await expect(source.resolveListUrl(
      'https://contoso.sharepoint.com/sites/example/sub/Lists/Team%20Services/AllItems.aspx'
    )).resolves.toEqual({
      id: 'c3fa8d8c-2270-4dc4-9f7e-1f83fef461fd',
      title: 'Team Services',
      itemCount: 12,
      baseTemplate: 100,
      webUrl: 'https://contoso.sharepoint.com/sites/example/sub',
      serverRelativeUrl: '/sites/example/sub/Lists/Team Services'
    });
    expect(urls[0]).toContain('https://contoso.sharepoint.com/sites/example/sub/_api/web/GetList(@listUrl)');
    expect(urls[0]).toContain('%27%2Fsites%2Fexample%2Fsub%2FLists%2FTeam%20Services%27');
  });

  it('rejects a URL when SharePoint resolves it to a document library', async () => {
    const client: SPHttpClient = {
      get: () => Promise.resolve(response({
        Id: 'c3fa8d8c-2270-4dc4-9f7e-1f83fef461fd',
        Title: 'Documents',
        BaseType: 1,
        BaseTemplate: 101
      }))
    } as unknown as SPHttpClient;
    const source = new SharePointBetterListDataSource(client, 'https://contoso.sharepoint.com/sites/example');

    await expect(source.resolveListUrl(
      'https://contoso.sharepoint.com/sites/example/Lists/Documents'
    )).rejects.toThrow('not a document library');
  });

  it('uses the selected list web for fields, items, and relative pagination', async () => {
    const urls: string[] = [];
    const client: SPHttpClient = {
      get: (url: string) => {
        urls.push(url);
        if (urls.length === 1) {
          return Promise.resolve(response({ value: [] }));
        }
        return Promise.resolve(urls.length === 2
          ? response({ value: [{ Id: 1, Title: 'One' }], '@odata.nextLink': '_api/next-page' })
          : response({ value: [{ Id: 2, Title: 'Two' }] }));
      }
    } as unknown as SPHttpClient;
    const source = new SharePointBetterListDataSource(client, 'https://contoso.sharepoint.com/sites/example');
    const list = {
      title: 'Services',
      webUrl: 'https://contoso.sharepoint.com/sites/example/sub'
    };

    await source.discoverFields(list);
    const result = await source.loadItems({
      list,
      mappings: { title: { internalName: 'Title', kind: 'text' } }
    });

    expect(urls[0]).toContain('/sites/example/sub/_api/web/lists/getbytitle');
    expect(urls[1]).toContain('/sites/example/sub/_api/web/lists/getbytitle');
    expect(urls[2]).toBe('https://contoso.sharepoint.com/sites/example/sub/_api/next-page');
    expect(result.items.map((item) => item.title)).toEqual(['One', 'Two']);
  });
});
