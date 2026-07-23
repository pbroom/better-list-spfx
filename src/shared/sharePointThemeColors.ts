import { normalizeBetterListGroupIconColor } from './groupIconConfiguration';

export interface IBetterListThemeColor {
  key: string;
  label: string;
  color: string;
}

const sharePointThemeColorSlots: readonly string[] = [
  'themeDarker',
  'themeDark',
  'themeDarkAlt',
  'themePrimary',
  'themeSecondary',
  'themeTertiary',
  'themeLight',
  'themeLighter',
  'themeLighterAlt',
  'black',
  'neutralDark',
  'neutralPrimary',
  'neutralPrimaryAlt',
  'neutralSecondary',
  'neutralSecondaryAlt',
  'neutralTertiary',
  'neutralTertiaryAlt',
  'neutralQuaternary',
  'neutralQuaternaryAlt',
  'neutralLight',
  'neutralLighter',
  'neutralLighterAlt',
  'accent',
  'white',
  'yellowDark',
  'yellow',
  'yellowLight',
  'orange',
  'orangeLight',
  'orangeLighter',
  'redDark',
  'red',
  'magentaDark',
  'magenta',
  'magentaLight',
  'purpleDark',
  'purple',
  'purpleLight',
  'blueDark',
  'blueMid',
  'blue',
  'blueLight',
  'tealDark',
  'teal',
  'tealLight',
  'greenDark',
  'green',
  'greenLight'
];

export const defaultSharePointThemePalette: Readonly<Record<string, string>> = {
  themeDarker: '#004578',
  themeDark: '#005a9e',
  themeDarkAlt: '#106ebe',
  themePrimary: '#0078d4',
  themeSecondary: '#2b88d8',
  themeTertiary: '#71afe5',
  themeLight: '#c7e0f4',
  themeLighter: '#deecf9',
  themeLighterAlt: '#eff6fc',
  black: '#000000',
  neutralDark: '#201f1e',
  neutralPrimary: '#323130',
  neutralPrimaryAlt: '#3b3a39',
  neutralSecondary: '#605e5c',
  neutralSecondaryAlt: '#8a8886',
  neutralTertiary: '#a19f9d',
  neutralTertiaryAlt: '#c8c6c4',
  neutralQuaternary: '#d2d0ce',
  neutralQuaternaryAlt: '#e1dfdd',
  neutralLight: '#edebe9',
  neutralLighter: '#f3f2f1',
  neutralLighterAlt: '#faf9f8',
  accent: '#0078d4',
  white: '#ffffff',
  yellowDark: '#d29200',
  yellow: '#ffb900',
  yellowLight: '#fff100',
  orange: '#d83b01',
  orangeLight: '#ea4300',
  orangeLighter: '#ff8c00',
  redDark: '#a4262c',
  red: '#e81123',
  magentaDark: '#5c005c',
  magenta: '#b4009e',
  magentaLight: '#e3008c',
  purpleDark: '#32145a',
  purple: '#5c2d91',
  purpleLight: '#b4a0ff',
  blueDark: '#002050',
  blueMid: '#00188f',
  blue: '#0078d4',
  blueLight: '#00bcf2',
  tealDark: '#004b50',
  teal: '#008272',
  tealLight: '#00b294',
  greenDark: '#004b1c',
  green: '#107c10',
  greenLight: '#bad80a'
};

export const defaultSharePointThemeColors = createSharePointThemeColors(defaultSharePointThemePalette);

export function createSharePointThemeColors(palette: unknown): readonly IBetterListThemeColor[] {
  if (!palette || typeof palette !== 'object') {
    return [];
  }

  const values = palette as Record<string, unknown>;
  const seen = new Set<string>();
  const colors: IBetterListThemeColor[] = [];

  sharePointThemeColorSlots.forEach((key) => {
    const color = normalizeBetterListGroupIconColor(values[key]);
    if (!color || seen.has(color)) {
      return;
    }
    seen.add(color);
    colors.push({
      key,
      label: humanizeThemeColorSlot(key),
      color
    });
  });

  return colors;
}

function humanizeThemeColorSlot(value: string): string {
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return `${words.charAt(0).toLocaleUpperCase()}${words.slice(1)}`;
}
