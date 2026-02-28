/**
 * Modal for configuring project settings.
 *
 * Currently supports setting the dev server port.
 * The parent component handles persistence via Tauri commands.
 */

import { useState, useEffect, useCallback } from 'react';
import '../styles/notifications.css';

interface ProjectSettingsModalProps {
  currentPort: number;
  onSave: (port: number) => void;
  onClose: () => void;
}

export function ProjectSettingsModal({ currentPort, onSave, onClose }: ProjectSettingsModalProps) {
  const [port, setPort] = useState(currentPort);

  const isValid = Number.isInteger(port) && port >= 1 && port <= 65535;

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
    if (isValid) {
      onSave(port);
    }
  };

  return (
    <div className="notification-settings-modal" onClick={onClose}>
      <div className="notification-settings-content" onClick={(e) => e.stopPropagation()}>
        <div className="notification-settings-header">
          <h2>Project Settings</h2>
          <p>Configure settings for this project.</p>
        </div>
        <div className="notification-settings-body">
          <div className="notification-setting-section">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                Dev Server Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                min={1}
                max={65535}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValid) handleSave();
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {!isValid && (
                <span style={{ fontSize: 12, color: 'var(--error, #ef4444)' }}>
                  Port must be between 1 and 65535
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                The port Ship Studio uses to connect to your dev server. Default is 3000.
              </span>
            </div>
          </div>
        </div>
        <div className="notification-settings-footer">
          <button className="notification-settings-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="notification-settings-save" onClick={handleSave} disabled={!isValid}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
