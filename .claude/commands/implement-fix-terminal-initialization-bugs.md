---
description: Implement OpenSpec change fix-terminal-initialization-bugs using specialized agent
---

# Implement: Fix Terminal Initialization Bugs

Execute the specialized implementation agent for OpenSpec change **fix-terminal-initialization-bugs**.

## Quick Start

Simply invoke this command:
```bash
/implement-fix-terminal-initialization-bugs
```

This will launch the `fix-terminal-initialization-bugs-implementer` agent with pre-configured workflow.

---

## What This Command Does

**Launches**: `.claude/agents/fix-terminal-initialization-bugs-implementer.md`

**Workflow Phases**:
1. **Research** (30min): Gather VS Code patterns, codebase context, xterm.js lifecycle
2. **Implementation** (1.5h): Fix message routing and shell initialization bugs
3. **Validation** (30min): API validation, security audit
4. **Testing** (1.5h): Unit/Integration test creation

**Total Estimated Time**: ~3.5h

---

## OpenSpec Context

**Change ID**: fix-terminal-initialization-bugs
**Problem**: Two critical bugs preventing terminal functionality:
1. AI Agent header display corruption
2. Terminal prompt not displayed (initialization message not routed to handler)

**Solution**: Fix message routing in MessageRoutingFacade and add diagnostic logging
**Scope**: Terminal Lifecycle Management, WebView Message Routing, UI Rendering

**Full Specification**: `openspec/changes/fix-terminal-initialization-bugs/`
- proposal.md - Problem statement and success criteria
- tasks.md - Detailed implementation tasks (4 phases)
- specs/terminal-header-display/spec.md - Header display requirements
- specs/terminal-shell-initialization/spec.md - Shell initialization requirements

---

## Execution Flow

When you run `/implement-fix-terminal-initialization-bugs`, the agent will:

### 1. Research Phase (Parallel - 30min)
- Launch `vscode-terminal-resolver` → VS Code message routing patterns
- Launch `serena-semantic-search` → Current codebase message handling
- Launch `xterm-info-analyzer` → xterm.js initialization lifecycle

### 2. Implementation Phase (1.5h)
- Launch `terminal-implementer` with research findings
- Follow TDD: Red → Green → Refactor
- Implement tasks from `tasks.md`:
  - **Phase 1**: Add diagnostic logging (TerminalCreationService, SecondaryTerminalProvider, TerminalManager)
  - **Phase 2**: Fix message routing (MessageRoutingFacade, handler registration)
  - **Phase 3**: Fix shell initialization (_handleTerminalInitializationComplete)

### 3. Validation Phase (Parallel - 30min)
- Launch `vscode-api-validator` → API usage checks
- Launch `security-auditor` → Security audit

### 4. Testing Phase (1.5h)
- Launch `tdd-quality-engineer` → Unit/Integration tests
  - Unit tests: MessageRoutingFacade handler registration
  - Integration tests: Terminal initialization flow
  - Scenarios from specs: Header display, shell initialization, message retry

---

## Success Criteria

The implementation is complete when:
- [✅] Terminal displays properly formatted AI Agent status in header
- [✅] Terminal shows shell prompt immediately after creation
- [✅] Terminal accepts keyboard input
- [✅] initializeShellForTerminal() is called for every new terminal
- [✅] startPtyOutput() is called for every new terminal
- [✅] No TypeScript compilation errors
- [✅] All existing tests pass
- [✅] Coverage > 80%
- [✅] Validation reports clean

---

## Affected Files (Expected)

**WebView**:
- `src/webview/services/TerminalCreationService.ts:357-363` - Add message retry and logging
- `src/webview/factories/HeaderFactory.ts` - Fix header display (if needed)

**Extension**:
- `src/providers/SecondaryTerminalProvider.ts:317` - Fix handler registration
- `src/providers/services/MessageRoutingFacade.ts` - Fix message routing logic
- `src/terminals/TerminalManager.ts` - Add shell initialization logging

**Tests**:
- `src/test/unit/MessageRoutingFacade.test.ts` - Handler registration tests
- `src/test/integration/TerminalInitialization.test.ts` - Integration tests

---

## Technical Details

### Bug 1: AI Agent Header Display Corruption

**Root Cause**: HeaderFactory initialization timing or missing CSS
**Fix Approach**: Verify DOM structure and CSS application in HeaderFactory.createTerminalHeader()
**Files**: `src/webview/factories/HeaderFactory.ts`

### Bug 2: Terminal Prompt Not Displayed

**Root Cause**: `terminalInitializationComplete` message not routed to handler
**Fix Approach**:
1. Verify MessageRoutingFacade routes 'terminal' category correctly
2. Ensure handler registration happens before WebView sends message
3. Add message retry logic (3 attempts, exponential backoff)
4. Add logging at each routing step

**Files**:
- `src/webview/services/TerminalCreationService.ts` - Message sending with retry
- `src/providers/SecondaryTerminalProvider.ts` - Handler registration timing
- `src/providers/services/MessageRoutingFacade.ts` - Routing logic
- `src/terminals/TerminalManager.ts` - Shell initialization

---

## Diagnostic Logging

The implementation will add comprehensive logging:

**WebView** (`TerminalCreationService.ts`):
```typescript
📨 [WebView] Sending terminalInitializationComplete for terminalId: 1
📨 [WebView] Message payload: {command, terminalId, timestamp}
✅ [WebView] Message sent successfully
```

**Extension** (`SecondaryTerminalProvider.ts`):
```typescript
📥 [Extension] Received message: terminalInitializationComplete
🔍 [Router] Routing message to category: terminal
✅ [Handler] Executing terminalInitializationComplete for: 1
```

**TerminalManager**:
```typescript
🔧 [Shell] Initializing shell for terminal: 1
📤 [Shell] Sent initialization codes
🎯 [PTY] Starting output for terminal: 1
📊 [PTY] First data received, length: 256
```

---

## Testing Strategy

### Unit Tests (15 tests)
- MessageRoutingFacade handler registration (5 tests)
- Handler execution (5 tests)
- Message retry logic (5 tests)

### Integration Tests (8 tests)
- Full initialization flow (3 tests)
- Shell initialization (3 tests)
- Header display (2 tests)

### Manual Testing
- Create terminal → Verify prompt appears
- Type commands → Verify input works
- AI agent detection → Verify header displays correctly
- Split mode → Verify both terminals work

---

## Next Steps After Implementation

1. **Verify Build**: `npm run compile`
2. **Run Tests**: `npm run test`
3. **Manual Testing**: Load extension in VS Code
   - Create new terminal
   - Verify prompt appears immediately
   - Type commands and verify input works
   - Check AI Agent header display
   - Test split mode
4. **Pre-Release Check**: `npm run pre-release:check`
5. **Archive OpenSpec**: `/openspec:archive fix-terminal-initialization-bugs`

---

## Related Commands

- `/openspec:proposal` - Create new OpenSpec change
- `/openspec:apply fix-terminal-initialization-bugs` - Mark change as applied
- `/openspec:archive fix-terminal-initialization-bugs` - Archive completed change
- `/terminal-research message routing patterns` - Research message routing

---

## Expected Outcome

After running this command, you should have:

✅ **Bugs Fixed**:
- AI Agent header displays correctly (no corruption)
- Terminal prompt appears immediately after creation
- Terminal accepts keyboard input

✅ **Code Improvements**:
- Message routing fixed in MessageRoutingFacade
- Handler registration timing corrected
- Message retry logic implemented (3 attempts)
- Comprehensive diagnostic logging added

✅ **Tests Added**:
- 15 unit tests for message routing
- 8 integration tests for initialization flow
- Coverage > 80%

✅ **Validation Clean**:
- No deprecated API usage
- No security vulnerabilities
- No TypeScript errors
- All tests passing

---

## Troubleshooting

**If prompt still doesn't appear after fix**:
1. Check logs in Extension Host console for 📥 and ✅ markers
2. Verify message sent from WebView (check WebView console for 📨)
3. Check MessageRoutingFacade routing category matches
4. Verify handler registration happens before message sent

**If header display still corrupted**:
1. Check HeaderFactory.createTerminalHeader() returns all elements
2. Verify CSS classes applied correctly
3. Check flexbox layout (`minWidth: 0` for statusSection)
4. Test in both single and split modes

**If tests fail**:
1. Run `npm run compile` first
2. Check test logs for specific failures
3. Verify mocks match actual message structure
4. Ensure test data includes all required fields (terminalId, timestamp)
