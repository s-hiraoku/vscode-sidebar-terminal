# Terminal Manager Refactoring Plan

**Issue:** [#213 - Split TerminalManager into specialized services](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213)

**Priority:** P0 (High Impact - Architecture Foundation)

**Status:** ✅ Phase 1 Complete - Service Design & Implementation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Solution Design](#solution-design)
4. [Implementation Status](#implementation-status)
5. [Service Interfaces](#service-interfaces)
6. [Migration Plan](#migration-plan)
7. [Testing Strategy](#testing-strategy)
8. [Metrics & Success Criteria](#metrics--success-criteria)
9. [Next Steps](#next-steps)

---

## 🎯 Overview

The `TerminalManager.ts` file has grown to **1,899 lines** with **10+ responsibilities**, making it a classic "God Object" that violates the Single Responsibility Principle (SRP). This refactoring decomposes it into **5 specialized services**, each handling a distinct aspect of terminal management.

### Benefits

- **Reduced Complexity:** From 1,899 lines to ~400 lines coordinator
- **Improved Testability:** Each service can be tested in isolation
- **Better Maintainability:** Clear separation of concerns
- **Enhanced Reliability:** Reduced cyclomatic complexity and if-statement count
- **Easier Onboarding:** Clear service boundaries for new developers

---

## 🚨 Problem Statement

### Current Issues

1. **God Object Anti-Pattern**
   - 1,899 lines of code in a single file
   - 106 if-statements with high cyclomatic complexity
   - 10+ distinct responsibilities

2. **Responsibilities (Violations of SRP)**
   - PTY process management
   - Terminal lifecycle operations
   - CLI Agent detection (now extracted)
   - Terminal ID management
   - Data buffering and optimization
   - Shell integration
   - Profile management
   - Input/output handling
   - State notifications
   - Error recovery and validation

3. **Testing Challenges**
   - Difficult to test individual responsibilities
   - High coupling between components
   - Mocking complexity

---

## 🏗️ Solution Design

### Service Decomposition

The refactoring splits `TerminalManager` into **5 specialized services**:

#### 1. **TerminalProcessManager** - PTY Operations
**Responsibility:** Low-level PTY process lifecycle management

**Key Methods:**
- `createPtyProcess()` - Spawn new PTY processes
- `writeToPty()` - Write data to PTY
- `resizePty()` - Resize PTY dimensions
- `killPty()` - Terminate PTY processes
- `registerPty()` / `unregisterPty()` - PTY registry management
- `attemptPtyRecovery()` - Recover from PTY failures

**Location:** `src/services/TerminalProcessManager.ts`

**Status:** ✅ Implemented & Tested

---

#### 2. **TerminalLifecycleService** - Terminal Operations
**Responsibility:** High-level terminal create/delete/focus operations

**Key Methods:**
- `createTerminal()` - Create new terminal instances
- `deleteTerminal()` - Delete terminals
- `focusTerminal()` - Focus terminal
- `setActiveTerminal()` - Set active terminal
- `getTerminal()` / `getTerminals()` - Terminal queries

**Events:**
- `onTerminalCreated`
- `onTerminalRemoved`
- `onTerminalFocus`

**Location:** `src/services/TerminalLifecycleManager.ts` (already exists)

**Status:** ✅ Exists - Needs Integration

---

#### 3. **TerminalStateCoordinator** - State Management
**Responsibility:** Terminal state tracking and event coordination

**Key Methods:**
- `getCurrentState()` - Get current terminal state
- `notifyStateUpdate()` - Notify state changes
- `notifyProcessStateChange()` - Notify process state changes
- `isTerminalActive()` / `setTerminalActive()` - Active state management
- `deactivateAllTerminals()` - Bulk state operations
- `getAvailableSlots()` - Available terminal slots

**Events:**
- `onStateUpdate`
- `onData`
- `onExit`

**Location:** `src/services/TerminalStateCoordinator.ts`

**Status:** ✅ Implemented & Tested

---

#### 4. **TerminalDataBufferService** - Output Buffering
**Responsibility:** Performance optimization through data buffering

**Key Methods:**
- `bufferData()` - Buffer terminal output
- `flushBuffer()` - Flush buffered data
- `scheduleFlush()` - Schedule adaptive flush
- `addFlushHandler()` - Register flush handlers
- `getAllStats()` - Buffer statistics

**Features:**
- Adaptive flush intervals (8-16ms)
- High-frequency detection for CLI agents
- Performance statistics tracking

**Location:** `src/services/TerminalDataBufferingService.ts` (already exists)

**Status:** ✅ Exists - Needs Integration

---

#### 5. **TerminalValidationService** - Validation & Recovery
**Responsibility:** Operation validation and error recovery

**Key Methods:**
- `validateCreation()` - Validate terminal creation
- `validateDeletion()` - Validate terminal deletion
- `validatePtyWrite()` - Validate PTY write operations
- `validatePtyResize()` - Validate PTY resize operations
- `checkTerminalHealth()` - Health checks
- `validateStateConsistency()` - State consistency validation
- `setupLaunchTimeout()` - Launch timeout monitoring
- `attemptRecovery()` - Error recovery

**Location:** `src/services/TerminalValidationService.ts`

**Status:** ✅ Implemented & Tested

---

### Refactored Architecture

```
┌─────────────────────────────────────────────────────────┐
│          TerminalManager (Coordinator)                  │
│            ~400 lines (80% reduction)                   │
└───────────┬─────────────────────────────────────────────┘
            │
            ├──> TerminalProcessManager (PTY ops)
            │
            ├──> TerminalLifecycleService (create/delete/focus)
            │
            ├──> TerminalStateCoordinator (state & events)
            │
            ├──> TerminalDataBufferService (buffering)
            │
            └──> TerminalValidationService (validation)
```

---

## ✅ Implementation Status

### Phase 1: Service Design & Implementation (COMPLETE)

- [x] Design service interfaces (`src/interfaces/TerminalServices.ts`)
- [x] Implement TerminalProcessManager
- [x] Implement TerminalStateCoordinator
- [x] Implement TerminalValidationService
- [x] Write unit tests for new services (≥80% coverage target)
- [x] Document refactoring plan

### Phase 2: Integration (NEXT)

- [ ] Create RefactoredTerminalManager using all 5 services
- [ ] Migrate existing TerminalManager logic to services
- [ ] Update SecondaryTerminalProvider to use RefactoredTerminalManager
- [ ] Integration testing

### Phase 3: Testing & Validation

- [ ] Run full test suite
- [ ] E2E testing
- [ ] Performance benchmarking
- [ ] Code review

### Phase 4: Deployment

- [ ] Gradual rollout with feature flag
- [ ] Monitor for regressions
- [ ] Deprecate old TerminalManager

---

## 🔌 Service Interfaces

All service interfaces are defined in `src/interfaces/TerminalServices.ts`:

```typescript
// Main service interfaces
export interface ITerminalProcessManager { ... }
export interface ITerminalLifecycleService { ... }
export interface ITerminalStateCoordinator { ... }
export interface ITerminalDataBufferService { ... }
export interface ITerminalValidationService { ... }

// Factory for creating services
export interface ITerminalServicesFactory { ... }
```

### Key Types

```typescript
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  canProceed: boolean;
}

export interface PtyCreationOptions {
  shell: string;
  shellArgs: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
}
```

---

## 🚀 Migration Plan

### Step 1: Parallel Implementation

Keep existing `TerminalManager` working while building new services.

```typescript
// Current (unchanged)
export class TerminalManager { ... }

// New (side-by-side)
export class RefactoredTerminalManager {
  constructor(
    private processManager: ITerminalProcessManager,
    private lifecycleService: ITerminalLifecycleService,
    private stateCoordinator: ITerminalStateCoordinator,
    private dataBufferService: ITerminalDataBufferService,
    private validationService: ITerminalValidationService
  ) {}
}
```

### Step 2: Feature Flag Migration

Use feature flag to switch between implementations:

```typescript
const useRefactoredManager = getConfig('experimental.useRefactoredTerminalManager');
const terminalManager = useRefactoredManager
  ? new RefactoredTerminalManager(...)
  : new TerminalManager();
```

### Step 3: Service Wiring Example

```typescript
// Create services
const processManager = new TerminalProcessManager();
const lifecycleService = new TerminalLifecycleManager();
const stateCoordinator = new TerminalStateCoordinator();
const dataBufferService = new TerminalDataBufferingService({
  normalFlushInterval: 16,
  fastFlushInterval: 8,
  maxBufferSize: 50,
});
const validationService = new TerminalValidationService(
  () => stateCoordinator.getTerminalsMap(),
  (id) => processManager.getPty(id)
);

// Wire services together
dataBufferService.addFlushHandler((terminalId, data) => {
  stateCoordinator.fireDataEvent(terminalId, data);
});

// Create coordinator
const terminalManager = new RefactoredTerminalManager(
  processManager,
  lifecycleService,
  stateCoordinator,
  dataBufferService,
  validationService
);
```

### Step 4: Gradual Method Migration

Migrate methods one by one:

```typescript
// Example: createTerminal() migration
async createTerminal(): Promise<string> {
  // 1. Validation
  const validation = this.validationService.validateCreation();
  if (!validation.canProceed) {
    throw new Error(validation.reason);
  }

  // 2. PTY Creation
  const ptyOptions = this.buildPtyOptions();
  const pty = await this.processManager.createPtyProcess(ptyOptions);

  // 3. Terminal Registration
  const terminalId = generateTerminalId();
  const terminal = this.buildTerminalInstance(terminalId, pty);

  // 4. State Management
  this.stateCoordinator.registerTerminal(terminal);
  this.stateCoordinator.setTerminalActive(terminalId, true);

  // 5. PTY Registry
  this.processManager.registerPty(terminalId, pty);

  // 6. Setup Event Handlers
  this.setupTerminalEvents(terminalId, pty);

  // 7. Notify
  this.stateCoordinator.notifyStateUpdate();

  return terminalId;
}
```

---

## 🧪 Testing Strategy

### Unit Tests (Implemented)

Each service has comprehensive unit tests:

- **TerminalProcessManager**: `src/test/unit/services/TerminalProcessManager.test.ts`
  - PTY creation, write, resize, kill operations
  - Process state tracking
  - Error handling and recovery
  - Target: ≥80% coverage

- **TerminalStateCoordinator**: `src/test/unit/services/TerminalStateCoordinator.test.ts`
  - State management and synchronization
  - Event emission
  - Active terminal management
  - Target: ≥80% coverage

- **TerminalValidationService**: `src/test/unit/services/TerminalValidationService.test.ts`
  - Creation/deletion validation
  - PTY operation validation
  - Health checks
  - Launch monitoring
  - Target: ≥80% coverage

### Integration Tests (TODO)

Test service interactions:

```typescript
describe('Terminal Services Integration', () => {
  it('should create terminal with all services coordinated', async () => {
    // Test full terminal creation flow
  });

  it('should handle terminal deletion with cleanup', async () => {
    // Test full deletion flow
  });

  it('should buffer and flush data correctly', async () => {
    // Test data flow through services
  });
});
```

### E2E Tests (TODO)

Test complete user workflows:

- Create multiple terminals
- Switch between terminals
- Write commands and receive output
- Resize terminals
- Delete terminals
- Handle errors gracefully

---

## 📊 Metrics & Success Criteria

### Code Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| TerminalManager LOC | 1,899 | ~400 | 80% reduction |
| If-statements | 106 | ~20 | 80% reduction |
| Cyclomatic Complexity | High | Low | <10 per method |
| File Count | 1 | 6 | 6 services |

### Test Coverage

| Service | Target | Status |
|---------|--------|--------|
| TerminalProcessManager | ≥80% | ✅ Tests Written |
| TerminalStateCoordinator | ≥80% | ✅ Tests Written |
| TerminalValidationService | ≥80% | ✅ Tests Written |
| Integration Tests | ≥80% | ⏳ TODO |
| E2E Tests | 100% | ⏳ TODO |

### Quality Goals

- ✅ All services follow Single Responsibility Principle
- ✅ Clear interface contracts
- ✅ Comprehensive unit test coverage
- ⏳ Integration test coverage
- ⏳ No performance regression
- ⏳ No functional regression

---

## 📝 Next Steps

### Immediate (Week 1-2)

1. **Create RefactoredTerminalManager**
   - Wire all 5 services together
   - Implement coordinator logic
   - Migrate core methods (create, delete, write, resize)

2. **Integration Testing**
   - Write integration tests
   - Test service interactions
   - Validate event flow

3. **Performance Validation**
   - Benchmark against current implementation
   - Ensure no performance regression
   - Optimize if needed

### Short-term (Week 3-4)

4. **Feature Flag Rollout**
   - Add configuration flag
   - Deploy to test environment
   - Monitor for issues

5. **Complete Method Migration**
   - Migrate remaining methods
   - Update all call sites
   - Deprecate old implementation

6. **Documentation**
   - Update API documentation
   - Create migration guide
   - Update architecture diagrams

### Long-term (Month 2+)

7. **Production Deployment**
   - Gradual rollout to production
   - Monitor metrics and logs
   - Fix any discovered issues

8. **Cleanup**
   - Remove old TerminalManager
   - Remove feature flags
   - Archive deprecated code

9. **Optimization**
   - Further service refinement
   - Performance optimization
   - Additional testing

---

## 📚 References

- **Issue:** [#213 - Split TerminalManager into specialized services](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213)
- **Service Interfaces:** `src/interfaces/TerminalServices.ts`
- **Implementations:**
  - `src/services/TerminalProcessManager.ts`
  - `src/services/TerminalStateCoordinator.ts`
  - `src/services/TerminalValidationService.ts`
  - `src/services/TerminalDataBufferingService.ts` (existing)
  - `src/services/TerminalLifecycleManager.ts` (existing)
- **Tests:**
  - `src/test/unit/services/TerminalProcessManager.test.ts`
  - `src/test/unit/services/TerminalStateCoordinator.test.ts`
  - `src/test/unit/services/TerminalValidationService.test.ts`

---

## 🎉 Conclusion

Phase 1 of the Terminal Manager refactoring is complete! We have successfully:

1. ✅ Designed comprehensive service interfaces
2. ✅ Implemented 3 new specialized services
3. ✅ Written comprehensive unit tests
4. ✅ Documented the architecture and migration plan

The foundation is now in place for Phase 2: integrating these services into a refactored TerminalManager coordinator that will reduce complexity by 80% while improving testability and maintainability.

---

**Last Updated:** 2025-11-12

**Status:** Phase 1 Complete ✅ | Phase 2 Ready to Begin 🚀
