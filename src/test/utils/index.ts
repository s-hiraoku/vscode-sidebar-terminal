/**
 * Test utilities module
 *
 * Exports all test base classes and helper utilities
 */

// Base test classes
export { BaseTest } from './BaseTest';
export { ConfigurationTest } from './ConfigurationTest';
export { AsyncTest } from './AsyncTest';
export { WebViewTest } from './WebViewTest';
export { TerminalTest } from './TerminalTest';

// Helper utilities
export * from './test-helpers';

// Re-export commonly used test dependencies
// Note: For vitest tests, import { expect } from 'vitest' directly
export { expect } from 'chai'; // Legacy: used by Mocha-based tests only
