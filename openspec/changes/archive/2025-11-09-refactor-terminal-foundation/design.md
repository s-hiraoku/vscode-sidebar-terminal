## Terminal Refactor Design Notes

### v0 – Discovery Snapshots (2025-10-30)

#### Extension ↔ WebView Messaging Inventory

**Inbound (WebView → Extension) via `SecondaryTerminalProvider` router**
- `webviewReady` / `ready` (alias) – signal WebView initialization
- `getSettings` – request terminal settings
- `focusTerminal` – set active terminal in registry/state service
- `splitTerminal` – request split operation with optional direction
- `createTerminal` – request new PTY-backed terminal
- `input` – forward user keystrokes to terminal process
- `resize` – report xterm dimensions for PTY resize
- `killTerminal` – kill active or provided terminal
- `deleteTerminal` – explicit delete request from UI
- `updateSettings` – persist settings changes
- `reportPanelLocation` – inform extension of detected panel dock
- `terminalClosed` – notify extension terminal instance closed in UI
- `openTerminalLink` – request to open detected hyperlink/file
- `reorderTerminals` – reorder terminal list per UI drag-drop
- `requestInitialTerminal` – ask extension to create first terminal
- `terminalInitializationComplete` – WebView side finished xterm bootstrap for given terminal
- `persistenceSaveSession` / `persistenceRestoreSession` / `persistenceClearSession` – persistence orchestration
- `terminalSerializationRequest` / `terminalSerializationRestoreRequest` – legacy serialization bridge
- `scrollbackDataCollected` – send serialized scrollback back to extension
- `htmlScriptTest`, `timeoutTest`, `test` – debug hooks (non-production)

**Outbound (Extension → WebView) primarily via `TerminalEventCoordinator` and provider services**
- `output` – terminal data chunk
- `exit` – PTY exit event
- `terminalCreated` – notify UI of new terminal metadata
- `terminalRemoved` – notify removal
- `stateUpdate` – broadcast full terminal state snapshot
- `focusTerminal` – sync active terminal focus
- `settingsResponse` / `fontSettingsUpdate` – respond with configuration
- `panelLocationUpdate` / `requestPanelLocationDetection` – panel orchestration
- `initializationComplete` – provider initialization handshake
- `cliAgentStatusUpdate` / `cliAgentFullStateSync` / `switchAiAgentResponse` – agent integration
- `deleteTerminalResponse` – confirm deletion result
- `saveAllTerminalSessions` / `sessionRestorationData` – persistence coordination
- `versionInfo`, `phase8ServicesReady` – service wiring diagnostics

**TerminalManager Event Hub (`TerminalEventHub`)**
- Emits `onData`, `onExit`, `onTerminalCreated`, `onTerminalRemoved`, `onStateUpdate`, `onTerminalFocus` consumed by provider coordinator.

#### High-Level Ownership Map
- `TerminalManager` – monolithic orchestrator (creation, lifecycle, input, scrollback, CLI agent, shell integration, state updates)
- `SecondaryTerminalProvider` – VS Code WebView provider managing message router, initialization workflows, persistence hooks
- `TerminalMessageHandlers` & `UnifiedMessageDispatcher` – alternate messaging pipeline (likely for consolidated mode)
- `ConsolidatedMessageService` – additional message abstraction used by webview managers
- Buffer/state services (`BufferManagementService`, `TerminalStateService`) – DI-managed but partially utilized

*Next Step*: capture baseline build/test metrics (Task 1.2) and highlight high-risk modules/tests (Task 1.3).
