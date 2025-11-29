## ADDED Requirements
### Requirement: Register WebView Terminals for Persistence
Sidebar terminals MUST register with the optimized persistence manager immediately after creation so serialized scrollback can be saved and restored.

#### Scenario: Terminal creation registers for persistence
- **GIVEN** a sidebar terminal instance has finished initializing in the WebView
- **WHEN** the terminal becomes ready to accept addons
- **THEN** the serialize addon is loaded for that terminal within 1 second
- **AND** the terminal is registered with `OptimizedTerminalPersistenceManager`
- **AND** registration failures are surfaced to the extension as errors.

### Requirement: Restore Scrollback After Window Reload
Persistent sessions MUST replay previously saved scrollback into the matching sidebar terminals after a VS Code window reload.

#### Scenario: Serialized content restores after reload
- **GIVEN** persistent sessions are enabled and scrollback data exists for one or more terminals
- **WHEN** the user reloads the VS Code window and the extension requests `restoreTerminalSerialization`
- **THEN** the WebView replays the serialized content into each matching terminal within 5 seconds of creation
- **AND** the extension receives a success response indicating how many terminals restored content.

#### Scenario: Fallback scrollback applies when serialization fails
- **GIVEN** serialized content for a terminal is unavailable or invalid but fallback scrollback lines are provided
- **WHEN** the extension requests restoration with fallback data
- **THEN** the WebView writes the fallback lines to the target terminal in the original order
- **AND** the extension receives a response that the terminal was restored via fallback.
