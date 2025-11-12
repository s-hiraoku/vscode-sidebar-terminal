# CLI Agent Detection - Centralized Architecture

## Overview

This module provides a centralized architecture for CLI Agent detection, eliminating ~400 lines of duplicate code across multiple services and establishing a single source of truth for pattern definitions and state management.

## Architecture Components

### 1. CliAgentPatternRegistry

**Single source of truth for all pattern definitions**

- Stores all CLI Agent patterns (Claude, Gemini, Codex)
- Manages startup, termination, and exclusion patterns
- Provides shell prompt patterns
- Handles ANSI escape sequence cleaning patterns

**Usage:**
```typescript
import { CliAgentPatternRegistry } from './services/cliAgent';

const registry = CliAgentPatternRegistry.getInstance();
const claudePatterns = registry.getAgentPatterns('claude');
```

### 2. CliAgentDetectionEngine

**Unified detection logic for all CLI Agents**

- Detects CLI Agents from input/output
- Detects agent termination
- Cleans ANSI escape sequences
- Uses CliAgentPatternRegistry for consistent pattern matching

**Usage:**
```typescript
import { CliAgentDetectionEngine } from './services/cliAgent';

const engine = CliAgentDetectionEngine.getInstance();

// Detect from input
const inputResult = engine.detectFromInput('claude help');
if (inputResult.isDetected) {
  console.log(`Detected ${inputResult.agentType}`);
}

// Detect from output
const outputResult = engine.detectFromOutput(terminalOutput);

// Detect termination
const terminationResult = engine.detectTermination(terminalOutput, 'claude');
```

### 3. CliAgentStateStore

**Centralized state management with observer pattern**

- Tracks connected and disconnected agents
- Manages state transitions
- Provides event-driven state change notifications
- Supports persistence through state snapshots
- Prevents race conditions with transition locks
- Debounces rapid state changes

**Usage:**
```typescript
import { CliAgentStateStore, StateObserver } from './services/cliAgent';

const stateStore = CliAgentStateStore.getInstance();

// Set agent as connected
stateStore.setConnectedAgent('terminal-1', 'claude');

// Subscribe to state changes
stateStore.onStateChange((event) => {
  console.log(`Terminal ${event.terminalId} changed to ${event.status}`);
});

// Or implement observer pattern
class MyObserver implements StateObserver {
  onStateChange(event: StateChangeEvent): void {
    // Handle state change
  }
}

const observer = new MyObserver();
stateStore.addObserver(observer);

// Get current state
const state = stateStore.getAgentState('terminal-1');
const connectedAgent = stateStore.getConnectedAgent();
const disconnectedAgents = stateStore.getDisconnectedAgents();

// Persist state
const snapshot = stateStore.getStateSnapshot();
// ... save snapshot to disk ...

// Restore state
stateStore.restoreStateSnapshot(snapshot);
```

## Migration Guide

### From Old Architecture

**Before (Scattered Implementation):**
```typescript
// TerminalManager.ts
private detectAgent(output: string) {
  // Duplicate pattern matching logic
  if (output.includes('claude')) {
    // ...
  }
}

// CliAgentDetectionService.ts
private detectFromOutput(output: string) {
  // More duplicate pattern matching
  if (this.patternDetector.detectClaudeStartup(line)) {
    // ...
  }
}

// CliAgentStateManager.ts
setConnectedAgent(terminalId: string, type: AgentType) {
  // State management logic
}
```

**After (Centralized Architecture):**
```typescript
import {
  CliAgentDetectionEngine,
  CliAgentStateStore
} from './services/cliAgent';

const engine = CliAgentDetectionEngine.getInstance();
const stateStore = CliAgentStateStore.getInstance();

// Detect from output
const result = engine.detectFromOutput(output);

// Update state
if (result.isDetected && result.agentType) {
  stateStore.setConnectedAgent(terminalId, result.agentType);
}
```

### Refactored CliAgentDetectionService

The refactored service (`CliAgentDetectionService.refactored.ts`) demonstrates how to use the centralized components while maintaining the existing interface:

```typescript
import { CliAgentDetectionServiceRefactored } from './services/CliAgentDetectionService.refactored';

// Drop-in replacement for the old service
const service = new CliAgentDetectionServiceRefactored();

// Same interface, but uses centralized components internally
const result = service.detectFromInput(terminalId, 'claude help');
```

## Benefits

### Code Reduction
- **Before**: ~400 lines of duplicate detection logic
- **After**: ~80 lines of centralized logic
- **Reduction**: ~80% less code to maintain

### Consistency
- Single pattern definition source
- Unified detection logic across all services
- Consistent state management

### Maintainability
- Easy to add new CLI agents
- Centralized pattern updates
- Clear separation of concerns

### Performance
- < 500ms detection performance (with caching)
- Debounced state changes to prevent rapid flipping
- LRU cache for detection results

### Extensibility
- Observer pattern for state changes
- Easy to add new pattern types
- Support for persistence through snapshots

## Performance Considerations

### Detection Performance
- Target: < 500ms for pattern matching + UI updates
- Achieved through:
  - Efficient regex patterns
  - LRU caching
  - Early termination on matches

### State Management
- Debouncing (500ms) prevents rapid state changes
- Transition locks prevent race conditions
- Observer pattern for efficient event propagation

## Testing

See the test files in `src/test/unit/services/cliAgent/` for comprehensive test coverage:

- `CliAgentPatternRegistry.test.ts` - Pattern definition tests
- `CliAgentDetectionEngine.test.ts` - Detection logic tests
- `CliAgentStateStore.test.ts` - State management tests

## Future Enhancements

1. **Pattern Learning**: Machine learning-based pattern detection
2. **Multi-Language Support**: Support for additional CLI agent types
3. **Enhanced Persistence**: Automatic state persistence to disk
4. **Telemetry**: Detection performance metrics
5. **Configuration UI**: Visual pattern editor

## Related Issues

- Issue #220: Consolidate CLI Agent detection to single source
- Issue #213: TerminalManager refactoring

## API Reference

See individual component files for detailed API documentation:
- [CliAgentPatternRegistry.ts](./CliAgentPatternRegistry.ts)
- [CliAgentDetectionEngine.ts](./CliAgentDetectionEngine.ts)
- [CliAgentStateStore.ts](./CliAgentStateStore.ts)
