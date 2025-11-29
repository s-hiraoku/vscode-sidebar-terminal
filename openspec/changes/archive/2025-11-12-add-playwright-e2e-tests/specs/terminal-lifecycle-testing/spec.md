# Spec: Terminal Lifecycle Testing

## ADDED Requirements

### Requirement: Terminal Creation Testing
**Priority**: P0
**Status**: Proposed

E2E tests SHALL validate terminal creation workflows from the user's perspective.

#### Scenario: Create single terminal via UI
**Given** the extension is activated and WebView is visible
**When** the user clicks the "New Terminal" button
**Then** a new terminal SHALL be created with ID 1
**And** the terminal SHALL appear in the terminal list
**And** the terminal SHALL be focused and ready for input
**And** the terminal prompt SHALL be visible within 2 seconds

#### Scenario: Create multiple terminals up to limit
**Given** no terminals currently exist
**When** the user creates 5 terminals (max limit)
**Then** terminals with IDs 1-5 SHALL exist
**And** each terminal SHALL have a unique tab/button
**And** clicking each tab SHALL switch focus correctly
**And** attempting to create a 6th terminal SHALL show a notification about the limit

#### Scenario: Terminal ID recycling
**Given** terminals 1, 2, 3 exist
**When** terminal 2 is deleted
**And** a new terminal is created
**Then** the new terminal SHALL reuse ID 2
**And** the terminal order SHALL be maintained (1, 2, 3)

---

### Requirement: Terminal Deletion Testing
**Priority**: P0
**Status**: Proposed

E2E tests SHALL validate terminal deletion workflows and cleanup behavior.

#### Scenario: Delete active terminal via trash icon
**Given** terminals 1, 2, 3 exist with terminal 2 active
**When** the user clicks the trash icon for terminal 2
**Then** terminal 2 SHALL be removed from the list
**And** terminal 1 or 3 SHALL become active automatically
**And** the PTY process for terminal 2 SHALL be terminated
**And** no zombie processes SHALL remain

#### Scenario: Delete terminal via keyboard shortcut
**Given** terminal 1 is active
**When** the user presses the configured delete shortcut
**Then** terminal 1 SHALL be deleted
**And** the next terminal SHALL become active
**And** confirmation may be shown if configured

#### Scenario: Prevent concurrent deletion race conditions
**Given** terminal 1 exists
**When** multiple delete operations are triggered simultaneously
**Then** only one deletion SHALL succeed
**And** no errors SHALL occur from concurrent deletion attempts
**And** the terminal SHALL be removed exactly once

---

### Requirement: Terminal Session Restoration Testing
**Priority**: P0
**Status**: Proposed

E2E tests SHALL validate terminal session persistence and restoration across VS Code restarts.

#### Scenario: Save terminal session state
**Given** terminals 1, 2 with scrollback content exist
**When** the extension saves session state
**Then** terminal scrollback (up to 1000 lines) SHALL be persisted
**And** active terminal ID SHALL be saved
**And** terminal working directories SHALL be saved
**And** session data SHALL not exceed storage limits (20MB)

#### Scenario: Restore terminal session on startup
**Given** a previous session exists in storage
**When** VS Code is restarted and the extension activates
**Then** terminals SHALL be recreated with original IDs
**And** scrollback content SHALL be restored
**And** the previously active terminal SHALL be focused
**And** working directories SHALL be restored where possible

#### Scenario: Handle corrupted session data gracefully
**Given** session storage contains invalid data
**When** the extension attempts to restore the session
**Then** the extension SHALL NOT crash
**And** a new clean session SHALL be started
**And** an error notification SHALL inform the user
**And** corrupted data SHALL be cleared from storage

---

### Requirement: Terminal Focus and Switching Testing
**Priority**: P1
**Status**: Proposed

E2E tests SHALL validate terminal focus management and tab switching behavior.

#### Scenario: Switch terminals via tab click
**Given** terminals 1, 2, 3 exist with terminal 1 active
**When** the user clicks the tab for terminal 2
**Then** terminal 2 SHALL become active
**And** terminal 1 SHALL lose focus
**And** the active terminal indicator SHALL update
**And** keyboard input SHALL route to terminal 2

#### Scenario: Switch terminals via keyboard shortcut
**Given** terminals 1, 2 exist with terminal 1 active
**When** the user presses the "next terminal" shortcut
**Then** terminal 2 SHALL become active
**And** pressing the shortcut again SHALL cycle back to terminal 1

#### Scenario: Focus terminal via command palette
**Given** multiple terminals exist
**When** the user executes "Focus Terminal X" command
**Then** the specified terminal SHALL become active
**And** the WebView SHALL scroll to show the active terminal
**And** the cursor SHALL be positioned in the terminal input area

---

### Requirement: Terminal Process Lifecycle Testing
**Priority**: P1
**Status**: Proposed

E2E tests SHALL validate PTY process lifecycle and state transitions.

#### Scenario: PTY process spawns successfully
**Given** the user creates a new terminal
**When** the PTY process is spawned
**Then** the process SHALL enter ProcessState.LaunchedWithGracefulPeriod
**And** the shell prompt SHALL appear within 2 seconds
**And** the process SHALL transition to ProcessState.Running
**And** the terminal SHALL accept input

#### Scenario: Handle PTY spawn failure gracefully
**Given** the configured shell is invalid or missing
**When** a terminal creation is attempted
**Then** the PTY spawn SHALL fail
**And** an error notification SHALL inform the user
**And** a fallback shell SHALL be attempted if configured
**And** no terminal SHALL be created if all attempts fail

#### Scenario: Handle terminal process crash
**Given** a running terminal with PTY process
**When** the PTY process crashes unexpectedly
**Then** the terminal SHALL show a crash notification
**And** the terminal SHALL offer to restart the process
**And** session data SHALL be preserved if possible
**And** the crash SHALL be logged for debugging

---

## Cross-References

**Related Requirements**:
- REQ-E2E-INFRA-003 (terminal creation helpers)
- REQ-WEBVIEW-INTERACT-001 (WebView interaction testing)

**Depends On**:
- VS Code Extension API: `commands.executeCommand('secondaryTerminal.splitTerminal')`
- TerminalManager: ID recycling system (IDs 1-5)
- SessionManager: Session persistence with 1000 line scrollback limit

**Related Changes**:
- None (new testing capability)
