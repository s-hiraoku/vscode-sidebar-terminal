/**
 * Application Layer - Create Terminal Use Case
 *
 * ターミナル作成のビジネスロジックを含むユースケース
 */

import {
  ITerminalService,
  Terminal,
  TerminalCreationOptions,
  TerminalOperationResult,
} from '../../domain/interfaces/TerminalService';
import { IEventBus } from '../interfaces/EventBus';
import { extension as log } from '../../utils/logger';

export interface CreateTerminalCommand {
  options?: TerminalCreationOptions;
  setAsActive?: boolean;
  sendNotification?: boolean;
}

export interface CreateTerminalResult {
  success: boolean;
  terminal?: Terminal;
  error?: string;
}

/**
 * ターミナル作成ユースケース
 */
export class CreateTerminalUseCase {
  constructor(
    private readonly terminalService: ITerminalService,
    private readonly eventBus: IEventBus
  ) {}

  /**
   * ターミナルを作成
   */
  async execute(command: CreateTerminalCommand): Promise<CreateTerminalResult> {
    try {
      log('🚀 [USE-CASE] Creating terminal...');

      // バリデーション
      const validation = this.validateCommand(command);
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      // ターミナル作成
      const result = await this.terminalService.createTerminal(command.options);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const terminalId = result.data!;
      const terminal = this.terminalService.getTerminal(terminalId);

      if (!terminal) {
        return { success: false, error: 'Failed to retrieve created terminal' };
      }

      // アクティブ設定
      if (command.setAsActive !== false) {
        const activeResult = this.terminalService.setActiveTerminal(terminalId);
        if (!activeResult.success) {
          log(`⚠️ [USE-CASE] Failed to set terminal as active: ${activeResult.error}`);
        }
      }

      // イベント発行
      this.eventBus.publish('terminal:created', {
        terminal,
        wasSetAsActive: command.setAsActive !== false,
        sendNotification: command.sendNotification !== false,
      });

      log(`✅ [USE-CASE] Terminal created successfully: ${terminal.name} (${terminalId})`);

      return {
        success: true,
        terminal,
      };
    } catch (error) {
      const errorMessage = `Failed to create terminal: ${String(error)}`;
      log(`❌ [USE-CASE] ${errorMessage}`);

      this.eventBus.publish('terminal:creation-failed', {
        error: errorMessage,
        command,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * コマンドバリデーション
   */
  private validateCommand(command: CreateTerminalCommand): { success: boolean; error?: string } {
    // 現在のターミナル数チェック
    const currentTerminals = this.terminalService.getAllTerminals();
    const maxTerminals = 5; // TODO: 設定から取得

    if (currentTerminals.length >= maxTerminals) {
      return {
        success: false,
        error: `Maximum terminal limit reached (${maxTerminals})`,
      };
    }

    // 作業ディレクトリの検証
    if (command.options?.cwd) {
      // TODO: ディレクトリ存在チェック
    }

    return { success: true };
  }
}
