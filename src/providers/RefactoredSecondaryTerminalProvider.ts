/**
 * リファクタリングされた Secondary Terminal Provider
 * 
 * 依存性注入とサービス構成を使用して、
 * 元の1,663行のプロバイダーを300行程度に縮小しています。
 */

import * as vscode from 'vscode';
import { WebviewMessage, VsCodeMessage } from '../types/common';
import { getTerminalConfig } from '../utils/common';
import { extension as log } from '../utils/logger';

// Services
import { ITerminalLifecycleManager, TerminalLifecycleManager } from '../services/TerminalLifecycleManager';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';
import { CliAgentDetectionService } from '../services/CliAgentDetectionService';
import { ITerminalDataBufferingService, TerminalDataBufferingService } from '../services/TerminalDataBufferingService';
import { ITerminalStateManager, TerminalStateManager } from '../services/TerminalStateManager';

// Messaging and WebView
import { IWebViewResourceManager, WebViewResourceManager } from '../webview/WebViewResourceManager';
import { IWebViewMessageRouter, WebViewMessageRouter, MessageHandler } from '../messaging/WebViewMessageRouter';
import { MessageFactory } from '../messaging/MessageFactory';

// Event Management
import { ITerminalEventSubscriptionManager, TerminalEventSubscriptionManager } from '../events/TerminalEventSubscriptionManager';

// Utils
import { OperationResultHandler, NotificationService } from '../utils/OperationResultHandler';
import { ConfigurationService } from '../config/ConfigurationService';

/**
 * Provider 設定インターフェース
 */
export interface ProviderConfig {
  enableAutoFocus: boolean;
  enableDebugging: boolean;
  maxRetryAttempts: number;
}

/**
 * リファクタリングされた Secondary Terminal Provider
 */
export class RefactoredSecondaryTerminalProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'secondaryTerminal';
  
  // Services (Dependency Injection)
  private readonly lifecycleManager: ITerminalLifecycleManager;
  private readonly cliAgentService: ICliAgentDetectionService;
  private readonly bufferingService: ITerminalDataBufferingService;
  private readonly stateManager: ITerminalStateManager;
  private readonly resourceManager: IWebViewResourceManager;
  private readonly messageRouter: IWebViewMessageRouter;
  private readonly eventSubscriptionManager: ITerminalEventSubscriptionManager;
  private readonly configService: ConfigurationService;
  private readonly notificationService: NotificationService;
  
  // Provider 状態
  private webviewView: vscode.WebviewView | undefined;
  private readonly config: ProviderConfig;
  
  // リソース管理
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    // 依存性注入 - テストでモックを注入可能
    lifecycleManager?: ITerminalLifecycleManager,
    cliAgentService?: ICliAgentDetectionService,
    bufferingService?: ITerminalDataBufferingService,
    stateManager?: ITerminalStateManager,
    resourceManager?: IWebViewResourceManager,
    messageRouter?: IWebViewMessageRouter,
    config: Partial<ProviderConfig> = {}
  ) {
    // デフォルトサービスまたは注入されたサービスを使用
    this.lifecycleManager = lifecycleManager || new TerminalLifecycleManager();
    this.cliAgentService = cliAgentService || new CliAgentDetectionService();
    this.bufferingService = bufferingService || new TerminalDataBufferingService();
    this.stateManager = stateManager || new TerminalStateManager();
    this.resourceManager = resourceManager || new WebViewResourceManager();
    this.messageRouter = messageRouter || new WebViewMessageRouter();
    
    // 設定とユーティリティサービス
    this.configService = ConfigurationService.getInstance();
    this.notificationService = this.createNotificationService();
    
    // イベント管理（サービス間の協調）
    this.eventSubscriptionManager = new TerminalEventSubscriptionManager(
      this.messageRouter,
      this.lifecycleManager,
      this.cliAgentService,
      this.stateManager,
      this.bufferingService
    );
    
    // 設定
    this.config = {
      enableAutoFocus: true,
      enableDebugging: false,
      maxRetryAttempts: 3,
      ...config
    };
    
    // メッセージハンドラーを設定
    this.setupMessageHandlers();
    
    log('🚀 [REFACTORED-PROVIDER] Refactored secondary terminal provider initialized');
  }

  // === VS Code WebView Provider Implementation ===

  /**
   * WebView View を解決
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    try {
      this.webviewView = webviewView;
      
      log('🎯 [REFACTORED-PROVIDER] Resolving WebView...');
      
      // WebView リソースを設定
      this.resourceManager.configureWebview(webviewView, this.context);
      
      // メッセージルーターを設定
      this.messageRouter.setupMessageHandling(webviewView);
      
      // イベント購読を開始
      this.subscribeToEvents();
      
      // 初期設定をWebViewに送信
      await this.sendInitialSettings();
      
      log('✅ [REFACTORED-PROVIDER] WebView resolved successfully');
    } catch (error) {
      log(`❌ [REFACTORED-PROVIDER] Failed to resolve WebView: ${String(error)}`);
      throw error;
    }
  }

  // === Public API Methods ===

  /**
   * メッセージを送信
   */
  public async sendMessage(message: WebviewMessage): Promise<void> {
    return this.messageRouter.sendMessage(message);
  }

  /**
   * ターミナルマネージャーを取得（後方互換性）
   */
  public getTerminalManager(): ITerminalLifecycleManager {
    return this.lifecycleManager;
  }

  /**
   * Provider統計を取得
   */
  public getProviderStats() {
    return {
      terminalCount: this.lifecycleManager.getTerminalCount(),
      messageStats: this.messageRouter.getMessageStats(),
      bufferStats: this.bufferingService.getAllStats(),
      stateAnalysis: this.stateManager.getStateAnalysis(),
      configHealth: this.configService.getTerminalSettings(),
    };
  }

  // === リソース管理 ===

  /**
   * 全リソースを解放
   */
  public dispose(): void {
    log('🗑️ [REFACTORED-PROVIDER] Disposing provider...');
    
    // イベント購読を解除
    this.eventSubscriptionManager.dispose();
    
    // サービスを解放
    this.lifecycleManager.dispose();
    this.cliAgentService.dispose();
    this.bufferingService.dispose();
    this.stateManager.dispose();
    this.messageRouter.dispose();
    this.configService.dispose();
    
    // Disposableを解放
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.webviewView = undefined;
    
    log('✅ [REFACTORED-PROVIDER] Provider disposed');
  }

  // === プライベートメソッド ===

  /**
   * メッセージハンドラーを設定
   */
  private setupMessageHandlers(): void {
    // WebView 準備完了
    this.messageRouter.addMessageHandler('ready', this.handleWebViewReady.bind(this));
    this.messageRouter.addMessageHandler('webviewReady', this.handleWebViewReady.bind(this));
    
    // ターミナル操作
    this.messageRouter.addMessageHandler('createTerminal', this.handleCreateTerminal.bind(this));
    this.messageRouter.addMessageHandler('deleteTerminal', this.handleDeleteTerminal.bind(this));
    this.messageRouter.addMessageHandler('input', this.handleTerminalInput.bind(this));
    this.messageRouter.addMessageHandler('resize', this.handleTerminalResize.bind(this));
    this.messageRouter.addMessageHandler('focusTerminal', this.handleFocusTerminal.bind(this));
    
    // 設定
    this.messageRouter.addMessageHandler('getSettings', this.handleGetSettings.bind(this));
    
    // エラー処理
    this.messageRouter.addMessageHandler('error', this.handleError.bind(this));
    
    log('📝 [REFACTORED-PROVIDER] Message handlers setup complete');
  }

  /**
   * イベント購読を開始
   */
  private subscribeToEvents(): void {
    this.eventSubscriptionManager.subscribeToTerminalEvents();
    this.eventSubscriptionManager.subscribeToCliAgentEvents();
    this.eventSubscriptionManager.subscribeToStateEvents();
    this.eventSubscriptionManager.subscribeToDataEvents();
    
    log('🎧 [REFACTORED-PROVIDER] Event subscriptions activated');
  }

  /**
   * 初期設定を送信
   */
  private async sendInitialSettings(): Promise<void> {
    try {
      const terminalSettings = this.configService.getTerminalSettings();
      const altClickSettings = this.configService.getAltClickSettings();
      
      const message = MessageFactory.createSettingsResponse(
        terminalSettings,
        { altClickSettings }
      );
      
      await this.messageRouter.sendMessage(message);
      
      log('⚙️ [REFACTORED-PROVIDER] Initial settings sent');
    } catch (error) {
      log(`❌ [REFACTORED-PROVIDER] Failed to send initial settings: ${String(error)}`);
    }
  }

  /**
   * 通知サービスを作成
   */
  private createNotificationService(): NotificationService {
    return {
      showSuccess: (message: string) => {
        vscode.window.showInformationMessage(message);
      },
      showError: (message: string) => {
        vscode.window.showErrorMessage(message);
      },
      showWarning: (message: string) => {
        vscode.window.showWarningMessage(message);
      }
    };
  }

  // === メッセージハンドラー ===

  /**
   * WebView準備完了ハンドラー
   */
  private async handleWebViewReady(message: VsCodeMessage): Promise<void> {
    log('🎯 [REFACTORED-PROVIDER] WebView ready received');
    
    // 現在の状態をWebViewに送信
    const currentState = this.stateManager.getCurrentState();
    await this.messageRouter.sendMessage(
      MessageFactory.createStateUpdateMessage(currentState, currentState.activeTerminalId || undefined)
    );
  }

  /**
   * ターミナル作成ハンドラー
   */
  private async handleCreateTerminal(message: VsCodeMessage): Promise<void> {
    const result = await OperationResultHandler.handleTerminalOperation(
      async () => {
        const terminalId = this.lifecycleManager.createTerminal();
        this.stateManager.setActiveTerminal(terminalId);
        return OperationResultHandler.success(terminalId);
      },
      'CREATE-TERMINAL',
      'Terminal created successfully',
      this.notificationService
    );

    if (result && this.config.enableAutoFocus) {
      this.stateManager.setActiveTerminal(result);
    }
  }

  /**
   * ターミナル削除ハンドラー
   */
  private async handleDeleteTerminal(message: VsCodeMessage): Promise<void> {
    if (!message.terminalId) {
      log('⚠️ [REFACTORED-PROVIDER] Delete terminal: missing terminal ID');
      return;
    }

    await OperationResultHandler.handleTerminalOperation(
      () => this.lifecycleManager.killTerminal(message.terminalId!),
      'DELETE-TERMINAL',
      `Terminal ${message.terminalId} deleted`,
      this.notificationService
    );
  }

  /**
   * ターミナル入力ハンドラー
   */
  private async handleTerminalInput(message: VsCodeMessage): Promise<void> {
    if (!message.terminalId || !message.data) {
      return;
    }

    OperationResultHandler.handleSyncOperation(
      () => this.lifecycleManager.writeToTerminal(message.terminalId!, message.data!),
      'TERMINAL-INPUT'
    );
  }

  /**
   * ターミナルリサイズハンドラー
   */
  private async handleTerminalResize(message: VsCodeMessage): Promise<void> {
    if (!message.terminalId || !message.cols || !message.rows) {
      return;
    }

    OperationResultHandler.handleSyncOperation(
      () => this.lifecycleManager.resizeTerminal(message.terminalId!, message.cols!, message.rows!),
      'TERMINAL-RESIZE'
    );
  }

  /**
   * ターミナルフォーカスハンドラー
   */
  private async handleFocusTerminal(message: VsCodeMessage): Promise<void> {
    if (!message.terminalId) {
      return;
    }

    OperationResultHandler.handleSyncOperation(
      () => this.stateManager.setActiveTerminal(message.terminalId!),
      'TERMINAL-FOCUS'
    );
  }

  /**
   * 設定取得ハンドラー
   */
  private async handleGetSettings(message: VsCodeMessage): Promise<void> {
    await this.sendInitialSettings();
  }

  /**
   * エラーハンドラー
   */
  private async handleError(message: VsCodeMessage): Promise<void> {
    log(`❌ [REFACTORED-PROVIDER] WebView error: ${message.message}`);
    
    if (message.message && this.notificationService) {
      this.notificationService.showError(`Terminal Error: ${message.message}`);
    }
  }
}

/**
 * ファクトリー関数 - デフォルト設定でProviderを作成
 */
export function createRefactoredSecondaryTerminalProvider(
  context: vscode.ExtensionContext,
  overrides: {
    lifecycleManager?: ITerminalLifecycleManager;
    cliAgentService?: ICliAgentDetectionService;
    bufferingService?: ITerminalDataBufferingService;
    stateManager?: ITerminalStateManager;
    resourceManager?: IWebViewResourceManager;
    messageRouter?: IWebViewMessageRouter;
    config?: Partial<ProviderConfig>;
  } = {}
): RefactoredSecondaryTerminalProvider {
  return new RefactoredSecondaryTerminalProvider(
    context,
    overrides.lifecycleManager,
    overrides.cliAgentService,
    overrides.bufferingService,
    overrides.stateManager,
    overrides.resourceManager,
    overrides.messageRouter,
    overrides.config
  );
}