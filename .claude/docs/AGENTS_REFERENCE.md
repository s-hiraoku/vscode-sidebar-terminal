# Agents Reference Guide

**Comprehensive reference for all available agents in the VS Code Sidebar Terminal project**

This guide provides detailed documentation for each agent, including purpose, usage, parameters, output format, and integration patterns.

---

## Table of Contents

1. [Agent System Overview](#agent-system-overview)
2. [OpenSpec Workflow Agents](#openspec-workflow-agents)
3. [Research Agents](#research-agents)
4. [Implementation Agents](#implementation-agents)
5. [Testing Agents](#testing-agents)
6. [Validation Agents](#validation-agents)
7. [Integration Patterns](#integration-patterns)
8. [Best Practices](#best-practices)

---

## Agent System Overview

### What is an Agent?

An **Agent** is a specialized AI assistant configured for a specific task with:
- **Predefined purpose**: Clear, focused objective
- **Tool access**: Specific tools (Read, Write, Grep, Bash, MCP servers)
- **Workflow**: Step-by-step process
- **Output format**: Standardized response structure

### Agent Types

1. **OpenSpec Agents**: OpenSpec workflow automation
2. **Research Agents**: Gather implementation guidance
3. **Implementation Agents**: Write production code
4. **Testing Agents**: Create and debug tests
5. **Validation Agents**: Check code quality/security/performance

### How to Invoke Agents

**Method 1: Task Tool**
```bash
Task(agent-name): "Task description with context"
```

**Method 2: Generated Commands**
```bash
/implement-{change-id}  # Automatically orchestrates multiple agents
```

---

## OpenSpec Workflow Agents

### openspec-scaffolder

**File**: `.claude/agents/openspec-scaffolder.md`

**Purpose**: Automate OpenSpec change directory scaffolding

**When to Use**:
- Starting a new feature or bug fix
- Need to create OpenSpec proposal structure
- Want to ensure OpenSpec standards compliance

**Inputs**:
```typescript
{
  changeId: string;          // e.g., "add-terminal-profile-sync"
  problemStatement: string;  // Brief problem description
  affectedCapabilities: string[];  // e.g., ["terminal-lifecycle", "configuration"]
}
```

**Usage Example**:
```bash
Task(openspec-scaffolder): "Create OpenSpec change for add-terminal-profile-sync

Problem: Terminal profiles from VS Code settings are not synchronized
Affected capabilities: terminal-lifecycle-management, configuration-management"
```

**Generated Files**:
```
openspec/changes/{change-id}/
├── proposal.md          # Problem statement, solution, impact
├── tasks.md             # Phase-based implementation plan
├── design.md            # (Optional) Architecture changes
└── specs/              # Delta specifications
    └── {capability}/
        └── spec.md     # ADDED/MODIFIED/REMOVED requirements
```

**Output Format**:
```markdown
## OpenSpec Change Scaffolded

**Change ID**: add-terminal-profile-sync
**Location**: `openspec/changes/add-terminal-profile-sync/`

**Files Created**:
✅ proposal.md
✅ tasks.md
✅ specs/terminal-lifecycle-management/spec.md
✅ specs/configuration-management/spec.md

**Validation**: ✅ PASSED

**Next Steps**:
1. Fill in placeholder sections in proposal.md
2. Define specific tasks in tasks.md
3. Add scenarios to spec.md files
4. Run: openspec validate add-terminal-profile-sync --strict
5. Use: /openspec:agents-gen add-terminal-profile-sync
```

**Time Savings**: 30min manual → 5min automated (6x faster)

**Integrates With**:
- Filesystem MCP (safe file operations)
- OpenSpec CLI (validation)

---

### terminal-performance-analyzer

**File**: `.claude/agents/terminal-performance-analyzer.md`

**Purpose**: Profile terminal performance and identify optimization opportunities

**When to Use**:
- Investigating performance degradation
- Before/after optimization verification
- Performance regression testing
- Memory leak detection

**Analysis Areas**:
1. **Terminal Lifecycle**: Creation time, deletion time, session restore
2. **Rendering Performance**: FPS, draw calls, buffer flush intervals
3. **Memory Usage**: Per-terminal memory, scrollback size, leak detection
4. **PTY Output**: Buffering efficiency, auto-save performance
5. **Dispose Handlers**: Coverage, performance (<100ms target)

**Usage Example**:
```bash
Task(terminal-performance-analyzer): "Analyze terminal creation performance after recent refactoring

Focus areas:
- Terminal creation time (target: <500ms)
- Memory usage per terminal (target: <20MB)
- Dispose handler coverage
"
```

**Output Format**:
```markdown
## Terminal Performance Analysis Report

**Analysis Date**: 2025-11-14
**Scope**: Terminal Creation + Memory Usage

### Executive Summary
**Overall Performance**: ⚠️ Needs Attention

**Key Findings**:
- Terminal creation: 650ms (target: <500ms) ❌
- Memory per terminal: 18MB (target: <20MB) ✅
- Dispose coverage: 87% ✅

**Priority Actions**:
1. Fix synchronous file reads in TerminalCreationService (P0)
2. Implement lazy addon loading (P1)

### Current Performance Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Terminal creation | 650ms | <500ms | ❌ |
| Memory per terminal | 18MB | <20MB | ✅ |
| Dispose coverage | 87% | 100% | ⚠️ |

### Bottlenecks Identified

#### 1. Synchronous File Reads During Creation

**Location**: `src/webview/services/TerminalCreationService.ts:245`
**Impact**: 🔴 Critical
**Description**: fs.readFileSync blocks terminal creation for ~150ms

**Current Code**:
```typescript
const config = fs.readFileSync('terminal-config.json', 'utf8');
```

**Recommended Fix**:
```typescript
const config = await fs.promises.readFile('terminal-config.json', 'utf8');
```

**Expected Improvement**: Reduce creation time by 150ms (23% faster)
**Implementation Effort**: 1h
**Priority**: P0

[Additional bottlenecks...]

### Optimization Opportunities
[...]

### Next Steps
1. ✅ Immediate: Fix synchronous file reads
2. Short-term: Implement lazy addon loading
3. Long-term: Profile with Chrome DevTools MCP
```

**Benchmarks**:
- Terminal creation: <500ms
- Terminal deletion: <100ms
- Session restore: <3s (1000 lines)
- Normal rendering: 60fps (16ms buffer flush)
- AI agent rendering: 250fps (4ms buffer flush)
- Memory per terminal: <20MB
- Session storage: <20MB total

**Integrates With**:
- Chrome DevTools MCP (performance profiling)
- memory-leak-detector (leak validation)

---

### vscode-api-validator

**File**: `.claude/agents/vscode-api-validator.md`

**Purpose**: Validate VS Code extension API usage against current version standards

**When to Use**:
- Before releases (pre-release check)
- After implementing new features
- When upgrading VS Code engine version
- Debugging API-related issues

**Validation Categories**:
1. **Deprecated API Usage**: Finds APIs marked deprecated
2. **Multiple acquireVsCodeApi() Calls**: WebView API misuse
3. **Missing Dispose Handlers**: Resource leak prevention
4. **Async/Await in Activation**: Proper activation patterns
5. **WebView Provider Implementation**: Correct interface implementation
6. **Unhandled Promise Rejections**: Error handling
7. **Configuration Scopes**: Correct ConfigurationTarget usage
8. **Command Registration**: package.json ↔ code sync

**Usage Example**:
```bash
Task(vscode-api-validator): "Validate API usage in files modified for terminal-initialization fix

Files to check:
- src/webview/services/TerminalCreationService.ts
- src/providers/SecondaryTerminalProvider.ts
- src/providers/services/MessageRoutingFacade.ts
"
```

**Output Format**:
```markdown
## VS Code API Validation Report

**Extension**: vscode-sidebar-terminal
**Engine Version**: ^1.85.0
**Validation Date**: 2025-11-14

### Executive Summary
**Overall Status**: ⚠️ Issues Found

**Issues Found**: 3
- 🔴 Critical: 1 (Must fix before release)
- 🟡 High: 2 (Should fix this sprint)

**Quick Actions**:
1. Fix deprecated onDidChangePanelLocation usage
2. Add dispose handler for MessageRoutingFacade
3. Add error handling for showInputBox promise

### Deprecated API Usage

#### Issue 1: onDidChangePanelLocation is Deprecated

**Location**: `src/providers/SecondaryTerminalProvider.ts:145`
**Severity**: 🔴 Critical

**Current Code**:
```typescript
vscode.window.onDidChangePanelLocation((location) => {
    this.updateLayout(location);
});
```

**Problem**: API deprecated in VS Code 1.82, will be removed in 1.90

**Replacement**:
```typescript
vscode.window.onDidChangeActiveColorTheme((theme) => {
    this.updateLayout();
});
```

**Migration Steps**:
1. Replace onDidChangePanelLocation with appropriate alternative
2. Update layout logic to not depend on panel location
3. Test with VS Code 1.85+

**References**:
- https://code.visualstudio.com/api/references/vscode-api#window.onDidChangePanelLocation
- Migration guide: https://github.com/microsoft/vscode/issues/...

### Missing Dispose Handlers

#### Missing Dispose: MessageRoutingFacade

**Location**: `src/providers/services/MessageRoutingFacade.ts:15`
**Severity**: 🟡 High (Memory Leak Risk)

**Current Code**:
```typescript
export class MessageRoutingFacade {
    private handlers: Map<string, Handler[]> = new Map();

    constructor() {
        // Registers event listeners but no dispose!
    }
}
```

**Fix**:
```typescript
export class MessageRoutingFacade implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private handlers: Map<string, Handler[]> = new Map();

    constructor() {
        // Register resources for disposal
    }

    public dispose(): void {
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
        this.handlers.clear();
    }
}
```

**Resources at Risk**:
- Event listeners: 3
- Map references: 1

[Additional issues...]

### Recommendations

#### Priority 0 (Critical - Fix Before Release)
1. **Fix onDidChangePanelLocation usage**
   - Impact: Extension will break in VS Code 1.90+
   - Effort: 2h
   - Fix: Use onDidChangeActiveColorTheme

#### Priority 1 (High - Fix This Sprint)
1. **Add MessageRoutingFacade dispose handler**
   - Impact: Memory leak risk
   - Effort: 1h
2. **Add error handling for showInputBox**
   - Impact: Unhandled promise rejection
   - Effort: 30min

### Testing Checklist
- [ ] All deprecated APIs replaced
- [ ] All dispose handlers implemented
- [ ] All promises have .catch()
- [ ] Manual testing in VS Code 1.85+
```

**Integrates With**:
- GitHub MCP (VS Code API docs)
- WebFetch (API documentation)

---

## Research Agents

### vscode-terminal-resolver

**File**: `.claude/agents/vscode-terminal-resolver.md`

**Purpose**: Fetch VS Code terminal implementation patterns from GitHub source code

**When to Use**:
- Researching how VS Code implements a feature
- Need authoritative implementation patterns
- Want to follow VS Code conventions

**Usage Example**:
```bash
Task(vscode-terminal-resolver): "How does VS Code handle terminal shell initialization and PTY output routing?

Focus on:
- src/vs/workbench/contrib/terminal/browser/terminalInstance.ts
- Message delivery guarantees
- Error handling patterns
"
```

**Output Format** (100-200 words):
```markdown
VS Code implements terminal shell initialization using a multi-step process:

1. **PTY Creation** (TerminalInstance.ts:234): Spawns PTY process with IPC communication
2. **Shell Detection** (TerminalInstance.ts:456): Detects shell type (bash/zsh/fish) via $SHELL
3. **Initialization Codes** (TerminalInstance.ts:567): Sends shell-specific init sequences
4. **Output Routing** (TerminalInstance.ts:678): Routes PTY output through event emitter with buffering

**Key Patterns**:
- Uses promise-based handlers for async operations
- Implements 3-retry logic with exponential backoff
- Buffers output (16ms interval) for performance
- Handles shell crashes gracefully with reconnection

**Error Handling**:
- Catches PTY spawn failures → Shows error message to user
- Timeouts after 30s if shell doesn't initialize
- Logs all errors to Extension Host console

**Recommendation**: Follow the buffered output pattern and 3-retry logic for reliable message delivery.
```

**Integrates With**:
- GitHub MCP (VS Code repository access)

---

### serena-semantic-search

**File**: `.claude/agents/serena-semantic-search.md`

**Purpose**: Semantic search within current codebase to find similar implementations

**When to Use**:
- Finding existing patterns in codebase
- Understanding current architecture
- Identifying refactoring opportunities

**Usage Example**:
```bash
Task(serena-semantic-search): "Find message routing patterns in the codebase

Keywords: MessageRoutingFacade, handler registration, message delivery
Focus: How handlers are currently registered and called"
```

**Output Format** (100-200 words):
```markdown
Message routing is centralized in `MessageRoutingFacade` (src/providers/services/MessageRoutingFacade.ts):

**Architecture**:
- Category-based routing: 'terminal', 'webview', 'ui'
- Handler registration via registerHandlers() method
- Message routing via routeMessage(category, command, payload)

**Current Implementations**:
1. **Terminal handlers** (SecondaryTerminalProvider.ts:317):
   - terminalInitializationComplete → _handleTerminalInitializationComplete
   - terminalCreated → _handleTerminalCreated
   - Registered under 'terminal' category

2. **WebView handlers** (SecondaryTerminalProvider.ts:412):
   - themeChanged → _handleThemeChange
   - Registered under 'webview' category

**Pattern**:
```typescript
const handlers = [
    { command: 'terminalInitializationComplete', handler: this._handleTerminalInitializationComplete },
];
messagingFacade.registerHandlers('terminal', handlers);
```

**Issue Found**: Handler registration timing - must complete before WebView sends messages.
```

**Integrates With**:
- Serena MCP (semantic code search)

---

### xterm-info-analyzer

**File**: `.claude/agents/xterm-info-analyzer.md`

**Purpose**: Retrieve xterm.js documentation and best practices

**When to Use**:
- Implementing xterm.js features
- Configuring terminal options
- Understanding xterm.js lifecycle

**Usage Example**:
```bash
Task(xterm-info-analyzer): "How does xterm.js handle terminal initialization and addon loading?

Questions:
- When is the terminal ready to accept input?
- What events signal complete initialization?
- How should addons be loaded for optimal performance?"
```

**Output Format** (100-200 words):
```markdown
xterm.js terminal initialization lifecycle:

**Initialization Sequence**:
1. Create terminal: `new Terminal(options)`
2. Open terminal: `terminal.open(container)` - Attaches to DOM
3. Load addons: `terminal.loadAddon(addon)` - Activates addon functionality
4. Wait for ready: Terminal emits 'onRender' event when ready

**Optimal Addon Loading** (Performance):
- **Eager loading** (at initialization): FitAddon, WebGLAddon
- **Lazy loading** (on demand): SearchAddon, WebLinksAddon
- **Deferred loading** (after first render): SerializeAddon

**Ready Signal**:
```typescript
terminal.onRender(() => {
    // Terminal is ready to accept input
    // Safe to send initialization messages
});
```

**Best Practices**:
- Use WebGLAddon for hardware acceleration (fallback to Canvas)
- Set scrollback limit (2000 lines recommended)
- Dispose terminal when no longer needed: `terminal.dispose()`

**Performance**: 30% faster creation with lazy addon loading.
```

**Integrates With**:
- deepwiki MCP (xterm.js repository docs)

---

## Implementation Agents

### terminal-implementer

**File**: `.claude/agents/terminal-implementer.md`

**Purpose**: Implement terminal features following VS Code patterns and xterm.js best practices

**When to Use**:
- After research phase completes
- Implementing new terminal functionality
- Following TDD methodology

**Workflow**: Red → Green → Refactor (TDD)

**Usage Example**:
```bash
Task(terminal-implementer): "Implement terminal shell initialization fix

**Research Findings**:
- VS Code: Uses 3-retry logic with exponential backoff
- Codebase: MessageRoutingFacade has category-based routing
- xterm.js: Terminal emits 'onRender' when ready

**Requirements**:
1. Fix message routing in MessageRoutingFacade
2. Add retry logic (3 attempts, 50ms/100ms/200ms delays)
3. Add logging at each step
4. Ensure handler called before WebView init

**Success Criteria**:
- Terminal prompt appears immediately
- Input works correctly
- All tests pass"
```

**Output Format**:
```markdown
## Implementation Summary

**Feature**: Terminal shell initialization fix

**Files Modified**:
- src/webview/services/TerminalCreationService.ts:357-363 - Added retry logic
- src/providers/SecondaryTerminalProvider.ts:317 - Fixed handler timing
- src/providers/services/MessageRoutingFacade.ts:85 - Fixed category routing
- src/test/unit/MessageRoutingFacade.test.ts:1-50 - Added tests

**Key Decisions**:
- Followed VS Code 3-retry pattern from TerminalInstance.ts:234
- Used exponential backoff (50ms, 100ms, 200ms)
- Added logging with emoji markers (📨, 📥, ✅)
- Ensured handler registration before WebView resolves

**Test Coverage**:
- Unit tests: 15 passing
- Integration tests: 8 passing
- TDD compliance: ✅

**Performance Impact**:
- No significant performance change
- Retry adds max 350ms on failure (rare)

**Next Steps**:
- Run `npm run test:unit` ✅
- Run `npm run compile` ✅
- Manual testing in VS Code ✅
```

**Code Quality Standards**:
- TypeScript strict mode (no `any`)
- Atomic operations (prevent race conditions)
- Dispose handlers (prevent memory leaks)
- Security patterns (regex, not includes())

**Integrates With**:
- vscode-terminal-resolver (VS Code patterns)
- serena-semantic-search (codebase context)
- xterm-info-analyzer (xterm.js APIs)

---

### tdd-quality-engineer

**File**: `.claude/agents/tdd-quality-engineer.md`

**Purpose**: Create comprehensive test suites following t-wada TDD methodology

**When to Use**:
- After implementation completes
- Creating test suite from scratch
- Improving test coverage

**TDD Workflow**: Red → Green → Refactor

**Usage Example**:
```bash
Task(tdd-quality-engineer): "Create comprehensive test suite for terminal initialization fix

**Implementation Summary**: Fixed message routing in MessageRoutingFacade

**Test Requirements**:
- Unit tests for handler registration
- Integration tests for full initialization flow
- Scenarios: message sent, handler called, shell initialized, PTY output

**Coverage Target**: >80%"
```

**Output Format**:
```markdown
## TDD Test Suite Created

**Feature**: Terminal initialization

### Unit Tests (15 tests)

**MessageRoutingFacade** (src/test/unit/MessageRoutingFacade.test.ts):
```typescript
describe('MessageRoutingFacade', () => {
    describe('handler registration', () => {
        it('should register handler for terminal category', () => {
            // Red: Test fails initially
            const facade = new MessageRoutingFacade();
            facade.registerHandlers('terminal', handlers);
            expect(facade.hasHandler('terminal', 'terminalInitializationComplete')).toBe(true);
        });

        it('should call registered handler when message routed', async () => {
            // Green: Minimal implementation
            const spy = jest.fn();
            facade.registerHandlers('terminal', [{ command: 'test', handler: spy }]);
            await facade.routeMessage('terminal', 'test', {});
            expect(spy).toHaveBeenCalled();
        });

        it('should throw error if handler not found', () => {
            // Refactor: Add error handling
            expect(() => {
                facade.routeMessage('terminal', 'unknown', {});
            }).toThrow('Handler not found');
        });
    });
});
```

### Integration Tests (8 tests)

**Terminal Initialization Flow** (src/test/integration/TerminalInitialization.test.ts):
- Full flow: WebView → Extension → TerminalManager
- Shell initialization called
- PTY output started
- Retry logic on failure

### Coverage Report

**Overall**: 87% (target: >80%) ✅

| File | Coverage |
|------|----------|
| MessageRoutingFacade.ts | 92% ✅ |
| TerminalCreationService.ts | 85% ✅ |
| SecondaryTerminalProvider.ts | 84% ✅ |

### TDD Compliance

✅ All tests written before implementation
✅ Red → Green → Refactor cycle followed
✅ Each test verifies one specific behavior
✅ Test names describe expected behavior
✅ Arrange-Act-Assert structure used
```

**Integrates With**:
- terminal-implementer (implementation code)
- Vitest (test framework)

---

## Testing Agents

### playwright-test-planner

**File**: `.claude/agents/playwright-test-planner.md`

**Purpose**: Create E2E test scenarios for Playwright

**Usage Example**:
```bash
Task(playwright-test-planner): "Create E2E test scenarios for terminal initialization

Feature: Terminal prompt display and input capability
User flows: Create terminal, verify prompt, type commands"
```

**Output Format**:
```markdown
## E2E Test Scenarios

### Terminal Initialization

#### Scenario 1: Terminal Prompt Display (P0)
**Priority**: P0 (Critical)
**Given**: Extension is activated
**When**: User creates a new terminal
**Then**:
- Terminal displays shell prompt within 3 seconds
- Prompt shows current directory
- Cursor is visible and blinking

**Test Steps**:
1. Open VS Code
2. Activate extension
3. Click "New Terminal" button
4. Wait for terminal to appear
5. Verify prompt text present
6. Verify cursor visible

#### Scenario 2: Keyboard Input (P0)
**Priority**: P0 (Critical)
**Given**: Terminal is displayed with prompt
**When**: User types a command
**Then**:
- Characters appear in terminal
- Terminal accepts Enter key
- Command executes

[Additional scenarios...]
```

---

### playwright-test-generator

**File**: `.claude/agents/playwright-test-generator.md`

**Purpose**: Generate Playwright test code from scenarios

**Usage Example**:
```bash
Task(playwright-test-generator): "Implement E2E test for terminal prompt display scenario

Scenario: Terminal Prompt Display (P0)
Steps: Create terminal → Wait for prompt → Verify text"
```

**Output Format**:
```typescript
// tests/e2e/terminal/prompt-display.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Terminal Prompt Display', () => {
    test('should display prompt within 3 seconds after creation', async ({ page }) => {
        // Navigate to extension
        await page.goto('http://localhost:3000');

        // Create terminal
        await page.click('[data-testid="new-terminal-button"]');

        // Wait for prompt (max 3s)
        const prompt = await page.waitForSelector('.terminal-prompt', { timeout: 3000 });

        // Verify prompt visible
        expect(await prompt.isVisible()).toBe(true);

        // Verify prompt text contains directory
        const promptText = await prompt.textContent();
        expect(promptText).toContain('$');
    });
});
```

---

### playwright-test-healer

**File**: `.claude/agents/playwright-test-healer.md`

**Purpose**: Debug and fix failing Playwright tests

**Usage Example**:
```bash
Task(playwright-test-healer): "Debug failing test: terminal-prompt-display.spec.ts

Error: Timeout waiting for '.terminal-prompt' selector
Test was passing yesterday, started failing after refactoring"
```

**Output Format**:
```markdown
## Test Healing Report

**Test**: terminal-prompt-display.spec.ts
**Error**: TimeoutError: Selector '.terminal-prompt' not found

### Root Cause Analysis

**Issue**: CSS class changed from 'terminal-prompt' to 'prompt-text' in refactoring

**Evidence**:
- Git diff shows class rename in TerminalCreationService.ts:123
- Browser snapshot shows element exists with new class name
- Other tests using old class name also failing

### Fix

**Update selector**:
```typescript
// Before
await page.waitForSelector('.terminal-prompt');

// After
await page.waitForSelector('.prompt-text');
```

### Verification

✅ Test now passes
✅ No regression in other tests
✅ Selector is stable (uses data-testid recommended)

### Recommendation

Use data-testid instead of CSS classes:
```typescript
<div data-testid="terminal-prompt" class="prompt-text">
```

```typescript
await page.waitForSelector('[data-testid="terminal-prompt"]');
```
```

---

## Validation Agents

### security-auditor

**File**: `.claude/agents/security-auditor.md`

**Purpose**: Audit code for security vulnerabilities

**Checks**:
- Regex vs includes() (substring injection)
- Shell injection risks
- Path traversal vulnerabilities
- Credential storage
- Input validation

**Usage Example**:
```bash
Task(security-auditor): "Audit security in AI agent detection code

Files: src/webview/services/AIAgentDetector.ts
Focus: Pattern matching, URL validation"
```

**Output Format**:
```markdown
## Security Audit Report

**Scope**: AI Agent Detection

### Critical Issues

#### Issue 1: Substring Injection Vulnerability

**Location**: `src/webview/services/AIAgentDetector.ts:45`
**Severity**: 🔴 Critical (CVSS: 7.5)

**Vulnerable Code**:
```typescript
if (text.includes('claude code')) {
    // Detect Claude Code CLI agent
}
```

**Attack Vector**:
```typescript
// Attacker can inject:
text = "not claude code, actually malicious"
// Will trigger detection falsely
```

**Fix**:
```typescript
if (/(^|\s)claude\s+code(\s|$)/i.test(text)) {
    // Use regex with word boundaries
}
```

**Impact**: False positive agent detection → Incorrect UI state
**CVSS**: 7.5 (High) - Integrity impact
**Priority**: P0 - Fix immediately

[Additional issues...]

### Recommendations
1. Replace all includes() with regex patterns
2. Add input validation for CLI output
3. Sanitize URLs before display
```

---

### memory-leak-detector

**File**: `.claude/agents/memory-leak-detector.md`

**Purpose**: Detect memory leaks in terminal lifecycle

**Usage Example**:
```bash
Task(memory-leak-detector): "Detect memory leaks in terminal managers

Focus: Event listeners, timers, dispose handlers"
```

**Output Format**:
```markdown
## Memory Leak Detection Report

### Potential Leaks Found: 3

#### Leak 1: Undisposed Event Listener

**Location**: `src/managers/TerminalLifecycleManager.ts:67`
**Risk**: 🔴 High

**Code**:
```typescript
constructor() {
    vscode.workspace.onDidChangeConfiguration((e) => {
        this.updateConfig(e);
    });
    // No dispose handler!
}
```

**Leak**: Event listener not cleaned up → Memory retained
**Fix**: Add to disposables array

[Additional leaks...]

### Dispose Handler Coverage: 87%

**Missing Dispose**:
- TerminalLifecycleManager
- MessageRoutingFacade

**Recommendation**: Implement IDisposable for all managers
```

---

## Integration Patterns

### Sequential Workflow

**Pattern**: Research → Implement → Validate → Test

```bash
# Phase 1: Research (parallel)
Task(vscode-terminal-resolver): "..."
Task(serena-semantic-search): "..."
Task(xterm-info-analyzer): "..."

# Phase 2: Implementation
Task(terminal-implementer): "... with research findings ..."

# Phase 3: Validation (parallel)
Task(vscode-api-validator): "..."
Task(terminal-performance-analyzer): "..."

# Phase 4: Testing
Task(tdd-quality-engineer): "..."
```

---

### Automated Workflow

**Pattern**: Use generated commands

```bash
# Generate specialized agent
/openspec:agents-gen fix-terminal-initialization-bugs

# Execute full workflow automatically
/implement-fix-terminal-initialization-bugs
```

Agent internally orchestrates:
1. Research (parallel agents)
2. Implementation (TDD)
3. Validation (parallel agents)
4. Testing (comprehensive suite)

---

## Best Practices

### 1. Always Use Research Agents Before Implementation

❌ **Bad**:
```bash
Task(terminal-implementer): "Implement feature X"
# No context → Poor quality
```

✅ **Good**:
```bash
Task(vscode-terminal-resolver): "How does VS Code implement X?"
Task(serena-semantic-search): "Find X patterns in codebase"

# After research completes:
Task(terminal-implementer): "Implement X with research findings: ..."
```

---

### 2. Run Validation Agents Before Release

```bash
# Pre-release checklist
Task(vscode-api-validator): "Validate all modified files"
Task(terminal-performance-analyzer): "Check performance regressions"
Task(security-auditor): "Audit security in new code"
Task(memory-leak-detector): "Check for leaks in new managers"
```

---

### 3. Use Parallel Execution When Possible

❌ **Slow** (sequential):
```bash
Task(vscode-terminal-resolver): "..."  # 30s
# Wait...
Task(serena-semantic-search): "..."    # 30s
# Wait...
Task(xterm-info-analyzer): "..."       # 30s
# Total: 90s
```

✅ **Fast** (parallel):
```bash
# Single message with multiple Task tool calls
Task(vscode-terminal-resolver): "..."
Task(serena-semantic-search): "..."
Task(xterm-info-analyzer): "..."
# Total: 30s (3x faster)
```

---

### 4. Provide Concise Prompts with Clear Context

❌ **Vague**:
```bash
Task(terminal-implementer): "Fix the bug"
```

✅ **Clear**:
```bash
Task(terminal-implementer): "Fix terminal prompt not displaying

Problem: terminalInitializationComplete handler not called
Research: VS Code uses 3-retry pattern (TerminalInstance.ts:234)
Files: MessageRoutingFacade.ts, SecondaryTerminalProvider.ts

Success Criteria:
- Prompt appears immediately
- Input works
- Handler called for every terminal"
```

---

### 5. Always Request Summaries (100-200 words)

Agents should provide concise summaries, not full implementations in their final reports. This keeps context manageable.

```bash
Task(vscode-terminal-resolver): "... Summary: 100-200 words"
```

---

## Additional Resources

- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)
- **MCP Setup**: [MCP_SETUP.md](MCP_SETUP.md)
- **CLAUDE.md**: Complete development guide
- **Agent Files**: Browse `.claude/agents/` for source code

---

**Questions or issues?** Create an issue in the repository or consult [QUICKSTART.md](QUICKSTART.md).
