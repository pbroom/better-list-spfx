import * as React from 'react';
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  makeStyles,
  mergeClasses,
  tokens
} from '@fluentui/react-components';
import { CheckmarkRegular } from '@fluentui/react-icons';

import {
  betterListDefaultSortOptions,
  betterListFluentSurfaceClassName,
  betterListPortalMountNodeProps,
  BetterListDefaultSort,
  createBetterListPortalPositioning,
  IBetterListFieldPathOption
} from '../../../../shared';

export interface IDefaultSortingMenuProps {
  columnOptions: readonly IBetterListFieldPathOption[];
  selectedColumn: string;
  selectedMode: BetterListDefaultSort;
  targetDocument?: Document;
  onChange: (mode: BetterListDefaultSort, column?: string) => void;
}

const useStyles = makeStyles({
  trigger: {
    width: '100%',
    justifyContent: 'space-between',
    fontWeight: tokens.fontWeightRegular
  },
  popover: {
    maxHeight: 'min(360px, calc(100vh - 16px))',
    overflowY: 'auto',
    overscrollBehavior: 'contain'
  }
});

export const DefaultSortingMenu: React.FunctionComponent<IDefaultSortingMenuProps> = ({
  columnOptions,
  selectedColumn,
  selectedMode,
  targetDocument,
  onChange
}) => {
  const classes = useStyles();
  const selectedOption = betterListDefaultSortOptions.find(
    (option) => option.value === selectedMode
  ) || betterListDefaultSortOptions[0];
  const selectedColumnOption = columnOptions.find(
    (option) => option.fieldPath === selectedColumn
  );
  const triggerLabel = selectedMode === 'column'
    ? selectedColumnOption
      ? `Column: ${selectedColumnOption.label}`
      : 'Column'
    : selectedOption.label;

  return (
    <Menu
      checkedValues={{ defaultSort: [selectedMode] }}
      hasIcons
      mountNode={betterListPortalMountNodeProps}
      positioning={createBetterListPortalPositioning(targetDocument)}
      onCheckedValueChange={(_event, data) => {
        const nextMode = betterListDefaultSortOptions.find(
          (option) => option.value === data.checkedItems[0] && option.value !== 'column'
        )?.value;
        if (nextMode) {
          onChange(nextMode);
        }
      }}
    >
      <MenuTrigger disableButtonEnhancement>
        <MenuButton
          appearance="outline"
          aria-label="Default sorting"
          className={classes.trigger}
        >
          {triggerLabel}
        </MenuButton>
      </MenuTrigger>
      <MenuPopover
        className={mergeClasses(classes.popover, betterListFluentSurfaceClassName)}
      >
        <MenuList>
          {betterListDefaultSortOptions
            .filter((option) => option.value !== 'column')
            .map((option) => (
              <MenuItemRadio
                key={option.value}
                name="defaultSort"
                value={option.value}
              >
                {option.label}
              </MenuItemRadio>
            ))}
          <Menu
            checkedValues={{ defaultSortColumn: selectedColumn ? [selectedColumn] : [] }}
            hasIcons
            mountNode={betterListPortalMountNodeProps}
            positioning={createBetterListPortalPositioning(targetDocument, 'submenu')}
            onCheckedValueChange={(_event, data) => {
              const column = data.checkedItems[0];
              if (column) {
                onChange('column', column);
              }
            }}
          >
            <MenuTrigger disableButtonEnhancement>
              <MenuItem
                icon={selectedMode === 'column' ? <CheckmarkRegular /> : undefined}
                secondaryContent={selectedMode === 'column' ? selectedColumnOption?.label : undefined}
              >
                Column
              </MenuItem>
            </MenuTrigger>
            <MenuPopover
              className={mergeClasses(classes.popover, betterListFluentSurfaceClassName)}
            >
              <MenuList>
                {columnOptions.length > 0 ? (
                  columnOptions.map((option) => (
                    <MenuItemRadio
                      key={option.fieldPath}
                      name="defaultSortColumn"
                      value={option.fieldPath}
                    >
                      {option.label}
                    </MenuItemRadio>
                  ))
                ) : (
                  <MenuItem disabled>No sortable columns</MenuItem>
                )}
              </MenuList>
            </MenuPopover>
          </Menu>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
};
