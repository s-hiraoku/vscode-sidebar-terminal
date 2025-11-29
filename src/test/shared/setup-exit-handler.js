/**
 * Mocha process exit handler setup
 * Minimal setup to ensure Mocha can exit cleanly with Node.js v24+
 */

'use strict';

// Save original process methods at the very start before anything can modify them
// Use safe accessors to handle the case where process methods might already be undefined
const _originalExit = typeof process.exit === 'function'
  ? process.exit.bind(process)
  : function(code) { process.exitCode = code; };
const _originalArgv = process.argv ? [...process.argv] : [];
const _originalStdout = process.stdout;
const _originalStderr = process.stderr;
const _originalCwd = typeof process.cwd === 'function' ? process.cwd.bind(process) : () => '/test';

// Create a safe exit function that always works
const safeExit = function(code) {
  try {
    if (typeof _originalExit === 'function') {
      _originalExit(code);
    } else {
      process.exitCode = code;
    }
  } catch {
    process.exitCode = code;
  }
};

// Ensure process.exit is always available as a function
try {
  Object.defineProperty(process, 'exit', {
    value: safeExit,
    writable: true,
    configurable: true,
    enumerable: false,
  });
} catch {
  process.exit = safeExit;
}

// Ensure process.argv is always a valid array with includes method
if (!Array.isArray(process.argv) || typeof process.argv.includes !== 'function') {
  process.argv = _originalArgv;
}

// Ensure process.cwd is always available
if (typeof process.cwd !== 'function') {
  process.cwd = _originalCwd;
}

// Ensure process.stdout and stderr are valid
if (!_originalStdout || typeof _originalStdout.write !== 'function') {
  console.warn('⚠️ process.stdout is not available');
}
if (!_originalStderr || typeof _originalStderr.write !== 'function') {
  console.warn('⚠️ process.stderr is not available');
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

// Handle unhandled promise rejections without crashing
process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled promise rejection:', reason);
});

// Handle uncaught exceptions without crashing
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

module.exports = {};
