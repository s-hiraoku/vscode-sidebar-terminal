# Change Proposal: Terminal Profile Sync

## Why
- Agents expect Secondary Terminal to mirror VS Code's default terminal profile to avoid shell mismatches when cloning workflows.
- Current implementation always launches the bundled shell configuration, causing environment drift and broken CLI startup scripts for zsh/fish users.
- Aligning with VS Code profiles removes manual profile switching and reduces onboarding friction for AI-driven workflows.

## What Changes
- Detect and cache the user's default VS Code terminal profile and apply it when Secondary Terminal spawns new sessions.
- Add a "Secondary Terminal: Sync Default Profile" command that refreshes cached profiles and re-spawns active terminals when requested.
- Surface a status toast in the webview when profile sync succeeds or falls back to the built-in shell.
- Extend agent telemetry to include selected profile metadata (name, shell path) for debugging.

## Success Metrics
- 0 regression failures in existing terminal launch integration tests.
- 100% of new sessions start with the VS Code default profile on supported platforms (Win/Mac/Linux) when the profile is available.
- Fallback path logs a single warning per session when profile resolution fails.

## Rollout Plan
- Land behind a feature flag `secondaryTerminal.enableProfileSync` defaulting to `true`.
- Validate on macOS, Windows PowerShell, and Ubuntu bash in CI matrix before enabling for all users.
- Document behavior and troubleshooting steps in README "Profiles" section.
