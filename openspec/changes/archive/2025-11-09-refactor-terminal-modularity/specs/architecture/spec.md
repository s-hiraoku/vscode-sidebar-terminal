## ADDED Requirements
### Requirement: Layered Terminal Coordination
Secondary Terminal MUST organize the provider, webview coordinator, and terminal core into separate modules communicating via typed interfaces so that responsibilities do not bleed across layers.

#### Scenario: Provider Only Wires Dependencies
- **GIVEN** the extension resolves the `SecondaryTerminalProvider`
- **WHEN** the provider initializes the webview
- **THEN** dependency wiring MUST be delegated to helper classes (bootstrapper, message bridge, panel controller, persistence orchestrator)
- **AND** the provider MUST NOT implement command routing or persistence logic itself.

#### Scenario: Coordinator Handles Webview Messages
- **GIVEN** the webview posts any terminal command message
- **WHEN** the `WebviewCoordinator` receives it
- **THEN** the command MUST be dispatched through a typed handler registry
- **AND** no direct switch statements inside `LightweightTerminalWebviewManager` SHOULD remain for these commands.

### Requirement: Terminal Core Command Pipeline
Terminal lifecycle operations MUST flow through a dedicated command queue so concurrent create/delete/focus operations remain serialized and observable.

#### Scenario: Concurrent Terminal Creation
- **GIVEN** two terminals are requested at the same time
- **WHEN** the command pipeline processes the create commands
- **THEN** terminal IDs MUST be allocated deterministically via the registry
- **AND** lifecycle events MUST fire in request order without race conditions.

#### Scenario: Buffered Delete Handling
- **GIVEN** a terminal delete command is issued while another delete is pending
- **WHEN** the command pipeline flushes deletes
- **THEN** the second delete MUST wait until the first completes
- **AND** the registry MUST mark terminals as "being killed" to avoid duplicate disposal callbacks.
