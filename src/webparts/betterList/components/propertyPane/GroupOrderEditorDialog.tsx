import * as React from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Text,
  makeStyles,
  shorthands,
  tokens
} from '@fluentui/react-components';
import {
  ArrowDownRegular,
  ArrowUpRegular,
  DismissRegular,
  SearchRegular
} from '@fluentui/react-icons';

import {
  betterListFluentSurfaceClassName,
  IBetterListGroupOrderEntry
} from '../../../../shared';

export interface IBetterListGroupOption {
  key: string;
  label: string;
  itemCount: number;
}

export interface IGroupOrderEditorDialogProps {
  groups: readonly IBetterListGroupOption[];
  value: readonly IBetterListGroupOrderEntry[];
  onApply: (value: readonly IBetterListGroupOrderEntry[]) => void;
  onOpenChange: (open: boolean) => void;
}

interface IGroupOrderEditorRow extends IBetterListGroupOption {
  hidden: boolean;
}

const useStyles = makeStyles({
  surface: {
    width: 'min(680px, calc(100vw - 32px))',
    maxWidth: '680px',
    maxHeight: 'calc(100dvh - 32px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  body: {
    flexGrow: 1,
    minHeight: 0,
    maxHeight: 'inherit',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    overflow: 'hidden'
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '12px',
    minHeight: 0,
    overflow: 'hidden'
  },
  search: {
    width: '100%'
  },
  resultSummary: {
    color: tokens.colorNeutralForeground3
  },
  tableFrame: {
    minHeight: '220px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium)
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed'
  },
  headerCell: {
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    textAlign: 'left',
    ...shorthands.padding('8px', '10px')
  },
  row: {
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`
  },
  hiddenRow: {
    color: tokens.colorNeutralForeground3
  },
  cell: {
    fontSize: tokens.fontSizeBase300,
    verticalAlign: 'middle',
    ...shorthands.padding('8px', '10px')
  },
  groupLabel: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  countCell: {
    width: '72px'
  },
  visibleCell: {
    width: '88px'
  },
  orderCell: {
    width: '92px'
  },
  orderActions: {
    display: 'flex',
    columnGap: '2px'
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    minHeight: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    ...shorthands.padding('24px')
  },
  actionStart: {
    marginRight: 'auto'
  }
});

export const GroupOrderEditorDialog: React.FunctionComponent<IGroupOrderEditorDialogProps> = ({
  groups,
  value,
  onApply,
  onOpenChange
}) => {
  const classes = useStyles();
  const [query, setQuery] = React.useState('');
  const [rows, setRows] = React.useState<readonly IGroupOrderEditorRow[]>(() =>
    mergeGroupOrder(groups, value)
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleRows = React.useMemo(
    () => rows.filter((row) => !normalizedQuery || row.label.toLocaleLowerCase().includes(normalizedQuery)),
    [normalizedQuery, rows]
  );
  const visibleKeys = React.useMemo(() => visibleRows.map((row) => row.key), [visibleRows]);

  const move = (key: string, direction: -1 | 1): void => {
    setRows((current) => moveGroupRow(current, key, direction, visibleKeys));
  };

  return (
    <Dialog modalType="modal" open onOpenChange={(_event, data) => onOpenChange(data.open)}>
      <DialogSurface className={`${classes.surface} ${betterListFluentSurfaceClassName}`}>
        <DialogBody className={classes.body}>
          <DialogTitle>Edit groups</DialogTitle>
          <DialogContent className={classes.content}>
            <Input
              aria-label="Search groups"
              className={classes.search}
              contentBefore={<SearchRegular aria-hidden="true" />}
              contentAfter={query ? (
                <Button
                  appearance="transparent"
                  aria-label="Clear group search"
                  icon={<DismissRegular />}
                  size="small"
                  onClick={() => setQuery('')}
                />
              ) : undefined}
              placeholder="Search groups"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <Text aria-live="polite" className={classes.resultSummary} size={200}>
              {normalizedQuery
                ? `${visibleRows.length} of ${rows.length} groups`
                : `${rows.length} group${rows.length === 1 ? '' : 's'}`}
            </Text>
            <div className={classes.tableFrame}>
              {visibleRows.length ? (
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th className={classes.headerCell} scope="col">Group</th>
                      <th className={`${classes.headerCell} ${classes.countCell}`} scope="col">Items</th>
                      <th className={`${classes.headerCell} ${classes.visibleCell}`} scope="col">Visible</th>
                      <th className={`${classes.headerCell} ${classes.orderCell}`} scope="col">Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, visibleIndex) => (
                      <tr className={`${classes.row} ${row.hidden ? classes.hiddenRow : ''}`} key={row.key}>
                        <td className={classes.cell}>
                          <span className={classes.groupLabel} title={row.label}>{row.label}</span>
                        </td>
                        <td className={`${classes.cell} ${classes.countCell}`}>{row.itemCount}</td>
                        <td className={`${classes.cell} ${classes.visibleCell}`}>
                          <Checkbox
                            aria-label={`${row.hidden ? 'Show' : 'Hide'} ${row.label}`}
                            checked={!row.hidden}
                            onChange={(_event, data) => {
                              setRows((current) => current.map((entry) =>
                                entry.key === row.key ? { ...entry, hidden: !Boolean(data.checked) } : entry
                              ));
                            }}
                          />
                        </td>
                        <td className={`${classes.cell} ${classes.orderCell}`}>
                          <div className={classes.orderActions}>
                            <Button
                              appearance="subtle"
                              aria-label={`Move ${row.label} up`}
                              disabled={visibleIndex === 0}
                              icon={<ArrowUpRegular />}
                              size="small"
                              onClick={() => move(row.key, -1)}
                            />
                            <Button
                              appearance="subtle"
                              aria-label={`Move ${row.label} down`}
                              disabled={visibleIndex === visibleRows.length - 1}
                              icon={<ArrowDownRegular />}
                              size="small"
                              onClick={() => move(row.key, 1)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className={classes.empty} role="status">
                  {rows.length ? `No groups match “${query}”.` : 'No groups are available for this column.'}
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions fluid>
            <Button
              appearance="subtle"
              className={classes.actionStart}
              disabled={!rows.length}
              onClick={() => setRows(mergeGroupOrder(groups, []))}
            >
              Reset order
            </Button>
            <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!rows.length}
              onClick={() => {
                onApply(rows.map((row) => row.hidden ? { key: row.key, hidden: true } : { key: row.key }));
                onOpenChange(false);
              }}
            >
              Apply
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export function mergeGroupOrder(
  groups: readonly IBetterListGroupOption[],
  value: readonly IBetterListGroupOrderEntry[]
): readonly IGroupOrderEditorRow[] {
  const groupByKey = new Map(groups.map((group) => [group.key, group]));
  const included = new Set<string>();
  const rows: IGroupOrderEditorRow[] = [];
  value.forEach((entry) => {
    const group = groupByKey.get(entry.key);
    if (!group || included.has(entry.key)) {
      return;
    }
    included.add(entry.key);
    rows.push({ ...group, hidden: entry.hidden === true });
  });
  groups.forEach((group) => {
    if (!included.has(group.key)) {
      rows.push({ ...group, hidden: false });
    }
  });
  return rows;
}

export function moveGroupRow(
  rows: readonly IGroupOrderEditorRow[],
  key: string,
  direction: -1 | 1,
  visibleKeys: readonly string[]
): readonly IGroupOrderEditorRow[] {
  const visibleIndex = visibleKeys.indexOf(key);
  const swapKey = visibleKeys[visibleIndex + direction];
  if (visibleIndex < 0 || !swapKey) {
    return rows;
  }
  const currentIndex = rows.findIndex((row) => row.key === key);
  const swapIndex = rows.findIndex((row) => row.key === swapKey);
  if (currentIndex < 0 || swapIndex < 0) {
    return rows;
  }
  const next = rows.slice();
  [next[currentIndex], next[swapIndex]] = [next[swapIndex], next[currentIndex]];
  return next;
}
