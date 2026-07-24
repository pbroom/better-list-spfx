import * as React from 'react';
import {
  Button,
  makeStyles,
  Menu,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  tokens
} from '@fluentui/react-components';
import type { MenuProps } from '@fluentui/react-components';
import { ChevronDownRegular } from '@fluentui/react-icons';

import {
  createBetterListColumnReferenceMenuGroups,
  getBetterListColumnReferenceMenuLabel,
  IBetterListFieldPathOption
} from '../../../../shared';

const noGroupingValue = '__no_grouping__';

const useStyles = makeStyles({
  trigger: {
    justifyContent: 'space-between',
    minWidth: 0,
    width: '100%',
    fontWeight: tokens.fontWeightRegular
  },
  triggerLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textAlign: 'left',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  triggerIcon: {
    color: tokens.colorNeutralStrokeAccessible
  }
});

export interface IGroupingColumnMenuProps {
  mountNode?: MenuProps['mountNode'];
  options: readonly IBetterListFieldPathOption[];
  popoverClassName?: string;
  positioning?: MenuProps['positioning'];
  selectedLabel?: string;
  selectedPath: string;
  submenuPositioning?: MenuProps['positioning'];
  onChange: (fieldPath: string) => void;
}

export const GroupingColumnMenu: React.FunctionComponent<IGroupingColumnMenuProps> = ({
  mountNode,
  options,
  popoverClassName,
  positioning,
  selectedLabel,
  selectedPath,
  submenuPositioning,
  onChange
}) => {
  const classes = useStyles();
  const groups = createBetterListColumnReferenceMenuGroups(options);
  const checkedValues = {
    groupingColumn: [selectedPath || noGroupingValue]
  };
  const select = (fieldPath: string | undefined): void => {
    if (fieldPath) {
      onChange(fieldPath === noGroupingValue ? '' : fieldPath);
    }
  };
  const label = selectedLabel || 'No grouping';

  return (
    <Menu
      checkedValues={checkedValues}
      mountNode={mountNode}
      positioning={positioning}
      onCheckedValueChange={(_event, data) => select(data.checkedItems[0])}
    >
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="secondary"
          aria-label={`Grouping column: ${label}`}
          className={classes.trigger}
          icon={<ChevronDownRegular className={classes.triggerIcon} />}
          iconPosition="after"
          type="button"
        >
          <span className={classes.triggerLabel}>{label}</span>
        </Button>
      </MenuTrigger>
      <MenuPopover className={popoverClassName}>
        <MenuList>
          <MenuItemRadio name="groupingColumn" value={noGroupingValue}>
            No grouping
          </MenuItemRadio>
          {groups.map((group) =>
            group.label ? (
              <Menu
                checkedValues={checkedValues}
                key={group.key}
                mountNode={mountNode}
                positioning={submenuPositioning}
                onCheckedValueChange={(_event, data) => select(data.checkedItems[0])}
              >
                <MenuTrigger disableButtonEnhancement>
                  <MenuItem>{group.label}</MenuItem>
                </MenuTrigger>
                <MenuPopover className={popoverClassName}>
                  <MenuList>
                    {group.options.map((option) => (
                      <MenuItemRadio
                        key={option.fieldPath}
                        name="groupingColumn"
                        value={option.fieldPath}
                      >
                        {getBetterListColumnReferenceMenuLabel(option)}
                      </MenuItemRadio>
                    ))}
                  </MenuList>
                </MenuPopover>
              </Menu>
            ) : (
              group.options.map((option) => (
                <MenuItemRadio
                  key={option.fieldPath}
                  name="groupingColumn"
                  value={option.fieldPath}
                >
                  {getBetterListColumnReferenceMenuLabel(option)}
                </MenuItemRadio>
              ))
            )
          )}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
};
