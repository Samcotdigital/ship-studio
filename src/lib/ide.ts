/**
 * IDE and Finder integration utilities.
 *
 * Provides functions for:
 * - Checking which IDEs (VS Code, Cursor) are available
 * - Opening projects in an IDE
 * - Opening paths in Finder
 *
 * @module lib/ide
 */

import { invoke } from '@tauri-apps/api/core';

/** IDE availability status */
export interface IdeAvailability {
  /** Whether VS Code is installed */
  vscode: boolean;
  /** Whether Cursor is installed */
  cursor: boolean;
}

/**
 * Check which IDEs are available on the system.
 * @returns Availability status for VS Code and Cursor
 */
export async function checkIdeAvailability(): Promise<IdeAvailability> {
  return invoke<IdeAvailability>('check_ide_availability');
}

/**
 * Open a project in the specified IDE.
 * @param projectPath - Absolute path to the project directory
 * @param ide - IDE to open ("vscode" or "cursor")
 */
export async function openInIde(projectPath: string, ide: 'vscode' | 'cursor'): Promise<void> {
  return invoke<void>('open_in_ide', { projectPath, ide });
}

/**
 * Open a path in macOS Finder.
 * @param path - Absolute path to open in Finder
 */
export async function openInFinder(path: string): Promise<void> {
  return invoke<void>('open_in_finder', { path });
}
