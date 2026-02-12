/**
 * Wizard Step 4: Hosting Provider (placeholder)
 *
 * Shows a "Coming Soon" message. Always skippable.
 */

interface HostingStepProps {
  onSkip: () => void;
}

export function HostingStep({ onSkip }: HostingStepProps) {
  return (
    <div className="wizard-step-items">
      <div className="wizard-hosting-placeholder">
        <div className="wizard-hosting-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="var(--bg-tertiary)" />
            <path
              d="M24 14v20M14 24h20"
              stroke="var(--text-muted)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="24" cy="24" r="8" stroke="var(--text-muted)" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <h3 className="wizard-hosting-title">Coming Soon</h3>
        <p className="wizard-hosting-desc">
          Hosting provider integration is on the way. You can set this up later from your project
          settings.
        </p>
        <button className="wizard-hosting-skip-btn" onClick={onSkip}>
          Skip for Now
        </button>
      </div>
    </div>
  );
}
