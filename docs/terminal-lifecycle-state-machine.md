# Terminal Lifecycle State Machine

## Overview

The Terminal Lifecycle State Machine provides centralized state management for terminal lifecycle events, addressing the fragmented state management previously scattered across multiple classes.

## Problem Statement

Prior to this implementation, terminal lifecycle management was fragmented across five separate classes:
- `TerminalManager`: Creation logic
- `SecondaryTerminalProvider`: Initialization
- `TerminalInitializationCoordinator`: Coordination
- `TerminalEventCoordinator`: Lifecycle events
- `LightweightTerminalWebviewManager`: WebView management

This fragmentation led to:
- Undefined lifecycle states
- Difficulty tracking state transitions
- Inconsistent error handling
- Inability to query current terminal state
- Potential race conditions during rapid state changes

## Solution

The `TerminalLifecycleStateMachine` class provides:
- **Centralized state tracking** using a Map structure
- **Enforced valid transitions** with validation
- **Transition history** for debugging (configurable limit)
- **State change listeners** for UI synchronization
- **Validation** preventing invalid state transitions

## State Definitions

### State Flow

```
Creating → Initializing → Ready → Active ⇄ Inactive → Closing → Closed
            ↓              ↓         ↓         ↓         ↓
            └──────────────→ Error ←──────────┘
```

### States

| State | Description |
|-------|-------------|
| `Creating` | Terminal is being created (PTY process starting) |
| `Initializing` | Terminal PTY created, initializing xterm.js and UI |
| `Ready` | Terminal fully initialized and ready for use |
| `Active` | Terminal is active (user is interacting) |
| `Inactive` | Terminal exists but is not currently active |
| `Closing` | Terminal is being closed (cleanup in progress) |
| `Closed` | Terminal has been closed and resources released |
| `Error` | Terminal encountered an error |

## Valid State Transitions

| From State | Valid Next States |
|-----------|-------------------|
| `Creating` | `Initializing`, `Error`, `Closed` |
| `Initializing` | `Ready`, `Error`, `Closing` |
| `Ready` | `Active`, `Inactive`, `Closing`, `Error` |
| `Active` | `Inactive`, `Closing`, `Error` |
| `Inactive` | `Active`, `Closing`, `Error` |
| `Closing` | `Closed`, `Error` |
| `Closed` | _(no transitions allowed)_ |
| `Error` | `Closing`, `Closed` |

## Usage

### Initialization

```typescript
import { TerminalLifecycleStateMachine } from './services/terminal/TerminalLifecycleStateMachine';

// Create state machine (default: keep 50 transitions per terminal)
const stateMachine = new TerminalLifecycleStateMachine();

// Or with custom history limit
const stateMachine = new TerminalLifecycleStateMachine(100);
```

### Basic Operations

```typescript
// Initialize a new terminal
stateMachine.initializeTerminal('terminal-1', {
  name: 'Terminal 1',
  number: 1
});

// Transition to next state
stateMachine.transition(
  'terminal-1',
  TerminalLifecycleState.Initializing,
  'PTY process started'
);

// Transition to error (always allowed except from Closed)
stateMachine.transitionToError(
  'terminal-1',
  'PTY creation failed',
  { errorCode: 500 }
);

// Check current state
const state = stateMachine.getState('terminal-1');
console.log(state); // 'error'

// Check if transition is valid
const canTransition = stateMachine.canTransitionTo(
  'terminal-1',
  TerminalLifecycleState.Ready
);
```

### History and Debugging

```typescript
// Get transition history
const history = stateMachine.getHistory('terminal-1');
history.forEach(transition => {
  console.log(`${transition.fromState} → ${transition.toState}`);
  console.log(`  Reason: ${transition.reason}`);
  console.log(`  Time: ${transition.timestamp}`);
});

// Get all terminals in specific state
const activeTerminals = stateMachine.getTerminalsInState(
  TerminalLifecycleState.Active
);

// Get state counts
const counts = stateMachine.getStateCounts();
console.log(`Active: ${counts.active}, Ready: ${counts.ready}`);

// Get debug information
const debugInfo = stateMachine.getDebugInfo();
console.log(JSON.stringify(debugInfo, null, 2));
```

### Event Listening

```typescript
// Listen to state changes
stateMachine.onStateChange((transition) => {
  console.log(`Terminal ${transition.terminalId} changed state`);
  console.log(`  ${transition.fromState} → ${transition.toState}`);
  console.log(`  Reason: ${transition.reason}`);
});
```

### Cleanup

```typescript
// Remove terminal after it's closed
if (stateMachine.getState('terminal-1') === TerminalLifecycleState.Closed) {
  stateMachine.removeTerminal('terminal-1');
}

// Dispose when done
stateMachine.dispose();
```

## Integration with TerminalStateManagementService

The state machine is integrated into `TerminalStateManagementService` and automatically manages lifecycle states:

```typescript
// The service automatically manages lifecycle states
const service = new TerminalStateManagementService();

// Adding terminal initializes it in Creating state
service.addTerminal(terminal);

// Setting active transitions to Active state
service.setActiveTerminal('terminal-1');

// Removing terminal transitions to Closing → Closed
service.removeTerminal('terminal-1');

// Access lifecycle methods
const lifecycleState = service.getLifecycleState('terminal-1');
const history = service.getLifecycleHistory('terminal-1');
const debugInfo = service.getLifecycleDebugInfo();
```

## API Reference

### Constructor

```typescript
constructor(maxHistoryPerTerminal?: number = 50)
```

### Methods

#### State Management

- `initializeTerminal(terminalId: string, metadata?: Record<string, unknown>): boolean`
- `transition(terminalId: string, toState: TerminalLifecycleState, reason?: string, metadata?: Record<string, unknown>): boolean`
- `transitionToError(terminalId: string, reason: string, metadata?: Record<string, unknown>): boolean`

#### State Queries

- `getState(terminalId: string): TerminalLifecycleState | undefined`
- `isInState(terminalId: string, state: TerminalLifecycleState): boolean`
- `canTransitionTo(terminalId: string, toState: TerminalLifecycleState): boolean`
- `hasTerminal(terminalId: string): boolean`

#### History and Analysis

- `getHistory(terminalId: string): StateTransition[]`
- `getTerminalsInState(state: TerminalLifecycleState): string[]`
- `getStateCounts(): Record<TerminalLifecycleState, number>`
- `getAllStates(): Map<string, TerminalLifecycleState>`
- `getDebugInfo(): { totalTerminals, stateCounts, terminals }`

#### Cleanup

- `removeTerminal(terminalId: string): boolean`
- `clear(): void`
- `dispose(): void`

### Events

- `onStateChange: Event<StateTransition>`

### Types

```typescript
enum TerminalLifecycleState {
  Creating = 'creating',
  Initializing = 'initializing',
  Ready = 'ready',
  Active = 'active',
  Inactive = 'inactive',
  Closing = 'closing',
  Closed = 'closed',
  Error = 'error',
}

interface StateTransition {
  terminalId: string;
  fromState: TerminalLifecycleState;
  toState: TerminalLifecycleState;
  timestamp: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}
```

## Benefits

### 1. Clear State Visibility
Always know the exact state of any terminal at any time.

### 2. Race Condition Prevention
State transitions are validated and atomic, preventing invalid states.

### 3. Improved Error Handling
Error states are explicitly tracked with reasons and metadata.

### 4. Debugging Support
Full transition history for troubleshooting and analysis.

### 5. UI Synchronization
Event-based notifications for state changes enable reactive UI updates.

### 6. Future Extensibility
Easy to add new states or modify transition rules.

## Testing

Comprehensive unit tests are provided in:
- `src/test/unit/services/terminal/TerminalLifecycleStateMachine.test.ts`

Run tests with:
```bash
npm test -- --testPathPattern=TerminalLifecycleStateMachine.test.ts
```

## Related Issues

- Issue #221: [Refactoring][P1] Implement Terminal Lifecycle State Machine
- Issue #213: Related terminal management improvements

## Future Enhancements

1. **State Persistence**: Save state to disk for crash recovery
2. **State-based Policies**: Different behavior based on current state
3. **Performance Metrics**: Track time spent in each state
4. **State Visualization**: Debug UI showing state transitions
5. **State Snapshots**: Save/restore entire state machine state

## Implementation Details

### Files

- `src/services/terminal/TerminalLifecycleStateMachine.ts` - Core implementation
- `src/services/terminal/TerminalStateManagementService.ts` - Integration layer
- `src/test/unit/services/terminal/TerminalLifecycleStateMachine.test.ts` - Unit tests

### Design Decisions

1. **Enum-based states**: Provides type safety and autocomplete
2. **Map-based storage**: O(1) lookups for state queries
3. **Event emitter pattern**: Standard VS Code pattern for notifications
4. **Immutable history**: Transitions cannot be modified after recording
5. **Bounded history**: Prevents memory leaks with configurable limits

## Migration Guide

For existing code using terminal state:

### Before
```typescript
// State was implicit and scattered
if (terminal.pty && terminal.isActive) {
  // Do something
}
```

### After
```typescript
// State is explicit and centralized
const state = service.getLifecycleState(terminal.id);
if (state === TerminalLifecycleState.Active) {
  // Do something
}
```
