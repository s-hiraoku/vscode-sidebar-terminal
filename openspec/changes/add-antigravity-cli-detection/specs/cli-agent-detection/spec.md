## ADDED Requirements

### Requirement: Antigravity CLI Agent Detection

The system SHALL detect Google Antigravity CLI as a supported CLI agent when users launch it from Secondary Terminal.

#### Scenario: Detect Antigravity from submitted command

- **GIVEN** a terminal has no connected CLI agent
- **WHEN** the user submits `agy`
- **THEN** the terminal SHALL be marked as connected to the `antigravity` agent type
- **AND** CLI agent optimizations SHALL apply to that terminal

#### Scenario: Detect Antigravity from wrapped launcher command

- **GIVEN** a terminal has no connected CLI agent
- **WHEN** the user submits a wrapped launcher command that ultimately invokes `agy`
- **THEN** the terminal SHALL be marked as connected to the `antigravity` agent type

#### Scenario: Detect Antigravity from startup output

- **GIVEN** a terminal has no connected CLI agent
- **WHEN** terminal output includes stable Antigravity CLI startup text
- **THEN** the terminal SHALL be marked as connected to the `antigravity` agent type

### Requirement: Antigravity CLI Agent Presentation

The system SHALL present detected Antigravity CLI sessions using the user-facing name "Antigravity".

#### Scenario: Notify Antigravity completion

- **GIVEN** an Antigravity CLI session was connected
- **WHEN** the session terminates
- **THEN** completion notifications SHALL use the display name "Antigravity"
