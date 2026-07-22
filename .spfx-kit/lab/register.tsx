import '@fontsource-variable/geist-mono';

import * as React from 'react';
import type { LabRenderProps, LabWebPart, LabWebPartRegistry } from '@spfx-kit/spfx-lab-runtime';
import { RendererProvider } from '@griffel/react';
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';

import {
  BetterListFieldValue,
  createBetterListGroupingOverride,
  defaultBetterListHtmlTemplate,
  defaultBetterListScss,
  formatItemPropertyDisplayValue,
  formatItemPropertyValue,
  getRichTextItemPropertyPaths,
  getBetterListRenderer,
  getItemPropertyUrl,
  parseBetterListGroupIconsConfiguration,
  groupItems,
  IBetterListFieldMappings,
  IBetterListGroupResult,
  IBetterListEffectiveTabConfiguration,
  IBetterListItem as ICoreBetterListItem,
  IBetterListTabConfig,
  parseItemLayoutConfiguration,
  parseItemPropertyFields,
  parseTabConfiguration,
  processItems,
  resolveBetterListTabConfigurations,
  scopeBetterListStyles,
  serializeItemPropertyFields,
  serializeBetterListGroupIconsConfiguration,
  serializeTabConfiguration,
  updateBetterListGroupIconOverride
} from '../../src/shared';
import BetterListView, {
  BetterListGroupIcon,
  IBetterListItem,
  IBetterListTab
} from '../../src/webparts/betterList/components/BetterListView';
import { FixtureBetterListDataSource } from '../../src/webparts/betterList/services/FixtureBetterListDataSource';
import type { ISharePointImageAssetProvider } from '../../src/webparts/betterList/services';
import {
  BetterListLabPropertyPane,
  BetterListLabProps,
  betterListSourceWorkspaceControl
} from './BetterListLabPropertyPane';
import {
  createFixtureIdentity,
  createServicesFixtureRecords,
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
  sourceWebUrl: 'https://contoso.sharepoint.com/sites/lab',
  fieldMappingsJson: JSON.stringify(servicesFieldMappings),
  itemPropertiesJson: serializeItemPropertyFields(['Title']),
  itemLayoutJson: '[]',
  tabsColumn: '',
  groupsColumn: '',
  groupsCollapsible: true,
  groupIconsJson: serializeBetterListGroupIconsConfiguration(parseBetterListGroupIconsConfiguration(undefined)),
  tabsJson: serializeTabConfiguration(servicesTabs),
  customCss: defaultBetterListScss,
  htmlTemplate: defaultBetterListHtmlTemplate,
  authoringTabId: servicesTabs[0]?.id || ''
};

const Preview: React.FunctionComponent<LabRenderProps<BetterListLabProps>> = ({ props, lab, updateProps }) => {
  const [items, setItems] = React.useState<readonly ICoreBetterListItem[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [activeTabKey, setActiveTabKey] = React.useState(props.authoringTabId);

  const mappings = React.useMemo(() => readMappings(props.fieldMappingsJson), [props.fieldMappingsJson]);
  const effectiveMappings = mappings;
  const itemLayout = React.useMemo(
    () => parseItemLayoutConfiguration(
      props.itemLayoutJson,
      parseItemPropertyFields(props.itemPropertiesJson)
    ),
    [props.itemLayoutJson, props.itemPropertiesJson]
  );
  const tabs = React.useMemo(() => readTabs(props.tabsJson), [props.tabsJson]);
  const groupIcons = React.useMemo(
    () => parseBetterListGroupIconsConfiguration(props.groupIconsJson),
    [props.groupIconsJson]
  );

  React.useEffect(() => {
    if (props.authoringTabId) {
      setActiveTabKey(props.authoringTabId);
    }
  }, [props.authoringTabId]);
  const dataSource = React.useMemo(
    () =>
      new FixtureBetterListDataSource(createServicesFixtureRecords(lab.spfxContext.pageContext.user), {
        identity: createFixtureIdentity(lab.spfxContext.pageContext.user),
        lists: [{
          id: servicesListId,
          title: servicesListTitle,
          itemCount: 12,
          baseTemplate: 100,
          webUrl: 'https://contoso.sharepoint.com/sites/lab',
          serverRelativeUrl: '/sites/lab/Lists/Services'
        }],
        fields: servicesFields
      }),
    [lab.spfxContext.pageContext.user]
  );
  const imageAssetProvider = React.useMemo(
    () => createFixtureImageAssetProvider(new URL('./groupIconFixture.svg?no-inline', import.meta.url).pathname),
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');
    dataSource
      .loadItems({
        list: { id: props.sourceListId, title: props.sourceListTitle, webUrl: props.sourceWebUrl },
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
  }, [dataSource, effectiveMappings, props.sourceListId, props.sourceListTitle, props.sourceWebUrl]);

  const effectiveTabs = React.useMemo(
    () => resolveBetterListTabConfigurations(tabs, {
      grouping: {
        column: props.groupsColumn,
        collapsible: props.groupsCollapsible,
        icons: groupIcons
      },
      itemLayout
    }),
    [groupIcons, itemLayout, props.groupsCollapsible, props.groupsColumn, tabs]
  );
  const presentationTabs = React.useMemo(
    () => effectiveTabs.map((tab) => createPresentationTab(
      items,
      tab,
      props.sourceListTitle,
      effectiveMappings
    )),
    [effectiveMappings, effectiveTabs, items, props.sourceListTitle]
  );
  const activeConfiguration = effectiveTabs.find((entry) => entry.tab.id === activeTabKey) ?? effectiveTabs[0];

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

  const content = (
    <FluentProvider
      className="better-list-lab"
      data-active-tab={activeTabKey}
      data-breakpoint={lab.breakpoint.id}
      data-theme={lab.theme.mode}
      style={style}
      targetDocument={typeof document === 'undefined' ? undefined : document}
      theme={lab.theme.mode === 'dark' ? webDarkTheme : webLightTheme}
    >
      {props.customCss ? <style>{scopeBetterListStyles(props.customCss, '.better-list-lab')}</style> : null}
      <BetterListView
        tabs={presentationTabs}
        activeTabKey={activeTabKey}
        items={presentationTabs[0]?.items ?? []}
        status={status}
        errorMessage={errorMessage}
        htmlTemplate={props.htmlTemplate}
        itemPropertyFields={itemLayout.itemProperties}
        itemLayoutRows={itemLayout.rows}
        groupIconScope={props.groupsColumn}
        groupIcons={groupIcons}
        groupImageAssetProvider={imageAssetProvider}
        isEditMode={lab.displayMode === 'edit'}
        listTitle={props.sourceListTitle}
        emptyMessage="There are no active Services items to display."
        onTabChange={(tabKey) => {
          setActiveTabKey(tabKey);
          updateProps({ authoringTabId: tabKey });
        }}
        onGroupIconOverrideChange={(groupKey, override) =>
          activeConfiguration?.grouping.column
            ? updateProps({
                tabsJson: serializeTabConfiguration(tabs.map((tab) => tab.id === activeConfiguration.tab.id
                  ? {
                      ...tab,
                      groupingOverride: createBetterListGroupingOverride({
                        ...activeConfiguration.grouping,
                        icons: updateBetterListGroupIconOverride(
                          activeConfiguration.grouping.icons,
                          activeConfiguration.grouping.column,
                          groupKey,
                          override
                        )
                      })
                    }
                  : tab))
              })
            : undefined
        }
      />
    </FluentProvider>
  );
  return typeof document === 'undefined'
    ? content
    : <RendererProvider renderer={getBetterListRenderer(document)}>{content}</RendererProvider>;
};

function createFixtureImageAssetProvider(imageUrl: string): ISharePointImageAssetProvider {
  const siteAssetsRoot = '/sites/lab/SiteAssets';
  const campaignFolder = `${siteAssetsRoot}/Campaigns`;
  return {
    discoverLibraries: async () => [
      { id: 'site-assets', title: 'Site Assets', serverRelativeUrl: siteAssetsRoot },
      { id: 'documents', title: 'Documents', serverRelativeUrl: '/sites/lab/Shared Documents' }
    ],
    browseFolder: async (serverRelativeUrl: string) => {
      if (serverRelativeUrl === siteAssetsRoot) {
        return {
          serverRelativeUrl,
          folders: [{ name: 'Campaigns', serverRelativeUrl: campaignFolder }],
          images: [
            fixtureImage('general-group-icon.svg', `${siteAssetsRoot}/general-group-icon.svg`, imageUrl),
            fixtureImage('communications-group-icon.svg', `${siteAssetsRoot}/communications-group-icon.svg`, imageUrl)
          ]
        };
      }
      if (serverRelativeUrl === campaignFolder) {
        return {
          serverRelativeUrl,
          folders: [],
          images: [fixtureImage('campaign-icon.svg', `${campaignFolder}/campaign-icon.svg`, imageUrl)]
        };
      }
      return { serverRelativeUrl, folders: [], images: [] };
    },
    uploadImage: async (file: File) => fixtureImage(
      file.name,
      `${siteAssetsRoot}/Better List/Group Icons/${encodeURIComponent(file.name)}`,
      imageUrl,
      file.size
    )
  };
}

function fixtureImage(name: string, serverRelativeUrl: string, absoluteUrl: string, size?: number) {
  return { name, serverRelativeUrl, absoluteUrl, size };
}

const webPart: LabWebPart<BetterListLabProps> = {
  id: 'better-list-spfx:default',
  appId: 'better-list-spfx',
  title: 'Better List',
  description: 'Display SharePoint list content as searchable, grouped, configurable list items.',
  defaultProps,
  controls: [betterListSourceWorkspaceControl],
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

function createPresentationTab(
  sourceItems: readonly ICoreBetterListItem[],
  configuration: IBetterListEffectiveTabConfiguration,
  sourceListTitle: string,
  mappings: IBetterListFieldMappings
): IBetterListTab {
  const richTextFieldPaths = getRichTextItemPropertyPaths(mappings);
  const descriptionFieldPath = mappings.description?.fieldPath || mappings.description?.internalName;
  const group = configuration.grouping.column
    ? { field: 'group' as const, direction: 'ascending' as const, ungroupedLabel: 'Other' }
    : undefined;
  const tab = {
    ...configuration.tab,
    group,
    layout: {
      ...configuration.tab.layout,
      columns: configuration.tab.layout?.columns ?? (2 as const),
      collapsible: group ? configuration.grouping.collapsible : false
    }
  };
  const groupedItems = configuration.grouping.column
    ? sourceItems.map((item) => ({
        ...item,
        values: {
          ...item.values,
          group: formatItemPropertyValue(
            item.source,
            configuration.grouping.column,
            richTextFieldPaths.has(configuration.grouping.column)
          )
        }
      }))
    : sourceItems;
  const processed = processItems(groupedItems, tab);
  const groups: readonly IBetterListGroupResult[] = group
    ? groupItems(processed, group)
    : [{ key: 'all', label: sourceListTitle || 'Items', items: processed }];
  const itemProperties = configuration.itemLayout.itemProperties;
  const itemElementLinks = configuration.itemLayout.links;
  const items: IBetterListItem[] = [];
  groups.forEach((group, groupIndex) => {
    group.items.forEach((item) => {
      const elements = itemProperties
        .filter((fieldPath) => fieldPath !== 'Title')
        .map((fieldPath) => {
          const isDescription = fieldPath === descriptionFieldPath;
          const normalizedMetadata = item.metadata.find((entry) => entry.key === fieldPath);
          const value = isDescription
            ? item.description
            : normalizedMetadata
              ? formatItemPropertyDisplayValue(normalizedMetadata.value)
              : formatItemPropertyValue(item.source, fieldPath, richTextFieldPaths.has(fieldPath));
          return value
            ? {
                key: fieldPath,
                kind: isDescription ? ('description' as const) : ('metadata' as const),
                value,
                href: itemElementLinks[fieldPath]
                  ? getItemPropertyUrl(item.source, itemElementLinks[fieldPath])
                  : undefined
              }
            : undefined;
        })
        .filter((element): element is {
          key: string;
          kind: 'description' | 'metadata';
          value: string;
          href: string | undefined;
        } => Boolean(element));
      const metadata = elements.filter((element) => element.kind === 'metadata').map((element) => element.value);
      items.push({
        id: String(item.id),
        title: item.title,
        href: itemElementLinks.Title ? getItemPropertyUrl(item.source, itemElementLinks.Title) : undefined,
        description:
          descriptionFieldPath && itemProperties.indexOf(descriptionFieldPath) >= 0 ? item.description : undefined,
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
    icon: tab.tabIcon,
    iconOverride: tab.tabIconOverride,
    itemCount: items.length,
    maxItems: tab.maxItems,
    showItemCount: tab.showItemCount,
    grouped: Boolean(tab.group),
    items,
    layout: tab.layout,
    itemPropertyFields: itemProperties,
    itemLayoutRows: configuration.itemLayout.rows,
    groupIconScope: configuration.grouping.column,
    groupIcons: configuration.grouping.icons
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
  return normalized === 'general' || normalized === 'communications' || normalized === 'policy' || normalized === 'support'
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
