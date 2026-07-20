import {
  collectBetterListQueryFields,
  compileBetterListFilterQuery,
  getBetterListQuerySuggestions,
  parseBetterListFilterQuery
} from './filterQuery';
import { BetterListFieldValue, IBetterListQueryField } from './betterListTypes';

const fields: readonly IBetterListQueryField[] = [
  { name: 'Title', kind: 'text', field: 'title' },
  { name: 'Featured', kind: 'boolean', field: 'featured' },
  { name: 'Order priority', kind: 'number', field: 'sortOrder' },
  {
    name: 'Service category',
    kind: 'lookup',
    fieldPath: 'Category',
    mapping: { kind: 'lookup', internalName: 'Category', lookupValueField: 'Title', multi: true }
  }
];

function matches(expression: string, values: Readonly<Record<string, BetterListFieldValue>>): boolean {
  const compiled = compileBetterListFilterQuery(expression, fields);
  expect(compiled).toBeDefined();
  return compiled ? compiled((field) => values[field.name]) : false;
}

describe('Better List filter queries', () => {
  it('evaluates compound conditions with AND precedence, NOT, and parentheses', () => {
    expect(matches('Featured = true AND (Title ~ "request" OR "Order priority" >= 5)', {
      Featured: true,
      Title: 'Travel request',
      'Order priority': 1
    })).toBe(true);
    expect(matches('NOT Featured = true OR "Order priority" >= 5 AND Title ~ "request"', {
      Featured: true,
      Title: 'Travel request',
      'Order priority': 4
    })).toBe(false);
  });

  it('supports empty checks and requires every multi-value entry to miss a negative comparison', () => {
    expect(matches('"Service category" != "Policy"', { 'Service category': ['General', 'Communications'] })).toBe(true);
    expect(matches('"Service category" != "Policy"', { 'Service category': ['General', 'Policy'] })).toBe(false);
    expect(matches('Title IS EMPTY', { Title: '' })).toBe(true);
    expect(matches('Title IS NOT EMPTY', { Title: 'Acquisition' })).toBe(true);
    expect(matches('"Order priority" < 5', { 'Order priority': null })).toBe(false);
    expect(matches('Featured = "true" AND "Order priority" = "5"', { Featured: true, 'Order priority': 5 })).toBe(true);
  });

  it('returns precise diagnostics for unknown fields, invalid operators, and incomplete groups', () => {
    expect(parseBetterListFilterQuery('Unknown = true', fields).diagnostic?.message).toMatch(/not an available field/i);
    expect(parseBetterListFilterQuery('Featured ~ true', fields).diagnostic?.message).toMatch(/text-like/i);
    expect(parseBetterListFilterQuery('(Featured = true', fields).diagnostic?.message).toMatch(/close/i);
  });

  it('offers caret-aware field, operator, value, and connector completions', () => {
    expect(getBetterListQuerySuggestions('Fea', 3, fields)[0]).toMatchObject({ label: 'Featured', insertText: 'Featured ' });
    expect(getBetterListQuerySuggestions('Featured ', 9, fields).map((suggestion) => suggestion.label)).toContain('=');
    expect(getBetterListQuerySuggestions('Featured = ', 11, fields).map((suggestion) => suggestion.label)).toEqual(['true', 'false']);
    expect(getBetterListQuerySuggestions('Featured = t', 12, fields).map((suggestion) => suggestion.label)).toEqual(['true']);
    expect(getBetterListQuerySuggestions('Featured = true ', 16, fields).map((suggestion) => suggestion.label)).toEqual(['AND', 'OR']);
    expect(getBetterListQuerySuggestions('Featured !', 10, fields).map((suggestion) => suggestion.label)).toEqual(['!=']);
    expect(getBetterListQuerySuggestions('Title !', 7, fields).map((suggestion) => suggestion.label)).toEqual(['!=', '!~']);
    expect(getBetterListQuerySuggestions('Featured IS', 11, fields).map((suggestion) => suggestion.label)).toEqual(['IS EMPTY', 'IS NOT EMPTY']);
  });

  it('collects only source and semantic fields referenced by the authored query', () => {
    expect(collectBetterListQueryFields('Featured = true AND "Service category" = "General"', fields).map((field) => field.name)).toEqual([
      'Featured',
      'Service category'
    ]);
  });
});
