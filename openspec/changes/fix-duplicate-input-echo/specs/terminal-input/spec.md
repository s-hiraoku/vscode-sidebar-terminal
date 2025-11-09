# Spec: Terminal Input Handling

## MODIFIED Requirements

### Requirement: WebView terminal input event handling

The InputManager MUST capture only user keyboard input events using xterm.js's `onKey()` handler, excluding PTY echo output and programmatic terminal writes, to prevent duplicate character input.

**Context**: The WebView's InputManager captures user keyboard input and sends it to the extension. The current implementation uses xterm.js's `onData` event, which captures both user input and programmatic writes, causing duplicate character input.

**Change**: Replace `terminal.onData()` event handler with `terminal.onKey()` to capture only user keyboard input, excluding PTY echo output and programmatic terminal writes.

**Affected Component**: `src/webview/managers/InputManager.ts`, method `addXtermClickHandler()`, lines 933-950

#### Scenario: User types single character

**Given** a terminal is focused and ready for input
**When** the user types the character "a"
**Then** the character "a" should appear exactly once in the terminal
**And** the input should be sent to the extension exactly once
**And** no duplicate characters should appear

#### Scenario: User types multiple characters rapidly

**Given** a terminal is focused and ready for input
**When** the user types "hello world" rapidly
**Then** the exact string "hello world" should appear once
**And** no characters should be duplicated
**And** no characters should be dropped

#### Scenario: PTY echo output is received

**Given** a terminal is focused and has sent user input to extension
**When** the extension sends PTY echo output via `terminal.write()`
**Then** the echo output should display in terminal
**But** the echo output should NOT trigger the input event handler
**And** the echo output should NOT be sent back to extension

#### Scenario: User performs IME composition (Japanese)

**Given** a terminal is focused with IME enabled
**When** the user types "nihongo" and converts to "日本語"
**Then** IME composition should complete successfully
**And** the final composed text "日本語" should be sent to extension
**But** intermediate composition states should not be sent multiple times

#### Scenario: User pastes text into terminal

**Given** a terminal is focused
**And** the user has copied text "paste test"
**When** the user presses Cmd+V (macOS) or Ctrl+V (Windows/Linux)
**Then** the text "paste test" should appear exactly once
**And** no duplicate characters should appear

#### Scenario: User presses special keys

**Given** a terminal is focused
**When** the user presses arrow keys (Up/Down/Left/Right)
**Then** each key press should be sent to extension exactly once
**And** terminal should respond appropriately (cursor movement, command history, etc.)

#### Scenario: User executes commands

**Given** a terminal is focused with shell prompt ready
**When** the user types "echo test" and presses Enter
**Then** the command should execute correctly
**And** the output "test" should appear
**And** no input duplication should occur

## ADDED Requirements

### Requirement: Input event type discrimination

The InputManager MUST use xterm.js `onKey` event to distinguish user keyboard input from programmatic terminal writes, capturing only keyboard events that provide `{ key: string; domEvent: KeyboardEvent }` structure.

**Context**: The fix requires distinguishing between user keyboard input and programmatic terminal writes to prevent duplicate input.

**Implementation**: Use xterm.js `onKey` event which provides `{ key: string; domEvent: KeyboardEvent }` structure, capturing only user keyboard events.

#### Scenario: Keyboard event structure validation

**Given** InputManager is setting up terminal input handlers
**When** a terminal is created
**Then** the `onKey` event handler should be registered
**And** the event should provide `key` (string) and `domEvent` (KeyboardEvent)
**And** only keyboard events should trigger the handler

### Requirement: IME composition handling with onKey

The InputManager MUST check IME composition state before processing keyboard events and return early during composition to allow xterm.js to handle IME input internally.

**Context**: IME composition must work correctly with the new `onKey` event handler.

**Implementation**: Check IME composition state before processing keyboard events and return early during composition.

#### Scenario: IME composition with onKey event

**Given** IME composition is active
**When** the user types keys during composition
**Then** the InputManager should detect composition state
**And** should return early without sending to extension
**And** should let xterm.js handle composition internally
**And** should send final composed text after composition completes

## REMOVED Requirements

None - This change modifies existing behavior, does not remove functionality.

## Implementation Notes

### Code Changes

**File**: `src/webview/managers/InputManager.ts`

**Method**: `addXtermClickHandler(terminal, terminalId, container, manager)`

**Current implementation** (lines 933-950):
```typescript
terminal.onData((data: string) => {
  if (this.imeHandler.isIMEComposing()) {
    this.logger(`Terminal ${terminalId} data during IME composition - allowing xterm.js to handle`);
  } else {
    this.logger(`Terminal ${terminalId} normal data: ${data.length} chars`);
  }

  manager.postMessageToExtension({
    command: 'input',
    terminalId: terminalId,
    data: data,
    timestamp: Date.now(),
  });
});
```

**New implementation**:
```typescript
terminal.onKey((event: { key: string; domEvent: KeyboardEvent }) => {
  if (this.imeHandler.isIMEComposing()) {
    this.logger(`Terminal ${terminalId} key during IME composition - allowing xterm.js to handle`);
    return; // Don't send during IME composition
  }

  this.logger(`Terminal ${terminalId} user input: ${event.key.length} chars`);

  manager.postMessageToExtension({
    command: 'input',
    terminalId: terminalId,
    data: event.key,
    timestamp: Date.now(),
  });
});
```

### Technical Details

**Why onKey instead of onData**:
- `onData` fires for both user input AND programmatic `terminal.write()` calls
- `onKey` fires ONLY for user keyboard events
- This prevents PTY echo output from being re-sent to extension

**Event structure**:
- `onKey` provides: `{ key: string; domEvent: KeyboardEvent }`
- `key` contains the processed character(s) to send
- `domEvent` provides access to original keyboard event if needed

**IME handling**:
- Check composition state before processing key events
- Return early during composition to let xterm.js handle it
- Final composed text will be sent when composition completes

### Testing Strategy

1. **Manual typing**: Verify no duplicates for individual characters
2. **Rapid typing**: Verify no duplicates or drops for fast typing
3. **IME composition**: Test Japanese, Chinese, Korean input
4. **Paste operations**: Verify paste works correctly
5. **Special keys**: Test arrows, Enter, Tab, function keys
6. **Cross-shell**: Test bash, zsh, fish
7. **Cross-platform**: Test macOS, Windows, Linux

### Rollback Plan

If issues arise, revert to `onData` implementation:
1. Replace `onKey` with `onData`
2. Restore previous event handler structure
3. Deploy hotfix version

### Performance Impact

**Expected**: Neutral or slight improvement
- `onKey` is more targeted than `onData`
- Fewer event firings (no programmatic writes)
- Same input latency for user typing

### Security Considerations

No security impact - this change only affects how user input is captured, not how it's processed or transmitted.
