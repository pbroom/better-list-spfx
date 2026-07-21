/* eslint-disable @typescript-eslint/no-use-before-define -- The compact editor composes helpers declared after the main form. */
import * as React from 'react';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel } from '@fluentui/react-components';

import {
  BetterListComparableValue,
  BetterListFieldMapping,
  BetterListFieldKind,
  BetterListFieldSlot,
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
  showAddAction?: boolean;
  tabs: readonly IBetterListTabConfig[];
  onChange: (tabs: readonly IBetterListTabConfig[]) => void;
}

const ICON_OPTIONS: readonly { value: BetterListTabIcon; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'communications', label: 'Communications' },
  { value: 'policy', label: 'Document' },
  { value: 'support', label: 'Support' }
];

export const TabBuilder: React.FunctionComponent<ITabBuilderProps> = ({ fields, showAddAction = true, tabs, onChange }) => {
  const [closedTabIds, setClosedTabIds] = React.useState<ReadonlySet<string>>(() => new Set<string>());
  const openTabIds = tabs.filter((tab) => !closedTabIds.has(tab.id)).map((tab) => tab.id);

  const patchTab = (index: number, patch: Partial<IBetterListTabConfig>): void => {
    onChange(tabs.map((tab, candidateIndex) => (candidateIndex === index ? { ...tab, ...patch } : tab)));
  };

  const addTab = (): void => {
    onChange(appendNewTab(tabs));
  };

  const removeTab = (index: number): void => {
    if (tabs.length <= 1) {
      return;
    }
    onChange(tabs.filter((_tab, candidateIndex) => candidateIndex !== index));
  };

  const moveTab = (index: number, offset: -1 | 1): void => {
    const destination = index + offset;
    if (destination < 0 || destination >= tabs.length) {
      return;
    }
    const next = tabs.slice();
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  };

  return (
    <div className="bl-tabs-builder">
      <style>{tabBuilderCss}</style>
      {showAddAction ? (
        <div className="bl-tabs-builder__heading">
          <button aria-label="Add tab" className="bl-tabs-builder__add" type="button" onClick={addTab}>
            + Add tab
          </button>
        </div>
      ) : null}
      <Accordion<string>
        collapsible
        multiple
        openItems={openTabIds}
        onToggle={(_event, data) => {
          const nextOpenTabIds = new Set(data.openItems);
          setClosedTabIds(new Set(tabs.filter((tab) => !nextOpenTabIds.has(tab.id)).map((tab) => tab.id)));
        }}
      >
        {tabs.map((tab, index) => {
          const queryFields = fields.map(toQueryField);
          const expression = filterExpression(tab.filter, fields);
          const headerId = `tab-${safeId(tab.id)}-header`;
          const panelId = `tab-${safeId(tab.id)}-panel`;
          const open = !closedTabIds.has(tab.id);
          return (
            <AccordionItem className="bl-tabs-builder__card" key={tab.id} value={tab.id}>
              <div className="bl-tabs-builder__card-heading">
                <AccordionHeader
                  as="h4"
                  button={{ 'aria-controls': panelId, className: 'bl-tabs-builder__accordion-button', id: headerId }}
                  className="bl-tabs-builder__accordion-header"
                  expandIconPosition="start"
                  size="small"
                >
                  <strong>Tab {index + 1}</strong>
                </AccordionHeader>
                <div aria-label={`Actions for ${tab.label}`} className="bl-tabs-builder__actions" role="group">
                  <button aria-label={`Move ${tab.label} up`} disabled={index === 0} type="button" onClick={() => moveTab(index, -1)}>
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${tab.label} down`}
                    disabled={index === tabs.length - 1}
                    type="button"
                    onClick={() => moveTab(index, 1)}
                  >
                    ↓
                  </button>
                  <button aria-label={`Remove ${tab.label}`} disabled={tabs.length <= 1} type="button" onClick={() => removeTab(index)}>
                    ×
                  </button>
                </div>
              </div>

              {open ? (
                <AccordionPanel aria-labelledby={headerId} className="bl-tabs-builder__card-body" id={panelId}>
                  <label className="bl-tabs-builder__field">
                    <span>Name</span>
                    <input
                      required
                      value={tab.label}
                      onChange={(event) => {
                        if (event.currentTarget.value.trim()) {
                          patchTab(index, { label: event.currentTarget.value });
                        }
                      }}
                    />
                  </label>

                  <div className="bl-tabs-builder__grid">
                    <label className="bl-tabs-builder__field">
                      <span>Icon</span>
                      <select
                        value={tab.tabIcon || ''}
                        onChange={(event) => patchTab(index, { tabIcon: (event.currentTarget.value || undefined) as BetterListTabIcon | undefined })}
                      >
                        <option value="">No icon</option>
                        {ICON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="bl-tabs-builder__field">
                      <span>Maximum items</span>
                      <input
                        min={1}
                        placeholder="No limit"
                        type="number"
                        value={tab.maxItems ?? ''}
                        onChange={(event) => {
                          const value = event.currentTarget.valueAsNumber;
                          patchTab(index, { maxItems: Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined });
                        }}
                      />
                    </label>
                  </div>

                  <label className="bl-tabs-builder__check">
                    <input
                      checked={tab.showItemCount === true}
                      type="checkbox"
                      onChange={(event) => patchTab(index, { showItemCount: event.currentTarget.checked })}
                    />
                    <span>Show item count</span>
                  </label>

                  <FilterQueryEditor
                    expression={expression}
                    fields={queryFields}
                    id={`tab-filter-${safeId(tab.id)}`}
                    onChange={(nextExpression) => {
                      const trimmed = nextExpression.trim();
                      patchTab(index, {
                        filter: trimmed
                          ? { kind: 'query', expression: nextExpression, fields: collectBetterListQueryFields(nextExpression, queryFields) }
                          : { kind: 'all' }
                      });
                    }}
                  />
                </AccordionPanel>
              ) : null}
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

const FilterQueryEditor: React.FunctionComponent<{
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
  const helpText = fields.length === 0
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
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter' && event.key !== 'Tab' && event.key !== 'Escape') {
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

function filterExpression(filter: BetterListFilter, fields: readonly IBetterListTabFilterField[]): string {
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
      ? { name: filter.field, kind: typeof filter.value === 'boolean' ? 'boolean' : typeof filter.value === 'number' ? 'number' : 'text', field: filter.field }
      : { name: filter.fieldPath, kind: filter.mapping.kind, fieldPath: filter.fieldPath, mapping: filter.mapping };
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
.bl-tabs-builder { color: #242424; font: 12px/1.4 "Segoe UI", sans-serif; }
.bl-tabs-builder *, .bl-tabs-builder *::before, .bl-tabs-builder *::after { box-sizing: border-box; }
.bl-tabs-builder__heading, .bl-tabs-builder__actions { align-items: center; display: flex; }
.bl-tabs-builder__heading { justify-content: flex-end; }
.bl-tabs-builder__card-heading { align-items: center; display: grid; grid-template-columns: minmax(0, 1fr) auto; }
.bl-tabs-builder__heading { color: #616161; margin-bottom: 8px; }
.bl-tabs-builder__card { background: transparent; border: 0; border-radius: 0; margin: 0 0 4px; padding: 0; }
.bl-tabs-builder__card-heading { border-bottom: 1px solid #e0e0e0; min-height: 38px; }
.bl-tabs-builder__card-body { padding: 8px 0 6px; }
.bl-tabs-builder__accordion-header { margin: 0; min-width: 0; }
.bl-tabs-builder__accordion-button { justify-content: flex-start !important; padding-left: 0 !important; width: 100%; }
.bl-tabs-builder__actions { gap: 2px; }
.bl-tabs-builder button { align-items: center; background: transparent; border: 1px solid transparent; border-radius: 4px; color: #242424; cursor: pointer; display: inline-flex; justify-content: center; min-height: 28px; padding: 2px 7px; }
.bl-tabs-builder button:hover:not(:disabled) { background: #f0f0f0; }
.bl-tabs-builder button:disabled { cursor: default; opacity: .35; }
.bl-tabs-builder__add { border-color: #d1d1d1 !important; background: #fff !important; }
.bl-tabs-builder__field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.bl-tabs-builder__field > span, .bl-tabs-builder__filter legend { color: #424242; font-weight: 600; }
.bl-tabs-builder input:not([type="checkbox"]), .bl-tabs-builder select { background: #fff; border: 1px solid #8a8886; border-radius: 4px; color: #242424; font: inherit; min-height: 32px; padding: 5px 8px; width: 100%; }
.bl-tabs-builder input:focus, .bl-tabs-builder select:focus, .bl-tabs-builder button:focus-visible { outline: 2px solid #0f6cbd; outline-offset: 1px; }
.bl-tabs-builder__grid { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin-top: 8px; }
.bl-tabs-builder__check { align-items: center; display: flex; gap: 7px; margin: 10px 0; }
.bl-tabs-builder__filter { border: 0; border-top: 1px solid #e0e0e0; margin: 10px 0 0; padding: 10px 0 0; }
.bl-tabs-builder__filter legend { padding: 0 6px 0 0; }
.bl-query-editor { position: relative; }
.bl-query-editor input { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace !important; }
.bl-query-editor__label { margin-bottom: 1px; }
.bl-query-editor__suggestions { background: #fff; border: 1px solid #d1d1d1; border-radius: 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, .18); left: 0; list-style: none; margin: 3px 0 0; max-height: 176px; overflow: auto; padding: 3px; position: absolute; right: 0; top: 100%; z-index: 40; }
.bl-query-editor__suggestions li { align-items: center; border-radius: 3px; cursor: pointer; display: flex; gap: 8px; justify-content: space-between; min-height: 30px; padding: 5px 7px; }
.bl-query-editor__suggestions li.is-active { background: #ebf3fc; color: #0f548c; }
.bl-query-editor__suggestions small { color: #616161; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bl-query-editor__help { color: #616161; line-height: 1.3; margin-top: 5px; }
.bl-query-editor__help.is-error { color: #a4262c; }
.bl-query-editor__sr-only { height: 1px; margin: -1px; overflow: hidden; position: absolute; width: 1px; clip: rect(0, 0, 0, 0); }
@media (forced-colors: active) { .bl-query-editor__suggestions, .bl-query-editor__suggestions li.is-active { outline: 1px solid CanvasText; } }
@media (max-width: 360px) { .bl-tabs-builder__grid { grid-template-columns: minmax(0, 1fr); } }
`;

export function appendNewTab(tabs: readonly IBetterListTabConfig[]): readonly IBetterListTabConfig[] {
  return [
    ...tabs,
    {
      id: createUniqueTabId(tabs),
      label: `Tab ${tabs.length + 1}`,
      filter: { kind: 'all' },
      icon: { mode: 'none' },
      layout: tabs[0]?.layout ? { ...tabs[0].layout } : undefined
    }
  ];
}

function createUniqueTabId(tabs: readonly IBetterListTabConfig[]): string {
  const used = new Set(tabs.map((tab) => tab.id.toLocaleLowerCase()));
  let index = tabs.length + 1;
  while (used.has(`tab-${index}`)) {
    index += 1;
  }
  return `tab-${index}`;
}
