//! # Screenshot and Playwright Commands
//!
//! Commands for capturing project thumbnails, full-page and viewport screenshots,
//! image comparison, cropping, and stitching.
//!
//! Organized into submodules:
//! - `base` — crop, read as base64, and compare screenshots
//! - `playwright` — Playwright environment management, full-page and viewport captures
//! - `stitch` — stitch multiple screenshots into a single full-page image
//! - `thumbnail` — project thumbnail capture and retrieval

mod base;
mod playwright;
mod stitch;
mod thumbnail;

pub use base::*;
pub use playwright::*;
pub use stitch::*;
pub use thumbnail::*;
