# Tasks: Align Terminal Initialization With VS Code

## Stage 0 – Research & Spec
- [ ] Review VS Code `TerminalProcessManager` / `AutoOpenBarrier` flow (identify key states & timeouts).
- [ ] Update `openspec/changes/align-terminal-initialization-with-vscode/specs/terminal-shell-initialization/spec.md` with new requirements & scenarios.

## Stage 1 – Extension Handshake Refactor
- [ ] Implement per-terminal initialization state machine in `SecondaryTerminalProvider` / `TerminalManager`.
- [ ] Buffer PTY output until WebView acknowledges “view ready” (matching VS Code behavior).
- [ ] Replace ad-hoc timers with ACK/Retry logic (configurable delays, bounded attempts).
- [ ] Emit structured logs for every state transition (for diagnostics).

## Stage 2 – WebView Alignment
- [ ] Update `TerminalCreationService` / `LightweightTerminalWebviewManager` to:
  - Send explicit “view ready” ack.
  - Wait for Extension “start output” signal before displaying buffered data.
  - Use `initialText` / cursor sync to avoid duplicate prompts.
- [ ] Ensure xterm is fully configured before notifying Extension.

## Stage 3 – Recovery & UX
- [ ] Implement timeout-based fallback: if prompt not detected within 1s, auto re-run shell init in safe mode.
- [ ] Surface user-facing notification when initialization ultimately fails.
- [ ] Add telemetry/log counters for success/failure.

## Stage 4 – Testing & Validation
- [ ] Unit tests for handshake state machine + retry.
- [ ] Integration test covering bash/zsh/fish prompt appearance.
- [ ] Manual validation checklist (prompt visible, input works, logs clean).
