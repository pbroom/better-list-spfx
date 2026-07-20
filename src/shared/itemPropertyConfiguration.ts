const REQUIRED_TITLE_FIELD = 'Title';
export const betterListMaxItemRows = 5;

export type BetterListItemLayoutRows = readonly (readonly string[])[];

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
  try {
    const parsed = JSON.parse(serialized || '[]') as unknown;
    if (Array.isArray(parsed)) {
      return normalizeItemLayoutRows(parsed, itemProperties);
    }
  } catch {
    // Fall through to the legacy flat layout.
  }
  return [];
}

export function serializeItemLayoutRows(
  rows: BetterListItemLayoutRows,
  itemProperties: readonly string[]
): string {
  return JSON.stringify(normalizeItemLayoutRows(rows, itemProperties));
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
  fieldPath: string
): string | undefined {
  const value = readPath(source, fieldPath);
  return formatValue(value);
}

export function getItemPropertyUrl(
  source: Readonly<Record<string, unknown>>,
  fieldPath: string
): string | undefined {
  const value = readPath(source, fieldPath);
  if (typeof value === 'string') {
    return value || undefined;
  }
  if (isRecord(value)) {
    const url = value.Url ?? value.URL ?? value.url;
    return typeof url === 'string' && url ? url : undefined;
  }
  return undefined;
}

function readPath(source: Readonly<Record<string, unknown>>, fieldPath: string): unknown {
  return fieldPath.split('.').reduce<unknown>((current, segment) => {
    return isRecord(current) ? current[segment] : undefined;
  }, source);
}

function formatValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const values = value.map(formatValue).filter((entry): entry is string => Boolean(entry));
    return values.length ? values.join(', ') : undefined;
  }
  if (isRecord(value)) {
    return formatValue(
      value.Title ??
        value.title ??
        value.Description ??
        value.description ??
        value.Url ??
        value.URL ??
        value.EMail ??
        value.Email
    );
  }
  return String(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
