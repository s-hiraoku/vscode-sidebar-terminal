# 調査レポート: ターミナルプロセス永続化

**調査日**: 2025-11-30
**ステータス**: 調査完了・将来の実装検討用に記録

---

## 調査結果サマリー

### VS Code標準ターミナルの仕組み
VS Codeは**専用のPTY Hostプロセス**を使用し、ターミナルプロセスをレンダラーウィンドウから分離している：
- PTY Hostはウィンドウとは独立して動作
- ウィンドウリロード時にプロセスをデタッチ・再接続
- `persistentProcessId`で安定したプロセス識別

### この拡張機能の現状
- **スクロールバック永続化**: 実装済み（動作中）
- **プロセス永続化**: フィールドは存在するが未実装
  - `persistentProcessId`: 存在するが使われていない
  - `shouldPersist`: 存在するが使われていない
  - `attemptProcessRecovery()`: スタブのみ存在
- **根本的な問題**: node-ptyはプロセスのデタッチをサポートしていない

### 技術的制約
1. **node-ptyの制限**: プロセスのデタッチ/再接続機能なし
2. **VS Code Extension APIの制限**: 拡張機能より長く生存するプロセスを生成する標準APIなし
3. **OS依存**: Windows (ConPTY) vs Unix (PTY) で異なる実装が必要

---

## 実装オプション

### Option A: tmux/screen統合（推奨）
**概要**: 外部のターミナルマルチプレクサを活用

**メリット**:
- 真のプロセス永続化が可能
- 既存の安定したツールを活用
- VS Code再起動を完全にサポート

**デメリット**:
- ユーザーがtmux/screenをインストール必要
- 主にLinux/macOS向け（Windows WSL経由は可能）
- 設定の複雑さ

**実装規模**: 中規模（2-3週間）

### Option B: バックグラウンドデーモン方式
**概要**: 拡張機能とは別のNode.jsプロセスを常駐させる

**メリット**:
- 完全な制御が可能
- プラットフォーム固有の最適化可能

**デメリット**:
- 複雑な実装
- セキュリティ考慮が必要
- プラットフォーム固有のコードが必要
- 常駐プロセスの管理が必要

**実装規模**: 大規模（1-2ヶ月）

### Option C: ハイブリッドアプローチ（現実的な選択肢）
**概要**: 現在のスクロールバック永続化を強化 + tmux検出・推奨

**Phase 1**: UX改善（短期）
- 再起動時に「プロセスは復元されません」通知
- 最後のコマンドと作業ディレクトリを表示
- tmux/screenの使用を推奨するメッセージ

**Phase 2**: tmux自動検出（中期）
- tmuxがインストールされている場合、自動的に利用
- tmuxセッションへの接続/デタッチをサポート

**Phase 3**: オプショナルなデーモン方式（長期）
- 上級ユーザー向けにバックグラウンドサービス提供

---

## 推奨プラン: Option C (ハイブリッドアプローチ)

### Phase 1: UX改善 (1週間)

#### 1.1 復元時の通知改善
**ファイル**: `src/services/persistence/ExtensionPersistenceService.ts`

```typescript
// 復元完了時に通知を表示
private async showRestoreNotification(restoredCount: number): Promise<void> {
  const message = `${restoredCount}個のターミナルが復元されました。` +
    `注意: 実行中のプロセスは復元されていません。`;

  const action = await vscode.window.showInformationMessage(
    message,
    '詳細',
    'tmuxの設定方法'
  );

  if (action === 'tmuxの設定方法') {
    vscode.env.openExternal(vscode.Uri.parse('https://...'));
  }
}
```

#### 1.2 ターミナルヘッダーに復元状態表示
- 復元されたターミナルには「📋 Restored」バッジを表示
- 最後のコマンドをツールチップで表示

#### 1.3 設定オプション追加
**ファイル**: `package.json`

```json
{
  "secondaryTerminal.showRestoreNotification": {
    "type": "boolean",
    "default": true,
    "description": "Show notification when terminals are restored without running processes"
  },
  "secondaryTerminal.persistenceMode": {
    "type": "string",
    "enum": ["scrollback-only", "tmux-auto", "tmux-prompt"],
    "default": "scrollback-only",
    "description": "Terminal persistence mode"
  }
}
```

### Phase 2: tmux統合 (2-3週間)

#### 2.1 tmux検出・ラッパー
**新規ファイル**: `src/services/TmuxIntegrationService.ts`

```typescript
export class TmuxIntegrationService {
  async isTmuxAvailable(): Promise<boolean>;
  async createTmuxSession(sessionName: string): Promise<string>;
  async attachToSession(sessionName: string): Promise<void>;
  async detachSession(sessionName: string): Promise<void>;
  async listSessions(): Promise<TmuxSession[]>;
}
```

#### 2.2 ターミナル作成フローの変更
**ファイル**: `src/terminals/TerminalSpawner.ts`

```typescript
async spawnTerminal(request: TerminalSpawnRequest): Promise<TerminalSpawnResult> {
  if (this.config.persistenceMode === 'tmux-auto' && await this.tmux.isTmuxAvailable()) {
    return this.spawnWithTmux(request);
  }
  return this.spawnDirect(request);
}

private async spawnWithTmux(request: TerminalSpawnRequest): Promise<TerminalSpawnResult> {
  const sessionName = `vscode-st-${request.terminalId}`;
  await this.tmux.createTmuxSession(sessionName);

  // tmux attach-sessionをPTYで実行
  const ptyProcess = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
    // ...options
  });

  return { ptyProcess, tmuxSession: sessionName };
}
```

#### 2.3 復元フローの変更
**ファイル**: `src/services/persistence/ExtensionPersistenceService.ts`

```typescript
async restoreTerminals(): Promise<void> {
  const existingTmuxSessions = await this.tmux.listSessions();

  for (const terminal of savedTerminals) {
    if (terminal.tmuxSession && existingTmuxSessions.includes(terminal.tmuxSession)) {
      // tmuxセッションに再接続
      await this.reattachToTmuxSession(terminal);
    } else {
      // 通常のスクロールバック復元
      await this.restoreWithScrollback(terminal);
    }
  }
}
```

### Phase 3: 設定とドキュメント

#### 3.1 設定UI追加
- 設定画面で永続化モードを選択可能に
- tmuxのインストール状態を表示

#### 3.2 ドキュメント更新
- README.mdにtmux統合の説明追加
- セットアップガイド作成

---

## 実装の優先順位

1. **Phase 1.1**: 復元時の通知改善（最優先）
2. **Phase 1.3**: 設定オプション追加
3. **Phase 2.1**: tmux検出・ラッパー
4. **Phase 2.2**: tmuxでのターミナル作成
5. **Phase 2.3**: tmuxセッションへの再接続
6. **Phase 3**: ドキュメント

---

## 修正が必要なファイル

### Phase 1
1. `src/services/persistence/ExtensionPersistenceService.ts` - 通知追加
2. `package.json` - 設定オプション追加
3. `src/webview/` - 復元状態バッジ表示

### Phase 2
1. `src/services/TmuxIntegrationService.ts` (新規)
2. `src/terminals/TerminalSpawner.ts` - tmux対応
3. `src/services/persistence/ExtensionPersistenceService.ts` - tmux復元
4. `src/types/shared.ts` - tmuxSession フィールド追加

### Phase 3
1. `README.md` - ドキュメント更新
2. `docs/README_ja.md` - 日本語ドキュメント更新

---

## 技術的な注意点

### Windows対応
- tmuxはネイティブでは動作しない
- WSL経由での対応を検討
- Windows向けには現在のスクロールバック復元を維持

### エラーハンドリング
- tmuxが途中でアンインストールされた場合
- tmuxセッションが外部から終了された場合
- 権限エラーの処理

### パフォーマンス
- tmuxセッション一覧取得のキャッシュ
- 起動時のtmux検出を非同期に

---

## 結論

### 現時点での対応
1. ✅ ドキュメントに制限事項を明記（README.md, README_ja.md に追加済み）
2. ✅ 回避策としてtmux/screenの使用を推奨

### 将来の実装候補
実装する場合は「Option C: ハイブリッドアプローチ」を推奨：
1. **Phase 1**: UX改善（復元時の通知、設定オプション）
2. **Phase 2**: tmux統合（自動検出、セッション管理）
3. **Phase 3**: ドキュメントと設定UI

### 技術的な制約の認識
- node-ptyはプロセスのデタッチ/再接続をサポートしていない
- VS Code Extension APIには拡張機能より長く生存するプロセスを生成する標準APIがない
- 真のプロセス永続化にはtmux/screen等の外部ツール、またはバックグラウンドデーモンが必要

---

## 参考資料

- [VS Code Terminal Advanced Documentation](https://code.visualstudio.com/docs/terminal/advanced)
- [GitHub Issue #117265 - PTY Host and Persistent Local Terminals](https://github.com/microsoft/vscode/issues/117265)
- [node-pty GitHub Repository](https://github.com/microsoft/node-pty)
