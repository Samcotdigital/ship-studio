/**
 * Application entry point.
 *
 * Renders the main App component into the DOM root element.
 * Wrapped in React.StrictMode for development warnings and checks.
 *
 * Supports multi-window: if a `project` URL parameter is present,
 * the window opens directly to that project instead of the projects list.
 *
 * @module main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { exposeReactGlobals } from './lib/plugin-loader';
import { exposePluginContextRef } from './contexts/PluginContext';
import { OverlayScrollbars } from 'overlayscrollbars';
import 'overlayscrollbars/overlayscrollbars.css';

// Expose React globals and context ref for plugins before any rendering
exposeReactGlobals(React, ReactDOM);
exposePluginContextRef();

// Patch removeChild to handle nodes relocated by OverlayScrollbars.
// When OS wraps a scrollable element, it moves children into a viewport wrapper.
// If React then unmounts the parent, it tries to removeChild on the original nodes
// which are no longer direct children — causing a crash. This patch handles that.
// eslint-disable-next-line @typescript-eslint/unbound-method
const origRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function <T extends Node>(child: T): T {
  if (child.parentNode !== this) {
    // Node was relocated (likely by OverlayScrollbars) — remove from actual parent
    if (child.parentNode) return child.parentNode.removeChild(child);
    return child;
  }
  return origRemoveChild.call(this, child) as T;
};

// Initialize OverlayScrollbars on scrollable elements.
// Uses a debounced MutationObserver to catch dynamically added containers.
// Skips elements with scrollbar-width: none (intentionally hidden scrollbars).
const OS_ATTR = 'data-os-init';
const OS_OPTS = { scrollbars: { theme: 'os-theme-shipstudio', autoHide: 'move' as const } };

function initScrollbars() {
  document.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.closest('[class*="-modal"], [class*="-overlay"], [class*="-dropdown"]')) return;
    if (el.matches('.branches-tab, .prs-tab')) return;
    if (el.hasAttribute(OS_ATTR)) return;
    const style = getComputedStyle(el);
    if (style.scrollbarWidth === 'none') return;
    const oy = style.overflowY;
    if (oy === 'auto' || oy === 'scroll') {
      el.setAttribute(OS_ATTR, '');
      OverlayScrollbars(el, OS_OPTS);
    }
  });
}

requestAnimationFrame(() => {
  initScrollbars();

  let timer: number;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(initScrollbars, 150);
  }).observe(document.body, { childList: true, subtree: true });
});

// Parse project path from URL if present (for project windows)
const urlParams = new URLSearchParams(window.location.search);
const initialProjectPath = urlParams.get('project');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App initialProjectPath={initialProjectPath} />
    </ErrorBoundary>
  </React.StrictMode>
);
