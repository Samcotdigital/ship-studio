/**
 * Agent abstraction layer for the frontend.
 *
 * All agent-specific values (binary names, flags, display strings) are
 * centralized here so the rest of the frontend is agent-agnostic.
 *
 * Currently only Claude Code is supported. Additional agents can be added
 * by defining new AgentConfig consts and updating getActiveAgent().
 *
 * @module lib/agent
 */

/** Configuration for an AI coding agent integrated with Ship Studio. */
export interface AgentConfig {
  /** Unique identifier (e.g., "claude-code") */
  id: string;
  /** Human-readable name (e.g., "Claude Code") */
  displayName: string;
  /** Binary name to spawn in terminal (e.g., "claude") */
  binaryName: string;
  /** Process name for display purposes */
  processName: string;
  /** Flag to skip permission prompts, or null if not supported */
  autoAcceptFlag: string | null;
  /** Whether this agent supports the skills system */
  supportsSkills: boolean;
  /** Whether this agent supports status detection via terminal title */
  supportsStatusDetection: boolean;
  /** Loading message shown while terminal starts */
  loadingMessage: string;
  /** Error message shown when binary is not found */
  notFoundMessage: string;
  /** Hint shown after not-found error (install instructions) */
  installHint: string;
}

/** Claude Code agent configuration. */
export const CLAUDE_CODE: AgentConfig = {
  id: 'claude-code',
  displayName: 'Claude Code',
  binaryName: 'claude',
  processName: 'claude',
  autoAcceptFlag: '--dangerously-skip-permissions',
  supportsSkills: true,
  supportsStatusDetection: true,
  loadingMessage: 'Starting Claude Code...',
  notFoundMessage: 'Error starting Claude',
  installHint: 'Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code',
};

/**
 * Returns the currently active agent configuration.
 *
 * For now this always returns CLAUDE_CODE. In the future, this could read
 * from a config file or user preference to support multiple agents.
 */
export function getActiveAgent(): AgentConfig {
  return CLAUDE_CODE;
}
