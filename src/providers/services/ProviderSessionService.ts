/**
 * ProviderSessionService
 *
 * Session persistence operations extracted from SecondaryTerminalProvider.
 * Handles saving and restoring terminal sessions.
 */

import { provider as log } from '../../utils/logger';
import { safeProcessCwd } from '../../utils/common';
import { WebviewMessage } from '../../types/common';
import { TIMING_CONSTANTS } from '../../constants/TimingConstants';

/**
 * Dependencies required by ProviderSessionService
 */
export interface IProviderSessionDependencies {
  // Persistence
  extensionPersistenceService: {
    saveCurrentSession(): Promise<{ success: boolean; error?: string }>;
    restoreSession(): Promise<{
      terminals: Array<{
        id: string;
        name: string;
        cwd?: string;
        isActive?: boolean;
        scrollback?: string[];
      }>;
    } | null>;
  } | null;

  // Terminal management
  getTerminals(): Array<{ id: string; name: string; cwd?: string }>;
  getActiveTerminalId(): string | null;
  createTerminal(): string;

  // Communication
  sendMessage(message: WebviewMessage): Promise<void>;

  // Settings
  getCurrentFontSettings(): Record<string, unknown>;
}

export class ProviderSessionService {
  constructor(private readonly deps: IProviderSessionDependencies) {}

  /**
   * Save the current session state
   */
  public async saveCurrentSession(): Promise<boolean> {
    if (!this.deps.extensionPersistenceService) {
      log('⚠️ [PERSISTENCE] Persistence service not available');
      return false;
    }

    try {
      log('💾 [PERSISTENCE] Saving current session...');
      const terminals = this.deps.getTerminals();

      const response = await this.deps.extensionPersistenceService.saveCurrentSession();

      if (response.success) {
        log(`✅ [PERSISTENCE] Session saved successfully: ${terminals.length} terminals`);
        return true;
      } else {
        log(`❌ [PERSISTENCE] Session save failed: ${response.error}`);
        return false;
      }
    } catch (error) {
      log(`❌ [PERSISTENCE] Save session error: ${error}`);
      return false;
    }
  }

  /**
   * Restore the last saved session
   */
  public async restoreLastSession(): Promise<boolean> {
    if (!this.deps.extensionPersistenceService) {
      log('⚠️ [PERSISTENCE] Persistence service not available');
      return false;
    }

    try {
      log('💾 [PERSISTENCE] Restoring last session...');
      const sessionResult = await this.deps.extensionPersistenceService.restoreSession();

      if (!sessionResult?.terminals?.length) {
        log('📦 [PERSISTENCE] No terminals to restore');
        return false;
      }

      log(`📦 [PERSISTENCE] Found ${sessionResult.terminals.length} terminals to restore`);

      const terminalMappings: Array<{
        oldId: string;
        newId: string;
        terminalData: (typeof sessionResult.terminals)[0];
      }> = [];

      const restoredTerminals: string[] = [];
      for (const terminalData of sessionResult.terminals) {
        try {
          const newTerminalId = this.deps.createTerminal();
          restoredTerminals.push(newTerminalId);
          terminalMappings.push({
            oldId: terminalData.id,
            newId: newTerminalId,
            terminalData,
          });
          log(`✅ [PERSISTENCE] Restored terminal: ${terminalData.name} (${newTerminalId})`);
        } catch (error) {
          log(`❌ [PERSISTENCE] Failed to restore terminal ${terminalData.name}:`, error);
        }
      }

      if (restoredTerminals.length > 0) {
        const fontSettings = this.deps.getCurrentFontSettings();

        // Send terminal creation notifications
        for (const mapping of terminalMappings) {
          await this.deps.sendMessage({
            command: 'terminalCreated',
            terminal: {
              id: mapping.newId,
              name: mapping.terminalData.name || `Terminal ${mapping.newId}`,
              cwd: mapping.terminalData.cwd || safeProcessCwd(),
              isActive: mapping.terminalData.isActive || false,
            },
            fontSettings,
          });
        }

        await new Promise((resolve) =>
          setTimeout(resolve, TIMING_CONSTANTS.WEBVIEW_INIT_DELAY_MS)
        );

        // Restore scrollback
        for (const mapping of terminalMappings) {
          if (
            mapping.terminalData.scrollback &&
            Array.isArray(mapping.terminalData.scrollback) &&
            mapping.terminalData.scrollback.length > 0
          ) {
            await this.deps.sendMessage({
              command: 'restoreScrollback',
              terminalId: mapping.newId,
              scrollback: mapping.terminalData.scrollback,
            });
          }
        }

        log(`✅ [PERSISTENCE] Restored ${restoredTerminals.length} terminals`);
        return true;
      }

      return false;
    } catch (error) {
      log(`❌ [PERSISTENCE] Restore session error: ${error}`);
      return false;
    }
  }
}
