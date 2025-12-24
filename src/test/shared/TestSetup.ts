/**
 * 共通テストセットアップユーティリティ
 * 全テストファイルで重複していた setupTestEnvironment 関数を統合
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

// Initialize browser globals immediately before any imports
if (!(global as any).self) {
  (global as any).self = global;
}
if (!(global as any).window) {
  (global as any).window = global;
}

// Mock HTMLCanvasElement.getContext BEFORE any xterm.js imports
if (typeof (global as any).HTMLCanvasElement === 'undefined') {
  (global as any).HTMLCanvasElement = class MockHTMLCanvasElement {
    getContext(contextType: string): any {
      if (contextType === '2d') {
        return {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          fillRect: () => {},
          strokeRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          closePath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          fillText: () => {},
          strokeText: () => {},
          measureText: () => ({ width: 0 }),
          save: () => {},
          restore: () => {},
          scale: () => {},
          rotate: () => {},
          translate: () => {},
          transform: () => {},
          setTransform: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
          createPattern: () => null,
          getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
          putImageData: () => {},
          drawImage: () => {},
          canvas: this,
        };
      }
      return null;
    }

    get width() {
      return 300;
    }
    set width(_value: number) {}
    get height() {
      return 150;
    }
    set height(_value: number) {}
    toDataURL() {
      return 'data:,';
    }
    toBlob() {}
    getBoundingClientRect() {
      return {
        width: 300,
        height: 150,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 300,
        bottom: 150,
      } as any;
    }
  };
}

import * as sinon from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { JSDOM } from 'jsdom';

// Set up chai plugins
chai.use(sinonChai);

// ============================================================================
// TEST POLLUTION PREVENTION - Module-level state for cleanup
// ============================================================================

/**
 * Store original Module.prototype.require for restoration
 * CRITICAL: This must be restored in cleanupTestEnvironment to prevent test pollution
 */
let originalModuleRequire: NodeRequire | null = null;
let moduleRequireOverridden = false;

/**
 * Store original process.env for restoration
 */
let originalProcessEnv: NodeJS.ProcessEnv | null = null;

// Async setup for chai-as-promised ES module
let chaiAsPromisedSetup = false;
async function setupChaiAsPromised() {
  if (!chaiAsPromisedSetup) {
    const chaiAsPromised = await import('chai-as-promised');
    chai.use(chaiAsPromised.default);
    chaiAsPromisedSetup = true;
  }
}

/**
 * VS Code API のモックオブジェクト
 * 全テストで共通して使用されるVS Code API群のモック
 */
export const mockVscode = {
  workspace: {
    getConfiguration: sinon.stub().callsFake((section) => {
      const config = {
        get: sinon.stub().callsFake((key: string, defaultValue?: unknown): unknown => {
          // Return reasonable defaults for common configuration keys
          if (section === 'secondaryTerminal') {
            const defaults: { [key: string]: unknown } = {
              shell: '/bin/bash',
              shellArgs: [],
              fontSize: 14,
              fontFamily: 'monospace',
              maxTerminals: 5,
              theme: 'auto',
              cursorBlink: true,
              startDirectory: '',
              showHeader: true,
              showIcons: true,
              altClickMovesCursor: true,
              enableCliAgentIntegration: true,
              enableGitHubCopilotIntegration: true,
              enablePersistentSessions: true,
              persistentSessionScrollback: 1000,
              persistentSessionReviveProcess: false,
            };
            // Return default value if key exists in defaults, otherwise return the provided default
            return key in defaults ? defaults[key] : defaultValue;
          }
          if (section === 'terminal.integrated') {
            const defaults: { [key: string]: unknown } = {
              shell: '/bin/bash',
              shellArgs: [],
              altClickMovesCursor: true,
              profiles: {},
              defaultProfile: {},
            };
            return key in defaults ? defaults[key] : defaultValue;
          }
          if (section === 'editor') {
            const defaults: { [key: string]: unknown } = {
              multiCursorModifier: 'alt',
            };
            return key in defaults ? defaults[key] : defaultValue;
          }
          if (section === 'workbench') {
            const defaults: { [key: string]: unknown } = {
              colorTheme: 'One Dark Pro',
              iconTheme: 'vscode-icons',
            };
            return key in defaults ? defaults[key] : defaultValue;
          }
          return defaultValue;
        }),
        has: sinon.stub().returns(true),
        inspect: sinon.stub().returns({ defaultValue: undefined }),
        update: sinon.stub().resolves(),
      };
      return config;
    }),
    onDidChangeConfiguration: sinon.stub().returns({
      dispose: sinon.stub(),
    }),
    workspaceFolders: [
      {
        uri: {
          fsPath: '/test/workspace',
          scheme: 'file',
          path: '/test/workspace',
          toString: () => 'file:///test/workspace',
        },
        name: 'test-workspace',
      },
    ],
    name: 'test-workspace',
  },
  window: {
    showErrorMessage: sinon.stub().resolves(),
    showWarningMessage: sinon.stub().resolves(),
    showInformationMessage: sinon.stub().resolves(),
    createWebviewPanel: sinon.stub(),
    registerWebviewViewProvider: sinon.stub(),
    showOpenDialog: sinon.stub().resolves(),
    showSaveDialog: sinon.stub().resolves(),
    activeTextEditor: {
      document: {
        uri: {
          scheme: 'file',
          fsPath: '/test/file.ts',
          path: '/test/file.ts',
          toString: () => 'file:///test/file.ts',
        },
        getText: sinon.stub().returns('test content'),
        lineAt: sinon.stub().returns({ text: 'test line' }),
        lineCount: 10,
      },
      selection: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
        isEmpty: true,
      },
    },
  },
  commands: {
    registerCommand: sinon.stub(),
    executeCommand: sinon.stub().resolves(),
  },
  ExtensionContext: sinon.stub(),
  ViewColumn: { One: 1, Two: 2, Three: 3, Left: 1, Right: 2 },
  TreeDataProvider: sinon.stub(),
  EventEmitter: class MockEventEmitter {
    private listeners: Array<(event: any) => void> = [];

    fire = (event: any) => {
      this.listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    };

    event = (listener: (event: any) => void) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          const index = this.listeners.indexOf(listener);
          if (index >= 0) {
            this.listeners.splice(index, 1);
          }
        },
      };
    };

    dispose = () => {
      this.listeners.length = 0;
    };
  },
  CancellationToken: sinon.stub(),
  Uri: {
    file: sinon.stub().callsFake((path: string) => ({
      scheme: 'file',
      path: path,
      fsPath: path,
      toString: () => `file://${path}`,
      with: sinon.stub(),
    })),
    parse: sinon.stub().callsFake((uri: string) => ({
      scheme: 'file',
      path: uri.replace('file://', ''),
      fsPath: uri.replace('file://', ''),
      toString: () => uri,
      with: sinon.stub(),
    })),
    joinPath: sinon.stub().callsFake((base: any, ...pathSegments: string[]) => ({
      scheme: base.scheme || 'file',
      path: `${base.path}/${pathSegments.join('/')}`,
      fsPath: `${base.fsPath || base.path}/${pathSegments.join('/')}`,
      toString: () => `${base.scheme || 'file'}://${base.path}/${pathSegments.join('/')}`,
      with: sinon.stub(),
    })),
  },
  env: {
    openExternal: sinon.stub().resolves(),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
};

/**
 * 基本的なテスト環境セットアップ
 * グローバルなモックとNode.js環境のセットアップを行う
 */
export async function setupTestEnvironment(): Promise<void> {
  // Setup chai-as-promised first
  await setupChaiAsPromised();
  // Mock VS Code module
  (global as any).vscode = mockVscode;

  // CRITICAL: Register vscode mock in require.cache so that `import * as vscode from 'vscode'` returns the mock
  // This fixes ConfigurationService and other modules that import vscode directly
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Module = require('module');
  try {
    const vscodeModulePath = require.resolve('vscode', { paths: [process.cwd()] });
    require.cache[vscodeModulePath] = {
      id: vscodeModulePath,
      filename: vscodeModulePath,
      loaded: true,
      exports: mockVscode,
    } as NodeModule;
  } catch (e) {
    // vscode module not found in require.resolve, will be handled by Module.prototype.require override
  }

  // Register mocks in require.cache where possible, keeping Module.prototype.require
  // override minimal to preserve nyc coverage instrumentation
  const mockNodePty = {
    spawn: () => ({
      pid: 1234,
      onData: () => ({ dispose: () => {} }),
      onExit: () => ({ dispose: () => {} }),
      write: () => {},
      resize: () => {},
      kill: () => {},
      dispose: () => {},
    }),
  };

  // Register node-pty mocks in cache
  const ptyModules = ['node-pty', '@homebridge/node-pty-prebuilt-multiarch'];
  ptyModules.forEach((moduleName) => {
    try {
      const modulePath = require.resolve(moduleName, { paths: [process.cwd()] });
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: mockNodePty,
      } as NodeModule;
    } catch (e) {
      // Module not found, skip
    }
  });

  // Note: xterm mocks are handled by xterm-mock.js which is loaded first

  // Minimal hook ONLY for 'vscode' module (which has no physical file to cache)
  // CRITICAL: Store original require for restoration in cleanupTestEnvironment
  if (!moduleRequireOverridden) {
    originalModuleRequire = Module.prototype.require;
    moduleRequireOverridden = true;
  }
  const savedOriginalRequire = originalModuleRequire || Module.prototype.require;
  Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
      return mockVscode;
    }
    // All other modules pass through to original require (preserves nyc instrumentation)
    // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-unsafe-return
    return savedOriginalRequire.apply(this, arguments);
  };

  // Mock Node.js modules
  (global as any).require = sinon.stub();
  (global as any).module = { exports: {} };

  // Enhanced process polyfilling for test compatibility
  // Save original process methods NOW before they might get replaced
  // CRITICAL: Save actual Node.js EventEmitter methods to prevent "process.emit is not a function" errors
  const EventEmitter = require('events');
  const originalProcessEmit =
    process.emit && typeof process.emit === 'function'
      ? process.emit.bind(process)
      : EventEmitter.prototype.emit.bind(process);
  const originalProcessOn =
    process.on && typeof process.on === 'function'
      ? process.on.bind(process)
      : EventEmitter.prototype.on.bind(process);
  const originalProcessListeners =
    process.listeners && typeof process.listeners === 'function'
      ? process.listeners.bind(process)
      : EventEmitter.prototype.listeners.bind(process);
  const originalProcessListenerCount =
    process.listenerCount && typeof process.listenerCount === 'function'
      ? process.listenerCount.bind(process)
      : () => 0;
  const savedCwd =
    process.cwd && typeof process.cwd === 'function' ? process.cwd.bind(process) : null;

  const processPolyfill = {
    ...process,
    nextTick: (callback: () => void) => setImmediate(callback),
    env: { ...process.env, NODE_ENV: 'test' },
    platform: process.platform,
    cwd: savedCwd || (() => '/test'),
    argv: process.argv,
    pid: process.pid,
    on: originalProcessOn,
    emit: originalProcessEmit,
    listeners: originalProcessListeners,
    listenerCount: originalProcessListenerCount,
    removeListener: () => processPolyfill,
    removeAllListeners: () => processPolyfill,
    off: () => processPolyfill,
  };

  // Processオブジェクトは上書きせず、必要なプロパティのみ安全に設定
  if (!(global as any).process) {
    (global as any).process = processPolyfill;
  } else {
    // 既存のprocessオブジェクトに不足しているメソッドを追加
    // Use saved original functions to ensure they work correctly
    const existingProcess = (global as any).process;
    if (!existingProcess.nextTick) {
      existingProcess.nextTick = (callback: () => void) => setImmediate(callback);
    }
    if (!existingProcess.on || typeof existingProcess.on !== 'function') {
      existingProcess.on = originalProcessOn;
    }
    if (!existingProcess.emit || typeof existingProcess.emit !== 'function') {
      existingProcess.emit = originalProcessEmit;
    }
    if (!existingProcess.listeners || typeof existingProcess.listeners !== 'function') {
      existingProcess.listeners = originalProcessListeners;
    }
    if (!existingProcess.listenerCount || typeof existingProcess.listenerCount !== 'function') {
      existingProcess.listenerCount = originalProcessListenerCount;
    }
    if (!existingProcess.removeListener) {
      existingProcess.removeListener = () => existingProcess;
    }
    if (!existingProcess.removeAllListeners) {
      existingProcess.removeAllListeners = () => existingProcess;
    }
    if (!existingProcess.off) {
      existingProcess.off = () => existingProcess;
    }
    if (!existingProcess.cwd) {
      existingProcess.cwd = savedCwd || (() => '/test');
    }
  }

  // テスト用の環境変数を一時的に設定（復元可能な形で）
  // CRITICAL: Save original env for restoration
  if (!originalProcessEnv) {
    originalProcessEnv = { ...process.env };
  }
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  // Mock global objects that might be needed
  (global as any).Buffer = Buffer;
  (global as any).setImmediate = setImmediate;
  (global as any).clearImmediate = clearImmediate;

  // Global xterm.js mocks for tests that access them directly
  (global as any).Terminal = function () {
    return {
      write: () => {},
      writeln: () => {},
      clear: () => {},
      resize: () => {},
      focus: () => {},
      blur: () => {},
      dispose: () => {},
      open: () => {},
      onData: () => ({ dispose: () => {} }),
      onResize: () => ({ dispose: () => {} }),
      onKey: () => ({ dispose: () => {} }),
      loadAddon: () => {},
      options: {},
      rows: 24,
      cols: 80,
      buffer: {
        active: {
          length: 100,
          viewportY: 50,
          baseY: 0,
          getLine: () => ({ translateToString: () => '' }),
        },
      },
    };
  };

  (global as any).FitAddon = function () {
    return {
      fit: () => {},
      dispose: () => {},
    };
  };

  // Fix process event handler methods for Mocha compatibility
  // Only add missing methods to the actual process object if they don't exist
  const requiredMethods = ['removeListener', 'removeAllListeners', 'off'];
  requiredMethods.forEach((method) => {
    if (
      !(process as any)[method] &&
      typeof process[method as keyof typeof process] === 'undefined'
    ) {
      (process as any)[method] = function (..._args: any[]) {
        // For methods that need to be chainable
        if (method === 'removeListener' || method === 'removeAllListeners' || method === 'off') {
          return process;
        }
        return;
      };
    }
  });
}

/**
 * 拡張コンソールモックセットアップ
 * テスト中のコンソール出力を制御するためのモック
 * Note: This preserves original console functionality while allowing tests to suppress output
 */
export function setupConsoleMocks(): {
  log: sinon.SinonStub;
  warn: sinon.SinonStub;
  error: sinon.SinonStub;
  info: sinon.SinonStub;
  debug: sinon.SinonStub;
} {
  // Preserve original console for fallback
  const originalConsole = console;

  // Create pass-through stubs that call original console
  const consoleMocks = {
    log: sinon.stub().callsFake((...args) => originalConsole.log(...args)),
    warn: sinon.stub().callsFake((...args) => originalConsole.warn(...args)),
    error: sinon.stub().callsFake((...args) => originalConsole.error(...args)),
    info: sinon.stub().callsFake((...args) => originalConsole.info(...args)),
    debug: sinon.stub().callsFake((...args) => originalConsole.debug(...args)),
  };

  // Don't replace global console - this was causing hangs
  // Tests that need to mock console can access consoleMocks directly

  return consoleMocks;
}

/**
 * JSDOM環境のセットアップ
 * DOM操作が必要なテストのための環境構築
 */
export function setupJSDOMEnvironment(htmlContent?: string): {
  dom: JSDOM;
  document: Document;
  window: any;
} {
  const defaultHtml =
    htmlContent ||
    `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Test Environment</title>
      </head>
      <body>
        <div id="terminal-container"></div>
        <div id="settings-panel"></div>
        <div id="notification-container"></div>
      </body>
    </html>
  `;

  // Ensure process.nextTick is available globally before JSDOM creation
  // Save the original process for JSDOM
  const originalProcess = global.process || process;

  // Ensure process.nextTick exists for JSDOM
  if (!process.nextTick || typeof process.nextTick !== 'function') {
    (process as any).nextTick = (callback: () => void) => setImmediate(callback);
  }

  // Ensure global.process exists with necessary methods for tests
  if (!global.process) {
    (global as any).process = {
      ...originalProcess,
      nextTick: (callback: () => void) => setImmediate(callback),
      env: { ...process.env, NODE_ENV: 'test' },
      on: () => {},
      removeListener: () => global.process,
      removeAllListeners: () => global.process,
      off: () => global.process,
    };
  } else if (typeof global.process.nextTick !== 'function') {
    global.process.nextTick = (callback: () => void) => setImmediate(callback);
  }

  const dom = new JSDOM(defaultHtml, {
    url: 'http://localhost',
    contentType: 'text/html',
    includeNodeLocations: true,
    storageQuota: 10000000,
    beforeParse(window) {
      // Ensure process.nextTick is available for JSDOM
      (window as any).process = {
        ...global.process,
        nextTick: (callback: () => void) => setImmediate(callback),
        env: { NODE_ENV: 'test' },
        platform: 'linux',
        cwd: () => '/test',
        on: () => {},
        removeListener: () => window.process,
        removeAllListeners: () => window.process,
        off: () => window.process,
      };
      // Add missing methods that might be needed
      (window as any).setImmediate = setImmediate;
      (window as any).clearImmediate = clearImmediate;
      (window as any).setTimeout = setTimeout;
      (window as any).clearTimeout = clearTimeout;
    },
  });

  const { window } = dom;
  const { document } = window;

  // グローバルにDOM要素を設定
  (global as any).window = window;
  (global as any).document = document;

  // navigatorは既に存在する場合があるので安全に設定
  if (!(global as any).navigator) {
    (global as any).navigator = window.navigator;
  }

  (global as any).HTMLElement = window.HTMLElement;
  (global as any).Element = window.Element;
  (global as any).Node = window.Node;

  // DOM イベント系のモック
  (global as any).Event = window.Event;
  (global as any).CustomEvent = window.CustomEvent;
  (global as any).MouseEvent = window.MouseEvent;
  (global as any).KeyboardEvent = window.KeyboardEvent;

  // ResizeObserver モック
  (global as any).ResizeObserver = class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // requestAnimationFrame モック
  if (!(global as any).requestAnimationFrame) {
    (global as any).requestAnimationFrame = (callback: FrameRequestCallback): number => {
      return setTimeout(() => callback(Date.now()), 16) as unknown as number;
    };
    (global as any).cancelAnimationFrame = (id: number): void => {
      clearTimeout(id);
    };
  }
  if (!window.requestAnimationFrame) {
    (window as any).requestAnimationFrame = (global as any).requestAnimationFrame;
    (window as any).cancelAnimationFrame = (global as any).cancelAnimationFrame;
  }

  // Element.closest ポリフィル (JSDOMで不足する場合)
  if (window.Element && !window.Element.prototype.closest) {
    window.Element.prototype.closest = function (selector: string): Element | null {
      let element: Element | null = this;
      while (element) {
        if (element.matches && element.matches(selector)) {
          return element;
        }
        element = element.parentElement;
      }
      return null;
    };
  }

  // Element.matches ポリフィル
  if (window.Element && !window.Element.prototype.matches) {
    window.Element.prototype.matches =
      (window.Element.prototype as any).msMatchesSelector ||
      (window.Element.prototype as any).webkitMatchesSelector ||
      function (this: Element, s: string): boolean {
        const matches = (this.ownerDocument || document).querySelectorAll(s);
        let i = matches.length;
        while (--i >= 0 && matches.item(i) !== this) {}
        return i > -1;
      };
  }

  // Element.contains ポリフィル
  if (window.Element && !window.Element.prototype.contains) {
    window.Element.prototype.contains = function (other: Node | null): boolean {
      if (!other) return false;
      let node: Node | null = other;
      while (node) {
        if (node === this) return true;
        node = node.parentNode;
      }
      return false;
    };
  }

  // Element.remove ポリフィル
  if (window.Element && !window.Element.prototype.remove) {
    window.Element.prototype.remove = function (): void {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    };
  }

  // ChildNode.remove ポリフィル (for Text nodes etc.)
  if (window.CharacterData && !window.CharacterData.prototype.remove) {
    window.CharacterData.prototype.remove = function (): void {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    };
  }

  // HTMLCanvasElement.getContext モック (xterm.jsのCanvas依存関係対応)
  if (window.HTMLCanvasElement && !window.HTMLCanvasElement.prototype.getContext) {
    window.HTMLCanvasElement.prototype.getContext = function (contextType: string): any {
      if (contextType === '2d') {
        return {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          fillRect: () => {},
          strokeRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          closePath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          fillText: () => {},
          strokeText: () => {},
          measureText: () => ({ width: 0 }),
          save: () => {},
          restore: () => {},
          scale: () => {},
          rotate: () => {},
          translate: () => {},
          transform: () => {},
          setTransform: () => {},
          createLinearGradient: () => ({
            addColorStop: () => {},
          }),
          createRadialGradient: () => ({
            addColorStop: () => {},
          }),
          createPattern: () => null,
          getImageData: () => ({
            data: new Uint8ClampedArray(),
            width: 0,
            height: 0,
          }),
          putImageData: () => {},
          drawImage: () => {},
          canvas: this,
        };
      }
      return null;
    };
  }

  // グローバルにもHTMLCanvasElementモックを設定
  if (!(global as any).HTMLCanvasElement) {
    (global as any).HTMLCanvasElement = window.HTMLCanvasElement;
  }

  return { dom, document, window };
}

/**
 * Global state snapshot for test isolation
 * Stores original global values to restore after tests
 */
interface GlobalStateSnapshot {
  document: any;
  window: any;
  navigator: any;
  HTMLElement: any;
  Element: any;
  Node: any;
  Event: any;
  CustomEvent: any;
  MouseEvent: any;
  KeyboardEvent: any;
  ResizeObserver: any;
}

/**
 * Backup current global state for restoration
 * Call this in beforeEach to capture state before test modifications
 */
export function backupGlobalState(): GlobalStateSnapshot {
  return {
    document: (global as any).document,
    window: (global as any).window,
    navigator: (global as any).navigator,
    HTMLElement: (global as any).HTMLElement,
    Element: (global as any).Element,
    Node: (global as any).Node,
    Event: (global as any).Event,
    CustomEvent: (global as any).CustomEvent,
    MouseEvent: (global as any).MouseEvent,
    KeyboardEvent: (global as any).KeyboardEvent,
    ResizeObserver: (global as any).ResizeObserver,
  };
}

/**
 * Restore global state from snapshot
 * Call this in afterEach to restore original global state
 */
export function restoreGlobalState(snapshot: GlobalStateSnapshot): void {
  (global as any).document = snapshot.document;
  (global as any).window = snapshot.window;
  (global as any).navigator = snapshot.navigator;
  (global as any).HTMLElement = snapshot.HTMLElement;
  (global as any).Element = snapshot.Element;
  (global as any).Node = snapshot.Node;
  (global as any).Event = snapshot.Event;
  (global as any).CustomEvent = snapshot.CustomEvent;
  (global as any).MouseEvent = snapshot.MouseEvent;
  (global as any).KeyboardEvent = snapshot.KeyboardEvent;
  (global as any).ResizeObserver = snapshot.ResizeObserver;
}

/**
 * Helper function to reset all stubs in an object recursively
 * Resets both call history and behavior
 */
function resetStubsRecursively(obj: any, depth: number = 0): void {
  if (!obj || typeof obj !== 'object' || depth > 3) return;

  Object.keys(obj).forEach(key => {
    try {
      const value = obj[key];
      if (value && typeof value === 'function') {
        // Reset stub history if it's a sinon stub
        if (typeof value.resetHistory === 'function') {
          value.resetHistory();
        }
        if (typeof value.reset === 'function') {
          value.reset();
        }
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recurse into nested objects
        resetStubsRecursively(value, depth + 1);
      }
    } catch (e) {
      // Ignore errors for individual stub resets
    }
  });
}

/**
 * テスト分離とクリーンアップのためのリセット関数
 * テスト間で状態が持ち越されることを防ぐ
 *
 * CRITICAL: This function now performs comprehensive cleanup to prevent test pollution
 */
export function resetTestEnvironment(): void {
  // Clear all Sinon state safely
  try {
    sinon.reset();
  } catch (error) {
    // Reset may fail if nothing to reset, this is OK
    console.debug('Sinon reset warning:', error);
  }

  try {
    sinon.restore();
  } catch (error) {
    // Restore may fail if nothing to restore, this is OK
    console.debug('Sinon restore warning:', error);
  }

  // CRITICAL: Reset ALL mockVscode stubs to prevent call history accumulation
  try {
    if (mockVscode) {
      // Reset workspace stubs
      resetStubsRecursively(mockVscode.workspace);

      // Reset window stubs
      resetStubsRecursively(mockVscode.window);

      // Reset commands stubs
      resetStubsRecursively(mockVscode.commands);

      // Reset Uri stubs
      resetStubsRecursively(mockVscode.Uri);

      // Reset env stubs
      resetStubsRecursively(mockVscode.env);
    }
  } catch (error) {
    console.debug('MockVscode reset warning:', error);
  }
}

/**
 * 安全なSinon stub作成 - "already wrapped" エラーを防ぐ
 */
export function safeStub(obj: any, method: string): sinon.SinonStub {
  if (obj[method] && obj[method].restore) {
    obj[method].restore();
  }
  return sinon.stub(obj, method);
}

/**
 * 完全なテスト環境セットアップ
 * 基本環境 + コンソールモック + JSDOM環境の統合セットアップ
 */
export function setupCompleteTestEnvironment(htmlContent?: string): {
  dom: JSDOM;
  document: Document;
  window: any;
  consoleMocks: ReturnType<typeof setupConsoleMocks>;
  mockVscode: typeof mockVscode;
} {
  setupTestEnvironment();
  const consoleMocks = setupConsoleMocks();
  const { dom, document, window } = setupJSDOMEnvironment(htmlContent);

  return {
    dom,
    document,
    window,
    consoleMocks,
    mockVscode,
  };
}

/**
 * sinon サンドボックスとテスト環境のクリーンアップ
 * afterEach で呼び出してテスト間の状態リセットを行う
 *
 * CRITICAL: This function now restores Module.prototype.require and process.env
 * to prevent test pollution between test files
 */
export function cleanupTestEnvironment(
  sandbox?: sinon.SinonSandbox,
  dom?: JSDOM,
  globalSnapshot?: GlobalStateSnapshot
): void {
  // sinon スタブをリセット
  if (sandbox) {
    try {
      sandbox.restore();
    } catch (error) {
      // Restore may fail if already restored, this is OK
      console.debug('Sandbox restore warning:', error);
    }
  }

  // JSDOM をクリーンアップ
  if (dom) {
    try {
      dom.window.close();
    } catch (error) {
      // Window may already be closed, this is OK
      console.debug('JSDOM cleanup warning:', error);
    }
  }

  // グローバル状態を復元（スナップショットがある場合）
  if (globalSnapshot) {
    try {
      restoreGlobalState(globalSnapshot);
    } catch (error) {
      console.debug('Global state restore warning:', error);
    }
  }

  // CRITICAL: Reset mockVscode stubs to prevent call history accumulation
  resetTestEnvironment();

  // グローバル状態をクリア
  try {
    const config = mockVscode.workspace.getConfiguration();
    if (config && typeof config === 'object') {
      Object.keys(config).forEach((key) => {
        if (typeof config[key] === 'object' && config[key] && config[key].reset) {
          try {
            config[key].reset();
          } catch (error) {
            // Reset may fail, this is OK
            console.debug(`Config reset warning for ${key}:`, error);
          }
        }
      });
    }
  } catch (error) {
    // Config cleanup may fail, this is OK
    console.debug('Config cleanup warning:', error);
  }

  // グローバルオブジェクトの部分的クリーンアップ（スナップショットがない場合のみ）
  if (!globalSnapshot) {
    try {
      delete (global as any).window;
      delete (global as any).document;
      delete (global as any).navigator;
    } catch (error) {
      // Global cleanup may fail, this is OK
      console.debug('Global cleanup warning:', error);
    }
  }
}

/**
 * Full test environment teardown - restores Module.prototype.require
 * Call this at the end of a test suite (in after()) to fully restore Node.js state
 *
 * CRITICAL: This prevents test pollution between test files
 */
export function teardownTestEnvironment(): void {
  // Restore Module.prototype.require
  if (originalModuleRequire && moduleRequireOverridden) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Module = require('module');
      Module.prototype.require = originalModuleRequire;
      moduleRequireOverridden = false;
    } catch (error) {
      console.debug('Module.prototype.require restore warning:', error);
    }
  }

  // Restore process.env
  if (originalProcessEnv) {
    try {
      // Clear current env and restore original
      Object.keys(process.env).forEach(key => {
        if (!(key in originalProcessEnv!)) {
          delete process.env[key];
        }
      });
      Object.assign(process.env, originalProcessEnv);
    } catch (error) {
      console.debug('process.env restore warning:', error);
    }
  }

  // Clear require.cache entries we added
  try {
    const modulesToClear = ['vscode', 'node-pty', '@homebridge/node-pty-prebuilt-multiarch'];
    modulesToClear.forEach(moduleName => {
      try {
        const modulePath = require.resolve(moduleName, { paths: [process.cwd()] });
        delete require.cache[modulePath];
      } catch (e) {
        // Module not found, skip
      }
    });
  } catch (error) {
    console.debug('require.cache cleanup warning:', error);
  }
}

/**
 * Create an isolated test context with automatic cleanup
 * Use this for tests that need complete isolation
 *
 * @example
 * describe('MyTest', () => {
 *   const ctx = createIsolatedTestContext();
 *
 *   beforeEach(() => ctx.setup());
 *   afterEach(() => ctx.cleanup());
 *
 *   it('should work', () => {
 *     // Test code
 *   });
 * });
 */
export function createIsolatedTestContext(): {
  setup: () => { dom: JSDOM; document: Document; window: any; sandbox: sinon.SinonSandbox };
  cleanup: () => void;
  getSandbox: () => sinon.SinonSandbox;
} {
  let dom: JSDOM | null = null;
  let globalSnapshot: GlobalStateSnapshot | null = null;
  let sandbox: sinon.SinonSandbox | null = null;

  return {
    setup: () => {
      // Create sandbox first
      sandbox = sinon.createSandbox();

      // Backup global state
      globalSnapshot = backupGlobalState();

      // Setup JSDOM
      const result = setupJSDOMEnvironment();
      dom = result.dom;

      return {
        dom: result.dom,
        document: result.document,
        window: result.window,
        sandbox,
      };
    },

    cleanup: () => {
      // Use try-finally to ensure all cleanup happens
      try {
        if (sandbox) {
          sandbox.restore();
        }
      } finally {
        try {
          if (dom) {
            dom.window.close();
          }
        } finally {
          if (globalSnapshot) {
            restoreGlobalState(globalSnapshot);
          }
        }
      }

      // Reset references
      dom = null;
      globalSnapshot = null;
      sandbox = null;
    },

    getSandbox: () => {
      if (!sandbox) {
        throw new Error('Test context not set up. Call setup() first.');
      }
      return sandbox;
    },
  };
}

// Fix process.removeListener issue for Mocha
if (process && !process.removeListener) {
  (process as any).removeListener = function () {
    return process;
  };
}

// Additional process polyfills for Mocha compatibility
if (process) {
  // Ensure all required event emitter methods exist
  const requiredMethods = ['removeListener', 'removeAllListeners', 'off', 'listenerCount'];
  requiredMethods.forEach((method) => {
    if (!(process as any)[method]) {
      const stub =
        method === 'listenerCount'
          ? function () {
              return 0;
            } // Return 0 listeners for test environment
          : function () {
              return process;
            };

      try {
        Object.defineProperty(process, method, {
          value: stub,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch (e) {
        // Fallback to direct assignment if defineProperty fails
        (process as any)[method] = stub;
      }
    }
  });
}

// Sync version for backwards compatibility (without chai-as-promised)
export function setupTestEnvironmentSync(): void {
  // Mock VS Code module
  (global as any).vscode = mockVscode;

  // CRITICAL: Register vscode mock in require.cache so that `import * as vscode from 'vscode'` returns the mock
  // This fixes ConfigurationService and other modules that import vscode directly
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Module = require('module');
  try {
    const vscodeModulePath = require.resolve('vscode', { paths: [process.cwd()] });
    require.cache[vscodeModulePath] = {
      id: vscodeModulePath,
      filename: vscodeModulePath,
      loaded: true,
      exports: mockVscode,
    } as NodeModule;
  } catch (e) {
    // vscode module not found in require.resolve, will be handled by Module.prototype.require override
  }

  // Register mocks in require.cache where possible
  const mockNodePtySync = {
    spawn: () => ({
      write: () => {},
      resize: () => {},
      kill: () => {},
      dispose: () => {},
    }),
  };

  // Register node-pty mock in cache
  try {
    const ptyPath = require.resolve('@homebridge/node-pty-prebuilt-multiarch', { paths: [process.cwd()] });
    require.cache[ptyPath] = {
      id: ptyPath,
      filename: ptyPath,
      loaded: true,
      exports: mockNodePtySync,
    } as NodeModule;
  } catch (e) {
    // Module not found, skip
  }

  // Minimal hook ONLY for 'vscode' module (which has no physical file to cache)
  // CRITICAL: Store original require for restoration in teardownTestEnvironment
  if (!moduleRequireOverridden) {
    originalModuleRequire = Module.prototype.require;
    moduleRequireOverridden = true;
  }
  const savedOriginalRequireSync = originalModuleRequire || Module.prototype.require;
  Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
      return mockVscode;
    }
    // All other modules pass through to original require (preserves nyc instrumentation)
    // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-unsafe-return
    return savedOriginalRequireSync.apply(this, arguments);
  };

  // Set up DOM environment
  setupJSDOMEnvironment(); // Re-enabled - tests need DOM for UIController, WebView, etc.
  setupConsoleMocks(); // Re-enabled with pass-through implementation

  // Ensure process.cwd exists and is callable
  // Note: setup-exit-handler.js should have already wrapped process.cwd,
  // but we double-check here in case it wasn't loaded first
  if (!process.cwd || typeof process.cwd !== 'function') {
    const fallbackCwd = () => '/test';
    try {
      Object.defineProperty(process, 'cwd', {
        value: fallbackCwd,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {
      (process as any).cwd = fallbackCwd;
    }
  }

  // Ensure process.memoryUsage exists for memory leak tests
  if (!process.memoryUsage || typeof process.memoryUsage !== 'function') {
    (process as any).memoryUsage = () => ({
      heapUsed: 50 * 1024 * 1024, // 50MB
      heapTotal: 100 * 1024 * 1024, // 100MB
      external: 10 * 1024 * 1024, // 10MB
      rss: 150 * 1024 * 1024, // 150MB
      arrayBuffers: 5 * 1024 * 1024, // 5MB
    });
  }

  // Ensure process.emit exists for EventEmitter compatibility
  if (!process.emit || typeof process.emit !== 'function') {
    (process as any).emit = () => false;
  }
}

// Auto-setup when this module is imported (sync version for compatibility)
try {
  setupTestEnvironmentSync();
} catch (error) {
  console.error('Failed to setup test environment:', error);
  throw error;
}

/**
 * TypeScript型定義の拡張
 * テスト環境で使用するグローバル変数の型を定義
 */
