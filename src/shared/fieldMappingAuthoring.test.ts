import {
  createBetterListFieldMapping,
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
});
