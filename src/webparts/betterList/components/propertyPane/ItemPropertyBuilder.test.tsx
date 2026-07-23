import * as React from 'react';
import * as ReactDom from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import { installTestResizeObserver } from '../../../../test/installTestResizeObserver';
import { ColumnPickerMenu } from './ItemPropertyBuilder';

describe('ColumnPickerMenu', () => {
  it('mounts a standalone menu in its explicit target document', async () => {
    const container = document.createElement('div');
    const frame = document.createElement('iframe');
    document.body.append(container, frame);
    const targetDocument = frame.contentDocument as Document;
    const restoreResizeObserver = installTestResizeObserver(targetDocument.defaultView as Window);

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

    act(() => {
      ReactDom.unmountComponentAtNode(container);
    });
    restoreResizeObserver();
    container.remove();
    frame.remove();
  });
});
