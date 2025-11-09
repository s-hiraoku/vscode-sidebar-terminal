# Spec: Split TerminalLifecycleManager

## ADDED Requirements

### Requirement: TerminalCreationService の抽出

システムSHALL TerminalCreationService をTerminalLifecycleManager から抽出し、ターミナル作成ロジックを独立したサービスとして提供すること。

#### Scenario: ターミナル作成サービスの独立化

**Given** TerminalLifecycleManagerが1694行のGod Objectである
**When** TerminalCreationServiceを抽出する
**Then** createTerminal(), removeTerminal(), switchToTerminal() が独立したサービスになる
**And** サービスクラスは400行以下になる
**And** 単体テストが容易になる

### Requirement: TerminalAddonManager の抽出

システムSHALL TerminalAddonManager をTerminalLifecycleManager から抽出し、アドオン管理を専門化すること。

#### Scenario: アドオン管理の専門化

**Given** アドオンローディングロジックが複数箇所に散在している
**When** TerminalAddonManagerを抽出する
**Then** すべてのアドオン管理が一箇所に集約される
**And** loadAllAddons(), disposeAddons(), getAddon() が提供される
**And** 350行以下のfocused classになる

### Requirement: TerminalEventManager の抽出

システムSHALL TerminalEventManager をTerminalLifecycleManager から抽出し、イベント処理を専門化すること。

#### Scenario: イベント処理の専門化

**Given** イベントハンドリングロジックが混在している
**When** TerminalEventManagerを抽出する
**Then** click, focus, wheel等のイベント処理が独立する
**And** 350行以下のfocused classになる

### Requirement: TerminalLinkManager の抽出

システムSHALL TerminalLinkManager をTerminalLifecycleManager から抽出し、リンク処理を専門化すること。

#### Scenario: リンク処理の専門化

**Given** リンクハンドリングロジックが混在している
**When** TerminalLinkManagerを抽出する
**Then** ファイルリンク・URLリンク処理が独立する
**And** 300行以下のfocused classになる

## MODIFIED Requirements

### Requirement: TerminalLifecycleManager の Coordinator化

システムSHALL TerminalLifecycleManager を TerminalLifecycleCoordinator にリファクタリングし、調整役に特化すること。

#### Scenario: Coordinatorへの変換

**Given** 抽出されたサービスが存在する
**When** TerminalLifecycleCoordinator を作成する
**Then** すべてのサービスが依存性注入される
**And** メソッド呼び出しは適切なサービスに委譲される
**And** Coordinatorは300行以下になる
**And** 既存のAPIインターフェースは維持される

## REMOVED Requirements

なし

## Related Capabilities

- **unify-addon-loading**: AddonLoader統一と連携
- **standardize-error-handling**: ErrorHandler標準化と連携
- **unify-message-handlers**: BaseMessageHandler統一と連携

## Implementation Notes

### Technical Approach

Extract Class リファクタリングパターンを使用：
1. 関連メソッドのグループを特定
2. 新しいクラスを作成
3. メソッドを移動
4. 元のクラスから新しいクラスを呼び出す

### Performance Targets

- クラスサイズ: 1694行 → 各クラス500行以下
- テスト容易性: 50+モック → 10-15モック/クラス
- 変更影響範囲: 明確化

### Testing Strategy

- 各抽出サービスの単体テスト
- Coordinatorの統合テスト
- E2Eテストで既存機能の検証
