# Spec: E2E Test Infrastructure

## ADDED Requirements

### Requirement: Playwright Test Framework Integration
**Priority**: P0
**Status**: Proposed

The extension SHALL integrate Playwright Test framework with MCP agent support for end-to-end testing of VS Code extension functionality.

#### Scenario: Install Playwright Test with MCP support
**Given** the project has existing Mocha/Chai test infrastructure
**When** Playwright Test is added as a development dependency
**Then** the package.json SHALL include `@playwright/test` in devDependencies
**And** the Playwright Test MCP server SHALL be available via Claude Code agents
**And** existing unit tests SHALL continue to work without conflicts

#### Scenario: Configure Playwright for VS Code extension testing
**Given** Playwright Test is installed
**When** the test configuration is created
**Then** a `playwright.config.ts` file SHALL exist in the project root
**And** the configuration SHALL specify VS Code extension test environment
**And** the configuration SHALL support both headed and headless modes
**And** the configuration SHALL enable screenshot and video capture on failures

---

### Requirement: Test Directory Structure
**Priority**: P0
**Status**: Proposed

The E2E test suite SHALL follow a clear directory structure that separates concerns and enables maintainability.

#### Scenario: Organize E2E tests by feature area
**Given** Playwright Test is configured
**When** E2E tests are created
**Then** tests SHALL be organized in `src/test/e2e/` directory
**And** tests SHALL be grouped by feature: `terminal/`, `webview/`, `agents/`, `config/`
**And** shared helpers SHALL exist in `src/test/e2e/helpers/`
**And** test fixtures SHALL exist in `src/test/fixtures/e2e/`

#### Scenario: Maintain separation from unit tests
**Given** E2E tests exist in `src/test/e2e/`
**When** tests are executed
**Then** E2E tests SHALL NOT interfere with unit tests in `src/test/unit/`
**And** test runners SHALL be configurable to run E2E or unit tests separately
**And** CI workflows SHALL be able to run test suites independently

---

### Requirement: VS Code Extension Test Helpers
**Priority**: P0
**Status**: Proposed

The E2E test infrastructure SHALL provide reusable helpers for common VS Code extension testing patterns.

#### Scenario: Extension activation helper
**Given** an E2E test needs to interact with the extension
**When** the test setup runs
**Then** a helper SHALL activate the extension automatically
**And** the helper SHALL wait for extension activation to complete
**And** the helper SHALL verify the extension is active before proceeding
**And** activation failures SHALL be reported with clear error messages

#### Scenario: WebView interaction helper
**Given** a test needs to interact with the terminal WebView
**When** the WebView helper is used
**Then** the helper SHALL locate the WebView element
**And** the helper SHALL provide methods for clicking, typing, scrolling
**And** the helper SHALL handle WebView iframe context switching
**And** the helper SHALL wait for WebView to be fully loaded

#### Scenario: Terminal creation helper
**Given** a test needs a terminal instance
**When** the terminal creation helper is invoked
**Then** the helper SHALL create a terminal via VS Code command
**And** the helper SHALL wait for terminal to be fully initialized
**And** the helper SHALL return a handle to the terminal instance
**And** the helper SHALL support creating multiple terminals

---

### Requirement: Test Fixtures and Mock Data
**Priority**: P1
**Status**: Proposed

The E2E test suite SHALL include realistic test fixtures and mock data for consistent testing.

#### Scenario: Terminal output fixtures
**Given** tests need to verify terminal rendering
**When** test fixtures are loaded
**Then** sample terminal output files SHALL exist with ANSI color codes
**And** fixtures SHALL include long output (scrollback testing)
**And** fixtures SHALL include special characters (Unicode, emojis)
**And** fixtures SHALL include AI agent output samples

#### Scenario: Configuration fixtures
**Given** tests need to verify configuration handling
**When** configuration fixtures are used
**Then** fixtures SHALL include valid configuration objects
**And** fixtures SHALL include invalid configuration edge cases
**And** fixtures SHALL include theme configuration samples
**And** fixtures SHALL be version-controlled and documented

---

### Requirement: Visual Testing Utilities
**Priority**: P1
**Status**: Proposed

The E2E test infrastructure SHALL provide utilities for visual regression testing and screenshot comparison.

#### Scenario: Screenshot capture utility
**Given** a test needs to verify visual appearance
**When** the screenshot utility is invoked
**Then** the utility SHALL capture full page screenshots
**And** the utility SHALL support element-specific screenshots
**And** the utility SHALL save screenshots with descriptive names
**And** the utility SHALL organize screenshots by test and date

#### Scenario: Visual comparison utility
**Given** a test needs to detect visual regressions
**When** visual comparison is performed
**Then** the utility SHALL compare current screenshot with baseline
**And** the utility SHALL calculate pixel difference percentage
**And** the utility SHALL highlight differences in output
**And** the utility SHALL support configurable tolerance thresholds (default 0.1%)

---

### Requirement: Test Debugging Support
**Priority**: P2
**Status**: Proposed

The E2E test infrastructure SHALL provide debugging tools for troubleshooting test failures.

#### Scenario: Headed mode for visual debugging
**Given** a developer needs to debug a failing test
**When** tests are run with `--headed` flag
**Then** the browser SHALL open in visible mode
**And** the developer SHALL see the test execution in real-time
**And** the browser SHALL pause on failures for inspection
**And** developer tools SHALL be accessible for debugging

#### Scenario: Trace recording for failure analysis
**Given** an E2E test fails in CI
**When** the test failure is investigated
**Then** a trace file SHALL be automatically recorded
**And** the trace SHALL include screenshots at each step
**And** the trace SHALL include network activity logs
**And** the trace SHALL be downloadable from CI artifacts

---

## Cross-References

**Related Requirements**:
- REQ-TERM-LIFECYCLE-* (terminal-lifecycle-testing)
- REQ-WEBVIEW-INTERACT-* (webview-interaction-testing)
- REQ-AI-DETECT-TEST-* (ai-agent-detection-testing)

**Related Changes**:
- None (new capability)
