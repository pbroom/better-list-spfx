import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  IPropertyPaneField,
  PropertyPaneFieldType
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import * as strings from 'WebPartStrings';

import {
  BetterListFieldValue,
  BetterListComparableValue,
  betterListStylePresetVersion,
  createDefaultTabs,
  defaultBetterListScss,
  formatItemPropertyValue,
  getItemPropertyUrl,
  groupItems,
  IBetterListFieldMappings,
  IBetterListFieldInfo,
  IBetterListGroupResult,
  IBetterListItem as ICoreBetterListItem,
  IBetterListTabConfig,
  parseItemPropertyFields,
  parseTabConfiguration,
  processItems,
  scopeBetterListStyles,
  serializeItemPropertyFields,
  serializeTabConfiguration
} from '../../shared';
import BetterListView, {
  BetterListGroupIcon,
  IBetterListItem,
  IBetterListTab
} from './components/BetterListView';
import {
  BetterListPropertyPane,
  IBetterListAuthoringState,
  IBetterListPickerDataSource,
  ISharePointFieldOption
} from './components/propertyPane/BetterListPropertyPane';
import {
  IBetterListDataSource,
  inferBetterListFieldKind,
  SharePointBetterListDataSource
} from './services';

export interface IBetterListWebPartProps {
  sourceListId: string;
  sourceListTitle: string;
  fieldMappingsJson: string;
  itemPropertiesJson: string;
  tabsColumn: string;
  groupsColumn: string;
  groupsCollapsible: boolean;
  tabsJson: string;
  customCss: string;
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
  private _items: readonly ICoreBetterListItem[] = [];
  private _status: 'loading' | 'ready' | 'error' = 'loading';
  private _errorMessage = '';
  private _activeTabKey = '';

  public render(): void {
    const tabs = this._createEffectiveTabs();
    const presentationTabs = tabs.map((tab) => this._createPresentationTab(tab));
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
      onTabChange: (tabKey: string): void => {
        this._activeTabKey = tabKey;
      },
      onRetry: (): void => {
        this._reloadItems().catch(() => undefined);
      }
    });

    ReactDom.render(
      React.createElement(
        'div',
        { className: wrapperClassName },
        this.properties.customCss
          ? React.createElement(
              'style',
              undefined,
              scopeBetterListStyles(this.properties.customCss, `.${wrapperClassName}`)
            )
          : undefined,
        view
      ),
      this.domElement
    );
  }

  protected async onInit(): Promise<void> {
    this.properties.sourceListId = this.properties.sourceListId || '';
    this.properties.sourceListTitle = this.properties.sourceListTitle || '';
    this.properties.fieldMappingsJson = this.properties.fieldMappingsJson || '{}';
    this.properties.itemPropertiesJson =
      this.properties.itemPropertiesJson || serializeItemPropertyFields(['Title']);
    this.properties.tabsColumn = this.properties.tabsColumn || '';
    this.properties.groupsColumn = this.properties.groupsColumn || '';
    this.properties.groupsCollapsible = this.properties.groupsCollapsible !== false;
    this.properties.tabsJson = this.properties.tabsJson || serializeTabConfiguration(createDefaultTabs());
    if (!this.properties.stylePresetVersion) {
      this.properties.customCss = this.properties.customCss || defaultBetterListScss;
      this.properties.stylePresetVersion = betterListStylePresetVersion;
    }

    this._dataSource = new SharePointBetterListDataSource(
      this.context.spHttpClient,
      this.context.pageContext.web.absoluteUrl
    );
    this._pickerDataSource = {
      loadLists: async () => {
        const lists = await this._dataSource.discoverLists();
        return lists.map((list) => ({ id: list.id, title: list.title }));
      },
      loadFields: async (listId: string) => {
        const fields = await this._dataSource.discoverFields({ id: listId });
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
                fields: await this._dataSource.discoverFields({ id: lookupListId })
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
        return fields.map((field) => ({
          ...toFieldDescriptor(field),
          lookupFields: field.lookupListId
            ? lookupFieldsByListId.get(field.lookupListId)
            : undefined
        }));
      }
    };
    await this._reloadItems();
  }

  protected onDispose(): void {
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
            React.createElement(BetterListPropertyPane, {
              value: this._createAuthoringState(),
              pickerDataSource: this._pickerDataSource,
              onChange: (value): void => this._applyAuthoringState(value, changeCallback)
            }),
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
    return {
      sourceListId: this.properties.sourceListId,
      sourceListTitle: this.properties.sourceListTitle,
      fieldMappings: this._readMappings(),
      itemProperties: parseItemPropertyFields(this.properties.itemPropertiesJson),
      tabsColumn: this.properties.tabsColumn,
      groupsColumn: this.properties.groupsColumn,
      groupsCollapsible: this.properties.groupsCollapsible,
      tabs: this._readTabs().slice(),
      customCss: this.properties.customCss
    };
  }

  private _applyAuthoringState(
    value: IBetterListAuthoringState,
    changeCallback?: (targetProperty?: string, newValue?: unknown, isValidEntry?: boolean) => void
  ): void {
    const next = {
      sourceListId: value.sourceListId,
      sourceListTitle: value.sourceListTitle,
      fieldMappingsJson: JSON.stringify(value.fieldMappings),
      itemPropertiesJson: serializeItemPropertyFields(value.itemProperties),
      tabsColumn: value.tabsColumn,
      groupsColumn: value.groupsColumn,
      groupsCollapsible: value.groupsCollapsible,
      tabsJson: serializeTabConfiguration(
        coerceTabFilterValues(value.tabs.length ? value.tabs : [createFallbackTab()], value.fieldMappings)
      ),
      customCss: value.customCss
    };
    const reloadRequired =
      next.sourceListId !== this.properties.sourceListId ||
      next.sourceListTitle !== this.properties.sourceListTitle ||
      next.fieldMappingsJson !== this.properties.fieldMappingsJson ||
      next.itemPropertiesJson !== this.properties.itemPropertiesJson ||
      next.tabsColumn !== this.properties.tabsColumn ||
      next.groupsColumn !== this.properties.groupsColumn ||
      next.groupsCollapsible !== this.properties.groupsCollapsible ||
      next.tabsJson !== this.properties.tabsJson;

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

  private async _reloadItems(): Promise<void> {
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
        list: { id: this.properties.sourceListId, title: this.properties.sourceListTitle },
        mappings: this._readMappings() as IBetterListFieldMappings
      });
      this._items = result.items;
      this._status = 'ready';
    } catch (error) {
      this._items = [];
      this._status = 'error';
      this._errorMessage = error instanceof Error ? error.message : strings.ErrorMessage;
    }
    this.render();
  }

  private _createPresentationTab(tab: IBetterListTabConfig): IBetterListTab {
    const processed = processItems(this._items, tab);
    const groups: readonly IBetterListGroupResult[] = tab.group
      ? groupItems(processed, tab.group)
      : [{ key: 'all', label: this.properties.sourceListTitle || 'Items', items: processed }];
    const items: IBetterListItem[] = [];
    const itemProperties = parseItemPropertyFields(this.properties.itemPropertiesJson);
    const selectedItemProperties = new Set(itemProperties);
    groups.forEach((group, groupIndex) => {
      group.items.forEach((item) => {
        items.push(
          this._createPresentationItem(
            item,
            group,
            groupIndex,
            tab,
            itemProperties,
            selectedItemProperties
          )
        );
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

  private _createPresentationItem(
    item: ICoreBetterListItem,
    group: IBetterListGroupResult,
    groupIndex: number,
    tab: IBetterListTabConfig,
    itemProperties: readonly string[],
    selectedItemProperties: ReadonlySet<string>
  ): IBetterListItem {
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
    return {
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

  private _createEffectiveTabs(): readonly IBetterListTabConfig[] {
    const configuredTabs = this._readTabs();
    const configuredLayout = configuredTabs[0]?.layout;
    const group = this.properties.groupsColumn
      ? { field: 'group' as const, direction: 'ascending' as const, ungroupedLabel: 'Other' }
      : undefined;
    const layout = {
      ...configuredLayout,
      columns: configuredLayout?.columns ?? (2 as const),
      collapsible: group ? this.properties.groupsCollapsible : false
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
    if (!this.properties.tabsColumn) {
      return [baseTab];
    }

    const uniqueValues = new Map<string, BetterListComparableValue>();
    this._items.forEach((item) => {
      const value = item.values.tab;
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
    return [
      ...Array.from(uniqueValues.entries()).map(
        ([label, value], index): IBetterListTabConfig => ({
          id: `column-${slugify(label)}-${index}`,
          label,
          filter: { kind: 'equals', field: 'tab', value },
          group,
          icon: { mode: 'none' },
          layout
        })
      ),
      { ...baseTab, label: 'All items' }
    ];
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
    title: field.title,
    typeAsString: field.typeAsString,
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
  return { id: 'all', label: 'All items', filter: { kind: 'all' }, icon: { mode: 'none' } };
}

function coerceTabFilterValues(
  tabs: readonly IBetterListTabConfig[],
  mappings: Partial<IBetterListFieldMappings>
): readonly IBetterListTabConfig[] {
  return tabs.map((tab) => {
    if (tab.filter.kind !== 'equals') {
      return tab;
    }
    const mapping = mappings[tab.filter.field];
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
  const raw = (tab.icon?.mode === 'fixed'
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

function stripSortPrefix(value: string): string {
  return value.trim().replace(/^\d+(?:\.\d+)?\s*\|\s*/, '');
}

function formatColumnLabel(value: BetterListFieldValue | undefined): string {
  return typeof value === 'boolean'
    ? value
      ? 'Yes'
      : 'No'
    : stripSortPrefix(toDisplayString(value));
}

function slugify(value: string): string {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'value'
  );
}
