# CLI Agent Detection Service Refactoring

## Overview

This document outlines the refactoring of CLI Agent detection functionality from the monolithic `TerminalManager` class into a dedicated service following the Single Responsibility Principle (SRP).

## Motivation

The original `TerminalManager` class was handling both terminal lifecycle management and CLI Agent detection logic, resulting in:
- **Violation of Single Responsibility Principle**: One class handling multiple concerns
- **Poor testability**: Difficult to test CLI agent detection in isolation
- **High complexity**: Over 1600 lines with mixed concerns
- **Tight coupling**: CLI agent logic tightly coupled with terminal management

## Architecture Changes

### Before Refactoring

```
TerminalManager (1600+ lines)
├── Terminal lifecycle management
├── CLI Agent detection patterns
├── CLI Agent state management
├── Shell prompt detection
├── Termination logic
├── Event emission
└── Performance optimizations
```

### After Refactoring

```
TerminalManager (800 lines)
├── Terminal lifecycle management
├── Performance optimizations
└── Uses: ICliAgentDetectionService

CliAgentDetectionService
├── Detection patterns (Claude/Gemini)
├── State management
├── Termination detection
├── Event emission
└── Performance optimizations

Supporting Components:
├── ICliAgentDetectionService (interface)
├── ICliAgentPatternDetector (interface)
├── ICliAgentStateManager (interface)
└── CliAgentPatternDetector (implementation)
```

## Extracted Components

### 1. Interface Definitions (`src/interfaces/CliAgentService.ts`)

- **ICliAgentDetectionService**: Main service interface
- **ICliAgentPatternDetector**: Pattern matching interface
- **ICliAgentStateManager**: State management interface
- **ICliAgentDetectionConfig**: Configuration interface

### 2. Service Implementation (`src/services/CliAgentDetectionService.ts`)

#### CliAgentPatternDetector
- `detectClaudeStartup()`: Detects Claude Code startup patterns
- `detectGeminiStartup()`: Detects Gemini CLI startup patterns
- `detectShellPrompt()`: Detects shell prompt return (termination)
- `cleanAnsiEscapeSequences()`: Cleans terminal output

#### CliAgentStateManager
- `setConnectedAgent()`: Sets active CLI agent
- `setAgentTerminated()`: Handles agent termination
- `promoteLatestDisconnectedAgent()`: Auto-promotion logic
- `getDisconnectedAgents()`: State access

#### CliAgentDetectionService (Main Service)
- `detectFromInput()`: Detects agent startup from user input
- `detectFromOutput()`: Detects agent patterns from terminal output
- `detectTermination()`: Detects agent termination
- `switchAgentConnection()`: Manual agent switching
- `getAgentState()`: State queries

### 3. Updated TerminalManager Integration

The `TerminalManager` now uses dependency injection to access CLI Agent functionality:

```typescript
class TerminalManager {
  private readonly _cliAgentService: ICliAgentDetectionService;

  constructor(cliAgentService?: ICliAgentDetectionService) {
    this._cliAgentService = cliAgentService || new CliAgentDetectionService();
  }

  // Delegates CLI agent operations to service
  public isCliAgentConnected(terminalId: string): boolean {
    const agentState = this._cliAgentService.getAgentState(terminalId);
    return agentState.status === 'connected';
  }
}
```

## Benefits Achieved

### 1. Single Responsibility Principle (SRP)
- **TerminalManager**: Focused on terminal lifecycle only
- **CliAgentDetectionService**: Focused on CLI agent detection only

### 2. Improved Testability
- CLI agent detection can be tested in isolation
- Mock services can be injected for testing
- Clear interfaces enable better test coverage

### 3. Reduced Complexity
- **TerminalManager**: Reduced from 1600+ to ~800 lines
- **Separation of concerns**: Each class has a clear, single purpose
- **Easier maintenance**: Changes to CLI agent logic don't affect terminal management

### 4. Better Dependency Injection
- Service can be mocked for testing
- Alternative implementations can be provided
- Clear separation of dependencies

### 5. Enhanced Modularity
- CLI agent logic is now reusable
- Service can be used independently
- Clear API boundaries

## Detection Logic Preserved

All existing CLI agent detection functionality has been preserved:

### Claude Code Detection
- Startup pattern matching
- Version-specific patterns
- Model-specific detection
- Welcome message recognition

### Gemini CLI Detection  
- CLI startup patterns
- Version detection
- API integration patterns
- Authentication flows

### Termination Detection
- Shell prompt recognition
- Exit command detection
- Process termination signals
- Cleanup procedures

### State Management
- Connected/Disconnected/None states
- Auto-promotion logic
- Manual switching capability
- Event emission

## Performance Optimizations

The refactoring maintains all performance optimizations:

- **Detection debouncing**: Prevents rapid successive calls
- **Data caching**: Avoids reprocessing identical data
- **Early exit conditions**: Skips processing for minimal data
- **Optimized buffering**: Efficient handling for connected terminals

## Testing Strategy

The refactoring enables comprehensive testing:

### Unit Tests
- Test individual pattern detectors
- Test state management logic
- Test termination detection
- Test configuration handling

### Integration Tests
- Test service integration with TerminalManager
- Test real CLI agent scenarios
- Test event emission and handling

### Mock Testing
- Mock CLI agent services for terminal tests
- Mock pattern detectors for service tests
- Isolated testing of components

## Migration Guide

### For Developers

The public API of `TerminalManager` remains unchanged, ensuring backward compatibility:

```typescript
// These methods work exactly as before
terminalManager.isCliAgentConnected(terminalId)
terminalManager.getCurrentGloballyActiveAgent()
terminalManager.switchAiAgentConnection(terminalId)
```

### For Testing

New testing capabilities are available:

```typescript
// Mock the CLI agent service for testing
const mockService = new MockCliAgentDetectionService();
const terminalManager = new TerminalManager(mockService);

// Test CLI agent detection in isolation
const service = new CliAgentDetectionService();
const result = service.detectFromInput(terminalId, 'claude code');
```

## Conclusion

This refactoring successfully separates CLI Agent detection concerns from terminal management while:
- Maintaining all existing functionality
- Improving code organization and testability
- Reducing complexity through proper separation of concerns
- Enabling better testing and maintainability
- Following SOLID principles for better software design

The refactored code is now more maintainable, testable, and follows established software engineering principles while preserving all CLI Agent detection capabilities.