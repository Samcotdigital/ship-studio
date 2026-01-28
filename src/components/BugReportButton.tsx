/**
 * Floating bug report button with draggable positioning.
 *
 * Renders a small button that can be dragged anywhere on screen.
 * Opens a modal for submitting bug reports via Formspark.
 *
 * @module components/BugReportButton
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { BugIcon } from './icons';
import '../styles/bug-report.css';

const FORMSPARK_ACTION = 'https://submit-form.com/13matekcb';

interface Position {
  x: number;
  y: number;
}

export function BugReportButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [position, setPosition] = useState<Position>({
    x: window.innerWidth - 60,
    y: window.innerHeight - 60,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const dragStartMouse = useRef<Position>({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  // Form state
  const [loomUrl, setLoomUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      hasDragged.current = false;
      dragStartPos.current = { x: position.x, y: position.y };
      dragStartMouse.current = { x: e.clientX, y: e.clientY };
    },
    [position]
  );

  // Handle drag move and end
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartMouse.current.x;
      const deltaY = e.clientY - dragStartMouse.current.y;

      // Check if we've moved enough to count as a drag
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDragged.current = true;
      }

      const newX = dragStartPos.current.x + deltaX;
      const newY = dragStartPos.current.y + deltaY;

      // Constrain to window bounds
      const buttonSize = 48;
      const constrainedX = Math.max(0, Math.min(window.innerWidth - buttonSize, newX));
      const constrainedY = Math.max(0, Math.min(window.innerHeight - buttonSize, newY));

      setPosition({ x: constrainedX, y: constrainedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle click (only if not dragged)
  const handleClick = useCallback(() => {
    if (!hasDragged.current) {
      setIsModalOpen(true);
    }
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loomUrl.trim() && !description.trim()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch(FORMSPARK_ACTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          loom_url: loomUrl.trim() || undefined,
          description: description.trim() || undefined,
          timestamp: new Date().toISOString(),
          platform: navigator.platform,
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setLoomUrl('');
        setDescription('');
        // Close modal after success message
        setTimeout(() => {
          setIsModalOpen(false);
          setSubmitStatus('idle');
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSubmitStatus('idle');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        className={`bug-report-button ${isDragging ? 'dragging' : ''}`}
        style={{
          left: position.x,
          top: position.y,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        title="Report a Bug"
      >
        <BugIcon size={22} />
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="bug-report-overlay" onClick={handleClose} onKeyDown={handleKeyDown}>
          <div className="bug-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bug-report-header">
              <h2>Report a Bug</h2>
              <button className="bug-report-close" onClick={handleClose}>
                &times;
              </button>
            </div>

            {submitStatus === 'success' ? (
              <div className="bug-report-success">
                <span className="bug-report-success-icon">✓</span>
                <p>Thank you! Your report has been submitted.</p>
              </div>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)}>
                <div className="bug-report-body">
                  <div className="bug-report-field">
                    <label className="bug-report-label">
                      Loom Video URL <span className="bug-report-preferred">(Preferred)</span>
                    </label>
                    <input
                      type="url"
                      className="bug-report-input"
                      value={loomUrl}
                      onChange={(e) => setLoomUrl(e.target.value)}
                      placeholder="https://www.loom.com/share/..."
                      autoFocus
                    />
                    <p className="bug-report-hint">
                      Record your screen showing the bug with{' '}
                      <a href="https://www.loom.com" target="_blank" rel="noopener noreferrer">
                        Loom
                      </a>
                    </p>
                  </div>

                  <div className="bug-report-divider">
                    <span>or</span>
                  </div>

                  <div className="bug-report-field">
                    <label className="bug-report-label">Description</label>
                    <textarea
                      className="bug-report-textarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what happened and what you expected to happen..."
                      rows={4}
                    />
                  </div>

                  {submitStatus === 'error' && (
                    <div className="bug-report-error">Failed to submit. Please try again.</div>
                  )}
                </div>

                <div className="bug-report-footer">
                  <button type="button" onClick={handleClose} disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || (!loomUrl.trim() && !description.trim())}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
