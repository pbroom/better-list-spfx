import {
  createBetterListGroupIconKey,
  defaultBetterListGroupIconsConfiguration,
  getBetterListGroupIconOverride,
  normalizeBetterListGroupImageUrl,
  parseBetterListGroupIconsConfiguration,
  serializeBetterListGroupIconsConfiguration,
  updateBetterListGroupIconOverride
} from './groupIconConfiguration';

describe('group icon configuration', () => {
  it('defaults missing, malformed, and unknown versions to visible automatic icons', () => {
    expect(parseBetterListGroupIconsConfiguration(undefined)).toEqual(defaultBetterListGroupIconsConfiguration);
    expect(parseBetterListGroupIconsConfiguration('{')).toEqual(defaultBetterListGroupIconsConfiguration);
    expect(parseBetterListGroupIconsConfiguration('{"version":2}')).toEqual(defaultBetterListGroupIconsConfiguration);
  });

  it('round-trips supported icon, image, and hidden overrides', () => {
    const value = parseBetterListGroupIconsConfiguration(JSON.stringify({
      version: 1,
      showIcons: true,
      overrides: [
        { groupKey: 'category::general', icon: { kind: 'icon', library: 'solar-duotone', name: 'buildings' } },
        { groupKey: 'category::policy', icon: { kind: 'image', url: '/SiteAssets/policy.png' } },
        { groupKey: 'category::other', icon: { kind: 'none' } }
      ]
    }));

    expect(parseBetterListGroupIconsConfiguration(serializeBetterListGroupIconsConfiguration(value))).toEqual(value);
  });

  it('deduplicates normalized keys without treating object-prototype names specially', () => {
    const value = parseBetterListGroupIconsConfiguration(JSON.stringify({
      version: 1,
      overrides: [
        { groupKey: 'Category::GENERAL', icon: { kind: 'icon', library: 'fluent', name: 'megaphone' } },
        { groupKey: 'category::general', icon: { kind: 'none' } },
        { groupKey: '__proto__', icon: { kind: 'icon', library: 'fluent-color', name: 'mail' } }
      ]
    }));

    expect(value.overrides).toHaveLength(2);
    expect(value.overrides[0].groupKey).toBe('category::general');
    expect(value.overrides[1].groupKey).toBe('__proto__');
  });

  it('preserves safe Iconify names while dropping malformed names and unsafe image URLs', () => {
    const value = parseBetterListGroupIconsConfiguration(JSON.stringify({
      version: 1,
      overrides: [
        { groupKey: 'a', icon: { kind: 'icon', library: 'fluent', name: 'accessibility-24-regular' } },
        { groupKey: 'b', icon: { kind: 'image', url: `java${'script'}:alert(1)` } },
        { groupKey: 'c', icon: { kind: 'image', url: 'https://user:password@example.com/a.png' } },
        { groupKey: 'd', icon: { kind: 'icon', library: 'fluent', name: 'NotAnExport' } },
        { groupKey: 'e', icon: { kind: 'icon', library: 'fluent', name: '../icon' } }
      ]
    }));

    expect(value.overrides).toEqual([
      { groupKey: 'a', icon: { kind: 'icon', library: 'fluent', name: 'accessibility-24-regular' } }
    ]);
  });

  it('allows HTTPS, server-relative, and local-development image URLs only', () => {
    expect(normalizeBetterListGroupImageUrl('https://cdn.example.com/icon.png')).toBe('https://cdn.example.com/icon.png');
    expect(normalizeBetterListGroupImageUrl('/sites/demo/SiteAssets/icon.png')).toBe('/sites/demo/SiteAssets/icon.png');
    expect(normalizeBetterListGroupImageUrl('http://127.0.0.1:5173/icon.png')).toBe('http://127.0.0.1:5173/icon.png');
    expect(normalizeBetterListGroupImageUrl('//example.com/icon.png')).toBeUndefined();
    expect(normalizeBetterListGroupImageUrl('http://example.com/icon.png')).toBeUndefined();
    expect(normalizeBetterListGroupImageUrl('data:image/png;base64,abc')).toBeUndefined();
    expect(normalizeBetterListGroupImageUrl('https://exa\nmple.com/icon.png')).toBeUndefined();
  });

  it('updates and removes a scoped override without losing other entries', () => {
    const key = createBetterListGroupIconKey('Category.Title', 'General');
    const first = updateBetterListGroupIconOverride(
      defaultBetterListGroupIconsConfiguration,
      'Category.Title',
      'General',
      { kind: 'icon', library: 'fluent', name: 'apps-list-detail' }
    );
    expect(key).toBe('category.title::general');
    expect(getBetterListGroupIconOverride(first, 'Category.Title', 'GENERAL')).toEqual({
      kind: 'icon',
      library: 'fluent',
      name: 'apps-list-detail'
    });
    expect(updateBetterListGroupIconOverride(first, 'Category.Title', 'general', undefined).overrides).toEqual([]);
  });

  it('normalizes scoped keys independently of the editor locale', () => {
    expect(createBetterListGroupIconKey(' Icon ', 'I')).toBe('icon::i');
  });
});
