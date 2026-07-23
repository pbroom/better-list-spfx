import { defaultBetterListScss, scopeBetterListStyles } from './betterListStyles';

describe('Better List author styles', () => {
  it('contains the stable visual targets rendered by the web part', () => {
    expect(defaultBetterListScss).toContain('.better-list__toolbar');
    expect(defaultBetterListScss).toContain('.better-list__search-controls');
    expect(defaultBetterListScss).toContain('.better-list__sort');
    expect(defaultBetterListScss).toContain('.better-list__group-button');
    expect(defaultBetterListScss).toContain('.better-list__item-description');
    expect(defaultBetterListScss).toContain('.better-list__item-row');
    expect(defaultBetterListScss).toContain('@media (max-width: 760px)');
    expect(defaultBetterListScss.match(/\.better-list__group \{([^}]*)\}/)?.[1]).not.toContain('border');
    expect(defaultBetterListScss.match(/\.better-list__item \{([^}]*)\}/)?.[1]).not.toContain('border');
  });

  it('contains broad element and role selectors in the instance scope', () => {
    const source = 'button, [role="tooltip"], .fui-Button { color: red; }';

    expect(scopeBetterListStyles(source, '.instance')).toBe(`@scope (.instance) {\n${source}\n}`);
  });

  it('keeps nested media rules inside the instance scope', () => {
    const source = '@media (max-width: 760px) {\n  button, [role="tooltip"] { display: none; }\n}';

    expect(scopeBetterListStyles(source, '.instance')).toBe(`@scope (.instance) {\n${source}\n}`);
  });

  it('contains similarly named selectors without rewriting them', () => {
    const source = '.better-list, .better-list__item, .better-list-lab, .better-list-row-1 {}';

    expect(scopeBetterListStyles(source, '.instance')).toBe(`@scope (.instance) {\n${source}\n}`);
  });

  it('isolates identical styles under different instance scopes', () => {
    const source = '.better-list, button { color: red; }';

    expect(scopeBetterListStyles(source, '.instance-one')).toBe(`@scope (.instance-one) {\n${source}\n}`);
    expect(scopeBetterListStyles(source, '.instance-two')).toBe(`@scope (.instance-two) {\n${source}\n}`);
  });
});
