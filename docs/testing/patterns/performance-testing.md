# パフォーマンステストパターン

VS Code Sidebar Terminal拡張機能のパフォーマンステストでは、メモリ使用量、実行速度、リソースリークを検証します。

## 目次

- [パフォーマンステストの種類](#パフォーマンステストの種類)
- [メモリリークテスト](#メモリリークテスト)
- [バッファパフォーマンステスト](#バッファパフォーマンステスト)
- [負荷テスト](#負荷テスト)
- [ベンチマークテスト](#ベンチマークテスト)
- [プロファイリング](#プロファイリング)

---

## パフォーマンステストの種類

### テストの分類

| 種類 | 目的 | 測定指標 | 実行頻度 |
|------|------|---------|---------|
| メモリリーク | リソース解放の検証 | ヒープサイズ、GC回数 | CI/CD |
| バッファ性能 | データ処理速度 | スループット、レイテンシ | 週次 |
| 負荷テスト | システム限界の把握 | CPU、メモリ、応答時間 | リリース前 |
| ベンチマーク | 性能劣化の検出 | 実行時間、相対性能 | PR毎 |

---

## メモリリークテスト

### ターミナル作成・削除のメモリリーク検証

```typescript
// src/test/performance/memory/TerminalMemoryLeak.test.ts
import { describe, it, expect } from 'vitest';
import { TerminalManager } from '../../../terminal/TerminalManager';

describe('Performance: Memory Leak Detection', () => {
  describe('Terminal Lifecycle', () => {
    it('should not leak memory on terminal creation and deletion', function() {
      this.timeout(30000); // 30秒

      const manager = new TerminalManager();
      const iterations = 100;
      const measurements: number[] = [];

      // 初期メモリ使用量を記録
      global.gc?.(); // ガベージコレクション実行（--expose-gc フラグが必要）
      const initialMemory = process.memoryUsage().heapUsed;

      // 複数回のターミナル作成・削除を実行
      for (let i = 0; i < iterations; i++) {
        // ターミナルを作成
        const terminal = manager.createTerminal();

        // データを書き込み
        terminal.write('test data\n'.repeat(100));

        // ターミナルを削除
        manager.deleteTerminal(terminal.id);

        // 10回ごとにメモリ使用量を測定
        if (i % 10 === 0) {
          global.gc?.();
          const currentMemory = process.memoryUsage().heapUsed;
          measurements.push(currentMemory - initialMemory);
        }
      }

      // クリーンアップ
      manager.dispose();
      global.gc?.();

      // 最終メモリ使用量を確認
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // メモリ増加が許容範囲内か確認（例: 10MB以下）
      const maxAllowedIncrease = 10 * 1024 * 1024; // 10MB
      expect(memoryIncrease).to.be.lessThan(
        maxAllowedIncrease,
        `Memory leak detected: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`
      );

      // メモリ使用量の推移を確認（線形増加していないか）
      const trend = calculateTrend(measurements);
      expect(Math.abs(trend)).to.be.lessThan(
        1000,
        'Memory usage should not show linear growth'
      );
    });
  });

  describe('Event Listener Cleanup', () => {
    it('should remove all event listeners on dispose', function() {
      this.timeout(10000);

      const manager = new TerminalManager();
      const terminal = manager.createTerminal();

      // イベントリスナーを大量に登録
      const listeners: Array<() => void> = [];
      for (let i = 0; i < 1000; i++) {
        const listener = () => {};
        terminal.onData(listener);
        listeners.push(listener);
      }

      // メモリ使用量を測定
      global.gc?.();
      const beforeDispose = process.memoryUsage().heapUsed;

      // リスナーを削除
      manager.dispose();

      // GC実行
      global.gc?.();
      const afterDispose = process.memoryUsage().heapUsed;

      // メモリが解放されたことを確認
      const freed = beforeDispose - afterDispose;
      expect(freed).to.be.greaterThan(0, 'Memory should be freed after dispose');
    });
  });
});

// ヘルパー関数: 線形トレンドを計算
function calculateTrend(values: number[]): number {
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}
```

### メモリプロファイリングの実行

```bash
# GCを有効にしてテスト実行
node --expose-gc ./node_modules/vitest/vitest.mjs run \
  src/test/vitest/unit/performance/memory \
  --testTimeout 60000

# ヒープスナップショットを取得
node --inspect-brk --expose-gc ./node_modules/vitest/vitest.mjs run \
  src/test/vitest/unit/performance/memory
# Chrome DevTools で chrome://inspect にアクセスして解析
```

---

## バッファパフォーマンステスト

### スクロールバックバッファの性能テスト

```typescript
// src/test/performance/buffer/ScrollbackPerformance.test.ts
import { describe, it, expect } from 'vitest';
import { ScrollbackBuffer } from '../../../buffer/ScrollbackBuffer';

describe('Performance: Scrollback Buffer', () => {
  describe('Write Performance', () => {
    it('should handle rapid writes efficiently', function() {
      this.timeout(10000);

      const buffer = new ScrollbackBuffer({ maxLines: 10000 });
      const iterations = 10000;
      const lineLength = 100;

      // パフォーマンス測定開始
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage().heapUsed;

      // 大量のデータを書き込み
      for (let i = 0; i < iterations; i++) {
        buffer.write('x'.repeat(lineLength) + '\n');
      }

      // パフォーマンス測定終了
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage().heapUsed;

      // 実行時間を計算
      const durationMs = Number(endTime - startTime) / 1_000_000;
      const throughput = iterations / (durationMs / 1000); // lines/sec

      // メモリ使用量を計算
      const memoryUsedMB = (endMemory - startMemory) / 1024 / 1024;

      // 結果を出力
      console.log(`  Write Performance:`);
      console.log(`    Duration: ${durationMs.toFixed(2)}ms`);
      console.log(`    Throughput: ${throughput.toFixed(0)} lines/sec`);
      console.log(`    Memory: ${memoryUsedMB.toFixed(2)}MB`);

      // パフォーマンス基準をチェック
      expect(durationMs).to.be.lessThan(1000, 'Should write 10k lines in < 1s');
      expect(throughput).to.be.greaterThan(5000, 'Should write > 5k lines/sec');
      expect(memoryUsedMB).to.be.lessThan(50, 'Should use < 50MB for 10k lines');

      buffer.dispose();
    });

    it('should handle line wrapping efficiently', function() {
      this.timeout(10000);

      const buffer = new ScrollbackBuffer({
        maxLines: 5000,
        columns: 80
      });

      const longLine = 'x'.repeat(500); // 80列を超える長い行
      const iterations = 5000;

      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        buffer.write(longLine + '\n');
      }

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      console.log(`  Line Wrapping Performance: ${durationMs.toFixed(2)}ms`);

      expect(durationMs).to.be.lessThan(2000, 'Line wrapping should be fast');

      buffer.dispose();
    });
  });

  describe('Read Performance', () => {
    it('should retrieve lines efficiently', function() {
      this.timeout(5000);

      const buffer = new ScrollbackBuffer({ maxLines: 10000 });

      // バッファにデータを書き込み
      for (let i = 0; i < 10000; i++) {
        buffer.write(`Line ${i}\n`);
      }

      // 読み取り性能を測定
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < 1000; i++) {
        const randomLine = Math.floor(Math.random() * 10000);
        buffer.getLine(randomLine);
      }

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      console.log(`  Read Performance: ${durationMs.toFixed(2)}ms for 1000 reads`);

      expect(durationMs).to.be.lessThan(100, 'Should read 1000 lines in < 100ms');

      buffer.dispose();
    });
  });

  describe('Search Performance', () => {
    it('should search through buffer efficiently', function() {
      this.timeout(10000);

      const buffer = new ScrollbackBuffer({ maxLines: 10000 });

      // テストデータを準備
      for (let i = 0; i < 10000; i++) {
        buffer.write(`Line ${i} with some random text\n`);
      }

      // 検索性能を測定
      const searchTerms = ['Line', 'random', 'text', 'nonexistent'];
      const startTime = process.hrtime.bigint();

      searchTerms.forEach(term => {
        buffer.search(term);
      });

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      console.log(`  Search Performance: ${durationMs.toFixed(2)}ms`);

      expect(durationMs).to.be.lessThan(500, 'Search should be fast');

      buffer.dispose();
    });
  });
});
```

---

## 負荷テスト

### 同時ターミナル数の負荷テスト

```typescript
// src/test/performance/load/ConcurrentTerminals.test.ts
import { describe, it, expect } from 'vitest';
import { TerminalManager } from '../../../terminal/TerminalManager';

describe('Performance: Load Testing', () => {
  describe('Concurrent Terminals', () => {
    it('should handle multiple terminals simultaneously', async function() {
      this.timeout(60000); // 60秒

      const manager = new TerminalManager();
      const terminalCount = 50;
      const terminals: any[] = [];

      // メモリとCPU使用量の測定開始
      const startMemory = process.memoryUsage();
      const startTime = process.hrtime.bigint();

      // 複数のターミナルを作成
      for (let i = 0; i < terminalCount; i++) {
        const terminal = await manager.createTerminal({
          name: `Terminal ${i}`
        });
        terminals.push(terminal);
      }

      console.log(`  Created ${terminalCount} terminals`);

      // 各ターミナルにデータを書き込み
      const writePromises = terminals.map(async (terminal, index) => {
        for (let i = 0; i < 100; i++) {
          terminal.write(`Terminal ${index}: Line ${i}\n`);
          // 少し待機してリアルな使用をシミュレート
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      await Promise.all(writePromises);

      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();

      // パフォーマンス指標を計算
      const durationMs = Number(endTime - startTime) / 1_000_000;
      const memoryIncreaseMB = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;

      console.log(`  Duration: ${durationMs.toFixed(2)}ms`);
      console.log(`  Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      console.log(`  Per terminal: ${(memoryIncreaseMB / terminalCount).toFixed(2)}MB`);

      // パフォーマンス基準
      expect(durationMs).to.be.lessThan(30000, 'Should handle load in < 30s');
      expect(memoryIncreaseMB).to.be.lessThan(500, 'Should use < 500MB total');

      // クリーンアップ
      manager.dispose();
    });

    it('should handle rapid terminal creation and deletion', async function() {
      this.timeout(30000);

      const manager = new TerminalManager();
      const iterations = 100;

      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        // ターミナルを作成
        const terminal = await manager.createTerminal();

        // データを書き込み
        terminal.write('test\n');

        // すぐに削除
        await manager.deleteTerminal(terminal.id);
      }

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      const opsPerSec = (iterations * 2) / (durationMs / 1000);

      console.log(`  Duration: ${durationMs.toFixed(2)}ms`);
      console.log(`  Operations/sec: ${opsPerSec.toFixed(0)}`);

      expect(durationMs).to.be.lessThan(10000, 'Should complete in < 10s');

      manager.dispose();
    });
  });
});
```

### メッセージスループットテスト

```typescript
describe('Performance: Message Throughput', () => {
  it('should handle high message rate', async function() {
    this.timeout(20000);

    const messageHandler = new MessageHandler();
    const messageCount = 10000;

    const startTime = process.hrtime.bigint();

    // 大量のメッセージを送信
    const promises = [];
    for (let i = 0; i < messageCount; i++) {
      promises.push(
        messageHandler.handleMessage({
          command: 'write',
          data: `Message ${i}\n`
        })
      );
    }

    await Promise.all(promises);

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const throughput = messageCount / (durationMs / 1000);

    console.log(`  Message throughput: ${throughput.toFixed(0)} msg/sec`);

    expect(throughput).to.be.greaterThan(1000, 'Should handle > 1k msg/sec');

    messageHandler.dispose();
  });
});
```

---

## ベンチマークテスト

### 相対性能の測定

```typescript
// src/test/performance/benchmark/RelativePerformance.test.ts
import { describe, it, expect } from 'vitest';

describe('Performance: Benchmarks', () => {
  describe('String Operations', () => {
    it('should compare string concatenation methods', () => {
      const iterations = 100000;

      // Method 1: += operator
      let startTime = process.hrtime.bigint();
      let str1 = '';
      for (let i = 0; i < iterations; i++) {
        str1 += 'x';
      }
      let duration1 = Number(process.hrtime.bigint() - startTime) / 1_000_000;

      // Method 2: Array.join
      startTime = process.hrtime.bigint();
      const arr = [];
      for (let i = 0; i < iterations; i++) {
        arr.push('x');
      }
      const str2 = arr.join('');
      let duration2 = Number(process.hrtime.bigint() - startTime) / 1_000_000;

      console.log(`  += operator: ${duration1.toFixed(2)}ms`);
      console.log(`  Array.join: ${duration2.toFixed(2)}ms`);
      console.log(`  Speedup: ${(duration1 / duration2).toFixed(2)}x`);

      // Array.joinの方が速いはず
      expect(duration2).to.be.lessThan(duration1 * 2);
    });
  });

  describe('Buffer Implementations', () => {
    it('should compare circular buffer vs array buffer', function() {
      this.timeout(10000);

      const iterations = 10000;
      const maxSize = 1000;

      // Circular Buffer implementation
      class CircularBuffer {
        private buffer: string[];
        private head = 0;
        private tail = 0;

        constructor(private maxSize: number) {
          this.buffer = new Array(maxSize);
        }

        push(item: string): void {
          this.buffer[this.tail] = item;
          this.tail = (this.tail + 1) % this.maxSize;
          if (this.tail === this.head) {
            this.head = (this.head + 1) % this.maxSize;
          }
        }
      }

      // Test Circular Buffer
      const startTime1 = process.hrtime.bigint();
      const circularBuffer = new CircularBuffer(maxSize);
      for (let i = 0; i < iterations; i++) {
        circularBuffer.push(`line ${i}`);
      }
      const duration1 = Number(process.hrtime.bigint() - startTime1) / 1_000_000;

      // Test Array with shift
      const startTime2 = process.hrtime.bigint();
      const arrayBuffer: string[] = [];
      for (let i = 0; i < iterations; i++) {
        arrayBuffer.push(`line ${i}`);
        if (arrayBuffer.length > maxSize) {
          arrayBuffer.shift();
        }
      }
      const duration2 = Number(process.hrtime.bigint() - startTime2) / 1_000_000;

      console.log(`  Circular Buffer: ${duration1.toFixed(2)}ms`);
      console.log(`  Array with shift: ${duration2.toFixed(2)}ms`);
      console.log(`  Speedup: ${(duration2 / duration1).toFixed(2)}x`);

      // Circular Bufferの方が速いはず
      expect(duration1).to.be.lessThan(duration2);
    });
  });
});
```

---

## プロファイリング

### CPU プロファイリング

```typescript
// src/test/performance/profiling/CPUProfile.test.ts
import { performance } from 'perf_hooks';

describe('Performance: CPU Profiling', () => {
  it('should profile heavy operations', function() {
    this.timeout(10000);

    const operations = {
      parsing: 0,
      rendering: 0,
      calculation: 0
    };

    for (let i = 0; i < 1000; i++) {
      // Parsing
      let start = performance.now();
      JSON.parse(JSON.stringify({ data: 'x'.repeat(100) }));
      operations.parsing += performance.now() - start;

      // Rendering (simulated)
      start = performance.now();
      'x'.repeat(1000).split('').join('');
      operations.rendering += performance.now() - start;

      // Calculation
      start = performance.now();
      Math.sqrt(Math.random() * 1000000);
      operations.calculation += performance.now() - start;
    }

    console.log('  CPU Time Distribution:');
    const total = operations.parsing + operations.rendering + operations.calculation;
    console.log(`    Parsing: ${(operations.parsing / total * 100).toFixed(1)}%`);
    console.log(`    Rendering: ${(operations.rendering / total * 100).toFixed(1)}%`);
    console.log(`    Calculation: ${(operations.calculation / total * 100).toFixed(1)}%`);
  });
});
```

---

## CI/CDでのパフォーマンス監視

### GitHub Actionsでのベンチマーク

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run performance tests
        run: |
          npm run test:performance > perf-results.txt

      - name: Compare with baseline
        run: |
          node scripts/compare-performance.js perf-results.txt baseline.txt

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = fs.readFileSync('perf-results.txt', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Performance Test Results\n\n\`\`\`\n${results}\n\`\`\``
            });
```

---

## ベストプラクティス

### ✅ Do

- 実際のユースケースに基づいたテスト
- 複数回実行して平均を取る
- メモリとCPUの両方を測定
- ベースラインと比較
- 結果を記録して追跡

### ❌ Don't

- 不安定なテストを作らない
- 環境依存の基準を使わない
- 最適化前のベンチマークを忘れない
- GCのタイミングを無視しない

---

## 参考

- [Node.js Performance Hooks](https://nodejs.org/api/perf_hooks.html)
- [Chrome DevTools Memory Profiling](https://developer.chrome.com/docs/devtools/memory-problems/)
- [ベストプラクティス](../best-practices.md)

---

**最終更新**: 2025-11-08
