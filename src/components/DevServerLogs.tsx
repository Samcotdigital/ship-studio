/**
 * DevServerLogs component that displays the dev server (npm run dev) output.
 *
 * This component creates a read-only terminal view using xterm.js to display
 * the output from the Next.js development server. It supports:
 * - Full ANSI color code rendering
 * - Automatic scrolling to latest output
 * - Terminal resize handling
 * - Live updates as new output arrives
 *
 * @module components/DevServerLogs
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { loadNerdFonts } from '../lib/fonts';
import '@xterm/xterm/css/xterm.css';

/** Props for the DevServerLogs component */
interface DevServerLogsProps {
  /** Current output from the dev server */
  output: string;
  /** Version number that changes when output updates (triggers re-render) */
  outputVersion: number;
}

export function DevServerLogs({ output, outputVersion }: DevServerLogsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);
  const lastWrittenLengthRef = useRef(0);

  // Initialize terminal after mount and fonts are loaded
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkReady = async () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        await loadNerdFonts();
        setIsReady(true);
      } else {
        requestAnimationFrame(() => void checkReady());
      }
    };
    void checkReady();
  }, []);

  // Create terminal when ready
  useEffect(() => {
    if (!isReady || !containerRef.current) return;

    const container = containerRef.current;

    // Create terminal with same styling as Claude terminal
    const term = new XTerm({
      fontFamily: '"JetBrainsMono NF", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: false,
      cursorStyle: 'block',
      scrollback: 10000,
      disableStdin: true, // Read-only
      theme: {
        background: '#1a1a1a',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#3a3d41',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(container);

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Write initial message
    term.write('\x1b[90m$ npm run dev\x1b[0m\r\n\r\n');

    // Write current output
    if (output) {
      term.write(output);
      lastWrittenLengthRef.current = output.length;
    }

    // Handle resize. `fit()` recomputes cols/rows from the new container
    // size but doesn't force xterm to repaint already-rendered lines at
    // the new width — so without `refresh()` you get overlapping text
    // (old glyphs at old column positions bleeding through the new
    // layout). Debounce to coalesce transient resize events (grid
    // animation, font load, tab switches) into a single fit+refresh.
    let resizeTimer: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        const t = terminalRef.current;
        const fit = fitAddonRef.current;
        if (!t || !fit) return;
        try {
          fit.fit();
          t.refresh(0, t.rows - 1);
        } catch {
          // fit() throws if container is 0×0 (e.g. mid-transition);
          // safe to ignore — next resize event will retry.
        }
      }, 16);
    });
    resizeObserver.observe(container);

    return () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      lastWrittenLengthRef.current = 0;
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- output is intentionally excluded; incremental writes handled by separate effect below
  }, [isReady]); // Only recreate terminal when isReady changes

  // Write new output when it changes
  useEffect(() => {
    if (!terminalRef.current || !isReady) return;

    // Only write new content (what we haven't written yet)
    if (output.length > lastWrittenLengthRef.current) {
      const newContent = output.slice(lastWrittenLengthRef.current);
      terminalRef.current.write(newContent);
      lastWrittenLengthRef.current = output.length;
    }
  }, [output, outputVersion, isReady]);

  // Click to focus for scrolling
  const handleClick = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a1a',
      }}
    />
  );
}
