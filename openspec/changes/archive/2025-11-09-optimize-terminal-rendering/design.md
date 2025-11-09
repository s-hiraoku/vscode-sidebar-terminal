# Design: Terminal Rendering Optimization and Scrollback Fix

## Architecture Overview

このデザインドキュメントでは、VS Code標準ターミナルの実装パターンを採用した、効率的なターミナルレンダリングとスクロールバック管理の詳細設計を説明します。

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                  WebView Container                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        TerminalLifecycleManager (Coordinator)        │  │
│  │  - Terminal creation/disposal                        │  │
│  │  - Rendering optimization                            │  │
│  │  - Addon lifecycle management                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                  │
│         ┌───────────────┼────────────────┐                 │
│         │               │                │                 │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐          │
│  │  Rendering  │ │  Scrollback │ │  Lifecycle  │          │
│  │  Optimizer  │ │  Manager    │ │  Controller │          │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘          │
│         │               │                │                 │
│         └───────────────┼────────────────┘                 │
│                         │                                  │
│  ┌──────────────────────▼────────────────────────────┐    │
│  │              xterm.js Terminal                     │    │
│  │  ┌───────────────────────────────────────────┐    │    │
│  │  │  Core Rendering (Canvas/DOM/WebGL)        │    │    │
│  │  └───────────────────────────────────────────┘    │    │
│  │  ┌───────────────────────────────────────────┐    │    │
│  │  │  Addons (Serialize, WebGL, Search, etc.) │    │    │
│  │  └───────────────────────────────────────────┘    │    │
│  └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Rendering Optimizer

VS Codeパターンに基づいた効率的なレンダリング制御

#### Responsibilities
- ResizeObserverの統合管理
- GPU アクセラレーション（WebGL）の自動フォールバック
- スムーススクロールのデバイス別最適化
- 描画トリガーの重複排除

#### Key Interfaces

```typescript
interface IRenderingOptimizer {
  /**
   * Setup optimized resize observer for terminal
   */
  setupOptimizedResize(
    terminal: Terminal,
    container: HTMLElement,
    fitAddon: FitAddon
  ): IDisposable;

  /**
   * Enable WebGL rendering with automatic fallback
   */
  enableWebGL(terminal: Terminal): Promise<boolean>;

  /**
   * Configure smooth scrolling based on input device
   */
  configureSmoothScrolling(terminal: Terminal): void;

  /**
   * Force redraw when necessary (WebGL texture clear)
   */
  forceRedraw(terminal: Terminal): void;
}

interface IDeviceDetector {
  /**
   * Detect if using physical mouse wheel vs trackpad
   */
  isPhysicalMouseWheel(): boolean;

  /**
   * Update smooth scroll duration based on device
   */
  updateSmoothScrollDuration(terminal: Terminal): void;
}
```

#### Implementation Strategy

```typescript
class RenderingOptimizer implements IRenderingOptimizer {
  private static readonly SMOOTH_SCROLL_DURATION = 125; // ms
  private webglAddons = new Map<Terminal, WebglAddon>();
  private deviceDetector = new DeviceDetector();

  setupOptimizedResize(
    terminal: Terminal,
    container: HTMLElement,
    fitAddon: FitAddon
  ): IDisposable {
    // VS Code pattern: Single ResizeObserver with debouncing
    const resizeObserver = new ResizeObserver(
      debounce((entries) => {
        const { width, height } = entries[0].contentRect;
        if (width > 50 && height > 50) {
          // Only resize if dimensions are valid
          fitAddon.fit();
        }
      }, 100) // 100ms debounce
    );

    resizeObserver.observe(container);
    return { dispose: () => resizeObserver.disconnect() };
  }

  async enableWebGL(terminal: Terminal): Promise<boolean> {
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);

      // Monitor context loss for automatic recovery
      webglAddon.onContextLoss(() => {
        this.handleWebGLContextLoss(terminal);
      });

      this.webglAddons.set(terminal, webglAddon);
      return true;
    } catch (error) {
      // Automatic fallback to DOM renderer
      console.warn('WebGL failed, using DOM renderer:', error);
      return false;
    }
  }

  private handleWebGLContextLoss(terminal: Terminal): void {
    const webglAddon = this.webglAddons.get(terminal);
    if (webglAddon) {
      webglAddon.dispose();
      this.webglAddons.delete(terminal);
    }
    // Terminal automatically falls back to DOM renderer
  }
}

class DeviceDetector implements IDeviceDetector {
  private isPhysical = true;

  isPhysicalMouseWheel(): boolean {
    return this.isPhysical;
  }

  updateSmoothScrollDuration(terminal: Terminal): void {
    // Trackpad: 0ms (instant), Mouse wheel: 125ms (smooth)
    const duration = this.isPhysical
      ? RenderingOptimizer.SMOOTH_SCROLL_DURATION
      : 0;

    // Note: xterm.js doesn't expose smoothScrollDuration directly
    // This is a custom implementation for this project
    (terminal as any).options.smoothScrollDuration = duration;
  }

  detectDevice(event: WheelEvent): void {
    // deltaMode: 0 = pixels (trackpad), 1 = lines (mouse wheel)
    const isPhysical = event.deltaMode === 1;
    if (isPhysical !== this.isPhysical) {
      this.isPhysical = isPhysical;
    }
  }
}
```

### 2. Scrollback Manager

VS Codeの完全なスクロールバック管理パターン

#### Responsibilities
- SerializeAddonによるANSIカラー保持
- ラップされた行の正しい処理
- 効率的なバッファイテレーション
- 空行トリミングによる最適化

#### Key Interfaces

```typescript
interface IScrollbackManager {
  /**
   * Save scrollback with ANSI colors preserved
   */
  saveScrollback(
    terminal: Terminal,
    maxLines: number
  ): Promise<string>;

  /**
   * Restore scrollback from serialized content
   */
  restoreScrollback(
    terminal: Terminal,
    content: string
  ): Promise<boolean>;

  /**
   * Get full buffer line with wrapped lines joined
   */
  getFullBufferLine(
    lineIndex: number,
    buffer: IBuffer
  ): string | undefined;

  /**
   * Iterate buffer lines in reverse (latest to oldest)
   */
  getBufferReverseIterator(
    buffer: IBuffer
  ): IterableIterator<string>;
}

interface ISerializeHelper {
  /**
   * Serialize terminal content as HTML (with ANSI colors)
   */
  serializeAsHTML(
    terminal: Terminal,
    options?: ISerializeOptions
  ): Promise<string>;

  /**
   * Serialize range with empty line trimming
   */
  serializeRange(
    terminal: Terminal,
    startLine: number,
    endLine: number
  ): Promise<string>;
}
```

#### Implementation Strategy

```typescript
class ScrollbackManager implements IScrollbackManager {
  private serializeAddons = new Map<Terminal, SerializeAddon>();

  async saveScrollback(
    terminal: Terminal,
    maxLines: number = 1000
  ): Promise<string> {
    const serializeAddon = await this.getOrLoadSerializeAddon(terminal);

    // Get full content with ANSI colors
    const fullContent = serializeAddon.serialize();
    const lines = fullContent.split('\n');

    // Take last N lines
    const startIndex = Math.max(0, lines.length - maxLines);
    return lines.slice(startIndex).join('\n');
  }

  async restoreScrollback(
    terminal: Terminal,
    content: string
  ): Promise<boolean> {
    try {
      // Write content line by line to preserve ANSI codes
      const lines = content.split('\n');
      for (const line of lines) {
        terminal.writeln(line);
      }
      return true;
    } catch (error) {
      console.error('Failed to restore scrollback:', error);
      return false;
    }
  }

  getFullBufferLine(
    lineIndex: number,
    buffer: IBuffer
  ): string | undefined {
    let line = buffer.getLine(lineIndex);
    if (!line) {
      return undefined;
    }

    let lineData = line.translateToString(true);
    let currentIndex = lineIndex;

    // Join wrapped lines backwards
    while (currentIndex > 0 && line.isWrapped) {
      line = buffer.getLine(--currentIndex);
      if (!line) {
        break;
      }
      lineData = line.translateToString(false) + lineData;
    }

    return lineData;
  }

  *getBufferReverseIterator(buffer: IBuffer): IterableIterator<string> {
    for (let i = buffer.length - 1; i >= 0; i--) {
      const lineData = this.getFullBufferLine(i, buffer);
      if (lineData !== undefined) {
        // Skip already processed wrapped lines
        const line = buffer.getLine(i);
        if (line) {
          let wrapCount = 0;
          let checkIndex = i;
          while (checkIndex > 0 && buffer.getLine(checkIndex)?.isWrapped) {
            wrapCount++;
            checkIndex--;
          }
          i = checkIndex; // Skip wrapped lines
        }
        yield lineData;
      }
    }
  }

  private async getOrLoadSerializeAddon(
    terminal: Terminal
  ): Promise<SerializeAddon> {
    let addon = this.serializeAddons.get(terminal);
    if (!addon) {
      addon = new SerializeAddon();
      terminal.loadAddon(addon);
      this.serializeAddons.set(terminal, addon);
    }
    return addon;
  }
}

class SerializeHelper implements ISerializeHelper {
  async serializeAsHTML(
    terminal: Terminal,
    options?: ISerializeOptions
  ): Promise<string> {
    const serializeAddon = await this.getSerializeAddon(terminal);
    return serializeAddon.serializeAsHTML(options);
  }

  async serializeRange(
    terminal: Terminal,
    startLine: number,
    endLine: number
  ): Promise<string> {
    const serializeAddon = await this.getSerializeAddon(terminal);
    const buffer = terminal.buffer.active;

    // Trim trailing empty lines
    let trimmedEndLine = endLine;
    for (let i = endLine; i >= startLine; i--) {
      const line = buffer.getLine(i);
      if (line && line.translateToString(true).trim() === '') {
        trimmedEndLine--;
      } else {
        break;
      }
    }

    // Trim leading empty lines
    let trimmedStartLine = startLine;
    for (let i = startLine; i <= trimmedEndLine; i++) {
      const line = buffer.getLine(i);
      if (line && line.translateToString(true).trim() === '') {
        trimmedStartLine++;
      } else {
        break;
      }
    }

    return serializeAddon.serializeAsHTML({
      range: {
        startLine: trimmedStartLine,
        endLine: trimmedEndLine,
        startCol: 0
      }
    });
  }

  private async getSerializeAddon(
    terminal: Terminal
  ): Promise<SerializeAddon> {
    // Lazy load SerializeAddon
    const existingAddon = (terminal as any)._serializeAddon;
    if (existingAddon) {
      return existingAddon;
    }

    const serializeAddon = new SerializeAddon();
    terminal.loadAddon(serializeAddon);
    (terminal as any)._serializeAddon = serializeAddon;
    return serializeAddon;
  }
}
```

### 3. Lifecycle Controller

xterm.jsアドオンとターミナルライフサイクルの最適化管理

#### Responsibilities
- アドオンの遅延ロード
- WebGLコンテキストロストの自動復旧
- 適切なDispose処理

#### Key Interfaces

```typescript
interface ILifecycleController {
  /**
   * Attach terminal to DOM element with optimizations
   */
  attachTerminal(
    terminal: Terminal,
    container: HTMLElement,
    options: IAttachOptions
  ): void;

  /**
   * Detach terminal and cleanup resources
   */
  detachTerminal(terminal: Terminal): void;

  /**
   * Load addon lazily when needed
   */
  loadAddonLazy<T>(
    terminal: Terminal,
    addonName: string
  ): Promise<T | undefined>;

  /**
   * Dispose terminal and all associated resources
   */
  disposeTerminal(terminal: Terminal): void;
}

interface IAttachOptions {
  enableGpu?: boolean;
  enableUnicode11?: boolean;
  enableSearch?: boolean;
}
```

#### Implementation Strategy

```typescript
class LifecycleController implements ILifecycleController {
  private attachedTerminals = new Map<Terminal, IDisposable>();
  private addonLoaders = new Map<string, Promise<any>>();

  attachTerminal(
    terminal: Terminal,
    container: HTMLElement,
    options: IAttachOptions
  ): void {
    // Open terminal in container
    terminal.open(container);

    const disposables: IDisposable[] = [];

    // Setup focus handling
    if (terminal.textarea) {
      disposables.push(
        this.addDisposableListener(terminal.textarea, 'focus', () => {
          // Handle focus
        })
      );
      disposables.push(
        this.addDisposableListener(terminal.textarea, 'blur', () => {
          // Handle blur
        })
      );
    }

    // Enable GPU acceleration if requested
    if (options.enableGpu) {
      this.loadAddonLazy<WebglAddon>(terminal, 'webgl')
        .then((addon) => {
          if (addon) {
            // Monitor context loss
            addon.onContextLoss(() => {
              this.handleContextLoss(terminal, addon);
            });
          }
        })
        .catch((error) => {
          console.warn('WebGL addon failed to load:', error);
        });
    }

    // Store disposables
    this.attachedTerminals.set(terminal, {
      dispose: () => disposables.forEach((d) => d.dispose())
    });
  }

  detachTerminal(terminal: Terminal): void {
    const disposable = this.attachedTerminals.get(terminal);
    if (disposable) {
      disposable.dispose();
      this.attachedTerminals.delete(terminal);
    }
  }

  async loadAddonLazy<T>(
    terminal: Terminal,
    addonName: string
  ): Promise<T | undefined> {
    try {
      // Check if addon is already loaded
      const existingAddon = (terminal as any)[`_${addonName}Addon`];
      if (existingAddon) {
        return existingAddon;
      }

      // Lazy load addon
      let addonLoader = this.addonLoaders.get(addonName);
      if (!addonLoader) {
        addonLoader = this.loadAddon(addonName);
        this.addonLoaders.set(addonName, addonLoader);
      }

      const AddonConstructor = await addonLoader;
      const addon = new AddonConstructor();
      terminal.loadAddon(addon);
      (terminal as any)[`_${addonName}Addon`] = addon;
      return addon;
    } catch (error) {
      console.error(`Failed to load ${addonName} addon:`, error);
      return undefined;
    }
  }

  private async loadAddon(addonName: string): Promise<any> {
    switch (addonName) {
      case 'webgl':
        return (await import('@xterm/addon-webgl')).WebglAddon;
      case 'serialize':
        return (await import('@xterm/addon-serialize')).SerializeAddon;
      case 'search':
        return (await import('@xterm/addon-search')).SearchAddon;
      case 'unicode11':
        return (await import('@xterm/addon-unicode11')).Unicode11Addon;
      default:
        throw new Error(`Unknown addon: ${addonName}`);
    }
  }

  private handleContextLoss(terminal: Terminal, addon: WebglAddon): void {
    // Dispose WebGL addon
    addon.dispose();
    (terminal as any)._webglAddon = undefined;

    // Terminal automatically falls back to DOM renderer
    console.warn('WebGL context lost, fallback to DOM renderer');
  }

  disposeTerminal(terminal: Terminal): void {
    // Dispose all addons
    const webglAddon = (terminal as any)._webglAddon;
    if (webglAddon) {
      webglAddon.dispose();
    }

    const serializeAddon = (terminal as any)._serializeAddon;
    if (serializeAddon) {
      serializeAddon.dispose();
    }

    // Detach from container
    this.detachTerminal(terminal);

    // Dispose terminal
    terminal.dispose();
  }

  private addDisposableListener(
    element: Element,
    event: string,
    handler: EventListener
  ): IDisposable {
    element.addEventListener(event, handler);
    return {
      dispose: () => element.removeEventListener(event, handler)
    };
  }
}
```

## Integration with Existing System

### Modified Components

#### 1. TerminalLifecycleManager

```typescript
class TerminalLifecycleManager {
  private renderingOptimizer: IRenderingOptimizer;
  private scrollbackManager: IScrollbackManager;
  private lifecycleController: ILifecycleController;

  async createTerminal(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig
  ): Promise<Terminal | null> {
    // Create terminal instance
    const terminal = new Terminal({
      scrollback: config?.scrollback || 1000,
      // ... other options
    });

    // Create container
    const container = this.createContainer(terminalId, terminalName);

    // Attach terminal with optimizations
    this.lifecycleController.attachTerminal(terminal, container, {
      enableGpu: config?.enableGpuAcceleration !== false,
      enableUnicode11: config?.enableUnicode11 !== false,
      enableSearch: config?.enableSearchAddon !== false
    });

    // Setup optimized resize
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    const resizeDisposable = this.renderingOptimizer.setupOptimizedResize(
      terminal,
      container,
      fitAddon
    );

    // Configure smooth scrolling
    this.renderingOptimizer.configureSmoothScrolling(terminal);

    // Store terminal instance
    this.terminals.set(terminalId, {
      terminal,
      container,
      fitAddon,
      resizeDisposable
    });

    return terminal;
  }

  async removeTerminal(terminalId: string): Promise<boolean> {
    const instance = this.terminals.get(terminalId);
    if (!instance) {
      return false;
    }

    // Save scrollback before disposal
    const scrollback = await this.scrollbackManager.saveScrollback(
      instance.terminal,
      1000
    );

    // Store scrollback for session restoration
    await this.persistScrollback(terminalId, scrollback);

    // Dispose terminal and cleanup
    instance.resizeDisposable?.dispose();
    this.lifecycleController.disposeTerminal(instance.terminal);
    this.terminals.delete(terminalId);

    return true;
  }
}
```

#### 2. StandardTerminalPersistenceManager

```typescript
class StandardTerminalPersistenceManager {
  private scrollbackManager: IScrollbackManager;

  async saveSession(terminalId: string): Promise<void> {
    const terminal = this.getTerminal(terminalId);
    if (!terminal) {
      return;
    }

    // Save scrollback with ANSI colors
    const scrollback = await this.scrollbackManager.saveScrollback(
      terminal,
      1000
    );

    // Store in VS Code globalState
    await this.context.globalState.update(
      `scrollback-${terminalId}`,
      scrollback
    );
  }

  async restoreSession(terminalId: string): Promise<boolean> {
    const terminal = this.getTerminal(terminalId);
    if (!terminal) {
      return false;
    }

    // Retrieve scrollback from VS Code globalState
    const scrollback = this.context.globalState.get<string>(
      `scrollback-${terminalId}`
    );

    if (!scrollback) {
      return false;
    }

    // Restore scrollback with ANSI colors
    return await this.scrollbackManager.restoreScrollback(
      terminal,
      scrollback
    );
  }
}
```

## Performance Considerations

### Optimization Targets

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| WebView Draw Calls | 5-7 per terminal creation | 2-3 per terminal creation | Performance profiler |
| Memory Usage (1000 lines scrollback) | ~5MB | ~3.5MB | Chrome DevTools |
| Scrollback Restore Time | 2-3s | <1s | Performance timing API |
| GPU Utilization | Not used | 40-60% when WebGL enabled | GPU profiler |

### Trade-offs

#### WebGL vs DOM Renderer
- **WebGL**: Better performance, GPU accelerated, but can fail on some systems
- **DOM**: Universal compatibility, but slower rendering
- **Decision**: Use WebGL with automatic DOM fallback

#### Serialize vs Plain Text
- **SerializeAddon**: Preserves ANSI colors, larger size
- **Plain Text**: Smaller size, loses formatting
- **Decision**: Use SerializeAddon with plain text fallback

## Testing Strategy

### Unit Tests
- RenderingOptimizer: WebGL fallback, smooth scrolling detection
- ScrollbackManager: Wrapped line handling, buffer iteration
- LifecycleController: Addon lazy loading, disposal

### Integration Tests
- Terminal creation with all optimizations enabled
- Scrollback save/restore with ANSI colors
- WebGL context loss recovery

### Performance Tests
- Measure draw call reduction
- Benchmark scrollback restoration time
- Profile memory usage improvements

## Rollout Strategy

### Phase 1: Feature Flag (Week 1)
- Implement optimizations behind feature flag
- Enable for internal testing only

### Phase 2: Beta Testing (Week 2-3)
- Enable for beta users via settings
- Collect performance metrics and feedback

### Phase 3: General Availability (Week 4)
- Enable by default for all users
- Provide opt-out via settings if needed

## Monitoring and Metrics

### Key Metrics
- WebView draw call count
- Memory usage per terminal
- Scrollback restoration success rate
- WebGL vs DOM renderer usage ratio

### Error Tracking
- WebGL context loss events
- SerializeAddon failures
- Scrollback restoration errors

## Future Enhancements

### Potential Improvements
1. **Incremental Scrollback Save**: Only save changed lines
2. **Compression**: Compress scrollback data for storage
3. **Virtual Scrolling**: Lazy render scrollback for very large buffers
4. **Smart Resize**: Predict resize events and pre-calculate dimensions
