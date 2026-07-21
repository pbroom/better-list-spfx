import type { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

jest.mock('@microsoft/sp-http', () => ({
  SPHttpClient: { configurations: { v1: {} } }
}));

import {
  SHAREPOINT_IMAGE_MAX_FILE_SIZE,
  SharePointImageAssetProvider,
  validateSharePointImageFile
} from './SharePointImageAssetProvider';

function response(payload: unknown, ok: boolean = true, status: number = 200): SPHttpClientResponse {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Conflict',
    text: () => Promise.resolve(JSON.stringify(payload))
  } as unknown as SPHttpClientResponse;
}

function imageFile(
  name: string = 'group-icon.png',
  type: string = 'image/png',
  size: number = 128
): File {
  return { name, type, size } as File;
}

const librariesPayload = {
  value: [
    {
      Id: 'documents',
      Title: 'Documents',
      Hidden: false,
      RootFolder: { ServerRelativeUrl: '/sites/example/Shared Documents' }
    },
    {
      Id: 'site-assets',
      Title: 'Site Assets',
      Hidden: true,
      RootFolder: { ServerRelativeUrl: '/sites/example/SiteAssets' }
    },
    {
      Id: 'hidden-library',
      Title: 'Hidden Library',
      Hidden: true,
      RootFolder: { ServerRelativeUrl: '/sites/example/Hidden Library' }
    }
  ]
};

describe('SharePointImageAssetProvider', () => {
  it('discovers current-site document libraries and exposes hidden Site Assets for image browsing', async () => {
    const urls: string[] = [];
    const client: SPHttpClient = {
      get: (url: string) => {
        urls.push(url);
        return Promise.resolve(response(librariesPayload));
      }
    } as unknown as SPHttpClient;
    const provider = new SharePointImageAssetProvider(client, 'https://contoso.sharepoint.com/sites/example/');

    await expect(provider.discoverLibraries()).resolves.toEqual([
      {
        id: 'documents',
        title: 'Documents',
        serverRelativeUrl: '/sites/example/Shared Documents'
      },
      {
        id: 'site-assets',
        title: 'Site Assets',
        serverRelativeUrl: '/sites/example/SiteAssets'
      }
    ]);
    expect(urls[0]).toContain('$filter=BaseTemplate eq 101');
    expect(urls[0]).toContain('$expand=RootFolder');
  });

  it('retries library discovery after a transient SharePoint failure', async () => {
    const get = jest.fn()
      .mockResolvedValueOnce(response({ error: { message: 'Temporary failure' } }, false, 503))
      .mockResolvedValueOnce(response(librariesPayload));
    const client: SPHttpClient = { get } as unknown as SPHttpClient;
    const provider = new SharePointImageAssetProvider(client, 'https://contoso.sharepoint.com/sites/example');

    await expect(provider.discoverLibraries()).rejects.toThrow('Temporary failure');
    await expect(provider.discoverLibraries()).resolves.toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('browses an allowed library with ResourcePath endpoints and returns only supported images', async () => {
    const urls: string[] = [];
    const client: SPHttpClient = {
      get: (url: string) => {
        urls.push(url);
        if (url.indexOf('/_api/web/lists?') !== -1) return Promise.resolve(response(librariesPayload));
        if (url.indexOf('/Folders?') !== -1) {
          return Promise.resolve(response({
            value: [
              { Name: 'Events', ServerRelativeUrl: '/sites/example/Shared Documents/Events' },
              { Name: 'Forms', ServerRelativeUrl: '/sites/example/Shared Documents/Forms' }
            ]
          }));
        }
        return Promise.resolve(response({
          value: [
            {
              Name: 'Banner #1.png',
              ServerRelativeUrl: '/sites/example/Shared Documents/Banner #1.png',
              Length: '512',
              TimeLastModified: '2026-07-21T01:00:00Z'
            },
            { Name: 'Notes.docx', ServerRelativeUrl: '/sites/example/Shared Documents/Notes.docx' }
          ]
        }));
      }
    } as unknown as SPHttpClient;
    const provider = new SharePointImageAssetProvider(client, 'https://contoso.sharepoint.com/sites/example');

    const result = await provider.browseFolder('/sites/example/Shared Documents');

    expect(result.folders).toEqual([
      { name: 'Events', serverRelativeUrl: '/sites/example/Shared Documents/Events' }
    ]);
    expect(result.images).toEqual([
      {
        name: 'Banner #1.png',
        serverRelativeUrl: '/sites/example/Shared Documents/Banner #1.png',
        absoluteUrl: 'https://contoso.sharepoint.com/sites/example/Shared%20Documents/Banner%20%231.png',
        size: 512,
        modified: '2026-07-21T01:00:00Z'
      }
    ]);
    expect(urls.find((url: string) => url.indexOf('/Folders?') !== -1)).toContain(
      'GetFolderByServerRelativePath(decodedUrl=@path)'
    );
    expect(urls.find((url: string) => url.indexOf('/Folders?') !== -1)).toContain(
      "@path='%2Fsites%2Fexample%2FShared%20Documents'"
    );
  });

  it('rejects attempts to browse outside discovered document libraries', async () => {
    const client: SPHttpClient = {
      get: () => Promise.resolve(response(librariesPayload))
    } as unknown as SPHttpClient;
    const provider = new SharePointImageAssetProvider(client, 'https://contoso.sharepoint.com/sites/example');

    await expect(provider.browseFolder('/sites/another/Shared Documents')).rejects.toThrow(
      "outside this site's document libraries"
    );
  });

  it('allows browsing Site Assets even when SharePoint marks the library hidden', async () => {
    const client: SPHttpClient = {
      get: (url: string) => Promise.resolve(
        response(url.indexOf('/_api/web/lists?') !== -1 ? librariesPayload : { value: [] })
      )
    } as unknown as SPHttpClient;
    const provider = new SharePointImageAssetProvider(client, 'https://contoso.sharepoint.com/sites/example');

    await expect(provider.browseFolder('/sites/example/SiteAssets')).resolves.toEqual({
      serverRelativeUrl: '/sites/example/SiteAssets',
      folders: [],
      images: []
    });
  });

  it('creates the Better List asset folders and uploads with ResourcePath-safe aliases', async () => {
    const posts: Array<{ url: string; options: unknown }> = [];
    const client: SPHttpClient = {
      get: () => Promise.resolve(response(librariesPayload)),
      post: (url: string, _configuration: unknown, options: unknown) => {
        posts.push({ url, options });
        if (url.indexOf('/Files/AddUsingPath') !== -1) {
          return Promise.resolve(response({
            Name: 'Leadership #1.png',
            ServerRelativeUrl: '/sites/example/SiteAssets/Better List/Group Icons/Leadership #1.png',
            Length: 256
          }));
        }
        return Promise.resolve(response({}));
      }
    } as unknown as SPHttpClient;
    const provider = new SharePointImageAssetProvider(client, 'https://contoso.sharepoint.com/sites/example');
    const file: File = imageFile('Leadership #1.png', 'image/png', 256);

    const result = await provider.uploadImage(file);

    expect(posts).toHaveLength(3);
    expect(posts[0].url).toContain('Folders/AddUsingPath(decodedUrl=@path,overwrite=false)');
    expect(posts[0].url).toContain('Better%20List');
    expect(posts[1].url).toContain('Group%20Icons');
    expect(posts[2].url).toContain('Files/AddUsingPath(decodedUrl=@file,overwrite=false)');
    expect(posts[2].url).toContain('Leadership%20%231.png');
    expect((posts[2].options as { body?: File }).body).toBe(file);
    expect(result).toEqual({
      name: 'Leadership #1.png',
      serverRelativeUrl: '/sites/example/SiteAssets/Better List/Group Icons/Leadership #1.png',
      absoluteUrl:
        'https://contoso.sharepoint.com/sites/example/SiteAssets/Better%20List/Group%20Icons/Leadership%20%231.png',
      size: 256,
      modified: undefined
    });
  });

  it('validates extension, content type, and the 10 MB upload limit', () => {
    expect(() => validateSharePointImageFile(imageFile('icon.svg', 'image/svg+xml'))).toThrow(
      'PNG, JPEG, GIF, or WebP'
    );
    expect(() => validateSharePointImageFile(imageFile('icon.png', 'image/jpeg'))).toThrow(
      'does not match its content type'
    );
    expect(() => validateSharePointImageFile(
      imageFile('icon.webp', 'image/webp', SHAREPOINT_IMAGE_MAX_FILE_SIZE + 1)
    )).toThrow('smaller than 10 MB');
  });
});
