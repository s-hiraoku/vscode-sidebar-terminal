# Issue: CLI Agents検出機能のバグ修正

## 概要
現在のCLI Agent検出機能にて、複数のCLI Agents（claude code / gemini cli）の検出と監視に関するバグが存在しています。

## 問題の背景
CLI Agentsは単独のAgentではなく、以下の複数のAgentsを指します：
- **claude code** (Claude Code CLI)
- **gemini cli** (Gemini Code CLI)

現在の実装では、claude codeのみを想定した検出パターンとなっており、gemini cliへの対応が不十分です。

## 発生しているバグ

### 1. **Gemini CLI起動の検出不可**
- **現象**: `gemini`コマンドで起動されるGemini CLIが検出されない
- **原因**: 検出パターンが`claude`コマンドのみに限定されている
- **影響**: Gemini CLI使用時にヘッダーステータスが更新されない

### 2. **監視機能の不具合**
- **現象**: CLI Agents起動後の出力監視が適切に機能していない
- **原因**: 出力パターンがclaude code専用になっている
- **影響**: Agents実行中の状態変更が反映されない

### 3. **終了検知の失敗**
- **現象**: CLI Agentsが終了してもヘッダーステータスが更新されない
- **原因**: 終了パターンの検出ロジックが不適切
- **影響**: 終了後も"connected"状態のまま残る

## 技術的な詳細

### 現在の検出パターン（不完全）
```typescript
// 入力検出（claude codeのみ）
if (command.toLowerCase().startsWith('claude')) {
  // CLI Agent起動検出
}

// 出力検出（claude code専用パターン）
const cliAgentPatterns = [
  'Welcome to CLI Agent',
  'CLI Agent Code',
  'Type your message',
  // geminiのパターンなし
];

// 終了検出（汎用的すぎる）
const exitPatterns = ['Goodbye!', 'Chat ended', 'Session terminated'];
```

## 修正が必要な要素

### 1. **コマンド検出の拡張**
- `claude` コマンド → Claude Code検出
- `gemini` コマンド → Gemini CLI検出
- 各Agentの固有パターンに対応

### 2. **出力パターンの充実**
- **Claude Code用パターン**:
  - "Welcome to Claude Code"
  - "Claude Code CLI"
  - "human:", "assistant:"
  
- **Gemini CLI用パターン**:
  - "Welcome to Gemini"
  - "Gemini CLI"
  - "model:", "user:"

### 3. **終了検知の改善**
- 各AgentのEOF検出
- プロセス終了シグナルの監視
- タイムアウトベースの終了検知

### 4. **Agent種別の識別**
- どのAgentが実行中かを識別
- 複数Agent同時実行の対応
- Agent別の状態管理

## 期待される修正内容

### フェーズ1: 検出パターンの拡張
1. Gemini CLI起動コマンドの検出追加
2. Gemini CLI固有の出力パターン追加
3. Agent種別の識別機能実装

### フェーズ2: 監視機能の強化
1. 各Agent固有の動作パターン監視
2. リアルタイム状態変更の検出
3. 複数Agent同時実行の対応

### フェーズ3: 終了検知の改善
1. Agent固有の終了パターン検出
2. プロセス終了の確実な検知
3. 状態リセット機能の実装

## 影響を受けるファイル

- `/src/integration/SidebarCliAgentDetector.ts` - 検出ロジックの修正
- `/src/providers/SecondaryTerminalProvider.ts` - Agent種別の通知対応
- `/src/webview/main.ts` - 複数Agent対応のUI更新
- `/src/test/unit/terminals/CliAgentDetection.test.ts` - テストケースの追加

## テスト項目

### 基本機能テスト
1. Claude Code起動・終了の検出
2. Gemini CLI起動・終了の検出
3. Agent種別の正確な識別

### 複合シナリオテスト
1. 複数ターミナルでの異なるAgent実行
2. Agent切り替え時の状態管理
3. 同時終了時の状態同期

### エラーケーステスト
1. 異常終了時の状態リセット
2. 検出失敗時のフォールバック
3. メモリリーク防止の確認

## 成功基準

1. **完全な検出**: claude code / gemini cli両方の起動・終了を100%検出
2. **リアルタイム更新**: Agent状態変更が即座にUIに反映
3. **状態整合性**: Extension-WebView間の状態が常に同期
4. **パフォーマンス**: 検出処理がターミナル性能に影響しない

## 参考情報

- Claude Code CLI: `claude` コマンドで起動
- Gemini CLI: `gemini` コマンドで起動
- 両方とも対話型CLIツールとして動作
- プロンプト表示やメッセージ形式が異なる

この修正により、すべてのCLI Agentsが適切に検出・監視され、ユーザー体験が大幅に向上することが期待されます。