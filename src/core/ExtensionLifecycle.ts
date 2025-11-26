import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { ExtensionPersistenceService } from '../services/persistence/ExtensionPersistenceService';
import { extension as log, logger, LogLevel } from '../utils/logger';
import { FileReferenceCommand, TerminalCommand } from '../commands';
import { CopilotIntegrationCommand } from '../commands/CopilotIntegrationCommand';
import { EnhancedShellIntegrationService } from '../services/EnhancedShellIntegrationService';
import { KeyboardShortcutService } from '../services/KeyboardShortcutService';
import { TerminalDecorationsService } from '../services/TerminalDecorationsService';
import { TerminalLinksService } from '../services/TerminalLinksService';
import { TelemetryService } from '../services/TelemetryService';
import { VersionUtils } from '../utils/VersionUtils';
import { CommandRegistrar } from './CommandRegistrar';
import { SessionLifecycleManager } from './SessionLifecycleManager';

/**
 * Manages the complete lifecycle of the VS Code extension.
 *
 * This class is responsible for initializing, configuring, and cleaning up all
 * components of the Secondary Terminal extension. It serves as the central
 * orchestrator for terminal management, session persistence, command handling,
 * and service integration.
 *
 * @remarks
 * The ExtensionLifecycle class handles:
 * - Extension activation and deactivation
 * - Component initialization and dependency injection
 * - Command registration and event handling
 * - Session management and restoration
 * - Service lifecycle management
 * - Resource cleanup and disposal
 *
 * @example
 * ```typescript
 * const lifecycle = new ExtensionLifecycle();
 * await lifecycle.activate(context);
 * // ... extension runs ...
 * await lifecycle.deactivate();
 * ```
 *
 * @public
 */
export class ExtensionLifecycle {
  private terminalManager: TerminalManager | undefined;
  private sidebarProvider: SecondaryTerminalProvider | undefined;
  private extensionPersistenceService: ExtensionPersistenceService | undefined;
  private fileReferenceCommand: FileReferenceCommand | undefined;
  private terminalCommand: TerminalCommand | undefined;
  private copilotIntegrationCommand: CopilotIntegrationCommand | undefined;
  private shellIntegrationService: EnhancedShellIntegrationService | undefined;
  private keyboardShortcutService: KeyboardShortcutService | undefined;
  private decorationsService: TerminalDecorationsService | undefined;
  private linksService: TerminalLinksService | undefined;
  private telemetryService: TelemetryService | undefined;
  private _extensionContext: vscode.ExtensionContext | undefined;

  // Extracted services for better maintainability
  private commandRegistrar: CommandRegistrar | undefined;
  private sessionLifecycleManager: SessionLifecycleManager | undefined;

  /**
   * Activates the extension and initializes all components.
   *
   * This method is the main entry point for extension activation. It performs
   * the following operations in sequence:
   * 1. Configures logging based on extension mode (development/production)
   * 2. Initializes the terminal manager
   * 3. Sets up session management for terminal persistence
   * 4. Initializes command handlers
   * 5. Configures shell integration service
   * 6. Registers the sidebar terminal provider
   * 7. Sets up keyboard shortcut service
   * 8. Initializes Phase 8 services (decorations and links)
   * 9. Registers all VS Code commands
   * 10. Sets up automatic session saving
   *
   * @param context - The VS Code extension context containing subscriptions and resources
   * @returns A promise that resolves immediately to prevent activation spinner hanging
   *
   * @remarks
   * - The method resolves immediately even if some initialization steps are asynchronous
   * - Session restoration is handled asynchronously by SecondaryTerminalProvider
   * - Errors are caught, logged, and shown to the user without throwing
   *
   * @throws Never throws; all errors are caught and handled internally
   *
   * @example
   * ```typescript
   * const lifecycle = new ExtensionLifecycle();
   * await lifecycle.activate(context);
   * ```
   *
   * @public
  */
  activate(context: vscode.ExtensionContext): Promise<void> {
    const activationStartTime = Date.now();
    this._extensionContext = context;

    const logLevel = this.configureLogger(context);
    const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
    const version = (extension?.packageJSON as { version?: string })?.version || 'unknown';

    logger.lifecycle('Sidebar Terminal activation started', {
      mode: this.getExtensionModeLabel(context.extensionMode),
      version,
      logLevel: LogLevel[logLevel],
    });

    try {
      this.telemetryService = new TelemetryService(
        context,
        's-hiraoku.vscode-sidebar-terminal',
        version
      );
    } catch (error) {
      logger.warn('Telemetry service unavailable; continuing without analytics', error);
    }

    try {
      // Ensure node-pty looks for release binaries
      process.env.NODE_PTY_DEBUG = '0';

      // Initialize terminal manager
      this.terminalManager = new TerminalManager();

      // Initialize extension persistence service
      this.extensionPersistenceService = new ExtensionPersistenceService(
        context,
        this.terminalManager
      );

      // Initialize command handlers
      this.fileReferenceCommand = new FileReferenceCommand(this.terminalManager);
      this.terminalCommand = new TerminalCommand(this.terminalManager);
      this.copilotIntegrationCommand = new CopilotIntegrationCommand();

      // Initialize enhanced shell integration service
      try {
        this.shellIntegrationService = new EnhancedShellIntegrationService(
          this.terminalManager,
          context
        );
        // Set shell integration service on TerminalManager
        this.terminalManager.setShellIntegrationService(this.shellIntegrationService);
      } catch (error) {
        logger.warn('Enhanced shell integration service unavailable', error);
        // Continue without shell integration
      }

      // Register the sidebar terminal provider
      this.sidebarProvider = new SecondaryTerminalProvider(
        context,
        this.terminalManager,
        this.extensionPersistenceService,
        this.telemetryService
      );

      // Set sidebar provider for ExtensionPersistenceService
      if (this.extensionPersistenceService) {
        (this.extensionPersistenceService as any).setSidebarProvider?.(this.sidebarProvider);
      }

      // Initialize keyboard shortcut service
      this.keyboardShortcutService = new KeyboardShortcutService(this.terminalManager);

      // Connect keyboard service to webview provider
      this.keyboardShortcutService.setWebviewProvider(this.sidebarProvider);

      // Connect enhanced shell integration service to webview provider
      if (this.shellIntegrationService) {
        this.shellIntegrationService.setWebviewProvider(this.sidebarProvider);
      }

      // Initialize Phase 8: Terminal Decorations & Links Services
      try {
        // Initialize terminal decorations service
        this.decorationsService = new TerminalDecorationsService();

        // Initialize terminal links service
        this.linksService = new TerminalLinksService();

        // Connect Phase 8 services to webview provider
        if (this.decorationsService && this.linksService) {
          this.sidebarProvider.setPhase8Services(this.decorationsService, this.linksService);
        }

        // Connect Phase 8 services to terminal manager for data processing
        if (this.terminalManager) {
          // Set up data processing for decorations through terminal manager
          // Note: This will be connected via message passing in the webview
        }
      } catch (error) {
        logger.warn('Phase 8 services unavailable; continuing without decorations/links', error);
        // Continue without Phase 8 features
      }

      // Initialize SessionLifecycleManager first (needed by CommandRegistrar)
      this.sessionLifecycleManager = new SessionLifecycleManager({
        getTerminalManager: () => this.terminalManager,
        getSidebarProvider: () => this.sidebarProvider,
        getExtensionPersistenceService: () => this.extensionPersistenceService,
        getExtensionContext: () => this._extensionContext,
      });

      // Initialize CommandRegistrar and register all commands
      this.commandRegistrar = new CommandRegistrar(
        {
          terminalManager: this.terminalManager,
          sidebarProvider: this.sidebarProvider,
          extensionPersistenceService: this.extensionPersistenceService,
          fileReferenceCommand: this.fileReferenceCommand,
          terminalCommand: this.terminalCommand,
          copilotIntegrationCommand: this.copilotIntegrationCommand,
          shellIntegrationService: this.shellIntegrationService,
          keyboardShortcutService: this.keyboardShortcutService,
          telemetryService: this.telemetryService,
        },
        {
          handleSaveSession: () => this.sessionLifecycleManager!.handleSaveSession(),
          handleRestoreSession: () => this.sessionLifecycleManager!.handleRestoreSession(),
          handleClearSession: () => this.sessionLifecycleManager!.handleClearSession(),
          handleTestScrollback: () => this.sessionLifecycleManager!.handleTestScrollback(),
          diagnoseSessionData: () => this.sessionLifecycleManager!.diagnoseSessionData(),
        }
      );
      this.commandRegistrar.registerCommands(context);

      // Initialize context key for dynamic split icon functionality
      void vscode.commands.executeCommand(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );

      // CRITICAL: Session restore is now handled by SecondaryTerminalProvider asynchronously
      // This prevents VS Code activation spinner from hanging
      // Register webview providers AFTER session restore completes
      const sidebarWebviewProvider = vscode.window.registerWebviewViewProvider(
        SecondaryTerminalProvider.viewType,
        this.sidebarProvider,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
      );
      context.subscriptions.push(sidebarWebviewProvider);

      // 自動保存設定 - delegate to SessionLifecycleManager
      this.sessionLifecycleManager.setupSessionAutoSave(context);
      // Track successful activation
      const activationDuration = Date.now() - activationStartTime;
      this.telemetryService?.trackActivation(activationDuration);
      logger.lifecycle('Sidebar Terminal extension activated', {
        durationMs: activationDuration,
        version,
      });

      // Setup telemetry event listeners
      this.setupTelemetryEventListeners();

      // CRITICAL: Ensure activation Promise resolves immediately
      // This prevents VS Code progress spinner from hanging
      return Promise.resolve();
    } catch (error) {
      logger.error('Failed to activate Sidebar Terminal extension', error);

      // Track activation error
      if (error instanceof Error) {
        this.telemetryService?.trackError(error, 'activation');
      }

      void vscode.window.showErrorMessage(
        `Failed to activate Sidebar Terminal: ${error instanceof Error ? error.message : String(error)}`
      );

      // CRITICAL: Even on error, resolve activation Promise to prevent spinner hanging
      return Promise.resolve();
    }
  }

  private configureLogger(context: vscode.ExtensionContext): LogLevel {
    const override = this.resolveLogLevelOverride();
    if (override !== undefined) {
      logger.setLevel(override);
      return override;
    }

    if (context.extensionMode === vscode.ExtensionMode.Production) {
      logger.setLevel(LogLevel.WARN);
      return LogLevel.WARN;
    }

    logger.setLevel(LogLevel.INFO);
    return LogLevel.INFO;
  }

  private resolveLogLevelOverride(): LogLevel | undefined {
    const rawLevel = process.env.SECONDARY_TERMINAL_LOG_LEVEL?.toLowerCase();
    switch (rawLevel) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
      case 'warning':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      case 'none':
        return LogLevel.NONE;
      default:
        return undefined;
    }
  }

  private getExtensionModeLabel(mode: vscode.ExtensionMode): string {
    switch (mode) {
      case vscode.ExtensionMode.Development:
        return 'Development';
      case vscode.ExtensionMode.Test:
        return 'Test';
      default:
        return 'Production';
    }
  }

  /**
   * Deactivates the extension and performs cleanup.
   *
   * This method ensures proper cleanup of all extension resources:
   * 1. Saves current terminal sessions
   * 2. Disposes of the standard session manager
   * 3. Disposes of keyboard shortcut service
   * 4. Disposes of Phase 8 services (decorations and links)
   * 5. Disposes of terminal manager and all terminals
   * 6. Disposes of sidebar provider
   * 7. Clears command handlers
   * 8. Disposes of shell integration service
   *
   * @returns A promise that resolves when all cleanup is complete
   *
   * @remarks
   * - All errors during cleanup are logged but not thrown
   * - Session data is saved before disposing managers
   * - Resources are disposed in reverse order of initialization
   *
   * @throws Never throws; all errors are caught and logged
   *
   * @example
   * ```typescript
   * await lifecycle.deactivate();
   * ```
   *
   * @public
  */
  async deactivate(): Promise<void> {
    logger.lifecycle('Sidebar Terminal deactivation started');

    // Track deactivation
    this.telemetryService?.trackDeactivation();
    logger.lifecycle('Sidebar Terminal deactivation tracked');

    // シンプルセッション保存処理 - delegate to SessionLifecycleManager
    if (this.sessionLifecycleManager) {
      await this.sessionLifecycleManager.saveSimpleSessionOnExit();
    }

    // Dispose standard session manager (cleanup auto-save timers)
    if (this.extensionPersistenceService) {
      log('🔧 [EXTENSION] Disposing standard session manager...');
      this.extensionPersistenceService.dispose(); // Cleanup auto-save timers
      this.extensionPersistenceService = undefined;
    }

    // Dispose keyboard shortcut service
    if (this.keyboardShortcutService) {
      log('🔧 [EXTENSION] Disposing keyboard shortcut service...');
      this.keyboardShortcutService.dispose();
      this.keyboardShortcutService = undefined;
    }

    // Dispose Phase 8 services
    if (this.decorationsService) {
      log('🔧 [EXTENSION] Disposing terminal decorations service...');
      this.decorationsService.dispose();
      this.decorationsService = undefined;
    }

    if (this.linksService) {
      log('🔧 [EXTENSION] Disposing terminal links service...');
      this.linksService.dispose();
      this.linksService = undefined;
    }

    // Dispose terminal manager
    if (this.terminalManager) {
      log('🔧 [EXTENSION] Disposing terminal manager...');
      this.terminalManager.dispose();
      this.terminalManager = undefined;
    }

    // Dispose sidebar provider
    if (this.sidebarProvider) {
      log('🔧 [EXTENSION] Disposing sidebar provider...');
      this.sidebarProvider.dispose();
      this.sidebarProvider = undefined;
    }

    // Clear command handlers
    this.fileReferenceCommand = undefined;
    this.terminalCommand = undefined;
    this.copilotIntegrationCommand = undefined;

    // Dispose shell integration service
    if (this.shellIntegrationService) {
      this.shellIntegrationService.dispose();
      this.shellIntegrationService = undefined;
    }

    // Dispose telemetry service (this should be last to track all events)
    if (this.telemetryService) {
      log('📊 [TELEMETRY] Disposing telemetry service...');
      this.telemetryService.dispose();
      this.telemetryService = undefined;
    }

    logger.lifecycle('Sidebar Terminal deactivation complete');
  }

  /**
   * Gets the current terminal manager instance.
   *
   * @returns The terminal manager instance, or undefined if not initialized
   *
   * @remarks
   * This method is primarily intended for testing purposes.
   *
   * @public
   */
  getTerminalManager(): TerminalManager | undefined {
    return this.terminalManager;
  }

  /**
   * Gets the current sidebar provider instance.
   *
   * @returns The sidebar provider instance, or undefined if not initialized
   *
   * @remarks
   * This method is primarily intended for testing purposes.
   *
   * @public
   */
  getSidebarProvider(): SecondaryTerminalProvider | undefined {
    return this.sidebarProvider;
  }

  /**
   * Gets the current standard session manager instance.
   *
   * @returns The standard session manager instance, or undefined if not initialized
   *
   * @remarks
   * This method is primarily intended for testing purposes.
   *
   * @public
   */
  getExtensionPersistenceService(): ExtensionPersistenceService | undefined {
    return this.extensionPersistenceService;
  }

  /**
   * Setup telemetry event listeners for tracking key metrics
   */
  private setupTelemetryEventListeners(): void {
    if (!this.telemetryService) {
      logger.warn('Telemetry service not available, skipping telemetry event listener setup');
      return;
    }

    log('📊 [TELEMETRY] Setting up telemetry event listeners...');

    // Track terminal creation
    if (this.terminalManager) {
      const terminalCreatedDisposable = this.terminalManager.onTerminalCreated((terminal) => {
        this.telemetryService?.trackTerminalCreated(terminal.id);
        log(`📊 [TELEMETRY] Terminal created: ${terminal.id}`);
      });

      // Track terminal deletion
      const terminalRemovedDisposable = this.terminalManager.onTerminalRemoved((terminalId) => {
        this.telemetryService?.trackTerminalDeleted(terminalId);
        log(`📊 [TELEMETRY] Terminal deleted: ${terminalId}`);
      });

      // Track terminal focus
      const terminalFocusedDisposable = this.terminalManager.onTerminalFocus((terminalId) => {
        this.telemetryService?.trackTerminalFocused(terminalId);
      });

      if (this._extensionContext) {
        this._extensionContext.subscriptions.push(
          terminalCreatedDisposable,
          terminalRemovedDisposable,
          terminalFocusedDisposable
        );
      }
    }

    // Track CLI Agent detection events
    if (this.shellIntegrationService) {
      const cliAgentService = (this.shellIntegrationService as any).cliAgentDetectionService;

      if (cliAgentService?.onCliAgentStatusChange) {
        const cliAgentStatusDisposable = cliAgentService.onCliAgentStatusChange((event: any) => {
          if (event.status === 'connected') {
            this.telemetryService?.trackCliAgentDetected(event.type || 'unknown');
            log(`📊 [TELEMETRY] CLI Agent detected: ${event.type}`);
          } else if (event.status === 'disconnected') {
            // Track disconnection with session duration (if available)
            this.telemetryService?.trackCliAgentDisconnected(event.type || 'unknown', 0);
            log(`📊 [TELEMETRY] CLI Agent disconnected: ${event.type}`);
          }
        });

        if (this._extensionContext) {
          this._extensionContext.subscriptions.push(cliAgentStatusDisposable);
        }
      }
    }

    // Track session save/restore
    if (this.extensionPersistenceService) {
      // Note: ExtensionPersistenceService may not expose events
      // If it does, we can add tracking here
      log('📊 [TELEMETRY] Session manager event tracking (to be implemented if events available)');
    }

    log('✅ [TELEMETRY] Telemetry event listeners setup complete');
  }
}
