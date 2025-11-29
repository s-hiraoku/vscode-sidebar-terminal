# Terminal Input Capability

## ADDED Requirements

### Requirement: VS Code-Compatible IME Composition Handling
The system SHALL handle IME composition events using patterns from VS Code's terminal implementation.

#### Scenario: Japanese IME composition
- **WHEN** user types Japanese characters using IME
- **THEN** the system SHALL track composition state with compositionstart event
- **AND** the system SHALL update composition text with compositionupdate events
- **AND** the system SHALL commit text only on compositionend event
- **AND** the system SHALL prevent duplicate character insertion during composition

#### Scenario: Chinese pinyin input
- **WHEN** user enters Chinese characters via pinyin IME
- **THEN** the system SHALL display composition candidates without committing
- **AND** the system SHALL preserve cursor position during composition
- **AND** the system SHALL handle composition cancellation (ESC key)

#### Scenario: Composition state tracking
- **WHEN** IME composition is active
- **THEN** the system SHALL set isComposing flag to true
- **AND** the system SHALL disable normal keyboard event processing
- **AND** the system SHALL restore normal processing on compositionend
- **AND** the implementation SHALL match VS Code's composition handling patterns

### Requirement: Standard Keyboard Shortcut Handling
The system SHALL implement keyboard shortcuts matching VS Code terminal behavior.

#### Scenario: Copy with Ctrl+C (or Cmd+C on macOS)
- **WHEN** user presses Ctrl+C with text selected
- **THEN** the system SHALL copy selected text to clipboard
- **AND** the system SHALL not send SIGINT to the shell process
- **WHEN** user presses Ctrl+C without selection
- **THEN** the system SHALL send SIGINT (^C) to the shell process

#### Scenario: Paste with Ctrl+V (or Cmd+V on macOS)
- **WHEN** user presses Ctrl+V
- **THEN** the system SHALL paste clipboard content into terminal
- **AND** the system SHALL handle bracketed paste mode if enabled
- **AND** multi-line paste SHALL show confirmation prompt

#### Scenario: Alternative keyboard shortcuts
- **WHEN** user presses Ctrl+Insert
- **THEN** the system SHALL copy selected text (Windows pattern)
- **WHEN** user presses Shift+Insert
- **THEN** the system SHALL paste clipboard content (Windows/Linux pattern)
- **AND** shortcuts SHALL match VS Code's keyboard event handling

### Requirement: Multi-line Paste Handling
The system SHALL handle complex paste scenarios matching VS Code's paste behavior.

#### Scenario: Multi-line text paste
- **WHEN** user pastes text containing 3 or more lines
- **THEN** the system SHALL display a confirmation prompt
- **AND** the prompt SHALL show "Paste 15 lines into terminal?"
- **AND** the user SHALL be able to approve or cancel the paste

#### Scenario: Bracketed paste mode
- **WHEN** terminal supports bracketed paste mode
- **THEN** the system SHALL wrap pasted content with \e[200~ and \e[201~ sequences
- **AND** the shell SHALL receive paste as atomic unit
- **AND** special characters SHALL not be interpreted during paste

#### Scenario: Quote and special character handling
- **WHEN** pasted text contains quotes or newlines
- **THEN** the system SHALL escape characters according to shell type
- **AND** bash/zsh SHALL use backslash escaping
- **AND** PowerShell SHALL use backtick escaping
- **AND** the implementation SHALL match VS Code's paste escaping logic

### Requirement: Alt+Click Link Handling
The system SHALL detect and open file paths and URLs using VS Code's link handler patterns.

#### Scenario: File path detection with Alt+Click
- **WHEN** terminal output contains "src/app.ts:42:7"
- **AND** user Alt+Click on the path
- **THEN** the system SHALL open src/app.ts in editor
- **AND** the cursor SHALL be placed at line 42, column 7

#### Scenario: URL link handling
- **WHEN** terminal output contains "http://localhost:3000"
- **AND** user Alt+Click on the URL
- **THEN** the system SHALL open the URL in external browser
- **AND** the system SHALL handle HTTPS and custom protocols

#### Scenario: Link detection pattern matching
- **WHEN** detecting clickable links
- **THEN** the system SHALL use regex patterns matching VS Code's linkifier
- **AND** file paths SHALL support relative and absolute paths
- **AND** line/column numbers SHALL be optional (":line:col" format)
- **AND** URLs SHALL support HTTP, HTTPS, FTP protocols

### Requirement: Keyboard Event Processing
The system SHALL process keyboard events using VS Code's terminal input handler patterns.

#### Scenario: Special key handling
- **WHEN** user presses Arrow keys (Up/Down/Left/Right)
- **THEN** the system SHALL send appropriate ANSI escape sequences
- **WHEN** user presses Home/End keys
- **THEN** the system SHALL send cursor positioning sequences
- **WHEN** user presses Function keys (F1-F12)
- **THEN** the system SHALL send appropriate escape sequences for the terminal type

#### Scenario: Modifier key combinations
- **WHEN** user presses Ctrl+Arrow
- **THEN** the system SHALL send word-jump sequences
- **WHEN** user presses Shift+Arrow with selection
- **THEN** the system SHALL extend text selection
- **AND** modifier handling SHALL match VS Code's key binding resolver

### Requirement: VS Code Pattern Conformance
The system SHALL implement input handling using patterns from VS Code's TerminalInputHandler.

#### Scenario: vscode-terminal-resolver pattern application
- **WHEN** implementing IME/keyboard/paste handlers
- **THEN** the implementation SHALL reference microsoft/vscode/src/vs/workbench/contrib/terminal/browser/terminalInputHandler.ts
- **AND** the implementation SHALL document VS Code version used (e.g., v1.85.0)
- **AND** the implementation SHALL adapt patterns to InputManager architecture

#### Scenario: Event handler structure
- **WHEN** processing terminal input
- **THEN** the system SHALL separate composition, keyboard, and paste handlers
- **AND** each handler SHALL match VS Code's handler method signatures
- **AND** error handling SHALL follow VS Code's graceful degradation patterns
