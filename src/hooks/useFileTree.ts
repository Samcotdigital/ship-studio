/**
 * Hook for managing file tree state in the code browser.
 *
 * Handles loading the file tree, expanding/collapsing directories,
 * selecting files, and lazy-loading file content on demand.
 *
 * @module hooks/useFileTree
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listProjectFiles,
  readProjectFile,
  saveProjectFile,
  buildFileTree,
  type FileTreeNode,
  type FileContent,
} from '../lib/code';
import { logger } from '../lib/logger';
import { useAsyncState } from './useAsyncState';

interface UseFileTreeResult {
  tree: FileTreeNode[];
  expandedPaths: Set<string>;
  selectedFilePath: string | null;
  fileContent: FileContent | null;
  isLoadingTree: boolean;
  isLoadingFile: boolean;
  treeError: string | null;
  fileError: string | null;
  toggleDirectory: (path: string) => void;
  selectFile: (path: string) => void;
  refreshTree: () => void;
  // Inline editing of the selected file.
  isEditing: boolean;
  draft: string;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  beginEdit: () => void;
  cancelEdit: () => void;
  updateDraft: (value: string) => void;
  /** Persist the draft; resolves true on success, false on failure. */
  saveFile: () => Promise<boolean>;
}

export function useFileTree(projectPath: string): UseFileTreeResult {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const selectedFileRef = useRef(selectedFilePath);
  useEffect(() => {
    selectedFileRef.current = selectedFilePath;
  }, [selectedFilePath]);

  const fetchTree = useCallback(async (path: string) => {
    try {
      const entries = await listProjectFiles(path);
      return buildFileTree(entries);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to load file tree', { error: msg });
      throw err;
    }
  }, []);
  const {
    data: treeData,
    isLoading: isLoadingTree,
    error: treeErrorObj,
    execute: executeLoadTree,
  } = useAsyncState<FileTreeNode[], [string]>(fetchTree, { initial: [] });
  const tree = treeData ?? [];
  const treeError = treeErrorObj ? treeErrorObj.message : null;

  const fetchFile = useCallback(async (proj: string, path: string) => {
    try {
      return await readProjectFile(proj, path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to read file', { path, error: msg });
      throw err;
    }
  }, []);
  const fileState = useAsyncState<FileContent, [string, string]>(fetchFile);
  const {
    data: fileContent,
    isLoading: isLoadingFile,
    error: fileErrorObj,
    execute: executeLoadFile,
    setData: setFileContent,
    reset: resetFile,
  } = fileState;
  // Clear fileContent when execute fails (matches previous behavior)
  const executeLoadFileAndClear = useCallback(
    async (proj: string, path: string) => {
      const result = await executeLoadFile(proj, path);
      if (result === null) {
        // Error occurred — clear stale content
        setFileContent(null);
      }
      return result;
    },
    [executeLoadFile, setFileContent]
  );
  const fileError = fileErrorObj ? fileErrorObj.message : null;

  // Inline edit state for the selected file.
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isDirty = isEditing && fileContent != null && draft !== fileContent.content;
  // The file-switch guard reads dirtiness from a closure, so mirror it in a ref.
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const exitEdit = useCallback(() => {
    setIsEditing(false);
    setDraft('');
    setSaveError(null);
  }, []);

  // Reset state when project changes
  useEffect(() => {
    setSelectedFilePath(null);
    setFileContent(null);
    resetFile();
    setExpandedPaths(new Set());
    exitEdit();
  }, [projectPath, setFileContent, resetFile, exitEdit]);

  const loadTree = useCallback(() => executeLoadTree(projectPath), [executeLoadTree, projectPath]);

  // Load tree on mount / project change
  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const toggleDirectory = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectFile = useCallback(
    async (path: string) => {
      if (path === selectedFileRef.current) return;
      // Guard against silently dropping unsaved edits when switching files.
      if (
        isDirtyRef.current &&
        !window.confirm('You have unsaved changes. Discard them and switch files?')
      ) {
        return;
      }
      exitEdit();
      setSelectedFilePath(path);
      await executeLoadFileAndClear(projectPath, path);
    },
    [projectPath, executeLoadFileAndClear, exitEdit]
  );

  const refreshTree = useCallback(() => {
    void loadTree();
  }, [loadTree]);

  const beginEdit = useCallback(() => {
    if (!fileContent || fileContent.isBinary || fileContent.isTruncated) return;
    setDraft(fileContent.content);
    setSaveError(null);
    setIsEditing(true);
  }, [fileContent]);

  const saveFile = useCallback(async (): Promise<boolean> => {
    const path = selectedFileRef.current;
    if (!path || !isEditing) return false;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveProjectFile(projectPath, path, draft);
      // Commit the buffer into fileContent so the read view reflects the save
      // and the dirty flag clears, without a round-trip re-read.
      if (fileContent) {
        setFileContent({
          ...fileContent,
          content: draft,
          size: new TextEncoder().encode(draft).length,
        });
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to save file', { path, error: msg });
      setSaveError(msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [projectPath, draft, isEditing, fileContent, setFileContent]);

  return {
    tree,
    expandedPaths,
    selectedFilePath,
    fileContent,
    isLoadingTree,
    isLoadingFile,
    treeError,
    fileError,
    toggleDirectory,
    selectFile: (path: string) => void selectFile(path),
    refreshTree,
    isEditing,
    draft,
    isDirty,
    isSaving,
    saveError,
    beginEdit,
    cancelEdit: exitEdit,
    updateDraft: setDraft,
    saveFile,
  };
}
