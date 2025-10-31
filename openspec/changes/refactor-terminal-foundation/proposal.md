## Why
- TerminalManager.ts has grown past 1,800 lines and owns lifecycle, buffering, shell integration, CLI agent detection, and state persistence. This makes onboarding and defect triage slow and introduces subtle regressions (e.g., the recent `sendInput` signature mismatch).
- Extension ↔ WebView messaging is duplicated across `SecondaryTerminalProvider`, `TerminalMessageHandlers`, and multiple webview managers; inconsistent DTO shapes cause brittle behaviors and make validation difficult.
- Buffer/scrollback and state services are injected but not consistently leveraged, preventing deterministic testing and mocking.
- Current architecture makes it difficult to introduce new terminal features (e.g., per-terminal profiles) without touching numerous files, increasing risk and cycle time.

## Goals
1. Decompose terminal orchestration into testable services with clear contracts (creation, lifecycle, input routing, persistence).
2. Normalize Extension ↔ WebView messaging through shared DTO definitions, validation, and telemetry hooks.
3. Strengthen test coverage around terminal lifecycle, message dispatch, and CLI agent integration using the existing DI services.
4. Preserve existing user-facing behavior, performance budgets, and compatibility with AI agent plugins.
5. Document new module boundaries and migration steps to support future contributors.

## Non-Goals
- Introducing new user-facing features or changing terminal limits.
- Replacing the existing DI container or plugin system.
- Rewriting the WebView UI/UX beyond structural adjustments required for refactoring.
- Altering CLI agent detection heuristics (beyond necessary orchestrator changes).

## Proposed Approach
### Phase 0 – Discovery & Guardrails
- Inventory current message commands, lifecycle hooks, and tests; map them to proposed modules.
- Capture baseline metrics (bundle size, lint/test duration, existing coverage) and log any known flaky tests.

### Phase 1 – Terminal Core Extraction
- Extract lifecycle management (creation, activation, disposal) into a dedicated `TerminalOrchestrator` with explicit dependencies (spawner, registry, buffer, state).
- Introduce small service interfaces for input routing and process monitoring, leaving TerminalManager as a façade that wires services for backward compatibility.
- Ensure ShellIntegrationService and CLI agent detection rely on the new interfaces.

### Phase 2 – Messaging Normalization
- Define shared DTO/type definitions for terminal commands/events in a single location (`src/types/terminalMessaging.ts`).
- Update `TerminalMessageHandlers`, `SecondaryTerminalProvider`, and WebView manager adapters to use the shared DTOs and a central dispatcher contract.
- Add validation/guard rails when handlers are misused (e.g., missing terminalId) and ensure logging is standardized.

### Phase 3 – WebView Coordination Simplification
- Split responsibilities inside `SecondaryTerminalProvider` into focused collaborators (e.g., `InitializationWorkflow`, `TerminalFocusCoordinator`).
- Align WebView message bridges with the normalized DTOs, removing redundant mapping layers.
- Confirm scrollback and persistence flows still work with BufferManagementService.

### Phase 4 – Hardening & Documentation
- Expand unit/integration coverage for new services and message flows.
- Update developer docs (README snippet, openspec project notes) with new module layout and testing tips.
- Run full validation (lint, format, tests, coverage, `openspec validate`) and capture before/after metrics.

## Impact & Risks
- **Regression Risk**: Terminal lifecycle and messaging changes may affect live sessions; mitigated via phased rollout and regression tests.
- **Performance Risk**: Additional abstraction layers may impact startup or throughput; mitigated by profiling buffer flush intervals and xterm.js rendering.
- **Plugin Compatibility**: Agent plugins depend on current APIs; coordination required to keep contracts stable.
- **Timeline Risk**: Large refactor could span multiple sprints; use phase checkpoints and incremental merges.

## Success Metrics
- Reduce TerminalManager.ts to <600 LOC, with remaining responsibilities well-documented.
- Achieve >80% unit test coverage on new orchestration and messaging modules.
- Zero regressions in manual smoke tests (terminal creation, input, CLI agent detection, persistence).
- Maintain or improve extension activation time and WebView load metrics (baseline vs post-refactor).

## Validation Plan
- Automated: `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run coverage:check`.
- Manual: Verify terminal creation, input, resize, focus, split, persistence restore, CLI agent connection/disconnection, and WebView interactions on macOS and Windows.
- Spec: Run `openspec validate refactor-terminal-foundation --strict` before requesting approval.

## Open Questions
- Do we need new telemetry hooks to observe terminal orchestration health? (Pending discussion.)
- Should we stage WebView messaging normalization behind a feature flag for beta users?
- Are there upcoming features (e.g., terminal profile sync) that we should design for during this refactor?
