# Ship Studio Development Guidelines

## Core Principles

### Never Assume Data
- **Only display data that is reliably known** - never construct, guess, or infer values
- If data isn't available, either:
  1. Don't show that field at all
  2. Show a clear "unknown" or neutral state
  3. Redesign the UI to not need that data
- Example: Don't construct URLs like `https://{project-name}.vercel.app` - only show URLs that were explicitly returned from an API or saved from a real operation
- This prevents confusing users with incorrect information

### Data Storage
- Project metadata is stored in `.shipstudio/project.json` within each project
- This file stores: last_opened timestamp, publish records (staging/production with URL, state, publishedAt)
- Vercel project linking info is in `.vercel/project.json` (managed by Vercel CLI)
- Only trust data that was explicitly saved - don't infer state from file existence alone

## Architecture

### Backend (Rust/Tauri)
- Commands are organized in `src-tauri/src/commands/` by domain (git, vercel, github, etc.)
- Command registration is in `src-tauri/src/lib.rs`
- Commands validate paths to ensure they're within `~/ShipStudio` directory
- Git operations use the `git` CLI with TTL-based caching (`src-tauri/src/cache.rs`)
- Vercel operations use the `vercel` CLI
- Structured logging via `tracing` crate, logs stored at `~/Library/Logs/ShipStudio/`

### Frontend (React/TypeScript)
- Components are in `src/components/`
- Lib functions (Tauri invoke wrappers) are in `src/lib/`
- Main app state is managed in `src/App.tsx`
- Polling uses exponential backoff (`src/lib/polling.ts`)
- Structured logging via `src/lib/logger.ts`

## Testing

### Frontend Tests (Vitest + React Testing Library)
```bash
npm test          # Run all tests
npm run test:ui   # Run with Vitest UI
```

Tests are in `src/**/*.test.{ts,tsx}`. Uses official `@tauri-apps/api/mocks` for mocking Tauri IPC.

### Backend Tests (Rust)
```bash
cd src-tauri && cargo test
```

Unit tests are colocated in source files using `#[cfg(test)]` modules.

## Common Patterns

### Publishing Flow
1. User clicks Publish in PublishDropdown
2. Backend pushes to GitHub (staging or main branch)
3. Vercel auto-deploys via GitHub integration
4. Result (URL, state, timestamp) is saved to `.shipstudio/project.json`

### Integration Status
- GitHub: Check via `gh auth status`
- Vercel: Check via `vercel whoami`
- Claude: Check via `claude --version`

## Known Gotchas

### CSP Must Be Null for Terminal Fonts
The Content Security Policy in `src-tauri/tauri.conf.json` MUST be set to `null`.

**Why:** xterm.js dynamically injects `<style>` elements for font rendering. Even with `style-src 'unsafe-inline'` in the CSP, WebKit/Tauri blocks these styles in production builds. This causes the terminal to fall back to system fonts instead of JetBrains Mono Nerd Font.

**If you change CSP:** Always test terminal font rendering in a production build (`pnpm tauri build`), not just dev mode. Dev mode works fine but production builds will break.

## Releasing New Versions

Use `scripts/release.sh` to automate the release process. The script bumps the version in all 3 files (`package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`), updates `Cargo.lock`, commits, and tags.

### Quick Release

```bash
# Patch bump with release notes (most common)
./scripts/release.sh -n "**Fixed bug X** - Description"

# Multiple notes
./scripts/release.sh -n "**Feature A** - Description" -n "**Fix B** - Description"

# Minor or major bump
./scripts/release.sh minor -n "**New feature** - Description"

# Then push to trigger CI
git push origin main && git push origin vX.Y.Z
```

The `-n` flag automatically adds notes to `RELEASE_NOTES.md`. Without `-n`, you must update `RELEASE_NOTES.md` manually before running the script.

### What Happens After Push

1. GitHub Actions builds for ARM64 + Intel, signs with Apple Developer ID, and notarizes
2. Uploads artifacts to the private repo as a **draft** release
3. Auto-publishes to the public `ship-studio/releases` repo (updater bundles + DMGs + `latest.json`)
4. **You must manually publish the draft** in the main repo at https://github.com/ship-studio/ship-studio/releases

### Auto-Update Flow

The app checks `latest.json` from the public releases repo. When a newer version is found, `UpdateBanner` shows release notes with a download button. The update is verified using minisign signatures before installing.

### Two-Repo Strategy

- **`ship-studio/ship-studio`** (private) — source code, draft releases
- **`ship-studio/releases`** (public) — update bundles (`.tar.gz` + `.sig`), DMGs, `latest.json`

DMG download links for the marketing site:
- ARM64: `https://github.com/ship-studio/releases/releases/latest/download/ShipStudio_darwin-aarch64.dmg`
- Intel: `https://github.com/ship-studio/releases/releases/latest/download/ShipStudio_darwin-x86_64.dmg`

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 Developer ID Application certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 |
| `APPLE_API_ISSUER` | App Store Connect API issuer ID (for notarization) |
| `APPLE_API_KEY` | App Store Connect API key ID (for notarization) |
| `APPLE_API_KEY_CONTENT` | Base64-encoded .p8 private key file (for notarization) |
| `TAURI_SIGNING_PRIVATE_KEY` | Minisign private key for update bundle signing |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key |
| `RELEASES_PAT` | GitHub PAT with `public_repo` scope for cross-repo publishing |

### Local Notarized Build (for testing)

Use `scripts/build-notarized.sh` with the Apple env vars set to build, sign, and notarize locally. See the script for required environment variables.

See `RELEASING.md` for full details.
