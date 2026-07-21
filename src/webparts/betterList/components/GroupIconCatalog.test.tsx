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

  it('applies a persisted icon color override to currentColor artwork', () => {
    const markup = renderToStaticMarkup(
      <BetterListGroupIconVisual
        override={{ kind: 'icon', library: 'solar-duotone', name: 'people', color: '#245a8d' }}
      />
    );

    expect(markup).toContain('style="color:#245a8d"');
  });

  it('applies a persisted color override to Fluent monochrome artwork', () => {
    const markup = renderToStaticMarkup(
      <BetterListGroupIconVisual
        override={{ kind: 'icon', library: 'fluent', name: 'mail', color: '#245a8d' }}
      />
    );

    expect(markup).toContain('style="color:#245a8d"');
  });

  it('applies the default color to monochrome artwork without an individual override', () => {
    const markup = renderToStaticMarkup(
      <BetterListGroupIconVisual
        defaultColor="#0f6cbd"
        override={{ kind: 'icon', library: 'fluent', name: 'mail' }}
      />
    );

    expect(markup).toContain('style="color:#0f6cbd"');
  });

  it('keeps the individual color ahead of the default color', () => {
    const markup = renderToStaticMarkup(
      <BetterListGroupIconVisual
        defaultColor="#0f6cbd"
        override={{ kind: 'icon', library: 'solar-duotone', name: 'people', color: '#245a8d' }}
      />
    );

    expect(markup).toContain('style="color:#245a8d"');
    expect(markup).not.toContain('style="color:#0f6cbd"');
  });

  it('leaves Fluent color artwork on its built-in palette', () => {
    const markup = renderToStaticMarkup(
      <BetterListGroupIconVisual
        defaultColor="#0f6cbd"
        override={{ kind: 'icon', library: 'fluent-color', name: 'mail', color: '#245a8d' }}
      />
    );

    expect(markup).not.toContain('style="color:#245a8d"');
    expect(markup).not.toContain('style="color:#0f6cbd"');
  });
});
