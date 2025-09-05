import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { generateNonce } from '../../utils/common';

/**
 * Interface for HTML generation options
 */
export interface HtmlGenerationOptions {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  includeSplitStyles?: boolean;
  includeCliAgentStyles?: boolean;
  customStyles?: string;
}

/**
 * Interface for fallback HTML generation
 */
export interface FallbackHtmlOptions {
  title?: string;
  message?: string;
  isLoading?: boolean;
}

/**
 * Interface for error HTML generation
 */
export interface ErrorHtmlOptions {
  error: unknown;
  allowRetry?: boolean;
  customMessage?: string;
}

/**
 * Service responsible for generating WebView HTML content
 * 
 * This service extracts HTML generation logic from SecondaryTerminalProvider to improve:
 * - Single Responsibility: Focus only on HTML generation and CSP management
 * - Testability: Isolated HTML generation logic with configurable options
 * - Reusability: Can be used by multiple providers or components
 * - Security: Centralized CSP management and nonce generation
 * - Maintainability: All HTML/CSS logic in one place for easy updates
 */
export class WebViewHtmlGenerationService {
  
  /**
   * Generate the main WebView HTML content
   */
  generateMainHtml(options: HtmlGenerationOptions): string {
    try {
      log('🎨 [HtmlGeneration] Generating main WebView HTML');

      const { webview, extensionUri } = options;
      
      // Generate script URI
      const scriptUri = this._generateScriptUri(webview, extensionUri);
      
      // Generate nonce for CSP
      const nonce = generateNonce();
      
      // Generate CSP header
      const csp = this._generateCSPHeader(webview, nonce);
      
      // Generate styles
      const styles = this._generateMainStyles(options);
      
      // Generate body content
      const bodyContent = this._generateBodyContent();
      
      // Generate inline scripts
      const inlineScripts = this._generateInlineScripts(nonce);
      
      // Generate main script tags
      const scriptTags = this._generateScriptTags(nonce, scriptUri);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${csp}
    <!-- XTerm CSS is now bundled in webview.js -->
    <style>
        ${styles}
    </style>
</head>
<body>
    ${bodyContent}
    ${inlineScripts}
    ${scriptTags}
</body>
</html>`;

      log(`✅ [HtmlGeneration] Main HTML generated successfully (${html.length} chars)`);
      return html;

    } catch (error) {
      log('❌ [HtmlGeneration] Failed to generate main HTML:', error);
      throw new Error(`HTML generation failed: ${String(error)}`);
    }
  }

  /**
   * Generate fallback HTML for loading states or initialization failures
   */
  generateFallbackHtml(options: FallbackHtmlOptions = {}): string {
    const {
      title = 'Terminal Loading...',
      message = 'Please wait while the terminal initializes.',
      isLoading = true
    } = options;

    const loadingIndicator = isLoading ? '🔄' : '⚠️';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        ${this._generateFallbackStyles()}
    </style>
</head>
<body>
    <div class="fallback-container">
        <h3>${loadingIndicator} ${title}</h3>
        <p>${message}</p>
        ${isLoading ? '<div class="spinner"></div>' : ''}
    </div>
</body>
</html>`;
  }

  /**
   * Generate error HTML for critical failures
   */
  generateErrorHtml(options: ErrorHtmlOptions): string {
    const {
      error,
      allowRetry = false,
      customMessage
    } = options;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const displayMessage = customMessage || `Terminal initialization failed: ${errorMessage}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terminal Error</title>
    <style>
        ${this._generateErrorStyles()}
    </style>
</head>
<body>
    <div class="error-container">
        <h3>❌ Terminal Error</h3>
        <p class="error-message">${displayMessage}</p>
        ${allowRetry ? '<button onclick="window.location.reload()" class="retry-btn">Try Again</button>' : ''}
        <details class="error-details">
            <summary>Error Details</summary>
            <pre>${errorMessage}</pre>
        </details>
    </div>
</body>
</html>`;
  }

  /**
   * Validate HTML content before setting on WebView
   */
  validateHtml(html: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!html || html.trim().length === 0) {
      errors.push('HTML content is empty');
    }

    if (!html.includes('<!DOCTYPE html>')) {
      errors.push('Missing DOCTYPE declaration');
    }

    if (!html.includes('<meta charset="UTF-8">')) {
      errors.push('Missing charset declaration');
    }

    if (!html.includes('Content-Security-Policy')) {
      errors.push('Missing Content Security Policy');
    }

    if (!html.includes('nonce=')) {
      errors.push('Missing nonce for CSP');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate script URI with error handling
   */
  private _generateScriptUri(webview: vscode.Webview, extensionUri: vscode.Uri): vscode.Uri {
    try {
      const webviewJsPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js');
      return webview.asWebviewUri(webviewJsPath);
    } catch (error) {
      log('❌ [HtmlGeneration] Failed to generate script URI:', error);
      throw new Error(`Script URI generation failed: ${String(error)}`);
    }
  }

  /**
   * Generate Content Security Policy header
   */
  private _generateCSPHeader(webview: vscode.Webview, nonce: string): string {
    return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource};">`;
  }

  /**
   * Generate main CSS styles
   */
  private _generateMainStyles(options: HtmlGenerationOptions): string {
    const baseStyles = this._getBaseStyles();
    const terminalStyles = this._getTerminalStyles();
    const splitStyles = options.includeSplitStyles !== false ? this._getSplitStyles() : '';
    const cliAgentStyles = options.includeCliAgentStyles !== false ? this._getCliAgentStyles() : '';
    const customStyles = options.customStyles || '';

    return `
        ${baseStyles}
        ${terminalStyles}
        ${splitStyles}
        ${cliAgentStyles}
        ${customStyles}
    `;
  }

  /**
   * Generate base CSS styles
   */
  private _getBaseStyles(): string {
    return `
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
    `;
  }

  /**
   * Generate terminal-specific CSS styles
   */
  private _getTerminalStyles(): string {
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
    `;
  }

  /**
   * Generate split layout CSS styles
   */
  private _getSplitStyles(): string {
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
    `;
  }

  /**
   * Generate CLI Agent specific CSS styles
   */
  private _getCliAgentStyles(): string {
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
    `;
  }

  /**
   * Generate fallback page styles
   */
  private _generateFallbackStyles(): string {
    return `
        body {
            font-family: var(--vscode-font-family, monospace);
            background-color: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-foreground, #cccccc);
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .fallback-container {
            text-align: center;
            padding: 20px;
        }

        .fallback-container h3 {
            margin-bottom: 10px;
            color: var(--vscode-foreground, #cccccc);
        }

        .fallback-container p {
            margin-bottom: 20px;
            color: var(--vscode-descriptionForeground, #999);
        }

        .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid var(--vscode-widget-border, #454545);
            border-top: 2px solid var(--vscode-focusBorder, #007acc);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
  }

  /**
   * Generate error page styles
   */
  private _generateErrorStyles(): string {
    return `
        body {
            font-family: var(--vscode-font-family, monospace);
            background-color: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-foreground, #cccccc);
            margin: 0;
            padding: 20px;
            line-height: 1.5;
        }

        .error-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }

        .error-container h3 {
            color: var(--vscode-errorForeground, #f48771);
            margin-bottom: 15px;
        }

        .error-message {
            color: var(--vscode-foreground, #cccccc);
            margin-bottom: 20px;
            padding: 10px;
            background: var(--vscode-input-background, #3c3c3c);
            border-radius: 4px;
        }

        .retry-btn {
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #fff);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 20px;
        }

        .retry-btn:hover {
            background: var(--vscode-button-hoverBackground, #1177bb);
        }

        .error-details {
            margin-top: 20px;
        }

        .error-details summary {
            cursor: pointer;
            color: var(--vscode-textLink-foreground, #4daafc);
            margin-bottom: 10px;
        }

        .error-details pre {
            background: var(--vscode-editor-background, #1e1e1e);
            border: 1px solid var(--vscode-widget-border, #454545);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            white-space: pre-wrap;
        }
    `;
  }

  /**
   * Generate body content
   */
  private _generateBodyContent(): string {
    return `
        <div id="terminal-body">
            <!-- Simple terminal container -->
        </div>
    `;
  }

  /**
   * Generate inline scripts for VS Code API initialization
   */
  private _generateInlineScripts(nonce: string): string {
    return `
        <script nonce="${nonce}">
            // Acquire VS Code API once and store it globally for webview.js to use
            try {
                if (typeof window.acquireVsCodeApi === 'function') {
                    const vscode = window.acquireVsCodeApi();
                    window.vscodeApi = vscode;
                } else {
                    console.error('acquireVsCodeApi not available');
                }
            } catch (error) {
                console.error('Error acquiring VS Code API:', error);
            }
        </script>
    `;
  }

  /**
   * Generate script tags for main webview script
   */
  private _generateScriptTags(nonce: string, scriptUri: vscode.Uri): string {
    return `
        <script nonce="${nonce}" src="${scriptUri.toString()}"
                onload="console.log('✅ webview.js loaded successfully')"
                onerror="console.error('❌ webview.js failed to load', event)"></script>
    `;
  }

  /**
   * Generate loading page styles
   */
  private _generateLoadingStyles(): string {
    return `
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

  /**
   * Dispose of resources (for consistency with other services)
   */
  dispose(): void {
    // This service doesn't hold resources, but included for interface consistency
    log('🧹 [HtmlGeneration] HTML generation service disposed');
  }
}