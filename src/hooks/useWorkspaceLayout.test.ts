import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspaceLayout } from './useWorkspaceLayout';

// Mock window lib
vi.mock('../lib/window', () => ({
  setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
  enterCompactMode: vi.fn().mockResolvedValue(undefined),
  exitCompactMode: vi.fn().mockResolvedValue(undefined),
  focusWindow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useWorkspaceLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useWorkspaceLayout({ isGitHubConnected: false }));

    expect(result.current.showDevServerLogs).toBe(false);
    expect(result.current.showHealthLogs).toBe(false);
    expect(result.current.isPreviewHidden).toBe(false);
    expect(result.current.workspaceTab).toBe('preview');
    expect(result.current.compactView).toBe('terminal');
    expect(result.current.isPinned).toBe(false);
  });

  it('toggles dev server logs visibility', () => {
    const { result } = renderHook(() => useWorkspaceLayout({ isGitHubConnected: false }));

    act(() => {
      result.current.setShowDevServerLogs(true);
    });
    expect(result.current.showDevServerLogs).toBe(true);

    act(() => {
      result.current.setShowDevServerLogs(false);
    });
    expect(result.current.showDevServerLogs).toBe(false);
  });

  it('switches workspace tabs', () => {
    const { result } = renderHook(() => useWorkspaceLayout({ isGitHubConnected: true }));

    act(() => {
      result.current.setWorkspaceTab('branches');
    });
    expect(result.current.workspaceTab).toBe('branches');

    act(() => {
      result.current.setWorkspaceTab('prs');
    });
    expect(result.current.workspaceTab).toBe('prs');
  });

  it('resets tabs to preview when GitHub disconnects', () => {
    const { result, rerender } = renderHook(
      ({ connected }) => useWorkspaceLayout({ isGitHubConnected: connected }),
      { initialProps: { connected: true } }
    );

    act(() => {
      result.current.setWorkspaceTab('branches');
      result.current.setCompactView('branches');
    });
    expect(result.current.workspaceTab).toBe('branches');
    expect(result.current.compactView).toBe('branches');

    rerender({ connected: false });

    expect(result.current.workspaceTab).toBe('preview');
    expect(result.current.compactView).toBe('terminal');
  });

  it('does not reset preview tab when GitHub disconnects if already on preview', () => {
    const { result, rerender } = renderHook(
      ({ connected }) => useWorkspaceLayout({ isGitHubConnected: connected }),
      { initialProps: { connected: true } }
    );

    // Already on preview/terminal (defaults)
    rerender({ connected: false });

    expect(result.current.workspaceTab).toBe('preview');
    expect(result.current.compactView).toBe('terminal');
  });

  it('toggles pin state', async () => {
    const { setAlwaysOnTop } = await import('../lib/window');
    const { result } = renderHook(() => useWorkspaceLayout({ isGitHubConnected: false }));

    await act(async () => {
      await result.current.handlePinToggle();
    });

    expect(result.current.isPinned).toBe(true);
    expect(setAlwaysOnTop).toHaveBeenCalledWith(true);

    await act(async () => {
      await result.current.handlePinToggle();
    });

    expect(result.current.isPinned).toBe(false);
    expect(setAlwaysOnTop).toHaveBeenCalledWith(false);
  });

  it('reverts pin state if setAlwaysOnTop fails', async () => {
    const { setAlwaysOnTop } = await import('../lib/window');
    vi.mocked(setAlwaysOnTop).mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useWorkspaceLayout({ isGitHubConnected: false }));

    await act(async () => {
      await result.current.handlePinToggle();
    });

    expect(result.current.isPinned).toBe(false);
  });

  it('resets layout clears log panels', () => {
    const { result } = renderHook(() => useWorkspaceLayout({ isGitHubConnected: false }));

    act(() => {
      result.current.setShowDevServerLogs(true);
      result.current.setShowHealthLogs(true);
    });

    act(() => {
      result.current.resetLayout();
    });

    expect(result.current.showDevServerLogs).toBe(false);
    expect(result.current.showHealthLogs).toBe(false);
  });

  it('toggles preview visibility', () => {
    const { result } = renderHook(() => useWorkspaceLayout({ isGitHubConnected: false }));

    act(() => {
      result.current.setIsPreviewHidden(true);
    });
    expect(result.current.isPreviewHidden).toBe(true);
  });
});
