# VS Code標準ターミナル実装ガイド

**作成日**: 2025-01-08
**リポジトリ**: microsoft/vscode
**調査対象**: src/vs/workbench/contrib/terminal/

## 📋 調査概要

VS Codeの標準ターミナル実装から、以下の4つの重要な領域を調査し、現在の実装との差異を分析しました。

1. ターミナル初期化フロー
2. セッション復元メカニズム
3. 出力処理とバッファリング戦略
4. シェル統合とプロンプト検出

---

## 1️⃣ ターミナル初期化フロー

### VS Code実装パターン

#### 初期化の段階的アプローチ

VS Codeは3段階の初期化プロセスを採用しています:

```typescript
// ソース: src/vs/workbench/contrib/terminal/browser/terminalInstance.ts (lines 220-250)

constructor() {
    // Stage 1: xterm.js準備（非同期Promise）
    this._xtermReadyPromise = this._createXterm();

    // Stage 2: コンテナ待機（100ms timeout）
    this._containerReadyBarrier = new AutoOpenBarrier(Constants.WaitForContainerThreshold);

    // Stage 3: プロセス作成
    this._xtermReadyPromise.then(async () => {
        await this._containerReadyBarrier.wait(); // コンテナが準備できるまで待機

        // シェル統合有効時: 実行可能ファイルを事前に解決
        if (this._terminalConfigurationService.config.shellIntegration?.enabled) {
            const defaultProfile = await this._terminalProfileResolverService.getDefaultProfile();
            this.shellLaunchConfig.executable = defaultProfile.path;
            this.shellLaunchConfig.args = defaultProfile.args;
        }

        await this._createProcess(); // プロセス作成
    });
}
```

#### プロンプト表示の確実性保証

VS Codeは**AutoOpenBarrier**パターンでプロンプト表示を保証:

```typescript
// 定数定義
const enum Constants {
    /**
     * コンテナ準備を待つ最大時間
     * この期間により、フォアグラウンドターミナルが適切な初期サイズを持つことを保証
     */
    WaitForContainerThreshold = 100, // 100ms
    DefaultCols = 80,
    DefaultRows = 30,
}

// 使用例
this._containerReadyBarrier = new AutoOpenBarrier(100);
await this._containerReadyBarrier.wait();
```

**ポイント**:
- DOM要素が完全に準備できるまで**100ms待機**
- この待機により、xtermが正しいサイズで初期化される
- サイズが正しくないと、プロンプトが正しく表示されないことがある

#### PTYプロセスとの通信パターン

```typescript
// ソース: src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts (lines 120-180)

async createProcess(
    shellLaunchConfig: IShellLaunchConfig,
    cols: number,
    rows: number,
    reset: boolean = true
): Promise<ITerminalLaunchError | ITerminalLaunchResult | undefined> {

    // プロセス状態を"Launching"に設定
    this._setProcessState(ProcessState.Launching);

    // プロセスリスナー設定
    this._processListeners = [
        newProcess.onProcessReady((e: IProcessReadyEvent) => {
            this.shellProcessId = e.pid;
            this._initialCwd = e.cwd;
            this.processReadyTimestamp = Date.now();
            this._onProcessReady.fire(e);

            // キューイングされたデータを送信
            if (this._preLaunchInputQueue.length > 0) {
                newProcess.input(this._preLaunchInputQueue.join(''));
                this._preLaunchInputQueue.length = 0;
            }
        }),
        newProcess.onProcessExit(exitCode => this._onExit(exitCode)),
        // ... その他のリスナー
    ];

    // プロセス起動
    const result = await newProcess.start();

    // タイムアウト後に"Running"状態に遷移
    setTimeout(() => {
        if (this.processState === ProcessState.Launching) {
            this._setProcessState(ProcessState.Running);
        }
    }, ProcessConstants.ErrorLaunchThresholdDuration); // 500ms

    return result;
}
```

**キーポイント**:
1. **プロセス状態管理**: `Uninitialized` → `Launching` → `Running`
2. **プレローンチキュー**: プロセス準備前のインプットをキューイング
3. **500msタイムアウト**: 起動時エラー検出のための閾値
4. **イベント駆動**: `onProcessReady`で初期化完了を通知

---

### 現在の実装との差異

#### 問題点

```typescript
// 現在の実装 (src/terminals/TerminalManager.ts)
public createTerminal(): string {
    const { ptyProcess } = this._terminalSpawner.spawnTerminal({...});

    // 問題: xterm準備やDOM準備を待たずに即座にプロセス作成
    this._setupTerminalEvents(terminal);

    // Shell integration initialization (タイミング問題)
    this._initializeShellForTerminal(terminalId);
}
```

#### VS Code方式への改善案

```typescript
public async createTerminalWithProfile(profileName?: string): Promise<string> {
    // ✅ Stage 1: xterm準備完了を待機
    await this._ensureXtermReady();

    // ✅ Stage 2: DOM/WebView準備完了を待機（100ms barrier）
    await this._containerReadyBarrier.wait();

    // ✅ Stage 3: プロセス作成
    const { ptyProcess } = this._terminalSpawner.spawnTerminal({...});

    // ✅ Stage 4: プロセス準備完了を待機
    await this._waitForProcessReady(ptyProcess);

    // ✅ Stage 5: シェル初期化（プロンプト表示後に実行）
    await this._initializeShellForTerminal(terminalId);
}
```

---

## 2️⃣ セッション復元

### VS Code実装パターン

#### セッション復元時の挙動

VS Codeは**スクロールバックを完全に復元**します:

```typescript
// ソース: src/vs/platform/terminal/node/ptyService.ts (lines 220-280)

private async _reviveTerminalProcess(workspaceId: string, terminal: ISerializedTerminalState): Promise<void> {
    const restoreMessage = localize('terminal-history-restored', "History restored");

    // Windows Conpty対応: 新しいビューポートを確保
    let postRestoreMessage = '';
    if (isWindows) {
        const lastReplayEvent = terminal.replayEvent.events.at(-1);
        if (lastReplayEvent) {
            // カーソルを画面下部に移動し、トップに戻す
            postRestoreMessage += '\r\n'.repeat(lastReplayEvent.rows - 1) + `\x1b[H`;
        }
    }

    // プロセス作成時にinitialTextとしてスクロールバックを注入
    const newId = await this.createProcess({
        ...terminal.shellLaunchConfig,
        cwd: terminal.processDetails.cwd,
        name: terminal.processDetails.title,
        initialText: terminal.replayEvent.events[0].data +
                    formatMessageForTerminal(restoreMessage, { loudFormatting: true }) +
                    postRestoreMessage
    }, ...);
}
```

#### セリアライゼーション戦略

```typescript
// ソース: src/vs/platform/terminal/node/ptyService.ts (lines 180-220)

async serializeTerminalState(ids: number[]): Promise<string> {
    const promises: Promise<ISerializedTerminalState>[] = [];

    for (const [persistentProcessId, persistentProcess] of this._ptys.entries()) {
        // 重要: データが書き込まれたプロセスのみシリアライズ
        if (persistentProcess.hasWrittenData && ids.indexOf(persistentProcessId) !== -1) {
            promises.push(Promises.withAsyncBody<ISerializedTerminalState>(async r => {
                r({
                    id: persistentProcessId,
                    shellLaunchConfig: persistentProcess.shellLaunchConfig,
                    processDetails: await this._buildProcessDetails(persistentProcessId, persistentProcess),
                    processLaunchConfig: persistentProcess.processLaunchOptions,
                    unicodeVersion: persistentProcess.unicodeVersion,
                    replayEvent: await persistentProcess.serializeNormalBuffer(), // xterm serialize addon使用
                    timestamp: Date.now()
                });
            }));
        }
    }

    const serialized: ICrossVersionSerializedTerminalState = {
        version: 1,
        state: await Promise.all(promises)
    };
    return JSON.stringify(serialized);
}
```

#### プロンプト重複回避メカニズム

VS Codeは**initialText**パラメータを使用してプロンプト重複を回避:

```typescript
// 復元時のフロー:
// 1. スクロールバックを"initialText"として渡す
// 2. プロセスは起動するが、シェル初期化前にinitialTextが表示される
// 3. シェルのプロンプトは通常通り表示される
// 4. 結果: スクロールバック + 新しいプロンプト（重複なし）

await this.createProcess({
    initialText: terminal.replayEvent.events[0].data + restoreMessage,
    // ... その他の設定
});
```

#### 復元完了の判定タイミング

```typescript
// ソース: src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts (lines 80-90)

// onProcessReplayComplete イベントで復元完了を通知
if (newProcess.onProcessReplayComplete) {
    this._processListeners.push(
        newProcess.onProcessReplayComplete(() => this._onProcessReplayComplete.fire())
    );
}

// 使用例:
this._register(processManager.onProcessReplayComplete(() => {
    // 復元完了後の処理
    this._onProcessReplayComplete.fire();
}));
```

---

### 現在の実装との差異

#### 問題点

```typescript
// 現在の実装 (src/sessions/StandardTerminalSessionManager.ts)
public async restoreSession(): Promise<void> {
    const sessionData = await this.loadSessionData();

    for (const terminalData of sessionData.terminals) {
        // 問題1: ターミナル作成とスクロールバック復元が分離
        const terminal = await this.terminalManager.createTerminal();

        // 問題2: 復元後にスクロールバックを送信（プロンプト重複の原因）
        await this.restoreScrollback(terminal.id, terminalData.scrollback);
    }
}
```

**問題点**:
- スクロールバックを復元**後**に送信するため、新しいプロンプトが表示された後になる
- シェル初期化とスクロールバック復元のタイミングが適切でない

#### VS Code方式への改善案

```typescript
public async restoreSession(): Promise<void> {
    const sessionData = await this.loadSessionData();

    for (const terminalData of sessionData.terminals) {
        // ✅ ターミナル作成時にinitialTextとしてスクロールバックを渡す
        const terminal = await this.terminalManager.createTerminalWithInitialText({
            initialText: terminalData.scrollback.join('\r\n') +
                        '\r\n\x1b[1;32m[Session Restored]\x1b[0m\r\n',
            cwd: terminalData.cwd,
            // ... その他の設定
        });

        // ✅ 復元完了を待機
        await this._waitForReplayComplete(terminal.id);
    }
}

// TerminalSpawnerに初期テキスト機能を追加
export class TerminalSpawner {
    public spawnTerminal(options: {
        initialText?: string; // 新しいパラメータ
        // ... その他
    }): { ptyProcess: IPty } {
        const ptyProcess = pty.spawn(shell, shellArgs, {
            // ... 通常の設定
        });

        // 初期テキストがある場合、プロセス準備後に即座に送信
        if (options.initialText) {
            ptyProcess.onData(() => {
                ptyProcess.write(options.initialText);
            });
        }

        return { ptyProcess };
    }
}
```

---

## 3️⃣ 出力処理とバッファリング戦略

### VS Code実装パターン

#### PTYからの出力処理

```typescript
// ソース: src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts (lines 150-180)

// SeamlessRelaunchDataFilter: データフィルタリングレイヤー
this._dataFilter = this._register(
    this._instantiationService.createInstance(SeamlessRelaunchDataFilter)
);

this._register(this._dataFilter.onProcessData(ev => {
    const data = (typeof ev === 'string' ? ev : ev.data);

    // BeforeProcessDataイベント: データ前処理フック
    const beforeProcessDataEvent: IBeforeProcessDataEvent = { data };
    this._onBeforeProcessData.fire(beforeProcessDataEvent);

    // 前処理後のデータを送信
    if (beforeProcessDataEvent.data && beforeProcessDataEvent.data.length > 0) {
        this._onProcessData.fire({
            data: beforeProcessDataEvent.data,
            trackCommit: false
        });
    }
}));
```

#### AckDataBufferer: フロー制御

```typescript
// ソース: src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts (lines 60-70)

// データ確認応答バッファ
this._ackDataBufferer = new AckDataBufferer(
    e => this._process?.acknowledgeDataEvent(e)
);

// 使用例:
// PTYがデータを送信 → xtermが処理 → acknowledgeDataEvent呼び出し
// これによりPTYはxtermの処理速度に合わせて送信速度を調整できる
```

#### バッファリング最適化

```typescript
// ターミナルデータバッファリングの定数
export const enum FlowControlConstants {
    /**
     * xtermがバッファリングできる最大バイト数
     */
    HighWatermark = 131072, // 128KB

    /**
     * ackを送信する閾値
     */
    LowWatermark = 65536,  // 64KB

    /**
     * ack送信の最小間隔
     */
    MinAckInterval = 1000, // 1秒
}
```

**VS Codeのバッファリング戦略**:
1. **128KB**までデータをバッファリング
2. バッファが**64KB**以下になったらPTYに確認応答
3. 最小**1秒間隔**で確認応答を送信
4. これによりPTYは過度なデータ送信を避けられる

---

### 現在の実装との差異

#### 問題点

```typescript
// 現在の実装 (src/terminals/TerminalManager.ts lines 66-70)
private readonly DATA_FLUSH_INTERVAL = 8; // ~125fps
private readonly MAX_BUFFER_SIZE = 50;

// 問題: 固定間隔・固定サイズのバッファリング
// VS Codeのような適応的バッファリングがない
```

#### VS Code方式への改善案

```typescript
// ✅ フロー制御定数を追加
private readonly enum FlowControlConstants {
    HighWatermark = 131072,  // 128KB
    LowWatermark = 65536,    // 64KB
    MinAckInterval = 1000,   // 1秒
}

// ✅ AckDataBufferer実装
private _ackDataBufferer?: AckDataBufferer;

// ✅ データフィルタリングレイヤー追加
private _setupDataFilter(terminal: TerminalInstance): void {
    const dataFilter = new DataFilter();

    dataFilter.onProcessData((ev) => {
        // 前処理フック
        const beforeEvent = { data: ev.data };
        this._onBeforeProcessData.fire(beforeEvent);

        // xtermに送信
        if (beforeEvent.data) {
            this._sendToWebView(terminal.id, beforeEvent.data);
        }

        // フロー制御: バッファサイズ監視
        if (this._shouldAcknowledgeData(terminal)) {
            terminal.ptyProcess.acknowledgeDataEvent(ev.trackCommit);
        }
    });
}

private _shouldAcknowledgeData(terminal: TerminalInstance): boolean {
    const bufferSize = this._getBufferSize(terminal);
    return bufferSize <= FlowControlConstants.LowWatermark;
}
```

---

## 4️⃣ シェル統合とプロンプト検出

### VS Code実装パターン

#### シェル統合の有効化判定

```typescript
// ソース: src/vs/workbench/contrib/terminal/browser/terminalInstance.ts (lines 130-140)

const shellIntegrationSupportedShellTypes: (PosixShellType | GeneralShellType | WindowsShellType)[] = [
    PosixShellType.Bash,
    PosixShellType.Zsh,
    GeneralShellType.PowerShell,
    GeneralShellType.Python,
];

// シェル統合有効判定
if (this._terminalConfigurationService.config.shellIntegration?.enabled &&
    shellIntegrationSupportedShellTypes.includes(this.shellType)) {
    // シェル統合を有効化
}
```

#### シェル統合初期化

```typescript
// ソース: src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts (lines 280-320)

const options: ITerminalProcessOptions = {
    shellIntegration: {
        enabled: this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled),
        suggestEnabled: this._terminalConfigurationService.config.suggestEnabled,
        nonce: this.shellIntegrationNonce // セキュリティ用nonce
    },
    // ... その他のオプション
};

// プロセス作成時にシェル統合設定を渡す
const newProcess = await backend.createProcess(
    shellLaunchConfig,
    cwd,
    cols,
    rows,
    unicodeVersion,
    env,
    options,  // ← シェル統合設定を含む
    shouldPersist
);
```

#### プロンプト検出ロジック

VS Codeは**Capability System**を使用してプロンプトを検出:

```typescript
// ソース: src/vs/workbench/contrib/terminal/browser/terminalInstance.ts (lines 460-490)

this._register(this.capabilities.onDidAddCapability(e => {
    switch (e.id) {
        case TerminalCapability.CwdDetection: {
            // カレントディレクトリ検出
            capabilityListeners.set(e.id, e.capability.onDidChangeCwd(cwd => {
                this._cwd = cwd;
                this._setTitle(this.title, TitleEventSource.Config);
            }));
            break;
        }
        case TerminalCapability.CommandDetection: {
            // コマンド検出とプロンプト状態管理
            e.capability.promptInputModel.setShellType(this.shellType);

            capabilityListeners.set(e.id, Event.any(
                e.capability.promptInputModel.onDidStartInput,
                e.capability.promptInputModel.onDidChangeInput,
                e.capability.promptInputModel.onDidFinishInput
            )(refreshInfo));

            // コマンド実行イベント
            this._register(e.capability.onCommandExecuted(async (command) => {
                if (!command.id && command.command) {
                    const commandId = generateUuid();
                    this.xterm?.shellIntegration.setNextCommandId(command.command, commandId);
                    await this._processManager.setNextCommandId(command.command, commandId);
                }
            }));
            break;
        }
        // ... その他のCapability
    }
}));
```

#### Safe Modeの実装

```typescript
// VS Codeにはexplicitな"safe mode"概念はないが、
// シェル統合失敗時のフォールバック機構がある

// ソース: terminal.ts (ProcessPropertyType)
export const enum ProcessPropertyType {
    // ...
    FailedShellIntegrationActivation = 'failedShellIntegrationActivation',
    // ...
}

// シェル統合失敗時の処理
newProcess.onDidChangeProperty(({ type, value }) => {
    switch (type) {
        case ProcessPropertyType.FailedShellIntegrationActivation:
            // テレメトリ送信
            this._telemetryService?.publicLog2('terminal/shellIntegrationActivationFailure');
            // フォールバック: 通常のターミナル動作に戻る
            break;
    }
});
```

---

### 現在の実装との差異

#### 問題点

```typescript
// 現在の実装 (src/services/ShellIntegrationService.ts)
public async initializeShellForTerminal(terminalId: string): Promise<void> {
    // 問題: シェル統合を常に実行しようとする
    // VS CodeのようなCapability Systemがない
}
```

#### VS Code方式への改善案

```typescript
// ✅ Capability Systemの実装
export class TerminalCapabilityStore {
    private _capabilities = new Map<TerminalCapability, ICapability>();

    public add(capability: TerminalCapability, impl: ICapability): void {
        this._capabilities.set(capability, impl);
        this._onDidAddCapability.fire({ id: capability, capability: impl });
    }

    public has(capability: TerminalCapability): boolean {
        return this._capabilities.has(capability);
    }
}

// ✅ シェル統合をCapabilityとして実装
export class ShellIntegrationCapability implements ICapability {
    private _initialized = false;

    async initialize(terminal: TerminalInstance): Promise<void> {
        if (this._initialized) {
            return; // 重複初期化防止
        }

        const shellType = await this._detectShellType(terminal);
        if (!this._isSupportedShell(shellType)) {
            // サポート外のシェル: フォールバック
            return;
        }

        try {
            await this._injectShellIntegration(terminal, shellType);
            this._initialized = true;
        } catch (error) {
            // 失敗時: safe mode（通常動作）にフォールバック
            console.warn('Shell integration failed, falling back to normal mode:', error);
        }
    }

    private _isSupportedShell(shellType: string): boolean {
        return ['bash', 'zsh', 'pwsh', 'powershell'].includes(shellType);
    }
}

// ✅ TerminalManagerでCapability Systemを使用
export class TerminalManager {
    private _capabilities = new TerminalCapabilityStore();

    async createTerminal(): Promise<string> {
        const terminal = await this._spawnTerminal();

        // Capabilityベースのシェル統合
        if (this._shouldEnableShellIntegration(terminal)) {
            const shellIntegration = new ShellIntegrationCapability();
            this._capabilities.add(TerminalCapability.ShellIntegration, shellIntegration);

            // 非同期初期化（ターミナル作成をブロックしない）
            shellIntegration.initialize(terminal).catch(err => {
                console.warn('Shell integration init failed:', err);
            });
        }

        return terminal.id;
    }
}
```

---

## 📊 実装比較まとめ

| 機能領域 | VS Code実装 | 現在の実装 | 推奨改善 |
|---------|------------|----------|---------|
| **初期化フロー** | 3段階（xterm準備 → コンテナ待機100ms → プロセス作成） | 即座にプロセス作成 | ✅ AutoOpenBarrier追加 |
| **プロンプト表示** | コンテナ準備完了を保証してからプロセス起動 | タイミング問題あり | ✅ containerReadyBarrier実装 |
| **セッション復元** | initialTextでスクロールバック注入 | 復元後にスクロールバック送信 | ✅ initialTextパラメータ追加 |
| **プロンプト重複** | initialText使用で回避 | 復元時に重複発生 | ✅ 復元フロー改善 |
| **出力バッファリング** | 128KB/64KB適応的制御 | 固定8ms/50行 | ✅ FlowControl実装 |
| **シェル統合** | Capability Systemで管理 | 直接実行 | ✅ Capability導入 |
| **プロンプト検出** | CommandDetection Capability | 独自実装 | ✅ Capability統合 |

---

## 🎯 優先度付き実装推奨事項

### Priority 1: 即座に実装すべき改善

1. **AutoOpenBarrier実装**
   - ファイル: `src/terminals/TerminalManager.ts`
   - 実装: 100ms containerReadyBarrier
   - 効果: プロンプト重複問題の根本解決

2. **initialTextパラメータ追加**
   - ファイル: `src/terminals/TerminalSpawner.ts`
   - 実装: セッション復元時のinitialText注入
   - 効果: セッション復元時のプロンプト重複解消

### Priority 2: パフォーマンス改善

3. **FlowControl実装**
   - ファイル: `src/terminals/TerminalManager.ts`
   - 実装: AckDataBuffererとバッファサイズ監視
   - 効果: 高負荷時の安定性向上

4. **データフィルタリングレイヤー**
   - ファイル: 新規 `src/terminals/DataFilter.ts`
   - 実装: BeforeProcessDataイベント
   - 効果: 出力前処理の柔軟性向上

### Priority 3: アーキテクチャ改善

5. **Capability System導入**
   - ファイル: 新規 `src/terminals/CapabilityStore.ts`
   - 実装: ShellIntegration, CwdDetection Capability
   - 効果: 機能拡張性とメンテナンス性向上

---

## 📝 実装コード例

### AutoOpenBarrier実装例

```typescript
// src/utils/AutoOpenBarrier.ts
export class AutoOpenBarrier {
    private _isOpen = false;
    private _promise: Promise<void>;
    private _resolve!: () => void;

    constructor(private _timeout: number) {
        this._promise = new Promise<void>((resolve) => {
            this._resolve = resolve;
        });

        // タイムアウト後に自動オープン
        setTimeout(() => {
            if (!this._isOpen) {
                this.open();
            }
        }, this._timeout);
    }

    public wait(): Promise<void> {
        return this._promise;
    }

    public open(): void {
        if (!this._isOpen) {
            this._isOpen = true;
            this._resolve();
        }
    }

    public isOpen(): boolean {
        return this._isOpen;
    }
}

// src/terminals/TerminalManager.ts での使用例
export class TerminalManager {
    private _containerReadyBarrier = new AutoOpenBarrier(100); // 100ms

    public async createTerminalWithProfile(profileName?: string): Promise<string> {
        // xterm準備完了待機
        await this._ensureXtermReady();

        // ✅ コンテナ準備完了待機（100ms timeout）
        await this._containerReadyBarrier.wait();

        // プロセス作成
        const terminal = await this._spawnTerminal();

        return terminal.id;
    }

    // WebViewが準備完了したら即座にバリアを開く
    public notifyWebViewReady(): void {
        this._containerReadyBarrier.open();
    }
}
```

### initialTextパラメータ実装例

```typescript
// src/terminals/TerminalSpawner.ts
export interface SpawnTerminalOptions {
    terminalId: string;
    shell: string;
    shellArgs: string[];
    cwd: string;
    env: { [key: string]: string };
    initialText?: string; // ✅ 新しいパラメータ
}

export class TerminalSpawner {
    public spawnTerminal(options: SpawnTerminalOptions): { ptyProcess: IPty } {
        const ptyProcess = pty.spawn(options.shell, options.shellArgs, {
            name: 'xterm-256color',
            cols: 80,
            rows: 30,
            cwd: options.cwd,
            env: options.env,
        });

        // ✅ initialTextがある場合、プロセス起動後すぐに送信
        if (options.initialText) {
            // プロセスが準備できたらinitialTextを送信
            let ready = false;
            const readyHandler = () => {
                if (!ready) {
                    ready = true;
                    ptyProcess.write(options.initialText);
                }
            };

            // 最初のデータ受信をプロセス準備完了の合図とする
            ptyProcess.onData(readyHandler);

            // タイムアウト保護（500ms以内に準備できない場合も送信）
            setTimeout(readyHandler, 500);
        }

        return { ptyProcess };
    }
}

// src/sessions/StandardTerminalSessionManager.ts での使用例
public async restoreSession(): Promise<void> {
    const sessionData = await this.loadSessionData();

    for (const terminalData of sessionData.terminals) {
        // ✅ スクロールバックをinitialTextとして渡す
        const terminal = await this.terminalManager.createTerminalWithOptions({
            profileName: terminalData.profileName,
            cwd: terminalData.cwd,
            initialText: this._formatRestoreText(terminalData.scrollback),
        });
    }
}

private _formatRestoreText(scrollback: string[]): string {
    const restoreMessage = '\x1b[1;32m[Session Restored]\x1b[0m';
    return scrollback.join('\r\n') + '\r\n' + restoreMessage + '\r\n';
}
```

---

## 🔗 参考リソース

- **VS Code Repository**: https://github.com/microsoft/vscode
- **ターミナル実装**: `src/vs/workbench/contrib/terminal/`
- **PTYサービス**: `src/vs/platform/terminal/node/ptyService.ts`
- **プロセス管理**: `src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts`
- **ターミナルインスタンス**: `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`

---

## 📅 実装ロードマップ

### Week 1: 基盤改善
- [ ] AutoOpenBarrier実装
- [ ] initialTextパラメータ追加
- [ ] セッション復元フロー改善

### Week 2: パフォーマンス
- [ ] FlowControl実装
- [ ] DataFilter追加
- [ ] バッファリング最適化

### Week 3: アーキテクチャ
- [ ] Capability System導入
- [ ] ShellIntegration Capability実装
- [ ] 既存コードリファクタリング

### Week 4: テストと検証
- [ ] 単体テスト作成
- [ ] 統合テスト実施
- [ ] パフォーマンステスト
- [ ] 実環境検証

---

**このガイドはVS Codeの実装パターンを忠実に分析し、現在の実装への具体的な改善提案を提供しています。**
