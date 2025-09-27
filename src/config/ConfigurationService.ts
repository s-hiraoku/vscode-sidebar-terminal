/**
 * 統一された設定アクセスサービス
 *
 * VS Code設定へのアクセスを集約し、キャッシュ機能付きで
 * 一貫性のある設定管理を提供します。
 */

import * as vscode from 'vscode';
import { extension as log } from '../utils/logger';

/**
 * 設定変更イベントハンドラー
 */
export type ConfigChangeHandler = (
  section: string,
  key: string,
  newValue: unknown,
  oldValue: unknown
) => void;

/**
 * 統一された設定サービス
 */
export class ConfigurationService {
  private static instance: ConfigurationService;
  private configCache = new Map<string, unknown>();
  private changeHandlers = new Set<ConfigChangeHandler>();
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    this.setupConfigurationWatcher();
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): ConfigurationService {
    if (!this.instance) {
      this.instance = new ConfigurationService();
    }
    return this.instance;
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.disposables.forEach((d) => {
      d.dispose();
    });
    this.disposables = [];
    this.configCache.clear();
    this.changeHandlers.clear();
  }

  // === VS Code設定セクション取得 ===

  /**
   * Secondary Terminal設定を取得
   */
  getSecondaryTerminalConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('secondaryTerminal');
  }

  /**
   * Terminal統合設定を取得
   */
  getTerminalIntegratedConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('terminal.integrated');
  }

  /**
   * エディター設定を取得
   */
  getEditorConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('editor');
  }

  /**
   * ワークベンチ設定を取得
   */
  getWorkbenchConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('workbench');
  }

  // === キャッシュ付き設定値取得 ===

  /**
   * キャッシュ付きで設定値を取得
   */
  getCachedValue<T>(section: string, key: string, defaultValue: T): T {
    const cacheKey = `${section}.${key}`;

    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey) as T;
    }

    const value = vscode.workspace.getConfiguration(section).get<T>(key, defaultValue);
    this.configCache.set(cacheKey, value);
    return value;
  }

  /**
   * 設定値を強制的に再読み込み
   */
  refreshValue<T>(section: string, key: string, defaultValue: T): T {
    const cacheKey = `${section}.${key}`;
    this.configCache.delete(cacheKey);
    return this.getCachedValue(section, key, defaultValue);
  }

  /**
   * 複数の設定値をバッチで取得
   */
  getBatchValues(
    configs: Array<{ section: string; key: string; defaultValue: unknown }>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const config of configs) {
      const fullKey = `${config.section}.${config.key}`;
      result[fullKey] = this.getCachedValue(config.section, config.key, config.defaultValue);
    }

    return result;
  }

  // === 具体的な設定値取得メソッド ===

  /**
   * Terminal関連設定を取得
   */
  getTerminalSettings(): Record<string, unknown> {
    return {
      // Secondary Terminal設定
      maxTerminals: this.getCachedValue('secondaryTerminal', 'maxTerminals', 5),
      shell: this.getCachedValue('secondaryTerminal', 'shell', ''),
      shellArgs: this.getCachedValue('secondaryTerminal', 'shellArgs', []),
      cwd: this.getCachedValue('secondaryTerminal', 'cwd', ''),
      env: this.getCachedValue('secondaryTerminal', 'env', {}),

      // フォント設定
      fontFamily: this.getCachedValue(
        'secondaryTerminal',
        'fontFamily',
        "Menlo, Monaco, 'Courier New', monospace"
      ),
      fontSize: this.getCachedValue('secondaryTerminal', 'fontSize', 12),
      lineHeight: this.getCachedValue('secondaryTerminal', 'lineHeight', 1.2),

      // 表示設定
      cursorBlink: this.getCachedValue('secondaryTerminal', 'cursorBlink', true),
      cursorStyle: this.getCachedValue('secondaryTerminal', 'cursorStyle', 'block'),
      theme: this.getCachedValue('secondaryTerminal', 'theme', 'dark'),

      // ヘッダー設定
      showHeader: this.getCachedValue('secondaryTerminal', 'showHeader', true),
      headerTitle: this.getCachedValue('secondaryTerminal', 'headerTitle', 'Terminal'),

      // パフォーマンス設定
      scrollback: this.getCachedValue('secondaryTerminal', 'scrollback', 1000),
      fastScrollModifier: this.getCachedValue('secondaryTerminal', 'fastScrollModifier', 'alt'),

      // CLI Agent設定
      enableCliAgentIntegration: this.getCachedValue(
        'secondaryTerminal',
        'enableCliAgentIntegration',
        true
      ),
      enableGitHubCopilotIntegration: this.getCachedValue(
        'secondaryTerminal',
        'enableGitHubCopilotIntegration',
        true
      ),
      highlightActiveBorder: this.getCachedValue('secondaryTerminal', 'highlightActiveBorder', true),
    };
  }

  /**
   * Alt+Click関連設定を取得
   */
  getAltClickSettings(): Record<string, unknown> {
    return {
      altClickMovesCursor: this.getCachedValue('terminal.integrated', 'altClickMovesCursor', true),
      multiCursorModifier: this.getCachedValue('editor', 'multiCursorModifier', 'alt'),
    };
  }

  /**
   * 永続化セッション設定を取得
   */
  getPersistentSessionSettings(): Record<string, unknown> {
    return {
      enablePersistentSessions: this.getCachedValue(
        'terminal.integrated',
        'enablePersistentSessions',
        true
      ),
      persistentSessionScrollback: this.getCachedValue(
        'terminal.integrated',
        'persistentSessionScrollback',
        100
      ),
      persistentSessionReviveProcess: this.getCachedValue(
        'terminal.integrated',
        'persistentSessionReviveProcess',
        'onExitAndWindowClose'
      ),
    };
  }

  /**
   * テーマ関連設定を取得
   */
  getThemeSettings(): Record<string, unknown> {
    return {
      colorTheme: this.getCachedValue('workbench', 'colorTheme', 'Default Dark Modern'),
      iconTheme: this.getCachedValue('workbench', 'iconTheme', 'vs-seti'),
      preferredDarkColorTheme: this.getCachedValue(
        'workbench',
        'preferredDarkColorTheme',
        'Default Dark Modern'
      ),
      preferredLightColorTheme: this.getCachedValue(
        'workbench',
        'preferredLightColorTheme',
        'Default Light Modern'
      ),
    };
  }

  // === 設定値更新 ===

  /**
   * 設定値を更新
   */
  async updateValue(
    section: string,
    key: string,
    value: unknown,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    try {
      await vscode.workspace.getConfiguration(section).update(key, value, target);

      // キャッシュを更新
      const cacheKey = `${section}.${key}`;
      this.configCache.set(cacheKey, value);

      log(`✅ [CONFIG] Updated ${section}.${key} = ${JSON.stringify(value)}`);
    } catch (error) {
      log(`❌ [CONFIG] Failed to update ${section}.${key}: ${String(error)}`);
      throw error;
    }
  }

  /**
   * 複数の設定値をバッチで更新
   */
  async updateBatchValues(
    updates: Array<{
      section: string;
      key: string;
      value: unknown;
      target?: vscode.ConfigurationTarget;
    }>
  ): Promise<void> {
    const errors: string[] = [];

    for (const update of updates) {
      try {
        await this.updateValue(
          update.section,
          update.key,
          update.value,
          update.target || vscode.ConfigurationTarget.Workspace
        );
      } catch (error) {
        errors.push(`${update.section}.${update.key}: ${String(error)}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Batch update failed for: ${errors.join(', ')}`);
    }
  }

  // === 設定変更監視 ===

  /**
   * 設定変更ハンドラーを追加
   */
  onConfigurationChanged(handler: ConfigChangeHandler): vscode.Disposable {
    this.changeHandlers.add(handler);

    return {
      dispose: () => {
        this.changeHandlers.delete(handler);
      },
    };
  }

  /**
   * 特定セクションの設定変更を監視
   */
  onSectionChanged(
    section: string,
    handler: (key: string, newValue: unknown, oldValue: unknown) => void
  ): vscode.Disposable {
    return this.onConfigurationChanged((changedSection, key, newValue, oldValue) => {
      if (changedSection === section) {
        handler(key, newValue, oldValue);
      }
    });
  }

  // === プライベートメソッド ===

  /**
   * 設定変更ウォッチャーを設定
   */
  private setupConfigurationWatcher(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      // 関連セクションのキャッシュをクリア
      const sectionsToWatch = ['secondaryTerminal', 'terminal.integrated', 'editor', 'workbench'];

      for (const section of sectionsToWatch) {
        if (event.affectsConfiguration(section)) {
          this.clearSectionCache(section);

          // 変更ハンドラーに通知
          this.notifyConfigurationChange(section, event);
        }
      }
    });

    this.disposables.push(disposable);
  }

  /**
   * セクションのキャッシュをクリア
   */
  private clearSectionCache(section: string): void {
    const keysToDelete: string[] = [];

    this.configCache.forEach((value, key) => {
      if (key.startsWith(`${section}.`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.configCache.delete(key));
    log(`🧹 [CONFIG] Cleared cache for section: ${section}`);
  }

  /**
   * 設定変更をハンドラーに通知
   */
  private notifyConfigurationChange(
    section: string,
    _event: vscode.ConfigurationChangeEvent
  ): void {
    // 簡単な実装: セクション全体が変更されたと通知
    // より詳細な実装では、個別のキー変更を検出
    this.changeHandlers.forEach((handler) => {
      handler(section, '*', null, null);
    });
  }
}
