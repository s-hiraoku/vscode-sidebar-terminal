/**
 * メッセージハンドリングユーティリティ
 * Extension ↔ WebView間の85%重複を削減
 * TypedMessageHandling.tsとの移行ブリッジ（廃止予定）
 */

import { webview as log } from '../../utils/logger';

import {
  TypedMessageHandler,
  MessagePayload,
  LoggerFunction,
  VSCodeWebviewAPI,
  MESSAGE_COMMANDS,
} from './TypedMessageHandling';

export type MessageHandler<T extends MessagePayload = MessagePayload> = TypedMessageHandler<T>;

export interface MessageRegistration<T extends MessagePayload = MessagePayload> {
  command: string;
  handler: MessageHandler<T>;
  description?: string;
}

/**
 * メッセージハンドラー登録パターンの統一クラス（廃止予定）
 * 新規実装ではTypedMessageRouterを使用してください
 */
export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();
  private logger: LoggerFunction;

  constructor(private componentName: string) {
    this.logger = (message: string, ...args: unknown[]) => {
      log(`[${this.componentName.toUpperCase()}-ROUTER]`, message, ...args);
    };
  }

  /**
   * ハンドラーを登録
   */
  public register(registration: MessageRegistration): void {
    this.handlers.set(registration.command, registration.handler);
    this.logger(`📝 Registered handler for "${registration.command}"`);
  }

  /**
   * 複数ハンドラーを一括登録
   */
  public registerAll(registrations: MessageRegistration[]): void {
    registrations.forEach((reg) => this.register(reg));
    this.logger(`📝 Registered ${registrations.length} handlers`);
  }

  /**
   * メッセージをルーティング
   */
  public async route(command: string, data: MessagePayload): Promise<boolean> {
    const handler = this.handlers.get(command);
    if (!handler) {
      this.logger(`❌ No handler found for command: ${command}`);
      return false;
    }

    try {
      this.logger(`📨 Routing command: ${command}`);
      await handler(data);
      return true;
    } catch (error) {
      this.logger(`❌ Handler failed for command ${command}:`, error);
      return false;
    }
  }

  /**
   * 登録済みコマンド一覧を取得
   */
  public getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 全ハンドラーをクリア
   */
  public clear(): void {
    const count = this.handlers.size;
    this.handlers.clear();
    this.logger(`🧹 Cleared ${count} handlers`);
  }
}

/**
 * Extension → WebView メッセージ受信パターン
 */
export function createWebViewMessageListener(
  router: MessageRouter,
  onUnhandled?: (event: MessageEvent) => void
): (event: MessageEvent) => void {
  return async (event: MessageEvent) => {
    const { command, ...data } = event.data;

    if (!command) {
      console.warn('Received message without command:', event.data);
      return;
    }

    const handled = await router.route(command, data);
    if (!handled && onUnhandled) {
      onUnhandled(event);
    }
  };
}

/**
 * WebView → Extension メッセージ送信ヘルパー（廃止予定）
 * 新規実装ではTypedMessageSenderを使用してください
 */
export class MessageSender {
  private logger: LoggerFunction;

  constructor(
    private vscode: VSCodeWebviewAPI,
    private componentName: string
  ) {
    this.logger = (message: string, ...args: unknown[]) => {
      log(`[${this.componentName.toUpperCase()}-SENDER]`, message, ...args);
    };
  }

  /**
   * コマンドメッセージを送信
   */
  public send(command: string, data: MessagePayload = {}): void {
    try {
      const message = { command, ...data };
      this.vscode.postMessage(message);
      this.logger(`📤 Sent command: ${command}`);
    } catch (error) {
      this.logger(`❌ Failed to send command ${command}:`, error);
    }
  }

  /**
   * 複数メッセージを順次送信
   */
  public sendSequential(messages: Array<{ command: string; data?: MessagePayload }>): void {
    messages.forEach(({ command, data }) => {
      this.send(command, data);
    });
  }

  /**
   * 条件付きメッセージ送信
   */
  public sendIf(
    condition: boolean | (() => boolean),
    command: string,
    data: MessagePayload = {}
  ): void {
    const shouldSend = typeof condition === 'function' ? condition() : condition;
    if (shouldSend) {
      this.send(command, data);
    }
  }
}

/**
 * 共通メッセージパターンの定数（廃止予定）
 * 新規実装ではMESSAGE_COMMANDSを使用してください
 */
export const COMMON_COMMANDS = {
  // ターミナル操作
  CREATE_TERMINAL: MESSAGE_COMMANDS.TERMINAL_CREATE,
  DELETE_TERMINAL: MESSAGE_COMMANDS.TERMINAL_DELETE,
  SET_ACTIVE_TERMINAL: MESSAGE_COMMANDS.TERMINAL_SET_ACTIVE,

  // 出力・入力
  OUTPUT: MESSAGE_COMMANDS.TERMINAL_OUTPUT,
  INPUT: MESSAGE_COMMANDS.TERMINAL_INPUT,
  CLEAR: MESSAGE_COMMANDS.TERMINAL_CLEAR,

  // 状態管理
  INIT: MESSAGE_COMMANDS.STATE_INIT,
  RESIZE: MESSAGE_COMMANDS.TERMINAL_RESIZE,
  STATE_UPDATE: MESSAGE_COMMANDS.STATE_UPDATE,

  // セッション管理
  SESSION_RESTORE: MESSAGE_COMMANDS.SESSION_RESTORE,
  EXTRACT_SCROLLBACK: MESSAGE_COMMANDS.SESSION_EXTRACT_SCROLLBACK,

  // 設定・テーマ
  THEME_UPDATE: MESSAGE_COMMANDS.THEME_UPDATE,
  CONFIG_UPDATE: MESSAGE_COMMANDS.CONFIG_UPDATE,
} as const;

/**
 * メッセージデータの型安全なバリデーター（廃止予定）
 * 新規実装ではMessageDataValidatorを使用してください
 */
export class MessageValidator {
  private static logger: LoggerFunction = (message: string, ...args: unknown[]) => {
    log('[MESSAGE-VALIDATOR]', message, ...args);
  };

  /**
   * 必須フィールドをチェック
   */
  public static validateRequired(
    data: Record<string, unknown>,
    requiredFields: string[]
  ): { isValid: boolean; missingFields: string[] } {
    const missingFields = requiredFields.filter((field) => !(field in data));
    const isValid = missingFields.length === 0;

    if (!isValid) {
      this.logger(`❌ Validation failed. Missing fields:`, missingFields);
    }

    return { isValid, missingFields };
  }

  /**
   * ターミナルIDの形式チェック
   */
  public static validateTerminalId(terminalId: unknown): boolean {
    const isValid = typeof terminalId === 'string' && terminalId.length > 0;
    if (!isValid) {
      this.logger(`❌ Invalid terminal ID:`, terminalId);
    }
    return isValid;
  }

  /**
   * 数値範囲チェック
   */
  public static validateRange(value: unknown, min: number, max: number): boolean {
    const isValid = typeof value === 'number' && value >= min && value <= max;
    if (!isValid) {
      this.logger(`❌ Value ${value} is not in range [${min}, ${max}]`);
    }
    return isValid;
  }
}
