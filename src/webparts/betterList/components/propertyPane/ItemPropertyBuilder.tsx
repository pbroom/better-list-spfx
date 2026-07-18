/* eslint-disable @typescript-eslint/no-use-before-define -- The builder composes small row controls declared below it. */
import * as React from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  makeStyles,
  mergeClasses,
  tokens
} from '@fluentui/react-components';
import {
  AddRegular,
  CalendarLtrRegular,
  ChevronRightRegular,
  DismissRegular,
  ImageRegular,
  LinkRegular,
  NumberSymbolRegular,
  PersonRegular,
  ReOrderDotsVerticalRegular,
  TextDescriptionRegular,
  TextTRegular,
  ToggleRightRegular
} from '@fluentui/react-icons';

import { IBetterListFieldDescriptor } from '../../../../shared';

export interface IItemPropertyBuilderProps {
  fields: readonly IBetterListFieldDescriptor[];
  value: readonly string[];
  onChange: (value: readonly string[]) => void;
}

export interface IColumnPickerMenuProps {
  ariaLabel: string;
  fields: readonly IBetterListFieldDescriptor[];
  onSelect: (fieldPath: string) => void;
  disabledLabel?: string;
  selectedPaths?: ReadonlySet<string>;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 32px',
    alignItems: 'center',
    minHeight: '48px'
  },
  headingButton: {
    justifyContent: 'flex-start',
    minWidth: 0,
    paddingLeft: 0,
    fontSize: '14px',
    fontWeight: 600
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '20px minmax(0, 1fr) 28px',
    alignItems: 'center',
    minHeight: '40px',
    columnGap: '8px',
    color: tokens.colorNeutralForeground1
  },
  requiredRow: {
    gridTemplateColumns: '20px minmax(0, 1fr)'
  },
  sortableRow: {
    gridTemplateColumns: '20px 20px minmax(0, 1fr) 28px'
  },
  draggingRow: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8
  },
  dragHandle: {
    minWidth: '20px',
    width: '20px',
    height: '28px',
    padding: 0,
    color: tokens.colorNeutralForeground3,
    cursor: 'grab',
    touchAction: 'none',
    ':active': {
      cursor: 'grabbing'
    }
  },
  icon: {
    color: tokens.colorNeutralForeground3,
    fontSize: '18px'
  },
  label: {
    minWidth: 0,
    overflow: 'hidden',
    fontSize: '13px',
    lineHeight: '18px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  removeButton: {
    color: tokens.colorNeutralForeground3
  },
  addButton: {
    color: tokens.colorNeutralForeground1
  },
  menuPopover: {
    width: '260px',
    maxWidth: 'calc(100vw - 32px)',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16
  },
  menuIcon: {
    color: tokens.colorNeutralForeground3
  }
});

export const ItemPropertyBuilder: React.FunctionComponent<IItemPropertyBuilderProps> = ({
  fields,
  value,
  onChange
}) => {
  const classes = useStyles();
  const [expanded, setExpanded] = React.useState(true);
  const selected = React.useMemo(() => new Set(value), [value]);
  const sortableFields = React.useMemo(() => value.slice(1), [value]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const availableFields = React.useMemo(
    () =>
      fields.filter((field) => {
        if (field.internalName === 'Title') {
          return false;
        }
        if (isLookupField(field)) {
          return getLookupTargetFields(field).some(
            (targetField) => !selected.has(createLookupFieldPath(field, targetField))
          );
        }
        return !selected.has(field.internalName);
      }),
    [fields, selected]
  );

  const addField = React.useCallback(
    (fieldPath: string): void => {
      if (!selected.has(fieldPath)) {
        onChange([...value, fieldPath]);
      }
    },
    [onChange, selected, value]
  );

  const removeField = React.useCallback(
    (fieldPath: string): void => {
      onChange(value.filter((candidate) => candidate !== fieldPath));
    },
    [onChange, value]
  );

  const reorderFields = React.useCallback(
    (event: DragEndEvent): void => {
      const overId = event.over?.id;
      if (overId === undefined || event.active.id === overId) {
        return;
      }
      const activeIndex = value.indexOf(String(event.active.id));
      const overIndex = value.indexOf(String(overId));
      if (activeIndex <= 0 || overIndex <= 0) {
        return;
      }
      onChange(arrayMove([...value], activeIndex, overIndex));
    },
    [onChange, value]
  );

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Button
          appearance="transparent"
          aria-expanded={expanded}
          className={classes.headingButton}
          onClick={() => setExpanded((current) => !current)}
        >
          Item properties
        </Button>
        <ColumnPickerMenu
          ariaLabel="Add item property"
          disabledLabel="All item properties added"
          fields={availableFields}
          onSelect={addField}
          selectedPaths={selected}
        />
      </div>
      {expanded ? (
        <>
          <ItemPropertyRow
            field={findField(fields, value[0])}
            fieldPath={value[0]}
            required
          />
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragEnd={reorderFields}
          >
            <SortableContext
              items={sortableFields}
              strategy={verticalListSortingStrategy}
            >
              {sortableFields.map((fieldPath) => (
                <SortableItemPropertyRow
                  field={findField(fields, fieldPath)}
                  fieldPath={fieldPath}
                  key={fieldPath}
                  onRemove={removeField}
                />
              ))}
            </SortableContext>
          </DndContext>
        </>
      ) : null}
    </div>
  );
};

interface IItemPropertyRowProps {
  field: IBetterListFieldDescriptor | undefined;
  fieldPath: string;
  required?: boolean;
}

const ItemPropertyRow: React.FunctionComponent<IItemPropertyRowProps> = ({
  field,
  fieldPath,
  required = false
}) => {
  const classes = useStyles();
  return (
    <div
      className={mergeClasses(classes.row, required && classes.requiredRow)}
      data-item-property={fieldPath}
    >
      <span className={classes.icon} aria-hidden="true">
        {fieldPath.indexOf('.') >= 0
          ? renderFieldIcon(findLookupTargetField(field, fieldPath)?.typeAsString)
          : renderFieldIcon(field?.typeAsString)}
      </span>
      <span className={classes.label}>{getSelectedFieldLabel(field, fieldPath)}</span>
    </div>
  );
};

interface ISortableItemPropertyRowProps {
  field: IBetterListFieldDescriptor | undefined;
  fieldPath: string;
  onRemove: (fieldPath: string) => void;
}

const SortableItemPropertyRow: React.FunctionComponent<ISortableItemPropertyRowProps> = ({
  field,
  fieldPath,
  onRemove
}) => {
  const classes = useStyles();
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id: fieldPath });
  const label = getSelectedFieldLabel(field, fieldPath);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      className={mergeClasses(
        classes.row,
        classes.sortableRow,
        isDragging && classes.draggingRow
      )}
      data-item-property={fieldPath}
      ref={setNodeRef}
      style={style}
    >
      <Button
        {...attributes}
        {...listeners}
        appearance="transparent"
        aria-label={`Reorder ${label}`}
        className={classes.dragHandle}
        icon={<ReOrderDotsVerticalRegular />}
        ref={setActivatorNodeRef}
        size="small"
      />
      <span className={classes.icon} aria-hidden="true">
        {fieldPath.indexOf('.') >= 0
          ? renderFieldIcon(findLookupTargetField(field, fieldPath)?.typeAsString)
          : renderFieldIcon(field?.typeAsString)}
      </span>
      <span className={classes.label}>{label}</span>
      <Button
        appearance="subtle"
        aria-label={`Remove ${label}`}
        className={classes.removeButton}
        icon={<DismissRegular />}
        size="small"
        onClick={() => onRemove(fieldPath)}
      />
    </div>
  );
};

export function ColumnPickerMenu({
  ariaLabel,
  disabledLabel,
  fields,
  onSelect,
  selectedPaths
}: IColumnPickerMenuProps): React.ReactElement {
  const classes = useStyles();

  if (fields.length === 0) {
    return (
      <Button
        appearance="subtle"
        aria-label={disabledLabel || ariaLabel}
        className={classes.addButton}
        disabled
        icon={<AddRegular />}
        size="small"
      />
    );
  }

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          aria-label={ariaLabel}
          className={classes.addButton}
          icon={<AddRegular />}
          size="small"
        />
      </MenuTrigger>
      <MenuPopover className={classes.menuPopover}>
        <MenuList>
          {fields.map((field) =>
            isLookupField(field) ? (
              <Menu key={field.internalName}>
                <MenuTrigger disableButtonEnhancement>
                  <MenuItem>{field.title}</MenuItem>
                </MenuTrigger>
                <MenuPopover className={classes.menuPopover}>
                  <MenuList>
                    {getLookupTargetFields(field)
                      .filter(
                        (targetField) =>
                          !selectedPaths?.has(createLookupFieldPath(field, targetField))
                      )
                      .map((targetField) => (
                        <MenuItem
                          icon={
                            <span className={classes.menuIcon}>
                              {renderFieldIcon(targetField.typeAsString)}
                            </span>
                          }
                          key={targetField.internalName}
                          onClick={() =>
                            onSelect(createLookupFieldPath(field, targetField))
                          }
                        >
                          {targetField.title}
                          {targetField.internalName === (field.lookupField || 'Title')
                            ? ' (default)'
                            : ''}
                        </MenuItem>
                      ))}
                  </MenuList>
                </MenuPopover>
              </Menu>
            ) : (
              <MenuItem
                icon={
                  <span className={classes.menuIcon}>
                    {renderFieldIcon(field.typeAsString)}
                  </span>
                }
                key={field.internalName}
                onClick={() => onSelect(field.internalName)}
              >
                {field.title}
              </MenuItem>
            )
          )}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

function isLookupField(field: IBetterListFieldDescriptor): boolean {
  return field.typeAsString.toLocaleLowerCase().indexOf('lookup') >= 0;
}

function getLookupTargetFields(
  field: IBetterListFieldDescriptor
): readonly IBetterListFieldDescriptor[] {
  if (field.lookupFields && field.lookupFields.length > 0) {
    return field.lookupFields;
  }
  const internalName = field.lookupField || 'Title';
  return [{ internalName, title: internalName, typeAsString: 'Text' }];
}

function createLookupFieldPath(
  field: IBetterListFieldDescriptor,
  targetField: IBetterListFieldDescriptor
): string {
  return `${field.internalName}.${targetField.internalName}`;
}

function findField(
  fields: readonly IBetterListFieldDescriptor[],
  fieldPath: string
): IBetterListFieldDescriptor | undefined {
  const internalName = fieldPath.split('.')[0];
  return fields.find((field) => field.internalName === internalName);
}

function findLookupTargetField(
  field: IBetterListFieldDescriptor | undefined,
  fieldPath: string
): IBetterListFieldDescriptor | undefined {
  const nestedField = fieldPath.split('.')[1];
  return field?.lookupFields?.find((candidate) => candidate.internalName === nestedField);
}

function getSelectedFieldLabel(field: IBetterListFieldDescriptor | undefined, fieldPath: string): string {
  if (!field) {
    return fieldPath;
  }
  const [, nestedField] = fieldPath.split('.');
  const targetField = nestedField
    ? field.lookupFields?.find((candidate) => candidate.internalName === nestedField)
    : undefined;
  return nestedField ? `${field.title} → ${targetField?.title || nestedField}` : field.title;
}

function renderFieldIcon(typeAsString: string | undefined): React.ReactNode {
  const type = (typeAsString || 'text').toLocaleLowerCase();
  if (type.indexOf('lookup') >= 0) {
    return <ChevronRightRegular />;
  }
  if (type.indexOf('user') >= 0 || type.indexOf('person') >= 0) {
    return <PersonRegular />;
  }
  if (type.indexOf('image') >= 0 || type.indexOf('thumbnail') >= 0) {
    return <ImageRegular />;
  }
  if (type.indexOf('note') >= 0 || type.indexOf('multi') >= 0) {
    return <TextDescriptionRegular />;
  }
  if (type.indexOf('date') >= 0) {
    return <CalendarLtrRegular />;
  }
  if (type.indexOf('boolean') >= 0) {
    return <ToggleRightRegular />;
  }
  if (type.indexOf('url') >= 0 || type.indexOf('hyperlink') >= 0) {
    return <LinkRegular />;
  }
  if (
    type.indexOf('number') >= 0 ||
    type.indexOf('currency') >= 0 ||
    type.indexOf('counter') >= 0
  ) {
    return <NumberSymbolRegular />;
  }
  return <TextTRegular />;
}
