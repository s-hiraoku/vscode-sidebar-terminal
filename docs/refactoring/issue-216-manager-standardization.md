# Issue #216: Manager Pattern Standardization

## Overview

This document describes the standardization of Manager pattern implementation across the codebase to ensure consistent dependency injection, lifecycle management, and disposable resource handling.

## Problem Statement

The codebase contains 38+ Manager classes with fragmented dependency injection approaches:
- 22 managers use late-binding via `setCoordinator()`
- 8 managers use constructor injection
- Some managers implement both patterns
- Inconsistent `initialize()` and `dispose()` lifecycle management

## Solution

Implement a standardized approach using constructor-based dependency injection backed by an abstract `BaseManager` class that explicitly implements `IDisposable`.

## Changes Made

### 1. BaseManager Enhancement

**Location**: `src/webview/managers/BaseManager.ts`

**Changes**:
- ✅ Explicitly implements `IDisposable` interface
- ✅ Enforces consistent lifecycle: instantiation → initialization → disposal
- ✅ Provides performance tracking and error handling utilities

**Key Features**:
```typescript
export abstract class BaseManager extends ResourceManager implements IDisposable {
  // Enforced abstract methods
  protected abstract doInitialize(): Promise<void> | void;
  protected abstract doDispose(): void;

  // Standardized lifecycle methods
  public async initialize(): Promise<void>;
  public dispose(): void;

  // Performance and health monitoring
  public getPerformanceMetrics(): ManagerPerformanceMetrics;
  public getHealthStatus(): ManagerHealthStatus;
}
```

### 2. IDisposable Interface

**Location**: `src/webview/utils/DOMManager.ts`

```typescript
export interface IDisposable {
  dispose(): void;
}
```

All managers must implement this interface to ensure proper resource cleanup.

## Migration Pattern

### Before (Late-binding pattern)

```typescript
export class ProfileManager implements IProfileManager {
  private coordinator: IManagerCoordinator | null = null;

  constructor() {
    this.setupProfileSelectorContainer();
  }

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
  }

  public async initialize(): Promise<void> {
    if (!this.coordinator) {
      console.error('ProfileManager: Coordinator not set');
      return;
    }
    // ... initialization logic
  }

  public dispose(): void {
    // ... cleanup logic
  }
}
```

### After (Constructor injection pattern)

```typescript
export class ProfileManager extends BaseManager implements IProfileManager {
  constructor(
    private readonly coordinator: IManagerCoordinator
  ) {
    super('ProfileManager', {
      enableLogging: true,
      enablePerformanceTracking: true,
      enableErrorRecovery: true
    });
  }

  protected async doInitialize(): Promise<void> {
    this.setupProfileSelectorContainer();
    await this.refreshProfiles();
    // ... initialization logic
  }

  protected doDispose(): void {
    // ... cleanup logic
  }
}
```

## Real-World Example: ScrollbackManager Migration

### Before Migration

```typescript
export class ScrollbackManager implements IScrollbackManager {
  private serializeAddons: Map<string, SerializeAddon> = new Map();
  private terminals: Map<string, Terminal> = new Map();

  // No constructor - stateless initialization

  public dispose(): void {
    this.terminals.clear();
    this.serializeAddons.clear();
    terminalLogger.info('🧹 ScrollbackManager: Disposed');
  }
}
```

### After Migration (✅ Completed in Phase 2)

```typescript
export class ScrollbackManager extends BaseManager implements IScrollbackManager {
  private serializeAddons: Map<string, SerializeAddon> = new Map();
  private terminals: Map<string, Terminal> = new Map();

  constructor() {
    super('ScrollbackManager', {
      enableLogging: false, // Use terminalLogger instead
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });
  }

  protected doInitialize(): void {
    // ScrollbackManager is stateless and ready immediately
    this.logger('ScrollbackManager initialized');
  }

  protected doDispose(): void {
    this.terminals.clear();
    this.serializeAddons.clear();
    terminalLogger.info('🧹 ScrollbackManager: Disposed');
  }
}
```

### Benefits Gained

1. **Performance Tracking**: Automatic tracking of operations and initialization time
2. **Health Monitoring**: Built-in health status and metrics
3. **Error Recovery**: Centralized error handling with configurable recovery
4. **Consistent Lifecycle**: Standardized initialization and disposal
5. **Type Safety**: Explicit IDisposable implementation

### Test Coverage

See: `src/test/unit/webview/managers/ScrollbackManager.BaseManager.test.ts`

## Phase 3 Examples: Constructor Injection Managers

### SimplePersistenceManager Migration

**Before**:
```typescript
export class SimplePersistenceManager implements ISimplePersistenceManager {
  constructor(vscodeApi: any) {
    this.vscodeApi = vscodeApi;
    // initialization logic
  }
  // No dispose method
}
```

**After** (✅ Completed in Phase 3):
```typescript
export class SimplePersistenceManager extends BaseManager implements ISimplePersistenceManager {
  constructor(vscodeApi: any) {
    super('SimplePersistenceManager', {
      enableLogging: false,
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });
    this.vscodeApi = vscodeApi;
  }

  protected doInitialize(): void {
    this.logger('SimplePersistenceManager initialized');
  }

  protected doDispose(): void {
    if (this.saveDebouncer) {
      this.saveDebouncer.cancel?.();
    }
    log('🧹 SimplePersistenceManager disposed');
  }
}
```

### TerminalEventManager Migration

**Before**:
```typescript
export class TerminalEventManager {
  constructor(coordinator: IManagerCoordinator, eventRegistry: EventHandlerRegistry) {
    this.coordinator = coordinator;
    this.eventRegistry = eventRegistry;
  }

  public dispose(): void {
    terminalLogger.info('TerminalEventManager disposed');
  }
}
```

**After** (✅ Completed in Phase 3):
```typescript
export class TerminalEventManager extends BaseManager {
  constructor(coordinator: IManagerCoordinator, eventRegistry: EventHandlerRegistry) {
    super('TerminalEventManager', {
      enableLogging: false,
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });
    this.coordinator = coordinator;
    this.eventRegistry = eventRegistry;
  }

  protected doInitialize(): void {
    this.logger('TerminalEventManager initialized');
    terminalLogger.info('✅ TerminalEventManager ready');
  }

  protected doDispose(): void {
    terminalLogger.info('🧹 TerminalEventManager disposed');
  }
}
```

### Key Pattern: Constructor Injection Already Works

Phase 3 demonstrates that managers already using constructor injection can be easily migrated to BaseManager:
1. Add `extends BaseManager` to class declaration
2. Call `super()` at the beginning of constructor
3. Move initialization logic to `doInitialize()`
4. Convert `dispose()` to `protected doDispose()`
5. Gain all BaseManager benefits (metrics, health monitoring, error recovery)

### Test Coverage

- `src/test/unit/webview/managers/Phase3.Migrations.test.ts`
- Comprehensive integration tests for both managers
- Constructor injection pattern verification
- BaseManager lifecycle enforcement tests

## Phase 4 Example: Eliminating Late-Binding Pattern

### DisplayModeManager Migration

**Before**:
```typescript
export class DisplayModeManager extends BaseManager implements IDisplayModeManager {
  private coordinator: IManagerCoordinator | null = null;

  constructor() {
    super('DisplayModeManager', { /* options */ });
  }

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    this.log('Coordinator set');
  }

  protected doInitialize(): void {
    // Initialization logic
  }
}

// Usage (late-binding)
const manager = new DisplayModeManager();
manager.setCoordinator(this);
manager.initialize();
```

**After** (✅ Completed in Phase 4):
```typescript
export class DisplayModeManager extends BaseManager implements IDisplayModeManager {
  private readonly coordinator: IManagerCoordinator;

  constructor(coordinator: IManagerCoordinator) {
    super('DisplayModeManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });
    this.coordinator = coordinator;
  }

  protected doInitialize(): void {
    // Initialization logic - coordinator already available
  }
}

// Usage (constructor injection)
const manager = new DisplayModeManager(this);
manager.initialize();
```

### Key Improvements in Phase 4

1. **Eliminated Late-Binding**: Removed `setCoordinator()` method entirely
2. **Type Safety**: Coordinator is `readonly` and required at construction
3. **No Null Checks**: Coordinator is guaranteed to exist, eliminating `| null` checks
4. **Interface Cleanup**: Removed `setCoordinator()` from `IDisplayModeManager` interface
5. **Caller Simplification**: Single-step instantiation instead of two-step pattern

### Test Coverage

- `src/test/unit/webview/managers/Phase4.Migrations.test.ts`
- Late-binding elimination verification
- Constructor injection pattern enforcement
- Independent manager verification (UIManager)

## Phase 5 Examples: Terminal Managers

### TerminalContainerManager Migration

**Before**:
```typescript
export class TerminalContainerManager extends BaseManager implements ITerminalContainerManager {
  private coordinator: IManagerCoordinator | null = null;

  constructor() {
    super('TerminalContainerManager', { /* options */ });
  }

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    this.log('Coordinator set');
  }
}

// Usage (late-binding)
const manager = new TerminalContainerManager();
manager.setCoordinator(this);
manager.initialize();
```

**After** (✅ Completed in Phase 5):
```typescript
export class TerminalContainerManager extends BaseManager implements ITerminalContainerManager {
  private readonly coordinator: IManagerCoordinator;

  constructor(coordinator: IManagerCoordinator) {
    super('TerminalContainerManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });
    this.coordinator = coordinator;
  }

  protected doInitialize(): void {
    this.log('Initializing TerminalContainerManager');
    this.discoverExistingContainers();
    this.log('TerminalContainerManager initialized successfully');
  }

  protected doDispose(): void {
    this.containerCache.clear();
    this.containerModes.clear();
    this.splitWrapperCache.clear();
    this.splitResizers.clear();
  }
}

// Usage (constructor injection)
const manager = new TerminalContainerManager(this);
manager.initialize();
```

### TerminalLinkManager Migration

**Before**:
```typescript
export class TerminalLinkManager {
  private readonly coordinator: IManagerCoordinator;

  constructor(coordinator: IManagerCoordinator) {
    this.coordinator = coordinator;
  }

  public dispose(): void {
    this.linkProviderDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    this.linkProviderDisposables.clear();
  }
}
```

**After** (✅ Completed in Phase 5):
```typescript
export class TerminalLinkManager extends BaseManager {
  private readonly coordinator: IManagerCoordinator;

  constructor(coordinator: IManagerCoordinator) {
    super('TerminalLinkManager', {
      enableLogging: false,
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });
    this.coordinator = coordinator;
  }

  protected doInitialize(): void {
    this.logger('TerminalLinkManager initialized');
    terminalLogger.info('✅ TerminalLinkManager ready');
  }

  protected doDispose(): void {
    this.linkProviderDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    this.linkProviderDisposables.clear();
    terminalLogger.info('🧹 TerminalLinkManager disposed');
  }
}
```

### Key Pattern: Terminal Managers with Complex State

Phase 5 demonstrates that terminal managers with complex DOM state can be successfully migrated:
1. Managers already extending BaseManager just need `setCoordinator()` removal
2. Constructor injection makes coordinator dependency explicit and required
3. Complex cleanup logic moves cleanly to `doDispose()`
4. BaseManager provides performance tracking and health monitoring for free
5. No null checks needed for coordinator throughout the manager

### Test Coverage

- `src/test/unit/webview/managers/Phase5.Migrations.test.ts`
- Comprehensive integration tests for both managers
- Constructor injection pattern verification
- BaseManager lifecycle enforcement tests
- Multi-instance coordinator verification

## Benefits

1. **Type Safety**: Coordinators are required at construction, eliminating null checks
2. **Consistent Lifecycle**: All managers follow the same initialization/disposal pattern
3. **Better Error Handling**: Centralized error handling and recovery
4. **Performance Monitoring**: Built-in performance tracking and health monitoring
5. **Resource Management**: Automatic resource cleanup via `ResourceManager`
6. **Testability**: Easier to mock dependencies with constructor injection

## ESLint Rules

To prevent regression, the following ESLint rules will be added:

### Rule: `require-base-manager-extension`

**Purpose**: Ensure all Manager classes extend `BaseManager`

```typescript
// ❌ Bad
export class MyManager implements IMyManager {
  dispose() { }
}

// ✅ Good
export class MyManager extends BaseManager implements IMyManager {
  protected doDispose() { }
}
```

### Rule: `no-late-binding-coordinator`

**Purpose**: Prevent use of `setCoordinator()` pattern

```typescript
// ❌ Bad
public setCoordinator(coordinator: IManagerCoordinator): void {
  this.coordinator = coordinator;
}

// ✅ Good
constructor(private readonly coordinator: IManagerCoordinator) {
  super('ManagerName');
}
```

### Rule: `require-dispose-implementation`

**Purpose**: Ensure all managers implement proper disposal

```typescript
// ❌ Bad
export class MyManager {
  // No dispose method
}

// ✅ Good
export class MyManager extends BaseManager {
  protected doDispose() {
    // Cleanup logic
  }
}
```

## Migration Strategy

Given the scope (38+ managers), migration will be performed in phases:

### Phase 1: Foundation (✅ Complete)
- ✅ Update `BaseManager` to implement `IDisposable`
- ✅ Create migration guide
- ✅ Add ESLint rules
- ✅ Create example migration

### Phase 2: Example Migration (✅ Complete)
- ✅ Migrate `ScrollbackManager` to BaseManager
- ✅ Add unit tests for ScrollbackManager migration
- ✅ Document real-world migration example
- ⏳ Migrate `ProfileManager` (requires coordinator pattern changes)
- ⏳ Migrate `ConfigManager`
- ⏳ Migrate `HeaderManager`

### Phase 3: Independent Managers (✅ Complete)
- ✅ Migrate `SimplePersistenceManager` to BaseManager
- ✅ Migrate `TerminalEventManager` to BaseManager (constructor injection already in place)
- ✅ Add comprehensive Phase 3 integration tests
- ✅ Verify TerminalAddonManager (stateless utility, no migration needed)

### Phase 4: Display & UI Managers (✅ Complete)
- ✅ Migrate `DisplayModeManager` to constructor injection (removed setCoordinator)
- ✅ Verify `UIManager` (already extends BaseManager, no coordinator dependency)
- ✅ Update all callers (LightweightTerminalWebviewManager, tests)
- ✅ Add comprehensive Phase 4 integration tests
- ✅ Document late-binding elimination pattern
- **Progress**: 6/38 managers migrated (16% complete)

### Phase 5: Terminal Managers (✅ Complete)
- ✅ Migrate `TerminalContainerManager` to constructor injection (removed setCoordinator)
- ✅ Migrate `TerminalLinkManager` to BaseManager (already had constructor injection)
- ✅ Update all callers (LightweightTerminalWebviewManager, tests)
- ✅ Add comprehensive Phase 5 integration tests
- ✅ Verify TerminalAddonManager (stateless utility, no migration needed)
- **Progress**: 8/38 managers migrated (21% complete)

### Phase 6: Service & Utility Managers
- Migrate service managers
- Migrate utility managers
- Final cleanup and testing

## Testing Requirements

1. **Unit Tests**: Each migrated manager must have unit tests covering:
   - Initialization
   - Disposal
   - Coordinator dependency
   - Error handling

2. **Integration Tests**: Test manager interactions:
   - Manager coordinator integration
   - Lifecycle management
   - Resource cleanup

3. **E2E Tests**: Ensure full system functionality:
   - All managers initialize correctly
   - No memory leaks
   - Proper error recovery

## Acceptance Criteria

- ✅ `BaseManager` explicitly implements `IDisposable`
- ✅ ESLint rules prevent regression (skeleton in place)
- ✅ Unit tests for `BaseManager` functionality
- ✅ At least one complete manager migration example (ScrollbackManager)
- ⏳ All tests pass (unit, integration, E2E)
- ✅ Documentation updated

## Timeline

- **Phase 1**: 1 day (Foundation) - ✅ Complete
- **Phase 2**: 1 day (Example Migration) - ✅ Complete
- **Phase 3**: 1-2 days (Core Managers with coordinator) - Next
- **Phase 4**: 1 day (Display & UI)
- **Phase 5**: 1 day (Terminal Managers)
- **Phase 6**: 1 day (Service & Utility)

**Total Estimate**: 4-6 days (2 days completed)

## Related Files

- `src/webview/managers/BaseManager.ts` - Base manager implementation
- `src/webview/utils/DOMManager.ts` - IDisposable interface
- `src/webview/interfaces/ManagerInterfaces.ts` - Manager interfaces
- `.eslintrc.js` - ESLint rules (to be added)

## References

- [Issue #216](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/216)
- TypeScript Dependency Injection patterns
- VS Code extension best practices
