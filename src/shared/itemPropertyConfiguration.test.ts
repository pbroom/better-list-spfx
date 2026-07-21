import {
  betterListMaxItemRows,
  flattenItemLayoutRows,
  formatItemPropertyValue,
  getItemPropertyUrl,
  parseItemLayoutConfiguration,
  parseItemLayoutRows,
  parseItemPropertyFields,
  removeItemLayoutRow,
  serializeItemLayoutRows,
  serializeItemLayoutConfiguration,
  serializeItemPropertyFields
} from './itemPropertyConfiguration';

describe('item property configuration', () => {
  it('preserves authored order, permits an empty selection, and defaults invalid legacy data to Title', () => {
    expect(parseItemPropertyFields('["Description","Title","Description"]')).toEqual([
      'Description',
      'Title'
    ]);
    expect(parseItemPropertyFields('[]')).toEqual([]);
    expect(parseItemPropertyFields(undefined)).toEqual(['Title']);
    expect(parseItemPropertyFields('not json')).toEqual(['Title']);
  });

  it('serializes a normalized ordered shape', () => {
    expect(serializeItemPropertyFields(['Title', 'Org', 'Org', 'Active'])).toBe(
      '["Title","Org","Active"]'
    );
  });

  it('keeps legacy item properties flat until a row is explicitly added', () => {
    const properties = ['Title', 'Description', 'Category.Title'];

    expect(parseItemLayoutRows(undefined, properties)).toEqual([]);
    expect(parseItemLayoutRows('not json', properties)).toEqual([]);
  });

  it('normalizes row membership without pinning Title, appends missing properties to row one, and caps at five rows', () => {
    const properties = ['Title', 'Description', 'Category.Title', 'Owner'];
    const serialized = JSON.stringify([
      ['Description', 'Description', 'Unknown'],
      ['Category.Title', 'Title'],
      [],
      ['Owner'],
      [],
      []
    ]);

    const rows = parseItemLayoutRows(serialized, properties);

    expect(rows).toHaveLength(betterListMaxItemRows);
    expect(rows).toEqual([
      ['Description'],
      ['Category.Title', 'Title'],
      [],
      ['Owner'],
      []
    ]);
    expect(flattenItemLayoutRows(rows)).toEqual(['Description', 'Category.Title', 'Title', 'Owner']);
    expect(serializeItemLayoutRows(rows, properties)).toBe(JSON.stringify(rows));
  });

  it('allows Title to be removed from an explicit row layout', () => {
    expect(parseItemLayoutRows('[[],["Description"]]', ['Description'])).toEqual([
      [],
      ['Description']
    ]);
  });

  it('migrates the legacy hidden URL property to an explicit Title link', () => {
    expect(parseItemLayoutConfiguration('[["Title","URL"]]', ['Title', 'URL'])).toEqual({
      itemProperties: ['Title'],
      rows: [['Title']],
      links: { Title: 'URL' }
    });
  });

  it('round-trips explicit links for any selected item element', () => {
    const serialized = serializeItemLayoutConfiguration(
      [['Description', 'Title']],
      ['Description', 'Title'],
      { Description: 'DetailsLink', Title: 'URL', Removed: 'URL' }
    );

    expect(parseItemLayoutConfiguration(serialized, ['Description', 'Title'])).toEqual({
      itemProperties: ['Description', 'Title'],
      rows: [['Description', 'Title']],
      links: { Description: 'DetailsLink', Title: 'URL' }
    });
  });

  it('preserves authored reading order when removing the first or a later row', () => {
    const properties = ['Title', 'Category', 'Description', 'Owner'];
    const rows = [['Title'], ['Category', 'Description'], ['Owner']];

    expect(removeItemLayoutRow(rows, 0, properties)).toEqual([
      ['Title', 'Category', 'Description'],
      ['Owner']
    ]);
    expect(removeItemLayoutRow(rows, 1, properties)).toEqual([
      ['Title', 'Category', 'Description'],
      ['Owner']
    ]);
    expect(removeItemLayoutRow(rows, 2, properties)).toEqual([
      ['Title'],
      ['Category', 'Description', 'Owner']
    ]);
  });

  it('formats scalar, lookup, person, and hyperlink values', () => {
    const source = {
      Active: true,
      Category: { Title: 'General' },
      Audience: [{ Title: 'Alex' }, { Title: 'Morgan' }],
      URL: { Url: 'https://contoso.example', Description: 'Open service' }
    };

    expect(formatItemPropertyValue(source, 'Active')).toBe('Yes');
    expect(formatItemPropertyValue(source, 'Category.Title')).toBe('General');
    expect(formatItemPropertyValue(source, 'Audience')).toBe('Alex, Morgan');
    expect(formatItemPropertyValue(source, 'URL')).toBe('Open service');
    expect(getItemPropertyUrl(source, 'URL')).toBe('https://contoso.example');
  });

  it('rejects unsafe hyperlink protocols', () => {
    expect(getItemPropertyUrl({ URL: { Url: `java${'script'}:alert(1)` } }, 'URL')).toBeUndefined();
    expect(
      getItemPropertyUrl({ URL: { Url: ['java', '\n', 'script:alert(1)'].join('') } }, 'URL')
    ).toBeUndefined();
    expect(getItemPropertyUrl({ URL: { Url: 'data:text/html,unsafe' } }, 'URL')).toBeUndefined();
    expect(getItemPropertyUrl({ URL: { Url: 'mailto:help@contoso.example' } }, 'URL')).toBe(
      'mailto:help@contoso.example'
    );
  });
});
