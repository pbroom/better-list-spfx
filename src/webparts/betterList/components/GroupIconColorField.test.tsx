/* eslint-disable @rushstack/pair-react-dom-render-unmount -- Each render is paired with the shared afterEach cleanup. */
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { act } from 'react-dom/test-utils';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';

import { GroupIconColorField } from './GroupIconColorField';

describe('GroupIconColorField', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      ReactDom.unmountComponentAtNode(container);
    });
    container.remove();
  });

  it('shows SharePoint theme colors below the hue slider and commits a selected swatch', () => {
    const onChange = jest.fn();
    act(() => {
      ReactDom.render(
        <FluentProvider targetDocument={document} theme={webLightTheme}>
          <GroupIconColorField
            themeColors={[
              { key: 'themePrimary', label: 'Theme primary', color: '#0078d4' },
              { key: 'neutralPrimary', label: 'Neutral primary', color: '#323130' }
            ]}
            value="#0078d4"
            onChange={onChange}
          />
        </FluentProvider>,
        container
      );
    });

    const trigger = document.body.querySelector('[aria-label="Open icon color picker"]') as HTMLButtonElement;
    act(() => trigger.click());

    const hueSlider = document.body.querySelector('[aria-label="Icon color hue"]') as HTMLElement;
    const swatchPicker = document.body.querySelector('[aria-label="SharePoint theme colors"]') as HTMLElement;
    expect(hueSlider.compareDocumentPosition(swatchPicker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const neutralSwatch = document.body.querySelector(
      '[aria-label="Neutral primary, #323130"]'
    ) as HTMLButtonElement;
    act(() => neutralSwatch.click());

    expect(onChange).toHaveBeenLastCalledWith('#323130');
    expect((container.querySelector('[aria-label="Icon color value"]') as HTMLInputElement).value).toBe('#323130');
  });

  it('omits the theme color section when no site palette is available', () => {
    act(() => {
      ReactDom.render(
        <FluentProvider targetDocument={document} theme={webLightTheme}>
          <GroupIconColorField value={undefined} onChange={jest.fn()} />
        </FluentProvider>,
        container
      );
    });

    const trigger = document.body.querySelector('[aria-label="Open icon color picker"]') as HTMLButtonElement;
    act(() => trigger.click());

    expect(document.body.querySelector('[aria-label="SharePoint theme colors"]')).toBeNull();
  });
});
