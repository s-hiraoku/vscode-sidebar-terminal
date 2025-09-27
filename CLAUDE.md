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
MAX_SCROLLBACK = 1000; // Lines to persist
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
- **Build Platform-Specific**: Creates platform packages
- **CodeQL**: Security scanning (check regex patterns)

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