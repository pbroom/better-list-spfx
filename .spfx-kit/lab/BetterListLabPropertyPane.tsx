import * as React from 'react';
import { Button, Combobox, Option, Switch, makeStyles, tokens } from '@fluentui/react-components';
import { AddRegular, ChevronDownRegular, ChevronRightRegular, CodeRegular } from '@fluentui/react-icons';
import type {
  LabCssEditorTarget,
  LabPropertyBag,
  LabPropertyControl,
  LabPropertyPaneRenderProps
} from '@spfx-kit/spfx-lab-runtime';

import {
  createBetterListMetadataMappings,
  parseItemLayoutConfiguration,
  parseItemPropertyFields,
  parseTabConfiguration,
  betterListSemanticSlots,
  betterListTemplateMaxBytes,
  defaultBetterListHtmlTemplate,
  validateBetterListTemplateStructure,
  serializeItemLayoutConfiguration,
  serializeItemPropertyFields,
  serializeTabConfiguration,
  IBetterListFieldMappings,
  IBetterListTabConfig
} from '../../src/shared';
import { ColumnPickerMenu, ItemPropertyBuilder } from '../../src/webparts/betterList/components/propertyPane/ItemPropertyBuilder';
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
  section: {
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`
  },
  sectionHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 32px',
    alignItems: 'center',
    minHeight: '48px'
  },
  sectionButton: {
    justifyContent: 'flex-start',
    minWidth: 0,
    paddingLeft: 0,
    fontSize: '14px',
    fontWeight: 600
  },
  sectionLabel: {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0
  },
  sectionIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground3,
    fontSize: '16px'
  },
  sectionBody: {
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
    lineHeight: '18px',
    padding: '0 0 12px'
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
  removeButton: {
    flexShrink: 0
  },
  switch: {
    marginTop: '8px'
  },
  itemBuilder: {
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`
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
  const [listQuery, setListQuery] = React.useState<string | undefined>(undefined);
  const itemLayout = React.useMemo(
    () => parseItemLayoutConfiguration(
      values.itemLayoutJson,
      parseItemPropertyFields(values.itemPropertiesJson)
    ),
    [values.itemLayoutJson, values.itemPropertiesJson]
  );
  const tabs = React.useMemo(() => readTabs(values.tabsJson), [values.tabsJson]);
  const mappings = React.useMemo(() => readMappings(values.fieldMappingsJson), [values.fieldMappingsJson]);
  const tabFilterFields = React.useMemo(
    () => createTabFilterFields(mappings),
    [mappings]
  );
  const groupingFields = React.useMemo(() => servicesAuthoringFields.filter(isGroupingColumn), []);

  return (
    <section className={classes.root}>
      <Combobox
        aria-label="Choose list or enter URL"
        className={classes.listPicker}
        placeholder="Choose list or enter URL…"
        selectedOptions={values.sourceListId ? [values.sourceListId] : []}
        value={listQuery !== undefined ? listQuery : values.sourceListTitle}
        onBlur={() => setListQuery(undefined)}
        onChange={(event) => setListQuery(event.currentTarget.value)}
        onOptionSelect={(_event, data) => {
          setListQuery(undefined);
          if (data.optionValue === servicesListId) {
            onChange({
              sourceListId: servicesListId,
              sourceListTitle: servicesListTitle
            });
          }
        }}
      >
        <Option value={servicesListId}>{servicesListTitle}</Option>
      </Combobox>

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
        label={tabs.length > 1 ? `Tabs (${tabs.length})` : 'Tabs'}
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
      <DisclosureSection
        action={
          <ColumnPickerMenu
            ariaLabel="Select groups column"
            fields={groupingFields}
            onSelect={(groupsColumn) => onChange({ groupsColumn })}
            selectedPaths={new Set(values.groupsColumn ? [values.groupsColumn] : [])}
          />
        }
        label="Groups"
      >
        <ColumnSetting
          emptyLabel="No group column selected."
          fieldPath={values.groupsColumn}
          removeAriaLabel="Remove groups column"
          selectedLabel="Groups column"
          onRemove={() => onChange({ groupsColumn: '' })}
        />
        {values.groupsColumn ? (
          <Switch
            checked={values.groupsCollapsible}
            className={classes.switch}
            label="Allow groups to collapse"
            onChange={(_event, data) => onChange({ groupsCollapsible: data.checked })}
          />
        ) : null}
      </DisclosureSection>

      <div className={classes.itemBuilder}>
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
      </div>

      <DisclosureSection defaultExpanded icon="code" label="Advanced">
        <div className={classes.advancedBody}>
          {renderControl(betterListSourceWorkspaceControl)}
        </div>
      </DisclosureSection>
    </section>
  );
};

const ColumnSetting: React.FunctionComponent<{
  emptyLabel: string;
  fieldPath: string;
  removeAriaLabel: string;
  selectedLabel: string;
  onRemove: () => void;
}> = ({ emptyLabel, fieldPath, removeAriaLabel, selectedLabel, onRemove }) => {
  const classes = useStyles();
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={fieldPath ? classes.settingRow : classes.settingEmpty}
      role="status"
    >
      <span className={fieldPath ? classes.settingSummary : undefined}>
        {fieldPath ? `${selectedLabel}: ${getColumnSummary(fieldPath)}.` : emptyLabel}
      </span>
      {fieldPath ? (
        <Button
          appearance="subtle"
          aria-label={removeAriaLabel}
          className={classes.removeButton}
          size="small"
          onClick={onRemove}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );
};

interface IDisclosureSectionProps {
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: 'code';
  label: string;
}

const DisclosureSection: React.FunctionComponent<IDisclosureSectionProps> = ({
  action,
  children,
  defaultExpanded = false,
  icon,
  label
}) => {
  const classes = useStyles();
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  return (
    <div className={classes.section}>
      <div className={classes.sectionHeader}>
        <Button
          appearance="transparent"
          aria-expanded={expanded}
          className={classes.sectionButton}
          onClick={() => setExpanded((current) => !current)}
        >
          {label}
        </Button>
        {action || (
          <span className={classes.sectionIcon} aria-hidden="true">
            {icon === 'code' ? <CodeRegular /> : expanded ? <ChevronDownRegular /> : <ChevronRightRegular />}
          </span>
        )}
      </div>
      {expanded ? <div className={classes.sectionBody}>{children}</div> : null}
    </div>
  );
};

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

function getColumnSummary(fieldPath: string): string {
  const internalName = fieldPath.split('.')[0];
  const field = servicesAuthoringFields.find((candidate) => candidate.internalName === internalName);
  const nestedField = fieldPath.split('.')[1];
  return field ? (nestedField ? `${field.title} → ${nestedField}` : field.title) : fieldPath;
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
