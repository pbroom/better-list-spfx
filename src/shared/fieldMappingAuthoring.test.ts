import {
  createBetterListColumnReferenceMenuGroups,
  createBetterListFieldCatalog,
  createBetterListFieldMapping,
  createBetterListFieldPathCatalog,
  createBetterListMetadataMappings,
  getBetterListColumnReferenceMenuLabel,
  IBetterListFieldDescriptor,
  updateBetterListFieldMapping
} from './fieldMappingAuthoring';

function field(
  internalName: string,
  typeAsString: string,
  allowMultipleValues = false
): IBetterListFieldDescriptor {
  return { internalName, title: internalName, typeAsString, allowMultipleValues };
}

describe('createBetterListFieldMapping', () => {
  it('uses the URL value for links and the description for link labels', () => {
    expect(createBetterListFieldMapping(field('ServiceUrl', 'URL'), 'url')).toMatchObject({
      kind: 'url',
      valueProperty: 'url'
    });
    expect(createBetterListFieldMapping(field('ServiceUrl', 'URL'), 'urlLabel')).toMatchObject({
      kind: 'url',
      valueProperty: 'description'
    });
  });

  it('preserves multi-value metadata for audience and lookup fields', () => {
    expect(createBetterListFieldMapping(field('Audience', 'User', true), 'audience')).toMatchObject({
      kind: 'person',
      multi: true
    });
    expect(createBetterListFieldMapping(field('Topics', 'LookupMulti'), 'category')).toMatchObject({
      kind: 'lookup',
      multi: true
    });
  });

  it('persists the selected lookup-target column in the field mapping', () => {
    expect(
      createBetterListFieldMapping(
        {
          ...field('Category', 'Lookup'),
          lookupField: 'Title',
          lookupListId: '26b8db39-7a13-4fe5-9a88-bdbfe54676a4'
        },
        undefined,
        'Description'
      )
    ).toMatchObject({
      kind: 'lookup',
      internalName: 'Category',
      lookupValueField: 'Description'
    });
  });

  it('keeps the stable internal path while persisting the SharePoint query alias', () => {
    expect(createBetterListFieldMapping({
      ...field('_UIVersionString', 'Computed'),
      queryName: 'OData__UIVersionString'
    })).toMatchObject({
      internalName: '_UIVersionString',
      queryName: 'OData__UIVersionString'
    });
  });

  it('authors Person fields through safe lookup-like target properties', () => {
    const person = field('PoC', 'User');
    expect(createBetterListFieldPathCatalog([person]).map((option) => option.fieldPath)).toEqual([
      'PoC/Title',
      'PoC/EMail',
      'PoC/Id'
    ]);
    expect(createBetterListFieldMapping(person, undefined, 'EMail')).toMatchObject({
      kind: 'person',
      internalName: 'PoC',
      valueProperty: 'email'
    });
    expect(createBetterListFieldMapping(person)).toMatchObject({
      kind: 'person',
      valueProperty: 'title'
    });
  });

  it('canonicalizes legacy dotted Person paths without changing their meaning', () => {
    const person = field('PoC', 'User');
    expect(createBetterListMetadataMappings([person], ['PoC.EMail'])).toEqual([
      expect.objectContaining({
        key: 'PoC/EMail',
        label: 'PoC → Email',
        mapping: expect.objectContaining({
          fieldPath: 'PoC/EMail',
          personValueField: 'EMail',
          valueProperty: 'email'
        })
      })
    ]);
  });

  it('authors discovered Person properties for batch resolution through the user information list', () => {
    const person: IBetterListFieldDescriptor = {
      ...field('PoC', 'User'),
      lookupListId: '26b8db39-7a13-4fe5-9a88-bdbfe54676a4',
      lookupFields: [{
        ...field('Department', 'Text'),
        title: 'Department',
        queryName: 'DepartmentAlias'
      }]
    };

    const mapping = createBetterListFieldMapping(person, undefined, 'Department');
    expect(mapping).toMatchObject({
      fieldPath: 'PoC/Department',
      personValueField: 'Department',
      relationship: {
        kind: 'person',
        lookupListId: '26b8db39-7a13-4fe5-9a88-bdbfe54676a4',
        target: {
          internalName: 'Department',
          queryName: 'DepartmentAlias',
          queryable: false,
          resolution: 'userInfoBatch'
        }
      }
    });
    expect(mapping.kind === 'person' ? mapping.lookupValueField : undefined).toBeUndefined();
  });

  it('deduplicates exact field identities and disambiguates repeated display titles', () => {
    const catalog = createBetterListFieldCatalog([
      { ...field('Title', 'Text'), title: 'Title' },
      { ...field('Title', 'Text'), title: 'Title duplicate row' },
      { ...field('Title0', 'Text'), title: 'Title' }
    ]);
    expect(catalog.map((entry) => entry.internalName)).toEqual(['Title', 'Title0']);
    expect(createBetterListFieldPathCatalog(catalog).map((entry) => entry.label)).toEqual([
      'Title (Title)',
      'Title (Title0)'
    ]);
  });

  it('groups nested column references for menus without shortening canonical labels', () => {
    const category: IBetterListFieldDescriptor = {
      ...field('Category', 'Lookup'),
      lookupFields: [
        { ...field('Title', 'Text'), title: 'Title' },
        { ...field('Active', 'Boolean'), title: 'Active' }
      ]
    };
    const options = createBetterListFieldPathCatalog([
      field('Modified', 'DateTime'),
      category
    ]);
    const groups = createBetterListColumnReferenceMenuGroups(options);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBeUndefined();
    expect(groups[0]).toMatchObject({
      options: [{ fieldPath: 'Modified', label: 'Modified', menuLabel: 'Modified' }]
    });
    expect(groups[1]).toMatchObject({
      label: 'Category',
      options: [
        { fieldPath: 'Category/Title', label: 'Category → Title', menuLabel: 'Title' },
        { fieldPath: 'Category/Active', label: 'Category → Active', menuLabel: 'Active' }
      ]
    });
    expect(groups[1].options.map(getBetterListColumnReferenceMenuLabel)).toEqual([
      'Title',
      'Active'
    ]);
  });

  it('derives compact menu labels for persisted column references that only carry full labels', () => {
    const options = [
      { fieldPath: 'Category/Active', label: 'Category → Active' },
      { fieldPath: 'Category/SortOrder', label: 'Category → Sort order' }
    ];
    const [group] = createBetterListColumnReferenceMenuGroups(options);

    expect(group.label).toBe('Category');
    expect(group.options.map(getBetterListColumnReferenceMenuLabel)).toEqual([
      'Active',
      'Sort order'
    ]);
    expect(group.options.map((option) => option.label)).toEqual([
      'Category → Active',
      'Category → Sort order'
    ]);
  });

  it('uses explicit menu labels when SharePoint titles contain the context separator', () => {
    const options = [{
      fieldPath: 'Category/Active',
      label: 'Category → Parent → Active → state',
      parentLabel: 'Category → Parent',
      menuLabel: 'Active → state'
    }];
    const [group] = createBetterListColumnReferenceMenuGroups(options);

    expect(group.label).toBe('Category → Parent');
    expect(getBetterListColumnReferenceMenuLabel(group.options[0])).toBe('Active → state');
    expect(group.options[0].label).toBe('Category → Parent → Active → state');
  });

  it('persists disambiguated parent and leaf labels for runtime column menus', () => {
    const fields: readonly IBetterListFieldDescriptor[] = [
      {
        ...field('CategoryPrimary', 'Lookup'),
        title: 'Category',
        lookupFields: [
          { ...field('ActivePrimary', 'Boolean'), title: 'Active' },
          { ...field('ActiveLegacy', 'Boolean'), title: 'Active' }
        ]
      },
      {
        ...field('CategorySecondary', 'Lookup'),
        title: 'Category',
        lookupFields: [
          { ...field('Active', 'Boolean'), title: 'Active' }
        ]
      }
    ];

    expect(createBetterListMetadataMappings(fields, [
      'CategoryPrimary/ActivePrimary',
      'CategorySecondary/Active'
    ])).toEqual([
      expect.objectContaining({
        key: 'CategoryPrimary/ActivePrimary',
        label: 'Category (CategoryPrimary) → Active (ActivePrimary)',
        menuLabel: 'Active (ActivePrimary)',
        parentLabel: 'Category (CategoryPrimary)'
      }),
      expect.objectContaining({
        key: 'CategorySecondary/Active',
        label: 'Category (CategorySecondary) → Active',
        menuLabel: 'Active',
        parentLabel: 'Category (CategorySecondary)'
      })
    ]);
  });

  it.each([
    ['Title', 'Text', 'text'],
    ['Active', 'Boolean', 'boolean'],
    ['Priority', 'Number', 'number'],
    ['Published', 'DateTime', 'dateTime']
  ])('maps %s (%s) to the %s scalar kind', (internalName, typeAsString, kind) => {
    expect(createBetterListFieldMapping(field(internalName, typeAsString))).toMatchObject({ kind });
  });

  it('replaces or clears one slot without discarding metadata mappings', () => {
    const mappings = {
      title: createBetterListFieldMapping(field('Title', 'Text'), 'title'),
      description: createBetterListFieldMapping(field('Description', 'Note'), 'description'),
      metadata: [
        {
          key: 'department',
          label: 'Department',
          mapping: createBetterListFieldMapping(field('Department', 'Text'))
        }
      ]
    };

    const remapped = updateBetterListFieldMapping(
      mappings,
      'description',
      field('OrgFullName', 'Text')
    );
    expect(remapped.description?.internalName).toBe('OrgFullName');
    expect(remapped.metadata).toEqual(mappings.metadata);

    const cleared = updateBetterListFieldMapping(remapped, 'description');
    expect(cleared.description).toBeUndefined();
    expect(cleared.metadata).toEqual(mappings.metadata);
  });

  it('includes link-only fields once in item metadata mappings', () => {
    const fields = [
      field('Title', 'Text'),
      field('Description', 'Note'),
      field('URL', 'URL')
    ];

    expect(createBetterListMetadataMappings(fields, ['Description', 'URL', 'URL'])).toEqual([
      expect.objectContaining({ key: 'Description', label: 'Description' }),
      expect.objectContaining({ key: 'URL', label: 'URL' })
    ]);
  });
});
