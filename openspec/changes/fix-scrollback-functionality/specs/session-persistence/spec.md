# Session Persistence - Scrollback Fix Delta

## MODIFIED Requirements

### Requirement: Scrollback Restoration

The system SHALL restore terminal scrollback history when sessions are restored.

When the Extension sends `restoreTerminalSessions` command with scrollback data, the WebView SHALL:
1. Register and handle the `restoreTerminalSessions` command
2. Restore scrollback content to each terminal specified
3. Preserve ANSI color codes from the saved scrollback
4. Support batch restoration for multiple terminals

#### Scenario: Session restoration with scrollback
- **GIVEN** a saved session with terminal scrollback data
- **WHEN** the Extension sends `restoreTerminalSessions` command
- **THEN** WebView SHALL restore scrollback to each terminal
- **AND** ANSI color codes SHALL be preserved
- **AND** restoration SHALL complete in <3 seconds for 1000 lines

#### Scenario: Missing handler fallback
- **GIVEN** a `restoreTerminalSessions` command is received
- **WHEN** the handler processes the message
- **THEN** it SHALL delegate to `restoreScrollback` for each terminal
- **AND** log appropriate success/error messages

### Requirement: Scrollback Extraction with Color Preservation

The system SHALL preserve ANSI color codes when extracting terminal scrollback.

When extracting scrollback data, the system SHALL:
1. Use SerializeAddon when available for ANSI color preservation
2. Fall back to buffer method when SerializeAddon unavailable
3. Log which extraction method was used
4. Return scrollback as array of strings

#### Scenario: Extract with SerializeAddon
- **GIVEN** a terminal with SerializeAddon loaded
- **WHEN** scrollback is extracted
- **THEN** SerializeAddon.serialize() SHALL be used
- **AND** ANSI escape codes SHALL be preserved in output

#### Scenario: Extract without SerializeAddon
- **GIVEN** a terminal without SerializeAddon
- **WHEN** scrollback is extracted
- **THEN** buffer.getLine().translateToString() SHALL be used
- **AND** a warning SHALL be logged about color loss

### Requirement: Consolidated Extraction Code Path

The system SHALL use a single consolidated code path for scrollback extraction.

`LightweightTerminalWebviewManager.extractScrollbackData()` SHALL delegate to the same extraction logic used by `ScrollbackMessageHandler`.

#### Scenario: Consistent extraction behavior
- **GIVEN** scrollback extraction is requested
- **WHEN** extraction is performed via any entry point
- **THEN** the same SerializeAddon-aware logic SHALL be used
- **AND** results SHALL be consistent regardless of call path
