/**
 * Message Handling Patterns - Public API
 *
 * Unified message handling system implementing Command and Chain of Responsibility patterns.
 * This consolidates and replaces:
 * - ConsolidatedMessageManager
 * - SecondaryTerminalMessageRouter
 * - MessageRouter
 * - UnifiedMessageDispatcher
 * - ConsolidatedMessageService
 *
 * Related to: GitHub Issue #219
 */

// Core interfaces and base classes
export {
  IMessageHandler,
  IMessageHandlerContext,
  IMessageHandlerResult,
  BaseCommandHandler,
} from './core/IMessageHandler';

// Message validation
export {
  MessageValidator,
  MessageValidationError,
  IValidationResult,
  IMessageValidationRule,
  DEFAULT_VALIDATION_RULES,
  createMessageValidator,
} from './core/MessageValidator';

// Message logging
export {
  MessageLogger,
  ChildMessageLogger,
  LogLevel,
  ILogEntry,
  ILoggerConfig,
  createMessageLogger,
  messageLogger,
} from './core/MessageLogger';

// Message handler registry
export {
  MessageHandlerRegistry,
  IRegistryStats,
  IDispatchOptions,
} from './core/MessageHandlerRegistry';

// Message processor facade
export {
  MessageProcessor,
  IMessageProcessorConfig,
  IProcessorStats,
  createMessageProcessor,
} from './core/MessageProcessor';

// Specialized handlers
export { TerminalCommandHandler } from './handlers/TerminalCommandHandler';
export { SessionCommandHandler } from './handlers/SessionCommandHandler';
export { SettingsCommandHandler } from './handlers/SettingsCommandHandler';
