# Spec Delta: Terminal Management

## ADDED Requirements

### Requirement: DI-Managed Terminal Services
The terminal management system SHALL use dependency injection for all service dependencies.

#### Scenario: TerminalManager service resolution
- **WHEN** TerminalManager is instantiated via DI container
- **THEN** all required services (BufferManagementService, LifecycleService, EventHub) SHALL be automatically resolved and injected

#### Scenario: Service mocking in tests
- **WHEN** unit tests for TerminalManager are executed
- **THEN** mock implementations of dependencies SHALL be easily injectable via DI container

#### Scenario: Service replacement at runtime
- **WHEN** a service implementation needs to be replaced (e.g., for testing or feature flagging)
- **THEN** the DI container SHALL allow re-registration without modifying TerminalManager code

### Requirement: Buffer Management Service
The system SHALL extract buffer management logic into a dedicated service.

#### Scenario: Data buffering for normal output
- **WHEN** terminal data is received during normal operation
- **THEN** the BufferManagementService SHALL buffer data and flush at 16ms intervals (60fps)

#### Scenario: Data buffering for CLI agent output
- **WHEN** terminal data is received during active CLI agent operation
- **THEN** the BufferManagementService SHALL buffer data and flush at 4ms intervals (250fps)

#### Scenario: Adaptive buffering based on output frequency
- **WHEN** terminal output frequency changes
- **THEN** the BufferManagementService SHALL dynamically adjust flush intervals based on configuration and output patterns

#### Scenario: Buffer overflow prevention
- **WHEN** buffer size exceeds maximum threshold
- **THEN** the BufferManagementService SHALL immediately flush buffered data to prevent memory issues

### Requirement: Terminal State Service
The system SHALL manage terminal state through a dedicated service.

#### Scenario: Terminal state tracking
- **WHEN** a terminal's state changes (e.g., active to inactive)
- **THEN** the TerminalStateService SHALL update the state and publish a StateChangedEvent

#### Scenario: State query by terminal ID
- **WHEN** state is queried for a specific terminal ID
- **THEN** the TerminalStateService SHALL return the current state or null if terminal does not exist

#### Scenario: State persistence coordination
- **WHEN** terminal state needs to be persisted
- **THEN** the TerminalStateService SHALL coordinate with PersistenceOrchestrator to save state

### Requirement: Event-Driven Terminal Coordination
The system SHALL use event bus for cross-service terminal coordination.

#### Scenario: Terminal creation event publication
- **WHEN** a terminal is created
- **THEN** TerminalManager SHALL publish a TerminalCreatedEvent via event bus

#### Scenario: Terminal data event subscription
- **WHEN** WebView services need terminal data
- **THEN** they SHALL subscribe to TerminalDataEvent via event bus instead of direct callbacks

#### Scenario: Agent detection event coordination
- **WHEN** an AI agent is detected in a terminal
- **THEN** AgentDetectedEvent SHALL be published and all interested services SHALL be notified

### Requirement: Configuration-Driven Buffer Management
The system SHALL allow buffer management behavior to be customized via configuration.

#### Scenario: Custom buffer flush interval
- **WHEN** `sidebarTerminal.performance.bufferFlushInterval` is set to a custom value
- **THEN** BufferManagementService SHALL use that interval for normal output

#### Scenario: Adaptive buffering enable/disable
- **WHEN** `sidebarTerminal.performance.enableAdaptiveBuffering` is set to false
- **THEN** BufferManagementService SHALL use fixed intervals regardless of output patterns

#### Scenario: Max buffer size configuration
- **WHEN** `sidebarTerminal.performance.maxBufferSize` is set to a custom value
- **THEN** BufferManagementService SHALL enforce that limit before flushing
