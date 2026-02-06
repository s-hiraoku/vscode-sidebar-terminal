## Development Flow (Mandatory)

1. When receiving a feature request or modification, write tests first
2. Present the tests to confirm the specification
3. Proceed to implementation only after confirmation
4. Adjust implementation until all tests pass

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

## CRITICAL: Protecting Local Changes

**NEVER delete or discard uncommitted local changes without explicit user permission.**

When you need to investigate build issues or test changes:

1. **ALWAYS use `git stash` first** to save uncommitted changes
2. After investigation, restore with `git stash pop`
3. **NEVER use `git checkout -- .`** or `git restore .` to discard changes
4. **NEVER use `git clean`** without explicit user confirmation

Example workflow:

```bash
# Save current changes before investigation
git stash push -m "WIP: saving before investigation"

# Do your investigation...

# Restore changes when done
git stash pop
```

If build issues occur, ask the user before discarding any changes.

## Related Documentation

This project has domain-specific CLAUDE.md files with detailed implementation guidance:

| File                    | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `src/webview/CLAUDE.md` | WebView architecture, Manager patterns, debugging |
| `src/test/CLAUDE.md`    | TDD workflow, test patterns, quality gates        |

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
# - Publishes to Open VSX Registry (if OVSX_PAT secret is configured)

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

# Publish to Open VSX Registry (for VS Codium, Gitpod, Eclipse Theia)
npm run ovsx:publish              # Build and publish
npm run ovsx:publish:vsix         # Publish existing VSIX files
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
LightweightTerminalWebviewManager (Coordinator)
├── ConsolidatedMessageManager  # Extension ↔ WebView communication
├── UIManager                   # Theme management and visual feedback
├── InputManager                # Keyboard/IME handling, Alt+Click support
├── PerformanceManager          # Output buffering (16ms flush interval)
├── NotificationManager         # User notifications
├── TerminalLifecycleCoordinator # Terminal creation/deletion
├── SplitManager                # Terminal split layout
├── ConfigManager               # Settings persistence
├── TerminalTabManager          # Tab management
├── DisplayModeManager          # Display mode control
└── HeaderManager               # Terminal header UI
```

> **Note**: For detailed WebView implementation guidance, see `src/webview/CLAUDE.md`

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
  preserveWrappedLines: true,
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
const fitAddon = lifecycleController.loadAddonLazy(terminalId, 'FitAddon', FitAddon, {
  lazy: true,
  cache: true,
});

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

- **Supported Agents**: Claude Code, GitHub Copilot, Gemini CLI, Codex CLI
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

- **Terminal Features**: Use `terminal-implementer` for production-ready terminal code (it invokes `terminal-expert` Skill automatically)
- **Code Analysis**: Use `serena-semantic-search` to find similar implementations in the codebase
- **Refactoring**: Use `similarity-based-refactoring` to identify patterns and improve code structure
- **Testing**: Use `tdd-quality-engineer` to implement comprehensive TDD tests

#### Skills vs Agents Pattern (Updated)

**Skills** provide domain knowledge (what to do):

- `terminal-expert` - Unified xterm.js + VS Code terminal knowledge
- `vscode-extension-expert` - VS Code extension development
- `mcp-*` Skills - MCP tool usage guidance

**Agents** execute tasks (how to do it) and **invoke Skills for knowledge**:

- `terminal-implementer` invokes `terminal-expert` Skill before implementing

#### Agent Workflow Example

```bash
# 1. Implement terminal feature (Agent automatically invokes terminal-expert Skill)
Task(terminal-implementer): "Implement terminal process lifecycle"

# 2. Search for similar implementations in our codebase
Task(serena-semantic-search): "Find terminal lifecycle management patterns"

# 3. Create comprehensive tests
Task(tdd-quality-engineer): "Create TDD tests for terminal lifecycle management"

# 4. Refactor for maintainability
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

| Skill                 | MCP Server      | Use When                                                                                                 |
| --------------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| `mcp-deepwiki`        | deepwiki        | Researching GitHub repositories, understanding library APIs, asking questions about open-source projects |
| `mcp-brave-search`    | brave-search    | Searching the web for current information, news, documentation, or local businesses                      |
| `mcp-playwright`      | playwright      | Browser automation, taking screenshots, filling forms, testing web applications                          |
| `mcp-firecrawl`       | firecrawl       | Web scraping, crawling websites, extracting structured data from web pages                               |
| `mcp-chrome-devtools` | chrome-devtools | Browser debugging, analyzing performance, inspecting network requests and console                        |

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
if (text.includes('github copilot')) {
}

// ✅ SECURE - Use regex with boundaries
if (/(^|\s)github copilot(\s|$)/i.test(text)) {
}
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

> **Note**: For detailed TDD implementation guidance, see `src/test/CLAUDE.md`

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

| Priority          | Scenarios | Release Requirement |
| ----------------- | --------- | ------------------- |
| P0 (Critical)     | 18        | 100% pass rate      |
| P1 (Important)    | 38        | ≥95% pass rate      |
| P2 (Nice-to-have) | 13        | ≥80% pass rate      |

**Implementation Status**: 87% complete (60+ scenarios)
**Test Files Location**: `src/test/e2e/tests/`

### Quick Commands

```bash
npx playwright test                    # Run all E2E tests
npx playwright test --headed           # With visible browser
npx playwright test --debug            # Debug mode
npx playwright show-report             # View test report
```

### Performance Benchmarks

```
Terminal creation: <500ms
Session restore: <3s (1000 lines)
AI agent detection: <500ms
WebView load: <3s
Terminal deletion: <100ms
```

### Detailed Documentation

For comprehensive E2E testing guides, see `src/test/e2e/`:

| Document                                                                    | Purpose                   |
| --------------------------------------------------------------------------- | ------------------------- |
| [QUICK_START.md](src/test/e2e/QUICK_START.md)                               | Get started in 5 minutes  |
| [DEBUGGING.md](src/test/e2e/DEBUGGING.md)                                   | Debug failing/flaky tests |
| [MAINTENANCE.md](src/test/e2e/MAINTENANCE.md)                               | Test suite maintenance    |
| [TEST_PLAN.md](src/test/e2e/TEST_PLAN.md)                                   | Full test scenarios       |
| [TEST_IMPLEMENTATION_STATUS.md](src/test/e2e/TEST_IMPLEMENTATION_STATUS.md) | Current status            |

### Playwright Agents (Claude Code)

- `playwright-test-planner` - Generate test scenarios
- `playwright-test-generator` - Implement tests
- `playwright-test-healer` - Debug and fix failing tests

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

5. **Open VSX Registry Publishing** (Optional):
   - Publishes to Open VSX for VS Codium, Gitpod, Eclipse Theia users
   - Runs in parallel with VS Code Marketplace publish
   - Uses `OVSX_PAT` secret for authentication
   - Skipped if `OVSX_PAT` is not configured

#### Required Secrets

- `VSCE_PAT`: Personal Access Token for VS Code Marketplace publishing
- `OVSX_PAT`: (Optional) Personal Access Token for Open VSX Registry
  - Create account at [open-vsx.org](https://open-vsx.org/)
  - Generate token from account settings
  - Add to GitHub repository secrets

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
