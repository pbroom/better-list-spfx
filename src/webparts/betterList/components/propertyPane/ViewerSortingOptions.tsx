import * as React from 'react';
import {
  Checkbox,
  Menu,
  MenuButton,
  MenuItem,
  MenuItemCheckbox,
  MenuList,
  MenuPopover,
  MenuTrigger,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens
} from '@fluentui/react-components';

import {
  betterListFluentSurfaceClassName,
  betterListPortalMountNodeProps,
  betterListViewerSortChoices,
  BetterListViewerSortOption,
  createBetterListColumnReferenceMenuGroups,
  createBetterListPortalPositioning,
  getBetterListColumnReferenceMenuLabel,
  IBetterListFieldPathOption
} from '../../../../shared';

export interface IViewerSortingOptionsProps {
  className?: string;
  columnOptions: readonly IBetterListFieldPathOption[];
  enabled: readonly BetterListViewerSortOption[];
  legendClassName?: string;
  selectedColumns: readonly string[];
  targetDocument?: Document;
  onChange: (
    enabled: readonly BetterListViewerSortOption[],
    selectedColumns: readonly string[]
  ) => void;
}

const useStyles = makeStyles({
  columnRow: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS
  },
  columnTrigger: {
    ...shorthands.borderWidth(tokens.strokeWidthThin),
    flexGrow: 1,
    justifyContent: 'space-between',
    minWidth: 0
  },
  menuPopover: {
    maxHeight: 'min(360px, calc(100vh - 16px))',
    overflowY: 'auto',
    overscrollBehavior: 'contain'
  }
});

export const ViewerSortingOptions: React.FunctionComponent<IViewerSortingOptionsProps> = ({
  className,
  columnOptions,
  enabled,
  legendClassName,
  selectedColumns,
  targetDocument,
  onChange
}) => {
  const classes = useStyles();
  const updateMode = (mode: BetterListViewerSortOption, checked: boolean): void => {
    const nextEnabled = checked
      ? [...enabled, mode]
      : enabled.filter((option) => option !== mode);
    const nextColumns =
      mode === 'column' && checked && selectedColumns.length === 0
        ? columnOptions.map((option) => option.fieldPath)
        : selectedColumns;
    onChange(nextEnabled, nextColumns);
  };
  const selectedColumnLabels = columnOptions
    .filter((option) => selectedColumns.indexOf(option.fieldPath) >= 0)
    .map((option) => option.label);
  const columnSummary =
    selectedColumnLabels.length === 0
      ? 'Choose columns'
      : selectedColumnLabels.length === 1
        ? selectedColumnLabels[0]
        : `${selectedColumnLabels.length} columns`;
  const columnMenuGroups = createBetterListColumnReferenceMenuGroups(columnOptions);
  const updateColumns = (nextColumns: readonly string[]): void => {
    const nextEnabled =
      nextColumns.length > 0
        ? enabled.indexOf('column') >= 0
          ? enabled
          : [...enabled, 'column' as const]
        : enabled.filter((option) => option !== 'column');
    onChange(nextEnabled, nextColumns);
  };

  return (
    <fieldset aria-label="Sorting options" className={className}>
      <legend className={legendClassName}>Sorting options</legend>
      {betterListViewerSortChoices
        .filter((choice) => choice.value !== 'column')
        .map((choice) => (
          <Checkbox
            aria-label={`Show ${choice.label} sorting option`}
            checked={enabled.indexOf(choice.value) >= 0}
            key={choice.value}
            label={choice.label}
            onChange={(_event, data) => updateMode(choice.value, data.checked === true)}
          />
        ))}
      <div className={classes.columnRow}>
        <Checkbox
          aria-label="Show Column sorting option"
          checked={enabled.indexOf('column') >= 0}
          disabled={columnOptions.length === 0}
          label="Column"
          onChange={(_event, data) => updateMode('column', data.checked === true)}
        />
        <Menu
          checkedValues={{ viewerSortColumns: selectedColumns.slice() }}
          mountNode={betterListPortalMountNodeProps}
          positioning={createBetterListPortalPositioning(targetDocument)}
          onCheckedValueChange={(_event, data) => {
            updateColumns(data.checkedItems);
          }}
        >
          <MenuTrigger disableButtonEnhancement>
            <MenuButton
              appearance="outline"
              aria-label="Choose visitor sorting columns"
              className={classes.columnTrigger}
              disabled={columnOptions.length === 0}
              size="small"
            >
              {columnSummary}
            </MenuButton>
          </MenuTrigger>
          <MenuPopover
            className={mergeClasses(classes.menuPopover, betterListFluentSurfaceClassName)}
          >
            <MenuList>
              {columnMenuGroups.length > 0 ? (
                columnMenuGroups.map((group) =>
                  group.label ? (
                    <Menu
                      checkedValues={{ viewerSortColumns: selectedColumns.slice() }}
                      key={group.key}
                      mountNode={betterListPortalMountNodeProps}
                      positioning={createBetterListPortalPositioning(targetDocument, 'submenu')}
                      onCheckedValueChange={(_event, data) =>
                        updateColumns(data.checkedItems)
                      }
                    >
                      <MenuTrigger disableButtonEnhancement>
                        <MenuItem>{group.label}</MenuItem>
                      </MenuTrigger>
                      <MenuPopover
                        className={mergeClasses(
                          classes.menuPopover,
                          betterListFluentSurfaceClassName
                        )}
                      >
                        <MenuList>
                          {group.options.map((option) => (
                            <MenuItemCheckbox
                              key={option.fieldPath}
                              name="viewerSortColumns"
                              value={option.fieldPath}
                            >
                              {getBetterListColumnReferenceMenuLabel(option)}
                            </MenuItemCheckbox>
                          ))}
                        </MenuList>
                      </MenuPopover>
                    </Menu>
                  ) : (
                    group.options.map((option) => (
                      <MenuItemCheckbox
                        key={option.fieldPath}
                        name="viewerSortColumns"
                        value={option.fieldPath}
                      >
                        {getBetterListColumnReferenceMenuLabel(option)}
                      </MenuItemCheckbox>
                    ))
                  )
                )
              ) : null}
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
    </fieldset>
  );
};
