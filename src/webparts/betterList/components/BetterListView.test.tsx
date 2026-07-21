/* eslint-disable @typescript-eslint/no-use-before-define -- Shared fixture markup is declared after the behavior cases for readability. */
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

    const html = renderToStaticMarkup(<BetterListView activeTabKey="all" items={[item]} tabs={tabs} />);

    expect(html).not.toContain('Better List views');
    expect(html).not.toContain('General');
    expect(html).not.toContain('better-list__group-heading');
    expect(html).toContain('Service title');
  });

  it('renders optional tab icons and counts', () => {
    const tabs: readonly IBetterListTab[] = [
      { key: 'featured', label: 'Featured', icon: 'communications', itemCount: 4, showItemCount: true, items: [item] },
      { key: 'all', label: 'All items', itemCount: 12, items: [item] }
    ];

    const html = renderToStaticMarkup(<BetterListView activeTabKey="featured" items={[item]} tabs={tabs} />);

    expect(html).toContain('Featured (4)');
    expect(html).toContain('<svg');
    expect(html).toContain('All items');
    expect(html).not.toContain('All items (12)');
  });

  it('applies a tab item maximum after filtering while retaining the full item count', () => {
    const first = { ...item, id: 'first', title: 'A service' };
    const second = { ...item, id: 'second', title: 'B service' };
    const tabs: readonly IBetterListTab[] = [
      { key: 'limited', label: 'Limited', itemCount: 2, maxItems: 1, showItemCount: true, items: [first, second] },
      { key: 'all', label: 'All', items: [first, second] }
    ];

    const html = renderToStaticMarkup(<BetterListView activeTabKey="limited" items={[first, second]} tabs={tabs} />);

    expect(html).toContain('Limited (2)');
    expect(html).toContain('A service');
    expect(html).not.toContain('B service');
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

    const html = renderToStaticMarkup(<BetterListView activeTabKey="all" items={[item]} tabs={tabs} />);

    expect(html.indexOf('Service title')).toBeLessThan(html.indexOf('Service description'));
    expect(html.indexOf('Service description')).toBeLessThan(html.indexOf('Organization'));
    expect(html).not.toContain('better-list-row-1');
  });

  it('links Title and other item elements to their independently configured hyperlinks', () => {
    const linkedItem: IBetterListItem = {
      ...item,
      href: 'https://contoso.example/title',
      elements: [
        {
          key: 'Description',
          kind: 'description',
          value: 'Service description',
          href: 'https://contoso.example/description'
        },
        {
          key: 'Organization',
          kind: 'metadata',
          value: 'Organization',
          href: 'https://contoso.example/organization'
        }
      ]
    };
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'all',
        label: 'All items',
        grouped: false,
        layout: { showSearch: false },
        items: [linkedItem]
      }
    ];

    const html = renderToStaticMarkup(
      <BetterListView
        activeTabKey="all"
        itemLayoutRows={[["Title"], ["Description", "Organization"]]}
        items={[linkedItem]}
        tabs={tabs}
      />
    );

    expect(html).toContain('href="https://contoso.example/title"');
    expect(html).toContain('href="https://contoso.example/description"');
    expect(html).toContain('href="https://contoso.example/organization"');
  });

  it('renders configured flex rows in authored order, including a moved Title, and keeps empty rows addressable', () => {
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
      <BetterListView
        activeTabKey="all"
        itemLayoutRows={[
          ['Organization'],
          ['Description', 'Title'],
          []
        ]}
        items={[item]}
        tabs={tabs}
      />
    );

    expect(html).toContain('better-list-row-1');
    expect(html).toContain('better-list-row-2');
    expect(html).toContain('better-list-row-3');
    expect(html).toContain('data-item-row="3"');
    expect(html.indexOf('Organization')).toBeLessThan(html.indexOf('Service description'));
    expect(html.indexOf('Service description')).toBeLessThan(html.indexOf('Service title'));
  });

  it('omits Title when it is removed and keeps the remaining row layout', () => {
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'all',
        label: 'All items',
        grouped: false,
        layout: { showSearch: false },
        items: [item]
      }
    ];

    const rowHtml = renderToStaticMarkup(
      <BetterListView
        activeTabKey="all"
        itemLayoutRows={[['Organization'], []]}
        itemPropertyFields={['Organization']}
        items={[item]}
        tabs={tabs}
      />
    );
    const emptyHtml = renderToStaticMarkup(
      <BetterListView
        activeTabKey="all"
        itemPropertyFields={[]}
        items={[{ ...item, elements: [] }]}
        tabs={tabs}
      />
    );

    expect(rowHtml).not.toContain('Service title');
    expect(rowHtml).toContain('Organization');
    expect(rowHtml).toContain('better-list-row-2');
    expect(emptyHtml).not.toContain('Service title');
  });

  it('renders custom shell, list, and item wrappers with escaped display tokens', () => {
    const unsafeItem = {
      ...item,
      id: 'unsafe-id',
      title: '<img src=x onerror=alert(1)>',
      description: '<strong>description</strong>'
    };
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'all',
        label: 'All items',
        grouped: false,
        layout: { showSearch: false },
        items: [unsafeItem]
      }
    ];

    const html = renderToStaticMarkup(
      <BetterListView
        activeTabKey="all"
        htmlTemplate={customTemplate}
        items={[unsafeItem]}
        listTitle="Services & support"
        tabs={tabs}
      />
    );

    expect(html).toContain('<main');
    expect(html).toContain('custom-shell');
    expect(html).toContain('title="Services &amp; support"');
    expect(html).toContain('data-item="unsafe-id"');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('better-list__item');
  });

  it('forwards authored items-slot attributes to each rendered item root', () => {
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'all',
        label: 'All items',
        grouped: false,
        layout: { showSearch: false },
        items: [item]
      }
    ];
    const template = customTemplate.replace(
      '<li data-bl-slot="items"></li>',
      '<li class="slot-item" data-template-item="true" data-bl-slot="items"></li>'
    );

    const html = renderToStaticMarkup(
      <BetterListView activeTabKey="all" htmlTemplate={template} items={[item]} tabs={tabs} />
    );

    expect(html).toContain('class="custom-item slot-item');
    expect(html).toContain('data-template-item="true"');
  });

  it('renders grouped wrappers and group tokens while preserving trusted collapse semantics', () => {
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'grouped',
        label: 'Grouped',
        grouped: true,
        layout: { showSearch: false, collapsible: true },
        items: [item]
      }
    ];

    const html = renderToStaticMarkup(
      <BetterListView activeTabKey="grouped" htmlTemplate={customTemplate} items={[item]} tabs={tabs} />
    );

    expect(html).toContain('custom-group');
    expect(html).toContain('General (1)');
    expect(html).toContain('aria-controls=');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="region"');
  });

  it('falls back to the built-in template when persisted source is corrupt', () => {
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
      <BetterListView activeTabKey="all" htmlTemplate="<script>alert(1)</script>" items={[item]} tabs={tabs} />
    );

    expect(html).toContain('better-list__header');
    expect(html).toContain('better-list__items');
    expect(html).toContain('Service title');
    expect(html).not.toContain('<script>');
  });

  it.each([
    ['loading', 'Loading list items'],
    ['error', 'Unable to load the list'],
    ['ready', 'There are no list items to display.']
  ] as const)('keeps trusted %s state rendering inside a custom content slot', (status, expected) => {
    const html = renderToStaticMarkup(
      <BetterListView activeTabKey="all" htmlTemplate={customTemplate} items={[]} status={status} tabs={[]} />
    );

    expect(html).toContain('custom-content');
    expect(html).toContain(expected);
  });
});

const customTemplate = `<template data-bl-fragment="shell">
  <main class="custom-shell" title="{{list.title}}">
    <span data-bl-slot="tabs"></span>
    <span data-bl-slot="search"></span>
    <p data-results="{{results.count}}">{{tab.label}}</p>
    <div class="custom-content" data-bl-slot="content"></div>
  </main>
</template>
<template data-bl-fragment="group">
  <article class="custom-group">
    <p>{{group.title}} ({{group.count}})</p>
    <h3 data-bl-slot="heading"></h3>
    <div data-bl-slot="body"></div>
  </article>
</template>
<template data-bl-fragment="list">
  <ol class="custom-list"><li data-bl-slot="items"></li></ol>
</template>
<template data-bl-fragment="item">
  <article class="custom-item" data-item="{{item.id}}">
    <span data-bl-slot="title"></span>
    <p>{{item.description}}</p>
    <div data-bl-slot="properties"></div>
  </article>
</template>`;
