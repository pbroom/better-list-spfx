/* eslint-disable @rushstack/pair-react-dom-render-unmount -- Tests share one container and unmount it centrally after every case. */
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import {
  SourceEditorField,
  SourceEditorMonacoAdapter
} from '../../../../vendor/source-editor/SourceEditorField';
import { SourceWorkspaceField } from '../../../../vendor/source-editor/SourceWorkspaceField';
import { SourceEditorDiagnostic } from '../../../../vendor/source-editor/sourceEditorCore';
import { installTestResizeObserver } from '../../../../test/installTestResizeObserver';

describe('SourceEditorField', () => {
  let container: HTMLDivElement;
  let restoreResizeObserver: (() => void) | undefined;
  const unavailableMonaco: SourceEditorMonacoAdapter = {
    load: () => Promise.reject(new Error('Monaco unavailable'))
  };

  beforeEach(() => {
    restoreResizeObserver = installTestResizeObserver();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      ReactDom.unmountComponentAtNode(container);
    });
    container.remove();
    restoreResizeObserver?.();
    restoreResizeObserver = undefined;
  });

  it('keeps invalid and oversized drafts local while committing the next valid source', async () => {
    const onChange = jest.fn();
    const validate = (value: string): SourceEditorDiagnostic[] =>
      value.includes('<script>') ? [{ level: 'error', message: 'Scripts are not allowed.' }] : [];
    const render = (): void => {
      ReactDom.render(
        <SourceEditorField
          commitMode="valid"
          config={{ monacoAdapter: unavailableMonaco }}
          label="HTML template"
          language="html"
          maxBytes={24}
          validate={validate}
          value="<section>valid</section>"
          onChange={onChange}
        />,
        container
      );
    };

    await act(async () => {
      render();
      await settleEditorFallback();
    });
    const textarea = getTextareas(container)[0];

    changeTextarea(textarea, '<script>bad</script>');
    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Scripts are not allowed.');

    act(render);
    expect(getTextareas(container)[0].value).toBe('<script>bad</script>');

    changeTextarea(getTextareas(container)[0], 'x'.repeat(25));
    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('24 bytes');

    changeTextarea(getTextareas(container)[0], '<p>fixed</p>');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('<p>fixed</p>');
  });

  it('synchronizes fallback inline and floating drafts and closes from the keyboard shortcut', async () => {
    await act(async () => {
      ReactDom.render(
        <SourceEditorField
          label="Custom CSS"
          language="scss"
          config={{ monacoAdapter: unavailableMonaco }}
          value=".initial {}"
          onChange={jest.fn()}
        />,
        container
      );
      await settleEditorFallback();
    });

    const popOut = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pop out');
    expect(popOut).toBeDefined();
    act(() => {
      Simulate.click(popOut as HTMLButtonElement);
    });

    expect(getTextareas(document.body)).toHaveLength(2);
    changeTextarea(getTextareas(document.body)[0], '.changed {}');
    expect(getTextareas(document.body).map((textarea) => textarea.value)).toEqual(['.changed {}', '.changed {}']);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
    });
    expect(getTextareas(document.body)).toHaveLength(1);
  });

  it('opens one floating workspace and switches between CSS and HTML documents', async () => {
    await act(async () => {
      ReactDom.render(
        <SourceWorkspaceField
          label="Styles & template"
          documents={[
            {
              config: { monacoAdapter: unavailableMonaco },
              id: 'scss',
              label: 'CSS/SCSS',
              language: 'scss',
              value: '.better-list {}',
              onChange: jest.fn()
            },
            {
              config: { monacoAdapter: unavailableMonaco },
              id: 'html',
              label: 'HTML template',
              language: 'html',
              value: '<section></section>',
              onChange: jest.fn()
            }
          ]}
        />,
        container
      );
      await settleEditorFallback();
    });

    expect(container.querySelector('[role="tab"][aria-label="Split"]')).toBeNull();
    const popOut = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pop out');
    act(() => Simulate.click(popOut as HTMLButtonElement));
    expect(document.body.querySelectorAll('[role="dialog"][aria-label="Styles & template source workspace"]')).toHaveLength(1);
    const splitTab = document.body.querySelector<HTMLButtonElement>('[role="tab"][aria-label="Split"]');
    expect(splitTab).not.toBeNull();

    const htmlTab = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((button) =>
      button.textContent?.includes('HTML template')
    );
    act(() => Simulate.click(htmlTab as HTMLButtonElement));
    expect(htmlTab?.getAttribute('aria-selected')).toBe('true');
    expect(getTextareas(document.body).some((textarea) => textarea.value === '<section></section>')).toBe(true);

    act(() => Simulate.click(splitTab as HTMLButtonElement));
    expect(splitTab?.getAttribute('aria-selected')).toBe('true');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.textContent).toContain(
      'HTML template'
    );
  });

  it('preserves invalid drafts when the workspace moves into and out of the portal', async () => {
    const onChange = jest.fn();
    const validate = (value: string): SourceEditorDiagnostic[] =>
      value.includes('<script>') ? [{ level: 'error', message: 'Scripts are not allowed.' }] : [];

    await act(async () => {
      ReactDom.render(
        <SourceWorkspaceField
          label="Styles & template"
          documents={[
            {
              commitMode: 'valid',
              config: { monacoAdapter: unavailableMonaco },
              id: 'html',
              label: 'HTML template',
              language: 'html',
              validate,
              value: '<section>valid</section>',
              onChange
            }
          ]}
        />,
        container
      );
      await settleEditorFallback();
    });

    changeTextarea(getTextareas(container)[0], '<script>draft</script>');
    expect(onChange).not.toHaveBeenCalled();
    const popOut = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pop out');
    await act(async () => {
      Simulate.click(popOut as HTMLButtonElement);
      await settleEditorFallback();
    });
    expect(getTextareas(document.body).some((textarea) => textarea.value === '<script>draft</script>')).toBe(true);

    const close = document.body.querySelector<HTMLButtonElement>('[aria-label="Close source workspace"]');
    await act(async () => {
      Simulate.click(close as HTMLButtonElement);
      await settleEditorFallback();
    });
    expect(getTextareas(container)[0].value).toBe('<script>draft</script>');
  });

  it('lets Escape cancel a target rename without closing the floating workspace', async () => {
    await act(async () => {
      ReactDom.render(
        <SourceWorkspaceField
          label="Styles & template"
          documents={[
            {
              config: { monacoAdapter: unavailableMonaco },
              id: 'scss',
              label: 'CSS/SCSS',
              language: 'scss',
              targets: [{ editable: true, label: 'Card', selector: '.card', snippet: '.card {}' }],
              value: '.card {}',
              onChange: jest.fn()
            }
          ]}
        />,
        container
      );
      await settleEditorFallback();
    });

    const popOut = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pop out');
    act(() => Simulate.click(popOut as HTMLButtonElement));
    const edit = document.body.querySelector<HTMLButtonElement>('[aria-label="Edit .card"]');
    act(() => Simulate.click(edit as HTMLButtonElement));
    const renameInput = document.body.querySelector<HTMLInputElement>('[aria-label="Edit .card"]');
    expect(renameInput).not.toBeNull();

    act(() => {
      renameInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.body.querySelector<HTMLInputElement>('input[aria-label="Edit .card"]')).toBeNull();
  });

  it('remeasures floating shortcuts when the workspace resizes without ResizeObserver', async () => {
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, writable: true, value: undefined });
    let resizeObserverRestored = false;

    try {
      await act(async () => {
        ReactDom.render(
          <SourceWorkspaceField
            label="Styles & template"
            documents={[
              {
                config: { monacoAdapter: unavailableMonaco },
                id: 'scss',
                label: 'CSS/SCSS',
                language: 'scss',
                targets: [{ label: 'Card', selector: '.card', snippet: '.card {}' }],
                value: '.card {}',
                onChange: jest.fn()
              }
            ]}
          />,
          container
        );
        await settleEditorFallback();
      });

      const popOut = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pop out');
      await act(async () => {
        Simulate.click(popOut as HTMLButtonElement);
        await settleEditorFallback();
      });

      const toolbar = document.body.querySelector<HTMLElement>(
        '.bt-source-workspace--floating .bt-floating-editor__toolbar'
      );
      const workspace = document.body.querySelector<HTMLElement>('.bt-source-workspace--floating');
      const items = toolbar?.querySelector<HTMLElement>('.bt-floating-editor__toolbar-items');
      expect(workspace).not.toBeNull();
      expect(toolbar).not.toBeNull();
      expect(items).not.toBeNull();
      Object.defineProperty(toolbar as HTMLElement, 'clientWidth', { configurable: true, value: 100 });
      Object.defineProperty(items as HTMLElement, 'scrollWidth', { configurable: true, value: 200 });

      await act(async () => {
        (workspace as HTMLElement).style.width = '100px';
        await settleMutationObserver();
      });

      const collapsedTrigger = toolbar?.querySelector<HTMLButtonElement>('[aria-label="Open SCSS editor shortcuts"]');
      expect(collapsedTrigger).not.toBeNull();
      expect(collapsedTrigger?.classList.contains('bt-floating-editor__shortcut-menu-trigger')).toBe(true);
      restoreWindowProperty('ResizeObserver', resizeObserverDescriptor);
      resizeObserverRestored = true;
      act(() => Simulate.click(collapsedTrigger as HTMLButtonElement));
      expect(document.body.querySelector('[role="menu"][aria-label="SCSS editor shortcuts"]')).not.toBeNull();

      Object.defineProperty(toolbar as HTMLElement, 'clientWidth', { configurable: true, value: 400 });
      await act(async () => {
        (workspace as HTMLElement).style.width = '400px';
        await settleMutationObserver();
      });
      const expandedTrigger = toolbar?.querySelector<HTMLButtonElement>('[aria-label="Open SCSS editor shortcuts"]');
      expect(expandedTrigger).toBeNull();
    } finally {
      if (!resizeObserverRestored) {
        restoreWindowProperty('ResizeObserver', resizeObserverDescriptor);
      }
    }
  });
});

function getTextareas(root: ParentNode): HTMLTextAreaElement[] {
  return Array.from(root.querySelectorAll('textarea'));
}

function changeTextarea(textarea: HTMLTextAreaElement, value: string): void {
  act(() => {
    textarea.value = value;
    Simulate.change(textarea);
  });
}

async function settleEditorFallback(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function settleMutationObserver(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await settleEditorFallback();
}

function restoreWindowProperty(key: 'ResizeObserver', descriptor?: PropertyDescriptor): void {
  if (descriptor) {
    Object.defineProperty(window, key, descriptor);
    return;
  }
  delete (window as unknown as Record<string, unknown>)[key];
}
