## Why

Google Antigravity CLI is now a terminal-first agent surface launched with `agy`.
Secondary Terminal should detect it as a CLI agent so users get the same status tracking,
fast buffering, notifications, and multi-agent workflow affordances as existing agents.

## What Changes

- Add `antigravity` as a supported CLI agent type.
- Detect Antigravity CLI from submitted launcher commands such as `agy` and `antigravity`.
- Detect Antigravity CLI from stable startup output containing Antigravity/AGY CLI identifiers.
- Display and notify the agent as "Antigravity".
- Update user-facing docs and package metadata where supported CLI agents are listed.

## Impact

- Affected specs: `openspec/changes/add-antigravity-cli-detection/specs/cli-agent-detection/spec.md`
- Affected code:
  - `src/types/shared.ts`
  - `src/services/CliAgentPatternRegistry.ts`
  - `src/services/CliAgentDetectionEngine.ts`
  - `src/services/agentConstants.ts`
  - `src/services/terminal/TerminalCliAgentIntegrationService.ts`
  - `src/terminals/TerminalManager.ts`
  - `src/webview/managers/handlers/TerminalLifecycleMessageHandler.ts`
  - `src/constants/SystemConstants.ts`
  - `src/constants/TerminalConstants.ts`
  - `src/test/vitest/unit/services/CliAgentDetectionService.test.ts`
  - `src/test/vitest/unit/services/CliAgentPatternRegistry.test.ts`
  - `src/test/vitest/unit/services/ToastNotificationService.test.ts`
  - `README.md`
  - `package.json`
