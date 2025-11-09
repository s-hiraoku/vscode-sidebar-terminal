# Tasks: Fix Duplicate Input Echo

## Overview

Fix terminal input duplication by replacing `terminal.onData()` with `terminal.onKey()` to capture only user keyboard input.

## Task Breakdown

### Phase 1: Code Investigation and Validation (Completed ✅)

- [x] **Task 1.1**: Investigate terminal input handling flow
  - Location: `src/webview/managers/InputManager.ts`
  - Identify `onData` event handler at line 933-950
  - Confirm root cause: `onData` captures both user input and PTY echo

- [x] **Task 1.2**: Review xterm.js API documentation
  - Compare `onData` vs `onKey` event behavior
  - Confirm `onKey` only captures user keyboard events
  - Verify `onKey` provides `{ key: string; domEvent: KeyboardEvent }`

- [x] **Task 1.3**: Search for all `onData` usages in codebase
  - Find all instances of `terminal.onData` calls
  - Verify only InputManager uses it for user input handling
  - Confirm no other code depends on this specific handler

### Phase 2: Implementation

- [ ] **Task 2.1**: Replace `onData` with `onKey` in InputManager
  - File: `src/webview/managers/InputManager.ts`
  - Replace event handler at line 933-950
  - Update IME composition handling for `onKey` event structure
  - Update logging to reflect user keyboard input specifically
  - **Validation**: Code compiles without TypeScript errors

- [ ] **Task 2.2**: Update event handling logic
  - Extract `event.key` from KeyboardEvent structure
  - Ensure IME composition check happens before sending data
  - Add early return for IME composition state
  - **Validation**: Logic handles all keyboard event types correctly

- [ ] **Task 2.3**: Add paste event handling if needed
  - Test if paste operations still work with `onKey` only
  - If paste doesn't work, add separate `onData` handler for paste detection
  - Filter paste events from regular `onKey` flow
  - **Validation**: Paste operations function correctly

### Phase 3: Testing

- [ ] **Task 3.1**: Manual typing test
  - Type individual characters (a, b, c, 1, 2, 3)
  - Verify each character appears exactly once
  - Test with different terminal profiles
  - **Expected**: No duplicate characters

- [ ] **Task 3.2**: Rapid typing test
  - Type quickly: "hello world test 123"
  - Verify all characters appear correctly once
  - Check for any dropped or duplicated characters
  - **Expected**: Complete input with no errors

- [ ] **Task 3.3**: IME composition test
  - Test Japanese input: ひらがな、カタカナ、漢字
  - Test Chinese input: 你好世界
  - Verify composition works correctly
  - **Expected**: IME composition completes successfully

- [ ] **Task 3.4**: Special keys test
  - Test arrow keys (Up, Down, Left, Right)
  - Test Enter, Tab, Escape
  - Test Ctrl+C, Ctrl+V, Ctrl+A
  - Test function keys (F1-F12)
  - **Expected**: All special keys work as expected

- [ ] **Task 3.5**: Copy-paste test
  - Copy text from outside terminal
  - Paste into terminal with Cmd+V (macOS) / Ctrl+V (Windows/Linux)
  - Verify pasted text appears exactly once
  - **Expected**: Paste works without duplication

- [ ] **Task 3.6**: Command execution test
  - Type and execute: `echo "test"`
  - Type and execute: `ls -la`
  - Type and execute: `npm --version`
  - Verify commands execute correctly
  - **Expected**: Commands work normally

### Phase 4: Edge Cases and Regression Testing

- [ ] **Task 4.1**: Test multi-line input
  - Type commands with line continuation (\\)
  - Test heredoc input
  - **Expected**: Multi-line input works correctly

- [ ] **Task 4.2**: Test terminal echo modes
  - Test in shells with different echo settings
  - Test password input (no echo)
  - **Expected**: Respects shell echo settings

- [ ] **Task 4.3**: Test with different shells
  - bash
  - zsh
  - fish
  - **Expected**: Works consistently across all shells

- [ ] **Task 4.4**: Test Alt+Click functionality
  - Verify Alt+Click still works after input handler change
  - Test cursor positioning with Alt+Click
  - **Expected**: Alt+Click unaffected by input handler change

### Phase 5: Performance and Monitoring

- [ ] **Task 5.1**: Performance comparison
  - Measure input latency before and after change
  - Compare CPU usage during typing
  - **Expected**: Similar or improved performance

- [ ] **Task 5.2**: Add debugging logs
  - Add detailed logging for input event flow
  - Log event type (keyboard vs programmatic)
  - **Expected**: Clear debugging information available

### Phase 6: Documentation and Cleanup

- [ ] **Task 6.1**: Update code comments
  - Document why `onKey` is used instead of `onData`
  - Explain the duplicate input issue that was fixed
  - **Validation**: Code comments are clear and accurate

- [ ] **Task 6.2**: Update CHANGELOG.md
  - Add fix entry for duplicate input issue
  - Reference OpenSpec change ID
  - **Validation**: CHANGELOG updated with fix details

- [ ] **Task 6.3**: Update test documentation
  - Document test procedures for input handling
  - Add regression test instructions
  - **Validation**: Testing procedures documented

## Success Criteria

- ✅ No duplicate characters when typing
- ✅ All keyboard input types work correctly
- ✅ IME composition functions properly
- ✅ Copy-paste operations work
- ✅ Special keys and shortcuts work
- ✅ No performance regression
- ✅ All shells supported
- ✅ Alt+Click functionality preserved

## Estimated Effort

- **Development**: 2-3 hours
- **Testing**: 3-4 hours
- **Documentation**: 1 hour
- **Total**: 6-8 hours

## Dependencies

None - this is an isolated change to InputManager

## Risk Assessment

**Low Risk** - Change is minimal and well-isolated. Extensive testing will validate correctness before release.
