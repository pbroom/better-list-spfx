import { defaultBetterListScss, scopeBetterListStyles } from './betterListStyles';

describe('Better List author styles', () => {
  it('contains the stable visual targets rendered by the web part', () => {
    expect(defaultBetterListScss).toContain('.better-list__toolbar');
    expect(defaultBetterListScss).toContain('.better-list__group-button');
    expect(defaultBetterListScss).toContain('.better-list__item-description');
    expect(defaultBetterListScss).toContain('@media (max-width: 760px)');
    expect(defaultBetterListScss.match(/\.better-list__item \{([^}]*)\}/)?.[1]).not.toContain('border');
  });

  it('scopes Better List selectors without rewriting similarly named hosts', () => {
    expect(scopeBetterListStyles('.better-list, .better-list__item {}\n.better-list-lab {}', '.instance')).toBe(
      '.instance .better-list, .instance .better-list__item {}\n.better-list-lab {}'
    );
  });
});
