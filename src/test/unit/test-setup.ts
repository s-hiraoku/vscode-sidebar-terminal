/**
 * Unit test setup - Imports from shared test utilities
 * This file serves as a compatibility layer for legacy test setup
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-rest-params */

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

// Comprehensive EventEmitter methods for process object to fix Mocha issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalProcess = global.process as any;
if (originalProcess) {
  // Ensure all EventEmitter methods exist
  const eventMethods = [
    'on',
    'off',
    'removeListener',
    'removeAllListeners',
    'emit',
    'addListener',
    'once',
    'prependListener',
    'prependOnceListener',
  ];

  eventMethods.forEach((method) => {
    if (!originalProcess[method] || typeof originalProcess[method] !== 'function') {
      originalProcess[method] = function () {
        return originalProcess;
      };
    }
  });

  // Special handling for removeListener to prevent Mocha errors
  const originalRemoveListener = originalProcess.removeListener;
  // eslint-disable-next-line @typescript-eslint/ban-types
  originalProcess.removeListener = function (event: string, listener: Function) {
    try {
      if (originalRemoveListener && typeof originalRemoveListener === 'function') {
        return originalRemoveListener.call(this, event, listener);
      }
      return originalProcess;
    } catch (e) {
      // Silently ignore removeListener errors in test environment
      return originalProcess;
    }
  };
}
