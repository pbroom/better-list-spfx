import {
  defaultBetterListHtmlTemplate,
  parseBetterListTemplate,
  resolveBetterListTemplate,
  substituteBetterListTokens,
  validateBetterListTemplate
} from './betterListTemplate';

describe('Better List HTML templates', () => {
  it('compiles the built-in shell, group, list, and item fragments', () => {
    const result = parseBetterListTemplate(defaultBetterListHtmlTemplate);

    expect(result.diagnostics).toEqual([]);
    expect(Object.keys(result.template?.fragments || {})).toEqual(['shell', 'group', 'list', 'item']);
  });

  it.each([
    ['missing fragment', defaultBetterListHtmlTemplate.replace(/<template data-bl-fragment="group">[\s\S]*?<\/template>\s*/, '')],
    [
      'duplicate fragment',
      `${defaultBetterListHtmlTemplate}\n${fragment('item', '<li><span data-bl-slot="title"></span><div data-bl-slot="properties"></div></li>')}`
    ],
    ['unknown fragment', defaultBetterListHtmlTemplate.replace('data-bl-fragment="item"', 'data-bl-fragment="card"')],
    ['missing slot', defaultBetterListHtmlTemplate.replace('<span data-bl-slot="search"></span>', '')],
    [
      'duplicate slot',
      defaultBetterListHtmlTemplate.replace(
        '<span data-bl-slot="search"></span>',
        '<span data-bl-slot="search"></span><span data-bl-slot="search"></span>'
      )
    ],
    ['unknown slot', defaultBetterListHtmlTemplate.replace('data-bl-slot="properties"', 'data-bl-slot="loop"')]
  ])('rejects invalid schema: %s', (_label, source) => {
    expect(parseBetterListTemplate(source).template).toBeUndefined();
  });

  it.each([
    ['script', '<script>alert(1)</script>'],
    ['style element', '<style>.x{}</style>'],
    ['form', '<form></form>'],
    ['interactive element', '<button>Click</button>'],
    ['media element', '<img src="x">'],
    ['svg', '<svg></svg>'],
    ['mathml', '<math></math>']
  ])('rejects forbidden element: %s', (_label, element) => {
    const source = defaultBetterListHtmlTemplate.replace(
      '<span data-bl-slot="title"></span>',
      `${element}<span data-bl-slot="title"></span>`
    );
    expect(parseBetterListTemplate(source).template).toBeUndefined();
  });

  it.each([
    ['event handler', 'onclick="alert(1)"'],
    ['inline style', 'style="display:none"'],
    ['id', 'id="override"'],
    ['URL', 'href="https://example.com"'],
    ['tabindex', 'tabindex="0"'],
    ['runtime data attribute', 'data-bl-runtime="override"'],
    ['reserved runtime data attribute', 'data-selected-tab="override"'],
    ['runtime aria attribute', 'aria-controls="override"']
  ])('rejects forbidden attribute: %s', (_label, attribute) => {
    const source = defaultBetterListHtmlTemplate.replace(
      '<li>\n    <span data-bl-slot="title">',
      `<li ${attribute}>\n    <span data-bl-slot="title">`
    );
    expect(messages(source).join(' ')).toContain('not allowed');
  });

  it('allows only context-specific tokens in text and safe display attributes', () => {
    const valid = defaultBetterListHtmlTemplate
      .replace('<section>', '<section title="{{list.title}}" aria-label="{{tab.label}}" data-count="{{results.count}}">')
      .replace('<li>\n    <span data-bl-slot="title">', '<li title="{{item.title}}">{{item.id}}<span data-bl-slot="title">');
    expect(parseBetterListTemplate(valid).diagnostics).toEqual([]);

    const invalidContext = defaultBetterListHtmlTemplate.replace('<section>', '<section>{{item.title}}');
    expect(messages(invalidContext).join(' ')).toContain('not allowed');

    const unknown = defaultBetterListHtmlTemplate.replace('<li>', '<li>{{item.source.Secret}}');
    expect(messages(unknown).join(' ')).toContain('not allowed');

    const classToken = defaultBetterListHtmlTemplate.replace(
      '<li>',
      '<li class="item-{{item.id}}">'
    );
    expect(messages(classToken).join(' ')).toContain('class attributes');
  });

  it('rejects malformed markup and oversized UTF-8 source', () => {
    expect(messages(defaultBetterListHtmlTemplate.replace('</li>', '</div>')).join(' ')).toContain('Malformed HTML');
    expect(
      validateBetterListTemplate(`${defaultBetterListHtmlTemplate}${'é'.repeat(20_000)}`)
        .map((diagnostic) => diagnostic.message)
        .join(' ')
    ).toContain('32 KB');
  });

  it('accepts greater-than signs in text and quoted attributes', () => {
    const source = defaultBetterListHtmlTemplate.replace(
      '<li>',
      '<li title="A > B"><p>Count > 0 and 1 < 2</p>'
    );

    expect(parseBetterListTemplate(source).diagnostics).toEqual([]);
  });

  it('falls back to the built-in template for corrupt persisted source', () => {
    const resolved = resolveBetterListTemplate('<script>bad()</script>');
    expect(resolved.source).toBe(defaultBetterListHtmlTemplate);
  });

  it('substitutes tokens as plain display values', () => {
    expect(
      substituteBetterListTokens('{{item.title}} / {{item.id}}', {
        'item.title': '<em>unsafe</em>',
        'item.id': 7
      })
    ).toBe('<em>unsafe</em> / 7');
  });
});

function fragment(name: string, body: string): string {
  return `<template data-bl-fragment="${name}">${body}</template>`;
}

function messages(source: string): string[] {
  return parseBetterListTemplate(source).diagnostics.map((diagnostic) => diagnostic.message);
}
