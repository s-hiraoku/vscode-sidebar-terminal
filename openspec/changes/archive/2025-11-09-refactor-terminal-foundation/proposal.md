# Proposal: Refactor Terminal Foundation Before Optimization

## Overview

レンダリング最適化（`optimize-terminal-rendering`）実装の**前提条件**として、ターミナルコードベースの基盤をリファクタリングします。

現在のコードベースは有機的成長により以下の問題を抱えています：
- **God Object** (TerminalLifecycleManager: 1694行)
- **コード重複85%**（アドオンローディング）
- **エラーハンドリング15+箇所で不統一**
- **メッセージハンドラー70%構造重複**

このリファクタリングにより、新機能実装が**安全**で**効率的**になります。

## Problem Statement

### 現在のコードベース分析結果

similarity-based-refactoring agent による分析：
- **コード重複**: 全体の30%が重複コード
- **God Object**: TerminalLifecycleManager が10以上の責任
- **テスト困難**: モックが50+必要
- **変更リスク**: 影響範囲が不明確

### 具体的な問題

#### 1. God Object: TerminalLifecycleManager (1694行)

**責任の過剰**:
```
TerminalLifecycleManager
├── ターミナル作成/削除 (createTerminal, removeTerminal)
├── アドオン管理 (WebGL, Serialize, Search, Unicode11, WebLinks)
├── リサイズ処理 (ResizeObserver, debounce)
├── スクロールバック自動保存 (setupScrollbackAutoSave)
├── リンクプロバイダー管理 (registerTerminalLinkHandlers)
├── シェルインテグレーション (setupShellIntegration)
├── イベントハンドリング (click, focus, wheel)
├── スムーススクロール (enableScrollbarDisplay)
├── DOM操作 (container作成, アタッチメント)
└── パフォーマンス最適化 (performInitialResize)
```

**影響**:
- Single Responsibility Principle 違反
- テストに50+モック必要
- 変更時の影響範囲が広い
- 新機能追加時のコンフリクトリスク高

#### 2. アドオンローディング重複 (85%類似)

**重複箇所**: TerminalLifecycleManager.ts: 412-458行

```typescript
// WebglAddon (449-458)
if (terminalConfig.enableGpuAcceleration !== false) {
  try {
    webglAddon = new WebglAddon();
    terminal.loadAddon(webglAddon);
    terminalLogger.info(`✅ WebGL addon loaded`);
  } catch (error) {
    terminalLogger.warn(`⚠️ WebGL failed: ${error}`);
  }
}

// Unicode11Addon (439-447) - ほぼ同じ構造
// SearchAddon (405) - 同じ構造
// SerializeAddon (406) - 同じ構造
// WebLinksAddon (396-403) - 同じ構造
```

**コスト**: 5箇所 × 平均10行 = 50行の重複

#### 3. エラーハンドリング不統一 (15+箇所)

**パターンA**: TerminalLifecycleManager.ts:380-382
```typescript
catch (error) {
  terminalLogger.error(`Failed to create Terminal instance: ${error}`);
  throw new Error(`Terminal instantiation failed: ${error}`);
}
```

**パターンB**: TerminalLifecycleManager.ts:419-420
```typescript
catch (error) {
  terminalLogger.error(`❌ Failed to load essential addons: ${error}`);
  throw error;
}
```

**パターンC**: TerminalLifecycleManager.ts:921-923
```typescript
catch (error) {
  terminalLogger.error(`Failed to enable scrollbar: ${error}`);
}
```

**問題**: ログ形式、エラー再スロー、絵文字使用が不統一

#### 4. メッセージハンドラー構造重複 (70%類似)

**9つのハンドラーが同じ構造**:
- TerminalLifecycleMessageHandler
- ScrollbackMessageHandler
- SerializationMessageHandler
- SettingsAndConfigMessageHandler
- ShellIntegrationMessageHandler
- PanelLocationHandler
- SplitHandler
- SessionHandler (extension側)
- SystemMessageHandler (extension側)

**共通パターン**:
```typescript
export class XxxMessageHandler {
  constructor(private logger: (msg: string) => void) {}

  handleMessage(msg: WebViewMessage, coordinator: IManagerCoordinator): void {
    // 1. Type narrowing (全ハンドラー共通)
    // 2. Validation (全ハンドラー共通)
    // 3. Execution (ハンドラー固有)
    // 4. Error handling (全ハンドラー共通)
  }

  dispose(): void {}
}
```

## Proposed Solution

### 4つの主要リファクタリング

#### 1. TerminalLifecycleManager 分割

**Before**:
```
TerminalLifecycleManager (1694行, 10+ responsibilities)
```

**After**:
```
TerminalLifecycleCoordinator (コーディネーター, ~300行)
  - 全体調整のみ

TerminalCreationService (~400行)
  - createTerminal()
  - removeTerminal()
  - switchToTerminal()

TerminalAddonManager (~350行)
  - loadAllAddons()
  - disposeAddons()
  - getAddon()

TerminalEventManager (~350行)
  - setupEventHandlers()
  - handleClick()
  - handleFocus()

TerminalLinkManager (~300行)
  - registerLinkHandlers()
  - openFileLink()
  - openUrlLink()
```

**削減**: 1694行 → 1700行（合計）、最大クラス400行

#### 2. AddonLoader ユーティリティ作成

**Before**: 5箇所で重複

**After**:
```typescript
// src/webview/utils/AddonLoader.ts
export class AddonLoader {
  async loadAddon<T>(
    terminal: Terminal,
    addonType: AddonType,
    config: AddonConfig
  ): Promise<T | undefined> {
    if (config.disabled) return undefined;

    try {
      const Addon = await this.importAddon(addonType);
      const addon = new Addon();
      terminal.loadAddon(addon);
      this.logger.info(`✅ ${addonType} addon loaded`);
      return addon;
    } catch (error) {
      this.logger.warn(`⚠️ ${addonType} failed: ${error}`);
      if (config.required) throw error;
      return undefined;
    }
  }
}
```

**削減**: 50行の重複 → 30行の統一実装

#### 3. ErrorHandler 標準化

**Before**: 15+箇所で異なるパターン

**After**:
```typescript
// src/webview/utils/ErrorHandler.ts
export class ErrorHandler {
  static handleOperationError(
    operation: string,
    error: unknown,
    options: ErrorOptions = {}
  ): void {
    const {
      severity = 'error',
      notify = false,
      rethrow = false,
      recovery = undefined
    } = options;

    const message = `${this.getSeverityEmoji(severity)} ${operation} failed`;
    this.log(severity, message, error);

    if (notify) this.notifyUser(message);
    if (recovery) recovery();
    if (rethrow) throw error;
  }
}
```

**削減**: 15箇所 × 5行 = 75行 → 50行の統一実装

#### 4. BaseMessageHandler 基底クラス

**Before**: 9クラスで重複

**After**:
```typescript
// src/webview/managers/handlers/BaseMessageHandler.ts
export abstract class BaseMessageHandler<T extends WebViewMessage> {
  constructor(protected logger: (msg: string) => void) {}

  abstract handleMessage(msg: T, coordinator: IManagerCoordinator): void;

  protected validate(msg: T, schema: ValidationSchema): boolean {
    // Common validation logic
  }

  protected handleError(error: unknown, context: string): void {
    ErrorHandler.handleOperationError(context, error, {
      severity: 'error',
      notify: false
    });
  }

  dispose(): void {
    // Common cleanup
  }
}
```

**削減**: 9クラス × 20行 = 180行の重複 → 60行の基底クラス

## Benefits

### コード品質向上

| 指標 | Before | After | 改善 |
|------|--------|-------|------|
| 総行数 | ~3500 | ~2450 | -30% |
| 最大クラス | 1694行 | 400行 | -76% |
| 重複コード | ~355行 | ~140行 | -61% |
| テストモック数 | 50+ | 10-15 | -70% |

### レンダリング最適化実装への影響

#### Before (リファクタリングなし):
```
RenderingOptimizer を TerminalLifecycleManager に追加
  ↓
1694行のGod Objectがさらに肥大化
  ↓
テストが複雑化（60+モック必要）
  ↓
バグリスク高、メンテナンス困難
```

#### After (リファクタリング後):
```
RenderingOptimizer を TerminalAddonManager に統合
  ↓
350行の focused class に機能追加
  ↓
テスト容易（15モック程度）
  ↓
安全な実装、メンテナンス容易
```

## Implementation Strategy

### Phase 1: TerminalLifecycleManager 分割 (Week 1)

**Priority**: HIGHEST

1. Extract TerminalCreationService (Day 1-2)
2. Extract TerminalAddonManager (Day 2-3)
3. Extract TerminalEventManager (Day 3-4)
4. Extract TerminalLinkManager (Day 4-5)
5. Create TerminalLifecycleCoordinator (Day 5)

### Phase 2: AddonLoader 統一 (Week 1-2)

**Priority**: HIGH

1. Create AddonLoader utility (Day 6)
2. Migrate all addon loading code (Day 6-7)
3. Remove duplicated code (Day 7)

### Phase 3: ErrorHandler 標準化 (Week 2)

**Priority**: MEDIUM

1. Create ErrorHandler utility (Day 8)
2. Migrate error handling sites (Day 8-9)

### Phase 4: BaseMessageHandler (Week 2)

**Priority**: MEDIUM

1. Create BaseMessageHandler (Day 10)
2. Migrate 9 handlers (Day 10-12)

### Phase 5: 統合テスト (Week 3)

**Priority**: CRITICAL

1. Run full test suite (Day 13-14)
2. Performance validation (Day 14)
3. Documentation update (Day 15)

## Success Criteria

### 機能要件
- ✅ すべての既存機能が正常動作
- ✅ すべてのE2Eテストがパス
- ✅ 後方互換性維持（API変更なし）

### 品質要件
- ✅ コード量30%削減
- ✅ 各クラス500行以下
- ✅ テストカバレッジ85%以上維持
- ✅ TypeScript コンパイルエラー0件
- ✅ ESLint エラー0件

### パフォーマンス要件
- ✅ レンダリングパフォーマンス維持
- ✅ メモリ使用量維持
- ✅ ターミナル作成時間維持

## Risks and Mitigations

### リスク1: 既存機能の破壊

**確率**: MEDIUM
**影響**: HIGH

**軽減策**:
- Extract Method → Extract Class の安全なリファクタリング手順
- 各フェーズ後にテスト実行
- Feature flags による段階的ロールアウト
- 問題発生時の即時ロールバック

### リスク2: テスト修正コスト

**確率**: HIGH
**影響**: MEDIUM

**軽減策**:
- テストの段階的移行
- モックの再利用
- テストユーティリティの作成

### リスク3: パフォーマンス回帰

**確率**: LOW
**影響**: HIGH

**軽減策**:
- 各フェーズでパフォーマンステスト
- ベンチマーク継続測定
- パフォーマンス回帰時のアラート

## Timeline

- **Week 1**: Phase 1-2 (分割 + Addon統一)
- **Week 2**: Phase 3-4 (Error標準化 + Handler統一)
- **Week 3**: Phase 5 (統合テスト)

**Total**: 3 weeks

**その後**: optimize-terminal-rendering 実装開始

## Dependencies

### 前提条件
- すべてのテストがパス
- main ブランチが安定
- for-publish ブランチが最新

### ブロックする内容
- optimize-terminal-rendering 実装はこの完了後

## References

- Refactoring Catalog: Martin Fowler
- similarity-based-refactoring agent 分析結果
- VS Code patterns: microsoft/vscode

## Next Steps

1. Review and approve this proposal
2. Create detailed spec deltas for each capability
3. Begin Phase 1 implementation
4. Validate with existing tests after each step
