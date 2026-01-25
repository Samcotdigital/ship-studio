//! # Vercel CLI Integration Commands
//!
//! Commands for Vercel CLI status, deployments, and project management.

use std::process::Command;
use crate::types::{
    DeployToVercelOptions, DeploymentStatus, LinkToVercelOptions, ProjectMetadata,
    ProjectVercelStatus, PublishRecord, VercelCliStatus, VercelDeployment,
    VercelDeploymentStatus, VercelTeam,
};
use crate::utils::{get_extended_path, validate_project_path, format_relative_time};
use crate::commands::setup::is_mock_mode;

/// Finds the Vercel CLI binary by checking common installation paths.
pub fn find_vercel_binary() -> Option<std::path::PathBuf> {
    // First try which
    if let Ok(path) = which::which("vercel") {
        return Some(path);
    }

    // Check common npm global bin locations
    if let Some(home) = dirs::home_dir() {
        let common_paths = vec![
            home.join(".npm-global/bin/vercel"),
            home.join(".nvm/versions/node").join("*").join("bin/vercel"),
            home.join("n/bin/vercel"),
            std::path::PathBuf::from("/usr/local/bin/vercel"),
            std::path::PathBuf::from("/opt/homebrew/bin/vercel"),
        ];

        for path in common_paths {
            if path.exists() {
                return Some(path);
            }
        }

        // Check npm prefix
        if let Ok(output) = Command::new("npm")
            .args(["prefix", "-g"])
            .env("PATH", get_extended_path())
            .output()
        {
            if output.status.success() {
                let prefix = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let vercel_path = std::path::PathBuf::from(&prefix).join("bin/vercel");
                if vercel_path.exists() {
                    return Some(vercel_path);
                }
            }
        }
    }

    None
}

/// Returns a Command for vercel with extended PATH set
pub fn get_vercel_command() -> Command {
    let mut cmd = if let Some(path) = find_vercel_binary() {
        Command::new(path)
    } else {
        // Fallback to system PATH
        Command::new("vercel")
    };
    // Ensure extended PATH is available for any child processes
    cmd.env("PATH", get_extended_path());
    cmd
}

#[tauri::command]
pub async fn install_vercel_cli() -> Result<(), String> {
    if is_mock_mode() {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        crate::commands::setup::mock_install("vercel");
        return Ok(());
    }

    // Install Vercel CLI globally via npm
    let output = Command::new("npm")
        .args(["install", "-g", "vercel"])
        .env("PATH", get_extended_path())
        .output()
        .map_err(|e| format!("Failed to run npm: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to install Vercel CLI: {}", stderr));
    }

    Ok(())
}

#[tauri::command]
pub async fn check_vercel_cli_status() -> VercelCliStatus {
    // Check if vercel CLI is installed (either in PATH or common npm locations)
    let installed = find_vercel_binary().is_some();

    if !installed {
        return VercelCliStatus {
            installed: false,
            authenticated: false,
        };
    }

    // Check if authenticated by running `vercel whoami`
    let authenticated = get_vercel_command()
        .args(["whoami"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    VercelCliStatus {
        installed,
        authenticated,
    }
}

#[tauri::command]
pub async fn get_vercel_username() -> Result<String, String> {
    let output = get_vercel_command()
        .args(["whoami"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to get Vercel username".to_string());
    }

    let username = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(username)
}

/// Get list of Vercel teams the user belongs to.
#[tauri::command]
pub async fn get_vercel_teams() -> Result<Vec<VercelTeam>, String> {
    let output = get_vercel_command()
        .args(["team", "list", "--no-color"])
        .output()
        .map_err(|e| format!("Failed to run vercel team list: {}", e))?;

    // If the command fails (e.g., user has no teams), return empty list
    if !output.status.success() {
        return Ok(Vec::new());
    }

    // Vercel CLI outputs to stderr, not stdout
    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut teams = Vec::new();
    let mut in_table = false;

    // Parse the output table format:
    // ✔ team-slug     Team Name
    //   other-team    Other Team Name
    for line in stderr.lines() {
        // Skip header/info lines
        if line.contains("Vercel CLI")
            || line.contains("Fetching")
            || line.trim().is_empty()
        {
            continue;
        }

        // Detect header row
        if line.trim().starts_with("id") || (line.contains("id") && line.contains("Team name")) {
            in_table = true;
            continue;
        }

        if !in_table {
            continue;
        }

        // Check if this line starts with the current team marker
        let is_current = line.starts_with('✔') || line.starts_with("✔");

        // Remove the marker and leading whitespace
        let cleaned = line.trim_start_matches('✔').trim();

        // Split into parts - first part is ID (slug), rest is team name
        // The format uses multiple spaces to separate columns
        let parts: Vec<&str> = cleaned.splitn(2, "  ").collect();

        if parts.len() >= 2 {
            let id = parts[0].trim().to_string();
            let name = parts[1].trim().to_string();

            if !id.is_empty() && !name.is_empty() {
                teams.push(VercelTeam {
                    id,
                    name,
                    is_current,
                });
            }
        } else if parts.len() == 1 {
            // Fallback: if only one part, use it as both id and name
            let id = parts[0].trim().to_string();
            if !id.is_empty() && !id.to_lowercase().contains("team name") {
                teams.push(VercelTeam {
                    id: id.clone(),
                    name: id,
                    is_current,
                });
            }
        }
    }

    Ok(teams)
}

#[tauri::command]
pub async fn deploy_to_vercel(options: DeployToVercelOptions) -> Result<String, String> {
    let validated_path = validate_project_path(&options.project_path)?;
    let project_name = &options.project_name;

    // Step 1: Link the project to Vercel (creates project if doesn't exist)
    let mut link_args = vec!["link", "--yes", "--project", project_name];

    // Add scope if provided (team ID)
    let scope_arg: String;
    if let Some(ref scope) = options.scope {
        scope_arg = scope.clone();
        link_args.push("--scope");
        link_args.push(&scope_arg);
    }

    let link_output = get_vercel_command()
        .args(&link_args)
        .current_dir(&validated_path)
        .output()
        .map_err(|e| format!("Failed to run vercel link: {}", e))?;

    if !link_output.status.success() {
        let stderr = String::from_utf8_lossy(&link_output.stderr);
        let stdout = String::from_utf8_lossy(&link_output.stdout);
        return Err(format!("Failed to link project to Vercel: {} {}", stderr, stdout));
    }

    // Step 2: If GitHub repo is provided, connect it for auto-deploy on future pushes
    if let Some(github_repo) = &options.github_repo {
        let github_url = format!("https://github.com/{}", github_repo);
        let mut connect_cmd = get_vercel_command();
        connect_cmd.args(["git", "connect", &github_url, "--yes"]);

        // Add scope if provided
        if let Some(ref scope) = options.scope {
            connect_cmd.args(["--scope", scope]);
        }

        let connect_output = connect_cmd
            .current_dir(&validated_path)
            .output();

        if let Ok(output) = connect_output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let combined = format!("{}{}", stdout, stderr);

            if !output.status.success() && !combined.contains("already connected") {
                // Parse the error to give a helpful message
                if combined.contains("Make sure there aren't any typos") || combined.contains("access to the repository") {
                    // Extract GitHub org from repo (e.g., "ship-studio" from "ship-studio/repo-name")
                    let github_org = github_repo.split('/').next().unwrap_or("the GitHub organization");
                    return Err(format!(
                        "GitHub connection failed: The Vercel team doesn't have access to the '{}' GitHub organization.\n\n\
                        To fix this:\n\
                        1. Go to Vercel → Team Settings → Git\n\
                        2. Connect or authorize the '{}' GitHub organization",
                        github_org, github_org
                    ));
                } else if combined.contains("already linked") {
                    // Different repo already linked - this is fine, continue
                } else {
                    return Err(format!("Failed to connect GitHub repository: {}", combined.trim()));
                }
            }
        }
    }

    // Step 3: Deploy to production
    let mut deploy_args = vec!["--prod", "--yes"];

    // Add scope if provided (team ID)
    let deploy_scope_arg: String;
    if let Some(ref scope) = options.scope {
        deploy_scope_arg = scope.clone();
        deploy_args.push("--scope");
        deploy_args.push(&deploy_scope_arg);
    }

    let deploy_output = get_vercel_command()
        .args(&deploy_args)
        .current_dir(&validated_path)
        .output()
        .map_err(|e| format!("Failed to run vercel --prod: {}", e))?;

    if !deploy_output.status.success() {
        let stderr = String::from_utf8_lossy(&deploy_output.stderr);
        let stdout = String::from_utf8_lossy(&deploy_output.stdout);
        return Err(format!("Failed to deploy to Vercel: {} {}", stderr, stdout));
    }

    // Parse production URL from vercel --prod output
    let stdout = String::from_utf8_lossy(&deploy_output.stdout);
    let production_url = stdout
        .lines()
        .find_map(|line| {
            if let Some(https_start) = line.find("https://") {
                let url_part = &line[https_start..];
                let url_end = url_part
                    .find(|c: char| c.is_whitespace() || c == '[' || c == ']')
                    .unwrap_or(url_part.len());
                let url = &url_part[..url_end];
                if !url.contains("/deployments/") && !url.contains("vercel.com/") {
                    return Some(url.to_string());
                }
            }
            None
        })
        .unwrap_or_else(|| format!("https://{}.vercel.app", project_name));

    // Write the production URL to a marker file for reliable detection
    let vercel_dir = validated_path.join(".vercel");
    let url_file = vercel_dir.join("production_url");
    if let Err(e) = std::fs::write(&url_file, &production_url) {
        eprintln!("Warning: Failed to write production_url marker: {}", e);
    }

    Ok(production_url)
}

/// Checks Vercel status by verifying with the Vercel CLI.
#[tauri::command]
pub async fn get_project_vercel_status(project_path: String) -> ProjectVercelStatus {
    let not_linked = ProjectVercelStatus {
        status: "not-linked".to_string(),
        project_name: None,
        vercel_org: None,
        production_url: None,
        staging_url: None,
    };

    // Validate path
    let project = match validate_project_path(&project_path) {
        Ok(p) => p,
        Err(_) => return not_linked,
    };

    let vercel_dir = project.join(".vercel");
    let project_json = vercel_dir.join("project.json");

    // Check if .vercel/project.json exists
    if !project_json.exists() {
        return not_linked;
    }

    // Read project.json to get project name and org/project IDs
    let project_json_content = std::fs::read_to_string(&project_json)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok());

    let project_name = project_json_content.as_ref()
        .and_then(|json| json.get("projectName").and_then(|v| v.as_str()).map(|s| s.to_string()));

    // Get orgId for team-scoped projects
    let org_id = project_json_content.as_ref()
        .and_then(|json| json.get("orgId").and_then(|v| v.as_str()).map(|s| s.to_string()));

    let project_name_str = match &project_name {
        Some(name) => name.clone(),
        None => return not_linked,
    };

    // Verify the project actually exists on Vercel by running `vercel ls`
    // This will fail if the project was deleted or the local config is stale
    // Use --scope if we have an orgId (team project)
    let mut verify_cmd = get_vercel_command();
    verify_cmd.args(["ls"]);
    if let Some(ref org) = org_id {
        verify_cmd.args(["--scope", org]);
    }
    let verify_output = verify_cmd
        .current_dir(&project)
        .output();

    let project_exists = match verify_output {
        Ok(output) => {
            // If the command succeeds and doesn't contain error messages about missing project
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let combined = format!("{}{}", stdout, stderr);

            // Check for various error indicators that mean the project doesn't exist
            !combined.contains("not linked")
                && !combined.contains("Could not find")
                && !combined.contains("No project found")
                && !combined.contains("does not exist")
                && output.status.success()
        }
        Err(_) => false,
    };

    if !project_exists {
        // Clean up stale local config
        let _ = std::fs::remove_dir_all(&vercel_dir);
        return not_linked;
    }

    // Check if Vercel is connected to GitHub
    // Use --scope if we have an orgId (team project)
    let mut git_cmd = get_vercel_command();
    git_cmd.args(["git", "connect", "--yes"]);
    if let Some(ref org) = org_id {
        git_cmd.args(["--scope", org]);
    }
    let git_connect_output = git_cmd
        .current_dir(&project)
        .output();

    let is_git_connected = match git_connect_output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let full_output = stdout + &stderr;
            full_output.contains("already connected")
        }
        Err(_) => false,
    };

    if !is_git_connected {
        return ProjectVercelStatus {
            status: "not-git-connected".to_string(),
            project_name,
            vercel_org: None,
            production_url: None,
            staging_url: None,
        };
    }

    // Get URLs from `vercel alias ls`
    let mut alias_cmd = get_vercel_command();
    alias_cmd.args(["alias", "ls"]);
    if let Some(ref org) = org_id {
        alias_cmd.args(["--scope", org]);
    }
    let alias_output = alias_cmd
        .current_dir(&project)
        .output()
        .ok();

    let mut vercel_org: Option<String> = None;
    let mut staging_url: Option<String> = None;
    let mut production_url: Option<String> = None;
    let mut production_candidates: Vec<String> = Vec::new();

    if let Some(output) = alias_output {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let full_output = stdout + &stderr;

        // Extract org from "Fetching aliases under {org}"
        for line in full_output.lines() {
            if line.contains("Fetching aliases under ") {
                vercel_org = line.split("Fetching aliases under ").nth(1).map(|s| s.trim().to_string());
                break;
            }
        }

        // Parse alias table for URLs belonging to this project
        for line in full_output.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let url = parts[1];
                if url.starts_with(&format!("{}.", project_name_str))
                    || url.starts_with(&format!("{}-", project_name_str)) {
                    if url.contains("-git-staging-") {
                        if staging_url.is_none() {
                            staging_url = Some(url.to_string());
                        }
                    } else if !url.contains("-git-") {
                        production_candidates.push(url.to_string());
                    }
                }
            }
        }

        // Pick shortest production URL (likely custom domain or {project}.vercel.app)
        if !production_candidates.is_empty() {
            production_candidates.sort_by_key(|s| s.len());
            production_url = Some(production_candidates[0].clone());
        }
    }

    // If no staging URL from aliases, check vercel list for Preview deployments
    if staging_url.is_none() {
        let mut list_cmd = get_vercel_command();
        list_cmd.args(["list"]);
        if let Some(ref org) = org_id {
            list_cmd.args(["--scope", org]);
        }
        let list_output = list_cmd
            .current_dir(&project)
            .output()
            .ok();

        if let Some(output) = list_output {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            for line in stderr.lines() {
                if line.contains("Preview") && !line.contains("Production") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    for part in parts {
                        if part.contains(".vercel.app") {
                            let url = part.trim_start_matches("https://");
                            staging_url = Some(url.to_string());
                            break;
                        }
                    }
                    if staging_url.is_some() {
                        break;
                    }
                }
            }
        }
    }

    // Cache URLs to .shipstudio/project.json
    if production_url.is_some() || staging_url.is_some() {
        let shipstudio_dir = project.join(".shipstudio");
        let metadata_path = shipstudio_dir.join("project.json");

        let mut metadata = if metadata_path.exists() {
            std::fs::read_to_string(&metadata_path)
                .ok()
                .and_then(|contents| serde_json::from_str::<ProjectMetadata>(&contents).ok())
                .unwrap_or_default()
        } else {
            ProjectMetadata::default()
        };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        if let Some(ref url) = production_url {
            metadata.publish.production = Some(PublishRecord {
                url: url.clone(),
                state: "READY".to_string(),
                published_at: now,
            });
        }

        if let Some(ref url) = staging_url {
            metadata.publish.staging = Some(PublishRecord {
                url: url.clone(),
                state: "READY".to_string(),
                published_at: now,
            });
        }

        let _ = std::fs::create_dir_all(&shipstudio_dir);
        if let Ok(contents) = serde_json::to_string_pretty(&metadata) {
            let _ = std::fs::write(&metadata_path, contents);
        }
    }

    ProjectVercelStatus {
        status: "connected".to_string(),
        project_name,
        vercel_org,
        production_url,
        staging_url,
    }
}

#[tauri::command]
pub async fn link_to_vercel(options: LinkToVercelOptions) -> Result<String, String> {
    let project_path = &options.project_path;
    let github_repo = &options.github_repo;

    // Step 1: Link the local project to Vercel
    let link_output = get_vercel_command()
        .args(["link", "--yes"])
        .current_dir(project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !link_output.status.success() {
        let stderr = String::from_utf8_lossy(&link_output.stderr);
        return Err(format!("Failed to link project to Vercel: {}", stderr));
    }

    // Step 2: Connect Vercel project to the GitHub repo
    let github_url = format!("https://github.com/{}", github_repo);
    let connect_output = get_vercel_command()
        .args(["git", "connect", &github_url, "--yes"])
        .current_dir(project_path)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&connect_output.stdout);
    let stderr = String::from_utf8_lossy(&connect_output.stderr);
    let combined_output = format!("{}{}", stdout, stderr);

    if !connect_output.status.success() && !combined_output.contains("already connected") {
        eprintln!("Warning: Failed to connect Vercel to GitHub: {}", stderr);
    }

    // Step 3: Trigger initial production deployment
    let deploy_output = get_vercel_command()
        .args(["--prod", "--yes"])
        .current_dir(project_path)
        .output();

    let mut deployed_url: Option<String> = None;
    if let Ok(output) = deploy_output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains("Production:") || line.starts_with("https://") {
                if let Some(url) = line.split_whitespace().find(|s| s.starts_with("https://")) {
                    deployed_url = Some(url.to_string());
                    break;
                }
            }
        }
    }

    // Fallback: construct URL from repo name
    let url = deployed_url.unwrap_or_else(|| {
        let repo_name = github_repo.split('/').last().unwrap_or("project");
        format!("https://{}.vercel.app", repo_name)
    });

    // Save the URL to project metadata
    let project = std::path::Path::new(project_path);
    let shipstudio_dir = project.join(".shipstudio");
    let metadata_path = shipstudio_dir.join("project.json");

    let mut metadata: ProjectMetadata = if metadata_path.exists() {
        std::fs::read_to_string(&metadata_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        ProjectMetadata::default()
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    metadata.publish.production = Some(PublishRecord {
        url: url.clone(),
        state: "READY".to_string(),
        published_at: now,
    });

    let _ = std::fs::create_dir_all(&shipstudio_dir);
    if let Ok(contents) = serde_json::to_string_pretty(&metadata) {
        let _ = std::fs::write(&metadata_path, contents);
    }

    Ok(url)
}

/// Parses a deployment line from `vercel list` output.
fn parse_deployment_line(line: &str) -> Option<(String, String, Option<String>)> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }

    let first = parts[0];
    if !first.contains('.') {
        return None;
    }

    let url = if first.starts_with("https://") {
        first.to_string()
    } else {
        format!("https://{}", first)
    };

    let state = parts.iter()
        .find(|&p| {
            let lower = p.to_lowercase();
            lower == "ready" || lower == "building" || lower == "error" ||
            lower == "queued" || lower == "canceled"
        })
        .map(|s| s.to_uppercase())
        .unwrap_or_else(|| "UNKNOWN".to_string());

    let branch = parts.iter()
        .find(|&p| *p == "main" || *p == "master" || *p == "staging" || *p == "preview")
        .map(|s| s.to_string());

    Some((url, state, branch))
}

#[tauri::command]
pub async fn get_vercel_deployments(project_path: String) -> Result<VercelDeploymentStatus, String> {
    let validated_path = validate_project_path(&project_path)?;

    let output = get_vercel_command()
        .args(["list", "--limit", "10"])
        .current_dir(&validated_path)
        .output()
        .map_err(|e| format!("Failed to run vercel list: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not linked") || stderr.contains("No project found") || stderr.contains("Could not find") {
            return Ok(VercelDeploymentStatus {
                staging: None,
                production: None,
                preview_url: None,
                production_url: None,
            });
        }
        eprintln!("vercel list error: {}", stderr);
        return Ok(VercelDeploymentStatus {
            staging: None,
            production: None,
            preview_url: None,
            production_url: None,
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut staging_deployment: Option<VercelDeployment> = None;
    let mut production_deployment: Option<VercelDeployment> = None;
    let mut preview_url: Option<String> = None;
    let mut production_url: Option<String> = None;

    for line in stdout.lines() {
        if line.trim().is_empty() ||
           line.contains("Deployments") ||
           line.starts_with("─") ||
           (line.contains("Age") && line.contains("Status")) {
            continue;
        }

        if let Some((url, state, branch)) = parse_deployment_line(line) {
            let is_production = line.to_lowercase().contains("production") ||
                               branch.as_ref().map(|b| b == "main" || b == "master").unwrap_or(false);
            let is_staging = branch.as_ref().map(|b| b == "staging").unwrap_or(false);

            let deployment = VercelDeployment {
                uid: String::new(),
                url: url.clone(),
                state: state.clone(),
                target: if is_production { Some("production".to_string()) } else { None },
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0),
            };

            if is_production && production_deployment.is_none() {
                production_url = Some(url);
                production_deployment = Some(deployment);
            } else if is_staging && staging_deployment.is_none() {
                preview_url = Some(url);
                staging_deployment = Some(deployment);
            } else if staging_deployment.is_none() && !is_production {
                preview_url = Some(url);
                staging_deployment = Some(deployment);
            }
        }
    }

    Ok(VercelDeploymentStatus {
        staging: staging_deployment,
        production: production_deployment,
        preview_url,
        production_url,
    })
}

/// Get the latest deployment status for a project from Vercel.
#[tauri::command]
pub async fn get_deployment_status(project_path: String, _since_timestamp: Option<u64>) -> Result<Option<DeploymentStatus>, String> {
    let validated_path = validate_project_path(&project_path)?;

    // Step 1: Check for any BUILDING deployments first
    let building_output = Command::new("vercel")
        .args(["ls", "--status", "BUILDING", "--no-color"])
        .current_dir(&validated_path)
        .env("PATH", get_extended_path())
        .output()
        .map_err(|e| format!("Failed to run vercel ls: {}", e))?;

    if building_output.status.success() {
        let building_stdout = String::from_utf8_lossy(&building_output.stdout);
        if let Some(url) = building_stdout.lines()
            .find(|line| line.contains(".vercel.app") && line.trim().starts_with("https://"))
            .map(|line| line.trim().to_string())
        {
            return Ok(Some(DeploymentStatus {
                state: "BUILDING".to_string(),
                url: Some(url),
                created_at: None,
                ready_at: None,
            }));
        }
    }

    // Step 2: No building deployments, get the newest deployment
    let output = Command::new("vercel")
        .args(["ls", "--no-color"])
        .current_dir(&validated_path)
        .env("PATH", get_extended_path())
        .output()
        .map_err(|e| format!("Failed to run vercel ls: {}", e))?;

    if !output.status.success() {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    let url = match stdout.lines()
        .find(|line| line.contains(".vercel.app") && line.trim().starts_with("https://"))
        .map(|line| line.trim().to_string())
    {
        Some(u) => u,
        None => return Ok(None),
    };

    // Step 3: Get deployment details with vercel inspect --json
    let inspect_output = Command::new("vercel")
        .args(["inspect", &url, "--json"])
        .current_dir(&validated_path)
        .env("PATH", get_extended_path())
        .output()
        .map_err(|e| format!("Failed to run vercel inspect: {}", e))?;

    if !inspect_output.status.success() {
        return Ok(None);
    }

    let inspect_stdout = String::from_utf8_lossy(&inspect_output.stdout);

    let json_start = match inspect_stdout.find('{') {
        Some(i) => i,
        None => return Ok(None),
    };
    let json_str = &inspect_stdout[json_start..];

    let ready_state = if json_str.contains("\"readyState\": \"READY\"") || json_str.contains("\"readyState\":\"READY\"") {
        "READY"
    } else if json_str.contains("\"readyState\": \"BUILDING\"") || json_str.contains("\"readyState\":\"BUILDING\"") {
        "BUILDING"
    } else if json_str.contains("\"readyState\": \"ERROR\"") || json_str.contains("\"readyState\":\"ERROR\"") {
        "ERROR"
    } else if json_str.contains("\"readyState\": \"QUEUED\"") || json_str.contains("\"readyState\":\"QUEUED\"") {
        "QUEUED"
    } else if json_str.contains("\"readyState\": \"CANCELED\"") || json_str.contains("\"readyState\":\"CANCELED\"") {
        "CANCELED"
    } else {
        "BUILDING"
    };

    Ok(Some(DeploymentStatus {
        state: ready_state.to_string(),
        url: Some(url),
        created_at: None,
        ready_at: None,
    }))
}

/// Helper to get Vercel deployment info for a project (used by get_dashboard_projects)
pub fn get_vercel_deployment_info(project_path: &std::path::Path) -> (Option<String>, Option<String>, Option<String>) {
    let metadata_path = project_path.join(".shipstudio").join("project.json");
    if metadata_path.exists() {
        if let Ok(contents) = std::fs::read_to_string(&metadata_path) {
            if let Ok(metadata) = serde_json::from_str::<ProjectMetadata>(&contents) {
                if let Some(prod) = metadata.publish.production {
                    if !prod.url.is_empty() {
                        return (
                            Some(prod.url),
                            Some(format_relative_time(prod.published_at)),
                            Some(prod.state),
                        );
                    }
                }
                if let Some(staging) = metadata.publish.staging {
                    if !staging.url.is_empty() {
                        return (
                            Some(staging.url),
                            Some(format_relative_time(staging.published_at)),
                            Some(staging.state),
                        );
                    }
                }
            }
        }
    }

    (None, None, None)
}
