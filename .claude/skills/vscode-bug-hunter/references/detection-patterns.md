# Bug Detection Patterns

Comprehensive catalog of bug patterns specific to VS Code extensions.

## Memory Leak Patterns

### Pattern ML-001: Unregistered Event Listener

**Severity**: High
**Detection Difficulty**: Medium

```typescript
// BUG PATTERN
class MyClass {
  constructor() {
    // Event listener created but not tracked
    vscode.workspace.onDidChangeConfiguration(() => {
      this.handleConfigChange();
    });
  }
}

// DETECTION: Search for event registration without assignment
// grep -rn "vscode\.\w+\.on\w+\(" src/ | grep -v "const\|let\|this\.\w\+ ="
```

**Fix Pattern**:
```typescript
class MyClass implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(() => {
        this.handleConfigChange();
      })
    );
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
```

### Pattern ML-002: Timer Without Cleanup

**Severity**: High
**Detection Difficulty**: Easy

```typescript
// BUG PATTERN
class Poller {
  start() {
    setInterval(() => {
      this.poll();
    }, 5000);
    // Timer ID not stored - cannot be cleared!
  }
}

// DETECTION
// grep -rn "setInterval\|setTimeout" src/ | grep -v "clear\|this\.\w\+Id"
```

**Fix Pattern**:
```typescript
class Poller implements vscode.Disposable {
  private timerId: NodeJS.Timeout | undefined;

  start(): void {
    this.timerId = setInterval(() => this.poll(), 5000);
  }

  dispose(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }
}
```

### Pattern ML-003: Closure Capturing Large Object

**Severity**: Medium
**Detection Difficulty**: Hard

```typescript
// BUG PATTERN
class DataProcessor {
  private largeData: LargeObject;

  setupHandler() {
    // Closure captures 'this', keeping largeData alive
    someEmitter.on('event', () => {
      console.log('Event received');
      // Even if largeData is not used, it's retained
    });
  }
}

// DETECTION: Manual review of closures in event handlers
```

**Fix Pattern**:
```typescript
class DataProcessor {
  private largeData: LargeObject;

  setupHandler() {
    // Use arrow function only when needed, or bind specific data
    const handler = this.handleEvent.bind(this);
    someEmitter.on('event', handler);
    // Store handler reference for removal
    this.eventHandler = handler;
  }

  private handleEvent(): void {
    console.log('Event received');
  }
}
```

### Pattern ML-004: WebView Panel Not Disposed

**Severity**: High
**Detection Difficulty**: Medium

```typescript
// BUG PATTERN
class MyProvider {
  createPanel() {
    const panel = vscode.window.createWebviewPanel(...);
    // Panel reference lost - cannot dispose!
    panel.webview.html = this.getHtml();
  }
}

// DETECTION
// grep -rn "createWebviewPanel" src/ | check if result is stored
```

## Race Condition Patterns

### Pattern RC-001: Check-Then-Act Without Lock

**Severity**: Critical
**Detection Difficulty**: Hard

```typescript
// BUG PATTERN
class TerminalManager {
  private terminals: Map<number, Terminal> = new Map();

  async createTerminal(id: number): Promise<Terminal> {
    // RACE: Another call might create between check and set
    if (this.terminals.has(id)) {
      return this.terminals.get(id)!;
    }

    const terminal = await this.doCreateTerminal(id);
    this.terminals.set(id, terminal);
    return terminal;
  }
}

// DETECTION
// grep -rn "if.*has\|if.*get\|if.*\[" src/ -A 3 | grep "set\|push\|="
```

**Fix Pattern**:
```typescript
class TerminalManager {
  private terminals: Map<number, Terminal> = new Map();
  private creationPromises: Map<number, Promise<Terminal>> = new Map();

  async createTerminal(id: number): Promise<Terminal> {
    // Return existing terminal
    const existing = this.terminals.get(id);
    if (existing) return existing;

    // Return in-flight creation
    const pending = this.creationPromises.get(id);
    if (pending) return pending;

    // Create with lock
    const promise = this.doCreateTerminal(id);
    this.creationPromises.set(id, promise);

    try {
      const terminal = await promise;
      this.terminals.set(id, terminal);
      return terminal;
    } finally {
      this.creationPromises.delete(id);
    }
  }
}
```

### Pattern RC-002: State Mutation During Async Operation

**Severity**: High
**Detection Difficulty**: Hard

```typescript
// BUG PATTERN
class StateManager {
  private state: AppState;

  async updateState(partial: Partial<AppState>): Promise<void> {
    // RACE: state might change during async operation
    const newState = { ...this.state, ...partial };
    await this.saveState(newState);
    this.state = newState; // Overwrites concurrent changes!
  }
}

// DETECTION: Look for async functions that read then write state
```

**Fix Pattern**:
```typescript
class StateManager {
  private state: AppState;
  private updateLock: Promise<void> = Promise.resolve();

  async updateState(partial: Partial<AppState>): Promise<void> {
    // Serialize state updates
    this.updateLock = this.updateLock.then(async () => {
      const newState = { ...this.state, ...partial };
      await this.saveState(newState);
      this.state = newState;
    });
    return this.updateLock;
  }
}
```

### Pattern RC-003: Promise Without Await in Loop

**Severity**: Medium
**Detection Difficulty**: Medium

```typescript
// BUG PATTERN
async function processItems(items: Item[]): Promise<void> {
  for (const item of items) {
    // All promises fire concurrently - may overwhelm resources
    processItem(item);
  }
}

// DETECTION
// grep -rn "for\|forEach" src/ -A 2 | grep -v "await"
```

**Fix Pattern**:
```typescript
// Sequential processing
async function processItems(items: Item[]): Promise<void> {
  for (const item of items) {
    await processItem(item);
  }
}

// Or controlled concurrency
async function processItems(items: Item[]): Promise<void> {
  const BATCH_SIZE = 5;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(item => processItem(item)));
  }
}
```

## Null/Undefined Patterns

### Pattern NU-001: Missing Null Check After Map.get

**Severity**: High
**Detection Difficulty**: Easy

```typescript
// BUG PATTERN
const terminal = this.terminals.get(id);
terminal.write(data); // Crash if undefined!

// DETECTION
// grep -rn "\.get\(" src/ -A 1 | grep -v "if\|?\."
```

**Fix Pattern**:
```typescript
const terminal = this.terminals.get(id);
if (!terminal) {
  console.warn(`Terminal ${id} not found`);
  return;
}
terminal.write(data);
```

### Pattern NU-002: Optional Property Access Without Check

**Severity**: Medium
**Detection Difficulty**: Easy

```typescript
// BUG PATTERN
interface Config {
  terminal?: {
    fontSize?: number;
  };
}

const fontSize = config.terminal.fontSize; // Crash if terminal undefined!

// DETECTION
// grep -rn "\.\w+\.\w+\.\w+" src/ | grep -v "\?\."
```

**Fix Pattern**:
```typescript
const fontSize = config.terminal?.fontSize ?? DEFAULT_FONT_SIZE;
```

### Pattern NU-003: Array Index Without Bounds Check

**Severity**: Medium
**Detection Difficulty**: Medium

```typescript
// BUG PATTERN
const firstItem = items[0]; // Undefined if array empty
const lastItem = items[items.length - 1]; // Undefined if empty

// DETECTION
// grep -rn "\[\d\+\]\|\[.*length" src/ --include="*.ts"
```

**Fix Pattern**:
```typescript
const firstItem = items[0];
if (firstItem === undefined) {
  throw new Error('Expected at least one item');
}

// Or use optional chaining for arrays
const firstItem = items.at(0);
```

## Error Handling Patterns

### Pattern EH-001: Empty Catch Block

**Severity**: High
**Detection Difficulty**: Easy

```typescript
// BUG PATTERN
try {
  await riskyOperation();
} catch {
  // Silently swallowed!
}

// DETECTION
// grep -rn "catch\s*{" src/ -A 1 | grep -E "catch.*\{\s*\}|catch.*\{\s*$"
```

**Fix Pattern**:
```typescript
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // Either re-throw or handle appropriately
  throw error;
}
```

### Pattern EH-002: Promise Without Catch

**Severity**: High
**Detection Difficulty**: Medium

```typescript
// BUG PATTERN
someAsyncFunction().then(result => {
  processResult(result);
});
// No .catch() - unhandled rejection!

// DETECTION
// grep -rn "\.then\(" src/ | grep -v "\.catch\("
```

**Fix Pattern**:
```typescript
someAsyncFunction()
  .then(result => processResult(result))
  .catch(error => {
    console.error('Async operation failed:', error);
    vscode.window.showErrorMessage(`Operation failed: ${error.message}`);
  });

// Or use async/await
try {
  const result = await someAsyncFunction();
  processResult(result);
} catch (error) {
  console.error('Async operation failed:', error);
}
```

### Pattern EH-003: Async Function Without Try-Catch

**Severity**: Medium
**Detection Difficulty**: Medium

```typescript
// BUG PATTERN
async function activate(context: vscode.ExtensionContext) {
  await initializeServices(); // Unhandled if this throws
  registerCommands(context);
}

// DETECTION
// Analyze async functions for presence of try-catch
```

**Fix Pattern**:
```typescript
async function activate(context: vscode.ExtensionContext) {
  try {
    await initializeServices();
    registerCommands(context);
  } catch (error) {
    console.error('Extension activation failed:', error);
    vscode.window.showErrorMessage(
      `Extension failed to activate: ${error.message}`
    );
    throw error; // Let VS Code know activation failed
  }
}
```

## WebView Patterns

### Pattern WV-001: Message Sent Before Ready

**Severity**: High
**Detection Difficulty**: Hard

```typescript
// BUG PATTERN
class MyPanel {
  constructor() {
    this.panel = vscode.window.createWebviewPanel(...);
    this.panel.webview.html = this.getHtml();
    // BUG: WebView not ready yet!
    this.panel.webview.postMessage({ type: 'init', data: this.getData() });
  }
}

// DETECTION: postMessage called in constructor or immediately after panel creation
```

**Fix Pattern**:
```typescript
class MyPanel {
  private ready = false;
  private messageQueue: Message[] = [];

  constructor() {
    this.panel = vscode.window.createWebviewPanel(...);
    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'ready') {
        this.ready = true;
        this.flushQueue();
      }
    });
  }

  postMessage(message: Message): void {
    if (this.ready) {
      this.panel.webview.postMessage(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length) {
      this.panel.webview.postMessage(this.messageQueue.shift()!);
    }
  }
}
```

### Pattern WV-002: Missing CSP

**Severity**: Critical (Security)
**Detection Difficulty**: Easy

```typescript
// BUG PATTERN
getHtml() {
  return `
    <!DOCTYPE html>
    <html>
      <body>
        <script src="https://external-cdn.com/lib.js"></script>
      </body>
    </html>
  `;
}

// DETECTION
// grep -rn "<!DOCTYPE\|<html" src/ | check for Content-Security-Policy
```

**Fix Pattern**:
```typescript
getHtml(webview: vscode.Webview) {
  const nonce = getNonce();
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="
          default-src 'none';
          style-src ${webview.cspSource};
          script-src 'nonce-${nonce}';
        ">
      </head>
      <body>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>
  `;
}
```

## State Management Patterns

### Pattern SM-001: Stale Closure

**Severity**: Medium
**Detection Difficulty**: Hard

```typescript
// BUG PATTERN
class Component {
  private value = 0;

  setup() {
    setInterval(() => {
      // This closure captures the initial value
      console.log('Value:', this.value);
    }, 1000);
  }

  update(newValue: number) {
    this.value = newValue;
    // The interval still logs the old value!
  }
}

// DETECTION: Look for closures created once that reference mutable state
```

### Pattern SM-002: Inconsistent State Update

**Severity**: High
**Detection Difficulty**: Hard

```typescript
// BUG PATTERN
class FormState {
  private name = '';
  private email = '';
  private isValid = false;

  setName(name: string) {
    this.name = name;
    // BUG: isValid not updated
  }

  setEmail(email: string) {
    this.email = email;
    this.isValid = this.validateEmail(email);
    // BUG: doesn't consider name validation
  }
}

// DETECTION: Look for multiple related state fields updated independently
```

**Fix Pattern**:
```typescript
class FormState {
  private state = {
    name: '',
    email: '',
  };

  private get isValid(): boolean {
    return this.validateName(this.state.name) &&
           this.validateEmail(this.state.email);
  }

  updateField(field: keyof typeof this.state, value: string) {
    this.state[field] = value;
    // isValid is computed, always consistent
  }
}
```

## Security Patterns

### Pattern SEC-001: Command Injection

**Severity**: Critical
**Detection Difficulty**: Medium

```typescript
// BUG PATTERN
async function runCommand(userInput: string) {
  const { exec } = require('child_process');
  exec(`git status ${userInput}`); // Injection vulnerability!
}

// DETECTION
// grep -rn "exec\|spawn\|execSync" src/ | grep -v "execPath"
```

**Fix Pattern**:
```typescript
async function runCommand(userInput: string) {
  const { execFile } = require('child_process');
  // execFile doesn't use shell, prevents injection
  execFile('git', ['status', userInput]);
}
```

### Pattern SEC-002: Path Traversal

**Severity**: Critical
**Detection Difficulty**: Medium

```typescript
// BUG PATTERN
async function readFile(filename: string) {
  const path = `./data/${filename}`;
  return fs.readFileSync(path); // ../../../etc/passwd attack!
}

// DETECTION
// grep -rn "readFile\|writeFile\|readdir" src/ | check for user input in path
```

**Fix Pattern**:
```typescript
async function readFile(filename: string) {
  const basePath = path.resolve('./data');
  const filePath = path.resolve(basePath, filename);

  // Verify path is within allowed directory
  if (!filePath.startsWith(basePath)) {
    throw new Error('Invalid path');
  }

  return fs.readFileSync(filePath);
}
```

### Pattern SEC-003: Substring Security Check

**Severity**: Critical
**Detection Difficulty**: Easy

```typescript
// BUG PATTERN
if (text.includes('github copilot')) {
  // Can be bypassed with 'fakegithub copilotfake'
}

// DETECTION
// grep -rn "\.includes\(" src/ | check for security-sensitive checks
```

**Fix Pattern**:
```typescript
// Use word boundary regex
if (/(^|\s)github copilot(\s|$)/i.test(text)) {
  // Proper word boundary matching
}
```

## Detection Command Summary

```bash
# Memory leaks
grep -rn "addEventListener\|setInterval\|setTimeout" src/ --include="*.ts"
grep -rn "vscode\.\w+\.on\w+\(" src/ --include="*.ts" | grep -v "push\|="

# Race conditions
grep -rn "if.*\.has\|if.*\.get" src/ --include="*.ts" -A 3

# Null/undefined
grep -rn "\.get\(" src/ --include="*.ts" -A 1 | grep -v "if\|?\."

# Error handling
grep -rn "catch\s*{" src/ --include="*.ts" -A 1
grep -rn "\.then\(" src/ --include="*.ts" | grep -v "\.catch\("

# Security
grep -rn "exec\|eval\|innerHTML" src/ --include="*.ts"
grep -rn "\.includes\(" src/ --include="*.ts"

# Code smells
grep -rn "any\|@ts-ignore\|as any" src/ --include="*.ts"
grep -rn "TODO\|FIXME\|HACK\|BUG" src/ --include="*.ts"
```
