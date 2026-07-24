import * as React from 'react';
import * as ReactDom from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, Simulate } from 'react-dom/test-utils';

import {
  createDefaultTabs,
  defaultBetterListHtmlTemplate,
  parseBetterListGroupIconsConfiguration
} from '../../../../shared';
import { installTestResizeObserver } from '../../../../test/installTestResizeObserver';
import {
  BetterListPropertyPane,
  IBetterListAuthoringState,
  IBetterListPickerDataSource
} from './BetterListPropertyPane';

describe('BetterListPropertyPane', () => {
  let restoreResizeObserver: (() => void) | undefined;

  beforeEach(() => {
    restoreResizeObserver = installTestResizeObserver();
  });

  afterEach(() => {
    restoreResizeObserver?.();
    restoreResizeObserver = undefined;
  });

  const createValue = (): IBetterListAuthoringState => ({
    heading: '',
    itemColumns: 2,
    maxItemsPerPage: 0,
    showSearch: true,
    showSortingOptions: false,
    sortingOptions: [
      'listOrder',
      'titleAscending',
      'popularity',
      'trending',
      'recentlyUpdated'
    ],
    sortingColumns: [],
    defaultSort: 'listOrder',
    defaultSortColumn: '',
    sourceListId: 'services',
    sourceListTitle: 'Services',
    sourceWebUrl: 'https://contoso.sharepoint.com/sites/example',
    fieldMappings: {},
    itemProperties: ['Title'],
    itemLayoutRows: [],
    itemElementLinks: {},
    tabsColumn: '',
    groupsColumn: '',
    groupsCollapsible: true,
    groupIcons: parseBetterListGroupIconsConfiguration(undefined),
    tabs: createDefaultTabs().slice(),
    customCss: '',
    htmlTemplate: defaultBetterListHtmlTemplate
  });

  it('owns its Fluent boundary and renders the production-compatible pane shell', () => {
    const value: IBetterListAuthoringState = createValue();

    const html = renderToStaticMarkup(
      <BetterListPropertyPane
        pickerDataSource={{
          loadFields: async () => [],
          loadLists: async () => [{ id: 'services', title: 'Services' }],
          resolveListUrl: async () => ({ id: 'services', title: 'Services' })
        }}
        value={value}
        onChange={() => undefined}
      />
    );

    expect(html).toContain('fui-FluentProvider');
    expect(html).toContain('fui-Combobox');
    expect(html).toContain('bl-pane__source-dropdown');
    expect(html).toContain('aria-label="Title"');
    expect(html).toContain('placeholder="Title (optional)"');
    expect(html).toContain('aria-label="Columns"');
    expect(html).toContain('fui-Dropdown');
    expect(html).toContain('bl-pane__compact-dropdown');
    expect(html).not.toContain('fui-Select');
    expect(html).toContain('aria-label="Max items per page"');
    expect(html).toContain('placeholder="No maximum"');
    expect(html).toContain('Search &amp; sorting');
    expect(html.indexOf('aria-label="Title"')).toBeLessThan(html.indexOf('aria-label="Source list"'));
    expect(html.indexOf('aria-label="Source list"')).toBeLessThan(html.indexOf('aria-label="Columns"'));
    expect(html.indexOf('aria-label="Columns"')).toBeLessThan(html.indexOf('aria-label="Max items per page"'));
    expect(html.indexOf('aria-label="Max items per page"')).toBeLessThan(html.indexOf('aria-label="Add tab"'));
    expect(html).toContain('--bl-font-mono: &quot;Geist Mono Variable&quot;');
    expect(html.indexOf('Search &amp; sorting')).toBeLessThan(html.indexOf('aria-label="Add tab"'));
    expect(html.match(/bl-property-pane-section/g)).toHaveLength(5);
    expect(html).toContain('data-property-pane-section-heading="true"');
    expect(html.match(/data-property-pane-section-divider="before"/g)).toHaveLength(5);
    expect(html).not.toContain('data-property-pane-section-divider="none"');
    expect(html).toContain('aria-label="Add tab"');
    expect(html).not.toContain('aria-label="Select groups column"');
    expect(html).not.toContain('+ Add tab');
    expect(html).not.toContain('<h2>Better List</h2>');
    expect(html.match(/>Pop out</g)).toHaveLength(1);
    expect(html).toContain('Styles &amp; template views');
    expect(html).toContain('fui-TabList');
    expect(html).toContain('fui-Tab');
    expect(html).toContain('>CSS/SCSS</span>');
    expect(html).toContain('>HTML template</span>');
    expect(html).not.toContain('aria-label="Split"');
  });

  it('authors an optional title without changing the source-list selection', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = createValue();

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={{
            loadFields: async () => [],
            loadLists: async () => [{ id: 'services', title: 'Services' }],
            resolveListUrl: async () => ({ id: 'services', title: 'Services' })
          }}
          value={value}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Title"]');
    expect(input).not.toBeNull();
    await act(async () => {
      (input as HTMLInputElement).value = 'Service directory';
      Simulate.change(input as HTMLInputElement);
    });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      Simulate.blur(input as HTMLInputElement);
    });

    expect(onChange).toHaveBeenCalledWith({
      ...value,
      heading: 'Service directory'
    });
    ReactDom.unmountComponentAtNode(container);
  });

  it('authors and clears the maximum items per page setting', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = createValue();

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={{
            loadFields: async () => [],
            loadLists: async () => [{ id: 'services', title: 'Services' }],
            resolveListUrl: async () => ({ id: 'services', title: 'Services' })
          }}
          value={value}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Max items per page"]');
    expect(input).not.toBeNull();
    await act(async () => {
      (input as HTMLInputElement).value = '6';
      Simulate.change(input as HTMLInputElement);
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, maxItemsPerPage: 6 });

    await act(async () => {
      (input as HTMLInputElement).value = '';
      Simulate.change(input as HTMLInputElement);
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, maxItemsPerPage: 0 });
    ReactDom.unmountComponentAtNode(container);
  });

  it('authors the global item column count', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = createValue();

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={{
            loadFields: async () => [],
            loadLists: async () => [{ id: 'services', title: 'Services' }],
            resolveListUrl: async () => ({ id: 'services', title: 'Services' })
          }}
          value={value}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
    });

    const dropdown = container.querySelector<HTMLButtonElement>('button[aria-label="Columns"]');
    expect(dropdown).not.toBeNull();
    await act(async () => {
      Simulate.click(dropdown as HTMLButtonElement);
      await Promise.resolve();
    });
    const option = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (candidate) => candidate.textContent?.trim() === '4'
    );
    expect(option).toBeDefined();
    await act(async () => {
      Simulate.click(option as HTMLElement);
    });

    expect(onChange).toHaveBeenLastCalledWith({ ...value, itemColumns: 4 });
    ReactDom.unmountComponentAtNode(container);
  });

  it('authors global search and sorting-control visibility', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = createValue();

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={{
            loadFields: async () => [],
            loadLists: async () => [{ id: 'services', title: 'Services' }],
            resolveListUrl: async () => ({ id: 'services', title: 'Services' })
          }}
          value={value}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
    });

    const searchSectionButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Search & sorting'
    );
    expect(searchSectionButton).toBeDefined();
    await act(async () => {
      Simulate.click(searchSectionButton as HTMLButtonElement);
    });

    const searchSwitch = container.querySelector<HTMLInputElement>('input[aria-label="Search field"]');
    const sortingSwitch = container.querySelector<HTMLInputElement>('input[aria-label="Show sorting options"]');
    const defaultSorting = container.querySelector<HTMLButtonElement>('button[aria-label="Default sorting"]');
    expect(searchSwitch).not.toBeNull();
    expect(sortingSwitch).not.toBeNull();
    expect(defaultSorting).not.toBeNull();
    expect(defaultSorting?.textContent).toContain('None (default list order)');
    expect(searchSwitch?.checked).toBe(true);
    expect(sortingSwitch?.checked).toBe(false);
    await act(async () => {
      Simulate.click(defaultSorting as HTMLButtonElement);
      await Promise.resolve();
    });
    const defaultSortOptions = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitem"]')
    );
    expect(defaultSortOptions.map((candidate) => candidate.textContent?.trim())).toEqual([
      'None (default list order)',
      'A to Z',
      'Popularity',
      'Trending',
      'Recently updated',
      'Column'
    ]);
    await act(async () => {
      Simulate.click(
        defaultSortOptions.find((candidate) => candidate.textContent?.trim() === 'Recently updated') as HTMLElement
      );
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...value,
      defaultSort: 'recentlyUpdated',
      defaultSortColumn: '',
      fieldMappings: { ...value.fieldMappings, metadata: [] }
    });
    await act(async () => {
      (searchSwitch as HTMLInputElement).checked = false;
      Simulate.change(searchSwitch as HTMLInputElement);
    });

    expect(onChange).toHaveBeenLastCalledWith({ ...value, showSearch: false });
    await act(async () => {
      (sortingSwitch as HTMLInputElement).checked = true;
      Simulate.change(sortingSwitch as HTMLInputElement);
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, showSortingOptions: true });
    ReactDom.unmountComponentAtNode(container);
  });

  it('reconciles a saved sort column when the field catalog changes', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value: IBetterListAuthoringState = {
      ...createValue(),
      defaultSort: 'column',
      defaultSortColumn: 'Priority',
      fieldMappings: {
        title: { kind: 'text', internalName: 'Title', displayName: 'Title' }
      }
    };
    const createPickerDataSource = (includePriority: boolean): IBetterListPickerDataSource => ({
      loadFields: async () => [
        { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
        ...(includePriority
          ? [{ internalName: 'Priority', title: 'Priority', typeAsString: 'Number' }]
          : [])
      ],
      loadLists: async () => [{ id: 'services', title: 'Services' }],
      resolveListUrl: async () => ({ id: 'services', title: 'Services' })
    });

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={createPickerDataSource(true)}
          value={value}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={createPickerDataSource(false)}
          value={value}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      ...value,
      defaultSort: 'listOrder',
      defaultSortColumn: '',
      fieldMappings: {
        ...value.fieldMappings,
        metadata: []
      }
    });
    ReactDom.unmountComponentAtNode(container);
  });

  it('authors the visitor sorting options when sorting controls are shown', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = {
      ...createValue(),
      showSortingOptions: true
    };

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={{
            loadFields: async () => [
              { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
              { internalName: 'Modified', title: 'Modified', typeAsString: 'DateTime' },
              { internalName: 'ViewsLifeTime', title: 'Popularity', typeAsString: 'Number' },
              { internalName: 'ViewsRecent', title: 'Trending', typeAsString: 'Number' },
              { internalName: 'Priority', title: 'Priority', typeAsString: 'Number' }
            ],
            loadLists: async () => [{ id: 'services', title: 'Services' }],
            resolveListUrl: async () => ({ id: 'services', title: 'Services' })
          }}
          value={value}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const searchSectionButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Search & sorting'
    );
    await act(async () => {
      Simulate.click(searchSectionButton as HTMLButtonElement);
    });

    const optionLabels = [
      'None (default list order)',
      'A to Z',
      'Popularity',
      'Trending',
      'Recently updated',
      'Column'
    ];
    const options = optionLabels.map((label) =>
      container.querySelector<HTMLInputElement>(
        `input[aria-label="Show ${label} sorting option"]`
      )
    );
    expect(options.every(Boolean)).toBe(true);
    expect(options.slice(0, 5).every((option) => option?.checked)).toBe(true);
    expect(options[5]?.checked).toBe(false);
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Choose visitor sorting columns"]')
    ).not.toBeNull();

    await act(async () => {
      (options[2] as HTMLInputElement).checked = false;
      Simulate.change(options[2] as HTMLInputElement);
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...value,
      sortingOptions: ['listOrder', 'titleAscending', 'trending', 'recentlyUpdated'],
      sortingColumns: [],
      fieldMappings: expect.objectContaining({
        metadata: expect.arrayContaining([
          expect.objectContaining({ key: 'ViewsRecent' }),
          expect.objectContaining({ key: 'Modified' })
        ])
      })
    });
    ReactDom.unmountComponentAtNode(container);
  });

  it('authors a default-sort column from the Column submenu', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = createValue();

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={{
            loadFields: async () => [
              { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
              {
                internalName: 'Category',
                title: 'Category',
                typeAsString: 'Lookup',
                lookupFields: [
                  { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
                  { internalName: 'Active', title: 'Active', typeAsString: 'Boolean' }
                ]
              }
            ],
            loadLists: async () => [{ id: 'services', title: 'Services' }],
            resolveListUrl: async () => ({ id: 'services', title: 'Services' })
          }}
          value={value}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const searchSectionButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Search & sorting'
    );
    await act(async () => {
      Simulate.click(searchSectionButton as HTMLButtonElement);
    });

    const defaultSorting = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Default sorting"]'
    );
    await act(async () => {
      Simulate.click(defaultSorting as HTMLButtonElement);
      await Promise.resolve();
    });

    const columnMenuItem = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Column');
    expect(columnMenuItem).toBeDefined();
    expect(columnMenuItem?.getAttribute('aria-haspopup')).toBe('menu');
    await act(async () => {
      Simulate.keyDown(columnMenuItem as HTMLElement, {
        key: 'ArrowRight'
      });
      await Promise.resolve();
    });

    const categoryMenuItem = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Category');
    expect(categoryMenuItem?.getAttribute('aria-haspopup')).toBe('menu');
    await act(async () => {
      Simulate.keyDown(categoryMenuItem as HTMLElement, { key: 'ArrowRight' });
      await Promise.resolve();
    });
    const activeOption = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    ).find((candidate) => candidate.textContent?.trim() === 'Active');
    expect(activeOption).toBeDefined();
    await act(async () => {
      Simulate.click(activeOption as HTMLElement);
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      defaultSort: 'column',
      defaultSortColumn: 'Category/Active'
    }));
    expect(
      container.querySelector('button[aria-label="Default sorting column"]')
    ).toBeNull();
    ReactDom.unmountComponentAtNode(container);
  });

  it('groups lookup columns across authoring menus while keeping full selected labels', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const lookupPath = 'Category/Active';
    const value: IBetterListAuthoringState = {
      ...createValue(),
      showSortingOptions: true,
      sortingOptions: ['column'],
      sortingColumns: [lookupPath],
      defaultSort: 'column',
      defaultSortColumn: lookupPath,
      groupsColumn: lookupPath
    };
    document.body.append(container);

    try {
      await act(async () => {
        ReactDom.render(
          <BetterListPropertyPane
            pickerDataSource={{
              loadFields: async () => [
                { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
                {
                  internalName: 'Category',
                  title: 'Category',
                  typeAsString: 'Lookup',
                  lookupField: 'Title',
                  lookupFields: [
                    { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
                    { internalName: 'Active', title: 'Active', typeAsString: 'Boolean' }
                  ]
                }
              ],
              loadLists: async () => [{ id: 'services', title: 'Services' }],
              resolveListUrl: async () => ({ id: 'services', title: 'Services' })
            }}
            value={value}
            onChange={onChange}
          />,
          container
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      const groupsSection = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Groups'
      );
      await act(async () => {
        Simulate.click(groupsSection as HTMLButtonElement);
      });
      const groupingTrigger = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Grouping column: Category → Active"]'
      );
      expect(groupingTrigger?.getAttribute('aria-label')).toBe(
        'Grouping column: Category → Active'
      );
      expect(groupingTrigger?.textContent).toContain('Category → Active');
      await act(async () => {
        Simulate.click(groupingTrigger as HTMLButtonElement);
        await Promise.resolve();
      });
      const groupingParent = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
      ).find((candidate) => candidate.textContent?.trim() === 'Category');
      expect(groupingParent?.getAttribute('aria-haspopup')).toBe('menu');
      await act(async () => {
        Simulate.keyDown(groupingParent as HTMLElement, { key: 'ArrowRight' });
        await Promise.resolve();
      });
      const activeOption = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
      ).find((candidate) => candidate.textContent?.trim() === 'Active');
      expect(activeOption).toBeDefined();
      expect(
        Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).some(
          (candidate) => candidate.textContent?.trim() === 'Category → Active'
        )
      ).toBe(false);

      await act(async () => {
        Simulate.click(activeOption as HTMLElement);
      });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        tabs: expect.arrayContaining([
          expect.objectContaining({
            groupingOverride: expect.objectContaining({ column: lookupPath })
          })
        ])
      }));
      const searchSection = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Search & sorting'
      );
      await act(async () => {
        Simulate.click(searchSection as HTMLButtonElement);
      });
      expect(
        container.querySelector<HTMLButtonElement>('button[aria-label="Default sorting"]')
          ?.textContent
      ).toContain('Category → Active');
      expect(
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Choose visitor sorting columns"]'
        )?.textContent
      ).toContain('Category → Active');
    } finally {
      ReactDom.unmountComponentAtNode(container);
      container.remove();
    }
  });

  it('resolves persisted grouping paths that use dotted separators', async () => {
    const container = document.createElement('div');
    const value: IBetterListAuthoringState = {
      ...createValue(),
      groupsColumn: 'Category.Active'
    };
    document.body.append(container);

    try {
      await act(async () => {
        ReactDom.render(
          <BetterListPropertyPane
            pickerDataSource={{
              loadFields: async () => [
                { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
                {
                  internalName: 'Category',
                  title: 'Category',
                  typeAsString: 'Lookup',
                  lookupField: 'Title',
                  lookupFields: [
                    { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
                    { internalName: 'Active', title: 'Active', typeAsString: 'Boolean' }
                  ]
                }
              ],
              loadLists: async () => [{ id: 'services', title: 'Services' }],
              resolveListUrl: async () => ({ id: 'services', title: 'Services' })
            }}
            value={value}
            onChange={() => undefined}
          />,
          container
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      const groupsSection = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Groups'
      );
      await act(async () => {
        Simulate.click(groupsSection as HTMLButtonElement);
      });

      const groupingTrigger = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Grouping column: Category → Active"]'
      );
      expect(groupingTrigger?.getAttribute('aria-label')).toBe(
        'Grouping column: Category → Active'
      );
      expect(groupingTrigger?.textContent).toContain('Category → Active');

      await act(async () => {
        Simulate.click(groupingTrigger as HTMLButtonElement);
        await Promise.resolve();
      });
      const groupingParent = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
      ).find((candidate) => candidate.textContent?.trim() === 'Category');
      await act(async () => {
        Simulate.keyDown(groupingParent as HTMLElement, { key: 'ArrowRight' });
        await Promise.resolve();
      });
      const activeOption = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
      ).find((candidate) => candidate.textContent?.trim() === 'Active');
      expect(activeOption?.getAttribute('aria-checked')).toBe('true');
    } finally {
      ReactDom.unmountComponentAtNode(container);
      container.remove();
    }
  });

  it('commits the title after the debounce interval', async () => {
    jest.useFakeTimers();
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = createValue();

    try {
      await act(async () => {
        ReactDom.render(
          <BetterListPropertyPane
            pickerDataSource={{
              loadFields: async () => [],
              loadLists: async () => [{ id: 'services', title: 'Services' }],
              resolveListUrl: async () => ({ id: 'services', title: 'Services' })
            }}
            value={value}
            onChange={onChange}
          />,
          container
        );
        await Promise.resolve();
      });

      const input = container.querySelector<HTMLInputElement>('input[aria-label="Title"]') as HTMLInputElement;
      await act(async () => {
        input.value = 'Service directory';
        Simulate.change(input);
      });

      act(() => {
        jest.advanceTimersByTime(499);
      });
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith({
        ...value,
        heading: 'Service directory'
      });
    } finally {
      ReactDom.unmountComponentAtNode(container);
      jest.useRealTimers();
    }
  });

  it('resets the title debounce and cancels the pending commit after blur', async () => {
    jest.useFakeTimers();
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = createValue();

    try {
      await act(async () => {
        ReactDom.render(
          <BetterListPropertyPane
            pickerDataSource={{
              loadFields: async () => [],
              loadLists: async () => [{ id: 'services', title: 'Services' }],
              resolveListUrl: async () => ({ id: 'services', title: 'Services' })
            }}
            value={value}
            onChange={onChange}
          />,
          container
        );
        await Promise.resolve();
      });

      const input = container.querySelector<HTMLInputElement>('input[aria-label="Title"]') as HTMLInputElement;
      await act(async () => {
        input.value = 'Service';
        Simulate.change(input);
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await act(async () => {
        input.value = 'Service directory';
        Simulate.change(input);
      });
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(onChange).not.toHaveBeenCalled();

      await act(async () => {
        Simulate.blur(input);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith({
        ...value,
        heading: 'Service directory'
      });

      act(() => {
        jest.runOnlyPendingTimers();
      });
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      ReactDom.unmountComponentAtNode(container);
      jest.useRealTimers();
    }
  });

  it('commits a focused title draft when the property pane unmounts', async () => {
    jest.useFakeTimers();
    const container = document.createElement('div');
    const onChange = jest.fn();
    const value = createValue();

    try {
      await act(async () => {
        ReactDom.render(
          <BetterListPropertyPane
            pickerDataSource={{
              loadFields: async () => [],
              loadLists: async () => [{ id: 'services', title: 'Services' }],
              resolveListUrl: async () => ({ id: 'services', title: 'Services' })
            }}
            value={value}
            onChange={onChange}
          />,
          container
        );
        await Promise.resolve();
      });

      const input = container.querySelector<HTMLInputElement>('input[aria-label="Title"]');
      expect(input).not.toBeNull();
      await act(async () => {
        (input as HTMLInputElement).value = 'Service directory';
        Simulate.change(input as HTMLInputElement);
      });
      expect(onChange).not.toHaveBeenCalled();

      await act(async () => {
        ReactDom.unmountComponentAtNode(container);
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        ...value,
        heading: 'Service directory'
      });
      act(() => {
        jest.runOnlyPendingTimers();
      });
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      ReactDom.unmountComponentAtNode(container);
      jest.useRealTimers();
    }
  });

  it('resolves a pasted URL before replacing the selected list', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const listUrl = 'https://contoso.sharepoint.com/sites/example/sub/Lists/Team%20Services/AllItems.aspx';
    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={{
            loadFields: async () => [],
            loadLists: async () => [{ id: 'services', title: 'Services' }],
            resolveListUrl: async () => ({
              id: 'c3fa8d8c-2270-4dc4-9f7e-1f83fef461fd',
              title: 'Team Services',
              webUrl: 'https://contoso.sharepoint.com/sites/example/sub'
            })
          }}
          value={createValue()}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
    });
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Source list"]');
    expect(input).not.toBeNull();

    await act(async () => {
      (input as HTMLInputElement).value = listUrl;
      Simulate.change(input as HTMLInputElement);
      await Promise.resolve();
    });
    await act(async () => {
      Simulate.keyDown(input as HTMLInputElement, { key: 'Enter' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      sourceListId: 'c3fa8d8c-2270-4dc4-9f7e-1f83fef461fd',
      sourceListTitle: 'Team Services',
      sourceWebUrl: 'https://contoso.sharepoint.com/sites/example/sub'
    }));
    ReactDom.unmountComponentAtNode(container);
  });

  it('ignores a pending URL resolution after the source input changes', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const listUrl = 'https://contoso.sharepoint.com/sites/example/Lists/Services/AllItems.aspx';
    let finishResolution: ((value: { id: string; title: string; webUrl: string }) => void) | undefined;
    const resolution = new Promise<{ id: string; title: string; webUrl: string }>((resolve) => {
      finishResolution = resolve;
    });

    await act(async () => {
      ReactDom.render(
        <BetterListPropertyPane
          pickerDataSource={{
            loadFields: async () => [],
            loadLists: async () => [{ id: 'services', title: 'Services' }],
            resolveListUrl: async () => resolution
          }}
          value={createValue()}
          onChange={onChange}
        />,
        container
      );
      await Promise.resolve();
    });
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Source list"]');
    expect(input).not.toBeNull();

    await act(async () => {
      (input as HTMLInputElement).value = listUrl;
      Simulate.change(input as HTMLInputElement);
      await Promise.resolve();
    });
    onChange.mockClear();
    await act(async () => {
      Simulate.keyDown(input as HTMLInputElement, { key: 'Enter' });
      await Promise.resolve();
    });
    expect((input as HTMLInputElement).getAttribute('aria-busy')).toBe('true');
    await act(async () => {
      (input as HTMLInputElement).value = 'Different list';
      Simulate.change(input as HTMLInputElement);
      await Promise.resolve();
    });
    expect((input as HTMLInputElement).getAttribute('aria-busy')).toBe('false');
    await act(async () => {
      finishResolution?.({
        id: 'late-list',
        title: 'Late list',
        webUrl: 'https://contoso.sharepoint.com/sites/example'
      });
      await resolution;
      await Promise.resolve();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('Different list');
    ReactDom.unmountComponentAtNode(container);
  });

  /* eslint-disable @rushstack/pair-react-dom-render-unmount --
   * The regression intentionally rerenders one mounted pane before the finally-block cleanup. */
  it('discards group discovery results after the active tab changes', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const allTab = createDefaultTabs()[0];
    const value: IBetterListAuthoringState = {
      ...createValue(),
      fieldMappings: {
        title: { kind: 'text', internalName: 'Title', displayName: 'Title' }
      },
      groupsColumn: 'Category',
      tabs: [
        allTab,
        { ...allTab, id: 'second', label: 'Second' }
      ]
    };
    let finishGroupLoad: ((groups: readonly {
      key: string;
      label: string;
      itemCount: number;
    }[]) => void) | undefined;
    const groupLoad = new Promise<readonly {
      key: string;
      label: string;
      itemCount: number;
    }[]>((resolve) => {
      finishGroupLoad = resolve;
    });
    const loadGroupOptions = jest.fn(async () => groupLoad);
    const pickerDataSource = {
      loadFields: async () => [
        { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
        { internalName: 'Category', title: 'Category', typeAsString: 'Choice' }
      ],
      loadLists: async () => [{ id: 'services', title: 'Services' }],
      resolveListUrl: async () => ({ id: 'services', title: 'Services' })
    };

    try {
      await act(async () => {
        ReactDom.render(
          <BetterListPropertyPane
            activeTabId="all"
            loadGroupOptions={loadGroupOptions}
            pickerDataSource={pickerDataSource}
            value={value}
            onChange={onChange}
          />,
          container
        );
        await Promise.resolve();
        await Promise.resolve();
      });
      const groupsSection = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Groups'
      );
      expect(groupsSection).toBeDefined();
      await act(async () => {
        Simulate.click(groupsSection as HTMLButtonElement);
      });
      const editGroups = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Edit groups'
      );
      expect(editGroups).toBeDefined();
      await act(async () => {
        Simulate.click(editGroups as HTMLButtonElement);
        await Promise.resolve();
      });
      expect(loadGroupOptions).toHaveBeenCalledWith('all', 'Category', { kind: 'all' });

      await act(async () => {
        ReactDom.render(
          <BetterListPropertyPane
            activeTabId="second"
            loadGroupOptions={loadGroupOptions}
            pickerDataSource={pickerDataSource}
            value={value}
            onChange={onChange}
          />,
          container
        );
        await Promise.resolve();
      });
      await act(async () => {
        finishGroupLoad?.([{ key: 'alpha', label: 'Alpha', itemCount: 2 }]);
        await groupLoad;
        await Promise.resolve();
      });

      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
      expect(container.textContent).not.toContain('Loading groups…');
    } finally {
      ReactDom.unmountComponentAtNode(container);
    }
  });
  /* eslint-enable @rushstack/pair-react-dom-render-unmount */
});
