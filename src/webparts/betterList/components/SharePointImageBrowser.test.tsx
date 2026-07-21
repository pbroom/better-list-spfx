/* eslint-disable @rushstack/pair-react-dom-render-unmount -- Tests share one container and unmount it centrally after every case. */
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import { ISharePointImageAssetProvider } from '../services';
import { SharePointImageBrowser } from './SharePointImageBrowser';

describe('SharePointImageBrowser', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      ReactDom.unmountComponentAtNode(container);
    });
    container.remove();
  });

  it('browses current-site libraries and selects an existing image URL', async () => {
    const onSelect = jest.fn();
    const provider: ISharePointImageAssetProvider = {
      discoverLibraries: jest.fn().mockResolvedValue([
        { id: 'assets', title: 'Site Assets', serverRelativeUrl: '/sites/example/SiteAssets' }
      ]),
      browseFolder: jest.fn().mockResolvedValue({
        serverRelativeUrl: '/sites/example/SiteAssets',
        folders: [{ name: 'Campaigns', serverRelativeUrl: '/sites/example/SiteAssets/Campaigns' }],
        images: [{
          name: 'general.png',
          serverRelativeUrl: '/sites/example/SiteAssets/general.png',
          absoluteUrl: 'https://contoso.sharepoint.com/sites/example/SiteAssets/general.png'
        }]
      }),
      uploadImage: jest.fn()
    };

    act(() => {
      ReactDom.render(<SharePointImageBrowser provider={provider} onSelect={onSelect} />, container);
    });
    await clickButton(container, 'Browse SharePoint');

    expect(provider.discoverLibraries).toHaveBeenCalledTimes(1);
    expect(provider.browseFolder).toHaveBeenCalledWith('/sites/example/SiteAssets');
    expect(container.textContent).toContain('Site Assets');
    expect(container.textContent).toContain('Campaigns');

    act(() => {
      Simulate.click(container.querySelector('[aria-label="Select general.png"]') as HTMLButtonElement);
    });
    expect(onSelect).toHaveBeenCalledWith(
      'https://contoso.sharepoint.com/sites/example/SiteAssets/general.png'
    );
    expect(container.querySelector('[aria-label="Browse SharePoint images"]')).toBeNull();
  });

  it('uploads a local image and selects the stable SharePoint URL', async () => {
    const onSelect = jest.fn();
    const uploadImage = jest.fn().mockResolvedValue({
      name: 'uploaded.webp',
      serverRelativeUrl: '/sites/example/SiteAssets/Better List/Group Icons/uploaded.webp',
      absoluteUrl: 'https://contoso.sharepoint.com/sites/example/SiteAssets/Better%20List/Group%20Icons/uploaded.webp'
    });
    const provider: ISharePointImageAssetProvider = {
      discoverLibraries: jest.fn(),
      browseFolder: jest.fn(),
      uploadImage
    };
    const file = { name: 'uploaded.webp', type: 'image/webp', size: 512 } as File;

    act(() => {
      ReactDom.render(<SharePointImageBrowser provider={provider} onSelect={onSelect} />, container);
    });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      Simulate.change(input);
      await settle();
    });

    expect(uploadImage).toHaveBeenCalledWith(file);
    expect(onSelect).toHaveBeenCalledWith(
      'https://contoso.sharepoint.com/sites/example/SiteAssets/Better%20List/Group%20Icons/uploaded.webp'
    );
    expect(container.textContent).toContain('uploaded.webp was uploaded to Site Assets and selected.');
  });

  it('retries the folder that failed instead of the previous successful folder', async () => {
    const root = '/sites/example/SiteAssets';
    const child = `${root}/Campaigns`;
    const browseFolder = jest.fn()
      .mockResolvedValueOnce({
        serverRelativeUrl: root,
        folders: [{ name: 'Campaigns', serverRelativeUrl: child }],
        images: []
      })
      .mockRejectedValueOnce(new Error('Temporary folder failure'))
      .mockResolvedValueOnce({ serverRelativeUrl: child, folders: [], images: [] });
    const provider: ISharePointImageAssetProvider = {
      discoverLibraries: jest.fn().mockResolvedValue([
        { id: 'assets', title: 'Site Assets', serverRelativeUrl: root }
      ]),
      browseFolder,
      uploadImage: jest.fn()
    };

    act(() => {
      ReactDom.render(<SharePointImageBrowser provider={provider} onSelect={jest.fn()} />, container);
    });
    await clickButton(container, 'Browse SharePoint');
    await clickButton(container, 'Campaigns');
    expect(container.textContent).toContain('Temporary folder failure');

    await clickButton(container, 'Retry');

    expect(browseFolder).toHaveBeenNthCalledWith(3, child);
    expect(container.textContent).toContain('No supported images are in this folder.');
  });
});

async function clickButton(root: ParentNode, label: string): Promise<void> {
  const button = Array.from(root.querySelectorAll('button')).find((entry) => entry.textContent === label);
  expect(button).toBeDefined();
  await act(async () => {
    Simulate.click(button as HTMLButtonElement);
    await settle();
  });
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
