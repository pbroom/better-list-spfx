import * as React from 'react';
import * as ReactDom from 'react-dom';
import { act } from 'react-dom/test-utils';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';

import { GroupIconPickerDialog } from './GroupIconPickerDialog';

describe('GroupIconPickerDialog', () => {
  let container: HTMLDivElement;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 360
    });
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      ReactDom.unmountComponentAtNode(container);
    });
    container.remove();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight
    });
  });

  it('keeps dialog actions outside the scrolling content on short viewports', () => {
    act(() => {
      ReactDom.render(
        <FluentProvider targetDocument={document} theme={webLightTheme}>
          <GroupIconPickerDialog
            current={{ kind: 'image', url: '/sites/example/SiteAssets/group-icon.png' }}
            groupTitle="General"
            open
            onApply={jest.fn()}
            onOpenChange={jest.fn()}
          />
        </FluentProvider>,
        container
      );
    });

    const surface = document.body.querySelector('[role="dialog"]') as HTMLElement;
    const body = surface.querySelector('.fui-DialogBody') as HTMLElement;
    const content = surface.querySelector('.fui-DialogContent') as HTMLElement;
    const actions = surface.querySelector('.fui-DialogActions') as HTMLElement;
    const bodyStyles = window.getComputedStyle(body);

    expect(window.getComputedStyle(surface).maxHeight).toBe('calc(100dvh - 32px)');
    expect(bodyStyles.minHeight).toBe('0');
    expect(bodyStyles.overflowX).toBe('hidden');
    expect(bodyStyles.overflowY).toBe('hidden');
    expect(bodyStyles.gridTemplateRows.replace(/\s+/g, ' ')).toBe('auto minmax(0, 1fr) auto');
    expect(window.getComputedStyle(content).overflowY).toBe('auto');
    expect(actions.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(Array.from(actions.querySelectorAll('button')).map((button) => button.textContent)).toEqual([
      'Use automatic icon',
      'No icon',
      'Cancel',
      'Apply'
    ]);
  });
});
