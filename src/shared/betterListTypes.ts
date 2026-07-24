/* eslint-disable @rushstack/no-new-null */

import type {
  BetterListGroupIconOverride,
  IBetterListGroupIconsConfiguration
} from './groupIconConfiguration';
import type {
  BetterListItemElementLinks,
  BetterListItemLayoutRows
} from './itemPropertyConfiguration';

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

export type BetterListDefaultSort =
  | 'listOrder'
  | 'titleAscending'
  | 'popularity'
  | 'trending'
  | 'recentlyUpdated'
  | 'column';

export type BetterListViewerSortOption = BetterListDefaultSort;

export type BetterListRelationshipKind = 'lookup' | 'person';
export type BetterListRelationshipResolution = 'expanded' | 'userInfoBatch';

export interface IBetterListRelationshipTarget {
  /** Stable internal name authored after the relationship slash. */
  internalName: string;
  label: string;
  kind: Exclude<BetterListFieldKind, 'lookup' | 'person'>;
  /** Entity property used when SharePoint exposes a different OData alias. */
  queryName?: string;
  queryable: boolean;
  resolution: BetterListRelationshipResolution;
  richText?: boolean;
}

export interface IBetterListRelationshipDescriptor {
  kind: BetterListRelationshipKind;
  lookupListId?: string;
  target: IBetterListRelationshipTarget;
  targets?: readonly IBetterListRelationshipTarget[];
}

interface IBetterListBaseFieldMapping {
  internalName: string;
  /** Canonical authored identity, for example PoC/EMail. */
  fieldPath?: string;
  /** Root SharePoint field internal name. Defaults to internalName. */
  sourceInternalName?: string;
  displayName?: string;
  /** SharePoint list-item entity property used in OData queries. Defaults to internalName. */
  queryName?: string;
  /** True when the selected field value contains SharePoint rich-text markup. */
  richText?: boolean;
  fieldType?: string;
  relationship?: IBetterListRelationshipDescriptor;
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
  /** Entity property name for the selected lookup-list field. */
  lookupValueQueryName?: string;
  multi?: boolean;
}

export interface IBetterListPersonFieldMapping extends IBetterListBaseFieldMapping {
  kind: 'person';
  valueProperty?: 'id' | 'title' | 'email' | 'loginName';
  personValueField?: string;
  personValueQueryName?: string;
  /** Legacy alias retained for serialized relationship mappings authored before personValueField. */
  lookupValueField?: string;
  /** Legacy query-name alias paired with lookupValueField. */
  lookupValueQueryName?: string;
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
  /** Concise text used only while the field is shown inside its parent submenu. */
  menuLabel?: string;
  /** Disambiguated lookup/person parent label used to build nested menus. */
  parentLabel?: string;
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
  filterFields?: readonly BetterListFieldMapping[];
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

export interface IBetterListQueryField {
  name: string;
  kind: BetterListFieldKind;
  field?: BetterListFieldSlot;
  fieldPath?: string;
  mapping?: BetterListFieldMapping;
}

export type BetterListFilter =
  | { kind: 'all' }
  | { kind: 'equals'; field: BetterListFieldSlot; value: BetterListComparableValue }
  | {
      kind: 'sourceEquals';
      fieldPath: string;
      mapping: BetterListFieldMapping;
      value: BetterListComparableValue;
    }
  | {
      kind: 'query';
      expression: string;
      fields: readonly IBetterListQueryField[];
    };

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

export interface IBetterListGroupOrderEntry {
  /** Stable group identity produced by the Better List grouping pipeline. */
  key: string;
  /** Hidden groups remain in the authored order so they can be restored later. */
  hidden?: boolean;
}

export type BetterListIconMode = 'none' | 'field' | 'fixed';

export type BetterListTabIcon = 'list' | 'communications' | 'policy' | 'support';

export type BetterListColumnCount = 1 | 2 | 3 | 4;

export function normalizeBetterListColumnCount(value: unknown): BetterListColumnCount {
  const numericValue = Number(value);
  return numericValue === 1 || numericValue === 2 || numericValue === 3 || numericValue === 4
    ? numericValue
    : 2;
}

export interface IBetterListIconOverride {
  mode: BetterListIconMode;
  field?: BetterListFieldSlot;
  value?: string;
}

export interface IBetterListLayoutOverride {
  columns?: BetterListColumnCount;
  density?: 'compact' | 'comfortable';
  collapsible?: boolean;
  initiallyExpanded?: boolean;
  showDescriptions?: boolean;
  showSearch?: boolean;
}

export interface IBetterListTabGroupingOverride {
  /** Explicit none is distinct from an omitted override, which inherits the previous tab. */
  mode: 'none' | 'custom';
  column?: string;
  collapsible?: boolean;
  icons?: IBetterListGroupIconsConfiguration;
  /** Optional query evaluated against each distinct grouping relationship. */
  filter?: BetterListFilter;
  /** Optional author-defined order and visibility for known group identities. */
  groupOrder?: readonly IBetterListGroupOrderEntry[];
}

export interface IBetterListTabItemLayoutOverride {
  itemProperties: readonly string[];
  rows: BetterListItemLayoutRows;
  links: BetterListItemElementLinks;
}

export interface IBetterListTabConfig {
  id: string;
  label: string;
  filter: BetterListFilter;
  tabIcon?: BetterListTabIcon;
  /** Rich tab icon chosen from the shared icon picker. Takes precedence over the legacy tabIcon value. */
  tabIconOverride?: BetterListGroupIconOverride;
  showItemCount?: boolean;
  maxItems?: number;
  group?: IBetterListGroup;
  sort?: readonly IBetterListSort[];
  icon?: IBetterListIconOverride;
  layout?: IBetterListLayoutOverride;
  /** Omit to inherit the effective grouping configuration from the preceding tab. */
  groupingOverride?: IBetterListTabGroupingOverride;
  /** Omit to inherit the effective item layout configuration from the preceding tab. */
  itemLayoutOverride?: IBetterListTabItemLayoutOverride;
}

export interface IBetterListListReference {
  id?: string;
  title?: string;
  /** Absolute URL of the SharePoint web containing the list. Empty means the current page web. */
  webUrl?: string;
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
  /** Synthetic source that preserves the relationship entity behind this group. */
  source?: Readonly<Record<string, unknown>>;
}

export interface IBetterListListInfo {
  id: string;
  title: string;
  itemCount: number;
  baseTemplate: number;
  webUrl?: string;
  serverRelativeUrl?: string;
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
  entityPropertyName?: string;
  richText?: boolean;
  richTextMode?: string;
  lookupListId?: string;
  lookupField?: string;
  fieldPath?: string;
  sourceInternalName?: string;
  relationship?: IBetterListRelationshipDescriptor;
}

export interface IBetterListLoadRequest {
  list: IBetterListListReference;
  mappings: IBetterListFieldMappings;
}

export interface IBetterListLoadResult {
  items: readonly IBetterListItem[];
  audienceIdentity: IBetterListAudienceIdentity;
}
