# WebView Initialization Template Method Pattern Design

## Issue Reference
Issue #218: Consolidate WebView initialization with Template Method pattern

## Problem Analysis

### Current State
Four files contain similar initialization logic patterns:
1. **SecondaryTerminalProvider** (resolveWebviewView method, ~100 lines)
2. **RefactoredTerminalWebviewManager** (constructor, ~150 lines)
3. **TerminalCoordinator** (constructor, ~13 lines)
4. **RefactoredWebviewCoordinator** (initialize method, ~30 lines)

### Common Initialization Phases
All four files follow a similar initialization sequence:

1. **Prerequisites Validation** - Verify dependencies and resources
2. **Webview Configuration** - Set security options, resource roots
3. **Message Listeners Setup** - Configure Extension ↔ WebView communication
4. **Managers/Components Initialization** - Initialize service instances
5. **Event Handlers Setup** - Configure DOM, terminal, and UI events
6. **Settings Loading** - Load user preferences and state
7. **Finalization** - Final setup, initial UI state

## Proposed Solution: Template Method Pattern

### Design Overview

Create an abstract base class `BaseWebViewInitializer` that defines the initialization sequence as a template method, with concrete implementations providing specific behavior.

### Architecture

```
BaseWebViewInitializer (abstract)
├─ SecondaryTerminalProviderInitializer
├─ TerminalWebviewManagerInitializer
├─ TerminalCoordinatorInitializer
└─ WebviewCoordinatorInitializer
```

### Class Diagram

```typescript
abstract class BaseWebViewInitializer {
  // Template Method - defines the algorithm skeleton
  public async initialize(): Promise<void>

  // Abstract methods - must be implemented by subclasses
  protected abstract validatePrerequisites(): Promise<void>
  protected abstract configureWebview(): Promise<void>
  protected abstract setupMessageListeners(): Promise<void>
  protected abstract initializeManagers(): Promise<void>
  protected abstract setupEventHandlers(): Promise<void>
  protected abstract loadSettings(): Promise<void>

  // Hook methods - optional override
  protected async finalizeInitialization(): Promise<void>
  protected handleInitializationError(error: unknown): void

  // Logging utilities
  protected logInitializationStart(): void
  protected logInitializationComplete(): void
  protected logPhase(phase: string): void
}
```

### Implementation Strategy

**Option 1: Composition-based (Recommended)**
- Create initialization helper classes that extend `BaseWebViewInitializer`
- Existing classes delegate to these helpers
- Minimal changes to existing code
- Preserves existing class hierarchies

**Option 2: Inheritance-based**
- Existing classes extend `BaseWebViewInitializer`
- Requires refactoring existing inheritance relationships
- More invasive changes

### Detailed Design

#### 1. Base Abstract Class

Location: `src/webview/initialization/BaseWebViewInitializer.ts`

```typescript
export abstract class BaseWebViewInitializer<TContext = any> {
  protected readonly context: TContext;
  protected readonly logger: (message: string, ...args: any[]) => void;

  constructor(context: TContext, logger?: (message: string, ...args: any[]) => void) {
    this.context = context;
    this.logger = logger ?? console.log;
  }

  /**
   * Template Method - defines initialization sequence
   */
  public async initialize(): Promise<void> {
    try {
      this.logInitializationStart();

      // Phase 1: Validate prerequisites
      this.logPhase('Validating prerequisites');
      await this.validatePrerequisites();

      // Phase 2: Configure webview
      this.logPhase('Configuring webview');
      await this.configureWebview();

      // Phase 3: Setup message listeners
      this.logPhase('Setting up message listeners');
      await this.setupMessageListeners();

      // Phase 4: Initialize managers
      this.logPhase('Initializing managers');
      await this.initializeManagers();

      // Phase 5: Setup event handlers
      this.logPhase('Setting up event handlers');
      await this.setupEventHandlers();

      // Phase 6: Load settings
      this.logPhase('Loading settings');
      await this.loadSettings();

      // Phase 7: Finalization (hook method)
      this.logPhase('Finalizing initialization');
      await this.finalizeInitialization();

      this.logInitializationComplete();
    } catch (error) {
      this.handleInitializationError(error);
      throw error;
    }
  }

  // Abstract methods - must be implemented by subclasses
  protected abstract validatePrerequisites(): Promise<void>;
  protected abstract configureWebview(): Promise<void>;
  protected abstract setupMessageListeners(): Promise<void>;
  protected abstract initializeManagers(): Promise<void>;
  protected abstract setupEventHandlers(): Promise<void>;
  protected abstract loadSettings(): Promise<void>;

  // Hook methods - optional override
  protected async finalizeInitialization(): Promise<void> {
    // Default: no-op
  }

  protected handleInitializationError(error: unknown): void {
    this.logger('❌ Initialization failed:', error);
  }

  // Logging utilities
  protected logInitializationStart(): void {
    this.logger(`🚀 Initializing ${this.constructor.name}...`);
  }

  protected logInitializationComplete(): void {
    this.logger(`✅ ${this.constructor.name} initialized successfully`);
  }

  protected logPhase(phase: string): void {
    this.logger(`🔧 ${phase}...`);
  }
}
```

#### 2. Concrete Implementations

##### SecondaryTerminalProviderInitializer

Location: `src/providers/initialization/SecondaryTerminalProviderInitializer.ts`

```typescript
export class SecondaryTerminalProviderInitializer extends BaseWebViewInitializer<{
  provider: SecondaryTerminalProvider;
  webviewView: vscode.WebviewView;
}> {
  protected async validatePrerequisites(): Promise<void> {
    if (!this.context.webviewView) {
      throw new Error('WebviewView is required');
    }
    this.logger('✅ Prerequisites validated');
  }

  protected async configureWebview(): Promise<void> {
    this.context.provider['_configureWebview'](this.context.webviewView);
  }

  protected async setupMessageListeners(): Promise<void> {
    const { webviewView } = this.context;
    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      (message) => this.context.provider['_handleWebviewMessage'](message)
    );
    // Register disposable...
  }

  protected async initializeManagers(): Promise<void> {
    this.context.provider['_initializeMessageHandlers']();
  }

  protected async setupEventHandlers(): Promise<void> {
    this.context.provider['_setupTerminalEventListeners']();
    this.context.provider['_setupCliAgentStatusListeners']();
    this.context.provider['_setupConfigurationChangeListeners']();
  }

  protected async loadSettings(): Promise<void> {
    // Load settings from VS Code configuration
  }

  protected async finalizeInitialization(): Promise<void> {
    this.context.provider['_setupPanelLocationChangeListener'](
      this.context.webviewView
    );
    this.context.provider['_setWebviewHtml'](this.context.webviewView, false);
  }
}
```

##### TerminalWebviewManagerInitializer

Location: `src/webview/initialization/TerminalWebviewManagerInitializer.ts`

```typescript
export class TerminalWebviewManagerInitializer extends BaseWebViewInitializer<{
  manager: RefactoredTerminalWebviewManager;
}> {
  protected async validatePrerequisites(): Promise<void> {
    // Validate required dependencies
  }

  protected async configureWebview(): Promise<void> {
    // WebView configuration handled by browser context
  }

  protected async setupMessageListeners(): Promise<void> {
    this.context.manager['setupScrollbackMessageListener']();
  }

  protected async initializeManagers(): Promise<void> {
    // Managers already initialized in constructor
    // This phase validates initialization
  }

  protected async setupEventHandlers(): Promise<void> {
    this.context.manager['setupEventHandlers']();
  }

  protected async loadSettings(): Promise<void> {
    this.context.manager.loadSettings();
  }

  protected async finalizeInitialization(): Promise<void> {
    this.context.manager['setupInputManager']();
  }
}
```

##### TerminalCoordinatorInitializer

Location: `src/webview/services/initialization/TerminalCoordinatorInitializer.ts`

```typescript
export class TerminalCoordinatorInitializer extends BaseWebViewInitializer<{
  coordinator: TerminalCoordinator;
}> {
  protected async validatePrerequisites(): Promise<void> {
    // Validate configuration
  }

  protected async configureWebview(): Promise<void> {
    // No webview configuration needed for coordinator
  }

  protected async setupMessageListeners(): Promise<void> {
    // No direct message listeners
  }

  protected async initializeManagers(): Promise<void> {
    // Coordinator initialization handled in constructor
  }

  protected async setupEventHandlers(): Promise<void> {
    this.context.coordinator['initializeEventListeners']();
  }

  protected async loadSettings(): Promise<void> {
    // Load terminal configuration
  }
}
```

##### WebviewCoordinatorInitializer

Location: `src/webview/initialization/WebviewCoordinatorInitializer.ts`

```typescript
export class WebviewCoordinatorInitializer extends BaseWebViewInitializer<{
  coordinator: RefactoredWebviewCoordinator;
}> {
  protected async validatePrerequisites(): Promise<void> {
    if (this.context.coordinator['isInitialized']) {
      throw new Error('Coordinator already initialized');
    }
  }

  protected async configureWebview(): Promise<void> {
    // No direct webview configuration
  }

  protected async setupMessageListeners(): Promise<void> {
    this.context.coordinator['setupMessageHandlers']();
  }

  protected async initializeManagers(): Promise<void> {
    await this.context.coordinator['terminalCoordinator'].initialize();
    await this.context.coordinator['uiController'].initialize();
  }

  protected async setupEventHandlers(): Promise<void> {
    this.context.coordinator['setupTerminalCoordinatorEvents']();
    this.context.coordinator['setupUIControllerEvents']();
  }

  protected async loadSettings(): Promise<void> {
    // Load coordinator configuration
  }

  protected async finalizeInitialization(): Promise<void> {
    this.context.coordinator['updateUIState']();
  }
}
```

### Integration Approach

#### Before (SecondaryTerminalProvider example)
```typescript
public resolveWebviewView(webviewView: vscode.WebviewView): void {
  try {
    this._view = webviewView;
    this._isInitialized = false;

    // Step 1: Configure webview
    this._configureWebview(webviewView);

    // Step 2: Setup message listeners
    const messageDisposable = webviewView.webview.onDidReceiveMessage(...);

    // Step 3: Setup visibility listener
    const visibilityDisposable = webviewView.onDidChangeVisibility(...);

    // Step 4: Set HTML
    this._setWebviewHtml(webviewView, false);

    // Step 5: Setup listeners
    this._setupTerminalEventListeners();
    this._setupCliAgentStatusListeners();

    // Step 6: Panel location listener
    this._setupPanelLocationChangeListener(webviewView);
  } catch (error) {
    this._handleWebviewSetupError(webviewView, error);
  }
}
```

#### After (Using Template Method)
```typescript
public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
  this._view = webviewView;
  this._isInitialized = false;

  const initializer = new SecondaryTerminalProviderInitializer(
    { provider: this, webviewView },
    log
  );

  await initializer.initialize();
  this._isInitialized = true;
}
```

## Benefits

1. **Code Reduction**: ~200 lines eliminated through consolidation
2. **Unified Workflow**: Consistent initialization across all providers
3. **Maintainability**: Changes to initialization flow in one place
4. **Testability**: Each phase can be tested independently
5. **Error Handling**: Standardized error handling approach
6. **Documentation**: Clear initialization sequence

## Implementation Timeline

1. **Phase 1**: Create base abstract class (1 day)
2. **Phase 2**: Implement concrete initializers (1 day)
3. **Phase 3**: Integrate with existing classes (1 day)
4. **Phase 4**: Testing and validation (1 day)

Total: 4 days

## Testing Strategy

1. **Unit Tests**: Test each initializer implementation
2. **Integration Tests**: Test initialization flow end-to-end
3. **Regression Tests**: Ensure no functionality is broken
4. **Error Handling Tests**: Verify error scenarios are handled correctly

## Migration Notes

- Existing functionality is preserved
- No breaking changes to public APIs
- Internal refactoring only
- Gradual migration possible (one class at a time)
