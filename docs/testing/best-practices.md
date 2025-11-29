# テストベストプラクティス

VS Code Sidebar Terminal拡張機能のテストを作成する際のベストプラクティス集です。

## 目次

- [テスト作成の原則](#テスト作成の原則)
- [テスト構造](#テスト構造)
- [非同期テスト](#非同期テスト)
- [モックとスタブ](#モックとスタブ)
- [テストの命名規則](#テストの命名規則)
- [テストの独立性](#テストの独立性)
- [エラーハンドリング](#エラーハンドリング)
- [パフォーマンス](#パフォーマンス)

---

## テスト作成の原則

### 1. AAA パターン (Arrange-Act-Assert)

すべてのテストは以下の3つのセクションで構成します：

```typescript
it('should calculate sum correctly', () => {
  // Arrange (準備): テストに必要な初期状態を設定
  const calculator = new Calculator();
  const a = 5;
  const b = 3;

  // Act (実行): テスト対象の操作を実行
  const result = calculator.add(a, b);

  // Assert (検証): 期待される結果を検証
  expect(result).to.equal(8);
});
```

### 2. 1テスト1検証

各テストは1つの具体的な動作のみを検証します：

```typescript
// ❌ 悪い例: 複数の動作をテスト
it('should handle all terminal operations', () => {
  const terminal = createTerminal();
  expect(terminal.isActive).to.be.true;
  terminal.write('data');
  expect(terminal.buffer.length).to.equal(1);
  terminal.dispose();
  expect(terminal.isDisposed).to.be.true;
});

// ✅ 良い例: 1つの動作ずつテスト
it('should be active when created', () => {
  const terminal = createTerminal();
  expect(terminal.isActive).to.be.true;
});

it('should buffer written data', () => {
  const terminal = createTerminal();
  terminal.write('data');
  expect(terminal.buffer.length).to.equal(1);
});

it('should be disposed after disposal', () => {
  const terminal = createTerminal();
  terminal.dispose();
  expect(terminal.isDisposed).to.be.true;
});
```

### 3. Given-When-Then形式

テストの意図を明確にするため、コメントで明示：

```typescript
it('should restore terminal session from globalState', async () => {
  // Given: 保存されたセッションデータが存在する
  const savedSession = {
    terminals: [{ id: 1, scrollback: ['line1', 'line2'] }]
  };
  await globalState.update('sessions', savedSession);

  // When: セッションを復元する
  const restored = await sessionManager.restoreSession();

  // Then: 正しくセッションが復元される
  expect(restored.terminals).to.have.length(1);
  expect(restored.terminals[0].scrollback).to.deep.equal(['line1', 'line2']);
});
```

---

## テスト構造

### describe のネスト

論理的なグループ化にdescribeを使用：

```typescript
describe('TerminalManager', () => {
  describe('Terminal Creation', () => {
    it('should create terminal with default settings', () => {
      // テストコード
    });

    it('should create terminal with custom settings', () => {
      // テストコード
    });
  });

  describe('Terminal Deletion', () => {
    it('should delete terminal by ID', () => {
      // テストコード
    });

    it('should prevent deletion of last terminal', () => {
      // テストコード
    });
  });
});
```

### beforeEach と afterEach の適切な使用

```typescript
describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;

  beforeEach(() => {
    // 各テスト前に初期化
    sandbox = sinon.createSandbox();
    mockContext = createMockContext();
    sessionManager = new SessionManager(mockContext);
  });

  afterEach(() => {
    // 各テスト後にクリーンアップ
    sandbox.restore();
    sessionManager.dispose();
  });

  it('should save session', async () => {
    // テストコード
  });
});
```

---

## 非同期テスト

### async/await の使用（推奨）

```typescript
// ✅ 良い例: async/await
it('should save terminal data asynchronously', async () => {
  const terminal = createTerminal();

  await sessionManager.saveTerminal(terminal);

  const saved = await sessionManager.getTerminal(terminal.id);
  expect(saved).to.exist;
});
```

### Promise を返す

```typescript
// ✅ 良い例: Promiseを返す
it('should handle async errors', () => {
  return sessionManager.invalidOperation()
    .then(() => {
      throw new Error('Should have rejected');
    })
    .catch(error => {
      expect(error.message).to.include('Invalid operation');
    });
});
```

### done() コールバック（非推奨）

```typescript
// ⚠️ 可能な限り避ける: doneコールバック
it('should process callback', (done) => {
  processData((error, result) => {
    if (error) return done(error);
    expect(result).to.be.ok;
    done();
  });
});
```

### タイムアウトの設定

```typescript
it('should complete within time limit', async function() {
  this.timeout(5000); // 5秒

  await longRunningOperation();

  expect(result).to.be.ok;
});
```

---

## モックとスタブ

### Sinon Sandbox の使用

```typescript
describe('MessageHandler', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore(); // すべてのスタブを自動復元
  });

  it('should call webview.postMessage', () => {
    const postMessageStub = sandbox.stub(webview, 'postMessage');

    messageHandler.sendMessage({ command: 'test' });

    expect(postMessageStub).to.have.been.calledOnce;
  });
});
```

### stub の戻り値設定

```typescript
it('should handle configuration values', () => {
  const getStub = sandbox.stub(config, 'get');

  // 条件付き戻り値
  getStub.withArgs('shell').returns('/bin/bash');
  getStub.withArgs('fontSize').returns(14);

  const shell = config.get('shell');
  const fontSize = config.get('fontSize');

  expect(shell).to.equal('/bin/bash');
  expect(fontSize).to.equal(14);
});
```

### 非同期スタブ

```typescript
it('should handle async operations', async () => {
  const saveStub = sandbox.stub(storage, 'save');

  // 成功ケース
  saveStub.resolves({ success: true });

  const result = await storage.save(data);
  expect(result.success).to.be.true;
});

it('should handle async errors', async () => {
  const loadStub = sandbox.stub(storage, 'load');

  // エラーケース
  loadStub.rejects(new Error('Storage error'));

  await expect(storage.load()).to.be.rejectedWith('Storage error');
});
```

### spy の使用

```typescript
it('should call callback function', () => {
  const callback = sandbox.spy();

  eventEmitter.on('data', callback);
  eventEmitter.emit('data', 'test data');

  expect(callback).to.have.been.calledOnce;
  expect(callback).to.have.been.calledWith('test data');
});
```

---

## テストの命名規則

### 明確で説明的な名前

```typescript
// ❌ 悪い例: 曖昧
it('works', () => { });
it('test1', () => { });
it('should do stuff', () => { });

// ✅ 良い例: 具体的
it('should create terminal with specified shell', () => { });
it('should throw error when terminal limit exceeded', () => { });
it('should preserve scrollback on session save', () => { });
```

### should で始める

```typescript
describe('TerminalManager', () => {
  it('should create new terminal instance', () => { });
  it('should delete terminal by ID', () => { });
  it('should return all active terminals', () => { });
});
```

### エッジケースの明示

```typescript
describe('Terminal Deletion', () => {
  it('should delete terminal successfully', () => { });
  it('should handle deletion of non-existent terminal', () => { });
  it('should prevent deletion when only one terminal remains', () => { });
  it('should throw error when deleting already deleted terminal', () => { });
});
```

---

## テストの独立性

### テスト間で状態を共有しない

```typescript
// ❌ 悪い例: グローバル状態に依存
let sharedTerminal: Terminal;

it('test 1', () => {
  sharedTerminal = createTerminal();
  sharedTerminal.write('data');
});

it('test 2', () => {
  // test 1に依存している！
  expect(sharedTerminal.buffer).to.not.be.empty;
});

// ✅ 良い例: 各テストが独立
it('test 1', () => {
  const terminal = createTerminal();
  terminal.write('data');
  expect(terminal.buffer).to.not.be.empty;
});

it('test 2', () => {
  const terminal = createTerminal();
  expect(terminal.buffer).to.be.empty;
});
```

### テストの実行順序に依存しない

```typescript
// ❌ 悪い例: テストの順序に依存
describe('Bad Example', () => {
  let counter = 0;

  it('increments counter', () => {
    counter++;
    expect(counter).to.equal(1);
  });

  it('counter is 2', () => {
    counter++;
    expect(counter).to.equal(2); // 前のテストに依存
  });
});

// ✅ 良い例: 各テストが独立
describe('Good Example', () => {
  let counter: number;

  beforeEach(() => {
    counter = 0; // 各テスト前にリセット
  });

  it('increments counter from 0 to 1', () => {
    counter++;
    expect(counter).to.equal(1);
  });

  it('increments counter from 0 to 1', () => {
    counter++;
    expect(counter).to.equal(1);
  });
});
```

---

## エラーハンドリング

### 例外のテスト

```typescript
it('should throw error for invalid terminal ID', () => {
  expect(() => {
    terminalManager.getTerminal(-1);
  }).to.throw('Invalid terminal ID');
});

// または、特定のエラータイプ
it('should throw TypeError for null argument', () => {
  expect(() => {
    terminalManager.create(null);
  }).to.throw(TypeError);
});
```

### 非同期エラーのテスト

```typescript
it('should reject with error message', async () => {
  await expect(
    sessionManager.loadInvalidSession()
  ).to.be.rejectedWith('Session not found');
});

// または、chai-as-promisedを使用
it('should handle async rejection', () => {
  return expect(asyncOperation()).to.be.rejected;
});
```

---

## パフォーマンス

### テストは高速に

```typescript
// ✅ 良い例: モックを使用して高速化
it('should process data quickly', () => {
  const mockStorage = {
    save: sandbox.stub().resolves(),
    load: sandbox.stub().resolves(mockData)
  };

  const processor = new DataProcessor(mockStorage);
  const result = processor.process(data);

  expect(result).to.be.ok;
});

// ❌ 悪い例: 実際のファイルI/Oを使用
it('should save to disk', async () => {
  // 実際のファイル書き込み（遅い）
  await fs.writeFile('/tmp/test.json', data);
  const content = await fs.readFile('/tmp/test.json');
  expect(content).to.equal(data);
});
```

### 不要な待機を避ける

```typescript
// ❌ 悪い例: 不要なsleep
it('should process eventually', async () => {
  processor.start();
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
  expect(processor.isComplete).to.be.true;
});

// ✅ 良い例: イベント駆動
it('should complete processing', async () => {
  const promise = new Promise(resolve => {
    processor.on('complete', resolve);
  });

  processor.start();
  await promise;

  expect(processor.isComplete).to.be.true;
});
```

---

## その他のベストプラクティス

### テストデータの管理

```typescript
// テストデータをファクトリー関数で作成
function createTestTerminal(overrides = {}) {
  return {
    id: 1,
    name: 'Test Terminal',
    isActive: true,
    scrollback: [],
    ...overrides
  };
}

it('should handle custom terminal data', () => {
  const terminal = createTestTerminal({
    name: 'Custom Terminal',
    scrollback: ['line1', 'line2']
  });

  expect(terminal.name).to.equal('Custom Terminal');
  expect(terminal.scrollback).to.have.length(2);
});
```

### マジックナンバーを避ける

```typescript
// ❌ 悪い例: マジックナンバー
it('should limit terminals', () => {
  for (let i = 0; i < 5; i++) {
    manager.createTerminal();
  }
  expect(() => manager.createTerminal()).to.throw();
});

// ✅ 良い例: 定数を使用
it('should limit terminals to MAX_TERMINALS', () => {
  const MAX_TERMINALS = 5;

  for (let i = 0; i < MAX_TERMINALS; i++) {
    manager.createTerminal();
  }

  expect(() => manager.createTerminal()).to.throw(
    `Cannot exceed ${MAX_TERMINALS} terminals`
  );
});
```

### テストのスキップ

```typescript
// 一時的にテストをスキップ（CI/CDでは失敗させる）
it.skip('temporarily disabled test', () => {
  // このテストは実行されない
});

// 特定の条件でのみ実行
const itOnWindows = process.platform === 'win32' ? it : it.skip;

itOnWindows('should use Windows-specific behavior', () => {
  // Windows でのみ実行
});
```

---

## 参考リンク

- [Mocha Best Practices](https://mochajs.org/#best-practices)
- [Chai Best Practices](https://www.chaijs.com/guide/styles/)
- [Sinon Best Practices](https://sinonjs.org/releases/latest/best-practices/)
- [TDD Implementation Strategy](../../src/test/TDD-Implementation-Strategy.md)

---

**最終更新**: 2025-11-08
