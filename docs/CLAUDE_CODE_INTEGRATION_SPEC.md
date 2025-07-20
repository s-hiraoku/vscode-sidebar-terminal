# Claude Code Integration Specification

## Overview

This document outlines the complete specification for Claude Code integration in the VS Code Sidebar Terminal extension. The integration provides real-time status display and performance optimization for Claude Code sessions.

## Architecture

### Core Components

#### Extension Host (Node.js)

- **SidebarTerminalProvider**: Main WebView provider and message router
- **TerminalManager**: Terminal process management with Claude detection
- **ClaudeTerminalTracker**: Claude Code session tracking and state management

#### WebView (Browser Environment)

- **TerminalWebviewManager**: Main coordinator implementing IManagerCoordinator
- **UIManager**: Claude status display and visual feedback
- **MessageManager**: WebView ↔ Extension communication
- **PerformanceManager**: Output buffering optimization for Claude Code
- **DOMManager**: Unified DOM element creation and manipulation
- **CommunicationManager**: Consolidated messaging with retry logic
- **LoggerManager**: Centralized logging with performance tracking

### Communication Flow

```
Claude Code Session → Terminal Output → TerminalManager → Extension → WebView → UIManager → Header Display
```

## Features

### 1. Real-Time Status Display

#### Header Status Format

- **Connected**: `Terminal 1   Claude Code connected ●` (green blinking indicator)
- **Disconnected**: `Terminal 1   Claude Code disconnected ●` (red solid indicator)
- **Inactive**: `Terminal 1` (no Claude status)

#### Status Detection Patterns

- **Input Detection**: Commands starting with `claude`
- **Output Patterns**:
  - `Welcome to Claude`
  - `Claude Code`
  - `Type your message`
  - `claude.ai`
  - Regex patterns: `/^\\s*Human:/`, `/^\\s*Assistant:/`

#### Visual Indicators

- **Color Coding**:
  - Connected: `#4CAF50` (green)
  - Disconnected: `#f44747` (red)
- **Animation**: Connected status shows blinking animation
- **Positioning**: Status text and indicator positioned to the right of terminal name

### 2. Performance Optimization

#### Adaptive Buffering Strategy

- **Normal Mode**: 16ms flush interval (~60fps)
- **Claude Code Mode**: 4ms flush interval for cursor accuracy
- **High-Frequency Output**: 8ms interval for frequent output
- **Large Output**: Immediate flush for ≥1000 characters

#### Buffer Management

- **Maximum Buffer Size**: 50 items
- **Immediate Flush Conditions**:
  - Large output (≥1000 chars)
  - Buffer full
  - Claude Code mode with moderate output (≥100 chars)

### 3. Alt+Click Integration

#### Conflict Detection

The extension automatically detects Claude Code activity and temporarily disables Alt+Click during:

- Claude Code execution sessions
- High-frequency terminal output (>500 chars in 2 seconds)
- Large output chunks (≥1000 characters)

#### User Feedback

- **Disabled State**: "⚡ Claude Code Active" tooltip
- **Notifications**: System notifications for disable/enable state
- **Visual Indication**: Blue highlight feedback when Alt+Click is active

## Technical Implementation

### DOM Structure Requirements

#### Terminal Headers

All terminal headers must include `data-terminal-id` attribute for Claude status updates:

```html
<div class="terminal-header" data-terminal-id="terminal-123">
  <span class="terminal-name">Terminal 1</span>
  <span class="claude-status">Claude Code connected</span>
  <span class="claude-indicator">●</span>
</div>
```

#### CSS Classes

- `.terminal-header`: Main header container
- `.terminal-name`: Terminal name display
- `.claude-status`: Claude status text
- `.claude-indicator`: Status indicator (●)

### Message Protocol

#### Extension → WebView

```typescript
interface ClaudeStatusMessage {
  command: 'claudeStatusUpdate';
  claudeStatus: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
  };
}
```

#### WebView → Extension

```typescript
interface TerminalInputMessage {
  command: 'input';
  data: string;
  terminalId?: string;
}
```

### State Management

#### Terminal State Structure

```typescript
interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  maxTerminals: number;
  availableSlots: number[];
}
```

#### Claude Detection State

- **Command History**: Tracked per terminal (max 100 commands)
- **Active Terminals**: Set of terminal IDs with active Claude sessions
- **Input Buffer**: Partial input tracking for command detection

### Error Handling

#### Error Categories

1. **Terminal Errors**: Process failures, PTY issues
2. **Layout Errors**: DOM manipulation failures
3. **Settings Errors**: Configuration update failures
4. **Communication Errors**: WebView ↔ Extension messaging issues
5. **DOM Errors**: Element creation/manipulation failures

#### Error Recovery

- **Automatic Retry**: Communication failures with exponential backoff
- **Graceful Degradation**: Continue operation with reduced functionality
- **User Notification**: Clear error messages via notification system

## Code Quality Standards

### TypeScript Configuration

- **Strict Mode**: Enabled for type safety@
- **Interface Compliance**: All managers implement defined interfaces
- **Type Definitions**: Comprehensive type coverage for all data structures

### Performance Requirements

- **Claude Status Update**: <5ms execution time
- **DOM Operations**: Batched and debounced
- **Memory Usage**: Bounded log storage (1000 entries max)
- **Buffer Management**: Automatic cleanup and size limits

### Testing Strategy

- **Unit Tests**: Component-level testing with mocks
- **Integration Tests**: End-to-end Claude detection flow
- **Performance Tests**: Buffer and communication benchmarks
- **Error Handling Tests**: Failure scenario validation

## Configuration Options

### Extension Settings

```json
{
  "sidebarTerminal.claudeIntegration.enabled": true,
  "sidebarTerminal.claudeIntegration.statusUpdateInterval": 100,
  "sidebarTerminal.claudeIntegration.performanceMode": true,
  "sidebarTerminal.claudeIntegration.altClickConflictDetection": true
}
```

### WebView Settings

- **Font Settings**: Font family and size configuration
- **Theme Integration**: VS Code theme compatibility
- **Buffer Configuration**: Flush intervals and size limits

## Security Considerations

### Input Validation

- **Message Sanitization**: All incoming messages validated
- **Command Filtering**: Claude command detection uses safe patterns
- **DOM Injection Prevention**: Safe HTML generation methods

### Resource Management

- **Memory Limits**: Bounded collections and cleanup
- **Process Isolation**: Separate terminal processes
- **Error Boundaries**: Contained failure handling

## Deployment and Updates

### Backward Compatibility

- **Legacy Support**: Graceful fallback for missing features
- **Configuration Migration**: Automatic settings updates
- **API Versioning**: Stable message protocol

### Update Strategy

- **Incremental Updates**: Feature flags for new functionality
- **Performance Monitoring**: Built-in metrics collection
- **Error Reporting**: Comprehensive logging and telemetry

## Troubleshooting Guide

### Common Issues

#### Header Not Updating

1. **Check DOM Structure**: Verify `data-terminal-id` attributes
2. **Message Flow**: Check browser console for message logs
3. **Status Detection**: Verify Claude command patterns

#### Performance Issues

1. **Buffer Settings**: Check flush intervals in performance manager
2. **Log Level**: Reduce logging verbosity in production
3. **Memory Usage**: Monitor buffer sizes and cleanup

#### Alt+Click Conflicts

1. **VS Code Settings**: Verify required Alt+Click settings
2. **Detection Patterns**: Check Claude output pattern matching
3. **Conflict Resolution**: Monitor disable/enable notifications

### Debug Commands

- **Log Export**: Access via LoggerManager.exportLogs()
- **Buffer Stats**: PerformanceManager.getBufferStats()
- **Connection Info**: CommunicationManager.getConnectionInfo()

## Future Enhancements

### Planned Features

1. **Multi-Session Support**: Handle multiple concurrent Claude sessions
2. **Session Persistence**: Maintain Claude state across VS Code restarts
3. **Custom Themes**: Claude-specific visual themes
4. **Advanced Metrics**: Performance and usage analytics

### Extensibility Points

- **Plugin Architecture**: Support for custom Claude integrations
- **Event Hooks**: Extensible event system for third-party addons
- **Theme API**: Customizable visual appearance
- **Configuration API**: Programmatic settings management

---

**Last Updated**: 2025-01-20
**Version**: 1.0.0
**Compatibility**: VS Code 1.60+, Claude Code 2.0+
