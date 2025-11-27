import * as vscode from 'vscode';
import { generateNonce } from '../utils/common';
import { provider as log } from '../utils/logger';

/**
 * WebView HTML Generator Service
 *
 * Extracted from SecondaryTerminalProvider to handle:
 * - HTML template generation for WebView
 * - CSS styling and theming
 * - Security policy configuration
 * - Script loading and initialization
 * - Error handling and fallback HTML
 */

export interface IWebViewHtmlGenerator {
  generateHtml(webview: vscode.Webview): string;
  generateFallbackHtml(): string;
  generateErrorHtml(error: unknown): string;
}

export class WebViewHtmlGenerator implements IWebViewHtmlGenerator {
  constructor(private extensionContext: vscode.ExtensionContext) {}

  public generateHtml(webview: vscode.Webview): string {
    try {
      const scriptUri = this.getScriptUri(webview);
      const nonce = generateNonce();
      const cspSource = webview.cspSource;

      return this.buildHtmlTemplate(scriptUri, nonce, cspSource);
    } catch (error) {
      log('❌ [HTML-GENERATOR] Failed to generate HTML:', error);
      throw error;
    }
  }

  public generateFallbackHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terminal Loading...</title>
        ${this.generateBaseStyles()}
    </head>
    <body>
        <div class="loading-container">
            <h3>🔄 Terminal is loading...</h3>
            <p>Please wait while the terminal initializes.</p>
        </div>
    </body>
    </html>`;
  }

  public generateErrorHtml(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terminal Error</title>
        ${this.generateBaseStyles()}
        <style>
            .error-container {
                color: var(--vscode-errorForeground, #f44747);
                text-align: center;
                padding: 20px;
            }
        </style>
    </head>
    <body>
        <div class="error-container">
            <h3>❌ Terminal initialization failed</h3>
            <p>Error: ${this.escapeHtml(errorMessage)}</p>
            <p>Please try reloading the terminal view.</p>
        </div>
    </body>
    </html>`;
  }

  private getScriptUri(webview: vscode.Webview): vscode.Uri {
    try {
      const webviewJsPath = vscode.Uri.joinPath(
        this.extensionContext.extensionUri,
        'dist',
        'webview.js'
      );
      return webview.asWebviewUri(webviewJsPath);
    } catch (error) {
      log('❌ [HTML-GENERATOR] Failed to create script URI:', error);
      throw error;
    }
  }

  private buildHtmlTemplate(scriptUri: vscode.Uri, nonce: string, cspSource: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="${this.generateCspContent(cspSource, nonce)}">
        <!-- XTerm CSS is now bundled in webview.js -->
        ${this.generateTerminalStyles()}
    </head>
    <body>
        <div id="terminal-body">
            <!-- Simple terminal container -->
        </div>
        ${this.generateInitializationScript(nonce)}
        <script nonce="${nonce}" src="${scriptUri.toString()}"
                onload="console.log('✅ webview.js loaded successfully')"
                onerror="console.error('❌ webview.js failed to load', event)"></script>
    </body>
    </html>`;
  }

  private generateCspContent(cspSource: string, nonce: string): string {
    return [
      "default-src 'none'",
      `style-src ${cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${cspSource}`,
      `font-src ${cspSource}`,
    ].join('; ');
  }

  private generateBaseStyles(): string {
    return `<style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-foreground, #cccccc);
            font-family: var(--vscode-font-family, monospace);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .loading-container,
        .error-container {
            text-align: center;
            padding: 20px;
        }

        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html, body {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
    </style>`;
  }

  private generateTerminalStyles(): string {
    return `<style>
        ${this.generateResetStyles()}
        ${this.generateLayoutStyles()}
        ${this.generateTerminalContainerStyles()}
        ${this.generateSplitLayoutStyles()}
        ${this.generateXTermStyles()}
        ${this.generateCliAgentStyles()}
        ${this.generateControlsStyles()}
    </style>`;
  }

  private generateResetStyles(): string {
    return `
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-foreground, #cccccc);
            font-family: var(--vscode-font-family, monospace);
            height: 100vh;
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        html, body {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
    `;
  }

  private generateLayoutStyles(): string {
    return `
        /* Split layout container */
        .terminal-layout {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        /* Split panes container */
        .split-container {
            flex: 1;
            display: flex;
            position: relative;
        }

        .split-container.horizontal {
            flex-direction: row;
        }

        .split-container.vertical {
            flex-direction: column;
        }
    `;
  }

  private generateTerminalContainerStyles(): string {
    return `
        /* Terminal containers */
        #terminal {
            flex: 1;
            width: 100%;
            background: #000;
            position: relative;
            overflow: hidden;
            margin: 0;
            padding: 0;
        }

        #terminal-body {
            flex: 1;
            width: 100%;
            height: 100%;
            background: #000;
            position: relative;
            overflow: hidden;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
        }

        .secondary-terminal {
            width: 100%;
            height: 100%;
            position: relative;
        }

        /* Terminal active border styles */
        .terminal-container {
            position: relative;
            width: 100%;
            height: 100%;
            border: 1px solid transparent !important;
            transition: border-color 0.2s ease-in-out;
        }

        .terminal-container.active {
            border-color: var(--vscode-focusBorder, #007acc) !important;
            border-width: 1px !important;
            border-style: solid !important;
        }

        .terminal-container.inactive {
            border-color: var(--vscode-widget-border, #454545) !important;
            opacity: 0.9;
        }

        /* Terminal body active border */
        #terminal-body.terminal-container.active {
            border-color: var(--vscode-focusBorder, #007acc) !important;
        }

        /* Individual terminal containers */
        div[data-terminal-container].terminal-container.active {
            border-color: var(--vscode-focusBorder, #007acc) !important;
        }

        /* Terminal container fixes */
        [data-terminal-container] {
            margin: 0 !important;
            padding: 2px !important;
            height: 100% !important;
            flex: 1 !important;
        }
    `;
  }

  private generateSplitLayoutStyles(): string {
    return `
        /* Terminal panes */
        .terminal-pane {
            position: relative;
            background: #000;
            min-width: 200px;
            min-height: 100px;
            display: flex;
            flex-direction: column;
            border: 1px solid transparent;
            transition: border-color 0.2s ease-in-out;
        }

        .terminal-pane.single {
            flex: 1;
        }

        .terminal-pane.split {
            flex: 1;
        }

        .terminal-pane.active {
            border-color: var(--vscode-focusBorder, #007acc);
        }

        .terminal-pane.inactive {
            border-color: var(--vscode-widget-border, #454545);
            opacity: 0.8;
        }

        /* Resize splitter */
        .splitter {
            background: var(--vscode-widget-border, #454545);
            position: relative;
            z-index: 10;
        }

        .splitter.horizontal {
            width: 4px;
            cursor: col-resize;
            min-width: 4px;
        }

        .splitter.vertical {
            height: 4px;
            cursor: row-resize;
            min-height: 4px;
        }

        .splitter:hover {
            background: var(--vscode-focusBorder, #007acc);
        }

        .splitter.dragging {
            background: var(--vscode-focusBorder, #007acc);
        }
    `;
  }

  private generateXTermStyles(): string {
    return `
        /* XTerm.js container fixes */
        .xterm {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
        }

        .xterm-viewport {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
        }

        .xterm-screen {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
        }
    `;
  }

  private generateCliAgentStyles(): string {
    return `
        /* CLI Agent status indicators */
        .terminal-name {
            color: var(--vscode-foreground) !important;
            font-weight: normal;
        }

        /* CLI Agent indicator styles */
        .claude-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            line-height: 1;
        }

        .claude-indicator.claude-connected {
            color: #4CAF50; /* Green for connected */
            animation: blink 1.5s infinite;
        }

        .claude-indicator.claude-disconnected {
            color: #F44336; /* Red for disconnected */
            /* No animation - solid color */
        }

        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
        }
    `;
  }

  private generateControlsStyles(): string {
    return `
        /* Split controls */
        .split-controls {
            position: absolute;
            top: 5px;
            right: 5px;
            z-index: 1000;
            display: flex;
            gap: 4px;
        }

        .split-btn {
            background: rgba(0, 0, 0, 0.7);
            color: var(--vscode-foreground, #cccccc);
            border: 1px solid var(--vscode-widget-border, #454545);
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            user-select: none;
        }

        .split-btn:hover {
            background: rgba(0, 0, 0, 0.9);
            border-color: var(--vscode-focusBorder, #007acc);
        }

        .split-btn.active {
            background: var(--vscode-button-background, #0e639c);
            border-color: var(--vscode-button-background, #0e639c);
        }

        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: var(--vscode-foreground, #cccccc);
            font-family: var(--vscode-font-family, monospace);
            background: var(--vscode-editor-background, #1e1e1e);
        }
    `;
  }

  private generateInitializationScript(nonce: string): string {
    return `<script nonce="${nonce}">
        // Acquire VS Code API once and store it globally for webview.js to use
        try {
            if (typeof window.acquireVsCodeApi === 'function') {
                const vscode = window.acquireVsCodeApi();
                window.vscodeApi = vscode;
                console.log('✅ [HTML-GENERATOR] VS Code API acquired successfully');
            } else {
                console.error('❌ [HTML-GENERATOR] acquireVsCodeApi not available');
            }
        } catch (error) {
            console.error('❌ [HTML-GENERATOR] Error acquiring VS Code API:', error);
        }
    </script>`;
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generate HTML for development mode with additional debugging
   */
  public generateDevelopmentHtml(webview: vscode.Webview): string {
    const baseHtml = this.generateHtml(webview);

    // Add development-specific scripts and styles
    const developmentExtensions = `
      <script nonce="${generateNonce()}">
        // Development mode enhancements
        console.log('🔧 [DEV] Development mode HTML loaded');
        window.isDevelopmentMode = true;
        
        // Enhanced error reporting in development
        window.addEventListener('error', function(event) {
          console.error('🚨 [DEV] Global error:', event.error);
        });
        
        window.addEventListener('unhandledrejection', function(event) {
          console.error('🚨 [DEV] Unhandled promise rejection:', event.reason);
        });
      </script>
      <style>
        /* Development mode indicators */
        body::before {
          content: '🔧 DEV';
          position: fixed;
          top: 5px;
          left: 5px;
          z-index: 9999;
          background: rgba(255, 193, 7, 0.8);
          color: #000;
          padding: 2px 6px;
          font-size: 10px;
          border-radius: 3px;
          pointer-events: none;
        }
      </style>
    `;

    // Insert development extensions before closing head tag
    return baseHtml.replace('</head>', developmentExtensions + '</head>');
  }

  /**
   * Generate HTML with custom theme overrides
   */
  public generateThemedHtml(webview: vscode.Webview, theme: 'light' | 'dark' | 'auto'): string {
    const baseHtml = this.generateHtml(webview);

    let themeStyles = '';
    if (theme === 'light') {
      themeStyles = this.generateLightThemeOverrides();
    } else if (theme === 'dark') {
      themeStyles = this.generateDarkThemeOverrides();
    }

    if (themeStyles) {
      return baseHtml.replace('</style>', themeStyles + '</style>');
    }

    return baseHtml;
  }

  private generateLightThemeOverrides(): string {
    return `
      /* Light theme overrides */
      :root {
        --theme-background: #ffffff;
        --theme-foreground: #000000;
        --theme-border: #cccccc;
      }
      
      body {
        background-color: var(--theme-background) !important;
        color: var(--theme-foreground) !important;
      }
      
      .terminal-container {
        border-color: var(--theme-border) !important;
      }
    `;
  }

  private generateDarkThemeOverrides(): string {
    return `
      /* Dark theme overrides */
      :root {
        --theme-background: #1e1e1e;
        --theme-foreground: #cccccc;
        --theme-border: #454545;
      }
      
      body {
        background-color: var(--theme-background) !important;
        color: var(--theme-foreground) !important;
      }
      
      .terminal-container {
        border-color: var(--theme-border) !important;
      }
    `;
  }
}
