# E2E Test Plan Summary

Quick reference guide for the comprehensive E2E test plan.

**Full Test Plan**: [TEST_PLAN.md](./TEST_PLAN.md)

---

## Test Coverage Overview

**Total Scenarios**: 69
**Critical (P0)**: 18 scenarios
**Important (P1)**: 38 scenarios
**Nice-to-have (P2)**: 13 scenarios

---

## Test Areas

### 1. Terminal Lifecycle Management (6 scenarios)

**Priority Breakdown**: P0: 4 | P1: 2

**Critical Tests (P0)**:

- 1.1 Single Terminal Creation
- 1.2 Multiple Terminal Creation (up to 5)
- 1.3 Terminal Deletion
- 1.4 Terminal ID Recycling

**Important Tests (P1)**:

- 1.5 Rapid Terminal Creation (race conditions)
- 1.6 Last Terminal Protection

---

### 2. Session Persistence (5 scenarios)

**Priority Breakdown**: P0: 3 | P1: 2

**Critical Tests (P0)**:

- 2.1 Basic Session Save/Restore
- 2.2 Scrollback Restoration (1000 lines)
- 2.3 Multi-Terminal Session Restoration

**Important Tests (P1)**:

- 2.4 Session Expiry Cleanup (7-day limit)
- 2.5 AI Agent Session Handling

---

### 3. AI Agent Detection (6 scenarios)

**Priority Breakdown**: P0: 2 | P1: 3 | P2: 1

**Critical Tests (P0)**:

- 3.1 Claude Code Detection
- 3.6 Security: False Positive Prevention

**Important Tests (P1)**:

- 3.2 GitHub Copilot Detection
- 3.3 Gemini CLI Detection
- 3.4 Multi-Agent Scenarios

**Nice-to-have (P2)**:

- 3.5 Agent Termination Detection

---

### 4. WebView Interactions (8 scenarios)

**Priority Breakdown**: P0: 4 | P1: 3 | P2: 1

**Critical Tests (P0)**:

- 4.1 Keyboard Input
- 4.2 Alt+Click Cursor Positioning
- 4.5 Scrolling Behavior
- 4.6 ANSI Color Rendering

**Important Tests (P1)**:

- 4.3 IME Composition
- 4.4 Copy/Paste Functionality
- 4.8 Theme Changes

**Nice-to-have (P2)**:

- 4.7 Search in Terminal Output

---

### 5. Configuration Management (4 scenarios)

**Priority Breakdown**: P0: 2 | P1: 2

**Critical Tests (P0)**:

- 5.1 Font Settings
- 5.3 Max Terminals Limit

**Important Tests (P1)**:

- 5.2 Shell Selection
- 5.4 Feature Toggles

---

### 6. Split Terminal and Layout (3 scenarios)

**Priority Breakdown**: P1: 2 | P2: 1

**Important Tests (P1)**:

- 6.1 Vertical Split
- 6.2 Horizontal Split

**Nice-to-have (P2)**:

- 6.3 Maximum Split Terminals

---

### 7. Error Handling (5 scenarios)

**Priority Breakdown**: P0: 2 | P1: 3

**Critical Tests (P0)**:

- 7.1 Invalid Shell Path
- 7.3 Rapid Terminal Operations

**Important Tests (P1)**:

- 7.2 Non-Existent Working Directory
- 7.4 Memory Leak Prevention
- 7.5 Large Output Handling (>10MB)

---

### 8. Cross-Platform Compatibility (3 scenarios)

**Priority Breakdown**: P1: 3

**Important Tests (P1)**:

- 8.1 Windows-Specific Features
- 8.2 macOS-Specific Features
- 8.3 Linux-Specific Features

---

## Release Quality Gates

### Required for Release

- **P0 Tests**: 100% pass rate (18/18 scenarios)
- **P1 Tests**: ≥95% pass rate (36+/38 scenarios)
- **P2 Tests**: ≥80% pass rate (10+/13 scenarios)

### Performance Benchmarks

- Terminal creation: <500ms
- Session restore: <3s
- AI agent detection: <500ms
- WebView load: <3s

---

## Implementation Priority

### Phase 3.1 - Terminal Lifecycle (Week 1)

Focus: Scenarios 1.1-1.6

- Critical for basic functionality
- Foundation for other tests
- **Estimated Time**: 6 hours

### Phase 3.2 - WebView Interactions (Week 1-2)

Focus: Scenarios 4.1-4.8

- Core user interaction testing
- Visual regression validation
- **Estimated Time**: 8 hours

### Phase 3.3 - AI Agent Detection (Week 2)

Focus: Scenarios 3.1-3.6

- Unique extension feature
- Security validation
- **Estimated Time**: 6 hours

### Phase 3.4 - Configuration Management (Week 2)

Focus: Scenarios 5.1-5.4

- Settings validation
- User customization testing
- **Estimated Time**: 4 hours

### Phase 3.5 - Session Persistence (Week 2)

Focus: Scenarios 2.1-2.5

- Critical for user experience
- Data integrity validation
- **Estimated Time**: 5 hours

### Phase 3.6 - Error Handling & Edge Cases (Week 3)

Focus: Scenarios 7.1-7.5

- Robustness testing
- Graceful degradation
- **Estimated Time**: 4 hours

### Phase 3.7 - Cross-Platform & Split Layout (Week 3)

Focus: Scenarios 6.1-6.3, 8.1-8.3

- Platform-specific features
- Layout management
- **Estimated Time**: 5 hours

---

## Test Automation Readiness

### Ready for Automation (69 scenarios)

All scenarios marked as automatable with Playwright Test

### Mock Requirements

- **AI Agents**: Mock startup scripts for Claude, Copilot, Gemini
- **Shell Processes**: PTY process mocking for unit tests
- **VS Code API**: Extension API mocking

### Test Data

- Located in: `src/test/fixtures/e2e/`
- Terminal output samples
- AI agent output samples
- Configuration fixtures

---

## Key Assertions by Category

### Terminal Lifecycle

- Terminal ID assignment (1-5)
- Terminal count validation
- Terminal active state
- Process state transitions

### Session Persistence

- Scrollback line count (≤1000)
- Active terminal restoration
- Working directory preservation
- Session storage size (<20MB)

### AI Agent Detection

- Agent name detection accuracy
- Status indicator visibility
- State transition timing
- Pattern matching security (regex boundaries)

### WebView Interactions

- Input character accuracy
- Cursor position coordinates
- ANSI color rendering
- Theme application

### Configuration

- Setting value persistence
- Invalid value handling
- Feature toggle effects
- Cross-platform defaults

---

## Test Execution Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test area
npx playwright test src/test/e2e/tests/terminal/
npx playwright test src/test/e2e/tests/webview/
npx playwright test src/test/e2e/tests/agents/

# Run by priority
npx playwright test --grep "@P0"
npx playwright test --grep "@P1"

# Run with headed browser (visual)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug -- --grep "Single Terminal Creation"
```

---

## Related Documentation

- **Full Test Plan**: [TEST_PLAN.md](./TEST_PLAN.md)
- **Test Helpers**: [helpers/](./helpers/)
- **Test Fixtures**: [../fixtures/e2e/](../fixtures/e2e/)
- **Playwright Config**: [../../playwright.config.ts](../../playwright.config.ts)

---

**Last Updated**: 2025-11-01
**Status**: Test plan complete, ready for implementation
**Next Phase**: Phase 3 - Test Implementation
