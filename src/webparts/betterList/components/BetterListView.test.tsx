/* eslint-disable @typescript-eslint/no-use-before-define -- Shared fixture markup is declared after the behavior cases for readability. */
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, Simulate } from 'react-dom/test-utils';

import { installTestResizeObserver } from '../../../test/installTestResizeObserver';
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

const createItems = (count: number): readonly IBetterListItem[] =>
  Array.from({ length: count }, (_value, index) => ({
    ...item,
    id: String(index + 1),
    title: `Service ${(`00${index + 1}`).slice(-3)}`
  }));

describe('BetterListView', () => {
  let restoreResizeObserver: (() => void) | undefined;

  beforeEach(() => {
    restoreResizeObserver = installTestResizeObserver();
  });

  afterEach(() => {
    restoreResizeObserver?.();
    restoreResizeObserver = undefined;
  });

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

  it('renders an optional semantic heading instead of a single-tab strip', () => {
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
      <BetterListView activeTabKey="all" heading="Service directory" items={[item]} tabs={tabs} />
    );

    expect(html).toContain('<h2');
    expect(html).toContain('better-list__heading');
    expect(html).toContain('better-list__title');
    expect(html).toContain('Service directory</h2>');
    expect(html).not.toContain('Better List views');
    expect(html).not.toContain('>All items<');
  });

  it('preserves an authored single-tab slot class when the heading replaces the tab strip', () => {
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
      '<span data-bl-slot="tabs"></span>',
      '<span class="authored-tabs-slot" data-bl-slot="tabs"></span>'
    );

    const html = renderToStaticMarkup(
      <BetterListView
        activeTabKey="all"
        heading="Service directory"
        htmlTemplate={template}
        items={[item]}
        tabs={tabs}
      />
    );

    expect(html).toContain('authored-tabs-slot');
    expect(html).toContain('better-list__navigation');
    expect(html).toContain('Service directory</h2>');
  });

  it('renders the optional semantic heading above a multi-tab strip', () => {
    const tabs: readonly IBetterListTab[] = [
      { key: 'featured', label: 'Featured', items: [item] },
      { key: 'all', label: 'All items', items: [item] }
    ];

    const html = renderToStaticMarkup(
      <BetterListView activeTabKey="featured" heading="Service directory" items={[item]} tabs={tabs} />
    );

    expect(html).toContain('better-list__navigation');
    expect(html.indexOf('Service directory</h2>')).toBeLessThan(html.indexOf('Better List views'));
    expect(html).toContain('Featured');
    expect(html).toContain('All items');
  });

  it('preserves the existing tab behavior when the optional heading is blank or missing', () => {
    const tabs: readonly IBetterListTab[] = [
      { key: 'featured', label: 'Featured', items: [item] },
      { key: 'all', label: 'All items', items: [item] }
    ];

    const blankHtml = renderToStaticMarkup(
      <BetterListView activeTabKey="featured" heading="   " items={[item]} tabs={tabs} />
    );
    const missingHtml = renderToStaticMarkup(
      <BetterListView activeTabKey="featured" items={[item]} tabs={tabs} />
    );

    expect(blankHtml).not.toContain('better-list__heading');
    expect(missingHtml).not.toContain('better-list__heading');
    expect(blankHtml).not.toContain('better-list__title');
    expect(missingHtml).not.toContain('better-list__title');
    expect(blankHtml).toContain('Better List views');
    expect(missingHtml).toContain('Better List views');
  });

  it('renders optional tab icons and counts', () => {
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'featured',
        label: 'Featured',
        iconOverride: { kind: 'icon', library: 'fluent', name: 'megaphone', color: '#245a8d' },
        itemCount: 4,
        showItemCount: true,
        items: [item]
      },
      { key: 'all', label: 'All items', itemCount: 12, items: [item] }
    ];

    const html = renderToStaticMarkup(<BetterListView activeTabKey="featured" items={[item]} tabs={tabs} />);

    expect(html).toContain('Featured (4)');
    expect(html).toContain('<svg');
    expect(html).toContain('style="color:#245a8d"');
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

  it('progressively renders the default result set in batches of 30', async () => {
    const container = document.createElement('div');
    const items = createItems(35);
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, layout: { showSearch: false }, items }
    ];

    await act(async () => {
      ReactDom.render(<BetterListView activeTabKey="all" items={items} tabs={tabs} />, container);
    });

    expect(container.textContent).toContain('Service 030');
    expect(container.textContent).not.toContain('Service 031');
    expect(container.textContent).toContain('Showing 30 of 35');

    const loadMore = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Load 5 more')
    );
    expect(loadMore).toBeDefined();
    await act(async () => {
      Simulate.click(loadMore as HTMLButtonElement);
    });

    expect(container.textContent).toContain('Service 035');
    expect(container.textContent).not.toContain('Showing 30 of 35');
    ReactDom.unmountComponentAtNode(container);
  });

  it('paginates the full filtered result set at the authored page size', async () => {
    const container = document.createElement('div');
    const items = createItems(5);
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items }
    ];

    await act(async () => {
      ReactDom.render(
        <BetterListView activeTabKey="all" items={items} maxItemsPerPage={2} tabs={tabs} />,
        container
      );
    });

    expect(container.textContent).toContain('Service 001');
    expect(container.textContent).toContain('Service 002');
    expect(container.textContent).not.toContain('Service 003');
    expect(container.textContent).toContain('Page 1 of 3');

    const nextPage = container.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    expect(nextPage).not.toBeNull();
    await act(async () => {
      Simulate.click(nextPage as HTMLButtonElement);
    });

    expect(container.textContent).not.toContain('Service 001');
    expect(container.textContent).toContain('Service 003');
    expect(container.textContent).toContain('Service 004');
    expect(container.textContent).not.toContain('Service 005');
    expect(container.textContent).toContain('Page 2 of 3');

    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    await act(async () => {
      (search as HTMLInputElement).value = 'Service 005';
      Simulate.change(search as HTMLInputElement);
    });
    expect(container.textContent).toContain('Service 005');
    expect(container.querySelector('nav[aria-label="List pagination"]')).toBeNull();
    ReactDom.unmountComponentAtNode(container);
  });

  it('uses the global item column count while preserving the legacy tab fallback', async () => {
    const container = document.createElement('div');
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'all',
        label: 'All items',
        grouped: false,
        layout: { columns: 1 },
        items: [item]
      }
    ];

    await act(async () => {
      ReactDom.render(
        <BetterListView activeTabKey="all" itemColumns={4} items={[item]} tabs={tabs} />,
        container
      );
    });
    expect(
      container.querySelector<HTMLElement>('.better-list__grid')?.style.getPropertyValue('--better-list-columns')
    ).toBe('4');

    await act(async () => {
      ReactDom.render(<BetterListView activeTabKey="all" items={[item]} tabs={tabs} />, container);
    });
    expect(
      container.querySelector<HTMLElement>('.better-list__grid')?.style.getPropertyValue('--better-list-columns')
    ).toBe('1');
    ReactDom.unmountComponentAtNode(container);
  });

  it('uses global search visibility without overriding a legacy tab opt-out', async () => {
    const container = document.createElement('div');
    const legacyHiddenTabs: readonly IBetterListTab[] = [
      {
        key: 'all',
        label: 'All items',
        grouped: false,
        layout: { showSearch: false },
        items: [item]
      }
    ];

    await act(async () => {
      ReactDom.render(
        <BetterListView activeTabKey="all" items={[item]} showSearch tabs={legacyHiddenTabs} />,
        container
      );
    });
    expect(container.querySelector('input[type="search"]')).toBeNull();

    await act(async () => {
      ReactDom.render(
        <BetterListView
          activeTabKey="all"
          items={[item]}
          searchValue="no match"
          showSearch={false}
          tabs={[{ key: 'all', label: 'All items', grouped: false, items: [item] }]}
        />,
        container
      );
    });
    expect(container.querySelector('input[type="search"]')).toBeNull();
    expect(container.textContent).toContain('Service title');

    await act(async () => {
      ReactDom.render(
        <BetterListView
          activeTabKey="all"
          items={[item]}
          showSearch
          tabs={[{ key: 'all', label: 'All items', grouped: false, items: [item] }]}
        />,
        container
      );
    });
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
    ReactDom.unmountComponentAtNode(container);
  });

  it('renders sorting options before search and independently of search visibility', () => {
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items: [item] }
    ];

    const html = renderToStaticMarkup(
      <BetterListView
        activeTabKey="all"
        items={[item]}
        showSortingOptions
        tabs={tabs}
      />
    );
    const sortingOnlyHtml = renderToStaticMarkup(
      <BetterListView
        activeTabKey="all"
        items={[item]}
        showSearch={false}
        showSortingOptions
        tabs={tabs}
      />
    );

    expect(html).toContain('better-list__search-controls');
    expect(html).toContain('aria-label="Sort items"');
    expect(html).toContain('better-list__sort-trigger');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).not.toContain('better-list__sort-tag');
    expect(html.indexOf('aria-label="Sort items"')).toBeLessThan(html.indexOf('type="search"'));
    expect(sortingOnlyHtml).toContain('aria-label="Sort items"');
    expect(sortingOnlyHtml).not.toContain('type="search"');
  });

  it('hides visitor sorting when every authored option is disabled', () => {
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items: [item] }
    ];
    const html = renderToStaticMarkup(
      <BetterListView
        activeTabKey="all"
        items={[item]}
        showSearch={false}
        showSortingOptions
        tabs={tabs}
        viewerSortOptions={[]}
      />
    );

    expect(html).not.toContain('aria-label="Sort items"');
    expect(html).not.toContain('better-list__search-controls');
  });

  it('only renders the enabled visitor sorting choices', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items: [item] }
    ];

    await act(async () => {
      ReactDom.render(
        <BetterListView
          activeTabKey="all"
          items={[item]}
          showSortingOptions
          tabs={tabs}
          viewerSortColumns={[
            {
              fieldPath: 'Priority',
              kind: 'number',
              label: 'Priority',
              valueKey: 'column:Priority'
            }
          ]}
          viewerSortOptions={['popularity', 'column']}
        />,
        container
      );
    });
    await act(async () => {
      Simulate.click(
        container.querySelector<HTMLButtonElement>('button[aria-label="Sort items"]') as HTMLButtonElement
      );
      await Promise.resolve();
    });

    expect(
      Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).map(
        (candidate) => candidate.textContent?.trim()
      )
    ).toEqual(['Popularity']);
    const columnMenu = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Column');
    expect(columnMenu).toBeDefined();
    expect(columnMenu?.getAttribute('aria-haspopup')).toBe('menu');
    ReactDom.unmountComponentAtNode(container);
    container.remove();
  });

  it('replaces and dismisses a visitor-selected sort tag', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const alpha = {
      ...item,
      id: 'alpha',
      itemSortOrder: 2,
      title: 'Alpha service',
      viewerSortValues: { 'mode:popularity': 1 }
    };
    const zulu = {
      ...item,
      id: 'zulu',
      itemSortOrder: 1,
      title: 'Zulu service',
      viewerSortValues: { 'mode:popularity': 10 }
    };
    const items = [zulu, alpha];
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items }
    ];

    await act(async () => {
      ReactDom.render(
        <BetterListView
          activeTabKey="all"
          items={items}
          showSortingOptions
          tabs={tabs}
        />,
        container
      );
    });

    const itemTitles = (): string[] =>
      Array.from(container.querySelectorAll('.better-list__item-title')).map((element) =>
        element.textContent?.trim() || ''
      );
    expect(itemTitles()).toEqual(['Zulu service', 'Alpha service']);

    const sortTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Sort items"]');
    expect(sortTrigger).not.toBeNull();
    expect(container.querySelector('.better-list__sort-tag')).toBeNull();
    await act(async () => {
      Simulate.click(sortTrigger as HTMLButtonElement);
      await Promise.resolve();
    });
    const ascendingOption = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find(
      (candidate) => candidate.textContent?.trim() === 'A to Z'
    );
    expect(ascendingOption).toBeDefined();
    await act(async () => {
      Simulate.click(ascendingOption as HTMLElement);
    });
    expect(itemTitles()).toEqual(['Alpha service', 'Zulu service']);
    expect(container.querySelectorAll('.better-list__sort-tag')).toHaveLength(1);
    expect(container.querySelector('.better-list__sort-tag')?.textContent).toContain('A to Z');

    await act(async () => {
      Simulate.click(sortTrigger as HTMLButtonElement);
      await Promise.resolve();
    });
    const popularityOption = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find(
      (candidate) => candidate.textContent?.trim() === 'Popularity'
    );
    expect(popularityOption).toBeDefined();
    await act(async () => {
      Simulate.click(popularityOption as HTMLElement);
    });

    expect(itemTitles()).toEqual(['Zulu service', 'Alpha service']);
    expect(container.querySelectorAll('.better-list__sort-tag')).toHaveLength(1);
    expect(container.querySelector('.better-list__sort-tag')?.textContent).toContain('Popularity');

    const activeSortTag = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Popularity sorting"]'
    );
    expect(activeSortTag).not.toBeNull();
    await act(async () => {
      activeSortTag?.focus();
      Simulate.click(activeSortTag as HTMLButtonElement);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(container.querySelector('.better-list__sort-tag')).toBeNull();
    expect(itemTitles()).toEqual(['Zulu service', 'Alpha service']);
    expect(document.activeElement).toBe(sortTrigger);
    ReactDom.unmountComponentAtNode(container);
    container.remove();
  });

  it('keeps an explicit list-order override distinct from dismissing to the authored default', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const alpha = { ...item, id: 'alpha', itemSortOrder: 2, title: 'Alpha service' };
    const zulu = { ...item, id: 'zulu', itemSortOrder: 1, title: 'Zulu service' };
    const items = [zulu, alpha];
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items }
    ];

    await act(async () => {
      ReactDom.render(
        <BetterListView
          activeTabKey="all"
          defaultSort="titleAscending"
          items={items}
          showSortingOptions
          tabs={tabs}
        />,
        container
      );
    });

    const itemTitles = (): string[] =>
      Array.from(container.querySelectorAll('.better-list__item-title')).map((element) =>
        element.textContent?.trim() || ''
      );
    expect(itemTitles()).toEqual(['Alpha service', 'Zulu service']);

    const sortTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Sort items"]'
    );
    await act(async () => {
      Simulate.click(sortTrigger as HTMLButtonElement);
      await Promise.resolve();
    });
    const listOrderOption = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    ).find((candidate) => candidate.textContent?.trim() === 'None (default list order)');
    expect(listOrderOption).toBeDefined();
    await act(async () => {
      Simulate.click(listOrderOption as HTMLElement);
    });

    expect(itemTitles()).toEqual(['Zulu service', 'Alpha service']);
    const activeSortTag = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove None (default list order) sorting"]'
    );
    expect(activeSortTag).not.toBeNull();
    await act(async () => {
      Simulate.click(activeSortTag as HTMLButtonElement);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(itemTitles()).toEqual(['Alpha service', 'Zulu service']);
    expect(container.querySelector('.better-list__sort-tag')).toBeNull();

    ReactDom.unmountComponentAtNode(container);
    container.remove();
  });

  it('keeps built-in popularity separate from a column named popularity', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const popular = {
      ...item,
      id: 'popular',
      itemSortOrder: 2,
      title: 'Popular service',
      viewerSortValues: {
        'mode:popularity': 100,
        'column:popularity': 100
      }
    };
    const lowColumn = {
      ...item,
      id: 'low-column',
      itemSortOrder: 1,
      title: 'Low column service',
      viewerSortValues: {
        'mode:popularity': 1,
        'column:popularity': 1
      }
    };
    const items = [lowColumn, popular];
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items }
    ];

    await act(async () => {
      ReactDom.render(
        <BetterListView
          activeTabKey="all"
          items={items}
          showSortingOptions
          tabs={tabs}
          viewerSortColumns={[
            {
              fieldPath: 'popularity',
              kind: 'number',
              label: 'Popularity column',
              valueKey: 'column:popularity'
            }
          ]}
          viewerSortOptions={['popularity', 'column']}
        />,
        container
      );
    });

    const firstTitle = (): string =>
      container.querySelector('.better-list__item-title')?.textContent?.trim() || '';
    const sortTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Sort items"]'
    ) as HTMLButtonElement;
    await act(async () => {
      Simulate.click(sortTrigger);
      await Promise.resolve();
    });
    const builtInPopularity = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Popularity');
    await act(async () => {
      Simulate.click(builtInPopularity as HTMLElement);
    });
    expect(firstTitle()).toBe('Popular service');

    await act(async () => {
      Simulate.click(sortTrigger);
      await Promise.resolve();
    });
    const columnMenu = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Column');
    await act(async () => {
      Simulate.keyDown(columnMenu as HTMLElement, { key: 'ArrowRight' });
      await Promise.resolve();
    });
    const columnPopularity = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Popularity column');
    await act(async () => {
      Simulate.click(columnPopularity as HTMLElement);
    });
    expect(firstTitle()).toBe('Low column service');

    ReactDom.unmountComponentAtNode(container);
    container.remove();
  });

  it('applies descending built-in metadata sorts and ascending column sorts', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const items = [
      {
        ...item,
        id: 'trending',
        itemSortOrder: 1,
        title: 'Trending service',
        viewerSortValues: {
          'mode:popularity': 1,
          'mode:trending': 50,
          'mode:recentlyUpdated': '2026-01-01T00:00:00Z',
          'column:Priority': 4
        }
      },
      {
        ...item,
        id: 'popular',
        itemSortOrder: 2,
        title: 'Popular service',
        viewerSortValues: {
          'mode:popularity': 10,
          'mode:trending': 1,
          'mode:recentlyUpdated': '2026-02-01T00:00:00Z',
          'column:Priority': 3
        }
      },
      {
        ...item,
        id: 'recent',
        itemSortOrder: 3,
        title: 'Recent service',
        viewerSortValues: {
          'mode:popularity': 5,
          'mode:trending': 20,
          'mode:recentlyUpdated': '2026-04-01T00:00:00Z',
          'column:Priority': 2
        }
      },
      {
        ...item,
        id: 'priority',
        itemSortOrder: 4,
        title: 'Priority service',
        viewerSortValues: {
          'mode:popularity': 2,
          'mode:trending': 2,
          'mode:recentlyUpdated': '2026-03-01T00:00:00Z',
          'column:Priority': 1
        }
      }
    ];
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items }
    ];

    await act(async () => {
      ReactDom.render(
        <BetterListView
          activeTabKey="all"
          items={items}
          showSortingOptions
          tabs={tabs}
          viewerSortColumns={[
            {
              fieldPath: 'Priority',
              kind: 'number',
              label: 'Priority',
              valueKey: 'column:Priority'
            }
          ]}
          viewerSortOptions={[
            'popularity',
            'trending',
            'recentlyUpdated',
            'column'
          ]}
        />,
        container
      );
    });

    const firstTitle = (): string =>
      container.querySelector('.better-list__item-title')?.textContent?.trim() || '';
    const sortTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Sort items"]'
    ) as HTMLButtonElement;
    const selectBuiltIn = async (label: string): Promise<void> => {
      await act(async () => {
        Simulate.click(sortTrigger);
        await Promise.resolve();
      });
      const option = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
      ).find((candidate) => candidate.textContent?.trim() === label);
      expect(option).toBeDefined();
      await act(async () => {
        Simulate.click(option as HTMLElement);
      });
    };

    await selectBuiltIn('Popularity');
    expect(firstTitle()).toBe('Popular service');
    await selectBuiltIn('Trending');
    expect(firstTitle()).toBe('Trending service');
    await selectBuiltIn('Recently updated');
    expect(firstTitle()).toBe('Recent service');

    await act(async () => {
      Simulate.click(sortTrigger);
      await Promise.resolve();
    });
    const columnMenu = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Column');
    expect(columnMenu).toBeDefined();
    await act(async () => {
      Simulate.keyDown(columnMenu as HTMLElement, {
        key: 'ArrowRight'
      });
      await Promise.resolve();
    });
    const priorityOption = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Priority');
    expect(priorityOption).toBeDefined();
    await act(async () => {
      Simulate.click(priorityOption as HTMLElement);
    });
    expect(firstTitle()).toBe('Priority service');
    expect(container.querySelectorAll('.better-list__sort-tag')).toHaveLength(1);
    expect(container.querySelector('.better-list__sort-tag')?.textContent).toContain(
      'Priority'
    );

    ReactDom.unmountComponentAtNode(container);
    container.remove();
  });

  it('sorts within groups without changing authored group order', () => {
    const firstGroupZulu = {
      ...item,
      id: 'first-zulu',
      title: 'Zulu service',
      groupId: 'first',
      groupTitle: 'First group',
      groupSortOrder: 1
    };
    const firstGroupAlpha = {
      ...firstGroupZulu,
      id: 'first-alpha',
      title: 'Alpha service'
    };
    const secondGroupItem = {
      ...item,
      id: 'second',
      title: 'Beta service',
      groupId: 'second',
      groupTitle: 'Second group',
      groupSortOrder: 2
    };
    const items = [firstGroupZulu, firstGroupAlpha, secondGroupItem];
    const tabs: readonly IBetterListTab[] = [
      { key: 'grouped', label: 'Grouped', grouped: true, items }
    ];

    const html = renderToStaticMarkup(
      <BetterListView
        activeTabKey="grouped"
        defaultSort="titleAscending"
        items={items}
        showSortingOptions
        tabs={tabs}
      />
    );

    expect(html.indexOf('First group')).toBeLessThan(html.indexOf('Second group'));
    expect(html.indexOf('Alpha service')).toBeLessThan(html.indexOf('Zulu service'));
  });

  it('applies the authored default sorting before a visitor override', () => {
    const lower = {
      ...item,
      id: 'lower',
      title: 'Zulu service',
      presentationOrder: 1,
      defaultSortKind: 'number' as const,
      defaultSortValue: 10
    };
    const higher = {
      ...item,
      id: 'higher',
      title: 'Alpha service',
      presentationOrder: 2,
      defaultSortKind: 'number' as const,
      defaultSortValue: 40
    };
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items: [lower, higher] }
    ];

    const listOrderHtml = renderToStaticMarkup(
      <BetterListView activeTabKey="all" defaultSort="listOrder" items={[lower, higher]} tabs={tabs} />
    );
    const titleHtml = renderToStaticMarkup(
      <BetterListView activeTabKey="all" defaultSort="titleAscending" items={[lower, higher]} tabs={tabs} />
    );
    const popularityHtml = renderToStaticMarkup(
      <BetterListView activeTabKey="all" defaultSort="popularity" items={[lower, higher]} tabs={tabs} />
    );
    const columnHtml = renderToStaticMarkup(
      <BetterListView activeTabKey="all" defaultSort="column" items={[lower, higher]} tabs={tabs} />
    );

    expect(listOrderHtml.indexOf('Zulu service')).toBeLessThan(listOrderHtml.indexOf('Alpha service'));
    expect(titleHtml.indexOf('Alpha service')).toBeLessThan(titleHtml.indexOf('Zulu service'));
    expect(popularityHtml.indexOf('Alpha service')).toBeLessThan(popularityHtml.indexOf('Zulu service'));
    expect(columnHtml.indexOf('Zulu service')).toBeLessThan(columnHtml.indexOf('Alpha service'));
  });

  it('falls back to list ordering when a metric is unavailable', () => {
    const first = { ...item, id: 'first', title: 'Zulu service', presentationOrder: 1 };
    const second = { ...item, id: 'second', title: 'Alpha service', presentationOrder: 2 };
    const tabs: readonly IBetterListTab[] = [
      { key: 'all', label: 'All items', grouped: false, items: [first, second] }
    ];

    const html = renderToStaticMarkup(
      <BetterListView activeTabKey="all" defaultSort="trending" items={[first, second]} tabs={tabs} />
    );

    expect(html.indexOf('Zulu service')).toBeLessThan(html.indexOf('Alpha service'));
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

  it('uses the selected tab\'s grouping and item layout configuration', () => {
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'featured',
        label: 'Featured',
        grouped: false,
        itemPropertyFields: ['Title'],
        itemLayoutRows: [['Title']],
        items: [item]
      },
      {
        key: 'details',
        label: 'Details',
        grouped: true,
        itemPropertyFields: ['Description'],
        itemLayoutRows: [['Description']],
        items: [item]
      }
    ];

    const featuredHtml = renderToStaticMarkup(
      <BetterListView activeTabKey="featured" items={[item]} tabs={tabs} />
    );
    const detailsHtml = renderToStaticMarkup(
      <BetterListView activeTabKey="details" items={[item]} tabs={tabs} />
    );

    expect(featuredHtml).toContain('Service title');
    expect(featuredHtml).not.toContain('Service description');
    expect(featuredHtml).not.toContain('better-list__group-heading');
    expect(detailsHtml).not.toContain('Service title');
    expect(detailsHtml).toContain('Service description');
    expect(detailsHtml).toContain('better-list__group-heading');
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

  it('hides every group icon when the global group-icon toggle is off', () => {
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
      <BetterListView
        activeTabKey="grouped"
        groupIcons={{ version: 1, showIcons: false, overrides: [] }}
        items={[item]}
        tabs={tabs}
      />
    );

    expect(html).toContain('General');
    expect(html).not.toContain('better-list__group-icon');
  });

  it('renders a scoped Solar duotone override without replacing another group automatically', () => {
    const policyItem = { ...item, id: '2', groupId: 'policy', groupTitle: 'Policy' };
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'grouped',
        label: 'Grouped',
        grouped: true,
        layout: { showSearch: false },
        items: [item, policyItem]
      }
    ];

    const html = renderToStaticMarkup(
      <BetterListView
        activeTabKey="grouped"
        groupIconScope="Category.Title"
        groupIcons={{
          version: 1,
          showIcons: true,
          overrides: [
            {
              groupKey: 'category.title::general',
              icon: { kind: 'icon', library: 'solar-duotone', name: 'buildings' }
            }
          ]
        }}
        items={[item, policyItem]}
        tabs={tabs}
      />
    );

    expect(html).toContain('General');
    expect(html).toContain('Policy');
    expect(html).toContain('better-list__group-icon');
    expect(html).toContain('opacity=".5"');
  });

  it('exposes group icon editors only in page edit mode', () => {
    const tabs: readonly IBetterListTab[] = [
      {
        key: 'grouped',
        label: 'Grouped',
        grouped: true,
        layout: { showSearch: false, collapsible: true },
        items: [item]
      }
    ];
    const sharedProps = {
      activeTabKey: 'grouped',
      groupIconScope: 'Category.Title',
      items: [item],
      tabs,
      onGroupIconOverrideChange: jest.fn()
    };

    const editHtml = renderToStaticMarkup(<BetterListView {...sharedProps} isEditMode />);
    const viewerHtml = renderToStaticMarkup(<BetterListView {...sharedProps} isEditMode={false} />);

    expect(editHtml).toContain('aria-label="Change icon for General"');
    expect(editHtml).toContain('aria-haspopup="dialog"');
    expect(viewerHtml).not.toContain('Change icon for General');
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
