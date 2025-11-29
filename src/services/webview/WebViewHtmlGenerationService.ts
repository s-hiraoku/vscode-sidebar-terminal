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
  useSimplifiedWebView?: boolean;
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
    // Check if simplified WebView should be used
    if (options.useSimplifiedWebView) {
      return this.generateSimplifiedHtml(options);
    }

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
   * Generate simplified WebView HTML content
   *
   * VS Code Standard Pattern Implementation:
   * - Minimal HTML structure
   * - Single script bundle (webview-simple.js)
   * - No complex inline scripts
   * - Simplified styles
   */
  generateSimplifiedHtml(options: HtmlGenerationOptions): string {
    try {
      log('🎨 [HtmlGeneration] Generating simplified WebView HTML');

      const { webview, extensionUri } = options;

      // Generate script URI for simplified bundle
      const scriptUri = this._generateSimplifiedScriptUri(webview, extensionUri);

      // Generate nonce for CSP
      const nonce = generateNonce();

      // Generate CSP header
      const csp = this._generateCSPHeader(webview, nonce);

      // Generate simplified styles
      const styles = this._generateSimplifiedStyles();

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${csp}
    <style>
        ${styles}
    </style>
</head>
<body>
    <div id="terminal-body" role="main" aria-label="Terminal workspace"></div>
    <script nonce="${nonce}" src="${scriptUri.toString()}" id="webview-main-script"></script>
</body>
</html>`;

      log(`✅ [HtmlGeneration] Simplified HTML generated successfully (${html.length} chars)`);
      return html;
    } catch (error) {
      log('❌ [HtmlGeneration] Failed to generate simplified HTML:', error);
      throw new Error(`Simplified HTML generation failed: ${String(error)}`);
    }
  }

  /**
   * Generate fallback HTML for loading states or initialization failures
   */
  generateFallbackHtml(options: FallbackHtmlOptions = {}): string {
    const {
      title = 'Terminal Loading...',
      message = 'Please wait while the terminal initializes.',
      isLoading = true,
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
    const { error, allowRetry = false, customMessage } = options;

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
      errors,
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
   * Generate script URI for simplified WebView bundle
   */
  private _generateSimplifiedScriptUri(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ): vscode.Uri {
    try {
      const webviewJsPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview-simple.js');
      return webview.asWebviewUri(webviewJsPath);
    } catch (error) {
      log('❌ [HtmlGeneration] Failed to generate simplified script URI:', error);
      throw new Error(`Simplified script URI generation failed: ${String(error)}`);
    }
  }

  /**
   * Generate simplified CSS styles
   *
   * Minimal styles for the simplified WebView:
   * - Full viewport utilization
   * - VS Code theme variables
   * - Terminal-optimized layout
   */
  private _generateSimplifiedStyles(): string {
    return `
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
        }

        body {
            background-color: var(--vscode-terminal-background, var(--vscode-editor-background, #1e1e1e));
            color: var(--vscode-terminal-foreground, var(--vscode-foreground, #cccccc));
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
        }

        #terminal-body {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: var(--vscode-terminal-background, #1e1e1e);
        }

        /* Terminal container styles */
        .terminal-container {
            flex: 1 1 auto;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            position: relative;
        }

        .terminal-container.active {
            display: flex;
            flex-direction: column;
        }

        .terminal-container:not(.active) {
            display: none;
        }

        /* Terminal header styles */
        .terminal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 8px;
            background: var(--vscode-terminal-tab-activeBackground, var(--vscode-editor-background, #1e1e1e));
            border-bottom: 1px solid var(--vscode-panel-border, #454545);
            flex-shrink: 0;
        }

        .terminal-name {
            color: var(--vscode-terminal-foreground, var(--vscode-foreground, #cccccc));
            font-size: 12px;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .terminal-close-btn {
            background: transparent;
            border: none;
            color: var(--vscode-foreground, #cccccc);
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 14px;
            line-height: 1;
            opacity: 0.7;
        }

        .terminal-close-btn:hover {
            opacity: 1;
            background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
        }

        /* Terminal wrapper (xterm container) */
        .terminal-wrapper {
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
        }

        /* XTerm scrollbar styling */
        .xterm-viewport::-webkit-scrollbar {
            width: 10px;
        }

        .xterm-viewport::-webkit-scrollbar-track {
            background: transparent;
        }

        .xterm-viewport::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
            border-radius: 5px;
        }

        .xterm-viewport::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.7));
        }

        /* Terminals wrapper for multiple terminals */
        #terminals-wrapper {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            width: 100%;
            height: 100%;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            padding: 4px;
            gap: 4px;
            box-sizing: border-box;
        }
    `;
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
            width: 100% !important;
            height: 100% !important;
            max-width: none !important; /* 🔧 CRITICAL FIX: No width limit */
            margin: 0 !important;
            padding: 0 !important;
        }

        body {
            width: 100% !important;
            max-width: none !important; /* 🔧 CRITICAL FIX: No width limit */
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-foreground, #cccccc);
            font-family: var(--vscode-font-family, monospace);
            height: 100%;
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        /* Screen reader only content */
        .sr-only {
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
        }

        /* Focus visible styles for keyboard navigation */
        *:focus-visible {
            outline: 2px solid var(--vscode-focusBorder, #007acc);
            outline-offset: 2px;
        }

        /* Skip to main content link */
        .skip-link {
            position: absolute;
            top: -40px;
            left: 0;
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #fff);
            padding: 8px;
            text-decoration: none;
            z-index: 10000;
        }

        .skip-link:focus {
            top: 0;
        }
    `;
  }

  /**
   * Generate terminal-specific CSS styles
   *
   * 🎯 SIMPLE DESIGN: Minimal base styles only.
   * All terminal container styles are in display-modes.css
   */
  private _getTerminalStyles(): string {
    return `
        /* Terminal background color */
        #terminal-body {
            background: var(--vscode-terminal-background, #000);
        }

        /* Terminal scrollbar styling */
        .xterm-viewport::-webkit-scrollbar {
            width: 10px;
        }

        .xterm-viewport::-webkit-scrollbar-track {
            background: transparent;
        }

        .xterm-viewport::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
            border-radius: 5px;
        }

        .xterm-viewport::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.7));
        }

        .xterm-viewport::-webkit-scrollbar-thumb:active {
            background: var(--vscode-scrollbarSlider-activeBackground, rgba(191, 191, 191, 0.4));
        }
    `;
  }

  /**
   * Generate split layout CSS styles
   *
   * 🎯 SIMPLE DESIGN: All split styles are in display-modes.css
   */
  private _getSplitStyles(): string {
    return `/* Split styles defined in display-modes.css */`;
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
        <div id="terminal-body" role="main" aria-label="Terminal workspace">
            <!-- Screen reader announcements -->
            <div role="status" aria-live="polite" aria-atomic="true" class="sr-only" id="sr-status"></div>
            <div role="alert" aria-live="assertive" aria-atomic="true" class="sr-only" id="sr-alert"></div>
            <!-- Terminal containers will be added here by JavaScript -->
        </div>
    `;
  }

  /**
   * Generate inline scripts for VS Code API initialization
   *
   * 🎯 NOTE: acquireVsCodeApi() is called in main.ts (webview.js) at top level
   * This inline script only monitors script loading - no API acquisition needed here
   */
  private _generateInlineScripts(nonce: string): string {
    return `
        <script nonce="${nonce}">
            // Script loading monitoring
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
        </script>
    `;
  }

  /**
   * Generate script tags for main webview script
   */
  private _generateScriptTags(nonce: string, scriptUri: vscode.Uri): string {
    return `
        <script nonce="${nonce}" src="${scriptUri.toString()}" id="webview-main-script"></script>
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
