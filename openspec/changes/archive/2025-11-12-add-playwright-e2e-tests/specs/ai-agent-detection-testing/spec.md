# Spec: AI Agent Detection Testing

## ADDED Requirements

### Requirement: Claude Code Detection Testing
**Priority**: P0
**Status**: Proposed

E2E tests SHALL validate detection and visual feedback for Claude Code CLI agent.

#### Scenario: Detect Claude Code startup
**Given** a terminal is active
**When** the terminal output contains "Claude Code" startup message
**Then** the terminal SHALL be marked as having Claude Code agent
**And** the status indicator SHALL change to "Claude Code Connected"
**And** the indicator SHALL use blue/purple theme color
**And** the detection SHALL complete within 500ms of output

#### Scenario: Detect Claude Code activity
**Given** Claude Code is detected as connected
**When** the terminal shows Claude Code actively processing (tool use)
**Then** the status indicator SHALL update to "Claude Code Active"
**And** the indicator color SHALL change to active state
**And** the terminal output buffer SHALL use 4ms flush interval (250fps)

#### Scenario: Detect Claude Code disconnection
**Given** Claude Code is active in a terminal
**When** Claude Code exits or shows completion message
**Then** the status indicator SHALL update to "Claude Code Disconnected"
**And** the indicator SHALL show inactive state
**And** the terminal SHALL revert to normal 16ms flush interval

---

### Requirement: GitHub Copilot Detection Testing
**Priority**: P0
**Status**: Proposed

E2E tests SHALL validate detection and visual feedback for GitHub Copilot CLI.

#### Scenario: Detect GitHub Copilot startup
**Given** a terminal is active
**When** the output matches /(^|\s)github copilot(\s|$)/i pattern
**Then** the terminal SHALL be marked as having GitHub Copilot agent
**And** the status indicator SHALL show "GitHub Copilot Connected"
**And** the indicator SHALL use Copilot brand colors

#### Scenario: Detect multiple Copilot variants
**Given** a terminal is active
**When** the output contains "copilot" or "gh copilot"
**Then** both variants SHALL be detected correctly
**And** the same visual feedback SHALL apply
**And** no false positives SHALL occur for unrelated text containing "copilot"

#### Scenario: Visual indicator for Copilot activity
**Given** GitHub Copilot is connected
**When** the terminal shows Copilot processing commands
**Then** the status indicator SHALL pulse or animate to show activity
**And** the animation SHALL be smooth (60fps minimum)
**And** the animation SHALL not cause performance issues

---

### Requirement: Multi-Agent Detection Testing
**Priority**: P1
**Status**: Proposed

E2E tests SHALL validate detection of multiple AI agents (Gemini, Codex, CodeRabbit).

#### Scenario: Detect Gemini CLI
**Given** a terminal is active
**When** the output contains Gemini ASCII art or "gemini code"
**Then** the terminal SHALL be marked as having Gemini agent
**And** the status indicator SHALL show "Gemini CLI Active"
**And** Gemini-specific branding SHALL be used

#### Scenario: Detect Codex CLI
**Given** a terminal is active
**When** the output matches Codex CLI startup pattern
**Then** the terminal SHALL detect Codex agent
**And** the status indicator SHALL show "Codex CLI Connected"

#### Scenario: Detect CodeRabbit CLI slash commands
**Given** a terminal is active
**When** the output contains "/coderabbit" commands
**Then** the terminal SHALL detect CodeRabbit integration
**And** the status indicator SHALL show CodeRabbit status

#### Scenario: Detect multiple agents in different terminals
**Given** terminal 1 has Claude Code, terminal 2 has GitHub Copilot
**When** both agents are active simultaneously
**Then** each terminal SHALL show the correct agent status
**And** status indicators SHALL not interfere with each other
**And** each terminal SHALL have independent agent detection

---

### Requirement: Agent Status Transitions Testing
**Priority**: P1
**Status**: Proposed

E2E tests SHALL validate agent status lifecycle transitions (Connected → Active → Disconnected).

#### Scenario: Agent status transition sequence
**Given** a terminal with no detected agent
**When** an agent starts and shows startup message
**Then** status SHALL transition: None → Connected
**When** the agent begins processing commands
**Then** status SHALL transition: Connected → Active
**When** the agent completes and exits
**Then** status SHALL transition: Active → Disconnected

#### Scenario: Handle rapid status changes
**Given** an agent is active in a terminal
**When** multiple status transitions occur within 1 second
**Then** all transitions SHALL be processed correctly
**And** the final status SHALL be accurate
**And** no intermediate states SHALL be skipped
**And** visual indicators SHALL update smoothly

#### Scenario: Persist agent status across terminal focus changes
**Given** terminal 1 has active Claude Code, terminal 2 has Copilot
**When** the user switches between terminals
**Then** each terminal SHALL maintain its agent status
**And** status indicators SHALL not reset or change
**And** switching focus SHALL not affect detection

---

### Requirement: Visual Feedback Testing
**Priority**: P1
**Status**: Proposed

E2E tests SHALL validate visual indicators and UI feedback for AI agent detection.

#### Scenario: Status indicator visual appearance
**Given** an AI agent is detected
**When** the status indicator is displayed
**Then** the indicator SHALL be clearly visible in the terminal header
**And** the indicator SHALL use agent-specific colors/icons
**And** the indicator SHALL not obscure terminal content
**And** visual appearance SHALL match design specifications (screenshot comparison)

#### Scenario: Theme compatibility for status indicators
**Given** an AI agent is active
**When** the VS Code theme is changed (light/dark/high contrast)
**Then** status indicators SHALL adjust colors for readability
**And** indicators SHALL remain visible in all themes
**And** contrast ratios SHALL meet accessibility standards (WCAG AA)

#### Scenario: Tooltip and hover information
**Given** an AI agent status indicator is visible
**When** the user hovers over the indicator
**Then** a tooltip SHALL show agent details (name, status, uptime)
**And** the tooltip SHALL update in real-time
**And** the tooltip SHALL not block terminal interaction

---

### Requirement: Agent Detection Security Testing
**Priority**: P0
**Status**: Proposed

E2E tests SHALL validate that agent detection patterns are secure and prevent false positives.

#### Scenario: Prevent substring injection false positives
**Given** a terminal receives arbitrary output
**When** the output contains text like "my github copilot implementation"
**Then** detection SHALL use regex with word boundaries /(^|\s)github copilot(\s|$)/i
**And** no false positive detection SHALL occur
**And** only actual agent instances SHALL be detected

#### Scenario: Handle malicious output safely
**Given** a terminal receives potentially malicious output
**When** the output contains XSS attempts or escape sequences
**Then** agent detection SHALL sanitize input properly
**And** no code execution SHALL occur from detection patterns
**And** the terminal SHALL remain secure and stable

#### Scenario: Validate detection pattern security
**Given** agent detection patterns are implemented
**When** security scanning tools analyze the code
**Then** no CodeQL warnings SHALL be raised about includes() usage
**And** all patterns SHALL use regex with proper boundaries
**And** detection code SHALL pass security review

---

### Requirement: Performance Testing for Agent Detection
**Priority**: P2
**Status**: Proposed

E2E tests SHALL validate that agent detection does not degrade terminal performance.

#### Scenario: High-frequency output with agent active
**Given** an AI agent is active and producing rapid output
**When** the terminal receives 1000 lines in 1 second
**Then** agent detection SHALL keep up without lag
**And** output rendering SHALL maintain 250fps (4ms interval)
**And** CPU usage SHALL remain under 30%
**And** memory SHALL not increase beyond expected scrollback limits

#### Scenario: Debouncing for agent detection
**Given** terminal output is rapidly changing
**When** agent detection patterns are evaluated
**Then** detection SHALL be debounced to reduce overhead
**And** debouncing SHALL not cause detection delays >500ms
**And** rapid status changes SHALL be handled efficiently

---

## Cross-References

**Related Requirements**:
- REQ-WEBVIEW-INTERACT-001 (visual rendering testing)
- REQ-E2E-INFRA-005 (visual testing utilities)

**Depends On**:
- AI Agent Detection System: Strategy pattern with regex patterns
- PerformanceManager: Dynamic buffer intervals (16ms normal, 4ms AI active)
- Security: Regex word boundaries instead of includes() for sanitization

**Related Changes**:
- None (new testing capability)

**Related Code**:
- Agent detection patterns must follow security guidelines in CLAUDE.md
- Visual indicators in terminal header WebView components
