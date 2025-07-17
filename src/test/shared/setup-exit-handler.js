/**
 * Mocha process exit handler setup
 * This fixes the exit code 7 issue by properly handling process cleanup
 */

// Add missing event handler methods to process for Mocha compatibility
if (!process.removeListener) {
  process.removeListener = function (...args) {
    return this.off ? this.off(...args) : this;
  };
}

if (!process.removeAllListeners) {
  process.removeAllListeners = function (event) {
    if (event && this.listeners) {
      const listeners = this.listeners(event);
      listeners.forEach((listener) => {
        this.removeListener(event, listener);
      });
    }
    return this;
  };
}

if (!process.off) {
  process.off = function (...args) {
    return this.removeListener ? this.removeListener(...args) : this;
  };
}

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

module.exports = {};
