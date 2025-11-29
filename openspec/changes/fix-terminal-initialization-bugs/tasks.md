# Tasks: Fix Terminal Initialization Bugs

## Prerequisites
- [ ] Review all code paths in TerminalCreationService.ts related to message sending
- [ ] Review MessageRoutingFacade.ts handler registration logic
- [ ] Review SecondaryTerminalProvider.ts handler implementation
- [ ] Set up test environment with fresh terminal creation

## Phase 1: Add Diagnostic Logging (Parallelizable)

### Task 1.1: Add WebView message sending logs
- **File**: `src/webview/services/TerminalCreationService.ts`
- **Changes**:
  - Add log before postMessage call: `log('📨 [WebView] Sending terminalInitializationComplete for terminalId: ' + terminalId)`
  - Add log with message content: `log('📨 [WebView] Message payload:', JSON.stringify({command, terminalId, timestamp}))`
  - Add log after postMessage: `log('✅ [WebView] Message sent successfully')`
- **Validation**: Create terminal and verify logs appear in webview console
- **Time**: 15 min

### Task 1.2: Add Extension message reception logs
- **File**: `src/providers/SecondaryTerminalProvider.ts`
- **Changes**:
  - Add log in _registerWebviewMessageListener: `log('📥 [Extension] Received message:', message.command)`
  - Add log in MessageRoutingFacade routing: `log('🔍 [Router] Routing message to category:', category)`
  - Add log at start of _handleTerminalInitializationComplete: `log('✅ [Handler] Executing terminalInitializationComplete for:', terminalId)`
- **Validation**: Create terminal and verify logs appear in Extension Host console
- **Time**: 15 min

### Task 1.3: Add shell initialization logs
- **File**: `src/terminals/TerminalManager.ts`
- **Changes**:
  - Add log at start of initializeShellForTerminal: `log('🔧 [Shell] Initializing shell for terminal:', terminalId)`
  - Add log after shell codes sent: `log('📤 [Shell] Sent initialization codes')`
  - Add log at start of startPtyOutput: `log('🎯 [PTY] Starting output for terminal:', terminalId)`
  - Add log when PTY data flows: `log('📊 [PTY] First data received, length:', data.length)`
- **Validation**: Verify all logs appear when creating terminal
- **Time**: 20 min

## Phase 2: Fix Message Routing (Critical Path)

### Task 2.1: Verify handler registration in MessageRoutingFacade
- **File**: `src/providers/services/MessageRoutingFacade.ts`
- **Changes**:
  - Review registerHandlers() method
  - Ensure 'terminal' category is properly registered
  - Verify 'terminalInitializationComplete' command mapping
  - Add defensive check: if (!this.handlers.has(category)) throw error
- **Validation**: Unit test verifying handler registration
- **Time**: 30 min
- **Dependencies**: None

### Task 2.2: Fix message routing logic
- **File**: `src/providers/services/MessageRoutingFacade.ts`
- **Changes**:
  - Review routeMessage() method
  - Fix category determination for 'terminalInitializationComplete'
  - Ensure exact string matching for command names
  - Add fallback for unknown categories
  - Add error handling for missing handlers
- **Validation**: Integration test for message routing
- **Time**: 45 min
- **Dependencies**: Task 2.1

### Task 2.3: Verify handler is called in SecondaryTerminalProvider
- **File**: `src/providers/SecondaryTerminalProvider.ts`
- **Changes**:
  - Verify _initializeMessageHandlers() registers handler correctly
  - Check handler array structure matches MessageRoutingFacade expectations
  - Ensure handler is registered before WebView initialization
  - Add assertion: handler must be registered before resolveWebviewView completes
- **Validation**: Unit test verifying handler execution
- **Time**: 30 min
- **Dependencies**: Task 2.2

## Phase 3: Fix Shell Initialization (Critical Path)

### Task 3.1: Verify _handleTerminalInitializationComplete implementation
- **File**: `src/providers/SecondaryTerminalProvider.ts` (lines 528-557)
- **Changes**:
  - Review existing implementation for correctness
  - Add defensive null checks for terminal and ptyProcess
  - Add retry logic if terminal not ready (max 3 attempts, 100ms delay)
  - Ensure async/await is used correctly
  - Add timing logs for performance monitoring
- **Validation**: Unit test with mocked TerminalManager
- **Time**: 45 min
- **Dependencies**: Task 2.3

### Task 3.2: Add fallback initialization mechanism
- **File**: `src/webview/services/TerminalCreationService.ts`
- **Changes**:
  - Implement message retry with exponential backoff (50ms, 100ms, 200ms)
  - Track message acknowledgment from Extension
  - If no ACK after 3 retries, log warning
  - Consider direct initialization fallback (document but don't implement yet)
- **Validation**: Integration test simulating message loss
- **Time**: 45 min
- **Dependencies**: Task 3.1

### Task 3.3: Verify shell initialization calls
- **File**: `src/terminals/TerminalManager.ts`
- **Changes**:
  - Review initializeShellForTerminal() implementation
  - Ensure shell codes are sent correctly to PTY
  - Verify startPtyOutput() establishes PTY data flow
  - Add error handling for PTY write failures
  - Add timeout detection (2 seconds) with fallback
- **Validation**: Integration test with real PTY process
- **Time**: 30 min
- **Dependencies**: Task 3.1

## Phase 4: Fix Header Display (Parallelizable with Phase 3)

### Task 4.1: Review HeaderFactory DOM structure
- **File**: `src/webview/factories/HeaderFactory.ts`
- **Changes**:
  - Verify createTerminalHeader() creates all required elements
  - Ensure proper nesting: container > (titleSection, statusSection, controlsSection)
  - Add CSS properties for text truncation: `minWidth: 0, overflow: hidden, textOverflow: ellipsis`
  - Verify flexbox layout prevents overflow
- **Validation**: Unit test for DOM structure
- **Time**: 30 min
- **Dependencies**: None

### Task 4.2: Fix AI Agent status insertion
- **File**: `src/webview/factories/HeaderFactory.ts`
- **Changes**:
  - Review insertCliAgentStatus() implementation
  - Ensure statusSpan has proper text truncation CSS
  - Verify indicator has correct colors and animation
  - Add defensive check: statusSection must exist before insertion
  - Ensure proper cleanup of old status before inserting new
- **Validation**: Unit test for status insertion and updates
- **Time**: 30 min
- **Dependencies**: Task 4.1

### Task 4.3: Verify CSS theme variable usage
- **File**: Multiple files in `src/webview/factories/`
- **Changes**:
  - Audit all VS Code theme variable usage
  - Ensure fallback colors are provided
  - Test in both light and dark themes
  - Fix any hard-coded colors
  - Verify contrast ratios meet accessibility standards
- **Validation**: Visual inspection in light/dark themes
- **Time**: 30 min
- **Dependencies**: Task 4.2

### Task 4.4: Test header in split mode
- **File**: `src/webview/factories/HeaderFactory.ts`, `src/webview/managers/SplitManager.ts`
- **Changes**:
  - Test header rendering with reduced width in split mode
  - Verify text truncation activates correctly
  - Ensure no layout shifts when AI Agent status updates
  - Test with multiple terminals (up to 5)
- **Validation**: Manual testing in split mode
- **Time**: 20 min
- **Dependencies**: Task 4.3

## Phase 5: Testing & Validation

### Task 5.1: Unit tests for message routing
- **File**: `src/test/unit/providers/MessageRoutingFacade.test.ts`
- **Tests**:
  - Handler registration for 'terminal' category
  - Message routing to correct handler
  - Handler execution with proper payload
  - Error handling for missing handlers
- **Time**: 45 min
- **Dependencies**: Tasks 2.1, 2.2, 2.3

### Task 5.2: Unit tests for shell initialization
- **File**: `src/test/unit/providers/SecondaryTerminalProvider.test.ts`
- **Tests**:
  - _handleTerminalInitializationComplete execution
  - initializeShellForTerminal() is called
  - startPtyOutput() is called
  - Defensive handling of missing terminal
  - Retry logic for terminal not ready
- **Time**: 45 min
- **Dependencies**: Tasks 3.1, 3.2, 3.3

### Task 5.3: Unit tests for header display
- **File**: `src/test/unit/webview/factories/HeaderFactory.test.ts`
- **Tests**:
  - createTerminalHeader() returns all elements
  - insertCliAgentStatus() creates proper DOM
  - CSS classes and theme variables are applied
  - Text truncation works correctly
  - Status updates don't cause layout shifts
- **Time**: 45 min
- **Dependencies**: Tasks 4.1, 4.2, 4.3

### Task 5.4: Integration tests for terminal initialization flow
- **File**: `src/test/integration/terminal-initialization.test.ts`
- **Tests**:
  - Full flow from WebView message to shell initialization
  - PTY output starts after initialization
  - Prompt displays within 1 second
  - Input is accepted after initialization
  - Multiple terminals initialize correctly
- **Time**: 60 min
- **Dependencies**: All Phase 2 and Phase 3 tasks

### Task 5.5: E2E tests for terminal usage
- **File**: `src/test/e2e/terminal-prompt.spec.ts`
- **Tests**:
  - Terminal shows prompt after creation
  - User can type and execute commands
  - Command output displays correctly
  - Works with bash, zsh, and fish shells
  - Works in different panel locations
- **Time**: 60 min
- **Dependencies**: All Phase 2, 3, 4 tasks

### Task 5.6: Manual testing across scenarios
- **Scenarios**:
  - Create terminal in sidebar, verify prompt and input
  - Create terminal in auxiliary bar, verify prompt and input
  - Create terminal in bottom panel, verify prompt and input
  - Test with bash shell
  - Test with zsh shell
  - Test with fish shell
  - Create 5 terminals rapidly, verify all initialize
  - Test in split mode with multiple terminals
  - Test AI Agent detection and header display
  - Restart VS Code and verify session restoration
- **Validation**: Document results in test report
- **Time**: 90 min
- **Dependencies**: All previous tasks

## Phase 6: Cleanup & Documentation

### Task 6.1: Remove excessive debug logging
- **Files**: All files modified in Phase 1
- **Changes**:
  - Keep critical logs (errors, warnings, initialization complete)
  - Remove verbose debug logs (message payloads, routing details)
  - Ensure remaining logs provide value for troubleshooting
- **Time**: 20 min
- **Dependencies**: Task 5.6

### Task 6.2: Update CHANGELOG.md
- **File**: `CHANGELOG.md`
- **Changes**:
  - Add entry for bug fixes under appropriate version
  - Describe issues fixed (header display, prompt initialization)
  - Credit issue reporters if applicable
- **Time**: 15 min
- **Dependencies**: Task 6.1

### Task 6.3: Update documentation
- **Files**: `README.md`, `CLAUDE.md`, `src/terminals/CLAUDE.md`, `src/webview/CLAUDE.md`
- **Changes**:
  - Document new diagnostic logging if kept
  - Update troubleshooting section if needed
  - Add notes about message routing behavior
- **Time**: 30 min
- **Dependencies**: Task 6.2

## Summary

**Total Estimated Time**: 11-13 hours
**Critical Path**: Phase 2 → Phase 3 → Phase 5.1-5.6
**Parallelizable**: Phase 1 (all tasks), Phase 4 (can run parallel to Phase 3)

**Key Milestones**:
1. Diagnostic logging complete (Phase 1) - Enables debugging
2. Message routing fixed (Phase 2) - Unblocks handler execution
3. Shell initialization verified (Phase 3) - Terminal becomes usable
4. Header display fixed (Phase 4) - Visual polish
5. All tests passing (Phase 5) - Quality gate
6. Documentation updated (Phase 6) - User-facing completion

**Risk Areas**:
- MessageRoutingFacade refactoring (Task 2.2) - Could break other handlers
- Shell initialization timing (Task 3.3) - Race conditions possible
- Header CSS (Task 4.3) - Theme compatibility issues

**Validation Strategy**:
- Unit tests catch logic errors
- Integration tests catch flow issues
- E2E tests catch user-visible problems
- Manual testing catches edge cases
