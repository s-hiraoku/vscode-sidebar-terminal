/**
 * Base Web View Initializer
 *
 * Abstract base class that defines the initialization sequence for WebView components
 * using the Template Method design pattern.
 *
 * @template TContext - The context type for initialization (e.g., provider, manager, coordinator instance)
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */
export abstract class BaseWebViewInitializer<TContext = any> {
  protected readonly context: TContext;
  protected readonly logger: (message: string, ...args: any[]) => void;
  private isInitialized = false;

  /**
   * Creates a new initializer instance
   *
   * @param context - The context object containing the component to initialize
   * @param logger - Optional logger function (defaults to console.log)
   */
  constructor(context: TContext, logger?: (message: string, ...args: any[]) => void) {
    this.context = context;
    this.logger = logger ?? console.log;
  }

  /**
   * Template Method - defines the initialization sequence
   *
   * This method follows a fixed 6-phase initialization process:
   * 1. Prerequisites Validation - Verify dependencies and resources
   * 2. Webview Configuration - Set security options, resource roots
   * 3. Message Listeners Setup - Configure Extension ↔ WebView communication
   * 4. Managers/Components Initialization - Initialize service instances
   * 5. Event Handlers Setup - Configure DOM, terminal, and UI events
   * 6. Settings Loading - Load user preferences and state
   * 7. Finalization - Final setup, initial UI state (optional hook)
   *
   * Each phase is implemented by abstract methods that subclasses must override.
   * The sequence is enforced and cannot be changed by subclasses.
   *
   * @throws Error if initialization fails at any phase
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger('⚠️ Already initialized, skipping');
      return;
    }

    try {
      this.logInitializationStart();

      // Phase 1: Validate prerequisites
      this.logPhase('Phase 1: Validating prerequisites');
      await this.validatePrerequisites();

      // Phase 2: Configure webview
      this.logPhase('Phase 2: Configuring webview');
      await this.configureWebview();

      // Phase 3: Setup message listeners
      this.logPhase('Phase 3: Setting up message listeners');
      await this.setupMessageListeners();

      // Phase 4: Initialize managers
      this.logPhase('Phase 4: Initializing managers');
      await this.initializeManagers();

      // Phase 5: Setup event handlers
      this.logPhase('Phase 5: Setting up event handlers');
      await this.setupEventHandlers();

      // Phase 6: Load settings
      this.logPhase('Phase 6: Loading settings');
      await this.loadSettings();

      // Phase 7: Finalization (hook method - optional)
      this.logPhase('Phase 7: Finalizing initialization');
      await this.finalizeInitialization();

      this.isInitialized = true;
      this.logInitializationComplete();
    } catch (error) {
      this.handleInitializationError(error);
      throw error;
    }
  }

  // ========================================
  // Abstract Methods - MUST be implemented by subclasses
  // ========================================

  /**
   * Phase 1: Validate Prerequisites
   *
   * Verify that all required dependencies and resources are available
   * before proceeding with initialization.
   *
   * Examples:
   * - Check if webview view object exists
   * - Validate configuration parameters
   * - Verify required services are available
   *
   * @throws Error if prerequisites are not met
   */
  protected abstract validatePrerequisites(): Promise<void>;

  /**
   * Phase 2: Configure Webview
   *
   * Set up webview-specific configuration including:
   * - Security options (CSP, local resource roots)
   * - Webview options (enable scripts, retain context)
   * - Resource roots and paths
   *
   * Note: Some initializers may not need webview configuration
   * (e.g., pure service coordinators)
   */
  protected abstract configureWebview(): Promise<void>;

  /**
   * Phase 3: Setup Message Listeners
   *
   * Configure message listeners for Extension ↔ WebView communication.
   *
   * IMPORTANT: In VS Code, message listeners should be set up BEFORE
   * HTML content is loaded to ensure no messages are missed.
   *
   * Examples:
   * - webview.onDidReceiveMessage()
   * - window.addEventListener('message')
   * - Message router registration
   */
  protected abstract setupMessageListeners(): Promise<void>;

  /**
   * Phase 4: Initialize Managers
   *
   * Initialize manager and service instances that the component depends on.
   *
   * Examples:
   * - Create terminal managers
   * - Initialize UI managers
   * - Set up persistence services
   * - Initialize CLI agent managers
   */
  protected abstract initializeManagers(): Promise<void>;

  /**
   * Phase 5: Setup Event Handlers
   *
   * Configure event handlers for:
   * - DOM events (clicks, keyboard, resize)
   * - Terminal events (data, resize, close)
   * - UI events (visibility, focus, blur)
   * - Lifecycle events (load, unload)
   */
  protected abstract setupEventHandlers(): Promise<void>;

  /**
   * Phase 6: Load Settings
   *
   * Load user settings and preferences:
   * - User configuration from VS Code settings
   * - Webview state (if persisted)
   * - Terminal preferences
   * - Theme settings
   */
  protected abstract loadSettings(): Promise<void>;

  // ========================================
  // Hook Methods - MAY be overridden by subclasses
  // ========================================

  /**
   * Phase 7: Finalize Initialization (Hook Method)
   *
   * Optional finalization step that runs after all required phases.
   * Subclasses can override this to perform component-specific final setup.
   *
   * Examples:
   * - Set initial UI state
   * - Trigger initial data loading
   * - Request initial state from extension
   * - Set HTML content (for providers)
   *
   * Default: No-op (does nothing)
   */
  protected async finalizeInitialization(): Promise<void> {
    // Default: no-op
    // Subclasses can override to add finalization logic
  }

  /**
   * Handle initialization errors
   *
   * Called when initialization fails at any phase.
   * Subclasses can override to add custom error handling logic.
   *
   * @param error - The error that occurred during initialization
   */
  protected handleInitializationError(error: unknown): void {
    const componentName = this.constructor.name;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger(`❌ [${componentName}] Initialization failed: ${errorMessage}`);
    if (errorStack) {
      this.logger(`❌ [${componentName}] Stack trace:`, errorStack);
    }
  }

  // ========================================
  // Logging Utilities
  // ========================================

  /**
   * Log initialization start
   */
  protected logInitializationStart(): void {
    const componentName = this.constructor.name;
    this.logger(`🚀 [${componentName}] === INITIALIZATION START ===`);
  }

  /**
   * Log initialization completion
   */
  protected logInitializationComplete(): void {
    const componentName = this.constructor.name;
    this.logger(`✅ [${componentName}] === INITIALIZATION COMPLETE ===`);
  }

  /**
   * Log a specific initialization phase
   *
   * @param phase - Description of the current phase
   */
  protected logPhase(phase: string): void {
    const componentName = this.constructor.name;
    this.logger(`🔧 [${componentName}] ${phase}`);
  }

  // ========================================
  // Public Query Methods
  // ========================================

  /**
   * Check if initialization has completed
   *
   * @returns true if initialization is complete, false otherwise
   */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the context object
   *
   * @returns The context object provided during construction
   */
  public getContext(): TContext {
    return this.context;
  }
}

/**
 * Type alias for initialization context with a single component
 */
export type SingleComponentContext<T> = {
  component: T;
};

/**
 * Type alias for initialization context with provider and webview
 */
export type ProviderContext<T> = {
  provider: T;
  webviewView: any;
};
