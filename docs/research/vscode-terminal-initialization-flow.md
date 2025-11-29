# VS Code Terminal Initialization and Session Restoration Flow

**Reference Repository**: microsoft/vscode
**Primary Sources**:
- `src/vs/workbench/contrib/terminal/browser/terminalView.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalService.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`
- `src/vs/base/common/async.ts`

---

## 1. Terminal Initialization Sequence

### 1.1 High-Level Flow

```
Window Load
    ↓
TerminalViewPane.renderBody()
    ↓
onDidChangeBodyVisibility(visible=true)
    ↓
_initializeTerminal(checkRestoredTerminals=false)
    ↓
[Check Connection State & Restored Groups]
    ↓
Create Terminal OR Restore Session
    ↓
Terminal Instance Ready
```

### 1.2 TerminalViewPane Initialization

**File**: `src/vs/workbench/contrib/terminal/browser/terminalView.ts`

**Lines 143-185**: The `_initializeTerminal()` method is the gatekeeper:

```typescript
private _initializeTerminal(checkRestoredTerminals: boolean) {
    // CRITICAL: Three conditions must ALL be true
    if (this.isBodyVisible() &&
        this._terminalService.isProcessSupportRegistered &&
        this._terminalService.connectionState === TerminalConnectionState.Connected) {

        const wasInitialized = this._isInitialized;
        this._isInitialized = true;

        // Check if terminals should be created
        let shouldCreate = this._terminalGroupService.groups.length === 0;

        // When triggered after reconnection, also check restored groups
        if (checkRestoredTerminals) {
            shouldCreate &&= this._terminalService.restoredGroupCount === 0;
        }

        if (!shouldCreate) {
            return; // Exit early if terminals exist
        }

        // Use flag to prevent duplicate creation
        if (!this._isTerminalBeingCreated) {
            this._isTerminalBeingCreated = true;
            this._terminalService.createTerminal({ location: TerminalLocation.Panel })
                .finally(() => this._isTerminalBeingCreated = false);
        }
    }
}
```

**Key Prevention Mechanisms**:

1. **`_isInitialized` flag** (line 60, 145): Tracks first-time initialization
2. **`_isTerminalBeingCreated` flag** (line 65, 168, 180-182): Prevents concurrent creation
3. **Connection state check** (line 144): Only proceeds when `Connected`
4. **Group count check** (line 156): Prevents creation if terminals exist
5. **Restored group count check** (line 160): Accounts for session restoration

**Lines 214-232**: Event-driven initialization triggers:

```typescript
this._register(this.onDidChangeBodyVisibility(async visible => {
    this._viewShowing.set(visible);
    if (visible) {
        // Call with checkRestoredTerminals=false on visibility change
        this._initializeTerminal(false);
        this._terminalGroupService.showPanel(false);
    }
}));

// Connection state changes trigger with checkRestoredTerminals=true
this._register(this._terminalService.onDidChangeConnectionState(() =>
    this._initializeTerminal(true)
));
```

---

## 2. Session Restoration Flow

### 2.1 Backend Initialization Sequence

**File**: `src/vs/workbench/contrib/terminal/browser/terminalService.ts`

**Lines 279-336**: The `_initializePrimaryBackend()` method orchestrates restoration:

```typescript
private async _initializePrimaryBackend() {
    mark('code/terminal/willGetTerminalBackend');
    this._primaryBackend = await this._terminalInstanceService.getBackend(
        this._environmentService.remoteAuthority
    );
    mark('code/terminal/didGetTerminalBackend');

    const enableTerminalReconnection =
        this._terminalConfigurationService.config.enablePersistentSessions;

    // Initial state is Connecting
    this._connectionState = TerminalConnectionState.Connecting;

    const isPersistentRemote =
        !!this._environmentService.remoteAuthority && enableTerminalReconnection;

    // Choose restoration strategy
    let reconnectedPromise: Promise<unknown>;
    if (isPersistentRemote) {
        reconnectedPromise = this._reconnectToRemoteTerminals();
    } else if (enableTerminalReconnection) {
        reconnectedPromise = this._reconnectToLocalTerminals();
    } else {
        reconnectedPromise = Promise.resolve();
    }

    // CRITICAL: Connection state changes AFTER restoration completes
    reconnectedPromise.then(async () => {
        this._setConnected(); // Sets state to Connected
        // ... wait for replay completion
        this._whenConnected.complete(); // Resolve promise
    });
}
```

**Connection State Transition**:
```
Connecting → [Restore Sessions] → Connected → [Fire onDidChangeConnectionState]
```

### 2.2 Local Session Restoration

**Lines 466-486**:

```typescript
private async _reconnectToLocalTerminals(): Promise<void> {
    const localBackend = await this._terminalInstanceService.getBackend();
    if (!localBackend) {
        return;
    }

    mark('code/terminal/willGetTerminalLayoutInfo');
    const layoutInfo = await localBackend.getTerminalLayoutInfo();
    mark('code/terminal/didGetTerminalLayoutInfo');

    if (layoutInfo && (layoutInfo.tabs.length > 0 || layoutInfo?.background?.length)) {
        mark('code/terminal/willRecreateTerminalGroups');

        // Store promise to recreated groups (used by _initializeTerminal)
        this._reconnectedTerminalGroups = this._recreateTerminalGroups(layoutInfo);

        const revivedInstances = await this._reviveBackgroundTerminalInstances(
            layoutInfo.background || []
        );
        this._backgroundedTerminalInstances = revivedInstances.map(
            instance => ({ instance })
        );

        mark('code/terminal/didRecreateTerminalGroups');
    }

    this._attachProcessLayoutListeners();
    this._logService.trace('Reconnected to local terminals');
}
```

### 2.3 Group Recreation

**Lines 488-499**:

```typescript
private _recreateTerminalGroups(layoutInfo?: ITerminalsLayoutInfo): Promise<ITerminalGroup[]> {
    const groupPromises: Promise<ITerminalGroup | undefined>[] = [];
    let activeGroup: Promise<ITerminalGroup | undefined> | undefined;

    if (layoutInfo) {
        for (const tabLayout of layoutInfo.tabs) {
            const terminalLayouts = tabLayout.terminals.filter(
                t => t.terminal && t.terminal.isOrphan
            );

            if (terminalLayouts.length) {
                // INCREMENT RESTORED COUNT - prevents duplicate creation
                this._restoredGroupCount += terminalLayouts.length;

                const promise = this._recreateTerminalGroup(tabLayout, terminalLayouts);
                groupPromises.push(promise);

                if (tabLayout.isActive) {
                    activeGroup = promise;
                }
            }
        }
    }

    return Promise.all(groupPromises);
}
```

**`restoredGroupCount`** (line 93-95):
- Incremented during restoration (line 495)
- Used by `_initializeTerminal()` to prevent duplicate creation
- Checked via `checkRestoredTerminals` parameter

---

## 3. Terminal Instance Initialization

### 3.1 Two-Phase Initialization

**File**: `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`

**Lines 526-571**: Constructor sets up two barriers:

```typescript
constructor(...) {
    // ...

    // BARRIER 1: Container must be attached within 1000ms
    this._containerReadyBarrier = new AutoOpenBarrier(
        Constants.WaitForContainerThreshold
    );

    // BARRIER 2: Process must attach within 1000ms
    this._attachBarrier = new AutoOpenBarrier(1000);

    // Start xterm creation (async)
    this._xtermReadyPromise = this._createXterm();

    this._xtermReadyPromise.then(async () => {
        // Wait for container to be ready
        await this._containerReadyBarrier.wait();

        // Resolve executable and shell type
        // ...

        // Create the actual process
        await this._createProcess();

        // Re-establish title after reconnect
        if (this.shellLaunchConfig.attachPersistentProcess) {
            this._cwd = this.shellLaunchConfig.attachPersistentProcess.cwd;
            this._setTitle(
                this.shellLaunchConfig.attachPersistentProcess.title,
                this.shellLaunchConfig.attachPersistentProcess.titleSource
            );
            this.setShellType(this.shellType);
        }

        if (this._fixedCols) {
            await this._addScrollbar();
        }
    });
}
```

### 3.2 AutoOpenBarrier Pattern

**File**: `src/vs/base/common/async.ts`

```typescript
export class AutoOpenBarrier extends Barrier {
    private readonly _timeout: Timeout;

    constructor(autoOpenTimeMs: number) {
        super();
        // Automatically opens after timeout to prevent deadlocks
        this._timeout = setTimeout(() => this.open(), autoOpenTimeMs);
    }

    override open(): void {
        clearTimeout(this._timeout);
        super.open();
    }
}
```

**Purpose**: Ensures initialization proceeds even if expected events don't fire:
- `_containerReadyBarrier`: Opens after container is attached OR 1000ms timeout
- `_attachBarrier`: Opens after process attaches OR 1000ms timeout

### 3.3 focusWhenReady Pattern

**Lines 1321-1325**:

```typescript
async focusWhenReady(force?: boolean): Promise<void> {
    // Wait for xterm to be created
    await this._xtermReadyPromise;

    // Wait for process to attach
    await this._attachBarrier.wait();

    // Now safe to focus
    this.focus(force);
}
```

**Usage**: Extensions and UI components call this to ensure focus happens only after:
1. Xterm.js is fully initialized
2. Process is attached and ready

---

## 4. Handshake Sequence: Extension Host ↔ Main Process ↔ Webview

### 4.1 Extension-Contributed Terminals

**File**: `src/vs/workbench/contrib/terminal/browser/terminalService.ts` (referenced via DeepWiki)

```
1. Extension Host: createExtensionTerminal()
   ↓ IPC: $createTerminal
2. Main Thread: MainThreadTerminalService.$createTerminal()
   ↓ Create ITerminalInstance
3. Renderer: onDidCreateInstance event fires
   ↓ Terminal opened in UI
4. Main Thread → Extension Host: $acceptTerminalOpened(numericId)
   ↓ Update ExtHostTerminal._id
5. Main Thread → Extension Host: $startExtensionTerminal()
   ↓ ExtHostPseudoterminal.startSendingEvents()
6. Data flow begins: Extension ↔ Main ↔ Xterm
```

### 4.2 Ready State Handshake

```
Backend Registration
    ↓
[State: Connecting]
    ↓
Restore Sessions (if enabled)
    ↓
_setConnected()
    ↓
[State: Connected]
    ↓
Fire: onDidChangeConnectionState
    ↓
TerminalViewPane._initializeTerminal(true)
    ↓
Check: restoredGroupCount
    ↓
Create new terminal OR use restored
    ↓
Terminal instance ready
```

---

## 5. Preventing Duplicate Terminal Creation

### 5.1 Multi-Level Guards

VS Code uses **five** levels of guards to prevent duplicates:

#### Level 1: Connection State
```typescript
// terminalView.ts line 144
if (this._terminalService.connectionState === TerminalConnectionState.Connected) {
    // Only proceed when connected
}
```

#### Level 2: Process Support Registration
```typescript
// terminalView.ts line 144
if (this._terminalService.isProcessSupportRegistered) {
    // Pty host must be ready
}
```

#### Level 3: Initialization Flag
```typescript
// terminalView.ts line 60, 145
private _isInitialized: boolean = false;

const wasInitialized = this._isInitialized;
this._isInitialized = true;
```

#### Level 4: Creation Lock
```typescript
// terminalView.ts line 65, 180-182
private _isTerminalBeingCreated: boolean = false;

if (!this._isTerminalBeingCreated) {
    this._isTerminalBeingCreated = true;
    this._terminalService.createTerminal(...)
        .finally(() => this._isTerminalBeingCreated = false);
}
```

#### Level 5: Group Count + Restored Count
```typescript
// terminalView.ts line 156-161
let shouldCreate = this._terminalGroupService.groups.length === 0;

// When checking after reconnection
if (checkRestoredTerminals) {
    shouldCreate &&= this._terminalService.restoredGroupCount === 0;
}

if (!shouldCreate) {
    return; // Exit early
}
```

### 5.2 State Transitions

```
[Initial State]
isInitialized = false
isTerminalBeingCreated = false
connectionState = Connecting
restoredGroupCount = 0
groups.length = 0

↓ [Backend connects, starts restoration]

connectionState = Connected (after restoration completes)
restoredGroupCount = N (number of restored terminals)

↓ [Fire: onDidChangeConnectionState]

_initializeTerminal(checkRestoredTerminals=true)
  - isBodyVisible? ✓
  - isProcessSupportRegistered? ✓
  - connectionState === Connected? ✓
  - shouldCreate = (groups.length === 0) && (restoredGroupCount === 0)

IF shouldCreate = false:
  → Exit early, use restored terminals

IF shouldCreate = true:
  → isTerminalBeingCreated = true
  → createTerminal()
  → isTerminalBeingCreated = false
```

---

## 6. Shell Prompt Appearing Only Once

### 6.1 Process Creation Guards

**File**: `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`

**Lines 1535-1573**: `_createProcess()` is called exactly once per instance:

```typescript
private async _createProcess(): Promise<void> {
    if (this.isDisposed) {
        return; // Early exit if already disposed
    }

    // Workspace trust check
    const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(...);
    if (activeWorkspaceRootUri) {
        const trusted = await this._trust();
        if (!trusted) {
            this._onProcessExit({ message: ... });
            return; // Exit without creating process
        }
    }

    // Re-evaluate dimensions if container set after xterm creation
    if (this._container && this._cols === 0 && this._rows === 0) {
        this._initDimensions();
        this.xterm?.resize(...);
    }

    // CRITICAL: Single call to createProcess
    await this._processManager.createProcess(
        this._shellLaunchConfig,
        this._cols || Constants.DefaultCols,
        this._rows || Constants.DefaultRows
    ).then(result => {
        // Handle result (errors, injected args, etc.)
    });

    if (this.isDisposed) {
        return; // Exit if disposed during creation
    }

    // Update icon if changed
    if (originalIcon !== this.shellLaunchConfig.icon || ...) {
        this._onIconChanged.fire({ instance: this, userInitiated: false });
    }
}
```

**Called from**: Constructor's `_xtermReadyPromise.then()` block (line 554)
- Only called once per instance lifecycle
- Promise chain ensures sequential execution
- Barriers prevent premature execution

### 6.2 Session Restoration vs New Process

**For Restored Terminals**:

```typescript
// terminalInstance.ts lines 557-561
if (this.shellLaunchConfig.attachPersistentProcess) {
    // Attach to existing process (no new shell spawned)
    this._cwd = this.shellLaunchConfig.attachPersistentProcess.cwd;
    this._setTitle(
        this.shellLaunchConfig.attachPersistentProcess.title,
        this.shellLaunchConfig.attachPersistentProcess.titleSource
    );
    this.setShellType(this.shellType);
}
```

**For New Terminals**:
- `_processManager.createProcess()` spawns new shell process
- Shell displays prompt upon initialization
- Process lifecycle tied to terminal instance

### 6.3 Preventing Multiple Prompts

1. **Single process per instance**: `_createProcess()` called once
2. **No re-initialization**: Instance lifecycle is linear (create → use → dispose)
3. **Restoration doesn't spawn shell**: Attaches to existing persistent process
4. **Data replay**: Restored terminals replay scrollback without re-executing commands

---

## 7. Implementation Recommendations for Your Project

### 7.1 Adopt Connection State Pattern

```typescript
enum TerminalConnectionState {
    Connecting = 'Connecting',
    Connected = 'Connected'
}

class TerminalManager {
    private _connectionState: TerminalConnectionState = TerminalConnectionState.Connecting;
    private readonly _onDidChangeConnectionState = new EventEmitter<void>();

    async initialize() {
        // Restore sessions first
        await this.restoreSessions();

        // THEN set connected state
        this._connectionState = TerminalConnectionState.Connected;
        this._onDidChangeConnectionState.fire();
    }
}
```

### 7.2 Use Restored Count Guard

```typescript
class TerminalManager {
    private _restoredTerminalCount: number = 0;

    async restoreSessions() {
        const sessions = await this.getSavedSessions();
        for (const session of sessions) {
            await this.restoreTerminal(session);
            this._restoredTerminalCount++;
        }
    }

    shouldCreateDefaultTerminal(): boolean {
        return this.getTerminalCount() === 0 &&
               this._restoredTerminalCount === 0;
    }
}
```

### 7.3 Implement Creation Lock

```typescript
class TerminalWebviewManager {
    private _isCreatingTerminal: boolean = false;

    async createTerminal(id: number): Promise<void> {
        if (this._isCreatingTerminal) {
            console.warn('Terminal creation already in progress');
            return;
        }

        try {
            this._isCreatingTerminal = true;
            await this.doCreateTerminal(id);
        } finally {
            this._isCreatingTerminal = false;
        }
    }
}
```

### 7.4 Use Ready Barriers

```typescript
class Terminal {
    private readonly _xtermReadyPromise: Promise<XTermTerminal>;
    private readonly _processReadyPromise: Promise<void>;

    async focusWhenReady(): Promise<void> {
        await this._xtermReadyPromise;
        await this._processReadyPromise;
        this.focus();
    }

    async sendTextWhenReady(text: string): Promise<void> {
        await this._xtermReadyPromise;
        await this._processReadyPromise;
        this.sendText(text);
    }
}
```

### 7.5 WebView Initialization Sequence

```typescript
// Extension side
async initializeWebView() {
    // 1. Create webview
    const webview = createWebView();

    // 2. Set HTML content
    webview.html = generateHtml();

    // 3. Wait for webview ready message
    await new Promise<void>(resolve => {
        const disposable = webview.onDidReceiveMessage(msg => {
            if (msg.type === 'webview-ready') {
                disposable.dispose();
                resolve();
            }
        });
    });

    // 4. Check for restored sessions
    const sessions = await getSavedSessions();
    if (sessions.length > 0) {
        // Send restore message
        webview.postMessage({
            type: 'restore-sessions',
            sessions: sessions
        });
    } else {
        // Send create default terminal message
        webview.postMessage({
            type: 'create-default-terminal'
        });
    }
}

// Webview side
window.addEventListener('DOMContentLoaded', () => {
    // Signal ready
    vscode.postMessage({ type: 'webview-ready' });

    // Wait for initialization message
    window.addEventListener('message', event => {
        const msg = event.data;

        if (msg.type === 'restore-sessions') {
            restoreSessions(msg.sessions);
        } else if (msg.type === 'create-default-terminal') {
            createDefaultTerminal();
        }
    });
});
```

---

## 8. Key Takeaways

1. **Connection State is Critical**: Never create terminals before `ConnectionState.Connected`
2. **Restoration Comes First**: Backend restoration completes BEFORE connection state changes
3. **Multiple Guard Layers**: Use flags, counts, and state checks to prevent duplicates
4. **Barrier Pattern**: AutoOpenBarrier prevents deadlocks while ensuring readiness
5. **Async Handshakes**: Proper sequencing of ready messages prevents race conditions
6. **Single Process Lifecycle**: Each terminal instance creates its process exactly once
7. **Session vs Process**: Restoration attaches to existing processes, doesn't spawn new shells

---

## 9. File References Summary

| File | Key Lines | Purpose |
|------|-----------|---------|
| `terminalView.ts` | 143-185 | `_initializeTerminal()` - main creation guard |
| `terminalView.ts` | 60, 65 | Initialization and creation flags |
| `terminalView.ts` | 214-232 | Event-driven initialization triggers |
| `terminalService.ts` | 279-336 | `_initializePrimaryBackend()` - restoration orchestration |
| `terminalService.ts` | 466-486 | `_reconnectToLocalTerminals()` - local restoration |
| `terminalService.ts` | 488-499 | `_recreateTerminalGroups()` - group recreation |
| `terminalService.ts` | 93-95 | `restoredGroupCount` property |
| `terminalInstance.ts` | 526-571 | Constructor - barrier setup |
| `terminalInstance.ts` | 1321-1325 | `focusWhenReady()` - readiness pattern |
| `terminalInstance.ts` | 1535-1573 | `_createProcess()` - single process creation |
| `async.ts` | AutoOpenBarrier | Timeout-based barrier implementation |

---

**Generated**: 2025-11-06
**VS Code Version**: Latest main branch (commit f4e72e4 - Nov 5, 2025)
