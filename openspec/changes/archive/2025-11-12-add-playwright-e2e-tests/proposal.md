# Proposal: Add Playwright E2E Testing with AI Agent Support

## Overview

Implement comprehensive end-to-end testing using Playwright Test MCP agents to validate VS Code extension functionality, terminal interactions, WebView UI, and AI agent detection features.

## Motivation

### Current State
- Existing E2E tests (`src/test/suite/e2e.test.ts`) only test basic VS Code API command execution
- No browser-based testing of WebView interactions (UI, theme changes, terminal output)
- No visual regression testing for terminal rendering
- Manual testing required for AI agent detection features
- Limited coverage of user workflows and edge cases

### Problems
1. **Limited Test Coverage**: Current E2E tests don't validate WebView UI interactions, terminal rendering, or visual behavior
2. **Manual Testing Overhead**: AI agent detection, Alt+Click, IME input require manual verification
3. **No Visual Regression**: Terminal rendering issues not caught until user reports
4. **Agent Testing Gap**: No automated tests for Claude Code, Copilot, Gemini detection
5. **Slow Feedback Loop**: Issues discovered late in development cycle

### Proposed Solution
Implement Playwright-based E2E test suite using MCP agents:

1. **playwright-test-planner agent**: Generate comprehensive test scenarios by exploring the live extension
2. **playwright-test-generator agent**: Implement automated tests for user workflows
3. **Test Categories**:
   - Terminal lifecycle (create, delete, restore sessions)
   - WebView UI interactions (clicks, typing, Alt+Click)
   - AI agent detection (Claude, Copilot, Gemini status indicators)
   - Configuration management (settings, theme changes)
   - Visual regression (terminal rendering, colors)

### Benefits
- **Automated Validation**: Catch UI/UX regressions automatically in CI/CD
- **Agent-Driven Test Creation**: Use specialized Playwright agents for comprehensive coverage
- **Visual Testing**: Validate terminal rendering, colors, AI status indicators
- **User Workflow Coverage**: Test real-world usage patterns end-to-end
- **Faster Development**: Immediate feedback on breaking changes
- **Production Confidence**: Verify extension works as expected before releases

## Scope

### In Scope
- Playwright Test framework integration with MCP agents
- Test plan creation using playwright-test-planner agent
- E2E test implementation using playwright-test-generator agent
- Terminal lifecycle tests (create, delete, restore)
- WebView interaction tests (UI clicks, typing, Alt+Click)
- AI agent detection tests (status indicators, visual feedback)
- Configuration management tests (settings changes)
- Visual regression testing setup
- CI/CD integration for automated test execution
- Test documentation and maintenance guidelines

### Out of Scope
- Unit test replacement (keep existing Mocha/Chai tests)
- Performance benchmarking (separate performance test suite exists)
- Load testing (separate concern)
- Manual exploratory testing procedures
- Browser compatibility testing (VS Code WebView only)

## User Impact

### End Users
- **Higher Quality**: Fewer bugs in released versions
- **Reliable Features**: AI agent detection, terminal interactions work consistently
- **Faster Bug Fixes**: Issues caught and fixed before release

### Developers
- **Faster Development**: Automated validation of changes
- **Confidence**: Know features work before merging PRs
- **Better Documentation**: Tests serve as usage examples
- **Easier Debugging**: Visual test failures show exactly what broke

## Implementation Approach

### Phase 1: Setup & Infrastructure (2-3 days)
1. Install Playwright Test MCP server
2. Configure test environment for VS Code extension
3. Set up test fixtures and helpers
4. Create CI/CD integration workflow

### Phase 2: Test Plan Creation (1-2 days)
1. Use `playwright-test-planner` agent to explore extension
2. Generate comprehensive test scenarios
3. Organize scenarios by feature area
4. Review and refine test plans

### Phase 3: Test Implementation (3-5 days)
1. Use `playwright-test-generator` agent for basic workflows
2. Implement terminal lifecycle tests
3. Implement WebView interaction tests
4. Implement AI agent detection tests
5. Implement configuration management tests
6. Add visual regression tests

### Phase 4: CI/CD Integration (1-2 days)
1. Add Playwright tests to GitHub Actions
2. Configure headless browser execution
3. Set up test artifact collection (screenshots, videos)
4. Add test reports to PR comments

### Phase 5: Documentation & Maintenance (1 day)
1. Document test execution procedures
2. Create troubleshooting guide
3. Define test maintenance responsibilities
4. Update CLAUDE.md with Playwright guidelines

## Dependencies

- Playwright Test MCP server (available via Claude Code)
- VS Code Extension Test Runner
- Existing test infrastructure (Mocha/Chai remains)
- GitHub Actions for CI/CD

## Risks & Mitigation

### Risk: Flaky Tests
**Mitigation**:
- Use Playwright's auto-waiting and retry mechanisms
- Implement proper test isolation
- Add explicit wait conditions where needed

### Risk: CI Performance Impact
**Mitigation**:
- Run E2E tests in parallel where possible
- Use headless mode in CI
- Cache Playwright browsers
- Run E2E tests only on significant PRs (separate workflow)

### Risk: Maintenance Overhead
**Mitigation**:
- Keep tests focused and isolated
- Use page object pattern for reusability
- Document test patterns in CLAUDE.md
- Regular test review and cleanup

### Risk: VS Code Extension Complexity
**Mitigation**:
- Start with simple scenarios
- Gradually add complex workflows
- Use Playwright's debugging tools
- Leverage playwright-test-generator agent for best practices

## Success Criteria

1. **Test Coverage**:
   - 20+ E2E test scenarios covering critical user workflows
   - All AI agent detection features tested
   - WebView UI interactions validated

2. **CI Integration**:
   - E2E tests run on every PR
   - Test results reported in PR comments
   - Screenshots/videos captured on failures

3. **Quality Metrics**:
   - 0 false positives in CI
   - <5 minute E2E test execution time
   - 95%+ test pass rate

4. **Documentation**:
   - Test execution guide in CLAUDE.md
   - Troubleshooting documentation
   - Agent usage examples

## Timeline

- **Week 1**: Setup, infrastructure, test plan creation
- **Week 2**: Test implementation, CI integration
- **Week 3**: Documentation, refinement, launch

**Total Estimated Effort**: 10-15 days

## Open Questions

1. Should E2E tests run on every commit or only on PRs?
2. What visual regression threshold is acceptable?
3. Should we test on multiple VS Code versions?
4. How do we handle AI agent tests without actual CLI tools installed?

## Related Changes

- None (new capability)

## Metadata

- **Author**: Claude Code Agent
- **Created**: 2025-11-01
- **Status**: Proposal
- **Priority**: High
- **Target Release**: v0.1.128+
