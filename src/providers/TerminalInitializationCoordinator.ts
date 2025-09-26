import { TerminalManager } from '../terminals/TerminalManager';
import { StandardTerminalSessionManager } from '../sessions/StandardTerminalSessionManager';
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
    private readonly standardSessionManager?: StandardTerminalSessionManager
  ) {}

  public async initialize(): Promise<void> {
    try {
      log('🔍 [TERMINAL-INIT] Starting coordinated terminal initialization...');
      await this.actions.initializeTerminal();
      log('✅ [TERMINAL-INIT] Basic initialization completed');

      const currentCount = this.terminalManager.getTerminals().length;
      log(`🔍 [TERMINAL-INIT] Current terminal count: ${currentCount}`);

      await this.restoreTerminalsIfNeeded(currentCount);
      this.scheduleInitializationCompleteMessage();
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
    }

    this.scheduleTerminalCountVerification();
  }

  private async attemptSessionRestoration(): Promise<boolean> {
    let restorationSuccessful = false;

    if (this.standardSessionManager) {
      try {
        log('🔄 [STANDARD-RESTORE] Attempting VS Code standard session restore...');
        const standardResult = await this.standardSessionManager.restoreSession(false);

        if (standardResult.success && standardResult.restoredCount > 0) {
          log(`✅ [STANDARD-RESTORE] Successfully restored ${standardResult.restoredCount} terminals`);
          restorationSuccessful = true;
        } else {
          log('📝 [STANDARD-RESTORE] No VS Code standard session found');
        }
      } catch (error) {
        log('❌ [STANDARD-RESTORE] VS Code standard restore failed:', error);
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

  private scheduleTerminalCountVerification(): void {
    setTimeout(() => {
      const finalCount = this.terminalManager.getTerminals().length;
      log(`🔍 [TERMINAL-INIT] Final terminal count: ${finalCount}`);

      if (finalCount === 0) {
        log('⚠️ [TERMINAL-INIT] No terminals after restoration - emergency creation');
        this.actions.ensureMinimumTerminals();
      }
    }, 1000);
  }

  private scheduleInitializationCompleteMessage(): void {
    setTimeout(() => {
      const terminalCount = this.terminalManager.getTerminals().length;
      void this.actions.sendInitializationComplete(terminalCount);
    }, 500);
  }

  private logExistingTerminals(currentTerminalCount: number): void {
    log(`ℹ️ [TERMINAL-INIT] Terminals already exist (${currentTerminalCount}) - no restoration needed`);

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

