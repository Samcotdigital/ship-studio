/**
 * Dismissible warning banner shown when editing the main branch.
 *
 * Displayed below the workspace header to warn users they're editing
 * the production branch directly. Can be dismissed for the session.
 *
 * @module components/MainBranchBanner
 */

import { useState } from 'react';
import { WarningIcon, CloseIcon, BranchIcon } from './icons';
import '../styles/main-branch-banner.css';

interface MainBranchBannerProps {
  /** Callback to create a new branch */
  onCreateBranch?: () => void;
}

export function MainBranchBanner({ onCreateBranch }: MainBranchBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <div className="main-branch-banner">
      <div className="main-branch-banner-content">
        <WarningIcon size={16} />
        <span className="main-branch-banner-text">
          You're editing <strong>main</strong> directly. Changes will go live immediately when
          published.
        </span>
        {onCreateBranch && (
          <button className="main-branch-banner-action" onClick={onCreateBranch}>
            <BranchIcon size={12} />
            Create branch
          </button>
        )}
      </div>
      <button
        className="main-branch-banner-close"
        onClick={() => setIsDismissed(true)}
        title="Dismiss"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
