/* eslint-disable */
// @ts-nocheck

// VS Code mocks are now set up globally via mocha-setup.ts

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';

// Import shared test setup
import '../test-setup';
import * as vscode from 'vscode';
import {
  getTerminalConfig,
  getShellForPlatform,
  getWorkingDirectory,
  validateDirectory,
  generateTerminalId,
  ActiveTerminalManager,
  generateNonce,
  getFirstItem,
  getFirstValue,
  delay,
  safeStringify,
} from '../../../utils/common';

// Get the global VS Code mock (set up in mocha-setup.ts)
const mockVscode = (global as any).vscode;

// Get the global ConfigManager mock (set up in mocha-setup.ts)
const mockConfigManager = (global as any)._originalConfigManager || {
  getExtensionTerminalConfig: sinon.stub().returns({}),
  getShellForPlatform: sinon.stub().returns('/bin/bash'),
};

// Setup test environment
function setupTestEnvironment() {
  // Reset Sinon stubs on the global VS Code mock
  if (mockVscode.workspace.getConfiguration.reset) {
    mockVscode.workspace.getConfiguration.reset();
  }

  // Mock Node.js modules
  (global as any).require = sinon.stub();
  (global as any).module = { exports: {} };
  (global as any).process = {
    platform: 'linux',
    env: {
      HOME: '/home/user',
      USERPROFILE: 'C:\\Users\\user',
      HOMEDRIVE: 'C:',
      HOMEPATH: '\\Users\\user',
    },
    cwd: sinon.stub().returns('/current/working/directory'),
  };
}

describe('Common Utils', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    setupTestEnvironment();

    // Reset ConfigManager stubs
    mockConfigManager.getExtensionTerminalConfig.reset();
    mockConfigManager.getShellForPlatform.reset();

    // Mock console before JSDOM creation
    (global as Record<string, unknown>).console = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    // Set up process.nextTick before JSDOM creation
    const originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      nextTick: (callback: () => void) => setImmediate(callback),
      env: { ...originalProcess.env, NODE_ENV: 'test' },
    };

    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
    (global as any).window = dom.window;

    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
    }
    if (dom) {
      dom.window.close();
    }
  });

  describe('getTerminalConfig', () => {
    it('should return default terminal configuration', () => {
      const expectedConfig = {
        shell: '/bin/bash',
        shellArgs: ['-l'],
        maxTerminals: 5,
        fontSize: 14,
        fontFamily: 'monospace',
      };
      mockConfigManager.getExtensionTerminalConfig.returns(expectedConfig);

      const config = getTerminalConfig();

      expect(config).to.deep.equal(expectedConfig);
      expect(mockConfigManager.getExtensionTerminalConfig).to.have.been.called;
    });

    it('should handle missing configuration gracefully', () => {
      mockConfigManager.getExtensionTerminalConfig.returns({});

      const config = getTerminalConfig();

      expect(config).to.be.an('object');
    });

    it('should merge custom configuration with defaults', () => {
      const expectedConfig = {
        fontSize: 16,
        customProperty: 'test',
      };
      mockConfigManager.getExtensionTerminalConfig.returns(expectedConfig);

      const config = getTerminalConfig();

      expect(config.fontSize).to.equal(16);
      expect(config.customProperty).to.equal('test');
    });
  });

  describe('getShellForPlatform', () => {
    it('should return bash for Linux', () => {
      mockConfigManager.getShellForPlatform.returns('/bin/bash');

      const shell = getShellForPlatform('');

      expect(shell).to.equal('/bin/bash');
      expect(mockConfigManager.getShellForPlatform).to.have.been.calledWith('');
    });

    it('should return zsh for macOS', () => {
      mockConfigManager.getShellForPlatform.returns('/bin/zsh');

      const shell = getShellForPlatform('');

      expect(shell).to.equal('/bin/zsh');
      expect(mockConfigManager.getShellForPlatform).to.have.been.calledWith('');
    });

    it('should return cmd for Windows', () => {
      mockConfigManager.getShellForPlatform.returns('cmd.exe');

      const shell = getShellForPlatform('');

      expect(shell).to.equal('cmd.exe');
      expect(mockConfigManager.getShellForPlatform).to.have.been.calledWith('');
    });

    it('should return bash for unknown platforms', () => {
      mockConfigManager.getShellForPlatform.returns('/bin/bash');

      const shell = getShellForPlatform('');

      expect(shell).to.equal('/bin/bash');
      expect(mockConfigManager.getShellForPlatform).to.have.been.calledWith('');
    });
  });

  describe('getWorkingDirectory', () => {
    it('should return workspace folder path when available', () => {
      mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: '/workspace/path' } }];
      mockConfigManager.getExtensionTerminalConfig.returns({ defaultDirectory: '' });

      // Mock fs.statSync to make directory validation pass
      const mockFs = {
        statSync: sinon.stub().returns({ isDirectory: () => true }),
        accessSync: sinon.stub(),
        constants: { R_OK: 4, X_OK: 1 },
      };
      (global as any).require = sinon.stub().withArgs('fs').returns(mockFs);

      const workingDir = getWorkingDirectory();

      expect(workingDir).to.equal('/workspace/path');
    });

    it('should return home directory when no workspace folder', () => {
      mockVscode.workspace.workspaceFolders = undefined;
      mockVscode.window.activeTextEditor = undefined;
      mockConfigManager.getExtensionTerminalConfig.returns({ defaultDirectory: '' });
      (global as any).process.env.HOME = '/home/user';

      // Mock os.homedir and fs to make home directory validation pass
      const mockOs = {
        homedir: sinon.stub().returns('/home/user'),
      };
      const mockFs = {
        statSync: sinon.stub().returns({ isDirectory: () => true }),
        accessSync: sinon.stub(),
        constants: { R_OK: 4, X_OK: 1 },
      };
      const mockRequire = sinon.stub();
      mockRequire.withArgs('os').returns(mockOs);
      mockRequire.withArgs('fs').returns(mockFs);
      (global as any).require = mockRequire;

      const workingDir = getWorkingDirectory();

      expect(workingDir).to.equal('/home/user');
    });

    it('should return current directory as fallback', () => {
      mockVscode.workspace.workspaceFolders = undefined;
      mockVscode.window.activeTextEditor = undefined;
      mockConfigManager.getExtensionTerminalConfig.returns({ defaultDirectory: '' });
      (global as any).process.env.HOME = undefined;
      (global as any).process.cwd.returns('/current/dir');

      // Mock os.homedir to fail, fs.statSync to fail for home but pass for cwd
      const mockOs = {
        homedir: sinon.stub().throws(new Error('No home dir')),
      };
      const mockFs = {
        statSync: sinon.stub().throws(new Error('No access')),
        accessSync: sinon.stub(),
        constants: { R_OK: 4, X_OK: 1 },
      };
      const mockRequire = sinon.stub();
      mockRequire.withArgs('os').returns(mockOs);
      mockRequire.withArgs('fs').returns(mockFs);
      (global as any).require = mockRequire;

      const workingDir = getWorkingDirectory();

      expect(workingDir).to.equal('/current/dir');
    });

    it('should handle Windows home directory', () => {
      mockVscode.workspace.workspaceFolders = undefined;
      mockVscode.window.activeTextEditor = undefined;
      mockConfigManager.getExtensionTerminalConfig.returns({ defaultDirectory: '' });
      (global as any).process.platform = 'win32';
      (global as any).process.env.USERPROFILE = 'C:\\Users\\user';

      // Mock os.homedir and fs to make Windows home directory validation pass
      const mockOs = {
        homedir: sinon.stub().returns('C:\\Users\\user'),
      };
      const mockFs = {
        statSync: sinon.stub().returns({ isDirectory: () => true }),
        accessSync: sinon.stub(),
        constants: { R_OK: 4, X_OK: 1 },
      };
      const mockRequire = sinon.stub();
      mockRequire.withArgs('os').returns(mockOs);
      mockRequire.withArgs('fs').returns(mockFs);
      (global as any).require = mockRequire;

      const workingDir = getWorkingDirectory();

      expect(workingDir).to.equal('C:\\Users\\user');
    });
  });

  describe('validateDirectory', () => {
    let mockFs: any;

    beforeEach(() => {
      mockFs = {
        statSync: sinon.stub(),
        accessSync: sinon.stub(),
        constants: { R_OK: 4, X_OK: 1 },
      };
      (global as any).require = sinon.stub().withArgs('fs').returns(mockFs);
    });

    it('should return true for valid directory path', () => {
      mockFs.statSync.returns({ isDirectory: () => true });
      mockFs.accessSync.returns(undefined);

      const isValid = validateDirectory('/valid/path');

      expect(isValid).to.be.true;
    });

    it('should return false for invalid directory path', () => {
      mockFs.statSync.throws(new Error('ENOENT'));

      const isValid = validateDirectory('/invalid/path');

      expect(isValid).to.be.false;
    });

    it('should return false for file (not directory)', () => {
      mockFs.statSync.returns({ isDirectory: () => false });
      mockFs.accessSync.returns(undefined);

      const isValid = validateDirectory('/path/to/file.txt');

      expect(isValid).to.be.false;
    });

    it('should return false for inaccessible directory', () => {
      mockFs.statSync.returns({ isDirectory: () => true });
      mockFs.accessSync.throws(new Error('EACCES'));

      const isValid = validateDirectory('/inaccessible/path');

      expect(isValid).to.be.false;
    });
  });

  describe('generateTerminalId', () => {
    it('should generate unique terminal ID', () => {
      const id1 = generateTerminalId();
      const id2 = generateTerminalId();

      expect(id1).to.be.a('string');
      expect(id2).to.be.a('string');
      expect(id1).to.not.equal(id2);
    });

    it('should generate ID with expected format', () => {
      const id = generateTerminalId();

      // Format is: terminal-{timestamp}-{random base36 string}
      expect(id).to.match(/^terminal-\d+-[a-z0-9]+$/);
    });

    it('should generate IDs with incrementing timestamps', () => {
      const id1 = generateTerminalId();
      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Wait 2ms to ensure timestamp difference
      }
      const id2 = generateTerminalId();

      const timestamp1 = parseInt(id1.split('-')[1]);
      const timestamp2 = parseInt(id2.split('-')[1]);

      expect(timestamp2).to.be.greaterThan(timestamp1);
    });
  });

  describe('ActiveTerminalManager', () => {
    let manager: ActiveTerminalManager;

    beforeEach(() => {
      manager = new ActiveTerminalManager();
    });

    it('should initialize with no active terminal', () => {
      expect(manager.getActive()).to.be.undefined;
    });

    it('should set and get active terminal ID', () => {
      const terminalId = 'terminal-1';

      manager.setActive(terminalId);

      expect(manager.getActive()).to.equal(terminalId);
    });

    it('should clear active terminal ID', () => {
      manager.setActive('terminal-1');
      manager.clearActive();

      expect(manager.getActive()).to.be.undefined;
    });

    it('should check if terminal is active', () => {
      const terminalId = 'terminal-1';

      manager.setActive(terminalId);

      expect(manager.isActive(terminalId)).to.be.true;
      expect(manager.isActive('terminal-2')).to.be.false;
    });

    it('should check if has active terminal', () => {
      expect(manager.hasActive()).to.be.false;

      manager.setActive('terminal-1');
      expect(manager.hasActive()).to.be.true;

      manager.clearActive();
      expect(manager.hasActive()).to.be.false;
    });
  });

  describe('generateNonce', () => {
    it('should generate a nonce string', () => {
      const nonce = generateNonce();

      expect(nonce).to.be.a('string');
      expect(nonce.length).to.be.greaterThan(0);
    });

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).to.not.equal(nonce2);
    });

    it('should generate alphanumeric nonce', () => {
      const nonce = generateNonce();

      expect(nonce).to.match(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('getFirstItem', () => {
    it('should return first item from array', () => {
      const array = ['first', 'second', 'third'];

      const result = getFirstItem(array);

      expect(result).to.equal('first');
    });

    it('should return undefined for empty array', () => {
      const result = getFirstItem([]);

      expect(result).to.be.undefined;
    });

    it('should return undefined for null/undefined', () => {
      expect(getFirstItem(null)).to.be.undefined;
      expect(getFirstItem(undefined)).to.be.undefined;
    });
  });

  describe('getFirstValue', () => {
    it('should return first value from Map', () => {
      const map = new Map();
      map.set('key1', 'first');
      map.set('key2', 'second');

      const result = getFirstValue(map);

      expect(result).to.equal('first');
    });

    it('should return undefined for empty Map', () => {
      const map = new Map();

      const result = getFirstValue(map);

      expect(result).to.be.undefined;
    });

    it('should handle Map with single value', () => {
      const map = new Map();
      map.set('key1', 'onlyvalue');

      const result = getFirstValue(map);

      expect(result).to.equal('onlyvalue');
    });
  });

  describe('delay', () => {
    it('should delay execution for specified milliseconds', async () => {
      const start = Date.now();

      await delay(100);

      const end = Date.now();
      expect(end - start).to.be.at.least(95); // Allow for some timing variance
    });

    it('should handle zero delay', async () => {
      const start = Date.now();

      await delay(0);

      const end = Date.now();
      expect(end - start).to.be.at.most(50); // Should be very quick
    });
  });

  describe('safeStringify', () => {
    it('should stringify simple object', () => {
      const obj = { name: 'test', value: 123 };

      const result = safeStringify(obj);

      expect(result).to.equal('{"name":"test","value":123}');
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      const result = safeStringify(obj);

      expect(result).to.be.a('string');
      expect(result).to.equal('[object Object]');
    });

    it('should handle null and undefined', () => {
      expect(safeStringify(null)).to.equal('null');
      expect(safeStringify(undefined)).to.equal('undefined');
    });

    it('should handle primitive values', () => {
      expect(safeStringify('string')).to.equal('"string"');
      expect(safeStringify(123)).to.equal('123');
      expect(safeStringify(true)).to.equal('true');
    });

    it('should handle complex nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
        array: [1, 2, 3],
      };

      const result = safeStringify(obj);

      expect(result).to.include('deep value');
      expect(result).to.include('[1,2,3]');
    });
  });
});
