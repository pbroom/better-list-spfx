import type {
  IBetterListAudienceIdentity,
  IBetterListFieldDescriptor,
  IBetterListFieldInfo,
  IBetterListFieldMappings,
  IBetterListTabConfig
} from '../../src/shared';

export const servicesListId = 'c3fa8d8c-2270-4dc4-9f7e-1f83fef461fd';
export const servicesListTitle = 'Services';
export const categoriesListId = '26b8db39-7a13-4fe5-9a88-bdbfe54676a4';

const categoryLookupFields: readonly IBetterListFieldDescriptor[] = [
  descriptor('Title', 'Title', 'Text', true),
  descriptor('Description', 'Description', 'Note'),
  descriptor('Modified', 'Last updated', 'DateTime'),
  descriptor('SortOrder', 'Sort order', 'Number'),
  descriptor('Active', 'Active', 'Boolean')
];

export const servicesFields: readonly IBetterListFieldInfo[] = [
  field('Title', 'Title', 'Text', true),
  field('Description', 'Description', 'Note'),
  field('URL', 'URL', 'URL'),
  field('UrlLabel', 'URL label', 'Text'),
  field('Category', 'Category', 'Lookup', false, false, 'Title', categoriesListId),
  field('OrgFullName', 'Organization', 'Text'),
  field('Org', 'Organization short name', 'Text'),
  field('Featured', 'Featured', 'Boolean'),
  field('OrderPriority', 'Order priority', 'Number'),
  field('Active', 'Active', 'Boolean'),
  field('Audience', 'Audience', 'UserMulti', false, true),
  field('Icon', 'Icon', 'Text')
];

export const servicesAuthoringFields: readonly IBetterListFieldDescriptor[] =
  servicesFields.map((sourceField) => ({
    internalName: sourceField.internalName,
    title: sourceField.title,
    typeAsString: sourceField.typeAsString,
    allowMultipleValues: sourceField.allowMultipleValues,
    lookupListId: sourceField.lookupListId,
    lookupField: sourceField.lookupField,
    lookupFields:
      sourceField.internalName === 'Category' ? categoryLookupFields : undefined,
    required: sourceField.required
  }));

export const servicesFieldMappings: IBetterListFieldMappings = {
  title: { kind: 'text', internalName: 'Title', displayName: 'Title' },
  description: { kind: 'text', internalName: 'Description', displayName: 'Description' },
  url: { kind: 'url', internalName: 'URL', displayName: 'URL', valueProperty: 'url' },
  urlLabel: { kind: 'text', internalName: 'UrlLabel', displayName: 'URL label' },
  category: { kind: 'lookup', internalName: 'Category', displayName: 'Category', valueProperty: 'title' },
  organization: { kind: 'text', internalName: 'OrgFullName', displayName: 'Organization' },
  organizationShortName: { kind: 'text', internalName: 'Org', displayName: 'Organization short name' },
  featured: { kind: 'boolean', internalName: 'Featured', displayName: 'Featured' },
  sortOrder: { kind: 'number', internalName: 'OrderPriority', displayName: 'Order priority' },
  active: { kind: 'boolean', internalName: 'Active', displayName: 'Active' },
  audience: {
    kind: 'person',
    internalName: 'Audience',
    displayName: 'Audience',
    valueProperty: 'title',
    multi: true
  },
  icon: { kind: 'text', internalName: 'Icon', displayName: 'Icon' }
};

export const servicesTabs: readonly IBetterListTabConfig[] = [
  {
    id: 'featured',
    label: 'Featured',
    filter: { kind: 'equals', field: 'featured', value: true },
    group: { field: 'category', direction: 'ascending', ungroupedLabel: 'Other' },
    sort: [{ field: 'sortOrder', direction: 'ascending', mode: 'number', nulls: 'last' }],
    icon: { mode: 'field', field: 'icon' },
    layout: {
      columns: 2,
      density: 'comfortable',
      collapsible: true,
      initiallyExpanded: true,
      showDescriptions: true,
      showSearch: true
    }
  },
  {
    id: 'all-services',
    label: 'All Services',
    filter: { kind: 'all' },
    group: { field: 'organization', direction: 'ascending', ungroupedLabel: 'Other' },
    sort: [{ field: 'sortOrder', direction: 'ascending', mode: 'number', nulls: 'last' }],
    icon: { mode: 'none' },
    layout: {
      columns: 2,
      density: 'comfortable',
      collapsible: true,
      initiallyExpanded: true,
      showDescriptions: true,
      showSearch: true
    }
  }
];

interface IFixtureUser {
  displayName: string;
  email: string;
  loginName: string;
}

function field(
  internalName: string,
  title: string,
  typeAsString: string,
  required = false,
  allowMultipleValues = false,
  lookupField?: string,
  lookupListId?: string
): IBetterListFieldInfo {
  return {
    id: `fixture-${internalName.toLocaleLowerCase()}`,
    internalName,
    title,
    typeAsString,
    hidden: false,
    readOnly: false,
    required,
    allowMultipleValues,
    lookupListId,
    lookupField
  };
}

function descriptor(
  internalName: string,
  title: string,
  typeAsString: string,
  required = false
): IBetterListFieldDescriptor {
  return { internalName, title, typeAsString, required };
}

export function createServicesFixtureRecords(user: IFixtureUser): readonly Readonly<Record<string, unknown>>[] {
  const currentUserAudience = [
    {
      Id: 42,
      Title: user.displayName,
      EMail: user.email,
      LoginName: user.loginName,
      PrincipalType: 1
    }
  ];

  return [
    service(
      1,
      'Acquisition Request',
      '<div class="ExternalClassFixture"><p>Create and submit&nbsp;an acquisition request.</p></div>',
      {
        org: 'AGSO',
        organization: 'Advanced Projects Office (APO)',
        category: '1 | General',
        icon: 'general',
        featured: true,
        order: 10,
        path: 'acquisition-request'
      }
    ),
    service(2, 'Test General Services Request', 'A guided request for common workplace and administrative services.', {
      org: 'APO',
      organization: 'Operational Alignment Directorate (OAD)',
      category: '1 | General',
      icon: 'general',
      featured: true,
      order: 20,
      path: 'general-services-request'
    }),
    service(3, 'Subscribe to Announcements', 'Stay informed on updates, deadlines, guidance, and operational announcements.', {
      org: 'WOO',
      organization: 'Executive Office',
      category: '3 | Communications',
      icon: 'communications',
      featured: true,
      order: 30,
      path: 'subscribe-announcements'
    }),
    service(4, 'Strategic Coordination Request', 'Coordinate a cross-office initiative, decision, or executive action.', {
      org: 'SCO',
      organization: 'Operational Alignment Directorate (OAD)',
      category: '4 | Policy',
      icon: 'policy',
      featured: true,
      order: 40,
      path: 'strategic-coordination-request'
    }),
    service(5, 'Technical Solution Request', 'Request help selecting, configuring, or troubleshooting a technical solution.', {
      org: 'PRO',
      organization: 'Enterprise Services Directorate (ESD)',
      category: '5 | Technical Support',
      icon: 'support',
      featured: true,
      order: 50,
      path: 'technical-solution-request'
    }),
    service(6, 'Travel Management', 'Arrange official travel and find current travel policy and support.', {
      org: 'AGSO',
      organization: 'Advanced Projects Office (APO)',
      category: '1 | General',
      icon: 'general',
      order: 60,
      path: 'travel-management'
    }),
    service(7, 'Department Notices', 'View department-wide notices, deadlines, and operational updates.', {
      org: 'CCA',
      organization: 'Executive Office',
      category: '3 | Communications',
      icon: 'communications',
      order: 70,
      path: 'department-notices'
    }),
    service(8, 'Parking Management', 'Request or update parking access for an official duty station.', {
      org: 'AGSO',
      organization: 'Advanced Projects Office (APO)',
      category: '1 | General',
      icon: 'general',
      order: 80,
      path: 'parking-management'
    }),
    service(9, 'Performance Appraisals', 'Find appraisal guidance, timelines, forms, and employee resources.', {
      org: 'WOO',
      organization: 'Executive Office',
      category: '2 | Human Resources',
      icon: 'general',
      order: 90,
      path: 'performance-appraisals'
    }),
    service(10, 'Foreign Service Assignments', 'Access assignment-cycle resources and career development guidance.', {
      org: 'WOO',
      organization: 'Executive Office',
      category: '2 | Human Resources',
      icon: 'general',
      order: 100,
      path: 'foreign-service-assignments',
      audience: currentUserAudience
    }),
    service(11, 'Hiring', 'Start a hiring action and review recruiting resources for managers.', {
      org: 'WOO',
      organization: 'Executive Office',
      category: '2 | Human Resources',
      icon: 'general',
      order: 110,
      path: 'hiring'
    }),
    service(12, 'Retired Records Request', 'This inactive fixture verifies that retired services stay hidden.', {
      org: 'BOD',
      organization: 'Business Operations Directorate (BOD)',
      category: '4 | Policy',
      icon: 'policy',
      order: 120,
      path: 'retired-records-request',
      active: false
    })
  ];
}

export function createFixtureIdentity(user: IFixtureUser): IBetterListAudienceIdentity {
  return {
    userId: 42,
    title: user.displayName,
    email: user.email,
    loginName: user.loginName,
    groupIds: []
  };
}

interface IServiceFixtureOptions {
  org: string;
  organization: string;
  category: string;
  icon: string;
  order: number;
  path: string;
  featured?: boolean;
  active?: boolean;
  audience?: readonly Readonly<Record<string, unknown>>[];
}

function service(
  id: number,
  title: string,
  description: string,
  options: IServiceFixtureOptions
): Readonly<Record<string, unknown>> {
  return {
    Id: id,
    Title: title,
    Description: description,
    URL: {
      Url: `https://contoso.sharepoint.com/sites/lab/SitePages/${options.path}.aspx`,
      Description: title
    },
    UrlLabel: title,
    Category: createCategoryLookupValue(options.category),
    Org: options.org,
    OrgFullName: options.organization,
    Featured: options.featured ?? false,
    OrderPriority: options.order,
    Active: options.active ?? true,
    Audience: options.audience ?? [],
    Icon: options.icon
  };
}

function createCategoryLookupValue(category: string): Readonly<Record<string, unknown>> {
  const match = category.match(/^(\d+)\s*\|\s*(.+)$/);
  const sortOrder = match ? Number(match[1]) : 0;
  const title = match ? match[2] : category;
  return {
    Id: Math.max(sortOrder, 1),
    Title: category,
    Description: `${title} services and resources`,
    Modified: `2026-07-${String(Math.min(sortOrder + 10, 28)).padStart(2, '0')}T14:30:00Z`,
    SortOrder: sortOrder,
    Active: true
  };
}
