/**
 * Editable code surface for the Code tab (CodeMirror 6).
 *
 * Mounted in place of the read-only Shiki viewer when the user toggles Edit
 * mode. Shares the github-dark palette + chrome theme with the rest of the
 * app's inline editors (see `lib/codemirror`) so toggling between read and
 * edit doesn't visually jump. Grammar is picked from the file's inferred
 * language; unsupported languages still edit fine, just without colors.
 *
 * Controlled via `value`/`onChange`. `onSave` is wired to Mod-S so the standard
 * save shortcut works while the editor has focus.
 */

import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit, bracketMatching } from '@codemirror/language';
import { ghDarkExtension, ssEditorTheme, codeLanguageExtension } from '../../lib/codemirror';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Shiki language id from `read_project_file` (drives grammar selection). */
  language: string;
  onSave?: () => void;
}

export function CodeFileEditor({ value, onChange, language, onSave }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Keep the listeners pointed at the latest callbacks without recreating the view.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Mount the editor. Recreated only when the grammar changes (i.e. a different
  // file's language) — the doc itself flows through the sync effect below.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              onSaveRef.current?.();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        codeLanguageExtension(language),
        ghDarkExtension,
        ssEditorTheme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // `value` is seeded once; external updates flow through the sync effect below.
    // Only the grammar warrants a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // External value changes (e.g. a save committed the buffer, or the file was
  // reloaded) → replace the doc without losing the editor instance.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className="code-file-editor" />;
}
