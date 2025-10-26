import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import {
  ConsolidatedTerminalPersistenceService,
} from '../../services/ConsolidatedTerminalPersistenceService';
import {
  PersistenceMessageHandler,
  PersistenceMessage,
  PersistenceResponse,
} from '../../handlers/PersistenceMessageHandler';
import { WebviewMessage } from '../../types/common';
import { TerminalManager } from '../../terminals/TerminalManager';
import { ScrollbackCoordinator } from '../services/ScrollbackCoordinator';
import { safeProcessCwd } from '../../utils/common';

export type SendMessageFn = (message: WebviewMessage) => Promise<void>;

export interface PersistenceOrchestratorOptions {
  extensionContext: vscode.ExtensionContext;
  terminalManager: TerminalManager;
  scrollbackCoordinator: ScrollbackCoordinator;
  sendMessage: SendMessageFn;
  handlerFactory?: (service: ConsolidatedTerminalPersistenceService) => PersistenceMessageHandler;
  serviceFactory?: (
    context: vscode.ExtensionContext,
    terminalManager: TerminalManager
  ) => ConsolidatedTerminalPersistenceService;
  delay?: (ms: number) => Promise<void>;
  logger?: typeof log;
}

const defaultServiceFactory = (
  context: vscode.ExtensionContext,
  terminalManager: TerminalManager
): ConsolidatedTerminalPersistenceService => new ConsolidatedTerminalPersistenceService(context, terminalManager);

const defaultHandlerFactory = (
  service: ConsolidatedTerminalPersistenceService
): PersistenceMessageHandler => new PersistenceMessageHandler(service);

export class PersistenceOrchestrator implements vscode.Disposable {
  private readonly persistenceService: ConsolidatedTerminalPersistenceService;
  private readonly handler: PersistenceMessageHandler;
  private readonly logger: typeof log;
  private readonly scrollbackCoordinator: ScrollbackCoordinator;
  private readonly sendMessageImpl: SendMessageFn;
  private readonly delay: (ms: number) => Promise<void>;

  constructor(private readonly options: PersistenceOrchestratorOptions) {
    this.logger = options.logger ?? log;
    this.persistenceService = (options.serviceFactory || defaultServiceFactory)(
      options.extensionContext,
      options.terminalManager
    );
    this.handler = (options.handlerFactory || defaultHandlerFactory)(this.persistenceService);
    this.scrollbackCoordinator = options.scrollbackCoordinator;
    this.sendMessageImpl = options.sendMessage;
    this.delay = options.delay ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  public hasHandler(): boolean {
    return Boolean(this.handler);
  }

  public getHandler(): PersistenceMessageHandler {
    return this.handler;
  }

  public async handlePersistenceMessage(
    message: WebviewMessage,
    sendMessage?: SendMessageFn
  ): Promise<void> {
    await this.routePersistenceMessage(
      message,
      sendMessage ?? this.sendMessageImpl,
      (webviewMessage) => webviewMessage
    );
  }

  public async handleLegacyPersistenceMessage(
    message: WebviewMessage,
    sendMessage?: SendMessageFn
  ): Promise<void> {
    await this.routePersistenceMessage(message, sendMessage, (legacyMessage) => {
      let command = legacyMessage.command;
      switch (legacyMessage.command) {
        case 'terminalSerializationRequest':
          command = 'persistenceSaveSession';
          break;
        case 'terminalSerializationRestoreRequest':
          command = 'persistenceRestoreSession';
          break;
      }
      return {
        ...legacyMessage,
        command,
      };
    });
  }

  private async routePersistenceMessage(
    message: WebviewMessage,
    sendMessage: SendMessageFn | undefined,
    normalize: (message: WebviewMessage) => WebviewMessage
  ): Promise<void> {
    const normalizedMessage = normalize(message);
    const responseCommand = normalizedMessage.command.endsWith('Response')
      ? normalizedMessage.command
      : `${normalizedMessage.command}Response`;

    try {
      const persistenceCommand = normalizedMessage.command
        .replace('persistence', '')
        .toLowerCase() as PersistenceMessage['command'];

      const persistenceMessage: PersistenceMessage = {
        command: persistenceCommand,
        data: normalizedMessage.data,
        terminalId: normalizedMessage.terminalId,
      };

      const response = await this.handler.handleMessage(persistenceMessage);

      await (sendMessage ?? this.sendMessageImpl)({
        command: responseCommand as any,
        success: response.success,
        data: response.data as string | any[] | undefined,
        error: response.error,
        terminalCount: response.terminalCount,
        messageId: normalizedMessage.messageId,
      });
    } catch (error) {
      this.logger('❌ [PERSISTENCE] Message handling failed:', error);
      await (sendMessage ?? this.sendMessageImpl)({
        command: responseCommand as any,
        success: false,
        error: `Persistence operation failed: ${(error as Error).message}`,
        messageId: normalizedMessage.messageId,
      });
    }
  }

  public async saveCurrentSession(): Promise<boolean> {
    this.logger('🔥 [PERSISTENCE-DEBUG] === saveCurrentSession called ===');

    try {
      const terminals = this.options.terminalManager.getTerminals();
      this.logger(`🔍 [PERSISTENCE-DEBUG] Found ${terminals.length} terminals to save`);

      if (terminals.length === 0) {
        this.logger('⚠️ [PERSISTENCE-DEBUG] No terminals to save');
        return false;
      }

      const terminalData = await Promise.all(
        terminals.map(async (terminal, index) => {
          this.logger(
            `🔍 [PERSISTENCE-DEBUG] Processing terminal ${index + 1}/${terminals.length}: ${terminal.id} (${terminal.name})`
          );

          const scrollbackData = await this.scrollbackCoordinator.requestScrollbackData(
            terminal.id,
            1000
          );

          return {
            id: terminal.id,
            name: terminal.name,
            scrollback: scrollbackData,
            workingDirectory: terminal.cwd || '',
            shellCommand: terminal.shell || '',
            isActive: terminal.isActive || false,
          };
        })
      );

      const response = await this.handler.handleMessage({
        command: 'saveSession',
        data: terminalData,
      });

      if (response.success) {
        this.logger(`✅ [PERSISTENCE] Session saved successfully: ${response.terminalCount} terminals`);
        return true;
      }

      this.logger(`❌ [PERSISTENCE] Session save failed: ${response.error}`);
      return false;
    } catch (error) {
      this.logger(`❌ [PERSISTENCE] Auto-save failed: ${error}`);
      return false;
    }
  }

  public async restoreLastSession(): Promise<boolean> {
    this.logger('🔥 [RESTORE-DEBUG] === restoreLastSession called ===');

    try {
      const response = await this.handler.handleMessage({
        command: 'restoreSession',
      });

      if (!response.success || !response.data || !Array.isArray(response.data)) {
        this.logger(`📦 [PERSISTENCE] No session to restore: ${response.error || 'No data'}`);
        return false;
      }

      const restoredTerminals = [] as Array<{ id: string }>;
      const terminalMappings: Array<{
        oldId: string;
        newId: string;
        terminalData: any;
      }> = [];

      for (const terminalData of response.data) {
        try {
          this.logger(
            `🔧 [RESTORE-DEBUG] Creating terminal process for: ${terminalData.name || terminalData.id}`
          );

          const newTerminalId = this.options.terminalManager.createTerminal();
          const terminal = this.options.terminalManager.getTerminal(newTerminalId);

          if (terminal) {
            terminalMappings.push({
              oldId: terminalData.id,
              newId: terminal.id,
              terminalData,
            });
            restoredTerminals.push(terminal);
          }
        } catch (terminalError) {
          this.logger(
            `❌ [RESTORE-DEBUG] Failed to restore terminal ${terminalData.id}: ${terminalError}`
          );
        }
      }

      if (restoredTerminals.length === 0) {
        this.logger('⚠️ [PERSISTENCE] No terminals were successfully restored');
        return false;
      }

      for (const mapping of terminalMappings) {
        await this.sendMessageImpl({
          command: 'terminalCreated',
          terminal: {
            id: mapping.newId,
            name: mapping.terminalData.name || `Terminal ${mapping.newId}`,
            cwd: mapping.terminalData.cwd || safeProcessCwd(),
            isActive: mapping.terminalData.isActive || false,
          },
        });
      }

      await this.delay(200);

      for (const mapping of terminalMappings) {
        if (
          mapping.terminalData.scrollback &&
          Array.isArray(mapping.terminalData.scrollback) &&
          mapping.terminalData.scrollback.length > 0
        ) {
          await this.sendMessageImpl({
            command: 'restoreScrollback',
            terminalId: mapping.newId,
            scrollback: mapping.terminalData.scrollback,
          });
        }
      }

      const activeMapping = terminalMappings.find((m) => m.terminalData.isActive);
      if (activeMapping) {
        this.options.terminalManager.setActiveTerminal(activeMapping.newId);
        await this.sendMessageImpl({
          command: 'setActiveTerminal',
          terminalId: activeMapping.newId,
        });
      }

      await this.sendMessageImpl({
        command: 'sessionRestored',
        success: true,
        restoredCount: restoredTerminals.length,
        totalCount: response.data.length,
      });

      this.logger(
        `✅ [PERSISTENCE] Session restored successfully: ${restoredTerminals.length}/${response.data.length} terminals`
      );

      return true;
    } catch (error) {
      this.logger(`❌ [PERSISTENCE] Auto-restore failed: ${error}`);
      return false;
    }
  }

  public dispose(): void {
    try {
      void this.persistenceService.cleanupExpiredSessions();
    } catch (error) {
      this.logger('⚠️ [PERSISTENCE] Failed to cleanup persistence service during dispose:', error);
    }
  }
}
