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

- Affected specs: cli-agent-detection
- Affected code: CLI agent type definitions, pattern registry, notification/display helpers,
  webview supported-agent filtering, unit tests, README/package metadata
