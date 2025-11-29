# Fix Scrollback Functionality

## Why

Terminal scrollback (session history) is not being restored when VS Code restarts or the extension reloads. Users lose their terminal history which includes important command outputs, error messages, and working context.

## What Changes

1. **Add missing message handler** - The `restoreTerminalSessions` command sent by ExtensionPersistenceService has no handler in WebView
2. **Fix SerializeAddon usage** - `LightweightTerminalWebviewManager.extractScrollbackData()` doesn't use SerializeAddon, losing ANSI color codes
3. **Consolidate extraction code paths** - Multiple inconsistent implementations of scrollback extraction exist

## Impact

- Affected specs: `session-persistence`
- Affected code:
  - `src/webview/managers/ConsolidatedMessageManager.ts` - Add command registration
  - `src/webview/coordinators/WebviewCoordinator.ts` - Add command registration
  - `src/webview/managers/LightweightTerminalWebviewManager.ts` - Fix extractScrollbackData
  - `src/webview/managers/handlers/ScrollbackMessageHandler.ts` - Add restoration handler
