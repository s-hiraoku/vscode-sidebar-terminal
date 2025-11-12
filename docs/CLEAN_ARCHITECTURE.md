# Clean Architecture Implementation

This document describes the clean architecture implementation for the VSCode Sidebar Terminal extension, as per issue #223.

## Overview

The codebase is refactored to follow clean architecture principles with clear separation between Extension and WebView layers.

## Architecture Layers

### 1. Extension Layer (`src/`)
- **Responsibilities:**
  - PTY process management
  - VS Code API interactions
  - Extension-side storage (globalState)
  - Terminal lifecycle management

- **Key Components:**
  - `ExtensionPersistenceService` - Session storage using VS Code APIs
  - `ExtensionStateService` - Terminal state management
  - `ExtensionMessageDispatcher` - Message handling

### 2. Communication Layer (`src/interfaces/`)
- **Responsibilities:**
  - Define contracts between layers
  - Message protocols and DTOs
  - No business logic

- **Key Interfaces:**
  - `IPersistenceService` - Persistence contract
  - `IStateService` - State management contract
  - `IMessageHandler` - Message handling contract

### 3. WebView Layer (`src/webview/`)
- **Responsibilities:**
  - Terminal rendering (xterm.js)
  - User interaction handling
  - Browser-side temporary storage

- **Key Components:**
  - `WebViewPersistenceService` - Browser localStorage
  - `WebViewStateService` - UI state management
  - `WebViewMessageDispatcher` - Message handling

## Design Principles

### 1. Dependency Inversion
All layers depend on interfaces, not concrete implementations:

```typescript
// Good: Depends on interface
constructor(private persistenceService: IPersistenceService) {}

// Bad: Depends on concrete class
constructor(private persistenceService: ExtensionPersistenceService) {}
```

### 2. Single Responsibility
Each service has one clear responsibility:

```typescript
// ExtensionPersistenceService: Only handles persistence
class ExtensionPersistenceService implements IPersistenceService {
  async saveSession(session: TerminalSessionData): Promise<PersistenceResult>
  async loadSessions(): Promise<TerminalSessionData[]>
}
```

### 3. Interface Segregation
Interfaces are focused and minimal:

```typescript
// Small, focused interface
interface IPersistenceService {
  saveSession(session: TerminalSessionData): Promise<PersistenceResult>;
  loadSessions(): Promise<TerminalSessionData[]>;
  // ... other focused methods
}
```

## Persistence Services

### Extension Persistence
- **Implementation:** `ExtensionPersistenceService`
- **Storage:** VS Code `globalState`
- **Features:**
  - Compression and optimization
  - Retention policy (max 50 sessions)
  - Scrollback size limits (2000 lines)

### WebView Persistence
- **Implementation:** `WebViewPersistenceService`
- **Storage:** Browser `localStorage`
- **Features:**
  - Temporary session storage
  - Smaller limits (20 sessions, 1000 lines)
  - Quick recovery for WebView state

### Factory Pattern
Both services use factory pattern for creation:

```typescript
// Extension context
const persistenceService = createExtensionPersistenceService(context);

// WebView context
const persistenceService = createWebViewPersistenceService();
```

## State Management

### Extension State
- **Implementation:** `ExtensionStateService`
- **Features:**
  - Terminal state tracking
  - Observable state changes
  - Synchronization with WebView

### WebView State
- **Implementation:** `WebViewStateService`
- **Features:**
  - UI state management
  - Local state caching
  - Event propagation

## Message Handling

### Message Protocol
Messages are typed and separated by origin:

```typescript
// Extension messages (Extension → WebView)
interface ExtensionMessage extends BaseMessage {
  command: 'init' | 'output' | 'exit' | ...
}

// WebView messages (WebView → Extension)
interface WebViewMessage extends BaseMessage {
  command: 'input' | 'resize' | 'split' | ...
}
```

### Message Handlers
Each message type has a dedicated handler:

```typescript
class InputMessageHandler implements IMessageHandler<WebViewMessage> {
  readonly command = 'input';

  async handle(message: WebViewMessage): Promise<MessageHandlerResult> {
    // Handle input message
  }
}
```

### Message Dispatchers
- `ExtensionMessageDispatcher` - Extension-side routing
- `WebViewMessageDispatcher` - WebView-side routing

## Migration Guide

### For Existing Code

#### Before (Tightly Coupled)
```typescript
class SecondaryTerminalProvider {
  // Mixed concerns
  private async _handleInput(message: WebviewMessage) {
    // PTY handling + WebView logic mixed
  }

  private async saveSession() {
    // Direct globalState access
    this.context.globalState.update('key', data);
  }
}
```

#### After (Clean Architecture)
```typescript
// Extension layer
class ExtensionTerminalService {
  constructor(
    private persistenceService: IPersistenceService,
    private stateService: IStateService
  ) {}

  async handleInput(terminalId: string, input: string) {
    // Only PTY handling
    this.pty.write(input);
  }
}

// WebView layer
class WebViewTerminalManager {
  constructor(
    private persistenceService: IPersistenceService,
    private messageRouter: IMessageRouter
  ) {}

  handleUserInput(input: string) {
    // Send message to Extension
    this.messageRouter.sendToExtension({
      command: 'input',
      data: input
    });
  }
}
```

## Benefits

### 1. Testability
Each service can be tested in isolation with mocks:

```typescript
const mockPersistence: IPersistenceService = {
  saveSession: jest.fn(),
  loadSessions: jest.fn(),
  // ...
};

const service = new ExtensionTerminalService(mockPersistence);
```

### 2. Maintainability
Clear separation makes code easier to understand and modify.

### 3. Flexibility
Easy to swap implementations (e.g., different storage backends).

### 4. Reduced Coupling
No circular dependencies or tight coupling between layers.

## Next Steps (Future Phases)

### Phase 3: Message Handler Separation
- Extract all message handlers from `SecondaryTerminalProvider`
- Implement handler registry pattern
- Separate Extension and WebView handlers

### Phase 4: Testing and Integration
- Add unit tests for all services
- Integration tests for message flow
- Performance benchmarking

## References

- Issue #223: Clean Architecture Violations
- `ARCHITECTURAL_ANALYSIS_ISSUE_223.md` - Detailed analysis
- `ISSUE_223_CODE_EXAMPLES.md` - Before/after examples
