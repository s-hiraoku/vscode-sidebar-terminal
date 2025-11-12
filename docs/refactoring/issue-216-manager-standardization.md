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
- ⏳ Add ESLint rules
- ⏳ Create example migration

### Phase 2: Core Managers (Next)
- Migrate `ProfileManager`
- Migrate `ConfigManager`
- Migrate `HeaderManager`
- Migrate `ScrollbackManager`

### Phase 3: Display & UI Managers
- Update `DisplayModeManager` (already extends BaseManager)
- Update `UIManager` (already extends BaseManager)
- Migrate remaining UI managers

### Phase 4: Terminal Managers
- Update `TerminalContainerManager` (already extends BaseManager)
- Migrate `TerminalEventManager`
- Migrate `TerminalAddonManager`
- Migrate remaining terminal managers

### Phase 5: Service & Utility Managers
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
- ⏳ ESLint rules prevent regression
- ⏳ Unit tests for `BaseManager` functionality
- ⏳ At least one complete manager migration example
- ⏳ All tests pass (unit, integration, E2E)
- ⏳ Documentation updated

## Timeline

- **Phase 1**: 1 day (Foundation) - ✅ Complete
- **Phase 2**: 1 day (Core Managers) - Next
- **Phase 3**: 1 day (Display & UI)
- **Phase 4**: 1 day (Terminal Managers)
- **Phase 5**: 1 day (Service & Utility)

**Total Estimate**: 3-5 days

## Related Files

- `src/webview/managers/BaseManager.ts` - Base manager implementation
- `src/webview/utils/DOMManager.ts` - IDisposable interface
- `src/webview/interfaces/ManagerInterfaces.ts` - Manager interfaces
- `.eslintrc.js` - ESLint rules (to be added)

## References

- [Issue #216](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/216)
- TypeScript Dependency Injection patterns
- VS Code extension best practices
