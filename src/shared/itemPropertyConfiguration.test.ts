import {
  formatItemPropertyValue,
  getItemPropertyUrl,
  parseItemPropertyFields,
  serializeItemPropertyFields
} from './itemPropertyConfiguration';

describe('item property configuration', () => {
  it('always starts with one required Title field', () => {
    expect(parseItemPropertyFields('["Description","Title","Description"]')).toEqual([
      'Title',
      'Description'
    ]);
    expect(parseItemPropertyFields('not json')).toEqual(['Title']);
  });

  it('serializes a normalized ordered shape', () => {
    expect(serializeItemPropertyFields(['Title', 'Org', 'Org', 'Active'])).toBe(
      '["Title","Org","Active"]'
    );
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
