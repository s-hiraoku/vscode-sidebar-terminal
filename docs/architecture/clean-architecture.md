# Clean Architecture Implementation

This document describes the Clean Architecture refactoring implemented for the vscode-sidebar-terminal extension.

## Overview

The codebase has been refactored to follow Clean Architecture principles, providing clear separation between Extension and WebView layers. This separation improves testability, maintainability, and allows for independent development of each layer.

## Architecture Layers

### Communication Layer (`src/communication/`)

The Communication Layer provides a clear contract for data exchange between Extension and WebView layers.

#### Components:

1. **Protocols** (`src/communication/protocols/`)
   - `MessageProtocol.ts`: Defines message types and protocols
   - Separates Extension-to-WebView and WebView-to-Extension commands

2. **DTOs** (`src/communication/dto/`)
   - `TerminalDTO.ts`: Terminal-related data transfer objects
   - `SettingsDTO.ts`: Settings-related data transfer objects
   - `SessionDTO.ts`: Session persistence data transfer objects

3. **Interfaces** (`src/communication/interfaces/`)
   - `ICommunicationBridge.ts`: Bidirectional communication interface
   - `IPersistencePort.ts`: Persistence operation interface

### Extension Layer (`src/extension/`)

The Extension Layer handles VS Code API interactions, PTY process management, and extension-side storage.

#### Components:

1. **Persistence** (`src/extension/persistence/`)
   - `ExtensionPersistenceService.ts`: Implements persistence using VS Code's globalState and workspace storage
   - Handles session save/restore operations
   - Manages storage health and cleanup

2. **Bridge** (`src/extension/bridge/`)
   - `ExtensionMessageBridge.ts`: Manages Extension-to-WebView communication
   - Implements message routing and handler registration
   - Provides type-safe message passing

### WebView Layer (`src/webview/`)

The WebView Layer handles terminal rendering with xterm.js, user input, and WebView-side storage.

#### Components:

1. **Persistence** (`src/webview/persistence/`)
   - `WebViewPersistenceService.ts`: Implements persistence using localStorage
   - Provides temporary state management
   - Handles local session caching

2. **Bridge** (`src/webview/bridge/`)
   - `WebViewMessageBridge.ts`: Manages WebView-to-Extension communication
   - Implements message handling and routing
   - Provides type-safe message passing

## Key Benefits

### 1. Clear Separation of Concerns

- **Extension Layer**: Handles VS Code API, PTY processes, extension storage
- **WebView Layer**: Handles terminal rendering, user input, local storage
- **Communication Layer**: Provides clear contracts for data exchange

### 2. Independent Testing

- Extension code can be tested without WebView dependencies
- WebView code can be tested independently
- Communication layer provides mockable interfaces

### 3. Type Safety

- DTOs provide clear data contracts
- Message protocols define valid commands
- Interfaces ensure implementation compliance

### 4. Maintainability

- Each layer has focused responsibilities
- Changes in one layer don't affect others
- Clear dependency flow

## Message Flow

### Extension to WebView

```
Extension Service → ExtensionMessageBridge → WebView
                         ↓
                    MessageProtocol
                         ↓
                    TerminalDTO/SettingsDTO
```

### WebView to Extension

```
WebView Component → WebViewMessageBridge → Extension
                         ↓
                    MessageProtocol
                         ↓
                    TerminalDTO/SettingsDTO
```

## Persistence Architecture

### Extension Persistence

- Uses VS Code's `globalState` and `workspaceState`
- Handles terminal session data
- Implements retention policies (7 days)
- Provides storage health checks

### WebView Persistence

- Uses browser `localStorage`
- Provides temporary state caching
- Implements shorter retention (1 day)
- Complements extension persistence

## Migration Guide

### For Developers

#### Using the Communication Layer

```typescript
// Import DTOs and interfaces
import {
  TerminalInfoDTO,
  ExtensionToWebViewMessage,
  IExtensionCommunicationBridge,
} from './communication';

// Create and send message
const message: ExtensionToWebViewMessage = {
  command: 'terminalCreated',
  data: terminalInfo,
  timestamp: Date.now(),
};

bridge.sendToWebView(message);
```

#### Implementing Persistence

```typescript
// Extension side
import { ExtensionPersistenceService } from './extension';

const persistenceService = new ExtensionPersistenceService(context);
const result = await persistenceService.saveSession({
  force: false,
  reason: 'manual',
  timestamp: Date.now(),
});
```

#### Registering Message Handlers

```typescript
// Register handler in Extension
bridge.registerHandler('input', async (message) => {
  const inputDTO = message.data as TerminalInputDTO;
  // Handle input
  return { success: true, handledBy: 'InputHandler' };
});
```

## Testing Strategy

### Unit Tests

- Test each layer independently
- Mock communication bridges
- Test DTOs for data validation

### Integration Tests

- Test message flow between layers
- Verify persistence operations
- Test error handling

### E2E Tests

- Test complete user workflows
- Verify session restoration
- Test terminal operations

## Future Enhancements

1. **Message Queue Optimization**
   - Implement priority-based message processing
   - Add message batching for performance

2. **Persistence Enhancements**
   - Add compression for session data
   - Implement incremental saves
   - Add backup/restore functionality

3. **Communication Protocol Evolution**
   - Version management for protocol changes
   - Backward compatibility support
   - Protocol negotiation

## References

- Issue #223: Clean Architecture Refactoring
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [VS Code Extension API](https://code.visualstudio.com/api)
