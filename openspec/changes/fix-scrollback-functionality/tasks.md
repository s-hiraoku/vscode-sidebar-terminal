# Tasks

## 1. Add Missing Message Handler

- [x] 1.1 Register `restoreTerminalSessions` command in `WebviewCoordinator.ts`
- [x] 1.2 Register `restoreTerminalSessions` command in `ConsolidatedMessageManager.ts`
- [x] 1.3 Implement handler in `ScrollbackMessageHandler.ts` to process `restoreTerminalSessions`
- [x] 1.4 Add batch restoration support for multiple terminals

## 2. Fix SerializeAddon Usage

- [x] 2.1 Update `LightweightTerminalWebviewManager.extractScrollbackData()` to use SerializeAddon
- [x] 2.2 Add fallback to buffer method when SerializeAddon unavailable
- [x] 2.3 Preserve ANSI color codes during extraction
- [x] 2.4 Add logging for extraction method used

## 3. Consolidate Code Paths

- [x] 3.1 Ensure `ScrollbackMessageHandler.extractScrollbackFromTerminal()` is the single source of truth
- [x] 3.2 Update `LightweightTerminalWebviewManager` to delegate to handler
- [ ] 3.3 Remove duplicate extraction logic (deferred - both paths now use consistent SerializeAddon logic)

## 4. Testing and Validation

- [ ] 4.1 Test session save/restore with scrollback data
- [ ] 4.2 Verify ANSI colors are preserved
- [ ] 4.3 Test multi-terminal restoration
- [ ] 4.4 Verify performance targets (<3s for 1000 lines)
- [ ] 4.5 Run existing scrollback tests

Note: Tasks 4.1-4.5 require manual testing due to pre-existing test infrastructure issues.
Compilation and lint checks passed successfully.
