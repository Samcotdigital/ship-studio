/**
 * Structured visual controls for the CSS-Mode editor (Phase 4).
 *
 * Renders one category's controls (segmented / dropdown / length / color) for a
 * resolved rule, plus an always-available "add any property" row. Each control
 * reads its value straight from the rule's declarations and writes a single CSS
 * property: a quick `onPreview` for live feedback, then `onSave` to persist.
 *
 * Dropdowns and the color popover reuse the Tailwind editor's components
 * (`EnumDropdown`, `ColorPicker`) so both editors look and behave identically.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../primitives/Button';
import { EnumDropdown } from './EnumDropdown';
import { ColorPicker } from './ColorPicker';
import { CSS_CATEGORIES, cssValueOf, type CssControl, type SegOption } from '../../lib/cssControls';
import type { CssDeclaration } from '../../lib/edit-css';

function cssSupports(prop: string, value: string): boolean {
  try {
    return (
      typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(prop, value)
    );
  } catch {
    return false;
  }
}

function isValidProperty(prop: string): boolean {
  return /^-{0,2}[a-z][a-z0-9-]*$/.test(prop.trim());
}

interface ControlProps {
  value: string;
  onPreview: (property: string, value: string | null) => void;
  onSave: (property: string, value: string | null) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ss-cc-field">
      <span className="ss-cc-label">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  prop,
  label,
  options,
  value,
  onPreview,
  onSave,
}: ControlProps & { prop: string; label: string; options: SegOption[] }) {
  return (
    <Field label={label}>
      <div className="ss-cc-seg" role="group" aria-label={label}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={`ss-cc-seg__btn${active ? ' is-active' : ''}`}
              title={o.title ?? o.label ?? o.value}
              aria-pressed={active}
              onClick={() => {
                const next = active ? null : o.value; // click active again to clear
                onPreview(prop, next);
                onSave(prop, next);
              }}
            >
              {o.glyph ?? o.label ?? o.value}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function SelectControl({
  prop,
  label,
  options,
  value,
  onPreview,
  onSave,
}: ControlProps & { prop: string; label: string; options: { value: string; label: string }[] }) {
  return (
    <Field label={label}>
      <EnumDropdown
        label={label}
        value={value || null}
        options={[
          { label: '—', token: '' },
          ...options.map((o) => ({ label: o.label, token: o.value })),
        ]}
        onChange={(token) => {
          const v = token || null;
          onPreview(prop, v);
          onSave(prop, v);
        }}
      />
    </Field>
  );
}

function LengthControl({
  prop,
  label,
  placeholder,
  value,
  onPreview,
  onSave,
}: ControlProps & { prop: string; label: string; placeholder?: string }) {
  const [v, setV] = useState(value);
  const valid = v.trim() === '' || cssSupports(prop, v.trim());
  const commit = () => {
    const next = v.trim();
    if (next === value) return;
    if (next !== '' && !valid) {
      setV(value);
      onPreview(prop, value || null);
      return;
    }
    onSave(prop, next === '' ? null : next);
  };
  return (
    <Field label={label}>
      <input
        className={`ss-cc-input${!valid ? ' is-invalid' : ''}`}
        value={v}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          setV(e.target.value);
          const t = e.target.value.trim();
          if (t && cssSupports(prop, t)) onPreview(prop, t);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          else if (e.key === 'Escape') {
            setV(value);
            onPreview(prop, value || null);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </Field>
  );
}

/** Color control: a swatch that opens the shared ColorPicker popover. Previews
 *  live while dragging; commits the final value when the popover closes. */
function ColorControl({
  prop,
  label,
  value,
  onPreview,
  onSave,
}: ControlProps & { prop: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const [local, setLocal] = useState(value || '');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef(value);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 216;
    const H = 250;
    const M = 8;
    let left = r.left - W - M;
    if (left < M) left = r.right + M;
    left = Math.min(Math.max(M, left), window.innerWidth - W - M);
    const top = Math.min(Math.max(M, r.top), window.innerHeight - H - M);
    setRect({ top, left });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (latestRef.current !== value) onSave(prop, latestRef.current || null);
  }, [prop, value, onSave]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <Field label={label}>
      <button
        ref={triggerRef}
        type="button"
        className="ss-color-swatch"
        title={`${label} color`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
          } else {
            latestRef.current = value;
            setLocal(value || '');
            setOpen(true);
          }
        }}
      >
        {value ? (
          <span className="ss-color-swatch__chip" style={{ background: value }} />
        ) : (
          <span className="ss-color-swatch__empty">—</span>
        )}
      </button>
      {open &&
        rect &&
        createPortal(
          <div ref={popRef} className="ss-color-popover" style={{ top: rect.top, left: rect.left }}>
            <ColorPicker
              value={local || '#000000'}
              onChange={(css) => {
                setLocal(css);
                latestRef.current = css;
                onPreview(prop, css);
              }}
            />
          </div>,
          document.body
        )}
    </Field>
  );
}

function Control({ control, value, onPreview, onSave }: { control: CssControl } & ControlProps) {
  const key = `${control.prop}:${value}`;
  switch (control.kind) {
    case 'segmented':
      return (
        <Segmented
          prop={control.prop}
          label={control.label}
          options={control.options}
          value={value}
          onPreview={onPreview}
          onSave={onSave}
        />
      );
    case 'select':
      return (
        <SelectControl
          prop={control.prop}
          label={control.label}
          options={control.options}
          value={value}
          onPreview={onPreview}
          onSave={onSave}
        />
      );
    case 'length':
      return (
        <LengthControl
          key={key}
          prop={control.prop}
          label={control.label}
          placeholder={control.placeholder}
          value={value}
          onPreview={onPreview}
          onSave={onSave}
        />
      );
    case 'color':
      return (
        <ColorControl
          key={key}
          prop={control.prop}
          label={control.label}
          value={value}
          onPreview={onPreview}
          onSave={onSave}
        />
      );
  }
}

/** Type any CSS property + value and add it to the rule. Always available so no
 *  property is ever out of reach of the visual editor. */
function AddProp({ onSave }: { onSave: (property: string, value: string | null) => void }) {
  const [prop, setProp] = useState('');
  const [value, setValue] = useState('');
  const ready =
    isValidProperty(prop) && value.trim() !== '' && cssSupports(prop.trim(), value.trim());
  const add = () => {
    if (!ready) return;
    onSave(prop.trim().toLowerCase(), value.trim());
    setProp('');
    setValue('');
  };
  return (
    <div className="ss-cc-add">
      <span className="ss-cc-label">Add property</span>
      <div className="ss-cc-add__row">
        <input
          className="ss-cc-input"
          placeholder="property"
          value={prop}
          spellCheck={false}
          onChange={(e) => setProp(e.target.value)}
        />
        <input
          className="ss-cc-input"
          placeholder="value"
          value={value}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <Button variant="secondary" size="sm" onClick={add} disabled={!ready}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function CssControls({
  category,
  declarations,
  onPreview,
  onSave,
}: {
  category: string;
  declarations: CssDeclaration[];
  onPreview: (property: string, value: string | null) => void;
  onSave: (property: string, value: string | null) => void;
}) {
  const get = (p: string) => cssValueOf(declarations, p);
  const cat = CSS_CATEGORIES.find((c) => c.id === category);
  if (!cat) return null;
  const controls = cat.controls.filter((c) => !c.showIf || c.showIf(get));
  return (
    <div className="ss-cc">
      {controls.map((c) => (
        <Control
          key={c.prop}
          control={c}
          value={get(c.prop)}
          onPreview={onPreview}
          onSave={onSave}
        />
      ))}
      <AddProp onSave={onSave} />
    </div>
  );
}
