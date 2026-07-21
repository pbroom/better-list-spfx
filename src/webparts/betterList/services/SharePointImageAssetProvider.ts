import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import {
  ISharePointImageAsset,
  ISharePointImageAssetProvider,
  ISharePointImageFolder,
  ISharePointImageFolderContents,
  ISharePointImageLibrary
} from './ISharePointImageAssetProvider';

interface IODataPage {
  values: readonly Record<string, unknown>[];
  nextLink?: string;
}

interface IDiscoveredLibrary extends ISharePointImageLibrary {
  hidden: boolean;
}

interface IImageType {
  extension: string;
  mimeTypes: readonly string[];
}

export const SHAREPOINT_IMAGE_MAX_FILE_SIZE: number = 10 * 1024 * 1024;

const IMAGE_TYPES: readonly IImageType[] = [
  { extension: '.png', mimeTypes: ['image/png'] },
  { extension: '.jpg', mimeTypes: ['image/jpeg'] },
  { extension: '.jpeg', mimeTypes: ['image/jpeg'] },
  { extension: '.gif', mimeTypes: ['image/gif'] },
  { extension: '.webp', mimeTypes: ['image/webp'] }
];

const TARGET_FOLDER_SEGMENTS: readonly string[] = ['Better List', 'Group Icons'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function numberValue(value: unknown): number | undefined {
  const number: number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function hasControlCharacters(value: string): boolean {
  for (let index: number = 0; index < value.length; index += 1) {
    const code: number = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function pageFromPayload(payload: unknown): IODataPage {
  const root: Record<string, unknown> = isRecord(payload) ? payload : {};
  const d: Record<string, unknown> = isRecord(root.d) ? root.d : root;
  const rawValues: unknown = Array.isArray(d.value) ? d.value : Array.isArray(d.results) ? d.results : [];
  const values: readonly Record<string, unknown>[] = (rawValues as readonly unknown[]).filter(isRecord);
  const nextLink: unknown = d['@odata.nextLink'] ?? d['odata.nextLink'] ?? d.__next;
  return { values, nextLink: typeof nextLink === 'string' && nextLink ? nextLink : undefined };
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  const root: Record<string, unknown> = isRecord(payload) ? payload : {};
  return isRecord(root.d) ? root.d : root;
}

function absoluteNextLink(nextLink: string, webUrl: string): string {
  if (/^https?:\/\//i.test(nextLink)) return nextLink;
  return new URL(nextLink, `${webUrl}/`).toString();
}

function oDataError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const error: unknown = payload.error ?? (isRecord(payload.d) ? payload.d.error : undefined);
  if (!isRecord(error)) return fallback;
  const message: unknown = error.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (isRecord(message) && typeof message.value === 'string' && message.value.trim()) return message.value;
  return fallback;
}

function normalizeServerRelativePath(value: string): string {
  const path: string = value.trim().replace(/\/$/, '');
  if (!path.startsWith('/') || path.startsWith('//') || hasControlCharacters(path)) {
    throw new Error('SharePoint image folders must use a valid server-relative path.');
  }
  return path;
}

function joinServerRelativePath(parent: string, child: string): string {
  return `${parent.replace(/\/$/, '')}/${child.replace(/^\//, '')}`;
}

function oDataAlias(value: string): string {
  return encodeURIComponent(`'${value.replace(/'/g, "''")}'`);
}

function extensionFor(name: string): string {
  const match: RegExpMatchArray | null = name.toLocaleLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : '';
}

function typeForName(name: string): IImageType | undefined {
  const extension: string = extensionFor(name);
  return IMAGE_TYPES.find((entry: IImageType) => entry.extension === extension);
}

function isImageName(name: string): boolean {
  return !!typeForName(name);
}

function isSiteAssetsLibrary(library: IDiscoveredLibrary): boolean {
  return library.title.toLocaleLowerCase() === 'site assets' || /\/siteassets$/i.test(library.serverRelativeUrl);
}

export function validateSharePointImageFile(file: File): void {
  const name: string = file.name.trim();
  if (!name || name === '.' || name === '..' || name.indexOf('/') !== -1 || name.indexOf('\\') !== -1 || hasControlCharacters(name)) {
    throw new Error('Choose an image with a valid file name.');
  }
  if (file.size <= 0) {
    throw new Error('Choose an image that is not empty.');
  }
  if (file.size > SHAREPOINT_IMAGE_MAX_FILE_SIZE) {
    throw new Error('Choose an image smaller than 10 MB.');
  }
  const imageType: IImageType | undefined = typeForName(name);
  if (!imageType) {
    throw new Error('Choose a PNG, JPEG, GIF, or WebP image.');
  }
  const mimeType: string = file.type.toLocaleLowerCase().trim();
  if (mimeType && imageType.mimeTypes.indexOf(mimeType) === -1) {
    throw new Error('The image file extension does not match its content type.');
  }
}

export class SharePointImageAssetProvider implements ISharePointImageAssetProvider {
  private readonly _client: SPHttpClient;
  private readonly _webUrl: string;
  private _librariesPromise?: Promise<readonly IDiscoveredLibrary[]>;

  public constructor(spHttpClient: SPHttpClient, webUrl: string) {
    this._client = spHttpClient;
    this._webUrl = webUrl.replace(/\/$/, '');
  }

  public async discoverLibraries(): Promise<readonly ISharePointImageLibrary[]> {
    const libraries: readonly IDiscoveredLibrary[] = await this._loadLibraries();
    return libraries
      .filter((library: IDiscoveredLibrary) => !library.hidden || isSiteAssetsLibrary(library))
      .map(({ id, title, serverRelativeUrl }: IDiscoveredLibrary): ISharePointImageLibrary => ({
        id,
        title,
        serverRelativeUrl
      }));
  }

  public async browseFolder(serverRelativeUrl: string): Promise<ISharePointImageFolderContents> {
    const path: string = normalizeServerRelativePath(serverRelativeUrl);
    const libraries: readonly IDiscoveredLibrary[] = await this._loadLibraries();
    const allowed: boolean = libraries.some((library: IDiscoveredLibrary) =>
      (!library.hidden || isSiteAssetsLibrary(library)) &&
      (path === library.serverRelativeUrl || path.startsWith(`${library.serverRelativeUrl}/`))
    );
    if (!allowed) {
      throw new Error('The selected folder is outside this site\'s document libraries.');
    }

    const folderEndpoint: string = this._folderEndpoint();
    const foldersUrl: string =
      `${folderEndpoint}/Folders?$select=Name,ServerRelativeUrl&$orderby=Name` +
      `&@path=${oDataAlias(path)}`;
    const filesUrl: string =
      `${folderEndpoint}/Files?$select=Name,ServerRelativeUrl,Length,TimeLastModified&$orderby=Name` +
      `&@path=${oDataAlias(path)}`;
    const result: [readonly Record<string, unknown>[], readonly Record<string, unknown>[]] = await Promise.all([
      this._getAllPages(foldersUrl),
      this._getAllPages(filesUrl)
    ]);

    return {
      serverRelativeUrl: path,
      folders: result[0]
        .map((row: Record<string, unknown>): ISharePointImageFolder => ({
          name: stringValue(row.Name),
          serverRelativeUrl: normalizeServerRelativePath(stringValue(row.ServerRelativeUrl))
        }))
        .filter((folder: ISharePointImageFolder) => !!folder.name && folder.name !== 'Forms'),
      images: result[1]
        .filter((row: Record<string, unknown>) => isImageName(stringValue(row.Name)))
        .map((row: Record<string, unknown>) => this._assetFromRow(row))
    };
  }

  public async uploadImage(file: File): Promise<ISharePointImageAsset> {
    validateSharePointImageFile(file);
    const siteAssets: IDiscoveredLibrary | undefined = (await this._loadLibraries()).find(
      isSiteAssetsLibrary
    );
    if (!siteAssets) {
      throw new Error('This site does not have a Site Assets library available for group icons.');
    }

    let targetPath: string = siteAssets.serverRelativeUrl;
    for (const segment of TARGET_FOLDER_SEGMENTS) {
      targetPath = joinServerRelativePath(targetPath, segment);
      await this._ensureFolder(targetPath);
    }

    const fileName: string = file.name.trim();
    const endpoint: string =
      `${this._folderEndpoint()}/Files/AddUsingPath(decodedUrl=@file,overwrite=false)` +
      `?@path=${oDataAlias(targetPath)}&@file=${oDataAlias(fileName)}`;
    const payload: unknown = await this._post(endpoint, file, file.type || 'application/octet-stream');
    const row: Record<string, unknown> = payloadRecord(payload);
    const fallbackPath: string = joinServerRelativePath(targetPath, fileName);
    return this._assetFromRow({
      Name: row.Name || fileName,
      ServerRelativeUrl: row.ServerRelativeUrl || fallbackPath,
      Length: row.Length || file.size,
      TimeLastModified: row.TimeLastModified
    });
  }

  private async _loadLibraries(): Promise<readonly IDiscoveredLibrary[]> {
    if (!this._librariesPromise) {
      const select: string = 'Id,Title,Hidden,RootFolder/ServerRelativeUrl';
      const url: string =
        `${this._webUrl}/_api/web/lists?$select=${select}&$expand=RootFolder` +
        '&$filter=BaseTemplate eq 101&$orderby=Title';
      this._librariesPromise = this._getAllPages(url)
        .then((rows: readonly Record<string, unknown>[]) =>
          rows
            .map((row: Record<string, unknown>): IDiscoveredLibrary | undefined => {
              const rootFolder: Record<string, unknown> = isRecord(row.RootFolder) ? row.RootFolder : {};
              const rawPath: string = stringValue(rootFolder.ServerRelativeUrl);
              if (!rawPath) return undefined;
              return {
                id: stringValue(row.Id),
                title: stringValue(row.Title),
                hidden: booleanValue(row.Hidden),
                serverRelativeUrl: normalizeServerRelativePath(rawPath)
              };
            })
            .filter((library: IDiscoveredLibrary | undefined): library is IDiscoveredLibrary => !!library)
        )
        .catch((error: unknown): never => {
          this._librariesPromise = undefined;
          throw error;
        });
    }
    return this._librariesPromise;
  }

  private _folderEndpoint(): string {
    return `${this._webUrl}/_api/web/GetFolderByServerRelativePath(decodedUrl=@path)`;
  }

  private async _ensureFolder(path: string): Promise<void> {
    const endpoint: string =
      `${this._webUrl}/_api/web/Folders/AddUsingPath(decodedUrl=@path,overwrite=false)` +
      `?@path=${oDataAlias(path)}`;
    try {
      await this._post(endpoint, undefined, 'application/json;odata=nometadata');
    } catch (error) {
      const status: number | undefined = isRecord(error) ? numberValue(error.status) : undefined;
      if (status !== 409) throw error;
    }
  }

  private _assetFromRow(row: Record<string, unknown>): ISharePointImageAsset {
    const serverRelativeUrl: string = normalizeServerRelativePath(stringValue(row.ServerRelativeUrl));
    const absolute: URL = new URL(this._webUrl);
    absolute.pathname = serverRelativeUrl;
    absolute.search = '';
    absolute.hash = '';
    return {
      name: stringValue(row.Name),
      serverRelativeUrl,
      absoluteUrl: absolute.toString(),
      size: numberValue(row.Length),
      modified: stringValue(row.TimeLastModified) || undefined
    };
  }

  private async _getAllPages(initialUrl: string): Promise<readonly Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let nextUrl: string | undefined = initialUrl;
    const visited: Set<string> = new Set<string>();
    while (nextUrl) {
      if (visited.has(nextUrl)) throw new Error('SharePoint returned a repeating pagination link.');
      visited.add(nextUrl);
      const page: IODataPage = pageFromPayload(await this._request('get', nextUrl));
      rows.push(...page.values);
      nextUrl = page.nextLink ? absoluteNextLink(page.nextLink, this._webUrl) : undefined;
    }
    return rows;
  }

  private _post(url: string, body: File | undefined, contentType: string): Promise<unknown> {
    return this._request('post', url, body, contentType);
  }

  private async _request(
    method: 'get' | 'post',
    url: string,
    body?: File,
    contentType?: string
  ): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json;odata=nometadata' };
    if (contentType) headers['Content-Type'] = contentType;
    const response: SPHttpClientResponse = method === 'get'
      ? await this._client.get(url, SPHttpClient.configurations.v1, { headers })
      : await this._client.post(url, SPHttpClient.configurations.v1, { headers, body });
    const text: string = await response.text();
    let payload: unknown = {};
    try {
      payload = text ? JSON.parse(text) as unknown : {};
    } catch {
      payload = {};
    }
    if (!response.ok) {
      const fallback: string =
        `SharePoint request failed with HTTP ${response.status}` +
        (response.statusText ? ` (${response.statusText})` : '') +
        '.';
      const error: Error & { status?: number } = new Error(oDataError(payload, text.trim() || fallback));
      error.status = response.status;
      throw error;
    }
    return payload;
  }
}
