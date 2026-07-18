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
  InfoRegular,
  MegaphoneRegular,
  SearchRegular
} from '@fluentui/react-icons';

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
  /** Ordered visible elements after the required title. */
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
  onTabChange?: (tabKey: string) => void;
  onSearchChange?: (value: string) => void;
  onRetry?: () => void;
}

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
  groupIcon: {
    flexShrink: 0
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
}> = ({ kind, title, className }) => {
  const Icon = resolveGroupIcon(kind, title);
  return <Icon className={className} aria-hidden="true" />;
};

const BetterListItem: React.FunctionComponent<{
  item: IBetterListItem;
  classes: ReturnType<typeof useStyles>;
  density: 'compact' | 'comfortable';
  showDescriptions: boolean;
}> = ({ item, classes, density, showDescriptions }) => {
  const metadata = (item.metadata ?? [item.organizationCode, item.organizationName]).filter(
    (value): value is string => Boolean(value?.trim())
  );
  const elements: readonly IBetterListItemElement[] =
    item.elements ??
    [
      ...metadata.map((value, index) => ({
        key: `metadata-${index}`,
        kind: 'metadata' as const,
        value
      })),
      ...(item.description
        ? [{ key: 'description', kind: 'description' as const, value: item.description }]
        : [])
    ];

  return (
    <li
      className={mergeClasses(
        classes.item,
        density === 'compact' && classes.itemCompact,
        'better-list__item',
        density === 'compact' && 'better-list__item--compact'
      )}
    >
      {item.href ? (
        <Link className={mergeClasses(classes.itemTitle, 'better-list__item-title')} href={item.href}>
          {item.title}
        </Link>
      ) : (
        <Text
          className={mergeClasses(
            classes.itemTitleText,
            'better-list__item-title',
            'better-list__item-title--text'
          )}
        >
          {item.title}
        </Text>
      )}
      {renderItemElements(elements, classes, showDescriptions)}
    </li>
  );
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
          <span
            className={mergeClasses(classes.metadataPart, 'better-list__metadata-part')}
            data-item-element={element.key}
            key={element.key}
          >
            {element.value}
          </span>
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
      rendered.push(
        <Text
          className={mergeClasses(classes.description, 'better-list__item-description')}
          data-item-element={element.key}
          key={element.key}
        >
          {element.value}
        </Text>
      );
    }
  });
  flushMetadata();
  return rendered;
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
  onTabChange,
  onSearchChange,
  onRetry
}) => {
  const classes = useStyles();
  const [selectedTabKey, setSelectedTabKey] = React.useState(activeTabKey);
  const [internalSearchValue, setInternalSearchValue] = React.useState(searchValue ?? '');
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
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
    return tabItems.filter(
      (item) => (!selectedIds || selectedIds.has(item.id)) && itemMatchesSearch(item, normalizedSearchText)
    );
  }, [items, normalizedSearchText, selectedTab]);

  const groups = React.useMemo(
    () => (grouped ? groupItems(visibleItems) : []),
    [grouped, visibleItems]
  );
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
        <div
          className={mergeClasses(classes.grid, 'better-list__grid')}
          style={gridStyle}
          aria-live="polite"
        >
          <ul className={mergeClasses(classes.list, 'better-list__items')}>
            {visibleItems.slice().sort(compareItems).map((item) => (
              <BetterListItem
                classes={classes}
                density={density}
                item={item}
                key={item.id}
                showDescriptions={showDescriptions}
              />
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div className={mergeClasses(classes.grid, 'better-list__grid')} style={gridStyle} aria-live="polite">
        {groups.map((group) => {
          const groupStateKey = `${selectedTab?.key ?? 'default'}:${group.id}`;
          const isExpanded = collapsible ? !(collapsedGroups[groupStateKey] ?? !initiallyExpanded) : true;
          const safeGroupId = group.id.replace(/[^a-zA-Z0-9_-]/g, '-');
          const headingId = `better-list-${instanceId}-${safeGroupId}-heading`;
          const panelId = `better-list-${instanceId}-${safeGroupId}-panel`;

          return (
            <section
              className={mergeClasses(classes.group, 'better-list__group')}
              key={group.id}
              aria-labelledby={grouped ? headingId : undefined}
            >
              {grouped ? (
                <h2 className={mergeClasses(classes.groupHeading, 'better-list__group-heading')}>
                  {collapsible ? (
                    <Button
                      appearance="transparent"
                      className={mergeClasses(classes.groupButton, 'better-list__group-button')}
                      id={headingId}
                      aria-controls={panelId}
                      aria-expanded={isExpanded}
                      onClick={() => toggleGroup(groupStateKey)}
                    >
                      <span
                        className={mergeClasses(classes.groupButtonContent, 'better-list__group-button-content')}
                      >
                        <GroupIcon
                          className={mergeClasses(classes.groupIcon, 'better-list__group-icon')}
                          kind={group.icon}
                          title={group.title}
                        />
                        <span className={classes.groupTitle}>{group.title}</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUpRegular
                          className={mergeClasses(classes.chevron, 'better-list__chevron')}
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDownRegular
                          className={mergeClasses(classes.chevron, 'better-list__chevron')}
                          aria-hidden="true"
                        />
                      )}
                    </Button>
                  ) : (
                    <span
                      className={mergeClasses(classes.groupStaticHeading, 'better-list__group-static-heading')}
                      id={headingId}
                    >
                      <GroupIcon
                        className={mergeClasses(classes.groupIcon, 'better-list__group-icon')}
                        kind={group.icon}
                        title={group.title}
                      />
                      <span className={classes.groupTitle}>{group.title}</span>
                    </span>
                  )}
                </h2>
              ) : null}
              {isExpanded ? (
                <div
                  id={grouped ? panelId : undefined}
                  role={grouped ? 'region' : undefined}
                  aria-labelledby={grouped ? headingId : undefined}
                >
                  <ul className={mergeClasses(classes.list, 'better-list__items')}>
                    {group.items.map((item) => (
                      <BetterListItem
                        classes={classes}
                        density={density}
                        item={item}
                        key={item.id}
                        showDescriptions={showDescriptions}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <section
      className={mergeClasses(classes.root, 'better-list')}
      aria-label="Better List"
      data-selected-tab={selectedTab?.key}
    >
      <div className={mergeClasses(classes.header, 'better-list__header')}>
        <div className={mergeClasses(classes.toolbar, 'better-list__toolbar')}>
          {tabs.length > 1 ? (
            <TabList
              className={mergeClasses(classes.tabs, 'better-list__tabs')}
              selectedValue={selectedTab?.key}
              onTabSelect={handleTabSelect}
              aria-label="Better List views"
            >
              {tabs.map((tab) => (
                <Tab className={mergeClasses(classes.tab, 'better-list__tab')} key={tab.key} value={tab.key}>
                  {tab.label}
                </Tab>
              ))}
            </TabList>
          ) : (
            <span />
          )}
          {showSearch ? (
            <Input
              className={mergeClasses(classes.search, 'better-list__search')}
              contentBefore={
                <SearchRegular
                  className={mergeClasses(classes.searchIcon, 'better-list__search-icon')}
                  aria-hidden="true"
                />
              }
              size="large"
              value={internalSearchValue}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              type="search"
            />
          ) : null}
        </div>
      </div>
      <div className={mergeClasses(classes.content, 'better-list__content')}>
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
    </section>
  );
};

export default BetterListView;
