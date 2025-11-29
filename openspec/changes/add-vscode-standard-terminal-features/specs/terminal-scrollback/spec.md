# Terminal Scrollback Capability

## ADDED Requirements

### Requirement: Enhanced Scrollback Persistence
The system SHALL persist terminal scrollback with VS Code-compatible capacity and state preservation.

#### Scenario: 1000-line scrollback persistence
- **WHEN** a terminal generates 1500 lines of output
- **THEN** the system SHALL save the most recent 1000 lines to persistent storage
- **AND** the system SHALL preserve ANSI color codes in the saved content
- **AND** the system SHALL restore all 1000 lines when the session is resumed

#### Scenario: Configurable scrollback limit
- **WHEN** user sets `secondaryTerminal.persistence.scrollbackLines` to 2000
- **THEN** the system SHALL persist up to 2000 lines of scrollback
- **AND** the configuration SHALL accept values from 200 to 3000
- **AND** the system SHALL validate and warn if value exceeds storage limits

#### Scenario: Full terminal state preservation
- **WHEN** a terminal session is saved
- **THEN** the system SHALL preserve cursor position
- **AND** the system SHALL preserve text selection ranges
- **AND** the system SHALL preserve all ANSI formatting (colors, bold, italic, underline)
- **AND** the system SHALL preserve the terminal dimensions (rows x columns)

### Requirement: VS Code Serialization Format
The system SHALL use xterm.js serialize addon matching VS Code's serialization approach.

#### Scenario: xterm.js serialize addon usage
- **WHEN** serializing terminal content
- **THEN** the system SHALL use Terminal.serialize() from xterm-addon-serialize
- **AND** the serialized format SHALL be compatible with xterm.js deserialization
- **AND** the system SHALL handle serialization errors gracefully

#### Scenario: Backward compatibility with existing sessions
- **WHEN** restoring a session saved with the old 200-line format
- **THEN** the system SHALL successfully restore the scrollback
- **AND** the system SHALL migrate the session to the new format
- **AND** the system SHALL not lose any existing data during migration

### Requirement: Progressive Scrollback Loading
The system SHALL support progressive loading of large scrollback buffers to optimize startup performance.

#### Scenario: Progressive restoration for large scrollback
- **WHEN** restoring a terminal with 3000 lines of scrollback
- **THEN** the system SHALL initially load the most recent 500 lines
- **AND** the system SHALL display a "Load more history" indicator
- **AND** the system SHALL load additional 500-line chunks on user request
- **AND** the system SHALL complete initial rendering within 1000ms

#### Scenario: Instant restoration for small scrollback
- **WHEN** restoring a terminal with fewer than 500 lines
- **THEN** the system SHALL load all content immediately
- **AND** the system SHALL not display progressive loading UI
- **AND** the system SHALL complete restoration within 500ms

### Requirement: Storage Optimization
The system SHALL optimize storage usage while supporting increased scrollback capacity.

#### Scenario: Compression for large scrollback
- **WHEN** saving terminal scrollback exceeding 1000 lines
- **THEN** the system SHALL apply gzip compression
- **AND** compression SHALL achieve at least 60% size reduction
- **AND** the system SHALL decompress seamlessly on restoration

#### Scenario: Storage limit enforcement
- **WHEN** total scrollback storage exceeds configured maximum (default 10MB)
- **THEN** the system SHALL warn the user
- **AND** the system SHALL suggest reducing scrollback lines or terminal count
- **AND** the system SHALL prevent new sessions until space is freed or limit increased

#### Scenario: Automatic cleanup of old sessions
- **WHEN** a terminal session has not been accessed for 7 days
- **THEN** the system SHALL mark it for cleanup
- **AND** the system SHALL remove sessions older than 30 days automatically
- **AND** the user SHALL be able to configure retention period

### Requirement: VS Code Standard Save Timing
The system SHALL persist terminal scrollback at the same lifecycle points as VS Code's integrated terminal.

#### Scenario: Auto-save on window close/reload
- **WHEN** user closes VS Code window or executes "Reload Window" command
- **THEN** the system SHALL automatically save all terminal sessions
- **AND** the save SHALL complete before window closes
- **AND** the system SHALL use `vscode.workspace.onWillSaveState` event
- **AND** the save SHALL not block the window close operation

#### Scenario: Auto-save on extension deactivation
- **WHEN** the extension is deactivated (VS Code shutdown)
- **THEN** the system SHALL save all terminal sessions
- **AND** the system SHALL clean up event listeners
- **AND** the save SHALL complete within deactivation timeout

#### Scenario: Debounced real-time save
- **WHEN** terminal content changes (output, scrollback modification)
- **THEN** the system SHALL schedule an auto-save
- **AND** the save SHALL be debounced with 30-second delay
- **AND** rapid changes SHALL not trigger multiple saves
- **AND** the debounced save SHALL not impact terminal performance

### Requirement: VS Code Pattern Conformance
The system SHALL implement scrollback persistence using patterns from VS Code's terminal source code.

#### Scenario: vscode-terminal-resolver pattern application
- **WHEN** implementing serialization logic
- **THEN** the system SHALL reference patterns from microsoft/vscode repository
- **AND** the implementation SHALL document the VS Code source file and version used
- **AND** the implementation SHALL adapt patterns to TerminalManager singleton architecture

#### Scenario: Terminal state structure matching VS Code
- **WHEN** serializing terminal state
- **THEN** the state structure SHALL include properties matching VS Code's ISerializedTerminal
- **AND** the system SHALL store shell integration data if available
- **AND** the system SHALL store working directory for restoration
