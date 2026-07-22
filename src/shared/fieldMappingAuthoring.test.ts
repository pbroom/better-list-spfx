import {
  createBetterListFieldCatalog,
  createBetterListFieldMapping,
  createBetterListFieldPathCatalog,
  createBetterListMetadataMappings,
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
