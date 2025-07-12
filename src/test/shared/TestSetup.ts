/**
 * 共通テストセットアップユーティリティ
 * 全テストファイルで重複していた setupTestEnvironment 関数を統合
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';

/**
 * VS Code API のモックオブジェクト
 * 全テストで共通して使用されるVS Code API群のモック
 */
export const mockVscode = {
  workspace: {
    getConfiguration: sinon.stub().returns({
      get: sinon.stub().returns(undefined),
      has: sinon.stub().returns(false),
      inspect: sinon.stub().returns(undefined),
      update: sinon.stub().resolves(),
    }),
    onDidChangeConfiguration: sinon.stub().returns({
      dispose: sinon.stub(),
    }),
    workspaceFolders: [],
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
  },
  commands: {
    registerCommand: sinon.stub(),
    executeCommand: sinon.stub().resolves(),
  },
  ExtensionContext: sinon.stub(),
  ViewColumn: { One: 1, Two: 2, Three: 3 },
  TreeDataProvider: sinon.stub(),
  EventEmitter: sinon.stub(),
  CancellationToken: sinon.stub(),
  Uri: {
    file: sinon.stub(),
    parse: sinon.stub(),
    joinPath: sinon.stub(),
  },
  env: {
    openExternal: sinon.stub().resolves(),
  },
};

/**
 * 基本的なテスト環境セットアップ
 * グローバルなモックとNode.js環境のセットアップを行う
 */
export function setupTestEnvironment(): void {
  // Mock VS Code module
  (global as any).vscode = mockVscode;

  // Mock Node.js modules
  (global as any).require = sinon.stub();
  (global as any).module = { exports: {} };
  (global as any).process = {
    platform: 'linux',
    env: {
      NODE_ENV: 'test',
      ...process.env,
    },
    cwd: sinon.stub().returns('/test'),
    exit: sinon.stub(),
    nextTick: process.nextTick.bind(process),
    stdout: process.stdout,
    stderr: process.stderr,
  };

  // Mock global objects that might be needed
  (global as any).Buffer = Buffer;
  (global as any).setImmediate = setImmediate;
  (global as any).clearImmediate = clearImmediate;
}

/**
 * 拡張コンソールモックセットアップ
 * テスト中のコンソール出力を制御するためのモック
 */
export function setupConsoleMocks(): {
  log: sinon.SinonStub;
  warn: sinon.SinonStub;
  error: sinon.SinonStub;
  info: sinon.SinonStub;
  debug: sinon.SinonStub;
} {
  const consoleMocks = {
    log: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    info: sinon.stub(),
    debug: sinon.stub(),
  };

  (global as Record<string, unknown>).console = consoleMocks;

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

  const dom = new JSDOM(defaultHtml, {
    url: 'http://localhost',
    contentType: 'text/html',
    includeNodeLocations: true,
    storageQuota: 10000000,
  });

  const { window } = dom;
  const { document } = window;

  // グローバルにDOM要素を設定
  (global as any).window = window;
  (global as any).document = document;
  (global as any).navigator = window.navigator;
  (global as any).HTMLElement = window.HTMLElement;
  (global as any).Element = window.Element;
  (global as any).Node = window.Node;

  // DOM イベント系のモック
  (global as any).Event = window.Event;
  (global as any).CustomEvent = window.CustomEvent;
  (global as any).MouseEvent = window.MouseEvent;
  (global as any).KeyboardEvent = window.KeyboardEvent;

  return { dom, document, window };
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
  Object.keys(mockVscode.workspace.getConfiguration()).forEach((key) => {
    if (
      typeof mockVscode.workspace.getConfiguration()[key] === 'object' &&
      mockVscode.workspace.getConfiguration()[key].reset
    ) {
      mockVscode.workspace.getConfiguration()[key].reset();
    }
  });

  // グローバルオブジェクトの部分的クリアアップ
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).navigator;
}

/**
 * TypeScript型定義の拡張
 * テスト環境で使用するグローバル変数の型を定義
 */
