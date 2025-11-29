# Common VS Code Extension Bugs Reference

## Memory Leak Bugs

### 1. Unregistered Event Listeners

**Symptoms**: Memory usage grows over time, extension becomes slow

**Bug Pattern**:
```typescript
// Event listener created but never disposed
vscode.workspace.onDidChangeTextDocument(e => {
  processDocument(e.document);
});
```

**Fix**:
```typescript
// Register in subscriptions
context.subscriptions.push(
  vscode.workspace.onDidChangeTextDocument(e => {
    processDocument(e.document);
  })
);
```

### 2. Undisposed Timers

**Symptoms**: Callbacks continue executing after extension should be idle

**Bug Pattern**:
```typescript
setInterval(() => {
  updateStatus();
}, 1000);
```

**Fix**:
```typescript
const timer = setInterval(() => {
  updateStatus();
}, 1000);

// Dispose when done
context.subscriptions.push({
  dispose: () => clearInterval(timer)
});
```

### 3. WebView Panel Leaks

**Symptoms**: Multiple WebView instances accumulate

**Bug Pattern**:
```typescript
function showPanel() {
  const panel = vscode.window.createWebviewPanel(...);
  // Panel never tracked or disposed
}
```

**Fix**:
```typescript
private panel: vscode.WebviewPanel | undefined;

function showPanel() {
  if (this.panel) {
    this.panel.reveal();
    return;
  }

  this.panel = vscode.window.createWebviewPanel(...);
  this.panel.onDidDispose(() => {
    this.panel = undefined;
  });
}
```

### 4. File Watcher Accumulation

**Symptoms**: System resources exhausted, "too many open files" errors

**Bug Pattern**:
```typescript
function watchProject() {
  // Creates new watcher without disposing old one
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
}
```

**Fix**:
```typescript
private watcher: vscode.FileSystemWatcher | undefined;

function watchProject() {
  this.watcher?.dispose();
  this.watcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(this.watcher);
}
```

## Race Condition Bugs

### 5. Duplicate Terminal Creation

**Symptoms**: Multiple terminals created when only one requested

**Bug Pattern**:
```typescript
private isCreating = false;

async createTerminal() {
  if (this.isCreating) return;
  this.isCreating = true;

  await doCreateTerminal(); // If this rejects, flag stays true
  this.isCreating = false;
}
```

**Fix**:
```typescript
private creationPromise: Promise<void> | null = null;

async createTerminal() {
  if (this.creationPromise) {
    return this.creationPromise;
  }

  this.creationPromise = this.doCreateTerminal();
  try {
    await this.creationPromise;
  } finally {
    this.creationPromise = null;
  }
}
```

### 6. Configuration Race

**Symptoms**: Stale configuration values used

**Bug Pattern**:
```typescript
let config = vscode.workspace.getConfiguration('myExt');

// Configuration changes while using cached value
function getSetting() {
  return config.get('setting');
}
```

**Fix**:
```typescript
function getSetting() {
  // Always get fresh configuration
  return vscode.workspace.getConfiguration('myExt').get('setting');
}
```

### 7. State Update Race

**Symptoms**: Lost updates, inconsistent state

**Bug Pattern**:
```typescript
async updateState(key: string, value: any) {
  const current = await this.context.globalState.get('state') || {};
  current[key] = value;
  await this.context.globalState.update('state', current);
}
// Concurrent calls can overwrite each other
```

**Fix**:
```typescript
private updateQueue = Promise.resolve();

async updateState(key: string, value: any) {
  this.updateQueue = this.updateQueue.then(async () => {
    const current = await this.context.globalState.get('state') || {};
    current[key] = value;
    await this.context.globalState.update('state', current);
  });
  return this.updateQueue;
}
```

## WebView Bugs

### 8. Message Before Ready

**Symptoms**: Initial messages lost, WebView shows stale data

**Bug Pattern**:
```typescript
function createWebview() {
  panel.webview.html = getHtml();
  panel.webview.postMessage({ type: 'init', data }); // Lost!
}
```

**Fix**:
```typescript
function createWebview() {
  panel.webview.html = getHtml();

  panel.webview.onDidReceiveMessage(msg => {
    if (msg.type === 'ready') {
      panel.webview.postMessage({ type: 'init', data });
    }
  });
}
```

### 9. CSP Blocks Resources

**Symptoms**: Styles/scripts don't load, console shows CSP violations

**Bug Pattern**:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';">
<link href="${styleUri}" rel="stylesheet">
<!-- Blocked by CSP! -->
```

**Fix**:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src ${webview.cspSource};">
<link href="${styleUri}" rel="stylesheet">
```

### 10. Invalid Resource URI

**Symptoms**: Resources 404, paths don't resolve

**Bug Pattern**:
```typescript
const scriptPath = path.join(extensionPath, 'media', 'script.js');
// Direct path doesn't work in WebView
```

**Fix**:
```typescript
const scriptUri = webview.asWebviewUri(
  vscode.Uri.joinPath(extensionUri, 'media', 'script.js')
);
```

## Activation Bugs

### 11. Wrong Activation Event

**Symptoms**: Extension doesn't activate when expected

**Bug Pattern**:
```json
{
  "activationEvents": ["onCommand:myExt.doSomething"]
}
// But command is triggered by a view, not explicitly
```

**Fix**:
```json
{
  "activationEvents": [
    "onCommand:myExt.doSomething",
    "onView:myExtView"
  ]
}
```

### 12. Sync Blocking in Activate

**Symptoms**: VS Code startup delayed

**Bug Pattern**:
```typescript
export function activate(context) {
  const data = fs.readFileSync(largePath); // Blocks!
  initialize(data);
}
```

**Fix**:
```typescript
export async function activate(context) {
  // Non-blocking initialization
  setImmediate(async () => {
    const data = await fs.promises.readFile(largePath);
    initialize(data);
  });
}
```

### 13. Missing Error Handler in Activate

**Symptoms**: Extension silently fails to activate

**Bug Pattern**:
```typescript
export async function activate(context) {
  await riskyOperation(); // Unhandled rejection crashes activation
}
```

**Fix**:
```typescript
export async function activate(context) {
  try {
    await riskyOperation();
  } catch (error) {
    vscode.window.showErrorMessage(`Activation failed: ${error.message}`);
    // Consider whether to rethrow or gracefully degrade
  }
}
```

## TypeScript/Type Bugs

### 14. Implicit Any

**Symptoms**: Runtime type errors, undefined is not a function

**Bug Pattern**:
```typescript
function process(data) { // Implicit any
  return data.map(x => x.value); // Runtime error if data is undefined
}
```

**Fix**:
```typescript
interface Item { value: string; }

function process(data: Item[] | undefined): string[] {
  return data?.map(x => x.value) ?? [];
}
```

### 15. Unsafe Type Assertion

**Symptoms**: Runtime crashes on unexpected data

**Bug Pattern**:
```typescript
const config = message.config as Config; // Dangerous!
config.setting.nested.value; // Crash if structure differs
```

**Fix**:
```typescript
function isConfig(obj: unknown): obj is Config {
  return obj !== null &&
    typeof obj === 'object' &&
    'setting' in obj;
}

if (isConfig(message.config)) {
  // Safe to use
}
```

## Communication Bugs

### 16. Message Type Mismatch

**Symptoms**: Messages ignored, handler never triggered

**Bug Pattern**:
```typescript
// Extension sends
panel.webview.postMessage({ type: 'UPDATE', data });

// WebView expects
if (message.type === 'update') { // Case mismatch!
```

**Fix**:
```typescript
// Define shared constants
const MessageTypes = {
  UPDATE: 'update'
} as const;

// Use consistently
panel.webview.postMessage({ type: MessageTypes.UPDATE, data });
```

### 17. Unvalidated Message Data

**Symptoms**: Crashes on malformed messages, security vulnerabilities

**Bug Pattern**:
```typescript
webview.onDidReceiveMessage(message => {
  const id = message.terminalId; // Could be anything!
  terminals.get(id).write(message.data);
});
```

**Fix**:
```typescript
webview.onDidReceiveMessage(message => {
  if (typeof message.terminalId !== 'number' ||
      typeof message.data !== 'string') {
    console.warn('Invalid message format');
    return;
  }

  const terminal = terminals.get(message.terminalId);
  if (!terminal) {
    console.warn(`Unknown terminal: ${message.terminalId}`);
    return;
  }

  terminal.write(message.data);
});
```

## Terminal-Specific Bugs

### 18. Terminal Write After Close

**Symptoms**: "Cannot write to disposed terminal" errors

**Bug Pattern**:
```typescript
terminal.sendText(command);
// Terminal might be closed by user
```

**Fix**:
```typescript
if (!this.isTerminalAlive(terminal)) {
  console.warn('Terminal no longer available');
  return;
}
terminal.sendText(command);
```

### 19. Shell Not Ready

**Symptoms**: Commands sent before shell prompt, output garbled

**Bug Pattern**:
```typescript
const terminal = vscode.window.createTerminal();
terminal.sendText('ls'); // Shell might not be ready!
```

**Fix**:
```typescript
const terminal = vscode.window.createTerminal();
// Wait for shell initialization
await new Promise(resolve => setTimeout(resolve, 500));
terminal.sendText('ls');

// Or use shell integration when available
```

### 20. Terminal ID Collision

**Symptoms**: Wrong terminal receives commands

**Bug Pattern**:
```typescript
let terminalId = 0;
function createTerminal() {
  terminalId++;
  // ID can collide if terminals are deleted and recreated
}
```

**Fix**:
```typescript
// Use ID recycling with proper tracking
class TerminalIdManager {
  private availableIds = new Set([1, 2, 3, 4, 5]);
  private usedIds = new Map<number, Terminal>();

  allocate(terminal: Terminal): number {
    const id = this.availableIds.values().next().value;
    this.availableIds.delete(id);
    this.usedIds.set(id, terminal);
    return id;
  }

  release(id: number): void {
    this.usedIds.delete(id);
    this.availableIds.add(id);
  }
}
```
