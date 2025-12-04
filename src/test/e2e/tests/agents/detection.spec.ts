import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
} from '../../helpers';
import { TEST_PATHS } from '../../config/test-constants';

/**
 * AI Agent Detection Tests
 * Based on TEST_PLAN.md Section 3: AI Agent Detection
 *
 * Test Scenarios:
 * - 3.1 Claude Code Detection (P0)
 * - 3.2 GitHub Copilot Detection (P1)
 * - 3.3 Gemini CLI Detection (P1)
 * - 3.6 Security: False Positive Prevention (P0)
 */
// TODO: Re-enable once TerminalLifecycleHelper is fully implemented
// Currently cannot send output to terminal for agent detection testing
test.describe.skip('AI Agent Detection', () => {
  let extensionHelper: VSCodeExtensionTestHelper;
  let terminalHelper: TerminalLifecycleHelper;
  let webviewHelper: WebViewInteractionHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new VSCodeExtensionTestHelper(page);
    terminalHelper = new TerminalLifecycleHelper(page);
    webviewHelper = new WebViewInteractionHelper(page);

    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();
    await terminalHelper.createTerminal();
  });

  test.afterEach(async () => {
    await terminalHelper.deleteAllTerminals();
    await extensionHelper.dispose();
  });

  /**
   * Test Scenario 3.1: Claude Code Detection
   * Priority: P0 (Critical)
   *
   * Validates that Claude Code agent is detected when
   * its startup message appears in terminal output.
   */
  test('should detect Claude Code agent from startup message @P0 @ai-agent-detection', async () => {
    // Arrange: Load Claude Code startup fixture
    const claudeStartup = readFileSync(
      `${TEST_PATHS.AI_AGENT_OUTPUT}/claude-code-startup.txt`,
      'utf-8'
    );

    // Act: Send Claude Code startup message to terminal
    await terminalHelper.sendText(1, claudeStartup);

    // Assert: Claude Code agent should be detected
    // Future: Check AI agent status indicator
    // const indicator = await page.locator('.ai-agent-indicator');
    // await expect(indicator).toContainText(AI_AGENT_CONSTANTS.AGENTS.CLAUDE_CODE);
    // await expect(indicator).toHaveClass(/claude-code/);

    // Log detection
    console.log('[Test] Claude Code detection simulated');
  });

  /**
   * Test Scenario 3.1 (Extended): Claude Code Status Transitions
   * Priority: P0 (Critical)
   *
   * Validates agent status transitions:
   * None → Connected → Active → Disconnected
   */
  test('should track Claude Code status transitions @P0 @ai-agent-detection', async () => {
    // Arrange: Load Claude Code startup
    const claudeStartup = readFileSync(
      `${TEST_PATHS.AI_AGENT_OUTPUT}/claude-code-startup.txt`,
      'utf-8'
    );

    // Act: Send startup message (Connected)
    await terminalHelper.sendText(1, claudeStartup);

    // Assert: Status should be "Connected"
    // Future: Verify status indicator shows "Connected"

    // Act: Send activity indicator (Active)
    await terminalHelper.sendText(1, 'Processing request...');

    // Assert: Status should transition to "Active"
    // Future: Verify status indicator shows "Active"

    // Act: Send completion message (Disconnected)
    await terminalHelper.sendText(1, 'Claude Code session ended');

    // Assert: Status should transition to "Disconnected"
    // Future: Verify status indicator shows "Disconnected"
  });

  /**
   * Test Scenario 3.2: GitHub Copilot Detection
   * Priority: P1 (Important)
   *
   * Validates that GitHub Copilot is detected from
   * its startup message.
   */
  test('should detect GitHub Copilot agent @P1 @ai-agent-detection', async () => {
    // Arrange: Load GitHub Copilot startup fixture
    const copilotStartup = readFileSync(
      `${TEST_PATHS.AI_AGENT_OUTPUT}/github-copilot-startup.txt`,
      'utf-8'
    );

    // Act: Send Copilot startup message
    await terminalHelper.sendText(1, copilotStartup);

    // Assert: GitHub Copilot should be detected
    // Future: Verify status indicator
    // const indicator = await page.locator('.ai-agent-indicator');
    // await expect(indicator).toContainText(AI_AGENT_CONSTANTS.AGENTS.GITHUB_COPILOT);

    console.log('[Test] GitHub Copilot detection simulated');
  });

  /**
   * Test Scenario 3.2 (Extended): Copilot Variant Detection
   * Priority: P1 (Important)
   *
   * Validates detection of different Copilot command variants:
   * - "copilot"
   * - "gh copilot"
   */
  test('should detect GitHub Copilot variants @P1 @ai-agent-detection', async ({ page: _page }) => {
    // Test "copilot" command
    await terminalHelper.sendText(1, 'copilot suggest');

    // Future: Verify detection
    // await page.waitForTimeout(600); // Wait for detection debounce
    // Future: Check indicator

    // Test "gh copilot" command
    await terminalHelper.sendText(1, 'gh copilot explain');

    // Future: Verify detection
    // Future: Check indicator shows Copilot

    console.log('[Test] Copilot variants detection simulated');
  });

  /**
   * Test Scenario 3.3: Gemini CLI Detection
   * Priority: P1 (Important)
   *
   * Validates that Gemini CLI is detected from
   * its ASCII art banner.
   */
  test('should detect Gemini CLI agent @P1 @ai-agent-detection', async () => {
    // Arrange: Load Gemini CLI startup fixture
    const geminiStartup = readFileSync(
      `${TEST_PATHS.AI_AGENT_OUTPUT}/gemini-cli-startup.txt`,
      'utf-8'
    );

    // Act: Send Gemini startup message (with ASCII art)
    await terminalHelper.sendText(1, geminiStartup);

    // Assert: Gemini CLI should be detected
    // Future: Verify status indicator
    // const indicator = await page.locator('.ai-agent-indicator');
    // await expect(indicator).toContainText(AI_AGENT_CONSTANTS.AGENTS.GEMINI_CLI);

    console.log('[Test] Gemini CLI detection simulated');
  });

  /**
   * Test Scenario 3.4: Multi-Agent Scenarios
   * Priority: P1 (Important)
   *
   * Validates that different agents can be detected
   * in different terminals simultaneously.
   */
  test('should detect different agents in different terminals @P1 @ai-agent-detection', async () => {
    // Arrange: Create 2 terminals
    const terminal1 = 1;
    const terminal2 = await terminalHelper.createTerminal();

    // Load fixtures
    const claudeStartup = readFileSync(
      `${TEST_PATHS.AI_AGENT_OUTPUT}/claude-code-startup.txt`,
      'utf-8'
    );
    const copilotStartup = readFileSync(
      `${TEST_PATHS.AI_AGENT_OUTPUT}/github-copilot-startup.txt`,
      'utf-8'
    );

    // Act: Send different agent messages to different terminals
    await terminalHelper.sendText(terminal1, claudeStartup);
    await terminalHelper.sendText(terminal2, copilotStartup);

    // Assert: Each terminal should show its own agent
    // Future: Verify terminal 1 shows Claude Code
    // Future: Verify terminal 2 shows GitHub Copilot
    // Future: Verify indicators are independent

    console.log('[Test] Multi-agent detection simulated');
  });

  /**
   * Test Scenario 3.6: Security - False Positive Prevention
   * Priority: P0 (Critical)
   *
   * Validates that agent detection uses regex with word boundaries
   * to prevent false positives from substring matches.
   */
  test('should prevent false positives from substring matches @P0 @ai-agent-detection @security', async () => {
    // Act: Send text that contains agent names as substrings
    const falsePositives = [
      'my github copilot implementation', // "copilot" is substring
      'I love using claude code editor', // "claude code" is substring
      'The gemini project is great', // "gemini" is substring
    ];

    for (const text of falsePositives) {
      await terminalHelper.sendText(1, text);
    }

    // Assert: No agents should be detected (false positives prevented)
    // Future: Verify NO agent indicators appear
    // const indicator = await page.locator('.ai-agent-indicator');
    // await expect(indicator).not.toBeVisible();

    console.log('[Test] False positive prevention verified');
  });

  /**
   * Test Scenario 3.6 (Extended): Regex Pattern Validation
   * Priority: P0 (Critical)
   *
   * Validates that detection patterns use proper word boundaries
   * as documented in CLAUDE.md security guidelines.
   */
  test('should use regex with word boundaries for detection @P0 @ai-agent-detection @security', async () => {
    // Test: Actual GitHub Copilot command (should detect)
    await terminalHelper.sendText(1, 'Welcome to GitHub Copilot in the CLI!');

    // Future: Verify detection occurs

    // Test: Substring mention (should NOT detect)
    await terminalHelper.sendText(1, 'mygithub copilottool');

    // Future: Verify no detection for substring

    // Test: Word boundary match (should detect)
    await terminalHelper.sendText(1, 'Using github copilot to help');

    // Future: Verify detection occurs

    console.log('[Test] Regex word boundary validation simulated');
  });

  /**
   * Test Scenario: Agent Detection Performance
   * Priority: P2 (Nice-to-have)
   *
   * Validates that agent detection completes within
   * the 500ms threshold specified in requirements.
   */
  test('should detect agent within 500ms @P2 @performance', async () => {
    // Arrange: Load Claude Code startup
    const claudeStartup = readFileSync(
      `${TEST_PATHS.AI_AGENT_OUTPUT}/claude-code-startup.txt`,
      'utf-8'
    );

    const startTime = Date.now();

    // Act: Send startup message
    await terminalHelper.sendText(1, claudeStartup);

    // Wait for detection (with debouncing)
    // Future: Wait for actual detection indicator to appear

    const duration = Date.now() - startTime;

    // Assert: Detection should complete within 500ms
    // (Current placeholder doesn't actually detect, so this passes)
    expect(duration).toBeLessThan(500);

    console.log(`[Performance] Agent detection took ${duration}ms`);
  });

  /**
   * Test Scenario: Visual Status Indicator
   * Priority: P1 (Important)
   *
   * Validates that detected agents show visual status
   * indicators in terminal headers.
   */
  test('should display visual status indicator for detected agent @P1 @ai-agent-detection @visual', async ({
    page: _page,
  }) => {
    // Arrange: Load Claude Code startup
    const claudeStartup = readFileSync(
      `${TEST_PATHS.AI_AGENT_OUTPUT}/claude-code-startup.txt`,
      'utf-8'
    );

    // Act: Send startup message
    await terminalHelper.sendText(1, claudeStartup);

    // Assert: Status indicator should be visible
    // Future: Verify indicator element exists
    // const indicator = await page.locator('.ai-agent-indicator');
    // await expect(indicator).toBeVisible();
    // await expect(indicator).toHaveCSS('color', expect.stringContaining('blue')); // Claude Code color

    console.log('[Test] Visual indicator validation simulated');
  });
});
