/**
 * Mocha process exit handler setup
 * Clean setup for Mocha v11 + Node.js v24 compatibility
 */

'use strict';

// Save original process methods at the very start
const _originalExit = typeof process.exit === 'function'
  ? process.exit.bind(process)
  : function(code) { process.exitCode = code; };
const _originalCwd = typeof process.cwd === 'function'
  ? process.cwd.bind(process)
  : () => '/test';

// Ensure process.exit is always available
if (typeof process.exit !== 'function') {
  process.exit = _originalExit;
}

// Ensure process.cwd is always available
if (typeof process.cwd !== 'function') {
  process.cwd = _originalCwd;
}

// Add listenerCount if missing (needed by Mocha)
if (typeof process.listenerCount !== 'function') {
  process.listenerCount = function(eventName) {
    if (typeof this.listeners === 'function') {
      try {
        const listeners = this.listeners(eventName);
        return Array.isArray(listeners) ? listeners.length : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };
}

// Wrap process.emit to prevent infinite recursion on error events
const _originalEmit = process.emit.bind(process);
const _emitDepth = { unhandledRejection: 0, uncaughtException: 0 };
const _maxEmitDepth = 3;

process.emit = function(eventName, ...args) {
  if (eventName === 'unhandledRejection' || eventName === 'uncaughtException') {
    if (_emitDepth[eventName] >= _maxEmitDepth) {
      console.error(`[setup-exit-handler] Suppressed recursive ${eventName}`);
      return false;
    }
    _emitDepth[eventName]++;
    try {
      return _originalEmit.call(this, eventName, ...args);
    } finally {
      _emitDepth[eventName]--;
    }
  }
  return _originalEmit.call(this, eventName, ...args);
};

// Handle unhandled promise rejections without crashing
process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled promise rejection:', reason);
});

// Handle uncaught exceptions without crashing
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

module.exports = {};
