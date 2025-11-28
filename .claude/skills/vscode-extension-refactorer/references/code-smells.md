# Code Smell Catalog for VS Code Extensions

## Structural Smells

### 1. God Class

**Indicators**:
- Class exceeds 500 lines
- More than 10 public methods
- Multiple unrelated responsibilities
- High coupling with many other classes

**Example**:
```typescript
// God Class - Does everything
class Extension {
  // Terminal management
  createTerminal(): void { }
  disposeTerminal(): void { }

  // UI management
  updateStatusBar(): void { }
  showPanel(): void { }

  // Configuration
  loadConfig(): void { }
  saveConfig(): void { }

  // File watching
  watchFiles(): void { }
  onFileChange(): void { }

  // Commands
  registerCommands(): void { }
  executeCommand(): void { }
}
```

**Refactoring**:
- Extract Class: Create separate classes for each responsibility
- Use Coordinator pattern to orchestrate

### 2. Long Method

**Indicators**:
- Method exceeds 50 lines
- Multiple levels of nesting
- Multiple sequential responsibilities
- Difficult to test in isolation

**Example**:
```typescript
async function handleMessage(message: Message): Promise<void> {
  // Validation (20 lines)
  if (!message) { throw new Error('No message'); }
  if (!message.type) { throw new Error('No type'); }
  // ... more validation

  // Parsing (15 lines)
  const data = JSON.parse(message.data);
  const config = extractConfig(data);
  // ... more parsing

  // Processing (30 lines)
  switch (message.type) {
    case 'create':
      // 10 lines
      break;
    case 'update':
      // 10 lines
      break;
    // ... more cases
  }

  // Response (10 lines)
  const response = buildResponse(result);
  await sendResponse(response);
}
```

**Refactoring**:
- Extract Method: Create focused methods
- Replace conditional with polymorphism

### 3. Feature Envy

**Indicators**:
- Method uses more data from another class than its own
- Extensive use of getters from other objects
- Logic that should belong to the data's owner

**Example**:
```typescript
class TerminalRenderer {
  render(terminal: Terminal): void {
    // Using lots of Terminal's data
    const cols = terminal.getCols();
    const rows = terminal.getRows();
    const buffer = terminal.getBuffer();
    const cursor = terminal.getCursor();
    const theme = terminal.getTheme();

    // All this logic should be in Terminal
    const width = cols * theme.charWidth;
    const height = rows * theme.lineHeight;
    const content = buffer.slice(0, rows * cols);
    // ...
  }
}
```

**Refactoring**:
- Move Method: Move logic to the class that owns the data
- Extract Method: Create a method on Terminal that does this work

### 4. Data Clumps

**Indicators**:
- Same group of parameters passed together repeatedly
- Related fields always used together
- Parallel arrays or multiple related primitives

**Example**:
```typescript
// Same parameters everywhere
function createTerminal(cols: number, rows: number, scrollback: number): void { }
function resizeTerminal(cols: number, rows: number): void { }
function validateDimensions(cols: number, rows: number): boolean { }
function logDimensions(cols: number, rows: number): void { }
```

**Refactoring**:
- Introduce Parameter Object: Create Dimensions interface
```typescript
interface Dimensions {
  cols: number;
  rows: number;
}

function createTerminal(dimensions: Dimensions, scrollback: number): void { }
function resizeTerminal(dimensions: Dimensions): void { }
```

### 5. Primitive Obsession

**Indicators**:
- Using primitives for domain concepts
- String/number used where object would be clearer
- Type checks using typeof instead of proper types

**Example**:
```typescript
// Using primitives for rich domain concepts
function processTerminal(
  id: number,           // Should be TerminalId
  status: string,       // Should be TerminalStatus enum
  output: string,       // Should be TerminalOutput
  timestamp: number     // Should be Date or Timestamp
): void {
  if (status === 'running') { }  // Magic string
  if (id > 0 && id <= 5) { }     // Magic numbers
}
```

**Refactoring**:
- Replace with Value Object
```typescript
type TerminalId = Brand<number, 'TerminalId'>;
enum TerminalStatus { Idle, Running, Disposing }

interface TerminalOutput {
  content: string;
  timestamp: Date;
  type: 'stdout' | 'stderr';
}

function processTerminal(
  id: TerminalId,
  status: TerminalStatus,
  output: TerminalOutput
): void { }
```

## Coupling Smells

### 6. Inappropriate Intimacy

**Indicators**:
- Class accesses private/internal details of another
- Bidirectional dependencies
- Circular references between classes

**Example**:
```typescript
class TerminalManager {
  private webview: WebviewManager;

  update(): void {
    // Accessing internal state directly
    this.webview._internalState.terminals = this.terminals;
    this.webview._messageQueue.push({ type: 'update' });
  }
}

class WebviewManager {
  _internalState: any;  // Exposed internal state
  _messageQueue: any[]; // Exposed internal queue

  private manager: TerminalManager;  // Circular reference
}
```

**Refactoring**:
- Extract Interface: Define clear public contracts
- Use events/callbacks instead of direct access

### 7. Message Chains

**Indicators**:
- Long chains of method calls: a.b().c().d()
- Navigation through object graph
- Coupling to internal structure

**Example**:
```typescript
// Long chain navigating structure
const output = terminal
  .getProcess()
  .getBuffer()
  .getActiveBuffer()
  .getLine(0)
  .getText();

// Accessing nested configuration
const fontSize = config
  .get('editor')
  .get('terminal')
  .get('font')
  .get('size');
```

**Refactoring**:
- Hide Delegate: Create methods that encapsulate navigation
```typescript
class Terminal {
  getOutputText(): string {
    return this.process.buffer.activeBuffer.getLine(0).getText();
  }
}

// Usage
const output = terminal.getOutputText();
```

### 8. Middle Man

**Indicators**:
- Class that only delegates to another class
- Methods that just forward calls
- No added value or transformation

**Example**:
```typescript
class TerminalProxy {
  private terminal: Terminal;

  write(data: string): void {
    this.terminal.write(data);  // Just forwarding
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);  // Just forwarding
  }

  dispose(): void {
    this.terminal.dispose();  // Just forwarding
  }
}
```

**Refactoring**:
- Remove Middle Man: Use Terminal directly
- Or add real value (logging, validation, transformation)

## Change Smells

### 9. Divergent Change

**Indicators**:
- Class changes for multiple unrelated reasons
- Different features require changes to same class
- Violation of Single Responsibility Principle

**Example**:
```typescript
class Terminal {
  // Changes when terminal behavior changes
  write(data: string): void { }
  resize(cols: number, rows: number): void { }

  // Changes when rendering changes
  render(): HTMLElement { }
  applyTheme(theme: Theme): void { }

  // Changes when persistence changes
  serialize(): string { }
  deserialize(data: string): void { }

  // Changes when configuration changes
  loadConfig(): void { }
  applyConfig(): void { }
}
```

**Refactoring**:
- Extract Class: Separate concerns
```typescript
class Terminal { }           // Core behavior
class TerminalRenderer { }   // Rendering
class TerminalSerializer { } // Persistence
class TerminalConfig { }     // Configuration
```

### 10. Shotgun Surgery

**Indicators**:
- Single change requires edits to many files
- Related logic scattered across codebase
- No central location for a concept

**Example**:
```typescript
// Adding a new message type requires changes in:
// 1. message-types.ts
type MessageType = 'create' | 'write' | 'resize' | 'NEW_TYPE';

// 2. message-handler.ts
switch (message.type) {
  case 'NEW_TYPE': handleNewType(); break;
}

// 3. webview-handler.ts
if (message.type === 'NEW_TYPE') { }

// 4. message-validator.ts
const validators = { 'NEW_TYPE': validateNewType };

// 5. message-logger.ts
const loggers = { 'NEW_TYPE': logNewType };
```

**Refactoring**:
- Move Method: Centralize related logic
- Use polymorphism with handler registry

## Complexity Smells

### 11. Conditional Complexity

**Indicators**:
- Nested if/else statements
- Long switch statements
- Type checking with instanceof/typeof

**Example**:
```typescript
function process(item: unknown): void {
  if (item instanceof Terminal) {
    if (item.isRunning()) {
      if (item.hasOutput()) {
        // Process running terminal with output
      } else {
        // Process running terminal without output
      }
    } else {
      // Process non-running terminal
    }
  } else if (item instanceof WebView) {
    // Different processing
  } else if (typeof item === 'string') {
    // String processing
  }
}
```

**Refactoring**:
- Replace Conditional with Polymorphism
- Use Strategy pattern
- Introduce Guard Clauses

### 12. Parallel Inheritance

**Indicators**:
- Creating subclass in one hierarchy requires subclass in another
- Mirror class structures
- Coupled hierarchies

**Example**:
```typescript
// Every terminal type needs a renderer type
class BashTerminal extends Terminal { }
class BashTerminalRenderer extends TerminalRenderer { }

class ZshTerminal extends Terminal { }
class ZshTerminalRenderer extends TerminalRenderer { }

class PowerShellTerminal extends Terminal { }
class PowerShellTerminalRenderer extends TerminalRenderer { }
```

**Refactoring**:
- Collapse Hierarchy: Merge if possible
- Use composition over inheritance
```typescript
class Terminal {
  constructor(
    private shell: ShellAdapter,
    private renderer: TerminalRenderer
  ) { }
}
```

## Naming Smells

### 13. Inconsistent Naming

**Indicators**:
- Similar concepts with different names
- Mixed naming conventions
- Unclear abbreviations

**Example**:
```typescript
// Inconsistent naming for similar concepts
class TerminalMgr { }      // Abbreviated
class WebviewManager { }   // Full word
class UICtrl { }           // Different abbreviation

// Mixed conventions
function getTerminal(): Terminal { }
function fetchWebview(): Webview { }
function retrieveConfig(): Config { }

// Unclear abbreviations
const termProc = getTermProc();  // What's Proc?
const wvMsgQ = new WvMsgQ();     // What's Wv? MsgQ?
```

**Refactoring**:
- Rename consistently
- Use full words or standardized abbreviations
- Follow project naming conventions

### 14. Comments as Deodorant

**Indicators**:
- Comments explaining what code does
- Comments apologizing for code
- TODO comments that never get done

**Example**:
```typescript
// Calculate the terminal size based on container
// dimensions and font metrics
function calc(c: HTMLElement, f: Font): { w: number; h: number } {
  // w is width, h is height
  const w = c.clientWidth / f.charWidth;
  const h = c.clientHeight / f.lineHeight;
  return { w, h };
}

// HACK: This fixes the weird bug
// TODO: Refactor this mess someday
```

**Refactoring**:
- Rename to be self-documenting
- Extract Method with descriptive name
```typescript
function calculateTerminalDimensions(
  container: HTMLElement,
  fontMetrics: FontMetrics
): TerminalDimensions {
  return {
    cols: Math.floor(container.clientWidth / fontMetrics.charWidth),
    rows: Math.floor(container.clientHeight / fontMetrics.lineHeight)
  };
}
```

## Performance Smells

### 15. Unnecessary Computation

**Indicators**:
- Same value calculated multiple times
- Expensive operations in loops
- No caching of stable values

**Example**:
```typescript
function render(terminals: Terminal[]): void {
  for (const terminal of terminals) {
    // Calculated every iteration
    const config = vscode.workspace.getConfiguration('terminal');
    const theme = loadTheme(config.get('theme'));
    const fontMetrics = measureFont(config.get('fontFamily'));

    terminal.render(theme, fontMetrics);
  }
}
```

**Refactoring**:
- Cache calculations
- Move invariants outside loops
```typescript
function render(terminals: Terminal[]): void {
  // Calculate once
  const config = vscode.workspace.getConfiguration('terminal');
  const theme = loadTheme(config.get('theme'));
  const fontMetrics = measureFont(config.get('fontFamily'));

  for (const terminal of terminals) {
    terminal.render(theme, fontMetrics);
  }
}
```

### 16. Memory Leaks

**Indicators**:
- Event listeners without cleanup
- Closures capturing large objects
- Growing collections without bounds

**Example**:
```typescript
class Terminal {
  private history: string[] = [];  // Unbounded growth

  constructor() {
    // Listener never removed
    vscode.workspace.onDidChangeConfiguration(() => {
      this.refresh();
    });

    // Timer never cleared
    setInterval(() => this.save(), 1000);
  }

  write(data: string): void {
    this.history.push(data);  // Never trimmed
  }
}
```

**Refactoring**:
- Add dispose handlers
- Bound collection sizes
- Track and clean up resources
