/**
 * Main application component and state management.
 *
 * This is the root component that orchestrates:
 * - Application views (loading, setup, projects, workspace)
 * - Project management (opening, creating, dev server lifecycle)
 * - Terminal and preview panel coordination
 * - Periodic screenshot capture for thumbnails
 * - Git branch management and status polling
 *
 * ## State Architecture
 *
 * State has been extracted into custom hooks for better organization:
 * - `useToasts` - Toast notification state
 * - `useTerminalManagement` - Terminal tabs and session state
 * - `useIntegrationStatus` - GitHub/Claude integration state
 * - `useScreenshotManagement` - Screenshot capture, crop, and thumbnail state
 * - `useDevServer` - Dev server lifecycle, output buffering, project type
 * - `useWorkspaceLayout` - Layout tabs, log panels, compact mode, pin state
 * - `usePluginState` - Plugin terminal modal and suggestion popup
 *
 * @module App
 */

import { useState, useEffect, useRef } from 'react';
import { useToasts } from './hooks/useToasts';
import { useTerminalManagement } from './hooks/useTerminalManagement';
import { usePlugins } from './hooks/usePlugins';
import { useIntegrationStatus } from './hooks/useIntegrationStatus';
import { useScreenshotManagement } from './hooks/useScreenshotManagement';
import { useDevServer } from './hooks/useDevServer';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import { usePluginState } from './hooks/usePluginState';
import { useBranchManagement } from './hooks/useBranchManagement';
import { useNotifications } from './hooks/useNotifications';
import { useProjectLifecycle } from './hooks/useProjectLifecycle';
import { useAppSetup } from './hooks/useAppSetup';
import { Terminal } from './components/Terminal';
import { DevServerLogs } from './components/DevServerLogs';
import { Preview } from './components/Preview';
import { ProjectList } from './components/ProjectList';
import { CreateProject } from './components/CreateProject';
import { ImportProject } from './components/ImportProject';
import { ImportTypePicker } from './components/ImportTypePicker';
import { Changelog } from './components/Changelog';
import { OnboardingScreen, OnboardingTerminal } from './components/setup';
import { SplitPane } from './components/SplitPane';
import { PublishBranchDropdown } from './components/PublishBranchDropdown';
import { BranchIndicator } from './components/BranchIndicator';
import { BranchesTab } from './components/BranchesTab';
import { PullRequestsTab } from './components/PullRequestsTab';
import { BugReportButton } from './components/BugReportButton';
import { CompactActionsRow } from './components/CompactMode';
import { MainBranchBanner } from './components/MainBranchBanner';
import { BrowserDropdown } from './components/BrowserDropdown';
import { ConnectOverlay } from './components/ConnectOverlay';
import { CodeHealthPanel } from './components/CodeHealthPanel';
import { WorkspaceModals } from './components/WorkspaceModals';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { PluginSlot } from './components/PluginSlot';
import './styles/notifications.css';
import {
  CameraIcon,
  CropIcon,
  FullPageIcon,
  BranchIcon,
  PullRequestIcon,
  EyeIcon,
  PanelRightIcon,
  PlusIcon,
  TerminalIcon,
  ResetIcon,
  CompactIcon,
  PinIcon,
  ExpandIcon,
  ArrowLeftIcon,
  ActivityIcon,
} from './components/icons';
import { ToolbarDropdown } from './components/ToolbarDropdown';
import { TerminalTabDropdown } from './components/TerminalTabDropdown';
import { Project } from './lib/project';
import { getAgentById } from './lib/agent';
import { markSetupComplete, getDefaultAgentId as fetchDefaultAgentId } from './lib/setup';
import { initDefaultAgent } from './lib/agent';
import { UpdateBanner } from './components/UpdateBanner';
import { logger } from './lib/logger';
import { trackEvent } from './lib/analytics';
import './styles/index.css';

// Initialize logger
logger.init();

// Track app launch
void trackEvent('app_launched', { $screen_name: 'Dashboard' });

/** Current application view/screen */
type AppView = 'loading' | 'onboarding' | 'projects' | 'project-loading' | 'workspace';

/** Props for the App component */
interface AppProps {
  /** Initial project path from URL parameter (for multi-window support) */
  initialProjectPath?: string | null;
}

function App({ initialProjectPath }: AppProps) {
  const [view, setView] = useState<AppView>('loading');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const previewRef = useRef<import('./components/Preview').PreviewHandle | null>(null);
  const currentProjectPathRef = useRef<string | null>(null);

  // Terminal tabs management
  const {
    terminalTabs,
    activeTerminalTab,
    terminalSessionId,
    terminalRefsMap,
    maxTerminalTabs,
    setActiveTerminalTab,
    addTerminalTab,
    closeTerminalTab,
    resetTerminals,
    focusActiveTerminal,
    pasteToActiveTerminal,
    switchTabAgent,
    getActiveTabAgent,
  } = useTerminalManagement();

  // Cleanup dev server when window is closed (prevents orphaned processes)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Stop the dev server synchronously as best we can
      if (devServerRef.current) {
        try {
          devServerRef.current.pty.kill();
        } catch {
          // Ignore errors during cleanup
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- devServerRef is a stable ref declared later in the file
  }, []);

  // Dev server and health check management
  const {
    devServerRef,
    healthPanelRef,
    devServerPort,
    setDevServerPort,
    projectType,
    isRestartingDevServer,
    devServerOutputRef,
    devServerOutputVersion,
    healthOutputRef,
    healthOutputVersion,
    handleHealthOutput,
    handleRestartDevServer: restartDevServer,
    startServerForProject,
    stopServer,
  } = useDevServer();

  // Notification settings, attention tabs, agent status sound alerts
  const {
    notificationSettings,
    showNotificationSettings,
    setShowNotificationSettings,
    attentionTabs,
    setAttentionTabs,
    createTabStatusHandler,
    handleSaveNotificationSettings,
  } = useNotifications({ activeTerminalTab });

  // Integration states consolidated via reducer for atomic updates
  const {
    integrations,
    isInitialCheckDone,
    refreshAllCliStatuses,
    setProjectGitHubStatus,
    clearProjectStatuses,
    authTerminalConfig,
    handleGitHubConnect: handleGitHubConnectFromOverlay,
    handleAuthTerminalExit,
    closeAuthTerminal,
  } = useIntegrationStatus();

  // Screenshot management
  const {
    isCapturing,
    isCropMode,
    setIsCropMode,
    isCropCapturing,
    isFullPageCapturing,
    screenshotPreviewPath,
    setScreenshotPreviewPath,
    showScreenshotModal,
    setShowScreenshotModal,
    handleCaptureScreenshot,
    handleCaptureFullPage,
    handleCropStart,
    handleCropComplete,
    handleCropCancel,
    handlePreviewReady: onPreviewReady,
    startScreenshotInterval,
    clearScreenshotInterval,
  } = useScreenshotManagement({
    previewRef,
    devServerPort,
    pasteToActiveTerminal,
    currentProjectPathRef,
  });

  // Workspace layout
  const {
    showDevServerLogs,
    setShowDevServerLogs,
    showHealthLogs,
    setShowHealthLogs,
    isPreviewHidden,
    setIsPreviewHidden,
    workspaceTab,
    setWorkspaceTab,
    compactView,
    setCompactView,
    isPinned,
    handlePinToggle,
    handleEnterCompactMode: enterCompact,
    handleExpandToFull,
    resetLayout,
  } = useWorkspaceLayout({
    isGitHubConnected: integrations.projectGithub?.status === 'connected',
  });

  // Plugin state
  const {
    pluginTerminal,
    pluginTerminalExited,
    openPluginTerminal,
    closePluginTerminal,
    handlePluginTerminalExit,
    pluginSuggestion,
    setPluginSuggestion,
    pluginSuggestionInstalling,
    checkPluginSuggestion,
    installSuggestedPlugin,
  } = usePluginState();

  // Env editor modal
  const [showEnvEditor, setShowEnvEditor] = useState(false);

  // Backups modal
  const [showBackupsModal, setShowBackupsModal] = useState(false);

  // Assets panel modal
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);

  // Education mode
  const [isEducationMode, setIsEducationMode] = useState(false);

  // Toast notifications
  const { toasts, showToast, dismissToast } = useToasts();

  // Branch management (state, polling, conflict handlers)
  const {
    currentBranch,
    branches,
    openPRs,
    hasUncommittedChanges,
    changedFiles,
    showSubmitReview,
    setShowSubmitReview,
    isBranchSwitching,
    gitError,
    setGitError,
    showConflictResolution,
    setShowConflictResolution,
    fetchBranchInfo,
    checkGitStatus,
    handleBranchSwitch,
    handlePublishError,
    handleResolveConflicts,
    handleConflictsResolved,
    clearBranchState,
  } = useBranchManagement({
    currentProject,
    previewRef,
    healthPanelRef,
    showToast,
  });

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Skills modal state
  const [showSkillsModal, setShowSkillsModal] = useState(false);

  // MCP modal state
  const [showMcpModal, setShowMcpModal] = useState(false);

  // Plugin manager modal state
  const [showPluginManager, setShowPluginManager] = useState(false);

  // Plugin system
  const { getSlotPlugins, reloadPlugins } = usePlugins(currentProject?.path ?? null);

  // Project lifecycle (selection, creation, import, publish, compact mode, etc.)
  const {
    autoAcceptMode,
    showCreateModal,
    setShowCreateModal,
    importView,
    setImportView,
    setCurrentPreviewPage,
    isPublishing,
    setIsPublishing,
    forcePublishOpen,
    setForcePublishOpen,
    isCompactPublishOpen,
    setIsCompactPublishOpen,
    showAutoAcceptWarning,
    setShowAutoAcceptWarning,
    handleSelectProject,
    handleBackToProjects,
    handleProjectCreated,
    handleImportProject,
    handleProjectImported,
    handleImportLocalFolder,
    handleCreateProject,
    handleRestartDevServer,
    handleEnterCompactMode: enterCompactMode,
    handleGitHubStatusChange,
    handlePreviewReady,
    sendToClaude,
    handleTerminalExit,
    handleToolbarAutoAcceptToggle,
    handleAutoAcceptWarningAccept,
  } = useProjectLifecycle({
    currentProject,
    setCurrentProject,
    currentProjectPathRef,
    setView,
    devServerRef,
    devServerPort,
    setDevServerPort,
    startServerForProject,
    stopServer,
    restartDevServer,
    enterCompact,
    resetTerminals,
    pasteToActiveTerminal,
    showToast,
    clearScreenshotInterval,
    startScreenshotInterval,
    onPreviewReady,
    setShowDevServerLogs,
    resetLayout,
    setProjectGitHubStatus,
    clearProjectStatuses,
    fetchBranchInfo,
    clearBranchState,
    checkPluginSuggestion,
  });

  // Wrapper for compact mode that also clears education mode (UI state stays in App)
  const handleEnterCompactMode = async () => {
    setIsEducationMode(false);
    await enterCompactMode();
  };

  // App setup, onboarding, HMR recovery, auto-open, keyboard shortcuts
  const { projectsLoading, setProjectsLoading } = useAppSetup({
    view,
    setView,
    initialProjectPath,
    setCurrentProject,
    setDevServerPort,
    handleSelectProject,
    refreshAllCliStatuses,
    setProjectGitHubStatus,
    fetchBranchInfo,
    setShowHelpModal,
  });

  // Plugin data for PluginSlot components (defined before early returns so all views can use them)
  const pluginProject = currentProject
    ? {
        name: currentProject.name,
        path: currentProject.path,
        currentBranch: currentBranch || 'main',
        hasUncommittedChanges,
        devServerUrl: `http://localhost:${devServerPort}`,
      }
    : null;

  const pluginActions = {
    showToast,
    refreshGitStatus: () => {
      if (currentProject) void fetchBranchInfo(currentProject.path);
    },
    refreshBranches: () => {
      if (currentProject) void fetchBranchInfo(currentProject.path);
    },
    focusTerminal: focusActiveTerminal,
    openUrl: (url: string) => {
      void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(url));
    },
    openTerminal: openPluginTerminal,
  };

  const pluginTheme = {
    bgPrimary: 'var(--bg-primary)',
    bgSecondary: 'var(--bg-secondary)',
    bgTertiary: 'var(--bg-tertiary)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
    border: 'var(--border)',
    accent: 'var(--accent, #10b981)',
    accentHover: 'var(--accent-hover)',
    action: 'var(--action)',
    actionHover: 'var(--action-hover)',
    actionText: 'var(--action-text)',
    error: 'var(--error)',
    success: 'var(--success)',
  };

  if (view === 'loading') {
    return (
      <>
        <div className="app loading">
          <img src="/ship_studio_full_noshadow.svg" alt="Ship Studio" className="app-logo" />
          <div className="spinner" />
        </div>
        <BugReportButton />
      </>
    );
  }

  if (view === 'onboarding') {
    const handleOnboardingComplete = async () => {
      // Re-hydrate default agent cache (may have been set during onboarding)
      const defaultAgent = await fetchDefaultAgentId();
      initDefaultAgent(defaultAgent);
      // Persist that setup is complete so future launches are fast
      await markSetupComplete();
      // Refresh CLI states and go to projects directly (don't re-enter onboarding)
      await refreshAllCliStatuses();
      setView('projects');
    };

    return (
      <>
        <div className="app">
          <UpdateBanner />
          <OnboardingScreen onComplete={() => void handleOnboardingComplete()} />
        </div>
        <BugReportButton />
      </>
    );
  }

  if (view === 'projects') {
    return (
      <>
        <div className="app">
          <UpdateBanner />
          <div className="dashboard-with-changelog">
            <ProjectList
              onSelectProject={(project) => void handleSelectProject(project)}
              onCreateProject={handleCreateProject}
              onImportProject={handleImportProject}
              isGitHubAuthenticated={integrations.github.cliStatus.authenticated}
              onGitHubConnectForImport={() => void handleGitHubConnectFromOverlay()}
              onGitHubConnect={handleGitHubConnectFromOverlay}
              githubUsername={integrations.github.username}
              isAuthCheckDone={isInitialCheckDone}
              onLoadingChange={setProjectsLoading}
            />
            {!projectsLoading && <Changelog />}
            {!projectsLoading && (
              <PluginSlot
                name="sidebar"
                plugins={getSlotPlugins('sidebar')}
                project={pluginProject}
                actions={pluginActions}
                theme={pluginTheme}
              />
            )}
          </div>
          {showCreateModal && (
            <CreateProject
              onComplete={handleProjectCreated}
              onCancel={() => setShowCreateModal(false)}
            />
          )}
          {importView === 'picker' && (
            <ImportTypePicker
              onSelectGitHub={() => setImportView('github')}
              onSelectLocalFolder={() => void handleImportLocalFolder()}
              onClose={() => setImportView('none')}
            />
          )}
          {importView === 'github' && (
            <ImportProject
              onComplete={handleProjectImported}
              onCancel={() => setImportView('none')}
            />
          )}

          {/* Auth Terminal Modal (for GitHub connect from projects view) */}
          {authTerminalConfig && (
            <div className="onboarding-terminal-overlay">
              <div className="onboarding-terminal-modal">
                <div className="onboarding-terminal-header">
                  <span className="onboarding-terminal-title">GitHub Account</span>
                  <button
                    className="onboarding-terminal-cancel"
                    onClick={() => closeAuthTerminal()}
                  >
                    Cancel
                  </button>
                </div>
                <OnboardingTerminal
                  command={authTerminalConfig.command}
                  args={authTerminalConfig.args}
                  onExit={(exitCode) => void handleAuthTerminalExit(exitCode, currentProject?.path)}
                />
              </div>
            </div>
          )}
        </div>
        <BugReportButton />
      </>
    );
  }

  if (view === 'project-loading') {
    return (
      <>
        <div className="app loading">
          <div className="spinner" />
          <p>Opening {currentProject?.name}...</p>
        </div>
        <BugReportButton />
      </>
    );
  }

  // Workspace view (responsive - adapts to narrow widths via CSS)
  return (
    <>
      <div className="app workspace">
        <UpdateBanner />
        <WorkspaceHeader
          projectPath={currentProject?.path || ''}
          projectName={currentProject?.name || ''}
          onBackToProjects={() => void handleBackToProjects()}
          isEducationMode={isEducationMode}
          onToggleEducationMode={() => setIsEducationMode(!isEducationMode)}
          onOpenPluginManager={() => setShowPluginManager(true)}
          onOpenAssetsPanel={() => setShowAssetsPanel(true)}
          onOpenEnvEditor={() => setShowEnvEditor(true)}
          onOpenBackupsModal={() => setShowBackupsModal(true)}
          integrations={integrations}
          onGitHubStatusChange={handleGitHubStatusChange}
          onGitHubConnect={handleGitHubConnectFromOverlay}
          focusActiveTerminal={focusActiveTerminal}
          onToast={showToast}
          currentBranch={currentBranch}
          hasUncommittedChanges={hasUncommittedChanges}
          isPublishing={isPublishing}
          setIsPublishing={setIsPublishing}
          onPublishError={handlePublishError}
          onPublishStatusChange={() => {
            void handleGitHubStatusChange();
            if (currentProject) void fetchBranchInfo(currentProject.path);
          }}
          onCreatePR={() => setShowSubmitReview(currentBranch || 'main')}
          forcePublishOpen={forcePublishOpen}
          onForcePublishOpenHandled={() => setForcePublishOpen(false)}
          getSlotPlugins={getSlotPlugins}
          pluginProject={pluginProject}
          pluginActions={pluginActions}
          pluginTheme={pluginTheme}
        />

        {(currentBranch === 'main' || currentBranch === 'master') && currentProject && (
          <MainBranchBanner
            projectPath={currentProject.path}
            onCreateBranch={() => setWorkspaceTab('branches')}
          />
        )}

        <div className="workspace-content">
          <SplitPane
            defaultSplit={28}
            minLeft={20}
            minRight={35}
            rightCollapsed={isPreviewHidden}
            left={
              <div className="terminal-pane">
                <CodeHealthPanel
                  ref={healthPanelRef}
                  projectPath={currentProject?.path || ''}
                  onToast={showToast}
                  onAskClaude={sendToClaude}
                  onHealthOutput={handleHealthOutput}
                  toolbarLeft={
                    <button
                      className="show-preview-btn"
                      onClick={() => void handleRestartDevServer()}
                      disabled={
                        isRestartingDevServer ||
                        (!devServerRef.current && projectType !== 'statichtml')
                      }
                      title="Restart dev server"
                      data-education-id="restart-server"
                    >
                      {isRestartingDevServer ? (
                        <div className="capture-spinner" />
                      ) : (
                        <ResetIcon size={14} />
                      )}
                      <span>Restart Server</span>
                    </button>
                  }
                  toolbarRight={
                    isPreviewHidden ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="show-preview-btn icon-only"
                          onClick={() => void handleEnterCompactMode()}
                          title="Compact Mode"
                          data-education-id="compact-button"
                        >
                          <CompactIcon size={12} />
                        </button>
                        <span data-education-id="browser-button">
                          <BrowserDropdown
                            url={`http://localhost:${devServerPort}`}
                            buttonClassName="show-preview-btn icon-only"
                            iconOnly
                          />
                        </span>
                        <button
                          className="show-preview-btn icon-only"
                          onClick={() => setIsPreviewHidden(false)}
                          title="Show Preview"
                          data-education-id="show-preview"
                        >
                          <PanelRightIcon size={12} />
                        </button>
                      </div>
                    ) : undefined
                  }
                />
                {/* Terminal view - hidden in compact mode when viewing branches/PRs */}
                <div
                  className={`compact-terminal-view ${compactView !== 'terminal' ? 'compact-hidden' : ''}`}
                >
                  <div className="terminal-tabs-bar">
                    <div className="terminal-tabs" data-education-id="terminal-tabs">
                      {terminalTabs.map((tab, index) => (
                        <button
                          key={tab.id}
                          className={`workspace-tab ${!showDevServerLogs && activeTerminalTab === tab.id ? 'active' : ''} ${attentionTabs.has(tab.id) ? 'attention' : ''}`}
                          onClick={() => {
                            setShowDevServerLogs(false);
                            setShowHealthLogs(false);
                            setActiveTerminalTab(tab.id);
                            setAttentionTabs((prev) => {
                              const next = new Set(prev);
                              next.delete(tab.id);
                              return next;
                            });
                          }}
                        >
                          <span className="terminal-tab-number">{index + 1}</span>
                          <TerminalTabDropdown
                            currentAgent={getAgentById(tab.agentId)}
                            onSwitchAgent={(agentId) => switchTabAgent(tab.id, agentId)}
                            onClose={() => closeTerminalTab(tab.id)}
                          />
                        </button>
                      ))}
                      {terminalTabs.length < maxTerminalTabs && (
                        <button className="terminal-tab-add" onClick={addTerminalTab}>
                          <PlusIcon size={12} />
                        </button>
                      )}
                    </div>
                    <div className="terminal-logs-tabs">
                      <button
                        className={`workspace-tab icon-only ${showDevServerLogs && !showHealthLogs ? 'active' : ''}`}
                        onClick={() => {
                          setShowDevServerLogs(true);
                          setShowHealthLogs(false);
                        }}
                        title="View dev server logs"
                        data-education-id="server-logs"
                      >
                        <TerminalIcon size={12} />
                      </button>
                      <button
                        className={`workspace-tab icon-only ${showHealthLogs ? 'active' : ''}`}
                        onClick={() => {
                          setShowDevServerLogs(true);
                          setShowHealthLogs(true);
                        }}
                        title="View health check logs"
                        data-education-id="health-logs"
                      >
                        <ActivityIcon size={12} />
                      </button>
                      <ToolbarDropdown
                        agent={getActiveTabAgent()}
                        autoAcceptMode={autoAcceptMode}
                        onNotificationSettings={() => setShowNotificationSettings(true)}
                        onSkills={() => setShowSkillsModal(true)}
                        onMcp={() => setShowMcpModal(true)}
                        onAutoAcceptToggle={handleToolbarAutoAcceptToggle}
                        onHelp={() => setShowHelpModal(true)}
                        terminalPlugins={getSlotPlugins('terminal')}
                        pluginProject={pluginProject}
                        pluginActions={pluginActions}
                        pluginTheme={pluginTheme}
                      />
                    </div>

                    {/* Compact mode controls - visible only at narrow widths via CSS */}
                    <div className="compact-mode-controls">
                      <button
                        className={`compact-control-btn ${isPinned ? 'active' : ''}`}
                        onClick={() => void handlePinToggle()}
                        title={isPinned ? 'Unpin from top' : 'Pin to top'}
                      >
                        <PinIcon size={12} />
                      </button>
                      <button
                        className="compact-control-btn"
                        onClick={() => void handleExpandToFull()}
                        title="Expand to full mode"
                      >
                        <ExpandIcon size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="terminal-content" data-education-id="claude-terminal">
                    {terminalTabs.map((tab) => (
                      <div
                        key={`session-${terminalSessionId}-tab-${tab.id}`}
                        className="terminal-tab-content"
                        style={{
                          display:
                            !showDevServerLogs && activeTerminalTab === tab.id ? 'block' : 'none',
                        }}
                      >
                        <Terminal
                          ref={(ref) => {
                            if (ref) {
                              terminalRefsMap.current.set(tab.id, ref);
                            }
                          }}
                          agent={getAgentById(tab.agentId)}
                          projectPath={currentProject?.path || ''}
                          onExit={handleTerminalExit}
                          autoAcceptMode={autoAcceptMode}
                          onStatusChange={createTabStatusHandler(tab.id)}
                        />
                      </div>
                    ))}
                    {showDevServerLogs && !showHealthLogs && (
                      <div className="terminal-tab-content" style={{ display: 'block' }}>
                        <DevServerLogs
                          output={devServerOutputRef.current}
                          outputVersion={devServerOutputVersion}
                        />
                      </div>
                    )}
                    {showHealthLogs && (
                      <div className="terminal-tab-content" style={{ display: 'block' }}>
                        <DevServerLogs
                          output={healthOutputRef.current}
                          outputVersion={healthOutputVersion}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact branches/PRs view - shown in compact mode when viewing branches or PRs */}
                <div
                  className={`compact-branches-view ${compactView === 'terminal' ? 'compact-hidden' : ''}`}
                >
                  {/* Back button header */}
                  <div className="compact-branches-header">
                    <button className="compact-back-btn" onClick={() => setCompactView('terminal')}>
                      <ArrowLeftIcon size={12} />
                      <span>Terminal</span>
                    </button>
                    <span className="compact-branches-title">
                      {compactView === 'branches' ? 'Branches' : 'Pull Requests'}
                    </span>
                    {/* Compact mode controls */}
                    <div className="compact-mode-controls" style={{ marginLeft: 'auto' }}>
                      <button
                        className={`compact-control-btn ${isPinned ? 'active' : ''}`}
                        onClick={() => void handlePinToggle()}
                        title={isPinned ? 'Unpin from top' : 'Pin to top'}
                      >
                        <PinIcon size={12} />
                      </button>
                      <button
                        className="compact-control-btn"
                        onClick={() => void handleExpandToFull()}
                        title="Expand to full mode"
                      >
                        <ExpandIcon size={12} />
                      </button>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="compact-branches-content">
                    {compactView === 'branches' &&
                      currentProject &&
                      integrations.github.cliStatus.authenticated &&
                      integrations.projectGithub?.status === 'connected' && (
                        <BranchesTab
                          branches={branches}
                          currentBranch={currentBranch || ''}
                          projectPath={currentProject.path}
                          githubUsername={integrations.github.username}
                          openPRs={openPRs}
                          onBranchSwitch={(branchName) => {
                            void handleBranchSwitch(branchName);
                            setCompactView('terminal'); // Return to terminal after switching
                          }}
                          onSubmitForReview={(branchName) => setShowSubmitReview(branchName)}
                          onViewPR={() => setCompactView('prs')}
                          onRefresh={() => void fetchBranchInfo(currentProject.path)}
                          onToast={showToast}
                        />
                      )}
                    {compactView === 'prs' &&
                      currentProject &&
                      integrations.github.cliStatus.authenticated &&
                      integrations.projectGithub?.status === 'connected' && (
                        <PullRequestsTab
                          projectPath={currentProject.path}
                          githubUsername={integrations.github.username}
                          onRefresh={() => void fetchBranchInfo(currentProject.path)}
                          onToast={showToast}
                          onBranchSwitch={(branchName) => {
                            void handleBranchSwitch(branchName);
                            setCompactView('terminal'); // Return to terminal after switching
                          }}
                          onNavigateToBranches={() => setCompactView('branches')}
                          onResolveConflicts={(headBranch, baseBranch) =>
                            void handleResolveConflicts(headBranch, baseBranch)
                          }
                        />
                      )}
                  </div>
                </div>
              </div>
            }
            right={
              <div className="preview-pane">
                {/* Preview/Branches/PRs Tabs - always show all tabs */}
                <div className="preview-tabs-bar">
                  {/* Branch Indicator - only show when GitHub is connected and we have branch info */}
                  {integrations.projectGithub?.status === 'connected' && currentBranch && (
                    <BranchIndicator
                      currentBranch={currentBranch}
                      hasUncommittedChanges={hasUncommittedChanges}
                      changedFiles={changedFiles}
                      projectPath={currentProject?.path || ''}
                      isOnBranchesTab={workspaceTab === 'branches' || workspaceTab === 'prs'}
                      onClick={() =>
                        setWorkspaceTab(
                          workspaceTab === 'branches' || workspaceTab === 'prs'
                            ? 'preview'
                            : 'branches'
                        )
                      }
                      onDiscard={() => {
                        if (currentProject) {
                          void checkGitStatus(currentProject.path);
                        }
                      }}
                      onToast={showToast}
                      onSave={() => setForcePublishOpen(true)}
                    />
                  )}
                  <div style={{ flex: 1 }} />
                  {integrations.projectGithub?.status === 'connected' && (
                    <div className="workspace-tabs">
                      <button
                        className={`workspace-tab ${workspaceTab === 'preview' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('preview')}
                      >
                        <EyeIcon size={14} />
                        <span>Preview</span>
                      </button>
                      <button
                        className={`workspace-tab ${workspaceTab === 'branches' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('branches')}
                        data-education-id="branches-tab"
                      >
                        <BranchIcon size={14} />
                        <span>Branches</span>
                      </button>
                      <button
                        className={`workspace-tab ${workspaceTab === 'prs' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('prs')}
                        data-education-id="prs-tab"
                      >
                        <PullRequestIcon size={14} />
                        <span>PRs</span>
                      </button>
                    </div>
                  )}
                  <div className="preview-tabs-divider" />
                  <div className="preview-actions">
                    <button
                      className="preview-action-btn-icon"
                      onClick={() => void handleEnterCompactMode()}
                      title="Compact Mode"
                      data-education-id="compact-button"
                    >
                      <CompactIcon size={12} />
                    </button>
                    <span data-education-id="browser-button">
                      <BrowserDropdown
                        url={`http://localhost:${devServerPort}`}
                        buttonClassName="preview-action-btn-icon"
                        iconOnly
                      />
                    </span>
                    <button
                      className="preview-action-btn-icon"
                      onClick={() => setIsPreviewHidden(true)}
                      title="Hide Preview"
                      data-education-id="hide-preview"
                    >
                      <PanelRightIcon size={12} />
                    </button>
                  </div>
                </div>

                {/* Tab content */}
                {workspaceTab === 'preview' && (
                  <div style={{ flex: 1, display: 'flex' }}>
                    <Preview
                      key={`${currentProject?.path || 'none'}-${devServerPort}`}
                      ref={previewRef}
                      port={devServerPort}
                      projectPath={currentProject?.path || ''}
                      isStaticProject={projectType === 'statichtml'}
                      onServerReady={handlePreviewReady}
                      onPageChange={setCurrentPreviewPage}
                      isCropMode={isCropMode}
                      onCropStart={handleCropStart}
                      onCropComplete={handleCropComplete}
                      onCropCancel={handleCropCancel}
                      isBranchSwitching={isBranchSwitching}
                      isDevServerRestarting={isRestartingDevServer}
                      onSendToClaude={sendToClaude}
                      onToast={showToast}
                      previewPlugins={
                        <PluginSlot
                          name="preview"
                          plugins={getSlotPlugins('preview')}
                          project={pluginProject}
                          actions={pluginActions}
                          theme={pluginTheme}
                        />
                      }
                      toolbarExtra={
                        <div className="agent-toolbar">
                          <button
                            className="agent-capture-btn"
                            onClick={() => void handleCaptureScreenshot()}
                            disabled={isCapturing || isCropMode || isFullPageCapturing}
                            title="Screenshot preview for Claude"
                            data-education-id="screenshot-button"
                          >
                            {isCapturing ? (
                              <div className="capture-spinner" />
                            ) : (
                              <CameraIcon size={14} />
                            )}
                          </button>
                          <button
                            className={`agent-capture-btn ${isCropMode ? 'active' : ''}`}
                            onClick={() => setIsCropMode(!isCropMode)}
                            disabled={isCapturing || isCropCapturing || isFullPageCapturing}
                            title="Crop screenshot for Claude"
                            data-education-id="crop-button"
                          >
                            {isCropCapturing ? (
                              <div className="capture-spinner" />
                            ) : (
                              <CropIcon size={14} />
                            )}
                          </button>
                          <button
                            className="agent-capture-btn"
                            onClick={() => void handleCaptureFullPage()}
                            disabled={
                              isCapturing || isCropCapturing || isFullPageCapturing || isCropMode
                            }
                            title="Full page screenshot for Claude"
                            data-education-id="fullpage-button"
                          >
                            {isFullPageCapturing ? (
                              <div className="capture-spinner" />
                            ) : (
                              <FullPageIcon size={14} />
                            )}
                          </button>
                        </div>
                      }
                    />
                  </div>
                )}
                {workspaceTab === 'branches' &&
                  currentProject &&
                  (integrations.github.cliStatus.authenticated &&
                  integrations.projectGithub?.status === 'connected' ? (
                    <BranchesTab
                      branches={branches}
                      currentBranch={currentBranch || ''}
                      projectPath={currentProject.path}
                      githubUsername={integrations.github.username}
                      openPRs={openPRs}
                      onBranchSwitch={(branchName) => void handleBranchSwitch(branchName)}
                      onSubmitForReview={(branchName) => setShowSubmitReview(branchName)}
                      onViewPR={() => setWorkspaceTab('prs')}
                      onRefresh={() => void fetchBranchInfo(currentProject.path)}
                      onToast={showToast}
                    />
                  ) : (
                    <div style={{ position: 'relative', flex: 1 }}>
                      <ConnectOverlay
                        title="Connect GitHub to manage branches"
                        description="Create branches, switch between versions, and collaborate with your team."
                        onConnect={() => void handleGitHubConnectFromOverlay()}
                      />
                    </div>
                  ))}
                {workspaceTab === 'prs' &&
                  currentProject &&
                  (integrations.github.cliStatus.authenticated &&
                  integrations.projectGithub?.status === 'connected' ? (
                    <PullRequestsTab
                      projectPath={currentProject.path}
                      githubUsername={integrations.github.username}
                      onRefresh={() => void fetchBranchInfo(currentProject.path)}
                      onToast={showToast}
                      onBranchSwitch={(branchName) => void handleBranchSwitch(branchName)}
                      onNavigateToBranches={() => setWorkspaceTab('branches')}
                      onResolveConflicts={(headBranch, baseBranch) =>
                        void handleResolveConflicts(headBranch, baseBranch)
                      }
                    />
                  ) : (
                    <div style={{ position: 'relative', flex: 1 }}>
                      <ConnectOverlay
                        title="Connect GitHub to view pull requests"
                        description="Submit code for review, merge changes, and track your team's work."
                        onConnect={() => void handleGitHubConnectFromOverlay()}
                      />
                    </div>
                  ))}
              </div>
            }
          />
        </div>

        {/* Compact footer - visible only at narrow window widths via CSS */}
        <div className="compact-footer-container">
          {/* Compact publish dropdown - uses controlled mode (forceOpen synced with state)
              The button is hidden via CSS; only the dropdown menu appears */}
          <div className="compact-publish-dropdown">
            <PublishBranchDropdown
              currentBranch={currentBranch || 'main'}
              projectGithubStatus={integrations.projectGithub}
              projectPath={currentProject?.path || ''}
              hasChangesToSync={hasUncommittedChanges}
              onStatusChange={() => {
                void handleGitHubStatusChange();
                if (currentProject) void fetchBranchInfo(currentProject.path);
              }}
              onModalClose={() => {
                setIsCompactPublishOpen(false);
                focusActiveTerminal();
              }}
              onToast={showToast}
              isPublishing={isPublishing}
              setIsPublishing={setIsPublishing}
              onPublishError={handlePublishError}
              onCreatePR={() => setShowSubmitReview(currentBranch || 'main')}
              forceOpen={isCompactPublishOpen}
              onForceOpenHandled={() => {}}
              excludeClickOutsideSelector=".compact-publish-btn"
            />
          </div>
          <CompactActionsRow
            serverHealth={
              projectType === 'statichtml' || devServerRef.current
                ? 'healthy'
                : isRestartingDevServer
                  ? 'starting'
                  : 'unhealthy'
            }
            currentBranch={currentBranch}
            hasUncommittedChanges={hasUncommittedChanges}
            prStatus={openPRs.find((pr) => pr.headRef === currentBranch) ? 'open' : 'none'}
            isGitHubConnected={integrations.projectGithub?.status === 'connected'}
            isSynced={!hasUncommittedChanges}
            onRestartServer={() => void handleRestartDevServer()}
            onOpenAssets={() => setShowAssetsPanel(true)}
            onOpenEnvEditor={() => setShowEnvEditor(true)}
            onCreateRepo={() => {
              // Button only shows when GitHub not connected, so prompt GitHub connection
              void handleGitHubConnectFromOverlay();
            }}
            onSwitchBranch={() => {
              // Toggle between terminal and branches view in compact mode
              setCompactView(compactView === 'branches' ? 'terminal' : 'branches');
            }}
            onCreatePR={() => {
              // Toggle between terminal and PRs view in compact mode
              setCompactView(compactView === 'prs' ? 'terminal' : 'prs');
            }}
            onPublish={() => setIsCompactPublishOpen((prev) => !prev)}
          />
        </div>

        <WorkspaceModals
          projectPath={currentProject?.path || ''}
          currentProjectPath={currentProject?.path}
          showEnvEditor={showEnvEditor}
          onCloseEnvEditor={() => {
            setShowEnvEditor(false);
            focusActiveTerminal();
          }}
          onToast={showToast}
          showBackupsModal={showBackupsModal}
          onCloseBackupsModal={() => {
            setShowBackupsModal(false);
            focusActiveTerminal();
          }}
          onBackupRestore={() => {
            if (currentProject) void fetchBranchInfo(currentProject.path);
            void handleGitHubStatusChange();
          }}
          onBackupCreatePR={(branchName) => setShowSubmitReview(branchName)}
          showAssetsPanel={showAssetsPanel}
          onCloseAssetsPanel={() => {
            setShowAssetsPanel(false);
            focusActiveTerminal();
          }}
          isEducationMode={isEducationMode}
          onCloseEducation={() => setIsEducationMode(false)}
          toasts={toasts}
          dismissToast={dismissToast}
          screenshotPreviewPath={screenshotPreviewPath}
          showScreenshotModal={showScreenshotModal}
          onDismissScreenshotPreview={() => setScreenshotPreviewPath(null)}
          onViewScreenshotFull={() => setShowScreenshotModal(true)}
          onCloseScreenshotModal={() => {
            setShowScreenshotModal(false);
            setScreenshotPreviewPath(null);
          }}
          showNotificationSettings={showNotificationSettings}
          notificationSettings={notificationSettings}
          onSaveNotificationSettings={handleSaveNotificationSettings}
          onCloseNotificationSettings={() => setShowNotificationSettings(false)}
          agentDisplayName={getActiveTabAgent().displayName}
          showHelpModal={showHelpModal}
          onCloseHelpModal={() => setShowHelpModal(false)}
          showSkillsModal={showSkillsModal}
          onCloseSkillsModal={() => setShowSkillsModal(false)}
          agentId={getActiveTabAgent().id}
          activeAgent={getActiveTabAgent()}
          showMcpModal={showMcpModal}
          onCloseMcpModal={() => setShowMcpModal(false)}
          showPluginManager={showPluginManager}
          onClosePluginManager={() => setShowPluginManager(false)}
          onPluginsChanged={() => void reloadPlugins()}
          pluginSuggestion={pluginSuggestion}
          pluginSuggestionInstalling={pluginSuggestionInstalling}
          onDismissPluginSuggestion={() => setPluginSuggestion(null)}
          onInstallSuggestedPlugin={() => {
            void installSuggestedPlugin(
              (msg) => showToast(msg, 'success'),
              (msg) => showToast(msg, 'error'),
              reloadPlugins
            );
          }}
          showAutoAcceptWarning={showAutoAcceptWarning}
          onCloseAutoAcceptWarning={() => setShowAutoAcceptWarning(false)}
          onAcceptAutoAcceptWarning={handleAutoAcceptWarningAccept}
          showSubmitReview={showSubmitReview}
          branches={branches}
          integrations={integrations}
          onSubmitReviewSuccess={() => {
            showToast('Pull request created', 'success');
            if (currentProject) void fetchBranchInfo(currentProject.path);
          }}
          onCloseSubmitReview={() => {
            setShowSubmitReview(null);
            focusActiveTerminal();
          }}
          gitError={gitError}
          onCloseGitError={() => setGitError(null)}
          onSendToClaude={sendToClaude}
          onResolveConflicts={() => void handleResolveConflicts()}
          showConflictResolution={showConflictResolution}
          hasCurrentProject={!!currentProject}
          onCloseConflictResolution={() => {
            setShowConflictResolution(false);
            focusActiveTerminal();
          }}
          onConflictsResolved={handleConflictsResolved}
          authTerminalConfig={authTerminalConfig}
          onCloseAuthTerminal={() => closeAuthTerminal()}
          onAuthTerminalExit={(exitCode) =>
            void handleAuthTerminalExit(exitCode, currentProject?.path)
          }
          pluginTerminal={pluginTerminal}
          pluginTerminalExited={pluginTerminalExited}
          onClosePluginTerminal={closePluginTerminal}
          onPluginTerminalExit={handlePluginTerminalExit}
        />
      </div>

      <BugReportButton />
    </>
  );
}

export default App;
