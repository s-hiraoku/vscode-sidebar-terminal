# Type-Safe Refactoring Migration Guide

## Overview

This guide helps migrate from legacy message handling to our new type-safe framework. The refactoring eliminates `any` types and provides comprehensive type safety.

## Key Components

### 1. BaseManager (Unified)
**Location**: `src/webview/managers/BaseManager.ts`

**Features**:
- Performance tracking with `ManagerPerformanceTracker`
- Error handling with `ManagerErrorHandler`
- Resource management with `ResourceManager`
- Health status monitoring
- Type-safe logger functions

**Migration**:
```typescript
// Old approach
class MyManager {
  private logger = console.log;

  initialize() {
    // Basic initialization
  }
}

// New approach
class MyManager extends BaseManager {
  constructor() {
    super('MyManager', {
      enableLogging: true,
      enablePerformanceTracking: true,
      enableErrorRecovery: true
    });
  }

  protected async doInitialize(): Promise<void> {
    // Type-safe initialization with automatic performance tracking
  }

  protected doDispose(): void {
    // Automatic resource cleanup
  }
}
```

### 2. TypedMessageHandling
**Location**: `src/webview/utils/TypedMessageHandling.ts`

**Features**:
- Complete elimination of `any` types
- Type-safe message routing with `TypedMessageRouter`
- Validated message data with `MessageDataValidator`
- Performance tracking for message processing
- Automatic error handling and recovery

**Migration**:
```typescript
// Old approach
router.register({
  command: 'terminalCreate',
  handler: (data: any) => {
    console.log('Creating terminal:', data.terminalId);
  }
});

// New approach
import { TypedMessageRouter, TerminalMessageData, MESSAGE_COMMANDS } from './TypedMessageHandling';

const router = new TypedMessageRouter('MyComponent');
router.registerHandler<TerminalMessageData>({
  command: MESSAGE_COMMANDS.TERMINAL_CREATE,
  handler: async (data) => {
    // data.terminalId is type-safe (string)
    console.log('Creating terminal:', data.terminalId);
  },
  validator: MessageDataValidator.createTerminalValidator(logger)
});
```

### 3. Message Types
**Available Message Types**:
- `TerminalMessageData`: Terminal operations
- `SessionMessageData`: Session management
- `ConfigurationMessageData`: Configuration updates
- `StatusMessageData`: Status notifications

**Usage**:
```typescript
import { TerminalMessageData, TypedMessageHandler } from './TypedMessageHandling';

const terminalHandler: TypedMessageHandler<TerminalMessageData> = async (data) => {
  // data.terminalId is guaranteed to be string
  // data.action is optional string
  // data.payload is optional Record<string, unknown>
};
```

### 4. Constants Migration
**Old**: `COMMON_COMMANDS` in MessageHandlingUtils.ts
**New**: `MESSAGE_COMMANDS` in TypedMessageHandling.ts

```typescript
// Old
import { COMMON_COMMANDS } from './MessageHandlingUtils';
COMMON_COMMANDS.CREATE_TERMINAL

// New
import { MESSAGE_COMMANDS } from './TypedMessageHandling';
MESSAGE_COMMANDS.TERMINAL_CREATE
```

## Migration Steps

### Step 1: Update Manager Base Classes
1. Extend `BaseManager` instead of custom base classes
2. Implement `doInitialize()` and `doDispose()` abstract methods
3. Use provided logger and error handling utilities

### Step 2: Migrate Message Handling
1. Replace `MessageRouter` with `TypedMessageRouter`
2. Define specific message data types
3. Add validators for critical message types
4. Update command constants

### Step 3: Type Safety Improvements
1. Replace `any` types with specific interfaces
2. Use `unknown` for truly unknown data
3. Implement proper type guards where needed
4. Add validation for external data

### Step 4: Testing
1. Update test mocks to use new interfaces
2. Add tests for type validation
3. Verify error handling scenarios
4. Test performance tracking

## Benefits

### Type Safety
- Eliminates runtime type errors
- Provides IDE autocompletion
- Catches errors at compile time
- Improves code maintainability

### Performance
- Automatic performance tracking
- Error counting and reporting
- Resource usage monitoring
- Initialization time tracking

### Maintainability
- Consistent error handling patterns
- Centralized logging utilities
- Automated resource cleanup
- Health status monitoring

### Developer Experience
- Clear migration path
- Comprehensive type definitions
- Detailed error messages
- Performance metrics

## Example: Complete Migration

**Before**:
```typescript
export class OldTerminalManager {
  private handlers = new Map<string, (data: any) => void>();

  constructor(private vscode: any) {
    this.setupHandlers();
  }

  private setupHandlers() {
    this.handlers.set('createTerminal', (data: any) => {
      console.log('Creating:', data.terminalId);
      // No validation, no error handling
    });
  }

  public handleMessage(command: string, data: any) {
    const handler = this.handlers.get(command);
    if (handler) {
      handler(data);
    }
  }
}
```

**After**:
```typescript
import { BaseManager, ManagerInitOptions } from './BaseManager';
import {
  TypedMessageRouter,
  TerminalMessageData,
  MESSAGE_COMMANDS,
  MessageDataValidator,
  VSCodeWebviewAPI
} from '../utils/TypedMessageHandling';

export class ModernTerminalManager extends BaseManager {
  private messageRouter: TypedMessageRouter;

  constructor(
    private vscodeApi: VSCodeWebviewAPI,
    options: ManagerInitOptions = {}
  ) {
    super('TerminalManager', {
      enableLogging: true,
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
      ...options
    });

    this.messageRouter = new TypedMessageRouter('TerminalManager', this.logger);
  }

  protected async doInitialize(): Promise<void> {
    this.registerMessageHandlers();
  }

  protected doDispose(): void {
    this.messageRouter.clearAllHandlers();
  }

  private registerMessageHandlers(): void {
    this.messageRouter.registerHandler<TerminalMessageData>({
      command: MESSAGE_COMMANDS.TERMINAL_CREATE,
      handler: async (data) => {
        // data.terminalId is type-safe
        this.logger(`Creating terminal: ${data.terminalId}`);
        await this.createTerminal(data);
      },
      validator: MessageDataValidator.createTerminalValidator(this.logger),
      description: 'Creates a new terminal instance'
    });
  }

  public async handleMessage(command: string, data: unknown): Promise<void> {
    const result = await this.messageRouter.processMessage(command, data);
    if (!result.success) {
      this.logger(`Message processing failed: ${result.error?.message}`);
    }
  }

  private async createTerminal(data: TerminalMessageData): Promise<void> {
    // Implementation with full type safety
    return this.executeWithErrorHandling(
      async () => {
        // Type-safe terminal creation logic
      },
      'createTerminal'
    );
  }

  public getHealthStatus() {
    return {
      ...super.getHealthStatus(),
      registeredCommands: this.messageRouter.getRegisteredCommands()
    };
  }
}
```

## Next Steps

1. **Gradual Migration**: Start with new features, then migrate existing code
2. **Testing**: Comprehensive test coverage for all type-safe components
3. **Documentation**: Update component documentation with new patterns
4. **Performance**: Monitor performance improvements from type safety
5. **Maintenance**: Regular updates to type definitions as requirements evolve

This migration provides a solid foundation for maintainable, type-safe code that will scale with the project's growth.