/* eslint-disable @rushstack/no-new-null */

export type BetterListFieldSlot =
  | 'title'
  | 'description'
  | 'url'
  | 'urlLabel'
  | 'category'
  | 'organization'
  | 'organizationShortName'
  | 'featured'
  | 'sortOrder'
  | 'active'
  | 'audience'
  | 'icon'
  | 'tab'
  | 'group';

export type BetterListFieldKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'dateTime'
  | 'url'
  | 'lookup'
  | 'person';

interface IBetterListBaseFieldMapping {
  internalName: string;
  displayName?: string;
}

export interface IBetterListScalarFieldMapping extends IBetterListBaseFieldMapping {
  kind: 'text' | 'number' | 'boolean' | 'dateTime';
}

export interface IBetterListUrlFieldMapping extends IBetterListBaseFieldMapping {
  kind: 'url';
  valueProperty?: 'url' | 'description';
}

export interface IBetterListLookupFieldMapping extends IBetterListBaseFieldMapping {
  kind: 'lookup';
  valueProperty?: 'id' | 'title';
  lookupValueField?: string;
  multi?: boolean;
}

export interface IBetterListPersonFieldMapping extends IBetterListBaseFieldMapping {
  kind: 'person';
  valueProperty?: 'id' | 'title' | 'email' | 'loginName';
  multi?: boolean;
}

export type BetterListFieldMapping =
  | IBetterListScalarFieldMapping
  | IBetterListUrlFieldMapping
  | IBetterListLookupFieldMapping
  | IBetterListPersonFieldMapping;

export interface IBetterListMetadataFieldMapping {
  key: string;
  label: string;
  mapping: BetterListFieldMapping;
}

export interface IBetterListMetadataValue {
  key: string;
  label: string;
  value: BetterListFieldValue;
}

export interface IBetterListFieldMappings {
  title: BetterListFieldMapping;
  description?: BetterListFieldMapping;
  url?: BetterListFieldMapping;
  urlLabel?: BetterListFieldMapping;
  category?: BetterListFieldMapping;
  organization?: BetterListFieldMapping;
  organizationShortName?: BetterListFieldMapping;
  featured?: BetterListFieldMapping;
  sortOrder?: BetterListFieldMapping;
  active?: BetterListFieldMapping;
  audience?: IBetterListPersonFieldMapping;
  icon?: BetterListFieldMapping;
  tab?: BetterListFieldMapping;
  group?: BetterListFieldMapping;
  metadata?: readonly IBetterListMetadataFieldMapping[];
}

export type BetterListComparableValue = string | number | boolean | null;
export type BetterListFieldValue = BetterListComparableValue | readonly BetterListComparableValue[];

export interface IBetterListAudiencePrincipal {
  id?: number;
  title?: string;
  email?: string;
  loginName?: string;
  principalType?: number;
}

export interface IBetterListAudienceIdentity {
  userId?: number;
  title?: string;
  email?: string;
  loginName?: string;
  groupIds: readonly number[];
}

export interface IBetterListItem {
  id: number | string;
  title: string;
  description?: string;
  url?: string;
  urlLabel?: string;
  featured: boolean;
  sortOrder?: number;
  active: boolean;
  audience: readonly IBetterListAudiencePrincipal[];
  metadata: readonly IBetterListMetadataValue[];
  values: Partial<Record<BetterListFieldSlot, BetterListFieldValue>>;
  source: Readonly<Record<string, unknown>>;
}

export type BetterListFilter =
  | { kind: 'all' }
  | { kind: 'equals'; field: BetterListFieldSlot; value: BetterListComparableValue };

export interface IBetterListSort {
  field: BetterListFieldSlot;
  direction?: 'ascending' | 'descending';
  mode?: 'auto' | 'text' | 'number' | 'dateTime';
  nulls?: 'first' | 'last';
}

export interface IBetterListGroup {
  field: BetterListFieldSlot;
  direction?: 'ascending' | 'descending';
  ungroupedLabel?: string;
}

export type BetterListIconMode = 'none' | 'field' | 'fixed';

export interface IBetterListIconOverride {
  mode: BetterListIconMode;
  field?: BetterListFieldSlot;
  value?: string;
}

export interface IBetterListLayoutOverride {
  columns?: 1 | 2 | 3;
  density?: 'compact' | 'comfortable';
  collapsible?: boolean;
  initiallyExpanded?: boolean;
  showDescriptions?: boolean;
  showSearch?: boolean;
}

export interface IBetterListTabConfig {
  id: string;
  label: string;
  filter: BetterListFilter;
  group?: IBetterListGroup;
  sort?: readonly IBetterListSort[];
  icon?: IBetterListIconOverride;
  layout?: IBetterListLayoutOverride;
}

export interface IBetterListListReference {
  id?: string;
  title?: string;
}

export interface IBetterListConfiguration {
  list: IBetterListListReference;
  mappings: IBetterListFieldMappings;
  tabs: readonly IBetterListTabConfig[];
}

export interface IBetterListSerializedConfiguration {
  list: IBetterListListReference;
  mappings: IBetterListFieldMappings;
  tabsJson: string;
}

export interface IBetterListGroupResult {
  key: string;
  label: string;
  items: readonly IBetterListItem[];
}

export interface IBetterListListInfo {
  id: string;
  title: string;
  itemCount: number;
  baseTemplate: number;
}

export interface IBetterListFieldInfo {
  id: string;
  internalName: string;
  title: string;
  typeAsString: string;
  hidden: boolean;
  readOnly: boolean;
  required: boolean;
  allowMultipleValues: boolean;
  lookupListId?: string;
  lookupField?: string;
}

export interface IBetterListLoadRequest {
  list: IBetterListListReference;
  mappings: IBetterListFieldMappings;
}

export interface IBetterListLoadResult {
  items: readonly IBetterListItem[];
  audienceIdentity: IBetterListAudienceIdentity;
}
