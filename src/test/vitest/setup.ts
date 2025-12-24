/**
 * Vitest Global Setup
 * Provides common setup for all tests including DOM, browser APIs, and xterm.js mocks
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Browser API Polyfills
// ============================================================================

// Performance API
if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    getEntries: vi.fn().mockReturnValue([]),
    getEntriesByName: vi.fn().mockReturnValue([]),
    getEntriesByType: vi.fn().mockReturnValue([]),
    toJSON: vi.fn().mockReturnValue({}),
    timeOrigin: Date.now(),
    timing: {} as PerformanceTiming,
    navigation: {} as PerformanceNavigation,
    onresourcetimingbufferfull: null,
    setResourceTimingBufferSize: vi.fn(),
    clearResourceTimings: vi.fn(),
    eventCounts: new Map(),
  } as unknown as Performance;
}

// MessageEvent polyfill
if (typeof globalThis.MessageEvent === 'undefined') {
  globalThis.MessageEvent = class MockMessageEvent<T = unknown> extends Event {
    readonly data: T;
    readonly origin: string;
    readonly lastEventId: string;
    readonly source: MessageEventSource | null;
    readonly ports: readonly MessagePort[];

    constructor(type: string, init?: MessageEventInit<T>) {
      super(type, init);
      this.data = init?.data as T;
      this.origin = init?.origin || '';
      this.lastEventId = init?.lastEventId || '';
      this.source = init?.source || null;
      this.ports = init?.ports || [];
    }

    initMessageEvent(): void {}
  } as unknown as typeof MessageEvent;
}

// CustomEvent polyfill
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class MockCustomEvent<T = unknown> extends Event {
    readonly detail: T;

    constructor(type: string, init?: CustomEventInit<T>) {
      super(type, init);
      this.detail = init?.detail as T;
    }

    initCustomEvent(): void {}
  } as unknown as typeof CustomEvent;
}

// ResizeObserver polyfill
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class MockResizeObserver {
    private callback: ResizeObserverCallback;
    private observedElements: Set<Element> = new Set();

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element): void {
      this.observedElements.add(target);
    }

    unobserve(target: Element): void {
      this.observedElements.delete(target);
    }

    disconnect(): void {
      this.observedElements.clear();
    }

    // Test helper to trigger resize
    _triggerResize(entries: ResizeObserverEntry[]): void {
      this.callback(entries, this);
    }
  } as unknown as typeof ResizeObserver;
}

// IntersectionObserver polyfill
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class MockIntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '0px';
    readonly thresholds: ReadonlyArray<number> = [0];

    constructor(
      _callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit
    ) {}

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// MutationObserver polyfill (happy-dom may already provide this)
if (typeof globalThis.MutationObserver === 'undefined') {
  globalThis.MutationObserver = class MockMutationObserver {
    constructor(_callback: MutationCallback) {}
    observe(): void {}
    disconnect(): void {}
    takeRecords(): MutationRecord[] {
      return [];
    }
  } as unknown as typeof MutationObserver;
}

// requestAnimationFrame / cancelAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    return setTimeout(() => callback(performance.now()), 16) as unknown as number;
  };
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (handle: number): void => {
    clearTimeout(handle);
  };
}

// ============================================================================
// xterm.js Mock
// ============================================================================

const createMockTerminal = () => ({
  onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onKey: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onResize: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onTitleChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onBell: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onBinary: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onCursorMove: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onLineFeed: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onScroll: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onSelectionChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onRender: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onWriteParsed: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  open: vi.fn(),
  write: vi.fn(),
  writeln: vi.fn(),
  paste: vi.fn(),
  clear: vi.fn(),
  reset: vi.fn(),
  resize: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  scrollToTop: vi.fn(),
  scrollToBottom: vi.fn(),
  scrollLines: vi.fn(),
  scrollPages: vi.fn(),
  scrollToLine: vi.fn(),
  select: vi.fn(),
  selectAll: vi.fn(),
  selectLines: vi.fn(),
  clearSelection: vi.fn(),
  hasSelection: vi.fn().mockReturnValue(false),
  getSelection: vi.fn().mockReturnValue(''),
  getSelectionPosition: vi.fn().mockReturnValue(undefined),
  refresh: vi.fn(),
  attachCustomKeyEventHandler: vi.fn(),
  attachCustomWheelEventHandler: vi.fn(),
  registerLinkProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  registerCharacterJoiner: vi.fn().mockReturnValue(0),
  deregisterCharacterJoiner: vi.fn(),
  registerMarker: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  registerDecoration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  loadAddon: vi.fn(),
  dispose: vi.fn(),
  element: null,
  textarea: null,
  rows: 24,
  cols: 80,
  buffer: {
    active: {
      type: 'normal',
      baseY: 0,
      length: 0,
      viewportY: 0,
      cursorX: 0,
      cursorY: 0,
      getLine: vi.fn().mockReturnValue(null),
    },
    alternate: {
      type: 'alternate',
      baseY: 0,
      length: 0,
      viewportY: 0,
      cursorX: 0,
      cursorY: 0,
      getLine: vi.fn().mockReturnValue(null),
    },
    normal: {
      type: 'normal',
      baseY: 0,
      length: 0,
      viewportY: 0,
      cursorX: 0,
      cursorY: 0,
      getLine: vi.fn().mockReturnValue(null),
    },
    onBufferChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  options: {
    cursorBlink: false,
    cursorStyle: 'block',
    scrollback: 1000,
    tabStopWidth: 8,
    theme: {},
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 1,
    letterSpacing: 0,
    allowTransparency: false,
    bellStyle: 'none',
    cols: 80,
    rows: 24,
  },
  markers: [],
  unicode: {
    activeVersion: '11',
    versions: ['6', '11'],
  },
  parser: {
    registerCsiHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerDcsHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerEscHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerOscHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  modes: {
    mouseTrackingMode: 'none',
    applicationCursorKeysMode: false,
    applicationKeypadMode: false,
    bracketedPasteMode: false,
    insertMode: false,
    originMode: false,
    reverseWraparoundMode: false,
    sendFocusMode: false,
    wraparoundMode: true,
  },
});

// Mock xterm.js Terminal class
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => createMockTerminal()),
}));

// Mock xterm addons
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    activate: vi.fn(),
    dispose: vi.fn(),
    fit: vi.fn(),
    proposeDimensions: vi.fn().mockReturnValue({ cols: 80, rows: 24 }),
  })),
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: vi.fn().mockImplementation(() => ({
    activate: vi.fn(),
    dispose: vi.fn(),
    onContextLoss: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    clearTextureAtlas: vi.fn(),
  })),
}));

vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: vi.fn().mockImplementation(() => ({
    activate: vi.fn(),
    dispose: vi.fn(),
    serialize: vi.fn().mockReturnValue(''),
    serializeAsHTML: vi.fn().mockReturnValue(''),
  })),
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: vi.fn().mockImplementation(() => ({
    activate: vi.fn(),
    dispose: vi.fn(),
    findNext: vi.fn().mockReturnValue(false),
    findPrevious: vi.fn().mockReturnValue(false),
    clearDecorations: vi.fn(),
    onDidChangeResults: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  })),
}));

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(() => ({
    activate: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({
    activate: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// ============================================================================
// Global Test Hooks
// ============================================================================

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Export utilities
// ============================================================================

export { createMockTerminal };
