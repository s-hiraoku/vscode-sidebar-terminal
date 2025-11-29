# User Review Feedback Tasks (2025-09-27)

## Review Summary

- Rating: 3/5 with four blocking UX issues identified on September 27, 2025.
- Focus: improve sidebar terminal polish for Claude Code workflows (settings, profiles, borders, multi-terminal navigation).

## Task Breakdown

- [x] **Restore settings button behaviour**
  - Diagnose why `secondaryTerminal.openSettings` from `src/providers/SecondaryTerminalProvider.ts:845` only logs and ensure the webview toggles a settings panel instead of no-op logging in `src/webview/managers/RefactoredTerminalWebviewManager.ts:2206`.
  - Wire the button in the header UI so that clicking the codicon triggers the manager and renders `SettingsPanel` (`src/webview/components/SettingsPanel.ts`).
  - Verify the extension command still opens VS Code settings via `vscode.commands.executeCommand('workbench.action.openSettings')` when invoked from the command palette.
  - Add regression coverage (unit/integration) that the button posts `openSettings` and that the webview responds.

- [x] **Implement "Switch Profile" command plumbing**
  - Register `secondaryTerminal.selectProfile` in `src/core/ExtensionLifecycle.ts` and `src/extension.ts` so it invokes a new handler that opens the profile picker rather than throwing "command not found".
  - Bridge the VS Code command to the existing webview message flow handled by `ProfileMessageHandler` (`src/services/webview/handlers/ProfileMessageHandler.ts`). Ensure it supports both dropdown selection and view toolbar button.
  - Confirm command metadata in `package.json:229` stays in sync (icon, category, when-clause) and add telemetry/error logging for failed profile launches.
  - Update automated tests (mock provider + e2e) to cover the new registration path and guard against regressions.

- [x] **Provide toggle to disable active terminal border highlight**
  - Introduce a user-facing setting (proposed id `secondaryTerminal.highlightActiveBorder`) defaulting to `true` and document it alongside existing decoration settings in `package.json` near `secondaryTerminal.decorations.*`.
  - Pipe the value through `UnifiedConfigurationService` → `WebViewSettingsManagerService` so that `UIManager` (`src/webview/managers/UIManager.ts:130-190`) can skip applying `WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR` (`src/webview/utils/WebviewThemeUtils.ts:51`) when the toggle is off.
  - Ensure the CSS fallback removes the `box-shadow` and `border` overrides when disabled while preserving focus indication for accessibility (consider solid outline or status badge alternative).
  - Add settings documentation and tests validating both active/inactive branches.

- [ ] **Add multi-terminal tab/dropdown navigation**
  - Evaluate enabling the dormant `TerminalTabManager` (`src/webview/managers/TerminalTabManager.ts`) and `TerminalTabList` component (`src/webview/components/TerminalTabList.ts`) to provide tabbed navigation without forced splits.
  - Expose a dropdown/tab UI in the header that lists existing terminals, matches VS Code behaviour, and keeps parity with split view support.
  - Synchronise with `TerminalLifecycleManager` so tab selection updates the active terminal without creating splits; ensure persistence and keyboard shortcuts continue to work.
  - Design UX fallback for users who still prefer splits (feature flag or combined view) and extend tests covering creation, switching, and disposal paths.

## Validation & Rollout Considerations

- Re-run `npm run test`, `npm run lint`, and webview integration suites after each task.
- Capture before/after screenshots or recordings for UI-facing tasks.
- Update release notes and CLAUDE.md once fixes are implemented.
