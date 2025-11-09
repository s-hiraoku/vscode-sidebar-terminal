## Why
- VS Code window reload currently recreates sidebar terminals without any of the previous scrollback, violating the advertised persistent session behavior (Issue #201).
- Investigation shows the WebView never registers xterm instances with the optimized persistence manager and ignores serialization restore messages, so `restoreTerminalContent` is never able to replay buffered output.
- Without a fix, users lose context after every reload and must rerun commands manually.

## What Changes
- Ensure every WebView terminal loads the serialize addon and registers with `OptimizedTerminalPersistenceManager`, keeping terminal buffers hydrated for later restores.
- Route `restoreTerminalSerialization` payloads through the persistence manager so serialized content (and fallback scrollback) is pushed into the correct xterm instance.
- Confirm the fallback `restoreScrollback` path targets the active terminal instance when serialization is unavailable.

## Impact
- Restores scrollback after window reloads, aligning behavior with VS Code's built-in terminal persistence.
- Requires updates to WebView terminal lifecycle and message plumbing; no schema or external API changes expected.
- Regression risk is limited to terminal restore flows—will mitigate via focused automated tests covering serialization and fallback paths.
