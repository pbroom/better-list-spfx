import * as React from 'react';
import type {
  LabRenderProps,
  LabWebPart,
  LabWebPartRegistry
} from '@spfx-kit/spfx-lab-runtime';

import {
  BetterListComparableValue,
  BetterListFieldValue,
  createBetterListFieldMapping,
  defaultBetterListScss,
  formatItemPropertyValue,
  getItemPropertyUrl,
  groupItems,
  IBetterListFieldMappings,
  IBetterListGroupResult,
  IBetterListItem as ICoreBetterListItem,
  IBetterListTabConfig,
  parseItemPropertyFields,
  parseTabConfiguration,
  processItems,
  scopeBetterListStyles,
  serializeItemPropertyFields,
  serializeTabConfiguration
} from '../../src/shared';
import BetterListView, {
  BetterListGroupIcon,
  IBetterListItem,
  IBetterListTab
} from '../../src/webparts/betterList/components/BetterListView';
import { FixtureBetterListDataSource } from '../../src/webparts/betterList/services/FixtureBetterListDataSource';
import {
  BetterListLabPropertyPane,
  BetterListLabProps,
  betterListCssControl
} from './BetterListLabPropertyPane';
import {
  createFixtureIdentity,
  createServicesFixtureRecords,
  servicesAuthoringFields,
  servicesFields,
  servicesFieldMappings,
  servicesListId,
  servicesListTitle,
  servicesTabs
} from './betterListFixtures';
import './betterListLab.css';

const defaultProps: BetterListLabProps = {
  sourceListId: servicesListId,
  sourceListTitle: servicesListTitle,
  fieldMappingsJson: JSON.stringify(servicesFieldMappings),
  itemPropertiesJson: serializeItemPropertyFields(['Title']),
  tabsColumn: '',
  groupsColumn: '',
  groupsCollapsible: true,
  tabsJson: serializeTabConfiguration(servicesTabs),
  customCss: defaultBetterListScss
};

const Preview: React.FunctionComponent<LabRenderProps<BetterListLabProps>> = ({ props, lab }) => {
  const [items, setItems] = React.useState<readonly ICoreBetterListItem[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [activeTabKey, setActiveTabKey] = React.useState('column-all-items');

  const mappings = React.useMemo(() => readMappings(props.fieldMappingsJson), [props.fieldMappingsJson]);
  const effectiveMappings = React.useMemo(
    () => createAxisMappings(mappings, props.tabsColumn, props.groupsColumn),
    [mappings, props.groupsColumn, props.tabsColumn]
  );
  const itemProperties = React.useMemo(
    () => parseItemPropertyFields(props.itemPropertiesJson),
    [props.itemPropertiesJson]
  );
  const tabs = React.useMemo(() => readTabs(props.tabsJson), [props.tabsJson]);
  const dataSource = React.useMemo(
    () =>
      new FixtureBetterListDataSource(createServicesFixtureRecords(lab.spfxContext.pageContext.user), {
        identity: createFixtureIdentity(lab.spfxContext.pageContext.user),
        lists: [{ id: servicesListId, title: servicesListTitle, itemCount: 12, baseTemplate: 100 }],
        fields: servicesFields
      }),
    [lab.spfxContext.pageContext.user]
  );

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');
    dataSource
      .loadItems({
        list: { id: props.sourceListId, title: props.sourceListTitle },
        mappings: effectiveMappings
      })
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
          setStatus('ready');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setItems([]);
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'The Services fixture could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dataSource, effectiveMappings, props.sourceListId, props.sourceListTitle]);

  const effectiveTabs = React.useMemo(
    () =>
      createColumnDrivenTabs(
        items,
        tabs,
        props.tabsColumn,
        props.groupsColumn,
        props.groupsCollapsible
      ),
    [items, props.groupsCollapsible, props.groupsColumn, props.tabsColumn, tabs]
  );
  const presentationTabs = React.useMemo(
    () =>
      effectiveTabs.map((tab) =>
        createPresentationTab(items, tab, props.sourceListTitle, itemProperties)
      ),
    [effectiveTabs, itemProperties, items, props.sourceListTitle]
  );

  React.useEffect(() => {
    if (!presentationTabs.some((tab) => tab.key === activeTabKey)) {
      setActiveTabKey(presentationTabs[0]?.key ?? '');
    }
  }, [activeTabKey, presentationTabs]);

  const style = {
    '--better-list-lab-surface': lab.theme.surface,
    '--better-list-lab-foreground': lab.theme.foreground,
    '--better-list-lab-muted': lab.theme.mutedForeground,
    '--better-list-lab-border': lab.theme.border
  } as React.CSSProperties;

  return (
    <div
      className="better-list-lab"
      data-active-tab={activeTabKey}
      data-breakpoint={lab.breakpoint.id}
      data-theme={lab.theme.mode}
      style={style}
    >
      {props.customCss ? <style>{scopeBetterListStyles(props.customCss, '.better-list-lab')}</style> : null}
      <BetterListView
        tabs={presentationTabs}
        activeTabKey={activeTabKey}
        items={presentationTabs[0]?.items ?? []}
        status={status}
        errorMessage={errorMessage}
        emptyMessage="There are no active Services items to display."
        onTabChange={setActiveTabKey}
      />
    </div>
  );
};

const webPart: LabWebPart<BetterListLabProps> = {
  id: 'better-list-spfx:default',
  appId: 'better-list-spfx',
  title: 'Better List',
  description: 'Display SharePoint list content as searchable, grouped, configurable list items.',
  defaultProps,
  controls: [betterListCssControl],
  propertyPane: BetterListLabPropertyPane,
  supportedBreakpoints: ['one-column', 'two-third', 'one-half', 'one-third', 'mobile'],
  fixtures: {
    listId: servicesListId,
    listTitle: servicesListTitle,
    fieldMappings: servicesFieldMappings,
    tabs: servicesTabs
  },
  render: Preview
};

function readMappings(serialized: string): IBetterListFieldMappings {
  try {
    const parsed = JSON.parse(serialized) as Partial<IBetterListFieldMappings>;
    if (parsed && parsed.title) {
      return parsed as IBetterListFieldMappings;
    }
  } catch (_error) {
    // Fall back to the known-good fixture mapping below.
  }
  return servicesFieldMappings;
}

function readTabs(serialized: string): readonly IBetterListTabConfig[] {
  try {
    return parseTabConfiguration(serialized);
  } catch (_error) {
    return servicesTabs;
  }
}

function createColumnDrivenTabs(
  sourceItems: readonly ICoreBetterListItem[],
  configuredTabs: readonly IBetterListTabConfig[],
  tabsColumn: string,
  groupsColumn: string,
  groupsCollapsible: boolean
): readonly IBetterListTabConfig[] {
  const groupField = groupsColumn ? ('group' as const) : undefined;
  const configuredLayout = configuredTabs[0]?.layout;
  const group = groupField
    ? { field: groupField, direction: 'ascending' as const, ungroupedLabel: 'Other' }
    : undefined;
  const layout = {
    ...configuredLayout,
    columns: configuredLayout?.columns ?? (2 as const),
    collapsible: groupField ? groupsCollapsible : false
  };
  const baseTab: IBetterListTabConfig = {
    id: 'column-all-items',
    label: 'All items',
    filter: { kind: 'all' },
    group,
    sort: configuredTabs[0]?.sort,
    icon: { mode: 'none' },
    layout
  };
  const tabsField = tabsColumn ? ('tab' as const) : undefined;
  if (!tabsField) {
    return [baseTab];
  }

  const uniqueValues = new Map<string, BetterListComparableValue>();
  sourceItems.forEach((item) => {
    const value = item.values[tabsField];
    if (
      value !== null &&
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      return;
    }
    const label = formatColumnLabel(value);
    if (label && !uniqueValues.has(label)) {
      uniqueValues.set(label, value);
    }
  });
  if (uniqueValues.size === 0) {
    return [baseTab];
  }

  const dynamicTabs = Array.from(uniqueValues.entries()).map(
    ([label, value], index): IBetterListTabConfig => ({
      id: `column-${slugify(label)}-${index}`,
      label,
      filter: { kind: 'equals', field: tabsField, value },
      group,
      icon: { mode: 'none' },
      layout
    })
  );

  return [
    ...dynamicTabs,
    {
      id: 'column-all-items',
      label: 'All Services',
      filter: { kind: 'all' },
      group,
      icon: { mode: 'none' },
      layout
    }
  ];
}

function formatColumnLabel(value: BetterListFieldValue | undefined): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  const label = toDisplayString(value).trim();
  return label.replace(/^\d+\s*\|\s*/, '');
}

function createAxisMappings(
  mappings: IBetterListFieldMappings,
  tabsColumn: string,
  groupsColumn: string
): IBetterListFieldMappings {
  const tab = createAxisMapping(tabsColumn);
  const group = createAxisMapping(groupsColumn);
  return {
    ...mappings,
    tab,
    group
  };
}

function createAxisMapping(fieldPath: string): ReturnType<typeof createBetterListFieldMapping> | undefined {
  if (!fieldPath) {
    return undefined;
  }
  const [internalName, lookupValueField] = fieldPath.split('.');
  const field = servicesAuthoringFields.find(
    (candidate) => candidate.internalName === internalName
  );
  return field
    ? createBetterListFieldMapping(field, undefined, lookupValueField)
    : undefined;
}

function slugify(value: string): string {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'value'
  );
}

function createPresentationTab(
  sourceItems: readonly ICoreBetterListItem[],
  tab: IBetterListTabConfig,
  sourceListTitle: string,
  itemProperties: readonly string[]
): IBetterListTab {
  const processed = processItems(sourceItems, tab);
  const groups: readonly IBetterListGroupResult[] = tab.group
    ? groupItems(processed, tab.group)
    : [{ key: 'all', label: sourceListTitle || 'Items', items: processed }];
  const items: IBetterListItem[] = [];
  const selectedItemProperties = new Set(itemProperties);

  groups.forEach((group, groupIndex) => {
    group.items.forEach((item) => {
      const elements = itemProperties
        .slice(1)
        .filter((fieldPath) => fieldPath !== 'URL')
        .map((fieldPath) => {
          const value = formatItemPropertyValue(item.source, fieldPath);
          return value
            ? {
                key: fieldPath,
                kind: fieldPath === 'Description' ? ('description' as const) : ('metadata' as const),
                value
              }
            : undefined;
        })
        .filter(
          (element): element is { key: string; kind: 'description' | 'metadata'; value: string } =>
            Boolean(element)
        );
      const metadata = elements
        .filter((element) => element.kind === 'metadata')
        .map((element) => element.value);
      items.push({
        id: String(item.id),
        title: item.title,
        href: selectedItemProperties.has('URL') ? getItemPropertyUrl(item.source, 'URL') : undefined,
        description: selectedItemProperties.has('Description')
          ? formatItemPropertyValue(item.source, 'Description')
          : undefined,
        metadata,
        elements,
        groupId: group.key,
        groupTitle: group.label,
        groupIcon: getGroupIcon(tab, group.items[0]),
        groupSortOrder: groupIndex,
        itemSortOrder: item.sortOrder
      });
    });
  });

  return {
    key: tab.id,
    label: tab.label,
    grouped: Boolean(tab.group),
    items,
    layout: tab.layout
  };
}

function getGroupIcon(tab: IBetterListTabConfig, firstItem?: ICoreBetterListItem): BetterListGroupIcon | undefined {
  const raw =
    (tab.icon?.mode === 'fixed'
      ? tab.icon.value
      : tab.icon?.mode === 'field' && tab.icon.field && firstItem
        ? toDisplayString(firstItem.values[tab.icon.field])
        : '') || '';
  const normalized = raw.toLocaleLowerCase();
  return normalized === 'general' ||
    normalized === 'communications' ||
    normalized === 'policy' ||
    normalized === 'support'
    ? normalized
    : undefined;
}

function toDisplayString(value: BetterListFieldValue | undefined): string {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== null).join(', ');
  }
  return value === undefined || value === null ? '' : String(value);
}

export function register(registry: LabWebPartRegistry): void {
  registry.register(webPart);
}
