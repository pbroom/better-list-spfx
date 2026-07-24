import * as React from 'react';
import * as ReactDom from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import { installTestResizeObserver } from '../../../../test/installTestResizeObserver';
import { IBetterListFieldDescriptor } from '../../../../shared';
import { ViewerSortingOptions } from './ViewerSortingOptions';

describe('ViewerSortingOptions', () => {
  let restoreResizeObserver: (() => void) | undefined;

  beforeEach(() => {
    restoreResizeObserver = installTestResizeObserver();
  });

  afterEach(() => {
    restoreResizeObserver?.();
    restoreResizeObserver = undefined;
  });

  it('selects a concise lookup submenu leaf while reporting the canonical path', async () => {
    const container = document.createElement('div');
    const onChange = jest.fn();
    const category: IBetterListFieldDescriptor = {
      internalName: 'Category',
      title: 'Category',
      typeAsString: 'Lookup'
    };
    const active: IBetterListFieldDescriptor = {
      internalName: 'Active',
      title: 'Active',
      typeAsString: 'Boolean'
    };
    document.body.append(container);

    try {
      await act(async () => {
        ReactDom.render(
          <ViewerSortingOptions
            columnOptions={[{
              field: category,
              fieldPath: 'Category/Active',
              label: 'Category → Active',
              menuLabel: 'Active',
              parentLabel: 'Category',
              targetField: active
            }]}
            enabled={[]}
            selectedColumns={[]}
            onChange={onChange}
          />,
          container
        );
      });
      const trigger = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Choose visitor sorting columns"]'
      );
      expect(trigger?.classList.contains('fui-MenuButton')).toBe(true);
      expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger?.getAttribute('aria-expanded')).toBe('false');
      const closedTriggerStyles = window.getComputedStyle(trigger as HTMLButtonElement);
      const closedTriggerBorderWidths = [
        closedTriggerStyles.borderTopWidth,
        closedTriggerStyles.borderRightWidth,
        closedTriggerStyles.borderBottomWidth,
        closedTriggerStyles.borderLeftWidth
      ];
      await act(async () => {
        Simulate.keyDown(trigger as HTMLButtonElement, { key: 'ArrowDown' });
        await Promise.resolve();
      });
      const openTriggerStyles = window.getComputedStyle(trigger as HTMLButtonElement);
      expect(trigger?.getAttribute('aria-expanded')).toBe('true');
      expect([
        openTriggerStyles.borderTopWidth,
        openTriggerStyles.borderRightWidth,
        openTriggerStyles.borderBottomWidth,
        openTriggerStyles.borderLeftWidth
      ]).toEqual(closedTriggerBorderWidths);
      const categoryItem = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
      ).find((item) => item.textContent?.trim() === 'Category');
      expect(categoryItem?.getAttribute('aria-haspopup')).toBe('menu');
      await act(async () => {
        Simulate.keyDown(categoryItem as HTMLElement, { key: 'ArrowRight' });
        await Promise.resolve();
      });
      const activeItem = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')
      ).find((item) => item.textContent?.trim() === 'Active');
      expect(activeItem).toBeDefined();

      await act(async () => {
        Simulate.click(activeItem as HTMLElement);
      });
      expect(onChange).toHaveBeenCalledWith(['column'], ['Category/Active']);
    } finally {
      ReactDom.unmountComponentAtNode(container);
      container.remove();
    }
  });
});
