/**
 * Status screen shown in the Preview pane while the dev server is coming up,
 * after the user stops waiting, or when the connect loop gives up.
 *
 * Replaces the old black-box "Starting dev server… Attempt 24/60" spinner that
 * had no way out. Now the user can:
 *   - Stop the retry loop immediately (no waiting for 60/60),
 *   - See the live dev-server logs inline (why is it stuck?), and
 *   - Hand the problem to the agent with the logs attached (Fix with agent).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './primitives/Button';
import { stripAnsi } from '../lib/ansi';

/** Last N log lines to show inline — enough to catch a compile error or an
 *  EADDRINUSE, small enough to stay readable in the cramped preview pane. */
const LOG_TAIL_LINES = 60;

export type DevServerPhase = 'loading' | 'stopped' | 'error';

interface DevServerStatusProps {
  phase: DevServerPhase;
  isStaticProject: boolean;
  port: number;
  retryCount: number;
  maxRetries: number;
  /** Raw dev-server output (may contain ANSI); empty for static projects. */
  devServerOutput: string;
  /** Halt the connect loop now. */
  onStop: () => void;
  /** Restart the connect loop from attempt 0. */
  onRetry: () => void;
  /** Hand the stuck server + logs to the agent. Absent when no agent is wired. */
  onFixWithAgent?: () => void;
}

function title(phase: DevServerPhase, isStatic: boolean): string {
  if (phase === 'loading') return isStatic ? 'Starting preview…' : 'Starting dev server…';
  if (phase === 'stopped') return 'Stopped waiting';
  return isStatic ? 'Could not start preview' : 'Could not connect to dev server';
}

export function DevServerStatus({
  phase,
  isStaticProject,
  port,
  retryCount,
  maxRetries,
  devServerOutput,
  onStop,
  onRetry,
  onFixWithAgent,
}: DevServerStatusProps) {
  const [logsOpen, setLogsOpen] = useState(true);
  const logBodyRef = useRef<HTMLPreElement>(null);
  // Whether the view is pinned to the bottom — true until the user scrolls up to
  // read older output, so streaming logs auto-follow without yanking them away.
  const stickToBottomRef = useRef(true);

  const logTail = useMemo(() => {
    if (!devServerOutput) return '';
    return stripAnsi(devServerOutput).split('\n').slice(-LOG_TAIL_LINES).join('\n').trim();
  }, [devServerOutput]);

  // Follow the tail as new lines arrive (unless the user scrolled up).
  useEffect(() => {
    const el = logBodyRef.current;
    if (el && logsOpen && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logTail, logsOpen]);

  const handleLogScroll = () => {
    const el = logBodyRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  return (
    <div className={`preview-status preview-status--${phase}`}>
      {phase === 'loading' ? (
        <div className="spinner" />
      ) : (
        <div className="preview-status__icon" aria-hidden>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            {phase === 'stopped' ? (
              <>
                <line x1="10" y1="9" x2="10" y2="15" />
                <line x1="14" y1="9" x2="14" y2="15" />
              </>
            ) : (
              <>
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12" y2="16" />
              </>
            )}
          </svg>
        </div>
      )}

      <p className="preview-status__title">{title(phase, isStaticProject)}</p>

      <p className="hint">
        {phase === 'error' && !isStaticProject
          ? 'It never responded — check the logs below or hand it to the agent.'
          : phase === 'error' && isStaticProject
            ? 'Make sure the project contains an index.html file.'
            : `Waiting for localhost:${port}`}
      </p>

      {phase === 'loading' && retryCount > 0 && (
        <p className="preview-status__attempt">
          Attempt {retryCount}/{maxRetries}
        </p>
      )}

      <div className="preview-status__actions">
        {phase === 'loading' ? (
          <Button variant="secondary" size="sm" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
        {onFixWithAgent && (
          <Button variant="primary" size="sm" onClick={onFixWithAgent}>
            Fix with agent
          </Button>
        )}
      </div>

      {logTail && (
        <div className="preview-status__logs">
          <button
            type="button"
            className="preview-status__logs-toggle"
            onClick={() => setLogsOpen((v) => !v)}
            aria-expanded={logsOpen}
          >
            <svg
              className={`preview-status__chevron${logsOpen ? ' open' : ''}`}
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
            Logs
          </button>
          {logsOpen && (
            <pre ref={logBodyRef} className="preview-status__logs-body" onScroll={handleLogScroll}>
              {logTail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
