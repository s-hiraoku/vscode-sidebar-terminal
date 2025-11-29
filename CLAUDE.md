<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

### Core Development
```bash
# Compile TypeScript
npm run compile              # Production build
npm run watch                # Watch mode for development

# Run tests
npm run test                 # Run all tests (may timeout on Ubuntu - known issue)
npm run test:unit            # Unit tests only
npm run test:coverage        # With coverage report
npm run test:watch           # Watch mode

# Code quality
npm run lint                 # ESLint check
npm run format              # Prettier formatting
npm run pre-release:check   # Comprehensive pre-release validation
```

### Release Management

#### Automated GitHub Actions Release (RECOMMENDED - New Safe Procedure)
```bash
# Step 1: Update version and commit changes (WITHOUT tag)
npm version patch --no-git-tag-version  # or minor/major
# Update CHANGELOG.md and README.md with release notes
git add -A && git commit -m "v{version}: Release description"
git push

# Step 2: Wait for CI to pass
# Check GitHub Actions: https://github.com/s-hiraoku/vscode-sidebar-terminal/actions
# Verify all platform builds succeed

# Step 3: Create and push git tag ONLY after CI success
git tag v{version}           # e.g., v0.1.107
git push origin v{version}   # Triggers automated release workflow

# This automatically:
# - Runs TDD quality gate and pre-release checks
# - Builds packages for 9 platforms (Windows/macOS/Linux variants)
# - Creates GitHub Release with auto-generated notes
# - Publishes to VS Code Marketplace with all platform variants

# Benefits of this approach:
# ✅ Prevents wasting version numbers on failed builds
# ✅ No need to delete tags and re-release
# ✅ Clean git history without tag pollution
# ✅ CI failures can be fixed without version confusion
```

#### Legacy Release Procedure (Deprecated)
```bash
# Old method: Tag immediately (NOT RECOMMENDED)
# This was problematic because CI failures required tag deletion
npm version patch --no-git-tag-version
git add -A && git commit -m "v{version}: Release description"
git tag v{version} && git push origin v{version} && git push
# ❌ Problem: If CI fails, must delete tag and increment version
```

#### Manual Release (Fallback)
```bash
# Safe releases (with automatic backup and quality checks)
npm run release:patch:safe   # 0.0.x version bump
npm run release:minor:safe   # 0.x.0 version bump
npm run release:major:safe   # x.0.0 version bump

# Emergency rollback (when things go wrong)
npm run rollback:emergency:publish  # Full automated rollback + publish
npm run rollback:to 0.1.95         # Rollback to specific version
```

### Platform-specific packaging
```bash
# Package for specific platforms
npm run vsce:package:darwin-arm64  # macOS Apple Silicon
npm run vsce:package:win32-x64     # Windows x64
npm run vsce:package:linux-x64     # Linux x64

# Publish to VS Code Marketplace
npm run vsce:publish
```

## Architecture Overview

### Terminal Management Architecture
The extension uses a **singleton TerminalManager** pattern with atomic operations to prevent race conditions:

- **ID Recycling System**: Terminal IDs 1-5 are recycled to maintain consistent user experience
- **Atomic Operations**: All terminal operations use atomic patterns to prevent duplicate operations
- **Process Lifecycle**: Each terminal has explicit lifecycle states (ProcessState/InteractionState)
- **Session Persistence**: Terminal states are saved every 5 minutes and can be restored

### WebView Architecture
The WebView uses a **Manager-Coordinator pattern**:

```
TerminalWebviewManager (Coordinator)
├── MessageManager     # Handles Extension ↔ WebView communication
├── UIManager         # Theme management and visual feedback
├── InputManager      # Keyboard/IME handling, Alt+Click support
├── PerformanceManager # Output buffering (16ms flush interval)
├── NotificationManager # User notifications
└── TerminalLifecycleManager # Terminal creation/deletion
```

### Terminal Rendering Optimization (Phase 1-3)
**OpenSpec Implementation**: `optimize-terminal-rendering` (Completed)

The extension implements three-phase optimization for improved performance:

#### Phase 1: Rendering Optimization
- **RenderingOptimizer**: Debounced resize handling (100ms) with ResizeObserver
- **WebGL Auto-Fallback**: GPU acceleration with automatic DOM renderer fallback
- **Device-Specific Scrolling**: Trackpad (0ms) vs Mouse wheel (125ms) smooth scrolling
- **Performance**: 30%+ reduction in draw calls during terminal creation

#### Phase 2: Scrollback Functionality (ScrollbackManager)
Located in `src/webview/managers/ScrollbackManager.ts`

**Core Features**:
- **ANSI Color Preservation**: Uses SerializeAddon to maintain escape sequences
- **Wrapped Line Processing**: Detects and reconstructs `line.isWrapped` content
- **Empty Line Trimming**: 10-20% size reduction while preserving meaningful content
- **Auto-Save Optimization**: 3-second debounce for high-frequency output

**Usage Pattern**:
```typescript
import { ScrollbackManager } from './managers/ScrollbackManager';

const scrollbackManager = new ScrollbackManager();

// Register terminal
scrollbackManager.registerTerminal(terminalId, terminal, serializeAddon);

// Save with options
const scrollbackData = scrollbackManager.saveScrollback(terminalId, {
  scrollback: 1000,
  trimEmptyLines: true,
  preserveWrappedLines: true
});

// Restore
scrollbackManager.restoreScrollback(terminalId, scrollbackData.content);
```

#### Phase 3: Lifecycle Management (LifecycleController)
Located in `src/webview/controllers/LifecycleController.ts`

**Core Features**:
- **DisposableStore Pattern**: Unified resource management from VS Code patterns
- **LIFO Disposal**: Last-In-First-Out cleanup for dependency safety
- **Lazy Addon Loading**: Load addons only when needed (30% memory reduction)
- **Addon Caching**: Global cache for addon reuse across terminals
- **Dispose Performance**: <100ms disposal time with complete reference clearing

**Usage Pattern**:
```typescript
import { LifecycleController } from './controllers/LifecycleController';
import { FitAddon } from '@xterm/addon-fit';

const lifecycleController = new LifecycleController();

// Attach terminal
lifecycleController.attachTerminal(terminalId, terminal);

// Lazy load addon with caching
const fitAddon = lifecycleController.loadAddonLazy(
  terminalId,
  'FitAddon',
  FitAddon,
  { lazy: true, cache: true }
);

// Dispose terminal and all resources
lifecycleController.disposeTerminal(terminalId);
```

**Performance Metrics** (All Phases):
- Draw calls: 30%+ reduction
- Memory usage: 20%+ reduction
- Scrollback restore: <1s for 1000 lines
- Terminal disposal: <100ms
- GPU utilization: 40-60% when WebGL enabled

### AI Agent Detection System
Real-time detection of CLI agents with visual status indicators:

- **Supported Agents**: Claude Code, GitHub Copilot, Gemini CLI, CodeRabbit CLI, Codex CLI
- **Detection Method**: Pattern matching on terminal output with debouncing
- **Security**: URL substring sanitization using regex patterns (not includes())
- **Visual Feedback**: Color-coded status indicators in terminal headers

## Development Guidelines

### Feature Implementation Reference

**When adding features, always refer to VS Code's standard terminal implementation.**

The VS Code repository contains the canonical implementation of terminal functionality. Before implementing any new feature:

1. **Research VS Code's approach**: Check how the feature is implemented in the official VS Code terminal
2. **Repository**: https://github.com/microsoft/vscode
3. **Terminal source**: `src/vs/workbench/contrib/terminal/`
4. **Follow their patterns**: Maintain consistency with VS Code's architecture and UX

This ensures:
- Consistency with user expectations from the native terminal
- Adherence to best practices used by the VS Code team
- Compatibility with VS Code's extension API patterns
- Better long-term maintainability

### Use Specialized Agents for Implementation

**When implementing features, leverage specialized agents via the Task tool.**

Agents are specialized AI assistants designed for specific tasks. Using them improves code quality and efficiency:

#### When to Use Agents

- **Research Phase**: Use `vscode-terminal-resolver` to reference VS Code's terminal implementation
- **Terminal Features**: Use `terminal-implementer` for production-ready terminal code
- **Code Analysis**: Use `serena-semantic-search` to find similar implementations in the codebase
- **Refactoring**: Use `similarity-based-refactoring` to identify patterns and improve code structure
- **Testing**: Use `tdd-quality-engineer` to implement comprehensive TDD tests
- **Documentation**: Use `xterm-info-analyzer` for accurate xterm.js API information

#### Agent Workflow Example

```bash
# 1. Research how VS Code implements the feature
Task(vscode-terminal-resolver): "How does VS Code handle terminal process lifecycle?"

# 2. Search for similar implementations in our codebase
Task(serena-semantic-search): "Find terminal lifecycle management patterns"

# 3. Implement the feature using terminal patterns
Task(terminal-implementer): "Implement terminal process lifecycle based on VS Code patterns"

# 4. Create comprehensive tests
Task(tdd-quality-engineer): "Create TDD tests for terminal lifecycle management"

# 5. Refactor for maintainability
Task(similarity-based-refactoring): "Identify and consolidate duplicate lifecycle code"
```

#### Benefits of Using Agents

- **Consistency**: Agents follow established patterns and best practices
- **Efficiency**: Specialized knowledge reduces research and implementation time
- **Quality**: Built-in testing and validation improve code reliability
- **Maintainability**: Code follows consistent architectural patterns

### MCP Tool Usage via Skills

**When using MCP tools, always invoke the corresponding Skill first to reduce context usage.**

MCP tools consume significant context tokens when loaded directly. Using Skills instead loads only the necessary documentation on demand, saving ~40k tokens.

#### Available MCP Skills

| Skill | MCP Server | Use When |
|-------|------------|----------|
| `mcp-deepwiki` | deepwiki | Researching GitHub repositories, understanding library APIs, asking questions about open-source projects |
| `mcp-brave-search` | brave-search | Searching the web for current information, news, documentation, or local businesses |
| `mcp-playwright` | playwright | Browser automation, taking screenshots, filling forms, testing web applications |
| `mcp-firecrawl` | firecrawl | Web scraping, crawling websites, extracting structured data from web pages |
| `mcp-chrome-devtools` | chrome-devtools | Browser debugging, analyzing performance, inspecting network requests and console |

#### How to Use

Before calling any MCP tool, invoke the corresponding Skill:

```bash
# Example: Before using DeepWiki MCP
Skill: mcp-deepwiki

# Then use the tool with proper parameters
mcp__deepwiki__ask_question({
  repoName: "microsoft/vscode",
  question: "How does the terminal handle PTY integration?"
})
```

#### Skill Invocation Pattern

```bash
# Web search
Skill: mcp-brave-search
mcp__brave-search__brave_web_search({ query: "xterm.js tutorial" })

# Web scraping
Skill: mcp-firecrawl
mcp__firecrawl__firecrawl_scrape({ url: "https://docs.example.com" })

# Browser automation
Skill: mcp-playwright
mcp__playwright__browser_navigate({ url: "https://example.com" })

# Browser debugging
Skill: mcp-chrome-devtools
mcp__chrome-devtools__take_snapshot({})
```

#### Benefits

- **Context Savings**: ~40k tokens saved by not loading all MCP tool definitions
- **On-Demand Loading**: Skills load only when needed
- **Better Documentation**: Each Skill includes usage examples and best practices
- **Tool Reference**: `references/tools.md` in each Skill provides detailed parameter documentation

## Known Issues & Workarounds

### CI/CD Issues
- **Ubuntu tests timeout (30min)**: Known issue with test runner. Tests pass on Windows/macOS
- **CodeQL false positives**: May report substring sanitization issues - use regex patterns with word boundaries
- **ES Module errors**: chai-as-promised requires dynamic imports in test setup

### Terminal Issues
- **Prompt restoration**: Use `TerminalManager.initializeShellForTerminal()` if prompt disappears
- **Memory leaks**: Sessions auto-save every 5 minutes, dispose handlers required for all managers
- **IME composition**: Special handling for Japanese/Chinese input in InputManager

## Critical Security Patterns

### URL Validation (IMPORTANT)
```typescript
// ❌ VULNERABLE - Don't use includes()
if (text.includes('github copilot')) { }

// ✅ SECURE - Use regex with boundaries
if (/(^|\s)github copilot(\s|$)/i.test(text)) { }
```

### Session Storage
- Terminal scrollback limited to 1000 lines for persistent sessions
- Sensitive data should not be stored in session state
- Use VSCode SecretStorage for credentials

## Performance Optimization Settings

### Current Optimized Values
```typescript
BUFFER_FLUSH_INTERVAL = 16;  // 60fps for normal output
CLI_AGENT_FLUSH_INTERVAL = 4; // 250fps for AI agents
SESSION_SAVE_INTERVAL = 300000; // 5 minutes
MAX_SCROLLBACK = 2000; // Lines to persist
PERSISTENT_SESSION_SCROLLBACK = 1000; // Lines to save in session
MAX_STORAGE_SIZE = 20MB; // Maximum storage for scrollback
```

## Testing Strategy

### Test Execution Priority
1. **Unit tests first**: Fastest, most reliable
2. **Integration tests**: Component interaction
3. **Performance tests**: Memory and CPU usage
4. **E2E tests**: Full WebView testing (may timeout)

### TDD Workflow
```bash
npm run tdd:red      # Write failing test
npm run tdd:green    # Minimal implementation
npm run tdd:refactor # Improve code
npm run tdd:quality-gate # Verify TDD compliance
```

## E2E Testing with Playwright

### Test Coverage Overview

**Total Scenarios**: 69 comprehensive end-to-end tests
**Critical (P0)**: 18 scenarios - Must pass 100% for release
**Important (P1)**: 38 scenarios - Must pass ≥95% for release
**Nice-to-have (P2)**: 13 scenarios - Must pass ≥80% for release

**Test Implementation Status**: 74% complete (84/113 tasks done)
**Test Files Location**: `src/test/e2e/tests/`

### Test Execution Commands

```bash
# Run E2E tests (when npx playwright command is configured)
npx playwright test                    # Run all E2E tests
npx playwright test --headed           # Run with visible browser (debugging)
npx playwright test --debug            # Run in debug mode with Playwright Inspector
npx playwright test --ui               # Run with Playwright UI mode

# Run specific test files
npx playwright test tests/terminal/    # Run all terminal tests
npx playwright test tests/agents/      # Run AI agent detection tests

# Generate test report
npx playwright show-report             # View HTML test report

# Update test snapshots
npx playwright test --update-snapshots # Update visual regression baselines
```

### Test Areas by Priority

#### 1. Terminal Lifecycle Management (6 scenarios)
**Priority**: P0: 4 | P1: 2

**Critical Tests (P0)**:
- Single terminal creation (<500ms)
- Multiple terminal creation (up to 5 terminals)
- Terminal deletion with cleanup verification
- Terminal ID recycling (IDs 1-5)

**Important Tests (P1)**:
- Rapid terminal creation (race condition testing)
- Last terminal protection (prevent deleting final terminal)

**Test Files**: `tests/terminal/creation.spec.ts`, `tests/terminal/deletion.spec.ts`

#### 2. Session Persistence (5 scenarios)
**Priority**: P0: 3 | P1: 2

**Critical Tests (P0)**:
- Basic session save/restore functionality
- Scrollback restoration with 1000 lines
- Multi-terminal session restoration

**Important Tests (P1)**:
- Session expiry cleanup (7-day retention)
- AI agent session handling

**Performance Target**: Session restore <3s for typical workloads

#### 3. AI Agent Detection (6 scenarios)
**Priority**: P0: 2 | P1: 3 | P2: 1

**Critical Tests (P0)**:
- Claude Code detection with visual status indicator
- Security: False positive prevention (substring attack protection)

**Important Tests (P1)**:
- GitHub Copilot detection
- Gemini CLI detection
- Multi-agent concurrent detection

**Test Files**: `tests/agents/detection.spec.ts`
**Detection Time**: <500ms for agent pattern matching

#### 4. WebView Interactions (8 scenarios)
**Priority**: P0: 4 | P1: 3 | P2: 1

**Critical Tests (P0)**:
- Keyboard input handling
- Alt+Click cursor positioning
- Scrolling behavior (smooth scrolling, wheel events)
- ANSI color rendering validation

**Important Tests (P1)**:
- IME composition (Japanese/Chinese input)
- Copy/Paste functionality
- Theme changes (dark/light mode)

**Test Files**: `tests/webview/keyboard-input.spec.ts`, `tests/visual/ansi-colors.spec.ts`

#### 5. Configuration Management (4 scenarios)
**Priority**: P0: 2 | P1: 2

**Critical Tests (P0)**:
- Font settings application
- Max terminals limit enforcement

**Important Tests (P1)**:
- Shell selection (bash/zsh/fish)
- Feature toggles (enable/disable features)

**Test Files**: `tests/config/settings.spec.ts`

#### 6. Error Handling (5 scenarios)
**Priority**: P0: 2 | P1: 3

**Critical Tests (P0)**:
- Invalid shell path handling
- Rapid terminal operations (concurrent operation safety)

**Important Tests (P1)**:
- Non-existent working directory recovery
- Memory leak prevention validation
- Large output handling (>10MB)

**Test Files**: `tests/errors/error-scenarios.spec.ts`, `tests/errors/concurrent-operations.spec.ts`

### Performance Benchmarks

All E2E tests must meet these performance targets:

```typescript
Terminal creation: <500ms
Session restore: <3s (1000 lines of scrollback)
AI agent detection: <500ms (pattern matching + UI update)
WebView load: <3s (initial render + terminal ready)
Theme switching: <200ms (visual update)
Terminal deletion: <100ms (cleanup + dispose)
```

### Debugging E2E Tests

#### Visual Debugging
```bash
# Run tests with visible browser window
npx playwright test --headed

# Run specific test in debug mode
npx playwright test tests/terminal/creation.spec.ts --debug

# Use Playwright Inspector for step-by-step debugging
npx playwright test --debug
```

#### Trace Analysis
```bash
# Collect traces on failure (configured by default)
npx playwright test

# View trace for failed test
npx playwright show-trace test-results/trace.zip
```

#### Screenshot and Video Debugging
- **Screenshots**: Automatically captured on failure → `test-results/`
- **Videos**: Recorded on failure → `test-results/`
- **Traces**: Available on first retry → `test-results/`

### CI/CD Integration

#### GitHub Actions Configuration
```yaml
- name: Run E2E Tests
  run: npx playwright test
  env:
    CI: true

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

#### Required Environment
- **Workers**: 1 worker in CI (sequential execution)
- **Retries**: 2 retries on failure in CI
- **Timeout**: 30s per test
- **Browsers**: Chromium (VS Code Electron base)

### Release Quality Gates

**Required for Release**:
- ✅ P0 Tests: 100% pass rate (18/18 scenarios)
- ✅ P1 Tests: ≥95% pass rate (36+/38 scenarios)
- ✅ P2 Tests: ≥80% pass rate (10+/13 scenarios)
- ✅ Performance benchmarks: All targets met
- ✅ No memory leaks detected
- ✅ Cross-platform validation (Windows/macOS/Linux)

**Test Execution Time**:
- **Local**: ~5-10 minutes (parallel execution)
- **CI**: ~10-15 minutes (sequential with retries)

### Test Development Guidelines

#### Adding New E2E Tests

1. **Identify test area**: Classify as Terminal/Session/Agent/WebView/Config/Error
2. **Assign priority**: P0 (critical) / P1 (important) / P2 (nice-to-have)
3. **Create test file**: Use existing structure in `src/test/e2e/tests/`
4. **Follow naming convention**: `feature-name.spec.ts`
5. **Add to TEST_PLAN.md**: Document test scenario and expected behavior

#### Test Structure Pattern
```typescript
import { test, expect } from '@playwright/test';
import { VSCodeTestHelper } from '../helpers/vscode-helper';

test.describe('Feature Area', () => {
  let helper: VSCodeTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new VSCodeTestHelper(page);
    await helper.initialize();
  });

  test('P0: Critical functionality', async () => {
    // Arrange
    await helper.openTerminal();

    // Act
    const result = await helper.performAction();

    // Assert
    expect(result).toBeTruthy();
  });
});
```

#### Best Practices
- **Use page object pattern**: Create helper classes for reusable actions
- **Set explicit waits**: Use `waitForSelector` instead of `setTimeout`
- **Clean up resources**: Ensure terminals are disposed in `afterEach`
- **Test isolation**: Each test should be independent
- **Meaningful assertions**: Use descriptive expect messages
- **Performance tracking**: Log execution times for benchmarking

### Common E2E Test Issues

#### Issue: Tests timeout in CI
**Solution**:
- Increase timeout in `playwright.config.ts`
- Use sequential workers in CI (`workers: 1`)
- Add explicit waits for async operations

#### Issue: Flaky tests
**Solution**:
- Add retry logic (`retries: 2` in CI)
- Use `waitForSelector` with proper conditions
- Verify element visibility before interaction
- Add debouncing for rapid UI updates

#### Issue: Screenshots not captured
**Solution**:
- Verify `screenshot: 'only-on-failure'` in config
- Check `test-results/` directory permissions
- Ensure test failure is properly thrown

### Additional E2E Testing Resources

For comprehensive guides on E2E testing, refer to these detailed documents in `src/test/e2e/`:

- **[QUICK_START.md](src/test/e2e/QUICK_START.md)**: Get started with E2E testing in 5 minutes
  - Installation and setup
  - Running your first test
  - Writing basic tests
  - Common patterns and examples
  - FAQ and troubleshooting

- **[DEBUGGING.md](src/test/e2e/DEBUGGING.md)**: Debug failing or flaky tests
  - Visual debugging strategies
  - Playwright Inspector usage
  - Trace viewer analysis
  - Common issues and solutions
  - Performance debugging

- **[MAINTENANCE.md](src/test/e2e/MAINTENANCE.md)**: Maintain test suite health
  - Test review process
  - Naming conventions
  - Page object patterns
  - Test data management
  - Failure triage procedures
  - CI/CD integration

**Playwright Agent Usage** (Claude Code):
- Use `playwright-test-planner` agent to generate test scenarios
- Use `playwright-test-generator` agent to implement tests
- Use `playwright-test-healer` agent to debug and fix failing tests
- All agents accessible via Task tool in Claude Code

## Emergency Response Procedures

### When Marketplace version breaks:
1. **Immediate**: `npm run rollback:emergency:publish`
2. **Investigate**: Check user reports and error logs
3. **Fix**: Create hotfix branch
4. **Test**: Run `npm run pre-release:check`
5. **Deploy**: `npm run release:patch:safe`

### When tests fail in CI:
1. Check if Ubuntu timeout (ignore if other platforms pass)
2. Check for ES Module import issues
3. Verify GitHub Actions permissions in workflow files
4. Run `npm run test:unit` locally to isolate issues

## Component-Specific Guidelines

### When modifying TerminalManager:
- Maintain atomic operation patterns
- Preserve ID recycling logic (1-5)
- Update dispose() methods for cleanup
- Test concurrent operation scenarios

### When modifying WebView:
- Follow Manager-Coordinator pattern
- Update both TypeScript and bundled JavaScript
- Test IME input and Alt+Click functionality
- Verify theme changes work correctly

### When modifying ScrollbackManager:
- Always use SerializeAddon for ANSI color preservation
- Test wrapped line reconstruction with various terminal widths
- Verify empty line trimming doesn't remove meaningful content
- Maintain 3-second debounce for auto-save performance
- Test with high-frequency output scenarios

### When modifying LifecycleController:
- Maintain DisposableStore LIFO disposal order
- Ensure all ITerminalAddon implementations have activate() method
- Test addon caching works correctly across terminals
- Verify dispose() completes in <100ms
- Check for memory leaks using Chrome DevTools
- Always extend ITerminalAddon (not just IDisposable) for addon types

### When modifying RenderingOptimizer:
- Maintain 100ms debounce for resize events
- Test WebGL fallback to DOM renderer
- Verify device detection for trackpad vs mouse wheel
- Ensure ResizeObserver cleanup on dispose
- Test with invalid dimensions (< 50px)

### When modifying AI Agent Detection:
- Use regex patterns, not includes()
- Test with actual CLI agent output
- Verify status indicators update correctly
- Check performance with high-frequency output

## GitHub Workflows

### Required Permissions
Workflows need specific permissions for PR comments and security scanning:
```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

### Workflow Dependencies
- **CI**: Main test pipeline (may timeout on Ubuntu)
- **TDD Quality Check**: Validates TDD compliance
- **Build Platform-Specific**: Creates platform packages and automated releases
- **CodeQL**: Security scanning (check regex patterns)

### GitHub Actions Release Workflow
The automated release system (`build-platform-packages.yml`) provides:

#### Triggered by Git Tags
- **Trigger**: Push git tag `v*` (e.g., `v0.1.103`)
- **Branches**: Runs on `main` and `for-publish` branches

#### Release Pipeline
1. **Pre-Release Quality Gate**:
   - TDD compliance check with comprehensive test suite
   - Blocks release if quality standards not met
   - Generates TDD compliance report for release

2. **Multi-Platform Build Matrix**:
   - **Windows**: win32-x64, win32-arm64
   - **macOS**: darwin-x64, darwin-arm64
   - **Linux**: linux-x64, linux-arm64, linux-armhf
   - **Alpine**: alpine-x64, alpine-arm64

3. **Automated Release Creation**:
   - Creates GitHub Release with auto-generated notes
   - Uploads all platform-specific VSIX files
   - Marks pre-releases automatically for version tags containing `-`

4. **VS Code Marketplace Publishing**:
   - Publishes all platform variants to Marketplace
   - Uses `VSCE_PAT` secret for authentication
   - Ensures users get optimized binaries for their platform

#### Required Secrets
- `VSCE_PAT`: Personal Access Token for VS Code Marketplace publishing

#### Monitoring
- View workflow status: https://github.com/s-hiraoku/vscode-sidebar-terminal/actions
- Release dashboard: https://github.com/s-hiraoku/vscode-sidebar-terminal/releases

## Debugging Tips

### Terminal not responding:
```typescript
// Check terminal state
console.log(terminalManager.getTerminalInfo(id));

// Force reinitialize
terminalManager.initializeShellForTerminal(id);
```

### WebView not updating:
```typescript
// Check message queue
messageManager.getQueueSize();

// Force flush
performanceManager.flush();
```

### Session not restoring:
```typescript
// Check saved sessions
const sessions = await sessionManager.getSavedSessions();

// Manual restore
await sessionManager.restoreSession(sessionId);
```