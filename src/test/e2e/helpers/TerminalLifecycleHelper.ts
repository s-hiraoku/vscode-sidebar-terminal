import { Page } from '@playwright/test';
import { TEST_TIMEOUTS, TERMINAL_CONSTANTS } from '../config/test-constants';

/**
 * Terminal information interface
 */
export interface TerminalInfo {
  id: number;
  name: string;
  isActive: boolean;
  processId?: number;
}

/**
 * Helper class for terminal lifecycle operations
 * Provides utilities for creating, deleting, and managing terminals
 */
export class TerminalLifecycleHelper {
  constructor(private page: Page) {}

  /**
   * Create a new terminal
   * @param waitForPrompt - Whether to wait for shell prompt
   * @returns Terminal ID
   */
  async createTerminal(waitForPrompt: boolean = true): Promise<number> {
    // Future: Execute create terminal command
    console.log('[E2E] Creating terminal...');

    if (waitForPrompt) {
      await this.page.waitForTimeout(TEST_TIMEOUTS.TERMINAL_CREATION);
    }

    // Future: Return actual terminal ID
    return 1;
  }

  /**
   * Delete a terminal by ID
   * @param terminalId - ID of terminal to delete
   */
  async deleteTerminal(terminalId: number): Promise<void> {
    console.log(`[E2E] Deleting terminal ${terminalId}...`);
    // Future: Execute delete terminal command
  }

  /**
   * Delete all terminals
   */
  async deleteAllTerminals(): Promise<void> {
    console.log('[E2E] Deleting all terminals...');
    // Future: Delete each terminal
  }

  /**
   * Switch to terminal by ID
   * @param terminalId - ID of terminal to focus
   */
  async switchToTerminal(terminalId: number): Promise<void> {
    console.log(`[E2E] Switching to terminal ${terminalId}...`);
    // Future: Execute focus terminal command
  }

  /**
   * Get list of all terminals
   * @returns Array of terminal information
   */
  async listTerminals(): Promise<TerminalInfo[]> {
    // Future: Query terminal list from extension
    return [];
  }

  /**
   * Get active terminal ID
   * @returns ID of currently active terminal
   */
  async getActiveTerminalId(): Promise<number | null> {
    // Future: Query active terminal from extension
    return null;
  }

  /**
   * Wait for terminal to be ready
   * @param terminalId - Terminal ID to wait for
   * @param timeout - Maximum wait time
   */
  async waitForTerminalReady(
    terminalId: number,
    timeout: number = TEST_TIMEOUTS.TERMINAL_CREATION
  ): Promise<void> {
    console.log(`[E2E] Waiting for terminal ${terminalId} to be ready...`);
    await this.page.waitForTimeout(timeout);
  }

  /**
   * Send text to terminal
   * @param terminalId - Target terminal ID
   * @param text - Text to send
   */
  async sendText(terminalId: number, text: string): Promise<void> {
    console.log(`[E2E] Sending to terminal ${terminalId}: ${text}`);
    // Future: Send text to terminal
  }

  /**
   * Get terminal output
   * @param _terminalId - Terminal ID
   * @returns Terminal output text
   */
  async getTerminalOutput(_terminalId: number): Promise<string> {
    // Future: Read terminal output
    return '';
  }

  /**
   * Check if terminal exists
   * @param terminalId - Terminal ID to check
   * @returns True if terminal exists
   */
  async terminalExists(terminalId: number): Promise<boolean> {
    const terminals = await this.listTerminals();
    return terminals.some((t) => t.id === terminalId);
  }

  /**
   * Get terminal count
   * @returns Number of active terminals
   */
  async getTerminalCount(): Promise<number> {
    const terminals = await this.listTerminals();
    return terminals.length;
  }

  /**
   * Verify terminal ID is within valid range
   * @param terminalId - Terminal ID to validate
   * @returns True if valid
   */
  isValidTerminalId(terminalId: number): boolean {
    return TERMINAL_CONSTANTS.TERMINAL_IDS.includes(terminalId as 1 | 2 | 3 | 4 | 5);
  }
}
