/**
 * Folder management utilities for organizing projects.
 *
 * Provides functions for:
 * - Creating, renaming, and deleting folders
 * - Moving projects between folders
 * - Listing folders with preview thumbnails
 *
 * @module lib/folders
 */

import { invoke } from '@tauri-apps/api/core';

/** A folder containing multiple projects */
export interface Folder {
  /** Unique folder ID */
  id: string;
  /** Display name */
  name: string;
  /** Array of project paths in this folder */
  project_paths: string[];
  /** Unix timestamp (ms) when folder was created */
  created_at: number;
  /** Unix timestamp (ms) when folder was last updated */
  updated_at: number;
}

/** Folder info for dashboard display with preview thumbnails */
export interface FolderInfo {
  /** Unique folder ID */
  id: string;
  /** Display name */
  name: string;
  /** Number of projects in the folder */
  project_count: number;
  /** Up to 4 base64-encoded thumbnails for grid preview */
  preview_thumbnails: (string | null)[];
  /** Unix timestamp (ms) when folder was last updated */
  updated_at: number;
}

/**
 * List all folders with preview information.
 * @returns Array of folder info sorted by last updated
 */
export async function listFolders(): Promise<FolderInfo[]> {
  return invoke<FolderInfo[]>('list_folders');
}

/**
 * Create a new folder.
 * @param name - Display name for the folder
 * @returns The created folder
 */
export async function createFolder(name: string): Promise<Folder> {
  return invoke<Folder>('create_folder', { name });
}

/**
 * Rename an existing folder.
 * @param folderId - ID of the folder to rename
 * @param name - New display name
 */
export async function renameFolder(folderId: string, name: string): Promise<void> {
  return invoke('rename_folder', { folderId, name });
}

/**
 * Delete a folder. Projects in the folder become unfiled.
 * @param folderId - ID of the folder to delete
 */
export async function deleteFolder(folderId: string): Promise<void> {
  return invoke('delete_folder', { folderId });
}

/**
 * Add a project to a folder.
 * @param folderId - ID of the folder
 * @param projectPath - Absolute path to the project
 */
export async function addProjectToFolder(folderId: string, projectPath: string): Promise<void> {
  return invoke('add_project_to_folder', { folderId, projectPath });
}

/**
 * Remove a project from a folder.
 * @param folderId - ID of the folder
 * @param projectPath - Absolute path to the project
 */
export async function removeProjectFromFolder(
  folderId: string,
  projectPath: string
): Promise<void> {
  return invoke('remove_project_from_folder', { folderId, projectPath });
}

/**
 * Move a project to a folder, or remove from all folders.
 * @param projectPath - Absolute path to the project
 * @param folderId - ID of the target folder, or null to unfile
 */
export async function moveProjectToFolder(
  projectPath: string,
  folderId: string | null
): Promise<void> {
  return invoke('move_project_to_folder', { projectPath, folderId });
}

/**
 * Get the folder ID for a project.
 * @param projectPath - Absolute path to the project
 * @returns Folder ID if the project is in a folder, null otherwise
 */
export async function getProjectFolder(projectPath: string): Promise<string | null> {
  return invoke<string | null>('get_project_folder', { projectPath });
}

/**
 * Get all project paths that are in folders.
 * Used to filter unfiled projects on the dashboard.
 * @returns Array of project paths that are filed in folders
 */
export async function getFiledProjectPaths(): Promise<string[]> {
  return invoke<string[]>('get_filed_project_paths');
}

/**
 * Get all project paths in a specific folder.
 * @param folderId - ID of the folder
 * @returns Array of project paths
 */
export async function getFolderProjects(folderId: string): Promise<string[]> {
  return invoke<string[]>('get_folder_projects', { folderId });
}

/**
 * Get folder details by ID.
 * @param folderId - ID of the folder
 * @returns Folder details or null if not found
 */
export async function getFolder(folderId: string): Promise<Folder | null> {
  return invoke<Folder | null>('get_folder', { folderId });
}
