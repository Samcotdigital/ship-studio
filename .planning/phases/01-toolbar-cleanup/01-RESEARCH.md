# Phase 1: Toolbar Cleanup - Research

**Researched:** 2026-02-28
**Domain:** React component modification (UI cleanup)
**Confidence:** HIGH

## Summary

Phase 1 is a small, self-contained UI change involving two modifications to the workspace toolbar area. The Restart Server button currently displays both a refresh icon and a "Restart Server" text label; TOOL-01 requires removing the text label so only the icon remains. TOOL-02 requires adding a new settings cog icon button next to the restart button.

Both changes are confined to a single file (`src/components/WorkspaceView.tsx`) and its associated CSS. No new libraries, backend changes, or data model work is needed. The existing `SettingsIcon` component and `.toolbar-icon-btn` / `.show-preview-btn` CSS classes provide everything required.

**Primary recommendation:** Modify the restart button JSX to remove the `<span>Restart Server</span>` text and add a new settings cog button in the same `toolbarLeft` container, using the existing `show-preview-btn icon-only` pattern for consistent sizing with adjacent buttons.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOOL-01 | Restart Server button displays only a refresh icon with no text label | The button is at `WorkspaceView.tsx:571-586`. Remove the `<span>Restart Server</span>` at line 585. Apply `icon-only` class variant for consistent icon-only sizing. |
| TOOL-02 | Settings cog icon button appears next to the restart button in the toolbar | Add a new button in the `toolbarLeft` container (same div wrapping the restart button, lines 570-596). Use `SettingsIcon` (already imported at line 51) with `show-preview-btn icon-only` class to match adjacent buttons. Wire an `onClick` prop that Phase 2 will connect to the settings modal. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | (existing) | Component rendering | Already in use throughout the app |

### Supporting
No additional libraries needed. All icons and CSS classes already exist in the codebase.

### Alternatives Considered
None -- this phase uses only existing codebase primitives.

**Installation:**
```bash
# No packages to install
```

## Architecture Patterns

### Relevant File Structure
```
src/
├── components/
│   ├── WorkspaceView.tsx          # Contains the restart button (lines 568-606)
│   ├── WorkspaceHeader.tsx        # Top header bar (NOT where restart button lives)
│   ├── CodeHealthPanel.tsx        # Renders toolbarLeft/toolbarRight in .terminal-toolbar
│   └── icons/
│       ├── editor.tsx             # ResetIcon (refresh/restart icon)
│       ├── utility.tsx            # SettingsIcon (cog/gear icon)
│       └── index.tsx              # Re-exports all icons
├── styles/
│   ├── base.css                   # .toolbar-icon-btn class (header toolbar style)
│   └── workspace.css              # .show-preview-btn class (terminal toolbar style)
```

### Pattern 1: Terminal Toolbar Button Styling
**What:** The restart button uses `.show-preview-btn` class, not `.toolbar-icon-btn`. These are different toolbar areas.
**When to use:** Buttons in the terminal toolbar area (below the workspace header) use `.show-preview-btn`. Buttons in the workspace header bar use `.toolbar-icon-btn`.
**Key distinction:**
- `.toolbar-icon-btn` = workspace header actions (education, plugins, assets, IDE, env, backups, bug report)
- `.show-preview-btn` = terminal toolbar area (restart server, dev command, show preview, compact mode)
**Example (existing icon-only button in terminal toolbar):**
```tsx
// Source: WorkspaceView.tsx lines 588-594
<button
  className="show-preview-btn icon-only"
  onClick={openDevCommandModal}
  title="Edit dev command"
>
  <SettingsIcon size={12} />
</button>
```

### Pattern 2: Restart Button Current Structure
**What:** The restart button currently renders both icon and text in the `toolbarLeft` prop of `CodeHealthPanel`.
**Context:**
```tsx
// Source: WorkspaceView.tsx lines 571-586
<button
  className="show-preview-btn"
  onClick={() => void handleRestartDevServer()}
  disabled={isRestartingDevServer || (!hasDevServer && projectType !== 'statichtml')}
  title="Restart dev server"
  data-education-id="restart-server"
>
  {isRestartingDevServer ? (
    <div className="capture-spinner" />
  ) : (
    <ResetIcon size={14} />
  )}
  <span>Restart Server</span>   {/* <-- REMOVE THIS for TOOL-01 */}
</button>
```

### Pattern 3: Icon-Only Button Variant
**What:** `.show-preview-btn.icon-only` is the established pattern for icon-only buttons in the terminal toolbar.
**CSS definition (workspace.css lines 382-388):**
```css
.show-preview-btn.icon-only {
  width: 28px;
  height: 28px;
  padding: 0;
  justify-content: center;
  gap: 0;
  color: var(--text-muted);
}
```
**Important:** When converting the restart button to icon-only, add the `icon-only` class to get the correct 28x28 sizing with no padding/gap.

### Pattern 4: Settings Cog Button Placement
**What:** The new settings cog button should be added inside the same wrapper div as the restart button.
**Current structure of `toolbarLeft` (when web project or custom dev command):**
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  <button ...>Restart Server</button>        {/* TOOL-01: make icon-only */}
  {!isWebProject && (
    <button ...>Edit dev command</button>     {/* existing icon-only SettingsIcon */}
  )}
  {/* TOOL-02: ADD settings cog button HERE */}
</div>
```
**Important:** The existing SettingsIcon button at lines 588-594 is for "Edit dev command" -- it opens the dev command modal. The NEW settings cog button (TOOL-02) is a separate button for "Project Settings" that Phase 2 will wire to a settings modal.

### Anti-Patterns to Avoid
- **Using `.toolbar-icon-btn` class for the settings cog:** The success criteria says "follows the existing `.toolbar-icon-btn` visual style" but the button lives in the terminal toolbar, not the workspace header. The visual result is nearly identical (both use `var(--bg-tertiary)`, `var(--border)`, 6px radius), but use `.show-preview-btn icon-only` for consistency with adjacent buttons in the same toolbar. The `.toolbar-icon-btn` style is a plugin-stable public API class -- using it in the terminal toolbar would be semantically incorrect.
- **Removing the spinner state:** The restart button shows a spinner when `isRestartingDevServer` is true. This must be preserved.
- **Breaking the non-web-project branch:** When `!isWebProject && !(customDevCommand)`, a different toolbar renders ("Dev Server..." button). This phase only changes the web project / custom dev command branch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings icon | Custom SVG | `SettingsIcon` from `./icons` | Already exists, consistent with codebase |
| Icon-only button styling | Custom CSS | `.show-preview-btn.icon-only` class | Already handles sizing, padding, hover states |

**Key insight:** Every visual primitive needed for this phase already exists in the codebase. No new CSS, icons, or components are required -- only JSX modifications.

## Common Pitfalls

### Pitfall 1: Conflating the Two SettingsIcon Usages
**What goes wrong:** The existing SettingsIcon at line 593 (for "Edit dev command") could be confused with the new settings cog (for "Project Settings"). Adding the new button right next to it creates two adjacent cog-looking icons.
**Why it happens:** Both use `SettingsIcon` but serve completely different purposes.
**How to avoid:** The existing one only shows for non-web projects (`!isWebProject`). The new Project Settings cog should always appear (regardless of project type). Placement should be after the dev command button if present, so the visual order is: [Restart] [Dev Command (if non-web)] [Settings].
**Warning signs:** Two identical-looking buttons side by side for non-web projects.

### Pitfall 2: Forgetting the Non-Web-Project Toolbar Branch
**What goes wrong:** Only modifying the web-project branch of the conditional and missing the other branch (lines 597-605, "Dev Server..." button).
**Why it happens:** The `toolbarLeft` prop has a ternary: `isWebProject || customDevCommand ? (branch A) : (branch B)`. The restart button with text only exists in branch A.
**How to avoid:** TOOL-01 only applies to branch A (the restart button). The settings cog (TOOL-02) should appear in both branches so it's always accessible regardless of project type.

### Pitfall 3: onClick Handler for Settings Cog
**What goes wrong:** Hardcoding a specific action or leaving no onClick at all.
**Why it happens:** Phase 1 adds the button but Phase 2 wires it to the modal.
**How to avoid:** Pass an `onOpenSettings` callback prop through the component chain, similar to how `openDevCommandModal` is handled. For Phase 1, it can be a no-op or simply not wired yet. The important thing is the prop exists for Phase 2 to connect.

### Pitfall 4: CompactMode Has Its Own Restart Button
**What goes wrong:** Forgetting that CompactMode's `CompactActionsRow.tsx` also has a restart button.
**Why it happens:** The compact mode has its own button row that mirrors some workspace actions.
**How to avoid:** The CompactMode restart button (line 95-102 of `CompactActionsRow.tsx`) is already icon-only -- it only shows `ResetIcon` with no text label. No changes needed there. But consider whether the settings cog should also appear in compact mode (likely deferred to Phase 2 or beyond since compact mode has limited space).

## Code Examples

### TOOL-01: Remove Text Label from Restart Button
```tsx
// BEFORE (WorkspaceView.tsx lines 571-586):
<button
  className="show-preview-btn"
  onClick={() => void handleRestartDevServer()}
  disabled={isRestartingDevServer || (!hasDevServer && projectType !== 'statichtml')}
  title="Restart dev server"
  data-education-id="restart-server"
>
  {isRestartingDevServer ? (
    <div className="capture-spinner" />
  ) : (
    <ResetIcon size={14} />
  )}
  <span>Restart Server</span>
</button>

// AFTER:
<button
  className="show-preview-btn icon-only"
  onClick={() => void handleRestartDevServer()}
  disabled={isRestartingDevServer || (!hasDevServer && projectType !== 'statichtml')}
  title="Restart dev server"
  data-education-id="restart-server"
>
  {isRestartingDevServer ? (
    <div className="capture-spinner" />
  ) : (
    <ResetIcon size={14} />
  )}
</button>
```

### TOOL-02: Add Settings Cog Button
```tsx
// Add after the restart button and dev-command button, inside the same flex container:
<button
  className="show-preview-btn icon-only"
  onClick={onOpenSettings}
  title="Project Settings"
  data-education-id="project-settings"
>
  <SettingsIcon size={12} />
</button>
```

### Settings Callback Prop Threading
The `onOpenSettings` callback needs to be threaded from `WorkspaceView` props or state. The pattern follows the existing `openDevCommandModal`:
```tsx
// In WorkspaceView's props interface or destructured variables, add:
// onOpenSettings: () => void;
// OR for Phase 1 with no modal yet:
// const handleOpenSettings = () => { /* Phase 2 will implement */ };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text+icon buttons | Icon-only toolbar buttons | Already in codebase | Cleaner, more compact toolbar |

**Deprecated/outdated:** N/A -- this is a straightforward JSX modification.

## Open Questions

1. **Should the settings cog appear in the non-web-project toolbar branch too?**
   - What we know: The non-web-project branch shows a "Dev Server..." button (SettingsIcon + text). Settings should be accessible regardless of project type.
   - What's unclear: Whether to add it in both branches or restructure the conditional.
   - Recommendation: Add the settings cog in both branches. It's a project-level action, not dev-server-specific.

2. **What should onClick do in Phase 1?**
   - What we know: Phase 2 will wire it to a settings modal.
   - What's unclear: Should Phase 1 have a no-op handler or prepare a placeholder?
   - Recommendation: Add the prop/callback placeholder but don't wire a modal. A no-op callback or a console.log is fine. Phase 2 will replace it with the real handler.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `src/components/WorkspaceView.tsx` (restart button at lines 568-606)
- Direct codebase inspection of `src/components/WorkspaceHeader.tsx` (header toolbar buttons, `.toolbar-icon-btn` usage)
- Direct codebase inspection of `src/styles/workspace.css` (`.show-preview-btn` and `.show-preview-btn.icon-only` definitions, lines 354-394)
- Direct codebase inspection of `src/styles/base.css` (`.toolbar-icon-btn` definition, lines 178-205)
- Direct codebase inspection of `src/components/icons/utility.tsx` (`SettingsIcon`, lines 70-86)
- Direct codebase inspection of `src/components/icons/editor.tsx` (`ResetIcon`, line 192)
- Direct codebase inspection of `src/components/CodeHealthPanel.tsx` (`toolbarLeft`/`toolbarRight` rendering, lines 40-123)
- Direct codebase inspection of `src/components/CompactMode/CompactActionsRow.tsx` (already icon-only restart, lines 95-102)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all primitives exist in codebase
- Architecture: HIGH - Direct codebase inspection, clear component structure understood
- Pitfalls: HIGH - Identified all relevant code paths (web/non-web, compact mode, existing SettingsIcon usage)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- internal UI modification, no external dependencies)
