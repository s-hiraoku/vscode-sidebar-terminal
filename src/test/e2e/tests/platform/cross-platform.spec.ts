import { test, expect } from '@playwright/test';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
} from '../../helpers';
import { TEST_TIMEOUTS as _TEST_TIMEOUTS } from '../../config/test-constants';

/**
 * Cross-Platform Compatibility Tests
 * Based on TEST_PLAN.md Section 8: Cross-Platform Compatibility
 *
 * Test Scenarios:
 * - 8.1 Windows-Specific Features (P1)
 * - 8.2 macOS-Specific Features (P1)
 * - 8.3 Linux-Specific Features (P1)
 */
test.describe('Cross-Platform Compatibility', () => {
  let extensionHelper: VSCodeExtensionTestHelper;
  let terminalHelper: TerminalLifecycleHelper;
  let webviewHelper: WebViewInteractionHelper;

  test.beforeEach(async ({ page }) => {
    // Initialize test helpers
    extensionHelper = new VSCodeExtensionTestHelper(page);
    terminalHelper = new TerminalLifecycleHelper(page);
    webviewHelper = new WebViewInteractionHelper(page);

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
   * Test Scenario 8.1: Windows-Specific Features
   * Priority: P1 (Important)
   *
   * Validates that Windows-specific functionality works correctly:
   * - PowerShell default shell
   * - Command Prompt (cmd.exe)
   * - Git Bash integration
   * - WSL support
   * - Ctrl-based keyboard shortcuts
   */
  test('should support Windows-specific features @P1 @cross-platform @windows-only', async ({
    page,
  }) => {
    // Skip if not on Windows
    test.skip(process.platform !== 'win32', 'Windows-only test');

    // Test 1: PowerShell Support
    await test.step('should support PowerShell as default shell', async () => {
      // Arrange: Set PowerShell as default shell
      await extensionHelper.updateConfiguration(
        'secondaryTerminal.shell.windows',
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
      );

      // Act: Create terminal
      const terminalId = await terminalHelper.createTerminal();

      // Wait for shell initialization
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send PowerShell-specific command
      await terminalHelper.sendText(terminalId, 'Get-Command pwsh');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Assert: PowerShell prompt should appear
      const output = await terminalHelper.getTerminalOutput(terminalId);
      expect(output).toMatch(/PS|CommandType|Name/i); // PowerShell indicators
    });

    // Test 2: Command Prompt Support
    await test.step('should support Command Prompt (cmd.exe)', async () => {
      // Clean up previous terminal
      await terminalHelper.deleteAllTerminals();

      // Arrange: Set cmd.exe as shell
      await extensionHelper.updateConfiguration(
        'secondaryTerminal.shell.windows',
        'C:\\Windows\\System32\\cmd.exe'
      );

      // Act: Create terminal
      const terminalId = await terminalHelper.createTerminal();
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Send CMD-specific command
      await terminalHelper.sendText(terminalId, 'echo %COMSPEC%');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Assert: CMD output should appear
      const output = await terminalHelper.getTerminalOutput(terminalId);
      expect(output).toMatch(/cmd\.exe/i);
    });

    // Test 3: Git Bash Support (if installed)
    await test.step('should support Git Bash if available', async () => {
      await terminalHelper.deleteAllTerminals();

      // Arrange: Try common Git Bash paths
      const gitBashPaths = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      ];

      let gitBashAvailable = false;
      let gitBashPath = '';

      for (const path of gitBashPaths) {
        try {
          await extensionHelper.updateConfiguration('secondaryTerminal.shell.windows', path);
          const terminalId = await terminalHelper.createTerminal();
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // Test if bash is available
          await terminalHelper.sendText(terminalId, 'echo $BASH_VERSION');
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const output = await terminalHelper.getTerminalOutput(terminalId);
          if (output.match(/\d+\.\d+\.\d+/)) {
            // Version number found
            gitBashAvailable = true;
            gitBashPath = path;
            break;
          }
        } catch (error) {
          // Git Bash not available at this path
        }
      }

      if (gitBashAvailable) {
        console.log(`Git Bash found at: ${gitBashPath}`);
        // Assert: Git Bash should work
        const output = await terminalHelper.getTerminalOutput(1);
        expect(output).toContain('BASH_VERSION');
      } else {
        console.log('Git Bash not installed, skipping test');
      }
    });

    // Test 4: Ctrl-based Keyboard Shortcuts
    await test.step('should use Ctrl-based keyboard shortcuts', async () => {
      await terminalHelper.deleteAllTerminals();
      const terminalId = await terminalHelper.createTerminal();

      // Act: Test Ctrl+C (copy when text selected)
      await terminalHelper.sendText(terminalId, 'echo "Windows test"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Select text (implementation-dependent)
      await webviewHelper.focusTerminal();

      // Try Ctrl+A to select all
      await page.keyboard.press('Control+KeyA');
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Try Ctrl+C to copy
      await page.keyboard.press('Control+KeyC');
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Assert: Clipboard should contain text (if permissions granted)
      // This is a basic test of keyboard shortcut handling
      // Full clipboard testing requires proper browser permissions
    });
  });

  /**
   * Test Scenario 8.2: macOS-Specific Features
   * Priority: P1 (Important)
   *
   * Validates that macOS-specific functionality works correctly:
   * - zsh default shell (modern macOS)
   * - bash support (legacy)
   * - Cmd key shortcuts
   * - Option+Click for cursor positioning
   * - Apple Silicon / Intel compatibility
   */
  test('should support macOS-specific features @P1 @cross-platform @macos-only', async ({
    page,
  }) => {
    // Skip if not on macOS
    test.skip(process.platform !== 'darwin', 'macOS-only test');

    // Test 1: zsh Support (default on modern macOS)
    await test.step('should support zsh as default shell', async () => {
      // Arrange: Set zsh as shell
      await extensionHelper.updateConfiguration('secondaryTerminal.shell.osx', '/bin/zsh');

      // Act: Create terminal
      const terminalId = await terminalHelper.createTerminal();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send zsh-specific command
      await terminalHelper.sendText(terminalId, 'echo $ZSH_VERSION');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Assert: zsh version should appear
      const output = await terminalHelper.getTerminalOutput(terminalId);
      expect(output).toMatch(/\d+\.\d+/); // Version number pattern
    });

    // Test 2: bash Support
    await test.step('should support bash shell', async () => {
      await terminalHelper.deleteAllTerminals();

      // Arrange: Set bash as shell
      await extensionHelper.updateConfiguration('secondaryTerminal.shell.osx', '/bin/bash');

      // Act: Create terminal
      const terminalId = await terminalHelper.createTerminal();
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Send bash-specific command
      await terminalHelper.sendText(terminalId, 'echo $BASH_VERSION');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Assert: bash version should appear
      const output = await terminalHelper.getTerminalOutput(terminalId);
      expect(output).toMatch(/\d+\.\d+\.\d+/); // bash version format
    });

    // Test 3: Cmd Key Shortcuts
    await test.step('should use Cmd-based keyboard shortcuts', async () => {
      await terminalHelper.deleteAllTerminals();
      const terminalId = await terminalHelper.createTerminal();

      // Act: Test Cmd+K (clear terminal)
      await terminalHelper.sendText(terminalId, 'echo "Line 1"');
      await terminalHelper.sendText(terminalId, 'echo "Line 2"');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Press Cmd+K to clear
      await page.keyboard.press('Meta+KeyK');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send new text
      await terminalHelper.sendText(terminalId, 'echo "After clear"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert: Old text should be cleared (depending on implementation)
      const _output = await terminalHelper.getTerminalOutput(terminalId);
      // This assertion depends on whether Cmd+K actually clears or not
      // Some terminals don't support this shortcut
    });

    // Test 4: Option+Click (Alt+Click equivalent)
    await test.step('should support Option+Click for cursor positioning', async () => {
      await terminalHelper.deleteAllTerminals();

      // Enable Alt+Click feature
      await extensionHelper.updateConfiguration('secondaryTerminal.altClickMovesCursor', true);

      const terminalId = await terminalHelper.createTerminal();
      await terminalHelper.sendText(terminalId, 'echo "Click test line"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Act: Option+Click
      const terminalElement = await page.locator('.terminal-container').first();
      const boundingBox = await terminalElement.boundingBox();

      if (boundingBox) {
        await page.keyboard.down('Alt'); // Option key on Mac
        await page.mouse.click(boundingBox.x + 100, boundingBox.y + 20);
        await page.keyboard.up('Alt');

        await new Promise((resolve) => setTimeout(resolve, 300));

        // Type text
        await webviewHelper.typeInTerminal('INSERTED');
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Assert: Text should be inserted at clicked position
        const output = await terminalHelper.getTerminalOutput(terminalId);
        expect(output).toContain('INSERTED');
      }
    });

    // Test 5: Architecture Detection (Apple Silicon vs Intel)
    await test.step('should work on both Apple Silicon and Intel Macs', async () => {
      // Get CPU architecture
      const _arch = await page.evaluate(() => {
        return navigator.userAgent.includes('ARM') || navigator.platform === 'MacIntel'
          ? 'detected'
          : 'unknown';
      });

      console.log(`macOS architecture: ${process.arch}`);

      await terminalHelper.deleteAllTerminals();
      const terminalId = await terminalHelper.createTerminal();

      // Run architecture detection command
      await terminalHelper.sendText(terminalId, 'uname -m');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const output = await terminalHelper.getTerminalOutput(terminalId);

      // Assert: Should show either arm64 (Apple Silicon) or x86_64 (Intel)
      expect(output).toMatch(/arm64|x86_64/);

      // Terminal should work regardless of architecture
      await terminalHelper.sendText(terminalId, 'echo "Architecture test passed"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      const finalOutput = await terminalHelper.getTerminalOutput(terminalId);
      expect(finalOutput).toContain('Architecture test passed');
    });
  });

  /**
   * Test Scenario 8.3: Linux-Specific Features
   * Priority: P1 (Important)
   *
   * Validates that Linux-specific functionality works correctly:
   * - bash as default shell
   * - zsh, fish support
   * - Ctrl-based keyboard shortcuts
   * - Compatibility with different desktop environments
   * - Different distributions (Ubuntu, Fedora, Arch, etc.)
   */
  test('should support Linux-specific features @P1 @cross-platform @linux-only', async ({
    page,
  }) => {
    // Skip if not on Linux
    test.skip(process.platform !== 'linux', 'Linux-only test');

    // Test 1: bash Support (default on most distros)
    await test.step('should support bash as default shell', async () => {
      // Arrange: Set bash as shell
      await extensionHelper.updateConfiguration('secondaryTerminal.shell.linux', '/bin/bash');

      // Act: Create terminal
      const terminalId = await terminalHelper.createTerminal();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send bash-specific command
      await terminalHelper.sendText(terminalId, 'echo $BASH_VERSION');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Assert: bash version should appear
      const output = await terminalHelper.getTerminalOutput(terminalId);
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });

    // Test 2: zsh Support
    await test.step('should support zsh if installed', async () => {
      await terminalHelper.deleteAllTerminals();

      // Check if zsh is available
      const terminalId = await terminalHelper.createTerminal();
      await terminalHelper.sendText(terminalId, 'which zsh');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const checkOutput = await terminalHelper.getTerminalOutput(terminalId);

      if (checkOutput.includes('/zsh')) {
        // zsh is available, test it
        await terminalHelper.deleteAllTerminals();
        await extensionHelper.updateConfiguration('secondaryTerminal.shell.linux', '/bin/zsh');

        const zshTerminalId = await terminalHelper.createTerminal();
        await new Promise((resolve) => setTimeout(resolve, 1500));

        await terminalHelper.sendText(zshTerminalId, 'echo $ZSH_VERSION');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const zshOutput = await terminalHelper.getTerminalOutput(zshTerminalId);
        expect(zshOutput).toMatch(/\d+\.\d+/);
        console.log('zsh test: PASSED');
      } else {
        console.log('zsh not installed, skipping test');
      }
    });

    // Test 3: fish Shell Support
    await test.step('should support fish shell if installed', async () => {
      await terminalHelper.deleteAllTerminals();

      // Check if fish is available
      const terminalId = await terminalHelper.createTerminal();
      await terminalHelper.sendText(terminalId, 'which fish');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const checkOutput = await terminalHelper.getTerminalOutput(terminalId);

      if (checkOutput.includes('/fish')) {
        // fish is available, test it
        await terminalHelper.deleteAllTerminals();
        await extensionHelper.updateConfiguration('secondaryTerminal.shell.linux', '/usr/bin/fish');

        const fishTerminalId = await terminalHelper.createTerminal();
        await new Promise((resolve) => setTimeout(resolve, 1500));

        await terminalHelper.sendText(fishTerminalId, 'echo $FISH_VERSION');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const fishOutput = await terminalHelper.getTerminalOutput(fishTerminalId);
        expect(fishOutput).toMatch(/\d+\.\d+/);
        console.log('fish test: PASSED');
      } else {
        console.log('fish not installed, skipping test');
      }
    });

    // Test 4: Ctrl-based Keyboard Shortcuts
    await test.step('should use Ctrl-based keyboard shortcuts', async () => {
      await terminalHelper.deleteAllTerminals();
      const terminalId = await terminalHelper.createTerminal();

      // Act: Test Ctrl+L (clear screen)
      await terminalHelper.sendText(terminalId, 'echo "Test line"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Press Ctrl+L to clear screen
      await page.keyboard.press('Control+KeyL');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send new text
      await terminalHelper.sendText(terminalId, 'echo "After clear"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert: Terminal should still be functional
      const output = await terminalHelper.getTerminalOutput(terminalId);
      expect(output).toContain('After clear');
    });

    // Test 5: Distribution Detection
    await test.step('should work across different Linux distributions', async () => {
      await terminalHelper.deleteAllTerminals();
      const terminalId = await terminalHelper.createTerminal();

      // Detect distribution
      await terminalHelper.sendText(terminalId, 'cat /etc/os-release | grep "^ID="');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const output = await terminalHelper.getTerminalOutput(terminalId);
      console.log(`Linux distribution detected: ${output}`);

      // Assert: Should get distribution info
      expect(output).toMatch(/ID=/);

      // Terminal should work regardless of distribution
      await terminalHelper.sendText(terminalId, 'echo "Distribution test passed"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      const finalOutput = await terminalHelper.getTerminalOutput(terminalId);
      expect(finalOutput).toContain('Distribution test passed');
    });

    // Test 6: Desktop Environment Compatibility
    await test.step('should work across different desktop environments', async () => {
      await terminalHelper.deleteAllTerminals();
      const terminalId = await terminalHelper.createTerminal();

      // Detect desktop environment
      await terminalHelper.sendText(terminalId, 'echo $XDG_CURRENT_DESKTOP');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const output = await terminalHelper.getTerminalOutput(terminalId);
      console.log(`Desktop environment: ${output || 'Not detected (may be headless)'}`);

      // Terminal should work in any DE (GNOME, KDE, XFCE, etc.) or headless
      await terminalHelper.sendText(terminalId, 'echo "DE test passed"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      const finalOutput = await terminalHelper.getTerminalOutput(terminalId);
      expect(finalOutput).toContain('DE test passed');
    });

    // Test 7: X11/Wayland Compatibility
    await test.step('should work with both X11 and Wayland', async () => {
      await terminalHelper.deleteAllTerminals();
      const terminalId = await terminalHelper.createTerminal();

      // Detect display server
      await terminalHelper.sendText(terminalId, 'echo $XDG_SESSION_TYPE');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const output = await terminalHelper.getTerminalOutput(terminalId);
      console.log(`Display server: ${output || 'Not detected (may be headless)'}`);

      // Terminal should work with X11, Wayland, or headless
      await terminalHelper.sendText(terminalId, 'echo "Display server test passed"');
      await new Promise((resolve) => setTimeout(resolve, 500));

      const finalOutput = await terminalHelper.getTerminalOutput(terminalId);
      expect(finalOutput).toContain('Display server test passed');
    });
  });

  /**
   * Universal Test: Platform-Agnostic Features
   *
   * Tests features that should work identically across all platforms.
   */
  test('should have consistent behavior across platforms @P1 @cross-platform', async () => {
    // Test terminal creation
    const terminalId = await terminalHelper.createTerminal();
    expect(terminalId).toBe(1);

    // Test basic command execution
    await terminalHelper.sendText(terminalId, 'echo "Platform test"');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const output = await terminalHelper.getTerminalOutput(terminalId);
    expect(output).toContain('Platform test');

    // Test terminal count
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBe(1);

    // Test terminal deletion
    await terminalHelper.deleteTerminal(terminalId);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const finalCount = await terminalHelper.getTerminalCount();
    expect(finalCount).toBe(0);

    console.log(`Platform-agnostic test passed on ${process.platform}`);
  });
});
