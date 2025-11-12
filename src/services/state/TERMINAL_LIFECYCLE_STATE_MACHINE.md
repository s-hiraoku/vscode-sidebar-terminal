# Terminal Lifecycle State Machine

## Overview

This document describes the Terminal Lifecycle State Machine implementation that addresses issue #221. The state machine provides centralized, consistent management of terminal lifecycle states across the vscode-sidebar-terminal extension.

## Problem Statement

Previously, terminal lifecycle logic was scattered across 5+ classes without clear state management:
- Creation logic in `TerminalManager`
- Initialization in `SecondaryTerminalProvider`
- Coordination in `TerminalInitializationCoordinator`
- Lifecycle events in `TerminalEventCoordinator`
- WebView lifecycle in `LightweightTerminalWebviewManager`

This fragmentation led to:
- No defined states
- Difficult transition tracking
- Inconsistent error handling
- Inability to query current terminal state
- Potential race conditions

## Solution: State Machine Pattern

The implementation provides a centralized state machine with:

### Terminal Lifecycle States

Seven distinct states representing the terminal lifecycle:

```typescript
enum TerminalLifecycleState {
  Creating,     // Terminal is being created (before initialization)
  Initializing, // Terminal is initializing (spawning process, setting up environment)
  Ready,        // Terminal is ready for use (process running, not active)
  Active,       // Terminal is currently active and receiving user input
  Closing,      // Terminal is in the process of closing
  Closed,       // Terminal has been closed
  Error,        // Terminal encountered an error
}
```

### Valid State Transitions

The state machine enforces valid transitions:

```
Creating → Initializing, Error
Initializing → Ready, Active, Error
Ready → Active, Closing, Error
Active → Ready, Closing, Error
Closing → Closed, Error
Closed → (terminal state, no transitions)
Error → Closing, Closed
```

## Architecture

### Core Components

#### 1. `TerminalLifecycleStateMachine`

Manages the lifecycle state of a single terminal instance.

```typescript
class TerminalLifecycleStateMachine {
  constructor(terminalId: string, initialState?: TerminalLifecycleState, maxHistorySize?: number)

  // State queries
  getCurrentState(): TerminalLifecycleState
  isInState(state: TerminalLifecycleState): boolean
  isInAnyState(states: TerminalLifecycleState[]): boolean

  // Transition validation
  canTransitionTo(targetState: TerminalLifecycleState): boolean
  getValidNextStates(): TerminalLifecycleState[]

  // State transitions
  transition(targetState: TerminalLifecycleState, metadata?: Partial<StateTransitionMetadata>): void
  forceTransition(targetState: TerminalLifecycleState, metadata?: Partial<StateTransitionMetadata>): void

  // Listeners
  addListener(listener: StateChangeListener): () => void
  removeListener(listener: StateChangeListener): boolean
  clearListeners(): void

  // History
  getTransitionHistory(limit?: number): StateTransitionRecord[]
  getLastTransition(): StateTransitionRecord | undefined
  clearHistory(): void

  // Summary
  getStateSummary(): StateSummary

  // Cleanup
  dispose(): void
}
```

#### 2. `TerminalLifecycleStateMachineManager`

Manages multiple terminal state machines centrally.

```typescript
class TerminalLifecycleStateMachineManager {
  // State machine management
  createStateMachine(terminalId: string, initialState?: TerminalLifecycleState): TerminalLifecycleStateMachine
  getStateMachine(terminalId: string): TerminalLifecycleStateMachine | undefined
  getOrCreateStateMachine(terminalId: string, initialState?: TerminalLifecycleState): TerminalLifecycleStateMachine
  removeStateMachine(terminalId: string): boolean

  // State queries
  getCurrentState(terminalId: string): TerminalLifecycleState | undefined
  isTerminalInState(terminalId: string, state: TerminalLifecycleState): boolean
  getTerminalsInState(state: TerminalLifecycleState): string[]

  // Global listeners
  addGlobalListener(listener: StateChangeListener): () => void
  removeGlobalListener(listener: StateChangeListener): boolean
  clearGlobalListeners(): void

  // Bulk operations
  getAllTerminalIds(): string[]
  getAllStateSummaries(): Map<string, StateSummary>
  getStateMachineCount(): number

  // Cleanup
  dispose(): void
}
```

## Usage Examples

### Basic Usage

```typescript
import {
  TerminalLifecycleStateMachine,
  TerminalLifecycleState,
} from './services/state/TerminalLifecycleStateMachine';

// Create a state machine for a terminal
const stateMachine = new TerminalLifecycleStateMachine('terminal-1');

// Transition through states
stateMachine.transition(TerminalLifecycleState.Initializing, {
  reason: 'Starting terminal process',
});

stateMachine.transition(TerminalLifecycleState.Ready, {
  reason: 'Terminal process spawned successfully',
});

stateMachine.transition(TerminalLifecycleState.Active, {
  reason: 'User focused terminal',
});

// Query state
console.log(stateMachine.getCurrentState()); // Active
console.log(stateMachine.isInState(TerminalLifecycleState.Active)); // true
```

### Using the Manager

```typescript
import {
  TerminalLifecycleStateMachineManager,
  TerminalLifecycleState,
} from './services/state/TerminalLifecycleStateMachine';

const manager = new TerminalLifecycleStateMachineManager();

// Create multiple terminal state machines
manager.createStateMachine('term-1');
manager.createStateMachine('term-2');
manager.createStateMachine('term-3');

// Get all terminals in Ready state
const readyTerminals = manager.getTerminalsInState(TerminalLifecycleState.Ready);
console.log(`Ready terminals: ${readyTerminals.join(', ')}`);

// Add global listener for all state changes
manager.addGlobalListener((event) => {
  console.log(
    `Terminal ${event.terminalId}: ${event.previousState} → ${event.newState}`
  );
});
```

### With Transition Metadata

```typescript
const stateMachine = new TerminalLifecycleStateMachine('term-1');

// Transition with metadata
stateMachine.transition(TerminalLifecycleState.Error, {
  reason: 'Process crashed',
  error: new Error('SIGSEGV'),
  data: {
    exitCode: 139,
    signal: 'SIGSEGV',
  },
});

// Retrieve transition history
const history = stateMachine.getTransitionHistory();
const lastTransition = stateMachine.getLastTransition();

console.log('Last transition:', lastTransition?.metadata);
// Output: { reason: 'Process crashed', error: Error, data: {...}, timestamp: Date }
```

### State Change Listeners

```typescript
const stateMachine = new TerminalLifecycleStateMachine('term-1');

// Add listener
const dispose = stateMachine.addListener((event) => {
  console.log(`State changed: ${event.previousState} → ${event.newState}`);
  console.log(`Reason: ${event.metadata.reason}`);

  // Perform actions based on state
  if (event.newState === TerminalLifecycleState.Error) {
    // Handle error state
    showErrorNotification(event.metadata.error);
  } else if (event.newState === TerminalLifecycleState.Closed) {
    // Clean up resources
    cleanupTerminalResources(event.terminalId);
  }
});

// Remove listener later
dispose();
```

## Integration with TerminalManager

### Recommended Integration Points

#### 1. Terminal Creation

```typescript
// In TerminalManager.createTerminal()
private _lifecycleManager = new TerminalLifecycleStateMachineManager();

async createTerminal(options: TerminalOptions): Promise<TerminalInstance> {
  const terminalId = generateTerminalId();

  // Create state machine
  const stateMachine = this._lifecycleManager.createStateMachine(
    terminalId,
    TerminalLifecycleState.Creating
  );

  try {
    // Transition to Initializing
    stateMachine.transition(TerminalLifecycleState.Initializing, {
      reason: 'Spawning terminal process',
    });

    // Create terminal...
    const terminal = await this._spawnTerminal(options);

    // Transition to Ready
    stateMachine.transition(TerminalLifecycleState.Ready, {
      reason: 'Terminal process spawned successfully',
    });

    return terminal;
  } catch (error) {
    // Transition to Error
    stateMachine.transition(TerminalLifecycleState.Error, {
      reason: 'Failed to create terminal',
      error: error as Error,
    });
    throw error;
  }
}
```

#### 2. Terminal Focus

```typescript
// In TerminalManager.focusTerminal()
focusTerminal(terminalId: string): void {
  const stateMachine = this._lifecycleManager.getStateMachine(terminalId);
  if (!stateMachine) return;

  // Transition previously active terminal to Ready
  const activeTerminals = this._lifecycleManager.getTerminalsInState(
    TerminalLifecycleState.Active
  );
  for (const activeId of activeTerminals) {
    if (activeId !== terminalId) {
      const activeSm = this._lifecycleManager.getStateMachine(activeId);
      activeSm?.transition(TerminalLifecycleState.Ready, {
        reason: 'Another terminal focused',
      });
    }
  }

  // Transition focused terminal to Active
  stateMachine.transition(TerminalLifecycleState.Active, {
    reason: 'Terminal focused by user',
  });
}
```

#### 3. Terminal Closure

```typescript
// In TerminalManager.deleteTerminal()
async deleteTerminal(terminalId: string): Promise<DeleteResult> {
  const stateMachine = this._lifecycleManager.getStateMachine(terminalId);
  if (!stateMachine) {
    return { success: false, reason: 'Terminal not found' };
  }

  // Transition to Closing
  stateMachine.transition(TerminalLifecycleState.Closing, {
    reason: 'User requested terminal closure',
  });

  try {
    // Kill terminal process...
    await this._killTerminalProcess(terminalId);

    // Transition to Closed
    stateMachine.transition(TerminalLifecycleState.Closed, {
      reason: 'Terminal process terminated successfully',
    });

    // Clean up state machine
    this._lifecycleManager.removeStateMachine(terminalId);

    return { success: true };
  } catch (error) {
    // Transition to Error
    stateMachine.transition(TerminalLifecycleState.Error, {
      reason: 'Failed to close terminal',
      error: error as Error,
    });
    return { success: false, reason: (error as Error).message };
  }
}
```

#### 4. Global State Monitoring

```typescript
// In TerminalManager constructor
constructor() {
  this._lifecycleManager = new TerminalLifecycleStateMachineManager();

  // Add global listener for all state changes
  this._lifecycleManager.addGlobalListener((event) => {
    log(`[LIFECYCLE] Terminal ${event.terminalId}: ${event.previousState} → ${event.newState}`);

    // Emit state update events for UI synchronization
    this._stateUpdateEmitter.fire({
      terminalId: event.terminalId,
      state: event.newState,
      metadata: event.metadata,
    });

    // Handle special states
    if (event.newState === TerminalLifecycleState.Error) {
      this._handleTerminalError(event.terminalId, event.metadata.error);
    }
  });
}
```

## Benefits

### 1. Clear State Definition

All terminal states are explicitly defined in one place, making the lifecycle clear and understandable.

### 2. Enforced Transitions

Invalid state transitions are prevented at runtime, eliminating a class of bugs related to inconsistent state.

### 3. Transition History

Complete transition history enables debugging and understanding of terminal lifecycle issues.

### 4. Centralized State Management

All state logic is centralized, making it easy to query and modify terminal states consistently.

### 5. Event-Driven Architecture

State change listeners enable UI and other components to react to state changes in a decoupled manner.

### 6. Error Handling

Error states are properly tracked with metadata, making error diagnosis easier.

## Testing

Comprehensive unit tests are provided in:
```
src/test/unit/services/state/TerminalLifecycleStateMachine.test.ts
```

Tests cover:
- State initialization
- Valid and invalid transitions
- Transition metadata
- Transition history
- State change listeners
- Manager operations
- Error handling

Run tests with:
```bash
npm test -- src/test/unit/services/state/TerminalLifecycleStateMachine.test.ts
```

## Future Enhancements

### 1. Integration with EventBus

Publish state changes to the central EventBus for system-wide notification:

```typescript
import { EventBus, createEventType } from '../../core/EventBus';

export const TerminalLifecycleStateChangedEvent = createEventType<StateChangeEvent>(
  'terminal.lifecycle.state.changed'
);

// In state machine
private _eventBus?: EventBus;

public setEventBus(eventBus: EventBus): void {
  this._eventBus = eventBus;
}

private _notifyListeners(event: StateChangeEvent): void {
  // Notify listeners
  for (const listener of this._listeners) {
    listener(event);
  }

  // Publish to EventBus if available
  if (this._eventBus) {
    this._eventBus.publish(TerminalLifecycleStateChangedEvent, event);
  }
}
```

### 2. Integration with ITerminalStateService

Coordinate with the existing state service:

```typescript
import { ITerminalStateService } from './ITerminalStateService';

// Update process state based on lifecycle state
stateMachine.addListener((event) => {
  const stateService = getDI().get(ITerminalStateService);

  if (event.newState === TerminalLifecycleState.Ready ||
      event.newState === TerminalLifecycleState.Active) {
    stateService.setProcessState(event.terminalId, ProcessState.Running);
  } else if (event.newState === TerminalLifecycleState.Error) {
    stateService.setProcessState(event.terminalId, ProcessState.KilledByProcess);
  } else if (event.newState === TerminalLifecycleState.Closed) {
    stateService.unregisterTerminal(event.terminalId);
  }
});
```

### 3. Persistence

Save and restore terminal lifecycle states across sessions:

```typescript
interface PersistedLifecycleState {
  terminalId: string;
  state: TerminalLifecycleState;
  lastTransition?: StateTransitionRecord;
}

// Save state
const state = stateMachine.getCurrentState();
const lastTransition = stateMachine.getLastTransition();
await persistenceService.saveLifecycleState({
  terminalId,
  state,
  lastTransition,
});

// Restore state
const persisted = await persistenceService.loadLifecycleState(terminalId);
if (persisted) {
  stateMachine.forceTransition(persisted.state, {
    reason: 'Restored from session',
  });
}
```

## Migration Guide

For existing code that manages terminal states manually:

### Before

```typescript
// Scattered state management
private _terminals = new Map<string, TerminalInstance>();
private _initializingTerminals = new Set<string>();
private _readyTerminals = new Set<string>();
private _errorTerminals = new Set<string>();

// Manual state tracking
this._initializingTerminals.add(terminalId);
// ... later
this._initializingTerminals.delete(terminalId);
this._readyTerminals.add(terminalId);
```

### After

```typescript
// Centralized state machine
private _lifecycleManager = new TerminalLifecycleStateMachineManager();

// State transitions
const stateMachine = this._lifecycleManager.createStateMachine(terminalId);
stateMachine.transition(TerminalLifecycleState.Initializing);
// ... later
stateMachine.transition(TerminalLifecycleState.Ready);

// Queries
const readyTerminals = this._lifecycleManager.getTerminalsInState(
  TerminalLifecycleState.Ready
);
```

## Conclusion

The Terminal Lifecycle State Machine provides a robust, maintainable solution for managing terminal states throughout their lifecycle. By centralizing state management and enforcing valid transitions, it eliminates a significant source of bugs and makes the codebase more maintainable and understandable.
