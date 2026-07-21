export type BetterListGroupIconLibrary = 'solar-duotone' | 'fluent' | 'fluent-color';

export interface IBetterListCatalogGroupIcon {
  kind: 'icon';
  library: BetterListGroupIconLibrary;
  name: string;
  color?: string;
}

export interface IBetterListImageGroupIcon {
  kind: 'image';
  url: string;
}

export interface IBetterListNoGroupIcon {
  kind: 'none';
}

export type BetterListGroupIconOverride =
  | IBetterListCatalogGroupIcon
  | IBetterListImageGroupIcon
  | IBetterListNoGroupIcon;

export interface IBetterListGroupIconOverrideEntry {
  groupKey: string;
  icon: BetterListGroupIconOverride;
}

export interface IBetterListGroupIconsConfiguration {
  version: 1;
  showIcons: boolean;
  defaultColor?: string;
  overrides: readonly IBetterListGroupIconOverrideEntry[];
}

const BETTER_LIST_GROUP_ICON_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BETTER_LIST_GROUP_ICON_NAME_MAX_LENGTH = 128;
const BETTER_LIST_GROUP_ICON_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const defaultBetterListGroupIconsConfiguration: IBetterListGroupIconsConfiguration = {
  version: 1,
  showIcons: true,
  overrides: []
};

export function createBetterListGroupIconKey(groupFieldPath: string, runtimeGroupKey: string): string {
  return `${groupFieldPath.trim().toLowerCase()}::${runtimeGroupKey.trim().toLowerCase()}`;
}

export function normalizeBetterListGroupImageUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || hasAsciiControlCharacter(trimmed)) {
    return undefined;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) {
      return undefined;
    }
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '::1')
    ) {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function normalizeBetterListGroupIconColor(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!BETTER_LIST_GROUP_ICON_COLOR_PATTERN.test(trimmed)) {
    return undefined;
  }
  const channels = trimmed.slice(1).toLowerCase();
  return channels.length === 3
    ? `#${channels[0]}${channels[0]}${channels[1]}${channels[1]}${channels[2]}${channels[2]}`
    : `#${channels}`;
}

export function parseBetterListGroupIconsConfiguration(value: string | undefined): IBetterListGroupIconsConfiguration {
  if (!value) {
    return defaultBetterListGroupIconsConfiguration;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) {
      return defaultBetterListGroupIconsConfiguration;
    }
    const seen = new Set<string>();
    const overrides: IBetterListGroupIconOverrideEntry[] = [];
    const rawOverrides = Array.isArray(parsed.overrides) ? parsed.overrides : [];
    rawOverrides.forEach((entry) => {
      if (!isRecord(entry) || typeof entry.groupKey !== 'string') {
        return;
      }
      const groupKey = entry.groupKey.trim().toLocaleLowerCase();
      const icon = normalizeBetterListIconOverride(entry.icon);
      if (!groupKey || !icon || seen.has(groupKey)) {
        return;
      }
      seen.add(groupKey);
      overrides.push({ groupKey, icon });
    });
    return {
      version: 1,
      showIcons: parsed.showIcons !== false,
      ...(normalizeBetterListGroupIconColor(parsed.defaultColor)
        ? { defaultColor: normalizeBetterListGroupIconColor(parsed.defaultColor) }
        : {}),
      overrides
    };
  } catch {
    return defaultBetterListGroupIconsConfiguration;
  }
}

export function serializeBetterListGroupIconsConfiguration(value: IBetterListGroupIconsConfiguration): string {
  return JSON.stringify({
    version: 1,
    showIcons: value.showIcons,
    ...(normalizeBetterListGroupIconColor(value.defaultColor)
      ? { defaultColor: normalizeBetterListGroupIconColor(value.defaultColor) }
      : {}),
    overrides: value.overrides
  });
}

export function getBetterListGroupIconOverride(
  value: IBetterListGroupIconsConfiguration,
  groupFieldPath: string,
  runtimeGroupKey: string
): BetterListGroupIconOverride | undefined {
  const groupKey = createBetterListGroupIconKey(groupFieldPath, runtimeGroupKey);
  return value.overrides.find((entry) => entry.groupKey === groupKey)?.icon;
}

export function updateBetterListGroupIconOverride(
  value: IBetterListGroupIconsConfiguration,
  groupFieldPath: string,
  runtimeGroupKey: string,
  icon: BetterListGroupIconOverride | undefined
): IBetterListGroupIconsConfiguration {
  const groupKey = createBetterListGroupIconKey(groupFieldPath, runtimeGroupKey);
  const overrides = value.overrides.filter((entry) => entry.groupKey !== groupKey);
  return {
    ...value,
    overrides: icon ? [...overrides, { groupKey, icon }] : overrides
  };
}

export function normalizeBetterListIconOverride(value: unknown): BetterListGroupIconOverride | undefined {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return undefined;
  }
  if (value.kind === 'none') {
    return { kind: 'none' };
  }
  if (value.kind === 'image' && typeof value.url === 'string') {
    const url = normalizeBetterListGroupImageUrl(value.url);
    return url ? { kind: 'image', url } : undefined;
  }
  if (
    value.kind === 'icon' &&
    isGroupIconLibrary(value.library) &&
    typeof value.name === 'string' &&
    value.name.length <= BETTER_LIST_GROUP_ICON_NAME_MAX_LENGTH &&
    BETTER_LIST_GROUP_ICON_NAME_PATTERN.test(value.name)
  ) {
    const color = value.library === 'fluent-color' ? undefined : normalizeBetterListGroupIconColor(value.color);
    return { kind: 'icon', library: value.library, name: value.name, ...(color ? { color } : {}) };
  }
  return undefined;
}

function isGroupIconLibrary(value: unknown): value is BetterListGroupIconLibrary {
  return value === 'solar-duotone' || value === 'fluent' || value === 'fluent-color';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasAsciiControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}
