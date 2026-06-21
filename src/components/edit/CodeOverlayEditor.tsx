/**
 * A plain, monospace code textarea used by the element HTML editor and the
 * CSS-mode Code view.
 *
 * It used to overlay a transparent textarea on a Shiki-highlighted <pre> for
 * syntax coloring, but that overlay kept misaligning the two layers in the panel
 * context (the colored text drifted from the caret, so clicks landed in the
 * wrong place). A single textarea has nothing to misalign or intercept, so
 * editing is rock-solid. Syntax highlighting can return later via a real editor
 * (e.g. CodeMirror) if it's worth the weight.
 *
 * `lang` is kept on the props for API compatibility (callers pass html/css);
 * it's unused now that there's no highlighter.
 */

import type { HighlightLang } from '../../lib/highlight';

interface Props {
  value: string;
  onChange: (value: string) => void;
  lang: HighlightLang;
  className?: string;
  placeholder?: string;
}

export function CodeOverlayEditor({ value, onChange, className, placeholder }: Props) {
  return (
    <textarea
      className={`ss-codeedit${className ? ` ${className}` : ''}`}
      value={value}
      spellCheck={false}
      wrap="off"
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
