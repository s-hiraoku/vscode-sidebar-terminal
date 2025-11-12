import { provider as log } from '../../utils/logger';
import { TerminalManager } from '../../terminals/TerminalManager';
import { getTerminalConfig, normalizeTerminalInfo } from '../../utils/common';
import { TERMINAL_CONSTANTS } from '../../constants';
import { TerminalErrorHandler } from '../../utils/feedback';

/**
 * Orchestrates terminal initialization and session restoration
 *
 * This service extracts initialization logic from SecondaryTerminalProvider
 * to provide a clean separation of concerns.
 */
export class InitializationOrchestrator {
  constructor(
    private readonly terminalManager: TerminalManager,
    private readonly sendMessage: (message: any) => Promise<void>
  ) {
    log('🎯 [InitOrchestrator] Initialization orchestrator created');
  }

  /**
   * Initialize terminal system
   */
  async initializeTerminal(getCurrentFontSettings: () => any): Promise<void> {
    log('🔧 [InitOrchestrator] Initializing terminal');

    try {
      const config = getTerminalConfig();
      const existingTerminals = this.terminalManager.getTerminals();

      log('🔧 [InitOrchestrator] Current terminals:', existingTerminals.length);
      existingTerminals.forEach((terminal) => {
        log(`🔧 [InitOrchestrator] - Terminal: ${terminal.name} (${terminal.id})`);
      });

      // VS CODE STANDARD: Don't create terminals during initialization
      // Let session restore or first user interaction handle terminal creation
      let terminalId: string | undefined;

      if (existingTerminals.length > 0) {
        // Terminals exist - use active one or first one
        const activeId = this.terminalManager.getActiveTerminalId();
        terminalId = activeId || existingTerminals[0]?.id;
        log('🔧 [InitOrchestrator] Using existing terminal:', terminalId);

        // For existing terminals, send terminalCreated messages
        // to ensure WebView recreates them (panel move scenario)
        for (const terminal of existingTerminals) {
          log('📤 [InitOrchestrator] Sending terminalCreated for existing terminal:', terminal.id);
          await this.sendMessage({
            command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
            terminalId: terminal.id,
            terminalName: terminal.name,
            config: config,
          });
        }
      } else {
        log(
          '📝 [InitOrchestrator] No existing terminals - will handle via session restore or user action'
        );
        terminalId = undefined;
      }

      // Send INIT message with all terminal info
      const initMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.INIT,
        config,
        terminals: this.terminalManager.getTerminals().map(normalizeTerminalInfo),
        activeTerminalId: terminalId,
      };

      await this.sendMessage(initMessage);

      // Send font settings
      const fontSettings = getCurrentFontSettings();
      await this.sendMessage({
        command: 'fontSettingsUpdate',
        fontSettings,
      });

      log('✅ [InitOrchestrator] Terminal initialization completed');
    } catch (error) {
      log('❌ [InitOrchestrator] Failed to initialize terminal:', error);
      TerminalErrorHandler.handleTerminalCreationError(error);
      throw error;
    }
  }

  /**
   * Ensure minimum number of terminals exist
   */
  ensureMinimumTerminals(): void {
    try {
      const terminals = this.terminalManager.getTerminals();
      const minTerminals = 1; // Could be configurable

      if (terminals.length < minTerminals) {
        log(
          `🎯 [InitOrchestrator] Ensuring minimum terminals (current: ${terminals.length}, min: ${minTerminals})`
        );

        const terminalsToCreate = minTerminals - terminals.length;
        for (let i = 0; i < terminalsToCreate; i++) {
          const terminalId = this.terminalManager.createTerminal();
          log(`✅ [InitOrchestrator] Created minimum terminal ${i + 1}/${terminalsToCreate}: ${terminalId}`);

          // Set first terminal as active
          if (i === 0) {
            this.terminalManager.setActiveTerminal(terminalId);
          }
        }
      }
    } catch (error) {
      log('❌ [InitOrchestrator] Failed to ensure minimum terminals:', error);
    }
  }

  /**
   * Schedule initial terminal creation
   */
  scheduleInitialTerminalCreation(delayMs: number = 100): void {
    log(`⏱️ [InitOrchestrator] Scheduling initial terminal creation (delay: ${delayMs}ms)`);

    setTimeout(() => {
      this.ensureMinimumTerminals();
    }, delayMs);
  }
}
