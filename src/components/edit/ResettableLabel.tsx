/**
 * Control label that doubles as a Reset affordance — Webflow-style. When the
 * value is set ON the active breakpoint (not inherited), clicking the label name
 * reveals a "Reset?" button; clicking that clears the value back to its inherited
 * or default state. Inherited/unset labels render as plain text.
 */

import { useEffect, useRef, useState } from 'react';
import { LayerDot } from './LayerDot';
import { type Breakpoint } from '../../lib/edit';

interface Props {
  label: string;
  /** Where the effective value came from (from readLayer). */
  definedAt: Breakpoint | null;
  /** The breakpoint currently being edited. */
  active: Breakpoint;
  /** Clear the value at the active breakpoint. */
  onReset: () => void;
}

export function ResettableLabel({ label, definedAt, active, onReset }: Props) {
  // Resettable only when the value is set on THIS breakpoint (a solid LayerDot).
  const setHere = definedAt !== null && definedAt.name === active.name;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close the "Reset?" affordance on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!setHere) {
    return (
      <span className="ss-edit-panel__label">
        {label}
        <LayerDot definedAt={definedAt} active={active} />
      </span>
    );
  }

  return (
    <span className="ss-edit-panel__label ss-edit-panel__label--resettable" ref={ref}>
      <button
        type="button"
        className="ss-edit-panel__labelbtn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={`Set on ${active.name} — click to reset`}
      >
        {label}
        <LayerDot definedAt={definedAt} active={active} />
      </button>
      {open && (
        <button
          type="button"
          className="ss-edit-panel__resetbtn"
          onClick={() => {
            onReset();
            setOpen(false);
          }}
        >
          Reset
        </button>
      )}
    </span>
  );
}
