import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { ExtensionPersistenceService } from '../services/persistence/ExtensionPersistenceService';
import { logger } from '../utils/logger';

export interface SessionLifecycleDeps {
  getTerminalManager: () => TerminalManager | undefined;
  getSidebarProvider: () => SecondaryTerminalProvider | undefined;
  getExtensionPersistenceService: () => ExtensionPersistenceService | undefined;
  getExtensionContext: () => vscode.ExtensionContext | undefined;
}

/** Manages terminal session persistence */
export class SessionLifecycleManager {
  private _restoreExecuted = false;

  constructor(private readonly deps: SessionLifecycleDeps) {}

  public setupSessionAutoSave(context: vscode.ExtensionContext): void {
    context.subscriptions.push({
      dispose: () => {
        void this.saveSessionOnExit();
      },
    });

    const terminalManager = this.deps.getTerminalManager();
    if (terminalManager) {
      const terminalCreatedDisposable = terminalManager.onTerminalCreated(() => {
        void this.saveSessionImmediately('terminal_created');
      });

      const terminalRemovedDisposable = terminalManager.onTerminalRemoved(() => {
        void this.saveSessionImmediately('terminal_removed');
      });

      context.subscriptions.push(terminalCreatedDisposable, terminalRemovedDisposable);
    }

    // Periodic backup save every 5 minutes
    const saveOnTerminalChange = setInterval(() => {
      void this.saveSessionPeriodically();
    }, 300000);

    context.subscriptions.push({
      dispose: () => clearInterval(saveOnTerminalChange),
    });
  }

  public async saveSessionOnExit(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    if (!extensionPersistenceService) {
      return;
    }

    try {
      await extensionPersistenceService.saveCurrentSession();
    } catch (error) {
      logger.error('Error saving session on exit', error);
    }
  }

  public async saveSimpleSessionOnExit(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    if (!extensionPersistenceService) {
      return;
    }

    try {
      // Use cached scrollback (updated every 30 seconds by TerminalAutoSaveService)
      await extensionPersistenceService.saveCurrentSession({ preferCache: true });
    } catch (error) {
      logger.error('Exception during session save on exit', error);
    }
  }

  public async handleSaveSession(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    if (!extensionPersistenceService) {
      await vscode.window.showErrorMessage('Extension persistence service not available');
      return;
    }

    try {
      await this.extractScrollbackFromAllTerminals();
      const result = await extensionPersistenceService.saveCurrentSession();
      if (result.success) {
        const count = result.terminalCount;
        await vscode.window.showInformationMessage(
          `Terminal session saved successfully (${count} terminal${count !== 1 ? 's' : ''})`
        );
      } else {
        await vscode.window.showErrorMessage(`Failed to save session: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to save session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
          const skipped = result.skippedCount && result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : '';
          await vscode.window.showInformationMessage(
            `Terminal session restored: ${result.restoredCount} terminal${result.restoredCount > 1 ? 's' : ''} restored${skipped}`
          );
        } else {
          await vscode.window.showInformationMessage('No previous session data found to restore');
        }
      } else {
        await vscode.window.showErrorMessage(`Failed to restore session: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to restore session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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

  public async handleTestScrollback(): Promise<void> {
    await vscode.window.showInformationMessage('Scrollback test temporarily disabled');
  }

  public async diagnoseSessionData(): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    const extensionContext = this.deps.getExtensionContext();

    if (!extensionPersistenceService || !extensionContext) {
      await vscode.window.showErrorMessage('Session manager or context not available');
      return;
    }

    try {
      const sessionInfo = extensionPersistenceService.getSessionInfo();

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
        const doc = await vscode.workspace.openTextDocument({
          content:
            'NO SESSION DATA FOUND\n\nTry:\n1. Save session: Cmd+Shift+P -> "Secondary Terminal: Save Terminal Session"\n2. Wait 5 minutes for auto-save\n3. Close VS Code (saves automatically on exit)',
          language: 'plaintext',
        });

        await vscode.window.showTextDocument(doc, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
        });

        await vscode.window.showWarningMessage('No session data found. See diagnostic report.');
      }
    } catch (error) {
      logger.error('Error during session diagnosis', error);
      await vscode.window.showErrorMessage(
        `Diagnostic failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public createInitialTerminal(): void {
    const terminalManager = this.deps.getTerminalManager();
    if (!terminalManager) {
      return;
    }

    try {
      const terminals = terminalManager.getTerminals();
      if (terminals.length === 0) {
        terminalManager.createTerminal();
      }
    } catch (error) {
      logger.error('Error creating initial terminal', error);
    }
  }

  private buildDiagnosticReport(sessionInfo: {
    exists?: boolean;
    timestamp?: number;
    version?: string;
    terminals?: Array<{ id: string; name: string; cwd: string }>;
    activeTerminalId?: string | null;
    scrollbackData?: Record<string, unknown>;
  }): string[] {
    const lines: string[] = [
      'SESSION DIAGNOSTIC REPORT',
      '',
      `Has Session: ${sessionInfo.exists ? 'Yes' : 'No'}`,
      `Timestamp: ${sessionInfo.timestamp ? new Date(sessionInfo.timestamp).toLocaleString() : 'Never'}`,
      '',
      `Version: ${sessionInfo.version}`,
      `Terminal Count: ${sessionInfo.terminals?.length || 0}`,
      `Active Terminal: ${sessionInfo.activeTerminalId || 'none'}`,
      '',
    ];

    if (sessionInfo.terminals && sessionInfo.terminals.length > 0) {
      lines.push('TERMINAL DETAILS:');
      lines.push('');

      sessionInfo.terminals.forEach((terminal, index) => {
        const scrollbackData = sessionInfo.scrollbackData?.[terminal.id];
        const scrollbackLines = Array.isArray(scrollbackData) ? scrollbackData.length : 0;

        lines.push(`Terminal ${index + 1}:`);
        lines.push(`  ID: ${terminal.id}`);
        lines.push(`  Name: ${terminal.name}`);
        lines.push(`  Scrollback Lines: ${scrollbackLines}`);
        lines.push(`  CWD: ${terminal.cwd}`);
        lines.push('');
      });
    } else {
      lines.push('No terminals in session data');
    }

    return lines;
  }

  private async saveSessionImmediately(_trigger: string): Promise<void> {
    const extensionPersistenceService = this.deps.getExtensionPersistenceService();
    const terminalManager = this.deps.getTerminalManager();

    if (!extensionPersistenceService || !terminalManager) {
      return;
    }

    try {
      await extensionPersistenceService.saveCurrentSession();
    } catch (error) {
      logger.error('Error in immediate save', error);
    }
  }

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

      await extensionPersistenceService.saveCurrentSession();
    } catch (error) {
      logger.error('Error in periodic session save', error);
    }
  }

  private async extractScrollbackFromAllTerminals(): Promise<void> {
    const terminalManager = this.deps.getTerminalManager();
    const sidebarProvider = this.deps.getSidebarProvider();

    if (!terminalManager || !sidebarProvider) {
      return;
    }

    const terminals = terminalManager.getTerminals();

    for (const terminal of terminals) {
      try {
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
        logger.debug(`Scrollback extraction failed for terminal ${terminal.id}`, error);
      }
    }
  }

  private restoreScrollbackForAllTerminals(): Promise<void> {
    // Scrollback restoration temporarily disabled
    return Promise.resolve();
  }
}
