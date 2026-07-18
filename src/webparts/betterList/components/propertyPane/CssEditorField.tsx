import * as React from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution';

export interface ICssEditorTarget {
  label: string;
  selector: string;
  snippet: string;
}

export interface ICssEditorFieldProps {
  label: string;
  value: string;
  targets: readonly ICssEditorTarget[];
  onChange: (value: string) => void;
}

/**
 * A compact version of Better Divider's bundled Monaco field. Keeping Monaco
 * inside the bundle avoids CDN/CSP surprises on locked-down SharePoint tenants.
 */
export const CssEditorField: React.FunctionComponent<ICssEditorFieldProps> = (props) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = React.useRef(props.onChange);
  const [fallback, setFallback] = React.useState(false);

  React.useEffect(() => {
    onChangeRef.current = props.onChange;
  }, [props.onChange]);

  React.useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    try {
      const model = monaco.editor.createModel(props.value || '', 'scss');
      const editor = monaco.editor.create(containerRef.current, {
        model,
        automaticLayout: true,
        fontSize: 12,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: 'on'
      });
      editorRef.current = editor;
      const subscription = editor.onDidChangeModelContent(() => onChangeRef.current(editor.getValue()));
      return () => {
        subscription.dispose();
        editor.dispose();
        model.dispose();
        editorRef.current = null;
      };
    } catch {
      setFallback(true);
      return undefined;
    }
  }, []);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== props.value) {
      editor.setValue(props.value || '');
    }
  }, [props.value]);

  const insertTarget = (target: ICssEditorTarget): void => {
    const editor = editorRef.current;
    if (!editor) {
      props.onChange(`${props.value || ''}${props.value ? '\n\n' : ''}${target.snippet}`);
      return;
    }
    const selection = editor.getSelection();
    if (!selection) {
      return;
    }
    editor.executeEdits('better-list-target', [{ range: selection, text: target.snippet, forceMoveMarkers: true }]);
    editor.focus();
  };

  return (
    <div className="bl-pane__field bl-css-editor">
      <span className="bl-pane__label">{props.label}</span>
      <p className="bl-pane__help">
        Styles are scoped to this web part. Insert a supported target, then override only the declarations you need.
      </p>
      <div className="bl-css-editor__targets" aria-label="Custom style targets">
        {props.targets.map((target) => (
          <button key={target.selector} type="button" onClick={() => insertTarget(target)}>
            {target.label}
          </button>
        ))}
      </div>
      {fallback ? (
        <textarea
          aria-label={props.label}
          className="bl-css-editor__fallback"
          spellCheck={false}
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
      ) : (
        <div aria-label={props.label} className="bl-css-editor__monaco" ref={containerRef} />
      )}
    </div>
  );
};
