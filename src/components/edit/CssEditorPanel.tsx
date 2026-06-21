/**
 * CSS-Mode editor panel — the properties panel for the CSS visual editor
 * (`useCssEditor`). A SEPARATE feature from `VisualEditorPanel` (the Tailwind
 * one); it shares the `ss-edit-panel` chrome (draggable header, pin, close) for
 * an identical look, but its body edits a CSS rule's declarations directly:
 * any property, any value, written surgically to the stylesheet.
 *
 * States mirror the resolver: `resolved` (edit the rule's declarations),
 * `not_found` (offer to create the rule in an authored sheet), and the
 * read-only `needs_class` / `inline` / `multiple` cases with guidance.
 */

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../primitives/Button';
import { PinIcon } from '../icons/layout';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { trackEvent } from '../../lib/analytics';
import { buildCssPrepPrompt } from '../../lib/edit-css';
import type { CssSelection } from '../../hooks/useCssEditor';
import type { CssDeclaration } from '../../lib/edit-css';

const PANEL_WIDTH = 340;

/** Whether the browser accepts `value` for `prop` (unit validation). */
function cssSupports(prop: string, value: string): boolean {
  try {
    return (
      typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(prop, value)
    );
  } catch {
    return false;
  }
}

/** A valid CSS property name (lowercase letters, digits, hyphens; optional `--`). */
function isValidProperty(prop: string): boolean {
  return /^-{0,2}[a-z][a-z0-9-]*$/.test(prop.trim());
}

interface Props {
  selection: CssSelection | null;
  authoredSheets: string[];
  saving: boolean;
  /** Live-preview a property on the resolved rule (no write). */
  onPreview: (property: string, value: string | null) => void;
  /** Persist a property (remove when value is null). */
  onSave: (property: string, value: string | null) => void;
  /** Create a rule for `selector` in `file` (the not-found case). */
  onCreateRule: (file: string, selector: string, declarations?: CssDeclaration[]) => void;
  /** Paste the prep prompt into the agent terminal (user presses Enter). */
  onSendToClaude?: (prompt: string) => void;
  onClose: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
}

/** One editable `property: value` row. Previews on change, saves on commit
 *  (blur / Enter), reverts on Escape. */
function DeclarationRow({
  decl,
  onPreview,
  onSave,
}: {
  decl: CssDeclaration;
  onPreview: (property: string, value: string | null) => void;
  onSave: (property: string, value: string | null) => void;
}) {
  // Seeded from the declaration; the parent keys this row by property+value, so a
  // save (which advances decl.value) remounts it with the fresh seed — no effect.
  const [value, setValue] = useState(decl.value);
  const valid = value.trim() !== '' && cssSupports(decl.property, value.trim());

  const commit = () => {
    const next = value.trim();
    if (next === decl.value || !valid) {
      setValue(decl.value); // revert invalid / unchanged
      onPreview(decl.property, decl.value);
      return;
    }
    onSave(decl.property, next);
  };

  return (
    <div className="ss-css-row">
      <span className="ss-css-row__prop" title={decl.property}>
        {decl.property}
      </span>
      <input
        className={`ss-css-row__value${value.trim() && !valid ? ' is-invalid' : ''}`}
        value={value}
        spellCheck={false}
        onChange={(e) => {
          setValue(e.target.value);
          const v = e.target.value.trim();
          if (v && cssSupports(decl.property, v)) onPreview(decl.property, v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          else if (e.key === 'Escape') {
            setValue(decl.value);
            onPreview(decl.property, decl.value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <button
        type="button"
        className="ss-css-row__remove"
        title={`Remove ${decl.property}`}
        aria-label={`Remove ${decl.property}`}
        onClick={() => onSave(decl.property, null)}
      >
        ×
      </button>
    </div>
  );
}

/** The "add a new property" row. */
function AddDeclaration({
  onSave,
  onPreview,
}: {
  onSave: (property: string, value: string | null) => void;
  onPreview: (property: string, value: string | null) => void;
}) {
  const [prop, setProp] = useState('');
  const [value, setValue] = useState('');
  const propOk = isValidProperty(prop);
  const ready = propOk && value.trim() !== '' && cssSupports(prop.trim(), value.trim());

  const add = () => {
    if (!ready) return;
    onSave(prop.trim().toLowerCase(), value.trim());
    setProp('');
    setValue('');
  };

  return (
    <div className="ss-css-add">
      <input
        className="ss-css-add__prop"
        placeholder="property"
        value={prop}
        spellCheck={false}
        onChange={(e) => setProp(e.target.value)}
      />
      <input
        className="ss-css-add__value"
        placeholder="value"
        value={value}
        spellCheck={false}
        onChange={(e) => {
          setValue(e.target.value);
          if (propOk && e.target.value.trim() && cssSupports(prop.trim(), e.target.value.trim())) {
            onPreview(prop.trim().toLowerCase(), e.target.value.trim());
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
      />
      <Button variant="secondary" size="sm" onClick={add} disabled={!ready}>
        Add
      </Button>
    </div>
  );
}

export function CssEditorPanel({
  selection,
  authoredSheets,
  saving,
  onPreview,
  onSave,
  onCreateRule,
  onSendToClaude,
  onClose,
  pinned,
  onTogglePin,
}: Props) {
  const [pos, setPos] = useState(() => ({
    top: 76,
    left: Math.max(
      8,
      (typeof window !== 'undefined' ? window.innerWidth : 1280) - PANEL_WIDTH - 24
    ),
  }));
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  // The create-rule target; defaults (derived, no effect) to the first sheet.
  const [sheet, setSheet] = useState('');
  const effectiveSheet = sheet || authoredSheets[0] || '';

  const onHeaderPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.ss-edit-panel__header-actions')) return;
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onHeaderPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const w = rootRef.current?.offsetWidth ?? PANEL_WIDTH;
    const left = Math.max(8, Math.min(e.clientX - d.dx, window.innerWidth - w - 8));
    const top = Math.max(8, Math.min(e.clientY - d.dy, window.innerHeight - 40));
    setPos({ top, left });
  }, []);
  const onHeaderPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  // Agent-prep flow: a reviewable prompt that refactors an off-spec project
  // toward the editor's conventions. Shown from the empty state and the
  // read-only (inline / multiple / needs-class) states.
  const [prep, setPrep] = useState(false);
  const { copy, isCopied } = useCopyToClipboard();
  const prepPrompt = buildCssPrepPrompt(authoredSheets);
  const openPrep = useCallback(() => {
    setPrep(true);
    void trackEvent('visual_prep_started', { mode: 'css' });
  }, []);
  const prepLink = (
    <button type="button" className="ss-css-prep-link" onClick={openPrep}>
      Prepare this project for visual editing →
    </button>
  );

  const res = selection?.resolution;

  return (
    <div
      ref={rootRef}
      className={`ss-edit-panel${pinned ? ' ss-edit-panel--pinned' : ''}`}
      data-testid="css-editor-panel"
      style={
        pinned
          ? undefined
          : {
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              right: 'auto',
              zIndex: 1000,
              maxHeight: `min(520px, calc(100vh - ${pos.top + 16}px))`,
            }
      }
    >
      <div
        className="ss-edit-panel__header"
        onPointerDown={pinned ? undefined : onHeaderPointerDown}
        onPointerMove={pinned ? undefined : onHeaderPointerMove}
        onPointerUp={pinned ? undefined : onHeaderPointerUp}
      >
        <span className="ss-edit-panel__title">Edit CSS</span>
        <span className="ss-edit-panel__header-actions">
          {onTogglePin && (
            <button
              className={`ss-edit-panel__pin${pinned ? ' is-pinned' : ''}`}
              onClick={onTogglePin}
              title={pinned ? 'Unpin — float over the preview' : 'Pin as sidebar'}
              aria-pressed={pinned}
            >
              <PinIcon size={13} />
            </button>
          )}
          <button className="ss-edit-panel__close" onClick={onClose} aria-label="Exit edit mode">
            ×
          </button>
        </span>
      </div>

      <div className="ss-edit-panel__body">
        {prep && (
          <div className="ss-css-prep">
            <p className="ss-css-prep__lead">
              Hand this to your coding agent to refactor the project's styling into clean,
              class-based CSS the editor can edit. It keeps the site looking the same.
            </p>
            <div className="ss-css-prep__box">{prepPrompt}</div>
            <div className="ss-css-prep__actions">
              <Button variant="ghost" size="sm" onClick={() => setPrep(false)}>
                Back
              </Button>
              <div className="ss-css-prep__right">
                <Button variant="secondary" size="sm" onClick={() => void copy(prepPrompt)}>
                  {isCopied ? 'Copied!' : 'Copy'}
                </Button>
                {onSendToClaude && (
                  <Button variant="primary" size="sm" onClick={() => onSendToClaude(prepPrompt)}>
                    Paste into terminal
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {!prep && !selection && (
          <div className="ss-css-empty">
            <p className="ss-css-empty__lead">Click an element to edit its styles.</p>
            <p className="ss-css-empty__hint">
              Edits change the element's CSS class rule — any property, any value — and apply
              everywhere that class is used.
            </p>
            {prepLink}
          </div>
        )}

        {!prep && selection && !res && <p className="ss-css-status">Resolving…</p>}

        {!prep && selection && res?.status === 'resolved' && (
          <>
            <div className="ss-css-context">
              <code className="ss-css-selector">{res.selector}</code>
              <span className="ss-css-file" title={res.file}>
                {res.file}
              </span>
            </div>
            {selection.instanceCount > 1 && (
              <p className="ss-css-instances">
                {selection.instanceCount} elements share this class — a save updates all of them.
              </p>
            )}
            <div className="ss-css-decls">
              {res.declarations.length === 0 && (
                <p className="ss-css-status">No declarations yet — add one below.</p>
              )}
              {res.declarations.map((d) => (
                <DeclarationRow
                  key={`${d.property}:${d.value}`}
                  decl={d}
                  onPreview={onPreview}
                  onSave={onSave}
                />
              ))}
            </div>
            <AddDeclaration onSave={onSave} onPreview={onPreview} />
          </>
        )}

        {!prep && res?.status === 'not_found' && (
          <div className="ss-css-create">
            <p className="ss-css-status">
              No CSS rule defines <code>{res.selector}</code> yet.
            </p>
            {authoredSheets.length > 0 ? (
              <>
                <label className="ss-css-create__label">
                  Stylesheet
                  <select value={effectiveSheet} onChange={(e) => setSheet(e.target.value)}>
                    {authoredSheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  block
                  disabled={!effectiveSheet}
                  onClick={() => onCreateRule(effectiveSheet, res.selector, [])}
                >
                  Create {res.selector}
                </Button>
              </>
            ) : (
              <p className="ss-css-readonly">
                No stylesheet found to add the rule to. Add a `.css` file linked in the page, then
                reselect.
              </p>
            )}
          </div>
        )}

        {!prep && res?.status === 'needs_class' && (
          <div className="ss-css-readonly">
            <p>
              This element has no class to style. Add a class to it in code, then reselect — or let
              the agent prepare the project.
            </p>
            {prepLink}
          </div>
        )}

        {!prep && res?.status === 'inline' && (
          <div className="ss-css-readonly">
            <p>
              This element is styled with an inline <code>style</code> attribute. Move those styles
              into a class to edit them here.
            </p>
            {prepLink}
          </div>
        )}

        {!prep && res?.status === 'multiple' && (
          <div className="ss-css-readonly">
            <p>
              <code>{res.selector}</code> is defined by {res.locations.length} rules, so it isn't
              safe to edit automatically. Consolidate it into one rule, then reselect.
            </p>
            <ul className="ss-css-locations">
              {res.locations.map((l) => (
                <li key={`${l.file}:${l.line}`}>
                  {l.file}:{l.line}
                </li>
              ))}
            </ul>
            {prepLink}
          </div>
        )}
      </div>

      <div className="ss-edit-panel__footer">
        <div className="ss-edit-panel__saved" aria-live="polite">
          {saving ? 'Saving…' : 'Edits save automatically'}
        </div>
      </div>
    </div>
  );
}
