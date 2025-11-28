# Advanced TypeScript Type Patterns

## Type Safety Patterns

### Branded Types

Prevent mixing up primitive types with similar underlying values.

```typescript
// Create branded type
declare const brand: unique symbol;
type Brand<T, B> = T & { [brand]: B };

// Define branded types
type TerminalId = Brand<number, 'TerminalId'>;
type SessionId = Brand<string, 'SessionId'>;
type Milliseconds = Brand<number, 'Milliseconds'>;
type Bytes = Brand<number, 'Bytes'>;

// Type-safe constructors
function createTerminalId(id: number): TerminalId {
  if (id < 1 || id > 5) {
    throw new Error(`Invalid terminal ID: ${id}`);
  }
  return id as TerminalId;
}

function createSessionId(id: string): SessionId {
  if (!id.match(/^[a-f0-9-]{36}$/)) {
    throw new Error(`Invalid session ID: ${id}`);
  }
  return id as SessionId;
}

// Usage - compiler prevents mixing
function getTerminal(id: TerminalId): Terminal { }
function getSession(id: SessionId): Session { }

const terminalId = createTerminalId(1);
const sessionId = createSessionId('abc-123-def');

getTerminal(terminalId);  // OK
getTerminal(sessionId);   // Error: Argument of type 'SessionId' is not assignable to 'TerminalId'
getTerminal(1);           // Error: Argument of type 'number' is not assignable to 'TerminalId'
```

### Discriminated Unions

Type-safe handling of different states.

```typescript
// State machine with discriminated unions
type TerminalState =
  | { status: 'idle' }
  | { status: 'initializing'; progress: number }
  | { status: 'running'; pid: number; startTime: Date }
  | { status: 'paused'; resumeCallback: () => void }
  | { status: 'error'; error: Error; recoverable: boolean }
  | { status: 'disposed' };

// Type-safe state handling
function renderState(state: TerminalState): string {
  switch (state.status) {
    case 'idle':
      return 'Terminal ready';

    case 'initializing':
      return `Loading... ${state.progress}%`;  // progress is available

    case 'running':
      return `PID: ${state.pid}, started: ${state.startTime}`;  // pid and startTime available

    case 'paused':
      return 'Paused';  // resumeCallback available for resume button

    case 'error':
      if (state.recoverable) {  // recoverable is available
        return `Error (recoverable): ${state.error.message}`;
      }
      return `Fatal error: ${state.error.message}`;

    case 'disposed':
      return 'Disposed';

    default:
      // Exhaustive check - TypeScript error if case is missing
      const _exhaustive: never = state;
      throw new Error(`Unhandled state: ${_exhaustive}`);
  }
}

// Message types with discriminated unions
type Message =
  | { type: 'create'; config: TerminalConfig }
  | { type: 'write'; terminalId: number; data: string }
  | { type: 'resize'; terminalId: number; cols: number; rows: number }
  | { type: 'dispose'; terminalId: number }
  | { type: 'batch'; messages: Message[] };

function handleMessage(message: Message): void {
  switch (message.type) {
    case 'create':
      createTerminal(message.config);  // config available
      break;
    case 'write':
      writeToTerminal(message.terminalId, message.data);
      break;
    case 'resize':
      resizeTerminal(message.terminalId, message.cols, message.rows);
      break;
    case 'dispose':
      disposeTerminal(message.terminalId);
      break;
    case 'batch':
      message.messages.forEach(handleMessage);  // Recursive
      break;
  }
}
```

### Type Guards

Narrow types at runtime with type safety.

```typescript
// Custom type guards
interface Terminal {
  id: number;
  write(data: string): void;
}

interface RemoteTerminal extends Terminal {
  host: string;
  port: number;
  connect(): Promise<void>;
}

interface VirtualTerminal extends Terminal {
  replay(commands: string[]): void;
}

// Type guard functions
function isRemoteTerminal(terminal: Terminal): terminal is RemoteTerminal {
  return 'host' in terminal && 'port' in terminal;
}

function isVirtualTerminal(terminal: Terminal): terminal is VirtualTerminal {
  return 'replay' in terminal;
}

// Usage with type narrowing
function processTerminal(terminal: Terminal): void {
  if (isRemoteTerminal(terminal)) {
    // TypeScript knows terminal is RemoteTerminal here
    console.log(`Connecting to ${terminal.host}:${terminal.port}`);
    terminal.connect();
  } else if (isVirtualTerminal(terminal)) {
    // TypeScript knows terminal is VirtualTerminal here
    terminal.replay(['ls', 'pwd']);
  } else {
    // Regular terminal
    terminal.write('Hello');
  }
}

// Assertion type guard
function assertTerminal(value: unknown): asserts value is Terminal {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Not an object');
  }
  if (!('id' in value) || typeof value.id !== 'number') {
    throw new Error('Missing id');
  }
  if (!('write' in value) || typeof value.write !== 'function') {
    throw new Error('Missing write function');
  }
}

// Usage - type is narrowed after assertion
function handleUnknown(value: unknown): void {
  assertTerminal(value);
  // TypeScript knows value is Terminal here
  value.write('Hello');
}
```

### Template Literal Types

Create precise string type patterns.

```typescript
// Command pattern types
type Command =
  | `terminal:${'create' | 'dispose' | 'focus'}`
  | `editor:${'open' | 'close' | 'save'}`
  | `view:${'show' | 'hide'}`;

// Event types
type TerminalEvent =
  | `terminal.${number}.created`
  | `terminal.${number}.disposed`
  | `terminal.${number}.output`;

// CSS class names
type TerminalClass =
  | `terminal-${number}`
  | `terminal-${'active' | 'inactive' | 'focused'}`;

// Configuration paths
type ConfigPath =
  | `terminal.${string}`
  | `editor.${string}`
  | `workbench.${string}`;

// Type-safe event emitter
type EventHandlers = {
  [K in TerminalEvent]: (data: unknown) => void;
};

function on<E extends TerminalEvent>(
  event: E,
  handler: EventHandlers[E]
): void {
  // ...
}

// Usage
on('terminal.1.created', (data) => { });  // OK
on('terminal.2.output', (data) => { });   // OK
on('terminal.invalid', (data) => { });    // Error: not a valid event
```

## Utility Type Patterns

### Deep Readonly

Make nested objects immutable.

```typescript
type DeepReadonly<T> = T extends (infer U)[]
  ? DeepReadonlyArray<U>
  : T extends object
  ? DeepReadonlyObject<T>
  : T;

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

// Usage
interface TerminalConfig {
  shell: string;
  env: {
    PATH: string;
    HOME: string;
  };
  dimensions: {
    cols: number;
    rows: number;
  };
}

type ImmutableConfig = DeepReadonly<TerminalConfig>;

const config: ImmutableConfig = {
  shell: '/bin/bash',
  env: { PATH: '/usr/bin', HOME: '/home' },
  dimensions: { cols: 80, rows: 24 }
};

config.shell = 'zsh';              // Error: readonly
config.env.PATH = '/usr/local';    // Error: nested readonly
config.dimensions.cols = 120;      // Error: nested readonly
```

### Deep Partial

Make nested properties optional.

```typescript
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

// Usage for configuration updates
interface TerminalOptions {
  shell: string;
  env: Record<string, string>;
  rendering: {
    fontFamily: string;
    fontSize: number;
    theme: {
      background: string;
      foreground: string;
    };
  };
}

function updateOptions(updates: DeepPartial<TerminalOptions>): void {
  // Can update any nested subset
}

// Partial updates at any level
updateOptions({ shell: '/bin/zsh' });
updateOptions({ rendering: { fontSize: 14 } });
updateOptions({ rendering: { theme: { background: '#000' } } });
```

### Strict Omit

Omit with type checking for key existence.

```typescript
type StrictOmit<T, K extends keyof T> = Omit<T, K>;

interface Terminal {
  id: number;
  name: string;
  shell: string;
  dispose(): void;
}

// Standard Omit allows invalid keys
type BadOmit = Omit<Terminal, 'invalid'>;  // No error!

// StrictOmit catches errors
type GoodOmit = StrictOmit<Terminal, 'id'>;           // OK
type BadStrictOmit = StrictOmit<Terminal, 'invalid'>; // Error!
```

### Required Keys

Make specific keys required while keeping others optional.

```typescript
type RequiredKeys<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

interface TerminalOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  name?: string;
}

// Require shell and cwd, keep others optional
type RequiredTerminalOptions = RequiredKeys<TerminalOptions, 'shell' | 'cwd'>;

const options: RequiredTerminalOptions = {
  shell: '/bin/bash',  // Required
  cwd: '/home',        // Required
  // name and env are still optional
};
```

### Pick with Rename

Pick and rename keys simultaneously.

```typescript
type PickAndRename<T, M extends Record<string, keyof T>> = {
  [K in keyof M]: T[M[K]];
};

interface InternalTerminal {
  terminalId: number;
  terminalName: string;
  processId: number;
}

// Create public API with cleaner names
type PublicTerminal = PickAndRename<InternalTerminal, {
  id: 'terminalId';
  name: 'terminalName';
  pid: 'processId';
}>;

// Result: { id: number; name: string; pid: number; }
```

## Advanced Patterns

### Builder Type Pattern

Type-safe builder with method chaining.

```typescript
type BuilderState = {
  shell: boolean;
  cwd: boolean;
  env: boolean;
};

type RequiredState = {
  shell: true;
  cwd: true;
  env: boolean;  // Optional
};

class TerminalBuilder<State extends BuilderState = { shell: false; cwd: false; env: false }> {
  private options: Partial<TerminalOptions> = {};

  shell(path: string): TerminalBuilder<State & { shell: true }> {
    this.options.shell = path;
    return this as any;
  }

  cwd(path: string): TerminalBuilder<State & { cwd: true }> {
    this.options.cwd = path;
    return this as any;
  }

  env(env: Record<string, string>): TerminalBuilder<State & { env: true }> {
    this.options.env = env;
    return this as any;
  }

  // build() only available when required fields are set
  build(this: TerminalBuilder<RequiredState>): Terminal {
    return new Terminal(this.options as TerminalOptions);
  }
}

// Usage
const builder = new TerminalBuilder();

builder.build();  // Error: missing shell and cwd

builder
  .shell('/bin/bash')
  .build();  // Error: missing cwd

builder
  .shell('/bin/bash')
  .cwd('/home')
  .build();  // OK!

builder
  .shell('/bin/bash')
  .cwd('/home')
  .env({ PATH: '/usr/bin' })
  .build();  // OK!
```

### Conditional Types

Type transformations based on conditions.

```typescript
// Extract return type of async functions
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type Result = UnwrapPromise<Promise<string>>;  // string
type Same = UnwrapPromise<number>;             // number

// Extract element type from arrays
type UnwrapArray<T> = T extends (infer U)[] ? U : T;

type Element = UnwrapArray<string[]>;  // string
type Same = UnwrapArray<number>;       // number

// Conditional property types
type MessagePayload<T extends string> =
  T extends 'create' ? { config: TerminalConfig } :
  T extends 'write' ? { terminalId: number; data: string } :
  T extends 'resize' ? { terminalId: number; cols: number; rows: number } :
  T extends 'dispose' ? { terminalId: number } :
  never;

function sendMessage<T extends string>(
  type: T,
  payload: MessagePayload<T>
): void {
  // ...
}

// Type-safe calls
sendMessage('create', { config: terminalConfig });  // OK
sendMessage('write', { terminalId: 1, data: 'hello' });  // OK
sendMessage('write', { config: terminalConfig });  // Error: wrong payload type
```

### Mapped Types with Modifiers

Transform type properties.

```typescript
// Make all properties mutable (remove readonly)
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// Make all properties required (remove optional)
type RequiredAll<T> = {
  [P in keyof T]-?: T[P];
};

// Add prefix to all property names
type Prefixed<T, Prefix extends string> = {
  [K in keyof T as `${Prefix}${Capitalize<string & K>}`]: T[K];
};

interface TerminalState {
  readonly id: number;
  name?: string;
  running: boolean;
}

type MutableState = Mutable<TerminalState>;
// { id: number; name?: string; running: boolean; }

type RequiredState = RequiredAll<TerminalState>;
// { readonly id: number; name: string; running: boolean; }

type PrefixedState = Prefixed<TerminalState, 'terminal'>;
// { terminalId: number; terminalName?: string; terminalRunning: boolean; }
```

### Recursive Types

Types that reference themselves.

```typescript
// JSON type
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// Tree structure
interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];
}

// Nested configuration
type NestedConfig = {
  [key: string]: string | number | boolean | NestedConfig;
};

// Path type for nested objects
type Path<T, Key extends keyof T = keyof T> =
  Key extends string
    ? T[Key] extends Record<string, any>
      ? Key | `${Key}.${Path<T[Key]>}`
      : Key
    : never;

interface Config {
  terminal: {
    shell: string;
    font: {
      family: string;
      size: number;
    };
  };
  editor: {
    theme: string;
  };
}

type ConfigPath = Path<Config>;
// 'terminal' | 'terminal.shell' | 'terminal.font' | 'terminal.font.family' | 'terminal.font.size' | 'editor' | 'editor.theme'
```

### Infer in Conditional Types

Extract types from complex structures.

```typescript
// Extract function parameters
type Parameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

// Extract return type
type ReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

// Extract promise value
type Awaited<T> =
  T extends Promise<infer U>
    ? U extends Promise<any>
      ? Awaited<U>
      : U
    : T;

// Extract event handler argument type
type EventPayload<T> = T extends (payload: infer P) => void ? P : never;

type Handler = (event: { id: number; data: string }) => void;
type Payload = EventPayload<Handler>;  // { id: number; data: string }

// Extract array element type
type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

type Numbers = ArrayElement<number[]>;  // number
type Mixed = ArrayElement<[string, number, boolean]>;  // string | number | boolean
```

### Type-Safe Event System

Complete type-safe event handling.

```typescript
// Define events and their payloads
interface EventMap {
  'terminal:created': { id: number; name: string };
  'terminal:disposed': { id: number };
  'terminal:output': { id: number; data: string; timestamp: Date };
  'terminal:error': { id: number; error: Error };
}

// Type-safe event emitter
class TypedEventEmitter<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<Function>>();

  on<K extends keyof Events>(
    event: K,
    callback: (data: Events[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof Events>(
    event: K,
    callback: (data: Events[K]) => void
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

// Usage
const emitter = new TypedEventEmitter<EventMap>();

// Type-safe subscription
emitter.on('terminal:created', (data) => {
  console.log(data.id, data.name);  // data is typed correctly
});

// Type-safe emit
emitter.emit('terminal:output', {
  id: 1,
  data: 'Hello',
  timestamp: new Date()
});

// Type errors for wrong data
emitter.emit('terminal:created', { id: 1 });  // Error: missing 'name'
emitter.emit('invalid:event', {});  // Error: invalid event name
```
