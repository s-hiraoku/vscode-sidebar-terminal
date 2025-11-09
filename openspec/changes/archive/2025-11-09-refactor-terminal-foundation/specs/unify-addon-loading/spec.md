# Spec: Unify Addon Loading

## ADDED Requirements

### Requirement: AddonLoader ユーティリティの作成

システムSHALL AddonLoader ユーティリティを作成し、すべてのアドオンローディングを統一パターンで実装すること。

#### Scenario: 統一されたアドオンローディング

**Given** 5箇所でアドオンローディングコードが重複している（85%類似）
**When** AddonLoader.loadAddon() を実装する
**Then** 統一されたインターフェースでアドオンをロードできる
**And** required/optional設定をサポートする
**And** 自動的にエラーハンドリングされる
**And** fallbackオプションをサポートする

#### Scenario: 動的アドオンインポート

**Given** AddonLoaderが実装されている
**When** アドオンタイプを指定してloadAddon()を呼ぶ
**Then** 動的import()でアドオンがロードされる
**And** ロード成功時はアドオンインスタンスが返される
**And** ロード失敗時はundefinedまたはエラーが返される

## MODIFIED Requirements

### Requirement: 既存アドオンローディングの移行

システムSHALL すべての既存アドオンローディングコードを AddonLoader 使用に移行すること。

#### Scenario: WebglAddon の移行

**Given** WebglAddonローディングが手動実装されている
**When** AddonLoaderに移行する
**Then** `await addonLoader.loadAddon(terminal, 'webgl', { required: false, fallback: 'dom' })` で実装される
**And** 重複コードが削除される

#### Scenario: その他アドオンの移行

**Given** SerializeAddon, SearchAddon, Unicode11Addon等が手動実装されている
**When** AddonLoaderに移行する
**Then** すべて統一されたloadAddon()呼び出しになる
**And** 合計50行の重複コードが削除される

## REMOVED Requirements

なし

## Related Capabilities

- **split-lifecycle-manager**: TerminalAddonManagerと統合
- **standardize-error-handling**: ErrorHandlerと連携

## Implementation Notes

### Technical Approach

```typescript
class AddonLoader {
  async loadAddon<T>(
    terminal: Terminal,
    addonType: AddonType,
    config?: AddonConfig
  ): Promise<T | undefined> {
    try {
      const Addon = await this.importAddon(addonType);
      const addon = new Addon();
      terminal.loadAddon(addon);
      return addon;
    } catch (error) {
      if (config?.required) throw error;
      return undefined;
    }
  }
}
```

### Performance Targets

- コード重複: 50行 → 0行
- 保守性: 5箇所の修正 → 1箇所の修正
