# Tasks: refactor-terminal-modularity

## 1. Discovery & Design
- [x] Document current data/control flow between `SecondaryTerminalProvider`, `LightweightTerminalWebviewManager`, and `TerminalManager` (sequence diagram or markdown sketch).
- [x] Define shared coordinator interfaces (provider ↔ webview ↔ terminal) and decide which responsibilities remain in each layer.

## 2. Provider Segmentation
- [x] Create `src/providers/secondaryTerminal/` with `ViewBootstrapper`, `MessageBridge`, `PanelLocationController`, and `PersistenceOrchestrator` classes plus unit tests.
- [x] Update `SecondaryTerminalProvider` to delegate to the new components and ensure `resolveWebviewView` only wires VS Code APIs + dependency graph.
- [x] Move panel location, scrollback, and message wiring tests to the new modules.

## 3. Webview Coordinator Layer
- [x] Introduce `WebviewCoordinator` (or similar) that composes existing managers; migrate lifecycle, diagnostics, and message dispatching from `LightweightTerminalWebviewManager` into smaller feature controllers.
- [x] Convert ad-hoc message handling into a typed command map with unit tests that enforce handler registration.
- [x] Ensure persistence, profile, and shell integration bridges plug into the coordinator via explicit interfaces.

## 4. Terminal Core Refactor
- [x] Extract `TerminalRegistry`, `TerminalLifecycleService`, and `TerminalEventHub` from `TerminalManager`; update consumers accordingly.
- [x] Replace the implicit `operationQueue` with a command pipeline (e.g., `TerminalCommandQueue`) and add tests covering concurrent create/delete scenarios.
- [ ] Verify CLI agent detection + profile sync integrations still function via updated adapters.

## 5. Persistence & Messaging Alignment
- [ ] Define a narrow `TerminalPersistencePort` used by both provider and webview coordinators; adapt `ConsolidatedTerminalPersistenceService` to implement it.
- [ ] Update `SecondaryTerminalMessageRouter` to consume the typed message map and ensure scrollback + telemetry commands pass through the new interfaces.

## 6. Validation & Cleanup
- [ ] Run `npm run lint`, `npm run test:unit`, `npm run test:integration`, and `npm run test:all` with the feature flag enabled and disabled.
- [ ] Remove dead code paths, update README/architecture docs, and drop the feature flag once parity is confirmed.
