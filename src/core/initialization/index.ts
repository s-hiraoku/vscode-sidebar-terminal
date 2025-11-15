/**
 * Core Initialization Module
 *
 * Exports Template Method pattern base classes for WebView initialization.
 * These classes consolidate ~200-250 lines of duplicated initialization logic.
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */

// Base classes
export { WebViewInitializationTemplate } from './WebViewInitializationTemplate';
export { MessageHandlerRegistryBase } from './MessageHandlerRegistryBase';
export { ManagerCoordinatorBase } from './ManagerCoordinatorBase';

// Types
export type {
  InitializationMetrics,
  InitializationContext,
} from './WebViewInitializationTemplate';

export type {
  MessageHandler,
  HandlerRegistrationOptions,
  HandlerMetrics,
} from './MessageHandlerRegistryBase';

export type { IManager, ManagerMetrics } from './ManagerCoordinatorBase';
