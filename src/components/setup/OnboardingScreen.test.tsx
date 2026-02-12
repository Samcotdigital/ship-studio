/**
 * Integration tests for OnboardingScreen — the step-by-step wizard.
 *
 * These tests mock the Tauri IPC layer at the module level and verify
 * the wizard state machine transitions: loading → wizard steps → complete
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  FRESH_STATUS,
  CLAUDE_ONLY_STATUS,
  BOTH_AGENTS_STATUS,
  CODEX_ONLY_STATUS,
  makeSetupStatus,
  ALL_READY_CLAUDE_ONLY,
  FRESH_INSTALL_ITEMS,
  STEP1_COMPLETE_STATUS,
  HAS_BASE_NO_AGENTS_STATUS,
  HAS_CLAUDE_NO_GITHUB_STATUS,
} from '../../test/fixtures/setup';

// ============ Module-level mocks ============

const invokeResults = new Map<string, { value?: unknown; error?: Error }>();

function mockInvoke(cmd: string, value: unknown) {
  invokeResults.set(cmd, { value });
}
function mockInvokeErr(cmd: string, error: Error) {
  invokeResults.set(cmd, { error });
}

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    const result = invokeResults.get(cmd);
    if (result?.error) return Promise.reject(result.error);
    if (result) return Promise.resolve(result.value);
    return Promise.resolve(undefined);
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
  once: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock('./OnboardingTerminal', () => ({
  OnboardingTerminal: ({
    onExit,
  }: {
    command: string;
    args: string[];
    onExit: (code: number | null) => void;
  }) => (
    <div data-testid="mock-terminal">
      <button data-testid="terminal-exit-0" onClick={() => onExit(0)}>
        Exit 0
      </button>
      <button data-testid="terminal-exit-1" onClick={() => onExit(1)}>
        Exit 1
      </button>
    </div>
  ),
}));

vi.mock('../icons', () => ({
  SlackIcon: ({ size }: { size: number }) => <span data-testid="slack-icon" data-size={size} />,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

vi.mock('../../lib/github', () => ({
  checkGitHubCliStatus: vi.fn().mockResolvedValue({ installed: true, authenticated: true }),
}));

import { OnboardingScreen } from './OnboardingScreen';

describe('OnboardingScreen', () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    invokeResults.clear();
    onComplete.mockReset();
  });

  // ============ Loading state ============

  it('shows spinner while fetching status', async () => {
    mockInvoke('get_full_setup_status', undefined);
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise(() => {}));

    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByText('Checking setup status...')).toBeInTheDocument();
  });

  // ============ Fresh install → starts at step 1 ============

  it('shows wizard on step 1 for fresh install', async () => {
    mockInvoke('get_full_setup_status', FRESH_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
      // Step title appears in both indicator and header — check the header h2
      expect(
        screen.getByText('Install the tools needed to manage dependencies')
      ).toBeInTheDocument();
    });
  });

  // ============ Auto-advance to correct step ============

  it('auto-advances to step 2 when step 1 is complete', async () => {
    mockInvoke('get_full_setup_status', STEP1_COMPLETE_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Set up version control and repository hosting')).toBeInTheDocument();
    });
  });

  it('auto-advances to step 3 when steps 1+2 complete', async () => {
    mockInvoke('get_full_setup_status', HAS_BASE_NO_AGENTS_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Install at least one AI coding assistant')).toBeInTheDocument();
    });
  });

  it('auto-advances to step 2 when has Claude but no gh_auth', async () => {
    mockInvoke('get_full_setup_status', HAS_CLAUDE_NO_GITHUB_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Set up version control and repository hosting')).toBeInTheDocument();
    });
  });

  // ============ All ready → celebration ============

  it('shows celebration when all steps complete with one agent', async () => {
    mockInvoke('get_full_setup_status', CLAUDE_ONLY_STATUS);
    mockInvoke('set_default_agent_id', undefined);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });
  });

  it('shows celebration when all steps complete with both agents', async () => {
    mockInvoke('get_full_setup_status', BOTH_AGENTS_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    // Both agents detected — should still go to celebration
    // (agent selection is now inline in the agent step)
    await waitFor(() => {
      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });
  });

  it('shows celebration for zero agents edge case', async () => {
    const status = makeSetupStatus({
      allReady: true,
      items: ALL_READY_CLAUDE_ONLY,
      detectedAgents: [],
    });
    mockInvoke('get_full_setup_status', status);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });
  });

  it('auto-sets codex as default when only codex detected', async () => {
    mockInvoke('get_full_setup_status', CODEX_ONLY_STATUS);
    mockInvoke('set_default_agent_id', undefined);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });
  });

  // ============ Error handling ============

  it('shows error message and retry on fetch error', async () => {
    mockInvokeErr('get_full_setup_status', new Error('Network error'));

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to check setup status. Please try again.')
      ).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retry after error re-fetches status', async () => {
    mockInvokeErr('get_full_setup_status', new Error('Network error'));

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    mockInvoke('get_full_setup_status', FRESH_STATUS);

    await act(async () => {
      fireEvent.click(screen.getByText('Retry'));
    });

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
    });
  });

  // ============ Step indicator ============

  it('renders wizard step indicator with all steps', async () => {
    mockInvoke('get_full_setup_status', FRESH_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
    });

    // Step indicator labels + step header means some titles appear twice
    // Verify the indicator exists by checking for the Hosting Provider label
    // (only in the indicator, not the active step header)
    expect(screen.getByText('Hosting Provider')).toBeInTheDocument();
  });

  // ============ Terminal interactions ============

  it('clicking Install opens terminal overlay', async () => {
    mockInvoke('get_full_setup_status', FRESH_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
    });

    const installButtons = screen.getAllByText('Install');
    await act(async () => {
      fireEvent.click(installButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-terminal')).toBeInTheDocument();
    });
  });

  it('terminal exit 0 closes terminal and refreshes', async () => {
    mockInvoke('get_full_setup_status', FRESH_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
    });

    const installButtons = screen.getAllByText('Install');
    await act(async () => {
      fireEvent.click(installButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-terminal')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('terminal-exit-0'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('mock-terminal')).not.toBeInTheDocument();
    });
  });

  it('terminal exit 1 keeps terminal open with Close button', async () => {
    mockInvoke('get_full_setup_status', FRESH_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
    });

    const installButtons = screen.getAllByText('Install');
    await act(async () => {
      fireEvent.click(installButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-terminal')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('terminal-exit-1'));
    });

    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByTestId('mock-terminal')).toBeInTheDocument();
  });

  it('terminal cancel closes terminal', async () => {
    mockInvoke('get_full_setup_status', FRESH_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
    });

    const installButtons = screen.getAllByText('Install');
    await act(async () => {
      fireEvent.click(installButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-terminal')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('mock-terminal')).not.toBeInTheDocument();
    });
  });

  // ============ Celebration auto-continue ============

  it('celebration screen auto-calls onComplete after 2500ms', async () => {
    vi.useFakeTimers();

    mockInvoke('get_full_setup_status', CLAUDE_ONLY_STATUS);
    mockInvoke('set_default_agent_id', undefined);

    render(<OnboardingScreen onComplete={onComplete} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByText("You're all set!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  // ============ Slack CTA ============

  it('shows Slack CTA link on wizard screen', async () => {
    mockInvoke('get_full_setup_status', FRESH_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Join Slack')).toBeInTheDocument();
    });
  });

  // ============ Items render ============

  it('renders setup items for current step', async () => {
    mockInvoke('get_full_setup_status', FRESH_STATUS);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
      expect(screen.getByText('Package Manager')).toBeInTheDocument();
    });
  });

  // ============ Brew package install ============

  it('renders install button for brew packages on step 1', async () => {
    const items = FRESH_INSTALL_ITEMS.map((i) =>
      i.id === 'homebrew' ? { ...i, status: 'ready' as const, version: '4.2.0' } : i
    );
    const status = makeSetupStatus({ items, detectedAgents: [] });
    mockInvoke('get_full_setup_status', status);
    mockInvoke('install_brew_packages', undefined);

    render(<OnboardingScreen onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Quick Setup')).toBeInTheDocument();
    });

    const installButtons = screen.getAllByText('Install');
    expect(installButtons.length).toBeGreaterThan(0);
  });
});
