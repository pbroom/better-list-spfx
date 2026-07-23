/* eslint-disable @typescript-eslint/no-use-before-define -- Small property-pane controls are composed before their declarations. */
import * as React from 'react';
import {
  Button,
  Combobox,
  Dropdown,
  FluentProvider,
  Input,
  Option,
  PortalMountNodeProvider,
  Switch,
  tokens,
  webLightTheme
} from '@fluentui/react-components';
import { AddRegular, EditRegular } from '@fluentui/react-icons';

import {
  createBetterListFieldMapping,
  createBetterListFieldPathCatalog,
  createBetterListGroupingOverride,
  createBetterListItemLayoutOverride,
  createBetterListMetadataMappings,
  createBetterListSortableFieldOptions,
  parseBetterListFieldPath,
  collectBetterListQueryFields,
  createDefaultTabs,
  betterListDefaultSortOptions,
  betterListSemanticSlots,
  defaultBetterListHtmlTemplate,
  betterListTemplateMaxBytes,
  BetterListFilter,
  BetterListItemLayoutRows,
  BetterListItemElementLinks,
  betterListFluentSurfaceClassName,
  betterListPortalMountNodeProps,
  BetterListColumnCount,
  BetterListDefaultSort,
  createBetterListPortalPositioning,
  getBetterListDefaultSortFieldPath,
  getBetterListPortalMountNode,
  IBetterListFieldDescriptor,
  IBetterListFieldMappings,
  IBetterListGroupIconsConfiguration,
  IBetterListGroupOrderEntry,
  IBetterListQueryField,
  IBetterListTabConfig,
  resolveBetterListTabConfigurations,
  validateBetterListTemplateStructure
} from '../../../../shared';
import { ISourceEditorTarget } from '../../../../vendor/source-editor/SourceEditorField';
import { SourceWorkspaceField } from '../../../../vendor/source-editor/SourceWorkspaceField';
import { GroupIconColorField } from '../GroupIconColorField';
import {
  GroupOrderEditorDialog,
  IBetterListGroupOption
} from './GroupOrderEditorDialog';
import { ItemPropertyBuilder } from './ItemPropertyBuilder';
import { PropertyPaneSection } from './PropertyPaneSection';
import {
  appendNewTab,
  filterExpression,
  FilterQueryEditor,
  IBetterListTabFilterField,
  TabBuilder
} from './TabBuilder';
import type { ISharePointImageAssetProvider } from '../../services';

const titleCommitDelayMs = 500;

export interface IBetterListAuthoringState {
  heading: string;
  itemColumns: BetterListColumnCount;
  maxItemsPerPage: number;
  showSearch: boolean;
  showSortingOptions: boolean;
  defaultSort: BetterListDefaultSort;
  defaultSortColumn: string;
  sourceListId: string;
  sourceListTitle: string;
  sourceWebUrl: string;
  fieldMappings: Partial<IBetterListFieldMappings>;
  itemProperties: readonly string[];
  itemLayoutRows: BetterListItemLayoutRows;
  itemElementLinks: BetterListItemElementLinks;
  tabsColumn: string;
  groupsColumn: string;
  groupsCollapsible: boolean;
  groupIcons: IBetterListGroupIconsConfiguration;
  tabs: IBetterListTabConfig[];
  customCss: string;
  htmlTemplate: string;
}

export interface ISharePointListOption {
  id: string;
  title: string;
  webUrl?: string;
}

export interface ISharePointFieldOption extends IBetterListFieldDescriptor {
  hidden?: boolean;
  readOnly?: boolean;
}

export interface IBetterListPickerDataSource {
  loadLists: () => Promise<readonly ISharePointListOption[]>;
  resolveListUrl: (value: string) => Promise<ISharePointListOption>;
  loadFields: (list: ISharePointListOption) => Promise<readonly ISharePointFieldOption[]>;
}

export interface IBetterListPropertyPaneProps {
  activeTabId?: string;
  value: IBetterListAuthoringState;
  pickerDataSource: IBetterListPickerDataSource;
  imageAssetProvider?: ISharePointImageAssetProvider;
  loadGroupOptions?: (
    tabId: string,
    column: string,
    filter: BetterListFilter
  ) => Promise<readonly IBetterListGroupOption[]>;
  onChange: (value: IBetterListAuthoringState) => void;
  onActiveTabChange?: (tabId: string) => void;
  targetDocument?: Document;
}

const cssTargets: readonly ISourceEditorTarget[] = [
  { label: 'Web part', selector: '.better-list', snippet: '.better-list {\n  /* layout and theme overrides */\n}' },
  { label: 'Header', selector: '.better-list__header', snippet: '.better-list__header {\n  /* title and search area */\n}' },
  { label: 'Heading', selector: '.better-list__heading', snippet: '.better-list__heading {\n  /* optional list heading */\n}' },
  { label: 'Tabs', selector: '.better-list__tabs', snippet: '.better-list__tabs {\n  /* tab row */\n}' },
  { label: 'Group', selector: '.better-list__group', snippet: '.better-list__group {\n  /* grouped section */\n}' },
  {
    label: 'Group heading',
    selector: '.better-list__group-heading',
    snippet: '.better-list__group-heading {\n  /* group icon and title */\n}'
  },
  {
    label: 'Pagination',
    selector: '.better-list__pagination',
    snippet: '.better-list__pagination {\n  /* page navigation */\n}'
  },
  {
    label: 'Load more',
    selector: '.better-list__load-more',
    snippet: '.better-list__load-more {\n  /* progressive result loading */\n}'
  },
  { label: 'Item', selector: '.better-list__item', snippet: '.better-list__item {\n  /* list item */\n}' },
  {
    label: 'Item row 1',
    selector: '.better-list-row-1',
    snippet: '.better-list .better-list-row-1 {\n  /* first horizontal item row */\n}'
  },
  {
    label: 'Item row 2',
    selector: '.better-list-row-2',
    snippet: '.better-list .better-list-row-2 {\n  /* second horizontal item row */\n}'
  },
  {
    label: 'Item row 3',
    selector: '.better-list-row-3',
    snippet: '.better-list .better-list-row-3 {\n  /* third horizontal item row */\n}'
  },
  {
    label: 'Item row 4',
    selector: '.better-list-row-4',
    snippet: '.better-list .better-list-row-4 {\n  /* fourth horizontal item row */\n}'
  },
  {
    label: 'Item row 5',
    selector: '.better-list-row-5',
    snippet: '.better-list .better-list-row-5 {\n  /* fifth horizontal item row */\n}'
  },
  { label: 'Item title', selector: '.better-list__item-title', snippet: '.better-list__item-title {\n  /* item link */\n}' },
  {
    label: 'Description',
    selector: '.better-list__item-description',
    snippet: '.better-list__item-description {\n  /* item description */\n}'
  },
  { label: 'Metadata', selector: '.better-list__metadata', snippet: '.better-list__metadata {\n  /* optional metadata */\n}' }
];

export const BetterListPropertyPane: React.FunctionComponent<IBetterListPropertyPaneProps> = (props) => {
  const [lists, setLists] = React.useState<readonly ISharePointListOption[]>([]);
  const [fields, setFields] = React.useState<readonly ISharePointFieldOption[]>([]);
  const [loadingLists, setLoadingLists] = React.useState(false);
  const [resolvingSource, setResolvingSource] = React.useState(false);
  const [sourceInput, setSourceInput] = React.useState(props.value.sourceListTitle);
  const [sourceError, setSourceError] = React.useState('');
  const [listError, setListError] = React.useState('');
  const [fieldError, setFieldError] = React.useState('');
  const [headingInput, setHeadingInput] = React.useState(props.value.heading);
  const [groupEditorOpen, setGroupEditorOpen] = React.useState(false);
  const [groupOptionsLoading, setGroupOptionsLoading] = React.useState(false);
  const [groupOptions, setGroupOptions] = React.useState<readonly IBetterListGroupOption[]>([]);
  const [groupOptionsError, setGroupOptionsError] = React.useState('');
  const headingInputRef = React.useRef(props.value.heading);
  const headingCommitTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestValueRef = React.useRef(props.value);
  const onChangeRef = React.useRef(props.onChange);
  const sourceRequest = React.useRef(0);
  const groupOptionsRequest = React.useRef(0);
  const groupOptionsContextRef = React.useRef('');

  latestValueRef.current = props.value;
  onChangeRef.current = props.onChange;

  const clearHeadingCommitTimer = React.useCallback((): void => {
    if (headingCommitTimerRef.current !== undefined) {
      clearTimeout(headingCommitTimerRef.current);
      headingCommitTimerRef.current = undefined;
    }
  }, []);

  const commitHeading = React.useCallback((): void => {
    clearHeadingCommitTimer();
    const latestValue = latestValueRef.current;
    const headingDraft = headingInputRef.current;
    if (headingDraft !== latestValue.heading) {
      const nextValue = { ...latestValue, heading: headingDraft };
      latestValueRef.current = nextValue;
      onChangeRef.current(nextValue);
    }
  }, [clearHeadingCommitTimer]);

  const scheduleHeadingCommit = React.useCallback((): void => {
    clearHeadingCommitTimer();
    headingCommitTimerRef.current = setTimeout(commitHeading, titleCommitDelayMs);
  }, [clearHeadingCommitTimer, commitHeading]);

  React.useEffect(() => () => {
    sourceRequest.current += 1;
    groupOptionsRequest.current += 1;
  }, []);

  React.useEffect(() => () => commitHeading(), [commitHeading]);

  React.useEffect(() => {
    setSourceInput(props.value.sourceListTitle);
  }, [props.value.sourceListId, props.value.sourceListTitle, props.value.sourceWebUrl]);

  React.useEffect(() => {
    headingInputRef.current = props.value.heading;
    setHeadingInput(props.value.heading);
  }, [props.value.heading]);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingLists(true);
    props.pickerDataSource
      .loadLists()
      .then((nextLists) => {
        if (!cancelled) {
          setLists(nextLists);
          setListError('');
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setListError(loadError.message || 'Lists could not be loaded.');
        }
      })
      .then(() => {
        if (!cancelled) {
          setLoadingLists(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingLists(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.pickerDataSource]);

  React.useEffect(() => {
    let cancelled = false;
    if (!props.value.sourceListId) {
      setFields([]);
      return undefined;
    }
    props.pickerDataSource
      .loadFields({
        id: props.value.sourceListId,
        title: props.value.sourceListTitle,
        webUrl: props.value.sourceWebUrl || undefined
      })
      .then((nextFields) => {
        if (!cancelled) {
          setFields(nextFields.filter((field) => !field.hidden));
          setFieldError('');
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setFieldError(loadError.message || 'Fields could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.pickerDataSource, props.value.sourceListId, props.value.sourceListTitle, props.value.sourceWebUrl]);

  const patchValue = (patch: Partial<IBetterListAuthoringState>): void => {
    props.onChange({ ...props.value, ...patch });
  };

  const activeTabId = props.value.tabs.some((tab) => tab.id === props.activeTabId)
    ? props.activeTabId as string
    : props.value.tabs[0]?.id || '';
  const effectiveTabs = resolveBetterListTabConfigurations(props.value.tabs, {
    grouping: {
      column: props.value.groupsColumn,
      collapsible: props.value.groupsCollapsible,
      icons: props.value.groupIcons,
      filter: { kind: 'all' }
    },
    itemLayout: {
      itemProperties: props.value.itemProperties,
      rows: props.value.itemLayoutRows,
      links: props.value.itemElementLinks
    }
  });
  const activeConfiguration =
    effectiveTabs.find((entry) => entry.tab.id === activeTabId) ?? effectiveTabs[0];
  const activeGrouping = activeConfiguration?.grouping ?? {
    column: '',
    collapsible: false,
    icons: props.value.groupIcons,
    filter: { kind: 'all' as const },
    groupOrder: [] as readonly IBetterListGroupOrderEntry[]
  };
  const groupOptionsContext = JSON.stringify([
    activeTabId,
    activeGrouping.column,
    activeGrouping.filter
  ]);
  groupOptionsContextRef.current = groupOptionsContext;
  React.useEffect(() => {
    groupOptionsRequest.current += 1;
    setGroupOptionsLoading(false);
    setGroupOptionsError('');
    setGroupEditorOpen(false);
  }, [groupOptionsContext]);
  const activeItemLayout = activeConfiguration?.itemLayout ?? {
    itemProperties: props.value.itemProperties,
    rows: props.value.itemLayoutRows,
    links: props.value.itemElementLinks
  };

  const updateActiveTab = (patch: Partial<IBetterListTabConfig>): IBetterListTabConfig[] =>
    props.value.tabs.map((tab) => tab.id === activeTabId ? { ...tab, ...patch } : tab);

  const createDerivedMetadata = (
    tabs: IBetterListTabConfig[],
    defaultSort: BetterListDefaultSort = props.value.defaultSort,
    defaultSortColumn: string = props.value.defaultSortColumn
  ): ReturnType<typeof createBetterListMetadataMappings> => {
    const resolved = resolveBetterListTabConfigurations(tabs, {
      grouping: {
        column: props.value.groupsColumn,
        collapsible: props.value.groupsCollapsible,
        icons: props.value.groupIcons,
        filter: { kind: 'all' }
      },
      itemLayout: {
        itemProperties: props.value.itemProperties,
        rows: props.value.itemLayoutRows,
        links: props.value.itemElementLinks
      }
    });
    const paths = resolved.reduce<string[]>((result, entry) => {
      result.push(...entry.itemLayout.itemProperties);
      result.push(...Object.keys(entry.itemLayout.links).map((fieldPath) => entry.itemLayout.links[fieldPath]));
      if (entry.grouping.column) {
        result.push(entry.grouping.column);
      }
      if (entry.grouping.filter.kind === 'sourceEquals') {
        result.push(entry.grouping.filter.fieldPath);
      } else if (entry.grouping.filter.kind === 'query') {
        result.push(...entry.grouping.filter.fields
          .map((field) => field.fieldPath)
          .filter((fieldPath): fieldPath is string => Boolean(fieldPath)));
      }
      return result;
    }, []);
    const defaultSortFieldPath = getBetterListDefaultSortFieldPath(
      defaultSort,
      defaultSortColumn,
      fields
    );
    if (defaultSortFieldPath) {
      paths.push(defaultSortFieldPath);
    }
    return createBetterListMetadataMappings(fields, paths);
  };

  const patchTabsWithDerivedMetadata = (tabs: IBetterListTabConfig[]): void => {
    const metadata = createDerivedMetadata(tabs);
    patchValue({ tabs, fieldMappings: { ...props.value.fieldMappings, metadata } });
  };

  const patchDefaultSort = (
    defaultSort: BetterListDefaultSort,
    defaultSortColumn: string = props.value.defaultSortColumn
  ): void => {
    const column = defaultSort === 'column' ? defaultSortColumn : '';
    patchValue({
      defaultSort,
      defaultSortColumn: column,
      fieldMappings: {
        ...props.value.fieldMappings,
        metadata: createDerivedMetadata(props.value.tabs, defaultSort, column)
      }
    });
  };

  const patchActiveGrouping = (nextGrouping: typeof activeGrouping): void => {
    const tabs = updateActiveTab({ groupingOverride: createBetterListGroupingOverride(nextGrouping) });
    patchTabsWithDerivedMetadata(tabs);
  };

  const applyResolvedList = (selected: ISharePointListOption): void => {
    patchValue({
      sourceListId: selected.id,
      sourceListTitle: selected.title,
      sourceWebUrl: selected.webUrl || '',
      fieldMappings: {},
      itemProperties: ['Title'],
      itemLayoutRows: [],
      itemElementLinks: {},
      defaultSort: 'listOrder',
      defaultSortColumn: '',
      tabsColumn: '',
      groupsColumn: '',
      groupsCollapsible: true,
      groupIcons: { ...props.value.groupIcons, overrides: [] },
      tabs: createDefaultTabs().slice()
    });
  };

  const selectList = (listId: string): void => {
    const selected = lists.find((list) => list.id === listId);
    if (!selected) {
      return;
    }
    sourceRequest.current += 1;
    setResolvingSource(false);
    setSourceError('');
    setSourceInput(selected.title);
    applyResolvedList(selected);
  };

  const resolveSourceInput = async (): Promise<void> => {
    const input: string = sourceInput.trim();
    if (!input || lists.some((list) => list.title === input && list.id === props.value.sourceListId)) {
      setSourceInput(props.value.sourceListTitle);
      return;
    }
    const requestId: number = sourceRequest.current + 1;
    sourceRequest.current = requestId;
    setResolvingSource(true);
    setSourceError('');
    try {
      const selected: ISharePointListOption = await props.pickerDataSource.resolveListUrl(input);
      if (sourceRequest.current !== requestId) {
        return;
      }
      setLists((current) => current.some((list) => list.id === selected.id && list.webUrl === selected.webUrl)
        ? current
        : current.concat(selected));
      setSourceInput(selected.title);
      applyResolvedList(selected);
    } catch (loadError) {
      if (sourceRequest.current === requestId) {
        setSourceError(loadError instanceof Error ? loadError.message : 'The SharePoint list URL could not be resolved.');
      }
    } finally {
      if (sourceRequest.current === requestId) {
        setResolvingSource(false);
      }
    }
  };

  React.useEffect(() => {
    if (!props.value.sourceListId || props.value.fieldMappings.title || fields.length === 0) {
      return;
    }
    const titleField =
      fields.find((field) => field.internalName === 'Title') ||
      fields.find((field) => field.required && field.typeAsString.toLocaleLowerCase() === 'text');
    if (titleField) {
      props.onChange({
        ...props.value,
        fieldMappings: {
          ...props.value.fieldMappings,
          title: createBetterListFieldMapping(titleField, 'title')
        }
      });
    }
  }, [fields, props]);

  const updateItemLayout = (value: {
    itemProperties: readonly string[];
    rows: BetterListItemLayoutRows;
    links: BetterListItemElementLinks;
  }): void => {
    const { itemProperties, rows, links } = value;
    const tabs = updateActiveTab({
      itemLayoutOverride: createBetterListItemLayoutOverride({ itemProperties, rows, links })
    });
    patchTabsWithDerivedMetadata(tabs);
  };

  const updateGroupColumn = (fieldPath: string): void => {
    patchActiveGrouping({
      column: fieldPath,
      collapsible: fieldPath ? activeGrouping.collapsible : false,
      filter: fieldPath === activeGrouping.column ? activeGrouping.filter : { kind: 'all' },
      icons: fieldPath === activeGrouping.column
        ? activeGrouping.icons
        : { ...activeGrouping.icons, overrides: [] },
      groupOrder: fieldPath === activeGrouping.column ? activeGrouping.groupOrder : []
    });
  };
  const openGroupEditor = async (): Promise<void> => {
    if (!activeGrouping.column || groupOptionsLoading) {
      return;
    }
    const requestId = groupOptionsRequest.current + 1;
    const requestContext = groupOptionsContext;
    groupOptionsRequest.current = requestId;
    setGroupOptionsLoading(true);
    setGroupOptionsError('');
    const isCurrentRequest = (): boolean =>
      groupOptionsRequest.current === requestId &&
      groupOptionsContextRef.current === requestContext;
    try {
      const nextGroups = props.loadGroupOptions
        ? await props.loadGroupOptions(activeTabId, activeGrouping.column, activeGrouping.filter)
        : [];
      if (isCurrentRequest()) {
        setGroupOptions(nextGroups);
        setGroupEditorOpen(true);
      }
    } catch (loadError) {
      if (isCurrentRequest()) {
        setGroupOptionsError(
          loadError instanceof Error ? loadError.message : 'Groups could not be loaded.'
        );
      }
    } finally {
      if (isCurrentRequest()) {
        setGroupOptionsLoading(false);
      }
    }
  };
  const groupingFields = fields.filter(isGroupingColumn);
  const groupingOptions = createGroupingColumnOptions(groupingFields);
  const selectedGroupingOption = groupingOptions.find((option) => option.value === activeGrouping.column);
  const defaultSortColumnOptions = createBetterListSortableFieldOptions(fields);
  const selectedDefaultSort = betterListDefaultSortOptions.find(
    (option) => option.value === props.value.defaultSort
  ) || betterListDefaultSortOptions[0];
  const selectedDefaultSortColumn = defaultSortColumnOptions.find(
    (option) => option.fieldPath === props.value.defaultSortColumn
  );
  const tabFilterFields = createTabFilterFields(props.value.fieldMappings, fields);
  const groupFilterFields = createGroupFilterFields(fields, activeGrouping.column);
  const groupQueryFields = groupFilterFields.map(toGroupQueryField);
  const targetDocument = props.targetDocument || (typeof document !== 'undefined' ? document : undefined);
  const portalMountNode = getBetterListPortalMountNode(targetDocument);

  return (
    <FluentProvider
      className="bl-pane-provider"
      targetDocument={targetDocument}
      theme={webLightTheme}
    >
      <PortalMountNodeProvider value={portalMountNode}>
      <div className="bl-pane">
        <style>{propertyPaneCss}</style>
        <section className="bl-pane__source-section">
          <label className="bl-pane__field">
            <span className="bl-pane__label">Source list</span>
            <Combobox
            aria-label="Source list"
            aria-busy={resolvingSource}
            className="bl-pane__source-dropdown"
            freeform
            mountNode={betterListPortalMountNodeProps}
            listbox={{
              className: `bl-pane__source-listbox ${betterListFluentSurfaceClassName}`,
              style: { maxHeight: 'min(320px, 70vh)', overflowY: 'auto' }
            }}
            placeholder={loadingLists ? 'Loading lists…' : 'Select a list or paste its URL'}
            positioning={createBetterListPortalPositioning(targetDocument)}
            selectedOptions={props.value.sourceListId ? [props.value.sourceListId] : []}
            value={sourceInput}
            onChange={(event) => {
              sourceRequest.current += 1;
              setResolvingSource(false);
              setSourceInput((event.target as HTMLInputElement).value);
              setSourceError('');
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }
              event.preventDefault();
              const matchingList = lists.find((list) => list.title === sourceInput);
              if (matchingList) {
                selectList(matchingList.id);
              } else {
                resolveSourceInput().catch(() => undefined);
              }
            }}
            onOptionSelect={(_event, data) => selectList(data.optionValue || '')}
          >
            {lists.map((list) => (
              <Option key={list.id} text={list.title} value={list.id}>
                {list.title}
              </Option>
            ))}
            </Combobox>
          </label>
          <p className="bl-pane__help">Choose a discovered list, or paste a same-tenant SharePoint list URL and press Enter.</p>
          {(sourceError || listError || fieldError) && (
            <div className="bl-pane__error" role="alert">
              {sourceError || fieldError || listError}
            </div>
          )}
          <label className="bl-pane__field">
            <span className="bl-pane__label">Title</span>
            <Input
              aria-label="Title"
              placeholder="Title (optional)"
              value={headingInput}
              onBlur={commitHeading}
              onChange={(_event, data) => {
                headingInputRef.current = data.value;
                setHeadingInput(data.value);
                scheduleHeadingCommit();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
          <div className="bl-pane__top-settings">
            <label className="bl-pane__field">
              <span className="bl-pane__label">Columns</span>
              <Dropdown
                aria-label="Columns"
                className="bl-pane__compact-dropdown"
                listbox={{ className: betterListFluentSurfaceClassName }}
                mountNode={betterListPortalMountNodeProps}
                positioning={createBetterListPortalPositioning(targetDocument)}
                selectedOptions={[String(props.value.itemColumns)]}
                value={String(props.value.itemColumns)}
                onOptionSelect={(_event, data) => {
                  const itemColumns = Number(data.optionValue);
                  if (itemColumns === 1 || itemColumns === 2 || itemColumns === 3 || itemColumns === 4) {
                    patchValue({ itemColumns });
                  }
                }}
              >
                <Option text="1" value="1">1</Option>
                <Option text="2" value="2">2</Option>
                <Option text="3" value="3">3</Option>
                <Option text="4" value="4">4</Option>
              </Dropdown>
            </label>
            <label className="bl-pane__field">
              <span className="bl-pane__label">Maximum items per page</span>
              <Input
                aria-label="Maximum items per page"
                min={1}
                placeholder="No maximum"
                step={1}
                type="number"
                value={props.value.maxItemsPerPage > 0 ? String(props.value.maxItemsPerPage) : ''}
                onChange={(_event, data) => {
                  const numericValue = Number(data.value);
                  patchValue({
                    maxItemsPerPage:
                      Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : 0
                  });
                }}
              />
            </label>
          </div>
        </section>

        <PropertyPaneSection label="Search & sorting">
          <Switch
            aria-label="Search field"
            checked={props.value.showSearch}
            className="bl-pane__switch"
            label="Search field"
            onChange={(_event, data) => patchValue({ showSearch: data.checked })}
          />
          <Switch
            aria-label="Show sorting options"
            checked={props.value.showSortingOptions}
            className="bl-pane__switch"
            label="Show sorting options"
            onChange={(_event, data) => patchValue({ showSortingOptions: data.checked })}
          />
          <label className="bl-pane__field">
            <span className="bl-pane__label">Default sorting</span>
            <Dropdown
              aria-label="Default sorting"
              listbox={{ className: betterListFluentSurfaceClassName }}
              mountNode={betterListPortalMountNodeProps}
              positioning={createBetterListPortalPositioning(targetDocument)}
              selectedOptions={[props.value.defaultSort]}
              value={selectedDefaultSort?.label || 'List ordering'}
              onOptionSelect={(_event, data) => {
                const defaultSort = betterListDefaultSortOptions.find(
                  (option) => option.value === data.optionValue
                )?.value;
                if (defaultSort) {
                  patchDefaultSort(defaultSort);
                }
              }}
            >
              {betterListDefaultSortOptions.map((option) => (
                <Option key={option.value} text={option.label} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Dropdown>
          </label>
          {props.value.defaultSort === 'column' ? (
            <label className="bl-pane__field">
              <span className="bl-pane__label">Column</span>
              <Dropdown
                aria-label="Default sorting column"
                listbox={{
                  className: betterListFluentSurfaceClassName,
                  style: { maxHeight: 'min(360px, calc(100vh - 16px))', overflowY: 'auto' }
                }}
                mountNode={betterListPortalMountNodeProps}
                placeholder="Select a column"
                positioning={createBetterListPortalPositioning(targetDocument)}
                selectedOptions={props.value.defaultSortColumn ? [props.value.defaultSortColumn] : []}
                value={selectedDefaultSortColumn?.label || ''}
                onOptionSelect={(_event, data) =>
                  patchDefaultSort('column', data.optionValue || '')
                }
              >
                {defaultSortColumnOptions.map((option) => (
                  <Option key={option.fieldPath} text={option.label} value={option.fieldPath}>
                    {option.label}
                  </Option>
                ))}
              </Dropdown>
            </label>
          ) : null}
        </PropertyPaneSection>

        <PropertyPaneSection
          action={
            <Button
              appearance="subtle"
              aria-label="Add tab"
              icon={<AddRegular />}
              size="small"
              onClick={() => {
                const tabs = appendNewTab(props.value.tabs).slice();
                const addedTabId = tabs[tabs.length - 1]?.id || '';
                patchValue({ tabs, tabsColumn: '' });
                if (addedTabId) {
                  props.onActiveTabChange?.(addedTabId);
                }
              }}
            />
          }
          label={
            <>
              Tabs
              {props.value.tabs.length > 1 ? (
                <span className="bl-pane__section-count"> ({props.value.tabs.length})</span>
              ) : null}
            </>
          }
        >
          <TabBuilder
            selectedTabId={activeTabId}
            fields={tabFilterFields}
            imageAssetProvider={props.imageAssetProvider}
            showAddAction={false}
            tabs={props.value.tabs}
            onChange={(tabs) => patchValue({ tabs: tabs.slice(), tabsColumn: '' })}
            onSelectedTabChange={props.onActiveTabChange}
          />
        </PropertyPaneSection>

        <PropertyPaneSection label="Groups">
        <TabSettingInheritance
          inherited={Boolean(activeConfiguration?.groupingInherited)}
          inheritedFromLabel={getTabLabel(props.value.tabs, activeConfiguration?.inheritedFromTabId)}
          onReset={activeConfiguration?.groupingInherited
            ? undefined
            : () => patchTabsWithDerivedMetadata(updateActiveTab({ groupingOverride: undefined }))}
        />
        <label className="bl-pane__field">
          <span className="bl-pane__label">Grouping column</span>
          <Dropdown
            aria-label="Grouping column"
            listbox={{
              className: betterListFluentSurfaceClassName,
              style: { maxHeight: 'min(360px, calc(100vh - 16px))', overflowY: 'auto' }
            }}
            mountNode={betterListPortalMountNodeProps}
            positioning={createBetterListPortalPositioning(targetDocument)}
            selectedOptions={[activeGrouping.column || noGroupingValue]}
            value={selectedGroupingOption?.label || 'No grouping'}
            onOptionSelect={(_event, data) =>
              updateGroupColumn(data.optionValue === noGroupingValue ? '' : data.optionValue || '')
            }
          >
            <Option text="No grouping" value={noGroupingValue}>No grouping</Option>
            {groupingOptions.map((option) => (
              <Option key={option.value} text={option.label} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </label>
        {activeGrouping.column ? (
          <>
            <Button
              appearance="secondary"
              className="bl-pane__edit-groups"
              disabled={groupOptionsLoading}
              icon={<EditRegular />}
              onClick={() => openGroupEditor().catch(() => undefined)}
            >
              {groupOptionsLoading ? 'Loading groups…' : 'Edit groups'}
            </Button>
            {groupOptionsError ? (
              <div className="bl-pane__error" role="alert">{groupOptionsError}</div>
            ) : null}
            <Switch
              checked={activeGrouping.collapsible}
              className="bl-pane__switch"
              label="Allow groups to collapse"
              onChange={(_event, data) => patchActiveGrouping({ ...activeGrouping, collapsible: data.checked })}
            />
            <FilterQueryEditor
              expression={filterExpression(activeGrouping.filter, groupFilterFields)}
              fields={groupQueryFields}
              id={`group-filter-${activeTabId.replace(/[^A-Za-z0-9_-]/g, '-')}`}
              onChange={(expression) => {
                const trimmed = expression.trim();
                patchActiveGrouping({
                  ...activeGrouping,
                  filter: trimmed
                    ? {
                        kind: 'query',
                        expression,
                        fields: collectBetterListQueryFields(expression, groupQueryFields)
                      }
                    : { kind: 'all' }
                });
              }}
            />
            <Switch
              checked={activeGrouping.icons.showIcons}
              className="bl-pane__switch"
              label="Show group icons"
              onChange={(_event, data) =>
                patchActiveGrouping({
                  ...activeGrouping,
                  icons: { ...activeGrouping.icons, showIcons: data.checked }
                })
              }
            />
            {activeGrouping.icons.showIcons ? (
              <GroupIconColorField
                label="Default icon color"
                value={activeGrouping.icons.defaultColor}
                onChange={(defaultColor) =>
                  patchActiveGrouping({
                    ...activeGrouping,
                    icons: { ...activeGrouping.icons, defaultColor }
                  })
                }
              />
            ) : null}
            {activeGrouping.icons.overrides.length ? (
              <div className="bl-pane__setting-row">
                <span>{`${activeGrouping.icons.overrides.length} icon override${
                  activeGrouping.icons.overrides.length === 1 ? '' : 's'
                }`}</span>
                <Button
                  appearance="subtle"
                  className="bl-pane__text-button"
                  size="small"
                  onClick={() => patchActiveGrouping({
                    ...activeGrouping,
                    icons: { ...activeGrouping.icons, overrides: [] }
                  })}
                >
                  Reset all
                </Button>
              </div>
            ) : (
              <p className="bl-pane__hint">
                In page edit mode, select a group icon to replace it with an icon or image.
              </p>
            )}
          </>
        ) : null}
        </PropertyPaneSection>

        {groupEditorOpen ? (
          <GroupOrderEditorDialog
            groups={groupOptions}
            value={activeGrouping.groupOrder}
            onApply={(groupOrder) => patchActiveGrouping({ ...activeGrouping, groupOrder })}
            onOpenChange={setGroupEditorOpen}
          />
        ) : null}

        <ItemPropertyBuilder
          context={(
            <TabSettingInheritance
              inherited={Boolean(activeConfiguration?.itemLayoutInherited)}
              inheritedFromLabel={getTabLabel(props.value.tabs, activeConfiguration?.inheritedFromTabId)}
              onReset={activeConfiguration?.itemLayoutInherited
                ? undefined
                : () => patchTabsWithDerivedMetadata(updateActiveTab({ itemLayoutOverride: undefined }))}
            />
          )}
          fields={fields}
          targetDocument={targetDocument}
          value={{
            itemProperties: activeItemLayout.itemProperties,
            rows: activeItemLayout.rows,
            links: activeItemLayout.links
          }}
          onChange={updateItemLayout}
        />

        <PropertyPaneSection defaultExpanded label="Advanced">
          <SourceWorkspaceField
            description="Edit scoped styles and the trusted HTML template in one workspace. Invalid template drafts stay local until corrected."
            label="Styles & template"
            documents={[
              {
                id: 'scss',
                label: 'CSS/SCSS',
                language: 'scss',
                targets: cssTargets,
                value: props.value.customCss,
                onChange: (customCss) => patchValue({ customCss })
              },
              {
                commitMode: 'valid',
                height: 360,
                id: 'html',
                label: 'HTML template',
                language: 'html',
                maxBytes: betterListTemplateMaxBytes,
                snippets: [
                  { label: 'Default template', snippet: defaultBetterListHtmlTemplate },
                  { label: 'Item title token', snippet: '{{item.title}}' },
                  { label: 'Result count token', snippet: '{{results.count}}' }
                ],
                validate: validateBetterListTemplateStructure,
                value: props.value.htmlTemplate,
                onChange: (htmlTemplate) => patchValue({ htmlTemplate })
              }
            ]}
          />
        </PropertyPaneSection>
      </div>
      </PortalMountNodeProvider>
    </FluentProvider>
  );
};

function createTabFilterFields(
  mappings: Partial<IBetterListFieldMappings>,
  fields: readonly ISharePointFieldOption[]
): readonly IBetterListTabFilterField[] {
  const semanticFields = betterListSemanticSlots
    .map((slot): IBetterListTabFilterField | undefined => {
      const mapping = mappings[slot.key];
      return mapping
        ? { id: `slot:${slot.key}`, key: slot.key, kind: mapping.kind, label: mapping.displayName || slot.label }
        : undefined;
    })
    .filter((field): field is IBetterListTabFilterField => Boolean(field));
  const mappedInternalNames = new Set(semanticFields.map((field) => mappings[field.key || 'title']?.internalName));
  const sourceFields = createBetterListFieldPathCatalog(fields)
    .filter((option) => !mappedInternalNames.has(option.field.internalName))
    .map((option): IBetterListTabFilterField => {
      const mapping = createBetterListFieldMapping(
        option.field,
        undefined,
        option.targetField?.internalName
      );
      return {
        id: `source:${option.fieldPath}`,
        fieldPath: option.fieldPath,
        kind: mapping.kind,
        label: option.label,
        mapping
      };
    });
  return semanticFields.concat(sourceFields);
}

function createGroupFilterFields(
  fields: readonly ISharePointFieldOption[],
  groupingColumn: string
): readonly IBetterListTabFilterField[] {
  const root = parseBetterListFieldPath(groupingColumn).source;
  if (!root) {
    return [];
  }
  return createBetterListFieldPathCatalog(fields)
    .filter((option) => option.field.internalName === root)
    .map((option) => {
      const mapping = createBetterListFieldMapping(
        option.field,
        undefined,
        option.targetField?.internalName
      );
      return {
        id: `group:${option.fieldPath}`,
        fieldPath: option.fieldPath,
        kind: mapping.kind,
        label: option.label,
        mapping
      };
    });
}

function toGroupQueryField(field: IBetterListTabFilterField): IBetterListQueryField {
  return {
    name: field.label,
    kind: field.kind,
    fieldPath: field.fieldPath,
    mapping: field.mapping
  };
}

interface IGroupingColumnOption {
  label: string;
  value: string;
}

const noGroupingValue = '__no_grouping__';

interface ITabSettingInheritanceProps {
  inherited: boolean;
  inheritedFromLabel?: string;
  onReset?: () => void;
}

const TabSettingInheritance: React.FunctionComponent<ITabSettingInheritanceProps> = ({
  inherited,
  inheritedFromLabel,
  onReset
}) => (
  <div className="bl-pane__inheritance">
    <span>
      {inherited
        ? inheritedFromLabel
          ? `Inherited from ${inheritedFromLabel}. Change a setting to override it for this tab.`
          : 'Using the legacy web part settings. Change a setting to override it for this tab.'
        : 'Customized for this tab.'}
    </span>
    {onReset ? (
      <Button appearance="subtle" className="bl-pane__text-button" size="small" onClick={onReset}>
        Use previous
      </Button>
    ) : null}
  </div>
);

function getTabLabel(tabs: readonly IBetterListTabConfig[], tabId: string | undefined): string | undefined {
  return tabs.find((tab) => tab.id === tabId)?.label;
}

function createGroupingColumnOptions(
  fields: readonly ISharePointFieldOption[]
): readonly IGroupingColumnOption[] {
  return createBetterListFieldPathCatalog(fields).map((option) => ({
    label: option.label,
    value: option.fieldPath
  }));
}

function isGroupingColumn(field: ISharePointFieldOption): boolean {
  const type = field.typeAsString.toLocaleLowerCase();
  return (
    type.indexOf('text') >= 0 ||
    type.indexOf('choice') >= 0 ||
    type.indexOf('lookup') >= 0 ||
    type.indexOf('user') >= 0 ||
    type.indexOf('person') >= 0 ||
    type.indexOf('boolean') >= 0 ||
    type.indexOf('date') >= 0
  );
}

const propertyPaneCss = `
.bl-pane-provider { background: transparent; }
.bl-pane { --bl-font-mono: "Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; color: #242424; container-type: inline-size; font-family: "Segoe UI", sans-serif; margin: -8px; }
.bl-pane *, .bl-pane *::before, .bl-pane *::after { box-sizing: border-box; }
.bl-pane__source-section { border: 0; margin: 0; padding: 8px 0 12px; }
.bl-pane__section-count { color: ${tokens.colorNeutralForeground3}; font-weight: 400; margin-left: 4px; }
.bl-pane__field { display: flex; flex-direction: column; gap: 5px; margin: 0 0 12px; min-width: 0; }
.bl-pane__top-settings { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.bl-pane__label { font-size: 12px; font-weight: 600; }
.bl-pane__source-dropdown { min-width: 0; width: 100%; }
.bl-pane__compact-dropdown { min-width: 0; width: 100%; }
.bl-pane__source-listbox { font-family: "Segoe UI", sans-serif; }
.bl-pane__help { color: #616161; font-size: 11px; line-height: 1.4; margin: -4px 0 12px; }
.bl-pane__error { background: #fdf3f4; border-left: 3px solid #c50f1f; color: #8a1219; font-size: 12px; padding: 8px; }
.bl-pane__empty { background: #f5f5f5; color: #616161; font-size: 12px; padding: 10px; }
.bl-pane__switch { margin-top: 8px; }
.bl-pane__edit-groups { align-self: flex-start; margin: 0 0 4px; }
.bl-pane__setting-row { align-items: center; color: #616161; display: flex; font-size: 12px; justify-content: space-between; gap: 8px; margin-top: 10px; }
.bl-pane__inheritance { align-items: flex-start; background: ${tokens.colorNeutralBackground2}; color: ${tokens.colorNeutralForeground3}; display: flex; font-size: 11px; gap: 8px; justify-content: space-between; line-height: 1.35; margin: 0 0 10px; padding: 8px; }
.bl-pane__text-button { border-color: transparent !important; min-height: 24px !important; padding: 2px 4px !important; }
.bl-pane__hint { color: #616161; font-size: 11px; line-height: 1.4; margin: 8px 0 0; }
.bl-pane__template-editor { border-top: 1px solid #e0e0e0; margin-top: 16px; padding-top: 16px; }
`;
