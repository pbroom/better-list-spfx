import {
  betterListMaxItemRows,
  flattenItemLayoutRows,
  formatItemPropertyValue,
  getItemPropertyUrl,
  parseItemLayoutRows,
  parseItemPropertyFields,
  serializeItemLayoutRows,
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
});
