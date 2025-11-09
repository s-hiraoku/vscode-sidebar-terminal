# Tasks: Refactor Terminal Foundation

## Overview

このタスクリストは、TerminalLifecycleManagerの分割を中心とした基盤リファクタリングの実装手順を示します。

**実装期間**: 3 weeks
**並行作業**: Phase 1-2は並行実行可能

---

## Phase 1: TerminalLifecycleManager 分割 (Week 1)

### Task 1.1: Extract TerminalCreationService
**Estimated Effort**: 2 days | **Priority**: HIGHEST

**Steps**:
1. Create `src/webview/services/TerminalCreationService.ts`
2. Extract `createTerminal()` method and dependencies
3. Extract `removeTerminal()` method and dependencies
4. Write unit tests

**Acceptance**: ✅ ~400 lines | ✅ Unit tests 90%+ coverage | ✅ No regression

---

### Task 1.2: Extract TerminalAddonManager
**Estimated Effort**: 2 days | **Priority**: HIGHEST

**Steps**:
1. Create `src/webview/managers/TerminalAddonManager.ts`
2. Extract all addon loading logic
3. Create `loadAllAddons()`, `disposeAddons()`, `getAddon<T>()`
4. Write unit tests

**Acceptance**: ✅ ~350 lines | ✅ Addon loading centralized

---

### Task 1.3: Extract TerminalEventManager
**Estimated Effort**: 1.5 days | **Priority**: HIGH

**Steps**:
1. Create `src/webview/managers/TerminalEventManager.ts`
2. Extract event handlers (click, focus, wheel)
3. Write unit tests

**Acceptance**: ✅ ~350 lines | ✅ Events work correctly

---

### Task 1.4: Extract TerminalLinkManager
**Estimated Effort**: 1.5 days | **Priority**: MEDIUM

**Steps**:
1. Create `src/webview/managers/TerminalLinkManager.ts`
2. Extract link handling logic
3. Write unit tests

**Acceptance**: ✅ ~300 lines | ✅ Links work correctly

---

### Task 1.5: Create TerminalLifecycleCoordinator
**Estimated Effort**: 2 days | **Priority**: HIGHEST | **Dependencies**: Tasks 1.1-1.4

**Steps**:
1. Rename TerminalLifecycleManager to TerminalLifecycleCoordinator
2. Inject all extracted services
3. Delegate to services
4. Run full test suite

**Acceptance**: ✅ ~300 lines (down from 1694) | ✅ All tests pass

---

## Phase 2: AddonLoader 統一 (Week 1-2)

### Task 2.1: Create AddonLoader Utility
**Estimated Effort**: 1 day | **Priority**: HIGH

**Steps**:
1. Create `src/webview/utils/AddonLoader.ts`
2. Implement `loadAddon<T>()` generic method
3. Write unit tests

**Acceptance**: ✅ Supports all addon types | ✅ Error handling works

---

### Task 2.2: Migrate to AddonLoader
**Estimated Effort**: 1.5 days | **Priority**: HIGH | **Dependencies**: Task 2.1

**Steps**:
1. Update TerminalAddonManager to use AddonLoader
2. Remove 50 lines of duplicated code
3. Run integration tests

**Acceptance**: ✅ All addons load correctly | ✅ Tests pass

---

## Phase 3: ErrorHandler 標準化 (Week 2)

### Task 3.1: Create ErrorHandler Utility
**Estimated Effort**: 1 day | **Priority**: MEDIUM

**Steps**:
1. Create `src/webview/utils/ErrorHandler.ts`
2. Implement `handleOperationError()` method
3. Write unit tests

**Acceptance**: ✅ Consistent error format | ✅ Tests pass

---

### Task 3.2: Migrate Error Handling
**Estimated Effort**: 1.5 days | **Priority**: MEDIUM | **Dependencies**: Task 3.1

**Steps**:
1. Replace 15+ error handling sites with ErrorHandler
2. Remove 75 lines of duplicated code

**Acceptance**: ✅ All errors use ErrorHandler | ✅ Consistent format

---

## Phase 4: BaseMessageHandler (Week 2)

### Task 4.1: Create BaseMessageHandler
**Estimated Effort**: 1 day | **Priority**: MEDIUM

**Steps**:
1. Create `src/webview/managers/handlers/BaseMessageHandler.ts`
2. Define abstract methods
3. Write unit tests

**Acceptance**: ✅ Common patterns extracted | ✅ Tests pass

---

### Task 4.2: Migrate Message Handlers
**Estimated Effort**: 2 days | **Priority**: MEDIUM | **Dependencies**: Task 4.1

**Steps**:
1. Update all 9 handlers to extend BaseMessageHandler
2. Remove 180 lines of duplicated code

**Acceptance**: ✅ All handlers extend base | ✅ Tests pass

---

## Phase 5: 統合テスト (Week 3)

### Task 5.1: Integration Testing
**Estimated Effort**: 2 days | **Priority**: CRITICAL

**Acceptance**: ✅ All tests pass | ✅ No regression

---

### Task 5.2: Performance Validation
**Estimated Effort**: 1 day | **Priority**: HIGH

**Acceptance**: ✅ Performance maintained | ✅ Results documented

---

### Task 5.3: Documentation Update
**Estimated Effort**: 1 day | **Priority**: MEDIUM

**Acceptance**: ✅ Docs updated | ✅ CHANGELOG updated

---

### Task 5.4: Final Validation
**Estimated Effort**: 0.5 days | **Priority**: CRITICAL

**Acceptance**: ✅ Pre-release check passes | ✅ Ready for merge

---

## Summary

**Total**: 14 tasks | **Effort**: 18.5 days (~3 weeks)

**Critical Path**: Task 1.1 → 1.5 → 5.1 → 5.4

**Parallelization**: Tasks 1.1, 1.2, 1.4 can run in parallel
