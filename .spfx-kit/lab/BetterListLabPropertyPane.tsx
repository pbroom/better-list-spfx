import * as React from 'react';
import { Button, Dropdown, Option, Switch, makeStyles, tokens } from '@fluentui/react-components';
import { AddRegular } from '@fluentui/react-icons';
import type {
  LabCssEditorTarget,
  LabPropertyBag,
  LabPropertyControl,
  LabPropertyPaneRenderProps
} from '@spfx-kit/spfx-lab-runtime';

import {
  createBetterListMetadataMappings,
  parseBetterListGroupIconsConfiguration,
  parseItemLayoutConfiguration,
  parseItemPropertyFields,
  parseTabConfiguration,
  betterListSemanticSlots,
  betterListTemplateMaxBytes,
  defaultBetterListHtmlTemplate,
  validateBetterListTemplateStructure,
  serializeItemLayoutConfiguration,
  serializeBetterListGroupIconsConfiguration,
  serializeItemPropertyFields,
  serializeTabConfiguration,
  IBetterListFieldMappings,
  IBetterListTabConfig
} from '../../src/shared';
import { GroupIconColorField } from '../../src/webparts/betterList/components/GroupIconColorField';
import { ItemPropertyBuilder } from '../../src/webparts/betterList/components/propertyPane/ItemPropertyBuilder';
import { PropertyPaneSection } from '../../src/webparts/betterList/components/propertyPane/PropertyPaneSection';
import {
  appendNewTab,
  IBetterListTabFilterField,
  TabBuilder
} from '../../src/webparts/betterList/components/propertyPane/TabBuilder';
import { servicesAuthoringFields, servicesListId, servicesListTitle } from './betterListFixtures';

export type BetterListLabProps = LabPropertyBag & {
  sourceListId: string;
  sourceListTitle: string;
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
  advancedBody: {
    paddingTop: '2px'
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
  const selectedGroupingOption = groupingOptions.find((option) => option.value === values.groupsColumn);

  return (
    <section className={classes.root}>
      <Dropdown
        aria-label="Source list"
        className={classes.listPicker}
        listbox={{ style: { maxHeight: 'min(320px, 70vh)', overflowY: 'auto' } }}
        placeholder="Select a SharePoint list"
        positioning={{ align: 'start', autoSize: 'height', position: 'below', strategy: 'fixed' }}
        selectedOptions={values.sourceListId ? [values.sourceListId] : []}
        value={values.sourceListTitle}
        onOptionSelect={(_event, data) => {
          if (data.optionValue === servicesListId) {
            onChange({
              sourceListId: servicesListId,
              sourceListTitle: servicesListTitle
            });
          }
        }}
      >
        <Option value={servicesListId}>{servicesListTitle}</Option>
      </Dropdown>

      <DisclosureSection
        action={
          <Button
            appearance="subtle"
            aria-label="Add tab"
            icon={<AddRegular />}
            size="small"
            onClick={() =>
              onChange({ tabsColumn: '', tabsJson: serializeTabConfiguration(appendNewTab(tabs)) })
            }
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
          showAddAction={false}
          tabs={tabs}
          onChange={(nextTabs) =>
            onChange({ tabsColumn: '', tabsJson: serializeTabConfiguration(nextTabs) })
          }
        />
      </DisclosureSection>
      <DisclosureSection label="Groups">
        <label className={classes.groupingField}>
          <span>Grouping column</span>
          <Dropdown
            aria-label="Grouping column"
            selectedOptions={[values.groupsColumn || noGroupingValue]}
            value={selectedGroupingOption?.label || 'No grouping'}
            onOptionSelect={(_event, data) => {
              const groupsColumn = data.optionValue === noGroupingValue ? '' : data.optionValue || '';
              onChange({
                groupsColumn,
                groupIconsJson: serializeBetterListGroupIconsConfiguration({ ...groupIcons, overrides: [] })
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
        {values.groupsColumn ? (
          <>
            <Switch
              checked={values.groupsCollapsible}
              className={classes.switch}
              label="Allow groups to collapse"
              onChange={(_event, data) => onChange({ groupsCollapsible: data.checked })}
            />
            <Switch
              checked={groupIcons.showIcons}
              className={classes.switch}
              label="Show group icons"
              onChange={(_event, data) =>
                onChange({
                  groupIconsJson: serializeBetterListGroupIconsConfiguration({ ...groupIcons, showIcons: data.checked })
                })
              }
            />
            {groupIcons.showIcons ? (
              <GroupIconColorField
                label="Default icon color"
                value={groupIcons.defaultColor}
                onChange={(defaultColor) =>
                  onChange({
                    groupIconsJson: serializeBetterListGroupIconsConfiguration({ ...groupIcons, defaultColor })
                  })
                }
              />
            ) : null}
            {groupIcons.overrides.length ? (
              <div className={classes.settingRow}>
                <span className={classes.settingSummary}>{`${groupIcons.overrides.length} icon override${
                  groupIcons.overrides.length === 1 ? '' : 's'
                }`}</span>
                <Button
                  appearance="subtle"
                  size="small"
                  onClick={() =>
                    onChange({
                      groupIconsJson: serializeBetterListGroupIconsConfiguration({ ...groupIcons, overrides: [] })
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

      <ItemPropertyBuilder
        fields={servicesAuthoringFields}
        value={{
          itemProperties: itemLayout.itemProperties,
          rows: itemLayout.rows,
          links: itemLayout.links
        }}
        onChange={(nextValue) => {
          const metadata = createBetterListMetadataMappings(
            servicesAuthoringFields,
            [
              ...nextValue.itemProperties,
              ...Object.keys(nextValue.links).map((fieldPath) => nextValue.links[fieldPath])
            ]
          );
          onChange({
            fieldMappingsJson: JSON.stringify({ ...mappings, metadata }),
            itemPropertiesJson: serializeItemPropertyFields(nextValue.itemProperties),
            itemLayoutJson: serializeItemLayoutConfiguration(
              nextValue.rows,
              nextValue.itemProperties,
              nextValue.links
            )
          });
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
