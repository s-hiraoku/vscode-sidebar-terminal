/**
 * CommandRegistrar - Handles VS Code command registration for the extension
 *
 * This service encapsulates all command registration logic, separating it from
 * the main ExtensionLifecycle class for better maintainability.
 */

import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { ExtensionPersistenceService } from '../services/persistence/ExtensionPersistenceService';
import { FileReferenceCommand, TerminalCommand } from '../commands';
import { CopilotIntegrationCommand } from '../commands/CopilotIntegrationCommand';
import { EnhancedShellIntegrationService } from '../services/EnhancedShellIntegrationService';
import { KeyboardShortcutService } from '../services/KeyboardShortcutService';
import { TelemetryService } from '../services/TelemetryService';
import { VersionUtils } from '../utils/VersionUtils';
import { logger } from '../utils/logger';

/**
 * Command handler definition
 * Handler accepts any arguments (typed at call site) to avoid strict type incompatibility
 */
interface CommandDefinition {
  command: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => unknown | Promise<unknown>;
}

/**
 * Dependencies required for command registration
 */
export interface CommandRegistrarDeps {
  terminalManager: TerminalManager | undefined;
  sidebarProvider: SecondaryTerminalProvider | undefined;
  extensionPersistenceService: ExtensionPersistenceService | undefined;
  fileReferenceCommand: FileReferenceCommand | undefined;
  terminalCommand: TerminalCommand | undefined;
  copilotIntegrationCommand: CopilotIntegrationCommand | undefined;
  shellIntegrationService: EnhancedShellIntegrationService | undefined;
  keyboardShortcutService: KeyboardShortcutService | undefined;
  telemetryService: TelemetryService | undefined;
}

/**
 * Session command handlers for complex session operations
 */
export interface SessionCommandHandlers {
  handleSaveSession: () => Promise<void>;
  handleRestoreSession: () => Promise<void>;
  handleClearSession: () => Promise<void>;
  handleTestScrollback: () => Promise<void>;
  diagnoseSessionData: () => Promise<void>;
}

/**
 * CommandRegistrar - Registers all VS Code commands for the extension
 */
export class CommandRegistrar {
  constructor(
    private readonly deps: CommandRegistrarDeps,
    private readonly sessionHandlers: SessionCommandHandlers
  ) {}

  /**
   * Registers all VS Code commands provided by the extension.
   *
   * This method registers command handlers for:
   * - Terminal management (split, kill, focus, etc.)
   * - File reference operations (@mention functionality)
   * - GitHub Copilot integration
   * - Session management (save, restore, clear)
   * - Shell integration features
   * - Search functionality
   * - Debug and diagnostic commands
   *
   * @param context - The VS Code extension context for registering command subscriptions
   */
  public registerCommands(context: vscode.ExtensionContext): void {
    const commandDisposables = this.buildCommandDefinitions();

    // Register all commands with telemetry tracking
    commandDisposables.forEach(({ command, handler }) => {
      const wrappedHandler = async (...args: unknown[]) => {
        try {
          this.deps.telemetryService?.trackCommandExecuted(command, true);
          return await handler(...args);
        } catch (error) {
          this.deps.telemetryService?.trackCommandExecuted(command, false);
          if (error instanceof Error) {
            this.deps.telemetryService?.trackError(error, `command:${command}`);
          }
          throw error;
        }
      };

      const disposable = vscode.commands.registerCommand(command, wrappedHandler);
      context.subscriptions.push(disposable);
    });
  }

  /**
   * Builds the list of all command definitions
   */
  private buildCommandDefinitions(): CommandDefinition[] {
    return [
      // ======================= メインコマンド =======================
      ...this.getMainCommands(),

      // ======================= ファイル参照コマンド =======================
      ...this.getFileReferenceCommands(),

      // ======================= GitHub Copilot統合コマンド =======================
      ...this.getCopilotCommands(),

      // ======================= セッション管理コマンド =======================
      ...this.getSessionManagementCommands(),

      // ======================= ターミナル操作コマンド =======================
      ...this.getTerminalOperationCommands(),

      // ======================= Shell Integration Commands =======================
      ...this.getShellIntegrationCommands(),

      // ======================= その他のコマンド =======================
      ...this.getMiscCommands(),
    ];
  }

  /**
   * Main terminal commands
   */
  private getMainCommands(): CommandDefinition[] {
    return [
      {
        command: 'secondaryTerminal.splitTerminal',
        handler: () => {
          this.deps.sidebarProvider?.splitTerminal();
        },
      },
      {
        command: 'secondaryTerminal.splitTerminalHorizontal',
        handler: () => {
          this.deps.sidebarProvider?.splitTerminal('horizontal');
        },
      },
    ];
  }

  /**
   * File reference commands
   */
  private getFileReferenceCommands(): CommandDefinition[] {
    return [
      {
        command: 'secondaryTerminal.sendAtMention',
        handler: () => {
          void this.deps.fileReferenceCommand?.handleSendAtMention();
        },
      },
    ];
  }

  /**
   * GitHub Copilot integration commands
   */
  private getCopilotCommands(): CommandDefinition[] {
    return [
      {
        command: 'secondaryTerminal.activateCopilot',
        handler: async () => {
          await this.deps.copilotIntegrationCommand?.handleActivateCopilot();
        },
      },
    ];
  }

  /**
   * Session management commands
   */
  private getSessionManagementCommands(): CommandDefinition[] {
    return [
      {
        command: 'secondaryTerminal.clearCorruptedHistory',
        handler: async () => {
          try {
            if (this.deps.extensionPersistenceService) {
              await this.deps.extensionPersistenceService.clearSession();
              void vscode.window.showInformationMessage(
                '🧹 Terminal session cleared! VS Code standard session will be saved from now on.'
              );
            } else {
              void vscode.window.showErrorMessage('Session manager not available');
            }
          } catch (error) {
            logger.error('Failed to clear terminal session via clearCorruptedHistory command', error);
            void vscode.window.showErrorMessage(
              `Failed to clear session: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        },
      },
      {
        command: 'secondaryTerminal.saveSession',
        handler: async () => {
          await this.sessionHandlers.handleSaveSession();
        },
      },
      {
        command: 'secondaryTerminal.restoreSession',
        handler: async () => {
          await this.sessionHandlers.handleRestoreSession();
        },
      },
      {
        command: 'secondaryTerminal.clearSession',
        handler: async () => {
          await this.sessionHandlers.handleClearSession();
        },
      },
      {
        command: 'secondaryTerminal.testScrollback',
        handler: async () => {
          await this.sessionHandlers.handleTestScrollback();
        },
      },
      {
        command: 'secondaryTerminal.diagnoseSession',
        handler: async () => {
          await this.sessionHandlers.diagnoseSessionData();
        },
      },
    ];
  }

  /**
   * Terminal operation commands
   */
  private getTerminalOperationCommands(): CommandDefinition[] {
    return [
      {
        command: 'secondaryTerminal.sendToTerminal',
        handler: (content?: string) => {
          this.deps.terminalCommand?.handleSendToTerminal(content as string | undefined);
        },
      },
      {
        command: 'secondaryTerminal.killTerminal',
        handler: async () => {
          try {
            await this.deps.sidebarProvider?.killTerminal();
          } catch (error) {
            logger.error('Failed to execute killTerminal command', error);
          }
        },
      },
    ];
  }

  /**
   * Shell integration commands
   */
  private getShellIntegrationCommands(): CommandDefinition[] {
    return [
      {
        command: 'secondaryTerminal.updateShellStatus',
        handler: (args: { terminalId: string; status: string }) => {
          this.deps.sidebarProvider?.sendMessageToWebview({
            command: 'updateShellStatus',
            terminalId: args.terminalId,
            status: args.status,
          });
        },
      },
      {
        command: 'secondaryTerminal.updateCwd',
        handler: (args: { terminalId: string; cwd: string }) => {
          this.deps.sidebarProvider?.sendMessageToWebview({
            command: 'updateCwd',
            terminalId: args.terminalId,
            cwd: args.cwd,
          });
        },
      },
      {
        command: 'secondaryTerminal.getCommandHistory',
        handler: (terminalId: string) => {
          if (this.deps.shellIntegrationService) {
            const history = this.deps.shellIntegrationService.getCommandHistory(terminalId as string);
            this.deps.sidebarProvider?.sendMessageToWebview({
              command: 'commandHistory',
              terminalId,
              history,
            });
            return history;
          }
          return [];
        },
      },
    ];
  }

  /**
   * Miscellaneous commands
   */
  private getMiscCommands(): CommandDefinition[] {
    return [
      {
        command: 'secondaryTerminal.find',
        handler: () => {
          this.deps.keyboardShortcutService?.find();
        },
      },
      {
        command: 'secondaryTerminal.selectProfile',
        handler: () => {
          this.deps.sidebarProvider?.selectProfile();
        },
      },
      {
        command: 'secondaryTerminal.openSettings',
        handler: () => {
          this.deps.sidebarProvider?.openSettings();
        },
      },
      {
        command: 'secondaryTerminal.debugInput',
        handler: async () => {
          if (!this.deps.terminalManager) {
            void vscode.window.showErrorMessage('TerminalManager not available');
            return;
          }

          const activeTerminalId = this.deps.terminalManager.getActiveTerminalId();
          if (!activeTerminalId) {
            void vscode.window.showErrorMessage('No active terminal available');
            return;
          }

          const testCommand = 'echo "DEBUG: Direct Extension input test successful"\\r';
          this.deps.terminalManager.sendInput(testCommand, activeTerminalId);
          void vscode.window.showInformationMessage('Debug input test sent directly to terminal');
        },
      },
      {
        command: 'secondaryTerminal.showVersion',
        handler: () => {
          const versionInfo = VersionUtils.getExtensionDisplayInfo();
          void vscode.window.showInformationMessage(versionInfo);
        },
      },
    ];
  }
}
