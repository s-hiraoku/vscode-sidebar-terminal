# Phase 2 Implementation Plan: Core Services Migration

## Overview

Phase 2 focuses on extracting core terminal management functionality into DI-managed services. This enables better testability, modularity, and prepares the codebase for plugin integration in Phase 3.

## Goals

- Extract 3 core services from TerminalManager
- Register all services in DIContainer
- Maintain 100% backward compatibility
- Keep all existing tests passing
- Achieve 90%+ test coverage for new services

## Timeline

**Estimated Duration**: 2-3 weeks
**Start Date**: 2025-10-27 (Today)
**Target Completion**: 2025-11-17

## Task Breakdown

### 2.1 BufferManagementService (Week 1 - Low Risk)

**Responsibility**: Manage terminal output buffering and flushing strategies

**Interface**:
```typescript
interface IBufferManagementService {
  // Buffer configuration
  setFlushInterval(terminalId: number, interval: number): void;
  getFlushInterval(terminalId: number): number;

  // Buffer operations
  write(terminalId: number, data: string): void;
  flush(terminalId: number): void;
  flushAll(): void;

  // Adaptive buffering
  enableAdaptiveBuffering(terminalId: number): void;
  disableAdaptiveBuffering(terminalId: number): void;

  // CLI Agent detection integration
  onCliAgentDetected(terminalId: number): void;
  onCliAgentDisconnected(terminalId: number): void;
}
```

**Migration Steps**:
1. Create `src/services/BufferManagementService.ts`
2. Extract buffer-related logic from TerminalManager
3. Write comprehensive unit tests (target: 95%+ coverage)
4. Register service in DIContainer
5. Update TerminalManager to use service
6. Run full test suite to verify no regressions

**Estimated Time**: 3-4 days

---

### 2.2 TerminalStateService (Week 2 - Medium Risk)

**Responsibility**: Manage terminal lifecycle states and metadata

**Interface**:
```typescript
interface ITerminalStateService {
  // State management
  getState(terminalId: number): TerminalState;
  setState(terminalId: number, state: TerminalState): void;

  // Metadata
  getMetadata(terminalId: number): TerminalMetadata;
  updateMetadata(terminalId: number, updates: Partial<TerminalMetadata>): void;

  // Lifecycle
  registerTerminal(id: number, metadata: TerminalMetadata): void;
  unregisterTerminal(id: number): void;

  // Queries
  getAllTerminals(): TerminalMetadata[];
  getActiveTerminal(): TerminalMetadata | undefined;
  isTerminalReady(id: number): boolean;
}

interface TerminalState {
  processState: ProcessState;
  interactionState: InteractionState;
  shellState: ShellState;
}

interface TerminalMetadata {
  id: number;
  name: string;
  createdAt: Date;
  lastActiveAt: Date;
  processId?: number;
  shellType: string;
}
```

**Migration Steps**:
1. Create `src/services/TerminalStateService.ts`
2. Extract state management logic from TerminalManager
3. Write comprehensive unit tests (target: 90%+ coverage)
4. Register service in DIContainer
5. Update TerminalManager to use service
6. Update session persistence to use new state service
7. Run full test suite

**Estimated Time**: 5-6 days

---

### 2.3 ExtensionLifecycle DI Integration (Week 3 - High Risk)

**Responsibility**: Bootstrap DI container and register all services

**Implementation**:
```typescript
// src/core/ExtensionLifecycle.ts

private bootstrapDIContainer(context: vscode.ExtensionContext): DIContainer {
  const container = new DIContainer();
  const eventBus = new EventBus();

  // Register core infrastructure
  container.register(IEventBus, () => eventBus, ServiceLifetime.Singleton);
  container.register(IExtensionContext, () => context, ServiceLifetime.Singleton);

  // Register services
  container.register(
    IBufferManagementService,
    (c) => new BufferManagementService(c.resolve(IEventBus)),
    ServiceLifetime.Singleton
  );

  container.register(
    ITerminalStateService,
    (c) => new TerminalStateService(c.resolve(IEventBus)),
    ServiceLifetime.Singleton
  );

  // Register PluginManager
  container.register(
    IPluginManager,
    (c) => new PluginManager(
      c.resolve(IEventBus),
      c.resolve(IExtensionContext)
    ),
    ServiceLifetime.Singleton
  );

  return container;
}
```

**Migration Steps**:
1. Add DI container initialization in activate()
2. Register all Phase 1 + Phase 2 services
3. Update service instantiation to use DI
4. Add disposal cleanup for DI container
5. Test extension activation/deactivation
6. Run full test suite

**Estimated Time**: 4-5 days

---

## Success Criteria

### Must Have
- [ ] All 3 services implemented with >85% test coverage
- [ ] All existing tests passing (no regressions)
- [ ] Zero TypeScript compilation errors
- [ ] DIContainer managing all core services
- [ ] Extension activates and deactivates cleanly

### Should Have
- [ ] Performance benchmarks show <5% overhead
- [ ] Memory usage within acceptable bounds
- [ ] Documentation updated for new services
- [ ] Integration tests for service interactions

### Nice to Have
- [ ] Service-level performance monitoring
- [ ] Debug logging for DI resolution
- [ ] Service dependency visualization

## Risk Assessment

### High Risk Items
1. **ExtensionLifecycle Changes**: Breaking extension activation could prevent users from using the extension
   - **Mitigation**: Feature flag for DI, allow fallback to legacy initialization

2. **Session Restoration**: Complex state dependencies could break session restore
   - **Mitigation**: Comprehensive integration tests, manual testing before release

3. **Performance Regression**: Service overhead could slow down terminal operations
   - **Mitigation**: Benchmark before/after, optimize hot paths

### Medium Risk Items
1. **Test Suite Stability**: Existing tests may need updates for DI-based mocking
   - **Mitigation**: Update tests incrementally, keep legacy tests as backup

2. **Type Safety**: Service interfaces must be strictly typed
   - **Mitigation**: Use TypeScript strict mode, comprehensive interface definitions

### Low Risk Items
1. **BufferManagementService**: Well-isolated, low coupling
2. **Event bus integration**: Already tested in Phase 1

## Rollback Plan

If Phase 2 introduces critical issues:

1. **Immediate**: Revert to commit `214ad3a` (pre-Phase 2)
2. **Feature Flag**: Set `secondaryTerminal.architecture.enableDI = false`
3. **Hot Fix**: Deploy emergency patch with DI disabled
4. **Root Cause**: Analyze logs, identify failure point
5. **Fix Forward**: Create targeted fix for specific issue

## Testing Strategy

### Unit Tests
- Each service: 85%+ coverage
- Test all public methods
- Test error conditions
- Test edge cases

### Integration Tests
- Service interactions
- DIContainer resolution
- Event bus communication
- Session persistence

### Performance Tests
- Buffer flush timing
- State query performance
- Memory usage under load
- DI resolution overhead

### Manual Tests
- Extension activation
- Terminal creation/deletion
- Session save/restore
- CLI agent detection

## Next Steps After Phase 2

Once Phase 2 is complete:
1. Create Phase 3 plan (Plugin System Implementation)
2. Migrate AI agent detection to plugins
3. Implement hot-reload for plugin configuration
4. Add external plugin API

---

## Current Status

**Phase 1 Status**: ✅ Complete (2025-10-27)
- DIContainer: 17/17 tests passing
- EventBus: 25/28 tests passing (89%)
- Plugin interfaces: Complete
- Configuration settings: 17 new settings added

**Phase 2 Status**: 🎯 Ready to Start
- Plan approved
- Dependencies ready
- Team aligned

**Git Status**:
- Branch: `for-publish`
- Latest commit: `214ad3a` - test: add comprehensive EventBus test suite
- Remote: Up to date

---

## Resources

- **OpenSpec Proposal**: `openspec/changes/refactor-customizable-architecture/`
- **Design Doc**: `openspec/changes/refactor-customizable-architecture/design.md`
- **Tasks**: `openspec/changes/refactor-customizable-architecture/tasks.md`
- **TDD Guide**: `src/test/CLAUDE.md`

## Contact

For questions or concerns about Phase 2 implementation:
- Review the OpenSpec proposal
- Check existing test patterns in `src/test/unit/`
- Reference TDD guide for testing approach
