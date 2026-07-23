/* eslint-disable @typescript-eslint/no-use-before-define -- The builder composes small row controls declared below it. */
import * as React from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
  KeyboardCoordinateGetter
} from '@dnd-kit/core';
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
  MenuDivider,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Portal,
  PortalMountNodeProvider,
  makeStyles,
  mergeClasses,
  tokens,
  useFluent
} from '@fluentui/react-components';
import type { PortalProps } from '@fluentui/react-components';
import {
  AddRegular,
  CalendarLtrRegular,
  ChevronRightRegular,
  DismissRegular,
  ImageRegular,
  LinkRegular,
  NumberSymbolRegular,
  PersonRegular,
  TextDescriptionRegular,
  TextTRegular,
  ToggleRightRegular
} from '@fluentui/react-icons';

import {
  betterListFluentSurfaceClassName,
  betterListPortalMountNodeProps,
  betterListMaxItemRows,
  BetterListItemElementLinks,
  BetterListItemLayoutRows,
  createBetterListPortalPositioning,
  flattenItemLayoutRows,
  getBetterListFieldPathLabel,
  getBetterListFieldTargetFields,
  IBetterListFieldDescriptor,
  isBetterListLookupLikeField,
  normalizeItemElementLinks,
  normalizeItemLayoutRows,
  normalizeItemPropertyFields,
  removeItemLayoutRow
} from '../../../../shared';
import { PropertyPaneSection } from './PropertyPaneSection';

export interface IItemLayoutBuilderValue {
  itemProperties: readonly string[];
  rows: BetterListItemLayoutRows;
  links: BetterListItemElementLinks;
}

interface IItemLinkFieldOption {
  fieldPath: string;
  label: string;
}

export interface IItemPropertyBuilderProps {
  context?: React.ReactNode;
  fields: readonly IBetterListFieldDescriptor[];
  targetDocument?: Document;
  value: IItemLayoutBuilderValue;
  onChange: (value: IItemLayoutBuilderValue) => void;
}

export interface IColumnPickerMenuProps {
  ariaLabel: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  fields: readonly IBetterListFieldDescriptor[];
  onSelect: (fieldPath: string) => void;
  disabledLabel?: string;
  selectedPaths?: ReadonlySet<string>;
  addRowDisabled?: boolean;
  onAddRow?: () => void;
  targetDocument?: Document;
}

const itemLayoutRowIdPrefix = 'item-layout-row-';
const noItemLinkValue = '__no_item_link__';
const BetterListAuthoringDocumentContext = React.createContext<Document | undefined>(undefined);

function useBetterListAuthoringSurface(explicitDocument?: Document): {
  mountNode: PortalProps['mountNode'];
  rootPositioning: ReturnType<typeof createBetterListPortalPositioning>;
  submenuPositioning: ReturnType<typeof createBetterListPortalPositioning>;
  targetDocument: Document | undefined;
} {
  const contextDocument = React.useContext(BetterListAuthoringDocumentContext);
  const fluent = useFluent();
  const targetDocument = explicitDocument || contextDocument || fluent.targetDocument;
  return React.useMemo(
    () => ({
      // Passing the document body directly bypasses Fluent's themed portal
      // wrapper. Let Fluent create that wrapper inside PortalMountNodeProvider
      // so Menu/MenuItem token variables resolve exactly as they do upstream.
      mountNode: betterListPortalMountNodeProps,
      rootPositioning: createBetterListPortalPositioning(targetDocument),
      submenuPositioning: createBetterListPortalPositioning(targetDocument, 'submenu'),
      targetDocument
    }),
    [targetDocument]
  );
}

function isItemLayoutRowId(id: string | number): boolean {
  return String(id).startsWith(itemLayoutRowIdPrefix);
}

const useStyles = makeStyles({
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 28px 28px',
    alignItems: 'center',
    minHeight: '40px',
    columnGap: '4px',
    color: tokens.colorNeutralForeground1,
    '&:hover > [data-item-property-remove], &:focus-within > [data-item-property-remove]': {
      opacity: 1,
      pointerEvents: 'auto'
    }
  },
  draggingRow: {
    opacity: 0.2
  },
  dragSurface: {
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'stretch',
    minWidth: 0,
    cursor: 'grab',
    touchAction: 'none',
    ':active': {
      cursor: 'grabbing'
    },
    ':focus-visible': {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: '-2px'
    }
  },
  label: {
    minWidth: 0,
    overflow: 'hidden',
    fontSize: '13px',
    lineHeight: '18px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  dragOverlay: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    minHeight: '40px',
    boxSizing: 'border-box',
    paddingRight: tokens.spacingHorizontalS,
    paddingLeft: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
    boxShadow: tokens.shadow16,
    cursor: 'grabbing',
    fontSize: '13px',
    lineHeight: '18px',
    pointerEvents: 'none'
  },
  removeButton: {
    color: tokens.colorNeutralForeground3,
    width: '28px',
    minWidth: '28px',
    height: '28px',
    minHeight: '28px',
    padding: 0,
    flexShrink: 0,
    transitionDuration: '100ms',
    transitionProperty: 'opacity',
    transitionTimingFunction: 'ease-out',
    '@media (hover: hover)': {
      opacity: 0,
      pointerEvents: 'none'
    },
    '@media (prefers-reduced-motion: reduce)': {
      transitionDuration: '0ms'
    }
  },
  linkButton: {
    color: tokens.colorNeutralForeground3,
    width: '28px',
    minWidth: '28px',
    height: '28px',
    minHeight: '28px',
    padding: 0,
    flexShrink: 0
  },
  linkButtonConfigured: {
    color: tokens.colorBrandForeground1
  },
  addButton: {
    color: tokens.colorNeutralForeground1,
    width: '28px',
    minWidth: '28px',
    height: '28px',
    minHeight: '28px',
    padding: 0,
    flexShrink: 0
  },
  layoutRow: {
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalXS,
    transitionDuration: '100ms',
    transitionProperty: 'background-color, box-shadow',
    transitionTimingFunction: 'ease-out'
  },
  layoutRowHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 28px 28px',
    alignItems: 'center',
    minHeight: '32px',
    columnGap: '4px',
    '&:hover > [data-item-layout-row-remove], &:focus-within > [data-item-layout-row-remove]': {
      opacity: 1,
      pointerEvents: 'auto'
    }
  },
  layoutRowLabel: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground2,
    fontSize: '12px',
    fontWeight: 600
  },
  layoutRowRule: {
    flexGrow: 1,
    height: tokens.strokeWidthThin,
    backgroundColor: tokens.colorNeutralStroke2
  },
  layoutRowBody: {
    minHeight: '40px',
    borderRadius: tokens.borderRadiusSmall
  },
  layoutRowOver: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
    boxShadow: `inset 0 0 0 2px ${tokens.colorBrandStroke1}`
  },
  emptyRow: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '40px',
    color: tokens.colorNeutralForeground3,
    fontSize: '12px'
  },
  menuPopover: {
    maxHeight: 'min(480px, calc(100vh - 16px))',
    overflowY: 'auto',
    overscrollBehavior: 'contain'
  },
  menuIcon: {
    color: tokens.colorNeutralForeground3
  }
});

export const ItemPropertyBuilder: React.FunctionComponent<IItemPropertyBuilderProps> = ({
  context,
  fields,
  targetDocument,
  value,
  onChange
}) => {
  const classes = useStyles();
  const [activeFieldPath, setActiveFieldPath] = React.useState<string>();
  const itemProperties = React.useMemo(
    () => normalizeItemPropertyFields(value.itemProperties),
    [value.itemProperties]
  );
  const rows = React.useMemo(
    () => normalizeItemLayoutRows(value.rows, itemProperties),
    [itemProperties, value.rows]
  );
  const links = React.useMemo(
    () => normalizeItemElementLinks(value.links, itemProperties),
    [itemProperties, value.links]
  );
  const detectItemLayoutCollision = React.useCallback<CollisionDetection>(
    (args) => {
      const fieldContainers = args.droppableContainers.filter(
        (container) => !isItemLayoutRowId(container.id)
      );
      const rowContainers = args.droppableContainers.filter(
        (container) => isItemLayoutRowId(container.id)
      );
      const pointerFields = pointerWithin({ ...args, droppableContainers: fieldContainers });
      if (pointerFields.length > 0) {
        return pointerFields;
      }
      const pointerRows = pointerWithin({ ...args, droppableContainers: rowContainers });
      if (pointerRows.length > 0) {
        return pointerRows;
      }

      const fallback = closestCenter(args);
      const firstCollision = fallback[0];
      if (!firstCollision || !isItemLayoutRowId(firstCollision.id)) {
        return fallback;
      }
      const rowIndex = Number(String(firstCollision.id).replace(itemLayoutRowIdPrefix, ''));
      const rowFields = new Set(rows[rowIndex] || []);
      const refined = closestCenter({
        ...args,
        droppableContainers: fieldContainers.filter((container) =>
          rowFields.has(String(container.id))
        )
      });
      return refined.length > 0 ? refined : fallback;
    },
    [rows]
  );
  const getItemLayoutKeyboardCoordinates = React.useCallback<KeyboardCoordinateGetter>(
    (event, args) => {
      if (event.code !== 'ArrowDown' && event.code !== 'ArrowUp') {
        return sortableKeyboardCoordinates(event, args);
      }
      const activeField = String(args.context.active?.id || '');
      const sourceRowIndex = rows.findIndex((row) => row.indexOf(activeField) >= 0);
      if (sourceRowIndex < 0) {
        return sortableKeyboardCoordinates(event, args);
      }
      const sourceIndex = rows[sourceRowIndex].indexOf(activeField);
      const direction = event.code === 'ArrowDown' ? 1 : -1;
      let targetRowIndex = sourceRowIndex;
      let targetIndex = sourceIndex + direction;
      if (targetIndex < 0 || targetIndex >= rows[sourceRowIndex].length) {
        targetRowIndex += direction;
        if (targetRowIndex < 0 || targetRowIndex >= rows.length) {
          return undefined;
        }
        targetIndex = direction > 0 ? 0 : rows[targetRowIndex].length - 1;
      }
      const targetId = rows[targetRowIndex][targetIndex] ||
        `${itemLayoutRowIdPrefix}${targetRowIndex}`;
      const targetRect = args.context.droppableRects.get(targetId);
      if (!targetRect) {
        return undefined;
      }
      event.preventDefault();
      return { x: targetRect.left, y: targetRect.top };
    },
    [rows]
  );
  const selected = React.useMemo(() => new Set(itemProperties), [itemProperties]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: getItemLayoutKeyboardCoordinates })
  );
  const availableFields = React.useMemo(
    () =>
      fields.filter((field) => {
        if (isBetterListLookupLikeField(field)) {
          return getBetterListFieldTargetFields(field).some(
            (targetField) => !selected.has(createLookupFieldPath(field, targetField))
          );
        }
        return !selected.has(field.internalName);
      }),
    [fields, selected]
  );
  const linkFields = React.useMemo(() => getItemLinkFieldOptions(fields), [fields]);

  const addField = React.useCallback(
    (fieldPath: string, rowIndex = 0): void => {
      if (!selected.has(fieldPath)) {
        const nextItemProperties = normalizeItemPropertyFields([...itemProperties, fieldPath]);
        if (rows.length === 0) {
          onChange({ itemProperties: nextItemProperties, rows: [], links });
          return;
        }
        const nextRows = rows.map((row) => row.slice());
        nextRows[Math.min(rowIndex, nextRows.length - 1)].push(fieldPath);
        onChange({
          itemProperties: nextItemProperties,
          rows: normalizeItemLayoutRows(nextRows, nextItemProperties),
          links
        });
      }
    },
    [itemProperties, links, onChange, rows, selected]
  );

  const removeField = React.useCallback(
    (fieldPath: string): void => {
      const nextItemProperties = itemProperties.filter((candidate) => candidate !== fieldPath);
      const nextRows = rows.map((row) => row.filter((candidate) => candidate !== fieldPath));
      const nextLinks = { ...links };
      delete nextLinks[fieldPath];
      onChange({
        itemProperties: nextItemProperties,
        rows: normalizeItemLayoutRows(nextRows, nextItemProperties),
        links: nextLinks
      });
    },
    [itemProperties, links, onChange, rows]
  );

  const updateFieldLink = React.useCallback(
    (fieldPath: string, linkFieldPath: string): void => {
      const nextLinks = { ...links };
      if (linkFieldPath) {
        nextLinks[fieldPath] = linkFieldPath;
      } else {
        delete nextLinks[fieldPath];
      }
      onChange({ itemProperties, rows, links: nextLinks });
    },
    [itemProperties, links, onChange, rows]
  );

  const reorderFlatFields = React.useCallback(
    (event: DragEndEvent): void => {
      setActiveFieldPath(undefined);
      const overId = event.over?.id;
      if (overId === undefined || event.active.id === overId) {
        return;
      }
      const activeIndex = itemProperties.indexOf(String(event.active.id));
      const overIndex = itemProperties.indexOf(String(overId));
      if (activeIndex < 0 || overIndex < 0) {
        return;
      }
      onChange({
        itemProperties: arrayMove([...itemProperties], activeIndex, overIndex),
        rows: [],
        links
      });
    },
    [itemProperties, links, onChange]
  );

  const addRow = React.useCallback((): void => {
    if (rows.length >= betterListMaxItemRows) {
      return;
    }
    const nextRows = rows.length === 0
      ? [itemProperties.slice()]
      : [...rows.map((row) => row.slice()), []];
    onChange({ itemProperties, rows: nextRows, links });
  }, [itemProperties, links, onChange, rows]);

  const removeRow = React.useCallback(
    (rowIndex: number): void => {
      if (rowIndex < 0 || rowIndex >= rows.length) {
        return;
      }
      if (rows.length === 1) {
        onChange({ itemProperties, rows: [], links });
        return;
      }
      onChange({
        itemProperties,
        rows: removeItemLayoutRow(rows, rowIndex, itemProperties),
        links
      });
    },
    [itemProperties, links, onChange, rows]
  );

  const reorderRows = React.useCallback(
    (event: DragEndEvent): void => {
      setActiveFieldPath(undefined);
      const activeField = String(event.active.id);
      const overId = event.over?.id === undefined ? '' : String(event.over.id);
      if (!overId) {
        return;
      }
      const sourceRowIndex = rows.findIndex((row) => row.indexOf(activeField) >= 0);
      const targetRowIndex = overId.startsWith(itemLayoutRowIdPrefix)
        ? Number(overId.replace(itemLayoutRowIdPrefix, ''))
        : rows.findIndex((row) => row.indexOf(overId) >= 0);
      if (
        sourceRowIndex < 0 ||
        targetRowIndex < 0 ||
        targetRowIndex >= rows.length
      ) {
        return;
      }

      const nextRows = rows.map((row) => row.slice());
      const sourceIndex = nextRows[sourceRowIndex].indexOf(activeField);
      if (sourceRowIndex === targetRowIndex && overId !== `${itemLayoutRowIdPrefix}${targetRowIndex}`) {
        const targetIndex = nextRows[targetRowIndex].indexOf(overId);
        if (targetIndex >= 0 && targetIndex !== sourceIndex) {
          nextRows[targetRowIndex] = arrayMove(nextRows[targetRowIndex], sourceIndex, targetIndex);
        }
      } else {
        nextRows[sourceRowIndex].splice(sourceIndex, 1);
        const targetIndex = overId === `${itemLayoutRowIdPrefix}${targetRowIndex}`
          ? nextRows[targetRowIndex].length
          : Math.max(0, nextRows[targetRowIndex].indexOf(overId));
        nextRows[targetRowIndex].splice(targetIndex, 0, activeField);
      }

      onChange({
        itemProperties: normalizeItemPropertyFields(flattenItemLayoutRows(nextRows)),
        rows: normalizeItemLayoutRows(nextRows, flattenItemLayoutRows(nextRows)),
        links
      });
    },
    [links, onChange, rows]
  );
  const beginDrag = React.useCallback((event: DragStartEvent): void => {
    setActiveFieldPath(String(event.active.id));
  }, []);
  const cancelDrag = React.useCallback((): void => {
    setActiveFieldPath(undefined);
  }, []);

  return (
    <BetterListAuthoringDocumentContext.Provider value={targetDocument}>
    <PropertyPaneSection
      action={
        <ColumnPickerMenu
          addRowDisabled={rows.length >= betterListMaxItemRows}
          ariaLabel="Add item layout element"
          disabledLabel="Item layout is full"
          fields={availableFields}
          onSelect={addField}
          onAddRow={addRow}
          selectedPaths={selected}
          targetDocument={targetDocument}
        />
      }
      label="Item layout"
    >
      {context}
      {rows.length === 0 ? (
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragCancel={cancelDrag}
            onDragEnd={reorderFlatFields}
            onDragStart={beginDrag}
          >
            <SortableContext
              items={[...itemProperties]}
              strategy={verticalListSortingStrategy}
            >
              {itemProperties.length > 0 ? (
                itemProperties.map((fieldPath) => (
                  <SortableItemPropertyRow
                    field={findField(fields, fieldPath)}
                    fieldPath={fieldPath}
                    key={fieldPath}
                    linkFieldPath={links[fieldPath]}
                    linkFields={linkFields}
                    onRemove={removeField}
                    onLinkChange={updateFieldLink}
                  />
                ))
              ) : (
                <div className={classes.emptyRow}>Add an item property to begin</div>
              )}
            </SortableContext>
            <ItemPropertyDragOverlay
              field={findField(fields, activeFieldPath || '')}
              fieldPath={activeFieldPath}
            />
          </DndContext>
        ) : (
          <DndContext
            collisionDetection={detectItemLayoutCollision}
            sensors={sensors}
            onDragCancel={cancelDrag}
            onDragEnd={reorderRows}
            onDragStart={beginDrag}
          >
            {rows.map((row, rowIndex) => (
              <ItemLayoutRow
                availableFields={availableFields}
                fields={fields}
                fieldPaths={row}
                key={`row-${rowIndex}`}
                links={links}
                linkFields={linkFields}
                rowIndex={rowIndex}
                selectedPaths={selected}
                onAddField={addField}
                onRemoveField={removeField}
                onRemoveRow={removeRow}
                onLinkChange={updateFieldLink}
              />
            ))}
            <ItemPropertyDragOverlay
              field={findField(fields, activeFieldPath || '')}
              fieldPath={activeFieldPath}
            />
          </DndContext>
        )}
    </PropertyPaneSection>
    </BetterListAuthoringDocumentContext.Provider>
  );
};

const ItemPropertyDragOverlay: React.FunctionComponent<{
  field: IBetterListFieldDescriptor | undefined;
  fieldPath: string | undefined;
}> = ({ field, fieldPath }) => {
  const classes = useStyles();
  const surface = useBetterListAuthoringSurface();
  return (
    <Portal mountNode={surface.mountNode}>
      <DragOverlay adjustScale={false} dropAnimation={null} zIndex={1000000}>
        {fieldPath ? (
          <div
            aria-hidden="true"
            className={classes.dragOverlay}
            data-item-property-drag-overlay
          >
            {getSelectedFieldLabel(field, fieldPath)}
          </div>
        ) : null}
      </DragOverlay>
    </Portal>
  );
};

interface IItemLayoutRowProps {
  availableFields: readonly IBetterListFieldDescriptor[];
  fields: readonly IBetterListFieldDescriptor[];
  fieldPaths: readonly string[];
  links: BetterListItemElementLinks;
  linkFields: readonly IItemLinkFieldOption[];
  rowIndex: number;
  selectedPaths: ReadonlySet<string>;
  onAddField: (fieldPath: string, rowIndex: number) => void;
  onRemoveField: (fieldPath: string) => void;
  onRemoveRow: (rowIndex: number) => void;
  onLinkChange: (fieldPath: string, linkFieldPath: string) => void;
}

const ItemLayoutRow: React.FunctionComponent<IItemLayoutRowProps> = ({
  availableFields,
  fields,
  fieldPaths,
  links,
  linkFields,
  rowIndex,
  selectedPaths,
  onAddField,
  onRemoveField,
  onRemoveRow,
  onLinkChange
}) => {
  const classes = useStyles();
  const rowId = `${itemLayoutRowIdPrefix}${rowIndex}`;
  const { isOver, setNodeRef } = useDroppable({ id: rowId });
  const { active, over } = useDndContext();
  const dragIsOver =
    Boolean(active) &&
    (isOver || fieldPaths.indexOf(String(over?.id ?? '')) >= 0);

  return (
    <div
      aria-label={`Item layout row ${rowIndex + 1}`}
      className={mergeClasses(classes.layoutRow, dragIsOver && classes.layoutRowOver)}
      data-item-layout-row={rowIndex + 1}
      ref={setNodeRef}
    >
      <div className={classes.layoutRowHeader}>
        <span className={classes.layoutRowLabel}>
          <span>Row {rowIndex + 1}</span>
          <span aria-hidden="true" className={classes.layoutRowRule} />
        </span>
        <ColumnPickerMenu
          ariaLabel={`Add item property to row ${rowIndex + 1}`}
          disabledLabel={`All item properties added to row ${rowIndex + 1}`}
          fields={availableFields}
          onSelect={(fieldPath) => onAddField(fieldPath, rowIndex)}
          selectedPaths={selectedPaths}
        />
        <Button
          appearance="subtle"
          aria-label={`Remove row ${rowIndex + 1}`}
          className={classes.removeButton}
          data-item-layout-row-remove
          icon={<DismissRegular />}
          size="small"
          onClick={() => onRemoveRow(rowIndex)}
        />
      </div>
      <div className={classes.layoutRowBody}>
        <SortableContext
          items={[...fieldPaths]}
          strategy={verticalListSortingStrategy}
        >
          {fieldPaths.length > 0 ? (
            fieldPaths.map((fieldPath) => (
              <SortableItemPropertyRow
                field={findField(fields, fieldPath)}
                fieldPath={fieldPath}
                key={fieldPath}
                linkFieldPath={links[fieldPath]}
                linkFields={linkFields}
                onRemove={onRemoveField}
                onLinkChange={onLinkChange}
              />
            ))
          ) : (
            <div className={classes.emptyRow}>Add or drop item properties here</div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

interface ISortableItemPropertyRowProps {
  field: IBetterListFieldDescriptor | undefined;
  fieldPath: string;
  linkFieldPath?: string;
  linkFields: readonly IItemLinkFieldOption[];
  onRemove?: (fieldPath: string) => void;
  onLinkChange: (fieldPath: string, linkFieldPath: string) => void;
}

const SortableItemPropertyRow: React.FunctionComponent<ISortableItemPropertyRowProps> = ({
  field,
  fieldPath,
  linkFieldPath,
  linkFields,
  onRemove,
  onLinkChange
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
        isDragging && classes.draggingRow
      )}
      data-item-property={fieldPath}
      ref={setNodeRef}
      style={style}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${label}`}
        className={classes.dragSurface}
        ref={setActivatorNodeRef}
      >
        <span className={classes.label}>{label}</span>
      </div>
      <ItemPropertyLinkMenu
        fieldLabel={label}
        linkFieldPath={linkFieldPath}
        linkFields={linkFields}
        onChange={(nextLinkFieldPath) => onLinkChange(fieldPath, nextLinkFieldPath)}
      />
      {onRemove ? (
        <Button
          appearance="subtle"
          aria-label={`Remove ${label}`}
          className={classes.removeButton}
          data-item-property-remove
          icon={<DismissRegular />}
          size="small"
          onClick={() => onRemove(fieldPath)}
        />
      ) : null}
    </div>
  );
};

const ItemPropertyLinkMenu: React.FunctionComponent<{
  fieldLabel: string;
  linkFieldPath?: string;
  linkFields: readonly IItemLinkFieldOption[];
  onChange: (linkFieldPath: string) => void;
}> = ({ fieldLabel, linkFieldPath, linkFields, onChange }) => {
  const classes = useStyles();
  const surface = useBetterListAuthoringSurface();
  const selected = linkFields.find((option) => option.fieldPath === linkFieldPath);
  const currentLinkLabel = selected?.label || linkFieldPath;
  const ariaLabel = currentLinkLabel
    ? `Change link column for ${fieldLabel}; currently ${currentLinkLabel}`
    : `Choose link column for ${fieldLabel}`;

  return (
    <Menu
      checkedValues={{ itemLink: [linkFieldPath || noItemLinkValue] }}
      mountNode={surface.mountNode}
      positioning={surface.rootPositioning}
      onCheckedValueChange={(_event, data) => {
        const nextValue = data.checkedItems[0];
        onChange(nextValue === noItemLinkValue ? '' : nextValue || '');
      }}
    >
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          aria-label={ariaLabel}
          className={mergeClasses(
            classes.linkButton,
            linkFieldPath && classes.linkButtonConfigured
          )}
          disabled={linkFields.length === 0 && !linkFieldPath}
          icon={<LinkRegular />}
          size="small"
          title={ariaLabel}
        />
      </MenuTrigger>
      <MenuPopover className={mergeClasses(classes.menuPopover, betterListFluentSurfaceClassName)}>
        <MenuList>
          <MenuItemRadio name="itemLink" value={noItemLinkValue}>
            No link
          </MenuItemRadio>
          {linkFields.map((option) => (
            <MenuItemRadio
              key={option.fieldPath}
              name="itemLink"
              value={option.fieldPath}
            >
              {option.label}
            </MenuItemRadio>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
};

export function ColumnPickerMenu({
  ariaLabel,
  buttonRef,
  disabledLabel,
  fields,
  onSelect,
  selectedPaths,
  addRowDisabled = false,
  onAddRow,
  targetDocument
}: IColumnPickerMenuProps): React.ReactElement {
  const classes = useStyles();
  const surface = useBetterListAuthoringSurface(targetDocument);
  const rowActionAvailable = Boolean(onAddRow) && !addRowDisabled;

  if (fields.length === 0 && !rowActionAvailable) {
    return (
      <Button
        appearance="subtle"
        aria-label={disabledLabel || ariaLabel}
        ref={buttonRef}
        className={classes.addButton}
        disabled
        icon={<AddRegular />}
        size="small"
      />
    );
  }

  const menu = (
    <Menu hasIcons mountNode={surface.mountNode} positioning={surface.rootPositioning}>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          aria-label={ariaLabel}
          ref={buttonRef}
          className={classes.addButton}
          icon={<AddRegular />}
          size="small"
        />
      </MenuTrigger>
      <MenuPopover className={mergeClasses(classes.menuPopover, betterListFluentSurfaceClassName)}>
        <MenuList>
          {onAddRow ? (
            <>
              <MenuItem disabled={addRowDisabled} icon={<AddRegular />} onClick={onAddRow}>
                {addRowDisabled ? `Maximum ${betterListMaxItemRows} rows` : 'Add row'}
              </MenuItem>
              {fields.length > 0 ? <MenuDivider /> : null}
            </>
          ) : null}
          {fields.map((field) =>
            isBetterListLookupLikeField(field) ? (
              <Menu
                hasIcons
                key={field.internalName}
                mountNode={surface.mountNode}
                positioning={surface.submenuPositioning}
              >
                <MenuTrigger disableButtonEnhancement>
                  <MenuItem>{field.title}</MenuItem>
                </MenuTrigger>
                <MenuPopover className={mergeClasses(classes.menuPopover, betterListFluentSurfaceClassName)}>
                  <MenuList>
                    {getBetterListFieldTargetFields(field)
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
                          {getBetterListFieldPathLabel(
                            field,
                            createLookupFieldPath(field, targetField)
                          )}
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

  return surface.targetDocument ? (
    <PortalMountNodeProvider value={surface.targetDocument.body}>
      {menu}
    </PortalMountNodeProvider>
  ) : menu;
}

function createLookupFieldPath(
  field: IBetterListFieldDescriptor,
  targetField: IBetterListFieldDescriptor
): string {
  return `${field.internalName}/${targetField.internalName}`;
}

function getItemLinkFieldOptions(
  fields: readonly IBetterListFieldDescriptor[]
): readonly IItemLinkFieldOption[] {
  return fields.reduce<IItemLinkFieldOption[]>((result, field) => {
    if (isBetterListLookupLikeField(field)) {
      getBetterListFieldTargetFields(field)
        .filter((targetField) => isHyperlinkField(targetField))
        .forEach((targetField) => {
          result.push({
            fieldPath: createLookupFieldPath(field, targetField),
            label: getBetterListFieldPathLabel(field, createLookupFieldPath(field, targetField))
          });
        });
    } else if (isHyperlinkField(field)) {
      result.push({ fieldPath: field.internalName, label: field.title });
    }
    return result;
  }, []);
}

function isHyperlinkField(field: IBetterListFieldDescriptor): boolean {
  const type = field.typeAsString.toLocaleLowerCase();
  return type.indexOf('url') >= 0 || type.indexOf('hyperlink') >= 0;
}

function findField(
  fields: readonly IBetterListFieldDescriptor[],
  fieldPath: string
): IBetterListFieldDescriptor | undefined {
  const internalName = fieldPath.split(/[/.]/)[0];
  return fields.find((field) => field.internalName === internalName);
}

function getSelectedFieldLabel(field: IBetterListFieldDescriptor | undefined, fieldPath: string): string {
  if (!field) {
    return fieldPath;
  }
  const [, nestedField] = fieldPath.split(/[/.]/);
  return nestedField ? getBetterListFieldPathLabel(field, fieldPath) : field.title;
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
