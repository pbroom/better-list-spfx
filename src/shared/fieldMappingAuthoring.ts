import {
  BetterListFieldKind,
  BetterListFieldMapping,
  BetterListFieldSlot,
  IBetterListFieldMappings,
  IBetterListMetadataFieldMapping,
  IBetterListRelationshipTarget
} from './betterListTypes';

export interface IBetterListFieldDescriptor {
  internalName: string;
  title: string;
  typeAsString: string;
  queryName?: string;
  richText?: boolean;
  richTextMode?: string;
  allowMultipleValues?: boolean;
  lookupListId?: string;
  lookupField?: string;
  lookupFields?: readonly IBetterListFieldDescriptor[];
  required?: boolean;
  fieldPath?: string;
  sourceInternalName?: string;
  relationship?: {
    kind: 'lookup' | 'person';
    lookupListId?: string;
    targets?: readonly IBetterListRelationshipTarget[];
  };
}

export interface IBetterListFieldPathOption {
  field: IBetterListFieldDescriptor;
  fieldPath: string;
  label: string;
  targetField?: IBetterListFieldDescriptor;
}

export interface IBetterListSemanticSlotDescriptor {
  key: BetterListFieldSlot;
  label: string;
  required?: boolean;
}

const personTargetFields: readonly IBetterListFieldDescriptor[] = [
  { internalName: 'Title', queryName: 'Title', title: 'Display name', typeAsString: 'Text' },
  { internalName: 'EMail', queryName: 'EMail', title: 'Email', typeAsString: 'Text' },
  { internalName: 'Id', queryName: 'Id', title: 'ID', typeAsString: 'Number' }
];

export const betterListSemanticSlots: readonly IBetterListSemanticSlotDescriptor[] = [
  { key: 'title', label: 'Title', required: true },
  { key: 'description', label: 'Description' },
  { key: 'url', label: 'URL' },
  { key: 'urlLabel', label: 'URL label' },
  { key: 'active', label: 'Active' },
  { key: 'audience', label: 'Audience' },
  { key: 'category', label: 'Category' },
  { key: 'organization', label: 'Organization' },
  { key: 'organizationShortName', label: 'Organization short name' },
  { key: 'featured', label: 'Featured' },
  { key: 'sortOrder', label: 'Sort order' },
  { key: 'icon', label: 'Icon' },
  { key: 'tab', label: 'Tabs' },
  { key: 'group', label: 'Groups' }
];

export function createBetterListFieldMapping(
  field: IBetterListFieldDescriptor,
  slot?: BetterListFieldSlot,
  lookupValueField?: string
): BetterListFieldMapping {
  const type = field.typeAsString.toLocaleLowerCase();
  const targetField = lookupValueField
    ? getBetterListFieldTargetFields(field).find((candidate) => candidate.internalName === lookupValueField) || {
        internalName: lookupValueField,
        queryName: lookupValueField,
        title: lookupValueField,
        typeAsString: 'Text'
      }
    : undefined;
  const common = {
    internalName: field.internalName,
    sourceInternalName: field.internalName,
    fieldPath: canonicalBetterListFieldPath(field.internalName, targetField?.internalName),
    displayName: field.title,
    queryName: field.queryName,
    richText: targetField?.richText ?? field.richText,
    fieldType: field.typeAsString
  };
  const multi = field.allowMultipleValues === true || type.indexOf('multi') >= 0;

  if (slot === 'audience' || type.indexOf('user') >= 0 || type.indexOf('person') >= 0) {
    const personTarget = targetField || getBetterListFieldTargetFields(field)[0];
    return {
      ...common,
      kind: 'person',
      fieldPath: canonicalBetterListFieldPath(field.internalName, personTarget?.internalName || 'Title'),
      valueProperty: getPersonValueProperty(personTarget?.internalName),
      personValueField: personTarget?.internalName || 'Title',
      personValueQueryName: personTarget?.queryName,
      relationship: createRelationshipDescriptor(field, 'person', personTarget),
      multi
    };
  }
  if (type.indexOf('lookup') >= 0) {
    const lookupTarget = targetField || getBetterListFieldTargetFields(field)[0];
    return {
      ...common,
      kind: 'lookup',
      fieldPath: canonicalBetterListFieldPath(field.internalName, lookupTarget?.internalName || 'Title'),
      valueProperty: 'title',
      lookupValueField: lookupTarget?.internalName || field.lookupField || 'Title',
      lookupValueQueryName: lookupTarget?.queryName,
      relationship: createRelationshipDescriptor(
        field,
        'lookup',
        lookupTarget
      ),
      multi
    };
  }
  if (type.indexOf('url') >= 0 || type.indexOf('hyperlink') >= 0) {
    return { ...common, kind: 'url', valueProperty: slot === 'urlLabel' ? 'description' : 'url' };
  }
  return { ...common, kind: getScalarFieldKind(type) };
}

export function updateBetterListFieldMapping(
  mappings: Partial<IBetterListFieldMappings>,
  slot: BetterListFieldSlot,
  field?: IBetterListFieldDescriptor
): Partial<IBetterListFieldMappings> {
  if (field) {
    return {
      ...mappings,
      [slot]: createBetterListFieldMapping(field, slot)
    };
  }

  const nextMappings = { ...mappings };
  delete nextMappings[slot];
  return nextMappings;
}

export function createBetterListMetadataMappings(
  fields: readonly IBetterListFieldDescriptor[],
  fieldPaths: readonly string[]
): readonly IBetterListMetadataFieldMapping[] {
  const seen = new Set<string>();
  return fieldPaths.reduce<IBetterListMetadataFieldMapping[]>((result, fieldPath) => {
    const parsed = parseBetterListFieldPath(fieldPath);
    const canonicalPath = canonicalBetterListFieldPath(parsed.source, parsed.target);
    if (!canonicalPath || canonicalPath === 'Title' || seen.has(canonicalPath)) {
      return result;
    }
    const internalName = parsed.source;
    const lookupValueField = parsed.target;
    const field = fields.find((candidate) => candidate.internalName === internalName);
    if (!field) {
      return result;
    }
    const targetField = lookupValueField
      ? getBetterListFieldTargetFields(field).find((candidate) => candidate.internalName === lookupValueField)
      : undefined;
    seen.add(canonicalPath);
    result.push({
      key: canonicalPath,
      label: lookupValueField ? `${field.title} → ${targetField?.title || lookupValueField}` : field.title,
      mapping: createBetterListFieldMapping(field, undefined, lookupValueField)
    });
    return result;
  }, []);
}

/**
 * Produces the stable, exact-identity field catalog shared by every authoring
 * surface. SharePoint can return duplicate display titles and, in a few list
 * shapes, duplicate field rows. Internal names are the authored identity.
 */
export function createBetterListFieldCatalog(
  fields: readonly IBetterListFieldDescriptor[]
): readonly IBetterListFieldDescriptor[] {
  const byInternalName = new Map<string, IBetterListFieldDescriptor>();
  fields.forEach((field) => {
    const key = canonicalFieldIdentity(field.internalName);
    if (!key) {
      return;
    }
    const current = byInternalName.get(key);
    const lookupFields = createBetterListFieldCatalog(
      (current?.lookupFields || []).concat(field.lookupFields || [])
    );
    byInternalName.set(key, {
      ...field,
      ...current,
      lookupFields: lookupFields.length > 0 ? lookupFields : undefined
    });
  });
  return Array.from(byInternalName.values());
}

export function isBetterListLookupLikeField(field: IBetterListFieldDescriptor): boolean {
  const type = field.typeAsString.toLocaleLowerCase();
  return type.indexOf('lookup') >= 0 || type.indexOf('user') >= 0 || type.indexOf('person') >= 0;
}

export function getBetterListFieldTargetFields(
  field: IBetterListFieldDescriptor
): readonly IBetterListFieldDescriptor[] {
  const type = field.typeAsString.toLocaleLowerCase();
  if (type.indexOf('user') >= 0 || type.indexOf('person') >= 0) {
    return createBetterListFieldCatalog(personTargetFields.concat(field.lookupFields || []));
  }
  if (field.lookupFields && field.lookupFields.length > 0) {
    return createBetterListFieldCatalog(field.lookupFields);
  }
  const internalName = field.lookupField || 'Title';
  return [{ internalName, queryName: internalName, title: internalName, typeAsString: 'Text' }];
}

export function createBetterListFieldPathCatalog(
  fields: readonly IBetterListFieldDescriptor[]
): readonly IBetterListFieldPathOption[] {
  const catalog = createBetterListFieldCatalog(fields);
  const sourceTitleCounts = countTitles(catalog);
  return catalog.reduce<IBetterListFieldPathOption[]>((options, field) => {
    const sourceLabel = disambiguatedTitle(field, sourceTitleCounts);
    if (!isBetterListLookupLikeField(field)) {
      options.push({ field, fieldPath: field.internalName, label: sourceLabel });
      return options;
    }
    const targets = getBetterListFieldTargetFields(field);
    const targetTitleCounts = countTitles(targets);
    targets.forEach((targetField) => {
      options.push({
        field,
        fieldPath: canonicalBetterListFieldPath(field.internalName, targetField.internalName),
        label: `${sourceLabel} → ${disambiguatedTitle(targetField, targetTitleCounts)}`,
        targetField
      });
    });
    return options;
  }, []);
}

export function getBetterListFieldPathLabel(
  field: IBetterListFieldDescriptor,
  fieldPath: string
): string {
  const targetInternalName = parseBetterListFieldPath(fieldPath).target;
  if (!targetInternalName) {
    return field.title;
  }
  const targets = getBetterListFieldTargetFields(field);
  const target = targets.find((candidate) => candidate.internalName === targetInternalName);
  return `${field.title} → ${target ? disambiguatedTitle(target, countTitles(targets)) : targetInternalName}`;
}

export function parseBetterListFieldPath(fieldPath: string): { source: string; target?: string } {
  const normalized = fieldPath.trim();
  const separator = normalized.indexOf('/') >= 0 ? '/' : '.';
  const parts = normalized.split(separator).filter(Boolean);
  return { source: parts[0] || '', target: parts[1] };
}

export function canonicalBetterListFieldPath(source: string, target?: string): string {
  const root = source.trim();
  const leaf = target?.trim();
  return leaf ? `${root}/${leaf}` : root;
}

function createRelationshipDescriptor(
  field: IBetterListFieldDescriptor,
  kind: 'lookup' | 'person',
  target: IBetterListFieldDescriptor | undefined
): NonNullable<BetterListFieldMapping['relationship']> | undefined {
  if (!target) return undefined;
  const targets = getBetterListFieldTargetFields(field).map((candidate) =>
    createRelationshipTarget(kind, candidate)
  );
  const selected = createRelationshipTarget(kind, target);
  return {
    kind,
    lookupListId: field.lookupListId,
    target: selected,
    targets
  };
}

function createRelationshipTarget(
  relationshipKind: 'lookup' | 'person',
  field: IBetterListFieldDescriptor
): IBetterListRelationshipTarget {
  const normalized = field.internalName.toLocaleLowerCase();
  const expandedPersonTarget = normalized === 'id' || normalized === 'title' || normalized === 'email';
  return {
    internalName: field.internalName,
    label: field.title || field.internalName,
    kind: getScalarFieldKind(field.typeAsString.toLocaleLowerCase()),
    queryName: field.queryName,
    queryable: relationshipKind === 'lookup' || expandedPersonTarget,
    resolution: relationshipKind === 'person' && !expandedPersonTarget ? 'userInfoBatch' : 'expanded',
    richText: field.richText
  };
}

function getPersonValueProperty(
  lookupValueField: string | undefined
): 'id' | 'title' | 'email' | 'loginName' {
  const property = (lookupValueField || 'Title').toLocaleLowerCase();
  if (property === 'id') return 'id';
  if (property === 'email') return 'email';
  if (property === 'loginname' || property === 'name') return 'loginName';
  return 'title';
}

function canonicalFieldIdentity(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function countTitles(
  fields: readonly IBetterListFieldDescriptor[]
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  fields.forEach((field) => {
    const key = field.title.trim().toLocaleLowerCase();
    result.set(key, (result.get(key) || 0) + 1);
  });
  return result;
}

function disambiguatedTitle(
  field: IBetterListFieldDescriptor,
  counts: ReadonlyMap<string, number>
): string {
  const title = field.title || field.internalName;
  return (counts.get(title.trim().toLocaleLowerCase()) || 0) > 1
    ? `${title} (${field.internalName})`
    : title;
}

function getScalarFieldKind(
  type: string
): Extract<BetterListFieldKind, 'text' | 'number' | 'boolean' | 'dateTime'> {
  if (type.indexOf('boolean') >= 0) {
    return 'boolean';
  }
  if (type.indexOf('number') >= 0 || type.indexOf('currency') >= 0 || type.indexOf('counter') >= 0) {
    return 'number';
  }
  if (type.indexOf('date') >= 0) {
    return 'dateTime';
  }
  return 'text';
}
