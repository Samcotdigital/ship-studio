/**
 * Hook for notification settings, attention tab tracking, and agent status sound alerts.
 *
 * Manages: notification sound settings, per-tab attention state,
 * agent status change detection (thinking -> waiting transitions),
 * and sound playback on completion.
 *
 * @module hooks/useNotifications
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  NotificationSettings,
  loadNotificationSettings,
  saveNotificationSettings,
  playSound,
} from '../lib/sounds';
import type { AgentStatus } from '../components/Terminal';

export interface UseNotificationsParams {
  activeTerminalTab: number;
}

export function useNotifications({ activeTerminalTab }: UseNotificationsParams) {
  // Notification settings state
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(loadNotificationSettings);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  // Track previous agent status per tab to detect transitions
  const prevAgentStatusMap = useRef<Map<number, AgentStatus>>(new Map());

  // Tabs waiting for user attention (finished processing while not active)
  const [attentionTabs, setAttentionTabs] = useState<Set<number>>(new Set());

  // Use ref for notification settings to avoid re-creating callback
  const notificationSettingsRef = useRef(notificationSettings);
  useEffect(() => {
    notificationSettingsRef.current = notificationSettings;
  }, [notificationSettings]);

  // Ref for activeTerminalTab so the callback doesn't need to be recreated
  const activeTerminalTabRef = useRef(activeTerminalTab);
  useEffect(() => {
    activeTerminalTabRef.current = activeTerminalTab;
  }, [activeTerminalTab]);

  // Handle agent status changes per tab - play sounds and mark attention
  const createTabStatusHandler = useCallback(
    (tabId: number) => (status: AgentStatus, _title: string) => {
      const settings = notificationSettingsRef.current;
      const prevStatus = prevAgentStatusMap.current.get(tabId) ?? 'idle';
      const wasThinking = prevStatus === 'thinking';

      // When agent transitions from thinking to waiting (finished processing)
      if (wasThinking && status === 'waiting') {
        if (settings.enabled) {
          void playSound(settings.sound);
        }
        // Mark tab as needing attention if it's not the active tab
        if (activeTerminalTabRef.current !== tabId) {
          setAttentionTabs((prev) => new Set(prev).add(tabId));
        }
      }

      prevAgentStatusMap.current.set(tabId, status);
    },
    []
  );

  // Save notification settings when they change
  const handleSaveNotificationSettings = useCallback((settings: NotificationSettings) => {
    setNotificationSettings(settings);
    saveNotificationSettings(settings);
  }, []);

  return {
    // State
    notificationSettings,
    showNotificationSettings,
    setShowNotificationSettings,
    attentionTabs,
    setAttentionTabs,

    // Handlers
    createTabStatusHandler,
    handleSaveNotificationSettings,
  };
}
