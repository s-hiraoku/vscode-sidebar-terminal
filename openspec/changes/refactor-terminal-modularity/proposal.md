# Change Proposal: Terminal Modularity Refactor

## Why
- Core runtime files have grown unwieldy: `LightweightTerminalWebviewManager.ts` (2,637 lines), `SecondaryTerminalProvider.ts` (2,396 lines), and `TerminalManager.ts` (1,830 lines) each mix orchestration, state, platform guards, and logging, making code reviews and onboarding extremely slow.
- Responsibilities overlap between the extension host (provider) and webview managers; message wiring, lifecycle handling, and persistence logic are duplicated, increasing the risk of regressions whenever we change terminal flows.
- Tests mirror the monoliths and are expensive to update; without seam boundaries we cannot target smaller integration tests or enable gradual rewrites.
- A structured coordinator/service layout would give us smaller surfaces (<500 lines each), clearer ownership, and enable future optimizations (e.g., multi-pane layouts, agent-specific UI) without another large-scale rewrite.

## What Changes
- Create a dedicated `src/providers/secondaryTerminal/` module that splits `SecondaryTerminalProvider` into a `ViewBootstrapper`, `MessageBridge`, `PanelLocationController`, and `PersistenceOrchestrator`, with the provider class reduced to dependency wiring and VS Code interfaces.
- Introduce a `WebviewCoordinator` layer that wraps the existing specialized managers (UI/Input/Performance/etc.) so that `LightweightTerminalWebviewManager` becomes a thin orchestrator delegating to composable feature controllers. Shared contracts move to `src/webview/coordinators/`.
- Restructure `TerminalManager` into (a) `TerminalRegistry` (state + id recycling), (b) `TerminalLifecycleService` (spawn/kill focus), and (c) `TerminalEventHub` (all emitters), enabling isolated tests and replacing the current ad-hoc promise queue with an explicit command pipeline.
- Align persistence and messaging services with the new layers: persistence managers expose a stable interface consumed by the provider orchestrator; the message router maps command ids to typed handlers to eliminate giant switch statements.

## Success Metrics
- Each of the three refactored entry points (`SecondaryTerminalProvider`, `LightweightTerminalWebviewManager`, `TerminalManager`) is reduced to ≤500 lines with clear dependency injection lists.
- Webview ↔ extension message paths are covered by new unit tests at the coordinator layer with mocked services; existing integration suites remain green.
- No regressions in terminal creation, split handling, persistence restore, or AI agent detection across Windows/macOS/Linux test runs (`npm run test:all`).

## Rollout Plan
- Land refactor behind a compile-time feature flag (`SECONDARY_TERMINAL_REFACTORED=1`) so we can keep the old orchestrators for a release if needed.
- Migrate provider, webview, and terminal subsystems sequentially (provider → webview → terminal core) to keep PRs reviewable and bisectable.
- After telemetry + manual validation show parity, remove the flag and delete the old glue code.
