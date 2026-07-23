import * as React from 'react';
import { Button, Combobox, Dropdown, Input, Option, Switch, makeStyles, tokens } from '@fluentui/react-components';
import { AddRegular, EditRegular } from '@fluentui/react-icons';
import type {
  LabCssEditorTarget,
  LabPropertyBag,
  LabPropertyControl,
  LabPropertyPaneRenderProps
} from '@spfx-kit/spfx-lab-runtime';

import {
  createBetterListMetadataMappings,
  createBetterListGroupingOverride,
  createBetterListItemLayoutOverride,
  getRichTextItemPropertyPaths,
  parseBetterListGroupIconsConfiguration,
  parseItemLayoutConfiguration,
  parseItemPropertyFields,
  parseTabConfiguration,
  groupItemsBySourceField,
  normalizeItem,
  processItems,
  betterListSemanticSlots,
  betterListTemplateMaxBytes,
  defaultBetterListHtmlTemplate,
  validateBetterListTemplateStructure,
  serializeTabConfiguration,
  IBetterListFieldMappings,
  IBetterListTabConfig,
  resolveBetterListTabConfigurations
} from '../../src/shared';
import { GroupIconColorField } from '../../src/webparts/betterList/components/GroupIconColorField';
import { ItemPropertyBuilder } from '../../src/webparts/betterList/components/propertyPane/ItemPropertyBuilder';
import { PropertyPaneSection } from '../../src/webparts/betterList/components/propertyPane/PropertyPaneSection';
import { GroupOrderEditorDialog } from '../../src/webparts/betterList/components/propertyPane/GroupOrderEditorDialog';
import {
  appendNewTab,
  IBetterListTabFilterField,
  TabBuilder
} from '../../src/webparts/betterList/components/propertyPane/TabBuilder';
import {
  createServicesFixtureRecords,
  servicesAuthoringFields,
  servicesListId,
  servicesListTitle
} from './betterListFixtures';

const titleCommitDelayMs = 500;

export type BetterListLabProps = LabPropertyBag & {
  heading: string;
  maxItemsPerPage: number;
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
  authoringTabId: string;
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    color: tokens.colorNeutralForeground1
  },
  listPicker: {
    width: '100%',
    marginBottom: '12px'
  },
  groupingField: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '5px',
    width: '100%',
    marginBottom: '12px',
    fontSize: '12px',
    fontWeight: 600
  },
  sectionLabel: {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0
  },
  sectionCount: {
    color: tokens.colorNeutralForeground3,
    fontWeight: 400,
    marginLeft: '4px'
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '8px'
  },
  settingSummary: {
    minWidth: 0,
    overflow: 'hidden',
    color: tokens.colorNeutralForeground2,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  settingEmpty: {
    margin: 0,
    color: tokens.colorNeutralForeground3
  },
  switch: {
    marginTop: '8px'
  },
  editGroups: {
    alignSelf: 'flex-start',
    marginBottom: '4px'
  },
  advancedBody: {
    paddingTop: '2px'
  },
  inheritance: {
    alignItems: 'center',
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    fontSize: '11px',
    justifyContent: 'space-between',
    columnGap: '8px',
    marginBottom: '8px'
  }
});

export const betterListCssControl: LabPropertyControl = {
  type: 'sourceEditor',
  language: 'scss',
  name: 'customCss',
  label: 'CSS/SCSS',
  description: 'Styles are scoped to this Better List preview.',
  minHeight: 250,
  targetComment: `/*
Better List CSS/SCSS targets:
.better-list - web part surface and design tokens.
.better-list__toolbar - tabs and search row.
.better-list__group - grouped section.
.better-list__pagination - page navigation.
.better-list__load-more - progressive result loading.
.better-list__item - list item surface.
*/`,
  targets: createCssTargets()
};

export const betterListHtmlControl: LabPropertyControl = {
  type: 'sourceEditor',
  language: 'html',
  name: 'htmlTemplate',
  label: 'HTML template',
  description: 'Structural wrappers only. Trusted controls and list behavior remain runtime-owned.',
  minHeight: 360,
  maxBytes: betterListTemplateMaxBytes,
  commitMode: 'valid',
  snippets: [
    { label: 'Default template', snippet: defaultBetterListHtmlTemplate },
    { label: 'Item title token', snippet: '{{item.title}}' },
    { label: 'Result count token', snippet: '{{results.count}}' }
  ],
  validate: validateBetterListTemplateStructure
};

export const betterListSourceWorkspaceControl: LabPropertyControl = {
  type: 'sourceWorkspace',
  name: 'sourceWorkspace',
  label: 'Styles & template',
  documents: [betterListCssControl, betterListHtmlControl]
};

export const BetterListLabPropertyPane: React.FunctionComponent<LabPropertyPaneRenderProps<BetterListLabProps>> = ({
  values,
  onChange,
  renderControl,
  title: _title
}) => {
  const classes = useStyles();
  const [sourceInput, setSourceInput] = React.useState(values.sourceListTitle);
  const [sourceError, setSourceError] = React.useState('');
  const [headingInput, setHeadingInput] = React.useState(values.heading);
  const [groupEditorOpen, setGroupEditorOpen] = React.useState(false);
  const headingInputRef = React.useRef(values.heading);
  const headingCommitTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestValuesRef = React.useRef(values);
  const onChangeRef = React.useRef(onChange);

  latestValuesRef.current = values;
  onChangeRef.current = onChange;

  const clearHeadingCommitTimer = React.useCallback((): void => {
    if (headingCommitTimerRef.current !== undefined) {
      clearTimeout(headingCommitTimerRef.current);
      headingCommitTimerRef.current = undefined;
    }
  }, []);

  const commitHeading = React.useCallback((): void => {
    clearHeadingCommitTimer();
    const headingDraft = headingInputRef.current;
    if (headingDraft !== latestValuesRef.current.heading) {
      latestValuesRef.current = { ...latestValuesRef.current, heading: headingDraft };
      onChangeRef.current({ heading: headingDraft });
    }
  }, [clearHeadingCommitTimer]);

  const scheduleHeadingCommit = React.useCallback((): void => {
    clearHeadingCommitTimer();
    headingCommitTimerRef.current = setTimeout(commitHeading, titleCommitDelayMs);
  }, [clearHeadingCommitTimer, commitHeading]);

  React.useEffect(() => setSourceInput(values.sourceListTitle), [values.sourceListId, values.sourceListTitle]);
  React.useEffect(() => {
    headingInputRef.current = values.heading;
    setHeadingInput(values.heading);
  }, [values.heading]);
  React.useEffect(() => () => commitHeading(), [commitHeading]);
  const itemLayout = React.useMemo(
    () => parseItemLayoutConfiguration(
      values.itemLayoutJson,
      parseItemPropertyFields(values.itemPropertiesJson)
    ),
    [values.itemLayoutJson, values.itemPropertiesJson]
  );
  const tabs = React.useMemo(() => readTabs(values.tabsJson), [values.tabsJson]);
  const groupIcons = React.useMemo(
    () => parseBetterListGroupIconsConfiguration(values.groupIconsJson),
    [values.groupIconsJson]
  );
  const mappings = React.useMemo(() => readMappings(values.fieldMappingsJson), [values.fieldMappingsJson]);
  const tabFilterFields = React.useMemo(
    () => createTabFilterFields(mappings),
    [mappings]
  );
  const groupingFields = React.useMemo(() => servicesAuthoringFields.filter(isGroupingColumn), []);
  const groupingOptions = React.useMemo(() => createGroupingColumnOptions(groupingFields), [groupingFields]);
  const activeTabId = tabs.some((tab) => tab.id === values.authoringTabId)
    ? values.authoringTabId
    : tabs[0]?.id || '';
  const effectiveTabs = React.useMemo(() => resolveBetterListTabConfigurations(tabs, {
    grouping: {
      column: values.groupsColumn,
      collapsible: values.groupsCollapsible,
      icons: groupIcons
    },
    itemLayout
  }), [groupIcons, itemLayout, tabs, values.groupsCollapsible, values.groupsColumn]);
  const activeConfiguration = effectiveTabs.find((entry) => entry.tab.id === activeTabId) ?? effectiveTabs[0];
  const activeGrouping = activeConfiguration?.grouping ?? {
    column: '',
    collapsible: false,
    icons: groupIcons,
    filter: { kind: 'all' as const },
    groupOrder: []
  };
  const groupOptions = React.useMemo(() => {
    if (!activeConfiguration || !activeGrouping.column) {
      return [];
    }
    const sourceItems = createServicesFixtureRecords({
      displayName: 'Lab User',
      email: 'lab.user@contoso.com',
      loginName: 'i:0#.f|membership|lab.user@contoso.com'
    }).map((record) => normalizeItem(record, mappings as IBetterListFieldMappings));
    const processed = processItems(sourceItems, activeConfiguration.tab);
    const richTextFieldPaths = getRichTextItemPropertyPaths(mappings as IBetterListFieldMappings);
    return groupItemsBySourceField(
      processed,
      activeGrouping.column,
      activeGrouping.filter,
      'Other',
      richTextFieldPaths.has(activeGrouping.column)
    ).map((group) => ({
      key: group.key,
      label: group.label,
      itemCount: group.items.length
    }));
  }, [activeConfiguration, activeGrouping.column, activeGrouping.filter, mappings]);
  const activeItemLayout = activeConfiguration?.itemLayout ?? itemLayout;
  const selectedGroupingOption = groupingOptions.find((option) => option.value === activeGrouping.column);
  const updateActiveTab = (patch: Partial<IBetterListTabConfig>): IBetterListTabConfig[] =>
    tabs.map((tab) => tab.id === activeTabId ? { ...tab, ...patch } : tab);
  const patchTabsWithDerivedMetadata = (nextTabs: IBetterListTabConfig[]): void => {
    const resolved = resolveBetterListTabConfigurations(nextTabs, {
      grouping: {
        column: values.groupsColumn,
        collapsible: values.groupsCollapsible,
        icons: groupIcons
      },
      itemLayout
    });
    const paths = resolved.reduce<string[]>((result, entry) => {
      result.push(...entry.itemLayout.itemProperties);
      result.push(...Object.keys(entry.itemLayout.links).map((fieldPath) => entry.itemLayout.links[fieldPath]));
      if (entry.grouping.column) {
        result.push(entry.grouping.column);
      }
      return result;
    }, []);
    const metadata = createBetterListMetadataMappings(servicesAuthoringFields, paths);
    onChange({
      fieldMappingsJson: JSON.stringify({ ...mappings, metadata }),
      tabsJson: serializeTabConfiguration(nextTabs)
    });
  };
  const patchActiveGrouping = (nextGrouping: typeof activeGrouping): void => {
    patchTabsWithDerivedMetadata(updateActiveTab({
      groupingOverride: createBetterListGroupingOverride(nextGrouping)
    }));
  };

  return (
    <section className={classes.root}>
      <Combobox
        aria-label="Source list"
        className={classes.listPicker}
        freeform
        listbox={{ style: { maxHeight: 'min(320px, 70vh)', overflowY: 'auto' } }}
        placeholder="Select a list or paste its URL"
        positioning={{ align: 'start', autoSize: 'height', position: 'below', strategy: 'fixed' }}
        selectedOptions={values.sourceListId ? [values.sourceListId] : []}
        value={sourceInput}
        onChange={(event) => {
          setSourceInput((event.target as HTMLInputElement).value);
          setSourceError('');
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || sourceInput === servicesListTitle) {
            return;
          }
          event.preventDefault();
          try {
            const url = new URL(sourceInput.trim());
            if (url.protocol !== 'https:' || !/\/lists\/services(?:\/|$)/i.test(url.pathname)) {
              throw new Error('Enter the Services SharePoint list URL.');
            }
            setSourceInput(servicesListTitle);
            setSourceError('');
            onChange({
              sourceListId: servicesListId,
              sourceListTitle: servicesListTitle,
              sourceWebUrl: `${url.origin}${url.pathname.replace(/\/Lists\/Services.*$/i, '')}`
            });
          } catch (error) {
            setSourceError(error instanceof Error ? error.message : 'Enter a valid SharePoint list URL.');
          }
        }}
        onOptionSelect={(_event, data) => {
          if (data.optionValue === servicesListId) {
            setSourceInput(servicesListTitle);
            setSourceError('');
            onChange({
              sourceListId: servicesListId,
              sourceListTitle: servicesListTitle,
              sourceWebUrl: 'https://contoso.sharepoint.com/sites/lab'
            });
          }
        }}
      >
        <Option value={servicesListId}>{servicesListTitle}</Option>
      </Combobox>
      {sourceError ? <div role="alert">{sourceError}</div> : null}
      <label className={classes.groupingField}>
        <span>Title</span>
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
        />
      </label>
      <label className={classes.groupingField}>
        <span>Maximum items per page</span>
        <Input
          aria-label="Maximum items per page"
          min={1}
          placeholder="No maximum"
          step={1}
          type="number"
          value={values.maxItemsPerPage > 0 ? String(values.maxItemsPerPage) : ''}
          onChange={(_event, data) => {
            const numericValue = Number(data.value);
            onChange({
              maxItemsPerPage:
                Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : 0
            });
          }}
        />
      </label>

      <DisclosureSection
        action={
          <Button
            appearance="subtle"
            aria-label="Add tab"
            icon={<AddRegular />}
            size="small"
            onClick={() => {
              const nextTabs = appendNewTab(tabs);
              onChange({
                authoringTabId: nextTabs[nextTabs.length - 1]?.id || activeTabId,
                tabsColumn: '',
                tabsJson: serializeTabConfiguration(nextTabs)
              });
            }}
          />
        }
        label={
          <>
            Tabs
            {tabs.length > 1 ? <span className={classes.sectionCount}> ({tabs.length})</span> : null}
          </>
        }
      >
        <TabBuilder
          fields={tabFilterFields}
          selectedTabId={activeTabId}
          showAddAction={false}
          tabs={tabs}
          onChange={(nextTabs) => {
            const nextAuthoringTabId = nextTabs.some((tab) => tab.id === activeTabId)
              ? activeTabId
              : nextTabs[0]?.id || '';
            onChange({
              authoringTabId: nextAuthoringTabId,
              tabsColumn: '',
              tabsJson: serializeTabConfiguration(nextTabs)
            });
          }}
          onSelectedTabChange={(authoringTabId) => onChange({ authoringTabId })}
        />
      </DisclosureSection>
      <DisclosureSection label="Groups">
        <div className={classes.inheritance}>
          <span>
            {activeConfiguration?.groupingInherited
              ? activeConfiguration.inheritedFromTabId
                ? `Inherited from ${tabs.find((tab) => tab.id === activeConfiguration.inheritedFromTabId)?.label || 'the previous tab'}. Change a setting to override it.`
                : 'Using the default web part settings. Change a setting to override it.'
              : 'Customized for this tab.'}
          </span>
          {activeConfiguration && !activeConfiguration.groupingInherited ? (
            <Button
              appearance="subtle"
              size="small"
              onClick={() => patchTabsWithDerivedMetadata(updateActiveTab({ groupingOverride: undefined }))}
            >
              Use previous
            </Button>
          ) : null}
        </div>
        <label className={classes.groupingField}>
          <span>Grouping column</span>
          <Dropdown
            aria-label="Grouping column"
            selectedOptions={[activeGrouping.column || noGroupingValue]}
            value={selectedGroupingOption?.label || 'No grouping'}
            onOptionSelect={(_event, data) => {
              const groupsColumn = data.optionValue === noGroupingValue ? '' : data.optionValue || '';
              patchActiveGrouping({
                column: groupsColumn,
                collapsible: groupsColumn ? activeGrouping.collapsible : false,
                icons: groupsColumn === activeGrouping.column
                  ? activeGrouping.icons
                  : { ...activeGrouping.icons, overrides: [] },
                filter: groupsColumn === activeGrouping.column
                  ? activeGrouping.filter
                  : { kind: 'all' },
                groupOrder: groupsColumn === activeGrouping.column ? activeGrouping.groupOrder : []
              });
            }}
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
              className={classes.editGroups}
              icon={<EditRegular />}
              onClick={() => setGroupEditorOpen(true)}
            >
              Edit groups
            </Button>
            <Switch
              checked={activeGrouping.collapsible}
              className={classes.switch}
              label="Allow groups to collapse"
              onChange={(_event, data) => patchActiveGrouping({ ...activeGrouping, collapsible: data.checked })}
            />
            <Switch
              checked={activeGrouping.icons.showIcons}
              className={classes.switch}
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
              <div className={classes.settingRow}>
                <span className={classes.settingSummary}>{`${activeGrouping.icons.overrides.length} icon override${
                  activeGrouping.icons.overrides.length === 1 ? '' : 's'
                }`}</span>
                <Button
                  appearance="subtle"
                  size="small"
                  onClick={() =>
                    patchActiveGrouping({
                      ...activeGrouping,
                      icons: { ...activeGrouping.icons, overrides: [] }
                    })
                  }
                >
                  Reset all
                </Button>
              </div>
            ) : (
              <p className={classes.settingEmpty}>Select a group icon in the preview to replace it.</p>
            )}
          </>
        ) : null}
      </DisclosureSection>

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
          <div className={classes.inheritance}>
            <span>
              {activeConfiguration?.itemLayoutInherited
                ? activeConfiguration.inheritedFromTabId
                  ? `Inherited from ${tabs.find((tab) => tab.id === activeConfiguration.inheritedFromTabId)?.label || 'the previous tab'}. Change a setting to override it.`
                  : 'Using the default web part settings. Change a setting to override it.'
                : 'Customized for this tab.'}
            </span>
            {activeConfiguration && !activeConfiguration.itemLayoutInherited ? (
              <Button
                appearance="subtle"
                size="small"
                onClick={() => patchTabsWithDerivedMetadata(updateActiveTab({ itemLayoutOverride: undefined }))}
              >
                Use previous
              </Button>
            ) : null}
          </div>
        )}
        fields={servicesAuthoringFields}
        value={{
          itemProperties: activeItemLayout.itemProperties,
          rows: activeItemLayout.rows,
          links: activeItemLayout.links
        }}
        onChange={(nextValue) => {
          patchTabsWithDerivedMetadata(updateActiveTab({
            itemLayoutOverride: createBetterListItemLayoutOverride({
              itemProperties: nextValue.itemProperties,
              rows: nextValue.rows,
              links: nextValue.links
            })
          }));
        }}
      />

      <DisclosureSection defaultExpanded label="Advanced">
        <div className={classes.advancedBody}>
          {renderControl(betterListSourceWorkspaceControl)}
        </div>
      </DisclosureSection>
    </section>
  );
};

interface IDisclosureSectionProps {
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  label: React.ReactNode;
}

const DisclosureSection: React.FunctionComponent<IDisclosureSectionProps> = ({
  action,
  children,
  defaultExpanded = false,
  label
}) => (
  <PropertyPaneSection action={action} defaultExpanded={defaultExpanded} label={label}>
    {children}
  </PropertyPaneSection>
);

function isGroupingColumn(field: (typeof servicesAuthoringFields)[number]): boolean {
  const type = field.typeAsString.toLocaleLowerCase();
  return (
    type.indexOf('text') >= 0 ||
    type.indexOf('choice') >= 0 ||
    type.indexOf('lookup') >= 0 ||
    type.indexOf('boolean') >= 0 ||
    type.indexOf('date') >= 0
  );
}

interface IGroupingColumnOption {
  label: string;
  value: string;
}

const noGroupingValue = '__no_grouping__';

function createGroupingColumnOptions(
  fields: ReadonlyArray<(typeof servicesAuthoringFields)[number]>
): readonly IGroupingColumnOption[] {
  return fields.reduce<IGroupingColumnOption[]>((options, field) => {
    const isLookup = field.typeAsString.toLocaleLowerCase().indexOf('lookup') >= 0;
    if (!isLookup) {
      options.push({ label: field.title, value: field.internalName });
      return options;
    }
    const lookupFields = field.lookupFields?.length
      ? field.lookupFields
      : [{ internalName: field.lookupField || 'Title', title: field.lookupField || 'Title', typeAsString: 'Text' }];
    lookupFields.forEach((lookupField) => {
      options.push({
        label: `${field.title} → ${lookupField.title}`,
        value: `${field.internalName}.${lookupField.internalName}`
      });
    });
    return options;
  }, []);
}

function readTabs(serialized: string): readonly IBetterListTabConfig[] {
  try {
    return parseTabConfiguration(serialized);
  } catch (_error) {
    return parseTabConfiguration(undefined);
  }
}

function readMappings(serialized: string): Partial<IBetterListFieldMappings> {
  try {
    const parsed = JSON.parse(serialized) as Partial<IBetterListFieldMappings>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function createTabFilterFields(mappings: Partial<IBetterListFieldMappings>): readonly IBetterListTabFilterField[] {
  return betterListSemanticSlots
    .map((slot): IBetterListTabFilterField | undefined => {
      const mapping = mappings[slot.key];
      return mapping
        ? { id: `slot:${slot.key}`, key: slot.key, kind: mapping.kind, label: mapping.displayName || slot.label }
        : undefined;
    })
    .filter((field): field is IBetterListTabFilterField => Boolean(field));
}

function createCssTargets(): LabCssEditorTarget[] {
  return [
    { label: 'Web part', selector: '.better-list', snippet: '.better-list {\n  /* layout and theme overrides */\n}' },
    { label: 'Header', selector: '.better-list__header', snippet: '.better-list__header {\n  /* tabs and search area */\n}' },
    { label: 'Tabs', selector: '.better-list__tabs', snippet: '.better-list__tabs {\n  /* tab row */\n}' },
    { label: 'Group', selector: '.better-list__group', snippet: '.better-list__group {\n  /* grouped section */\n}' },
    {
      label: 'Group heading',
      selector: '.better-list__group-heading',
      snippet: '.better-list__group-heading {\n  /* group icon and title */\n}'
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
    {
      label: 'Item title',
      selector: '.better-list__item-title',
      snippet: '.better-list__item-title {\n  /* item link */\n}'
    },
    {
      label: 'Description',
      selector: '.better-list__item-description',
      snippet: '.better-list__item-description {\n  /* item description */\n}'
    },
    { label: 'Metadata', selector: '.better-list__metadata', snippet: '.better-list__metadata {\n  /* optional metadata */\n}' }
  ];
}
