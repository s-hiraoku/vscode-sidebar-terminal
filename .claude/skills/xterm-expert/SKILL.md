---
name: xterm-expert
description: This skill provides expert-level guidance for implementing xterm.js terminal features. Use when creating terminal instances, configuring terminal options, implementing addons (fit, webgl, serialize, search), handling terminal input/output, managing terminal buffers, optimizing rendering performance, or implementing custom escape sequence handlers. Covers xterm.js API, addon ecosystem, and terminal rendering optimization.
---

# Xterm.js Expert

## Overview

This skill enables expert-level implementation of xterm.js terminal features. It provides comprehensive knowledge of the xterm.js API, addon ecosystem, performance optimization techniques, and terminal rendering best practices.

## When to Use This Skill

- Creating and configuring xterm.js Terminal instances
- Implementing terminal addons (fit, webgl, serialize, search, etc.)
- Handling terminal input and output
- Managing terminal buffers and scrollback
- Optimizing terminal rendering performance
- Implementing custom escape sequence handlers
- Integrating xterm.js with VS Code WebViews
- Debugging terminal rendering issues

## Terminal Creation and Configuration

### Basic Terminal Setup

```typescript
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

class TerminalManager {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.terminal = this.createTerminal();
    this.fitAddon = new FitAddon();
  }

  private createTerminal(): Terminal {
    return new Terminal({
      // Appearance
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
      fontSize: 14,
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      letterSpacing: 0,
      lineHeight: 1.2,
      cursorStyle: 'block',
      cursorBlink: true,
      cursorWidth: 1,

      // Behavior
      scrollback: 5000,
      tabStopWidth: 8,
      bellStyle: 'none',
      allowTransparency: false,
      rightClickSelectsWord: true,
      macOptionIsMeta: false,
      macOptionClickForcesSelection: false,
      altClickMovesCursor: true,

      // Performance
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
      smoothScrollDuration: 0,

      // Rendering
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1,

      // Theme
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        selectionForeground: '#ffffff',
        selectionInactiveBackground: '#3a3d41',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      }
    });
  }

  initialize(): void {
    // Load addons before opening
    this.terminal.loadAddon(this.fitAddon);

    // Open terminal in container
    this.terminal.open(this.container);

    // Fit after opening
    this.fitAddon.fit();

    // Setup resize observer
    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        this.fitAddon.fit();
      });
    });
    resizeObserver.observe(this.container);
  }
}
```

### Terminal Options Reference

```typescript
interface ITerminalOptions {
  // Font Options
  fontFamily?: string;           // Default: 'courier-new, courier, monospace'
  fontSize?: number;             // Default: 15
  fontWeight?: FontWeight;       // Default: 'normal'
  fontWeightBold?: FontWeight;   // Default: 'bold'
  letterSpacing?: number;        // Default: 0
  lineHeight?: number;           // Default: 1.0

  // Cursor Options
  cursorStyle?: 'block' | 'underline' | 'bar';  // Default: 'block'
  cursorBlink?: boolean;         // Default: false
  cursorWidth?: number;          // Default: 1 (for bar cursor)
  cursorInactiveStyle?: 'outline' | 'block' | 'bar' | 'underline' | 'none';

  // Scrolling Options
  scrollback?: number;           // Default: 1000
  scrollOnUserInput?: boolean;   // Default: true
  fastScrollModifier?: 'none' | 'alt' | 'ctrl' | 'shift';
  fastScrollSensitivity?: number;  // Default: 5
  scrollSensitivity?: number;    // Default: 1
  smoothScrollDuration?: number; // Default: 0 (disabled)

  // Behavior Options
  allowTransparency?: boolean;   // Default: false
  bellStyle?: 'none' | 'sound' | 'visual' | 'both';
  tabStopWidth?: number;         // Default: 8
  windowsMode?: boolean;         // Default: false
  convertEol?: boolean;          // Default: false
  altClickMovesCursor?: boolean; // Default: true
  rightClickSelectsWord?: boolean; // Default: false (on macOS)
  macOptionIsMeta?: boolean;     // Default: false
  macOptionClickForcesSelection?: boolean; // Default: false

  // Rendering Options
  allowProposedApi?: boolean;    // Default: false
  drawBoldTextInBrightColors?: boolean; // Default: true
  minimumContrastRatio?: number; // Default: 1
  overviewRulerWidth?: number;   // Default: undefined

  // Theme
  theme?: ITheme;

  // Size (usually managed by fit addon)
  cols?: number;                 // Default: 80
  rows?: number;                 // Default: 24
}
```

## Essential Addons

### FitAddon - Auto-sizing

```typescript
import { FitAddon } from '@xterm/addon-fit';

class FitManager {
  private fitAddon: FitAddon;
  private terminal: Terminal;
  private debounceTimer: number | undefined;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
  }

  fit(): void {
    this.fitAddon.fit();
  }

  // Debounced fit for resize events
  debouncedFit(delay: number = 100): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.fit();
      this.debounceTimer = undefined;
    }, delay);
  }

  // Get proposed dimensions without applying
  proposeDimensions(): { cols: number; rows: number } | undefined {
    return this.fitAddon.proposeDimensions();
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.fitAddon.dispose();
  }
}
```

### WebglAddon - GPU Acceleration

```typescript
import { WebglAddon } from '@xterm/addon-webgl';

class RenderingManager {
  private webglAddon: WebglAddon | undefined;
  private terminal: Terminal;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  enableWebGL(): boolean {
    try {
      this.webglAddon = new WebglAddon();

      // Handle context loss
      this.webglAddon.onContextLoss(() => {
        console.warn('WebGL context lost, falling back to canvas');
        this.disableWebGL();
      });

      this.terminal.loadAddon(this.webglAddon);
      console.log('WebGL rendering enabled');
      return true;
    } catch (error) {
      console.warn('WebGL not available:', error);
      return false;
    }
  }

  disableWebGL(): void {
    if (this.webglAddon) {
      this.webglAddon.dispose();
      this.webglAddon = undefined;
    }
  }

  isWebGLEnabled(): boolean {
    return this.webglAddon !== undefined;
  }
}
```

### SerializeAddon - Buffer Serialization

```typescript
import { SerializeAddon } from '@xterm/addon-serialize';

class ScrollbackManager {
  private serializeAddon: SerializeAddon;
  private terminal: Terminal;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.serializeAddon = new SerializeAddon();
    this.terminal.loadAddon(this.serializeAddon);
  }

  // Save scrollback with ANSI codes preserved
  saveScrollback(options?: {
    scrollback?: number;
    excludeModes?: boolean;
    excludeAltBuffer?: boolean;
  }): string {
    return this.serializeAddon.serialize({
      scrollback: options?.scrollback,
      excludeModes: options?.excludeModes ?? true,
      excludeAltBuffer: options?.excludeAltBuffer ?? true
    });
  }

  // Restore scrollback
  restoreScrollback(content: string): void {
    // Write serialized content back to terminal
    this.terminal.write(content);
  }

  // Get HTML representation
  serializeAsHTML(options?: { onlySelection?: boolean }): string {
    return this.serializeAddon.serializeAsHTML(options);
  }
}
```

### SearchAddon - Text Search

```typescript
import { SearchAddon, ISearchOptions } from '@xterm/addon-search';

class SearchManager {
  private searchAddon: SearchAddon;
  private terminal: Terminal;
  private currentSearchTerm: string = '';

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.searchAddon = new SearchAddon();
    this.terminal.loadAddon(this.searchAddon);
  }

  search(term: string, options?: ISearchOptions): boolean {
    this.currentSearchTerm = term;
    return this.searchAddon.findNext(term, options);
  }

  findNext(options?: ISearchOptions): boolean {
    if (!this.currentSearchTerm) return false;
    return this.searchAddon.findNext(this.currentSearchTerm, options);
  }

  findPrevious(options?: ISearchOptions): boolean {
    if (!this.currentSearchTerm) return false;
    return this.searchAddon.findPrevious(this.currentSearchTerm, options);
  }

  clearSearch(): void {
    this.searchAddon.clearDecorations();
    this.currentSearchTerm = '';
  }

  // Event handler for search results
  onDidChangeResults(callback: (results: { resultIndex: number; resultCount: number }) => void): void {
    this.searchAddon.onDidChangeResults(callback);
  }
}

// Search options reference
const searchOptions: ISearchOptions = {
  regex: false,           // Use regex pattern
  wholeWord: false,       // Match whole words only
  caseSensitive: false,   // Case sensitive search
  incremental: true,      // Search as you type
  decorations: {
    matchBackground: '#ffff00',
    matchBorder: '#000000',
    matchOverviewRuler: '#ffff00',
    activeMatchBackground: '#ff8800',
    activeMatchBorder: '#000000',
    activeMatchColorOverviewRuler: '#ff8800'
  }
};
```

### WebLinksAddon - Clickable Links

```typescript
import { WebLinksAddon } from '@xterm/addon-web-links';

class LinkManager {
  private webLinksAddon: WebLinksAddon;

  constructor(terminal: Terminal) {
    this.webLinksAddon = new WebLinksAddon(
      // Custom handler for link activation
      (event: MouseEvent, uri: string) => {
        // Prevent default behavior
        event.preventDefault();

        // Open link based on context
        if (this.isVSCodeEnvironment()) {
          // Use VS Code API to open
          vscode.postMessage({ type: 'open-link', uri });
        } else {
          window.open(uri, '_blank');
        }
      },
      // Options
      {
        hover: (event: MouseEvent, uri: string, range: IBufferRange) => {
          // Show hover tooltip
          this.showTooltip(event, uri);
        },
        leave: (event: MouseEvent, uri: string) => {
          this.hideTooltip();
        }
      }
    );

    terminal.loadAddon(this.webLinksAddon);
  }
}
```

### Unicode11Addon - Extended Unicode Support

```typescript
import { Unicode11Addon } from '@xterm/addon-unicode11';

class UnicodeManager {
  constructor(terminal: Terminal) {
    const unicode11Addon = new Unicode11Addon();
    terminal.loadAddon(unicode11Addon);
    terminal.unicode.activeVersion = '11';
  }
}
```

### ImageAddon - Inline Images (iTerm2/Sixel)

```typescript
import { ImageAddon, IImageAddonOptions } from '@xterm/addon-image';

class ImageManager {
  private imageAddon: ImageAddon;

  constructor(terminal: Terminal) {
    const options: IImageAddonOptions = {
      enableSizeReports: true,
      pixelLimit: 16777216,  // 4096 x 4096
      sixelSupport: true,
      sixelScrolling: true,
      sixelPaletteLimit: 256,
      storageLimit: 128,
      showPlaceholder: true
    };

    this.imageAddon = new ImageAddon(options);
    terminal.loadAddon(this.imageAddon);
  }
}
```

## Input/Output Handling

### Writing to Terminal

```typescript
class TerminalWriter {
  private terminal: Terminal;
  private buffer: string[] = [];
  private flushTimer: number | undefined;
  private readonly flushInterval = 16; // 60fps

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  // Basic write
  write(data: string): void {
    this.terminal.write(data);
  }

  // Write with callback when complete
  writeAsync(data: string): Promise<void> {
    return new Promise((resolve) => {
      this.terminal.write(data, resolve);
    });
  }

  // Write line with newline
  writeln(data: string): void {
    this.terminal.writeln(data);
  }

  // Buffered write for high-frequency output
  writeBuffered(data: string): void {
    this.buffer.push(data);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (!this.flushTimer) {
      this.flushTimer = window.setTimeout(() => {
        this.flush();
      }, this.flushInterval);
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.terminal.write(this.buffer.join(''));
      this.buffer = [];
    }
    this.flushTimer = undefined;
  }

  // Clear terminal
  clear(): void {
    this.terminal.clear();
  }

  // Reset terminal
  reset(): void {
    this.terminal.reset();
  }
}
```

### Reading Input

```typescript
class TerminalInput {
  private terminal: Terminal;
  private disposables: IDisposable[] = [];

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  // Handle user input (keyboard)
  onData(callback: (data: string) => void): IDisposable {
    const disposable = this.terminal.onData(callback);
    this.disposables.push(disposable);
    return disposable;
  }

  // Handle binary input
  onBinary(callback: (data: string) => void): IDisposable {
    const disposable = this.terminal.onBinary(callback);
    this.disposables.push(disposable);
    return disposable;
  }

  // Handle key events with more detail
  onKey(callback: (event: { key: string; domEvent: KeyboardEvent }) => void): IDisposable {
    const disposable = this.terminal.onKey(callback);
    this.disposables.push(disposable);
    return disposable;
  }

  // Paste text
  paste(data: string): void {
    this.terminal.paste(data);
  }

  // Focus terminal
  focus(): void {
    this.terminal.focus();
  }

  // Check if focused
  isFocused(): boolean {
    return document.activeElement === this.terminal.textarea;
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
```

### Custom Key Handling

```typescript
class KeyHandler {
  private terminal: Terminal;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.setupCustomKeyHandlers();
  }

  private setupCustomKeyHandlers(): void {
    // Attach custom key handler
    this.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Return false to prevent xterm from handling
      // Return true to let xterm handle normally

      // Ctrl+C for copy (when selection exists)
      if (event.ctrlKey && event.key === 'c' && this.terminal.hasSelection()) {
        this.copySelection();
        return false;
      }

      // Ctrl+V for paste
      if (event.ctrlKey && event.key === 'v') {
        this.pasteFromClipboard();
        return false;
      }

      // Ctrl+Shift+C for copy (always)
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        this.copySelection();
        return false;
      }

      // Custom shortcuts
      if (event.ctrlKey && event.key === 'l') {
        this.terminal.clear();
        return false;
      }

      return true;
    });
  }

  private async copySelection(): Promise<void> {
    const selection = this.terminal.getSelection();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
  }

  private async pasteFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      this.terminal.paste(text);
    } catch (error) {
      console.error('Paste failed:', error);
    }
  }
}
```

## Buffer Management

### Buffer API

```typescript
class BufferManager {
  private terminal: Terminal;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  // Get active buffer (normal or alternate)
  getActiveBuffer(): IBuffer {
    return this.terminal.buffer.active;
  }

  // Get normal buffer
  getNormalBuffer(): IBuffer {
    return this.terminal.buffer.normal;
  }

  // Get alternate buffer (used by vim, less, etc.)
  getAlternateBuffer(): IBuffer {
    return this.terminal.buffer.alternate;
  }

  // Check if using alternate buffer
  isAlternateBuffer(): boolean {
    return this.terminal.buffer.active === this.terminal.buffer.alternate;
  }

  // Get cursor position
  getCursorPosition(): { x: number; y: number } {
    const buffer = this.getActiveBuffer();
    return {
      x: buffer.cursorX,
      y: buffer.cursorY
    };
  }

  // Get line content
  getLine(y: number): IBufferLine | undefined {
    return this.getActiveBuffer().getLine(y);
  }

  // Get text from line
  getLineText(y: number): string {
    const line = this.getLine(y);
    if (!line) return '';
    return line.translateToString(true); // trim whitespace
  }

  // Get all visible lines
  getVisibleContent(): string[] {
    const buffer = this.getActiveBuffer();
    const lines: string[] = [];

    for (let i = 0; i < this.terminal.rows; i++) {
      const line = buffer.getLine(buffer.viewportY + i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    return lines;
  }

  // Get scrollback content
  getScrollbackContent(maxLines?: number): string[] {
    const buffer = this.getActiveBuffer();
    const lines: string[] = [];
    const count = maxLines ?? buffer.length;

    for (let i = 0; i < Math.min(count, buffer.length); i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    return lines;
  }

  // Get cell at position
  getCell(x: number, y: number): IBufferCell | undefined {
    const line = this.getLine(y);
    return line?.getCell(x);
  }

  // Get cell attributes
  getCellAttributes(x: number, y: number): {
    char: string;
    fg: number;
    bg: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
  } | undefined {
    const cell = this.getCell(x, y);
    if (!cell) return undefined;

    return {
      char: cell.getChars(),
      fg: cell.getFgColor(),
      bg: cell.getBgColor(),
      bold: cell.isBold() === 1,
      italic: cell.isItalic() === 1,
      underline: cell.isUnderline() === 1
    };
  }
}
```

### Selection Management

```typescript
class SelectionManager {
  private terminal: Terminal;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  // Get selected text
  getSelection(): string {
    return this.terminal.getSelection();
  }

  // Get selection position
  getSelectionPosition(): ISelectionPosition | undefined {
    return this.terminal.getSelectionPosition();
  }

  // Check if has selection
  hasSelection(): boolean {
    return this.terminal.hasSelection();
  }

  // Set selection programmatically
  select(column: number, row: number, length: number): void {
    this.terminal.select(column, row, length);
  }

  // Select all
  selectAll(): void {
    this.terminal.selectAll();
  }

  // Select lines
  selectLines(start: number, end: number): void {
    this.terminal.selectLines(start, end);
  }

  // Clear selection
  clearSelection(): void {
    this.terminal.clearSelection();
  }

  // Listen for selection changes
  onSelectionChange(callback: () => void): IDisposable {
    return this.terminal.onSelectionChange(callback);
  }
}
```

## Performance Optimization

### Rendering Optimization

```typescript
class RenderingOptimizer {
  private terminal: Terminal;
  private webglAddon: WebglAddon | undefined;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  // Enable WebGL with fallback
  enableOptimizedRendering(): void {
    try {
      this.webglAddon = new WebglAddon();
      this.webglAddon.onContextLoss(() => {
        console.warn('WebGL context lost, using canvas renderer');
        this.webglAddon?.dispose();
        this.webglAddon = undefined;
      });
      this.terminal.loadAddon(this.webglAddon);
    } catch (e) {
      console.log('WebGL not available, using canvas renderer');
    }
  }

  // Optimize for high-frequency output
  configureForHighOutput(): void {
    // Disable smooth scrolling for performance
    this.terminal.options.smoothScrollDuration = 0;

    // Reduce scrollback for memory
    this.terminal.options.scrollback = 1000;

    // Disable cursor blink to reduce repaints
    this.terminal.options.cursorBlink = false;
  }

  // Optimize for interactive use
  configureForInteractive(): void {
    // Enable smooth scrolling
    this.terminal.options.smoothScrollDuration = 125;

    // Standard scrollback
    this.terminal.options.scrollback = 5000;

    // Enable cursor blink
    this.terminal.options.cursorBlink = true;
  }
}
```

### Output Buffering

```typescript
class OutputBuffer {
  private terminal: Terminal;
  private buffer: string = '';
  private flushScheduled = false;
  private flushInterval: number;
  private isHighFrequency = false;

  constructor(terminal: Terminal, flushInterval: number = 16) {
    this.terminal = terminal;
    this.flushInterval = flushInterval;
  }

  write(data: string): void {
    this.buffer += data;

    // Detect high-frequency output
    if (this.buffer.length > 10000) {
      this.isHighFrequency = true;
      this.flushInterval = 4; // Faster flush for high output
    }

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  private flush(): void {
    if (this.buffer.length > 0) {
      this.terminal.write(this.buffer);
      this.buffer = '';
    }
    this.flushScheduled = false;

    // Reset to normal frequency after idle
    if (this.buffer.length === 0) {
      this.isHighFrequency = false;
      this.flushInterval = 16;
    }
  }

  // Force immediate flush
  flushNow(): void {
    if (this.buffer.length > 0) {
      this.terminal.write(this.buffer);
      this.buffer = '';
    }
  }
}
```

### Memory Management

```typescript
class TerminalMemoryManager {
  private terminal: Terminal;
  private maxScrollback: number;

  constructor(terminal: Terminal, maxScrollback: number = 5000) {
    this.terminal = terminal;
    this.maxScrollback = maxScrollback;
  }

  // Trim scrollback when it gets too large
  trimScrollback(): void {
    const buffer = this.terminal.buffer.normal;
    if (buffer.length > this.maxScrollback * 1.5) {
      // Clear and restore only recent content
      const content = this.getRecentContent(this.maxScrollback);
      this.terminal.clear();
      this.terminal.write(content);
    }
  }

  private getRecentContent(lines: number): string {
    const buffer = this.terminal.buffer.normal;
    const result: string[] = [];
    const start = Math.max(0, buffer.length - lines);

    for (let i = start; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        result.push(line.translateToString(false));
      }
    }

    return result.join('\r\n');
  }

  // Dispose and cleanup
  dispose(): void {
    this.terminal.dispose();
  }
}
```

## Event Handling

### Terminal Events

```typescript
class TerminalEventHandler {
  private terminal: Terminal;
  private disposables: IDisposable[] = [];

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  // Data output from terminal
  onData(callback: (data: string) => void): void {
    this.disposables.push(this.terminal.onData(callback));
  }

  // Terminal resized
  onResize(callback: (size: { cols: number; rows: number }) => void): void {
    this.disposables.push(this.terminal.onResize(callback));
  }

  // Title changed (from escape sequence)
  onTitleChange(callback: (title: string) => void): void {
    this.disposables.push(this.terminal.onTitleChange(callback));
  }

  // Bell character received
  onBell(callback: () => void): void {
    this.disposables.push(this.terminal.onBell(callback));
  }

  // Selection changed
  onSelectionChange(callback: () => void): void {
    this.disposables.push(this.terminal.onSelectionChange(callback));
  }

  // Scroll position changed
  onScroll(callback: (position: number) => void): void {
    this.disposables.push(this.terminal.onScroll(callback));
  }

  // Line added to scrollback
  onLineFeed(callback: () => void): void {
    this.disposables.push(this.terminal.onLineFeed(callback));
  }

  // Cursor moved
  onCursorMove(callback: () => void): void {
    this.disposables.push(this.terminal.onCursorMove(callback));
  }

  // Terminal rendered
  onRender(callback: (event: { start: number; end: number }) => void): void {
    this.disposables.push(this.terminal.onRender(callback));
  }

  // Writing complete
  onWriteParsed(callback: () => void): void {
    this.disposables.push(this.terminal.onWriteParsed(callback));
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
```

## Custom Escape Sequences

### Parser Hooks

```typescript
class CustomSequenceHandler {
  private terminal: Terminal;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.setupCustomHandlers();
  }

  private setupCustomHandlers(): void {
    // Register OSC (Operating System Command) handler
    // OSC 1337 is used by iTerm2 for custom commands
    this.terminal.parser.registerOscHandler(1337, (data: string) => {
      this.handleCustomOSC(data);
      return true; // Return true if handled
    });

    // Register CSI (Control Sequence Introducer) handler
    this.terminal.parser.registerCsiHandler(
      { final: 'q' }, // Custom sequence ending in 'q'
      (params: IParams) => {
        this.handleCustomCSI(params);
        return true;
      }
    );

    // Register DCS (Device Control String) handler
    this.terminal.parser.registerDcsHandler(
      { final: 'q' },
      {
        hook: (params: IParams) => { /* Start */ },
        put: (data: Uint32Array, start: number, end: number) => { /* Data */ },
        unhook: (success: boolean) => { /* End */ }
      }
    );
  }

  private handleCustomOSC(data: string): void {
    // Parse iTerm2-style commands
    // Example: SetMark, ClearScrollback, etc.
    const [command, ...args] = data.split(';');

    switch (command) {
      case 'SetMark':
        this.setMark();
        break;
      case 'ClearScrollback':
        this.terminal.clear();
        break;
      // Add more custom commands
    }
  }

  private handleCustomCSI(params: IParams): void {
    // Handle custom CSI sequence
    console.log('Custom CSI:', params);
  }

  private setMark(): void {
    // Implementation for mark functionality
  }
}
```

## Integration with VS Code WebView

### Complete Integration Example

```typescript
// In VS Code WebView
class XtermVSCodeIntegration {
  private terminal: Terminal;
  private vscode: any;
  private fitAddon: FitAddon;

  constructor(container: HTMLElement) {
    this.vscode = acquireVsCodeApi();
    this.terminal = new Terminal({
      fontFamily: 'var(--vscode-editor-font-family)',
      fontSize: 14,
      theme: this.getVSCodeTheme()
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(container);
    this.fitAddon.fit();

    this.setupCommunication();
    this.setupResizeHandler();
  }

  private getVSCodeTheme(): ITheme {
    const style = getComputedStyle(document.body);
    return {
      background: style.getPropertyValue('--vscode-terminal-background').trim() ||
                  style.getPropertyValue('--vscode-editor-background').trim(),
      foreground: style.getPropertyValue('--vscode-terminal-foreground').trim() ||
                  style.getPropertyValue('--vscode-editor-foreground').trim(),
      cursor: style.getPropertyValue('--vscode-terminalCursor-foreground').trim(),
      cursorAccent: style.getPropertyValue('--vscode-terminalCursor-background').trim(),
      selectionBackground: style.getPropertyValue('--vscode-terminal-selectionBackground').trim()
    };
  }

  private setupCommunication(): void {
    // Send input to extension
    this.terminal.onData((data) => {
      this.vscode.postMessage({ type: 'input', data });
    });

    // Receive output from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.type) {
        case 'output':
          this.terminal.write(message.data);
          break;
        case 'resize':
          this.terminal.resize(message.cols, message.rows);
          break;
        case 'clear':
          this.terminal.clear();
          break;
        case 'focus':
          this.terminal.focus();
          break;
      }
    });

    // Notify ready
    this.vscode.postMessage({ type: 'ready' });
  }

  private setupResizeHandler(): void {
    const resizeObserver = new ResizeObserver(() => {
      this.fitAddon.fit();
      this.vscode.postMessage({
        type: 'resize',
        cols: this.terminal.cols,
        rows: this.terminal.rows
      });
    });
    resizeObserver.observe(this.terminal.element!.parentElement!);
  }
}
```

## ANSI Escape Sequences Reference

### Common Sequences

```typescript
const ANSI = {
  // Cursor movement
  cursorUp: (n: number) => `\x1b[${n}A`,
  cursorDown: (n: number) => `\x1b[${n}B`,
  cursorForward: (n: number) => `\x1b[${n}C`,
  cursorBack: (n: number) => `\x1b[${n}D`,
  cursorPosition: (row: number, col: number) => `\x1b[${row};${col}H`,
  cursorHome: '\x1b[H',
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',

  // Erase
  eraseToEndOfLine: '\x1b[K',
  eraseToStartOfLine: '\x1b[1K',
  eraseLine: '\x1b[2K',
  eraseDown: '\x1b[J',
  eraseUp: '\x1b[1J',
  eraseScreen: '\x1b[2J',

  // Text formatting
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  inverse: '\x1b[7m',
  hidden: '\x1b[8m',
  strikethrough: '\x1b[9m',

  // Colors (foreground)
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Colors (background)
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  // 256 colors
  fg256: (n: number) => `\x1b[38;5;${n}m`,
  bg256: (n: number) => `\x1b[48;5;${n}m`,

  // True color (24-bit)
  fgRGB: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
  bgRGB: (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`,

  // Screen modes
  alternateScreen: '\x1b[?1049h',
  normalScreen: '\x1b[?1049l',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h'
};
```

## Resources

For detailed reference documentation:
- `references/xterm-api.md` - Complete xterm.js API reference
- `references/addons-guide.md` - Addon implementation details
- `references/escape-sequences.md` - ANSI escape sequence reference
