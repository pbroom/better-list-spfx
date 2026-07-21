import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { solarGroupIcons } from './SolarGroupIconData';
import { BetterListGroupIconVisual } from './GroupIconCatalog';

describe('BetterListGroupIconVisual', () => {
  it.each(Object.keys(solarGroupIcons))('renders the curated Solar %s artwork', name => {
    const markup = renderToStaticMarkup(
      <BetterListGroupIconVisual override={{ kind: 'icon', library: 'solar-duotone', name }} />
    );

    expect(markup).toContain('<svg');
    expect(markup).toMatch(/<(?:circle|ellipse|path)\b/);
  });

  it('preserves non-path Solar primitives', () => {
    const markup = renderToStaticMarkup(
      <BetterListGroupIconVisual override={{ kind: 'icon', library: 'solar-duotone', name: 'people' }} />
    );

    expect(markup).toContain('<circle');
    expect(markup).toContain('<ellipse');
  });
});
