import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import BetterListView, { IBetterListItem, IBetterListTab } from './BetterListView';

const item: IBetterListItem = {
  id: '1',
  title: 'Service title',
  description: 'Service description',
  metadata: ['Organization'],
  elements: [
    { key: 'Description', kind: 'description', value: 'Service description' },
    { key: 'Organization', kind: 'metadata', value: 'Organization' }
  ],
  groupId: 'general',
  groupTitle: 'General'
};

describe('BetterListView', () => {
  it('hides the single baseline tab and does not render a group heading when grouping is disabled', () => {
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'all',
        label: 'All items',
        grouped: false,
        layout: { showSearch: false },
        items: [item]
      }
    ];

    const html = renderToStaticMarkup(
      <BetterListView activeTabKey="all" items={[item]} tabs={tabs} />
    );

    expect(html).not.toContain('Better List views');
    expect(html).not.toContain('General');
    expect(html).not.toContain('better-list__group-heading');
    expect(html).toContain('Service title');
  });

  it('renders configured item elements in their authored order', () => {
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'all',
        label: 'All items',
        grouped: false,
        layout: { showSearch: false },
        items: [item]
      }
    ];

    const html = renderToStaticMarkup(
      <BetterListView activeTabKey="all" items={[item]} tabs={tabs} />
    );

    expect(html.indexOf('Service title')).toBeLessThan(html.indexOf('Service description'));
    expect(html.indexOf('Service description')).toBeLessThan(html.indexOf('Organization'));
  });
});
