/* eslint-disable @typescript-eslint/no-use-before-define -- Small property-pane controls are composed before their declarations. */
import * as React from 'react';
import {
  Button,
  Dropdown,
  FluentProvider,
  Option,
  Switch,
  tokens,
  webLightTheme
} from '@fluentui/react-components';
import { AddRegular } from '@fluentui/react-icons';

import {
  createBetterListFieldMapping,
  createBetterListMetadataMappings,
  createDefaultTabs,
  betterListSemanticSlots,
  defaultBetterListHtmlTemplate,
  betterListTemplateMaxBytes,
  BetterListItemLayoutRows,
  BetterListItemElementLinks,
  IBetterListFieldDescriptor,
  IBetterListFieldMappings,
  IBetterListGroupIconsConfiguration,
  IBetterListTabConfig,
  validateBetterListTemplateStructure
} from '../../../../shared';
import { ISourceEditorTarget, SourceEditorField } from '../../../../vendor/source-editor/SourceEditorField';
import { ColumnPickerMenu, ItemPropertyBuilder } from './ItemPropertyBuilder';
import { PropertyPaneSection } from './PropertyPaneSection';
import { appendNewTab, IBetterListTabFilterField, TabBuilder } from './TabBuilder';

export interface IBetterListAuthoringState {
  sourceListId: string;
  sourceListTitle: string;
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
}

export interface ISharePointFieldOption extends IBetterListFieldDescriptor {
  hidden?: boolean;
  readOnly?: boolean;
}

export interface IBetterListPickerDataSource {
  loadLists: () => Promise<readonly ISharePointListOption[]>;
  loadFields: (listId: string) => Promise<readonly ISharePointFieldOption[]>;
}

export interface IBetterListPropertyPaneProps {
  value: IBetterListAuthoringState;
  pickerDataSource: IBetterListPickerDataSource;
  onChange: (value: IBetterListAuthoringState) => void;
}

const cssTargets: readonly ISourceEditorTarget[] = [
  { label: 'Web part', selector: '.better-list', snippet: '.better-list {\n  /* layout and theme overrides */\n}' },
  { label: 'Header', selector: '.better-list__header', snippet: '.better-list__header {\n  /* title and search area */\n}' },
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
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    setLoadingLists(true);
    props.pickerDataSource
      .loadLists()
      .then((nextLists) => {
        if (!cancelled) {
          setLists(nextLists);
          setError('');
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setError(loadError.message || 'Lists could not be loaded.');
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
      .loadFields(props.value.sourceListId)
      .then((nextFields) => {
        if (!cancelled) {
          setFields(nextFields.filter((field) => !field.hidden));
          setError('');
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setError(loadError.message || 'Fields could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.pickerDataSource, props.value.sourceListId]);

  const patchValue = (patch: Partial<IBetterListAuthoringState>): void => {
    props.onChange({ ...props.value, ...patch });
  };

  const selectList = (listId: string): void => {
    const selected = lists.find((list) => list.id === listId);
    patchValue({
      sourceListId: listId,
      sourceListTitle: selected?.title || '',
      fieldMappings: {},
      itemProperties: ['Title'],
      itemLayoutRows: [],
      itemElementLinks: {},
      tabsColumn: '',
      groupsColumn: '',
      groupsCollapsible: true,
      groupIcons: { ...props.value.groupIcons, overrides: [] },
      tabs: createDefaultTabs().slice()
    });
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
    const metadata = createBetterListMetadataMappings(
      fields,
      [...itemProperties, ...Object.keys(links).map((fieldPath) => links[fieldPath])]
    );
    patchValue({
      itemProperties,
      itemLayoutRows: rows,
      itemElementLinks: links,
      fieldMappings: { ...props.value.fieldMappings, metadata }
    });
  };

  const updateGroupColumn = (fieldPath: string): void => {
    const [internalName, lookupValueField] = fieldPath.split('.');
    const field = fields.find((candidate) => candidate.internalName === internalName);
    const fieldMappings = { ...props.value.fieldMappings };
    if (field) {
      fieldMappings.group = createBetterListFieldMapping(field, 'group', lookupValueField);
    } else {
      delete fieldMappings.group;
    }
    patchValue({
      fieldMappings,
      groupsColumn: fieldPath,
      groupIcons:
        fieldPath === props.value.groupsColumn
          ? props.value.groupIcons
          : { ...props.value.groupIcons, overrides: [] }
    });
  };
  const groupingFields = fields.filter(isGroupingColumn);
  const tabFilterFields = createTabFilterFields(props.value.fieldMappings, fields);

  return (
    <FluentProvider className="bl-pane-provider" theme={webLightTheme}>
      <div className="bl-pane">
        <style>{propertyPaneCss}</style>
        <section className="bl-pane__source-section">
        <label className="bl-pane__field">
          <span className="bl-pane__label">Source list</span>
          <Dropdown
            aria-label="Source list"
            className="bl-pane__source-dropdown"
            disabled={loadingLists}
            listbox={{
              className: 'bl-pane__source-listbox',
              style: { maxHeight: 'min(320px, 70vh)', overflowY: 'auto' }
            }}
            placeholder={loadingLists ? 'Loading lists…' : 'Select a SharePoint list'}
            positioning={{ align: 'start', autoSize: 'height', position: 'below', strategy: 'fixed' }}
            selectedOptions={props.value.sourceListId ? [props.value.sourceListId] : []}
            value={props.value.sourceListTitle}
            onOptionSelect={(_event, data) => selectList(data.optionValue || '')}
          >
            {lists.map((list) => (
              <Option key={list.id} text={list.title} value={list.id}>
                {list.title}
              </Option>
            ))}
          </Dropdown>
        </label>
        {error && (
          <div className="bl-pane__error" role="alert">
            {error}
          </div>
        )}
        </section>

        <PropertyPaneSection
          action={
            <Button
              appearance="subtle"
              aria-label="Add tab"
              icon={<AddRegular />}
              size="small"
              onClick={() => patchValue({ tabs: appendNewTab(props.value.tabs).slice(), tabsColumn: '' })}
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
            fields={tabFilterFields}
            showAddAction={false}
            tabs={props.value.tabs}
            onChange={(tabs) => patchValue({ tabs: tabs.slice(), tabsColumn: '' })}
          />
        </PropertyPaneSection>

        <PropertyPaneSection
          action={
          <ColumnPickerMenu
            ariaLabel="Select groups column"
            fields={groupingFields}
            onSelect={updateGroupColumn}
            selectedPaths={new Set(props.value.groupsColumn ? [props.value.groupsColumn] : [])}
          />
          }
          label="Groups"
        >
        <AxisColumnSummary
          emptyLabel="No group column selected."
          fieldPath={props.value.groupsColumn}
          fields={fields}
          removeAriaLabel="Remove groups column"
          selectedLabel="Groups column"
          onRemove={() => updateGroupColumn('')}
        />
        {props.value.groupsColumn ? (
          <>
            <Switch
              checked={props.value.groupsCollapsible}
              className="bl-pane__switch"
              label="Allow groups to collapse"
              onChange={(_event, data) => patchValue({ groupsCollapsible: data.checked })}
            />
            <Switch
              checked={props.value.groupIcons.showIcons}
              className="bl-pane__switch"
              label="Show group icons"
              onChange={(_event, data) =>
                patchValue({ groupIcons: { ...props.value.groupIcons, showIcons: data.checked } })
              }
            />
            {props.value.groupIcons.overrides.length ? (
              <div className="bl-pane__setting-row">
                <span>{`${props.value.groupIcons.overrides.length} icon override${
                  props.value.groupIcons.overrides.length === 1 ? '' : 's'
                }`}</span>
                <Button
                  appearance="subtle"
                  className="bl-pane__text-button"
                  size="small"
                  onClick={() => patchValue({ groupIcons: { ...props.value.groupIcons, overrides: [] } })}
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

        <ItemPropertyBuilder
          fields={fields}
          value={{
            itemProperties: props.value.itemProperties,
            rows: props.value.itemLayoutRows,
            links: props.value.itemElementLinks
          }}
          onChange={updateItemLayout}
        />

        <PropertyPaneSection defaultExpanded label="Advanced">
        <SourceEditorField
          description="Styles are scoped to this web part. Insert a supported target, then override only the declarations you need."
          label="Custom CSS/SCSS"
          language="scss"
          targets={cssTargets}
          value={props.value.customCss}
          onChange={(customCss) => patchValue({ customCss })}
        />
        <div className="bl-pane__template-editor">
          <SourceEditorField
            commitMode="valid"
            description="Customize structural wrappers around trusted tabs, search, groups, items, links, and properties. Invalid drafts stay local until corrected."
            height={360}
            label="HTML template"
            language="html"
            maxBytes={betterListTemplateMaxBytes}
            snippets={[
              { label: 'Default template', snippet: defaultBetterListHtmlTemplate },
              { label: 'Item title token', snippet: '{{item.title}}' },
              { label: 'Result count token', snippet: '{{results.count}}' }
            ]}
            validate={validateBetterListTemplateStructure}
            value={props.value.htmlTemplate}
            onChange={(htmlTemplate) => patchValue({ htmlTemplate })}
          />
        </div>
        </PropertyPaneSection>
      </div>
    </FluentProvider>
  );
};

function getFieldPathLabel(field: ISharePointFieldOption, fieldPath: string): string {
  const targetInternalName = fieldPath.split('.')[1];
  if (!targetInternalName) {
    return field.title;
  }
  const targetField = field.lookupFields?.find((candidate) => candidate.internalName === targetInternalName);
  return `${field.title} → ${targetField?.title || targetInternalName}`;
}

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
  const sourceFields = fields
    .filter((field) => !mappedInternalNames.has(field.internalName))
    .map((field): IBetterListTabFilterField => {
      const mapping = createBetterListFieldMapping(field);
      return {
        id: `source:${field.internalName}`,
        fieldPath: field.internalName,
        kind: mapping.kind,
        label: field.title,
        mapping
      };
    });
  return semanticFields.concat(sourceFields);
}

const AxisColumnSummary: React.FunctionComponent<{
  emptyLabel: string;
  fieldPath: string;
  fields: readonly ISharePointFieldOption[];
  removeAriaLabel: string;
  selectedLabel: string;
  onRemove: () => void;
}> = ({ emptyLabel, fieldPath, fields, removeAriaLabel, selectedLabel, onRemove }) => {
  const field = fields.find((candidate) => candidate.internalName === fieldPath.split('.')[0]);
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={fieldPath ? 'bl-pane__axis-summary' : 'bl-pane__empty'}
      role="status"
    >
      <span>
        {fieldPath ? `${selectedLabel}: ${field ? getFieldPathLabel(field, fieldPath) : fieldPath}.` : emptyLabel}
      </span>
      {fieldPath ? (
        <Button appearance="subtle" aria-label={removeAriaLabel} size="small" onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
};

function isGroupingColumn(field: ISharePointFieldOption): boolean {
  const type = field.typeAsString.toLocaleLowerCase();
  return (
    type.indexOf('text') >= 0 ||
    type.indexOf('choice') >= 0 ||
    type.indexOf('lookup') >= 0 ||
    type.indexOf('boolean') >= 0 ||
    type.indexOf('date') >= 0
  );
}

const propertyPaneCss = `
.bl-pane-provider { background: transparent; }
.bl-pane { color: #242424; container-type: inline-size; font-family: "Segoe UI", sans-serif; margin: -8px; }
.bl-pane *, .bl-pane *::before, .bl-pane *::after { box-sizing: border-box; }
.bl-pane__source-section { border: 0; margin: 0; padding: 8px 0 12px; }
.bl-pane__section-count { color: ${tokens.colorNeutralForeground3}; font-weight: 400; margin-left: 4px; }
.bl-pane__field { display: flex; flex-direction: column; gap: 5px; margin: 0 0 12px; min-width: 0; }
.bl-pane__label { font-size: 12px; font-weight: 600; }
.bl-pane__source-dropdown { min-width: 0; width: 100%; }
.bl-pane__source-listbox { font-family: "Segoe UI", sans-serif; }
.bl-pane__help { color: #616161; font-size: 11px; line-height: 1.4; margin: -4px 0 12px; }
.bl-pane__error { background: #fdf3f4; border-left: 3px solid #c50f1f; color: #8a1219; font-size: 12px; padding: 8px; }
.bl-pane__empty { background: #f5f5f5; color: #616161; font-size: 12px; padding: 10px; }
.bl-pane__axis-summary { align-items: center; display: flex; font-size: 12px; justify-content: space-between; gap: 8px; }
.bl-pane__switch { margin-top: 8px; }
.bl-pane__setting-row { align-items: center; color: #616161; display: flex; font-size: 12px; justify-content: space-between; gap: 8px; margin-top: 10px; }
.bl-pane__text-button { border-color: transparent !important; min-height: 24px !important; padding: 2px 4px !important; }
.bl-pane__hint { color: #616161; font-size: 11px; line-height: 1.4; margin: 8px 0 0; }
.bl-pane__template-editor { border-top: 1px solid #e0e0e0; margin-top: 16px; padding-top: 16px; }
`;
