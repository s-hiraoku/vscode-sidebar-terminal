# Spec: Standardize Error Handling

## ADDED Requirements

### Requirement: ErrorHandler ユーティリティの作成

システムSHALL ErrorHandler ユーティリティを作成し、すべてのエラーハンドリングを統一パターンで実装すること。

#### Scenario: 統一されたエラー処理

**Given** 15+箇所でエラーハンドリングパターンが異なる
**When** ErrorHandler.handleOperationError() を実装する
**Then** operation名、error、optionsを受け取る
**And** severity level（error, warn, info）に応じた処理ができる
**And** ログ形式が統一される（絵文字含む）
**And** notify, rethrow, recoveryオプションをサポートする

#### Scenario: エラーログの一貫性

**Given** ErrorHandlerが実装されている
**When** エラーが発生する
**Then** `[絵文字] operation名 failed` の形式でログされる
**And** severity に応じた絵文字が使用される（❌=error, ⚠️=warn, ℹ️=info）
**And** スタックトレースが適切に記録される

## MODIFIED Requirements

### Requirement: 既存エラーハンドリングの移行

システムSHALL すべての既存エラーハンドリングコードを ErrorHandler 使用に移行すること。

#### Scenario: try-catchブロックの標準化

**Given** 15+箇所で異なるエラー処理パターンが使用されている
**When** ErrorHandlerに移行する
**Then** すべて `ErrorHandler.handleOperationError()` 呼び出しになる
**And** 合計75行の重複コードが削除される
**And** エラーログ形式が統一される

## REMOVED Requirements

なし

## Related Capabilities

- **split-lifecycle-manager**: 各サービスでErrorHandlerを使用
- **unify-addon-loading**: AddonLoaderでErrorHandlerを使用
- **unify-message-handlers**: BaseMessageHandlerでErrorHandlerを使用

## Implementation Notes

### Technical Approach

```typescript
class ErrorHandler {
  static handleOperationError(
    operation: string,
    error: unknown,
    options: ErrorOptions = {}
  ): void {
    const message = `${getSeverityEmoji(options.severity)} ${operation} failed`;
    log(options.severity, message, error);
    if (options.notify) notifyUser(message);
    if (options.recovery) options.recovery();
    if (options.rethrow) throw error;
  }
}
```

### Performance Targets

- コード重複: 75行 → 0行
- 一貫性: 100%統一された形式
