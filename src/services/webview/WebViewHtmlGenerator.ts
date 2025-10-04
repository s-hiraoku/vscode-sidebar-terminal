import * as vscode from 'vscode';
import { IWebViewHtmlGenerator } from './interfaces';
import { provider as log } from '../../utils/logger';
import { generateNonce } from '../../utils/common';

/**
 * Generates HTML content for the WebView
 *
 * This service extracts HTML generation logic from SecondaryTerminalProvider
 * to provide focused, testable HTML generation with proper security policies.
 */
export class WebViewHtmlGenerator implements IWebViewHtmlGenerator {
  private readonly extensionContext: vscode.ExtensionContext;

  constructor(extensionContext: vscode.ExtensionContext) {
    this.extensionContext = extensionContext;
    log('🎨 [HtmlGenerator] WebView HTML generator initialized');
  }

  /**
   * Generate main HTML for the WebView
   */
  generateMainHtml(webview: vscode.Webview): string {
    try {
      log('🎨 [HtmlGenerator] Generating main WebView HTML');

      // Create script URI
      const webviewJsPath = vscode.Uri.joinPath(
        this.extensionContext.extensionUri,
        'dist',
        'webview.js'
      );
      const scriptUri = webview.asWebviewUri(webviewJsPath);

      // Generate nonce for security
      const nonce = generateNonce();

      const html = this.buildMainHtmlTemplate(webview, scriptUri, nonce);

      log(`✅ [HtmlGenerator] Main HTML generated successfully (${html.length} characters)`);
      return html;
    } catch (error) {
      log('❌ [HtmlGenerator] Error generating main HTML:', error);
      throw error;
    }
  }

  /**
   * Generate fallback HTML when main generation fails
   */
  generateFallbackHtml(): string {
    log('🔄 [HtmlGenerator] Generating fallback HTML');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terminal Loading...</title>
        <style>
            body {
                font-family: var(--vscode-font-family, monospace);
                background-color: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-foreground, #cccccc);
                padding: 20px;
                text-align: center;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                flex-direction: column;
            }
            .loading-spinner {
                border: 3px solid var(--vscode-widget-border, #454545);
                border-top: 3px solid var(--vscode-focusBorder, #007acc);
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin-bottom: 15px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="loading-spinner"></div>
        <h3>🔄 Terminal is loading...</h3>
        <p>Please wait while the terminal initializes.</p>
        <p><small>If this takes too long, please try reloading the window.</small></p>
    </body>
    </html>`;
  }

  /**
   * Generate error HTML when setup fails
   */
  generateErrorHtml(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`❌ [HtmlGenerator] Generating error HTML for: ${errorMessage}`);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terminal Error</title>
        <style>
            body {
                font-family: var(--vscode-font-family, monospace);
                background-color: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-errorForeground, #f44747);
                padding: 20px;
                text-align: center;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                flex-direction: column;
            }
            .error-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            .error-message {
                background: var(--vscode-inputValidation-errorBackground, rgba(244, 71, 71, 0.1));
                border: 1px solid var(--vscode-inputValidation-errorBorder, #f44747);
                border-radius: 3px;
                padding: 15px;
                margin: 15px 0;
                font-family: var(--vscode-editor-font-family, monospace);
                font-size: 12px;
                max-width: 500px;
                word-break: break-word;
            }
            .retry-button {
                background: var(--vscode-button-background, #0e639c);
                color: var(--vscode-button-foreground, white);
                border: none;
                padding: 8px 16px;
                border-radius: 3px;
                cursor: pointer;
                margin-top: 15px;
            }
            .retry-button:hover {
                background: var(--vscode-button-hoverBackground, #1177bb);
            }
        </style>
    </head>
    <body>
        <div class="error-icon">❌</div>
        <h3>Terminal initialization failed</h3>
        <div class="error-message">
            <strong>Error:</strong> ${this.escapeHtml(errorMessage)}
        </div>
        <p>Please try one of the following solutions:</p>
        <ul style="text-align: left; display: inline-block;">
            <li>Reload the window (<code>Ctrl+Shift+P</code> → "Developer: Reload Window")</li>
            <li>Restart VS Code</li>
            <li>Check the VS Code Developer Console for more details</li>
        </ul>
        <button class="retry-button" onclick="window.location.reload()">Retry Loading</button>
    </body>
    </html>`;
  }

  /**
   * Build the main HTML template with all necessary components
   */
  private buildMainHtmlTemplate(
    webview: vscode.Webview,
    scriptUri: vscode.Uri,
    nonce: string
  ): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
          webview.cspSource
        } 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
        <title>Secondary Terminal</title>
        ${this.generateMainStyles()}
    </head>
    <body>
        <div id="terminal-body">
            <!-- Terminal container will be populated by webview.js -->
        </div>
        ${this.generateInitializationScript(nonce)}
        <script nonce="${nonce}" src="${scriptUri.toString()}" id="webview-main-script"></script>
    </body>
    </html>`;
  }

  /**
   * Generate main CSS styles for the terminal
   */
  private generateMainStyles(): string {
    return `
        <style>
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

            /* Terminal layout container */
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

            /* Terminal containers */
            #terminal {
                flex: 1;
                width: 100%;
                background: #000;
                position: relative;
                overflow: hidden;
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
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
                height: auto;
                flex: 0 0 auto;
                display: flex;
                flex-direction: column;
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

            /* XTerm.js container fixes */
            .xterm {
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
            }

            .xterm-viewport {
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
            }

            .xterm-screen {
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
            }

            /* Terminal container fixes */
            [data-terminal-container] {
                margin: 0 !important;
                padding: 2px !important;
                height: 100% !important;
                flex: 1 !important;
            }

            /* Ensure full height usage */
            html, body {
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }

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
                color: #4CAF50;
                animation: blink 1.5s infinite;
            }

            .claude-indicator.claude-disconnected {
                color: #F44336;
            }

            @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.3; }
                100% { opacity: 1; }
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

            /* ========================================
               Display Modes (Issue #198)
               ======================================== */

            /* Terminal Container Display Modes */
            .terminal-container.normal-mode {
                display: block;
                width: 100%;
                height: auto;
                position: relative;
            }

            .terminal-container.fullscreen-mode {
                display: flex !important;
                flex-direction: column;
                width: 100%;
                height: 100% !important;
                flex: 1 1 auto !important;
                min-height: 0;
                z-index: 10;
                position: relative;
                animation: fadeIn 0.2s ease-in-out;
            }

            .terminal-container.hidden-mode {
                display: none !important;
                animation: fadeOut 0.15s ease-in-out;
            }

            .terminal-container.split-mode {
                display: flex;
                flex-direction: column;
            }

            /* Split Mode Toggle Button */
            .split-mode-toggle-button {
                background: transparent;
                border: none;
                color: var(--vscode-foreground);
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 16px;
                transition: background-color 0.2s ease, color 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .split-mode-toggle-button:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .split-mode-toggle-button.active {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .split-mode-toggle-button:focus {
                outline: 1px solid var(--vscode-focusBorder);
                outline-offset: 2px;
            }

            /* Display Mode Animations */
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.98);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            @keyframes fadeOut {
                from {
                    opacity: 1;
                }
                to {
                    opacity: 0;
                }
            }

            /* Tab Close Button Enhancements */
            .terminal-tab-close {
                transition: opacity 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
            }

            .terminal-tab-close:hover {
                transform: scale(1.1);
            }

            .terminal-tab-close:active {
                transform: scale(0.95);
            }

            .terminal-tab-close:focus {
                outline: 1px solid var(--vscode-focusBorder);
                outline-offset: 1px;
            }

            /* Accessibility: Reduced Motion */
            @media (prefers-reduced-motion: reduce) {
                .terminal-container.fullscreen-mode,
                .terminal-container.hidden-mode,
                .terminal-tab-close {
                    animation: none;
                    transition: none;
                }
            }

            /* High Contrast Mode Support */
            @media (prefers-contrast: high) {
                .split-mode-toggle-button.active {
                    border: 2px solid var(--vscode-contrastActiveBorder, var(--vscode-focusBorder));
                }

                .terminal-tab-close:hover {
                    border: 1px solid var(--vscode-contrastActiveBorder, var(--vscode-focusBorder));
                }
            }
        </style>`;
  }

  /**
   * Generate initialization script for VS Code API
   */
  private generateInitializationScript(nonce: string): string {
    return `
        <script nonce="${nonce}">
            // Acquire VS Code API once and store it globally for webview.js to use
            try {
                if (typeof window.acquireVsCodeApi === 'function') {
                    const vscode = window.acquireVsCodeApi();
                    window.vscodeApi = vscode;
                    console.log('✅ VS Code API acquired successfully');
                } else {
                    console.error('❌ acquireVsCodeApi not available');
                }
            } catch (error) {
                console.error('❌ Error acquiring VS Code API:', error);
            }

            // Add script loading event handlers
            document.addEventListener('DOMContentLoaded', function() {
                const script = document.getElementById('webview-main-script');
                if (script) {
                    script.addEventListener('load', function() {
                        console.log('✅ webview.js loaded successfully');
                    });
                    script.addEventListener('error', function(event) {
                        console.error('❌ webview.js failed to load', event);
                    });
                }
            });
        </script>`;
  }

  /**
   * Escape HTML to prevent XSS attacks
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get debug information about HTML generation
   */
  getDebugInfo(): object {
    return {
      extensionUri: this.extensionContext.extensionUri.toString(),
      webviewDistPath: vscode.Uri.joinPath(
        this.extensionContext.extensionUri,
        'dist',
        'webview.js'
      ).toString(),
      timestamp: new Date().toISOString(),
    };
  }
}
