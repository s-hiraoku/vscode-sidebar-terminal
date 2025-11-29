# TDDテストアーキテクチャ図

## テスト構造の全体像

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TDD Test Architecture                                │
│                   TerminalManager Event Handlers                          │
└─────────────────────────────────────────────────────────────────────────┘

                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              ┌─────▼─────┐               ┌──────▼──────┐
              │   Unit     │               │ Integration │
              │   Tests    │               │    Tests    │
              └─────┬─────┘               └──────┬──────┘
                    │                             │
        ┌───────────┼───────────┐         ┌──────┴──────┐
        │           │           │         │             │
   ┌────▼────┐ ┌───▼───┐ ┌────▼────┐ ┌──▼──┐    ┌────▼────┐
   │  RED    │ │ GREEN │ │ REFACTOR│ │Multi│    │Lifecycle│
   │ Phase   │ │ Phase │ │  Phase  │ │Term │    │  Tests  │
   └────┬────┘ └───┬───┘ └────┬────┘ └──┬──┘    └────┬────┘
        │          │          │         │            │
        │          │          │         └────────────┴─────┐
        │          │          │                            │
        └──────────┴──────────┴────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  TDD Quality    │
                    │     Gate        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   CI/CD         │
                    │  Pipeline       │
                    └─────────────────┘
```

---

## Phase 1: RED - 失敗するテストを書く

```
┌─────────────────────────────────────────────────────────────┐
│                    RED Phase Tests                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 1. Event Handler Duplication Detection                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  createTerminal()                                            │
│       │                                                      │
│       ├──► onData handler count = ?                         │
│       │    Expected: 1                                       │
│       │    ✓ Test passes if exactly 1                       │
│       │                                                      │
│       └──► onExit handler count = ?                         │
│            Expected: 1                                       │
│            ✓ Test passes if exactly 1                       │
│                                                              │
│  createTerminalWithProfile()                                 │
│       │                                                      │
│       ├──► onData handler count = ?                         │
│       │    Expected: 1                                       │
│       │                                                      │
│       └──► onExit handler count = ?                         │
│            Expected: 1                                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 2. Data Event Emission Count                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PTY Process ──► emitData('test')                           │
│                        │                                     │
│                        ▼                                     │
│              onData event fired?                             │
│                        │                                     │
│                        ▼                                     │
│              Event counter = ?                               │
│              Expected: 1                                     │
│              ✓ Test passes if exactly 1                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 2: GREEN - テストを通す実装

```
┌─────────────────────────────────────────────────────────────┐
│                   GREEN Phase Verification                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Current Implementation Structure                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  createTerminal()                                            │
│       │                                                      │
│       ├──► spawn PTY process                                │
│       │                                                      │
│       ├──► create TerminalInstance                          │
│       │                                                      │
│       └──► _setupTerminalEvents(terminal)  ◄─┐             │
│                                               │              │
│  createTerminalWithProfile()                  │              │
│       │                                       │              │
│       ├──► resolve profile                   │              │
│       │                                       │              │
│       ├──► spawn PTY process with profile    │              │
│       │                                       │              │
│       ├──► create TerminalInstance            │              │
│       │                                       │              │
│       └──► _setupTerminalEvents(terminal)  ◄─┘              │
│                                               │              │
│                        UNIFIED EVENT SETUP    │              │
│                                                              │
│  _setupTerminalEvents(terminal)               │              │
│       │                                       │              │
│       ├──► Initialize ProcessState = Launching              │
│       │                                                      │
│       ├──► ptyProcess.onData((data) => {                    │
│       │        if (Launching) → Running                     │
│       │        bufferData(terminalId, data)                 │
│       │    })                                                │
│       │    ✓ Registered ONCE                                │
│       │                                                      │
│       └──► ptyProcess.onExit((event) => {                   │
│                Update ProcessState                           │
│                Cleanup resources                             │
│            })                                                │
│            ✓ Registered ONCE                                │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 3: REFACTOR - テストとコードの改善

```
┌─────────────────────────────────────────────────────────────┐
│                  REFACTOR Phase Tests                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 1. Method Consistency Verification                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Terminal 1 (createTerminal)                                 │
│       │                                                      │
│       ├──► Has onData handler? ✓                            │
│       ├──► Has onExit handler? ✓                            │
│       │                                                      │
│       │  Terminal 2 (createTerminalWithProfile)             │
│       │       │                                              │
│       └───────├──► Has onData handler? ✓                    │
│               ├──► Has onExit handler? ✓                    │
│               │                                              │
│               └──► Same pattern? ✓                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 2. Edge Cases                                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Rapid Terminal Creation                                     │
│       │                                                      │
│       ├──► Create T1 → Handler count = 1 ✓                 │
│       ├──► Create T2 → Handler count = 1 ✓                 │
│       ├──► Create T3 → Handler count = 1 ✓                 │
│       ├──► Create T4 → Handler count = 1 ✓                 │
│       └──► Create T5 → Handler count = 1 ✓                 │
│                                                              │
│  Multiple State Transitions                                  │
│       │                                                      │
│       ├──► emitData('data1')                                │
│       ├──► emitData('data2')                                │
│       ├──► emitData('data3')                                │
│       │                                                      │
│       └──► Handler count still = 1 ✓                        │
│                                                              │
│  Terminal Deletion During Data Processing                    │
│       │                                                      │
│       ├──► emitData('data')                                 │
│       ├──► deleteTerminal() ← concurrent                    │
│       │                                                      │
│       └──► No crash ✓                                       │
└──────────────────────────────────────────────────────────────┘
```

---

## 統合テスト構造

```
┌─────────────────────────────────────────────────────────────┐
│              Integration Test Architecture                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 1. Multi-Terminal Event Isolation                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Terminal 1 ──► Event A ──┐                                 │
│                            │                                 │
│  Terminal 2 ──► Event B ──┼──► Event Router                 │
│                            │                                 │
│  Terminal 3 ──► Event C ──┘                                 │
│                                                              │
│  Verification:                                               │
│    - Terminal 1 only receives Event A ✓                     │
│    - Terminal 2 only receives Event B ✓                     │
│    - Terminal 3 only receives Event C ✓                     │
│    - No cross-contamination ✓                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 2. Lifecycle Management                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Create Terminal                                             │
│       │                                                      │
│       ├──► ProcessState = Launching                         │
│       │                                                      │
│       ▼                                                      │
│  First Data Received                                         │
│       │                                                      │
│       ├──► ProcessState = Running ✓                         │
│       │                                                      │
│       ▼                                                      │
│  Delete Terminal                                             │
│       │                                                      │
│       ├──► ProcessState = KilledByUser ✓                    │
│       │                                                      │
│       └──► Handlers cleaned up ✓                            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 3. Concurrent Operations                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Thread 1: sendInput()  ──┐                                 │
│                            │                                 │
│  Thread 2: sendInput()  ──┼──► Atomic Operation Queue       │
│                            │                                 │
│  Thread 3: deleteTerminal()┘                                │
│                                                              │
│  Result:                                                     │
│    - No race conditions ✓                                   │
│    - No data loss ✓                                         │
│    - No crashes ✓                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Mock実装パターン

```
┌─────────────────────────────────────────────────────────────┐
│                  MockPtyProcess Design                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  MockPtyProcess                                              │
│  ├─ dataHandlers: Array<Function>                           │
│  ├─ exitHandlers: Array<Function>                           │
│  │                                                            │
│  ├─ onData(handler)                                          │
│  │    └─► this.dataHandlers.push(handler)                   │
│  │        └─► return { dispose: () => remove handler }      │
│  │                                                            │
│  ├─ onExit(handler)                                          │
│  │    └─► this.exitHandlers.push(handler)                   │
│  │        └─► return { dispose: () => remove handler }      │
│  │                                                            │
│  ├─ emitData(data) [TEST HELPER]                            │
│  │    └─► this.dataHandlers.forEach(h => h(data))          │
│  │                                                            │
│  ├─ emitExit(event) [TEST HELPER]                           │
│  │    └─► this.exitHandlers.forEach(h => h(event))         │
│  │                                                            │
│  ├─ getDataHandlerCount() [TEST HELPER]                     │
│  │    └─► return this.dataHandlers.length                   │
│  │                                                            │
│  └─ getExitHandlerCount() [TEST HELPER]                     │
│       └─► return this.exitHandlers.length                   │
└──────────────────────────────────────────────────────────────┘

Usage in Tests:
┌──────────────────────────────────────────────────────────────┐
│  beforeEach(() => {                                          │
│    mockPty = new MockPtyProcess()                           │
│    spawnStub.returns({ ptyProcess: mockPty })               │
│  })                                                          │
│                                                              │
│  it('should register handler once', () => {                 │
│    terminalManager.createTerminal()                         │
│    expect(mockPty.getDataHandlerCount()).to.equal(1)       │
│  })                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 品質ゲートフロー

```
┌─────────────────────────────────────────────────────────────┐
│                   TDD Quality Gate Flow                      │
└─────────────────────────────────────────────────────────────┘

Start
  │
  ├──► Run Unit Tests
  │         │
  │         ├──► RED Phase Tests
  │         │         └──► Handler duplication detection
  │         │
  │         ├──► GREEN Phase Tests
  │         │         └──► Process state management
  │         │
  │         └──► REFACTOR Phase Tests
  │                   └──► Edge cases
  │
  ├──► Run Integration Tests
  │         │
  │         ├──► Multi-terminal isolation
  │         ├──► Lifecycle management
  │         └──► Concurrent operations
  │
  ├──► Check Test Coverage
  │         │
  │         └──► Target: 85%+ ✓
  │
  ├──► Check TDD Compliance
  │         │
  │         └──► Target: 50%+ ✓
  │
  ├──► Run Performance Tests
  │         │
  │         └──► No degradation ✓
  │
  └──► Generate Report
           │
           └──► All gates passed? ──► Release ✓
                        │
                        └──► Failed ──► Fix & Retry
```

---

## テスト実行フロー

```
┌─────────────────────────────────────────────────────────────┐
│                Test Execution Workflow                       │
└─────────────────────────────────────────────────────────────┘

Developer Workflow:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. Write Failing Test (RED)                                │
│       │                                                      │
│       ├──► npm run test -- --grep "Event Handler"          │
│       │                                                      │
│       └──► Expected: FAIL ✗                                │
│                                                              │
│  2. Implement Minimum Code (GREEN)                          │
│       │                                                      │
│       ├──► Fix _setupTerminalEvents()                       │
│       │                                                      │
│       ├──► npm run test -- --grep "Event Handler"          │
│       │                                                      │
│       └──► Expected: PASS ✓                                │
│                                                              │
│  3. Refactor & Add Tests (REFACTOR)                         │
│       │                                                      │
│       ├──► Add edge case tests                              │
│       │                                                      │
│       ├──► Improve implementation                           │
│       │                                                      │
│       ├──► npm run test -- --grep "Event Handler"          │
│       │                                                      │
│       └──► Expected: PASS ✓                                │
│                                                              │
│  4. Run Quality Gates                                        │
│       │                                                      │
│       ├──► npm run tdd:quality-gate                         │
│       │                                                      │
│       └──► npm run test:coverage                            │
│                                                              │
│  5. Commit & Push                                            │
│       │                                                      │
│       └──► git commit -m "feat: unified event handlers"    │
│           git push                                           │
└──────────────────────────────────────────────────────────────┘

CI/CD Pipeline:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  GitHub Actions Trigger                                      │
│       │                                                      │
│       ├──► Install Dependencies                             │
│       │                                                      │
│       ├──► Run Unit Tests                                   │
│       │      └──► 15+ tests ✓                              │
│       │                                                      │
│       ├──► Run Integration Tests                            │
│       │      └──► 20+ tests ✓                              │
│       │                                                      │
│       ├──► Check Coverage                                    │
│       │      └──► 85%+ ✓                                   │
│       │                                                      │
│       ├──► TDD Quality Gate                                  │
│       │      └──► 50%+ ✓                                   │
│       │                                                      │
│       └──► Deploy / Publish                                  │
│              └──► Success ✓                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## まとめ

このアーキテクチャ図は、TDDテスト戦略の全体像を視覚化したものです。

**重要なポイント**:
- ✅ RED-GREEN-REFACTOR サイクルの明確な実装
- ✅ ユニットテストと統合テストの適切な分離
- ✅ Mock実装パターンの標準化
- ✅ 品質ゲートによる継続的な品質保証

この構造により、TerminalManagerのイベントハンドラーリファクタリングが
高品質かつ保守可能な状態で実装されることが保証されます。
