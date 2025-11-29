# Tasks: add-terminal-profile-sync

## 1. Discovery
- [ ] Review VS Code `TerminalProfile` API usage patterns in existing extension code.
- [ ] Audit current terminal spawn logic in `src/terminals/TerminalManager.ts` to identify profile injection points.

## 2. Implementation
- [ ] Introduce profile resolution service with cached default profile lookup and fallback logging.
- [ ] Update terminal creation pipeline to request the resolved profile before instantiating PTY sessions.
- [ ] Add command `secondaryTerminal.syncDefaultProfile` exposed via Command Palette with keybinding docs update.
- [ ] Emit webview notification channel message when profile sync succeeds or falls back.

## 3. Telemetry & Flags
- [ ] Add optional telemetry payload that includes `profileName` and `profileSource` while respecting user privacy settings.
- [ ] Gate functionality behind `secondaryTerminal.enableProfileSync` setting (default `true`).

## 4. Testing
- [ ] Extend unit tests to cover profile resolution service and fallback scenarios.
- [ ] Add integration test verifying new sessions adopt mocked VS Code profiles across platforms.
- [ ] Ensure README and changelog entries describe feature and rollout notes.

**Status**: ⏸️ **NOT STARTED** - Planned for Future Release
- This feature is planned but not yet implemented
- Current terminal spawning uses bundled shell configuration
- Implementation would require VS Code Terminal Profile API integration
- Priority: Medium (after current refactoring work is complete)
