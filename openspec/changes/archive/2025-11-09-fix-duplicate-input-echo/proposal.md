# Proposal: Fix Duplicate Input Echo

## Why

Users experience duplicate character input when typing in the terminal. For example, typing "a" results in "aa" being displayed.

**Root Cause**: In `src/webview/managers/InputManager.ts` (line 933-950), the `terminal.onData()` event handler captures both user keyboard input and PTY echo output sent from extension via `terminal.write()`. This creates a feedback loop:

1. User types "a"
2. `onData` fires → sends "a" to extension
3. Extension writes "a" to PTY
4. PTY echoes "a" back
5. Extension sends echo to WebView via `terminal.write()`
6. `onData` fires again → sends "a" to extension again (duplicate!)
7. Result: "aa" displayed

This issue affects all user input including typing, paste operations, and IME composition.

## What Changes

Replace `terminal.onData()` with `terminal.onKey()` to capture only user keyboard input, excluding programmatic writes and PTY echo output.

### Changes Required

**File**: `src/webview/managers/InputManager.ts`

**Current code** (line 933-950):
```typescript
// CRITICAL: Set up keyboard input handling with IME awareness
terminal.onData((data: string) => {
  // VS Code standard: Check IME composition state before processing
  if (this.imeHandler.isIMEComposing()) {
    this.logger(`Terminal ${terminalId} data during IME composition - allowing xterm.js to handle`);
    // Let xterm.js handle IME composition internally
    // But still send to extension for proper processing
  } else {
    this.logger(`Terminal ${terminalId} normal data: ${data.length} chars`);
  }

  // Always send data to extension (VS Code standard behavior)
  manager.postMessageToExtension({
    command: 'input',
    terminalId: terminalId,
    data: data,
    timestamp: Date.now(),
  });
});
```

**Proposed code**:
```typescript
// CRITICAL: Set up keyboard input handling with IME awareness
// Use onKey instead of onData to avoid capturing PTY echo output
terminal.onKey((event: { key: string; domEvent: KeyboardEvent }) => {
  // VS Code standard: Check IME composition state before processing
  if (this.imeHandler.isIMEComposing()) {
    this.logger(`Terminal ${terminalId} key during IME composition - allowing xterm.js to handle`);
    // Let xterm.js handle IME composition internally
    return; // Don't send to extension during IME composition
  }

  // Send only user keyboard input to extension (not PTY echo)
  this.logger(`Terminal ${terminalId} user input: ${event.key.length} chars`);

  manager.postMessageToExtension({
    command: 'input',
    terminalId: terminalId,
    data: event.key,
    timestamp: Date.now(),
  });
});
```

## Benefits

1. **Eliminates duplicate input**: Only user keyboard events are sent to extension
2. **Preserves echo handling**: PTY echo comes back via `terminal.write()` but doesn't trigger input event
3. **Maintains IME support**: IME composition handling remains intact
4. **VS Code standard pattern**: Aligns with VS Code's standard terminal implementation

## Testing Requirements

1. **Manual typing test**: Type individual characters and verify no duplication
2. **Rapid typing test**: Type quickly and verify all characters appear correctly once
3. **IME composition test**: Test Japanese/Chinese input with IME
4. **Copy-paste test**: Verify paste operations work correctly
5. **Special keys test**: Test arrow keys, Enter, Tab, Ctrl+C, etc.

## Risks and Mitigation

**Risk**: `onKey` might not capture all input types (paste, special sequences)

**Mitigation**: Test thoroughly with paste operations and special key combinations. If needed, combine `onKey` for keyboard input with separate paste handler.

**Risk**: Breaking existing functionality that relies on `onData`

**Mitigation**: Review all usages of terminal input in codebase. The change is isolated to user input handling in InputManager.

## Implementation Notes

- Change is minimal and localized to `InputManager.ts`
- No changes required to extension backend or PTY handling
- Terminal output display continues to work via `terminal.write()` from extension
- WebView → Extension messaging protocol remains unchanged

## References

- xterm.js `onKey` API: https://xtermjs.org/docs/api/terminal/classes/terminal/#onkey
- xterm.js `onData` API: https://xtermjs.org/docs/api/terminal/classes/terminal/#ondata
- VS Code terminal implementation pattern
