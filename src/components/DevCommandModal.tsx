/**
 * Modal for configuring a custom dev command for generic projects.
 *
 * Allows users to specify a command (e.g., "cargo run", "npm run dev")
 * that Ship Studio will auto-start/stop/restart.
 */

import { useState, useEffect, useCallback } from 'react';
import '../styles/notifications.css';

interface DevCommandModalProps {
  currentCommand: string | null;
  onSave: (command: string | null) => void;
  onClose: () => void;
}

export function DevCommandModal({ currentCommand, onSave, onClose }: DevCommandModalProps) {
  const [command, setCommand] = useState(currentCommand ?? '');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSave = () => {
    const trimmed = command.trim();
    onSave(trimmed || null);
  };

  const handleClear = () => {
    onSave(null);
  };

  return (
    <div className="notification-settings-modal" onClick={onClose}>
      <div className="notification-settings-content" onClick={(e) => e.stopPropagation()}>
        <div className="notification-settings-header">
          <h2>Dev Server Command</h2>
          <p>Set a command to auto-start when you open this project.</p>
        </div>
        <div className="notification-settings-body">
          <div className="notification-setting-section">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="e.g., npm run dev, cargo run"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono, monospace)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                If set, this command will start automatically and can be restarted from the toolbar.
                Leave blank to manage the dev server yourself in the terminal.
              </span>
            </div>
          </div>
        </div>
        <div className="notification-settings-footer">
          {currentCommand && (
            <button
              className="notification-settings-cancel"
              onClick={handleClear}
              style={{ marginRight: 'auto' }}
            >
              Clear
            </button>
          )}
          <button className="notification-settings-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="notification-settings-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
