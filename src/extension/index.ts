/**
 * Extension Layer - Public API
 *
 * Exports all public interfaces and services for the Extension layer.
 *
 * @see Issue #223 - Clean Architecture Refactoring
 */

// Persistence
export * from './persistence/ExtensionPersistenceService';

// Bridge
export * from './bridge/ExtensionMessageBridge';
