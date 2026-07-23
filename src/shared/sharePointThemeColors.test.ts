import {
  createSharePointThemeColors,
  defaultSharePointThemeColors
} from './sharePointThemeColors';

describe('SharePoint theme colors', () => {
  it('keeps the official palette order and normalizes hex colors', () => {
    expect(createSharePointThemeColors({
      themeDarker: '#ABC',
      themePrimary: '#0078D4',
      neutralPrimary: '#323130'
    })).toEqual([
      { key: 'themeDarker', label: 'Theme Darker', color: '#aabbcc' },
      { key: 'themePrimary', label: 'Theme Primary', color: '#0078d4' },
      { key: 'neutralPrimary', label: 'Neutral Primary', color: '#323130' }
    ]);
  });

  it('omits unsupported, missing, and duplicate color values', () => {
    expect(createSharePointThemeColors({
      themePrimary: '#0078d4',
      accent: '#0078D4',
      black: 'rgba(0,0,0,.4)',
      white: undefined
    })).toEqual([
      { key: 'themePrimary', label: 'Theme Primary', color: '#0078d4' }
    ]);
  });

  it('provides a complete default SharePoint palette for the lab', () => {
    expect(defaultSharePointThemeColors.length).toBeGreaterThan(35);
    expect(defaultSharePointThemeColors).toContainEqual({
      key: 'themePrimary',
      label: 'Theme Primary',
      color: '#0078d4'
    });
  });
});
