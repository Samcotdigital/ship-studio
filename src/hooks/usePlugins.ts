/**
 * Hook for managing plugin lifecycle.
 *
 * Loads enabled plugins for the current project, tracks loaded modules,
 * and provides helpers for querying which plugins register for specific UI slots.
 *
 * @module hooks/usePlugins
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listPlugins, PluginInfo } from '../lib/plugins';
import { loadPluginModule, unloadPluginModule, PluginModule } from '../lib/plugin-loader';

/** A fully loaded plugin: manifest + JS module */
export interface LoadedPlugin {
  info: PluginInfo;
  module: PluginModule;
}

/** Return type for usePlugins hook */
export interface UsePluginsReturn {
  /** All loaded plugins */
  plugins: LoadedPlugin[];
  /** Get plugins registered for a specific UI slot */
  getSlotPlugins: (slotName: string) => LoadedPlugin[];
  /** Reload all plugins (call after install/uninstall) */
  reloadPlugins: () => Promise<void>;
  /** Whether plugins are currently loading */
  isLoading: boolean;
}

export function usePlugins(projectPath: string | null): UsePluginsReturn {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);
  const currentPathRef = useRef(projectPath);

  const loadAllPlugins = useCallback(async (path: string | null) => {
    if (!path) {
      setPlugins([]);
      return;
    }

    setIsLoading(true);
    try {
      const installed = await listPlugins(path);
      const enabled = installed.filter((p) => p.enabled);

      const loaded: LoadedPlugin[] = [];
      for (const info of enabled) {
        try {
          const module = await loadPluginModule(path, info.manifest.id);
          loaded.push({ info, module });
        } catch (e) {
          console.error(`Failed to load plugin ${info.manifest.id}:`, e);
        }
      }

      if (mountedRef.current && currentPathRef.current === path) {
        setPlugins(loaded);
      }
    } catch (e) {
      console.error('Failed to list plugins:', e);
      if (mountedRef.current && currentPathRef.current === path) {
        setPlugins([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Reload when project changes
  useEffect(() => {
    mountedRef.current = true;
    currentPathRef.current = projectPath;

    // Unload previous plugins
    plugins.forEach((p) => unloadPluginModule(currentPathRef.current || '', p.info.manifest.id));

    void loadAllPlugins(projectPath);

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  const reloadPlugins = useCallback(async () => {
    // Unload current plugins
    plugins.forEach((p) => unloadPluginModule(projectPath || '', p.info.manifest.id));
    await loadAllPlugins(projectPath);
  }, [plugins, loadAllPlugins, projectPath]);

  const getSlotPlugins = useCallback(
    (slotName: string): LoadedPlugin[] => {
      return plugins.filter(
        (p) => p.info.manifest.slots.includes(slotName) && p.module.slots[slotName]
      );
    },
    [plugins]
  );

  return { plugins, getSlotPlugins, reloadPlugins, isLoading };
}
