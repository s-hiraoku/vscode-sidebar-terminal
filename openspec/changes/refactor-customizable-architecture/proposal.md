# Refactor: Customizable Architecture

## Why

Current codebase has grown organically with multiple refactorings, but still suffers from:

1. **Manual Dependency Management**: `ExtensionLifecycle.ts` manually instantiates 10+ services with hard-coded dependencies, making testing difficult and extension points unclear
2. **Monolithic Responsibilities**: Despite recent modularization, core classes still mix concerns (e.g., `TerminalManager` handles data buffering, CLI agent coordination, profile management, and event distribution)
3. **Limited Extensibility**: Adding a new AI agent or terminal feature requires modifying multiple files across different layers without clear extension points
4. **Testing Challenges**: Singleton patterns and tight coupling make unit testing require extensive mocking; integration tests are expensive to run
5. **Configuration Rigidity**: Many behaviors are hard-coded in TypeScript and cannot be customized without code changes

These issues slow down feature development, increase regression risk, and make the codebase harder to understand for new contributors.

## What Changes

Introduce a **Dependency Injection Container** and **Plugin Architecture** to enable customizable, testable, and extensible terminal management:

### 1. Lightweight DI Container (`src/core/DIContainer.ts`)
- Simple service registry with lifecycle management (singleton, transient, scoped)
- Factory registration for dynamic service creation
- Dependency resolution with circular dependency detection
- **NOT** using external DI frameworks - keep it simple and focused

### 2. Layered Architecture Clarification
- **Core Layer**: DI container, plugin manager, event bus, configuration
- **Domain Layer**: Terminal entities, AI agent interfaces, session models
- **Application Layer**: Use cases (create terminal, detect agent, restore session)
- **Infrastructure Layer**: VS Code API adapters, node-pty wrappers, storage

### 3. Plugin System for AI Agents
- `IAgentPlugin` interface for pluggable agent detection
- Plugin registration via configuration or code
- Plugin lifecycle hooks (activate, deactivate, configure)
- Dynamic plugin loading from settings

### 4. Configuration-Driven Behavior
- More settings in `package.json` for customization:
  - Agent detection patterns and thresholds
  - Buffer flush intervals and strategies
  - Terminal lifecycle behaviors
  - Performance optimization profiles
- Settings schema validation
- Hot-reloading of non-critical settings

### 5. Event-Driven Coordination
- Centralized event bus (`EventBus`) for cross-component communication
- Typed event definitions with strong contracts
- Subscription management with automatic cleanup
- Event replay for testing and debugging

## Impact

### Affected Specs
- **NEW**: `core` - DI container, plugin system, event bus
- **NEW**: `terminal-management` - Refactored TerminalManager architecture
- **NEW**: `plugin-system` - AI agent plugin interfaces and lifecycle

### Affected Code
- `src/core/ExtensionLifecycle.ts` - Migrate to DI container initialization
- `src/terminals/TerminalManager.ts` - Extract services into DI-managed components
- `src/providers/SecondaryTerminalProvider.ts` - Use DI for dependency resolution
- `src/services/CliAgent*.ts` - Migrate to plugin architecture
- `package.json` - Add new configuration sections

### Migration Strategy
- **Phase 1**: Introduce DI container alongside existing code (non-breaking)
- **Phase 2**: Migrate core services to DI incrementally
- **Phase 3**: Implement plugin system with existing agents as default plugins
- **Phase 4**: Extract configuration-driven behaviors
- **Phase 5**: Remove legacy initialization code

### Breaking Changes
- **BREAKING**: Plugin API surface for external AI agent extensions (new capability)
- **Non-Breaking**: All existing functionality remains compatible; DI is internal implementation detail

## Success Metrics
- DI container resolves all core services with zero manual instantiation in `ExtensionLifecycle`
- All existing AI agent detection migrated to plugin system without behavior changes
- Test suite shows 30%+ reduction in mocking complexity
- New AI agent can be added with <50 LOC (plugin implementation only)
- Configuration changes hot-reload without extension restart where possible
- All existing integration tests pass without modification

## Rollout Plan
1. **Pre-release**: Comprehensive testing of DI container and plugin system
2. **Alpha release**: Enable new architecture behind feature flag
3. **Beta release**: Default to new architecture with fallback option
4. **Stable release**: Remove legacy code after 2 version cycles of stability
