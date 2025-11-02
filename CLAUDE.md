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