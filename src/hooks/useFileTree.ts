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
  buildFileTree,
  type FileTreeNode,
  type FileContent,
} from '../lib/code';
import { logger } from '../lib/logger';

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
}

export function useFileTree(projectPath: string): UseFileTreeResult {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const selectedFileRef = useRef(selectedFilePath);
  selectedFileRef.current = selectedFilePath;

  // Reset state when project changes
  useEffect(() => {
    setSelectedFilePath(null);
    setFileContent(null);
    setFileError(null);
    setExpandedPaths(new Set());
  }, [projectPath]);

  const loadTree = useCallback(async () => {
    setIsLoadingTree(true);
    setTreeError(null);
    try {
      const entries = await listProjectFiles(projectPath);
      const built = buildFileTree(entries);
      setTree(built);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTreeError(msg);
      logger.error('Failed to load file tree', { error: msg });
    } finally {
      setIsLoadingTree(false);
    }
  }, [projectPath]);

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

      setSelectedFilePath(path);
      setFileError(null);
      setIsLoadingFile(true);

      try {
        const content = await readProjectFile(projectPath, path);
        setFileContent(content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setFileContent(null);
        setFileError(msg);
        logger.error('Failed to read file', { path, error: msg });
      } finally {
        setIsLoadingFile(false);
      }
    },
    [projectPath]
  );

  const refreshTree = useCallback(() => {
    void loadTree();
  }, [loadTree]);

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
  };
}
