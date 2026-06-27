/**
 * Shared CodeMirror 6 building blocks for the app's inline editors:
 * the visual editor's HTML/CSS box (`CodeOverlayEditor`) and the Code tab's
 * file editor (`CodeFileEditor`).
 *
 * Keeps one github-dark token palette and one chrome theme so both editors
 * match the Code tab's Shiki rendering — don't fork these per editor.
 *
 * @module lib/codemirror
 */

import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';

/* github-dark token colors (the same palette the Code tab's Shiki theme uses). */
export const ghDarkHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword], color: '#ff7b72' },
  { tag: [t.propertyName], color: '#79c0ff' },
  { tag: [t.variableName], color: '#ffa657' },
  { tag: [t.function(t.variableName), t.labelName], color: '#d2a8ff' },
  {
    tag: [t.number, t.bool, t.atom, t.color, t.constant(t.name), t.standard(t.name)],
    color: '#79c0ff',
  },
  {
    tag: [t.typeName, t.className, t.namespace, t.changed, t.annotation, t.self],
    color: '#79c0ff',
  },
  { tag: [t.string, t.special(t.string)], color: '#a5d6ff' },
  { tag: [t.comment, t.meta], color: '#8b949e', fontStyle: 'italic' },
  { tag: [t.tagName], color: '#7ee787' },
  { tag: [t.attributeName], color: '#79c0ff' },
  { tag: [t.invalid], color: '#f85149' },
]);

/* Editor chrome, themed with our tokens so it matches the panel surface. */
export const ssEditorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      color: 'var(--text-primary)',
      backgroundColor: 'var(--bg-tertiary)',
      fontSize: 'var(--font-size-xs)',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, monospace)',
      lineHeight: '1.6',
      overflow: 'auto',
      // Custom, theme-matched scrollbars (never the device's white default).
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--border) transparent',
      // Promote to its own compositing layer so the native caret has a clean
      // backing store and paints inside the panel's fixed, rounded, clipped box
      // (without this, WebKit drops the caret entirely — see .cm-content).
      transform: 'translateZ(0)',
    },
    '.cm-scroller::-webkit-scrollbar': { width: '10px', height: '10px' },
    '.cm-scroller::-webkit-scrollbar-track': { background: 'transparent' },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      background: 'var(--border)',
      borderRadius: '999px',
      border: '2px solid var(--bg-tertiary)',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': { background: 'var(--text-muted)' },
    '.cm-scroller::-webkit-scrollbar-corner': { background: 'transparent' },
    // Native caret, tinted bright. It renders invisibly inside the panel's
    // rounded `overflow:hidden` compositing layer (a known WebKit bug) unless the
    // editor is promoted to its own backing layer — see `.cm-scroller` above.
    '.cm-content': {
      padding: 'var(--spacing-sm) 0',
      caretColor: 'var(--text-bright, #fff)',
    },
    '.cm-line': { padding: '0 var(--spacing-sm)' },
    '.cm-cursor, .cm-cursor-primary': {
      borderLeftColor: 'var(--text-bright, #fff)',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--tint)' },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--tint-strong)' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-muted)',
      border: 'none',
    },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  },
  { dark: true }
);

export const ghDarkExtension: Extension = syntaxHighlighting(ghDarkHighlight);

/**
 * Map a Shiki language id (as returned by `read_project_file`) to a CodeMirror
 * grammar extension. Returns `[]` for languages without a bundled grammar — the
 * file is still fully editable, just without syntax colors. We only bundle the
 * grammars common in the supported starters to keep the dependency surface small.
 */
export function codeLanguageExtension(language: string): Extension {
  switch (language) {
    case 'javascript':
      return javascript();
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'json':
      return json();
    case 'html':
    case 'astro':
    case 'vue':
    case 'svelte':
      // Close-enough HTML highlighting for the templating languages.
      return html();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    case 'markdown':
      return markdown();
    default:
      return [];
  }
}
