# Claude Code Integration - Issue #99 調査結果

## 問題の概要
VS Code標準ターミナルでは、CMD + OPT + K（⌘ + ⌥ + K）を押すとClaude Codeの`claude-code.insertAtMentioned`コマンドが実行され、現在のエディタファイルの`@ファイル名`がターミナルに挿入されますが、このサイドバーターミナル拡張では同機能が動作しませんでした。

## 調査結果

### 1. Claude Code拡張機能の動作仕様
調査の結果、Claude Code拡張機能は以下の仕様で動作していることが判明しました：

- `claude-code.insertAtMentioned`コマンドは**引数なし**で呼び出される
- テキストデータは引数として渡されない（`Arguments length: 0`）
- 受け取り側（ターミナル拡張機能）が現在のエディタコンテキストから情報を取得することを期待

### 2. 実装した解決策

#### A. コマンドハンドラーの改修
```typescript
{
  command: 'claude-code.insertAtMentioned',
  callback: (...args: unknown[]) => {
    // 引数が空の場合の処理を追加
    if (args.length === 0) {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const fileName = activeEditor.document.fileName;
        const baseName = fileName.split('/').pop() || fileName.split('\\').pop() || fileName;
        text = `@${baseName}`; // @filename.ts 形式で生成
      }
    }
  },
}
```

#### B. メッセージフロー
1. CMD + OPT + K 押下
2. Claude Code拡張機能が`claude-code.insertAtMentioned`コマンドを実行（引数なし）
3. サイドバーターミナル拡張機能がコマンドを受信
4. アクティブエディタからファイル名を取得
5. `@ファイル名`形式でターミナルに挿入

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
- Claude Code拡張機能の既存の実装と完全互換
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

## まとめ
Claude Code拡張機能は、VS Code標準のAPIを活用してエディタコンテキストから情報を取得する設計になっていました。この仕様を理解し、適切に実装することで、サイドバーターミナル拡張機能でもClaude Codeとのシームレスな連携が実現できました。

---

# Claude Code Integration Guide (General)

This document also outlines general strategies for integrating the Sidebar Terminal extension with Claude Code and other VS Code extensions.

## Overview

VS Code doesn't provide a built-in API to intercept commands from other extensions. However, there are several approaches to achieve integration:

## Approach 1: Command Interception (Experimental)

You can intercept commands by registering your own command with the same identifier. This requires careful handling to avoid infinite loops.

```typescript
// In extension.ts
export function activate(context: vscode.ExtensionContext) {
  // Store the original disposable
  let interceptDisposable: vscode.Disposable | undefined;
  
  // Function to intercept claude-code.insertAtMentioned
  async function interceptClaudeCodeCommand(...args: any[]) {
    // Dispose our command to avoid infinite loop
    interceptDisposable?.dispose();
    
    try {
      // Log the intercepted command
      console.log('Intercepted claude-code.insertAtMentioned:', args);
      
      // Execute the original command
      await vscode.commands.executeCommand('claude-code.insertAtMentioned', ...args);
      
      // After execution, we could trigger our terminal action
      // For example, send the content to our terminal
      if (args[0] && typeof args[0] === 'string') {
        await vscode.commands.executeCommand('sidebarTerminal.sendToTerminal', args[0]);
      }
    } finally {
      // Re-register the interceptor
      interceptDisposable = vscode.commands.registerCommand(
        'claude-code.insertAtMentioned',
        interceptClaudeCodeCommand
      );
      context.subscriptions.push(interceptDisposable);
    }
  }
  
  // Initial registration
  interceptDisposable = vscode.commands.registerCommand(
    'claude-code.insertAtMentioned',
    interceptClaudeCodeCommand
  );
  context.subscriptions.push(interceptDisposable);
}
```

## Approach 2: Extension API Communication

If Claude Code exports an API, you can directly communicate with it:

```typescript
// In extension.ts
export function activate(context: vscode.ExtensionContext) {
  // Try to get Claude Code extension
  const claudeCodeExt = vscode.extensions.getExtension('anthropic.claude-code');
  
  if (claudeCodeExt) {
    // Wait for activation if needed
    const claudeCodeApi = claudeCodeExt.isActive 
      ? claudeCodeExt.exports 
      : await claudeCodeExt.activate();
    
    if (claudeCodeApi) {
      // Use the API if available
      console.log('Claude Code API:', claudeCodeApi);
      
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

Monitor file changes when Claude Code modifies files:

```typescript
// Watch for file changes
const watcher = vscode.workspace.createFileSystemWatcher('**/*');

watcher.onDidChange((uri) => {
  // Check if change was made by Claude Code
  // This requires pattern detection or timing analysis
  console.log('File changed:', uri.fsPath);
});

context.subscriptions.push(watcher);
```

## Approach 4: Custom Command Registration

Register your own commands that Claude Code users can invoke:

```typescript
// Register a command for Claude Code integration
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

Monitor clipboard changes when Claude Code copies content:

```typescript
let lastClipboardContent = '';

// Poll clipboard for changes
setInterval(async () => {
  const currentContent = await vscode.env.clipboard.readText();
  if (currentContent !== lastClipboardContent) {
    lastClipboardContent = currentContent;
    
    // Check if it's from Claude Code (requires pattern matching)
    if (isClaudeCodeContent(currentContent)) {
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

Create `src/integration/claudeCode.ts`:

```typescript
import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';

export class ClaudeCodeIntegration {
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
  const claudeCodeIntegration = new ClaudeCodeIntegration(terminalManager);
  
  // Register integration commands
  context.subscriptions.push(
    vscode.commands.registerCommand('sidebarTerminal.sendToTerminal', 
      (content: string) => claudeCodeIntegration.sendToTerminal(content)
    ),
    vscode.commands.registerCommand('sidebarTerminal.executeInTerminal',
      (command: string) => claudeCodeIntegration.executeCommand(command)
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
   test('Claude Code integration', async () => {
     await vscode.commands.executeCommand('sidebarTerminal.sendToTerminal', 'test content');
     // Verify content appears in terminal
   });
   ```

## Security Considerations

1. **Input Validation**: Always validate content before sending to terminal
2. **Command Sanitization**: Escape special characters that could execute unintended commands
3. **User Confirmation**: For potentially dangerous commands, ask for user confirmation

## Future Enhancements

1. **Bidirectional Communication**: Send terminal output back to Claude Code
2. **Context Sharing**: Share terminal state and environment with Claude Code
3. **Smart Command Detection**: Automatically detect and format commands from Claude Code
4. **Terminal Selection**: Allow users to choose which terminal receives the content

## Conclusion

While VS Code doesn't provide direct command interception APIs, these approaches offer various ways to integrate with Claude Code. The best approach depends on:
- Whether Claude Code exports an API
- The specific integration requirements
- Performance and reliability needs

Start with Approach 4 (Custom Command Registration) as it's the most straightforward and reliable method.