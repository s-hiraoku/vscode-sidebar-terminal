## 1. Discovery & Guardrails
- [x] 1.1 Catalogue current terminal commands/events and map owning modules
- [ ] 1.2 Capture baseline metrics (bundle size, lint/test time, coverage snapshots)
- [ ] 1.3 Identify high-risk areas/tests to prioritize during refactor

## 2. Terminal Core Extraction
- [ ] 2.1 Draft Target architecture for TerminalManager decomposition
- [ ] 2.2 Implement TerminalOrchestrator service with DI-friendly contracts
- [ ] 2.3 Update TerminalManager to delegate to orchestrator and maintain façade API
- [ ] 2.4 Ensure ShellIntegrationService and CLI agent detection use new interfaces
- [ ] 2.5 Add unit tests for orchestrator lifecycle and failure cases

## 3. Messaging Normalization
- [ ] 3.1 Create shared DTO/type definitions for terminal messaging
- [ ] 3.2 Refactor Extension message handlers to use DTOs and validation
- [ ] 3.3 Align WebView message adapters with shared DTOs
- [ ] 3.4 Add regression tests for message routing and error handling

## 4. WebView Coordination Simplification
- [ ] 4.1 Decompose SecondaryTerminalProvider responsibilities into focused collaborators
- [ ] 4.2 Update WebView managers to consume new coordination interfaces
- [ ] 4.3 Validate scrollback/persistence workflows end-to-end

## 5. Hardening & Documentation
- [ ] 5.1 Expand coverage (unit + integration) for new modules
- [ ] 5.2 Run full validation pipeline (lint, tests, coverage)
- [ ] 5.3 Update developer docs with new architecture overview and migration notes
- [ ] 5.4 Run `openspec validate refactor-terminal-foundation --strict`
