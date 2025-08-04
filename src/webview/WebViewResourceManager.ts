/**
 * WebView リソース管理サービス
 *
 * WebView の HTML 生成、リソース管理、設定を専門に行います。
 * Provider から分離してリソース管理のみに特化しています。
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { extension as log } from '../utils/logger';

export interface IWebViewResourceManager {
  configureWebview(webviewView: vscode.WebviewView, context: vscode.ExtensionContext): void;
  generateHTML(webview: vscode.Webview, context: vscode.ExtensionContext): string;
  getResourceUri(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    ...pathSegments: string[]
  ): vscode.Uri;
  setWebviewOptions(webview: vscode.Webview): void;
}

export interface WebViewResourceConfig {
  enableScripts: boolean;
  enableForms: boolean;
  enableCommandUris: boolean;
  retainContextWhenHidden: boolean;
  localResourceRoots: string[];
}

/**
 * WebView リソース管理サービス
 */
export class WebViewResourceManager implements IWebViewResourceManager {
  private readonly config: WebViewResourceConfig;

  constructor(config: Partial<WebViewResourceConfig> = {}) {
    this.config = {
      enableScripts: true,
      enableForms: true,
      enableCommandUris: false,
      retainContextWhenHidden: true,
      localResourceRoots: ['dist', 'src/webview'],
      ...config,
    };

    log('🎨 [WEBVIEW-RESOURCE] WebView resource manager initialized');
  }

  /**
   * WebView を設定
   */
  configureWebview(webviewView: vscode.WebviewView, context: vscode.ExtensionContext): void {
    try {
      // WebView オプションを設定
      this.setWebviewOptions(webviewView.webview);

      // HTML を生成・設定
      webviewView.webview.html = this.generateHTML(webviewView.webview, context);

      // WebView の表示設定
      webviewView.show?.(true);

      log('✅ [WEBVIEW-RESOURCE] WebView configured successfully');
    } catch (error) {
      log(`❌ [WEBVIEW-RESOURCE] Failed to configure WebView: ${String(error)}`);
      throw error;
    }
  }

  /**
   * HTML を生成
   */
  generateHTML(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    try {
      // リソース URI を取得
      const scriptUri = this.getResourceUri(webview, context, 'dist', 'webview.js');
      const styleResetUri = this.getResourceUri(
        webview,
        context,
        'src',
        'webview',
        'styles',
        'reset.css'
      );
      const styleVSCodeUri = this.getResourceUri(
        webview,
        context,
        'src',
        'webview',
        'styles',
        'vscode.css'
      );
      const styleMainUri = this.getResourceUri(
        webview,
        context,
        'src',
        'webview',
        'styles',
        'main.css'
      );

      // nonce を生成（セキュリティ）
      const nonce = this.generateNonce();

      const html = this.buildHTMLContent({
        nonce,
        scriptUri: scriptUri.toString(),
        styleResetUri: styleResetUri.toString(),
        styleVSCodeUri: styleVSCodeUri.toString(),
        styleMainUri: styleMainUri.toString(),
      });

      log('📄 [WEBVIEW-RESOURCE] HTML generated successfully');
      return html;
    } catch (error) {
      log(`❌ [WEBVIEW-RESOURCE] Failed to generate HTML: ${String(error)}`);
      return this.generateErrorHTML(String(error));
    }
  }

  /**
   * リソース URI を取得
   */
  getResourceUri(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    ...pathSegments: string[]
  ): vscode.Uri {
    const resourcePath = path.join(context.extensionPath, ...pathSegments);
    return webview.asWebviewUri(vscode.Uri.file(resourcePath));
  }

  /**
   * WebView オプションを設定
   */
  setWebviewOptions(webview: vscode.Webview): void {
    const localResourceRoots = this.config.localResourceRoots.map((root) =>
      vscode.Uri.file(
        path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname, root)
      )
    );

    webview.options = {
      enableScripts: this.config.enableScripts,
      enableForms: this.config.enableForms,
      enableCommandUris: this.config.enableCommandUris,
      localResourceRoots,
    };

    log(`🔧 [WEBVIEW-RESOURCE] WebView options set: ${JSON.stringify(webview.options)}`);
  }

  // === プライベートメソッド ===

  /**
   * HTML コンテンツを構築
   */
  private buildHTMLContent(resources: {
    nonce: string;
    scriptUri: string;
    styleResetUri: string;
    styleVSCodeUri: string;
    styleMainUri: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${resources.styleResetUri} ${resources.styleVSCodeUri} ${resources.styleMainUri} 'unsafe-inline'; script-src 'nonce-${resources.nonce}'; font-src 'self' data:;">
    
    <link href="${resources.styleResetUri}" rel="stylesheet">
    <link href="${resources.styleVSCodeUri}" rel="stylesheet">
    <link href="${resources.styleMainUri}" rel="stylesheet">
    
    <title>Secondary Terminal</title>
</head>
<body>
    <!-- ターミナルコンテナ -->
    <div id="terminal-container">
        <div id="loading-screen">
            <div class="loading-spinner"></div>
            <div class="loading-text">Initializing Terminal...</div>
        </div>
        
        <!-- エラー表示エリア -->
        <div id="error-container" style="display: none;">
            <div class="error-message">
                <h3>🚨 Terminal Error</h3>
                <p id="error-text"></p>
                <button id="retry-button" class="retry-btn">Retry</button>
            </div>
        </div>
        
        <!-- メインターミナルエリア -->
        <div id="main-terminal-area" style="display: none;">
            <!-- ターミナルヘッダー -->
            <div id="terminal-header">
                <div class="header-content">
                    <div class="header-left">
                        <span id="header-title">Terminal</span>
                        <span id="terminal-count" class="terminal-count">0</span>
                    </div>
                    <div class="header-right">
                        <button id="new-terminal-btn" class="header-btn" title="New Terminal">
                            <span class="icon">+</span>
                        </button>
                        <button id="settings-btn" class="header-btn" title="Settings">
                            <span class="icon">⚙️</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- ターミナルタブ -->
            <div id="terminal-tabs" class="terminal-tabs"></div>
            
            <!-- ターミナル本体 -->
            <div id="terminals" class="terminals-container"></div>
            
            <!-- ステータスバー -->
            <div id="status-bar" class="status-bar">
                <div class="status-left">
                    <span id="status-text">Ready</span>
                </div>
                <div class="status-right">
                    <span id="cli-agent-status" class="cli-agent-status">No Agent</span>
                </div>
            </div>
        </div>
    </div>

    <!-- 設定パネル -->
    <div id="settings-panel" class="settings-panel" style="display: none;">
        <div class="settings-content">
            <div class="settings-header">
                <h3>Terminal Settings</h3>
                <button id="close-settings-btn" class="close-btn">&times;</button>
            </div>
            <div class="settings-body">
                <!-- 設定項目がここに動的に追加される -->
            </div>
        </div>
    </div>

    <!-- 通知エリア -->
    <div id="notification-area" class="notification-area"></div>

    <!-- メイン JavaScript -->
    <script nonce="${resources.nonce}" src="${resources.scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * エラー HTML を生成
   */
  private generateErrorHTML(error: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secondary Terminal - Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .error-container {
            max-width: 500px;
            margin: 50px auto;
            text-align: center;
        }
        .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .error-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 12px;
        }
        .error-message {
            font-size: 14px;
            line-height: 1.4;
            margin-bottom: 20px;
            padding: 12px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
        }
        .retry-instructions {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">🚨</div>
        <div class="error-title">Failed to Load Terminal</div>
        <div class="error-message">${this.escapeHtml(error)}</div>
        <div class="retry-instructions">
            Try reloading VS Code or check the extension logs for more details.
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * nonce を生成（セキュリティ）
   */
  private generateNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * HTML エスケープ
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (match) => map[match] || match);
  }
}
