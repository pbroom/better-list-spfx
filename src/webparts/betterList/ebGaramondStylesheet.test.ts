import {
  ensureEbGaramondStylesheet,
  resolveEbGaramondStylesheetUrl,
} from './ebGaramondStylesheet';

describe('EB Garamond stylesheet', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('link[data-better-list-eb-garamond]')
      .forEach((link) => link.remove());
  });

  it('resolves the stable font stylesheet under the runtime module base URL', () => {
    expect(
      resolveEbGaramondStylesheetUrl([
        'https://cdn.example.test/spfx/better-list/',
      ]),
    ).toBe(
      'https://cdn.example.test/spfx/better-list/better-list-eb-garamond.css',
    );
  });

  it('loads one shared stylesheet for multiple Better List instances', () => {
    const first = ensureEbGaramondStylesheet(document, [
      'https://tenant.example.test/ClientSideAssets/better-list/',
    ]);
    const second = ensureEbGaramondStylesheet(document, [
      'https://tenant.example.test/ClientSideAssets/better-list/',
    ]);

    expect(second).toBe(first);
    expect(
      document.head.querySelectorAll('link[data-better-list-eb-garamond]'),
    ).toHaveLength(1);
  });

  it('ignores invalid and non-https module base URLs', () => {
    expect(
      resolveEbGaramondStylesheetUrl([
        'not a URL',
        'file:///tmp/',
        'http://cdn.example.test/spfx/better-list/',
      ]),
    ).toBeUndefined();
    expect(ensureEbGaramondStylesheet(document, [])).toBeUndefined();
  });
});
