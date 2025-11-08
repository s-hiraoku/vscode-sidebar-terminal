# アーキテクチャ概要: コンポーネント間の関係性

このドキュメントでは、VS Code拡張機能の主要コンポーネント（Extension、WebView、PTY、xterm）の関係性とデータフローを説明します。

## 主要コンポーネント構成図

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VS Code Extension (Node.js)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  SecondaryTerminalProvider                                    │  │
│  │  (WebviewViewProvider実装)                                    │  │
│  │  - WebView HTMLの生成                                         │  │
│  │  - Extension ↔ WebView 通信ブリッジ                          │  │
│  └────────────┬────────────────────────────────────────┬─────────┘  │
│               │                                         │             │
│               ↓                                         ↓             │
│  ┌────────────────────────┐              ┌────────────────────────┐ │
│  │  TerminalManager       │              │  各種サービス          │ │
│  │  (シングルトン)        │              │  - PanelLocationSvc    │ │
│  │                        │              │  - PersistenceSvc      │ │
│  │  役割:                 │              │  - ShellIntegration    │ │
│  │  • PTYプロセス管理     │              │  - CliAgentDetection   │ │
│  │  • ターミナルID管理    │              └────────────────────────┘ │
│  │  • データバッファリング│                                          │
│  │  • イベント配信        │                                          │
│  └────────┬───────────────┘                                          │
│           │                                                           │
│           ↓                                                           │
│  ┌────────────────────────┐                                          │
│  │  TerminalSpawner       │                                          │
│  │                        │                                          │
│  │  役割:                 │                                          │
│  │  • PTYプロセス生成     │────→  ┌──────────────────────┐          │
│  └────────────────────────┘      │  node-pty (IPty)      │          │
│                                   │                       │          │
│                                   │  シェルプロセス       │          │
│                                   │  /bin/bash, zsh等     │          │
│                                   │  pid, write(), kill() │          │
│                                   └──────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                              ↕
                    postMessage / onDidReceiveMessage
                    (WebviewMessage プロトコル)
                              ↕
┌─────────────────────────────────────────────────────────────────────┐
│                      WebView (ブラウザ環境)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  TerminalWebviewManager (IManagerCoordinator)                 │  │
│  │  - 全マネージャーの統括                                       │  │
│  │  - Extension通信の中央ハブ                                    │  │
│  └─────┬────────────────────────────────────────────────────────┘  │
│        │                                                             │
│        ├─→  MessageManager       (Extension通信)                    │
│        ├─→  UIManager            (テーマ・UI制御)                   │
│        ├─→  InputManager         (IME・Alt+Click)                   │
│        ├─→  PerformanceManager   (バッファリング)                   │
│        ├─→  NotificationManager  (通知)                             │
│        └─→  TerminalLifecycleManager  (ターミナル生成・削除)        │
│                     │                                                │
│                     ↓                                                │
│            ┌─────────────────┐                                      │
│            │  xterm.js        │                                      │
│            │  (Terminal)      │                                      │
│            │                  │                                      │
│            │  ブラウザベース  │                                      │
│            │  ターミナルUI    │                                      │
│            │  • レンダリング  │                                      │
│            │  • ユーザー入力  │                                      │
│            │  • アドオン      │                                      │
│            │    - FitAddon    │                                      │
│            │    - WebLinks    │                                      │
│            └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 主要コンポーネント詳細

### 1. SecondaryTerminalProvider (Extension側)

**ファイル**: `src/providers/SecondaryTerminalProvider.ts`

**役割**: VS Code WebviewViewProvider の実装クラス

**責務**:
- WebView HTMLの生成とセキュリティ設定（CSP）
- Extension ↔ WebView 間の双方向通信ブリッジ
- VS Code設定の監視と同期
- WebViewコンテキストの保持（`retainContextWhenHidden: true`）

**主要な依存関係**:
- `TerminalManager`: PTYプロセス管理
- `WebViewHtmlGenerationService`: HTML生成サービス
- `PanelLocationService`: パネル配置管理
- `UnifiedTerminalPersistenceService`: セッション永続化

### 2. TerminalManager (Extension側)

**ファイル**: `src/terminals/TerminalManager.ts`

**役割**: 全ターミナルプロセスの中央管理システム（シングルトン）

**責務**:
- node-pty プロセスの生命周期管理
- ターミナルID リサイクリング（1-5番の固定範囲）
- アクティブターミナル追跡
- データバッファリングとイベント配信
- CLI Agent検出（Claude Code、GitHub Copilot等）

**主要機能**:
```typescript
class TerminalManager {
  // ターミナル作成
  createTerminal(options): Promise<TerminalInstance>

  // データ送信（PTYプロセスへ）
  sendData(terminalId: string, data: string): void

  // リサイズ
  resizeTerminal(terminalId: string, cols: number, rows: number): void

  // 削除（原子性保証）
  deleteTerminal(terminalId: string): Promise<DeleteResult>

  // イベント
  onData: Event<TerminalEvent>
  onExit: Event<TerminalEvent>
  onTerminalCreated: Event<TerminalInstance>
}
```

**パフォーマンス最適化**:
- 通常出力: 8ms間隔（125fps）のバッファリング
- CLI Agent検出時: 4ms間隔（250fps）の高速モード
- 最大バッファサイズ: 50メッセージ

### 3. TerminalSpawner (Extension側)

**ファイル**: `src/terminals/TerminalSpawner.ts`

**役割**: PTYプロセスの生成専門クラス

**責務**:
- node-pty を使用したシェルプロセス起動
- 作業ディレクトリとシェルのフォールバック処理
- 環境変数の適切な設定
- エラーハンドリングと再試行ロジック

**実装例**:
```typescript
const ptyProcess = pty.spawn(shell, shellArgs, {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: workingDirectory,
  env: environmentVariables,
});
```

### 4. node-pty (IPty インターフェース)

**パッケージ**: `@homebridge/node-pty-prebuilt-multiarch`

**役割**: 実際のシェルプロセス（bash、zsh等）を管理

**主要メソッド**:
- `spawn(shell, args, options)`: プロセス起動
- `write(data: string)`: シェルに入力を送信
- `onData(callback)`: シェル出力を受信
- `resize(cols, rows)`: ターミナルサイズ変更
- `kill()`: プロセス終了

**特徴**:
- プラットフォーム依存（Unix: `forkpty`、Windows: `ConPTY`）
- プロセスID（pid）管理
- ネイティブバイナリ（プラットフォーム別ビルド）

### 5. TerminalWebviewManager (WebView側)

**ファイル**: `src/webview/main.ts`（エントリポイント）
**実装**: `src/webview/managers/LightweightTerminalWebviewManager.ts`

**役割**: WebView側の全マネージャーを統括するコーディネーター

**Manager階層構造**:
```
TerminalWebviewManager (IManagerCoordinator)
├── MessageManager        # Extension通信
├── UIManager             # テーマ・UI制御
├── InputManager          # キーボード・IME・Alt+Click
├── PerformanceManager    # 出力バッファリング（16ms）
├── NotificationManager   # ユーザー通知
├── TerminalLifecycleManager  # ターミナル生成・削除
└── SplitManager          # 分割レイアウト
```

**設計思想**:
- Manager-Coordinator パターン
- 責任分離（Single Responsibility Principle）
- 疎結合（Loose Coupling）
- インターフェース駆動開発

### 6. xterm.js (Terminal クラス)

**パッケージ**: `@xterm/xterm`

**役割**: ブラウザでターミナルUIをレンダリング

**主要機能**:
```typescript
// インスタンス作成（src/webview/managers/TerminalLifecycleManager.ts:327）
const terminal = new Terminal({
  cursorBlink: true,
  fontFamily: 'monospace',
  fontSize: 12,
  altClickMovesCursor: true,
  scrollback: 1000,
  // ... その他のオプション
});

// DOMにマウント
terminal.open(containerElement);

// 出力表示
terminal.write(data);

// ユーザー入力イベント
terminal.onData((data) => {
  // WebView → Extension へ送信
  postMessage({ command: 'input', data });
});
```

**アドオンシステム**:
- **FitAddon**: コンテナサイズに合わせた自動リサイズ
- **WebLinksAddon**: URL自動検出とクリック対応
- **SerializeAddon**: セッション保存用データシリアライズ

**レンダリング特性**:
- Canvas/WebGLベースの高速レンダリング
- 仮想スクロールバッファ
- ANSI エスケープシーケンス対応
- Unicode完全対応（絵文字含む）

## データフロー詳細

### フロー1: ターミナル出力 (PTY → WebView)

```
1. シェルプロセス（bash等）が出力
   ↓
2. node-pty: ptyProcess.onData イベント発火
   ↓
3. TerminalManager: データバッファリング（8ms間隔）
   ↓
4. postMessage({ command: 'terminalData', terminalId, data })
   ↓
5. MessageManager (WebView): メッセージ受信
   ↓
6. PerformanceManager: 出力バッファリング（16ms間隔）
   ↓
7. xterm.js: terminal.write(data)
   ↓
8. DOM: Canvas/WebGLレンダリング
   ↓
9. ユーザー画面に表示
```

**最適化ポイント**:
- **二段階バッファリング**: Extension側（8ms）+ WebView側（16ms）
- **CLI Agent検出時の高速化**: 4ms間隔に動的変更
- **バッチ処理**: 複数メッセージを一括処理

### フロー2: ユーザー入力 (WebView → PTY)

```
1. ユーザーがキーを押下
   ↓
2. xterm.js: terminal.onData イベント発火
   ↓
3. InputManager: IME処理・Alt+Click処理
   ↓
4. postMessage({ command: 'input', terminalId, data })
   ↓
5. SecondaryTerminalProvider: メッセージ受信
   ↓
6. TerminalManager.sendData(terminalId, data)
   ↓
7. ptyProcess.write(data)
   ↓
8. シェルプロセスに入力送信
```

**特殊処理**:
- **IME処理**: 日本語・中国語入力の適切な制御
- **Alt+Click**: VS Code標準設定に準拠したカーソル移動
- **キーボードショートカット**: Ctrl+C、Ctrl+V等の制御

### フロー3: ターミナル作成

```
1. ユーザー: WebViewで「新規ターミナル」ボタンクリック
   ↓
2. TerminalLifecycleManager: postMessage({ command: 'createTerminal' })
   ↓
3. SecondaryTerminalProvider: メッセージ受信・ルーティング
   ↓
4. TerminalManager.createTerminal(options)
   ├─ TerminalNumberManager: 空き番号取得（1-5）
   └─ TerminalSpawner.spawnTerminal(request)
       ↓
5. node-pty.spawn('/bin/bash', args, options)
   ├─ プロセス起動
   └─ イベントハンドラー登録（onData, onExit）
   ↓
6. postMessage({ command: 'initializeTerminal', terminalId, config })
   ↓
7. TerminalLifecycleManager: xterm.js インスタンス作成
   ├─ terminal = new Terminal(config)
   ├─ terminal.loadAddon(fitAddon)
   └─ terminal.open(containerElement)
   ↓
8. postMessage({ command: 'ready', terminalId })
   ↓
9. ターミナル使用可能！
```

## 通信プロトコル (WebviewMessage)

### Extension → WebView コマンド

```typescript
// ターミナル初期化
{
  command: 'initializeTerminal',
  terminalId: string,
  config: TerminalConfig
}

// 出力データ配信
{
  command: 'terminalData',
  terminalId: string,
  data: string
}

// 設定更新
{
  command: 'updateSettings',
  settings: PartialTerminalSettings
}

// ターミナル削除通知
{
  command: 'terminalRemoved',
  terminalId: string
}

// ターミナル状態更新
{
  command: 'updateTerminalState',
  state: TerminalState
}
```

### WebView → Extension コマンド

```typescript
// ユーザー入力
{
  command: 'input',
  terminalId: string,
  data: string
}

// リサイズ通知
{
  command: 'resize',
  terminalId: string,
  cols: number,
  rows: number
}

// ターミナル作成要求
{
  command: 'createTerminal',
  options?: TerminalOptions
}

// ターミナル削除要求
{
  command: 'deleteTerminal',
  terminalId: string
}

// スクロールバックデータ抽出
{
  command: 'extractScrollbackData',
  terminalId: string,
  maxLines?: number
}
```

## 補助サービス

### ShellIntegrationService

**ファイル**: `src/services/ShellIntegrationService.ts`

**役割**: シェル統合機能の提供

**機能**:
- シェル初期化スクリプトの注入
- プロンプト検出とカスタマイズ
- コマンド実行追跡
- エラー検出

### CliAgentDetectionService

**ファイル**: `src/services/CliAgentDetectionService.ts`

**役割**: AI CLI エージェント検出

**検出対象**:
- Claude Code
- GitHub Copilot
- Gemini CLI
- CodeRabbit CLI
- Codex CLI

**機能**:
- リアルタイム検出（正規表現ベース）
- 視覚的ステータス表示
- 出力バッファリングの動的調整

### UnifiedTerminalPersistenceService

**ファイル**: `src/services/UnifiedTerminalPersistenceService.ts`

**役割**: セッション永続化

**機能**:
- 5分間隔の自動保存
- スクロールバック保存（最大1000行）
- セッション復元
- 最大ストレージサイズ管理（20MB）

### PanelLocationService

**ファイル**: `src/providers/services/PanelLocationService.ts`

**役割**: パネル配置管理

**機能**:
- サイドバー/パネル/エディタ領域の検出
- 動的レイアウト変更対応
- 設定同期

## セキュリティ設計

### Content Security Policy (CSP)

WebView HTML生成時に適用される厳格なセキュリティポリシー：

```typescript
const csp = [
  "default-src 'none'",
  `script-src ${webview.cspSource} 'nonce-${nonce}'`,
  `style-src ${webview.cspSource} 'unsafe-inline'`,
  `font-src ${webview.cspSource}`,
  "img-src data:",
  "connect-src 'none'"
].join('; ');
```

**特徴**:
- `default-src 'none'`: 全拒否ベース
- nonce ベーススクリプト制御
- リソース種別細分化制御
- 最小権限原則適用

### サンドボックス分離

- **Extension側**: Node.js 完全アクセス権限
- **WebView側**: ブラウザサンドボックス内で実行
- **通信**: postMessage APIのみ（型安全なプロトコル）

## パフォーマンス最適化

### バッファリング戦略

| レイヤー | 間隔 | 目的 |
|---------|------|------|
| TerminalManager | 8ms (125fps) | PTY出力の効率的収集 |
| PerformanceManager | 16ms (60fps) | WebView レンダリング最適化 |
| CLI Agent検出時 | 4ms (250fps) | 高頻度出力対応 |

### メモリ管理

- **スクロールバック制限**: 2000行（通常）、1000行（永続化時）
- **定期クリーンアップ**: 30秒間隔
- **バッファサイズ上限**: 50メッセージ
- **ストレージ上限**: 20MB

## トラブルシューティング

### よくある問題と診断方法

**問題1: ターミナルが表示されない**
- WebView初期化確認: 開発者ツールでコンソールエラー確認
- CSP違反確認: Content Security Policy エラーログ
- HTML生成確認: `WebViewHtmlGenerationService` のログ

**問題2: 入力が反映されない**
- PTYプロセス状態確認: `TerminalManager.getTerminalInfo()`
- 通信確認: postMessage ログの確認
- シェルプロセス確認: プロセスが生存しているか

**問題3: パフォーマンス劣化**
- バッファリング状態: Debug Panel（Ctrl+Shift+D）で確認
- CLI Agent検出: 高速モードが有効か確認
- メモリ使用量: スクロールバックサイズ確認

**問題4: プロンプトが表示されない**
- シェル初期化: `initializeShellForTerminal()` 実行確認
- 環境変数: `PS1`, `PROMPT_COMMAND` 確認
- ShellIntegration: safe mode設定確認

## 実装の鍵となる設計パターン

### 1. Singleton Pattern
- **TerminalManager**: 全プロセスを一元管理

### 2. Manager-Coordinator Pattern
- **TerminalWebviewManager**: 全Managerを統括

### 3. Observer Pattern
- **Event Emitter**: 各種イベント配信

### 4. Adapter Pattern
- **node-pty**: プラットフォーム差異の吸収

### 5. Strategy Pattern
- **バッファリング**: 状況に応じた動的調整

## 参照ドキュメント

- [Providers実装ガイド](../../src/providers/CLAUDE.md)
- [Terminals実装ガイド](../../src/terminals/CLAUDE.md)
- [WebView実装ガイド](../../src/webview/CLAUDE.md)
- [プロジェクト指示書](../../CLAUDE.md)
- [VS Code WebviewView API](https://code.visualstudio.com/api/references/vscode-api#WebviewView)
- [xterm.js ドキュメント](https://xtermjs.org/)
- [node-pty リポジトリ](https://github.com/homebridge/node-pty-prebuilt-multiarch)

## まとめ

この拡張機能は、以下の4つの主要コンポーネントの密接な連携により動作します：

1. **Extension (Node.js)**: PTYプロセス管理・通信ブリッジ
2. **WebView (Browser)**: ユーザーインターフェース・イベント処理
3. **node-pty**: 実シェルプロセス管理
4. **xterm.js**: ターミナルレンダリング

各コンポーネントは明確な責任を持ち、型安全なプロトコルで通信することで、堅牢で保守性の高いアーキテクチャを実現しています。
