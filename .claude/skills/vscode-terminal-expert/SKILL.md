---
name: vscode-terminal-expert
description: This skill provides expert-level guidance for implementing VS Code terminal features based on the official VS Code terminal implementation. Use when implementing PTY/pseudo-terminal integration, xterm.js terminal rendering, session persistence, input handling (keyboard/IME/mouse), shell integration with OSC sequences, or terminal performance optimization. References VS Code's standard terminal source from github.com/microsoft/vscode.
---

# VS Code Terminal Expert

## Overview

This skill enables expert-level terminal implementation in VS Code extensions by providing comprehensive knowledge of VS Code's official terminal architecture, xterm.js integration patterns, PTY management, session persistence, and performance optimization. It references the canonical implementation from the VS Code repository at `src/vs/workbench/contrib/terminal/`.

## When to Use This Skill

- Implementing PTY (pseudo-terminal) process management
- Integrating xterm.js for terminal rendering
- Creating terminal session persistence and restoration
- Handling keyboard input, IME composition, and mouse events
- Implementing shell integration with OSC 633 sequences
- Optimizing terminal performance (GPU acceleration, buffering)
- Managing terminal lifecycle and resource cleanup

## Architecture Overview

### Multi-Process Architecture

VS Code's terminal uses a four-process architecture for stability:

```
┌─────────────────────────────────────────────────────────────┐
│ Main Process (Electron)                                      │
│ - Application lifecycle management                           │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬──────────────────┐
        ▼                 ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Renderer     │  │ Extension    │  │ PTY Host     │  │ Shared       │
│ Process      │  │ Host Process │  │ Process      │  │ Process      │
├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤
│ - Workbench  │  │ - Extension  │  │ - PtyService │  │ - Extension  │
│ - XtermTerminal│ │   execution  │  │ - node-pty   │  │   mgmt       │
│ - UI         │  │ - ExtHost    │  │ - Shell      │  │              │
└──────────────┘  │   Terminal   │  │   processes  │  └──────────────┘
                  └──────────────┘  └──────────────┘
```

### Key Components

| Component | Responsibility | Source Location |
|-----------|---------------|-----------------|
| `TerminalService` | Terminal lifecycle coordination | `terminalService.ts` |
| `TerminalInstance` | Single terminal (UI + state) | `terminalInstance.ts` |
| `TerminalProcessManager` | Process communication | `terminalProcessManager.ts` |
| `PtyService` | PTY host service | `ptyService.ts` |
| `TerminalProcess` | node-pty wrapper | `terminalProcess.ts` |
| `XtermTerminal` | xterm.js wrapper | `xterm/xtermTerminal.ts` |

## PTY Integration

### Process Creation Flow

```
User Action → TerminalService.createTerminal()
  → TerminalInstance creation
  → TerminalProcessManager.createProcess()
  → IPC to PTY Host
  → PtyService.createProcess()
  → TerminalProcess (wraps node-pty)
  → node-pty.spawn() → Shell process
```

### Implementation Pattern

```typescript
import * as pty from 'node-pty';

interface ITerminalProcess {
  readonly pid: number;
  readonly exitCode: number | undefined;

  write(data: string): void;
  resize(cols: number, rows: number): void;
  shutdown(immediate: boolean): void;
}

class TerminalProcess implements ITerminalProcess {
  private _ptyProcess: pty.IPty;
  private _exitCode: number | undefined;

  constructor(
    shellPath: string,
    args: string[],
    cwd: string,
    cols: number,
    rows: number,
    env: { [key: string]: string }
  ) {
    this._ptyProcess = pty.spawn(shellPath, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env
    });

    this._ptyProcess.onData(data => {
      this._onData.fire(data);
    });

    this._ptyProcess.onExit(({ exitCode, signal }) => {
      this._exitCode = exitCode;
      this._onExit.fire(exitCode);
    });
  }

  write(data: string): void {
    this._ptyProcess.write(data);
  }

  resize(cols: number, rows: number): void {
    // Prevent native exceptions
    if (cols < 1 || rows < 1) return;
    this._ptyProcess.resize(cols, rows);
  }

  shutdown(immediate: boolean): void {
    this._ptyProcess.kill();
  }
}
```

### Flow Control (Critical for Performance)

```typescript
// Prevents renderer from being overwhelmed by high-frequency output
class FlowControlledProcess {
  private _unacknowledgedCharCount = 0;
  private _isPaused = false;

  private readonly HIGH_WATERMARK = 100000; // chars
  private readonly LOW_WATERMARK = 5000;

  handleData(data: string): void {
    this._unacknowledgedCharCount += data.length;

    // Pause if exceeds high watermark
    if (!this._isPaused && this._unacknowledgedCharCount > this.HIGH_WATERMARK) {
      this._ptyProcess.pause();
      this._isPaused = true;
    }

    this._onData.fire(data);
  }

  acknowledge(charCount: number): void {
    this._unacknowledgedCharCount -= charCount;

    // Resume if below low watermark
    if (this._isPaused && this._unacknowledgedCharCount <= this.LOW_WATERMARK) {
      this._ptyProcess.resume();
      this._isPaused = false;
    }
  }
}
```

## xterm.js Integration

### XtermTerminal Wrapper Pattern

```typescript
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SerializeAddon } from '@xterm/addon-serialize';
import { SearchAddon } from '@xterm/addon-search';

class XtermTerminal extends Disposable {
  private readonly _terminal: Terminal;

  // Lazy-loaded addons
  private _webglAddon?: WebglAddon;
  private _searchAddon?: SearchAddon;
  private _serializeAddon?: SerializeAddon;

  // Always-loaded addons
  private readonly _fitAddon: FitAddon;

  constructor(options: ITerminalOptions) {
    super();

    this._terminal = new Terminal({
      allowProposedApi: true,
      cols: options.cols,
      rows: options.rows,
      fontSize: options.fontSize,
      fontFamily: options.fontFamily,
      cursorBlink: options.cursorBlink,
      scrollback: options.scrollback,
      theme: this._getTheme()
    });

    // Always load fit addon
    this._fitAddon = new FitAddon();
    this._terminal.loadAddon(this._fitAddon);
  }

  // Lazy load WebGL for GPU acceleration
  async enableWebglRenderer(): Promise<boolean> {
    if (this._webglAddon) return true;

    try {
      const { WebglAddon } = await import('@xterm/addon-webgl');
      this._webglAddon = new WebglAddon();

      this._webglAddon.onContextLoss(() => {
        console.warn('WebGL context lost, falling back to DOM renderer');
        this._disposeWebgl();
      });

      this._terminal.loadAddon(this._webglAddon);
      return true;
    } catch {
      return false;
    }
  }

  private _disposeWebgl(): void {
    this._webglAddon?.dispose();
    this._webglAddon = undefined;
  }

  // Lazy load search addon
  async getSearchAddon(): Promise<SearchAddon> {
    if (!this._searchAddon) {
      const { SearchAddon } = await import('@xterm/addon-search');
      this._searchAddon = new SearchAddon();
      this._terminal.loadAddon(this._searchAddon);
    }
    return this._searchAddon;
  }
}
```

### Addon Loading Strategy

| Addon | Loading | Purpose |
|-------|---------|---------|
| `FitAddon` | Always | Auto-resize to container |
| `WebglAddon` | Lazy | GPU acceleration (30%+ perf) |
| `SearchAddon` | Lazy | Find in terminal |
| `SerializeAddon` | Lazy | Session persistence |
| `Unicode11Addon` | Config | Unicode 11 support |
| `WebLinksAddon` | Config | Clickable URLs |
| `ImageAddon` | Config | Inline images (iTerm2) |

## Session Persistence

### Serialization Pattern

```typescript
import { SerializeAddon } from '@xterm/addon-serialize';

class TerminalSerializer {
  private _serializeAddon: SerializeAddon;

  constructor(terminal: Terminal) {
    this._serializeAddon = new SerializeAddon();
    terminal.loadAddon(this._serializeAddon);
  }

  serialize(options?: { scrollback?: number }): string {
    // Preserves ANSI colors and text attributes
    return this._serializeAddon.serialize({
      scrollback: options?.scrollback ?? 1000,
      excludeModes: false,
      excludeAltBuffer: false
    });
  }

  // Generate replay event for restoration
  generateReplayEvent(): IReplayEvent {
    return {
      content: this.serialize(),
      cursorPosition: {
        x: this._terminal.buffer.active.cursorX,
        y: this._terminal.buffer.active.cursorY
      }
    };
  }
}
```

### Persistence Flow

```
┌─────────────────────────────────────────────────────────┐
│ Window Reload / Shutdown Event                          │
└───────────────────┬─────────────────────────────────────┘
                    ▼
        ┌───────────────────────────┐
        │ TerminalService._saveState()│
        └───────────────────────────┘
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│ Layout Info      │    │ Buffer State     │
│ - Terminal groups│    │ - Scrollback     │
│ - Active terminal│    │ - Cursor pos     │
│ - Process IDs    │    │ - ANSI colors    │
└──────────────────┘    └──────────────────┘
        │                        │
        ▼                        ▼
    Workspace Storage    SerializeAddon output
```

### Restoration Pattern

```typescript
interface ITerminalSessionState {
  layoutInfo: ITerminalLayoutInfo;
  bufferState: Map<number, string>;
}

class SessionManager {
  async saveSession(): Promise<void> {
    const layout = this._getLayoutInfo();
    const buffers = new Map<number, string>();

    for (const terminal of this._terminals) {
      const serialized = terminal.serialize({ scrollback: 1000 });
      buffers.set(terminal.id, serialized);
    }

    await this._storageService.store('terminal.state', {
      layoutInfo: layout,
      bufferState: Object.fromEntries(buffers)
    });
  }

  async restoreSession(): Promise<void> {
    const state = await this._storageService.get<ITerminalSessionState>('terminal.state');
    if (!state) return;

    // Restore layout first
    await this._restoreLayout(state.layoutInfo);

    // Then restore buffers
    for (const [id, content] of Object.entries(state.bufferState)) {
      const terminal = this._getTerminal(Number(id));
      if (terminal) {
        terminal.write(content);
      }
    }
  }
}
```

## Input Handling

### Keyboard Input Flow

```
User Keypress
  → Browser KeyboardEvent
  → Custom key event handler
  → Check VS Code keybindings
  ├─→ [Match] → Execute command, preventDefault
  └─→ [No Match] → Pass to xterm.js
        → xterm.js processes key
        → Emits onData event
        → Write to PTY process
```

### Custom Key Handler Implementation

```typescript
terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
  // Check if VS Code should handle this key
  const keybinding = this._keybindingService.lookupKeybinding(event);

  if (keybinding && !this._config.sendKeybindingsToShell) {
    // Let VS Code handle it
    return false;
  }

  // Platform-specific handling
  if (isWindows && event.altKey && event.key === 'F4') {
    // Let system handle Alt+F4
    return false;
  }

  // Tab focus mode
  if (this._tabFocusMode && event.key === 'Tab') {
    return false;
  }

  // Pass to xterm.js
  return true;
});
```

### IME Composition Handling

```typescript
// IME (Input Method Editor) for CJK input
class IMEHandler {
  private _composing = false;
  private _compositionText = '';

  handleCompositionStart(): void {
    this._composing = true;
    this._compositionText = '';
  }

  handleCompositionUpdate(text: string): void {
    this._compositionText = text;
    // Show composition preview in terminal
  }

  handleCompositionEnd(text: string): void {
    this._composing = false;
    // Send final composed text to PTY
    this._pty.write(text);
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (this._composing) {
      // Don't process keypresses during composition
      return false;
    }
    return true;
  }
}
```

### Mouse Event Handling

```typescript
// Enable mouse mode for applications like vim, tmux
terminal.options.allowProposedApi = true;

// Handle selection for copy
terminal.onSelectionChange(() => {
  const selection = terminal.getSelection();
  this._updateContextKey('terminalTextSelected', selection.length > 0);
});

// Alt+Click for cursor positioning
element.addEventListener('click', (e) => {
  if (e.altKey) {
    const coords = terminal.getCharacterAtPosition(e.clientX, e.clientY);
    if (coords) {
      this._moveCursorTo(coords.x, coords.y);
    }
  }
});
```

## Shell Integration (OSC 633)

### Protocol Specification

```
OSC 633 ; A ST    → Prompt start
OSC 633 ; B ST    → Command line start (user input begins)
OSC 633 ; C ST    → Command execution start (pre-output)
OSC 633 ; D [; <ExitCode>] ST    → Command finished
OSC 633 ; E ; <CommandLine> [; <Nonce>] ST    → Explicit command line
OSC 633 ; P ; <Property>=<Value> ST    → Set property
```

### Shell Integration Addon

```typescript
class ShellIntegrationAddon implements ITerminalAddon {
  private _terminal: Terminal;
  private _currentCommand?: ICommandInfo;

  activate(terminal: Terminal): void {
    this._terminal = terminal;

    // Parse OSC sequences
    terminal.parser.registerOscHandler(633, data => {
      return this._handleOsc633(data);
    });
  }

  private _handleOsc633(data: string): boolean {
    const [code, ...params] = data.split(';');

    switch (code) {
      case 'A': // Prompt start
        this._handlePromptStart();
        return true;

      case 'B': // Command start
        this._handleCommandStart();
        return true;

      case 'C': // Execution start
        this._handleExecutionStart();
        return true;

      case 'D': // Command finished
        const exitCode = params[0] ? parseInt(params[0]) : undefined;
        this._handleCommandFinished(exitCode);
        return true;

      case 'P': // Property
        const [key, value] = params[0]?.split('=') ?? [];
        this._handleProperty(key, value);
        return true;
    }

    return false;
  }

  private _handlePromptStart(): void {
    this._currentCommand = {
      startMarker: this._terminal.registerMarker(0),
      timestamp: Date.now()
    };
    this._onCommandStarted.fire(this._currentCommand);
  }

  private _handleCommandFinished(exitCode?: number): void {
    if (this._currentCommand) {
      this._currentCommand.exitCode = exitCode;
      this._currentCommand.endMarker = this._terminal.registerMarker(0);
      this._onCommandFinished.fire(this._currentCommand);
    }
  }
}
```

### Bash Integration Script

```bash
# Injected into shell startup
__vsc_prompt_start() {
  printf "\033]633;A\007"
}

__vsc_command_start() {
  printf "\033]633;B\007"
}

__vsc_command_output_start() {
  printf "\033]633;C\007"
}

__vsc_command_complete() {
  printf "\033]633;D;%s\007" "$?"
}

__vsc_update_cwd() {
  printf "\033]633;P;Cwd=%s\007" "$PWD"
}

# Set up hooks
PROMPT_COMMAND="__vsc_prompt_start;__vsc_update_cwd;${PROMPT_COMMAND}"
trap '__vsc_command_output_start' DEBUG
```

## Performance Optimization

### GPU Acceleration

```typescript
async function setupRenderer(terminal: XtermTerminal): Promise<void> {
  const gpuAcceleration = this._config.gpuAcceleration; // 'auto' | 'on' | 'off'

  if (gpuAcceleration === 'off') {
    return; // Use DOM renderer
  }

  if (gpuAcceleration === 'auto' && isRemote) {
    return; // Skip GPU for remote connections
  }

  const success = await terminal.enableWebglRenderer();
  if (!success) {
    console.log('WebGL unavailable, using DOM renderer');
  }
}
```

### Output Buffering

```typescript
class OutputBuffer {
  private _buffer: string[] = [];
  private _flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 16; // ~60fps

  write(data: string): void {
    this._buffer.push(data);

    if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => this._flush(), this.FLUSH_INTERVAL);
    }
  }

  private _flush(): void {
    if (this._buffer.length > 0) {
      const combined = this._buffer.join('');
      this._terminal.write(combined);
      this._buffer = [];
    }
    this._flushTimer = null;
  }
}
```

### Debounced Resize

```typescript
class ResizeHandler {
  private _resizeTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 100;

  handleResize(width: number, height: number): void {
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
    }

    this._resizeTimeout = setTimeout(() => {
      this._performResize(width, height);
      this._resizeTimeout = null;
    }, this.DEBOUNCE_MS);
  }

  private _performResize(width: number, height: number): void {
    const dimensions = this._calculateDimensions(width, height);

    // Minimum dimensions to prevent exceptions
    const cols = Math.max(dimensions.cols, 1);
    const rows = Math.max(dimensions.rows, 1);

    this._terminal.resize(cols, rows);
    this._pty.resize(cols, rows);
  }

  private _calculateDimensions(width: number, height: number): { cols: number; rows: number } {
    const charWidth = this._fontMetrics.charWidth;
    const charHeight = this._fontMetrics.charHeight;

    return {
      cols: Math.floor(width / charWidth),
      rows: Math.floor(height / charHeight)
    };
  }
}
```

## Lifecycle Management

### DisposableStore Pattern (from VS Code)

```typescript
abstract class Disposable implements IDisposable {
  private readonly _store = new DisposableStore();
  private _isDisposed = false;

  protected _register<T extends IDisposable>(disposable: T): T {
    if (this._isDisposed) {
      console.warn('Registering on disposed object');
      disposable.dispose();
      return disposable;
    }
    return this._store.add(disposable);
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    this._store.dispose();
  }
}

class DisposableStore implements IDisposable {
  private readonly _toDispose = new Set<IDisposable>();
  private _isDisposed = false;

  add<T extends IDisposable>(disposable: T): T {
    if (this._isDisposed) {
      disposable.dispose();
      return disposable;
    }
    this._toDispose.add(disposable);
    return disposable;
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;

    // LIFO order for safety
    const items = Array.from(this._toDispose).reverse();
    this._toDispose.clear();

    for (const item of items) {
      try {
        item.dispose();
      } catch (e) {
        console.error('Error disposing:', e);
      }
    }
  }
}
```

### Terminal Disposal Pattern

```typescript
class TerminalInstance extends Disposable {
  dispose(): void {
    // 1. Dispose UI components
    this._widgetManager.dispose();

    // 2. Dispose xterm.js (clears buffers)
    this._xterm?.dispose();

    // 3. Dispose process manager (kills process)
    this._processManager.dispose();

    // 4. Automatic cleanup via DisposableStore
    super.dispose();
  }
}

class TerminalProcessManager extends Disposable {
  dispose(): void {
    // Force kill the process
    this._process?.shutdown(true);

    // Clean up IPC
    this._connection?.dispose();

    super.dispose();
  }
}
```

## Terminal Profiles

### Profile Structure

```typescript
interface ITerminalProfile {
  profileName: string;
  path: string | string[];  // Shell executable
  args?: string | string[];
  env?: { [key: string]: string | null };
  icon?: string;
  color?: string;
  overrideName?: boolean;
}

// Configuration example
const profiles = {
  "terminal.integrated.profiles.linux": {
    "bash": {
      "path": "bash",
      "args": ["--login"],
      "icon": "terminal-bash"
    },
    "zsh": {
      "path": "zsh",
      "args": ["-l"]
    }
  },
  "terminal.integrated.defaultProfile.linux": "zsh"
};
```

### Environment Variable Merging

Priority order (highest to lowest):
1. User shell environment (.bashrc, .zshrc)
2. Extension environment contributions
3. Built-in variables (VSCODE_*)
4. User-configured `terminal.integrated.env.*`
5. Profile-specific env

```typescript
function createTerminalEnvironment(
  baseEnv: IProcessEnvironment,
  configEnv: ITerminalEnvironment,
  profileEnv?: ITerminalEnvironment
): IProcessEnvironment {
  const env = { ...baseEnv };

  // Built-in variables
  env['VSCODE_GIT_ASKPASS_NODE'] = process.execPath;
  env['TERM_PROGRAM'] = 'vscode';
  env['TERM_PROGRAM_VERSION'] = version;

  // User config
  Object.assign(env, configEnv);

  // Profile overrides
  if (profileEnv) {
    Object.assign(env, profileEnv);
  }

  return env;
}
```

## Security Considerations

### Process Isolation

```
┌─────────────────────────────────────────┐
│ Renderer Process (Sandboxed)            │
│ - Cannot execute arbitrary commands     │
│ - Limited to IPC communication          │
└─────────────────────────────────────────┘
                    │ IPC
                    ▼
┌─────────────────────────────────────────┐
│ PTY Host Process (Privileged)           │
│ - Validates all requests                │
│ - Spawns shell processes                │
└─────────────────────────────────────────┘
```

### Validation Pattern

```typescript
function validateShellLaunchConfig(config: IShellLaunchConfig): void {
  // Prevent arbitrary executable paths
  if (!isInTrustedPaths(config.executable)) {
    throw new Error('Shell not in trusted paths');
  }

  // Sanitize arguments
  if (config.args) {
    config.args = config.args.filter(arg => !isDangerous(arg));
  }

  // Protect VS Code variables
  if (config.env) {
    for (const key in config.env) {
      if (key.startsWith('VSCODE_') && !isBuiltIn(key)) {
        delete config.env[key];
      }
    }
  }
}
```

## Key Source File References

| Path | Purpose |
|------|---------|
| `src/vs/workbench/contrib/terminal/browser/terminalService.ts` | Service coordination |
| `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` | Instance management |
| `src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts` | Process communication |
| `src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts` | xterm.js wrapper |
| `src/vs/platform/terminal/node/ptyService.ts` | PTY host service |
| `src/vs/platform/terminal/node/terminalProcess.ts` | node-pty wrapper |
| `src/vs/base/common/lifecycle.ts` | DisposableStore pattern |

## Performance Benchmarks

Target metrics for terminal implementation:

| Operation | Target | Notes |
|-----------|--------|-------|
| Terminal creation | <500ms | Including PTY spawn |
| Session restore | <3s | 1000 lines scrollback |
| Terminal disposal | <100ms | Full cleanup |
| Resize handling | 100ms debounce | Prevents excessive calls |
| Output buffering | 16ms flush | ~60fps rendering |

## Resources

For detailed reference documentation, see:
- `references/pty-integration.md` - Complete PTY implementation guide
- `references/xterm-addons.md` - xterm.js addon documentation
- `references/shell-integration.md` - OSC 633 protocol specification

For implementation reference:
- VS Code Repository: https://github.com/microsoft/vscode
- Terminal source: `src/vs/workbench/contrib/terminal/`
- xterm.js: https://github.com/xtermjs/xterm.js
