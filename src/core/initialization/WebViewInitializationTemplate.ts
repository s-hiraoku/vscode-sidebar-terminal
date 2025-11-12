/**
 * WebView Initialization Template
 *
 * Abstract base class implementing the Template Method pattern for WebView initialization.
 * Consolidates ~200-250 lines of duplicated initialization logic across:
 * - SecondaryTerminalProvider
 * - LightweightTerminalWebviewManager
 * - TerminalInitializationCoordinator
 * - WebviewCoordinator
 *
 * Defines a standardized 7-phase initialization workflow:
 * 1. Pre-Initialization (Performance tracking, duplicate guards)
 * 2. Core Setup (View references, manager instantiation)
 * 3. Configuration (Settings loading/application)
 * 4. Message Infrastructure (Listeners, handlers)
 * 5. Content Initialization (HTML generation, UI)
 * 6. Post-Initialization (Additional listeners)
 * 7. Completion (Flags, performance metrics)
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */

import { info as logInfo, error as logError } from '../../utils/logger';

export interface InitializationMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  phase: string;
  success: boolean;
  error?: unknown;
}

export interface InitializationContext {
  skipDuplicates: boolean;
  performanceTracking: boolean;
  errorRecovery: boolean;
}

/**
 * Abstract base class for WebView initialization using Template Method pattern
 */
export abstract class WebViewInitializationTemplate {
  private _initializationMetrics: InitializationMetrics[] = [];
  private _initializationStartTime: number = 0;
  private _isInitialized: boolean = false;

  /**
   * Template Method - Defines the initialization algorithm
   *
   * This method should NOT be overridden by subclasses.
   * Instead, implement the abstract methods and hook methods.
   */
  public async initialize(context?: Partial<InitializationContext>): Promise<void> {
    const ctx: InitializationContext = {
      skipDuplicates: true,
      performanceTracking: true,
      errorRecovery: true,
      ...context,
    };

    try {
      // Phase 1: Pre-Initialization
      this.performanceStart();

      if (ctx.skipDuplicates && this.shouldSkipInitialization()) {
        this.logPhase('Pre-Initialization', 'Skipped (duplicate guard)');
        return;
      }

      // Phase 2: Core Setup
      await this.executePhase('Core Setup', async () => {
        await this.setupViewReference();
        await this.instantiateManagers();
        await this.setupCoordinatorRelationships();
      });

      // Phase 3: Configuration
      await this.executePhase('Configuration', async () => {
        await this.configureWebView();
        await this.loadSettings();
        await this.applySettings();
      });

      // Phase 4: Message Infrastructure
      await this.executePhase('Message Infrastructure', async () => {
        await this.registerMessageHandlers();
        await this.registerEventListeners();
      });

      // Phase 5: Content Initialization
      await this.executePhase('Content Initialization', async () => {
        await this.initializeContent();
        await this.initializeUIComponents();
      });

      // Phase 6: Post-Initialization
      await this.executePhase('Post-Initialization', async () => {
        await this.postInitializationSetup();
      });

      // Phase 7: Completion
      this.markInitializationComplete();
      this.performanceEnd();

      this._isInitialized = true;
      this.logPhase('Completion', 'Initialization complete');
    } catch (error) {
      this.logPhase('Error', `Initialization failed: ${error}`);

      if (ctx.errorRecovery) {
        this.handleInitializationError(error);
      } else {
        throw error;
      }
    }
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Phase 2: Setup view/context reference
   *
   * Examples:
   * - SecondaryTerminalProvider: Set webviewView reference, communication service
   * - LightweightTerminalWebviewManager: Set DOM references
   */
  protected abstract setupViewReference(): Promise<void>;

  /**
   * Phase 4: Register message handlers for webview communication
   *
   * Examples:
   * - SecondaryTerminalProvider: Register onDidReceiveMessage listener
   * - WebviewCoordinator: Register command-to-handler mappings
   */
  protected abstract registerMessageHandlers(): Promise<void>;

  /**
   * Phase 5: Initialize webview content (HTML, UI elements)
   *
   * Examples:
   * - SecondaryTerminalProvider: Generate and set HTML
   * - LightweightTerminalWebviewManager: Initialize terminal instances
   */
  protected abstract initializeContent(): Promise<void>;

  // ============================================================================
  // HOOK METHODS - Optional overrides with default implementations
  // ============================================================================

  /**
   * Phase 1: Check if initialization should be skipped (duplicate guard)
   *
   * Override to implement duplicate initialization prevention.
   *
   * Example:
   * - SecondaryTerminalProvider: Check _bodyRendered flag
   *
   * @returns true if initialization should be skipped, false otherwise
   */
  protected shouldSkipInitialization(): boolean {
    return this._isInitialized;
  }

  /**
   * Phase 2: Instantiate managers/services
   *
   * Override to create specialized managers for the context.
   *
   * Example:
   * - LightweightTerminalWebviewManager: Create 15+ specialized managers
   */
  protected async instantiateManagers(): Promise<void> {
    // Default: No-op (not all contexts need managers)
  }

  /**
   * Phase 2: Setup coordinator relationships between managers
   *
   * Override to wire up dependencies between managers.
   *
   * Example:
   * - LightweightTerminalWebviewManager: Call setCoordinator() on all managers
   */
  protected async setupCoordinatorRelationships(): Promise<void> {
    // Default: No-op
  }

  /**
   * Phase 3: Configure webview options
   *
   * Override to set webview-specific options (VS Code only).
   *
   * Example:
   * - SecondaryTerminalProvider: Set enableScripts, localResourceRoots
   */
  protected async configureWebView(): Promise<void> {
    // Default: No-op (only relevant for VS Code provider)
  }

  /**
   * Phase 3: Load settings from storage
   *
   * Override to load settings from appropriate source.
   *
   * Example:
   * - SecondaryTerminalProvider: Load from VS Code configuration
   * - LightweightTerminalWebviewManager: Load from webview state
   */
  protected async loadSettings(): Promise<void> {
    // Default: No-op
  }

  /**
   * Phase 3: Apply loaded settings
   *
   * Override to apply settings to managers/components.
   *
   * Example:
   * - LightweightTerminalWebviewManager: Apply to ConfigManager, terminals
   */
  protected async applySettings(): Promise<void> {
    // Default: No-op
  }

  /**
   * Phase 4: Register event listeners
   *
   * Override to register lifecycle, visibility, or other event listeners.
   *
   * Example:
   * - SecondaryTerminalProvider: Register visibility, panel location listeners
   * - LightweightTerminalWebviewManager: Register page lifecycle listeners
   */
  protected async registerEventListeners(): Promise<void> {
    // Default: No-op
  }

  /**
   * Phase 5: Initialize UI components
   *
   * Override to initialize UI elements beyond basic content.
   *
   * Example:
   * - LightweightTerminalWebviewManager: Initialize input manager, settings panel
   */
  protected async initializeUIComponents(): Promise<void> {
    // Default: No-op
  }

  /**
   * Phase 6: Post-initialization setup (additional listeners, features)
   *
   * Override to perform additional setup after core initialization.
   *
   * Example:
   * - SecondaryTerminalProvider: Setup panel location listener
   * - LightweightTerminalWebviewManager: Setup scrollback listener
   */
  protected async postInitializationSetup(): Promise<void> {
    // Default: No-op
  }

  /**
   * Error Handling: Handle initialization errors
   *
   * Override to implement custom error recovery.
   *
   * Example:
   * - SecondaryTerminalProvider: Generate fallback HTML
   * - TerminalInitializationCoordinator: Emergency terminal creation
   */
  protected handleInitializationError(error: unknown): void {
    this.logError('Initialization failed', error);
    throw error;
  }

  // ============================================================================
  // CONCRETE METHODS - Reusable utilities (DO NOT override)
  // ============================================================================

  /**
   * Mark initialization as complete
   *
   * Sets internal flags to indicate successful initialization.
   */
  protected markInitializationComplete(): void {
    this._isInitialized = true;
  }

  /**
   * Check if initialization is complete
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get initialization metrics
   */
  public getInitializationMetrics(): InitializationMetrics[] {
    return [...this._initializationMetrics];
  }

  /**
   * Get total initialization duration
   */
  public getTotalInitializationDuration(): number {
    if (this._initializationMetrics.length === 0) return 0;

    const last = this._initializationMetrics[this._initializationMetrics.length - 1];
    return last ? last.endTime - this._initializationStartTime : 0;
  }

  // ============================================================================
  // PRIVATE UTILITIES
  // ============================================================================

  /**
   * Start performance tracking
   */
  private performanceStart(): void {
    this._initializationStartTime = Date.now();
  }

  /**
   * End performance tracking
   */
  private performanceEnd(): void {
    const totalDuration = Date.now() - this._initializationStartTime;
    this.logPhase('Performance', `Total initialization time: ${totalDuration}ms`);
  }

  /**
   * Execute a phase with timing and error tracking
   */
  private async executePhase(phase: string, fn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();

    try {
      await fn();

      const endTime = Date.now();
      this._initializationMetrics.push({
        startTime,
        endTime,
        duration: endTime - startTime,
        phase,
        success: true,
      });

      this.logPhase(phase, `Completed in ${endTime - startTime}ms`);
    } catch (error) {
      const endTime = Date.now();
      this._initializationMetrics.push({
        startTime,
        endTime,
        duration: endTime - startTime,
        phase,
        success: false,
        error,
      });

      this.logPhase(phase, `Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Log phase information
   */
  protected logPhase(phase: string, message: string): void {
    logInfo(`[${phase}] ${message}`);
  }

  /**
   * Log error information
   */
  protected logError(message: string, error: unknown): void {
    logError(`[ERROR] ${message}:`, error);
  }
}
