/**
 * WebView API Manager
 *
 * WebViewとVS Code間のAPI通信を管理
 * 責務：VS Code API初期化、メッセージ送信、状態管理
 */

import { webview as log } from '../../utils/logger';
import { VsCodeMessage } from '../../types/common';

/**
 * VS Code APIの型定義
 */
interface VSCodeAPI {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

/**
 * WebView API管理クラス
 * VS Code APIとの通信を一元管理
 */
export class WebViewApiManager {
  private vscodeApi: VSCodeAPI | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeApi();
  }

  /**
   * VS Code APIの初期化
   */
  private initializeApi(): void {
    try {
      // すでに初期化済みの場合はスキップ
      if (this.vscodeApi) {
        log('✅ VS Code API already initialized');
        return;
      }

      // windowオブジェクトからAPIを取得
      const windowWithApi = window as Window & {
        vscodeApi?: VSCodeAPI;
      };

      if (windowWithApi.vscodeApi) {
        this.vscodeApi = windowWithApi.vscodeApi;
        this.isInitialized = true;
        log('✅ VS Code API initialized successfully');
      } else {
        // グローバルオブジェクトからの取得を試行
        const globalApi = (window as any).acquireVsCodeApi?.();
        if (globalApi) {
          this.vscodeApi = globalApi;
          this.isInitialized = true;
          log('✅ VS Code API acquired from global object');
        } else {
          log('❌ ERROR: No VS Code API available');
        }
      }
    } catch (error) {
      log('❌ ERROR: Failed to initialize VS Code API:', error);
    }
  }

  /**
   * VS Code APIが利用可能かチェック
   */
  public isApiAvailable(): boolean {
    return this.vscodeApi !== null && this.isInitialized;
  }

  /**
   * VS Code APIを取得（安全なアクセス）
   */
  public getApi(): VSCodeAPI | null {
    if (!this.isApiAvailable()) {
      this.initializeApi(); // 再初期化を試行
    }
    return this.vscodeApi;
  }

  /**
   * Extensionにメッセージを送信
   */
  public postMessageToExtension(message: unknown): boolean {
    try {
      // 🔍 DEBUG: Enhanced message sending tracking
      console.log('🔍 [DEBUG] WebViewApiManager.postMessageToExtension called with:', {
        message,
        messageType: typeof message,
        command: (message as any)?.command,
        hasApi: !!this.vscodeApi,
        isInitialized: this.isInitialized,
        timestamp: Date.now(),
      });

      const api = this.getApi();
      if (!api) {
        console.error('❌ [DEBUG] Cannot send message - No VS Code API available');
        log('❌ ERROR: Cannot send message - No VS Code API available');
        return false;
      }

      console.log('🔍 [DEBUG] About to call api.postMessage');
      api.postMessage(message as VsCodeMessage);
      console.log('🔍 [DEBUG] api.postMessage called successfully');

      log(`📤 Message sent to extension: ${(message as any)?.command || 'unknown'}`);
      return true;
    } catch (error) {
      log('❌ ERROR: Failed to send message to extension:', error);
      return false;
    }
  }

  /**
   * WebView状態を保存
   */
  public saveState(state: unknown): boolean {
    try {
      const api = this.getApi();
      if (!api) {
        log('❌ ERROR: Cannot save state - No VS Code API available');
        return false;
      }

      api.setState(state);
      log('💾 WebView state saved');
      return true;
    } catch (error) {
      log('❌ ERROR: Failed to save WebView state:', error);
      return false;
    }
  }

  /**
   * WebView状態を読み込み
   */
  public loadState(): unknown {
    try {
      const api = this.getApi();
      if (!api) {
        log('❌ ERROR: Cannot load state - No VS Code API available');
        return null;
      }

      const state = api.getState();
      log('📂 WebView state loaded');
      return state;
    } catch (error) {
      log('❌ ERROR: Failed to load WebView state:', error);
      return null;
    }
  }

  /**
   * API接続状態の診断情報
   */
  public getDiagnostics(): {
    isInitialized: boolean;
    isApiAvailable: boolean;
    apiMethods: string[];
  } {
    return {
      isInitialized: this.isInitialized,
      isApiAvailable: this.isApiAvailable(),
      apiMethods: this.vscodeApi ? Object.keys(this.vscodeApi) : [],
    };
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    log('🧹 Disposing WebViewApiManager...');
    this.vscodeApi = null;
    this.isInitialized = false;
    log('✅ WebViewApiManager disposed');
  }
}

/**
 * シングルトンインスタンス
 * WebView全体で共有するAPI管理インスタンス
 */
export const webViewApiManager = new WebViewApiManager();
