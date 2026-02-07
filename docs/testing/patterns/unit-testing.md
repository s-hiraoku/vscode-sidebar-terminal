# ユニットテストパターン

ユニットテストは個別のクラスや関数を独立してテストします。このガイドでは、VS Code Sidebar Terminal拡張機能で使用する具体的なユニットテストパターンを説明します。

## 目次

- [基本パターン](#基本パターン)
- [VS Code API のモック](#vs-code-api-のモック)
- [非同期処理のテスト](#非同期処理のテスト)
- [イベントエミッターのテスト](#イベントエミッターのテスト)
- [エラーハンドリングのテスト](#エラーハンドリングのテスト)
- [プライベートメソッドのテスト](#プライベートメソッドのテスト)

---

## 基本パターン

### シンプルな関数のテスト

```typescript
// src/utils/StringUtils.ts
export function formatTerminalName(id: number, name?: string): string {
  return name ? `${id}: ${name}` : `Terminal ${id}`;
}

// src/test/unit/utils/StringUtils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTerminalName } from '../../../utils/StringUtils';

describe('StringUtils', () => {
  describe('formatTerminalName', () => {
    it('should format with custom name', () => {
      // Arrange
      const id = 1;
      const name = 'My Terminal';

      // Act
      const result = formatTerminalName(id, name);

      // Assert
      expect(result).toBe('1: My Terminal');
    });

    it('should format without custom name', () => {
      const id = 2;

      const result = formatTerminalName(id);

      expect(result).toBe('Terminal 2');
    });

    it('should handle empty string name', () => {
      const id = 3;
      const name = '';

      const result = formatTerminalName(id, name);

      expect(result).toBe('Terminal 3');
    });
  });
});
```

### クラスメソッドのテスト

```typescript
// src/services/ConfigurationService.ts
export class ConfigurationService {
  constructor(private config: vscode.WorkspaceConfiguration) {}

  getShell(): string {
    return this.config.get<string>('shell') || '/bin/bash';
  }

  getFontSize(): number {
    const size = this.config.get<number>('fontSize');
    return size && size > 0 ? size : 14;
  }
}

// src/test/unit/services/ConfigurationService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ConfigurationService } from '../../../services/ConfigurationService';

describe('ConfigurationService', () => {

  let mockConfig: any;
  let service: ConfigurationService;

  beforeEach(() => {

    mockConfig = {
      get: vi.fn()
    };
    service = new ConfigurationService(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getShell', () => {
    it('should return configured shell', () => {
      mockConfig.get.mockReturnValue('/bin/zsh');

      const result = service.getShell();

      expect(result).toBe('/bin/zsh');
    });

    it('should return default shell when not configured', () => {
      mockConfig.get.mockReturnValue(undefined);

      const result = service.getShell();

      expect(result).toBe('/bin/bash');
    });
  });

  describe('getFontSize', () => {
    it('should return configured font size', () => {
      mockConfig.get.mockReturnValue(16);

      const result = service.getFontSize();

      expect(result).toBe(16);
    });

    it('should return default when size is invalid', () => {
      mockConfig.get.mockReturnValue(0);

      const result = service.getFontSize();

      expect(result).toBe(14);
    });

    it('should return default when not configured', () => {
      mockConfig.get.mockReturnValue(undefined);

      const result = service.getFontSize();

      expect(result).toBe(14);
    });
  });
});
```

---

## VS Code API のモック

### WorkspaceConfiguration のモック

```typescript
import { mockVscode } from '../../shared/TestSetup';

describe('Settings Manager', () => {
  beforeEach(() => {
    // 設定値のモック
    mockVscode.workspace.getConfiguration.mockImplementation((section: string) => ({
      get: (key: string) => {
        if (section === 'secondaryTerminal' && key === 'shell') {
          return '/bin/bash';
        }
        if (section === 'secondaryTerminal' && key === 'fontSize') {
          return 14;
        }
        return undefined;
      },
      update: vi.fn().mockResolvedValue(undefined),
      has: (key: string) => true,
      inspect: vi.fn()
    }));
  });

  it('should read configuration', () => {
    const config = mockVscode.workspace.getConfiguration('secondaryTerminal');
    expect(config.get('shell')).toBe('/bin/bash');
  });
});
```

### ExtensionContext のモック

```typescript
describe('Extension Activation', () => {
  let mockContext: vscode.ExtensionContext;


  beforeEach(() => {

    mockContext = {
      subscriptions: [],
      globalState: {
        get: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
        keys: vi.fn().mockReturnValue([])
      },
      workspaceState: {
        get: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
        keys: vi.fn().mockReturnValue([])
      },
      extensionPath: '/mock/extension/path',
      storagePath: '/mock/storage/path',
      globalStoragePath: '/mock/global/storage',
      logPath: '/mock/log/path'
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save data to globalState', async () => {
    await mockContext.globalState.update('key', 'value');

    expect(mockContext.globalState.update).toHaveBeenCalledWith('key', 'value');
  });
});
```

---

## 非同期処理のテスト

### Promise ベースの非同期処理

```typescript
// src/services/StorageService.ts
export class StorageService {
  async saveSession(data: SessionData): Promise<void> {
    await this.storage.update('session', data);
  }

  async loadSession(): Promise<SessionData | undefined> {
    return this.storage.get<SessionData>('session');
  }
}

// テスト
describe('StorageService', () => {

  let mockStorage: any;
  let service: StorageService;

  beforeEach(() => {

    mockStorage = {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined)
    };
    service = new StorageService(mockStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveSession', () => {
    it('should save session data', async () => {
      const data = { terminals: [{ id: 1, name: 'test' }] };

      await service.saveSession(data);

      expect(mockStorage.update).toHaveBeenCalledWith('session', data);
    });

    it('should handle save errors', async () => {
      mockStorage.update.mockRejectedValue(new Error('Storage error'));

      await expect(service.saveSession({})).rejects.toThrow('Storage error');
    });
  });

  describe('loadSession', () => {
    it('should load session data', async () => {
      const data = { terminals: [{ id: 1 }] };
      mockStorage.get.mockResolvedValue(data);

      const result = await service.loadSession();

      expect(result).toEqual(data);
    });

    it('should return undefined when no data', async () => {
      mockStorage.get.mockResolvedValue(undefined);

      const result = await service.loadSession();

      expect(result).toBeUndefined();
    });
  });
});
```

### タイムアウトを伴う非同期処理

```typescript
describe('Delayed Operations', () => {
  it('should complete within timeout', async () => {
    const result = await longRunningOperation();

    expect(result).toBeTruthy();
  }, 5000); // 5秒タイムアウト

  it('should use fake timers for time-based logic', () => {
    const clock = vi.useFakeTimers();

    const callback = vi.fn();
    setTimeout(callback, 1000);

    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
```

---

## イベントエミッターのテスト

### EventEmitter のモック

```typescript
// src/services/TerminalEventService.ts
export class TerminalEventService {
  private emitter = new EventEmitter<TerminalEvent>();

  onData(listener: (data: string) => void): Disposable {
    return this.emitter.event(listener);
  }

  emitData(data: string): void {
    this.emitter.fire({ type: 'data', data });
  }
}

// テスト
describe('TerminalEventService', () => {
  let service: TerminalEventService;

  beforeEach(() => {
    service = new TerminalEventService();
  });

  it('should emit data events', () => {
    const listener = vi.fn();

    service.onData(listener);
    service.emitData('test data');

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith('test data');
  });

  it('should handle multiple listeners', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    service.onData(listener1);
    service.onData(listener2);
    service.emitData('test');

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('should dispose listeners', () => {
    const listener = vi.fn();

    const disposable = service.onData(listener);
    disposable.dispose();
    service.emitData('test');

    expect(listener).not.toHaveBeenCalled();
  });
});
```

---

## エラーハンドリングのテスト

### 例外のテスト

```typescript
describe('Error Handling', () => {
  it('should throw error for invalid input', () => {
    expect(() => {
      validateTerminalId(-1);
    }).toThrow('Invalid terminal ID');
  });

  it('should throw specific error type', () => {
    expect(() => {
      processData(null);
    }).toThrow(TypeError);
  });
});
```

### 非同期エラーのテスト

```typescript
describe('Async Error Handling', () => {
  it('should reject with error', async () => {
    await expect(
      service.loadInvalidData()
    ).rejects.toThrow('Data not found');
  });

  it('should handle rejection gracefully', async () => {
    vi.spyOn(service, 'load').mockRejectedValue(new Error('Load failed'));

    try {
      await service.loadWithFallback();
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('Load failed');
    }
  });
});
```

---

## プライベートメソッドのテスト

### アプローチ1: パブリックメソッド経由でテスト（推奨）

```typescript
// プライベートメソッドは直接テストせず、パブリックメソッド経由で検証
describe('DataProcessor', () => {
  it('should process data correctly', () => {
    // Given
    const processor = new DataProcessor();
    const input = 'raw data';

    // When: パブリックメソッドを呼ぶ
    const result = processor.process(input);

    // Then: プライベートメソッドの動作も間接的に検証される
    expect(result).toBe('PROCESSED: raw data');
  });
});
```

### アプローチ2: 型アサーションでアクセス（非推奨）

```typescript
// 必要な場合のみ使用
describe('DataProcessor - Internal Logic', () => {
  it('should sanitize data internally', () => {
    const processor = new DataProcessor();

    // 型アサーションでプライベートメソッドにアクセス
    const result = (processor as any).sanitize('  data  ');

    expect(result).toBe('data');
  });
});
```

**注意**: プライベートメソッドを直接テストする必要がある場合、それは設計の見直しのシグナルかもしれません。プライベートメソッドのロジックが複雑な場合は、別のクラスとして抽出することを検討してください。

---

## テストデータの管理

### ファクトリーパターン

```typescript
// src/test/utils/TestDataFactory.ts
export function createTestTerminal(overrides = {}): Terminal {
  return {
    id: 1,
    name: 'Test Terminal',
    isActive: true,
    scrollback: [],
    cwd: '/home/user',
    ...overrides
  };
}

export function createTestSession(overrides = {}): Session {
  return {
    id: 'session-1',
    terminals: [createTestTerminal()],
    timestamp: Date.now(),
    ...overrides
  };
}

// テストで使用
describe('TerminalManager', () => {
  it('should handle terminal with custom data', () => {
    const terminal = createTestTerminal({
      name: 'Custom Terminal',
      scrollback: ['line1', 'line2']
    });

    manager.addTerminal(terminal);

    expect(manager.getTerminal(terminal.id)).toEqual(terminal);
  });
});
```

---

## ベストプラクティス

### ✅ Do

- 各テストは独立させる
- beforeEach/afterEach でクリーンアップ
- 明確な命名規則を使用
- AAAパターン（Arrange-Act-Assert）に従う
- モックは sandbox で管理

### ❌ Don't

- テスト間で状態を共有しない
- グローバル変数に依存しない
- 実際のファイルI/Oを使用しない
- 複数の動作を1つのテストでテストしない
- マジックナンバーを使用しない

---

## 参考

- [ベストプラクティス](../best-practices.md)
- [トラブルシューティング](../troubleshooting.md)
- [統合テストパターン](./integration-testing.md)

---

**最終更新**: 2025-11-08
