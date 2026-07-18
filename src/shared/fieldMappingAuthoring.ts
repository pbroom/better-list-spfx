import {
  BetterListFieldKind,
  BetterListFieldMapping,
  BetterListFieldSlot,
  IBetterListFieldMappings
} from './betterListTypes';

export interface IBetterListFieldDescriptor {
  internalName: string;
  title: string;
  typeAsString: string;
  allowMultipleValues?: boolean;
  lookupListId?: string;
  lookupField?: string;
  lookupFields?: readonly IBetterListFieldDescriptor[];
  required?: boolean;
}

export interface IBetterListSemanticSlotDescriptor {
  key: BetterListFieldSlot;
  label: string;
  required?: boolean;
}

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
  const common = { internalName: field.internalName, displayName: field.title };
  const multi = field.allowMultipleValues === true || type.indexOf('multi') >= 0;

  if (slot === 'audience' || type.indexOf('user') >= 0 || type.indexOf('person') >= 0) {
    return { ...common, kind: 'person', valueProperty: 'title', multi };
  }
  if (type.indexOf('lookup') >= 0) {
    return {
      ...common,
      kind: 'lookup',
      valueProperty: 'title',
      lookupValueField: lookupValueField || field.lookupField || 'Title',
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
