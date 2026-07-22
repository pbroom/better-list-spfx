import { BetterListFieldMapping, IBetterListFieldMappings, IBetterListListReference } from './betterListTypes';

/**
 * Returns the portion of the authoring state that can change the SharePoint
 * request or the way returned rows are materialized. Presentation-only tab
 * settings deliberately stay out of this signature.
 */
export function createBetterListLoadSignature(
  list: IBetterListListReference,
  mappings: Partial<IBetterListFieldMappings>
): string {
  return JSON.stringify({
    list: {
      id: list.id || '',
      title: list.title || '',
      webUrl: list.webUrl || ''
    },
    mappings: mappingSignatureEntries(mappings)
  });
}

/** A tiny request epoch used to prevent older async loads from winning. */
export class BetterListRequestEpoch {
  private _current = 0;

  public begin(): number {
    this._current += 1;
    return this._current;
  }

  public invalidate(): void {
    this._current += 1;
  }

  public isCurrent(epoch: number): boolean {
    return epoch === this._current;
  }
}

function mappingSignatureEntries(mappings: Partial<IBetterListFieldMappings>): readonly string[] {
  const entries: string[] = [];
  const semanticMappings = mappings as unknown as Record<string, unknown>;

  Object.keys(semanticMappings)
    .filter((key) => key !== 'metadata' && key !== 'filterFields')
    .sort()
    .forEach((key) => {
      const mapping = semanticMappings[key];
      if (isFieldMapping(mapping)) {
        entries.push(`${key}:${fieldMappingSignature(mapping)}`);
      }
    });

  (mappings.metadata || []).forEach((entry) => {
    entries.push(`metadata:${entry.key}:${fieldMappingSignature(entry.mapping)}`);
  });
  (mappings.filterFields || []).forEach((mapping) => {
    entries.push(`filter:${fieldMappingSignature(mapping)}`);
  });

  return Array.from(new Set(entries)).sort();
}

function fieldMappingSignature(mapping: BetterListFieldMapping): string {
  return JSON.stringify(sortRecord(mapping as unknown as Record<string, unknown>));
}

function sortRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      const current = value[key];
      if (Array.isArray(current)) {
        result[key] = current.map((entry) => (isRecord(entry) ? sortRecord(entry) : entry));
      } else {
        result[key] = isRecord(current) ? sortRecord(current) : current;
      }
      return result;
    }, {});
}

function isFieldMapping(value: unknown): value is BetterListFieldMapping {
  return isRecord(value) && typeof value.internalName === 'string' && typeof value.kind === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
