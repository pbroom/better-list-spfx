/* eslint-disable @typescript-eslint/no-use-before-define -- The compact editor composes helpers declared after the main form. */
import * as React from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Portal,
  Switch,
  tokens
} from '@fluentui/react-components';
import { AddRegular, DismissRegular } from '@fluentui/react-icons';

import {
  BetterListComparableValue,
  BetterListFieldMapping,
  BetterListFieldKind,
  BetterListFieldSlot,
  BetterListGroupIconOverride,
  BetterListTabIcon,
  BetterListFilter,
  IBetterListQueryField,
  IBetterListQuerySuggestion,
  IBetterListTabConfig
} from '../../../../shared';
import {
  collectBetterListQueryFields,
  filterQueryFieldName,
  getBetterListQuerySuggestions,
  parseBetterListFilterQuery
} from '../../../../shared/filterQuery';
import { BetterListIconVisual } from '../GroupIconCatalog';
import type { ISharePointImageAssetProvider } from '../../services';

const IconPickerDialog = React.lazy(async () => {
  const module = await import(/* webpackChunkName: 'better-list-group-icon-picker' */ '../GroupIconPickerDialog');
  return { default: module.IconPickerDialog };
});

export interface IBetterListTabFilterField {
  id: string;
  kind: BetterListFieldKind;
  label: string;
  key?: BetterListFieldSlot;
  mapping?: BetterListFieldMapping;
  fieldPath?: string;
}

export interface ITabBuilderProps {
  fields: readonly IBetterListTabFilterField[];
  imageAssetProvider?: ISharePointImageAssetProvider;
  selectedTabId?: string;
  showAddAction?: boolean;
  tabs: readonly IBetterListTabConfig[];
  onChange: (tabs: readonly IBetterListTabConfig[]) => void;
  onSelectedTabChange?: (tabId: string) => void;
}

const reorderInstructions = 'Drag to reorder. For keyboard sorting, focus this row and press Space.';

export const TabBuilder: React.FunctionComponent<ITabBuilderProps> = ({
  fields,
  imageAssetProvider,
  selectedTabId,
  showAddAction = true,
  tabs,
  onChange,
  onSelectedTabChange
}) => {
  const [closedTabIds, setClosedTabIds] = React.useState<ReadonlySet<string>>(() => new Set<string>());
  const [activeTabId, setActiveTabId] = React.useState<string>();
  const [iconPickerTabId, setIconPickerTabId] = React.useState<string>();
  const keyboardSortingRef = React.useRef(false);
  const openTabIds = tabs.filter((tab) => !closedTabIds.has(tab.id)).map((tab) => tab.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: tabSortKeyboardCodes,
      onActivation: () => {
        keyboardSortingRef.current = true;
      }
    })
  );

  React.useEffect(() => {
    if (!selectedTabId) {
      return;
    }
    setClosedTabIds((current) => {
      if (!current.has(selectedTabId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(selectedTabId);
      return next;
    });
  }, [selectedTabId]);

  const patchTab = (index: number, patch: Partial<IBetterListTabConfig>): void => {
    onChange(tabs.map((tab, candidateIndex) => (candidateIndex === index ? { ...tab, ...patch } : tab)));
  };

  const addTab = (): void => {
    const nextTabs = appendNewTab(tabs);
    onChange(nextTabs);
    const addedTab = nextTabs[nextTabs.length - 1];
    if (addedTab) {
      onSelectedTabChange?.(addedTab.id);
    }
  };

  const removeTab = (index: number): void => {
    if (tabs.length <= 1) {
      return;
    }
    const removedTab = tabs[index];
    const nextTabs = tabs.filter((_tab, candidateIndex) => candidateIndex !== index);
    onChange(nextTabs);
    if (removedTab?.id === selectedTabId) {
      const nextSelectedTab = nextTabs[Math.min(index, nextTabs.length - 1)];
      if (nextSelectedTab) {
        onSelectedTabChange?.(nextSelectedTab.id);
      }
    }
  };

  const beginDrag = (event: DragStartEvent): void => {
    setActiveTabId(String(event.active.id));
  };

  const cancelDrag = (): void => {
    setActiveTabId(undefined);
    deferKeyboardSortingReset(keyboardSortingRef);
  };

  const finishDrag = (event: DragEndEvent): void => {
    setActiveTabId(undefined);
    deferKeyboardSortingReset(keyboardSortingRef);
    const overId = event.over?.id;
    if (overId === undefined || event.active.id === overId) {
      return;
    }
    const next = reorderTabsById(tabs, String(event.active.id), String(overId));
    if (next !== tabs) {
      onChange(next);
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const activeTabIndex = activeTab ? tabs.indexOf(activeTab) : -1;

  return (
    <div className="bl-tabs-builder">
      <style>{tabBuilderCss}</style>
      {showAddAction ? (
        <div className="bl-tabs-builder__heading">
          <Button
            appearance="subtle"
            aria-label="Add tab"
            className="bl-tabs-builder__add"
            icon={<AddRegular />}
            size="small"
            onClick={addTab}
          />
        </div>
      ) : null}
      <DndContext
        collisionDetection={closestCenter}
        sensors={sensors}
        onDragCancel={cancelDrag}
        onDragEnd={finishDrag}
        onDragStart={beginDrag}
      >
        <SortableContext items={tabs.map((tab) => tab.id)} strategy={verticalListSortingStrategy}>
          <Accordion<string>
            collapsible
            multiple
            openItems={openTabIds}
            onToggle={(_event, data) => {
              if (!shouldToggleTabAccordion(keyboardSortingRef.current)) {
                return;
              }
              const nextOpenTabIds = new Set(data.openItems);
              setClosedTabIds(new Set(tabs.filter((tab) => !nextOpenTabIds.has(tab.id)).map((tab) => tab.id)));
              const newlyOpened = data.openItems.find((tabId) => closedTabIds.has(tabId));
              if (newlyOpened) {
                onSelectedTabChange?.(newlyOpened);
              }
            }}
          >
            {tabs.map((tab, index) => {
              const queryFields = fields.map(toQueryField);
              const expression = filterExpression(tab.filter, fields);
              const headerId = `tab-${safeId(tab.id)}-header`;
              const panelId = `tab-${safeId(tab.id)}-panel`;
              const open = !closedTabIds.has(tab.id);
              return (
                <SortableTabCard
                  headerId={headerId}
                  index={index}
                  key={tab.id}
                  panelId={panelId}
                  selected={tab.id === selectedTabId}
                  tab={tab}
                  tabsLength={tabs.length}
                  onSelect={() => onSelectedTabChange?.(tab.id)}
                  onRemove={() => removeTab(index)}
                >
                  {open ? (
                    <AccordionPanel aria-labelledby={headerId} className="bl-tabs-builder__card-body" id={panelId}>
                      <TabNameField value={tab.label} onCommit={(label) => patchTab(index, { label })} />

                      <div className="bl-tabs-builder__grid">
                        <div className="bl-tabs-builder__field">
                          <span>Icon</span>
                          <Button
                            appearance="secondary"
                            className="bl-tabs-builder__icon-picker"
                            icon={renderTabIcon(tab.tabIconOverride, tab.tabIcon)}
                            onClick={() => setIconPickerTabId(tab.id)}
                          >
                            {tabIconLabel(tab.tabIconOverride, tab.tabIcon)}
                          </Button>
                        </div>
                        <label className="bl-tabs-builder__field">
                          <span>Maximum items</span>
                          <input
                            min={1}
                            placeholder="No limit"
                            type="number"
                            value={tab.maxItems ?? ''}
                            onChange={(event) => {
                              const value = event.currentTarget.valueAsNumber;
                              patchTab(index, {
                                maxItems: Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
                              });
                            }}
                          />
                        </label>
                      </div>

                      <Switch
                        checked={tab.showItemCount === true}
                        className="bl-tabs-builder__switch"
                        label="Show item count"
                        onChange={(_event, data) => patchTab(index, { showItemCount: data.checked })}
                      />

                      <FilterQueryEditor
                        expression={expression}
                        fields={queryFields}
                        id={`tab-filter-${safeId(tab.id)}`}
                        onChange={(nextExpression) => {
                          const trimmed = nextExpression.trim();
                          patchTab(index, {
                            filter: trimmed
                              ? {
                                  kind: 'query',
                                  expression: nextExpression,
                                  fields: collectBetterListQueryFields(nextExpression, queryFields)
                                }
                              : { kind: 'all' }
                          });
                        }}
                      />
                    </AccordionPanel>
                  ) : null}
                </SortableTabCard>
              );
            })}
          </Accordion>
        </SortableContext>
        {activeTab ? (
          <Portal>
            <DragOverlay adjustScale={false} dropAnimation={null} zIndex={1000000}>
              <div aria-hidden="true" className="bl-tabs-builder__drag-overlay" data-tab-drag-overlay>
                Tab {activeTabIndex + 1}: {activeTab.label}
              </div>
            </DragOverlay>
          </Portal>
        ) : null}
      </DndContext>
      {iconPickerTabId ? (
        <React.Suspense fallback={null}>
          <IconPickerDialog
            current={tabIconOverride(tabs.find((tab) => tab.id === iconPickerTabId))}
            groupTitle={tabs.find((tab) => tab.id === iconPickerTabId)?.label || 'tab'}
            imageAssetProvider={imageAssetProvider}
            open
            showAutomaticAction={false}
            onApply={(override) => {
              onChange(
                tabs.map((tab) =>
                  tab.id === iconPickerTabId ? { ...tab, tabIcon: undefined, tabIconOverride: override } : tab
                )
              );
            }}
            onOpenChange={(open) => {
              if (!open) setIconPickerTabId(undefined);
            }}
          />
        </React.Suspense>
      ) : null}
    </div>
  );
};

const legacyTabIconOverrides: Record<BetterListTabIcon, BetterListGroupIconOverride> = {
  list: { kind: 'icon', library: 'fluent', name: 'apps-list-detail' },
  communications: { kind: 'icon', library: 'fluent', name: 'megaphone' },
  policy: { kind: 'icon', library: 'fluent', name: 'document-text' },
  support: { kind: 'icon', library: 'fluent', name: 'headset' }
};

function tabIconOverride(tab: IBetterListTabConfig | undefined): BetterListGroupIconOverride | undefined {
  return tab?.tabIconOverride || (tab?.tabIcon ? legacyTabIconOverrides[tab.tabIcon] : undefined);
}

function renderTabIcon(
  override: BetterListGroupIconOverride | undefined,
  legacy?: BetterListTabIcon
): React.ReactElement {
  const current = override || (legacy ? legacyTabIconOverrides[legacy] : undefined);
  return current && current.kind !== 'none' ? (
    <BetterListIconVisual override={current} />
  ) : (
    <DismissRegular aria-hidden="true" />
  );
}

function tabIconLabel(override: BetterListGroupIconOverride | undefined, legacy?: BetterListTabIcon): string {
  const current = override || (legacy ? legacyTabIconOverrides[legacy] : undefined);
  if (!current || current.kind === 'none') return 'No icon';
  if (current.kind === 'image') return 'Image';
  return current.name
    .replace(/-(?:20|24|32)-(?:regular|filled)$/i, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface ISortableTabCardProps {
  children?: React.ReactNode;
  headerId: string;
  index: number;
  panelId: string;
  selected: boolean;
  tab: IBetterListTabConfig;
  tabsLength: number;
  onSelect: () => void;
  onRemove: () => void;
}

const SortableTabCard: React.FunctionComponent<ISortableTabCardProps> = ({
  children,
  headerId,
  index,
  panelId,
  selected,
  tab,
  tabsLength,
  onSelect,
  onRemove
}) => {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({
    id: tab.id
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const reorderHelpId = `${headerId}-reorder-help`;
  return (
    <AccordionItem
      className={`bl-tabs-builder__card${isDragging ? ' is-dragging' : ''}`}
      data-tab-selected={selected || undefined}
      data-tab-sortable={tab.id}
      onFocusCapture={onSelect}
      onPointerDown={onSelect}
      ref={setNodeRef}
      style={style}
      value={tab.id}
    >
      <div className="bl-tabs-builder__card-heading">
        <span className="bl-tabs-builder__sr-only" id={reorderHelpId}>
          {reorderInstructions}
        </span>
        <AccordionHeader
          as="h4"
          button={
            {
              ...attributes,
              ...listeners,
              'aria-controls': panelId,
              'aria-describedby': reorderHelpId,
              'aria-label': `Tab ${index + 1}: ${tab.label}. ${reorderInstructions}`,
              className: 'bl-tabs-builder__accordion-button',
              id: headerId,
              ref: setActivatorNodeRef
            } as unknown as NonNullable<React.ComponentProps<typeof AccordionHeader>['button']>
          }
          className="bl-tabs-builder__accordion-header"
          expandIconPosition="start"
          size="small"
        >
          <strong>Tab {index + 1}</strong>
        </AccordionHeader>
        <div aria-label={`Actions for ${tab.label}`} className="bl-tabs-builder__actions" role="group">
          <Button
            appearance="subtle"
            aria-label={`Remove ${tab.label}`}
            className="bl-tabs-builder__remove"
            data-tab-remove
            disabled={tabsLength <= 1}
            icon={<DismissRegular />}
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
      </div>
      {children}
    </AccordionItem>
  );
};

export const TabNameField: React.FunctionComponent<{
  value: string;
  onCommit: (value: string) => void;
}> = ({ value, onCommit }) => {
  const [draft, setDraft] = React.useState(value);
  const cancelBlur = React.useRef(false);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (): void => {
    if (cancelBlur.current) {
      cancelBlur.current = false;
      return;
    }
    const resolved = resolveTabNameDraft(draft, value);
    if (resolved.commit) {
      onCommit(resolved.commit);
    }
    if (resolved.draft !== draft) {
      setDraft(resolved.draft);
    }
  };

  return (
    <label className="bl-tabs-builder__field">
      <span>Name</span>
      <input
        required
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelBlur.current = true;
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
};

export const resolveTabNameDraft = (
  draft: string,
  currentValue: string
): { readonly draft: string; readonly commit?: string } => {
  const next = draft.trim();
  if (!next) {
    return { draft: currentValue };
  }
  return next === currentValue ? { draft: next } : { draft: next, commit: next };
};

export const FilterQueryEditor: React.FunctionComponent<{
  expression: string;
  fields: readonly IBetterListQueryField[];
  id: string;
  onChange: (expression: string) => void;
}> = ({ expression, fields, id, onChange }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [draft, setDraft] = React.useState(expression);
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(expression.length);
  const [activeIndex, setActiveIndex] = React.useState(0);
  React.useEffect(() => {
    setDraft(expression);
  }, [expression]);
  const suggestions = React.useMemo(
    () => getBetterListQuerySuggestions(draft, Math.min(cursor, draft.length), fields),
    [cursor, draft, fields]
  );
  const parsed = draft.trim() ? parseBetterListFilterQuery(draft, fields) : {};
  const diagnostic = parsed.diagnostic;
  const listboxId = `${id}-suggestions`;
  const helpId = `${id}-help`;
  const showSuggestions = open && suggestions.length > 0 && fields.length > 0;
  const helpText =
    fields.length === 0
      ? 'Map a list column before adding a filter.'
      : diagnostic
        ? diagnostic.message
        : draft.trim()
          ? 'Use AND, OR, NOT, and parentheses to combine conditions.'
          : '';

  const updateCursor = (input: HTMLInputElement): void => {
    setCursor(input.selectionStart ?? input.value.length);
    setActiveIndex(0);
  };

  const applySuggestion = (suggestion: IBetterListQuerySuggestion): void => {
    const next = `${draft.slice(0, suggestion.replaceStart)}${suggestion.insertText}${draft.slice(suggestion.replaceEnd)}`;
    const nextCursor = suggestion.replaceStart + suggestion.insertText.length;
    updateDraft(next);
    setCursor(nextCursor);
    setActiveIndex(0);
    setOpen(true);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const updateDraft = (next: string): void => {
    setDraft(next);
    if (!next.trim() || !parseBetterListFilterQuery(next, fields).diagnostic) {
      onChange(next);
    }
  };

  return (
    <fieldset className="bl-tabs-builder__filter">
      <legend>Filter items</legend>
      <div className="bl-query-editor">
        <label className="bl-tabs-builder__field" htmlFor={id}>
          <span className="bl-query-editor__sr-only">Filter items</span>
          <input
            aria-activedescendant={showSuggestions ? `${listboxId}-${activeIndex}` : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-describedby={helpText ? helpId : undefined}
            aria-expanded={showSuggestions}
            aria-invalid={Boolean(diagnostic)}
            autoComplete="off"
            id={id}
            placeholder="All items"
            ref={inputRef}
            role="combobox"
            spellCheck={false}
            value={draft}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              updateDraft(event.currentTarget.value);
              updateCursor(event.currentTarget);
              setOpen(true);
            }}
            onClick={(event) => {
              updateCursor(event.currentTarget);
              setOpen(true);
            }}
            onFocus={(event) => {
              updateCursor(event.currentTarget);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                return;
              }
              if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length > 0) {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((current) =>
                  event.key === 'ArrowDown'
                    ? (current + 1) % suggestions.length
                    : (current - 1 + suggestions.length) % suggestions.length
                );
                return;
              }
              if ((event.key === 'Enter' || event.key === 'Tab') && showSuggestions) {
                event.preventDefault();
                applySuggestion(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
              }
            }}
            onKeyUp={(event) => {
              if (
                event.key !== 'ArrowDown' &&
                event.key !== 'ArrowUp' &&
                event.key !== 'Enter' &&
                event.key !== 'Tab' &&
                event.key !== 'Escape'
              ) {
                updateCursor(event.currentTarget);
              }
            }}
          />
        </label>
        {showSuggestions ? (
          <ul className="bl-query-editor__suggestions" id={listboxId} role="listbox">
            {suggestions.map((suggestion, suggestionIndex) => (
              <li
                aria-selected={suggestionIndex === activeIndex}
                className={suggestionIndex === activeIndex ? 'is-active' : undefined}
                id={`${listboxId}-${suggestionIndex}`}
                key={suggestion.id}
                role="option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySuggestion(suggestion);
                }}
              >
                <span>{suggestion.label}</span>
                <small>{suggestion.detail}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {helpText ? (
        <div
          aria-atomic="true"
          aria-live="polite"
          className={diagnostic ? 'bl-query-editor__help is-error' : 'bl-query-editor__help'}
          id={helpId}
        >
          {helpText}
        </div>
      ) : null}
      <span aria-live="polite" className="bl-query-editor__sr-only">
        {showSuggestions ? `${suggestions.length} suggestions available.` : ''}
      </span>
    </fieldset>
  );
};

function toQueryField(field: IBetterListTabFilterField): IBetterListQueryField {
  return {
    name: field.label,
    kind: field.kind,
    field: field.key,
    fieldPath: field.fieldPath,
    mapping: field.mapping
  };
}

export function filterExpression(filter: BetterListFilter, fields: readonly IBetterListTabFilterField[]): string {
  if (filter.kind === 'all') {
    return '';
  }
  if (filter.kind === 'query') {
    return filter.expression;
  }
  const field = fields.find((candidate) =>
    filter.kind === 'equals' ? candidate.key === filter.field : candidate.fieldPath === filter.fieldPath
  );
  const queryField: IBetterListQueryField = field
    ? toQueryField(field)
    : filter.kind === 'equals'
      ? {
          name: filter.field,
          kind: typeof filter.value === 'boolean' ? 'boolean' : typeof filter.value === 'number' ? 'number' : 'text',
          field: filter.field
        }
      : {
          name: filter.fieldPath,
          kind: filter.mapping.kind,
          fieldPath: filter.fieldPath,
          mapping: filter.mapping
        };
  return `${filterQueryFieldName(queryField)} = ${filterValueText(filter.value)}`;
}

function filterValueText(value: BetterListComparableValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return String(value);
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

const tabBuilderCss = `
.bl-tabs-builder { color: #242424; container-type: inline-size; font: 12px/1.4 "Segoe UI", sans-serif; }
.bl-tabs-builder *, .bl-tabs-builder *::before, .bl-tabs-builder *::after { box-sizing: border-box; }
.bl-tabs-builder__heading, .bl-tabs-builder__actions { align-items: center; display: flex; }
.bl-tabs-builder__heading { justify-content: flex-end; }
.bl-tabs-builder__card-heading { align-items: center; display: grid; grid-template-columns: minmax(0, 1fr) auto; }
.bl-tabs-builder__heading { color: #616161; margin-bottom: 8px; }
.bl-tabs-builder__card { background: transparent; border: 0; border-radius: 0; margin: 0 0 4px; padding: 0; position: relative; }
.bl-tabs-builder__card:focus-within { z-index: 2; }
.bl-tabs-builder__card[data-tab-selected="true"] > .bl-tabs-builder__card-heading { background: ${tokens.colorNeutralBackground1Hover}; }
.bl-tabs-builder__card.is-dragging { opacity: .35; }
.bl-tabs-builder__card-heading { border-bottom: 0; min-height: 38px; }
.bl-tabs-builder__card-heading:hover > .bl-tabs-builder__actions [data-tab-remove], .bl-tabs-builder__card-heading:focus-within > .bl-tabs-builder__actions [data-tab-remove] { opacity: 1; pointer-events: auto; }
.bl-tabs-builder__card-body { padding: 8px 0 6px; }
.bl-tabs-builder__accordion-header { margin: 0; min-width: 0; }
.bl-tabs-builder__accordion-button { cursor: grab; justify-content: flex-start !important; padding-left: 0 !important; touch-action: none; width: 100%; }
.bl-tabs-builder__accordion-button:active { cursor: grabbing; }
.bl-tabs-builder__drag-overlay { background: ${tokens.colorNeutralBackground1}; border: 1px solid ${tokens.colorNeutralStroke2}; border-radius: ${tokens.borderRadiusMedium}; box-shadow: ${tokens.shadow16}; color: ${tokens.colorNeutralForeground1}; font: 600 12px/1.4 "Segoe UI", sans-serif; min-width: 180px; padding: 10px 12px; }
.bl-tabs-builder__actions { gap: 2px; }
.bl-tabs-builder__sr-only { clip: rect(0, 0, 0, 0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px; }
.bl-tabs-builder .bl-tabs-builder__remove { color: ${tokens.colorNeutralForeground3}; height: 28px; min-height: 28px; min-width: 28px; padding: 0; transition: opacity 100ms ease-out; width: 28px; }
.bl-tabs-builder__field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.bl-tabs-builder__field > span, .bl-tabs-builder__filter legend { color: #424242; font-weight: 600; }
.bl-tabs-builder .bl-tabs-builder__icon-picker { justify-content: flex-start; min-height: 32px; width: 100%; }
.bl-tabs-builder .bl-tabs-builder__icon-picker svg, .bl-tabs-builder .bl-tabs-builder__icon-picker img { height: 20px; object-fit: contain; width: 20px; }
.bl-tabs-builder input:not([type="checkbox"]), .bl-tabs-builder select { background: #fff; border: 1px solid #8a8886; border-radius: 4px; color: #242424; font: inherit; min-height: 32px; padding: 5px 8px; width: 100%; }
.bl-tabs-builder input:focus, .bl-tabs-builder select:focus { outline: 2px solid #0f6cbd; outline-offset: 1px; }
.bl-tabs-builder__grid { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin-top: 8px; }
.bl-tabs-builder__switch { margin: 10px 0; }
.bl-tabs-builder__filter { border: 0; border-top: 1px solid #e0e0e0; margin: 10px 0 0; padding: 10px 0 0; }
.bl-tabs-builder__filter legend { padding: 0 6px 0 0; }
.bl-query-editor { position: relative; }
.bl-query-editor input { font-family: var(--bl-font-mono, "Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace) !important; }
.bl-query-editor__label { margin-bottom: 1px; }
.bl-query-editor__suggestions { background: #fff; border: 1px solid #d1d1d1; border-radius: 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, .18); left: 0; list-style: none; margin: 3px 0 0; max-height: 176px; overflow: auto; padding: 3px; position: absolute; right: 0; top: 100%; z-index: 40; }
.bl-query-editor__suggestions li { align-items: center; border-radius: 3px; cursor: pointer; display: flex; gap: 8px; justify-content: space-between; min-height: 30px; padding: 5px 7px; }
.bl-query-editor__suggestions li.is-active { background: #ebf3fc; color: #0f548c; }
.bl-query-editor__suggestions small { color: #616161; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bl-query-editor__help { color: #616161; line-height: 1.3; margin-top: 5px; }
.bl-query-editor__help.is-error { color: #a4262c; }
.bl-query-editor__sr-only { height: 1px; margin: -1px; overflow: hidden; position: absolute; width: 1px; clip: rect(0, 0, 0, 0); }
@media (forced-colors: active) { .bl-query-editor__suggestions, .bl-query-editor__suggestions li.is-active { outline: 1px solid CanvasText; } }
@media (hover: hover) { .bl-tabs-builder .bl-tabs-builder__remove { opacity: 0; pointer-events: none; } }
@media (prefers-reduced-motion: reduce) { .bl-tabs-builder .bl-tabs-builder__remove { transition-duration: 0ms; } }
@container (max-width: 260px) { .bl-tabs-builder__grid { grid-template-columns: minmax(0, 1fr); } }
`;

export const tabSortKeyboardCodes = {
  start: ['Space'],
  cancel: ['Escape'],
  end: ['Space']
};

export function shouldToggleTabAccordion(keyboardSorting: boolean): boolean {
  return !keyboardSorting;
}

function deferKeyboardSortingReset(ref: React.MutableRefObject<boolean>): void {
  window.setTimeout(() => {
    ref.current = false;
  }, 0);
}

export function appendNewTab(tabs: readonly IBetterListTabConfig[]): readonly IBetterListTabConfig[] {
  return [
    ...tabs,
    {
      id: createUniqueTabId(tabs),
      label: `Tab ${tabs.length + 1}`,
      filter: { kind: 'all' },
      icon: { mode: 'none' }
    }
  ];
}

export function reorderTabsById(
  tabs: readonly IBetterListTabConfig[],
  activeId: string,
  overId: string
): readonly IBetterListTabConfig[] {
  const activeIndex = tabs.findIndex((tab) => tab.id === activeId);
  const overIndex = tabs.findIndex((tab) => tab.id === overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return tabs;
  }
  return arrayMove([...tabs], activeIndex, overIndex);
}

function createUniqueTabId(tabs: readonly IBetterListTabConfig[]): string {
  const used = new Set(tabs.map((tab) => tab.id.toLocaleLowerCase()));
  let index = tabs.length + 1;
  while (used.has(`tab-${index}`)) {
    index += 1;
  }
  return `tab-${index}`;
}
