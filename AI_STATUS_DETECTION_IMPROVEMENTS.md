# AI Status Detection Improvements

## 📋 問題の概要

AI Status の検知が効率的でなく、特に終了検知が厳密すぎて、すぐに終了してしまう問題がありました。

## 🎯 実装した改善

### 1. **終了検知の緩和**

#### Before (厳密すぎる検知)
- シェルプロンプトの長さ制限: ≤15文字
- AI出力の過度な除外パターン (80+キーワード)
- 信頼度レベルが高すぎる (0.75-0.9)

#### After (緩やかな検知)
- シェルプロンプトの長さ制限: ≤50文字
- AI出力除外パターンを大幅削減 (明確なAIパターンのみ)
- 信頼度レベルを調整 (0.4-0.7)
- **タイムアウト基盤検知**: 30秒間AI出力がない場合、より緩い検知

### 2. **状態変更の安定化**

#### グレースピリオドの追加
```typescript
// 接続エージェント: 1秒の猶予期間
setTimeout(() => {
  this.stateManager.setAgentTerminated(terminalId);
}, 1000);

// 切断エージェント: 1.5秒の猶予期間
setTimeout(() => {
  this.stateManager.setAgentTerminated(terminalId);
}, 1500);
```

#### AI活動追跡の改善
- AI出力のタイムスタンプ追跡
- Claude/Gemini固有の活動監視
- 長時間の非活動後の緩い検知モード

### 3. **シェルプロンプト検知の拡張**

#### 新しいプロンプトパターン
```typescript
// 追加されたパターン
/^[a-z0-9._-]+:\s*\$\s*$/i,        // hostname: $
/^PS\d+>\s*$/i,                    // PowerShell
/^C:\\.*>\s*$/i,                   // Windows Command Prompt
/^[a-z0-9._-]+\s*\$\s*$/i,        // Simple hostname $
/^.*\s+\$\s*$/i,                   // Any prompt ending with $
/^.*\s+%\s*$/i,                    // Any prompt ending with %
```

#### タイムアウト基盤検知
```typescript
// 30秒間AI出力がない場合の緩い検知
if (timeSinceLastAIOutput > 30000) {
  if (cleanLine.length <= 30 &&
      (cleanLine.includes('$') || cleanLine.includes('%') || cleanLine.includes('>'))) {
    return { isTerminated: true, confidence: 0.5, reason: 'Timeout-based detection' };
  }
}
```

### 4. **Claude専用検知の改善**

#### 拡張された終了メッセージ
```typescript
// 追加されたパターン
line === 'exit' ||           // シンプルなexit復活
line === 'quit' ||           // quit追加
line === 'goodbye' ||        // goodbye追加
line === 'bye' ||            // bye追加
line.includes('session terminated') ||
line.includes('process exited') ||
```

#### 時間基盤緩和
```typescript
// 20秒間Claude活動がない場合の緩い検知
if (timeSinceActivity > 20000) {
  return line.length <= 30 &&
         (line.includes('$') || line.includes('%') || line.includes('>'));
}
```

### 5. **設定可能なパラメータ**

#### 検知設定の初期化
```typescript
constructor() {
  this.detectionCache.set('terminationGracePeriod', 1000);     // 1秒猶予期間
  this.detectionCache.set('aiActivityTimeout', 30000);        // 30秒AI活動タイムアウト
  this.detectionCache.set('claudeActivityTimeout', 20000);    // 20秒Claude活動タイムアウト
  this.detectionCache.set('maxShellPromptLength', 50);        // 最大シェルプロンプト長
  this.detectionCache.set('relaxedModeEnabled', true);        // 緩和モード有効
}
```

## 📊 改善効果

### Before vs After

| 項目 | Before | After | 改善 |
|------|--------|-------|------|
| **シェルプロンプト長制限** | ≤15文字 | ≤50文字 | 233%拡張 |
| **AI除外パターン** | 80+キーワード | 10以下 | 87%削減 |
| **終了検知の信頼度** | 0.75-0.9 | 0.4-0.7 | より緩く |
| **状態変更** | 即座 | 1-1.5秒猶予 | 安定性向上 |
| **タイムアウト検知** | なし | 20-30秒後 | 新機能 |

### 検知パターンの改善

#### 検知される新しいプロンプト例
```bash
# 以前は検知されなかった
macbook-pro:~ user$           # 長い名前も検知
hostname: $                   # コロン形式
PS C:\Users\User>            # PowerShell
john@server:/long/path$      # 長いパスも検知

# タイムアウト後なら検知
host$                        # 30秒後なら検知
user%                        # 30秒後なら検知
```

#### 誤検知の防止
```bash
# 依然として除外される (AI出力)
"I'll help you with that"           # Claude出力
"Gemini CLI is analyzing..."        # Gemini出力
"Let me think about this..."        # AI思考過程
```

## 🧪 テストカバレッジ

### 新しいテストファイル
`src/test/unit/services/CliAgentDetection.improved.test.ts`

### テストされる機能
- ✅ 緩やかなシェルプロンプト検知
- ✅ タイムアウト基盤検知
- ✅ グレースピリオド状態管理
- ✅ AI活動追跡
- ✅ 明示的終了メッセージ
- ✅ エッジケースの処理
- ✅ パフォーマンス負荷テスト

## 🚀 使用上の注意

### より安定した検知
- AI エージェントの状態変更が緩やかになり、より安定
- 短時間での状態フリッピングが大幅に削減
- ユーザーエクスペリエンスの向上

### 設定の調整
必要に応じて、以下のパラメータを調整可能：
- `terminationGracePeriod`: 状態変更の猶予期間
- `aiActivityTimeout`: AI活動タイムアウト
- `maxShellPromptLength`: シェルプロンプト最大長
- `relaxedModeEnabled`: 緩和モードの有効/無効

## 🔄 今後の改善余地

1. **動的調整**: ユーザーの使用パターンに基づく自動調整
2. **学習機能**: よく使用されるプロンプトパターンの学習
3. **設定UI**: VS Code設定からの調整可能な UI
4. **統計追跡**: 検知精度の継続的な監視と改善

この改善により、AI Status検知がより信頼性が高く、安定したものになり、ユーザーエクスペリエンスが大幅に向上します。