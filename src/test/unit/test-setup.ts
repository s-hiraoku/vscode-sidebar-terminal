/**
 * Unit test setup - Mock VS Code API and other dependencies
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable prefer-rest-params */

// Mock VS Code API
const vscode = {
  workspace: {
    workspaceFolders: [
      {
        uri: { fsPath: '/workspace/test' },
        name: 'test-project',
      },
    ],
    getConfiguration: () => ({
      get: () => undefined,
    }),
  },
  EventEmitter: class {
    constructor() {}
    event = () => {};
    fire = () => {};
    dispose = () => {};
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
    parse: (uri: string) => ({ fsPath: uri }),
  },
  window: {
    showErrorMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve(),
    showInformationMessage: () => Promise.resolve(),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: () => Promise.resolve(),
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
  },
};

// Register the mock globally
(global as Record<string, unknown>).vscode = vscode;

// Mock Node.js process more completely but preserve existing functionality
const originalProcess = (global as any).process;
if (originalProcess && !originalProcess.nextTick) {
  originalProcess.nextTick = (callback: () => void) => {
    setImmediate(callback);
  };
}
if (originalProcess && !originalProcess.env) {
  originalProcess.env = {};
}
if (originalProcess && !originalProcess.platform) {
  originalProcess.platform = 'test';
}
if (originalProcess && !originalProcess.versions) {
  originalProcess.versions = { node: '18.0.0' };
}

// Mock node-pty
const mockPtyProcess = {
  pid: 1234,
  onData: () => {},
  onExit: () => {},
  write: () => {},
  resize: () => {},
  kill: () => {},
};

const ptyMock = {
  spawn: () => mockPtyProcess,
};

// Override module loading for node-pty
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'vscode') {
    return vscode;
  }
  if (id === 'node-pty') {
    return ptyMock;
  }
  return originalRequire.apply(this, arguments);
};

// Set up test environment - no mocha hooks here since this is a require module
// The cleanup will be handled by individual test files if needed
