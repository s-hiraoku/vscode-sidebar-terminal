/**
 * Clean Architecture - Interface Definitions
 *
 * This module exports all interface definitions for the application.
 * These interfaces define the contracts between layers and enable
 * clean separation of concerns.
 *
 * Layer Structure:
 * 1. Extension Layer - PTY management, VS Code APIs, storage
 * 2. Communication Layer - Message protocols, DTOs
 * 3. WebView Layer - xterm.js, UI rendering, user interaction
 */

// Persistence interfaces
export * from './IPersistenceService';

// State management interfaces
export * from './IStateService';

// Message handling interfaces
export * from './IMessageHandler';

// Re-export existing interfaces for convenience
export * from './IUnifiedConfigurationService';
export * from './CliAgentService';
