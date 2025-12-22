import { TerminalManager } from '../terminals/TerminalManager';
import { ExtensionPersistenceService } from '../services/persistence/ExtensionPersistenceService';
import { terminal as log } from '../utils/logger';

type InitializationCompleteSender = (terminalCount: number) => Promise<void>;

export interface TerminalInitializationActions {
  initializeTerminal: () => Promise<void>;
  ensureMinimumTerminals: () => void;
  sendInitializationComplete: InitializationCompleteSender;
  restoreLastSession: () => Promise<boolean>;
}

export class TerminalInitializationCoordinator {
  constructor(
    private readonly terminalManager: TerminalManager,
    private readonly actions: TerminalInitializationActions,
    private readonly extensionPersistenceService?: ExtensionPersistenceService
  ) {}

  public async initialize(): Promise<void> {
    try {
      log('🔍 [TERMINAL-INIT] Starting coordinated terminal initialization...');
      await this.actions.initializeTerminal();
      log('✅ [TERMINAL-INIT] Basic initialization completed');

      const currentCount = this.terminalManager.getTerminals().length;
      log(`🔍 [TERMINAL-INIT] Current terminal count: ${currentCount}`);

      await this.restoreTerminalsIfNeeded(currentCount);

      // 🎯 OPTIMIZATION: Unified initialization complete message with verification
      // Reduced from 500ms + 1000ms (2 messages) to single 800ms message
      this.scheduleUnifiedInitializationComplete();
    } catch (error) {
      log('❌ [TERMINAL-INIT] Critical initialization error:', error);
      this.attemptEmergencyTerminalCreation();
    }
  }

  private async restoreTerminalsIfNeeded(currentTerminalCount: number): Promise<void> {
    if (currentTerminalCount > 0) {
      this.logExistingTerminals(currentTerminalCount);
      return;
    }

    log('📦 [TERMINAL-INIT] No existing terminals - attempting coordinated restoration...');
    const restorationSucceeded = await this.attemptSessionRestoration();

    if (!restorationSucceeded) {
      log('🆕 [TERMINAL-INIT] No sessions found - creating default terminals');
      this.actions.ensureMinimumTerminals();
    } else {
      // 🎯 FIX: After restoration, notify WebView about the restored terminals
      log('🎯 [TERMINAL-INIT] Restoration succeeded - notifying WebView about restored terminals');
      await this.actions.initializeTerminal();
    }
  }

  private async attemptSessionRestoration(): Promise<boolean> {
    let restorationSuccessful = false;

    if (this.extensionPersistenceService) {
      try {
        log('🔄 [EXT-RESTORE] Attempting extension session restore...');
        const result = await this.extensionPersistenceService.restoreSession(false);

        if (result.success && result.restoredCount && result.restoredCount > 0) {
          log(`✅ [EXT-RESTORE] Successfully restored ${result.restoredCount} terminals`);
          restorationSuccessful = true;
        } else {
          log('📝 [EXT-RESTORE] No extension session found');
        }
      } catch (error) {
        log('❌ [EXT-RESTORE] Extension restore failed:', error);
      }
    }

    if (!restorationSuccessful) {
      try {
        log('🔄 [WEBVIEW-RESTORE] Attempting WebView session restore...');
        const webviewRestored = await this.actions.restoreLastSession();

        if (webviewRestored) {
          log('✅ [WEBVIEW-RESTORE] WebView session restored successfully');
          restorationSuccessful = true;
        } else {
          log('📝 [WEBVIEW-RESTORE] No WebView session found');
        }
      } catch (error) {
        log('❌ [WEBVIEW-RESTORE] WebView restore failed:', error);
      }
    }

    return restorationSuccessful;
  }

  /**
   * 🎯 VS Code Pattern: Immediate initialization complete after terminals are ready
   * No artificial delays - send message as soon as state is consistent
   */
  private scheduleUnifiedInitializationComplete(): void {
    // Small delay to ensure terminal creation messages are processed first
    setTimeout(() => {
      const terminalCount = this.terminalManager.getTerminals().length;
      log(`🔍 [TERMINAL-INIT] Final terminal count: ${terminalCount}`);

      // Emergency creation if needed
      if (terminalCount === 0) {
        log('⚠️ [TERMINAL-INIT] No terminals - emergency creation');
        this.actions.ensureMinimumTerminals();

        // Wait a bit for emergency terminals to be created
        setTimeout(() => {
          const emergencyCount = this.terminalManager.getTerminals().length;
          void this.actions.sendInitializationComplete(emergencyCount);
        }, 100);
      } else {
        // Normal flow - send initialization complete immediately
        void this.actions.sendInitializationComplete(terminalCount);
      }
    }, 100); // Minimal delay to ensure message ordering
  }

  // 🎯 DEPRECATED: Replaced by scheduleUnifiedInitializationComplete
  // private scheduleTerminalCountVerification(): void { }
  // private scheduleInitializationCompleteMessage(): void { }

  private logExistingTerminals(currentTerminalCount: number): void {
    log(
      `ℹ️ [TERMINAL-INIT] Terminals already exist (${currentTerminalCount}) - no restoration needed`
    );

    const existingTerminals = this.terminalManager.getTerminals();
    existingTerminals.forEach((terminal, index) => {
      log(`📋 [TERMINAL-INIT] Existing terminal ${index + 1}: ${terminal.name} (${terminal.id})`);
    });
  }

  private attemptEmergencyTerminalCreation(): void {
    try {
      log('🚨 [TERMINAL-INIT] Emergency terminal creation...');
      this.actions.ensureMinimumTerminals();
    } catch (error) {
      log('💥 [TERMINAL-INIT] Emergency creation failed:', error);
    }
  }
}
