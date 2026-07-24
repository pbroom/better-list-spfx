import * as React from 'react';
import * as ReactDom from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import { installTestResizeObserver } from '../../../../test/installTestResizeObserver';
import { ColumnPickerMenu, ItemPropertyBuilder } from './ItemPropertyBuilder';

describe('ColumnPickerMenu', () => {
  it('mounts a standalone menu in its explicit target document', async () => {
    const container = document.createElement('div');
    const frame = document.createElement('iframe');
    document.body.append(container, frame);
    const targetDocument = frame.contentDocument as Document;
    const restoreResizeObserver = installTestResizeObserver(targetDocument.defaultView as Window);

    try {
      await act(async () => {
        ReactDom.render(
          <ColumnPickerMenu
            ariaLabel="Add item layout element"
            fields={[]}
            targetDocument={targetDocument}
            onAddRow={() => undefined}
            onSelect={() => undefined}
          />,
          container
        );
        await Promise.resolve();
      });

      const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Add item layout element"]');
      expect(trigger).not.toBeNull();
      await act(async () => {
        Simulate.click(trigger as HTMLButtonElement);
        await Promise.resolve();
      });

      expect(targetDocument.body.querySelector('.better-list-portal')).not.toBeNull();
      expect(document.body.querySelector('.better-list-portal')).toBeNull();
    } finally {
      act(() => {
        ReactDom.unmountComponentAtNode(container);
      });
      restoreResizeObserver();
      container.remove();
      frame.remove();
    }
  });

  it('shows lookup targets as concise submenu leaves and selects the canonical path', async () => {
    const container = document.createElement('div');
    const onSelect = jest.fn();
    document.body.append(container);

    try {
      await act(async () => {
        ReactDom.render(
          <ColumnPickerMenu
            ariaLabel="Add item layout element"
            fields={[{
              internalName: 'Category',
              title: 'Category',
              typeAsString: 'Lookup',
              lookupField: 'Title',
              lookupFields: [
                { internalName: 'Title', title: 'Title', typeAsString: 'Text' },
                { internalName: 'Active', title: 'Active', typeAsString: 'Boolean' }
              ]
            }]}
            onSelect={onSelect}
          />,
          container
        );
      });

      await act(async () => {
        Simulate.click(
          container.querySelector<HTMLButtonElement>(
            'button[aria-label="Add item layout element"]'
          ) as HTMLButtonElement
        );
        await Promise.resolve();
      });
      const category = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
      ).find((item) => item.textContent?.trim() === 'Category');
      expect(category?.getAttribute('aria-haspopup')).toBe('menu');

      await act(async () => {
        Simulate.keyDown(category as HTMLElement, { key: 'ArrowRight' });
        await Promise.resolve();
      });
      const active = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
      ).find((item) => item.textContent?.trim() === 'Active');
      expect(active).toBeDefined();
      expect(document.body.textContent).not.toContain('Category → Active');

      await act(async () => {
        Simulate.click(active as HTMLElement);
      });
      expect(onSelect).toHaveBeenCalledWith('Category/Active');
    } finally {
      act(() => {
        ReactDom.unmountComponentAtNode(container);
      });
      container.remove();
    }
  });

  it('keeps full lookup context in selected item-layout and link labels', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    try {
      await act(async () => {
        ReactDom.render(
          <ItemPropertyBuilder
            fields={[{
              internalName: 'Category',
              title: 'Category',
              typeAsString: 'Lookup',
              lookupField: 'Title',
              lookupFields: [
                { internalName: 'Active', title: 'Active', typeAsString: 'Boolean' },
                { internalName: 'Website', title: 'Website', typeAsString: 'URL' }
              ]
            }]}
            value={{
              itemProperties: ['Category/Active'],
              rows: [],
              links: { 'Category/Active': 'Category/Website' }
            }}
            onChange={() => undefined}
          />,
          container
        );
      });

      const itemLayoutSection = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Item layout'
      );
      await act(async () => {
        Simulate.click(itemLayoutSection as HTMLButtonElement);
      });
      expect(
        container.querySelector('[data-item-property="Category/Active"]')?.textContent
      ).toContain('Category → Active');
      const linkButton = container.querySelector<HTMLButtonElement>(
        'button[aria-label*="currently Category → Website"]'
      );
      expect(linkButton).not.toBeNull();
      await act(async () => {
        Simulate.click(linkButton as HTMLButtonElement);
        await Promise.resolve();
      });
      const category = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
      ).find((item) => item.textContent?.trim() === 'Category');
      expect(category?.getAttribute('aria-haspopup')).toBe('menu');
      await act(async () => {
        Simulate.keyDown(category as HTMLElement, { key: 'ArrowRight' });
        await Promise.resolve();
      });
      expect(
        Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).some(
          (item) => item.textContent?.trim() === 'Website'
        )
      ).toBe(true);
      expect(
        Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).some(
          (item) => item.textContent?.trim() === 'Category → Website'
        )
      ).toBe(false);
    } finally {
      act(() => {
        ReactDom.unmountComponentAtNode(container);
      });
      container.remove();
    }
  });
});
