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
