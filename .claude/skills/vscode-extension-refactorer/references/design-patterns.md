# VS Code Extension Design Patterns

## Creational Patterns

### Factory Pattern

Create objects without exposing instantiation logic.

```typescript
// Factory for creating different terminal types
interface ITerminal {
  write(data: string): void;
  dispose(): void;
}

class TerminalFactory {
  static create(type: 'local' | 'remote' | 'virtual'): ITerminal {
    switch (type) {
      case 'local':
        return new LocalTerminal();
      case 'remote':
        return new RemoteTerminal();
      case 'virtual':
        return new VirtualTerminal();
      default:
        throw new Error(`Unknown terminal type: ${type}`);
    }
  }

  // Factory method with configuration
  static createFromConfig(config: TerminalConfig): ITerminal {
    const type = config.isRemote ? 'remote' : 'local';
    const terminal = this.create(type);
    terminal.applyConfig(config);
    return terminal;
  }
}

// Usage
const terminal = TerminalFactory.create('local');
const configuredTerminal = TerminalFactory.createFromConfig(config);
```

### Builder Pattern

Construct complex objects step by step.

```typescript
class TerminalBuilder {
  private options: Partial<TerminalOptions> = {};

  shell(path: string): this {
    this.options.shell = path;
    return this;
  }

  cwd(path: string): this {
    this.options.cwd = path;
    return this;
  }

  env(env: Record<string, string>): this {
    this.options.env = { ...this.options.env, ...env };
    return this;
  }

  dimensions(cols: number, rows: number): this {
    this.options.dimensions = { cols, rows };
    return this;
  }

  scrollback(lines: number): this {
    this.options.scrollback = lines;
    return this;
  }

  name(name: string): this {
    this.options.name = name;
    return this;
  }

  build(): Terminal {
    this.validateOptions();
    return new Terminal(this.options as TerminalOptions);
  }

  private validateOptions(): void {
    if (!this.options.shell) {
      throw new Error('Shell is required');
    }
  }
}

// Usage - fluent API
const terminal = new TerminalBuilder()
  .shell('/bin/bash')
  .cwd('/home/user')
  .env({ NODE_ENV: 'development' })
  .dimensions(120, 40)
  .scrollback(5000)
  .name('Dev Terminal')
  .build();
```

### Singleton Pattern

Ensure a class has only one instance.

```typescript
class TerminalManager {
  private static instance: TerminalManager | undefined;
  private terminals: Map<number, Terminal> = new Map();

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  // For testing - allow instance reset
  static resetInstance(): void {
    TerminalManager.instance?.dispose();
    TerminalManager.instance = undefined;
  }

  createTerminal(): Terminal {
    const terminal = new Terminal();
    this.terminals.set(terminal.id, terminal);
    return terminal;
  }

  dispose(): void {
    this.terminals.forEach(t => t.dispose());
    this.terminals.clear();
  }
}

// Usage
const manager = TerminalManager.getInstance();
const terminal = manager.createTerminal();
```

## Structural Patterns

### Adapter Pattern

Make incompatible interfaces work together.

```typescript
// VS Code's terminal interface
interface VSCodeTerminal {
  sendText(text: string, addNewLine?: boolean): void;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

// Our internal interface
interface ITerminal {
  write(data: string): void;
  writeLine(data: string): void;
  focus(): void;
  blur(): void;
  close(): void;
}

// Adapter to make VS Code terminal work with our interface
class VSCodeTerminalAdapter implements ITerminal {
  constructor(private terminal: VSCodeTerminal) {}

  write(data: string): void {
    this.terminal.sendText(data, false);
  }

  writeLine(data: string): void {
    this.terminal.sendText(data, true);
  }

  focus(): void {
    this.terminal.show(false);
  }

  blur(): void {
    this.terminal.show(true);  // preserveFocus = true
  }

  close(): void {
    this.terminal.dispose();
  }
}

// Usage
const vscodeTerminal = vscode.window.createTerminal('My Terminal');
const terminal: ITerminal = new VSCodeTerminalAdapter(vscodeTerminal);
terminal.writeLine('Hello World');
```

### Decorator Pattern

Add behavior to objects dynamically.

```typescript
interface ITerminal {
  write(data: string): void;
  dispose(): void;
}

class BaseTerminal implements ITerminal {
  write(data: string): void {
    // Basic write implementation
  }
  dispose(): void { }
}

// Decorator base class
abstract class TerminalDecorator implements ITerminal {
  constructor(protected terminal: ITerminal) {}

  write(data: string): void {
    this.terminal.write(data);
  }

  dispose(): void {
    this.terminal.dispose();
  }
}

// Logging decorator
class LoggingTerminal extends TerminalDecorator {
  write(data: string): void {
    console.log(`[Terminal] Writing: ${data.substring(0, 50)}...`);
    super.write(data);
  }
}

// Buffering decorator
class BufferedTerminal extends TerminalDecorator {
  private buffer: string[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(terminal: ITerminal, flushMs: number = 16) {
    super(terminal);
    this.flushInterval = setInterval(() => this.flush(), flushMs);
  }

  write(data: string): void {
    this.buffer.push(data);
  }

  private flush(): void {
    if (this.buffer.length > 0) {
      super.write(this.buffer.join(''));
      this.buffer = [];
    }
  }

  dispose(): void {
    clearInterval(this.flushInterval);
    this.flush();
    super.dispose();
  }
}

// Metrics decorator
class MetricsTerminal extends TerminalDecorator {
  private bytesWritten = 0;
  private writeCount = 0;

  write(data: string): void {
    this.bytesWritten += data.length;
    this.writeCount++;
    super.write(data);
  }

  getMetrics(): { bytes: number; writes: number } {
    return { bytes: this.bytesWritten, writes: this.writeCount };
  }
}

// Usage - stack decorators
let terminal: ITerminal = new BaseTerminal();
terminal = new BufferedTerminal(terminal, 16);
terminal = new LoggingTerminal(terminal);
terminal = new MetricsTerminal(terminal);

terminal.write('Hello');  // Logged, buffered, metrics tracked
```

### Facade Pattern

Provide a simplified interface to a complex subsystem.

```typescript
// Complex subsystems
class TerminalProcess {
  spawn(shell: string, args: string[]): void { }
  write(data: string): void { }
  resize(cols: number, rows: number): void { }
  kill(): void { }
}

class TerminalRenderer {
  initialize(container: HTMLElement): void { }
  render(buffer: string): void { }
  setTheme(theme: Theme): void { }
  dispose(): void { }
}

class TerminalSerializer {
  serialize(state: TerminalState): string { }
  deserialize(data: string): TerminalState { }
  saveToStorage(state: TerminalState): Promise<void> { }
  loadFromStorage(): Promise<TerminalState | undefined> { }
}

class TerminalConfig {
  getShell(): string { }
  getTheme(): Theme { }
  getDimensions(): { cols: number; rows: number } { }
}

// Facade provides simple interface
class TerminalFacade {
  private process: TerminalProcess;
  private renderer: TerminalRenderer;
  private serializer: TerminalSerializer;
  private config: TerminalConfig;

  constructor(container: HTMLElement) {
    this.config = new TerminalConfig();
    this.process = new TerminalProcess();
    this.renderer = new TerminalRenderer();
    this.serializer = new TerminalSerializer();

    this.initialize(container);
  }

  private initialize(container: HTMLElement): void {
    const shell = this.config.getShell();
    const theme = this.config.getTheme();
    const { cols, rows } = this.config.getDimensions();

    this.renderer.initialize(container);
    this.renderer.setTheme(theme);
    this.process.spawn(shell, []);
    this.process.resize(cols, rows);
  }

  // Simple public API
  write(data: string): void {
    this.process.write(data);
  }

  async save(): Promise<void> {
    const state = this.getState();
    await this.serializer.saveToStorage(state);
  }

  async restore(): Promise<boolean> {
    const state = await this.serializer.loadFromStorage();
    if (state) {
      this.applyState(state);
      return true;
    }
    return false;
  }

  dispose(): void {
    this.process.kill();
    this.renderer.dispose();
  }

  private getState(): TerminalState { /* ... */ }
  private applyState(state: TerminalState): void { /* ... */ }
}

// Usage - simple interface
const terminal = new TerminalFacade(container);
terminal.write('npm install');
await terminal.save();
terminal.dispose();
```

### Composite Pattern

Treat individual objects and compositions uniformly.

```typescript
interface ITerminalComponent {
  render(): void;
  dispose(): void;
  focus(): void;
}

// Leaf: Individual terminal
class Terminal implements ITerminalComponent {
  render(): void {
    // Render single terminal
  }

  dispose(): void {
    // Dispose single terminal
  }

  focus(): void {
    // Focus single terminal
  }
}

// Composite: Split container
class SplitContainer implements ITerminalComponent {
  private children: ITerminalComponent[] = [];
  private orientation: 'horizontal' | 'vertical';

  constructor(orientation: 'horizontal' | 'vertical') {
    this.orientation = orientation;
  }

  add(component: ITerminalComponent): void {
    this.children.push(component);
  }

  remove(component: ITerminalComponent): void {
    const index = this.children.indexOf(component);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  render(): void {
    // Render container with children
    this.children.forEach(child => child.render());
  }

  dispose(): void {
    this.children.forEach(child => child.dispose());
    this.children = [];
  }

  focus(): void {
    // Focus first child
    if (this.children.length > 0) {
      this.children[0].focus();
    }
  }
}

// Usage - build terminal layout
const root = new SplitContainer('horizontal');
const leftTerminal = new Terminal();
const rightSplit = new SplitContainer('vertical');
const topTerminal = new Terminal();
const bottomTerminal = new Terminal();

root.add(leftTerminal);
root.add(rightSplit);
rightSplit.add(topTerminal);
rightSplit.add(bottomTerminal);

// Treat uniformly
root.render();   // Renders all terminals
root.dispose();  // Disposes all terminals
```

## Behavioral Patterns

### Observer Pattern (Event Emitter)

Define subscription mechanism for events.

```typescript
type EventMap = {
  'terminal:created': { id: number };
  'terminal:disposed': { id: number };
  'terminal:output': { id: number; data: string };
  'terminal:error': { id: number; error: Error };
};

class TerminalEventEmitter {
  private listeners = new Map<keyof EventMap, Set<Function>>();

  on<K extends keyof EventMap>(
    event: K,
    callback: (data: EventMap[K]) => void
  ): vscode.Disposable {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return {
      dispose: () => {
        this.listeners.get(event)?.delete(callback);
      }
    };
  }

  once<K extends keyof EventMap>(
    event: K,
    callback: (data: EventMap[K]) => void
  ): vscode.Disposable {
    const disposable = this.on(event, (data) => {
      disposable.dispose();
      callback(data);
    });
    return disposable;
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  dispose(): void {
    this.listeners.clear();
  }
}

// Usage
const emitter = new TerminalEventEmitter();

const subscription = emitter.on('terminal:output', ({ id, data }) => {
  console.log(`Terminal ${id}: ${data}`);
});

emitter.emit('terminal:output', { id: 1, data: 'Hello World' });

subscription.dispose();  // Cleanup
```

### Strategy Pattern

Define family of algorithms and make them interchangeable.

```typescript
// Strategy interface
interface IScrollbackStrategy {
  save(buffer: string[]): string;
  restore(data: string): string[];
  getMaxSize(): number;
}

// Concrete strategies
class CompressedScrollback implements IScrollbackStrategy {
  save(buffer: string[]): string {
    const content = buffer.join('\n');
    return compress(content);  // Use compression
  }

  restore(data: string): string[] {
    const content = decompress(data);
    return content.split('\n');
  }

  getMaxSize(): number {
    return 100000;  // Can store more when compressed
  }
}

class PlainScrollback implements IScrollbackStrategy {
  save(buffer: string[]): string {
    return buffer.join('\n');
  }

  restore(data: string): string[] {
    return data.split('\n');
  }

  getMaxSize(): number {
    return 10000;  // Less storage without compression
  }
}

class TruncatedScrollback implements IScrollbackStrategy {
  constructor(private maxLines: number = 1000) {}

  save(buffer: string[]): string {
    const truncated = buffer.slice(-this.maxLines);
    return truncated.join('\n');
  }

  restore(data: string): string[] {
    return data.split('\n');
  }

  getMaxSize(): number {
    return this.maxLines;
  }
}

// Context
class Terminal {
  private scrollbackStrategy: IScrollbackStrategy;

  constructor(strategy?: IScrollbackStrategy) {
    this.scrollbackStrategy = strategy ?? new PlainScrollback();
  }

  setScrollbackStrategy(strategy: IScrollbackStrategy): void {
    this.scrollbackStrategy = strategy;
  }

  saveScrollback(): string {
    return this.scrollbackStrategy.save(this.buffer);
  }

  restoreScrollback(data: string): void {
    this.buffer = this.scrollbackStrategy.restore(data);
  }
}

// Usage - swap strategies
const terminal = new Terminal();

// Use compression for large outputs
if (expectedOutput > 50000) {
  terminal.setScrollbackStrategy(new CompressedScrollback());
} else {
  terminal.setScrollbackStrategy(new PlainScrollback());
}
```

### Command Pattern

Encapsulate requests as objects.

```typescript
// Command interface
interface ICommand {
  execute(): void;
  undo(): void;
}

// Concrete commands
class CreateTerminalCommand implements ICommand {
  private createdTerminal?: Terminal;

  constructor(private manager: TerminalManager) {}

  execute(): void {
    this.createdTerminal = this.manager.createTerminal();
  }

  undo(): void {
    if (this.createdTerminal) {
      this.manager.disposeTerminal(this.createdTerminal.id);
      this.createdTerminal = undefined;
    }
  }
}

class WriteCommand implements ICommand {
  private previousContent?: string;

  constructor(
    private terminal: Terminal,
    private data: string
  ) {}

  execute(): void {
    this.previousContent = this.terminal.getContent();
    this.terminal.write(this.data);
  }

  undo(): void {
    if (this.previousContent !== undefined) {
      this.terminal.setContent(this.previousContent);
    }
  }
}

class ResizeCommand implements ICommand {
  private previousDimensions?: { cols: number; rows: number };

  constructor(
    private terminal: Terminal,
    private cols: number,
    private rows: number
  ) {}

  execute(): void {
    this.previousDimensions = this.terminal.getDimensions();
    this.terminal.resize(this.cols, this.rows);
  }

  undo(): void {
    if (this.previousDimensions) {
      this.terminal.resize(
        this.previousDimensions.cols,
        this.previousDimensions.rows
      );
    }
  }
}

// Command invoker with history
class CommandHistory {
  private history: ICommand[] = [];
  private position = -1;

  execute(command: ICommand): void {
    // Remove any commands after current position (for redo)
    this.history = this.history.slice(0, this.position + 1);

    command.execute();
    this.history.push(command);
    this.position++;
  }

  undo(): boolean {
    if (this.position >= 0) {
      this.history[this.position].undo();
      this.position--;
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this.position < this.history.length - 1) {
      this.position++;
      this.history[this.position].execute();
      return true;
    }
    return false;
  }
}

// Usage
const history = new CommandHistory();

history.execute(new CreateTerminalCommand(manager));
history.execute(new WriteCommand(terminal, 'Hello'));
history.execute(new ResizeCommand(terminal, 120, 40));

history.undo();  // Undo resize
history.undo();  // Undo write
history.redo();  // Redo write
```

### State Pattern

Allow object to alter behavior when state changes.

```typescript
// State interface
interface ITerminalState {
  write(terminal: Terminal, data: string): void;
  resize(terminal: Terminal, cols: number, rows: number): void;
  dispose(terminal: Terminal): void;
}

// Concrete states
class IdleState implements ITerminalState {
  write(terminal: Terminal, data: string): void {
    terminal.setState(new RunningState());
    terminal.getProcess().write(data);
  }

  resize(terminal: Terminal, cols: number, rows: number): void {
    // Queue resize for when terminal starts
    terminal.queueResize(cols, rows);
  }

  dispose(terminal: Terminal): void {
    terminal.setState(new DisposedState());
  }
}

class RunningState implements ITerminalState {
  write(terminal: Terminal, data: string): void {
    terminal.getProcess().write(data);
  }

  resize(terminal: Terminal, cols: number, rows: number): void {
    terminal.getProcess().resize(cols, rows);
  }

  dispose(terminal: Terminal): void {
    terminal.setState(new DisposingState());
    terminal.getProcess().kill();
  }
}

class DisposingState implements ITerminalState {
  write(terminal: Terminal, data: string): void {
    console.warn('Cannot write to disposing terminal');
  }

  resize(terminal: Terminal, cols: number, rows: number): void {
    console.warn('Cannot resize disposing terminal');
  }

  dispose(terminal: Terminal): void {
    // Already disposing
  }
}

class DisposedState implements ITerminalState {
  write(terminal: Terminal, data: string): void {
    throw new Error('Terminal is disposed');
  }

  resize(terminal: Terminal, cols: number, rows: number): void {
    throw new Error('Terminal is disposed');
  }

  dispose(terminal: Terminal): void {
    // Already disposed
  }
}

// Context
class Terminal {
  private state: ITerminalState = new IdleState();

  setState(state: ITerminalState): void {
    this.state = state;
  }

  write(data: string): void {
    this.state.write(this, data);
  }

  resize(cols: number, rows: number): void {
    this.state.resize(this, cols, rows);
  }

  dispose(): void {
    this.state.dispose(this);
  }
}
```

### Mediator Pattern (Coordinator)

Define object that encapsulates how objects interact.

```typescript
// Mediator interface
interface ICoordinator {
  notify(sender: IManager, event: string, data?: unknown): void;
  getManager<T extends IManager>(name: string): T;
}

// Colleague interface
interface IManager {
  setCoordinator(coordinator: ICoordinator): void;
}

// Concrete mediator
class TerminalCoordinator implements ICoordinator {
  private managers = new Map<string, IManager>();

  registerManager(name: string, manager: IManager): void {
    this.managers.set(name, manager);
    manager.setCoordinator(this);
  }

  getManager<T extends IManager>(name: string): T {
    return this.managers.get(name) as T;
  }

  notify(sender: IManager, event: string, data?: unknown): void {
    // Coordinate interactions between managers
    switch (event) {
      case 'terminal:created':
        this.getManager<UIManager>('ui').updateTerminalCount();
        this.getManager<PersistenceManager>('persistence').saveState();
        break;

      case 'terminal:output':
        this.getManager<PerformanceManager>('performance').buffer(data);
        break;

      case 'theme:changed':
        this.getManager<UIManager>('ui').applyTheme(data as Theme);
        this.getManager<TerminalManager>('terminal').refreshAll();
        break;

      case 'config:changed':
        this.getManager<TerminalManager>('terminal').applyConfig();
        this.getManager<UIManager>('ui').refresh();
        break;
    }
  }
}

// Concrete colleagues
class TerminalManager implements IManager {
  private coordinator!: ICoordinator;

  setCoordinator(coordinator: ICoordinator): void {
    this.coordinator = coordinator;
  }

  createTerminal(): Terminal {
    const terminal = new Terminal();
    this.coordinator.notify(this, 'terminal:created', { id: terminal.id });
    return terminal;
  }
}

class UIManager implements IManager {
  private coordinator!: ICoordinator;

  setCoordinator(coordinator: ICoordinator): void {
    this.coordinator = coordinator;
  }

  changeTheme(theme: Theme): void {
    this.coordinator.notify(this, 'theme:changed', theme);
  }

  updateTerminalCount(): void {
    // Update UI
  }
}

// Usage
const coordinator = new TerminalCoordinator();
coordinator.registerManager('terminal', new TerminalManager());
coordinator.registerManager('ui', new UIManager());
coordinator.registerManager('performance', new PerformanceManager());
coordinator.registerManager('persistence', new PersistenceManager());
```
