import {
  BetterListFilter,
  IBetterListTabConfig,
  IBetterListTabGroupingOverride,
  IBetterListTabItemLayoutOverride
} from './betterListTypes';
import {
  defaultBetterListGroupIconsConfiguration,
  IBetterListGroupIconsConfiguration
} from './groupIconConfiguration';
import {
  BetterListItemElementLinks,
  BetterListItemLayoutRows,
  normalizeItemElementLinks,
  normalizeItemLayoutRows,
  normalizeItemPropertyFields
} from './itemPropertyConfiguration';

export interface IBetterListEffectiveGroupingConfiguration {
  column: string;
  collapsible: boolean;
  icons: IBetterListGroupIconsConfiguration;
  filter: BetterListFilter;
}

export interface IBetterListEffectiveItemLayoutConfiguration {
  itemProperties: readonly string[];
  rows: BetterListItemLayoutRows;
  links: BetterListItemElementLinks;
}

export interface IBetterListLegacyTabConfiguration {
  grouping: Omit<IBetterListEffectiveGroupingConfiguration, 'filter'> & {
    filter?: BetterListFilter;
  };
  itemLayout: IBetterListEffectiveItemLayoutConfiguration;
}

export interface IBetterListEffectiveTabConfiguration {
  tab: IBetterListTabConfig;
  grouping: IBetterListEffectiveGroupingConfiguration;
  itemLayout: IBetterListEffectiveItemLayoutConfiguration;
  groupingInherited: boolean;
  itemLayoutInherited: boolean;
  inheritedFromTabId?: string;
}

export function resolveBetterListTabConfigurations(
  tabs: readonly IBetterListTabConfig[],
  legacy: IBetterListLegacyTabConfiguration
): readonly IBetterListEffectiveTabConfiguration[] {
  let grouping = normalizeGroupingConfiguration(legacy.grouping);
  let itemLayout = normalizeItemLayoutConfiguration(legacy.itemLayout);

  return tabs.map((tab, index) => {
    const groupingInherited = tab.groupingOverride === undefined;
    const itemLayoutInherited = tab.itemLayoutOverride === undefined;
    if (tab.groupingOverride) {
      grouping = resolveGroupingOverride(tab.groupingOverride, grouping);
    }
    if (tab.itemLayoutOverride) {
      itemLayout = normalizeItemLayoutConfiguration(tab.itemLayoutOverride);
    }
    return {
      tab,
      grouping,
      itemLayout,
      groupingInherited,
      itemLayoutInherited,
      inheritedFromTabId: index > 0 ? tabs[index - 1]?.id : undefined
    };
  });
}

export function createBetterListGroupingOverride(
  value: Omit<IBetterListEffectiveGroupingConfiguration, 'filter'> & {
    filter?: BetterListFilter;
  }
): IBetterListTabGroupingOverride {
  const normalized = normalizeGroupingConfiguration(value);
  return normalized.column
    ? {
        mode: 'custom',
        column: normalized.column,
        collapsible: normalized.collapsible,
        icons: normalized.icons,
        filter: normalized.filter
      }
    : { mode: 'none' };
}

export function createBetterListItemLayoutOverride(
  value: IBetterListEffectiveItemLayoutConfiguration
): IBetterListTabItemLayoutOverride {
  return normalizeItemLayoutConfiguration(value);
}

function resolveGroupingOverride(
  override: IBetterListTabGroupingOverride,
  inherited: IBetterListEffectiveGroupingConfiguration
): IBetterListEffectiveGroupingConfiguration {
  if (override.mode === 'none') {
    return {
      column: '',
      collapsible: false,
      icons: normalizeGroupIcons(override.icons ?? inherited.icons),
      filter: { kind: 'all' }
    };
  }
  return normalizeGroupingConfiguration({
    column: override.column || '',
    collapsible: override.collapsible !== false,
    icons: override.icons ?? inherited.icons,
    filter: override.filter ?? { kind: 'all' }
  });
}

function normalizeGroupingConfiguration(
  value: Omit<IBetterListEffectiveGroupingConfiguration, 'filter'> & {
    filter?: BetterListFilter;
  }
): IBetterListEffectiveGroupingConfiguration {
  const column = value.column.trim();
  return {
    column,
    collapsible: Boolean(column) && value.collapsible !== false,
    icons: normalizeGroupIcons(value.icons),
    filter: column ? value.filter ?? { kind: 'all' } : { kind: 'all' }
  };
}

function normalizeGroupIcons(
  value: IBetterListGroupIconsConfiguration | undefined
): IBetterListGroupIconsConfiguration {
  const icons = value ?? defaultBetterListGroupIconsConfiguration;
  return {
    version: 1,
    showIcons: icons.showIcons !== false,
    defaultColor: icons.defaultColor,
    overrides: icons.overrides.slice()
  };
}

function normalizeItemLayoutConfiguration(
  value: IBetterListEffectiveItemLayoutConfiguration
): IBetterListEffectiveItemLayoutConfiguration {
  const itemProperties = normalizeItemPropertyFields(value.itemProperties);
  return {
    itemProperties,
    rows: normalizeItemLayoutRows(value.rows, itemProperties),
    links: normalizeItemElementLinks(value.links, itemProperties)
  };
}
