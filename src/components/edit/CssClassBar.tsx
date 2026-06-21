/**
 * Class bar + state switcher for the CSS-Mode editor.
 *
 * The class bar shows the selected element's classes as chips: click a chip to
 * pick which class's rule you're editing, `×` to remove a class from the
 * element, `+` to add one. The state switcher targets a pseudo-class (Default /
 * Hover / Focus / Active) — in CSS a state IS a selector (`.btn:hover`), so the
 * same resolve/edit engine handles it.
 */

import { useState } from 'react';

const STATES: { label: string; value: string | null }[] = [
  { label: 'Default', value: null },
  { label: 'Hover', value: 'hover' },
  { label: 'Focus', value: 'focus' },
  { label: 'Active', value: 'active' },
];

export function CssClassBar({
  classes,
  active,
  onSelect,
  onRemove,
  onAdd,
}: {
  classes: string[];
  active: string | null;
  onSelect: (name: string) => void;
  onRemove: (name: string) => void;
  onAdd: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const commit = () => {
    const n = val.trim().replace(/^\./, '');
    if (n) onAdd(n);
    setVal('');
    setAdding(false);
  };
  return (
    <div className="ss-css-classbar">
      {classes.map((c) => (
        <span key={c} className={`ss-css-chip${c === active ? ' is-active' : ''}`}>
          <button type="button" className="ss-css-chip__name" onClick={() => onSelect(c)}>
            .{c}
          </button>
          <button
            type="button"
            className="ss-css-chip__x"
            onClick={() => onRemove(c)}
            aria-label={`Remove .${c}`}
            title={`Remove .${c}`}
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          className="ss-css-chip__input"
          value={val}
          placeholder="class name"
          spellCheck={false}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
              setVal('');
              setAdding(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="ss-css-chip__add"
          onClick={() => setAdding(true)}
          title="Add a class"
          aria-label="Add a class"
        >
          +
        </button>
      )}
    </div>
  );
}

export function CssStateSwitcher({
  pseudo,
  onChange,
}: {
  pseudo: string | null;
  onChange: (pseudo: string | null) => void;
}) {
  return (
    <div className="ss-cc-seg ss-css-states" role="group" aria-label="State">
      {STATES.map((s) => (
        <button
          key={s.label}
          type="button"
          className={`ss-cc-seg__btn${pseudo === s.value ? ' is-active' : ''}`}
          aria-pressed={pseudo === s.value}
          onClick={() => onChange(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
