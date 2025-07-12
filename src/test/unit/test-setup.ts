/**
 * Unit test setup - Imports from shared test utilities
 * This file serves as a compatibility layer for legacy test setup
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-var-requires */

// Import shared test setup functionality
import { setupTestEnvironment, mockVscode } from '../shared/TestSetup';

// Set up test environment using shared utilities
setupTestEnvironment();

// Re-export VS Code mock for compatibility
const vscode = mockVscode;

// Export for legacy compatibility
module.exports = { vscode };

// Override module loading for vscode (stronger hook)
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'vscode') {
    return vscode;
  }
  if (id === 'node-pty') {
    return _ptyMock;
  }
  return originalRequire.apply(this, arguments);
};

// Mock node-pty using shared patterns
const mockPtyProcess = {
  pid: 1234,
  onData: () => {},
  onExit: () => {},
  write: () => {},
  resize: () => {},
  kill: () => {},
};

const _ptyMock = {
  spawn: () => mockPtyProcess,
};
