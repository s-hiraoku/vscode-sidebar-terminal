# CLI Agent Integration - Issue #99 調査結果

## ⚠️ 設計見直し（2024年版）

### 新しい協調的アプローチ

当初の実装では CLI Agent の CMD+OPT+K を「横取り」していましたが、これは以下の問題を抱えていました：

**問題点**:
- CLI Agent の本来の設計意図を阻害
- VS Code Terminal API との不整合
- 他の拡張機能との競合リスク
- エコシステム全体の協調性を損なう

**解決策**:
独自のキーバインド（CMD+SHIFT+K）を提供し、CLI Agent との協調的な共存を実現しました。

```json
// 新しいアプローチ
{
  "command": "sidebarTerminal.sendAtMention", 
  "key": "cmd+shift+k",  // CLI Agent と競合しない独自キー
  "when": "editorTextFocus"
}
```

### 現在の実装

- **独立したコマンド**: `sidebarTerminal.sendAtMention`
- **専用キーバインド**: CMD+SHIFT+K (Mac) / Ctrl+Shift+K (Windows/Linux)
- **CLI Agent 互換性**: 完全に共存可能
- **設定の簡素化**: 複雑な3モード設定から単純な on/off に変更

---

## 過去の調査結果（参考情報）

### 問題の概要（当初）
VS Code標準ターミナルでは、CMD + OPT + K（⌘ + ⌥ + K）を押すとCLI Agentの`cli-agent.insertAtMentioned`コマンドが実行され、現在のエディタファイルの`@ファイル名`がターミナルに挿入されますが、このサイドバーターミナル拡張では同機能が動作しませんでした。

## 調査結果

### 1. CLI Agent拡張機能の動作仕様
調査の結果、CLI Agent拡張機能は以下の仕様で動作していることが判明しました：

- `cli-agent.insertAtMentioned`コマンドは**引数なし**で呼び出される
- テキストデータは引数として渡されない（`Arguments length: 0`）
- 受け取り側（ターミナル拡張機能）が現在のエディタコンテキストから情報を取得することを期待

### 2. 実装した解決策

#### A. 独自コマンドによるアプローチ
競合を避けるため、独自の名前空間でコマンドを実装：
```typescript
{
  command: 'sidebarTerminal.sendToTerminal',
  callback: (content?: string) => {
    // content が未指定の場合、アクティブエディタから @filename を生成
    if (!content) {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const fileName = activeEditor.document.fileName;
        const baseName = fileName.split('/').pop() || fileName.split('\\').pop() || fileName;
        content = `@${baseName}`; // @filename.ts 形式で生成
      }
    }
    
    if (content && terminalManager) {
      terminalManager.sendInput(content);
    }
  },
}
```

#### B. キーバインドオーバーライドアプローチ（実装済み）
VS Codeのキーバインドシステムを使用してCMD+OPT+Kを処理：

**package.json keybindings設定:**
```json
{
  "contributes": {
    "keybindings": [
      {
        "command": "sidebarTerminal.insertAtMentioned",
        "key": "ctrl+alt+k",
        "mac": "cmd+alt+k", 
        "when": "config.sidebarTerminal.cliAgentIntegration != disabled && editorTextFocus"
      }
    ]
  }
}
```

**統合モード設定:**
```json
{
  "sidebarTerminal.cliAgentIntegration": {
    "type": "string",
    "enum": ["disabled", "enabled", "replace"],
    "default": "disabled"
  }
}
```

#### C. メッセージフロー
1. **disabled**: 元のCLI Agent動作のみ（キーバインド無効）
2. **enabled**: CMD+OPT+K → 標準ターミナル + サイドバーターミナル（両方）
3. **replace**: CMD+OPT+K → サイドバーターミナルのみ

#### D. 手動連携方法
```typescript
// コマンドパレットから実行
"Sidebar Terminal: Send to Sidebar Terminal"

// プログラムから呼び出し
await vscode.commands.executeCommand('sidebarTerminal.sendToTerminal', '@filename.ts');
```

### 3. 技術的詳細

#### 引数の構造分析
- 初回実装時：引数が文字列として渡されることを想定
- 実際の動作：引数は空配列 `[]` で渡される
- 解決方法：VS Code APIの`vscode.window.activeTextEditor`を使用してコンテキストを取得

#### ファイル名の抽出
```typescript
// フルパスからファイル名のみを抽出
const fileName = activeEditor.document.fileName;
const baseName = fileName.split('/').pop() || fileName.split('\\').pop() || fileName;
```

### 4. 実装の特徴

#### 互換性
- VS Code標準ターミナルと同じ動作を実現
- CLI Agent拡張機能の既存の実装と完全互換
- 他の拡張機能に影響を与えない

#### エラーハンドリング
- アクティブエディタが存在しない場合のエラーメッセージ表示
- 無効なテキストデータの検証
- 適切なログ出力によるデバッグ支援

### 5. 今後の拡張可能性

#### 代替フォーマット
必要に応じて以下のフォーマットに変更可能：

```typescript
// フルパス
text = activeEditor.document.uri.fsPath;

// ワークスペースからの相対パス
const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
if (workspaceFolder) {
  text = path.relative(workspaceFolder.uri.fsPath, activeEditor.document.uri.fsPath);
}

// 単純なファイル名（@なし）
text = baseName;
```

## キーボードショートカット CMD+OPT+K の詳細調査

### CLI Agent拡張機能のキーボードショートカット仕様
CLI Agent VS Code拡張機能（google.gemini-cli）では以下のキーボードショートカットが定義されています：

- **macOS**: `Cmd+Option+K` (⌘+⌥+K)
- **Windows/Linux**: `Alt+Ctrl+K`
- **コマンド**: `cli-agent.insertAtMentioned`
- **機能**: 選択されたコードをCLI Agent のプロンプトに送信

### VS Code キーボードショートカット傍受の制限事項

#### 1. 直接的なコマンド傍受は不可能
VS Code APIには、他の拡張機能のコマンド実行を直接傍受する機能は提供されていません：
- `vscode.commands` APIでは既存コマンドの実行を監視できない
- コマンド実行前にフックする仕組みが存在しない
- 他拡張機能のコマンド実行をブロックすることも不可能

#### 2. キーバインディング上書きによるアプローチ
最も実用的な解決策は、package.jsonでキーバインディングを上書きすることです：

```json
{
  "contributes": {
    "keybindings": [
      {
        "command": "sidebarTerminal.interceptCliAgent",
        "key": "ctrl+alt+k",
        "mac": "cmd+alt+k",
        "when": "sidebarTerminal.active && editorTextFocus"
      }
    ]
  }
}
```

#### 3. 条件付きキーバインディング戦略
`when`句を活用してコンテキストベースでキーバインディングを制御：

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "sidebarTerminal.interceptCliAgentShortcut": {
          "type": "boolean",
          "default": false,
          "description": "Intercept CLI Agent's CMD+OPT+K shortcut for sidebar terminal"
        }
      }
    },
    "keybindings": [
      {
        "command": "sidebarTerminal.handleCliAgentShortcut",
        "key": "ctrl+alt+k",
        "mac": "cmd+alt+k", 
        "when": "config.sidebarTerminal.interceptCliAgentShortcut && editorTextFocus"
      }
    ]
  }
}
```

### 代替統合アプローチ

#### A. 独自コマンドによる連携（推奨）
CLI Agentとの直接的な競合を避け、独自のワークフローを提供：

```typescript
// 実装例：Sidebar Terminal専用のCLI Agent連携コマンド
vscode.commands.registerCommand('sidebarTerminal.sendToCliAgentTerminal', async () => {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const selection = activeEditor.selection;
    const text = selection.isEmpty 
      ? `@${path.basename(activeEditor.document.fileName)}`
      : activeEditor.document.getText(selection);
    
    // サイドバーターミナルに送信
    await terminalManager.sendInput(text);
    
    // オプション：CLI Agentのコマンドも実行
    try {
      await vscode.commands.executeCommand('cli-agent.insertAtMentioned');
    } catch (error) {
      console.log('CLI Agent not available:', error);
    }
  }
});
```

#### B. VS Code設定による動的制御
ユーザーがキーバインディング動作を選択できるアプローチ：

```typescript
// Settings.json での制御例
{
  "sidebarTerminal.cliAgentIntegration": "intercept", // "intercept" | "parallel" | "disabled"
  "sidebarTerminal.interceptCliAgentShortcut": true
}
```

### 技術的考慮事項

#### 1. キーバインディング優先順位
VS Codeのキーバインディング解決順序：
1. ユーザー定義keybindings.json（最優先）
2. 拡張機能のpackage.json contributes.keybindings
3. VS Code標準キーバインディング

#### 2. 拡張機能間の競合回避
- 同一キーの競合時は後から読み込まれた拡張機能が優先
- `when`句による条件分岐で競合を回避
- 拡張機能の`activationEvents`の順序が影響

#### 3. ユーザビリティの配慮
- デフォルトでは既存の CLI Agent 動作を保持
- オプトイン方式で傍受機能を提供
- 明確な設定UIと説明を提供

### 実装推奨案

```typescript
// src/integration/cliAgentKeyboardIntegration.ts
export class CliAgentKeyboardIntegration {
  private context: vscode.ExtensionContext;
  private terminalManager: TerminalManager;
  
  constructor(context: vscode.ExtensionContext, terminalManager: TerminalManager) {
    this.context = context;
    this.terminalManager = terminalManager;
    this.registerCommands();
  }
  
  private registerCommands(): void {
    // サイドバーターミナル向けCLI Agent統合コマンド
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'sidebarTerminal.handleCliAgentShortcut',
        this.handleCLI AgentCodeShortcut.bind(this)
      )
    );
  }
  
  private async handleCLI AgentCodeShortcut(): Promise<void> {
    const config = vscode.workspace.getConfiguration('sidebarTerminal');
    const integrationMode = config.get<string>('cliAgentIntegration', 'parallel');
    
    switch (integrationMode) {
      case 'intercept':
        // サイドバーターミナルのみに送信
        await this.sendToSidebarTerminalOnly();
        break;
        
      case 'parallel':
        // 両方に送信
        await this.sendToSidebarTerminalOnly();
        await this.executeOriginalCLI AgentCodeCommand();
        break;
        
      case 'disabled':
        // 元のCLI Agentコマンドのみ実行
        await this.executeOriginalCLI AgentCodeCommand();
        break;
    }
  }
  
  private async sendToSidebarTerminalOnly(): Promise<void> {
    // エディタコンテキストから情報を取得してターミナルに送信
    await vscode.commands.executeCommand('sidebarTerminal.sendToTerminal');
  }
  
  private async executeOriginalCLI AgentCodeCommand(): Promise<void> {
    try {
      await vscode.commands.executeCommand('cli-agent.insertAtMentioned');
    } catch (error) {
      console.warn('CLI Agent command not available:', error);
    }
  }
}
```

## まとめ
CLI Agent拡張機能は、VS Code標準のAPIを活用してエディタコンテキストから情報を取得する設計になっていました。この仕様を理解し、適切に実装することで、サイドバーターミナル拡張機能でもCLI Agentとのシームレスな連携が実現できました。

**キーボードショートカット傍受については、VS Code APIの制限により直接的な傍受は不可能ですが、キーバインディング上書きと条件付き実行により、ユーザーフレンドリーな統合ソリューションを提供できます。**

---

## 現在の使用方法（2024年実装）

### 基本的な使用方法

1. **ファイルを開く**: VS Code でファイルを開きます
2. **キーバインド実行**: CMD+OPT+L (Mac) または Ctrl+Alt+L (Windows/Linux) を押します
3. **結果**: サイドバーターミナルに `@filename.ts` が入力されます

### コマンドパレット経由

1. Command Palette を開く（CMD+SHIFT+P）
2. `Sidebar Terminal: Send @filename to Sidebar Terminal` を検索・実行

### 設定オプション

```json
{
  // ファイル参照ショートカット機能の有効/無効
  "sidebarTerminal.enableCliAgentIntegration": true,
  
  // ショートカット実行後にサイドバーターミナルにフォーカス
  "sidebarTerminal.focusAfterAtMention": true,
  
  // 将来機能: 自動同期（未実装）
  "sidebarTerminal.enableAtMentionSync": false
}
```

### VS Code 設定画面での設定

VS Code の設定画面（`Ctrl/Cmd + ,`）で以下の項目を設定できます：

**Sidebar Terminal > Enable CLI Agent Integration**
- **説明**: File reference shortcuts: Use Cmd+Option+L (Mac) or Alt+Ctrl+L (Linux/Windows) to insert file references
- **デフォルト**: `true`
- **効果**: この設定を無効にするとファイル参照ショートカット機能が完全に無効化されます

**Sidebar Terminal > Focus After At Mention**
- **説明**: Focus sidebar terminal after sending @filename with CMD+OPT+L
- **デフォルト**: `true`
- **効果**: ショートカット実行後、自動的にサイドバーターミナルにフォーカスが移ります

### CLI Agent との併用

- **CLI Agent**: CMD+OPT+K → 標準ターミナルに送信
- **サイドバーターミナル**: CMD+OPT+L → サイドバーターミナルに送信
- **完全に独立**: 互いに干渉しない協調的な関係

この設計により、ユーザーは両方の拡張機能を問題なく併用できます。

---

## 🚀 継続的改善ロードマップ

### Phase 1: 協調的アプローチ ✅ 完了 (2024年)

**目標**: CLI Agent との競合を解決し、独立した機能を提供

**実装内容**:
- [x] CMD+OPT+K 横取りの廃止
- [x] 独自キーバインド CMD+OPT+L の実装  
- [x] `sidebarTerminal.sendAtMention` コマンド
- [x] 設定の簡素化
- [x] ドキュメント整備

**成果**: 
- CLI Agent と完全に共存可能
- ユーザーフレンドリーな独立機能
- 持続可能な設計基盤

### Phase 2: Terminal Mirror システム 🔄 計画中

**目標**: 標準ターミナルとの非侵襲的な同期

**実装予定**:
- [ ] 標準ターミナル入力監視システム
- [ ] CLI Agent アクティビティ検出
- [ ] 自動同期の設定制御
- [ ] パフォーマンス最適化

**技術的検討**:
```typescript
// Terminal Input Monitor (構想)
vscode.window.onDidChangeActiveTerminal((terminal) => {
  if (terminal && config.get('enableAtMentionSync')) {
    // 非侵襲的な入力監視
    monitorTerminalInput(terminal);
  }
});
```

**期待される成果**:
- CLI Agent → 標準ターミナル → 自動でサイドバーターミナルにも同期
- ユーザーの手動操作不要
- 完全に任意の機能（設定で無効化可能）

### Phase 3: VS Code Terminal API 互換性 🔮 長期目標

**目標**: エコシステム全体との完全互換性 (Issue #103)

**実装予定**:
- [ ] VS Code Terminal インターフェース実装
- [ ] 標準 Terminal API 対応
- [ ] Shell Integration サポート
- [ ] Event System 完全実装

**工数見積もり**: 6-10週間（Issue #103 参照）

**期待される成果**:
- CLI Agent が自然にサイドバーターミナルを認識
- 他の拡張機能との完全互換性
- VS Code エコシステムの一級市民としての地位

## 📊 進捗トラッキング

### 実装状況

| Phase | 機能 | 状態 | 優先度 | 工数見積もり |
|-------|------|------|--------|-------------|
| Phase 1 | 協調的統合 | ✅ 完了 | High | 2週間 |
| Phase 2 | Terminal Mirror | 📋 計画中 | Medium | 3-4週間 |
| Phase 3 | Terminal API | 🔮 構想中 | Low | 6-10週間 |

### 品質指標

| 指標 | Phase 1 | Phase 2 目標 | Phase 3 目標 |
|------|---------|-------------|-------------|
| CLI Agent 互換性 | ✅ 100% | ✅ 100% | ✅ 100% |
| ユーザー体験 | ✅ Good | 🎯 Excellent | 🎯 Perfect |
| 技術的負債 | ✅ Low | 🎯 Low | 🎯 Minimal |
| テストカバレッジ | 📋 60% | 🎯 80% | 🎯 95% |

## 🔧 開発・テスト手順

### 開発環境セットアップ

```bash
# 1. 依存関係インストール
npm install

# 2. コンパイル
npm run compile

# 3. テスト実行
npm test

# 4. リント確認
npm run lint
```

### 機能テスト手順

#### Phase 1 機能テスト

```bash
# 1. 基本機能テスト
# - VS Code でファイルを開く
# - CMD+OPT+L を押す
# - サイドバーターミナルに @filename.ts が表示される

# 2. CLI Agent 共存テスト  
# - CLI Agent 拡張をインストール
# - CMD+OPT+K → 標準ターミナルに送信（CLI Agent）
# - CMD+OPT+L → サイドバーターミナルに送信（この拡張）
# - 両方が独立して動作することを確認

# 3. エラーハンドリングテスト
# - ファイルを開かずに CMD+OPT+L → 警告メッセージ表示
# - サイドバーターミナルが無い状態 → エラーメッセージ表示
```

#### Phase 2 テスト（将来）

```bash
# 自動同期テスト（未実装）
# - CLI Agent で CMD+OPT+K 実行
# - 設定で enableAtMentionSync: true
# - サイドバーターミナルにも自動で同じ内容が表示される
```

### 継続的改善プロセス

1. **月次レビュー**: ユーザーフィードバック収集
2. **四半期計画**: 次フェーズの詳細設計
3. **年次評価**: ロードマップの見直し

### 関連 Issues

- **Issue #99**: 本機能のメイントラッキング
- **Issue #103**: Terminal API 互換性の詳細設計
- **新規 Issue**: Phase 2 実装時に作成予定

---

# CLI Agent Integration Guide (General)

This document also outlines general strategies for integrating the Sidebar Terminal extension with CLI Agent and other VS Code extensions.

## Overview

VS Code doesn't provide a built-in API to intercept commands from other extensions. However, there are several approaches to achieve integration:

## Approach 1: Command Interception (Experimental)

You can intercept commands by registering your own command with the same identifier. This requires careful handling to avoid infinite loops.

```typescript
// In extension.ts
export function activate(context: vscode.ExtensionContext) {
  // Store the original disposable
  let interceptDisposable: vscode.Disposable | undefined;
  
  // Function to intercept cli-agent.insertAtMentioned
  async function interceptCLI AgentCodeCommand(...args: any[]) {
    // Dispose our command to avoid infinite loop
    interceptDisposable?.dispose();
    
    try {
      // Log the intercepted command
      console.log('Intercepted cli-agent.insertAtMentioned:', args);
      
      // Execute the original command
      await vscode.commands.executeCommand('cli-agent.insertAtMentioned', ...args);
      
      // After execution, we could trigger our terminal action
      // For example, send the content to our terminal
      if (args[0] && typeof args[0] === 'string') {
        await vscode.commands.executeCommand('sidebarTerminal.sendToTerminal', args[0]);
      }
    } finally {
      // Re-register the interceptor
      interceptDisposable = vscode.commands.registerCommand(
        'cli-agent.insertAtMentioned',
        interceptCLI AgentCodeCommand
      );
      context.subscriptions.push(interceptDisposable);
    }
  }
  
  // Initial registration
  interceptDisposable = vscode.commands.registerCommand(
    'cli-agent.insertAtMentioned',
    interceptCLI AgentCodeCommand
  );
  context.subscriptions.push(interceptDisposable);
}
```

## Approach 2: Extension API Communication

If CLI Agent exports an API, you can directly communicate with it:

```typescript
// In extension.ts
export function activate(context: vscode.ExtensionContext) {
  // Try to get CLI Agent extension
  const cliAgentExt = vscode.extensions.getExtension('google.gemini-cli');
  
  if (cliAgentExt) {
    // Wait for activation if needed
    const claudeCodeApi = cliAgentExt.isActive 
      ? cliAgentExt.exports 
      : await cliAgentExt.activate();
    
    if (claudeCodeApi) {
      // Use the API if available
      console.log('CLI Agent API:', claudeCodeApi);
      
      // Register for events or use methods if available
      if (claudeCodeApi.onDidInsertAtMentioned) {
        claudeCodeApi.onDidInsertAtMentioned((content: string) => {
          // Handle the event
          vscode.commands.executeCommand('sidebarTerminal.sendToTerminal', content);
        });
      }
    }
  }
}
```

## Approach 3: File System Watcher

Monitor file changes when CLI Agent modifies files:

```typescript
// Watch for file changes
const watcher = vscode.workspace.createFileSystemWatcher('**/*');

watcher.onDidChange((uri) => {
  // Check if change was made by CLI Agent
  // This requires pattern detection or timing analysis
  console.log('File changed:', uri.fsPath);
});

context.subscriptions.push(watcher);
```

## Approach 4: Custom Command Registration

Register your own commands that CLI Agent users can invoke:

```typescript
// Register a command for CLI Agent integration
context.subscriptions.push(
  vscode.commands.registerCommand('sidebarTerminal.sendToTerminal', async (content: string) => {
    // Get the active terminal from your extension
    const terminalManager = getTerminalManager();
    const activeTerminal = terminalManager.getActiveTerminal();
    
    if (activeTerminal) {
      // Send content to terminal
      terminalManager.sendInput(activeTerminal, content);
      
      // Show success notification
      vscode.window.showInformationMessage('Content sent to Sidebar Terminal');
    } else {
      // Create a new terminal if none exists
      await vscode.commands.executeCommand('sidebarTerminal.splitTerminal');
      // Retry sending after terminal creation
      setTimeout(() => {
        vscode.commands.executeCommand('sidebarTerminal.sendToTerminal', content);
      }, 500);
    }
  })
);
```

## Approach 5: Clipboard Integration

Monitor clipboard changes when CLI Agent copies content:

```typescript
let lastClipboardContent = '';

// Poll clipboard for changes
setInterval(async () => {
  const currentContent = await vscode.env.clipboard.readText();
  if (currentContent !== lastClipboardContent) {
    lastClipboardContent = currentContent;
    
    // Check if it's from CLI Agent (requires pattern matching)
    if (isCliAgentContent(currentContent)) {
      vscode.commands.executeCommand('sidebarTerminal.sendToTerminal', currentContent);
    }
  }
}, 1000);
```

## Implementation Recommendations

### 1. Add New Commands to package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "sidebarTerminal.sendToTerminal",
        "title": "Send to Sidebar Terminal",
        "category": "Sidebar Terminal"
      },
      {
        "command": "sidebarTerminal.executeInTerminal",
        "title": "Execute in Sidebar Terminal",
        "category": "Sidebar Terminal"
      }
    ]
  }
}
```

### 2. Create Integration Module

Create `src/integration/cliAgent.ts`:

```typescript
import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';

export class CLI AgentCodeIntegration {
  private terminalManager: TerminalManager;
  
  constructor(terminalManager: TerminalManager) {
    this.terminalManager = terminalManager;
  }
  
  async sendToTerminal(content: string): Promise<void> {
    const activeTerminal = this.terminalManager.getActiveTerminal();
    
    if (!activeTerminal) {
      // Create new terminal
      await vscode.commands.executeCommand('sidebarTerminal.splitTerminal');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const terminal = this.terminalManager.getActiveTerminal();
    if (terminal) {
      this.terminalManager.sendInput(terminal, content);
    }
  }
  
  async executeCommand(command: string): Promise<void> {
    await this.sendToTerminal(command + '\n');
  }
}
```

### 3. Update Extension Activation

```typescript
export function activate(context: vscode.ExtensionContext) {
  const terminalManager = new TerminalManager();
  const cliAgentIntegration = new CLI AgentCodeIntegration(terminalManager);
  
  // Register integration commands
  context.subscriptions.push(
    vscode.commands.registerCommand('sidebarTerminal.sendToTerminal', 
      (content: string) => cliAgentIntegration.sendToTerminal(content)
    ),
    vscode.commands.registerCommand('sidebarTerminal.executeInTerminal',
      (command: string) => cliAgentIntegration.executeCommand(command)
    )
  );
}
```

## Testing Integration

1. **Manual Testing**: 
   - Install both extensions
   - Try executing `sidebarTerminal.sendToTerminal` from Command Palette
   - Test with different content types

2. **Automated Testing**:
   ```typescript
   test('CLI Agent integration', async () => {
     await vscode.commands.executeCommand('sidebarTerminal.sendToTerminal', 'test content');
     // Verify content appears in terminal
   });
   ```

## Security Considerations

1. **Input Validation**: Always validate content before sending to terminal
2. **Command Sanitization**: Escape special characters that could execute unintended commands
3. **User Confirmation**: For potentially dangerous commands, ask for user confirmation

## Future Enhancements

1. **Bidirectional Communication**: Send terminal output back to CLI Agent
2. **Context Sharing**: Share terminal state and environment with CLI Agent
3. **Smart Command Detection**: Automatically detect and format commands from CLI Agent
4. **Terminal Selection**: Allow users to choose which terminal receives the content

## Conclusion

While VS Code doesn't provide direct command interception APIs, these approaches offer various ways to integrate with CLI Agent. The best approach depends on:
- Whether CLI Agent exports an API
- The specific integration requirements
- Performance and reliability needs

Start with Approach 4 (Custom Command Registration) as it's the most straightforward and reliable method.