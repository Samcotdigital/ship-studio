/**
 * Header shown when a class string resolves to multiple identical source spots.
 * Default is "edit all" (one change writes to every spot); a "just one" affordance
 * opens a picker so the user can target a single location instead.
 */

import { useState } from 'react';
import { type SourceLocation } from '../../lib/edit';

interface Props {
  locations: SourceLocation[];
  /** 'all' (default) or the index of a single location being edited. */
  target: 'all' | number;
  onChange: (t: 'all' | number) => void;
}

export function MultiSourceControl({ locations, target, onChange }: Props) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="ss-edit-panel__multisrc">
      {target === 'all' ? (
        <p className="ss-edit-panel__multi">
          Editing {locations.length} places that share these classes.{' '}
          <button
            type="button"
            className="ss-edit-panel__linkbtn"
            aria-expanded={picking}
            onClick={() => setPicking((p) => !p)}
          >
            Just one?
          </button>
        </p>
      ) : (
        <p className="ss-edit-panel__multi">
          Editing only <code>{locations[target]?.file}</code>.{' '}
          <button type="button" className="ss-edit-panel__linkbtn" onClick={() => onChange('all')}>
            Edit all {locations.length}
          </button>
        </p>
      )}

      {picking && target === 'all' && (
        <ul className="ss-edit-panel__loclist" role="listbox" aria-label="Pick a source location">
          {locations.map((l, i) => (
            <li key={`${l.file}:${l.line}`}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="ss-edit-panel__locitem"
                onClick={() => {
                  onChange(i);
                  setPicking(false);
                }}
              >
                {l.file}:{l.line}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
