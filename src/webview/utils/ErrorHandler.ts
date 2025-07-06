/**
 * 統一されたエラーハンドリングクラス
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * ターミナル関連のエラーを処理
   */
  public handleTerminalError(error: Error, context: string): void {
    console.error(`[TERMINAL_ERROR] ${context}:`, error);

    // ユーザーに表示するエラーメッセージ
    this.showUserError(`Terminal Error: ${error.message}`);

    // 拡張機能にエラー詳細を送信
    this.reportToExtension({
      type: 'terminal',
      message: error.message,
      context,
      stack: error.stack,
    });
  }

  /**
   * レイアウト関連のエラーを処理
   */
  public handleLayoutError(error: Error, context: string): void {
    console.error(`[LAYOUT_ERROR] ${context}:`, error);

    // レイアウトエラーは表示のみでユーザーには通知しない
    // 重大な場合のみ処理を継続
    if (this.isCriticalLayoutError(error)) {
      this.showUserError('Layout initialization failed');
    }
  }

  /**
   * 設定関連のエラーを処理
   */
  public handleSettingsError(error: Error, context: string): void {
    console.error(`[SETTINGS_ERROR] ${context}:`, error);
    this.showUserError('Settings update failed');

    this.reportToExtension({
      type: 'settings',
      message: error.message,
      context,
      stack: error.stack,
    });
  }

  /**
   * WebView通信エラーを処理
   */
  public handleCommunicationError(error: Error, context: string): void {
    console.error(`[COMMUNICATION_ERROR] ${context}:`, error);
    this.showUserError('Communication with extension failed');

    this.reportToExtension({
      type: 'communication',
      message: error.message,
      context,
      stack: error.stack,
    });
  }

  /**
   * DOM操作エラーを処理
   */
  public handleDOMError(error: Error, context: string): void {
    console.error(`[DOM_ERROR] ${context}:`, error);

    // DOM操作エラーは通常回復可能
    if (this.isCriticalDOMError(error)) {
      this.showUserError('Interface update failed');
    }
  }

  /**
   * 一般的なエラーを処理
   */
  public handleGenericError(error: Error, context: string): void {
    console.error(`[GENERIC_ERROR] ${context}:`, error);
    this.showUserError('An unexpected error occurred');

    this.reportToExtension({
      type: 'generic',
      message: error.message,
      context,
      stack: error.stack,
    });
  }

  /**
   * ユーザーにエラーメッセージを表示
   */
  private showUserError(message: string): void {
    // ステータスマネージャーが利用可能な場合は使用
    const windowWithStatus = window as unknown as Record<string, unknown> & {
      statusManager?: {
        showStatus: (message: string, type: 'error') => void;
      };
    };

    if (typeof window !== 'undefined' && windowWithStatus.statusManager) {
      windowWithStatus.statusManager.showStatus(message, 'error');
    } else {
      // フォールバック：コンソールログのみ
      console.warn('Status manager not available, error message:', message);
    }
  }

  /**
   * 拡張機能にエラーを報告
   */
  private reportToExtension(errorInfo: {
    type: string;
    message: string;
    context: string;
    stack?: string;
  }): void {
    try {
      const windowWithVscode = window as unknown as Record<string, unknown> & {
        vscode?: {
          postMessage: (message: Record<string, unknown>) => void;
        };
      };

      if (typeof window !== 'undefined' && windowWithVscode.vscode) {
        windowWithVscode.vscode.postMessage({
          command: 'error',
          ...errorInfo,
          timestamp: Date.now(),
        });
      }
    } catch (reportError) {
      console.error('Failed to report error to extension:', reportError);
    }
  }

  /**
   * レイアウトエラーが重大かどうか判定
   */
  private isCriticalLayoutError(error: Error): boolean {
    const criticalMessages = [
      'container not found',
      'terminal body not available',
      'failed to initialize layout',
    ];

    return criticalMessages.some((msg) => error.message.toLowerCase().includes(msg));
  }

  /**
   * DOMエラーが重大かどうか判定
   */
  private isCriticalDOMError(error: Error): boolean {
    const criticalMessages = [
      'cannot access property',
      'null is not an object',
      'failed to create element',
    ];

    return criticalMessages.some((msg) => error.message.toLowerCase().includes(msg));
  }

  /**
   * 安全な関数実行ラッパー
   */
  public static safeExecute<T>(fn: () => T, context: string, fallback?: T): T | undefined {
    try {
      return fn();
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(error as Error, context);
      return fallback;
    }
  }

  /**
   * 非同期関数の安全な実行ラッパー
   */
  public static async safeExecuteAsync<T>(
    fn: () => Promise<T>,
    context: string,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(error as Error, context);
      return fallback;
    }
  }
}
