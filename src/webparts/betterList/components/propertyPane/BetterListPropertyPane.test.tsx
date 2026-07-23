import * as React from 'react';
import * as ReactDom from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, Simulate } from 'react-dom/test-utils';

import {
  createDefaultTabs,
  defaultBetterListHtmlTemplate,
  parseBetterListGroupIconsConfiguration
} from '../../../../shared';
import { BetterListPropertyPane, IBetterListAuthoringState } from './BetterListPropertyPane';

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
    expect(html.indexOf('aria-label="Source list"')).toBeLessThan(html.indexOf('aria-label="Title"'));
    expect(html.indexOf('aria-label="Title"')).toBeLessThan(html.indexOf('aria-label="Add tab"'));
    expect(html).toContain('--bl-font-mono: &quot;Geist Mono Variable&quot;');
    expect(html.match(/bl-property-pane-section/g)).toHaveLength(4);
    expect(html).toContain('data-property-pane-section-heading="true"');
    expect(html.match(/data-property-pane-section-divider="before"/g)).toHaveLength(4);
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

  it('commits a focused title draft when the property pane unmounts', async () => {
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
      ReactDom.unmountComponentAtNode(container);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      heading: 'Service directory'
    });
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
