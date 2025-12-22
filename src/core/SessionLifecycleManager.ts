/**
 * SessionLifecycleManager - Handles terminal session persistence lifecycle
 *
 * This service encapsulates all session save/restore/clear logic, separating it from
 * the main ExtensionLifecycle class for better maintainability.
 */

import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { ExtensionPersistenceService } from '../services/persistence/ExtensionPersistenceService';
import { extension as log, logger } from '../utils/logger';

/**
 * Dependencies required for session lifecycle management
 */
export interface SessionLifecycleDeps {
  getTerminalManager: () => TerminalManager | undefined;
  getSidebarProvider: () => SecondaryTerminalProvider | undefined;
  getExtensionPersistenceService: () => ExtensionPersistenceService | undefined;
  getExtensionContext: () => vscode.ExtensionContext | undefined;
}

/**
 * SessionLifecycleManager - Manages terminal session persistence
 */
export class SessionLifecycleManager {
  private _restoreExecuted = false;

  constructor(private readonly deps: SessionLifecycleDeps) {}

  /**
   * Setup automatic session saving
   */
  public setupSessionAutoSave(context: vscode.ExtensionContext): void {
    log('🔧 [EXTENSION] Setting up session auto-save on exit...');

    // Extension deactivation時にセッション保存
    context.subscriptions.push({
      dispose: () => {
        log('🔧 [EXTENSION] Extension disposing, saving session...');
        void this.saveSessionOnExit();
      },
    });

    // VS Code標準に準拠: ターミナル作成時に即座に保存
    const terminalManager = this.deps.getTerminalManager();
    if (terminalManager) {
      const terminalCreatedDisposable = terminalManager.onTerminalCreated((terminal) => {
        log(`💾 [EXTENSION] Terminal created - immediate save: ${terminal.name}`);
        void this.saveSessionImmediately('terminal_created');
      });

      const terminalRemovedDisposable = terminalManager.onTerminalRemoved((terminalId) => {
        log(`💾 [EXTENSION] Terminal removed - immediate save: ${terminalId}`);
        void this.saveSessionImmediately('terminal_removed');
      });

      context.subscriptions.push(terminalCreatedDisposable, terminalRemovedDisposable);
    }

    // ターミナル変更時の保存を設定（定期保存として - バックアップ用）
    const saveOnTerminalChange = setInterval(() => {
      void this.saveSessionPeriodically();
    }, 300000); // 5分ごとに保存

    context.subscriptions.push({
      dispose: () => clearInterval(saveOnTerminalChange),
    });

    log('✅ [EXTENSION] Session auto-save setup completed');
  }

  /**
   * Save session on extension exit
   */
  public async saveSessionOnExit(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    if (!extensionPersistenceService) {
      logger.warn('Extension persistence service not available during save-on-exit');
      return;
    }

    log('💾 [EXTENSION] Saving session on exit...');
    try {
      const result = await extensionPersistenceService.saveCurrentSession();
      if (result.success) {
        log(`✅ [EXTENSION] Session saved: ${result.terminalCount} terminals`);
      } else {
        logger.warn('Session save failed or no terminals to save');
      }
    } catch (error) {
      logger.error('Error saving session on exit', error);
    }
  }

  /**
   * Save session for simple session management on exit
   *
   * 🔧 FIX: Do NOT call prefetchScrollbackForSave() here.
   * WebView may already be closed during deactivate(), and waiting for
   * the 2-second timeout would cause the process to exit before saving.
   * The pushedScrollbackCache is already updated every 30 seconds by
   * TerminalAutoSaveService, so we can save immediately from cache.
   */
  public async saveSimpleSessionOnExit(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    if (!extensionPersistenceService) {
      logger.warn('Session manager not available, skipping save on exit');
      return;
    }

    log('💾 [STANDARD_SESSION] Saving session on exit (using cached scrollback)...');
    try {
      // Use preferCache: true to skip WebView communication and save immediately
      // The cache is updated every 30 seconds by TerminalAutoSaveService
      const result = await extensionPersistenceService.saveCurrentSession({ preferCache: true });
      if (result.success) {
        log(`✅ [STANDARD_SESSION] Session saved on exit: ${result.terminalCount} terminals`);
      } else {
        logger.error(`Failed to save session on exit: ${result.error}`);
      }
    } catch (error) {
      logger.error('Exception during session save on exit', error);
    }
  }

  /**
   * Handle save session command
   */
  public async handleSaveSession(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    if (!extensionPersistenceService) {
      await vscode.window.showErrorMessage('Extension persistence service not available');
      return;
    }

    try {
      log('📋 [SIMPLE_SESSION] Starting scrollback extraction...');
      await this.extractScrollbackFromAllTerminals();
      log('✅ [SIMPLE_SESSION] Scrollback extraction completed');

      const result = await extensionPersistenceService.saveCurrentSession();
      if (result.success) {
        await vscode.window.showInformationMessage(
          `Terminal session saved successfully (${result.terminalCount} terminal${result.terminalCount !== 1 ? 's' : ''})`
        );
      } else {
        await vscode.window.showErrorMessage(
          `Failed to save session: ${result.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to save session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle restore session command
   */
  public async handleRestoreSession(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    if (!extensionPersistenceService) {
      await vscode.window.showErrorMessage('Extension persistence service not available');
      return;
    }

    try {
      const result = await extensionPersistenceService.restoreSession();

      if (result.success) {
        if (result.restoredCount && result.restoredCount > 0) {
          await this.restoreScrollbackForAllTerminals();

          await vscode.window.showInformationMessage(
            `Terminal session restored: ${result.restoredCount} terminal${result.restoredCount > 1 ? 's' : ''} restored${result.skippedCount && result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ''}`
          );
        } else {
          await vscode.window.showInformationMessage('No previous session data found to restore');
        }
      } else {
        await vscode.window.showErrorMessage(
          `Failed to restore session: ${result.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to restore session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle clear session command
   */
  public async handleClearSession(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    if (!extensionPersistenceService) {
      await vscode.window.showErrorMessage('Extension persistence service not available');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to clear all saved terminal session data?',
      { modal: true },
      'Clear Session'
    );

    if (confirm === 'Clear Session') {
      try {
        await extensionPersistenceService.clearSession();
        await vscode.window.showInformationMessage('Terminal session data cleared successfully');
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Failed to clear session: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Handle test scrollback command
   */
  public async handleTestScrollback(): Promise<void> {
    log('🧪 [SCROLLBACK_TEST] Scrollback test temporarily disabled - using SimpleSessionManager');
    await vscode.window.showInformationMessage(
      'Scrollback test temporarily disabled - using SimpleSessionManager approach instead'
    );
  }

  /**
   * Diagnose session data
   */
  public async diagnoseSessionData(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    const extensionContext = this.deps.getExtensionContext();

    if (!extensionPersistenceService || !extensionContext) {
      await vscode.window.showErrorMessage('Session manager or context not available');
      return;
    }

    try {
      log('🔍 [DIAGNOSTIC] ===== SESSION DATA DIAGNOSIS =====');

      const sessionInfo = extensionPersistenceService.getSessionInfo();
      log('📊 [DIAGNOSTIC] Session Info:', sessionInfo);

      if (sessionInfo) {
        const diagnosticLines = this.buildDiagnosticReport(sessionInfo);

        const doc = await vscode.workspace.openTextDocument({
          content: diagnosticLines.join('\n'),
          language: 'plaintext',
        });

        await vscode.window.showTextDocument(doc, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
        });

        const scrollbackStatus =
          sessionInfo.terminals
            ?.map((t: { id: string; name: string }) => {
              const scrollbackData = sessionInfo.scrollbackData?.[t.id];
              const lines = Array.isArray(scrollbackData) ? scrollbackData.length : 0;
              return `${t.name}: ${lines} lines`;
            })
            .join(', ') || 'No terminals';

        await vscode.window.showInformationMessage(
          `Session found! ${sessionInfo.terminals?.length || 0} terminal(s). Scrollback: ${scrollbackStatus}`
        );
      } else {
        log('📭 [DIAGNOSTIC] No session data found');

        const doc = await vscode.workspace.openTextDocument({
          content:
            '❌ NO SESSION DATA FOUND\n\nTry:\n1. Save session: Cmd+Shift+P → "Secondary Terminal: Save Terminal Session"\n2. Wait 5 minutes for auto-save\n3. Close VS Code (saves automatically on exit)',
          language: 'plaintext',
        });

        await vscode.window.showTextDocument(doc, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
        });

        await vscode.window.showWarningMessage('No session data found. See diagnostic report.');
      }

      log('🔍 [DIAGNOSTIC] ===== DIAGNOSIS COMPLETE =====');
    } catch (error) {
      logger.error('Error during session diagnosis', error);
      await vscode.window.showErrorMessage(
        `Diagnostic failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create initial terminal when no session exists
   */
  public createInitialTerminal(): void {
    const terminalManager = this.deps.getTerminalManager();
    if (!terminalManager) {
      logger.warn('Cannot create initial terminal - terminal manager not available');
      return;
    }

    try {
      const terminals = terminalManager.getTerminals();
      if (terminals.length === 0) {
        log('🔧 [SIMPLE_SESSION] Creating initial terminal');
        const terminalId = terminalManager.createTerminal();
        log(`✅ [SIMPLE_SESSION] Initial terminal created: ${terminalId}`);
      } else {
        log(
          `📋 [SIMPLE_SESSION] Skipping initial terminal creation - ${terminals.length} terminals already exist`
        );
      }
    } catch (error) {
      logger.error('Error creating initial terminal', error);
    }
  }

  /**
   * Build diagnostic report lines
   */
  private buildDiagnosticReport(sessionInfo: {
    exists?: boolean;
    timestamp?: number;
    version?: string;
    terminals?: Array<{ id: string; name: string; cwd: string }>;
    activeTerminalId?: string | null;
    scrollbackData?: Record<string, unknown>;
  }): string[] {
    const diagnosticLines: string[] = [];
    diagnosticLines.push('📊 SESSION DIAGNOSTIC REPORT');
    diagnosticLines.push('');
    diagnosticLines.push(`✅ Has Session: ${sessionInfo.exists ? 'Yes' : 'No'}`);
    diagnosticLines.push(
      `📅 Timestamp: ${sessionInfo.timestamp ? new Date(sessionInfo.timestamp).toLocaleString() : 'Never'}`
    );
    diagnosticLines.push('');
    diagnosticLines.push(`📁 Version: ${sessionInfo.version}`);
    diagnosticLines.push(`🔢 Terminal Count: ${sessionInfo.terminals?.length || 0}`);
    diagnosticLines.push(`🎯 Active Terminal: ${sessionInfo.activeTerminalId || 'none'}`);
    diagnosticLines.push('');

    if (sessionInfo.terminals && sessionInfo.terminals.length > 0) {
      diagnosticLines.push('📋 TERMINAL DETAILS:');
      diagnosticLines.push('');

      sessionInfo.terminals.forEach((terminal, index) => {
        const scrollbackData = sessionInfo.scrollbackData?.[terminal.id];
        const scrollbackLines = Array.isArray(scrollbackData) ? scrollbackData.length : 0;

        diagnosticLines.push(`Terminal ${index + 1}:`);
        diagnosticLines.push(`  • ID: ${terminal.id}`);
        diagnosticLines.push(`  • Name: ${terminal.name}`);
        diagnosticLines.push(`  • Scrollback Lines: ${scrollbackLines} 📜`);
        diagnosticLines.push(`  • CWD: ${terminal.cwd}`);
        diagnosticLines.push('');

        log(`  Terminal ${index + 1}:`);
        log(`    - ID: ${terminal.id}`);
        log(`    - Name: ${terminal.name}`);
        log(`    - Scrollback Lines: ${scrollbackLines}`);
        log(`    - CWD: ${terminal.cwd}`);
      });
    } else {
      diagnosticLines.push('⚠️ No terminals in session data');
    }

    return diagnosticLines;
  }

  /**
   * Save session immediately (VS Code standard compliant)
   */
  private async saveSessionImmediately(trigger: string): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    const terminalManager = this.deps.getTerminalManager();

    if (!extensionPersistenceService || !terminalManager) {
      return;
    }

    try {
      const terminals = terminalManager.getTerminals();
      log(`💾 [EXTENSION] Immediate save triggered by ${trigger}: ${terminals.length} terminals`);

      const result = await extensionPersistenceService.saveCurrentSession();

      if (result.success) {
        log(
          `✅ [EXTENSION] Immediate save completed (${trigger}): ${result.terminalCount} terminals`
        );
      } else {
        logger.warn(`Immediate save failed (${trigger}): ${result.error || 'unknown error'}`);
      }
    } catch (error) {
      logger.error(`Error in immediate save (${trigger})`, error);
    }
  }

  /**
   * Save session periodically
   */
  private async saveSessionPeriodically(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    const terminalManager = this.deps.getTerminalManager();

    if (!extensionPersistenceService || !terminalManager) {
      return;
    }

    try {
      const terminals = terminalManager.getTerminals();
      if (terminals.length === 0) {
        return;
      }

      log(`💾 [EXTENSION] Periodic VS Code standard save: ${terminals.length} terminals`);
      const result = await extensionPersistenceService.saveCurrentSession();

      if (result.success) {
        log(`✅ [EXTENSION] Periodic save completed: ${result.terminalCount} terminals`);
      }
    } catch (error) {
      logger.error('Error in periodic session save', error);
    }
  }

  /**
   * Extract scrollback from all terminals
   */
  private async extractScrollbackFromAllTerminals(): Promise<void> {
    const terminalManager = this.deps.getTerminalManager();
    const sidebarProvider = this.deps.getSidebarProvider();

    if (!terminalManager || !sidebarProvider) {
      logger.warn('Scrollback extract skipped - terminal manager or sidebar provider unavailable');
      return;
    }

    const terminals = terminalManager.getTerminals();
    log(`🔍 [SCROLLBACK_EXTRACT] Found ${terminals.length} terminals to extract scrollback from`);

    for (const terminal of terminals) {
      try {
        log(`🔍 [SCROLLBACK_EXTRACT] Requesting scrollback for terminal ${terminal.id}`);

        await (
          sidebarProvider as unknown as { _sendMessage: (msg: unknown) => Promise<void> }
        )._sendMessage({
          command: 'getScrollback',
          terminalId: terminal.id,
          maxLines: 1000,
          timestamp: Date.now(),
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        log(
          `❌ [SCROLLBACK_EXTRACT] Error extracting scrollback for terminal ${terminal.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    log('✅ [SCROLLBACK_EXTRACT] Scrollback extraction requests sent for all terminals');
  }

  /**
   * Restore scrollback for all terminals (placeholder)
   */
  private restoreScrollbackForAllTerminals(): Promise<void> {
    log(
      '🔄 [SCROLLBACK_RESTORE] Scrollback restoration temporarily disabled - using SimpleSessionManager'
    );
    return Promise.resolve();
  }
}
