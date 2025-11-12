import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { WebViewHtmlGenerationService } from './WebViewHtmlGenerationService';
import { TerminalErrorHandler } from '../../utils/feedback';

/**
 * Manages WebView lifecycle including configuration, HTML generation, and event setup
 *
 * This service extracts WebView lifecycle management from SecondaryTerminalProvider
 * following the Single Responsibility Principle.
 */
export class WebViewLifecycleManager {
  private readonly htmlGenerationService: WebViewHtmlGenerationService;

  constructor(private readonly extensionContext: vscode.ExtensionContext) {
    this.htmlGenerationService = new WebViewHtmlGenerationService();
    log('🎨 [LifecycleManager] HTML generation service initialized');
  }

  /**
   * Configure WebView options
   */
  configureWebview(webviewView: vscode.WebviewView): void {
    try {
      log('🔧 [LifecycleManager] Configuring WebView options...');

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.extensionContext.extensionUri],
      };

      log('✅ [LifecycleManager] WebView options configured successfully');
    } catch (error) {
      log('❌ [LifecycleManager] Failed to configure WebView options:', error);
      throw error;
    }
  }

  /**
   * Set WebView HTML with robust error handling
   */
  setWebviewHtml(webviewView: vscode.WebviewView, isPanelMove: boolean): void {
    try {
      log('🎆 [LifecycleManager] Setting WebView HTML...');
      log('🎆 [LifecycleManager] isPanelMove:', isPanelMove);

      const html = this.generateHtml(webviewView.webview);

      if (!html || html.length === 0) {
        throw new Error('Generated HTML is empty');
      }

      log('🎆 [LifecycleManager] Generated HTML length:', html.length);
      log('🎆 [LifecycleManager] HTML preview (first 300 chars):', html.substring(0, 300));

      webviewView.webview.html = html;

      log('✅ [LifecycleManager] HTML set successfully');
      log('🎆 [LifecycleManager] WebView HTML length after setting:', webviewView.webview.html.length);
    } catch (error) {
      log('❌ [LifecycleManager] Failed to set WebView HTML:', error);

      // Set fallback HTML to prevent complete failure
      const fallbackHtml = this.generateFallbackHtml();
      webviewView.webview.html = fallbackHtml;

      log('🔄 [LifecycleManager] Fallback HTML set');
      throw error;
    }
  }

  /**
   * Set up WebView event listeners
   */
  setupWebviewEventListeners(
    webviewView: vscode.WebviewView,
    isPanelMove: boolean,
    onPanelLocationDetectionRequested: () => void
  ): void {
    try {
      log('🎆 [LifecycleManager] Setting up WebView event listeners...');
      log('🎆 [LifecycleManager] isPanelMove:', isPanelMove);

      // Set up visibility change handler for panel move detection
      webviewView.onDidChangeVisibility(
        () => {
          if (webviewView.visible) {
            log('👁️ [LifecycleManager] WebView became visible - triggering panel location detection');

            // Trigger panel location detection when WebView becomes visible
            // This handles cases where the panel was moved while hidden
            setTimeout(() => {
              log('📍 [LifecycleManager] Requesting panel location detection after visibility change');
              onPanelLocationDetectionRequested();
            }, 500); // Small delay to ensure WebView is fully loaded
          } else {
            log('👁️ [LifecycleManager] WebView became hidden');
          }
        },
        null,
        this.extensionContext.subscriptions
      );

      log('✅ [LifecycleManager] WebView event listeners set up successfully');
    } catch (error) {
      log('❌ [LifecycleManager] Failed to set up WebView event listeners:', error);
      throw error;
    }
  }

  /**
   * Handle WebView setup errors gracefully
   */
  handleWebviewSetupError(webviewView: vscode.WebviewView, error: unknown): void {
    try {
      log('🚨 [LifecycleManager] Handling WebView setup error...');

      // Ensure we have some HTML set, even if it's just an error message
      const errorHtml = this.generateErrorHtml(error);
      webviewView.webview.html = errorHtml;

      // Report error through standard channels
      TerminalErrorHandler.handleWebviewError(error);

      log('🔄 [LifecycleManager] Error HTML set as fallback');
    } catch (fallbackError) {
      log('💥 [LifecycleManager] Failed to handle WebView setup error:', fallbackError);

      // Last resort: set minimal HTML
      webviewView.webview.html =
        '<html><body><h3>Terminal initialization failed</h3></body></html>';
    }
  }

  /**
   * Generate main HTML for WebView
   */
  private generateHtml(webview: vscode.Webview): string {
    return this.htmlGenerationService.generateMainHtml({
      webview,
      extensionUri: this.extensionContext.extensionUri,
      includeSplitStyles: true,
      includeCliAgentStyles: true,
    });
  }

  /**
   * Generate fallback HTML when main HTML generation fails
   */
  private generateFallbackHtml(): string {
    return this.htmlGenerationService.generateFallbackHtml({
      title: 'Terminal Loading...',
      message: 'Please wait while the terminal initializes.',
      isLoading: true,
    });
  }

  /**
   * Generate error HTML when setup fails
   */
  private generateErrorHtml(error: unknown): string {
    return this.htmlGenerationService.generateErrorHtml({
      error,
      allowRetry: true,
      customMessage: `Terminal initialization failed. Please try reloading the terminal view or restarting VS Code.`,
    });
  }
}
