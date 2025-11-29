# Spec Delta: Plugin System

## ADDED Requirements

### Requirement: Plugin Interface Contract
The system SHALL define a standard plugin interface for extensibility.

#### Scenario: Plugin identification
- **WHEN** a plugin is registered
- **THEN** it SHALL provide unique id, name, and version properties

#### Scenario: Plugin lifecycle activation
- **WHEN** plugin activation is requested
- **THEN** the plugin's `activate()` method SHALL be called with a plugin context

#### Scenario: Plugin lifecycle deactivation
- **WHEN** plugin deactivation is requested
- **THEN** the plugin's `deactivate()` method SHALL be called for cleanup

#### Scenario: Plugin configuration updates
- **WHEN** plugin configuration changes
- **THEN** the plugin's `configure()` method SHALL be called with the new configuration

### Requirement: AI Agent Plugin Interface
The system SHALL define a specialized interface for AI agent detection plugins.

#### Scenario: Agent detection from terminal output
- **WHEN** terminal output is processed
- **THEN** the plugin's `detectAgent()` method SHALL return detection result or null if no agent detected

#### Scenario: Agent status indicator provision
- **WHEN** agent state is known
- **THEN** the plugin's `getStatusIndicator()` method SHALL return appropriate visual indicator for WebView

#### Scenario: Output acceleration determination
- **WHEN** agent state needs processing decision
- **THEN** the plugin's `shouldAccelerate()` method SHALL return true if buffer flushing should be accelerated

### Requirement: Default Agent Plugins
The system SHALL provide default plugins for supported AI agents.

#### Scenario: Claude Code plugin detection
- **WHEN** terminal output contains "Claude Code" startup message
- **THEN** ClaudePlugin SHALL detect the agent and return detection result

#### Scenario: GitHub Copilot plugin detection
- **WHEN** terminal output contains "Welcome to GitHub Copilot CLI"
- **THEN** CopilotPlugin SHALL detect the agent and return detection result

#### Scenario: Codex CLI plugin detection
- **WHEN** terminal output matches Codex CLI patterns
- **THEN** CodexPlugin SHALL detect the agent and return detection result

#### Scenario: Gemini CLI plugin detection
- **WHEN** terminal output contains GEMINI ASCII art
- **THEN** GeminiPlugin SHALL detect the agent and return detection result

### Requirement: Plugin Configuration System
The system SHALL allow per-plugin configuration via VS Code settings.

#### Scenario: Plugin enable/disable via configuration
- **WHEN** `sidebarTerminal.plugins.agents.claude.enabled` is set to false
- **THEN** ClaudePlugin SHALL be deactivated and not perform detection

#### Scenario: Plugin detection pattern customization
- **WHEN** `sidebarTerminal.plugins.agents.claude.detectionPattern` is updated
- **THEN** ClaudePlugin SHALL use the new pattern for detection

#### Scenario: Plugin detection threshold configuration
- **WHEN** `sidebarTerminal.plugins.agents.copilot.threshold` is set to 0.9
- **THEN** CopilotPlugin SHALL require 90% confidence before reporting detection

### Requirement: Plugin Context Provision
The system SHALL provide plugins with necessary context and capabilities.

#### Scenario: Event bus access
- **WHEN** plugin is activated
- **THEN** plugin context SHALL provide access to event bus for publishing events

#### Scenario: Logger access
- **WHEN** plugin needs to log information
- **THEN** plugin context SHALL provide access to extension logger

#### Scenario: Configuration access
- **WHEN** plugin needs to read configuration
- **THEN** plugin context SHALL provide access to VS Code configuration API

#### Scenario: Terminal access
- **WHEN** plugin needs terminal information
- **THEN** plugin context SHALL provide safe access to terminal metadata (not raw PTY)

### Requirement: Plugin Lifecycle Management
The system SHALL manage plugin lifecycles safely and efficiently.

#### Scenario: Plugin activation order
- **WHEN** multiple plugins are registered
- **THEN** they SHALL be activated in registration order

#### Scenario: Plugin deactivation order
- **WHEN** multiple plugins are deactivated
- **THEN** they SHALL be deactivated in reverse activation order

#### Scenario: Plugin activation error handling
- **WHEN** a plugin's `activate()` method throws an error
- **THEN** the error SHALL be logged and other plugins SHALL still be activated

#### Scenario: Plugin deactivation timeout
- **WHEN** a plugin's `deactivate()` method does not complete within 5 seconds
- **THEN** the system SHALL log a warning and continue with other plugins

### Requirement: Plugin Event Integration
The system SHALL integrate plugins with the event bus for coordination.

#### Scenario: Agent detected event publication
- **WHEN** a plugin detects an AI agent
- **THEN** it SHALL publish AgentDetectedEvent via event bus

#### Scenario: Agent state changed event publication
- **WHEN** an agent's state changes (e.g., connected to disconnected)
- **THEN** the plugin SHALL publish AgentStateChangedEvent

#### Scenario: Agent performance hint event publication
- **WHEN** a plugin determines output should be accelerated
- **THEN** it SHALL publish AgentPerformanceHintEvent for buffer management service

### Requirement: Plugin Testing Support
The system SHALL support easy testing of plugins.

#### Scenario: Plugin mock context creation
- **WHEN** unit tests need to test a plugin
- **THEN** a mock plugin context SHALL be easily creatable with test doubles

#### Scenario: Plugin isolation in tests
- **WHEN** testing a single plugin
- **THEN** the plugin SHALL be testable independently without activating other plugins

#### Scenario: Plugin detection testing
- **WHEN** testing agent detection logic
- **THEN** synthetic terminal output SHALL be easily provided to `detectAgent()` method
