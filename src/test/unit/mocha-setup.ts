/**
 * Mocha setup file that runs before all tests
 * This ensures VS Code mocks are available before any module imports
 */

// Override module resolution before any imports
const Module = require('module');
const originalRequire = Module.prototype.require;
const path = require('path');

// Import sinon for mocking
import * as sinon from 'sinon';
import * as chai from 'chai';

// Import and setup sinon-chai plugin
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

// Create VS Code mock before any modules are loaded
const mockVscode = {
  workspace: {
    getConfiguration: sinon.stub().returns({
      get: sinon.stub().returns(undefined),
    }),
    workspaceFolders: undefined,
    getWorkspaceFolder: sinon.stub().returns(undefined),
  },
  window: {
    showErrorMessage: sinon.stub().resolves(),
    showWarningMessage: sinon.stub().resolves(),
    showInformationMessage: sinon.stub().resolves(),
  },
  Uri: {
    file: sinon.stub().returns({ fsPath: '' }),
    parse: sinon.stub().returns({ fsPath: '' }),
  },
  env: {
    isWindows: false,
    isMacOS: false,
    isLinux: true,
  },
  ExtensionContext: sinon.stub(),
  ViewColumn: { One: 1 },
  TreeDataProvider: sinon.stub(),
  EventEmitter: sinon.stub(),
  CancellationToken: sinon.stub(),
  commands: {
    registerCommand: sinon.stub().returns({ dispose: sinon.stub() }),
    executeCommand: sinon.stub().resolves(),
  },
  languages: {
    registerDocumentFormattingEditProvider: sinon.stub().returns({ dispose: sinon.stub() }),
  },
  WebviewViewProvider: sinon.stub(),
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
};

// Create node-pty mock
const mockPty = {
  spawn: () => ({
    pid: 1234,
    onData: () => ({ dispose: () => {} }),
    onExit: () => ({ dispose: () => {} }),
    write: () => {},
    resize: () => {},
    kill: () => {},
  }),
};

// Create mock ConfigManager
const mockConfigManager = {
  getExtensionTerminalConfig: sinon.stub().returns({
    shell: '/bin/bash',
    shellArgs: ['-l'],
    maxTerminals: 5,
    fontSize: 14,
    fontFamily: 'monospace',
    defaultDirectory: '',
  }),
  getShellForPlatform: sinon.stub().returns('/bin/bash'),
  getInstance: sinon.stub(),
  getConfig: sinon.stub().returns({ get: sinon.stub() }),
};

// Store original config manager for cleanup
(global as any)._originalConfigManager = mockConfigManager;

// Override module resolution globally
Module.prototype.require = function (id: string) {
  if (id === 'vscode') {
    return mockVscode;
  }
  if (id === 'node-pty') {
    return mockPty;
  }

  // Intercept ConfigManager imports
  const isConfigManagerImport =
    id.includes('ConfigManager') ||
    id.includes('../config/ConfigManager') ||
    id.includes('../../config/ConfigManager') ||
    id.includes('../../../config/ConfigManager');

  if (isConfigManagerImport) {
    return {
      getConfigManager: () => mockConfigManager,
      ConfigManager: class MockConfigManager {
        static getInstance() {
          return mockConfigManager;
        }
      },
    };
  }

  return originalRequire.apply(this, arguments);
};

// Set up global mocks
(global as any).vscode = mockVscode;

// Store original process reference (don't modify globally here)
// Individual tests will handle process.nextTick setup for JSDOM

console.log('✓ Mocha setup complete - VS Code and node-pty mocks initialized');
