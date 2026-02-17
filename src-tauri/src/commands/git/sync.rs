//! Git sync commands — fetch, pull, merge, commit, discard.

use crate::cache::GIT_CACHE;
use crate::utils::{create_command, validate_project_path};

use super::git_stage_and_commit;

/// Fetch all branches from remotes
#[tauri::command]
pub async fn fetch_all_branches(project_path: String) -> Result<(), String> {
    let validated_path = validate_project_path(&project_path)?;

    let output = create_command("git")
        .args(["fetch", "--all", "--prune"])
        .current_dir(&validated_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to fetch: {stderr}"));
    }

    Ok(())
}

/// Pull latest changes from remote for current branch
#[tauri::command]
pub async fn git_pull(project_path: String) -> Result<(), String> {
    let validated_path = validate_project_path(&project_path)?;

    let output = create_command("git")
        .args(["pull", "--ff-only"])
        .current_dir(&validated_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to pull: {stderr}"));
    }

    // Invalidate status cache after pull
    GIT_CACHE.invalidate_status(&project_path);

    Ok(())
}

/// Pull remote changes and merge (may result in conflicts)
#[tauri::command]
pub async fn pull_and_merge(
    project_path: String,
    merge_branch: Option<String>,
) -> Result<(), String> {
    let validated_path = validate_project_path(&project_path)?;

    // First fetch to ensure we have latest refs
    let _ = create_command("git")
        .args(["fetch", "origin"])
        .current_dir(&validated_path)
        .output();

    let output = if let Some(branch) = merge_branch {
        create_command("git")
            .args(["merge", &format!("origin/{branch}")])
            .current_dir(&validated_path)
            .output()
            .map_err(|e| e.to_string())?
    } else {
        create_command("git")
            .args(["pull", "--no-rebase"])
            .current_dir(&validated_path)
            .output()
            .map_err(|e| e.to_string())?
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}{stderr}");

    // Check for merge conflicts
    if combined.contains("CONFLICT") || combined.contains("Automatic merge failed") {
        return Err(format!("MERGE_CONFLICT:{combined}"));
    }

    if !output.status.success() {
        return Err(format!("Failed to merge: {stderr}"));
    }

    Ok(())
}

/// Discard all uncommitted changes in the working directory
#[tauri::command]
pub async fn discard_changes(project_path: String) -> Result<(), String> {
    let validated_path = validate_project_path(&project_path)?;

    // Discard changes to tracked files
    let checkout_output = create_command("git")
        .args(["checkout", "."])
        .current_dir(&validated_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !checkout_output.status.success() {
        let stderr = String::from_utf8_lossy(&checkout_output.stderr);
        return Err(format!("Failed to discard changes: {stderr}"));
    }

    // Remove untracked files
    let clean_output = create_command("git")
        .args(["clean", "-fd"])
        .current_dir(&validated_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !clean_output.status.success() {
        let stderr = String::from_utf8_lossy(&clean_output.stderr);
        return Err(format!("Failed to clean untracked files: {stderr}"));
    }

    // Invalidate status caches after discarding changes
    GIT_CACHE.invalidate_status(&project_path);

    Ok(())
}

/// Stage all changes and create a commit with the given message.
/// Returns true if a commit was made, false if there was nothing to commit.
#[tauri::command]
pub async fn commit_changes(project_path: String, message: String) -> Result<bool, String> {
    let validated_path = validate_project_path(&project_path)?;
    let committed = git_stage_and_commit(&validated_path, &message)?;
    if committed {
        GIT_CACHE.invalidate_status(&project_path);
    }
    Ok(committed)
}
