# Proposal: Align Terminal Initialization With VS Code

## Summary
Rebuild the terminal initialization pipeline so it mirrors VS Code’s native terminal flow (View ready → PTY spawn → shell integration handshake → prompt ready). This guarantees that every newly created Sidebar Terminal shows a usable prompt immediately, enables shell integration, and recovers gracefully from timing failures.

## Motivation
- Current implementation relies on a fragile `terminalInitializationComplete` message; routing or timing glitches still leave users without a prompt.
- Workarounds (fallback timers, manual retries) add complexity but do not ensure parity with VS Code behavior.
- Users explicitly asked that Sidebar Terminal “behave like VS Code Terminal,” especially for prompt display and immediate usability.

## Goals
1. Adopt VS Code’s initialization order, including buffering PTY output until the WebView confirms readiness.
2. Guarantee prompt visibility and input capability within 1s of terminal creation.
3. Provide deterministic, observable handshake states with ACK/retry and timeout recovery.
4. Document the new flow in OpenSpec so future work follows the same contract.

## Non-Goals
- Replacing xterm.js or removing the WebView entirely (out of scope).
- Changing CLI agent detection logic beyond what’s needed for the new handshake.

## High-Level Plan
1. Define the canonical initialization state machine (Idle → ViewReady → PtySpawned → ShellInit → PromptReady).
2. Update WebView creation code to send explicit “view ready” ACK and hold outgoing data until Extension releases it.
3. Refactor `SecondaryTerminalProvider` / `TerminalManager` partnerships to:
   - Track initialization state per terminal.
   - Buffer PTY output until the WebView is ready.
   - Retry shell init when messages are missing, similar to VS Code’s AutoOpenBarrier.
4. Expand `terminal-shell-initialization` spec with VS Code parity requirements.

## Dependencies / Related Work
- Supersedes remaining work in `fix-terminal-initialization-bugs`.
- Requires coordination with `add-vscode-standard-terminal-features` change to avoid duplicate messaging logic.

## Risks
- Significant refactor touching both Extension and WebView layers; must stage carefully.
- Tight coupling with VS Code API proposals (e.g., `terminalShellEnv`) might surface new feature flags.
- Increased init logging may impact performance if not throttled.

## Validation
- Unit tests for state machine transitions.
- Integration test verifying prompt display within 1s for bash/zsh/fish.
- Manual verification against VS Code baseline (open dev tools, inspect events).
