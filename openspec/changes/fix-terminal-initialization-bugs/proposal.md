# Proposal: Fix Terminal Initialization Bugs

## Summary
Fix critical terminal initialization bugs preventing proper terminal functionality:
1. AI Agent header display corruption
2. Missing terminal prompt and input capability

## Problem Statement
Users report two critical bugs after recent refactoring:

### Bug 1: AI Agent Header Display Corruption
- **Symptom**: AI Agent status display in terminal header appears broken/corrupted
- **User Impact**: Cannot see AI agent connection status clearly
- **Root Cause**: HeaderFactory initialization timing issue or missing CSS styling

### Bug 2: Terminal Prompt Not Displayed
- **Symptom**: Terminal shows no prompt after initialization, cannot accept input
- **User Impact**: Terminal is completely unusable - blocking all terminal operations
- **Root Cause**: `terminalInitializationComplete` message sent from WebView but handler `_handleTerminalInitializationComplete` not called, preventing shell initialization

## Investigation Findings

### Current Terminal Initialization Flow
```
WebView (TerminalCreationService.ts:357-363):
  └─> Send terminalInitializationComplete message (50ms delay)

Extension (SecondaryTerminalProvider.ts:317):
  └─> Handler registered: _handleTerminalInitializationComplete
      └─> Should call: initializeShellForTerminal()
      └─> Should call: startPtyOutput()
```

### Evidence from Logs
- Extension activates successfully ✅
- WebView resolves successfully ✅
- All handlers registered including 'terminalInitializationComplete' ✅
- BUT: No logs showing handler execution ❌
- Result: No shell initialization, no PTY output, no prompt ❌

### Code Analysis
1. **Message sent correctly**: `TerminalCreationService.ts:357-363` sends message
2. **Handler registered**: `SecondaryTerminalProvider.ts:317` has handler
3. **Handler implementation exists**: `SecondaryTerminalProvider.ts:528-557`
4. **Compiled correctly**: `dist/extension.js` contains all code
5. **Missing link**: Handler registration or message routing broken

## Proposed Solution

### Approach 1: Fix Message Routing (Preferred)
**Verify and fix the message routing pipeline**:
- Check MessageRoutingFacade registration
- Verify handler category matching
- Ensure message command string matches exactly
- Add defensive logging at each routing step

### Approach 2: Direct Shell Initialization
**If message routing cannot be fixed quickly**:
- Initialize shell immediately after terminal creation
- Remove dependency on terminalInitializationComplete message
- More reliable but less flexible architecture

## Scope
- **In Scope**:
  - Fix AI Agent header display rendering
  - Fix terminal prompt initialization
  - Fix input capability
  - Add defensive logging for debugging
  - Ensure shell integration works correctly

- **Out of Scope**:
  - Major architectural changes to message system
  - Changes to xterm.js integration
  - Performance optimizations
  - New features

## Success Criteria
1. Terminal displays properly formatted AI Agent status in header
2. Terminal shows shell prompt immediately after creation
3. Terminal accepts keyboard input
4. initializeShellForTerminal() is called for every new terminal
5. startPtyOutput() is called for every new terminal
6. No TypeScript compilation errors
7. All existing tests pass

## Implementation Plan
See `tasks.md` for detailed breakdown.

## Risks & Mitigation
- **Risk**: Message routing changes break other handlers
  - **Mitigation**: Add comprehensive handler registration tests
- **Risk**: Shell initialization timing causes race conditions
  - **Mitigation**: Use proper async/await patterns, add timing logs
- **Risk**: Header display fix affects split mode
  - **Mitigation**: Test both single and split terminal modes

## Testing Strategy
1. Unit tests for handler registration
2. Integration tests for terminal initialization flow
3. E2E tests for prompt display and input
4. Manual testing across different shells (bash, zsh, fish)
5. Verify AI agent detection still works

## Dependencies
- No external dependencies
- Requires understanding of MessageRoutingFacade
- Requires understanding of TerminalInitializationCoordinator

## Timeline Estimate
- Investigation: Already completed
- Implementation: 2-4 hours
- Testing: 1-2 hours
- Total: 3-6 hours

## Related Changes
- Previous optimization phases (Phase 1-3) completed successfully
- This is a regression fix, not new functionality
