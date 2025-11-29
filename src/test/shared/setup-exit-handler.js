/**
 * Mocha process exit handler setup
 * This fixes the exit code 7 issue by properly handling process cleanup
 */

// Require EventEmitter once at the top for all process method polyfills
const EventEmitter = require('events');

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
if (!process.stdout) {
  process.stdout = {
    write: (data, encoding, callback) => {
      if (typeof encoding === 'function') callback = encoding;
      if (callback) setImmediate(callback);
      return true;
    },
    fd: 1,
  };
}
if (!process.stderr) {
  process.stderr = {
    write: (data, encoding, callback) => {
      if (typeof encoding === 'function') callback = encoding;
      if (callback) setImmediate(callback);
      return true;
    },
    fd: 2,
  };
}

module.exports = {};
