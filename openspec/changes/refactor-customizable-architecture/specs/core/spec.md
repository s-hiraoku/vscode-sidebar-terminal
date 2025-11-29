# Spec Delta: Core Architecture

## ADDED Requirements

### Requirement: Dependency Injection Container
The system SHALL provide a lightweight dependency injection container for managing service lifecycles and dependencies.

#### Scenario: Service registration with singleton lifetime
- **WHEN** a service is registered with singleton lifetime
- **THEN** the container SHALL return the same instance for all resolution requests

#### Scenario: Service registration with transient lifetime
- **WHEN** a service is registered with transient lifetime
- **THEN** the container SHALL create a new instance for each resolution request

#### Scenario: Service registration with scoped lifetime
- **WHEN** a service is registered with scoped lifetime
- **THEN** the container SHALL return the same instance within a scope and different instances across scopes

#### Scenario: Circular dependency detection
- **WHEN** resolving a service results in a circular dependency
- **THEN** the container SHALL throw a clear error describing the dependency cycle

#### Scenario: Service disposal
- **WHEN** the container is disposed
- **THEN** all singleton services implementing Disposable SHALL be disposed in reverse registration order

### Requirement: Event Bus
The system SHALL provide a typed event bus for decoupled component communication.

#### Scenario: Event subscription
- **WHEN** a component subscribes to an event type
- **THEN** the handler SHALL be invoked when that event is published

#### Scenario: Event unsubscription
- **WHEN** a subscription is disposed
- **THEN** the handler SHALL no longer be invoked for subsequent events

#### Scenario: Event publishing with multiple subscribers
- **WHEN** an event is published with multiple subscribers
- **THEN** all subscribers SHALL receive the event in registration order

#### Scenario: Error handling in event handlers
- **WHEN** an event handler throws an error
- **THEN** the error SHALL be logged and other handlers SHALL still be invoked

#### Scenario: Event replay for debugging
- **WHEN** event replay is requested with a timestamp
- **THEN** all events since that timestamp SHALL be returned in chronological order

### Requirement: Plugin Manager
The system SHALL provide a plugin manager for registering and managing plugins.

#### Scenario: Plugin registration
- **WHEN** a plugin is registered with a unique ID
- **THEN** the plugin SHALL be stored and retrievable by ID

#### Scenario: Duplicate plugin registration prevention
- **WHEN** a plugin is registered with an existing ID
- **THEN** the manager SHALL throw an error indicating the duplicate ID

#### Scenario: Plugin activation
- **WHEN** plugin activation is requested
- **THEN** all registered plugins SHALL have their `activate()` method called in registration order

#### Scenario: Plugin deactivation
- **WHEN** plugin deactivation is requested
- **THEN** all activated plugins SHALL have their `deactivate()` method called in reverse activation order

#### Scenario: Plugin retrieval by type
- **WHEN** plugins are queried by interface type (e.g., IAgentPlugin)
- **THEN** all plugins implementing that interface SHALL be returned

#### Scenario: Plugin configuration update
- **WHEN** a plugin's configuration is updated
- **THEN** the plugin's `configure()` method SHALL be called with the new configuration

### Requirement: Configuration Management
The system SHALL provide configuration schema validation and hot-reload support.

#### Scenario: Configuration schema validation
- **WHEN** configuration is loaded from VS Code settings
- **THEN** the system SHALL validate against JSON schema and reject invalid configurations

#### Scenario: Configuration hot-reload for non-critical settings
- **WHEN** a non-critical setting changes (e.g., buffer flush interval)
- **THEN** the system SHALL apply the change without requiring extension restart

#### Scenario: Configuration hot-reload for critical settings
- **WHEN** a critical setting changes (e.g., DI container structure)
- **THEN** the system SHALL notify the user that a restart is required

#### Scenario: Configuration migration
- **WHEN** a user upgrades from a previous version with old configuration keys
- **THEN** the system SHALL automatically migrate to new configuration keys and preserve user preferences

### Requirement: Layered Architecture Enforcement
The system SHALL organize code into four distinct layers with clear boundaries.

#### Scenario: Core layer dependency restrictions
- **WHEN** core layer code is analyzed
- **THEN** it SHALL NOT import from domain, application, or infrastructure layers

#### Scenario: Domain layer dependency restrictions
- **WHEN** domain layer code is analyzed
- **THEN** it SHALL only import from core layer and NOT from application or infrastructure layers

#### Scenario: Application layer dependency restrictions
- **WHEN** application layer code is analyzed
- **THEN** it SHALL import from core and domain layers but NOT from infrastructure layer implementations

#### Scenario: Infrastructure layer implementation freedom
- **WHEN** infrastructure layer code is analyzed
- **THEN** it MAY import from all other layers as needed for integration
