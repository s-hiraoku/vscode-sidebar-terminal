import { test, expect } from '@playwright/test';

/**
 * Standalone WebView E2E Tests
 *
 * These tests run against the standalone-webview.html fixture
 * which simulates the terminal WebView without VS Code.
 */
// TODO: Re-enable once standalone WebView is properly configured for E2E testing
// Currently requires complete WebView fixture setup
test.describe.skip('Standalone WebView Tests', () => {
  let baseUrl: string;

  test.beforeAll(() => {
    // Use the test server URL from global setup
    baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3333/standalone-webview.html';
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to the standalone WebView
    await page.goto(baseUrl);
    // Wait for the page to be ready
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Basic Functionality', () => {
    test('should load the WebView page successfully', async ({ page }) => {
      // Verify the page title
      const title = await page.title();
      expect(title).toContain('Terminal WebView');

      // Verify the header is visible
      const header = page.locator('#header');
      await expect(header).toBeVisible();

      // Verify the terminal body is visible
      const terminalBody = page.locator('#terminal-body');
      await expect(terminalBody).toBeVisible();
    });

    test('should display initial terminal tab', async ({ page }) => {
      // Wait for DOM to be ready
      await page.waitForSelector('.terminal-tab');

      // Verify Terminal 1 tab exists
      const tab = page.locator('.terminal-tab').first();
      await expect(tab).toBeVisible();
      await expect(tab).toContainText('Terminal 1');

      // Verify it's active
      await expect(tab).toHaveClass(/active/);
    });

    test('should hide loading indicator after initialization', async ({ page }) => {
      // Wait for loading to complete (500ms in the fixture)
      await page.waitForTimeout(600);

      // Verify loading indicator is hidden
      const loadingIndicator = page.locator('#loading-indicator');
      await expect(loadingIndicator).toHaveClass(/hidden/);
    });
  });

  test.describe('Terminal Tab Management', () => {
    test('should create new terminal when clicking + button', async ({ page }) => {
      // Wait for initial terminal
      await page.waitForSelector('.terminal-tab');

      // Get initial tab count
      const initialCount = await page.locator('.terminal-tab').count();
      expect(initialCount).toBe(1);

      // Click new terminal button
      await page.click('#btn-new-terminal');

      // Wait for new tab to appear
      await page.waitForSelector('.terminal-tab:nth-child(2)');

      // Verify two tabs exist
      const newCount = await page.locator('.terminal-tab').count();
      expect(newCount).toBe(2);

      // Verify new tab is named correctly
      const secondTab = page.locator('.terminal-tab').nth(1);
      await expect(secondTab).toContainText('Terminal 2');
    });

    test('should switch active terminal when clicking tab', async ({ page }) => {
      // Create a second terminal
      await page.click('#btn-new-terminal');
      await page.waitForSelector('.terminal-tab:nth-child(2)');

      // First tab should be active (new terminal becomes active)
      const secondTab = page.locator('.terminal-tab').nth(1);
      await expect(secondTab).toHaveClass(/active/);

      // Click first tab
      const firstTab = page.locator('.terminal-tab').first();
      await firstTab.click();

      // First tab should now be active
      await expect(firstTab).toHaveClass(/active/);
      await expect(secondTab).not.toHaveClass(/active/);
    });

    test('should close terminal when clicking close button', async ({ page }) => {
      // Create a second terminal
      await page.click('#btn-new-terminal');
      await page.waitForSelector('.terminal-tab:nth-child(2)');

      // Verify two tabs exist
      expect(await page.locator('.terminal-tab').count()).toBe(2);

      // Hover over the first tab to show close button
      const firstTab = page.locator('.terminal-tab').first();
      await firstTab.hover();

      // Click close button
      const closeBtn = firstTab.locator('.close-btn');
      await closeBtn.click();

      // Wait for tab to be removed
      await page.waitForFunction(() => {
        return document.querySelectorAll('.terminal-tab').length === 1;
      });

      // Verify only one tab remains
      expect(await page.locator('.terminal-tab').count()).toBe(1);
    });

    test('should not exceed maximum of 5 terminals', async ({ page }) => {
      // Create 4 more terminals (total 5)
      for (let i = 0; i < 4; i++) {
        await page.click('#btn-new-terminal');
        await page.waitForTimeout(100); // Small delay between creations
      }

      // Wait for all tabs
      await page.waitForFunction(() => {
        return document.querySelectorAll('.terminal-tab').length === 5;
      });

      // Verify 5 tabs exist
      expect(await page.locator('.terminal-tab').count()).toBe(5);

      // Try to create 6th terminal
      await page.click('#btn-new-terminal');

      // Wait for potential notification
      await page.waitForTimeout(200);

      // Verify still only 5 tabs
      expect(await page.locator('.terminal-tab').count()).toBe(5);

      // Verify warning notification appeared
      const notification = page.locator('.notification.warning');
      await expect(notification).toContainText('Maximum 5 terminals');
    });
  });

  test.describe('Action Buttons', () => {
    test('should have all action buttons visible', async ({ page }) => {
      const newBtn = page.locator('#btn-new-terminal');
      const splitBtn = page.locator('#btn-split-terminal');
      const killBtn = page.locator('#btn-kill-terminal');

      await expect(newBtn).toBeVisible();
      await expect(splitBtn).toBeVisible();
      await expect(killBtn).toBeVisible();
    });

    test('should have proper ARIA labels on action buttons', async ({ page }) => {
      const newBtn = page.locator('#btn-new-terminal');
      const splitBtn = page.locator('#btn-split-terminal');
      const killBtn = page.locator('#btn-kill-terminal');

      await expect(newBtn).toHaveAttribute('aria-label', 'New Terminal');
      await expect(splitBtn).toHaveAttribute('aria-label', 'Split Terminal');
      await expect(killBtn).toHaveAttribute('aria-label', 'Kill Terminal');
    });
  });

  test.describe('AI Agent Status', () => {
    test('should show agent status when agent is detected', async ({ page }) => {
      // Initially agent status should not be visible
      const agentStatus = page.locator('#agent-status');
      await expect(agentStatus).not.toHaveClass(/active/);

      // Simulate agent detection
      await page.evaluate(() => {
        (window as any).detectAgent('Claude Code');
      });

      // Agent status should be visible
      await expect(agentStatus).toHaveClass(/active/);
      await expect(agentStatus).toContainText('Claude Code');
    });

    test('should apply correct styling for different agents', async ({ page }) => {
      const agentStatus = page.locator('#agent-status');

      // Test Claude Code
      await page.evaluate(() => {
        (window as any).detectAgent('Claude Code');
      });
      await expect(agentStatus).toHaveClass(/claude-code/);

      // Test GitHub Copilot
      await page.evaluate(() => {
        (window as any).detectAgent('GitHub Copilot');
      });
      await expect(agentStatus).toHaveClass(/github-copilot/);

      // Test Gemini CLI
      await page.evaluate(() => {
        (window as any).detectAgent('Gemini CLI');
      });
      await expect(agentStatus).toHaveClass(/gemini-cli/);
    });

    test('should hide agent status when agent disconnects', async ({ page }) => {
      const agentStatus = page.locator('#agent-status');

      // Detect agent
      await page.evaluate(() => {
        (window as any).detectAgent('Claude Code');
      });
      await expect(agentStatus).toHaveClass(/active/);

      // Clear agent
      await page.evaluate(() => {
        (window as any).detectAgent(null);
      });
      await expect(agentStatus).not.toHaveClass(/active/);
    });
  });

  test.describe('Debug Panel', () => {
    test('should toggle debug panel with Ctrl+Shift+D', async ({ page }) => {
      const debugPanel = page.locator('#debug-panel');

      // Initially hidden
      await expect(debugPanel).not.toHaveClass(/visible/);

      // Press Ctrl+Shift+D
      await page.keyboard.press('Control+Shift+D');

      // Should be visible
      await expect(debugPanel).toHaveClass(/visible/);

      // Press again to hide
      await page.keyboard.press('Control+Shift+D');

      // Should be hidden
      await expect(debugPanel).not.toHaveClass(/visible/);
    });

    test('should display terminal state in debug panel', async ({ page }) => {
      // Show debug panel
      await page.keyboard.press('Control+Shift+D');

      const debugContent = page.locator('#debug-content');
      const content = await debugContent.textContent();

      // Verify state is displayed
      expect(content).toContain('terminals');
      expect(content).toContain('maxTerminals');
      expect(content).toContain('activeTerminalId');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA roles', async ({ page }) => {
      // Header toolbar
      const header = page.locator('#header');
      await expect(header).toHaveAttribute('role', 'toolbar');

      // Tab list
      const tabList = page.locator('.terminal-tabs');
      await expect(tabList).toHaveAttribute('role', 'tablist');

      // Individual tab
      const tab = page.locator('.terminal-tab').first();
      await expect(tab).toHaveAttribute('role', 'tab');

      // Notification container
      const notifications = page.locator('#notification-container');
      await expect(notifications).toHaveAttribute('role', 'alert');
    });

    test('should have proper aria-selected on tabs', async ({ page }) => {
      // Create second terminal
      await page.click('#btn-new-terminal');
      await page.waitForSelector('.terminal-tab:nth-child(2)');

      // Check aria-selected
      const firstTab = page.locator('.terminal-tab').first();
      const secondTab = page.locator('.terminal-tab').nth(1);

      // Second tab should be selected (newly created)
      await expect(secondTab).toHaveAttribute('aria-selected', 'true');
      await expect(firstTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  test.describe('Notifications', () => {
    test('should display notification and auto-dismiss', async ({ page }) => {
      // Trigger a notification by creating max terminals
      for (let i = 0; i < 4; i++) {
        await page.click('#btn-new-terminal');
        await page.waitForTimeout(50);
      }
      await page.click('#btn-new-terminal'); // 6th attempt

      // Notification should appear
      const notification = page.locator('.notification');
      await expect(notification.first()).toBeVisible();

      // Wait for auto-dismiss (3 seconds + buffer)
      await page.waitForTimeout(3500);

      // Notification should be gone
      await expect(page.locator('.notification.warning')).not.toBeVisible();
    });

    test('should show info notification on terminal ready', async ({ page }) => {
      // Navigate fresh to catch initial notification
      await page.goto(baseUrl);

      // Wait for terminal ready notification
      await page.waitForSelector('.notification.info');

      const notification = page.locator('.notification.info');
      await expect(notification).toContainText('Terminal ready');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should allow tab navigation through action buttons', async ({ page }) => {
      // Focus the first action button
      await page.focus('#btn-new-terminal');

      // Tab to next button
      await page.keyboard.press('Tab');

      // Verify focus moved to split button
      const splitBtn = page.locator('#btn-split-terminal');
      await expect(splitBtn).toBeFocused();

      // Tab to kill button
      await page.keyboard.press('Tab');

      const killBtn = page.locator('#btn-kill-terminal');
      await expect(killBtn).toBeFocused();
    });
  });
});
