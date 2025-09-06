import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { WebviewMessage } from '../types/common';
import { provider as log } from '../utils/logger';

// Import new services
import { WebViewMessageHandlerService } from '../services/webview/WebViewMessageHandlerService';
import { WebViewStateManager } from '../services/webview/WebViewStateManager';
import { CliAgentWebViewService } from '../services/webview/CliAgentWebViewService';
import { WebViewSettingsManagerService } from '../services/webview/WebViewSettingsManagerService';
import { WebViewHtmlGenerator } from '../services/webview/WebViewHtmlGenerator';
import { TerminalEventHandlerService } from '../services/webview/TerminalEventHandlerService';
import { IMessageHandlerContext } from '../services/webview/interfaces';

/**
 * Refactored SecondaryTerminalProvider using the new service architecture
 * 
 * This provider now uses focused services instead of handling everything directly:
 * - WebViewMessageHandlerService: Handles all WebView messages
 * - WebViewStateManager: Manages WebView state and initialization
 * - CliAgentWebViewService: Handles CLI Agent functionality
 * - WebViewSettingsManagerService: Manages settings
 * - WebViewHtmlGenerator: Generates HTML content
 * - TerminalEventHandlerService: Handles terminal events
 */
export class RefactoredSecondaryTerminalProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'secondaryTerminal';
  
  private _disposables: vscode.Disposable[] = [];
  private _view?: vscode.WebviewView;
  
  // New service instances
  private readonly _messageHandler: WebViewMessageHandlerService;
  private readonly _stateManager: WebViewStateManager;
  private readonly _cliAgentService: CliAgentWebViewService;
  private readonly _settingsManager: WebViewSettingsManagerService;
  private readonly _htmlGenerator: WebViewHtmlGenerator;
  private readonly _eventHandler: TerminalEventHandlerService;
  private _profileManager?: any; // TODO: Add proper type
  
  // Terminal ID mapping for Extension <-> WebView communication
  private _terminalIdMapping?: Map<string, string>;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _terminalManager: TerminalManager,
    private readonly _standardSessionManager?: any // TODO: Add proper type
  ) {
    log('🚀 [RefactoredProvider] Initializing services');
    
    // Initialize all services
    this._messageHandler = new WebViewMessageHandlerService();
    this._stateManager = new WebViewStateManager();
    this._cliAgentService = new CliAgentWebViewService();
    this._settingsManager = new WebViewSettingsManagerService();
    this._htmlGenerator = new WebViewHtmlGenerator(_extensionContext);
    this._eventHandler = new TerminalEventHandlerService();
    
    log('✅ [RefactoredProvider] All services initialized');
  }

  /**
   * VS Code WebviewViewProvider interface implementation
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    log('🚀 [RefactoredProvider] === RESOLVING WEBVIEW VIEW ===');
    
    try {
      // Set view reference
      this._view = webviewView;
      
      // Reset state for new WebView
      this._stateManager.reset();
      
      // Configure webview
      this._configureWebview(webviewView);
      
      // Set up message handling
      this._setupMessageHandling(webviewView);
      
      // Set up visibility handling
      this._setupVisibilityHandling(webviewView);
      
      // Generate and set HTML
      this._setWebviewHtml(webviewView);
      
      // Set up event listeners
      this._setupEventListeners();
      
      log('✅ [RefactoredProvider] WebView resolution completed');
      
    } catch (error) {
      log('❌ [RefactoredProvider] Error resolving WebView:', error);
      throw error;
    }
  }

  /**
   * Configure webview options
   */
  private _configureWebview(webviewView: vscode.WebviewView): void {
    log('🔧 [RefactoredProvider] Configuring webview options');
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionContext.extensionUri],
    };
    
    // Enable context retention for better performance
    webviewView.webview.html = ''; // Reset HTML first
    
    log('✅ [RefactoredProvider] Webview options configured');
  }

  /**
   * Set up message handling between Extension and WebView
   */
  private _setupMessageHandling(webviewView: vscode.WebviewView): void {
    log('🔧 [RefactoredProvider] Setting up message handling');
    
    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        log('📨 [RefactoredProvider] Message received:', message.command);
        
        try {
          // Create context for message handlers
          const context = this._createMessageHandlerContext(webviewView);
          
          // Use the message handler service to process the message
          const handled = await this._messageHandler.handleMessage(message, context);
          
          if (!handled) {
            log('⚠️ [RefactoredProvider] Message not handled:', message.command);
          }
          
        } catch (error) {
          log('❌ [RefactoredProvider] Error handling message:', error);
        }
      },
      undefined,
      this._disposables
    );
    
    this._disposables.push(messageDisposable);
    log('✅ [RefactoredProvider] Message handling set up');
  }

  /**
   * Set up visibility change handling
   */
  private _setupVisibilityHandling(webviewView: vscode.WebviewView): void {
    log('🔧 [RefactoredProvider] Setting up visibility handling');
    
    const visibilityDisposable = webviewView.onDidChangeVisibility(
      () => {
        if (webviewView.visible) {
          log('👁️ [RefactoredProvider] WebView became visible');
          // Request panel location detection when visible
          setTimeout(() => {
            const context = this._createMessageHandlerContext(webviewView);
            this._stateManager.requestPanelLocationDetection(context);
          }, 500);
        } else {
          log('👁️ [RefactoredProvider] WebView became hidden');
        }
      },
      undefined,
      this._disposables
    );
    
    this._disposables.push(visibilityDisposable);
    log('✅ [RefactoredProvider] Visibility handling set up');
  }

  /**
   * Set webview HTML content
   */
  private _setWebviewHtml(webviewView: vscode.WebviewView): void {
    log('🔧 [RefactoredProvider] Setting webview HTML');
    
    try {
      const html = this._htmlGenerator.generateMainHtml(webviewView.webview);
      webviewView.webview.html = html;
      log('✅ [RefactoredProvider] HTML set successfully');
    } catch (error) {
      log('❌ [RefactoredProvider] Error setting HTML:', error);
      // Set fallback HTML
      const fallbackHtml = this._htmlGenerator.generateFallbackHtml();
      webviewView.webview.html = fallbackHtml;
    }
  }

  /**
   * Set up all event listeners
   */
  private _setupEventListeners(): void {
    log('🔧 [RefactoredProvider] Setting up event listeners');
    
    try {
      // Create context
      const context = this._createMessageHandlerContext();
      
      // Set up terminal event listeners
      const terminalDisposables = this._eventHandler.setupEventListeners(context);
      this._disposables.push(...terminalDisposables);
      
      // Set up CLI Agent listeners
      const cliAgentDisposables = this._cliAgentService.setupListeners(context);
      this._disposables.push(...cliAgentDisposables);
      
      // Set up settings change listeners
      const settingsDisposable = this._settingsManager.setupConfigurationChangeListeners(context);
      this._disposables.push(settingsDisposable);
      
      log('✅ [RefactoredProvider] All event listeners set up');
      
    } catch (error) {
      log('❌ [RefactoredProvider] Error setting up event listeners:', error);
    }
  }

  /**
   * Create message handler context
   */
  private _createMessageHandlerContext(webviewView?: vscode.WebviewView): IMessageHandlerContext {
    const view = webviewView || this._view;
    
    return {
      extensionContext: this._extensionContext,
      terminalManager: this._terminalManager,
      webview: view?.webview,
      standardSessionManager: this._standardSessionManager,
      sendMessage: async (message: WebviewMessage) => {
        if (view?.webview) {
          try {
            await view.webview.postMessage(message);
            log('📤 [RefactoredProvider] Message sent:', message.command);
          } catch (error) {
            log('❌ [RefactoredProvider] Failed to send message:', error);
            throw error;
          }
        } else {
          log('⚠️ [RefactoredProvider] Cannot send message - WebView not available');
          throw new Error('WebView not available');
        }
      },
      terminalIdMapping: this._terminalIdMapping,
      // Add additional context properties
      stateManager: this._stateManager,
      cliAgentService: this._cliAgentService,
      settingsManager: this._settingsManager,
      profileManager: this._profileManager, // Add profile manager to context
    } as IMessageHandlerContext;
  }

  /**
   * Initialize terminal after WebView is ready
   */
  async _initializeTerminal(): Promise<void> {
    log('🎯 [RefactoredProvider] Initializing terminal');
    
    try {
      // Mark as initialized
      this._stateManager.setInitialized(true);
      
      // Create context
      const context = this._createMessageHandlerContext();
      
      // Send initial settings to WebView
      await this._settingsManager.sendAllSettingsToWebView(context);
      
      // Send initial CLI Agent state
      this._cliAgentService.sendFullStateSync(context);
      
      // Ensure minimum number of terminals exist
      if (this._terminalManager.getTerminals().length === 0) {
        log('🎯 [RefactoredProvider] Creating initial terminal');
        const terminalId = this._terminalManager.createTerminal();
        this._terminalManager.setActiveTerminal(terminalId);
        log(`✅ [RefactoredProvider] Created initial terminal: ${terminalId}`);
      }
      
      log('✅ [RefactoredProvider] Terminal initialization completed');
      
    } catch (error) {
      log('❌ [RefactoredProvider] Terminal initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get debug information from all services
   */
  getDebugInfo(): object {
    const context = this._createMessageHandlerContext();
    
    return {
      provider: {
        isInitialized: this._stateManager.isInitialized(),
        hasView: !!this._view,
        handlerCount: this._messageHandler.getHandlerCount(),
        supportedCommands: this._messageHandler.getSupportedCommands(),
      },
      stateManager: this._stateManager.getStateDebugInfo(),
      cliAgentService: this._cliAgentService.getDebugInfo(context),
      settingsManager: this._settingsManager.getDebugInfo(),
      htmlGenerator: this._htmlGenerator.getDebugInfo(),
      eventHandler: this._eventHandler.getDebugInfo(context),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Set profile manager for terminal profile functionality
   */
  public setProfileManager(profileManager: any): void {
    this._profileManager = profileManager;
    log('🎯 [PROVIDER] Profile Manager set on provider');
  }

  /**
   * Show profile selector UI
   */
  public async showProfileSelector(): Promise<void> {
    if (!this._profileManager || !this._view?.webview) {
      return;
    }

    try {
      const profiles = this._profileManager.getProfiles();
      const defaultProfile = this._profileManager.getDefaultProfile();

      this._view.webview.postMessage({
        command: 'showProfileSelector',
        profiles: profiles,
        selectedProfileId: defaultProfile.id
      });

      log('🎯 [PROVIDER] Sent showProfileSelector message to WebView');
    } catch (error) {
      log('❌ [PROVIDER] Error showing profile selector:', error);
    }
  }

  /**
   * Create terminal with profile selection
   */
  public async createTerminalWithProfileSelection(): Promise<void> {
    if (!this._profileManager || !this._view?.webview) {
      // Fallback to regular terminal creation
      await this._initializeTerminal();
      return;
    }

    try {
      const profiles = this._profileManager.getProfiles();
      if (profiles.length === 1) {
        // Only one profile available, use it directly
        const result = this._profileManager.createTerminalWithProfile(profiles[0].id);
        await this._createTerminalWithConfig(result.config);
      } else {
        // Show profile selector
        await this.showProfileSelector();
      }
    } catch (error) {
      log('❌ [PROVIDER] Error creating terminal with profile selection:', error);
      // Fallback to regular terminal creation
      await this._initializeTerminal();
    }
  }

  /**
   * Create terminal with specific configuration
   */
  private async _createTerminalWithConfig(config: any): Promise<void> {
    try {
      // Use existing terminal creation logic
      const terminalCreationResult = await this._terminalManager.createTerminal();

      if (this._view?.webview && terminalCreationResult) {
        this._view.webview.postMessage({
          command: 'terminalCreated',
          terminalId: terminalCreationResult,
          terminalName: config.name || 'Terminal'
        });
      }

      log(`🎯 [PROVIDER] Created terminal with profile: ${config.name}`);
    } catch (error) {
      log('❌ [PROVIDER] Error creating terminal with config:', error);
      throw error;
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [RefactoredProvider] Disposing provider');
    
    try {
      // Dispose all service resources
      this._cliAgentService.dispose();
      this._settingsManager.dispose();
      this._eventHandler.dispose();
      
      // Dispose all event listeners
      for (const disposable of this._disposables) {
        disposable.dispose();
      }
      this._disposables = [];
      
      // Clear references
      this._view = undefined;
      this._terminalIdMapping = undefined;
      
      log('✅ [RefactoredProvider] Provider disposed successfully');
      
    } catch (error) {
      log('❌ [RefactoredProvider] Error during disposal:', error);
    }
  }
}