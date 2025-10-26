# Design: Terminal Modularity Refactor

## 1. Current Control/Data Flow Summary

### 1.1 Extension Host Provider (`src/providers/SecondaryTerminalProvider.ts`)
1. VS Code calls `resolveWebviewView`, which in turn:
   - Calls `_resetForNewView` to instantiate services (PanelLocationService, ScrollbackCoordinator, UnifiedTerminalPersistenceService, etc.) and set flags.
   - Registers message + visibility listeners **before** writing HTML (`_registerWebviewMessageListener`, `_registerVisibilityListener`).
   - Generates HTML through `WebViewHtmlGenerationService` and wires persistence handlers and location detection timers.
2. `_registerWebviewMessageListener` attaches `onDidReceiveMessage` and forwards every message to `_handleWebviewMessage`, which performs validation and runs a large command map built in `_initializeMessageHandlers` (currently ~25 handlers covering focus, create/delete, resize, settings, telemetry, scrollback, etc.).
3. `_handle*` helpers call into `TerminalManager`, persistence services, or webview postMessage APIs directly. For example, `_handleCreateTerminal` calls `TerminalManager.createTerminalWithProfile`, while `_handleReportPanelLocation` feeds PanelLocationService → VS Code context update.
4. Terminal events (data/exit) are proxied through `TerminalEventCoordinator`, but the provider still owns the subscriptions and error handling.

### 1.2 Webview Manager (`src/webview/managers/LightweightTerminalWebviewManager.ts`)
1. Acts as coordinator for ~18 specialized managers (UIManager, InputManager, PerformanceManager, TerminalLifecycleManager, NotificationManager, etc.) but still contains:
   - System state bookkeeping (debug snapshots, scrollback requests, diagnostics payloads).
   - Direct message routing: `handleWebviewMessage` inspects `command` and branches to handlers for splits, lifecycle, focus, keyboard, persistence, etc.
   - Initialization pipeline that instantiates managers, wires observers, and synchronizes configuration/state with the extension.
2. The manager still owns `webview.postMessage` plumbing, manual retry logic, and resilience timers, resulting in 2,600+ LOC even after previous “lightweight” pass.

### 1.3 Terminal Core (`src/terminals/TerminalManager.ts`)
1. Maintains terminal registry, emits VS Code events, orchestrates shell integration, CLI agent detection, and persistence updates.
2. Serializes lifecycle operations through a custom `operationQueue` promise chain, plus guard sets such as `_terminalBeingKilled` to avoid duplicate disposal.
3. Contains business logic for profile resolution, spawn/kill, resize, input, and telemetry (logging, heartbeat). No separation between “state storage” and “command execution”, so tests must cover the entire manager.

## 2. Target Architecture Overview
```
VS Code Provider Layer
└── SecondaryTerminalProvider (wires VS Code APIs)
    ├── ViewBootstrapper (HTML + context wiring)
    ├── MessageBridge (typed commands ↔ Webview)
    ├── PanelLocationController (context keys, layout)
    └── PersistenceOrchestrator (session restore/save)

Webview Layer
└── WebviewCoordinator (single entry)
    ├── Feature Controllers (UI/Input/Perf/... existing managers)
    └── MessageRouter (command→handler map)

Terminal Core Layer
└── TerminalCommandQueue
    ├── TerminalRegistry (state, IDs, metadata)
    ├── TerminalLifecycleService (spawn/kill/focus)
    └── TerminalEventHub (emitter plumbing)
```

## 3. Shared Interfaces (Draft)
```ts
// Provider ↔ Webview
export interface WebviewBridge {
  post(message: WebviewCommandMessage): Thenable<boolean>;
  on(handler: (msg: WebviewCommandMessage) => void): vscode.Disposable;
}

export interface PanelLocationPort {
  detect(): Promise<PanelLocationSnapshot>;
  updateContext(snapshot: PanelLocationSnapshot): void;
}

export interface PersistencePort {
  restore(): Promise<RestoredSession | null>;
  save(state: PersistedTerminalState): Promise<void>;
}

// Webview Coordinator
export interface WebviewCoordinator {
  initialize(context: WebviewContext): Promise<void>;
  dispatch(command: WebviewCommandMessage): Promise<void>;
  dispose(): void;
}

// Terminal Core
export interface TerminalCommandQueue {
  enqueue(command: TerminalCommand): Promise<void>;
}

export interface TerminalRegistry {
  allocate(): string;
  release(id: string): void;
  get(id: string): TerminalInstance | undefined;
}

export interface TerminalLifecycleService {
  create(request: CreateTerminalRequest): Promise<TerminalInstance>;
  dispose(id: string): Promise<void>;
  focus(id: string): void;
}

export interface TerminalEventHub {
  onData: vscode.Event<TerminalEvent>;
  emitData(event: TerminalEvent): void;
  // same for exit, focus, state, etc.
}
```

These interfaces become the “ports” referenced in the proposal tasks. Concrete adapters will live under `src/providers/secondaryTerminal/` (provider layer), `src/webview/coordinators/`, and `src/terminals/core/`.

## 4. Sequencing Notes
1. **Discovery artifacts** (this document) satisfy Tasks 1.1 and 1.2. The rest of the tasks will move code gradually so we always keep a working provider/webview/terminal pipeline.
2. Provider segmentation can be achieved without changing terminal APIs by wrapping existing services. Once the bridge exists, `SecondaryTerminalProvider` shrinks to ~200–300 LOC.
3. Webview coordinator can initially delegate to current managers; once message routing is centralized we can prune legacy `handle*` branches.
4. Terminal core refactor will introduce `commandQueue.ts` and adapter classes while keeping the existing `TerminalManager` exported symbol for compatibility (flip via feature flag `SECONDARY_TERMINAL_REFACTORED`).
5. Persistence + messaging alignment happen after new interfaces settle so we can delete duplicated guards (PanelLocationService vs provider context updates, etc.).
