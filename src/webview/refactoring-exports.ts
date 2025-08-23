/**
 * Refactoring Exports
 *
 * Central export file for all refactored components to improve maintainability
 * and provide clear access to enhanced functionality.
 */

// Enhanced interfaces
export * from './interfaces/SegregatedManagerInterfaces';

// Enhanced base classes
export { EnhancedBaseManager } from './managers/EnhancedBaseManager';
export { RefactoredNotificationManager } from './managers/RefactoredNotificationManager';

// Dependency injection
export { DependencyContainer, ServiceType, ServiceLifecycle } from './core/DependencyContainer';

// Type utilities
export * from './utils/RefactoringTypes';

// Re-export original interfaces for backward compatibility
export * from './interfaces/ManagerInterfaces';
