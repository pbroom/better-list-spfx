import * as React from 'react';
import * as ReactDom from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, Simulate } from 'react-dom/test-utils';

import {
  createDefaultTabs,
  defaultBetterListHtmlTemplate,
  parseBetterListGroupIconsConfiguration
} from '../../../../shared';
import {
  BetterListPropertyPane,
  IBetterListAuthoringState,
  IBetterListPickerDataSource
} from './BetterListPropertyPane';

class TestResizeObserver implements ResizeObserver {
  public disconnect(): void {
    // No layout is measured in JSDOM.
  }

  public observe(): void {
    // No layout is measured in JSDOM.
  }

  public unobserve(): void {
    // No layout is measured in JSDOM.
  }
}

describe('BetterListPropertyPane', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
      writable: true
    });
  });

  const createValue = (): IBetterListAuthoringState => ({
    heading: '',
    itemColumns: 2,
    maxItemsPerPage: 0,
    showSearch: true,
    showSortingOptions: false,
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
    expect(html.indexOf('aria-label="Source list"')).toBeLessThan(html.indexOf('aria-label="Title"'));
    expect(html.indexOf('aria-label="Title"')).toBeLessThan(html.indexOf('aria-label="Columns"'));
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
    expect(html).toContain('>CSS/SCSS</button>');
    expect(html).toContain('>HTML template</button>');
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
    expect(defaultSorting?.textContent).toContain('List ordering');
    expect(searchSwitch?.checked).toBe(true);
    expect(sortingSwitch?.checked).toBe(false);
    await act(async () => {
      Simulate.click(defaultSorting as HTMLButtonElement);
      await Promise.resolve();
    });
    const defaultSortOptions = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(defaultSortOptions.map((candidate) => candidate.textContent?.trim())).toEqual([
      'List ordering',
      'A to Z',
      'Popularity',
      'Trending',
      'Recently updated',
      'Column (select)...'
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
