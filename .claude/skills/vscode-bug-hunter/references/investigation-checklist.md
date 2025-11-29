# Investigation Checklist

Systematic procedures for thorough bug hunting in VS Code extensions.

## Pre-Investigation Setup

### Environment Preparation

- [ ] Fresh VS Code instance (no other extensions)
- [ ] Developer Tools accessible (Help > Toggle Developer Tools)
- [ ] Extension running in debug mode (F5)
- [ ] Console cleared and ready
- [ ] Performance monitoring enabled

### Documentation Preparation

- [ ] Create investigation log file
- [ ] Note current extension version
- [ ] Note VS Code version
- [ ] Note OS and environment details
- [ ] Timestamp investigation start

## Component Investigation Checklists

### 1. Extension Activation

**Files to Review**:
- `extension.ts` or `src/extension.ts`
- `package.json` (activation events)

**Checklist**:
- [ ] Activation events match actual requirements
- [ ] `activate()` has try-catch wrapper
- [ ] All initialization errors are handled
- [ ] `deactivate()` properly cleans up
- [ ] No blocking synchronous operations in activation
- [ ] Dependencies initialized in correct order
- [ ] No circular imports

**Search Commands**:
```bash
grep -rn "export.*activate" src/ --include="*.ts"
grep -rn "export.*deactivate" src/ --include="*.ts"
grep -rn "activationEvents" package.json
```

### 2. Command Registration

**Files to Review**:
- Command registration files
- `package.json` (contributes.commands)

**Checklist**:
- [ ] All commands registered in `package.json` have handlers
- [ ] All handlers registered in `package.json` exist
- [ ] Commands have proper error handling
- [ ] Commands validate input parameters
- [ ] Long-running commands show progress
- [ ] Commands are idempotent where expected

**Search Commands**:
```bash
grep -rn "registerCommand" src/ --include="*.ts"
grep -rn "\"commands\"" package.json -A 50
```

### 3. Event Handlers

**Files to Review**:
- All files with event subscriptions

**Checklist**:
- [ ] All event handlers registered to `subscriptions`
- [ ] No duplicate event registrations
- [ ] Event handlers don't throw exceptions
- [ ] Long-running handlers don't block UI
- [ ] Handlers check for disposed state
- [ ] No memory leaks from closures

**Search Commands**:
```bash
grep -rn "vscode\.\w+\.on\w+" src/ --include="*.ts"
grep -rn "\.addEventListener" src/ --include="*.ts"
grep -rn "subscriptions\.push" src/ --include="*.ts"
```

### 4. Resource Management

**Files to Review**:
- Classes implementing `Disposable`
- Manager/Service classes

**Checklist**:
- [ ] All resources implement `Disposable`
- [ ] `dispose()` called in correct order
- [ ] No resource leaks (files, processes, handles)
- [ ] Timers cleared on disposal
- [ ] Event listeners removed
- [ ] References nullified after disposal
- [ ] No operations after disposal

**Search Commands**:
```bash
grep -rn "implements.*Disposable" src/ --include="*.ts"
grep -rn "dispose\(\)" src/ --include="*.ts"
grep -rn "setInterval\|setTimeout" src/ --include="*.ts"
```

### 5. State Management

**Files to Review**:
- State/Store classes
- Global state files

**Checklist**:
- [ ] State properly initialized
- [ ] State transitions are valid
- [ ] No inconsistent intermediate states
- [ ] Concurrent modifications handled
- [ ] State persisted when required
- [ ] State restored on reload
- [ ] Sensitive data not in plain state

**Search Commands**:
```bash
grep -rn "private.*state\|this\.state" src/ --include="*.ts"
grep -rn "globalState\|workspaceState" src/ --include="*.ts"
```

### 6. Async Operations

**Files to Review**:
- All async functions

**Checklist**:
- [ ] All promises awaited or explicitly fire-and-forget
- [ ] Error handling for all async operations
- [ ] No unhandled promise rejections
- [ ] Timeouts for long operations
- [ ] Concurrent operations controlled
- [ ] Race conditions prevented
- [ ] Cancellation supported where appropriate

**Search Commands**:
```bash
grep -rn "async\s" src/ --include="*.ts"
grep -rn "\.then\(" src/ --include="*.ts"
grep -rn "Promise\.all\|Promise\.race" src/ --include="*.ts"
grep -rn "await" src/ --include="*.ts"
```

### 7. WebView Communication

**Files to Review**:
- WebView provider classes
- Message handler files
- WebView JavaScript files

**Checklist**:
- [ ] Messages validated on both sides
- [ ] Ready handshake before sending data
- [ ] Message queue for pending messages
- [ ] Error responses for invalid messages
- [ ] No XSS vulnerabilities
- [ ] CSP properly configured
- [ ] Resource URIs use webview.asWebviewUri()

**Search Commands**:
```bash
grep -rn "postMessage" src/ --include="*.ts"
grep -rn "onDidReceiveMessage" src/ --include="*.ts"
grep -rn "createWebviewPanel" src/ --include="*.ts"
```

### 8. Terminal Operations

**Files to Review**:
- Terminal manager classes
- Terminal provider classes

**Checklist**:
- [ ] Terminal processes properly spawned
- [ ] PTY handles properly managed
- [ ] Terminal output buffered appropriately
- [ ] Input handled without dropping characters
- [ ] Resize events handled
- [ ] Terminal disposed on close
- [ ] Shell integration working

**Search Commands**:
```bash
grep -rn "createTerminal\|Terminal" src/ --include="*.ts"
grep -rn "pty\|pseudoTerminal" src/ --include="*.ts"
```

### 9. Configuration Handling

**Files to Review**:
- Configuration schema in `package.json`
- Configuration reader classes

**Checklist**:
- [ ] All config keys defined in `package.json`
- [ ] Default values provided
- [ ] Type validation for config values
- [ ] Config changes detected and applied
- [ ] Invalid config handled gracefully
- [ ] Secure storage for sensitive config

**Search Commands**:
```bash
grep -rn "getConfiguration" src/ --include="*.ts"
grep -rn "\"configuration\"" package.json -A 100
grep -rn "onDidChangeConfiguration" src/ --include="*.ts"
```

### 10. Error Handling

**Files to Review**:
- All source files

**Checklist**:
- [ ] All entry points have error handling
- [ ] Errors logged with context
- [ ] User-friendly error messages
- [ ] No sensitive info in error messages
- [ ] Recovery from transient errors
- [ ] Graceful degradation on failures
- [ ] No swallowed errors

**Search Commands**:
```bash
grep -rn "catch\s*{" src/ --include="*.ts"
grep -rn "catch\s*(\s*)" src/ --include="*.ts"
grep -rn "showErrorMessage" src/ --include="*.ts"
```

## Investigation Procedures

### Procedure A: Memory Leak Investigation

1. **Baseline Measurement**
   - [ ] Open Developer Tools > Memory
   - [ ] Take heap snapshot #1
   - [ ] Record baseline memory

2. **Trigger Suspected Leak**
   - [ ] Perform operation (create/delete terminal, etc.)
   - [ ] Repeat operation 10 times
   - [ ] Wait 30 seconds for GC

3. **Measurement**
   - [ ] Force garbage collection
   - [ ] Take heap snapshot #2
   - [ ] Compare snapshots

4. **Analysis**
   - [ ] Check for growing object counts
   - [ ] Identify retained objects
   - [ ] Trace retainer chains
   - [ ] Document findings

### Procedure B: Race Condition Investigation

1. **Identify Suspects**
   - [ ] Find shared mutable state
   - [ ] Find async operations modifying state
   - [ ] Find check-then-act patterns

2. **Design Stress Test**
   - [ ] Create concurrent operation scenario
   - [ ] Add timing instrumentation
   - [ ] Add state validation checks

3. **Execute Test**
   - [ ] Run concurrent operations
   - [ ] Monitor for state inconsistencies
   - [ ] Check for duplicate operations
   - [ ] Verify final state

4. **Document**
   - [ ] Record timing of events
   - [ ] Note state at each step
   - [ ] Identify race window

### Procedure C: Error Path Investigation

1. **Map Error Paths**
   - [ ] Identify all operations that can fail
   - [ ] Trace error propagation
   - [ ] Check error handling at each level

2. **Test Error Scenarios**
   - [ ] Invalid input
   - [ ] Network failure
   - [ ] Permission denied
   - [ ] Resource not found
   - [ ] Timeout

3. **Verify Behavior**
   - [ ] Error message appropriate
   - [ ] State remains consistent
   - [ ] Resources cleaned up
   - [ ] Recovery possible

### Procedure D: Security Audit

1. **Input Validation**
   - [ ] User input sanitized
   - [ ] Path traversal prevented
   - [ ] Command injection prevented
   - [ ] XSS prevented in WebView

2. **Data Protection**
   - [ ] Sensitive data encrypted
   - [ ] Credentials in SecretStorage
   - [ ] No secrets in logs
   - [ ] No secrets in error messages

3. **WebView Security**
   - [ ] CSP configured
   - [ ] External resources blocked
   - [ ] Scripts use nonce
   - [ ] Messages validated

## Quick Investigation Checklists

### 5-Minute Quick Scan
- [ ] Run `npx tsc --noEmit --strict`
- [ ] Search for `@ts-ignore` and `as any`
- [ ] Search for `TODO`, `FIXME`, `HACK`
- [ ] Search for `console.log` (should be removed)
- [ ] Check for empty catch blocks

### 15-Minute Component Review
- [ ] Check all dispose handlers exist
- [ ] Verify event listeners registered to subscriptions
- [ ] Check async functions have error handling
- [ ] Verify null checks for optional values
- [ ] Check for proper resource cleanup

### 60-Minute Deep Dive
- [ ] Full type check with strict mode
- [ ] Memory leak analysis
- [ ] Race condition review
- [ ] Error path verification
- [ ] Security audit

## Investigation Report Template

```markdown
# Bug Investigation Report

## Summary
- **Date**: YYYY-MM-DD
- **Investigator**: [Name]
- **Component**: [Component Name]
- **Duration**: [X hours]

## Scope
- Files reviewed: [list]
- Tools used: [list]
- Tests performed: [list]

## Findings

### Critical Issues
1. [Issue description]
   - **Location**: file:line
   - **Impact**: [description]
   - **Evidence**: [screenshot/log]

### Moderate Issues
1. [Issue description]

### Minor Issues
1. [Issue description]

## Recommendations
1. [Recommendation]

## Follow-up Required
- [ ] [Action item]
```

## Post-Investigation Actions

### Documentation
- [ ] Update investigation log
- [ ] Create bug reports for findings
- [ ] Document patterns found
- [ ] Update detection rules

### Prevention
- [ ] Add tests for found issues
- [ ] Update linting rules
- [ ] Add code review checklist items
- [ ] Document in team wiki

### Verification
- [ ] Fixes verified
- [ ] Regression tests added
- [ ] No new issues introduced
- [ ] Performance not impacted
