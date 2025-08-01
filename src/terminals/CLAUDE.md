# Terminals CLAUDE.md - ターミナル管理実装ガイド

このファイルは TerminalManager の効率的な実装をサポートします。

## 核心アーキテクチャ

### TerminalManager - 中央制御システム
**シングルトン管理** - 全ターミナルプロセスの生命周期を制御
- node-pty プロセス管理
- ターミナルID recycling (1-5番)
- アクティブターミナル追跡
- 削除操作の原子性保証

### 重要な設計パターン

#### ターミナル生命周期管理
```typescript
// ターミナル作成
createTerminal(): Promise<TerminalInfo> {
    const id = this.terminalNumberManager.getAvailableNumber();
    const ptyProcess = spawn(shell, args, options);
    
    this.terminals.set(id, {
        id,
        ptyProcess,
        name: `Terminal ${id}`,
        isActive: false
    });
    
    return terminalInfo;
}

// 安全な削除 (無限ループ防止)
async deleteTerminal(id: number): Promise<DeleteResult> {
    if (this._terminalBeingKilled.has(id)) {
        return { success: false, reason: 'Already being deleted' };
    }
    
    this._terminalBeingKilled.add(id);
    try {
        await this.killTerminalProcess(id);
        this.terminals.delete(id);
        this.terminalNumberManager.releaseNumber(id);
        return { success: true };
    } finally {
        this._terminalBeingKilled.delete(id);
    }
}
```

#### ターミナル番号管理
```typescript
// TerminalNumberManager による ID リサイクリング
getAvailableNumber(): number {
    // 1-5の範囲で再利用可能な番号を返す
    for (let i = 1; i <= 5; i++) {
        if (!this.usedNumbers.has(i)) {
            this.usedNumbers.add(i);
            return i;
        }
    }
    throw new Error('Maximum terminals reached');
}

releaseNumber(id: number): void {
    this.usedNumbers.delete(id);
}
```

## 実装効率化テンプレート

### データ処理最適化
```typescript
// バッファリング出力 (CLI Agent対応)
private flushInterval = 16; // 60fps base

handleTerminalData(id: number, data: string): void {
    if (this.isCliAgentActive) {
        this.flushInterval = 4; // CLI Agent時は高速化
    }
    
    this.bufferManager.addData(id, data);
    this.scheduleFlush();
}

private scheduleFlush(): void {
    if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
            this.flushAllBuffers();
            this.flushTimer = null;
        }, this.flushInterval);
    }
}
```

### リサイズ処理
```typescript
// デバウンス付きリサイズ
resizeTerminal(id: number, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (!terminal) return;
    
    // デバウンス処理
    clearTimeout(this.resizeTimers.get(id));
    this.resizeTimers.set(id, setTimeout(() => {
        terminal.ptyProcess.resize(cols, rows);
        this.resizeTimers.delete(id);
    }, 100));
}
```

### エラーハンドリング
```typescript
// 堅牢なエラー処理
private handleTerminalError(id: number, error: Error): void {
    console.error(`Terminal ${id} error:`, error);
    
    // クリーンアップ
    this.cleanupTerminalResources(id);
    
    // WebViewに通知
    this.sendErrorToWebview(id, error.message);
    
    // 再作成が必要な場合
    if (this.shouldRecreateTerminal(error)) {
        this.recreateTerminal(id);
    }
}
```

## パフォーマンス最適化

### CLI Agent検出・対応
```typescript
// CLI Agent活動検出
private detectCliAgent(data: string): boolean {
    const patterns = [
        /claude-code\s+["'].*?["']/,
        /gemini\s+code\s+["'].*?["']/,
        /\[Claude\s+Code\]/,
        /anthropic\.com/
    ];
    
    return patterns.some(pattern => pattern.test(data));
}

// 適応的バッファリング
private adjustBufferingForCliAgent(): void {
    if (this.cliAgentActive) {
        this.flushInterval = 4; // 高速フラッシュ
        this.maxBufferSize = 2000; // 大容量バッファ
    } else {
        this.flushInterval = 16; // 通常フラッシュ
        this.maxBufferSize = 1000; // 標準バッファ
    }
}
```

### メモリ効率化
```typescript
// 定期的なリソースクリーンアップ
private scheduleCleanup(): void {
    setInterval(() => {
        this.cleanupDeadProcesses();
        this.clearExpiredBuffers();
        this.compactEventHandlers();
    }, 30000); // 30秒間隔
}
```

## Alt+Click 統合

### VS Code標準Alt+Click実装
```typescript
// Alt+Click設定確認
private checkAltClickSettings(): boolean {
    const altClickEnabled = vscode.workspace.getConfiguration()
        .get<boolean>('terminal.integrated.altClickMovesCursor', false);
    const multiCursorModifier = vscode.workspace.getConfiguration()
        .get<string>('editor.multiCursorModifier', 'ctrlCmd');
    
    return altClickEnabled && multiCursorModifier === 'alt';
}

// WebViewに設定送信
private sendAltClickSettings(): void {
    this.sendToWebview({
        command: 'altClickSettings',
        enabled: this.checkAltClickSettings()
    });
}
```

## トラブルシューティング

### よくある問題と解決法

1. **ターミナルが作成されない**
   ```typescript
   // node-ptyプロセス確認
   console.log('Available shells:', this.getAvailableShells());
   console.log('Working directory:', process.cwd());
   ```

2. **メモリリーク**
   ```typescript
   // リソース確認
   console.log('Active terminals:', this.terminals.size);
   console.log('Event listeners:', this.getEventListenerCount());
   ```

3. **パフォーマンス低下**
   ```typescript
   // バッファ状態確認
   console.log('Buffer sizes:', this.getBufferSizes());
   console.log('Flush frequency:', this.flushInterval);
   ```

## テスト戦略

### 単体テスト重要ポイント
```typescript
// TerminalManager テスト
describe('TerminalManager', () => {
    it('should prevent infinite loops during deletion', async () => {
        const manager = new TerminalManager();
        
        // 同時削除テスト
        const deletePromises = [
            manager.deleteTerminal(1),
            manager.deleteTerminal(1),
            manager.deleteTerminal(1)
        ];
        
        const results = await Promise.all(deletePromises);
        
        // 1つだけ成功することを確認
        const successCount = results.filter(r => r.success).length;
        expect(successCount).to.equal(1);
    });
});
```

## 実装チェックリスト

### 新機能追加時
- [ ] node-pty プロセス制御
- [ ] ターミナル番号管理 (1-5)
- [ ] 無限ループ防止
- [ ] メモリリーク対策
- [ ] CLI Agent対応
- [ ] Alt+Click統合
- [ ] エラーハンドリング
- [ ] テストケース作成

### パフォーマンス確認
- [ ] データフラッシュ頻度
- [ ] バッファサイズ適正化
- [ ] イベントリスナー整理
- [ ] プロセス終了確認
- [ ] メモリ使用量確認

このガイドでターミナル管理の効率的な実装が可能です。