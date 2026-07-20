import {
  BetterListComparableValue,
  BetterListFieldKind,
  BetterListFieldValue,
  IBetterListQueryField
} from './betterListTypes';

export type BetterListQueryOperator = '=' | '!=' | '~' | '!~' | '>' | '>=' | '<' | '<=' | 'is-empty' | 'is-not-empty';

export interface IBetterListQueryDiagnostic {
  message: string;
  start: number;
  end: number;
}

export interface IBetterListQuerySuggestion {
  id: string;
  label: string;
  detail: string;
  insertText: string;
  replaceStart: number;
  replaceEnd: number;
}

type QueryTokenKind = 'word' | 'string' | 'operator' | 'leftParen' | 'rightParen';

interface IQueryToken {
  kind: QueryTokenKind;
  text: string;
  start: number;
  end: number;
}

type QueryNode =
  | { kind: 'and'; left: QueryNode; right: QueryNode }
  | { kind: 'or'; left: QueryNode; right: QueryNode }
  | { kind: 'not'; operand: QueryNode }
  | { kind: 'comparison'; field: IBetterListQueryField; operator: BetterListQueryOperator; value?: BetterListComparableValue };

export interface IBetterListParsedQuery {
  node?: QueryNode;
  diagnostic?: IBetterListQueryDiagnostic;
}

class QuerySyntaxError extends Error {
  public constructor(message: string, public readonly start: number, public readonly end: number) {
    super(message);
    Object.setPrototypeOf(this, QuerySyntaxError.prototype);
  }
}

function tokenize(expression: string, allowIncomplete = false): readonly IQueryToken[] {
  const tokens: IQueryToken[] = [];
  let index = 0;
  while (index < expression.length) {
    const character = expression[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '(' || character === ')') {
      tokens.push({ kind: character === '(' ? 'leftParen' : 'rightParen', text: character, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      const start = index;
      let text = '';
      let closed = false;
      index += 1;
      while (index < expression.length) {
        if (expression[index] === '\\' && index + 1 < expression.length) {
          text += expression[index + 1];
          index += 2;
        } else if (expression[index] === quote) {
          closed = true;
          index += 1;
          break;
        } else {
          text += expression[index];
          index += 1;
        }
      }
      if (!closed && !allowIncomplete) {
        throw new QuerySyntaxError('Close the quoted value.', start, expression.length);
      }
      tokens.push({ kind: 'string', text, start, end: index });
      continue;
    }
    const twoCharacterOperator = expression.slice(index, index + 2);
    if (twoCharacterOperator === '>=' || twoCharacterOperator === '<=' || twoCharacterOperator === '!=' || twoCharacterOperator === '!~') {
      tokens.push({ kind: 'operator', text: twoCharacterOperator, start: index, end: index + 2 });
      index += 2;
      continue;
    }
    if (character === '=' || character === '~' || character === '>' || character === '<') {
      tokens.push({ kind: 'operator', text: character, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (character === '!' && allowIncomplete) {
      tokens.push({ kind: 'operator', text: character, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    const start = index;
    while (index < expression.length && !/[\s()=~!<>]/.test(expression[index])) {
      index += 1;
    }
    if (start === index) {
      throw new QuerySyntaxError(`Remove the unsupported character "${character}".`, index, index + 1);
    }
    tokens.push({ kind: 'word', text: expression.slice(start, index), start, end: index });
  }
  return tokens;
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function findField(token: IQueryToken, fields: readonly IBetterListQueryField[]): IBetterListQueryField | undefined {
  const name = normalizedName(token.text);
  return fields.find((field) =>
    [field.name, field.field || '', field.fieldPath || '', field.mapping?.internalName || ''].some((candidate) => normalizedName(candidate) === name)
  );
}

function parseValue(token: IQueryToken, field: IBetterListQueryField): BetterListComparableValue {
  const normalized = normalizedName(token.text);
  if (token.kind !== 'string' && normalized === 'null') {
    return null;
  }
  if (field.kind === 'boolean') {
    if (normalized === 'true' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === 'no') {
      return false;
    }
    throw new QuerySyntaxError('Use true or false for this field.', token.start, token.end);
  }
  if (field.kind === 'number') {
    const value = Number(token.text);
    if (!Number.isFinite(value)) {
      throw new QuerySyntaxError('Enter a valid number.', token.start, token.end);
    }
    return value;
  }
  return token.text;
}

class QueryParser {
  private index = 0;

  public constructor(
    private readonly tokens: readonly IQueryToken[],
    private readonly fields: readonly IBetterListQueryField[],
    private readonly expressionLength: number
  ) {}

  public parse(): QueryNode {
    if (this.tokens.length === 0) {
      throw new QuerySyntaxError('Enter a filter expression, or leave the field empty to show all items.', 0, 0);
    }
    const node = this.parseOr();
    const token = this.peek();
    if (token) {
      throw new QuerySyntaxError(`Add AND or OR before "${token.text}".`, token.start, token.end);
    }
    return node;
  }

  private parseOr(): QueryNode {
    let node = this.parseAnd();
    while (this.matchWord('OR')) {
      node = { kind: 'or', left: node, right: this.parseAnd() };
    }
    return node;
  }

  private parseAnd(): QueryNode {
    let node = this.parseUnary();
    while (this.matchWord('AND')) {
      node = { kind: 'and', left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): QueryNode {
    if (this.matchWord('NOT')) {
      return { kind: 'not', operand: this.parseUnary() };
    }
    if (this.peek()?.kind === 'leftParen') {
      this.index += 1;
      const node = this.parseOr();
      const closing = this.peek();
      if (!closing || closing.kind !== 'rightParen') {
        throw new QuerySyntaxError('Close the parenthesized expression.', closing?.start ?? this.expressionLength, closing?.end ?? this.expressionLength);
      }
      this.index += 1;
      return node;
    }
    return this.parseComparison();
  }

  private parseComparison(): QueryNode {
    const fieldToken = this.take();
    if (!fieldToken || (fieldToken.kind !== 'word' && fieldToken.kind !== 'string')) {
      throw new QuerySyntaxError('Choose a field to begin the condition.', fieldToken?.start ?? this.expressionLength, fieldToken?.end ?? this.expressionLength);
    }
    const field = findField(fieldToken, this.fields);
    if (!field) {
      throw new QuerySyntaxError(`"${fieldToken.text}" is not an available field.`, fieldToken.start, fieldToken.end);
    }
    let operator: BetterListQueryOperator;
    const operatorToken = this.take();
    if (operatorToken?.kind === 'operator') {
      operator = operatorToken.text as BetterListQueryOperator;
    } else if (operatorToken?.kind === 'word' && normalizedName(operatorToken.text) === 'is') {
      const next = this.take();
      if (next?.kind === 'word' && normalizedName(next.text) === 'empty') {
        operator = 'is-empty';
      } else if (next?.kind === 'word' && normalizedName(next.text) === 'not') {
        const empty = this.take();
        if (!empty || empty.kind !== 'word' || normalizedName(empty.text) !== 'empty') {
          throw new QuerySyntaxError('Complete the operator with EMPTY.', empty?.start ?? this.expressionLength, empty?.end ?? this.expressionLength);
        }
        operator = 'is-not-empty';
      } else {
        throw new QuerySyntaxError('Use IS EMPTY or IS NOT EMPTY.', next?.start ?? this.expressionLength, next?.end ?? this.expressionLength);
      }
    } else {
      throw new QuerySyntaxError('Choose a comparison operator.', operatorToken?.start ?? this.expressionLength, operatorToken?.end ?? this.expressionLength);
    }
    if ((operator === '~' || operator === '!~') && (field.kind === 'number' || field.kind === 'boolean' || field.kind === 'dateTime')) {
      throw new QuerySyntaxError('Contains operators are only available for text-like fields.', operatorToken.start, operatorToken.end);
    }
    if ((operator === '>' || operator === '>=' || operator === '<' || operator === '<=') && field.kind !== 'number' && field.kind !== 'dateTime') {
      throw new QuerySyntaxError('Ordering operators are only available for number and date fields.', operatorToken.start, operatorToken.end);
    }
    if (operator === 'is-empty' || operator === 'is-not-empty') {
      return { kind: 'comparison', field, operator };
    }
    const valueToken = this.take();
    if (!valueToken || (valueToken.kind !== 'word' && valueToken.kind !== 'string')) {
      throw new QuerySyntaxError('Enter a value for this condition.', valueToken?.start ?? this.expressionLength, valueToken?.end ?? this.expressionLength);
    }
    return { kind: 'comparison', field, operator, value: parseValue(valueToken, field) };
  }

  private peek(): IQueryToken | undefined {
    return this.tokens[this.index];
  }

  private take(): IQueryToken | undefined {
    const token = this.peek();
    this.index += token ? 1 : 0;
    return token;
  }

  private matchWord(value: string): boolean {
    const token = this.peek();
    if (token?.kind === 'word' && normalizedName(token.text) === normalizedName(value)) {
      this.index += 1;
      return true;
    }
    return false;
  }
}

export function parseBetterListFilterQuery(
  expression: string,
  fields: readonly IBetterListQueryField[]
): IBetterListParsedQuery {
  try {
    const tokens = tokenize(expression);
    return { node: new QueryParser(tokens, fields, expression.length).parse() };
  } catch (error) {
    if (error instanceof QuerySyntaxError) {
      return { diagnostic: { message: error.message, start: error.start, end: error.end } };
    }
    throw error;
  }
}

function isEmpty(value: BetterListFieldValue | undefined): boolean {
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((entry) => isEmpty(entry));
  }
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function normalizeComparable(value: BetterListComparableValue): BetterListComparableValue {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : value;
}

function compareValue(candidate: BetterListComparableValue, expected: BetterListComparableValue, operator: BetterListQueryOperator, kind: BetterListFieldKind): boolean {
  const left = normalizeComparable(candidate);
  const right = normalizeComparable(expected);
  if (operator === '=') {
    return left === right;
  }
  if (operator === '!=') {
    return left !== right;
  }
  if (operator === '~' || operator === '!~') {
    const contains = String(left ?? '').indexOf(String(right ?? '')) >= 0;
    return operator === '~' ? contains : !contains;
  }
  if (left === null || right === null) {
    return false;
  }
  const leftValue = kind === 'dateTime' ? Date.parse(String(left ?? '')) : Number(left);
  const rightValue = kind === 'dateTime' ? Date.parse(String(right ?? '')) : Number(right);
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
    return false;
  }
  return operator === '>' ? leftValue > rightValue : operator === '>=' ? leftValue >= rightValue : operator === '<' ? leftValue < rightValue : leftValue <= rightValue;
}

function evaluate(node: QueryNode, readFieldValue: (field: IBetterListQueryField) => BetterListFieldValue | undefined): boolean {
  if (node.kind === 'and') {
    return evaluate(node.left, readFieldValue) && evaluate(node.right, readFieldValue);
  }
  if (node.kind === 'or') {
    return evaluate(node.left, readFieldValue) || evaluate(node.right, readFieldValue);
  }
  if (node.kind === 'not') {
    return !evaluate(node.operand, readFieldValue);
  }
  const value = readFieldValue(node.field);
  if (node.operator === 'is-empty' || node.operator === 'is-not-empty') {
    return node.operator === 'is-empty' ? isEmpty(value) : !isEmpty(value);
  }
  const candidates: readonly BetterListComparableValue[] = Array.isArray(value) ? value : [value ?? null];
  const matches = (candidate: BetterListComparableValue): boolean => compareValue(candidate, node.value ?? null, node.operator, node.field.kind);
  return node.operator === '!=' || node.operator === '!~' ? candidates.every(matches) : candidates.some(matches);
}

export function compileBetterListFilterQuery(
  expression: string,
  fields: readonly IBetterListQueryField[]
): ((readFieldValue: (field: IBetterListQueryField) => BetterListFieldValue | undefined) => boolean) | undefined {
  const parsed = parseBetterListFilterQuery(expression, fields);
  return parsed.node ? (readFieldValue) => evaluate(parsed.node as QueryNode, readFieldValue) : undefined;
}

function quoteFieldName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name) ? name : `"${name.replace(/"/g, '\\"')}"`;
}

function currentFragment(expression: string, cursor: number): { text: string; start: number } {
  const prefix = expression.slice(0, cursor);
  const incompleteIs = /\bIS\s+$/i.exec(prefix);
  if (incompleteIs) {
    return { text: 'IS', start: incompleteIs.index };
  }
  const quoted = /["']([^"']*)$/.exec(prefix);
  if (quoted) {
    return { text: quoted[1], start: cursor - quoted[1].length - 1 };
  }
  const operator = /[=~!<>]+$/.exec(prefix);
  if (operator) {
    return { text: operator[0], start: cursor - operator[0].length };
  }
  const match = /[^\s()=~!<>]*$/.exec(prefix);
  return { text: match?.[0] || '', start: cursor - (match?.[0].length || 0) };
}

function suggestionContext(
  expression: string,
  cursor: number,
  fields: readonly IBetterListQueryField[]
): { context: 'field' | 'operator' | 'value' | 'connector'; field?: IBetterListQueryField } {
  let tokens: readonly IQueryToken[];
  try {
    tokens = tokenize(expression.slice(0, cursor), true);
  } catch {
    return { context: 'field' };
  }
  const last = tokens[tokens.length - 1];
  if (!last || last.kind === 'leftParen' || (last.kind === 'word' && /^(and|or|not)$/i.test(last.text))) {
    return { context: 'field' };
  }
  const lastConnector = Math.max(
    -1,
    ...tokens.map((token, index) => token.kind === 'leftParen' || (token.kind === 'word' && /^(and|or|not)$/i.test(token.text)) ? index : -1)
  );
  const condition = tokens.slice(lastConnector + 1);
  if (condition.length <= 1) {
    const field = condition[0] ? findField(condition[0], fields) : undefined;
    return field && /\s$/.test(expression.slice(0, cursor)) ? { context: 'operator', field } : { context: 'field' };
  }
  const field = findField(condition[0], fields);
  const operatorIndex = condition.findIndex((token) => token.kind === 'operator');
  const hasOperator = operatorIndex >= 0 || condition.some((token) => token.kind === 'word' && /^is$/i.test(token.text));
  if (!hasOperator) {
    return { context: 'operator', field };
  }
  if (operatorIndex < 0 && condition.some((token) => token.kind === 'word' && /^is$/i.test(token.text))) {
    return { context: 'operator', field };
  }
  if (operatorIndex >= 0) {
    if (operatorIndex === condition.length - 1 && !/\s$/.test(expression.slice(0, cursor))) {
      return { context: 'operator', field };
    }
    if (condition.length <= operatorIndex + 1) {
      return { context: 'value', field };
    }
    if (condition.length === operatorIndex + 2 && !/\s$/.test(expression.slice(0, cursor))) {
      return { context: 'value', field };
    }
  }
  return { context: 'connector', field };
}

export function getBetterListQuerySuggestions(
  expression: string,
  cursor: number,
  fields: readonly IBetterListQueryField[]
): readonly IBetterListQuerySuggestion[] {
  const suggestion = suggestionContext(expression, cursor, fields);
  const context = suggestion.context;
  const fragment = currentFragment(expression, cursor);
  const needle = normalizedName(fragment.text.replace(/^["']/, ''));
  const create = (id: string, label: string, detail: string, insertText: string): IBetterListQuerySuggestion => ({
    id,
    label,
    detail,
    insertText,
    replaceStart: fragment.start,
    replaceEnd: cursor
  });
  const operatorCandidates: readonly IBetterListQuerySuggestion[] = [
    create('operator:=', '=', 'equals', '= '),
    create('operator:!=', '!=', 'does not equal', '!= '),
    create('operator:~', '~', 'contains', '~ '),
    create('operator:!~', '!~', 'does not contain', '!~ '),
    create('operator:>', '>', 'greater than', '> '),
    create('operator:>=', '>=', 'greater than or equal', '>= '),
    create('operator:<', '<', 'less than', '< '),
    create('operator:<=', '<=', 'less than or equal', '<= '),
    create('operator:empty', 'IS EMPTY', 'has no value', 'IS EMPTY '),
    create('operator:not-empty', 'IS NOT EMPTY', 'has a value', 'IS NOT EMPTY ')
  ].filter((candidate) => {
    const kind = suggestion.field?.kind;
    if (!kind) {
      return true;
    }
    if (candidate.id === 'operator:~' || candidate.id === 'operator:!~') {
      return kind !== 'boolean' && kind !== 'number' && kind !== 'dateTime';
    }
    if (/^operator:(>|>=|<|<=)$/.test(candidate.id)) {
      return kind === 'number' || kind === 'dateTime';
    }
    return true;
  });
  const valueCandidates: readonly IBetterListQuerySuggestion[] = suggestion.field?.kind === 'boolean'
    ? [create('value:true', 'true', 'Boolean value', 'true '), create('value:false', 'false', 'Boolean value', 'false ')]
    : suggestion.field?.kind === 'number'
      ? [create('value:number', '0', 'Number value', '0 ')]
      : suggestion.field?.kind === 'dateTime'
        ? [create('value:date', '"2026-01-01"', 'Date value', '"2026-01-01" ')]
        : [create('value:null', 'null', 'Empty value', 'null '), create('value:quoted', '"text"', 'Text value', '"text" ')];
  const candidates: readonly IBetterListQuerySuggestion[] = context === 'field'
    ? fields.map((field) => create(`field:${field.name}`, field.name, `${field.kind} field`, `${quoteFieldName(field.name)} `))
    : context === 'operator'
      ? operatorCandidates
      : context === 'value'
        ? valueCandidates
        : [
            create('connector:and', 'AND', 'all conditions must match', 'AND '),
            create('connector:or', 'OR', 'either condition may match', 'OR ')
          ];
  return candidates
    .filter((candidate) => !needle || normalizedName(candidate.label).indexOf(needle) >= 0)
    .slice(0, 12);
}

export function collectBetterListQueryFields(
  expression: string,
  fields: readonly IBetterListQueryField[]
): readonly IBetterListQueryField[] {
  let tokens: readonly IQueryToken[];
  try {
    tokens = tokenize(expression, true);
  } catch {
    return [];
  }
  const selected: IBetterListQueryField[] = [];
  let expectsField = true;
  tokens.forEach((token) => {
    if (token.kind === 'leftParen' || (token.kind === 'word' && /^(and|or|not)$/i.test(token.text))) {
      expectsField = true;
      return;
    }
    if (expectsField && (token.kind === 'word' || token.kind === 'string')) {
      const field = findField(token, fields);
      if (field && !selected.some((candidate) => normalizedName(candidate.name) === normalizedName(field.name))) {
        selected.push(field);
      }
      expectsField = false;
    }
  });
  return selected;
}

export function filterQueryFieldName(field: IBetterListQueryField): string {
  return quoteFieldName(field.name);
}
