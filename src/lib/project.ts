import { invoke } from "@tauri-apps/api/core";
import { spawn, IPty } from "tauri-pty";

export interface Project {
  name: string;
  path: string;
  thumbnail: string | null;
}

export interface DashboardProject {
  name: string;
  path: string;
  thumbnail: string | null;
  last_opened: number | null;
  /** Current git branch name */
  git_branch: string | null;
  /** Number of uncommitted changes (staged + unstaged) */
  uncommitted_count: number | null;
  /** Production URL from Vercel */
  production_url: string | null;
  /** Relative time string for last deployment (e.g., "2h ago") */
  last_deployed: string | null;
  /** Deployment state: READY, BUILDING, ERROR, QUEUED, CANCELED */
  deployment_state: string | null;
}

export interface Prerequisite {
  name: string;
  available: boolean;
  path: string | null;
}

export async function checkPrerequisites(): Promise<Prerequisite[]> {
  return invoke<Prerequisite[]>("check_prerequisites");
}

export async function listProjects(): Promise<Project[]> {
  return invoke<Project[]>("list_projects");
}

export async function getDashboardProjects(): Promise<DashboardProject[]> {
  return invoke<DashboardProject[]>("get_dashboard_projects");
}

export async function getMarketingstackDir(): Promise<string> {
  return invoke<string>("get_marketingstack_dir");
}

export async function ensureMarketingstackDir(): Promise<string> {
  return invoke<string>("ensure_marketingstack_dir");
}

export interface DevServerHandle {
  pty: IPty;
  stop: () => Promise<void>;
}

export async function startDevServer(
  projectPath: string,
  onOutput?: (data: string) => void
): Promise<DevServerHandle> {
  const decoder = new TextDecoder();

  const pty = await spawn("npm", ["run", "dev"], {
    cwd: projectPath,
    cols: 80,
    rows: 24,
  });

  if (onOutput) {
    pty.onData((data) => {
      onOutput(decoder.decode(data));
    });
  }

  return {
    pty,
    stop: async () => {
      try {
        pty.kill();
      } catch {
        // Ignore errors
      }
    },
  };
}

export async function waitForServer(
  url: string,
  maxAttempts = 30,
  intervalMs = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await fetch(url, { mode: "no-cors" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

// ============ Project Metadata (Publish State Persistence) ============

export interface PublishRecord {
  url: string;
  state: string;
  publishedAt: number;
}

export interface PublishMetadata {
  staging: PublishRecord | null;
  production: PublishRecord | null;
}

export interface ProjectMetadata {
  _description: string;
  publish: PublishMetadata;
}

export async function readProjectMetadata(projectPath: string): Promise<ProjectMetadata | null> {
  return invoke<ProjectMetadata | null>("read_project_metadata", { projectPath });
}

export async function writeProjectMetadata(projectPath: string, metadata: ProjectMetadata): Promise<void> {
  return invoke<void>("write_project_metadata", { projectPath, metadata });
}

export async function savePublishRecord(
  projectPath: string,
  target: "staging" | "production",
  record: PublishRecord
): Promise<void> {
  // Read existing metadata or create new
  let metadata = await readProjectMetadata(projectPath);

  if (!metadata) {
    metadata = {
      _description: "Marketingstack project metadata. Auto-generated - safe to delete if needed, will be recreated.",
      publish: { staging: null, production: null }
    };
  }

  // Update the specific target
  metadata.publish[target] = record;

  // Write back
  await writeProjectMetadata(projectPath, metadata);
}
