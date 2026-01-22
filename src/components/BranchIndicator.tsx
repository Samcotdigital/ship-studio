/**
 * Branch indicator component for workspace header.
 *
 * Shows the current branch name with:
 * - Branch icon
 * - Branch name
 * - "Live" badge if on main branch
 * - "Unsaved" badge if there are uncommitted changes
 *
 * When on the Branches/PRs tab, shows "Back to Preview" instead.
 *
 * @module components/BranchIndicator
 */

import { BranchIcon, ChevronIcon } from "./icons";

interface BranchIndicatorProps {
  /** Current branch name */
  currentBranch: string;
  /** Whether there are uncommitted changes */
  hasUncommittedChanges: boolean;
  /** Whether currently showing branches/prs tab */
  isOnBranchesTab: boolean;
  /** Callback when clicked - navigates to Branches tab or back to preview */
  onClick: () => void;
}

export function BranchIndicator({
  currentBranch,
  hasUncommittedChanges,
  isOnBranchesTab,
  onClick,
}: BranchIndicatorProps) {
  const isMainBranch = currentBranch === "main" || currentBranch === "master";

  if (isOnBranchesTab) {
    return (
      <div className="branch-indicator">
        <button className="branch-indicator-button branch-indicator-back" onClick={onClick}>
          <ChevronIcon size={14} className="back-chevron" />
          <span>Back to Preview</span>
        </button>
      </div>
    );
  }

  return (
    <div className="branch-indicator">
      <button className="branch-indicator-button" onClick={onClick}>
        <BranchIcon size={14} />
        <span className="branch-name">{currentBranch}</span>
        {isMainBranch && <span className="branch-live-badge">Live</span>}
        {hasUncommittedChanges && <span className="branch-unsaved-badge">Unsaved</span>}
      </button>
    </div>
  );
}
