import { test, expect } from '@playwright/test';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
} from '../../helpers';
import { TERMINAL_CONSTANTS as _TERMINAL_CONSTANTS } from '../../config/test-constants';

/**
 * Session Persistence Tests
 * Based on TEST_PLAN.md Section 2: Session Persistence and Restoration
 *
 * Test Scenarios:
 * - 2.1 Basic Session Save and Restore (P0)
 * - 2.2 Scrollback Restoration (P1)
 * - 2.3 Multi-Terminal Session Restoration (P1)
 * - 2.4 Session Expiry and Cleanup (P2)
 * - 2.5 Session Save/Restore with AI Agents (P1)
 */
test.describe('Session Persistence', () => {
  let extensionHelper: VSCodeExtensionTestHelper;
  let terminalHelper: TerminalLifecycleHelper;
  let webviewHelper: WebViewInteractionHelper;

  test.beforeEach(async ({ page }) => {
    // Initialize test helpers
    extensionHelper = new VSCodeExtensionTestHelper(page);
    terminalHelper = new TerminalLifecycleHelper(page);
    webviewHelper = new WebViewInteractionHelper(page);

    // Enable persistent sessions
    await extensionHelper.updateConfiguration('secondaryTerminal.enablePersistentSessions', true);
    await extensionHelper.updateConfiguration(
      'secondaryTerminal.persistentSessionReviveProcess',
      'onExitAndWindowClose'
    );

    // Activate extension
    await extensionHelper.activateExtension();

    // Wait for WebView to load
    await webviewHelper.waitForWebViewLoad();
  });

  test.afterEach(async () => {
    // Clean up all terminals
    await terminalHelper.deleteAllTerminals();

    // Dispose extension resources
    await extensionHelper.dispose();
  });

  /**
   * Test Scenario 2.1: Basic Session Save and Restore
   * Priority: P0 (Critical)
   *
   * Validates that terminal sessions can be saved and restored
   * across VS Code restarts with scrollback and working directory preserved.
   */
  test('should save and restore basic terminal session @P0 @session-persistence', async () => {
    // Arrange: Create terminals with content
    const terminal1Id = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal1Id, 'cd /tmp');
    await terminalHelper.sendText(terminal1Id, 'echo "Terminal 1 test"');

    const terminal2Id = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal2Id, 'ls -la');

    // Wait for commands to complete
    await webviewHelper.waitForTerminalOutput('Terminal 1 test', TEST_TIMEOUTS.COMMAND_EXECUTION);

    // Act: Trigger session save
    await extensionHelper.executeCommand('secondaryTerminal.saveSession');

    // Wait for save to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate VS Code reload
    await extensionHelper.reloadVSCode();

    // Wait for extension to reactivate
    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();

    // Assert: Both terminals should be restored
    const restoredCount = await terminalHelper.getTerminalCount();
    expect(restoredCount).toBe(2);

    // Assert: Terminal 1 should have scrollback
    const terminal1Output = await terminalHelper.getTerminalOutput(1);
    expect(terminal1Output).toContain('Terminal 1 test');

    // Assert: Terminal 2 should have scrollback
    const terminal2Output = await terminalHelper.getTerminalOutput(2);
    expect(terminal2Output).toContain('ls');

    // Assert: Active terminal should be preserved
    // (Last active terminal should be restored as active)
    const activeId = await terminalHelper.getActiveTerminalId();
    expect(activeId).toBeGreaterThanOrEqual(1);
    expect(activeId).toBeLessThanOrEqual(2);
  });

  /**
   * Test Scenario 2.2: Scrollback Restoration
   * Priority: P1 (Important)
   *
   * Validates that scrollback is preserved up to the configured limit
   * (default 1000 lines) across session restores.
   */
  test('should restore scrollback up to configured limit @P1 @session-persistence', async () => {
    // Arrange: Set scrollback limit
    await extensionHelper.updateConfiguration('secondaryTerminal.persistentSessionScrollback', 1000);

    const terminalId = await terminalHelper.createTerminal();

    // Generate 1500 lines of output (exceeds limit)
    const generateLinesCommand = 'for i in {1..1500}; do echo "Line $i"; done';
    await terminalHelper.sendText(terminalId, generateLinesCommand);

    // Wait for output generation to complete
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Act: Save and restore session
    await extensionHelper.executeCommand('secondaryTerminal.saveSession');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await extensionHelper.reloadVSCode();
    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();

    // Assert: Terminal should be restored
    const restoredCount = await terminalHelper.getTerminalCount();
    expect(restoredCount).toBe(1);

    // Assert: Scrollback should contain last 1000 lines
    const output = await terminalHelper.getTerminalOutput(1);
    const _lines = output.split('\n');

    // Last 1000 lines should be preserved (Lines 501-1500)
    expect(output).toContain('Line 1500');
    expect(output).toContain('Line 501');

    // First 500 lines should NOT be preserved (exceeds limit)
    expect(output).not.toContain('Line 1 '); // Space to avoid matching "Line 1000"
    expect(output).not.toContain('Line 500');
  });

  /**
   * Test Scenario 2.3: Multi-Terminal Session Restoration
   * Priority: P1 (Important)
   *
   * Validates that multiple terminals with different states
   * are restored correctly with proper ordering and IDs.
   */
  test('should restore multiple terminals with correct IDs and order @P1 @session-persistence', async () => {
    // Arrange: Create 5 terminals with different activities
    const terminals: Array<{ id: number; activity: string }> = [];

    // Terminal 1: Change directory and list files
    const terminal1 = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal1, 'cd ~/');
    await terminalHelper.sendText(terminal1, 'ls');
    terminals.push({ id: terminal1, activity: 'cd-ls' });

    // Terminal 2: Echo command
    const terminal2 = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal2, 'echo "Terminal 2"');
    terminals.push({ id: terminal2, activity: 'echo' });

    // Terminal 3: Print working directory
    const terminal3 = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal3, 'pwd');
    terminals.push({ id: terminal3, activity: 'pwd' });

    // Terminal 4: Date command
    const terminal4 = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal4, 'date');
    terminals.push({ id: terminal4, activity: 'date' });

    // Terminal 5: Whoami command
    const terminal5 = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal5, 'whoami');
    terminals.push({ id: terminal5, activity: 'whoami' });

    // Set terminal 3 as active
    await terminalHelper.switchToTerminal(3);

    // Wait for commands to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Act: Save and restore session
    await extensionHelper.executeCommand('secondaryTerminal.saveSession');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await extensionHelper.reloadVSCode();
    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();

    // Assert: All 5 terminals should be restored
    const restoredCount = await terminalHelper.getTerminalCount();
    expect(restoredCount).toBe(5);

    // Assert: Terminal IDs should match (1-5)
    const restoredTerminals = await terminalHelper.listTerminals();
    const restoredIds = restoredTerminals.map((t) => t.id).sort();
    expect(restoredIds).toEqual([1, 2, 3, 4, 5]);

    // Assert: Terminal 3 should be active
    const activeId = await terminalHelper.getActiveTerminalId();
    expect(activeId).toBe(3);

    // Assert: Each terminal should have appropriate scrollback
    const terminal1Output = await terminalHelper.getTerminalOutput(1);
    expect(terminal1Output).toMatch(/ls|home/i);

    const terminal2Output = await terminalHelper.getTerminalOutput(2);
    expect(terminal2Output).toContain('Terminal 2');

    const terminal3Output = await terminalHelper.getTerminalOutput(3);
    expect(terminal3Output).toMatch(/\//); // Should contain path

    // Note: date and whoami outputs are time-sensitive, so we just verify
    // terminals exist and have some content
    const terminal4Output = await terminalHelper.getTerminalOutput(4);
    expect(terminal4Output.length).toBeGreaterThan(0);

    const terminal5Output = await terminalHelper.getTerminalOutput(5);
    expect(terminal5Output.length).toBeGreaterThan(0);
  });

  /**
   * Test Scenario 2.4: Session Expiry and Cleanup
   * Priority: P2 (Nice-to-have)
   *
   * Validates that expired sessions (older than 7 days) are not restored
   * and are cleaned up from storage.
   */
  test('should not restore expired sessions older than 7 days @P2 @session-persistence', async () => {
    // Arrange: Create terminal with content
    const terminalId = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminalId, 'echo "Old session"');

    // Act: Save session
    await extensionHelper.executeCommand('secondaryTerminal.saveSession');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Manually modify session timestamp to 8 days old
    // This requires accessing VS Code global storage
    await extensionHelper.executeCommand('secondaryTerminal.expireSession', {
      days: 8,
    });

    // Reload VS Code
    await extensionHelper.reloadVSCode();
    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();

    // Assert: No terminals should be restored (expired session)
    const restoredCount = await terminalHelper.getTerminalCount();
    expect(restoredCount).toBe(0);

    // Assert: New fresh terminal can be created
    const newTerminalId = await terminalHelper.createTerminal();
    expect(newTerminalId).toBe(1);

    // Assert: Old session data should be cleaned from storage
    const hasExpiredData = await extensionHelper.executeCommand(
      'secondaryTerminal.checkExpiredSessionData'
    );
    expect(hasExpiredData).toBe(false);
  });

  /**
   * Test Scenario 2.5: Session Save/Restore with AI Agents
   * Priority: P1 (Important)
   *
   * Validates that terminals with AI agent sessions (Claude Code, Gemini CLI)
   * are restored correctly with scrollback, but agent status shows "Disconnected"
   * (since the agent process is not restarted).
   */
  test('should restore terminals with AI agent scrollback @P1 @session-persistence @ai-agent-detection', async ({
    page,
  }) => {
    // Arrange: Create terminal with Claude Code mock output
    const terminal1Id = await terminalHelper.createTerminal();

    // Simulate Claude Code startup banner and output
    const claudeOutput = `
Claude Code v1.0 (Mock)
Type "exit" to quit

claude> write a hello world script
Claude: Processing: write a hello world script
✓ Complete
`;
    await terminalHelper.sendText(terminal1Id, claudeOutput);

    // Create regular terminal
    const terminal2Id = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal2Id, 'echo "Regular terminal"');

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Act: Save and restore session
    await extensionHelper.executeCommand('secondaryTerminal.saveSession');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await extensionHelper.reloadVSCode();
    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();

    // Assert: Both terminals should be restored
    const restoredCount = await terminalHelper.getTerminalCount();
    expect(restoredCount).toBe(2);

    // Assert: Terminal 1 should have Claude Code scrollback
    const terminal1Output = await terminalHelper.getTerminalOutput(1);
    expect(terminal1Output).toContain('Claude Code');
    expect(terminal1Output).toContain('hello world');

    // Assert: Claude Code status should show "Disconnected"
    // (Agent process is not automatically restarted)
    const agentStatus = await page.locator('[data-testid="ai-agent-status-1"]').textContent();
    expect(agentStatus).toMatch(/disconnected|none/i);

    // Assert: Terminal 2 should have normal scrollback
    const terminal2Output = await terminalHelper.getTerminalOutput(2);
    expect(terminal2Output).toContain('Regular terminal');

    // Assert: No attempt to restart Claude Code automatically
    // (Verify no new Claude Code process spawned)
    const processes = await extensionHelper.executeCommand('secondaryTerminal.listProcesses');
    const claudeProcess = processes.find((p: any) => p.command.includes('claude'));
    expect(claudeProcess).toBeUndefined();
  });

  /**
   * Performance Test: Session Restore Time
   *
   * Validates that session restore completes within acceptable time limits.
   */
  test('should restore session within performance limits @P1 @session-persistence @performance', async () => {
    // Arrange: Create 5 terminals with scrollback
    for (let i = 0; i < 5; i++) {
      const terminalId = await terminalHelper.createTerminal();
      await terminalHelper.sendText(terminalId, `echo "Terminal ${i + 1}"`);
      // Generate 100 lines of output per terminal
      await terminalHelper.sendText(
        terminalId,
        `for j in {1..100}; do echo "Line $j of terminal ${i + 1}"; done`
      );
    }

    // Wait for output generation
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Act: Save session
    await extensionHelper.executeCommand('secondaryTerminal.saveSession');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Measure restore time
    const startTime = Date.now();

    await extensionHelper.reloadVSCode();
    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();

    // Wait for all terminals to be fully restored
    let restoredCount = 0;
    while (restoredCount < 5 && Date.now() - startTime < 10000) {
      restoredCount = await terminalHelper.getTerminalCount();
      if (restoredCount < 5) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const restoreTime = Date.now() - startTime;

    // Assert: Session restore should complete within 3 seconds
    expect(restoreTime).toBeLessThan(3000);

    // Assert: All terminals restored
    expect(restoredCount).toBe(5);

    console.log(`Session restore time: ${restoreTime}ms`);
  });
});
