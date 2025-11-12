/**
 * Secondary Terminal Provider Initializer
 *
 * Concrete implementation of BaseWebViewInitializer for SecondaryTerminalProvider.
 * Handles the initialization sequence for the VS Code WebView provider.
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */

import * as vscode from 'vscode';
import { BaseWebViewInitializer } from '../../webview/initialization/BaseWebViewInitializer';
import type { SecondaryTerminalProvider } from '../SecondaryTerminalProvider';
import type { WebviewMessage } from '../../types/shared';

/**
 * Context for Secondary Terminal Provider initialization
 */
export interface SecondaryTerminalProviderContext {
  provider: SecondaryTerminalProvider;
  webviewView: vscode.WebviewView;
  extensionContext: vscode.ExtensionContext;
}

/**
 * Initializer for SecondaryTerminalProvider using Template Method pattern
 */
export class SecondaryTerminalProviderInitializer extends BaseWebViewInitializer<SecondaryTerminalProviderContext> {
  /**
   * Phase 1: Validate Prerequisites
   *
   * Ensures all required resources are available before initialization.
   */
  protected async validatePrerequisites(): Promise<void> {
    const { webviewView, extensionContext } = this.context;

    if (!webviewView) {
      throw new Error('WebviewView is required for SecondaryTerminalProvider initialization');
    }

    if (!webviewView.webview) {
      throw new Error('WebView object is not available');
    }

    if (!extensionContext) {
      throw new Error('ExtensionContext is required for SecondaryTerminalProvider initialization');
    }

    this.logger('✅ Prerequisites validated: WebView and ExtensionContext available');
  }

  /**
   * Phase 2: Configure Webview
   *
   * Sets up webview options including security settings and resource roots.
   */
  protected async configureWebview(): Promise<void> {
    const { provider, webviewView } = this.context;

    // Call the provider's private configuration method
    // Note: Using bracket notation to access private method
    (provider as any)._configureWebview(webviewView);

    this.logger('✅ Webview configured with security options and resource roots');
  }

  /**
   * Phase 3: Setup Message Listeners
   *
   * Configures message listeners BEFORE HTML is loaded (VS Code best practice).
   * This ensures no messages are missed during initialization.
   */
  protected async setupMessageListeners(): Promise<void> {
    const { provider, webviewView, extensionContext } = this.context;

    // Setup message listener
    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        this.logger('📨 MESSAGE RECEIVED FROM WEBVIEW:', message.command);

        // Validate message
        if (!(provider as any)._isValidWebviewMessage(message)) {
          this.logger('⚠️ Invalid WebviewMessage received, ignoring');
          return;
        }

        // Handle message
        (provider as any)
          ._handleWebviewMessage(message)
          .catch((error: Error) => {
            this.logger('❌ Error handling message:', error);
          });
      },
      undefined,
      extensionContext.subscriptions
    );

    // Register disposable for cleanup
    extensionContext.subscriptions.push(messageDisposable);

    // Setup visibility change listener
    const visibilityDisposable = webviewView.onDidChangeVisibility(
      () => {
        if (webviewView.visible) {
          this.logger('👁️ WebView became visible');
          // Trigger panel location detection
          setTimeout(() => {
            (provider as any)._requestPanelLocationDetection();
          }, 500);
        } else {
          this.logger('👁️ WebView became hidden');
        }
      },
      undefined,
      extensionContext.subscriptions
    );

    extensionContext.subscriptions.push(visibilityDisposable);

    this.logger('✅ Message listeners registered and subscriptions added');
  }

  /**
   * Phase 4: Initialize Managers
   *
   * Sets up the message routing system and handler registry.
   */
  protected async initializeManagers(): Promise<void> {
    const { provider } = this.context;

    // Initialize message handlers
    (provider as any)._initializeMessageHandlers();

    this.logger('✅ Message handlers initialized');
  }

  /**
   * Phase 5: Setup Event Handlers
   *
   * Configures event listeners for terminal events, CLI agent status,
   * configuration changes, and panel location changes.
   */
  protected async setupEventHandlers(): Promise<void> {
    const { provider, webviewView } = this.context;

    // Setup terminal event listeners
    (provider as any)._setupTerminalEventListeners();
    this.logger('✅ Terminal event listeners configured');

    // Setup CLI agent status listeners
    (provider as any)._setupCliAgentStatusListeners();
    this.logger('✅ CLI agent status listeners configured');

    // Setup configuration change listeners
    (provider as any)._setupConfigurationChangeListeners();
    this.logger('✅ Configuration change listeners configured');

    // Setup panel location change listener
    (provider as any)._setupPanelLocationChangeListener(webviewView);
    this.logger('✅ Panel location change listener configured');
  }

  /**
   * Phase 6: Load Settings
   *
   * Loads current settings from VS Code configuration.
   */
  protected async loadSettings(): Promise<void> {
    const { provider } = this.context;

    // Get current settings from VS Code
    const currentSettings = (provider as any)._getCurrentSettings();
    this.logger('✅ Settings loaded:', Object.keys(currentSettings).length, 'settings');
  }

  /**
   * Phase 7: Finalize Initialization (Hook Method)
   *
   * Sets the webview HTML content after all listeners are ready.
   * This follows VS Code best practice: listeners first, then HTML.
   */
  protected async finalizeInitialization(): Promise<void> {
    const { provider, webviewView } = this.context;

    // Set webview HTML AFTER all listeners are ready
    (provider as any)._setWebviewHtml(webviewView, false);

    this.logger('✅ WebView HTML set and initialization finalized');
  }

  /**
   * Custom error handler for provider initialization
   */
  protected handleInitializationError(error: unknown): void {
    super.handleInitializationError(error);

    const { provider, webviewView } = this.context;

    // Call provider's error handler
    (provider as any)._handleWebviewSetupError(webviewView, error);
  }
}
