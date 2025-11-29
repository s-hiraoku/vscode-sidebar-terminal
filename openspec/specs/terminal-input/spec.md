# terminal-input Specification

## Purpose
TBD - created by archiving change fix-duplicate-input-echo. Update Purpose after archive.
## Requirements
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

