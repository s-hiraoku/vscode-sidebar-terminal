1. [x] Audit WebView terminal creation to guarantee every xterm instance loads the serialize addon and registers with `OptimizedTerminalPersistenceManager`; add logging or guards to surface failures.
2. [x] Wire `restoreTerminalSerialization` and `restoreScrollback` message paths through the optimized persistence manager so serialized and fallback content target the correct terminal.
3. [x] Update the extension-side session restore flow to await positive acknowledgement (restored vs. fallback) and surface errors when no terminals replay content.
4. [x] Add automated coverage (preferred: webview manager unit tests + session manager integration test) proving scrollback content survives a simulated reload and fallback path.
5. [x] Run `npm run test:unit` and any new targeted tests to confirm regressions are avoided.

**Status**: ✅ **COMPLETED** - Fixed in v0.1.121 (Issue #201)
- Implemented ConsolidatedTerminalPersistenceService with comprehensive serialization support
- Added SerializationMessageHandler and ScrollbackMessageHandler
- Full test coverage in SessionPersistence.test.ts
- Verified scrollback restoration after window reload
