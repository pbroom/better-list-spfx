import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { IBetterListTabConfig } from '../../../../shared';
import { IBetterListTabFilterField, TabBuilder } from './TabBuilder';

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

    expect(html).toContain('aria-label="Collapse Tab 1"');
    expect(html).toContain('aria-label="Collapse Tab 2"');
    expect(html).toContain('<legend>Filter items</legend>');
    expect(html).toContain('placeholder="All items"');
    expect(html).not.toContain('Items to show');
    expect(html).not.toContain('Leave empty for all items');
    expect(html).not.toContain('All items — try Featured = true');
  });
});
