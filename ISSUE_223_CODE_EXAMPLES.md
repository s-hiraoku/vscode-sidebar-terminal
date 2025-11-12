# Issue #223 - Clean Architecture Violations: Code Examples

This document provides concrete code examples of violations and their solutions.

---

## VIOLATION 1: Extension Layer Contains WebView Code

### Problem Example 1: WebViewStateManager in Extension

**Current (WRONG):**
```typescript
// File: src/services/WebViewStateManager.ts - WRONG LOCATION!
export class WebViewStateManager {
  constructor(
    private sendMessage?: (message: WebviewMessage) => Promise<void>
  ) {}

  // Extension service controlling WebView lifecycle
  public async initializeWebView(): Promise<void> {
    await this._initializeTerminal();
    
    // Sending messages to WebView from Extension
    this.sendMessage({
      command: 'stateUpdate',
      state: this.terminalManager.getCurrentState(),
    });
  }

  // WebView-specific visibility handling
  public async handleVisibilityChange(visible: boolean): Promise<void> {
    if (visible) {
      this.requestPanelLocationDetection();  // WebView operation!
    }
  }

  // Browser event handling in Extension
  private async _handleSessionRestore() {
    await this.sendMessage({
      command: 'sessionRestored',
      data: sessionData,
    });
  }
}
```

**Why It's Wrong:**
- Extension shouldn't import/use WebView-specific types
- Extension shouldn't call `sendMessage` to WebView
- WebView visibility is a browser concern

**Solution (CORRECT):**
```typescript
// File: src/services/state/ExtensionStateService.ts
export interface IExtensionStateService {
  getCurrentTerminalState(): TerminalState;
  setActiveTerminal(terminalId: string): void;
  initializeTerminals(): Promise<void>;
  // NO WebView-specific methods!
}

export class ExtensionStateService implements IExtensionStateService {
  constructor(
    private terminalManager: TerminalManager,
    private stateChangeListener: (state: TerminalState) => void  // Callback, not direct message
  ) {}

  getCurrentTerminalState(): TerminalState {
    return this.terminalManager.getState();
  }

  async initializeTerminals(): Promise<void> {
    const terminals = await this.terminalManager.restoreSession();
    
    // Notify via callback, not WebView-specific message
    this.stateChangeListener(this.terminalManager.getState());
  }
}

// File: src/webview/services/WebViewStateManager.ts
export class WebViewStateManager {
  constructor(
    private stateService: IExtensionStateService,
    private messageDispatcher: IWebViewMessageDispatcher
  ) {}

  // WebView-specific initialization
  public async initializeWebView(): Promise<void> {
    // Get state from Extension via service
    const state = this.stateService.getCurrentTerminalState();
    
    // Handle WebView visibility
    window.addEventListener('focus', () => this.onWebViewFocused());
  }

  private onWebViewFocused(): void {
    // WebView-specific logic here
  }
}
```

**Key Differences:**
- Extension service has NO knowledge of WebView
- Communication through interfaces/callbacks, not direct messages
- WebView initialization is in WebView layer
- Clear separation of concerns

---

## VIOLATION 2: SecondaryTerminalProvider God Object

### Problem: 92 Methods, 5 Different Concerns

**Current (WRONG) - SecondaryTerminalProvider.ts (2,655 lines)**
```typescript
export class SecondaryTerminalProvider implements vscode.WebviewViewProvider {
  // Concern 1: HTML Generation
  private _configureWebview(webviewView: vscode.WebviewView): void {
    webviewView.webview.html = this._htmlGenerationService.generateHtml();
  }

  // Concern 2: Message Routing (20+ methods)
  private async _handleWebviewMessage(message: WebviewMessage): Promise<void> {
    switch (message.command) {
      case 'input': return await this._handleInput(message);
      case 'resize': return await this._handleResize(message);
      case 'createTerminal': return await this._handleCreateTerminal(message);
      // ... 17+ more cases
    }
  }

  private async _handleInput(message: WebviewMessage): Promise<void> { /* 30 lines */ }
  private async _handleResize(message: WebviewMessage): Promise<void> { /* 40 lines */ }
  private async _handleCreateTerminal(message: WebviewMessage): Promise<void> { /* 60 lines */ }
  // ... 17+ more handlers

  // Concern 3: Terminal Lifecycle
  private async _handleCreateTerminal(message: WebviewMessage): Promise<void> {
    const terminalId = this._terminalManager.createTerminal();
    // ...
  }

  // Concern 4: Session Persistence
  private _persistenceService?: UnifiedTerminalPersistenceService;
  
  // Concern 5: Configuration Sync
  private _setupConfigurationListener(): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      // Configuration change handling
    });
  }

  // PLUS: dispose(), resolveWebviewView(), sendMessage(), etc.
  // TOTAL: 92+ methods in one class!
}
```

**Solution (CORRECT) - Extracted Components**

```typescript
// File: src/extension/providers/SecondaryTerminalProvider.ts (NEW - SLIM)
export class SecondaryTerminalProvider implements vscode.WebviewViewProvider {
  private messageRouter: ExtensionMessageRouter;
  private configSync: ConfigurationSynchronizer;
  private htmlGenerator: HTMLGenerationController;
  private sessionManager: SessionCoordinator;

  constructor(
    private context: vscode.ExtensionContext,
    private terminalManager: TerminalManager
  ) {
    // Delegate to specialized components
    this.messageRouter = new ExtensionMessageRouter(terminalManager);
    this.configSync = new ConfigurationSynchronizer();
    this.htmlGenerator = new HTMLGenerationController();
    this.sessionManager = new SessionCoordinator(terminalManager, context);
  }

  // Main responsibility: WebView integration with VS Code
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    // Delegate HTML generation
    webviewView.webview.html = this.htmlGenerator.generate();

    // Delegate message handling
    webviewView.webview.onDidReceiveMessage((message) => {
      this.messageRouter.route(message, webviewView);
    });

    // Delegate configuration sync
    this.configSync.setupListener(webviewView);

    // Delegate session management
    this.sessionManager.initialize(webviewView);
  }

  dispose(): void {
    this.messageRouter.dispose();
    this.configSync.dispose();
    this.sessionManager.dispose();
  }
}

// File: src/extension/messaging/ExtensionMessageRouter.ts (NEW)
export class ExtensionMessageRouter implements IMessageRouter {
  private handlers = new Map<string, IMessageHandler>();

  constructor(private terminalManager: TerminalManager) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers.set('input', new TerminalInputHandler(this.terminalManager));
    this.handlers.set('resize', new TerminalResizeHandler(this.terminalManager));
    this.handlers.set('createTerminal', new CreateTerminalHandler(this.terminalManager));
    // ... register all handlers
  }

  async route(message: WebviewMessage, webviewView: vscode.WebviewView): Promise<void> {
    const handler = this.handlers.get(message.command);
    if (!handler) {
      throw new Error(`Unknown command: ${message.command}`);
    }

    const response = await handler.handle(message);
    webviewView.webview.postMessage(response);
  }
}

// File: src/extension/messaging/handlers/TerminalInputHandler.ts (NEW)
export class TerminalInputHandler implements IMessageHandler {
  constructor(private terminalManager: TerminalManager) {}

  canHandle(message: WebviewMessage): boolean {
    return message.command === 'input';
  }

  async handle(message: WebviewMessage): Promise<WebviewMessage> {
    const { terminalId, data } = message as InputMessage;
    
    await this.terminalManager.sendInput(terminalId, data);
    
    return {
      command: 'inputProcessed',
      terminalId,
      success: true,
    };
  }
}

// File: src/extension/config/ConfigurationSynchronizer.ts (NEW)
export class ConfigurationSynchronizer implements IDisposable {
  private disposables: vscode.Disposable[] = [];

  setupListener(webviewView: vscode.WebviewView): void {
    const listener = vscode.workspace.onDidChangeConfiguration((event) => {
      const config = vscode.workspace.getConfiguration('sidebarTerminal');
      webviewView.webview.postMessage({
        command: 'configurationChanged',
        config: config.toJSON(),
      });
    });

    this.disposables.push(listener);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

// File: src/extension/session/SessionCoordinator.ts (NEW)
export class SessionCoordinator implements IDisposable {
  private persistenceService: IPersistenceService;

  constructor(
    private terminalManager: TerminalManager,
    context: vscode.ExtensionContext
  ) {
    this.persistenceService = new ExtensionPersistenceService(context);
  }

  async initialize(webviewView: vscode.WebviewView): Promise<void> {
    const session = await this.persistenceService.loadSession();
    
    if (session) {
      await this.terminalManager.restoreSession(session);
      webviewView.webview.postMessage({
        command: 'sessionRestored',
        terminals: session.terminals,
      });
    }
  }

  dispose(): void {
    this.persistenceService.dispose?.();
  }
}
```

**Result:**
- SecondaryTerminalProvider: ~150 lines (one responsibility: WebView integration)
- ExtensionMessageRouter: ~80 lines (one responsibility: message routing)
- Individual handlers: ~30 lines each (one responsibility: handle one message type)
- ConfigurationSynchronizer: ~40 lines (one responsibility: config sync)
- SessionCoordinator: ~60 lines (one responsibility: session management)

---

## VIOLATION 3: Four Persistence Services with No Unified Interface

### Problem: Duplicate Logic, No Abstraction

**Current (WRONG):**
```typescript
// File: src/services/UnifiedTerminalPersistenceService.ts (Extension)
export class UnifiedTerminalPersistenceService {
  async saveSession(terminals: any[]): Promise<void> {
    const sessionData = { /* ... */ };
    await this.context.globalState.update(SESSION_KEY, compressedData);
  }

  async restoreSession(): Promise<any[]> {
    const sessionData = await this.loadSessionData();
    const restoredTerminals = await this.bulkTerminalRestore(sessionData.terminals);
  }
}

// File: src/webview/managers/SimplePersistenceManager.ts (WebView)
export class SimplePersistenceManager {
  async saveSession(): Promise<boolean> {
    const sessionData = {
      terminalCount,
      activeTerminalId,
      terminalNames,
    };
    this.vscodeApi.setState(currentState);
    return true;
  }

  async loadSession(): Promise<SimpleSessionData | null> {
    const currentState = this.vscodeApi.getState();
    return currentState[SIMPLE_PERSISTENCE.STORAGE_KEY];
  }
}

// File: src/webview/managers/StandardTerminalPersistenceManager.ts (WebView)
export class StandardTerminalPersistenceManager {
  private serializeAddons: Map<string, SerializeAddon> = new Map();

  public addTerminal(terminalId: string, terminal: Terminal): void {
    const serializeAddon = new SerializeAddon();
    terminal.loadAddon(serializeAddon);
  }
}

// File: src/webview/services/OptimizedPersistenceManager.ts (WebView)
export class OptimizedPersistenceManager {
  async saveSession(force: boolean = false): Promise<boolean> {
    // Yet another implementation
  }
}
```

**Why It's Wrong:**
- 4 different classes doing similar things
- No shared interface
- Impossible to mock for testing
- Duplicate logic (compression, validation, etc.)

**Solution (CORRECT) - Unified Abstraction**

```typescript
// File: src/services/persistence/IPersistenceService.ts (NEW)
export interface SessionData {
  version: string;
  timestamp: number;
  terminals: TerminalInfo[];
  activeTerminalId: string;
}

export interface IPersistenceService {
  saveSession(session: SessionData): Promise<void>;
  restoreSession(): Promise<SessionData | null>;
  clearSession(): Promise<void>;
}

// File: src/services/persistence/ExtensionPersistenceService.ts (NEW)
export class ExtensionPersistenceService implements IPersistenceService {
  constructor(private context: vscode.ExtensionContext) {}

  async saveSession(session: SessionData): Promise<void> {
    const compressed = this.compress(session);
    await this.context.globalState.update(SESSION_KEY, compressed);
  }

  async restoreSession(): Promise<SessionData | null> {
    const raw = this.context.globalState.get<string>(SESSION_KEY);
    if (!raw) return null;
    return this.decompress(raw);
  }

  async clearSession(): Promise<void> {
    await this.context.globalState.update(SESSION_KEY, undefined);
  }

  private compress(data: SessionData): string {
    return JSON.stringify(data); // Real implementation would compress
  }

  private decompress(data: string): SessionData {
    return JSON.parse(data);
  }
}

// File: src/webview/services/persistence/WebViewPersistenceManager.ts (NEW)
export class WebViewPersistenceManager implements IPersistenceService {
  constructor(
    private vscodeApi: VsCodeApi,
    private strategies: PersistenceStrategy[] = []
  ) {
    // Support multiple backends: simple state, xterm addon, etc.
  }

  async saveSession(session: SessionData): Promise<void> {
    // Strategy 1: Save to VS Code state
    const state = this.vscodeApi.getState() || {};
    state[SESSION_KEY] = session;
    this.vscodeApi.setState(state);

    // Strategy 2: Also serialize xterm content if available
    for (const strategy of this.strategies) {
      await strategy.save(session);
    }
  }

  async restoreSession(): Promise<SessionData | null> {
    // Try to restore from state first
    const state = this.vscodeApi.getState();
    if (state?.[SESSION_KEY]) {
      return state[SESSION_KEY];
    }

    // Try other strategies
    for (const strategy of this.strategies) {
      const data = await strategy.restore();
      if (data) return data;
    }

    return null;
  }

  async clearSession(): Promise<void> {
    const state = this.vscodeApi.getState() || {};
    delete state[SESSION_KEY];
    this.vscodeApi.setState(state);

    for (const strategy of this.strategies) {
      await strategy.clear();
    }
  }
}

// File: src/services/persistence/PersistenceServiceFactory.ts (NEW)
export class PersistenceServiceFactory {
  static createExtensionService(context: vscode.ExtensionContext): IPersistenceService {
    return new ExtensionPersistenceService(context);
  }

  static createWebViewService(
    vscodeApi: VsCodeApi,
    enableXtermStrategy: boolean = false
  ): IPersistenceService {
    const strategies: PersistenceStrategy[] = [];

    if (enableXtermStrategy) {
      strategies.push(new XtermSerializeStrategy());
    }

    return new WebViewPersistenceManager(vscodeApi, strategies);
  }
}
```

**Result:**
- Single `IPersistenceService` interface for both layers
- Concrete implementations per layer
- Remove `SimplePersistenceManager`
- Remove `StandardTerminalPersistenceManager`
- Remove `OptimizedPersistenceManager` (duplicate)
- Easy to mock for testing
- Clear API contract

---

## VIOLATION 4: Message Handlers Crossing Layer Boundaries

### Problem: Persistence Message Handler Couples Layers

**Current (WRONG):**
```typescript
// File: src/handlers/PersistenceMessageHandler.ts - WRONG!
// This is in the Extension layer but handles WebView messages

export class PersistenceMessageHandler {
  constructor(private readonly persistenceService: UnifiedTerminalPersistenceService) {}

  // WebView sends this message
  async handleMessage(message: PersistenceMessage): Promise<PersistenceResponse> {
    switch (message.command) {
      case 'saveSession':
        // Extension handles WebView persistence
        return await this.handleSaveSession(message.data);
      case 'restoreSession':
        return await this.handleRestoreSession();
    }
  }

  // Calls Extension persistence directly
  private async handleSaveSession(terminalData: any): Promise<PersistenceResponse> {
    await this.persistenceService.saveSession(terminalData);
  }
}

// WebView has no persistence handler, all logic in Extension!
```

**Why It's Wrong:**
- Message handler is in Extension but for WebView protocol
- Couples message protocol to persistence service
- No abstraction between protocol and implementation

**Solution (CORRECT) - Layer-Specific Handlers**

```typescript
// File: src/extension/messaging/ExtensionPersistenceHandler.ts (NEW - EXTENSION)
export class ExtensionPersistenceHandler implements IMessageHandler {
  constructor(private persistenceService: IPersistenceService) {}

  canHandle(message: ExtensionMessage): boolean {
    return message.command === 'saveSession' || 
           message.command === 'restoreSession' ||
           message.command === 'clearSession';
  }

  async handle(message: ExtensionMessage): Promise<ExtensionMessage> {
    if (message.command === 'saveSession') {
      await this.persistenceService.saveSession(message.data);
      return { command: 'sessionSaved', success: true };
    }
    // ... handle other commands
  }
}

// File: src/webview/messaging/WebViewPersistenceHandler.ts (NEW - WEBVIEW)
export class WebViewPersistenceHandler implements IMessageHandler {
  constructor(private persistenceManager: IPersistenceService) {}

  canHandle(message: WebViewMessage): boolean {
    return message.command === 'sessionSaved' ||
           message.command === 'sessionRestored';
  }

  async handle(message: WebViewMessage): Promise<void> {
    if (message.command === 'sessionSaved') {
      // WebView-specific handling
      this.showNotification('Session saved');
      this.updateUI();
    }
    if (message.command === 'sessionRestored') {
      // WebView-specific handling
      this.restoreUIState(message.data);
    }
  }
}

// File: src/messaging/protocol/PersistenceProtocol.ts (NEW - SHARED)
export interface SaveSessionMessage extends BaseMessage {
  command: 'saveSession';
  data: SessionData;
}

export interface SessionSavedMessage extends BaseMessage {
  command: 'sessionSaved';
  success: boolean;
  error?: string;
}

export type PersistenceMessage = 
  | SaveSessionMessage 
  | RestoreSessionMessage
  | SessionRestoredMessage
  // ... etc
```

**Result:**
- Extension handler → handles Extension-side operations
- WebView handler → handles WebView-side operations
- Shared protocol → defines message contract
- Clear separation of concerns
- Easy to test each handler independently

---

## VIOLATION 5: State Management Lacking Abstraction

### Problem: No Unified State Interface

**Current (WRONG):**
```typescript
// File: src/services/TerminalStateManager.ts (Extension)
export class TerminalStateManager {
  private _currentState: TerminalState = {
    terminals: [],
    activeTerminalId: null,
    maxTerminals: 5,
  };

  setActiveTerminal(terminalId: string): OperationResult<void> {
    this._currentState.activeTerminalId = terminalId;
    this.emitStateUpdate();
  }

  getCurrentState(): TerminalState {
    return { ...this._currentState };
  }
}

// File: src/webview/managers/GenericStateManager.ts (WebView)
export class GenericStateManager {
  private state: Map<string, any> = new Map();

  setState(key: string, value: any): void {
    this.state.set(key, value);
  }

  getState(key: string): any {
    return this.state.get(key);
  }
}

// Different interfaces, different patterns, no synchronization!
```

**Why It's Wrong:**
- Extension and WebView have different state managers
- No unified state interface
- No synchronization protocol
- WebView doesn't know when Extension state changes

**Solution (CORRECT) - Unified State Abstraction**

```typescript
// File: src/services/state/IStateService.ts (NEW - INTERFACE)
export interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  maxTerminals: number;
}

export interface IStateService {
  getState(): TerminalState;
  setState(state: Partial<TerminalState>): void;
  onStateChange: Event<TerminalState>;
}

// File: src/services/state/ExtensionStateService.ts (NEW - EXTENSION)
export class ExtensionStateService implements IStateService {
  private state: TerminalState = {
    terminals: [],
    activeTerminalId: null,
    maxTerminals: 5,
  };

  private stateChanged = new vscode.EventEmitter<TerminalState>();

  getState(): TerminalState {
    return { ...this.state };
  }

  setState(partial: Partial<TerminalState>): void {
    this.state = { ...this.state, ...partial };
    this.stateChanged.fire(this.state);
  }

  get onStateChange(): vscode.Event<TerminalState> {
    return this.stateChanged.event;
  }
}

// File: src/webview/state/WebViewStateManager.ts (NEW - WEBVIEW)
export class WebViewStateManager implements IStateService {
  private state: TerminalState = {
    terminals: [],
    activeTerminalId: null,
    maxTerminals: 5,
  };

  private stateChanged = new EventEmitter<TerminalState>();

  getState(): TerminalState {
    return { ...this.state };
  }

  setState(partial: Partial<TerminalState>): void {
    this.state = { ...this.state, ...partial };
    this.stateChanged.emit(this.state);
  }

  // Listen to Extension state changes via message
  onExtensionStateChange(newState: TerminalState): void {
    this.setState(newState);
  }

  get onStateChange(): Event<TerminalState> {
    return this.stateChanged.event;
  }
}

// File: src/state-sync/StateSyncCoordinator.ts (NEW - SYNC)
export class StateSyncCoordinator {
  constructor(
    private extensionState: IStateService,
    private messageDispatcher: IMessageDispatcher
  ) {
    // When Extension state changes, sync to WebView
    this.extensionState.onStateChange.subscribe((state) => {
      this.messageDispatcher.send({
        command: 'stateSync',
        data: state,
      });
    });
  }
}
```

**Result:**
- Single `IStateService` interface
- Same interface for both layers
- Clear synchronization protocol
- Event-driven updates
- Easy to test with mock implementations

---

## Summary of Violations and Solutions

| Violation | Current Problem | Solution |
|-----------|-----------------|----------|
| **Extension has WebView code** | 1,380 lines of WebView logic in Extension | Move to WebView, use interfaces for communication |
| **God object (2,655 lines)** | SecondaryTerminalProvider handles 5 concerns | Extract to 5 specialized classes (~150 lines each) |
| **4 persistence services** | Duplicate logic, no interface | Create `IPersistenceService` interface, 2 implementations |
| **Scattered message handlers** | 10+ handlers in Extension | Create `ExtensionMessageRouter` + layer-specific handlers |
| **No state abstraction** | Extension and WebView have different state managers | Create `IStateService` interface, sync via messages |

**Total Refactoring Impact:**
- Reduce god objects from 2 to 0
- Extract 1,500+ lines of message handling
- Consolidate 4 persistence services into 1 interface + 2 implementations
- Create unified state interface
- All while maintaining full backward compatibility

