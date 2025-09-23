/**
 * Performance Tests for Buffer Management - Following t-wada's TDD Methodology
 *
 * These tests verify the performance characteristics of buffer management:
 * - High-frequency terminal output handling
 * - Output buffering and debouncing efficiency
 * - Memory usage optimization during buffer operations
 * - CLI agent output pattern detection performance
 * - Buffer overflow and cleanup mechanisms
 * - Concurrent buffer operations scaling
 *
 * TDD Performance Testing Approach:
 * 1. RED: Write failing tests for performance requirements
 * 2. GREEN: Implement buffer optimizations to meet requirements
 * 3. REFACTOR: Optimize buffer algorithms while maintaining performance
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupTestEnvironment, resetTestEnvironment } from '../../shared/TestSetup';
import { PerformanceManager } from '../../../webview/managers/PerformanceManager';
import { CliAgentDetectionService } from '../../../services/CliAgentDetectionService';

interface BufferMetrics {
  totalSize: number;
  queuedOperations: number;
  processingTime: number;
  memoryUsage: number;
  droppedOperations: number;
}

interface PerformanceBenchmark {
  operationsPerSecond: number;
  averageLatency: number;
  memoryEfficiency: number;
  cpuUsage: number;
}

describe('Buffer Management Performance - TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let performanceManager: PerformanceManager;
  let cliAgentDetection: CliAgentDetectionService;
  let mockCoordinator: any;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();

    // Mock coordinator
    mockCoordinator = {
      getManager: sandbox.stub(),
      isReady: sandbox.stub().returns(true),
      dispose: sandbox.stub(),
      initialize: sandbox.stub(),
      logger: sandbox.stub()
    };

    // Initialize managers
    performanceManager = new PerformanceManager();
    cliAgentDetection = new CliAgentDetectionService();

    // Setup coordinator responses
    mockCoordinator.getManager.withArgs('PerformanceManager').returns(performanceManager);
    mockCoordinator.getManager.withArgs('CliAgentDetectionService').returns(cliAgentDetection);
  });

  afterEach(() => {
    resetTestEnvironment();
    performanceManager.dispose();
    cliAgentDetection.dispose();
    sandbox.restore();
  });

  describe('High-Frequency Output Handling', () => {

    describe('RED Phase - Output Throughput Performance', () => {

      it('should handle 1000+ output operations per second efficiently', async function() {
        // RED: High-frequency output should maintain performance
        this.timeout(10000); // 10 second timeout for performance test

        const terminalId = 'perf-test-terminal-1';
        const operationsPerSecond = 1000;
        const testDurationSeconds = 5;
        const totalOperations = operationsPerSecond * testDurationSeconds;

        let processedOperations = 0;
        let startTime: number;
        let endTime: number;

        // Setup performance monitoring
        const performanceMetrics: BufferMetrics[] = [];

        performanceManager.onBufferUpdate((metrics: BufferMetrics) => {
          performanceMetrics.push(metrics);
        });

        startTime = performance.now();

        // Generate high-frequency output
        const outputPromises = [];
        for (let i = 0; i < totalOperations; i++) {
          const outputData = `High frequency output line ${i} with timestamp ${Date.now()}\n`;

          outputPromises.push(
            performanceManager.bufferOutput(terminalId, outputData).then(() => {
              processedOperations++;
            })
          );

          // Maintain target frequency
          if (i % operationsPerSecond === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        await Promise.all(outputPromises);
        endTime = performance.now();

        const actualDuration = (endTime - startTime) / 1000;
        const actualOpsPerSecond = processedOperations / actualDuration;

        expect(processedOperations).to.equal(totalOperations);
        expect(actualOpsPerSecond).to.be.greaterThan(800); // Allow some variance

        // Performance metrics should show efficient buffering
        const finalMetrics = performanceMetrics[performanceMetrics.length - 1];
        expect(finalMetrics.droppedOperations).to.be.lessThan(totalOperations * 0.01); // <1% dropped
      });

      it('should maintain low latency under sustained load', async function() {
        // RED: Latency should remain acceptable during sustained operations
        this.timeout(15000); // 15 second timeout

        const terminalId = 'latency-test-terminal';
        const batchSize = 100;
        const batchCount = 50;
        const latencies: number[] = [];

        for (let batch = 0; batch < batchCount; batch++) {
          const batchStartTime = performance.now();

          // Process batch of operations
          const batchPromises = [];
          for (let i = 0; i < batchSize; i++) {
            const outputData = `Batch ${batch} line ${i}\n`;
            batchPromises.push(performanceManager.bufferOutput(terminalId, outputData));
          }

          await Promise.all(batchPromises);

          const batchEndTime = performance.now();
          const batchLatency = batchEndTime - batchStartTime;
          latencies.push(batchLatency);

          // Brief pause between batches
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Analyze latency characteristics
        const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

        expect(averageLatency).to.be.lessThan(50); // Average < 50ms per batch
        expect(maxLatency).to.be.lessThan(200); // Max < 200ms
        expect(p95Latency).to.be.lessThan(100); // 95th percentile < 100ms

        // Latency should not degrade significantly over time
        const firstHalfAvg = latencies.slice(0, 25).reduce((sum, lat) => sum + lat, 0) / 25;
        const secondHalfAvg = latencies.slice(25).reduce((sum, lat) => sum + lat, 0) / 25;

        expect(secondHalfAvg).to.be.lessThan(firstHalfAvg * 1.5); // No more than 50% degradation
      });

      it('should scale buffer operations linearly with terminal count', async function() {
        // RED: Buffer performance should scale well with multiple terminals
        this.timeout(20000); // 20 second timeout

        const terminalCounts = [1, 5, 10, 20];
        const operationsPerTerminal = 500;
        const benchmarks: PerformanceBenchmark[] = [];

        for (const terminalCount of terminalCounts) {
          const terminals = Array.from({ length: terminalCount }, (_, i) => `scale-test-terminal-${i}`);

          const startTime = performance.now();
          const startMemory = process.memoryUsage().heapUsed;

          // Concurrent operations across all terminals
          const allPromises = terminals.map(async (terminalId) => {
            const terminalPromises = [];
            for (let i = 0; i < operationsPerTerminal; i++) {
              const outputData = `Terminal ${terminalId} line ${i}\n`;
              terminalPromises.push(performanceManager.bufferOutput(terminalId, outputData));
            }
            return Promise.all(terminalPromises);
          });

          await Promise.all(allPromises);

          const endTime = performance.now();
          const endMemory = process.memoryUsage().heapUsed;

          const totalOperations = terminalCount * operationsPerTerminal;
          const duration = (endTime - startTime) / 1000;
          const opsPerSecond = totalOperations / duration;
          const memoryIncrease = endMemory - startMemory;

          benchmarks.push({
            operationsPerSecond: opsPerSecond,
            averageLatency: duration / totalOperations * 1000,
            memoryEfficiency: memoryIncrease / totalOperations,
            cpuUsage: 0 // Would require platform-specific measurement
          });

          // Clean up between tests
          terminals.forEach(terminalId => performanceManager.clearBuffer(terminalId));
          if (global.gc) global.gc();
        }

        // Analyze scaling characteristics
        expect(benchmarks).to.have.length(terminalCounts.length);

        // Operations per second should not degrade severely with scale
        const singleTerminalOps = benchmarks[0].operationsPerSecond;
        const maxTerminalOps = benchmarks[benchmarks.length - 1].operationsPerSecond;

        // Should maintain at least 50% of single-terminal performance
        expect(maxTerminalOps).to.be.greaterThan(singleTerminalOps * 0.5);

        // Memory efficiency should be reasonable
        benchmarks.forEach(benchmark => {
          expect(benchmark.memoryEfficiency).to.be.lessThan(1024); // Less than 1KB per operation
        });
      });

      it('should optimize buffer allocation for different output patterns', async function() {
        // RED: Buffer allocation should adapt to output patterns
        this.timeout(12000); // 12 second timeout

        const testPatterns = [
          {
            name: 'Small frequent outputs',
            pattern: () => `Line ${Date.now()}\n`,
            count: 2000,
            expectedMemoryEfficiency: 100 // bytes per operation
          },
          {
            name: 'Large infrequent outputs',
            pattern: () => 'Large output: ' + 'A'.repeat(1000) + '\n',
            count: 100,
            expectedMemoryEfficiency: 1200 // bytes per operation
          },
          {
            name: 'Mixed size outputs',
            pattern: (i: number) => i % 10 === 0
              ? 'Large: ' + 'B'.repeat(500) + '\n'
              : `Small ${i}\n`,
            count: 1000,
            expectedMemoryEfficiency: 200 // bytes per operation
          }
        ];

        for (const testPattern of testPatterns) {
          const terminalId = `pattern-test-${testPattern.name.replace(/\s+/g, '-')}`;

          const startTime = performance.now();
          const startMemory = process.memoryUsage().heapUsed;

          // Generate pattern-specific output
          const promises = [];
          for (let i = 0; i < testPattern.count; i++) {
            const outputData = testPattern.pattern(i);
            promises.push(performanceManager.bufferOutput(terminalId, outputData));
          }

          await Promise.all(promises);

          const endTime = performance.now();
          const endMemory = process.memoryUsage().heapUsed;

          const duration = endTime - startTime;
          const memoryUsed = endMemory - startMemory;
          const memoryPerOperation = memoryUsed / testPattern.count;

          expect(duration).to.be.lessThan(5000); // Should complete within 5 seconds
          expect(memoryPerOperation).to.be.lessThan(testPattern.expectedMemoryEfficiency);

          // Clean up
          performanceManager.clearBuffer(terminalId);
          if (global.gc) global.gc();
        }
      });

    });

  });

  describe('CLI Agent Output Pattern Detection Performance', () => {

    describe('RED Phase - Pattern Detection Efficiency', () => {

      it('should detect CLI agent patterns without significant performance impact', async function() {
        // RED: Pattern detection should add minimal overhead
        this.timeout(10000); // 10 second timeout

        const terminalId = 'agent-detection-test';
        const outputCount = 1000;

        // Mixed output including agent patterns
        const outputs = [
          'Normal terminal output line',
          'claude_desktop_app: Starting Claude Code agent',
          'Regular command output',
          'GitHub Copilot is running in the background',
          'Another normal line',
          'aider: AI pair programming started',
          'Standard bash output',
          'gemini-cli: Generating response...',
          'More regular content'
        ];

        // Measure performance without pattern detection
        let startTime = performance.now();
        for (let i = 0; i < outputCount; i++) {
          const output = outputs[i % outputs.length];
          await performanceManager.bufferOutput(terminalId, output);
        }
        let endTime = performance.now();
        const baselineTime = endTime - startTime;

        // Clear and measure with pattern detection enabled
        performanceManager.clearBuffer(terminalId);

        startTime = performance.now();
        for (let i = 0; i < outputCount; i++) {
          const output = outputs[i % outputs.length];
          await performanceManager.bufferOutputWithAgentDetection(terminalId, output);
        }
        endTime = performance.now();
        const detectionTime = endTime - startTime;

        // Pattern detection overhead should be minimal (< 20% increase)
        const overhead = (detectionTime - baselineTime) / baselineTime;
        expect(overhead).to.be.lessThan(0.2);

        // Verify agents were detected
        const detectedAgents = cliAgentDetection.getActiveAgents(terminalId);
        expect(detectedAgents.size).to.be.greaterThan(0);
      });

      it('should handle complex agent output patterns efficiently', async function() {
        // RED: Complex patterns should not cause performance degradation
        this.timeout(8000); // 8 second timeout

        const terminalId = 'complex-pattern-test';

        // Complex multi-line agent outputs
        const complexOutputs = [
          `claude_desktop_app: Analyzing codebase...
Progress: [=====>    ] 50%
claude_desktop_app: Found 15 files to process
claude_desktop_app: Generating suggestions...`,

          `GitHub Copilot
  Suggestion 1: function calculateTotal()
  Suggestion 2: class DataProcessor
  Suggestion 3: interface UserConfig
Press Tab to accept, Esc to dismiss`,

          `aider: Starting pair programming session
> Added file: src/main.ts
> Added file: src/utils.ts
> Ready for instructions
aider> `,

          `gemini-cli: Processing query...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%
Response generated successfully.
Word count: 247 words`
        ];

        const startTime = performance.now();

        // Process complex patterns
        for (let i = 0; i < 100; i++) {
          const output = complexOutputs[i % complexOutputs.length];
          await performanceManager.bufferOutputWithAgentDetection(terminalId, output);
        }

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        // Should handle complex patterns quickly
        expect(processingTime).to.be.lessThan(2000); // Less than 2 seconds

        // All agent types should be detected
        const detectedAgents = cliAgentDetection.getActiveAgents(terminalId);
        expect(detectedAgents.has('claude_desktop_app')).to.be.true;
        expect(detectedAgents.has('github_copilot')).to.be.true;
        expect(detectedAgents.has('aider')).to.be.true;
        expect(detectedAgents.has('gemini_cli')).to.be.true;
      });

      it('should optimize pattern matching for high-frequency detection', async function() {
        // RED: Pattern matching should be optimized for repeated use
        this.timeout(15000); // 15 second timeout

        const terminalId = 'optimization-test';
        const patternCycles = 1000;

        // Patterns that should trigger optimization
        const repetitivePatterns = [
          'claude_desktop_app: Processing...',
          'GitHub Copilot suggestion available',
          'aider: Waiting for input',
          'gemini-cli: Ready'
        ];

        const startTime = performance.now();

        // First pass - patterns should be learned and optimized
        for (let cycle = 0; cycle < patternCycles; cycle++) {
          for (const pattern of repetitivePatterns) {
            await performanceManager.bufferOutputWithAgentDetection(terminalId, pattern);
          }
        }

        const firstPassTime = performance.now() - startTime;

        // Second pass - should benefit from optimization
        const secondPassStart = performance.now();

        for (let cycle = 0; cycle < patternCycles; cycle++) {
          for (const pattern of repetitivePatterns) {
            await performanceManager.bufferOutputWithAgentDetection(terminalId, pattern);
          }
        }

        const secondPassTime = performance.now() - secondPassStart;

        // Second pass should be faster due to optimizations
        expect(secondPassTime).to.be.lessThan(firstPassTime * 0.9); // At least 10% improvement

        // Verify detection still works
        const detectedAgents = cliAgentDetection.getActiveAgents(terminalId);
        expect(detectedAgents.size).to.equal(4); // All four agent types
      });

    });

  });

  describe('Buffer Memory Management', () => {

    describe('RED Phase - Memory Efficiency', () => {

      it('should implement efficient buffer cleanup to prevent memory leaks', async function() {
        // RED: Buffer cleanup should prevent unbounded memory growth
        this.timeout(12000); // 12 second timeout

        const terminalId = 'memory-test';
        const cycleCount = 50;
        const outputsPerCycle = 200;

        let maxMemoryIncrease = 0;
        const initialMemory = process.memoryUsage().heapUsed;

        for (let cycle = 0; cycle < cycleCount; cycle++) {
          // Generate output that should be cleaned up
          for (let i = 0; i < outputsPerCycle; i++) {
            const largeOutput = `Cycle ${cycle} output ${i}: ${'X'.repeat(1000)}\n`;
            await performanceManager.bufferOutput(terminalId, largeOutput);
          }

          // Trigger cleanup
          await performanceManager.cleanupOldBuffers(terminalId);

          // Force garbage collection
          if (global.gc) global.gc();

          const currentMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = currentMemory - initialMemory;
          maxMemoryIncrease = Math.max(maxMemoryIncrease, memoryIncrease);
        }

        // Memory increase should be bounded despite many cycles
        expect(maxMemoryIncrease).to.be.lessThan(50 * 1024 * 1024); // Less than 50MB

        // Final memory should be close to initial (efficient cleanup)
        const finalMemory = process.memoryUsage().heapUsed;
        const finalIncrease = finalMemory - initialMemory;
        expect(finalIncrease).to.be.lessThan(10 * 1024 * 1024); // Less than 10MB residual
      });

      it('should manage buffer size limits effectively', async function() {
        // RED: Buffers should respect size limits without performance degradation
        this.timeout(8000); // 8 second timeout

        const terminalId = 'buffer-limit-test';
        const maxBufferSize = 1024 * 1024; // 1MB limit
        const outputSize = 1000; // 1KB per output
        const totalOutputs = 2000; // 2MB total - should exceed limit

        performanceManager.setBufferSizeLimit(terminalId, maxBufferSize);

        let droppedOutputs = 0;
        performanceManager.onBufferOverflow((terminalId, droppedCount) => {
          droppedOutputs += droppedCount;
        });

        const startTime = performance.now();

        // Generate more output than buffer can hold
        for (let i = 0; i < totalOutputs; i++) {
          const output = `Output ${i}: ${'A'.repeat(outputSize - 20)}\n`;
          await performanceManager.bufferOutput(terminalId, output);
        }

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        // Should complete quickly despite overflow handling
        expect(processingTime).to.be.lessThan(5000); // Less than 5 seconds

        // Should have dropped old outputs to maintain limit
        expect(droppedOutputs).to.be.greaterThan(0);

        // Buffer size should be within limit
        const currentBufferSize = performanceManager.getBufferSize(terminalId);
        expect(currentBufferSize).to.be.lessThan(maxBufferSize * 1.1); // Allow 10% overhead
      });

      it('should optimize memory allocation for varying output sizes', async function() {
        // RED: Memory allocation should adapt to output size patterns
        this.timeout(10000); // 10 second timeout

        const testScenarios = [
          {
            name: 'Small uniform outputs',
            generator: (i: number) => `Small ${i}\n`,
            count: 5000,
            expectedEfficiency: 50 // bytes per operation
          },
          {
            name: 'Large uniform outputs',
            generator: (i: number) => `Large ${i}: ${'X'.repeat(2000)}\n`,
            count: 500,
            expectedEfficiency: 2100 // bytes per operation
          },
          {
            name: 'Highly variable outputs',
            generator: (i: number) => i % 100 === 0
              ? `Huge ${i}: ${'Y'.repeat(10000)}\n`
              : `Tiny ${i}\n`,
            count: 1000,
            expectedEfficiency: 1000 // bytes per operation
          }
        ];

        for (const scenario of testScenarios) {
          const terminalId = `allocation-test-${scenario.name.replace(/\s+/g, '-')}`;

          const startMemory = process.memoryUsage().heapUsed;

          // Generate scenario-specific outputs
          for (let i = 0; i < scenario.count; i++) {
            const output = scenario.generator(i);
            await performanceManager.bufferOutput(terminalId, output);
          }

          const endMemory = process.memoryUsage().heapUsed;
          const memoryUsed = endMemory - startMemory;
          const memoryPerOperation = memoryUsed / scenario.count;

          expect(memoryPerOperation).to.be.lessThan(scenario.expectedEfficiency);

          // Clean up
          performanceManager.clearBuffer(terminalId);
          if (global.gc) global.gc();
        }
      });

    });

  });

  describe('Concurrent Buffer Operations', () => {

    describe('RED Phase - Concurrency Performance', () => {

      it('should handle concurrent buffer operations without blocking', async function() {
        // RED: Concurrent operations should not cause performance bottlenecks
        this.timeout(15000); // 15 second timeout

        const terminalCount = 10;
        const operationsPerTerminal = 500;
        const concurrentOperations = terminalCount * operationsPerTerminal;

        const startTime = performance.now();

        // Launch concurrent operations across multiple terminals
        const allPromises = Array.from({ length: terminalCount }, (_, terminalIndex) => {
          const terminalId = `concurrent-test-${terminalIndex}`;

          return Promise.all(
            Array.from({ length: operationsPerTerminal }, async (_, opIndex) => {
              const output = `Terminal ${terminalIndex} operation ${opIndex}\n`;
              return performanceManager.bufferOutput(terminalId, output);
            })
          );
        });

        await Promise.all(allPromises);

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const operationsPerSecond = concurrentOperations / (totalTime / 1000);

        // Should achieve high throughput with concurrency
        expect(operationsPerSecond).to.be.greaterThan(1000); // At least 1000 ops/sec

        // Should complete in reasonable time
        expect(totalTime).to.be.lessThan(10000); // Less than 10 seconds
      });

      it('should maintain fairness across concurrent terminals', async function() {
        // RED: No terminal should be starved under concurrent load
        this.timeout(12000); // 12 second timeout

        const terminalCount = 8;
        const operationsPerTerminal = 300;
        const completionTimes: number[] = [];

        // Track completion time for each terminal
        const terminalPromises = Array.from({ length: terminalCount }, async (_, index) => {
          const terminalId = `fairness-test-${index}`;
          const startTime = performance.now();

          for (let i = 0; i < operationsPerTerminal; i++) {
            const output = `Terminal ${index} operation ${i}\n`;
            await performanceManager.bufferOutput(terminalId, output);
          }

          const endTime = performance.now();
          completionTimes.push(endTime - startTime);
          return endTime - startTime;
        });

        await Promise.all(terminalPromises);

        // Analyze fairness - completion times should be relatively similar
        const minTime = Math.min(...completionTimes);
        const maxTime = Math.max(...completionTimes);
        const fairnessRatio = maxTime / minTime;

        // No terminal should take more than 2x longer than the fastest
        expect(fairnessRatio).to.be.lessThan(2.0);

        // Average time should be reasonable
        const avgTime = completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length;
        expect(avgTime).to.be.lessThan(8000); // Average less than 8 seconds
      });

      it('should scale buffer operations with available CPU cores', async function() {
        // RED: Performance should improve with available parallelism
        this.timeout(20000); // 20 second timeout

        const coreCount = require('os').cpus().length;
        const operationsPerCore = 1000;

        // Test with different levels of parallelism
        const parallelismLevels = [1, Math.min(2, coreCount), Math.min(4, coreCount), coreCount];
        const benchmarks: { level: number; opsPerSecond: number }[] = [];

        for (const parallelLevel of parallelismLevels) {
          const totalOperations = operationsPerCore * parallelLevel;
          const terminals = Array.from({ length: parallelLevel }, (_, i) => `scale-test-core-${i}`);

          const startTime = performance.now();

          // Distribute operations across terminals
          const promises = terminals.map(async (terminalId, index) => {
            for (let i = 0; i < operationsPerCore; i++) {
              const output = `Core ${index} operation ${i}\n`;
              await performanceManager.bufferOutput(terminalId, output);
            }
          });

          await Promise.all(promises);

          const endTime = performance.now();
          const duration = (endTime - startTime) / 1000;
          const opsPerSecond = totalOperations / duration;

          benchmarks.push({ level: parallelLevel, opsPerSecond });

          // Clean up between tests
          terminals.forEach(terminalId => performanceManager.clearBuffer(terminalId));
          if (global.gc) global.gc();
        }

        // Performance should generally improve with more parallelism
        expect(benchmarks).to.have.length(parallelismLevels.length);

        // Each level should achieve reasonable performance
        benchmarks.forEach(benchmark => {
          expect(benchmark.opsPerSecond).to.be.greaterThan(500);
        });

        // Higher parallelism should generally be faster (allowing for overhead)
        const singleCoreOps = benchmarks[0].opsPerSecond;
        const maxCoreOps = benchmarks[benchmarks.length - 1].opsPerSecond;

        if (coreCount > 1) {
          expect(maxCoreOps).to.be.greaterThan(singleCoreOps * 0.8); // At least 80% scaling efficiency
        }
      });

    });

  });

  describe('Buffer Cleanup and Optimization', () => {

    describe('RED Phase - Cleanup Performance', () => {

      it('should perform incremental cleanup without blocking operations', async function() {
        // RED: Cleanup should not interfere with ongoing operations
        this.timeout(10000); // 10 second timeout

        const terminalId = 'cleanup-test';
        const continuousOperations = 2000;
        const cleanupInterval = 100; // Cleanup every 100 operations

        let operationsCompleted = 0;
        let cleanupOperations = 0;
        let maxOperationDelay = 0;

        // Continuous operations with periodic cleanup
        const operationPromises = [];
        for (let i = 0; i < continuousOperations; i++) {
          const operationStart = performance.now();

          const operationPromise = performanceManager.bufferOutput(terminalId, `Operation ${i}\n`)
            .then(() => {
              const operationEnd = performance.now();
              const delay = operationEnd - operationStart;
              maxOperationDelay = Math.max(maxOperationDelay, delay);
              operationsCompleted++;
            });

          operationPromises.push(operationPromise);

          // Trigger cleanup periodically
          if (i % cleanupInterval === 0 && i > 0) {
            performanceManager.incrementalCleanup(terminalId).then(() => {
              cleanupOperations++;
            });
          }
        }

        await Promise.all(operationPromises);

        expect(operationsCompleted).to.equal(continuousOperations);
        expect(cleanupOperations).to.be.greaterThan(15); // Should have performed multiple cleanups

        // No single operation should be severely delayed by cleanup
        expect(maxOperationDelay).to.be.lessThan(100); // Less than 100ms
      });

      it('should optimize buffer structure during cleanup', async function() {
        // RED: Cleanup should improve buffer performance over time
        this.timeout(8000); // 8 second timeout

        const terminalId = 'optimization-cleanup-test';

        // Create fragmented buffer state
        for (let i = 0; i < 1000; i++) {
          await performanceManager.bufferOutput(terminalId, `Fragmentation ${i}\n`);

          // Randomly remove some entries to create fragmentation
          if (i % 10 === 0) {
            await performanceManager.removeOldBufferEntries(terminalId, 3);
          }
        }

        // Measure performance before optimization
        const beforeOptimization = performance.now();
        for (let i = 0; i < 100; i++) {
          await performanceManager.bufferOutput(terminalId, `Before ${i}\n`);
        }
        const beforeTime = performance.now() - beforeOptimization;

        // Perform optimization cleanup
        await performanceManager.optimizeBufferStructure(terminalId);

        // Measure performance after optimization
        const afterOptimization = performance.now();
        for (let i = 0; i < 100; i++) {
          await performanceManager.bufferOutput(terminalId, `After ${i}\n`);
        }
        const afterTime = performance.now() - afterOptimization;

        // Performance should improve after optimization
        expect(afterTime).to.be.lessThan(beforeTime * 0.9); // At least 10% improvement
      });

      it('should handle cleanup under memory pressure efficiently', async function() {
        // RED: Cleanup should be aggressive under memory pressure
        this.timeout(12000); // 12 second timeout

        const terminalId = 'memory-pressure-test';

        // Simulate memory pressure by creating large buffers
        const largeOutputs = Array(100).fill('Large output: ' + 'X'.repeat(10000));

        for (const output of largeOutputs) {
          await performanceManager.bufferOutput(terminalId, output);
        }

        const beforeCleanupMemory = process.memoryUsage().heapUsed;

        // Simulate memory pressure cleanup
        await performanceManager.aggressiveCleanupUnderMemoryPressure(terminalId);

        if (global.gc) global.gc();

        const afterCleanupMemory = process.memoryUsage().heapUsed;
        const memoryFreed = beforeCleanupMemory - afterCleanupMemory;

        // Should free significant memory
        expect(memoryFreed).to.be.greaterThan(500 * 1024); // At least 500KB freed

        // Buffer should still be functional after aggressive cleanup
        await performanceManager.bufferOutput(terminalId, 'Post-cleanup test');
        const bufferSize = performanceManager.getBufferSize(terminalId);
        expect(bufferSize).to.be.greaterThan(0);
      });

    });

  });

});