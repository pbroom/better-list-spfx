import * as React from 'react';
import {
  Button,
  Input,
  Link,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  SelectTabData,
  SelectTabEvent,
  Spinner,
  Tab,
  TabList,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  shorthands
} from '@fluentui/react-components';
import {
  AppsListDetailRegular,
  ArrowClockwiseRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  DocumentTextRegular,
  FluentIcon,
  HeadsetRegular,
  ImageEditRegular,
  InfoRegular,
  MegaphoneRegular,
  SearchRegular
} from '@fluentui/react-icons';
import {
  BetterListItemLayoutRows,
  BetterListGroupIconOverride,
  BetterListTabIcon,
  BetterListTemplateFragmentName,
  BetterListTemplateSlotName,
  IBetterListTemplateElementNode,
  IBetterListTemplateNode,
  IBetterListGroupIconsConfiguration,
  defaultBetterListGroupIconsConfiguration,
  getBetterListGroupIconOverride,
  resolveBetterListTemplate,
  substituteBetterListTokens
} from '../../../shared';
import { BetterListGroupIconVisual, BetterListIconVisual } from './GroupIconCatalog';
import type { ISharePointImageAssetProvider } from '../services';

const GroupIconPickerDialog = React.lazy(async () => {
  const module = await import(
    /* webpackChunkName: 'better-list-group-icon-picker' */ './GroupIconPickerDialog'
  );
  return { default: module.GroupIconPickerDialog };
});

export type BetterListStatus = 'loading' | 'ready' | 'error';

export type BetterListGroupIcon = 'general' | 'communications' | 'policy' | 'support';

export interface IBetterListTabLayout {
  columns?: 1 | 2 | 3;
  density?: 'compact' | 'comfortable';
  collapsible?: boolean;
  initiallyExpanded?: boolean;
  showDescriptions?: boolean;
  showSearch?: boolean;
}

export interface IBetterListTab {
  key: string;
  label: string;
  icon?: BetterListTabIcon;
  iconOverride?: BetterListGroupIconOverride;
  itemCount?: number;
  maxItems?: number;
  showItemCount?: boolean;
  /** True when the item projection is intentionally grouped. */
  grouped?: boolean;
  /** Omit itemIds for a tab that includes every item. */
  itemIds?: readonly string[];
  /**
   * Optional tab-specific projection. Use this when tabs group the same source
   * item differently (for example, category in one tab and organization in another).
   */
  items?: readonly IBetterListItem[];
  /** Optional visitor-view presentation overrides for this tab. */
  layout?: IBetterListTabLayout;
}

export interface IBetterListItem {
  id: string;
  title: string;
  href?: string;
  description?: string;
  organizationCode?: string;
  organizationName?: string;
  /** Optional display-ready metadata overrides the organization fields. */
  metadata?: readonly string[];
  /** Ordered visible non-title elements. */
  elements?: readonly IBetterListItemElement[];
  groupId: string;
  groupTitle: string;
  groupIcon?: BetterListGroupIcon;
  groupSortOrder?: number;
  itemSortOrder?: number;
}

export interface IBetterListItemElement {
  key: string;
  kind: 'description' | 'metadata';
  value: string;
  href?: string;
}

export interface IBetterListViewProps {
  tabs: readonly IBetterListTab[];
  activeTabKey: string;
  items: readonly IBetterListItem[];
  status?: BetterListStatus;
  errorMessage?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  htmlTemplate?: string;
  itemPropertyFields?: readonly string[];
  itemLayoutRows?: BetterListItemLayoutRows;
  groupIconScope?: string;
  groupIcons?: IBetterListGroupIconsConfiguration;
  groupImageAssetProvider?: ISharePointImageAssetProvider;
  isEditMode?: boolean;
  listTitle?: string;
  onTabChange?: (tabKey: string) => void;
  onSearchChange?: (value: string) => void;
  onRetry?: () => void;
  onGroupIconOverrideChange?: (groupKey: string, override: BetterListGroupIconOverride | undefined) => void;
}

type BetterListTemplateTokens = Readonly<Record<string, string | number | undefined>>;
type BetterListTemplateSlotRenderer = (attributes: Record<string, unknown>, key: string) => React.ReactNode;

interface IBetterListGroup {
  id: string;
  title: string;
  icon?: BetterListGroupIcon;
  sortOrder: number;
  items: IBetterListItem[];
}

const useStyles = makeStyles({
  root: {
    minWidth: 0
  },
  header: {},
  toolbar: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    '@media (max-width: 760px)': {
      alignItems: 'stretch',
      flexDirection: 'column'
    }
  },
  tabs: {
    minWidth: 0
  },
  tab: {
    minHeight: '48px'
  },
  tabIcon: {
    width: '20px',
    height: '20px',
    objectFit: 'contain'
  },
  search: {
    width: 'min(100%, 440px)',
    minHeight: '48px',
    '@media (max-width: 760px)': {
      width: '100%'
    }
  },
  searchIcon: {},
  content: {},
  grid: {
    display: 'flex',
    flexDirection: 'column'
  },
  group: {
    minWidth: 0,
    width: '100%'
  },
  groupHeading: {
    ...shorthands.margin(0)
  },
  groupStaticHeading: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '64px'
  },
  groupButton: {
    width: '100%',
    minHeight: '64px',
    justifyContent: 'space-between'
  },
  groupButtonContent: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    textAlign: 'left'
  },
  groupEditHeading: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '64px',
    width: '100%'
  },
  groupEditTrigger: {
    flexShrink: 0,
    width: '40px',
    minWidth: '40px',
    height: '40px'
  },
  groupEditCollapseButton: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: '64px',
    justifyContent: 'space-between'
  },
  groupIcon: {
    flexShrink: 0,
    width: '28px',
    height: '28px',
    objectFit: 'contain'
  },
  groupTitle: {
    overflowWrap: 'anywhere'
  },
  chevron: {
    flexShrink: 0
  },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(var(--better-list-columns, 2), minmax(0, 1fr))',
    listStyleType: 'none',
    ...shorthands.margin(0),
    ...shorthands.padding(0),
    '@media (max-width: 760px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
      rowGap: 0
    }
  },
  item: {},
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: '12px',
    rowGap: '6px',
    minWidth: 0,
    '& .better-list__metadata': {
      marginTop: 0
    },
    '& .better-list__item-description': {
      marginTop: 0
    }
  },
  subsequentItemRow: {
    marginTop: '8px'
  },
  itemCompact: {},
  itemTitle: {
    textDecorationLine: 'none'
  },
  itemTitleText: {
    display: 'block'
  },
  metadata: {
    display: 'flex',
    flexWrap: 'wrap'
  },
  metadataPart: {
    display: 'inline-flex',
    alignItems: 'center'
  },
  description: {
    display: 'block',
    overflowWrap: 'anywhere'
  },
  state: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '240px',
    textAlign: 'center'
  },
  stateInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '480px',
    rowGap: '12px'
  },
  stateIcon: {},
  messageBar: {
    maxWidth: '720px',
    marginRight: 'auto',
    marginLeft: 'auto'
  }
});

const GROUP_ICON_BY_KIND: Record<BetterListGroupIcon, FluentIcon> = {
  general: AppsListDetailRegular,
  communications: MegaphoneRegular,
  policy: DocumentTextRegular,
  support: HeadsetRegular
};

const TAB_ICON_BY_KIND: Record<BetterListTabIcon, FluentIcon> = {
  list: AppsListDetailRegular,
  communications: MegaphoneRegular,
  policy: DocumentTextRegular,
  support: HeadsetRegular
};

function renderTabIcon(tab: IBetterListTab, className: string): React.ReactElement | undefined {
  if (tab.iconOverride) {
    return tab.iconOverride.kind === 'none'
      ? undefined
      : <BetterListIconVisual className={className} override={tab.iconOverride} />;
  }
  return tab.icon
    ? React.createElement(TAB_ICON_BY_KIND[tab.icon], { 'aria-hidden': true })
    : undefined;
}

let betterListInstanceCount = 0;

const normalizeSearchText = (value: string): string => value.trim().toLocaleLowerCase();

const compareText = (left: string, right: string): number => left.localeCompare(right, undefined, { sensitivity: 'base' });

const compareItems = (left: IBetterListItem, right: IBetterListItem): number => {
  const orderDifference = (left.itemSortOrder ?? Number.MAX_SAFE_INTEGER) - (right.itemSortOrder ?? Number.MAX_SAFE_INTEGER);
  return orderDifference || compareText(left.title, right.title);
};

const itemMatchesSearch = (item: IBetterListItem, searchText: string): boolean => {
  if (!searchText) {
    return true;
  }

  const searchableValues = [
    item.title,
    item.description,
    item.organizationCode,
    item.organizationName,
    item.groupTitle,
    ...(item.metadata ?? [])
  ];

  return searchableValues.some((value) => value?.toLocaleLowerCase().includes(searchText));
};

const groupItems = (items: readonly IBetterListItem[]): IBetterListGroup[] => {
  const groups = new Map<string, IBetterListGroup>();

  items.forEach((item) => {
    const existingGroup = groups.get(item.groupId);
    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.sortOrder = Math.min(existingGroup.sortOrder, item.groupSortOrder ?? Number.MAX_SAFE_INTEGER);
      existingGroup.icon = existingGroup.icon ?? item.groupIcon;
      return;
    }

    groups.set(item.groupId, {
      id: item.groupId,
      title: item.groupTitle,
      icon: item.groupIcon,
      sortOrder: item.groupSortOrder ?? Number.MAX_SAFE_INTEGER,
      items: [item]
    });
  });

  return Array.from(groups.values())
    .map((group) => ({ ...group, items: group.items.slice().sort(compareItems) }))
    .sort((left, right) => left.sortOrder - right.sortOrder || compareText(left.title, right.title));
};

const resolveGroupIcon = (kind: BetterListGroupIcon | undefined, title: string): FluentIcon => {
  if (kind) {
    return GROUP_ICON_BY_KIND[kind];
  }

  const normalizedTitle = title.toLocaleLowerCase();
  if (normalizedTitle.includes('communication')) {
    return GROUP_ICON_BY_KIND.communications;
  }
  if (normalizedTitle.includes('policy')) {
    return GROUP_ICON_BY_KIND.policy;
  }
  if (normalizedTitle.includes('support') || normalizedTitle.includes('technical')) {
    return GROUP_ICON_BY_KIND.support;
  }
  return GROUP_ICON_BY_KIND.general;
};

const GroupIcon: React.FunctionComponent<{
  kind?: BetterListGroupIcon;
  title: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ kind, title, className, style }) => {
  const Icon = resolveGroupIcon(kind, title);
  return <Icon className={className} aria-hidden="true" style={style} />;
};

function renderItemElements(
  elements: readonly IBetterListItemElement[],
  classes: ReturnType<typeof useStyles>,
  showDescriptions: boolean
): React.ReactNode[] {
  const rendered: React.ReactNode[] = [];
  let metadataRun: IBetterListItemElement[] = [];

  const flushMetadata = (): void => {
    if (metadataRun.length === 0) {
      return;
    }
    const run = metadataRun;
    metadataRun = [];
    rendered.push(
      <div
        className={mergeClasses(classes.metadata, 'better-list__metadata')}
        data-item-element-kind="metadata"
        key={`metadata-${run.map((element) => element.key).join('-')}`}
      >
        {run.map((element) => (
          element.href ? (
            <Link
              className={mergeClasses(classes.metadataPart, 'better-list__metadata-part')}
              data-item-element={element.key}
              href={element.href}
              key={element.key}
            >
              {element.value}
            </Link>
          ) : (
            <span
              className={mergeClasses(classes.metadataPart, 'better-list__metadata-part')}
              data-item-element={element.key}
              key={element.key}
            >
              {element.value}
            </span>
          )
        ))}
      </div>
    );
  };

  elements.forEach((element) => {
    if (element.kind === 'metadata') {
      metadataRun.push(element);
      return;
    }
    flushMetadata();
    if (showDescriptions) {
      rendered.push(element.href ? (
        <Link
          className={mergeClasses(classes.description, 'better-list__item-description')}
          data-item-element={element.key}
          href={element.href}
          key={element.key}
        >
          {element.value}
        </Link>
      ) : (
        <Text
          className={mergeClasses(classes.description, 'better-list__item-description')}
          data-item-element={element.key}
          key={element.key}
        >
          {element.value}
        </Text>
      ));
    }
  });
  flushMetadata();
  return rendered;
}

function renderItemLayoutRow(
  fieldPaths: readonly string[],
  rowIndex: number,
  elements: readonly IBetterListItemElement[],
  classes: ReturnType<typeof useStyles>,
  showDescriptions: boolean,
  renderTitle?: () => React.ReactNode
): React.ReactElement {
  const elementsByKey = new Map(elements.map((element) => [element.key, element]));
  const rendered: React.ReactNode[] = [];
  let metadataRun: IBetterListItemElement[] = [];

  const flushMetadata = (): void => {
    if (metadataRun.length === 0) {
      return;
    }
    const run = metadataRun;
    metadataRun = [];
    rendered.push(
      <div
        className={mergeClasses(classes.metadata, 'better-list__metadata')}
        data-item-element-kind="metadata"
        key={`metadata-${rowIndex}-${run.map((element) => element.key).join('-')}`}
      >
        {run.map((element) => (
          element.href ? (
            <Link
              className={mergeClasses(classes.metadataPart, 'better-list__metadata-part')}
              data-item-element={element.key}
              href={element.href}
              key={element.key}
            >
              {element.value}
            </Link>
          ) : (
            <span
              className={mergeClasses(classes.metadataPart, 'better-list__metadata-part')}
              data-item-element={element.key}
              key={element.key}
            >
              {element.value}
            </span>
          )
        ))}
      </div>
    );
  };

  fieldPaths.forEach((fieldPath) => {
    if (fieldPath === 'Title') {
      flushMetadata();
      if (renderTitle) {
        rendered.push(renderTitle());
      }
      return;
    }
    const element = elementsByKey.get(fieldPath);
    if (!element) {
      return;
    }
    if (element.kind === 'metadata') {
      metadataRun.push(element);
      return;
    }
    flushMetadata();
    if (showDescriptions) {
      rendered.push(element.href ? (
        <Link
          className={mergeClasses(classes.description, 'better-list__item-description')}
          data-item-element={element.key}
          href={element.href}
          key={element.key}
        >
          {element.value}
        </Link>
      ) : (
        <Text
          className={mergeClasses(classes.description, 'better-list__item-description')}
          data-item-element={element.key}
          key={element.key}
        >
          {element.value}
        </Text>
      ));
    }
  });
  flushMetadata();

  return (
    <div
      className={mergeClasses(
        classes.itemRow,
        rowIndex > 0 && classes.subsequentItemRow,
        'better-list__item-row',
        `better-list-row-${rowIndex + 1}`
      )}
      data-item-row={rowIndex + 1}
      key={`item-row-${rowIndex + 1}`}
    >
      {rendered}
    </div>
  );
}

export const BetterListView: React.FunctionComponent<IBetterListViewProps> = ({
  tabs,
  activeTabKey,
  items,
  status = 'ready',
  errorMessage = 'We could not load this list. Try again in a moment.',
  searchValue,
  searchPlaceholder = 'Search services',
  emptyMessage = 'There are no list items to display.',
  noResultsMessage = 'No items match the selected view and search.',
  htmlTemplate,
  itemPropertyFields = ['Title'],
  itemLayoutRows = [],
  groupIconScope = '',
  groupIcons = defaultBetterListGroupIconsConfiguration,
  groupImageAssetProvider,
  isEditMode = false,
  listTitle = 'Better List',
  onTabChange,
  onSearchChange,
  onRetry,
  onGroupIconOverrideChange
}) => {
  const classes = useStyles();
  const compiledTemplate = React.useMemo(() => resolveBetterListTemplate(htmlTemplate), [htmlTemplate]);
  const [selectedTabKey, setSelectedTabKey] = React.useState(activeTabKey);
  const [internalSearchValue, setInternalSearchValue] = React.useState(searchValue ?? '');
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
  const [editingGroup, setEditingGroup] = React.useState<IBetterListGroup | undefined>(undefined);
  const [instanceId] = React.useState(() => {
    betterListInstanceCount += 1;
    return betterListInstanceCount;
  });

  React.useEffect(() => {
    setSelectedTabKey(activeTabKey);
  }, [activeTabKey]);

  React.useEffect(() => {
    if (searchValue !== undefined) {
      setInternalSearchValue(searchValue);
    }
  }, [searchValue]);

  const selectedTab = tabs.find((tab) => tab.key === selectedTabKey) ?? tabs[0];
  const selectedLayout = selectedTab?.layout;
  const density = selectedLayout?.density ?? 'comfortable';
  const showDescriptions = selectedLayout?.showDescriptions !== false;
  const showSearch = selectedLayout?.showSearch !== false;
  const grouped = selectedTab?.grouped === true;
  const collapsible = grouped && selectedLayout?.collapsible !== false;
  const initiallyExpanded = selectedLayout?.initiallyExpanded !== false;
  const gridStyle = {
    '--better-list-columns': String(selectedLayout?.columns ?? 2)
  } as React.CSSProperties;
  const normalizedSearchText = normalizeSearchText(internalSearchValue);

  const visibleItems = React.useMemo(() => {
    const tabItems = selectedTab?.items ?? items;
    const selectedIds = selectedTab?.itemIds ? new Set(selectedTab.itemIds) : undefined;
    return tabItems.filter((item) => (!selectedIds || selectedIds.has(item.id)) && itemMatchesSearch(item, normalizedSearchText));
  }, [items, normalizedSearchText, selectedTab]);

  const displayedItems = React.useMemo(() => {
    const orderedItems = grouped ? visibleItems : visibleItems.slice().sort(compareItems);
    return selectedTab?.maxItems ? orderedItems.slice(0, selectedTab.maxItems) : orderedItems;
  }, [grouped, selectedTab?.maxItems, visibleItems]);
  const groups = React.useMemo(() => (grouped ? groupItems(displayedItems) : []), [displayedItems, grouped]);
  const hasAnyItems = items.length > 0 || tabs.some((tab) => Boolean(tab.items?.length));

  const handleTabSelect = (_event: SelectTabEvent, data: SelectTabData): void => {
    const nextTabKey = String(data.value);
    setSelectedTabKey(nextTabKey);
    onTabChange?.(nextTabKey);
  };

  const handleSearchChange = (_event: React.ChangeEvent<HTMLInputElement>, data: { value: string }): void => {
    setInternalSearchValue(data.value);
    onSearchChange?.(data.value);
  };

  const toggleGroup = (groupStateKey: string): void => {
    setCollapsedGroups((current) => {
      const currentlyCollapsed = current[groupStateKey] ?? !initiallyExpanded;
      return { ...current, [groupStateKey]: !currentlyCollapsed };
    });
  };

  const renderGroupIcon = (group: IBetterListGroup): React.ReactElement | null => {
    if (!groupIcons.showIcons) {
      return null;
    }
    const className = mergeClasses(classes.groupIcon, 'better-list__group-icon');
    const automatic = (
      <GroupIcon
        className={className}
        kind={group.icon}
        style={groupIcons.defaultColor ? { color: groupIcons.defaultColor } : undefined}
        title={group.title}
      />
    );
    const override = getBetterListGroupIconOverride(groupIcons, groupIconScope, group.id);
    return override ? (
      <BetterListGroupIconVisual
        className={className}
        defaultColor={groupIcons.defaultColor}
        fallback={automatic}
        override={override}
      />
    ) : (
      automatic
    );
  };

  const renderGroupIconEditor = (group: IBetterListGroup): React.ReactElement | null => {
    if (!isEditMode || !groupIcons.showIcons || !onGroupIconOverrideChange) {
      return renderGroupIcon(group);
    }
    const override = getBetterListGroupIconOverride(groupIcons, groupIconScope, group.id);
    return (
      <Tooltip content={`Change icon for ${group.title}`} relationship="label">
        <Button
          appearance="subtle"
          aria-haspopup="dialog"
          aria-label={`Change icon for ${group.title}`}
          className={mergeClasses(classes.groupEditTrigger, 'better-list__group-icon-editor')}
          icon={override?.kind === 'none' ? <ImageEditRegular aria-hidden="true" /> : renderGroupIcon(group)}
          onClick={() => setEditingGroup(group)}
        />
      </Tooltip>
    );
  };

  const classAliases: Readonly<Record<string, string>> = {
    'better-list': classes.root,
    'better-list__header': classes.header,
    'better-list__toolbar': classes.toolbar,
    'better-list__tabs': classes.tabs,
    'better-list__tab': classes.tab,
    'better-list__search': classes.search,
    'better-list__content': classes.content,
    'better-list__grid': classes.grid,
    'better-list__group': classes.group,
    'better-list__group-heading': classes.groupHeading,
    'better-list__items': classes.list,
    'better-list__item': classes.item
  };

  const renderFragment = (
    fragmentName: BetterListTemplateFragmentName,
    tokens: BetterListTemplateTokens,
    slots: Partial<Record<BetterListTemplateSlotName, BetterListTemplateSlotRenderer>>,
    rootAttributes: Record<string, unknown>
  ): React.ReactElement =>
    renderTemplateElement(compiledTemplate.fragments[fragmentName], tokens, slots, classAliases, rootAttributes, fragmentName);

  const renderItemTemplate = (
    item: IBetterListItem,
    densityValue: 'compact' | 'comfortable',
    showItemDescriptions: boolean,
    slotAttributes: Record<string, unknown> = {}
  ): React.ReactElement => {
    const metadata = (item.metadata ?? [item.organizationCode, item.organizationName]).filter((value): value is string =>
      Boolean(value?.trim())
    );
    const elements: readonly IBetterListItemElement[] = item.elements ?? [
      ...metadata.map((value, index) => ({
        key: `metadata-${index}`,
        kind: 'metadata' as const,
        value
      })),
      ...(item.description ? [{ key: 'description', kind: 'description' as const, value: item.description }] : [])
    ];
    const renderTitle = (attributes: Record<string, unknown>, key: string): React.ReactNode =>
      item.href ? (
        <Link
          {...attributes}
          className={mergeClasses(String(attributes.className || ''), classes.itemTitle, 'better-list__item-title')}
          href={item.href}
          key={key}
        >
          {item.title}
        </Link>
      ) : (
        <Text
          {...attributes}
          className={mergeClasses(
            String(attributes.className || ''),
            classes.itemTitleText,
            'better-list__item-title',
            'better-list__item-title--text'
          )}
          key={key}
        >
          {item.title}
        </Text>
      );
    return renderFragment(
      'item',
      {
        'item.id': item.id,
        'item.title': item.title,
        'item.description': item.description
      },
      {
        title: (attributes, key) =>
          itemLayoutRows.length > 0
            ? itemLayoutRows.map((row, index) =>
                renderItemLayoutRow(
                  row,
                  index,
                  elements,
                  classes,
                  showItemDescriptions,
                  () => renderTitle(attributes, `${key}-title`)
                )
              )
            : itemPropertyFields.indexOf('Title') >= 0
              ? renderTitle(attributes, key)
              : null,
        properties: () =>
          itemLayoutRows.length > 0
            ? null
            : renderItemElements(elements, classes, showItemDescriptions)
      },
      {
        ...slotAttributes,
        className: mergeClasses(
          String(slotAttributes.className || ''),
          classes.item,
          densityValue === 'compact' && classes.itemCompact,
          'better-list__item',
          densityValue === 'compact' && 'better-list__item--compact'
        ),
        key: item.id,
        role: 'listitem'
      }
    );
  };

  const renderListTemplate = (
    listItems: readonly IBetterListItem[],
    densityValue: 'compact' | 'comfortable',
    showItemDescriptions: boolean
  ): React.ReactElement =>
    renderFragment(
      'list',
      {},
      {
        items: (attributes) =>
          listItems.map((item) => renderItemTemplate(item, densityValue, showItemDescriptions, attributes))
      },
      {
        className: mergeClasses(classes.list, 'better-list__items'),
        role: 'list'
      }
    );

  const renderGroupTemplate = (group: IBetterListGroup): React.ReactElement => {
    const groupStateKey = `${selectedTab?.key ?? 'default'}:${group.id}`;
    const isExpanded = collapsible ? !(collapsedGroups[groupStateKey] ?? !initiallyExpanded) : true;
    const safeGroupId = group.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    const headingId = `better-list-${instanceId}-${safeGroupId}-heading`;
    const panelId = `better-list-${instanceId}-${safeGroupId}-panel`;
    return renderFragment(
      'group',
      {
        'group.title': group.title,
        'group.count': group.items.length
      },
      {
        heading: (attributes, key) => (
          <h2
            {...attributes}
            className={mergeClasses(String(attributes.className || ''), classes.groupHeading, 'better-list__group-heading')}
            key={key}
          >
            {collapsible && isEditMode && onGroupIconOverrideChange ? (
              <span className={mergeClasses(classes.groupEditHeading, 'better-list__group-edit-heading')} id={headingId}>
                {renderGroupIconEditor(group)}
                <Button
                  appearance="transparent"
                  className={mergeClasses(classes.groupEditCollapseButton, 'better-list__group-button')}
                  aria-controls={panelId}
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroup(groupStateKey)}
                >
                  <span className={classes.groupTitle}>{group.title}</span>
                  {isExpanded ? (
                    <ChevronUpRegular className={mergeClasses(classes.chevron, 'better-list__chevron')} aria-hidden="true" />
                  ) : (
                    <ChevronDownRegular className={mergeClasses(classes.chevron, 'better-list__chevron')} aria-hidden="true" />
                  )}
                </Button>
              </span>
            ) : collapsible ? (
              <Button
                appearance="transparent"
                className={mergeClasses(classes.groupButton, 'better-list__group-button')}
                id={headingId}
                aria-controls={panelId}
                aria-expanded={isExpanded}
                onClick={() => toggleGroup(groupStateKey)}
              >
                <span className={mergeClasses(classes.groupButtonContent, 'better-list__group-button-content')}>
                  {renderGroupIcon(group)}
                  <span className={classes.groupTitle}>{group.title}</span>
                </span>
                {isExpanded ? (
                  <ChevronUpRegular className={mergeClasses(classes.chevron, 'better-list__chevron')} aria-hidden="true" />
                ) : (
                  <ChevronDownRegular className={mergeClasses(classes.chevron, 'better-list__chevron')} aria-hidden="true" />
                )}
              </Button>
            ) : (
              <span
                className={mergeClasses(
                  classes.groupStaticHeading,
                  isEditMode && classes.groupEditHeading,
                  'better-list__group-static-heading'
                )}
                id={headingId}
              >
                {renderGroupIconEditor(group)}
                <span className={classes.groupTitle}>{group.title}</span>
              </span>
            )}
          </h2>
        ),
        body: (attributes, key) =>
          isExpanded ? (
            <div {...attributes} aria-labelledby={headingId} id={panelId} key={key} role="region">
              {renderListTemplate(group.items, density, showDescriptions)}
            </div>
          ) : null
      },
      {
        'aria-labelledby': headingId,
        className: mergeClasses(classes.group, 'better-list__group'),
        key: group.id
      }
    );
  };

  const renderReadyContent = (): React.ReactNode => {
    if (!hasAnyItems) {
      return (
        <div className={mergeClasses(classes.state, 'better-list__state')} role="status">
          <div className={classes.stateInner}>
            <InfoRegular className={mergeClasses(classes.stateIcon, 'better-list__state-icon')} aria-hidden="true" />
            <Text size={400}>{emptyMessage}</Text>
          </div>
        </div>
      );
    }

    if (visibleItems.length === 0) {
      return (
        <div className={mergeClasses(classes.state, 'better-list__state')} role="status">
          <div className={classes.stateInner}>
            <SearchRegular className={mergeClasses(classes.stateIcon, 'better-list__state-icon')} aria-hidden="true" />
            <Text size={400}>{noResultsMessage}</Text>
          </div>
        </div>
      );
    }

    if (!grouped) {
      return (
        <div className={mergeClasses(classes.grid, 'better-list__grid')} style={gridStyle} aria-live="polite">
          {renderListTemplate(displayedItems, density, showDescriptions)}
        </div>
      );
    }

    return (
      <div className={mergeClasses(classes.grid, 'better-list__grid')} style={gridStyle} aria-live="polite">
        {groups.map(renderGroupTemplate)}
      </div>
    );
  };

  return (
    <>
      {renderFragment(
        'shell',
        {
          'list.title': listTitle,
          'tab.label': selectedTab?.label,
          'results.count': visibleItems.length
        },
        {
      tabs: (attributes, key) =>
        tabs.length > 1 ? (
          <TabList
            {...attributes}
            className={mergeClasses(classes.tabs, 'better-list__tabs')}
            key={key}
            selectedValue={selectedTab?.key}
            onTabSelect={handleTabSelect}
            aria-label="Better List views"
          >
            {tabs.map((tab) => (
              <Tab
                className={mergeClasses(classes.tab, 'better-list__tab')}
                icon={renderTabIcon(tab, classes.tabIcon)}
                key={tab.key}
                value={tab.key}
              >
                {tab.showItemCount ? `${tab.label} (${tab.itemCount ?? 0})` : tab.label}
              </Tab>
            ))}
          </TabList>
        ) : (
          <span {...attributes} key={key} />
        ),
      search: (attributes, key) =>
        showSearch ? (
          <Input
            {...attributes}
            className={mergeClasses(String(attributes.className || ''), classes.search, 'better-list__search')}
            contentBefore={
              <SearchRegular className={mergeClasses(classes.searchIcon, 'better-list__search-icon')} aria-hidden="true" />
            }
            size="large"
            key={key}
            value={internalSearchValue}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            type="search"
          />
        ) : null,
      content: (attributes, key) => (
        <div
          {...attributes}
          className={mergeClasses(String(attributes.className || ''), classes.content, 'better-list__content')}
          key={key}
        >
          {status === 'loading' ? (
            <div className={mergeClasses(classes.state, 'better-list__state')} role="status" aria-live="polite">
              <Spinner label="Loading list items" size="large" />
            </div>
          ) : status === 'error' ? (
            <div className={mergeClasses(classes.state, 'better-list__state')} role="alert">
              <MessageBar className={classes.messageBar} intent="error">
                <MessageBarBody>
                  <MessageBarTitle>Unable to load the list</MessageBarTitle>
                  {errorMessage}
                </MessageBarBody>
                {onRetry ? (
                  <MessageBarActions>
                    <Button appearance="transparent" icon={<ArrowClockwiseRegular />} onClick={onRetry}>
                      Try again
                    </Button>
                  </MessageBarActions>
                ) : null}
              </MessageBar>
            </div>
          ) : (
            renderReadyContent()
          )}
        </div>
      )
        },
        {
          'aria-label': 'Better List',
          'data-selected-tab': selectedTab?.key,
          className: mergeClasses(classes.root, 'better-list')
        }
      )}
      {editingGroup && onGroupIconOverrideChange ? (
        <React.Suspense fallback={null}>
          <GroupIconPickerDialog
            current={getBetterListGroupIconOverride(groupIcons, groupIconScope, editingGroup.id)}
            defaultColor={groupIcons.defaultColor}
            groupTitle={editingGroup.title}
            imageAssetProvider={groupImageAssetProvider}
            open
            onApply={(override) => onGroupIconOverrideChange(editingGroup.id, override)}
            onOpenChange={(open) => {
              if (!open) {
                setEditingGroup(undefined);
              }
            }}
          />
        </React.Suspense>
      ) : null}
    </>
  );
};

function renderTemplateElement(
  node: IBetterListTemplateElementNode,
  tokens: BetterListTemplateTokens,
  slots: Partial<Record<BetterListTemplateSlotName, BetterListTemplateSlotRenderer>>,
  classAliases: Readonly<Record<string, string>>,
  rootAttributes: Record<string, unknown>,
  keyPath: string
): React.ReactElement {
  const authoredAttributes = resolveTemplateAttributes(node, tokens, classAliases);
  const attributes = {
    ...authoredAttributes,
    ...rootAttributes,
    className: mergeClasses(String(authoredAttributes.className || ''), String(rootAttributes.className || ''))
  };
  const children = node.children.map((child, index) =>
    renderTemplateNode(child, tokens, slots, classAliases, `${keyPath}:${index}`)
  );
  return React.createElement(node.tagName, attributes, children);
}

function renderTemplateNode(
  node: IBetterListTemplateNode,
  tokens: BetterListTemplateTokens,
  slots: Partial<Record<BetterListTemplateSlotName, BetterListTemplateSlotRenderer>>,
  classAliases: Readonly<Record<string, string>>,
  keyPath: string
): React.ReactNode {
  if (node.type === 'text') {
    return substituteBetterListTokens(node.value, tokens);
  }
  const attributes = resolveTemplateAttributes(node, tokens, classAliases);
  if (node.slot) {
    const renderSlot = slots[node.slot];
    return renderSlot ? renderSlot(attributes, keyPath) : null;
  }
  const children = node.children.map((child, index) =>
    renderTemplateNode(child, tokens, slots, classAliases, `${keyPath}:${index}`)
  );
  return React.createElement(node.tagName, { ...attributes, key: keyPath }, children);
}

function resolveTemplateAttributes(
  node: IBetterListTemplateElementNode,
  tokens: BetterListTemplateTokens,
  classAliases: Readonly<Record<string, string>>
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  Object.keys(node.attributes).forEach((name) => {
    const rawValue = node.attributes[name];
    const value = substituteBetterListTokens(rawValue, tokens);
    attributes[name === 'class' ? 'className' : name] = value;
  });
  const authoredClassName = String(attributes.className || '');
  const generatedClasses = authoredClassName
    .split(/\s+/)
    .filter(Boolean)
    .map((className) => classAliases[className])
    .filter(Boolean);
  attributes.className = mergeClasses(authoredClassName, ...generatedClasses);
  return attributes;
}

export default BetterListView;
