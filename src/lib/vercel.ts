import { invoke } from "@tauri-apps/api/core";

export interface VercelCliStatus {
  installed: boolean;
  authenticated: boolean;
}

export interface ProjectVercelStatus {
  /** "not-linked" | "not-git-connected" | "connected" */
  status: "not-linked" | "not-git-connected" | "connected";
  /** Vercel project name */
  project_name: string | null;
  /** Vercel org/team slug for dashboard URLs */
  vercel_org: string | null;
  /** Production URL (shortest alias, could be custom domain) */
  production_url: string | null;
  /** Staging URL (contains -git-staging-) */
  staging_url: string | null;
}

export async function checkVercelCliStatus(): Promise<VercelCliStatus> {
  return invoke<VercelCliStatus>("check_vercel_cli_status");
}

export async function getVercelUsername(): Promise<string> {
  return invoke<string>("get_vercel_username");
}

export async function getProjectVercelStatus(projectPath: string): Promise<ProjectVercelStatus> {
  return invoke<ProjectVercelStatus>("get_project_vercel_status", { projectPath });
}

export async function installVercelCli(): Promise<void> {
  return invoke("install_vercel_cli");
}

export interface LinkToVercelOptions {
  projectPath: string;
  githubRepo: string; // e.g., "username/repo-name"
}

export async function linkToVercel(options: LinkToVercelOptions): Promise<string> {
  return invoke<string>("link_to_vercel", { options });
}

export interface DeployToVercelOptions {
  projectPath: string;
  projectName: string;
  githubRepo?: string;
}

export async function deployToVercel(options: DeployToVercelOptions): Promise<string> {
  return invoke<string>("deploy_to_vercel", { options });
}

export interface VercelDeployment {
  uid: string;
  url: string;
  state: "READY" | "BUILDING" | "ERROR" | "QUEUED" | "CANCELED" | string;
  target: "production" | null;
  created_at: number; // Unix timestamp in ms
}

export interface VercelDeploymentStatus {
  staging: VercelDeployment | null;
  production: VercelDeployment | null;
  preview_url: string | null;
  production_url: string | null;
}

export async function getVercelDeployments(projectPath: string): Promise<VercelDeploymentStatus> {
  return invoke<VercelDeploymentStatus>("get_vercel_deployments", { projectPath });
}
