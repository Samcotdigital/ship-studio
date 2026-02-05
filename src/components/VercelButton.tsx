/**
 * VercelButton component for Vercel deployment management.
 *
 * Provides a dropdown button that allows users to:
 * - Install Vercel CLI if not present
 * - Log in to Vercel via OAuth flow
 * - Deploy projects to Vercel
 * - View deployment status and open live site
 *
 * Uses the Vercel CLI for deployments and a PTY for the login flow.
 *
 * @module components/VercelButton
 */

import { useState, useRef } from 'react';
import { VercelState } from '../hooks/useIntegrationStatus';
import {
  ProjectVercelStatus,
  installVercelCli,
  deployToVercel,
  checkVercelCliStatus,
  getVercelTeams,
  listVercelProjects,
  writeVercelProjectJson,
  VercelTeam,
  VercelProject,
} from '../lib/vercel';
import { ProjectGitHubStatus } from '../lib/github';
import { openUrl } from '@tauri-apps/plugin-opener';
import { OnboardingTerminal } from './setup';
import { ExternalLinkIcon } from './icons';

/** Props for the VercelButton component */
interface VercelButtonProps {
  /** Global Vercel CLI authentication state */
  vercelState: VercelState;
  /** Current project's Vercel status (linked, deployment URLs) */
  projectVercelStatus: ProjectVercelStatus | null;
  /** Current project's GitHub status (needed for git integration) */
  projectGithubStatus: ProjectGitHubStatus | null;
  /** Absolute path to the project directory */
  projectPath: string;
  /** Project name (used as default Vercel project name) */
  projectName: string;
  /** Callback to refresh project status after deployment */
  onStatusChange: (deployedUrl?: string) => void;
  /** Callback to initiate Vercel CLI authentication */
  onVercelConnect: () => void;
  /** Optional callback when modal is closed */
  onModalClose?: () => void;
  /** Optional callback to show toast notifications */
  onToast?: (message: string, type?: 'success' | 'error') => void;
  /** Whether Vercel is being auto-connected after GitHub repo creation */
  isAutoConnecting?: boolean;
  /** Current git branch name (for generating preview URLs) */
  currentBranch?: string;
}

export function VercelButton({
  vercelState,
  projectVercelStatus,
  projectGithubStatus,
  projectPath,
  projectName,
  onStatusChange,
  onVercelConnect,
  onModalClose,
  onToast,
  isAutoConnecting,
  currentBranch,
}: VercelButtonProps) {
  const [isInstalling, setIsInstalling] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployName, setDeployName] = useState(projectName);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<VercelTeam[]>([]);
  const [selectedScope, setSelectedScope] = useState<string | undefined>(undefined);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [existingProjects, setExistingProjects] = useState<VercelProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [optimisticLinked, setOptimisticLinked] = useState(false);
  const isLoggingInRef = useRef(false);
  // Stable reference for terminal args to prevent effect re-runs
  const vercelLoginArgs = useRef(['login']).current;

  const { cliStatus } = vercelState;

  // Don't show Vercel options until GitHub repo is created
  if (projectGithubStatus?.status !== 'connected' || !projectGithubStatus?.github_repo) {
    return null;
  }

  const handleInstallCli = async () => {
    setIsInstalling(true);
    setError(null);
    try {
      await installVercelCli();
      onVercelConnect();
      onToast?.('Vercel CLI installed!', 'success');
    } catch (e) {
      setError(String(e));
      onToast?.('Failed to install Vercel CLI', 'error');
    } finally {
      setIsInstalling(false);
    }
  };

  const handleStartLogin = () => {
    if (isLoggingInRef.current) return;
    isLoggingInRef.current = true;
    setShowLoginModal(true);
    setError(null);
  };

  const handleLoginExit = async (exitCode: number | null) => {
    isLoggingInRef.current = false;
    setShowLoginModal(false);

    if (exitCode === 0 || exitCode === null) {
      // Check if auth succeeded
      const status = await checkVercelCliStatus();
      if (status.authenticated) {
        onVercelConnect();
        onToast?.('Connected to Vercel!', 'success');
      }
    }
    onModalClose?.();
  };

  const handleCloseLoginModal = () => {
    // OnboardingTerminal will handle killing the PTY when unmounted
    isLoggingInRef.current = false;
    setShowLoginModal(false);
    onVercelConnect();
    onModalClose?.();
  };

  const handleDeploy = async () => {
    if (!deployName.trim()) return;

    setIsDeploying(true);
    setError(null);
    try {
      const deployedUrl = await deployToVercel({
        projectPath,
        projectName: deployName,
        githubRepo: projectGithubStatus?.github_repo || undefined,
        scope: selectedScope,
      });
      setShowDeployModal(false);
      onStatusChange(deployedUrl);
      onToast?.('Connected to Vercel!', 'success');
    } catch (e) {
      // Keep modal open and show error
      setError(String(e));
    } finally {
      setIsDeploying(false);
    }
  };

  // If Vercel CLI not installed
  if (!cliStatus.installed) {
    return (
      <>
        <button
          className="vercel-button vercel-install"
          onClick={() => void handleInstallCli()}
          disabled={isInstalling}
          title="Install Vercel CLI via npm"
        >
          <VercelIcon />
          {isInstalling ? 'Installing...' : 'Install Vercel'}
        </button>
        {error && <span className="vercel-error">{error}</span>}
      </>
    );
  }

  // If not authenticated
  if (!cliStatus.authenticated) {
    return (
      <>
        <button
          className="vercel-button vercel-connect"
          onClick={handleStartLogin}
          disabled={showLoginModal}
          title="Connect your Vercel account"
        >
          <VercelIcon />
          {showLoginModal ? 'Connecting...' : 'Connect Vercel'}
        </button>

        {showLoginModal && (
          <div className="onboarding-terminal-overlay">
            <div className="onboarding-terminal-modal">
              <div className="onboarding-terminal-header">
                <span className="onboarding-terminal-title">Vercel Account</span>
                <button className="onboarding-terminal-cancel" onClick={handleCloseLoginModal}>
                  Cancel
                </button>
              </div>
              <OnboardingTerminal
                command="vercel"
                args={vercelLoginArgs}
                onExit={(exitCode) => void handleLoginExit(exitCode)}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // If deploying
  if (isDeploying) {
    return (
      <button className="vercel-button vercel-deploying" disabled title="Deploying to Vercel...">
        <VercelIcon />
        <span className="deploying-text">Deploying...</span>
      </button>
    );
  }

  // If auto-connecting after GitHub repo creation
  if (isAutoConnecting) {
    return (
      <button className="vercel-button vercel-deploying" disabled title="Connecting to Vercel...">
        <VercelIcon />
        <span className="deploying-text">Connecting...</span>
      </button>
    );
  }

  // If project is fully connected to Vercel (linked + git connected), show icon to open dashboard
  if (projectVercelStatus?.status === 'connected') {
    const dashboardUrl =
      projectVercelStatus.vercel_org && projectVercelStatus.project_name
        ? `https://vercel.com/${projectVercelStatus.vercel_org}/${projectVercelStatus.project_name}`
        : 'https://vercel.com/dashboard';
    const productionUrl = projectVercelStatus.production_url;
    const branch = currentBranch || 'main';
    const isMainBranch = branch === 'main' || branch === 'master';

    // Generate preview URL for feature branches (Vercel's git branch URL pattern)
    const previewUrl =
      !isMainBranch && projectVercelStatus.project_name
        ? `${projectVercelStatus.project_name}-git-${branch.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.vercel.app`
        : null;

    const hasUrls = productionUrl || previewUrl;

    return (
      <div
        className="vercel-button-container"
        onMouseEnter={() => hasUrls && setShowSiteDropdown(true)}
        onMouseLeave={() => setShowSiteDropdown(false)}
      >
        <button
          className="vercel-button vercel-linked"
          onClick={() => void openUrl(dashboardUrl)}
          title="Open Vercel dashboard"
        >
          <VercelIcon />
        </button>

        {showSiteDropdown && hasUrls && (
          <div className="vercel-site-dropdown">
            <div className="vercel-site-dropdown-inner">
              {productionUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void openUrl(`https://${productionUrl}`);
                  }}
                >
                  <span className="vercel-site-badge vercel-site-badge-prod">Prod</span>
                  <span className="vercel-site-url">{productionUrl}</span>
                  <ExternalLinkIcon size={12} />
                </button>
              )}
              {previewUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void openUrl(`https://${previewUrl}`);
                  }}
                >
                  <span className="vercel-site-badge vercel-site-badge-preview">Preview</span>
                  <span className="vercel-site-url">{previewUrl}</span>
                  <ExternalLinkIcon size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Still checking Vercel status - show loading state
  if (projectVercelStatus === null) {
    return (
      <button className="vercel-button vercel-checking" disabled title="Checking Vercel status...">
        <VercelIcon />
        <span className="checking-text">Connecting...</span>
      </button>
    );
  }

  // Optimistic: show connected state immediately after linking while backend refreshes
  if (optimisticLinked) {
    return (
      <button className="vercel-button vercel-linked" disabled title="Connected to Vercel">
        <VercelIcon />
      </button>
    );
  }

  const loadExistingProjects = async (scope: string | undefined) => {
    setIsLoadingProjects(true);
    setSelectedProjectId('');
    try {
      const projects = await listVercelProjects(scope || '');
      setExistingProjects(projects);
    } catch {
      setExistingProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleLinkExisting = async () => {
    const project = existingProjects.find((p) => p.id === selectedProjectId);
    if (!project) return;

    setIsLinking(true);
    setError(null);
    try {
      await writeVercelProjectJson(projectPath, project.id, project.orgId, project.name);
      setShowDeployModal(false);
      setOptimisticLinked(true);
      onStatusChange();
      onToast?.('Linked to Vercel project!', 'success');
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLinking(false);
    }
  };

  const handleOpenDeployModal = async () => {
    setDeployName(projectName);
    setShowDeployModal(true);
    setError(null);
    setLinkMode('new');
    setExistingProjects([]);
    setSelectedProjectId('');
    setIsLoadingTeams(true);

    try {
      const fetchedTeams = await getVercelTeams();
      setTeams(fetchedTeams);
      // Pre-select the current team if one is marked
      const currentTeam = fetchedTeams.find((t) => t.is_current);
      if (currentTeam) {
        setSelectedScope(currentTeam.id);
      } else {
        setSelectedScope(undefined);
      }
    } catch (err) {
      // If fetching teams fails, just proceed without team selection
      console.warn('Failed to fetch Vercel teams:', err);
      setTeams([]);
      setSelectedScope(undefined);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  // Not linked yet - show Connect button to set up Vercel project
  return (
    <>
      <button
        className="vercel-button vercel-setup"
        onClick={() => void handleOpenDeployModal()}
        title="Connect to Vercel for auto-deployments"
      >
        <VercelIcon />
        Connect Vercel
      </button>

      {showDeployModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!isDeploying) {
              setShowDeployModal(false);
              onModalClose?.();
            }
          }}
        >
          <div className="modal vercel-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Connect to Vercel</h3>
            <p>Link this project to Vercel for automatic deployments when you publish.</p>

            <div className="vercel-link-mode-toggle">
              <button
                className={linkMode === 'new' ? 'active' : ''}
                onClick={() => setLinkMode('new')}
              >
                Create new project
              </button>
              <button
                className={linkMode === 'existing' ? 'active' : ''}
                onClick={() => {
                  setLinkMode('existing');
                  if (existingProjects.length === 0) {
                    void loadExistingProjects(selectedScope);
                  }
                }}
              >
                Link existing project
              </button>
            </div>

            <div className="vercel-form">
              {isLoadingTeams ? (
                <div className="vercel-form-loading">
                  <div className="vercel-form-spinner" />
                  <span>Loading teams...</span>
                </div>
              ) : (
                teams.length > 0 && (
                  <label>
                    Team
                    <select
                      className="owner-select"
                      value={selectedScope || ''}
                      onChange={(e) => {
                        const newScope = e.target.value || undefined;
                        setSelectedScope(newScope);
                        if (linkMode === 'existing') {
                          void loadExistingProjects(newScope);
                        }
                      }}
                    >
                      <option value="">Personal Account</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              )}

              {linkMode === 'new' ? (
                <>
                  <label>
                    Vercel project name
                    <input
                      type="text"
                      value={deployName}
                      onChange={(e) =>
                        setDeployName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase())
                      }
                      placeholder="my-project"
                      autoFocus
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </label>

                  {projectGithubStatus?.github_repo && (
                    <div className="vercel-github-info">
                      <span className="vercel-github-label">Connected to GitHub:</span>
                      <span className="vercel-github-repo">{projectGithubStatus.github_repo}</span>
                      <span className="vercel-github-note">
                        Auto-deploys on push will be enabled
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {isLoadingProjects ? (
                    <div className="vercel-form-loading">
                      <div className="vercel-form-spinner" />
                      <span>Loading projects...</span>
                    </div>
                  ) : existingProjects.length === 0 ? (
                    <div className="vercel-form-empty">No projects found for this scope</div>
                  ) : (
                    <label>
                      Select project
                      <select
                        className="owner-select"
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                      >
                        <option value="">Choose a project...</option>
                        {existingProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}

              {error && <p className="vercel-error">{error}</p>}
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowDeployModal(false);
                  onModalClose?.();
                }}
                disabled={isDeploying || isLinking}
              >
                Cancel
              </button>
              {linkMode === 'new' ? (
                <button
                  className="btn-primary"
                  onClick={() => void handleDeploy()}
                  disabled={isDeploying || !deployName.trim()}
                >
                  {isDeploying ? 'Connecting...' : 'Connect & Deploy'}
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => void handleLinkExisting()}
                  disabled={isLinking || !selectedProjectId}
                >
                  {isLinking ? 'Linking...' : 'Link Project'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VercelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 116 100" fill="currentColor">
      <path d="M57.5 0L115 100H0L57.5 0Z" />
    </svg>
  );
}
