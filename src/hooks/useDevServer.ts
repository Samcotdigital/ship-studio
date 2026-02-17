/**
 * Hook for dev server lifecycle management.
 *
 * Manages dev server start/stop/restart, output buffering,
 * health check output, and project type detection.
 */

import { useState, useRef, useCallback } from 'react';
import { startDevServer, DevServerHandle } from '../lib/project';
import {
  detectProjectType,
  startStaticServer,
  stopStaticServer,
  ProjectType,
} from '../lib/static-server';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../lib/logger';
import { trackEvent } from '../lib/analytics';
import { getWindowLabel } from '../lib/window';
import type { CodeHealthPanelRef } from '../components/CodeHealthPanel';

export function useDevServer() {
  const devServerRef = useRef<DevServerHandle | null>(null);
  const [devServerPort, setDevServerPort] = useState(3000);
  const [projectType, setProjectType] = useState<ProjectType>('unknown');
  const [isRestartingDevServer, setIsRestartingDevServer] = useState(false);

  // Dev server output buffering
  const devServerOutputRef = useRef<string>('');
  const [devServerOutputVersion, setDevServerOutputVersion] = useState(0);

  // Health check output buffering
  const healthOutputRef = useRef<string>('');
  const [healthOutputVersion, setHealthOutputVersion] = useState(0);
  const healthPanelRef = useRef<CodeHealthPanelRef>(null);

  // Handle health check output
  const handleHealthOutput = useCallback((output: string) => {
    healthOutputRef.current += output;
    if (healthOutputRef.current.length > 100000) {
      healthOutputRef.current = healthOutputRef.current.slice(-100000);
    }
    setHealthOutputVersion((v) => v + 1);
  }, []);

  // Create the output callback for dev server
  const createOutputHandler = useCallback(() => {
    return (data: string) => {
      devServerOutputRef.current += data;
      if (devServerOutputRef.current.length > 100000) {
        devServerOutputRef.current = devServerOutputRef.current.slice(-100000);
      }
      setDevServerOutputVersion((v) => v + 1);
    };
  }, []);

  // Clear output buffers
  const clearOutputBuffers = useCallback(() => {
    devServerOutputRef.current = '';
    setDevServerOutputVersion(0);
    healthOutputRef.current = '';
    setHealthOutputVersion(0);
  }, []);

  // Detect project type and start appropriate server
  const startServerForProject = useCallback(
    async (projectPath: string, projectName: string, port: number, windowLabel: string) => {
      let detectedType: ProjectType = 'unknown';
      try {
        detectedType = await detectProjectType(projectPath);
      } catch {
        logger.warn('[OpenProject] Failed to detect project type, defaulting to unknown');
      }
      setProjectType(detectedType);
      void trackEvent('project_type_detected', {
        project_type: detectedType,
        project_name: projectName,
        $screen_name: 'Workspace',
      });
      logger.info(`[OpenProject] Detected project type: ${detectedType}`);

      if (detectedType === 'statichtml') {
        try {
          const staticPort = await startStaticServer(windowLabel, projectPath);
          setDevServerPort(staticPort);
          void trackEvent('dev_server_started', {
            project_type: 'statichtml',
            port: staticPort,
            project_name: projectName,
            $screen_name: 'Workspace',
          });
          logger.info(`[OpenProject] Static server started on port ${staticPort}`);
        } catch (error) {
          logger.error('Failed to start static server', { error });
        }
      } else {
        try {
          clearOutputBuffers();
          void trackEvent('dev_server_started', {
            project_type: detectedType,
            port,
            project_name: projectName,
            $screen_name: 'Workspace',
          });
          devServerRef.current = await startDevServer(
            projectPath,
            port,
            windowLabel,
            createOutputHandler()
          );
        } catch (error) {
          logger.error('Failed to start dev server', { error });
        }
      }

      return detectedType;
    },
    [clearOutputBuffers, createOutputHandler]
  );

  // Stop dev server or static server
  const stopServer = useCallback(async () => {
    if (devServerRef.current) {
      await devServerRef.current.stop();
      devServerRef.current = null;
    }
    const windowLabel = getWindowLabel();
    try {
      await stopStaticServer(windowLabel);
    } catch {
      // Ignore - may not have been started
    }
    setProjectType('unknown');
  }, []);

  // Restart dev server
  const handleRestartDevServer = useCallback(
    async (projectPath: string) => {
      setIsRestartingDevServer(true);

      const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
        ]);
      };
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      try {
        if (projectType === 'statichtml') {
          const windowLabel = getWindowLabel();
          try {
            await stopStaticServer(windowLabel);
          } catch {
            // Ignore
          }
          await delay(300);
          const newPort = await startStaticServer(windowLabel, projectPath);
          setDevServerPort(newPort);
        } else {
          if (devServerRef.current) {
            try {
              await withTimeout(devServerRef.current.stop(), 5000, undefined);
            } catch (e) {
              logger.warn('Error stopping dev server, continuing with restart', { error: e });
            }
            devServerRef.current = null;
          }

          clearOutputBuffers();
          await delay(500);

          try {
            await withTimeout(invoke('kill_port', { port: devServerPort }), 5000, undefined);
          } catch {
            // Ignore if nothing to kill
          }
          await delay(300);

          try {
            await withTimeout(invoke('clear_project_cache', { projectPath }), 10000, undefined);
          } catch {
            // Non-critical
          }

          devServerRef.current = await withTimeout(
            startDevServer(projectPath, devServerPort, getWindowLabel(), createOutputHandler()),
            10000,
            null as unknown as DevServerHandle
          );

          if (!devServerRef.current) {
            logger.error('Failed to start dev server: spawn timed out');
          }
        }
      } catch (error) {
        logger.error('Failed to restart dev server', { error });
      } finally {
        setIsRestartingDevServer(false);
      }
    },
    [projectType, devServerPort, clearOutputBuffers, createOutputHandler]
  );

  return {
    // Refs
    devServerRef,
    healthPanelRef,

    // State
    devServerPort,
    setDevServerPort,
    projectType,
    setProjectType,
    isRestartingDevServer,
    devServerOutputRef,
    devServerOutputVersion,
    healthOutputRef,
    healthOutputVersion,

    // Handlers
    handleHealthOutput,
    handleRestartDevServer,
    startServerForProject,
    stopServer,
    clearOutputBuffers,
  };
}
