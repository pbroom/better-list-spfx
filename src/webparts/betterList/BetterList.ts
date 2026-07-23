import '@fontsource-variable/geist-mono';

import * as React from 'react';
import * as ReactDom from 'react-dom';
import { GriffelRenderer, RendererProvider } from '@griffel/react';
import {
  FluentProvider,
  PortalMountNodeProvider,
  webDarkTheme,
  webLightTheme
} from '@fluentui/react-components';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { DisplayMode, Version } from '@microsoft/sp-core-library';
import { IPropertyPaneConfiguration, IPropertyPaneField, PropertyPaneFieldType } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import * as strings from 'WebPartStrings';

import {
  addTabFilterMappings,
  alignTabQueryFieldKinds,
  BetterListFieldValue,
  BetterListGroupIconOverride,
  BetterListItemElementLinks,
  BetterListRequestEpoch,
  betterListStylePresetVersion,
  createDefaultTabs,
  createBetterListGroupingOverride,
  createBetterListFieldCatalog,
  createBetterListLoadSignature,
  defaultBetterListScss,
  defaultBetterListHtmlTemplate,
  formatItemPropertyDisplayValue,
  formatItemPropertyValue,
  getRichTextItemPropertyPaths,
  getBetterListRenderer,
  getItemPropertyUrl,
  groupItemsBySourceField,
  itemPropertyFieldPathsEqual,
  IBetterListFieldMappings,
  IBetterListFieldInfo,
  IBetterListGroupResult,
  IBetterListEffectiveTabConfiguration,
  IBetterListItem as ICoreBetterListItem,
  IBetterListTabConfig,
  parseItemLayoutConfiguration,
  parseBetterListGroupIconsConfiguration,
  parseItemPropertyFields,
  parseTabConfiguration,
  processItems,
  resolveBetterListTabConfigurations,
  scopeBetterListStyles,
  serializeItemLayoutConfiguration,
  serializeBetterListGroupIconsConfiguration,
  serializeItemPropertyFields,
  serializeTabConfiguration,
  updateBetterListGroupIconOverride
} from '../../shared';
import BetterListView, { BetterListGroupIcon, IBetterListItem, IBetterListTab } from './components/BetterListView';
import {
  BetterListPropertyPane,
  IBetterListAuthoringState,
  IBetterListPickerDataSource,
  ISharePointFieldOption
} from './components/propertyPane/BetterListPropertyPane';
import {
  IBetterListDataSource,
  ISharePointImageAssetProvider,
  SharePointBetterListDataSource,
  SharePointImageAssetProvider,
  inferBetterListFieldKind
} from './services';

const BetterListRendererProvider = RendererProvider as unknown as React.ComponentType<{
  renderer: GriffelRenderer;
}>;

export interface IBetterListWebPartProps {
  heading: string;
  sourceListId: string;
  sourceListTitle: string;
  sourceWebUrl: string;
  fieldMappingsJson: string;
  itemPropertiesJson: string;
  itemLayoutJson: string;
  tabsColumn: string;
  groupsColumn: string;
  groupsCollapsible: boolean;
  groupIconsJson: string;
  tabsJson: string;
  customCss: string;
  htmlTemplate: string;
  stylePresetVersion?: number;
}

interface IPropertyPaneCustomFieldProps {
  key: string;
  onRender: (
    domElement: HTMLElement,
    context?: unknown,
    changeCallback?: (targetProperty?: string, newValue?: unknown, isValidEntry?: boolean) => void
  ) => void;
  onDispose: (domElement: HTMLElement) => void;
}

export default class BetterListWebPart extends BaseClientSideWebPart<IBetterListWebPartProps> {
  private _dataSource!: IBetterListDataSource;
  private _pickerDataSource!: IBetterListPickerDataSource;
  private _imageAssetProvider!: ISharePointImageAssetProvider;
  private _items: readonly ICoreBetterListItem[] = [];
  private _status: 'loading' | 'ready' | 'error' = 'loading';
  private _errorMessage = '';
  private _activeTabKey = '';
  private _isDarkTheme = false;
  private readonly _loadRequestEpoch = new BetterListRequestEpoch();

  public render(): void {
    const tabs = this._createEffectiveTabConfigurations();
    const fieldMappings = this._readMappings();
    const descriptionFieldPath = fieldMappings.description?.fieldPath || fieldMappings.description?.internalName;
    const richTextFieldPaths = getRichTextItemPropertyPaths(fieldMappings);
    const itemLayout = parseItemLayoutConfiguration(
      this.properties.itemLayoutJson,
      parseItemPropertyFields(this.properties.itemPropertiesJson)
    );
    const groupIcons = parseBetterListGroupIconsConfiguration(this.properties.groupIconsJson);
    const presentationTabs = tabs.map((tab) =>
      this._createPresentationTab(tab, descriptionFieldPath, richTextFieldPaths)
    );
    const firstTab = presentationTabs[0];
    if (!this._activeTabKey || !presentationTabs.some((tab) => tab.key === this._activeTabKey)) {
      this._activeTabKey = firstTab?.key || '';
    }
    const wrapperClassName = `better-list-instance-${this._getInstanceSeed()}`;
    const view = React.createElement(BetterListView, {
      tabs: presentationTabs,
      activeTabKey: this._activeTabKey,
      items: firstTab?.items || [],
      status: this._status,
      errorMessage: this._errorMessage || strings.ErrorMessage,
      emptyMessage: this._hasCompleteConfiguration()
        ? 'There are no active list items to display.'
        : 'Choose a source list and map its Title field in the web part settings.',
      htmlTemplate: this.properties.htmlTemplate,
      itemPropertyFields: itemLayout.itemProperties,
      itemLayoutRows: itemLayout.rows,
      groupIconScope: this.properties.groupsColumn,
      groupIcons,
      groupImageAssetProvider: this._imageAssetProvider,
      isEditMode: this.displayMode === DisplayMode.Edit,
      heading: this.properties.heading,
      listTitle: this.properties.sourceListTitle,
      onTabChange: (tabKey: string): void => {
        this._activeTabKey = tabKey;
        if (this.displayMode === DisplayMode.Edit) {
          this.context.propertyPane.refresh();
          this.render();
        }
      },
      onRetry: (): void => {
        this._reloadItems().catch(() => undefined);
      },
      onGroupIconOverrideChange:
        this.displayMode === DisplayMode.Edit
          ? (groupKey: string, override: BetterListGroupIconOverride | undefined): void => {
              this._updateGroupIconOverride(groupKey, override);
            }
          : undefined
    });

    ReactDom.render(
      React.createElement(
        BetterListRendererProvider,
        { renderer: getBetterListRenderer(this.domElement.ownerDocument) },
        React.createElement(
          FluentProvider,
          {
            className: wrapperClassName,
            targetDocument: this.domElement.ownerDocument,
            theme: this._isDarkTheme ? webDarkTheme : webLightTheme
          },
          React.createElement(
            PortalMountNodeProvider,
            { value: this.domElement.ownerDocument.body },
            this.properties.customCss
              ? React.createElement(
                  'style',
                  undefined,
                  scopeBetterListStyles(this.properties.customCss, `.${wrapperClassName}`)
                )
              : undefined,
            view
          )
        )
      ),
      this.domElement
    );
  }

  protected async onInit(): Promise<void> {
    this.properties.heading = this.properties.heading || '';
    this.properties.sourceListId = this.properties.sourceListId || '';
    this.properties.sourceListTitle = this.properties.sourceListTitle || '';
    this.properties.sourceWebUrl = this.properties.sourceWebUrl || '';
    this.properties.fieldMappingsJson = this.properties.fieldMappingsJson || '{}';
    this.properties.itemPropertiesJson = this.properties.itemPropertiesJson || serializeItemPropertyFields(['Title']);
    this.properties.itemLayoutJson = this.properties.itemLayoutJson || '[]';
    this.properties.tabsColumn = this.properties.tabsColumn || '';
    this.properties.groupsColumn = this.properties.groupsColumn || '';
    this.properties.groupsCollapsible = this.properties.groupsCollapsible !== false;
    this.properties.groupIconsJson =
      this.properties.groupIconsJson ||
      serializeBetterListGroupIconsConfiguration(parseBetterListGroupIconsConfiguration(undefined));
    this.properties.tabsJson = this.properties.tabsJson || serializeTabConfiguration(createDefaultTabs());
    this.properties.htmlTemplate = this.properties.htmlTemplate || defaultBetterListHtmlTemplate;
    if (!this.properties.stylePresetVersion) {
      this.properties.customCss = this.properties.customCss || defaultBetterListScss;
      this.properties.stylePresetVersion = betterListStylePresetVersion;
    }

    this._dataSource = new SharePointBetterListDataSource(
      this.context.spHttpClient,
      this.context.pageContext.web.absoluteUrl
    );
    this._imageAssetProvider = new SharePointImageAssetProvider(
      this.context.spHttpClient,
      this.context.pageContext.web.absoluteUrl
    );
    this._pickerDataSource = {
      loadLists: async () => {
        const lists = await this._dataSource.discoverLists();
        return lists.map((list) => ({
          id: list.id,
          title: list.title,
          webUrl: list.webUrl
        }));
      },
      resolveListUrl: async (value: string) => {
        const list = await this._dataSource.resolveListUrl(value);
        return { id: list.id, title: list.title, webUrl: list.webUrl };
      },
      loadFields: async (list) => {
        const listReference = {
          id: list.id,
          title: list.title,
          webUrl: list.webUrl
        };
        const fields = await this._dataSource.discoverFields(listReference);
        const lookupListIds = Array.from(
          new Set(
            fields
              .map((field) => field.lookupListId)
              .filter((lookupListId): lookupListId is string => Boolean(lookupListId))
          )
        );
        const lookupFieldEntries = await Promise.all(
          lookupListIds.map(async (lookupListId) => {
            try {
              return {
                lookupListId,
                fields: await this._dataSource.discoverFields({
                  id: lookupListId,
                  webUrl: list.webUrl
                })
              };
            } catch {
              return { lookupListId, fields: [] };
            }
          })
        );
        const lookupFieldsByListId = new Map(
          lookupFieldEntries.map((entry) => [
            entry.lookupListId,
            entry.fields.filter(isSupportedLookupTargetField).map(toFieldDescriptor)
          ])
        );
        return createBetterListFieldCatalog(
          fields.map((field) => ({
            ...toFieldDescriptor(field),
            lookupFields: field.lookupListId ? lookupFieldsByListId.get(field.lookupListId) : undefined
          }))
        );
      }
    };
    await this._reloadItems();
  }

  protected onThemeChanged(theme: IReadonlyTheme | undefined): void {
    this._isDarkTheme = Boolean(theme?.isInverted);
  }

  protected onDispose(): void {
    this._loadRequestEpoch.invalidate();
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.PropertyPaneGroupName,
              isGroupNameHidden: true,
              groupFields: [this._createCustomPropertyPaneField()]
            }
          ]
        }
      ]
    };
  }

  private _createCustomPropertyPaneField(): IPropertyPaneField<IPropertyPaneCustomFieldProps> {
    return {
      type: PropertyPaneFieldType.Custom,
      targetProperty: 'fieldMappingsJson',
      properties: {
        key: 'better-list-property-pane',
        onRender: (domElement, _context, changeCallback): void => {
          ReactDom.render(
            React.createElement(
              BetterListRendererProvider,
              { renderer: getBetterListRenderer(domElement.ownerDocument) },
              React.createElement(BetterListPropertyPane, {
                activeTabId: this._activeTabKey,
                targetDocument: domElement.ownerDocument,
                value: this._createAuthoringState(),
                pickerDataSource: this._pickerDataSource,
                imageAssetProvider: this._imageAssetProvider,
                onChange: (value): void => this._applyAuthoringState(value, changeCallback),
                onActiveTabChange: (tabId: string): void => {
                  this._activeTabKey = tabId;
                  this.render();
                  this.context.propertyPane.refresh();
                }
              })
            ),
            domElement
          );
        },
        onDispose: (domElement): void => {
          ReactDom.unmountComponentAtNode(domElement);
        }
      }
    };
  }

  private _createAuthoringState(): IBetterListAuthoringState {
    const itemLayout = parseItemLayoutConfiguration(
      this.properties.itemLayoutJson,
      parseItemPropertyFields(this.properties.itemPropertiesJson)
    );
    return {
      heading: this.properties.heading,
      sourceListId: this.properties.sourceListId,
      sourceListTitle: this.properties.sourceListTitle,
      sourceWebUrl: this.properties.sourceWebUrl,
      fieldMappings: this._readMappings(),
      itemProperties: itemLayout.itemProperties,
      itemLayoutRows: itemLayout.rows,
      itemElementLinks: itemLayout.links,
      tabsColumn: this.properties.tabsColumn,
      groupsColumn: this.properties.groupsColumn,
      groupsCollapsible: this.properties.groupsCollapsible,
      groupIcons: parseBetterListGroupIconsConfiguration(this.properties.groupIconsJson),
      tabs: this._readTabs().slice(),
      customCss: this.properties.customCss,
      htmlTemplate: this.properties.htmlTemplate
    };
  }

  private _applyAuthoringState(
    value: IBetterListAuthoringState,
    changeCallback?: (targetProperty?: string, newValue?: unknown, isValidEntry?: boolean) => void
  ): void {
    const nextTabs = coerceTabFilterValues(value.tabs.length ? value.tabs : [createFallbackTab()], value.fieldMappings);
    const currentLoadSignature = createBetterListLoadSignature(
      {
        id: this.properties.sourceListId,
        title: this.properties.sourceListTitle,
        webUrl: this.properties.sourceWebUrl || undefined
      },
      addTabFilterMappings(this._readMappings() as IBetterListFieldMappings, this._readTabs())
    );
    const nextLoadSignature = createBetterListLoadSignature(
      {
        id: value.sourceListId,
        title: value.sourceListTitle,
        webUrl: value.sourceWebUrl || undefined
      },
      addTabFilterMappings(value.fieldMappings as IBetterListFieldMappings, nextTabs)
    );
    const next = {
      heading: value.heading,
      sourceListId: value.sourceListId,
      sourceListTitle: value.sourceListTitle,
      sourceWebUrl: value.sourceWebUrl,
      fieldMappingsJson: JSON.stringify(value.fieldMappings),
      itemPropertiesJson: serializeItemPropertyFields(value.itemProperties),
      itemLayoutJson: serializeItemLayoutConfiguration(
        value.itemLayoutRows,
        value.itemProperties,
        value.itemElementLinks
      ),
      tabsColumn: value.tabsColumn,
      groupsColumn: value.groupsColumn,
      groupsCollapsible: value.groupsCollapsible,
      groupIconsJson: serializeBetterListGroupIconsConfiguration(value.groupIcons),
      tabsJson: serializeTabConfiguration(nextTabs),
      customCss: value.customCss,
      htmlTemplate: value.htmlTemplate
    };
    const reloadRequired = currentLoadSignature !== nextLoadSignature;

    const properties = this.properties as unknown as Record<string, string | boolean | number | undefined>;
    (Object.keys(next) as Array<keyof typeof next>).forEach((propertyPath) => {
      if (properties[propertyPath] !== next[propertyPath]) {
        properties[propertyPath] = next[propertyPath];
        changeCallback?.(propertyPath, next[propertyPath], true);
      }
    });

    if (reloadRequired) {
      this._reloadItems().catch(() => undefined);
    } else {
      this.render();
    }
  }

  private _updateGroupIconOverride(groupKey: string, override: BetterListGroupIconOverride | undefined): void {
    const configurations = this._createEffectiveTabConfigurations();
    const active = configurations.find((entry) => entry.tab.id === this._activeTabKey) ?? configurations[0];
    if (!active || !active.grouping.column) {
      return;
    }
    const icons = updateBetterListGroupIconOverride(active.grouping.icons, active.grouping.column, groupKey, override);
    this.properties.tabsJson = serializeTabConfiguration(
      this._readTabs().map((tab) =>
        tab.id === active.tab.id
          ? {
              ...tab,
              groupingOverride: createBetterListGroupingOverride({
                ...active.grouping,
                icons
              })
            }
          : tab
      )
    );
    this.context.propertyPane.refresh();
    this.render();
  }

  private async _reloadItems(): Promise<void> {
    const requestEpoch = this._loadRequestEpoch.begin();
    if (!this._hasCompleteConfiguration()) {
      this._items = [];
      this._status = 'ready';
      this._errorMessage = '';
      this.render();
      return;
    }

    this._status = 'loading';
    this._errorMessage = '';
    this.render();
    try {
      const result = await this._dataSource.loadItems({
        list: {
          id: this.properties.sourceListId,
          title: this.properties.sourceListTitle,
          webUrl: this.properties.sourceWebUrl || undefined
        },
        mappings: addTabFilterMappings(this._readMappings() as IBetterListFieldMappings, this._readTabs())
      });
      if (!this._loadRequestEpoch.isCurrent(requestEpoch)) {
        return;
      }
      this._items = result.items;
      this._status = 'ready';
    } catch (error) {
      if (!this._loadRequestEpoch.isCurrent(requestEpoch)) {
        return;
      }
      this._items = [];
      this._status = 'error';
      this._errorMessage = error instanceof Error ? error.message : strings.ErrorMessage;
    }
    this.render();
  }

  private _createPresentationTab(
    configuration: IBetterListEffectiveTabConfiguration,
    descriptionFieldPath: string | undefined,
    richTextFieldPaths: ReadonlySet<string>
  ): IBetterListTab {
    const group = configuration.grouping.column
      ? {
          field: 'group' as const,
          direction: 'ascending' as const,
          ungroupedLabel: 'Other'
        }
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
    const processed = processItems(this._items, tab);
    const groups: readonly IBetterListGroupResult[] = group
      ? groupItemsBySourceField(
          processed,
          configuration.grouping.column,
          configuration.grouping.filter,
          group.ungroupedLabel,
          richTextFieldPaths.has(configuration.grouping.column)
        )
      : [{ key: 'all', label: this.properties.sourceListTitle || 'Items', items: processed }];
    const items: IBetterListItem[] = [];
    groups.forEach((group, groupIndex) => {
      group.items.forEach((item) => {
        items.push(
          this._createPresentationItem(
            item,
            group,
            groupIndex,
            tab,
            configuration.itemLayout.itemProperties,
            configuration.itemLayout.links,
            descriptionFieldPath,
            richTextFieldPaths
          )
        );
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
      itemPropertyFields: configuration.itemLayout.itemProperties,
      itemLayoutRows: configuration.itemLayout.rows,
      groupIconScope: configuration.grouping.column,
      groupIcons: configuration.grouping.icons
    };
  }

  private _createPresentationItem(
    item: ICoreBetterListItem,
    group: IBetterListGroupResult,
    groupIndex: number,
    tab: IBetterListTabConfig,
    itemProperties: readonly string[],
    itemElementLinks: BetterListItemElementLinks,
    descriptionFieldPath: string | undefined,
    richTextFieldPaths: ReadonlySet<string>
  ): IBetterListItem {
    const elements = itemProperties
      .filter((fieldPath) => fieldPath !== 'Title')
      .map((fieldPath) => {
        const isDescription = Boolean(
          descriptionFieldPath && itemPropertyFieldPathsEqual(fieldPath, descriptionFieldPath)
        );
        const normalizedMetadata = item.metadata.find((entry) => itemPropertyFieldPathsEqual(entry.key, fieldPath));
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
      .filter(
        (
          element
        ): element is {
          key: string;
          kind: 'description' | 'metadata';
          value: string;
          href: string | undefined;
        } => Boolean(element)
      );
    const metadata = elements.filter((element) => element.kind === 'metadata').map((element) => element.value);
    return {
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
    };
  }

  private _readMappings(): Partial<IBetterListFieldMappings> {
    try {
      const parsed = JSON.parse(this.properties.fieldMappingsJson || '{}') as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Partial<IBetterListFieldMappings>)
        : {};
    } catch {
      return {};
    }
  }

  private _readTabs(): readonly IBetterListTabConfig[] {
    try {
      return parseTabConfiguration(this.properties.tabsJson);
    } catch {
      return [createFallbackTab()];
    }
  }

  private _createEffectiveTabConfigurations(): readonly IBetterListEffectiveTabConfiguration[] {
    const itemLayout = parseItemLayoutConfiguration(
      this.properties.itemLayoutJson,
      parseItemPropertyFields(this.properties.itemPropertiesJson)
    );
    return resolveBetterListTabConfigurations(this._readTabs(), {
      grouping: {
        column: this.properties.groupsColumn,
        collapsible: this.properties.groupsCollapsible,
        icons: parseBetterListGroupIconsConfiguration(this.properties.groupIconsJson),
        filter: { kind: 'all' }
      },
      itemLayout
    });
  }

  private _hasCompleteConfiguration(): boolean {
    return Boolean(this.properties.sourceListId && this._readMappings().title);
  }

  private _getInstanceSeed(): string {
    const instanceId =
      (this as unknown as { instanceId?: string }).instanceId ||
      (this.context as unknown as { instanceId?: string }).instanceId ||
      this.context.manifest.id;
    return instanceId.toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  }
}

function toFieldDescriptor(field: IBetterListFieldInfo): ISharePointFieldOption {
  return {
    internalName: field.internalName,
    queryName: field.entityPropertyName,
    title: field.title,
    typeAsString: field.typeAsString,
    richText: field.richText,
    richTextMode: field.richTextMode,
    allowMultipleValues: field.allowMultipleValues,
    lookupListId: field.lookupListId,
    lookupField: field.lookupField,
    required: field.required,
    hidden: field.hidden,
    readOnly: field.readOnly
  };
}

function isSupportedLookupTargetField(field: IBetterListFieldInfo): boolean {
  const kind = inferBetterListFieldKind(field.typeAsString);
  return Boolean(kind && kind !== 'lookup' && kind !== 'person');
}

function createFallbackTab(): IBetterListTabConfig {
  return {
    id: 'all',
    label: 'All items',
    filter: { kind: 'all' },
    icon: { mode: 'none' }
  };
}

function coerceTabFilterValues(
  tabs: readonly IBetterListTabConfig[],
  mappings: Partial<IBetterListFieldMappings>
): readonly IBetterListTabConfig[] {
  return tabs.map((tab) => {
    if (tab.filter.kind === 'all') {
      return tab;
    }
    if (tab.filter.kind === 'query') {
      return alignTabQueryFieldKinds(tab, mappings);
    }
    const mapping = tab.filter.kind === 'sourceEquals' ? tab.filter.mapping : mappings[tab.filter.field];
    const rawValue = tab.filter.value;
    let value = rawValue;
    if (mapping?.kind === 'boolean' && typeof rawValue === 'string') {
      value = /^(true|yes|1)$/i.test(rawValue.trim());
    } else if (mapping?.kind === 'number' && typeof rawValue === 'string' && rawValue.trim()) {
      const parsed = Number(rawValue);
      value = Number.isFinite(parsed) ? parsed : rawValue;
    }
    return { ...tab, filter: { ...tab.filter, value } };
  });
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
