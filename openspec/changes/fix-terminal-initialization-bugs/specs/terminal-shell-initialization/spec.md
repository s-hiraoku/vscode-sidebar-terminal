# Spec: Terminal Shell Initialization

## Overview
Ensure terminal shell is properly initialized after terminal creation, displaying prompt and accepting user input.

## MODIFIED Requirements

### Requirement: Terminal initialization message delivery
WebView must reliably send terminalInitializationComplete message to Extension after terminal creation completes.

**Context**: TerminalCreationService sends message after 50ms delay, but Extension handler may not receive it due to routing issues.

**Rationale**: Extension needs notification to start shell initialization and PTY output.

#### Scenario: Message sent after terminal creation
**Given** TerminalCreationService.createTerminal() successfully creates a terminal
**When** terminal creation completes (terminal opened in DOM, addons loaded, initial resize done)
**Then** a `terminalInitializationComplete` message must be sent to Extension
**And** message must include terminalId
**And** message must include timestamp
**And** message must be sent after 50ms delay to ensure DOM is fully ready

#### Scenario: Message retry on failure
**Given** terminalInitializationComplete message is sent
**When** no acknowledgment is received within 200ms
**Then** message should be retried up to 3 times
**And** retry delay should increase exponentially (50ms, 100ms, 200ms)
**And** each retry should include attempt number in message payload

#### Scenario: Message logging for debugging
**Given** terminalInitializationComplete message is being sent
**When** postMessageToExtension() is called
**Then** a log entry must be created: "📨 Sending terminalInitializationComplete for {terminalId}"
**And** message content must be logged at debug level
**And** timestamp must be included in log

### Requirement: Message routing to handler
MessageRoutingFacade must correctly route terminalInitializationComplete messages to the registered handler.

**Context**: Handler is registered but may not be called due to routing category mismatch or registration order issues.

**Rationale**: Without proper routing, shell initialization never happens and terminal is unusable.

#### Scenario: Handler registration before message reception
**Given** SecondaryTerminalProvider is being initialized
**When** _initializeMessageHandlers() is called
**Then** _handleTerminalInitializationComplete handler must be registered
**And** handler must be registered for command 'terminalInitializationComplete'
**And** handler must be registered under 'terminal' category
**And** registration must complete before WebView sends any messages

#### Scenario: Message routing to correct handler
**Given** a terminalInitializationComplete message is received from WebView
**When** MessageRoutingFacade.routeMessage() is called
**Then** message command must match exactly: 'terminalInitializationComplete'
**And** message must be routed to 'terminal' category
**And** _handleTerminalInitializationComplete must be invoked
**And** message payload must be passed to handler

#### Scenario: Routing failure handling
**Given** a terminalInitializationComplete message is received
**When** no matching handler is found
**Then** a warning must be logged: "⚠️ No handler for terminalInitializationComplete"
**And** message details must be logged for debugging
**And** fallback initialization mechanism should be triggered

### Requirement: Shell initialization execution
Handler must call initializeShellForTerminal() and startPtyOutput() to enable terminal functionality.

**Context**: Handler implementation exists but may not be executed or may fail silently.

**Rationale**: These calls are required for terminal prompt display and input capability.

#### Scenario: Handler execution with valid terminal
**Given** _handleTerminalInitializationComplete is invoked with valid terminalId
**When** terminal instance is found in TerminalManager
**Then** initializeShellForTerminal() must be called with:
- terminalId
- terminal.ptyProcess
- safeMode = false (for new terminals)
**And** startPtyOutput() must be called with terminalId
**And** both calls must complete successfully
**And** logs must confirm: "🎯 Starting PTY output for {terminalId}"

#### Scenario: Handler execution logging
**Given** _handleTerminalInitializationComplete is executing
**When** each initialization step occurs
**Then** logs must be created:
- "✅ Terminal {terminalId} initialization confirmed by WebView"
- "🔧 Initializing shell for terminal {terminalId}"
- "🎯 Starting PTY output for terminal {terminalId}"
**And** any errors must be logged with ❌ prefix
**And** timing information should be included

#### Scenario: Defensive handling of missing terminal
**Given** _handleTerminalInitializationComplete is invoked
**When** terminal is not found in TerminalManager
**Then** error must be logged: "❌ Terminal {terminalId} not found or PTY not available"
**And** handler must return early without throwing
**And** retry should be scheduled after 100ms
**And** maximum 3 retry attempts

### Requirement: PTY output and prompt display
After shell initialization, terminal must display prompt and be ready for user input.

**Context**: initializeShellForTerminal() sends initial prompt and shell integration codes, startPtyOutput() begins PTY data flow.

**Rationale**: Users expect to see prompt immediately and start typing commands.

#### Scenario: Initial prompt display
**Given** shell initialization completes successfully
**When** PTY output starts flowing
**Then** terminal must display shell prompt within 500ms
**And** prompt format depends on shell (bash: `user@host:dir$`, zsh: custom, fish: custom)
**And** cursor must be positioned after prompt
**And** terminal must accept keyboard input

#### Scenario: Shell integration activation
**Given** shell initialization is complete
**When** shell integration codes are sent to PTY
**Then** VS Code shell integration features should activate:
- Command detection
- Working directory tracking
- Exit code capture
**And** shell integration status must be logged

#### Scenario: Input capability verification
**Given** terminal displays prompt
**When** user types characters
**Then** characters must appear in terminal at cursor position
**And** backspace must delete characters
**And** Enter must execute command
**And** command output must display in terminal

### Requirement: Initialization failure recovery
System must handle initialization failures gracefully and provide diagnostic information.

**Context**: Various failure modes exist (missing PTY, routing failure, timing issues).

**Rationale**: Users should see helpful error messages, not silent failures.

#### Scenario: PTY process not available
**Given** _handleTerminalInitializationComplete is invoked
**When** terminal.ptyProcess is null or undefined
**Then** error must be logged: "❌ Terminal {terminalId} not found or PTY not available"
**And** handler should schedule retry after 100ms
**And** maximum 3 retries before giving up
**And** user should see notification if all retries fail

#### Scenario: Shell initialization timeout
**Given** shell initialization is called
**When** no prompt appears within 2 seconds
**Then** timeout warning must be logged
**And** initializeShellForTerminal() should be called again with safeMode = true
**And** if safe mode also fails, user notification should be shown

## Validation

### Unit Tests
- Test message sending with retry mechanism
- Test handler registration in MessageRoutingFacade
- Test _handleTerminalInitializationComplete execution
- Test initializeShellForTerminal() and startPtyOutput() calls
- Test defensive error handling for missing terminal
- Test retry logic with exponential backoff

### Integration Tests
- Test full initialization flow from WebView to Extension
- Test message routing through MessageRoutingFacade
- Test shell initialization with real PTY process
- Test prompt display with different shells (bash, zsh, fish)
- Test input handling after initialization
- Test error recovery scenarios

### E2E Tests
- Test terminal creation shows prompt within 1 second
- Test typing commands works immediately after terminal creation
- Test command execution produces expected output
- Test multiple terminal creation in sequence
- Test terminal creation in split mode
- Test initialization after VS Code restart (session restoration)

### Manual Testing
- Create terminal and verify prompt appears
- Type commands and verify they execute
- Test with bash, zsh, and fish shells
- Test in different panel locations (sidebar, auxiliary bar, bottom panel)
- Verify error messages if initialization fails
- Check logs for proper diagnostic information
