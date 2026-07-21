import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { IBetterListTabConfig } from '../../../../shared';
import { IBetterListTabFilterField, reorderTabsById, TabBuilder } from './TabBuilder';

describe('TabBuilder', () => {
  it('renders compact, accessible tab disclosures and the simplified filter copy', () => {
    const fields: readonly IBetterListTabFilterField[] = [
      { id: 'featured', key: 'featured', kind: 'boolean', label: 'Featured' }
    ];
    const tabs: readonly IBetterListTabConfig[] = [
      { id: 'featured', label: 'Featured', filter: { kind: 'query', expression: 'Featured = true', fields: [] } },
      { id: 'all-services', label: 'All Services', filter: { kind: 'all' } }
    ];

    const html = renderToStaticMarkup(<TabBuilder fields={fields} showAddAction={false} tabs={tabs} onChange={() => undefined} />);

    expect(html).toContain('fui-Accordion');
    expect(html).toContain('fui-AccordionItem');
    expect(html).toContain('fui-AccordionHeader');
    expect(html).toContain('fui-AccordionPanel');
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(2);
    expect(html).toContain('<legend>Filter items</legend>');
    expect(html).toContain('placeholder="All items"');
    expect(html).not.toContain('Items to show');
    expect(html).not.toContain('Leave empty for all items');
    expect(html).not.toContain('All items — try Featured = true');
    expect(html.match(/data-tab-remove="true"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Remove Featured"');
    expect(html).toContain('aria-label="Remove All Services"');
    expect(html).toContain('aria-label="Reorder Featured"');
    expect(html).toContain('aria-label="Reorder All Services"');
    expect(html).not.toContain('Move Featured up');
    expect(html).not.toContain('Move Featured down');
    expect(html).toContain('.bl-tabs-builder__card-heading { border-bottom: 0;');
    expect(html).not.toContain('>×<');
  });

  it('reorders tabs by stable id without mutating the source', () => {
    const tabs: readonly IBetterListTabConfig[] = [
      { id: 'featured', label: 'Featured', filter: { kind: 'all' } },
      { id: 'all-services', label: 'All Services', filter: { kind: 'all' } }
    ];

    const reordered = reorderTabsById(tabs, 'featured', 'all-services');

    expect(reordered.map((tab) => tab.id)).toEqual(['all-services', 'featured']);
    expect(tabs.map((tab) => tab.id)).toEqual(['featured', 'all-services']);
    expect(reorderTabsById(tabs, 'missing', 'featured')).toBe(tabs);
  });
});
