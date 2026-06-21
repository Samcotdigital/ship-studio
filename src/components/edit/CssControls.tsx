/**
 * Structured visual controls for the CSS-Mode editor (Phase 4).
 *
 * Renders one category's controls (segmented / select / length / color) for a
 * resolved rule. Each control reads its value straight from the rule's
 * declarations and writes a single CSS property: a quick `onPreview` for live
 * feedback, then `onSave` to persist surgically. The "Custom" / raw-CSS path
 * lives in the panel's Code view, not here.
 */

import { useState } from 'react';
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

const HEX = /^#[0-9a-fA-F]{3,8}$/;

interface ControlProps {
  value: string;
  onPreview: (property: string, value: string | null) => void;
  onSave: (property: string, value: string | null) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
                // Click an active segment again to clear the property.
                const next = active ? null : o.value;
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
      <select
        className="ss-cc-select"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onPreview(prop, v || null);
          onSave(prop, v || null);
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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

function ColorControl({
  prop,
  label,
  value,
  onPreview,
  onSave,
}: ControlProps & { prop: string; label: string }) {
  const [v, setV] = useState(value);
  const swatch = HEX.test(v.trim()) ? v.trim() : '#000000';
  const commit = () => {
    const next = v.trim();
    if (next === value) return;
    if (next !== '' && !cssSupports(prop, next)) {
      setV(value);
      return;
    }
    onSave(prop, next === '' ? null : next);
  };
  return (
    <Field label={label}>
      <div className="ss-cc-color">
        <input
          type="color"
          className="ss-cc-swatch"
          value={swatch}
          aria-label={`${label} swatch`}
          onChange={(e) => {
            setV(e.target.value);
            onPreview(prop, e.target.value);
          }}
          onBlur={commit}
        />
        <input
          className="ss-cc-input"
          value={v}
          placeholder="—"
          spellCheck={false}
          onChange={(e) => {
            setV(e.target.value);
            const t = e.target.value.trim();
            if (t && cssSupports(prop, t)) onPreview(prop, t);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </Field>
  );
}

function Control({ control, value, onPreview, onSave }: { control: CssControl } & ControlProps) {
  // Key by value so external changes (a save advancing the rule) re-seed inputs.
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
    </div>
  );
}
