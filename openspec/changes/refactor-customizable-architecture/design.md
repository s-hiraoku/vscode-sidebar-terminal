# Design: Customizable Architecture

## Context

The extension has grown from a simple sidebar terminal to a sophisticated multi-terminal manager with AI agent detection, session persistence, and WebView coordination. Current architecture is service-oriented but lacks:
- Explicit dependency management
- Clear extension points for plugins
- Configuration-driven behavior patterns
- Testability without extensive mocking

Target audience: TypeScript developers familiar with VS Code extensions, DI patterns, and plugin architectures.

## Goals / Non-Goals

### Goals
- Enable plugin-based extensibility for AI agents and terminal features
- Simplify testing through dependency injection
- Clarify architectural layers and responsibilities
- Allow configuration-driven customization without code changes
- Maintain or improve current performance characteristics

### Non-Goals
- Full external plugin system with separate npm packages (internal plugins only for now)
- Breaking existing user configurations or workflows
- Rewriting all existing code (incremental migration preferred)
- Using heavy DI frameworks like InversifyJS (keep it simple)

## Decisions

### 1. DI Container Design

**Decision**: Implement a simple, focused DI container without external dependencies

**Rationale**:
- InversifyJS adds 50KB+ to bundle and brings decorator complexity
- Awilix requires learning curve and has opinionated patterns
- Custom implementation: <200 LOC, zero dependencies, tailored to our needs

**Implementation**:
```typescript
// src/core/DIContainer.ts
export enum ServiceLifetime {
  Singleton,  // One instance per container
  Transient,  // New instance per resolve
  Scoped      // One instance per scope (e.g., per webview)
}

export class DIContainer {
  register<T>(token: ServiceToken<T>, factory: Factory<T>, lifetime: ServiceLifetime): void
  resolve<T>(token: ServiceToken<T>): T
  createScope(): DIContainer  // For scoped services
  dispose(): void  // Cleanup all singletons
}
```

**Alternatives Considered**:
- **InversifyJS**: Too heavy, decorator-based (TypeScript decorators are unstable)
- **Awilix**: Good library but adds dependency and learning curve
- **Manual factories**: Current approach, but scattered and hard to test

### 2. Plugin System Architecture

**Decision**: Interface-based plugin system with lifecycle hooks and configuration support

**Rationale**:
- VS Code extensions already understand plugin patterns
- Interface-based design allows both internal and future external plugins
- Lifecycle hooks enable proper resource management

**Implementation**:
```typescript
// src/core/plugins/IPlugin.ts
export interface IPlugin {
  readonly id: string
  readonly name: string
  readonly version: string

  activate(context: IPluginContext): Promise<void>
  deactivate(): Promise<void>
  configure(config: Record<string, unknown>): void
}

export interface IAgentPlugin extends IPlugin {
  detectAgent(output: string): AgentDetectionResult | null
  getStatusIndicator(agentState: AgentState): StatusIndicator
  shouldAccelerate(agentState: AgentState): boolean
}

// src/core/plugins/PluginManager.ts
export class PluginManager {
  registerPlugin(plugin: IPlugin): void
  getPlugin<T extends IPlugin>(id: string): T | undefined
  getPluginsByType<T extends IPlugin>(type: new () => T): T[]
  activateAll(): Promise<void>
  deactivateAll(): Promise<void>
}
```

**Alternatives Considered**:
- **Class-based inheritance**: Less flexible, harder to mock
- **Function-based**: Loses OOP benefits and lifecycle management
- **External npm packages**: Adds complexity, security risk, and review burden

### 3. Layered Architecture Structure

**Decision**: Explicit four-layer architecture with clear boundaries

```
src/
├── core/                    # Core Layer - Infrastructure foundations
│   ├── DIContainer.ts       # Dependency injection
│   ├── EventBus.ts          # Event-driven communication
│   ├── plugins/             # Plugin system
│   └── config/              # Configuration management
├── domain/                  # Domain Layer - Business models
│   ├── entities/            # Terminal, Session, AgentState
│   ├── interfaces/          # Repository and service contracts
│   └── events/              # Domain events
├── application/             # Application Layer - Use cases
│   ├── usecases/            # CreateTerminal, DetectAgent, RestoreSession
│   └── services/            # Application services
└── infrastructure/          # Infrastructure Layer - External integrations
    ├── vscode/              # VS Code API adapters
    ├── pty/                 # node-pty wrappers
    ├── storage/             # Persistence implementations
    └── webview/             # WebView coordination
```

**Rationale**:
- Clear separation of concerns enables independent testing
- Domain layer becomes framework-agnostic
- Easy to mock infrastructure for unit tests
- Familiar pattern for developers with DDD/Clean Architecture experience

**Alternatives Considered**:
- **Current flat structure**: Works but lacks clear boundaries
- **Hexagonal Architecture**: Too complex for current needs
- **Three-layer (MVC-style)**: Doesn't separate domain from application logic

### 4. Event Bus Design

**Decision**: Typed event bus with subscription management

**Implementation**:
```typescript
// src/core/EventBus.ts
export class EventBus {
  subscribe<T>(event: EventType<T>, handler: EventHandler<T>): Disposable
  publish<T>(event: EventType<T>, data: T): void
  replay(since?: Date): Event[]  // For debugging/testing
}

// Example domain events
export const TerminalCreatedEvent = createEventType<TerminalCreatedPayload>('terminal.created')
export const AgentDetectedEvent = createEventType<AgentDetectedPayload>('agent.detected')
```

**Rationale**:
- Decouples components (no direct dependencies between services)
- Enables cross-cutting concerns (logging, telemetry)
- Facilitates testing with event replay and verification
- Type-safe event definitions prevent runtime errors

**Alternatives Considered**:
- **VS Code Event Emitter**: Good but not typed, harder to manage subscriptions
- **RxJS**: Too heavy (200KB+), overkill for our needs
- **Direct callbacks**: Current approach, causes tight coupling

### 5. Configuration Schema

**Decision**: JSON Schema-validated configuration with hot-reload support

**New Settings**:
```json
{
  "sidebarTerminal.architecture": {
    "enableDI": true,
    "enablePlugins": true,
    "performanceProfile": "balanced"  // "fast", "balanced", "efficient"
  },
  "sidebarTerminal.plugins": {
    "agents": {
      "claude": { "enabled": true, "detectionPattern": "...", "threshold": 0.8 },
      "copilot": { "enabled": true, "detectionPattern": "...", "threshold": 0.7 },
      "custom": []  // Future: User-defined agents
    }
  },
  "sidebarTerminal.performance": {
    "bufferFlushInterval": 16,
    "cliAgentFlushInterval": 4,
    "maxBufferSize": 50,
    "enableAdaptiveBuffering": true
  }
}
```

**Alternatives Considered**:
- **Hard-coded defaults**: Current approach, inflexible
- **YAML configuration**: Not standard for VS Code extensions
- **JavaScript-based config**: Security and complexity concerns

## Risks / Trade-offs

### Risk: Increased Complexity
- **Mitigation**: Incremental rollout, extensive documentation, keep DI container simple
- **Trade-off**: Short-term complexity increase for long-term maintainability

### Risk: Performance Regression
- **Mitigation**: Benchmark DI resolution overhead (<1ms per resolve), lazy initialization
- **Trade-off**: Minimal overhead acceptable for improved testability

### Risk: Breaking Plugin API
- **Mitigation**: Internal plugins only initially, careful API design before external support
- **Trade-off**: Delay external plugin support until API proven stable

### Risk: Migration Effort
- **Mitigation**: Incremental migration, existing code continues working during transition
- **Trade-off**: Temporary dual-code maintenance burden

## Migration Plan

### Phase 1: Foundation (1-2 weeks)
1. Implement DI container with comprehensive tests
2. Implement event bus with typed events
3. Create plugin interfaces and PluginManager
4. Add new configuration sections to `package.json`

### Phase 2: Core Services Migration (2-3 weeks)
5. Migrate `TerminalManager` to use DI for dependencies
6. Extract buffer management service
7. Extract lifecycle service
8. Update `ExtensionLifecycle` to use DI container

### Phase 3: Plugin System Implementation (2-3 weeks)
9. Migrate AI agent detection to plugin architecture
10. Implement default agent plugins (Claude, Copilot, etc.)
11. Add plugin configuration hot-reload
12. Update WebView to consume plugin events

### Phase 4: Testing & Refinement (1-2 weeks)
13. Update test suite to use DI for mocking
14. Add integration tests for plugin system
15. Performance benchmarking and optimization
16. Documentation and examples

### Phase 5: Cleanup (1 week)
17. Remove legacy initialization code
18. Remove feature flags
19. Update CLAUDE.md and README.md
20. Release announcement and migration guide

**Total Estimated Effort**: 8-11 weeks

## Open Questions

1. **Should we support external plugins in v1?**
   - Initial answer: No, prove plugin API with internal plugins first
   - Revisit after 3-6 months of stability

2. **How to handle plugin conflicts?**
   - Proposal: Plugin priority system + last-registered-wins for overlapping functionality
   - Need user feedback on desired behavior

3. **Should configuration changes require restart?**
   - Most settings can hot-reload
   - DI container structure changes require restart
   - Document per-setting reload behavior

4. **Performance benchmarks?**
   - Target: <5% overhead from DI resolution
   - Monitor: Extension activation time, terminal creation time, message throughput
   - Tool: VS Code Extension Profiler + custom benchmarks
