//! # Settings Commands
//!
//! Persisted UI preferences (calendar visibility, etc.).

use crate::commands::setup::{read_app_state, write_app_state};

/// Get whether the GitHub contribution calendar is hidden on the dashboard.
#[tauri::command]
pub fn get_calendar_hidden() -> Result<bool, String> {
    let state = read_app_state();
    Ok(state.calendar_hidden.unwrap_or(false))
}

/// Set whether the GitHub contribution calendar is hidden (persisted to app state).
#[tauri::command]
pub fn set_calendar_hidden(hidden: bool) -> Result<(), String> {
    let mut state = read_app_state();
    state.calendar_hidden = Some(hidden);
    write_app_state(&state)
}
