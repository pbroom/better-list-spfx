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

describe('SourceEditorField', () => {
  let container: HTMLDivElement;
  const unavailableMonaco: SourceEditorMonacoAdapter = {
    load: () => Promise.reject(new Error('Monaco unavailable'))
  };

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

    const popOut = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pop out');
    act(() => Simulate.click(popOut as HTMLButtonElement));
    expect(document.body.querySelectorAll('[role="dialog"][aria-label="Styles & template source workspace"]')).toHaveLength(1);

    const htmlTab = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent === 'HTML template'
    );
    act(() => Simulate.click(htmlTab as HTMLButtonElement));
    expect(htmlTab?.getAttribute('aria-selected')).toBe('true');
    expect(getTextareas(document.body).some((textarea) => textarea.value === '<section></section>')).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
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
