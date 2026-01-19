import { useState, useRef, useCallback, ReactNode, useEffect } from "react";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultSplit?: number; // percentage for left pane (0-100)
  minLeft?: number; // minimum percentage for left
  minRight?: number; // minimum percentage for right
}

export function SplitPane({
  left,
  right,
  defaultSplit = 50,
  minLeft = 20,
  minRight = 20,
}: SplitPaneProps) {
  const [split, setSplit] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store drag listeners in ref for cleanup on unmount
  const dragListenersRef = useRef<{
    move: ((e: MouseEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });

  // Cleanup drag listeners on unmount
  useEffect(() => {
    return () => {
      const { move, up } = dragListenersRef.current;
      if (move) document.removeEventListener("mousemove", move);
      if (up) document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = (x / rect.width) * 100;

      // Clamp to min/max
      const clamped = Math.max(minLeft, Math.min(100 - minRight, percentage));
      setSplit(clamped);

      // Trigger resize event for terminals to recalculate
      window.dispatchEvent(new Event("resize"));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      dragListenersRef.current = { move: null, up: null };
    };

    // Store listeners for cleanup
    dragListenersRef.current = { move: handleMouseMove, up: handleMouseUp };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [minLeft, minRight]);

  return (
    <div ref={containerRef} className="split-pane">
      {/* Overlay to capture mouse events during drag (prevents iframe from stealing events) */}
      {isDragging && <div className="split-pane-overlay" />}
      <div className="split-pane-left" style={{ width: `${split}%` }}>
        {left}
      </div>
      <div className="split-pane-handle" onMouseDown={handleMouseDown}>
        <div className="split-pane-handle-bar" />
      </div>
      <div className="split-pane-right" style={{ width: `${100 - split}%` }}>
        {right}
      </div>
    </div>
  );
}
