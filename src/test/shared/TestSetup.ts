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

    get width() { return 300; }
    set width(_value: number) {}
    get height() { return 150; }
    set height(_value: number) {}
    toDataURL() { return 'data:,'; }
    toBlob() {}
    getBoundingClientRect() { return { width: 300, height: 150, x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 150 } as any; }
  };
}

import * as sinon from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { JSDOM } from 'jsdom';

// Set up chai plugins
chai.use(sinonChai);

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

  // Override module loading for vscode and node-pty
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
      return mockVscode;
    }
    if (id === 'node-pty' || id === '@homebridge/node-pty-prebuilt-multiarch') {
      return {
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
    }
    // すべてのxterm関連モジュールをモック
    if (id === 'xterm' || id === '@xterm/xterm' || id.startsWith('xterm') || id.startsWith('@xterm/')) {
      return {
        Terminal: function () {
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
        },
        FitAddon: function () {
          return {
            fit: () => {},
            dispose: () => {},
          };
        },
      };
    }
    // Allow actual source code to be loaded for coverage
    // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-unsafe-return
    return originalRequire.apply(this, arguments);
  };

  // Mock Node.js modules
  (global as any).require = sinon.stub();
  (global as any).module = { exports: {} };

  // Enhanced process polyfilling for test compatibility
  const processPolyfill = {
    ...process,
    nextTick: (callback: () => void) => setImmediate(callback),
    env: { ...process.env, NODE_ENV: 'test' },
    platform: process.platform,
    cwd: process.cwd ? (() => process.cwd()) : (() => '/test'),
    argv: process.argv,
    pid: process.pid,
    on: () => {},
    removeListener: () => processPolyfill,
    removeAllListeners: () => processPolyfill,
    off: () => processPolyfill,
  };

  // Processオブジェクトは上書きせず、必要なプロパティのみ安全に設定
  if (!(global as any).process) {
    (global as any).process = processPolyfill;
  } else {
    // 既存のprocessオブジェクトに不足しているメソッドを追加
    const existingProcess = (global as any).process;
    if (!existingProcess.nextTick) {
      existingProcess.nextTick = (callback: () => void) => setImmediate(callback);
    }
    if (!existingProcess.on) {
      existingProcess.on = () => {};
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
      existingProcess.cwd = () => '/test';
    }
  }

  // テスト用の環境変数を一時的に設定（復元可能な形で）
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
 * テスト分離とクリーンアップのためのリセット関数
 * テスト間で状態が持ち越されることを防ぐ
 */
export function resetTestEnvironment(): void {
  // Clear all Sinon state safely
  try {
    sinon.reset();
  } catch (error) {
    // Reset may fail if nothing to reset, this is OK
  }

  try {
    sinon.restore();
  } catch (error) {
    // Restore may fail if nothing to restore, this is OK
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
 */
export function cleanupTestEnvironment(sandbox?: sinon.SinonSandbox, dom?: JSDOM): void {
  // sinon スタブをリセット
  if (sandbox) {
    sandbox.restore();
  }

  // JSDOM をクリーンアップ
  if (dom) {
    dom.window.close();
  }

  // グローバル状態をクリア
  const config = mockVscode.workspace.getConfiguration();
  if (config && typeof config === 'object') {
    Object.keys(config).forEach((key) => {
      if (typeof config[key] === 'object' && config[key] && config[key].reset) {
        config[key].reset();
      }
    });
  }

  // グローバルオブジェクトの部分的クリアアップ
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).navigator;
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
      const stub = method === 'listenerCount'
        ? function () { return 0; } // Return 0 listeners for test environment
        : function () { return process; };

      try {
        Object.defineProperty(process, method, {
          value: stub,
          writable: true,
          configurable: true,
          enumerable: false
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

  // Override module loading for vscode and node-pty
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
      return mockVscode;
    }
    if (id === '@homebridge/node-pty-prebuilt-multiarch') {
      return {
        spawn: () => ({
          write: () => {},
          resize: () => {},
          kill: () => {},
          dispose: () => {},
        }),
      };
    }
    // Continue with other mocks...
    return originalRequire.apply(this, arguments);
  };

  // Set up DOM environment
  // setupJSDOMEnvironment(); // Temporarily disabled - tests don't need DOM yet
  setupConsoleMocks(); // Re-enabled with pass-through implementation

  // Ensure process.cwd exists
  if (!process.cwd || typeof process.cwd !== 'function') {
    (process as any).cwd = () => '/test';
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
