# Duplicate Code Analysis Report

## Summary

This analysis identifies significant duplicate code patterns in the VS Code Sidebar Terminal extension that could benefit from refactoring to improve maintainability and reduce redundancy.

## 1. Terminal Management Logic

### Duplicate Pattern: Terminal Style Application

**Location**: `/src/webview/main.ts`

Found 4 identical instances of style application:

- Lines 268-276
- Lines 444-452
- Lines 592-600
- Lines 672-680

```typescript
container.style.width = '100%';
container.style.flex = '1';
container.style.display = 'flex';
container.style.flexDirection = 'column';
container.style.overflow = 'hidden';
container.style.margin = '0';
container.style.padding = '2px';
container.style.minHeight = '100px';
container.style.outline = 'none';
```

**Recommendation**: Extract to a reusable function:

```typescript
function applyTerminalContainerStyles(container: HTMLElement): void {
  Object.assign(container.style, {
    width: '100%',
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    margin: '0',
    padding: '2px',
    minHeight: '100px',
    outline: 'none',
  });
}
```

## 2. Message Handling Patterns

### Duplicate Pattern: Error Message Display

**Locations**:

- `/src/providers/SecandarySidebar.ts`: Multiple instances using `vscode.window.showErrorMessage`
- `/src/terminals/TerminalManager.ts`: Using `showErrorMessage` and `showWarningMessage`
- `/src/utils/feedback.ts`: Multiple error handling functions

**Duplication**: Each module has its own error display logic with similar patterns:

```typescript
// Pattern 1 (SecandarySidebar.ts)
void vscode.window.showErrorMessage(`Failed to ${action}: ${String(error)}`);

// Pattern 2 (TerminalManager.ts)
showErrorMessage(ERROR_MESSAGES.TERMINAL_CREATION_FAILED, error);

// Pattern 3 (feedback.ts)
showError(`Failed to ${action}: ${message}`);
```

**Recommendation**: Consolidate error handling into the existing `feedback.ts` module and use consistently across all modules.

## 3. Configuration Handling

### Duplicate Pattern: Configuration Access

**Locations**: Multiple files accessing configuration differently

1. Direct VS Code API usage:
   - `/src/providers/SecandarySidebar.ts` line 726: `vscode.workspace.getConfiguration('sidebarTerminal')`

2. ConfigManager usage:
   - `/src/providers/SecandarySidebar.ts` line 73: `getConfigManager().getExtensionTerminalConfig()`
   - `/src/terminals/TerminalManager.ts` line 50: `getTerminalConfig()`

**Recommendation**: Standardize on ConfigManager for all configuration access.

## 4. UI Component Creation

### Duplicate Pattern: DOM Element Creation with Inline Styles

**Location**: `/src/webview/main.ts`

Large blocks of inline CSS text (lines 139-149, 249-258, 969-984) are used repeatedly for similar purposes.

**Example**:

```typescript
container.style.cssText = `
  display: flex;
  flex-direction: column;
  background: #000;
  width: 100%;
  height: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
  gap: 0;
`;
```

**Recommendation**: Use CSS classes instead of inline styles or create style constants.

## 5. Notification Handling

### Duplicate Pattern: Notification Creation

**Locations**:

- `/src/webview/utils/NotificationUtils.ts`: Multiple similar notification functions
- `/src/webview/core/NotificationBridge.ts`: Duplicate notification logic
- `/src/webview/main.ts` line 960-1006: Custom notification implementation

**Pattern**: Each notification type has its own function with similar structure:

```typescript
export function showTerminalCloseError(minCount: number): void {
  showNotification({
    type: 'warning',
    title: 'Cannot close terminal',
    message: `Must keep at least ${minCount} terminal${minCount > 1 ? 's' : ''} open`,
  });
}

export function showTerminalKillError(reason: string): void {
  showNotification({
    type: 'error',
    title: 'Terminal kill failed',
    message: reason,
  });
}
```

**Recommendation**: Create a generic notification factory:

```typescript
const NotificationFactory = {
  terminalError: (title: string, message: string) =>
    showNotification({ type: 'error', title, message }),
  terminalWarning: (title: string, message: string) =>
    showNotification({ type: 'warning', title, message }),
  // etc.
};
```

## 6. Event Handler Registration

### Duplicate Pattern: Click Handler Registration

**Location**: `/src/webview/main.ts`

Multiple instances of similar click handler registration with identical logic:

- Lines 281-296: Terminal container click handler
- Lines 1339-1378: XTerm click handler
- Lines 392-399: Terminal div focus handler

**Recommendation**: Create a generic event handler registration utility.

## 7. Terminal Lifecycle Management

### Duplicate Pattern: Terminal Cleanup

**Locations**:

- `/src/terminals/TerminalManager.ts` lines 429-450: `_cleanupTerminalData`
- `/src/terminals/TerminalManager.ts` lines 455-473: `_removeTerminal`

Both methods perform similar cleanup operations with overlapping logic.

**Recommendation**: Consolidate cleanup logic into a single method with options.

## 8. Buffer Management

### Duplicate Pattern: Data Buffering Logic

**Locations**:

- `/src/terminals/TerminalManager.ts`: Data buffer management (lines 34-38, 367-415)
- `/src/webview/main.ts`: Output buffer management (lines 62-65, 715-799)

Both implement similar buffering strategies with flush timers.

**Recommendation**: Extract to a generic `BufferManager` class that can be reused.

## Priority Refactoring Targets

1. **High Priority**: Terminal style application (4 duplicates, easy to fix)
2. **High Priority**: Error handling consolidation (affects user experience)
3. **Medium Priority**: Configuration access standardization
4. **Medium Priority**: Notification system consolidation
5. **Low Priority**: Event handler registration patterns
6. **Low Priority**: Buffer management abstraction

## Estimated Impact

- **Code Reduction**: Approximately 300-400 lines of duplicate code could be eliminated
- **Maintainability**: Significant improvement in consistency and ease of updates
- **Testing**: Easier to test centralized functions vs. scattered duplicates
- **Performance**: Minimal impact, mostly organizational improvements
