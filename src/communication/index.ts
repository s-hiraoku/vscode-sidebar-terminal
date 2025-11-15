/**
 * Communication Layer - Public API
 *
 * Exports all public interfaces, protocols, and DTOs for the Communication Layer.
 * This layer provides clean separation between Extension and WebView layers.
 *
 * @see Issue #223 - Clean Architecture Refactoring
 */

// Protocols
export * from './protocols/MessageProtocol';

// DTOs
export * from './dto/TerminalDTO';
export * from './dto/SettingsDTO';
export * from './dto/SessionDTO';

// Interfaces
export * from './interfaces/ICommunicationBridge';
export * from './interfaces/IPersistencePort';
