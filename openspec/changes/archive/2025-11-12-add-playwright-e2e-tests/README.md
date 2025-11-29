# OpenSpec Change: Add Playwright E2E Testing with AI Agent Support

## Quick Links

- **Proposal**: [proposal.md](./proposal.md)
- **Tasks**: [tasks.md](./tasks.md)
- **Design**: [design.md](./design.md)
- **Specs**: [specs/](./specs/)

## Summary

This change introduces comprehensive end-to-end testing using Playwright Test framework with MCP agent integration. The implementation leverages specialized Playwright agents (`playwright-test-planner` and `playwright-test-generator`) to create and maintain high-quality E2E tests for the VS Code Sidebar Terminal extension.

## Status

**Current Status**: ✅ Validated - Ready for Review

- [x] Proposal created
- [x] Tasks defined (47 tasks, ~10-13 days)
- [x] Design documented
- [x] Spec deltas created (5 capabilities)
- [x] OpenSpec validation passed

## Capabilities Added

### 1. E2E Test Infrastructure ([spec](./specs/e2e-test-infrastructure/spec.md))
- Playwright Test framework integration
- Test helpers and utilities
- Visual testing capabilities
- Debugging support

### 2. Terminal Lifecycle Testing ([spec](./specs/terminal-lifecycle-testing/spec.md))
- Terminal creation and deletion
- Session restoration
- Focus and switching
- Process lifecycle validation

### 3. WebView Interaction Testing ([spec](./specs/webview-interaction-testing/spec.md))
- Keyboard input handling
- Alt+Click cursor positioning
- IME input support
- Copy/paste functionality
- Scrolling and navigation

### 4. AI Agent Detection Testing ([spec](./specs/ai-agent-detection-testing/spec.md))
- Claude Code, GitHub Copilot, Gemini detection
- Multi-agent support
- Status transitions
- Visual feedback validation
- Security testing

### 5. Test Automation and CI/CD ([spec](./specs/test-automation-ci/spec.md))
- GitHub Actions integration
- Test failure reporting
- Retry logic and performance monitoring
- Artifact management
- Quality gates

## Key Requirements

- **Test Coverage**: 20+ E2E scenarios minimum
- **Execution Time**: <5 minutes in CI
- **Pass Rate**: 95%+ target
- **Visual Regression**: 0.1% pixel difference tolerance
- **Agent Usage**: Leverage playwright-test-planner and playwright-test-generator

## Implementation Timeline

- **Week 1**: Setup & Test Plan (2.1-2.2)
- **Week 2**: Test Implementation (3.1-3.5)
- **Week 3**: CI Integration & Documentation (5.1-6.3)

**Total Effort**: 10-13 working days

## Dependencies

- `@playwright/test` package
- Playwright MCP server (via Claude Code)
- VS Code Extension Test Runner
- GitHub Actions for CI/CD

## Next Steps

1. **Review**: Team reviews proposal, tasks, and design
2. **Approval**: Get sign-off from maintainers
3. **Implementation**: Execute tasks in order (see [tasks.md](./tasks.md))
4. **Validation**: Run `openspec validate add-playwright-e2e-tests`
5. **Apply**: Use `/openspec:apply` when ready to implement

## Commands

```bash
# Validate this change
openspec validate add-playwright-e2e-tests --strict

# View change details
openspec show add-playwright-e2e-tests

# View specs with deltas
openspec show add-playwright-e2e-tests --json --deltas-only

# List all tasks
cat tasks.md

# Start implementation (after approval)
/openspec:apply
```

## Related Documentation

- [CLAUDE.md](../../../CLAUDE.md) - Development guidelines
- [project.md](../../project.md) - Project context
- [Playwright Documentation](https://playwright.dev/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

## Validation Status

```
✅ OpenSpec validation: PASSED
✅ All spec files valid
✅ 6 requirements defined
✅ 47 tasks organized
✅ 5 capabilities specified
✅ Design document complete
```

---

**Created**: 2025-11-01
**Author**: Claude Code Agent
**Change ID**: add-playwright-e2e-tests
**Priority**: High
**Target Release**: v0.1.128+
