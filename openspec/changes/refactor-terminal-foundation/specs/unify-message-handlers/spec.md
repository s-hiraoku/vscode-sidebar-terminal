# Spec: Unify Message Handlers

## ADDED Requirements

### Requirement: BaseMessageHandler 基底クラスの作成

システムSHALL BaseMessageHandler 抽象基底クラスを作成し、すべてのメッセージハンドラーで共通パターンを提供すること。

#### Scenario: 共通パターンの抽出

**Given** 9つのメッセージハンドラーが70%構造を共有している
**When** BaseMessageHandler を作成する
**Then** abstract handleMessage() メソッドを定義する
**And** protected validate() 共通バリデーションを提供する
**And** protected handleError() 共通エラー処理を提供する
**And** dispose() 共通クリーンアップを提供する

#### Scenario: 型安全な基底クラス

**Given** BaseMessageHandlerが実装されている
**When** ジェネリック型 `BaseMessageHandler<T extends WebViewMessage>` を使用する
**Then** 型安全なメッセージハンドリングが実現される
**And** コンパイル時に型チェックが行われる

## MODIFIED Requirements

### Requirement: 既存メッセージハンドラーの移行

システムSHALL すべての既存メッセージハンドラーを BaseMessageHandler 継承に移行すること。

#### Scenario: 9つのハンドラーの統一

**Given** 9つのハンドラーが独立して実装されている
**When** BaseMessageHandlerを継承する
**Then** すべてのハンドラーが同じ基底クラスを持つ
**And** 共通処理（validation, error handling, dispose）が基底クラスに移動する
**And** ハンドラー固有のロジックのみが残る
**And** 合計180行の重複コードが削除される

#### Scenario: ハンドラー実装の簡素化

**Given** BaseMessageHandlerを継承している
**When** 新しいハンドラーを実装する
**Then** handleMessage()のみを実装すればよい
**And** validation, error handling, disposeは自動的に提供される

## REMOVED Requirements

なし

## Related Capabilities

- **standardize-error-handling**: BaseMessageHandlerでErrorHandlerを使用
- **split-lifecycle-manager**: TerminalLifecycleMessageHandlerが移行対象

## Implementation Notes

### Technical Approach

```typescript
abstract class BaseMessageHandler<T extends WebViewMessage> {
  constructor(protected logger: (msg: string) => void) {}

  abstract handleMessage(msg: T, coordinator: IManagerCoordinator): void;

  protected validate(msg: T): boolean {
    // Common validation logic
  }

  protected handleError(error: unknown, context: string): void {
    ErrorHandler.handleOperationError(context, error);
  }

  dispose(): void {
    // Common cleanup
  }
}
```

### Performance Targets

- コード重複: 180行 → 0行
- 新規ハンドラー実装: 大幅簡素化
