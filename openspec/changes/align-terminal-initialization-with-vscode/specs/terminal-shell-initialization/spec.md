# Spec Delta: Terminal Shell Initialization (VS Code Parity)

## MODIFIED Requirements

### Requirement: Canonical initialization state machine
Extension and WebView MUST follow a shared state machine that mirrors VS Code’s terminal pipeline.

#### Scenario: Ordered state transitions
- **Given** a terminal creation request is issued
- **Then** the per-terminal state MUST progress in order:
  1. `Idle`
  2. `ViewReady` (WebView acknowledges readiness)
  3. `PtySpawned`
  4. `ShellInitialized`
  5. `PromptReady`
- **And** transitions MUST be logged with timestamps
- **And** regression to an earlier state MUST be prevented.

#### Scenario: Buffered PTY output
- **Given** PTY output occurs before the WebView reaches `ViewReady`
- **Then** Extension MUST buffer data (like VS Code’s `AutoOpenBarrier`)
- **And** buffered data MUST flush only after WebView sends `terminalReadyAck`
- **And** no prompt text may appear before the ack.

### Requirement: Reliable message handshake
All control messages between WebView and Extension MUST provide ACK/Retry semantics.

#### Scenario: WebView → Extension acknowledgement
- **Given** WebView finishes xterm + DOM setup
- **When** it sends `terminalInitializationComplete`
- **Then** Extension MUST respond with `startPtyOutput` (explicit ack)
- **And** WebView MUST retry sending up to 3 times if ack is not received within 200 ms, doubling the wait each retry.

#### Scenario: Extension → WebView start signal
- **Given** Extension has buffered PTY data and WebView reached `ViewReady`
- **When** shell initialization succeeds
- **Then** Extension MUST send `startOutput` (or equivalent) instructing WebView to drain the buffer
- **And** WebView MUST confirm receipt (single ack log) before writing to xterm.

### Requirement: Prompt readiness guarantee
Each newly created terminal MUST display a usable prompt within 1 second or surface an actionable error.

#### Scenario: Prompt within SLA
- **Given** standard shells (bash, zsh, fish)
- **When** a terminal is created
- **Then** shell prompt text MUST become visible within 1 s
- **And** the cursor MUST be focusable and accept user input immediately.

#### Scenario: Safe-mode fallback
- **Given** prompt is not detected within 1 s
- **Then** Extension MUST re-run `initializeShellForTerminal` with `safeMode=true`
- **And** log `⚠️ Prompt timeout -> safe mode`
- **And** if safe mode also fails, Extension MUST notify the user with recovery steps.

### Requirement: Diagnostic visibility
Initialization success/failure MUST be observable for supportability.

#### Scenario: Structured logging
- **Given** any initialization transition or retry occurs
- **Then** logs MUST include:
  - Terminal ID
  - Previous/next state
  - Retry count (if applicable)
  - Elapsed time since creation

#### Scenario: Metrics/telemetry counters
- **Given** initialization succeeds or fails
- **Then** increment counters (`terminal.init.success`, `terminal.init.timeout`)
- **And** expose them via existing telemetry hooks (if enabled).

## ADDED Requirements

### Requirement: Spec-owned contract vs existing changes
- This change supersedes partial fixes in `fix-terminal-initialization-bugs`; future work MUST reference this spec for initialization behavior to avoid duplicate logic.
