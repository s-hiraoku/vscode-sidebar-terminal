# WebView CLAUDE.md - Implementation Guide

This file provides guidance for efficient WebView component implementation.

## Core Architecture

### TerminalWebviewManager (main.ts)

**Main Coordinator** - Orchestrates all WebView managers

- Implements `IManagerCoordinator` interface
- Manages lifecycle of all managers
- Acts as central hub for Extension ↔ WebView communication

### Manager Hierarchy

```
TerminalWebviewManager (Coordinator)
├── ConsolidatedMessageManager  # Extension ↔ WebView communication
├── UIManager                   # UI control, themes, visual feedback
├── InputManager                # Keyboard shortcuts, IME, Alt+Click
├── PerformanceManager          # Output buffering, debouncing
├── NotificationManager         # User feedback, notifications
├── TerminalLifecycleCoordinator # Terminal creation/deletion
├── SplitManager                # Terminal splitting, layout
├── ConfigManager               # Settings persistence, configuration
├── TerminalTabManager          # Tab management
├── DisplayModeManager          # Display mode control
└── HeaderManager               # Terminal header UI
```

## Design Principles

### Creating New Managers

**Three-Stage Implementation Pattern**

1. **Interface Design**: Define types in `interfaces/ManagerInterfaces.ts`
2. **Implementation**: Create concrete implementation in `managers/`
3. **Integration**: Integrate into TerminalWebviewManager

**Required Implementation Elements**

- Inherit from `IManagerLifecycle` (initialize/dispose)
- Use coordinator dependency injection pattern
- Implement proper resource disposal

### Event Handling Architecture

**Bidirectional Communication Design**

- Extension → WebView: Command-based messaging
- WebView → Extension: Asynchronous communication via postMessage API
- Error handling: try-catch + fallback processing

**Message Protocol Design Principles**

- Extensibility through command separation
- Standardized data payloads
- Version compatibility support

### Performance Optimization Strategy

**Buffering Design**

- Efficient processing of high-frequency output
- Load reduction through debounce processing
- Memory-efficient buffer management

**Rendering Optimization**

- Minimize DOM updates
- Virtualization for large data handling
- Avoid layout thrashing through CSS changes

## Key Implementation Considerations

### Manager Coordination Design

**Responsibility Separation Principles**

- Strict adherence to Single Responsibility Principle per Manager
- Minimize interdependencies
- Loose coupling via coordinator

**Common Operation Patterns**

- Terminal operations: Via coordinator
- Notifications: Unified NotificationManager interface
- Theme/UI operations: UIManager consolidation

### Debugging & Troubleshooting Strategy

**Terminal State Debug Panel**

Built-in debug tool for real-time WebView state monitoring:

```
Ctrl+Shift+D    # Toggle debug panel (show/hide)
```

**Monitored Items**:

- System state (READY/BUSY)
- Terminal management info (active count, slot status)
- Performance metrics
- Pending operations visualization

**Common Problem Patterns**

1. **Communication Disconnection**: Check message queueing → Verify in Debug panel
2. **Memory Leaks**: Check dispose() pattern implementation → Monitor via Performance Metrics
3. **Performance**: Check buffering settings → Real-time verification in Debug panel

**Debug Tools**

- **Built-in Debug Panel**: State monitoring, troubleshooting
- **WebView Developer Tools**: DOM, JavaScript debugging
- **Extension Host Log Monitoring**: Backend processing verification
- **Performance Profiling**: CPU, memory usage analysis

### Test Strategy Design

**Test Categories**

- Unit tests: Individual Manager functionality
- Integration tests: Inter-Manager coordination
- E2E tests: Real WebView environment

**Mock Design Principles**

- Interface-based mocks
- Test facilitation through dependency injection
- Test data close to production environment

## Implementation Checklists

### New Feature Implementation

- [ ] Interface definition (ManagerInterfaces.ts)
- [ ] Implementation class creation (managers/xxx.ts)
- [ ] Integration into TerminalWebviewManager
- [ ] dispose() method implementation
- [ ] Test case creation
- [ ] TypeScript type safety verification

### Refactoring

- [ ] Maintain existing interfaces
- [ ] Message protocol compatibility verification
- [ ] Performance regression check
- [ ] Memory leak verification
- [ ] All tests passing

## File Structure

```
src/webview/
├── main.ts                     # Entry point, TerminalWebviewManager
├── interfaces/
│   └── ManagerInterfaces.ts    # Manager interfaces
├── managers/
│   ├── ConsolidatedMessageManager.ts
│   ├── UIManager.ts
│   ├── InputManager.ts
│   ├── PerformanceManager.ts
│   ├── SplitManager.ts
│   ├── ScrollbackManager.ts
│   └── ...
├── controllers/
│   └── LifecycleController.ts  # Resource lifecycle management
└── utils/
    └── DOMUtils.ts             # DOM utility functions
```

Following this guide enables efficient WebView component implementation.
