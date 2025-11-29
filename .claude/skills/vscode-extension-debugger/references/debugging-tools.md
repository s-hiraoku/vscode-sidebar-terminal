# VS Code Extension Debugging Tools Reference

## Built-in VS Code Tools

### Extension Development Host (F5)

The primary debugging environment for VS Code extensions.

**Setup** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "npm: watch"
    }
  ]
}
```

**Features**:
- Set breakpoints in TypeScript source
- Inspect variables and call stack
- Step through code execution
- Evaluate expressions in Debug Console
- Hot reload with extension host restart

**Tips**:
- Use `debugger;` statement for programmatic breakpoints
- Enable "Caught Exceptions" for comprehensive error catching
- Use conditional breakpoints for specific scenarios

### Developer Tools (Help > Toggle Developer Tools)

Chrome DevTools for the VS Code renderer process.

**Console Tab**:
- Extension host logs appear here
- Filter by `[Extension]` prefix for your extension
- Check for unhandled promise rejections

**Network Tab**:
- Monitor WebView resource loading
- Debug CSP issues
- Track API requests

**Performance Tab**:
- Profile extension startup time
- Identify slow operations
- Memory snapshots for leak detection

**Memory Tab**:
- Heap snapshots for memory analysis
- Allocation timelines
- Retained object inspection

### WebView Developer Tools

Command: `Developer: Open Webview Developer Tools`

**Access**:
1. Focus the WebView
2. Open Command Palette (Cmd/Ctrl+Shift+P)
3. Run "Developer: Open Webview Developer Tools"

**Features**:
- Full Chrome DevTools for WebView content
- DOM inspection and modification
- JavaScript debugging within WebView
- Network requests from WebView
- Console for WebView-side logging

**Common Uses**:
- Debug WebView JavaScript errors
- Inspect CSS and layout issues
- Monitor message passing
- Profile WebView performance

## Extension-Specific Debug Panel

### Terminal State Debug Panel

Built into this extension, accessible via `Ctrl+Shift+D`.

**Displays**:
- System state (READY/BUSY)
- Active terminal count
- Terminal slot status (1-5)
- Performance metrics
- Pending operations queue
- Message throughput

**Usage**:
```typescript
// Toggle debug panel visibility
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    toggleDebugPanel();
  }
});
```

## Logging Strategies

### Structured Logging

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  debug(message: string, data?: unknown): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[${this.component}] DEBUG: ${message}`, data ?? '');
    }
  }

  info(message: string, data?: unknown): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[${this.component}] INFO: ${message}`, data ?? '');
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.component}] WARN: ${message}`, data ?? '');
    }
  }

  error(message: string, error?: Error): void {
    console.error(`[${this.component}] ERROR: ${message}`, {
      message: error?.message,
      stack: error?.stack
    });
  }
}

// Usage
const logger = new Logger('TerminalManager');
logger.debug('Creating terminal', { id: 1 });
```

### Output Channel Logging

```typescript
const outputChannel = vscode.window.createOutputChannel('My Extension');

function log(message: string): void {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ${message}`);
}

// Show output channel
outputChannel.show();
```

### Telemetry (Production Debugging)

```typescript
import TelemetryReporter from '@vscode/extension-telemetry';

const reporter = new TelemetryReporter(connectionString);

// Track events
reporter.sendTelemetryEvent('terminalCreated', {
  shellType: 'bash'
});

// Track errors
reporter.sendTelemetryErrorEvent('terminalCreationFailed', {
  errorMessage: error.message
});

// Dispose on deactivation
context.subscriptions.push(reporter);
```

## Memory Debugging

### Heap Snapshot Analysis

1. Open Developer Tools (Help > Toggle Developer Tools)
2. Go to Memory tab
3. Select "Heap snapshot"
4. Click "Take snapshot"
5. Perform suspected leaky operation
6. Take another snapshot
7. Compare snapshots using "Comparison" view

**What to Look For**:
- Growing number of objects between snapshots
- Detached DOM trees (in WebViews)
- Unreleased event listeners
- Accumulated closures

### Allocation Timeline

1. Memory tab > "Allocation instrumentation on timeline"
2. Start recording
3. Perform operations
4. Stop recording
5. Analyze allocation bars

**Blue bars**: Objects still in memory
**Gray bars**: Collected objects

### Common Leak Patterns

```typescript
// Leak: Closure retaining large object
class Processor {
  private largeData: Buffer;

  process() {
    const data = this.largeData; // Closure captures
    return () => {
      console.log(data.length); // data never released
    };
  }
}

// Fix: Release reference explicitly
process() {
  const length = this.largeData.length;
  return () => {
    console.log(length); // Only primitive retained
  };
}
```

## Performance Profiling

### CPU Profiling

1. Developer Tools > Performance tab
2. Click Record
3. Perform operation to profile
4. Click Stop
5. Analyze flame chart

**Key Metrics**:
- Self time: Time in function itself
- Total time: Time including callees
- Identify hot paths and optimize

### Startup Performance

```typescript
// Measure activation time
export async function activate(context: vscode.ExtensionContext) {
  const start = Date.now();

  // ... initialization ...

  console.log(`Activation took ${Date.now() - start}ms`);
}
```

### Operation Timing

```typescript
class PerformanceTracker {
  private timings: Map<string, number[]> = new Map();

  start(operation: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      const existing = this.timings.get(operation) || [];
      existing.push(duration);
      this.timings.set(operation, existing);
    };
  }

  report(): void {
    for (const [op, times] of this.timings) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`${op}: avg=${avg.toFixed(2)}ms, count=${times.length}`);
    }
  }
}

// Usage
const tracker = new PerformanceTracker();
const done = tracker.start('createTerminal');
await createTerminal();
done();
```

## Remote Debugging

### Debug Extension in Remote Environment

```json
{
  "name": "Attach to Remote Extension Host",
  "type": "extensionHost",
  "request": "attach",
  "debugId": "${command:pickRemoteDebugId}"
}
```

### Debug WebView in Remote

1. Connect to remote VS Code
2. Open WebView
3. Use "Developer: Open Webview Developer Tools"
4. DevTools connects through remote tunnel

## Test Debugging

### Debug Unit Tests

```json
{
  "name": "Debug Tests",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/mocha/bin/_mocha",
  "args": [
    "--timeout", "999999",
    "${workspaceFolder}/out/test/**/*.test.js"
  ],
  "internalConsoleOptions": "openOnSessionStart"
}
```

### Debug Integration Tests

```json
{
  "name": "Debug Integration Tests",
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}",
    "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
  ],
  "outFiles": ["${workspaceFolder}/out/test/**/*.js"]
}
```

## Diagnostic Commands

### Extension Information

```typescript
// Register diagnostic command
vscode.commands.registerCommand('myExt.showDiagnostics', () => {
  const diagnostics = {
    version: context.extension.packageJSON.version,
    activationTime: activationDuration,
    terminalCount: terminals.size,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };

  vscode.window.showInformationMessage(
    JSON.stringify(diagnostics, null, 2)
  );
});
```

### State Inspection

```typescript
vscode.commands.registerCommand('myExt.inspectState', async () => {
  const globalState = context.globalState.keys().map(key => ({
    key,
    value: context.globalState.get(key)
  }));

  const workspaceState = context.workspaceState.keys().map(key => ({
    key,
    value: context.workspaceState.get(key)
  }));

  const doc = await vscode.workspace.openTextDocument({
    content: JSON.stringify({ globalState, workspaceState }, null, 2),
    language: 'json'
  });

  vscode.window.showTextDocument(doc);
});
```

## Error Tracking

### Global Error Handler

```typescript
process.on('uncaughtException', (error) => {
  console.error('[Extension] Uncaught exception:', error);
  // Log to telemetry
  reporter.sendTelemetryErrorEvent('uncaughtException', {
    message: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('[Extension] Unhandled rejection:', reason);
  // Log to telemetry
  reporter.sendTelemetryErrorEvent('unhandledRejection', {
    reason: String(reason)
  });
});
```

### Error Boundary Pattern

```typescript
function withErrorBoundary<T extends (...args: any[]) => any>(
  fn: T,
  errorHandler: (error: Error) => void
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch(errorHandler);
      }
      return result;
    } catch (error) {
      errorHandler(error as Error);
    }
  }) as T;
}

// Usage
const safeCreateTerminal = withErrorBoundary(
  createTerminal,
  (error) => {
    vscode.window.showErrorMessage(`Failed to create terminal: ${error.message}`);
    logger.error('Terminal creation failed', error);
  }
);
```
