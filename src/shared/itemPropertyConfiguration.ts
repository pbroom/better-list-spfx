import { toPlainText } from './plainText';

const REQUIRED_TITLE_FIELD = 'Title';
export const betterListMaxItemRows = 5;

export type BetterListItemLayoutRows = readonly (readonly string[])[];

export type BetterListItemElementLinks = Readonly<Record<string, string>>;

export interface IBetterListItemLayoutConfiguration {
  itemProperties: readonly string[];
  rows: BetterListItemLayoutRows;
  links: BetterListItemElementLinks;
}

interface IBetterListItemLayoutConfigurationV2 {
  version: 2;
  rows: BetterListItemLayoutRows;
  links: BetterListItemElementLinks;
}

export function parseItemPropertyFields(serialized: string | undefined): readonly string[] {
  if (!serialized) {
    return [REQUIRED_TITLE_FIELD];
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeItemPropertyFields(parsed);
    }
  } catch {
    // Fall through to the required default shape.
  }
  return [REQUIRED_TITLE_FIELD];
}

export function serializeItemPropertyFields(fields: readonly string[]): string {
  return JSON.stringify(normalizeItemPropertyFields(fields));
}

export function parseItemLayoutRows(
  serialized: string | undefined,
  itemProperties: readonly string[]
): BetterListItemLayoutRows {
  return parseItemLayoutConfiguration(serialized, itemProperties).rows;
}

export function parseItemLayoutConfiguration(
  serialized: string | undefined,
  itemProperties: readonly string[]
): IBetterListItemLayoutConfiguration {
  const properties = normalizeItemPropertyFields(itemProperties);
  try {
    const parsed = JSON.parse(serialized || '[]') as unknown;
    if (Array.isArray(parsed)) {
      const legacyUsesUrlForTitle = properties.indexOf('URL') >= 0;
      const visibleProperties = legacyUsesUrlForTitle
        ? properties.filter((fieldPath) => fieldPath !== 'URL')
        : properties;
      const legacyRows = normalizeItemLayoutRows(parsed, properties)
        .map((row) => row.filter((fieldPath) => fieldPath !== 'URL'));
      return {
        itemProperties: visibleProperties,
        rows: normalizeItemLayoutRows(legacyRows, visibleProperties),
        links: legacyUsesUrlForTitle && visibleProperties.indexOf(REQUIRED_TITLE_FIELD) >= 0
          ? { [REQUIRED_TITLE_FIELD]: 'URL' }
          : {}
      };
    }
    if (isRecord(parsed) && parsed.version === 2 && Array.isArray(parsed.rows)) {
      return {
        itemProperties: properties,
        rows: normalizeItemLayoutRows(parsed.rows, properties),
        links: normalizeItemElementLinks(parsed.links, properties)
      };
    }
  } catch {
    // Fall through to the legacy flat layout.
  }
  return { itemProperties: properties, rows: [], links: {} };
}

export function serializeItemLayoutRows(
  rows: BetterListItemLayoutRows,
  itemProperties: readonly string[]
): string {
  return JSON.stringify(normalizeItemLayoutRows(rows, itemProperties));
}

export function serializeItemLayoutConfiguration(
  rows: BetterListItemLayoutRows,
  itemProperties: readonly string[],
  links: BetterListItemElementLinks
): string {
  const properties = normalizeItemPropertyFields(itemProperties);
  const configuration: IBetterListItemLayoutConfigurationV2 = {
    version: 2,
    rows: normalizeItemLayoutRows(rows, properties),
    links: normalizeItemElementLinks(links, properties)
  };
  return JSON.stringify(configuration);
}

export function normalizeItemElementLinks(
  links: unknown,
  itemProperties: readonly string[]
): BetterListItemElementLinks {
  if (!isRecord(links)) {
    return {};
  }
  const selected = new Set(normalizeItemPropertyFields(itemProperties));
  return Object.keys(links).reduce<Record<string, string>>((result, fieldPath) => {
    const linkFieldPath = typeof links[fieldPath] === 'string' ? String(links[fieldPath]).trim() : '';
    if (selected.has(fieldPath) && linkFieldPath) {
      result[fieldPath] = linkFieldPath;
    }
    return result;
  }, {});
}

export function normalizeItemLayoutRows(
  rows: readonly unknown[],
  itemProperties: readonly string[]
): BetterListItemLayoutRows {
  if (rows.length === 0) {
    return [];
  }

  const properties = normalizeItemPropertyFields(itemProperties);
  const selected = new Set(properties);
  const placed = new Set<string>();
  const normalized = rows.slice(0, betterListMaxItemRows).map((row) => {
    if (!Array.isArray(row)) {
      return [] as string[];
    }
    return row.reduce<string[]>((result, entry) => {
      const fieldPath = typeof entry === 'string' ? entry.trim() : '';
      if (
        fieldPath &&
        selected.has(fieldPath) &&
        !placed.has(fieldPath)
      ) {
        placed.add(fieldPath);
        result.push(fieldPath);
      }
      return result;
    }, []);
  });
  properties.forEach((fieldPath) => {
    if (!placed.has(fieldPath)) {
      normalized[0].push(fieldPath);
    }
  });

  return normalized;
}

export function flattenItemLayoutRows(rows: BetterListItemLayoutRows): readonly string[] {
  return rows.reduce<string[]>((result, row) => {
    result.push(...row);
    return result;
  }, []);
}

export function removeItemLayoutRow(
  rows: BetterListItemLayoutRows,
  rowIndex: number,
  itemProperties: readonly string[]
): BetterListItemLayoutRows {
  if (rowIndex < 0 || rowIndex >= rows.length) {
    return rows;
  }
  if (rows.length === 1) {
    return [];
  }

  const removed = rows[rowIndex];
  const nextRows = rows
    .filter((_row, index) => index !== rowIndex)
    .map((row) => row.slice());
  const targetIndex = rowIndex === 0 ? 0 : rowIndex - 1;
  nextRows[targetIndex] = rowIndex === 0
    ? [...removed, ...nextRows[targetIndex]]
    : [...nextRows[targetIndex], ...removed];
  return normalizeItemLayoutRows(nextRows, itemProperties);
}

export function normalizeItemPropertyFields(fields: readonly unknown[]): readonly string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  fields.forEach((field) => {
    const value = typeof field === 'string' ? field.trim() : '';
    if (value && !seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  });

  return normalized;
}

export function formatItemPropertyValue(
  source: Readonly<Record<string, unknown>>,
  fieldPath: string,
  richText: boolean = false
): string | undefined {
  const value = readPath(source, fieldPath);
  return formatValue(value, richText);
}

export function getItemPropertyUrl(
  source: Readonly<Record<string, unknown>>,
  fieldPath: string
): string | undefined {
  const value = readPath(source, fieldPath);
  if (typeof value === 'string') {
    return normalizeSafeUrl(value);
  }
  if (isRecord(value)) {
    const url = value.Url ?? value.URL ?? value.url;
    return typeof url === 'string' ? normalizeSafeUrl(url) : undefined;
  }
  return undefined;
}

function normalizeSafeUrl(value: string): string | undefined {
  const url = value.trim();
  if (!url) {
    return undefined;
  }
  for (let index = 0; index < url.length; index += 1) {
    const characterCode = url.charCodeAt(index);
    if (characterCode <= 31 || characterCode === 127) {
      return undefined;
    }
  }
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLocaleLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto' && scheme !== 'tel') {
    return undefined;
  }
  return url;
}

function readPath(source: Readonly<Record<string, unknown>>, fieldPath: string): unknown {
  // Slash-separated paths are the canonical authored representation for
  // SharePoint relationship fields. Continue to accept the legacy dot form so
  // existing web-part JSON remains valid while schema hydration migrates it.
  return fieldPath.split(/[/.]/).filter(Boolean).reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      return current
        .map((entry) => isRecord(entry) ? entry[segment] : undefined)
        .filter((entry) => entry !== undefined && entry !== null && entry !== '');
    }
    return isRecord(current) ? current[segment] : undefined;
  }, source);
}

function formatValue(value: unknown, richText: boolean): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return typeof value === 'string' && richText ? toPlainText(value) : String(value);
  }
  if (Array.isArray(value)) {
    const values = value.map((entry) => formatValue(entry, richText)).filter((entry): entry is string => Boolean(entry));
    return values.length ? values.join(', ') : undefined;
  }
  if (isRecord(value)) {
    if (Array.isArray(value.results)) {
      return formatValue(value.results, richText);
    }
    return formatValue(
      value.Title ??
        value.title ??
        value.Description ??
        value.description ??
        value.Url ??
        value.URL ??
        value.EMail ??
        value.Email ??
        value.Name,
      richText
    );
  }
  return String(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
