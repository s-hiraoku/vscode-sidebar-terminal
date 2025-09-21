/**
 * メッセージハンドリングユーティリティ
 * Extension ↔ WebView間の85%重複を削減
 */

export type MessageHandler<T = any> = (data: T) => Promise<void> | void;

export interface MessageRegistration {
  command: string;
  handler: MessageHandler;
  description?: string;
}

/**
 * メッセージハンドラー登録パターンの統一クラス
 */
export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();
  private logger: (message: string, ...args: any[]) => void;

  constructor(private componentName: string) {
    this.logger = (message: string, ...args: any[]) => {
      console.log(`[${this.componentName.toUpperCase()}-ROUTER]`, message, ...args);
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
  public async route(command: string, data: any): Promise<boolean> {
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
 * WebView → Extension メッセージ送信ヘルパー
 */
export class MessageSender {
  private logger: (message: string, ...args: any[]) => void;

  constructor(
    private vscode: any,
    private componentName: string
  ) {
    this.logger = (message: string, ...args: any[]) => {
      console.log(`[${this.componentName.toUpperCase()}-SENDER]`, message, ...args);
    };
  }

  /**
   * コマンドメッセージを送信
   */
  public send(command: string, data: any = {}): void {
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
  public sendSequential(messages: Array<{ command: string; data?: any }>): void {
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
    data: any = {}
  ): void {
    const shouldSend = typeof condition === 'function' ? condition() : condition;
    if (shouldSend) {
      this.send(command, data);
    }
  }
}

/**
 * 共通メッセージパターンの定数
 */
export const COMMON_COMMANDS = {
  // ターミナル操作
  CREATE_TERMINAL: 'createTerminal',
  DELETE_TERMINAL: 'deleteTerminal',
  SET_ACTIVE_TERMINAL: 'setActiveTerminal',

  // 出力・入力
  OUTPUT: 'output',
  INPUT: 'input',
  CLEAR: 'clear',

  // 状態管理
  INIT: 'init',
  RESIZE: 'resize',
  STATE_UPDATE: 'stateUpdate',

  // セッション管理
  SESSION_RESTORE: 'sessionRestore',
  EXTRACT_SCROLLBACK: 'extractScrollbackData',

  // 設定・テーマ
  THEME_UPDATE: 'themeUpdate',
  CONFIG_UPDATE: 'configUpdate',
} as const;

/**
 * メッセージデータの型安全なバリデーター
 */
export class MessageValidator {
  private static logger = (message: string, ...args: any[]) => {
    console.log('[MESSAGE-VALIDATOR]', message, ...args);
  };

  /**
   * 必須フィールドをチェック
   */
  public static validateRequired(
    data: any,
    requiredFields: string[]
  ): { isValid: boolean; missingFields: string[] } {
    const missingFields = requiredFields.filter(field => !(field in data));
    const isValid = missingFields.length === 0;

    if (!isValid) {
      this.logger(`❌ Validation failed. Missing fields:`, missingFields);
    }

    return { isValid, missingFields };
  }

  /**
   * ターミナルIDの形式チェック
   */
  public static validateTerminalId(terminalId: any): boolean {
    const isValid = typeof terminalId === 'string' && terminalId.length > 0;
    if (!isValid) {
      this.logger(`❌ Invalid terminal ID:`, terminalId);
    }
    return isValid;
  }

  /**
   * 数値範囲チェック
   */
  public static validateRange(
    value: any,
    min: number,
    max: number
  ): boolean {
    const isValid = typeof value === 'number' && value >= min && value <= max;
    if (!isValid) {
      this.logger(`❌ Value ${value} is not in range [${min}, ${max}]`);
    }
    return isValid;
  }
}