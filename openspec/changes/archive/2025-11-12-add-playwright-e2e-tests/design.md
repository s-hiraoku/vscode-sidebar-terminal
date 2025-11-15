# Design: Playwright E2E Testing Architecture

## Overview

This document outlines the architectural design for implementing comprehensive end-to-end testing using Playwright Test with MCP agent integration for the VS Code Sidebar Terminal extension.

## Goals

1. **Comprehensive Coverage**: Test all critical user workflows end-to-end
2. **Agent-Driven Development**: Leverage Playwright MCP agents for test planning and generation
3. **Fast Feedback**: Provide quick feedback in CI (<5 minute execution time)
4. **Visual Validation**: Catch visual regressions and UI bugs automatically
5. **Maintainability**: Create sustainable test infrastructure that scales with the project

## Non-Goals

- Replace existing unit/integration tests (Mocha/Chai remains)
- Performance benchmarking (separate test suite handles this)
- Browser compatibility testing (VS Code WebView only)
- Manual testing procedures

## Architecture

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     E2E Test Suite                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Terminal    │  │   WebView    │  │  AI Agent    │     │
│  │  Lifecycle   │  │ Interaction  │  │  Detection   │     │
│  │    Tests     │  │    Tests     │  │    Tests     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │    Config    │  │   Visual     │                       │
│  │ Management   │  │  Regression  │                       │
│  │    Tests     │  │    Tests     │                       │
│  └──────────────┘  └──────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ uses
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Test Infrastructure                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │           Playwright Test Framework             │       │
│  │  - Browser automation                           │       │
│  │  - Test runner and reporting                    │       │
│  │  - Screenshot/video/trace capture               │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Playwright MCP Agents                   │       │
│  │  - playwright-test-planner (test scenarios)     │       │
│  │  - playwright-test-generator (test impl)        │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │          Test Helpers & Utilities               │       │
│  │  - VSCodeExtensionTestHelper                    │       │
│  │  - WebViewInteractionHelper                     │       │
│  │  - TerminalLifecycleHelper                      │       │
│  │  - VisualTestingUtility                         │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ runs on
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              VS Code Extension Under Test                   │
├─────────────────────────────────────────────────────────────┤
│  - Extension Host (Node.js)                                │
│  - WebView (Browser context)                               │
│  - Terminal Managers                                        │
│  - Session Management                                       │
│  - AI Agent Detection                                       │
└─────────────────────────────────────────────────────────────┘
```

### Test Organization

```
src/test/e2e/
├── config/
│   ├── playwright.config.ts        # Playwright configuration
│   └── test-constants.ts           # Test timeouts, paths, etc.
├── helpers/
│   ├── VSCodeExtensionTestHelper.ts
│   ├── WebViewInteractionHelper.ts
│   ├── TerminalLifecycleHelper.ts
│   └── VisualTestingUtility.ts
├── fixtures/
│   ├── terminal-output/            # Sample terminal outputs
│   ├── ai-agent-output/            # Mock AI agent outputs
│   ├── configurations/             # Test configurations
│   └── screenshots/                # Baseline screenshots
├── tests/
│   ├── terminal/
│   │   ├── creation.spec.ts
│   │   ├── deletion.spec.ts
│   │   ├── session-restore.spec.ts
│   │   └── focus-switching.spec.ts
│   ├── webview/
│   │   ├── rendering.spec.ts
│   │   ├── keyboard-input.spec.ts
│   │   ├── alt-click.spec.ts
│   │   ├── ime-input.spec.ts
│   │   └── copy-paste.spec.ts
│   ├── agents/
│   │   ├── claude-code.spec.ts
│   │   ├── github-copilot.spec.ts
│   │   ├── multi-agent.spec.ts
│   │   └── status-transitions.spec.ts
│   ├── config/
│   │   ├── settings.spec.ts
│   │   └── theme-changes.spec.ts
│   └── visual/
│       ├── ansi-colors.spec.ts
│       └── ai-indicators.spec.ts
├── TEST_PLAN.md                    # Test scenarios and coverage
└── MAINTENANCE.md                  # Test maintenance guide
```

## Key Design Decisions

### 1. Test Framework Choice: Playwright Test

**Decision**: Use Playwright Test over alternatives (Puppeteer, Selenium, Cypress)

**Rationale**:
- **MCP Agent Integration**: Claude Code provides playwright-test-planner and playwright-test-generator agents
- **Modern API**: Async/await, auto-waiting, retry logic built-in
- **VS Code Support**: Can test WebView components effectively
- **Rich Reporting**: Built-in HTML reports, screenshots, videos, traces
- **Performance**: Fast execution, parallel test support
- **Active Development**: Well-maintained by Microsoft

**Trade-offs**:
- Learning curve for team members unfamiliar with Playwright
- Additional dependency in the project
- Requires browser installation in CI

### 2. Agent-Driven Test Creation

**Decision**: Use Playwright MCP agents for test planning and initial implementation

**Rationale**:
- **Consistency**: Agents follow best practices and patterns
- **Coverage**: Planner agent explores UI comprehensively to identify test scenarios
- **Speed**: Generator agent creates boilerplate code quickly
- **Maintainability**: Generated tests follow consistent patterns

**Workflow**:
1. Use `playwright-test-planner` to explore extension and generate test scenarios
2. Review and prioritize scenarios (human oversight)
3. Use `playwright-test-generator` to implement high-priority tests
4. Refine and customize generated tests as needed
5. Add edge cases and error scenarios manually

**Trade-offs**:
- Agents may generate tests that need refinement
- Requires Claude Code access for optimal workflow
- Generated code should be reviewed for quality

### 3. Test Isolation Strategy

**Decision**: Each test should be independent with proper setup/teardown

**Rationale**:
- **Reliability**: Tests don't depend on execution order
- **Parallelization**: Tests can run concurrently
- **Debugging**: Failures are isolated and easier to diagnose
- **Maintainability**: Tests can be modified independently

**Implementation**:
```typescript
test.beforeEach(async ({ page }) => {
  // Activate extension
  await extensionHelper.activate();
  // Create fresh terminal
  await terminalHelper.createTerminal();
});

test.afterEach(async () => {
  // Clean up terminals
  await terminalHelper.deleteAllTerminals();
  // Dispose extension resources
  await extensionHelper.dispose();
});
```

### 4. Visual Testing Approach

**Decision**: Use Playwright's built-in visual comparison with configurable tolerance

**Rationale**:
- **Regression Detection**: Catch visual bugs automatically
- **Baseline Management**: Easy to update baselines when intentional changes occur
- **Cross-platform**: Works consistently in CI and locally
- **Threshold Configuration**: 0.1% pixel difference tolerance by default

**Implementation**:
```typescript
await expect(page).toHaveScreenshot('terminal-with-colors.png', {
  maxDiffPixels: 100,  // 0.1% tolerance
  threshold: 0.1,
});
```

**Trade-offs**:
- Baselines need to be maintained when UI changes
- Can be sensitive to minor rendering differences
- Requires careful threshold tuning

### 5. CI/CD Integration Strategy

**Decision**: Dedicated E2E workflow that runs on PR changes to `src/` or `test/` directories

**Rationale**:
- **Focused Execution**: Don't run E2E tests for documentation changes
- **Fast Feedback**: Parallel execution with sharding (<5 min target)
- **Clear Reporting**: PR comments with test results and failure artifacts
- **Quality Gate**: Block merges on E2E test failures

**Workflow Triggers**:
- Pull request opened/updated
- Push to `main` or `for-publish` branches
- Manual workflow dispatch (for testing)

**Optimizations**:
- Browser caching to speed up CI
- Test sharding for parallelization
- Retry logic for transient failures
- Artifact upload only on failures (screenshots, videos, traces)

### 6. Test Data Management

**Decision**: Use fixtures for consistent test data, with mock AI agent outputs

**Rationale**:
- **Reproducibility**: Same inputs produce same results
- **Coverage**: Test edge cases with crafted inputs
- **Speed**: No need for actual AI agent CLIs in CI
- **Safety**: No external dependencies or API calls

**Fixture Types**:
- Terminal output samples (ANSI colors, Unicode, long output)
- AI agent startup/activity messages
- Configuration objects (valid and invalid)
- Baseline screenshots for visual comparison

**Trade-offs**:
- Fixtures need maintenance as features evolve
- May not catch integration issues with real AI agents
- Fixture data should be version-controlled

### 7. Error Handling and Debugging

**Decision**: Comprehensive debugging support with traces, videos, and headed mode

**Rationale**:
- **Developer Experience**: Easy to debug failures locally
- **CI Debugging**: Traces and videos show what went wrong
- **Documentation**: Debugging guide helps team troubleshoot issues

**Debugging Features**:
- `--headed` mode for visual debugging locally
- Automatic trace recording on failures
- Video capture on failures (CI only)
- VS Code launch configurations for debugging tests
- Detailed error messages with screenshots

## Performance Considerations

### Test Execution Time

**Target**: <5 minutes total E2E test execution in CI

**Strategies**:
1. **Parallelization**: Run tests concurrently using Playwright sharding
2. **Selective Execution**: Skip visual tests if no UI changes
3. **Fast Setup**: Cache browsers, reuse extension builds
4. **Timeout Tuning**: Set appropriate timeouts (default 30s per test)

**Monitoring**:
- Track test execution times in CI
- Alert on performance regressions (>20% slower)
- Identify and optimize slow tests

### Resource Usage

**Constraints**:
- CI Memory: GitHub Actions runners have 7GB RAM
- CI CPU: 2-core runners
- Artifact Size: Keep under 100MB per workflow run

**Optimizations**:
- Run browsers in headless mode (lower memory)
- Compress videos and screenshots
- Clean up artifacts older than 30 days
- Limit scrollback in test terminals

## Security Considerations

### Test Environment Isolation

- Tests run in isolated VS Code Extension Host
- No access to production data or credentials
- Test fixtures don't contain sensitive information
- CI secrets used only for necessary authentication

### Agent Detection Testing

- Use regex patterns with word boundaries (security requirement)
- Test for XSS and injection vulnerabilities
- Validate security patterns meet CodeQL standards
- No false positives from malicious output

## Migration and Rollout Plan

### Phase 1: Infrastructure Setup (Week 1)
1. Install Playwright Test and configure
2. Create test helpers and utilities
3. Set up CI workflow
4. Validate end-to-end with 1-2 simple tests

### Phase 2: Test Implementation (Week 2)
1. Use planner agent to generate test scenarios
2. Implement terminal lifecycle tests
3. Implement WebView interaction tests
4. Implement AI agent detection tests

### Phase 3: Visual & CI Integration (Week 3)
1. Add visual regression tests
2. Optimize CI execution time
3. Add PR comment reporting
4. Document test procedures

### Phase 4: Refinement & Launch
1. Fix flaky tests
2. Tune retry logic and timeouts
3. Create developer documentation
4. Announce E2E test suite to team

## Monitoring and Metrics

### Key Metrics

1. **Test Coverage**: Number of E2E scenarios covered
   - Target: 20+ scenarios minimum
   - Track: Critical user workflows covered

2. **Test Reliability**: Pass rate over time
   - Target: 95%+ pass rate
   - Track: Flaky test rate (<5%)

3. **Execution Time**: Total CI execution time
   - Target: <5 minutes
   - Track: Per-test execution times

4. **Bug Detection**: E2E tests catching bugs
   - Track: Bugs caught before release
   - Track: False positive rate (<5%)

### Dashboards

- CI workflow success rate over time
- Test execution time trends
- Flaky test identification
- Visual regression detection rate

## Open Questions and Future Work

### Open Questions

1. **Visual Regression Tolerance**: Is 0.1% pixel difference appropriate?
   - **Resolution**: Start with 0.1%, adjust based on false positives

2. **AI Agent Testing**: How to test without actual CLI tools?
   - **Resolution**: Use mock fixtures for agent output patterns

3. **Test Data Maintenance**: Who updates baselines when UI changes?
   - **Resolution**: PR author updates baselines, reviewers verify

### Future Enhancements

1. **Cross-Platform Testing**: Test on Windows, macOS, Linux
2. **VS Code Version Matrix**: Test on multiple VS Code versions
3. **Accessibility Testing**: Add WCAG compliance tests
4. **Performance Profiling**: Integrate performance metrics in E2E tests
5. **Chaos Engineering**: Test resilience with random failures

## References

- [Playwright Test Documentation](https://playwright.dev/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Claude Code Playwright Agents](https://docs.anthropic.com/claude/docs/playwright-agents)
- [GitHub Actions CI/CD](https://docs.github.com/en/actions)

## Approval

This design should be reviewed by:
- [ ] Extension maintainers
- [ ] QA/Testing leads
- [ ] CI/CD infrastructure team
- [ ] Developer experience team

---

**Version**: 1.0
**Last Updated**: 2025-11-01
**Status**: Proposed
