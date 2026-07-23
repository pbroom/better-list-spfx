import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { IBetterListTabConfig } from '../../../../shared';
import {
  appendNewTab,
  IBetterListTabFilterField,
  reorderTabsById,
  resolveTabNameDraft,
  shouldToggleTabAccordion,
  tabSortKeyboardCodes,
  TabBuilder
} from './TabBuilder';

describe('TabBuilder', () => {
  it('renders compact, accessible tab disclosures and the simplified filter copy', () => {
    const fields: readonly IBetterListTabFilterField[] = [
      { id: 'featured', key: 'featured', kind: 'boolean', label: 'Featured' }
    ];
    const tabs: readonly IBetterListTabConfig[] = [
      {
        id: 'featured',
        label: 'Featured',
        filter: { kind: 'query', expression: 'Featured = true', fields: [] },
        tabIconOverride: { kind: 'icon', library: 'fluent', name: 'megaphone' }
      },
      { id: 'all-services', label: 'All Services', filter: { kind: 'all' } }
    ];

    const html = renderToStaticMarkup(
      <TabBuilder
        fields={fields}
        selectedTabId="featured"
        showAddAction={false}
        tabs={tabs}
        onChange={() => undefined}
      />
    );

    expect(html).toContain('fui-Accordion');
    expect(html).toContain('fui-AccordionItem');
    expect(html).toContain('fui-AccordionHeader');
    expect(html).toContain('fui-AccordionPanel');
    expect(html.match(/data-tab-selected="true"/g)).toHaveLength(1);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(2);
    expect(html).toContain('<legend>Filter items</legend>');
    expect(html).toContain('placeholder="All items"');
    expect(html).not.toContain('Items to show');
    expect(html).not.toContain('Leave empty for all items');
    expect(html).not.toContain('All items — try Featured = true');
    expect(html.match(/data-tab-remove="true"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Remove Featured"');
    expect(html).toContain('aria-label="Remove All Services"');
    expect(html).not.toContain('data-tab-drag-handle');
    expect(html).toContain(
      'aria-label="Tab 1: Featured. Drag to reorder. For keyboard sorting, focus this row and press Space."'
    );
    expect(html).toContain('aria-describedby="tab-featured-header-reorder-help"');
    expect(html).toContain('Drag to reorder. For keyboard sorting, focus this row and press Space.');
    expect(html).toContain('aria-roledescription="sortable"');
    expect(html).toContain('bl-tabs-builder__tab-label');
    expect(html).toContain('bl-tabs-builder__accordion-expand-icon');
    expect(html).toContain('.bl-tabs-builder__tab-label { order: 0; padding-left: var(--spacingHorizontalM); }');
    expect(html).toContain('.bl-tabs-builder .bl-tabs-builder__accordion-expand-icon { flex: 0 0 auto; order: 1;');
    expect(html).toContain('fui-Switch');
    expect(html).toContain('Show item count');
    expect(html).toContain('Megaphone');
    expect(html).toContain('bl-tabs-builder__icon-picker');
    expect(html).toContain('bl-tabs-builder__icon-picker-label');
    expect(html).toContain('title="Megaphone"');
    expect(html).toContain('font-weight: var(--fontWeightRegular);');
    expect(html).toContain('text-overflow: ellipsis; white-space: nowrap;');
    expect(html).not.toContain('<option value="communications">');
    expect(html).not.toContain('Move Featured up');
    expect(html).not.toContain('Move Featured down');
    expect(html).toContain('.bl-tabs-builder:focus-within { z-index: 2; }');
    expect(html).toContain(
      '.bl-tabs-builder__card[data-tab-selected=&quot;true&quot;] { background: #f9fcff; box-shadow: 0 0 0 var(--strokeWidthThin) var(--colorBrandStroke1); }'
    );
    expect(html).toContain('.bl-tabs-builder__card-body { padding: var(--spacingVerticalS) 0 var(--spacingVerticalM); }');
    expect(html).toContain('.bl-tabs-builder__actions { gap: 2px; padding-right: var(--spacingHorizontalS); }');
    expect(html).not.toContain('[data-tab-selected=&quot;true&quot;] &gt; .bl-tabs-builder__card-heading');
    expect(html).toContain('.bl-tabs-builder__card-heading { border-bottom: 0;');
    expect(html).toContain(
      'font-family: var(--bl-font-mono, &quot;Geist Mono Variable&quot;, &quot;Geist Mono&quot;, ui-monospace, SFMono-Regular, Consolas, &quot;Liberation Mono&quot;, monospace) !important;'
    );
    expect(html).not.toContain('>×<');
  });

  it('commits accepted tab-name drafts once and reverts empty drafts', () => {
    expect(resolveTabNameDraft(' Renamed tab ', 'All items')).toEqual({
      draft: 'Renamed tab',
      commit: 'Renamed tab'
    });
    expect(resolveTabNameDraft('All items', 'All items')).toEqual({
      draft: 'All items'
    });
    expect(resolveTabNameDraft('   ', 'All items')).toEqual({
      draft: 'All items'
    });
  });

  it('reserves Enter for disclosure while Space controls keyboard sorting', () => {
    expect(tabSortKeyboardCodes).toEqual({
      start: ['Space'],
      cancel: ['Escape'],
      end: ['Space']
    });
    expect(tabSortKeyboardCodes.start).not.toContain('Enter');
    expect(shouldToggleTabAccordion(true)).toBe(false);
    expect(shouldToggleTabAccordion(false)).toBe(true);
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

  it('adds an inheriting tab without copying presentation overrides', () => {
    const tabs: readonly IBetterListTabConfig[] = [
      {
        id: 'featured',
        label: 'Featured',
        filter: { kind: 'all' },
        groupingOverride: {
          mode: 'custom',
          column: 'Category.Title',
          collapsible: true
        },
        itemLayoutOverride: {
          itemProperties: ['Title', 'Description'],
          rows: [['Title'], ['Description']],
          links: {}
        }
      }
    ];

    const added = appendNewTab(tabs);

    expect(added).toHaveLength(2);
    expect(added[1]).toMatchObject({
      id: 'tab-2',
      label: 'Tab 2',
      filter: { kind: 'all' }
    });
    expect(added[1]?.groupingOverride).toBeUndefined();
    expect(added[1]?.itemLayoutOverride).toBeUndefined();
  });
});
