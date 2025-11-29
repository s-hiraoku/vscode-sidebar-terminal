/**
 * Mocha process exit handler setup
 * This fixes the exit code 7 issue by properly handling process cleanup
 */

// Require EventEmitter once at the top for all process method polyfills
const EventEmitter = require('events');

// CRITICAL: Preserve process.argv for Mocha v11 + Node.js v24 compatibility
// Mocha v11's run-helpers.js uses process.argv.includes() at exit
// Node.js v24 may have process.argv become undefined in certain conditions
const originalArgv = process.argv ? [...process.argv] : [];

// Create a safe argv proxy that always returns a valid array
const safeArgv = new Proxy(originalArgv, {
  get(target, prop) {
    if (prop === 'includes') {
      return (...args) => target.includes(...args);
    }
    return target[prop];
  },
});

// Ensure process.argv is always a valid array
if (!Array.isArray(process.argv)) {
  process.argv = originalArgv;
}

// Patch Mocha's run-helpers.js exitMocha function to handle undefined process.argv
// This must run before any tests to catch the case where process.argv becomes undefined
try {
  const runHelpers = require('mocha/lib/cli/run-helpers.js');

  // Directly patch the exitMocha function if it exists
  if (runHelpers && typeof runHelpers.exitMocha === 'function' && !runHelpers._exitMochaPatched) {
    const originalExitMocha = runHelpers.exitMocha;

    runHelpers.exitMocha = function(code) {
      // Ensure process.argv exists before calling original
      if (!process.argv || !Array.isArray(process.argv)) {
        process.argv = originalArgv;
      }
      return originalExitMocha.call(this, code);
    };

    runHelpers._exitMochaPatched = true;
    console.log('✅ Patched Mocha exitMocha to handle undefined process.argv');
  }
} catch (e) {
  // Ignore if patching fails
  console.warn('⚠️ Failed to patch Mocha exitMocha:', e.message);
}

// Ensure process.argv has includes method and is always valid
Object.defineProperty(process, 'argv', {
  get: function() {
    return originalArgv;
  },
  set: function(value) {
    // Allow setting but maintain our reference
    if (Array.isArray(value)) {
      originalArgv.length = 0;
      originalArgv.push(...value);
    }
  },
  configurable: true,
  enumerable: true,
});

// Add missing event handler methods to process for Mocha compatibility
// Use Object.defineProperty to make these more resistant to being overwritten

const ensureProcessMethod = (name, impl) => {
  if (!process[name] || typeof process[name] !== 'function') {
    try {
      Object.defineProperty(process, name, {
        value: impl,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {
      // Fallback to direct assignment
      process[name] = impl;
    }
  }
};

// Ensure process.cwd exists and works (critical for many tests)
// Save reference to original cwd before any modifications
const originalCwd =
  process.cwd && typeof process.cwd === 'function' ? process.cwd.bind(process) : null;

// Always wrap process.cwd to ensure it never throws
const safeCwd = function () {
  // Try original cwd first
  if (originalCwd) {
    try {
      return originalCwd();
    } catch (e) {
      // Original cwd failed, fall through to default
    }
  }
  return '/test';
};

// Force replace process.cwd with safe version
try {
  Object.defineProperty(process, 'cwd', {
    value: safeCwd,
    writable: true,
    configurable: true,
    enumerable: false,
  });
} catch (e) {
  // Fallback to direct assignment
  process.cwd = safeCwd;
}

// Save original EventEmitter methods for removeListener
const originalRemoveListener =
  process.removeListener && typeof process.removeListener === 'function'
    ? process.removeListener.bind(process)
    : EventEmitter.prototype.removeListener.bind(process);

ensureProcessMethod('removeListener', function (...args) {
  try {
    return originalRemoveListener.call(this, ...args);
  } catch (e) {
    console.warn('process.removeListener failed:', e.message);
    return this;
  }
});

ensureProcessMethod('removeAllListeners', function (event) {
  if (event && this.listeners) {
    const listeners = this.listeners(event);
    listeners.forEach((listener) => {
      try {
        originalRemoveListener.call(this, event, listener);
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
  }
  return this;
});

ensureProcessMethod('off', function (...args) {
  try {
    return originalRemoveListener.call(this, ...args);
  } catch (e) {
    console.warn('process.off failed:', e.message);
    return this;
  }
});

ensureProcessMethod('listenerCount', function (eventName) {
  // If the native implementation exists in EventEmitter.prototype, use it
  if (this.listeners && typeof this.listeners === 'function') {
    try {
      const listeners = this.listeners(eventName);
      return Array.isArray(listeners) ? listeners.length : 0;
    } catch (e) {
      return 0;
    }
  }
  return 0;
});

// Ensure process.emit exists (required by signal-exit in nyc)
// Save reference to original emit before any modifications
const originalEmit =
  process.emit && typeof process.emit === 'function'
    ? process.emit.bind(process)
    : EventEmitter.prototype.emit.bind(process);

// Track recursive emit calls to prevent infinite loops
let emitDepth = 0;
const MAX_EMIT_DEPTH = 10;

// Force override process.emit to prevent infinite loops
const safeEmit = function (eventName, ...args) {
  // Prevent infinite recursion on unhandledRejection/uncaughtException
  if (eventName === 'unhandledRejection' || eventName === 'uncaughtException') {
    emitDepth++;
    if (emitDepth > MAX_EMIT_DEPTH) {
      emitDepth = 0;
      console.error(`⚠️  Prevented infinite ${eventName} loop`);
      return false;
    }
  }

  try {
    return originalEmit.call(this, eventName, ...args);
  } catch (e) {
    // If emit fails, log but don't crash
    console.warn(`process.emit failed for event ${eventName}:`, e.message);
    return false;
  } finally {
    if (eventName === 'unhandledRejection' || eventName === 'uncaughtException') {
      emitDepth--;
    }
  }
};

// Force replace process.emit with safe version (always override)
try {
  Object.defineProperty(process, 'emit', {
    value: safeEmit,
    writable: true,
    configurable: true,
    enumerable: false,
  });
} catch (e) {
  process.emit = safeEmit;
}

// Directly patch Mocha's Runner class to handle missing listenerCount
// Wait for next tick to ensure Mocha is loaded
setImmediate(() => {
  try {
    // Try to get the Runner class directly
    const Runner = require('mocha/lib/runner.js');

    if (Runner && Runner.prototype._addEventListener) {
      const original_addEventListener = Runner.prototype._addEventListener;

      Runner.prototype._addEventListener = function (target, eventName, listener) {
        // Ensure listenerCount exists on the target before calling original method
        if (target && (!target.listenerCount || typeof target.listenerCount !== 'function')) {
          // Use simple assignment instead of defineProperty to avoid breaking process
          target.listenerCount = function (evtName) {
            if (this.listeners && typeof this.listeners === 'function') {
              try {
                const listeners = this.listeners(evtName);
                return Array.isArray(listeners) ? listeners.length : 0;
              } catch (e) {
                return 0;
              }
            }
            return 0;
          };
        }

        return original_addEventListener.call(this, target, eventName, listener);
      };

      console.log('✅ Patched Mocha Runner._addEventListener to handle missing listenerCount');
    }

    // Patch Runner.unhandled to prevent infinite loop on uncaught exceptions
    if (Runner && Runner.prototype.unhandled) {
      const originalUnhandled = Runner.prototype.unhandled;
      let isHandlingUnhandled = false;

      Runner.prototype.unhandled = function (err) {
        // Prevent infinite recursion
        if (isHandlingUnhandled) {
          console.error('⚠️  Suppressed recursive unhandled error:', err?.message || err);
          return;
        }

        isHandlingUnhandled = true;
        try {
          return originalUnhandled.call(this, err);
        } finally {
          // Use setImmediate to reset flag after event loop tick
          setImmediate(() => {
            isHandlingUnhandled = false;
          });
        }
      };

      console.log('✅ Patched Mocha Runner.unhandled to prevent infinite loop');
    }
  } catch (e) {
    console.warn('⚠️  Failed to patch Mocha Runner:', e.message);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled promise rejection:', reason);
  // Don't exit on unhandled rejection in tests
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Log but don't exit in test environment
});

// Ensure process.stdout and process.stderr exist for Mocha exit handling
// Save original references
const originalStdout = process.stdout;
const originalStderr = process.stderr;

const createFallbackStream = (fd) => ({
  write: (data, encoding, callback) => {
    if (typeof encoding === 'function') callback = encoding;
    if (callback) setImmediate(callback);
    return true;
  },
  fd,
  on: () => {},
  once: () => {},
  emit: () => {},
  end: () => {},
});

// Define stdout and stderr as getters that always return a valid object
Object.defineProperty(process, 'stdout', {
  get: function() {
    return originalStdout || createFallbackStream(1);
  },
  set: function(value) {
    // Allow setting but maintain reference
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(process, 'stderr', {
  get: function() {
    return originalStderr || createFallbackStream(2);
  },
  set: function(value) {
    // Allow setting but maintain reference
  },
  configurable: true,
  enumerable: true,
});

module.exports = {};
