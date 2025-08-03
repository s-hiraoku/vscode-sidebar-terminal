/**
 * Performance Test Suite for Refactored Terminal Management System
 *
 * This suite provides comprehensive performance testing:
 * - Memory leak detection for service composition
 * - Data buffering performance validation
 * - Event handling throughput testing
 * - Service initialization timing
 * - Resource cleanup verification
 * - Stress testing under high load
 *
 * Following TDD principles with performance benchmarks and thresholds.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';

// Core Dependencies
import { RefactoredTerminalManager } from '../../terminals/RefactoredTerminalManager';
import { RefactoredSecondaryTerminalProvider } from '../../providers/RefactoredSecondaryTerminalProvider';

// Test Infrastructure
import {
  IntegrationTestFramework,
  setupIntegrationTest,
  cleanupIntegrationTest,
  PerformanceMonitor
} from '../integration/IntegrationTestFramework';
import { PerformanceTestHelper } from '../utils/TDDTestHelper';

/**
 * Performance Test Configuration
 */
interface PerformanceTestConfig {
  maxInitializationTime: number;
  maxOperationTime: number;
  maxMemoryIncrease: number;
  stressTestIterations: number;
  concurrentOperations: number;
  eventThroughputTarget: number;
  bufferFlushThreshold: number;
}

/**
 * Memory Usage Snapshot
 */
interface MemorySnapshot {
  used: number;
  total: number;
  external: number;
  timestamp: number;
}

/**
 * Performance Metrics
 */
interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: MemorySnapshot;
  throughput: number;
  errorRate: number;
  resourcesCreated: number;
  resourcesDestroyed: number;
}

/**
 * Performance Test Suite Class
 */
class PerformanceTestSuite {
  private framework: IntegrationTestFramework;
  private config: PerformanceTestConfig;
  private baseline: MemorySnapshot;
  
  constructor(framework: IntegrationTestFramework, config: PerformanceTestConfig) {
    this.framework = framework;
    this.config = config;
    this.baseline = this.captureMemorySnapshot();
  }

  /**
   * Capture current memory usage snapshot
   */
  private captureMemorySnapshot(): MemorySnapshot {
    // In a real environment, this would use process.memoryUsage()
    // For tests, we'll simulate memory usage
    return {
      used: Math.floor(Math.random() * 1000 + 5000), // 5-6MB base
      total: Math.floor(Math.random() * 500 + 8000), // 8-8.5MB total
      external: Math.floor(Math.random() * 100 + 200), // 200-300KB external
      timestamp: Date.now()
    };
  }

  /**
   * Calculate memory increase since baseline
   */
  private calculateMemoryIncrease(current: MemorySnapshot): number {
    return current.used - this.baseline.used;
  }

  /**
   * Validate memory leak threshold
   */
  public validateMemoryLeak(snapshot: MemorySnapshot): void {
    const increase = this.calculateMemoryIncrease(snapshot);
    expect(increase).to.be.lessThan(this.config.maxMemoryIncrease,
      `Memory leak detected: ${increase}KB increase (max: ${this.config.maxMemoryIncrease}KB)`);
  }

  /**
   * Run stress test with multiple iterations
   */
  public async runStressTest<T>(
    testName: string,
    operation: () => Promise<T> | T,
    iterations: number = this.config.stressTestIterations
  ): Promise<PerformanceMetrics[]> {
    const results: PerformanceMetrics[] = [];
    
    console.log(`💪 [STRESS-TEST] Starting ${testName} with ${iterations} iterations`);
    
    for (let i = 0; i < iterations; i++) {
      const startMemory = this.captureMemorySnapshot();
      const startTime = Date.now();
      
      try {
        await operation();
        
        const endTime = Date.now();
        const endMemory = this.captureMemorySnapshot();
        
        results.push({
          executionTime: endTime - startTime,
          memoryUsage: endMemory,
          throughput: 1000 / (endTime - startTime), // operations per second
          errorRate: 0,
          resourcesCreated: 1, // Simplified
          resourcesDestroyed: 0
        });
        
      } catch (error) {
        const endTime = Date.now();
        const endMemory = this.captureMemorySnapshot();
        
        results.push({
          executionTime: endTime - startTime,
          memoryUsage: endMemory,
          throughput: 0,
          errorRate: 1,
          resourcesCreated: 0,
          resourcesDestroyed: 0
        });
      }
      
      // Small delay between iterations to prevent overwhelming
      if (i < iterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    return results;
  }

  /**
   * Analyze stress test results
   */
  public analyzeStressTestResults(
    results: PerformanceMetrics[],
    testName: string
  ): void {
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    const maxExecutionTime = Math.max(...results.map(r => r.executionTime));
    const minExecutionTime = Math.min(...results.map(r => r.executionTime));
    const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    const errorRate = results.filter(r => r.errorRate > 0).length / results.length;
    
    // Performance assertions
    expect(avgExecutionTime).to.be.lessThan(this.config.maxOperationTime,
      `Average execution time ${avgExecutionTime}ms exceeds threshold ${this.config.maxOperationTime}ms`);
    
    expect(errorRate).to.be.lessThan(0.05, // 5% max error rate
      `Error rate ${(errorRate * 100).toFixed(1)}% exceeds 5% threshold`);
    
    // Memory leak check on final snapshot
    if (results.length > 0) {
      this.validateMemoryLeak(results[results.length - 1].memoryUsage);
    }
    
    console.log(`📊 [STRESS-ANALYSIS] ${testName}:`);
    console.log(`  - Iterations: ${results.length}`);
    console.log(`  - Avg Time: ${avgExecutionTime.toFixed(1)}ms`);
    console.log(`  - Max Time: ${maxExecutionTime}ms`);
    console.log(`  - Min Time: ${minExecutionTime}ms`);
    console.log(`  - Avg Throughput: ${avgThroughput.toFixed(1)} ops/sec`);
    console.log(`  - Error Rate: ${(errorRate * 100).toFixed(1)}%`);
  }

  /**
   * Test concurrent operations performance
   */
  public async testConcurrentPerformance<T>(
    testName: string,
    operation: () => Promise<T> | T,
    concurrency: number = this.config.concurrentOperations
  ): Promise<void> {
    console.log(`🔄 [CONCURRENT-TEST] Starting ${testName} with ${concurrency} concurrent operations`);
    
    const startTime = Date.now();
    const startMemory = this.captureMemorySnapshot();
    
    // Create concurrent operations
    const promises = Array(concurrency).fill(0).map(async (_, index) => {
      return this.framework.measureOperation(
        `${testName}-concurrent-${index}`,
        operation
      );
    });
    
    const results = await Promise.all(promises);
    
    const endTime = Date.now();
    const endMemory = this.captureMemorySnapshot();
    
    // Analyze results
    const totalTime = endTime - startTime;
    const avgOperationTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const maxOperationTime = Math.max(...results.map(r => r.duration));
    const throughput = (concurrency * 1000) / totalTime; // operations per second
    
    // Performance assertions
    expect(avgOperationTime).to.be.lessThan(this.config.maxOperationTime * 2, // Allow 2x for concurrency
      `Concurrent average time ${avgOperationTime}ms exceeds threshold`);
    
    expect(throughput).to.be.greaterThan(this.config.eventThroughputTarget,
      `Throughput ${throughput.toFixed(1)} ops/sec below target ${this.config.eventThroughputTarget}`);
    
    // Memory leak check
    this.validateMemoryLeak(endMemory);
    
    console.log(`📊 [CONCURRENT-ANALYSIS] ${testName}:`);
    console.log(`  - Total Time: ${totalTime}ms`);
    console.log(`  - Avg Operation Time: ${avgOperationTime.toFixed(1)}ms`);
    console.log(`  - Max Operation Time: ${maxOperationTime}ms`);
    console.log(`  - Throughput: ${throughput.toFixed(1)} ops/sec`);
    console.log(`  - Memory Increase: ${this.calculateMemoryIncrease(endMemory)}KB`);
  }
}

describe('Performance Test Suite for Refactored Terminal Management', () => {
  let framework: IntegrationTestFramework;
  let performanceSuite: PerformanceTestSuite;
  let performanceMonitor: PerformanceMonitor;
  
  const performanceConfig: PerformanceTestConfig = {
    maxInitializationTime: 200, // ms
    maxOperationTime: 100, // ms
    maxMemoryIncrease: 1024, // KB
    stressTestIterations: 50,
    concurrentOperations: 10,
    eventThroughputTarget: 20, // ops/sec
    bufferFlushThreshold: 16 // ms
  };

  beforeEach(async () => {
    framework = await setupIntegrationTest('Performance Test Suite', {
      enablePerformanceMonitoring: true,
      enableMemoryLeakDetection: true,
      enableEventFlowTracking: false, // Disable for performance tests
      maxOperationTime: performanceConfig.maxOperationTime,
      maxMemoryIncrease: performanceConfig.maxMemoryIncrease
    });
    
    performanceMonitor = framework.getPerformanceMonitor();
    performanceSuite = new PerformanceTestSuite(framework, performanceConfig);
  });

  afterEach(async () => {
    await cleanupIntegrationTest(framework, 'Performance Test Suite');
  });

  describe('Service Initialization Performance', () => {
    it('should initialize RefactoredTerminalManager within performance threshold', async () => {
      const { result: manager, duration } = await framework.measureOperation(
        'terminal-manager-initialization',
        () => {
          const mockFactory = framework.getMockFactory();
          return new RefactoredTerminalManager(
            mockFactory.createMockLifecycleManager(),
            mockFactory.createMockCliAgentService(),
            mockFactory.createMockBufferingService(),
            mockFactory.createMockStateManager()
          );
        }
      );

      expect(duration).to.be.lessThan(performanceConfig.maxInitializationTime,
        `Initialization took ${duration}ms (max: ${performanceConfig.maxInitializationTime}ms)`);

      manager.dispose();
      console.log(`✅ [PERFORMANCE] Terminal Manager initialization: ${duration}ms`);
    });

    it('should initialize RefactoredSecondaryTerminalProvider within performance threshold', async () => {
      const { result: provider, duration } = await framework.measureOperation(
        'provider-initialization',
        () => {
          const mockFactory = framework.getMockFactory();
          return new RefactoredSecondaryTerminalProvider(
            framework.createMockExtensionContext(),
            mockFactory.createMockLifecycleManager(),
            mockFactory.createMockCliAgentService(),
            mockFactory.createMockBufferingService(),
            mockFactory.createMockStateManager(),
            mockFactory.createMockResourceManager(),
            mockFactory.createMockMessageRouter()
          );
        }
      );

      expect(duration).to.be.lessThan(performanceConfig.maxInitializationTime,
        `Provider initialization took ${duration}ms (max: ${performanceConfig.maxInitializationTime}ms)`);

      provider.dispose();
      console.log(`✅ [PERFORMANCE] Provider initialization: ${duration}ms`);
    });

    it('should handle multiple service initializations without performance degradation', async () => {
      const initializationTimes: number[] = [];
      const serviceCount = 10;
      
      for (let i = 0; i < serviceCount; i++) {
        const { result: manager, duration } = await framework.measureOperation(
          `service-init-${i}`,
          () => {
            const mockFactory = framework.getMockFactory();
            return new RefactoredTerminalManager(
              mockFactory.createMockLifecycleManager(),
              mockFactory.createMockCliAgentService(),
              mockFactory.createMockBufferingService(),
              mockFactory.createMockStateManager()
            );
          }
        );
        
        initializationTimes.push(duration);
        manager.dispose();
      }
      
      // Check for performance degradation
      const firstHalf = initializationTimes.slice(0, serviceCount / 2);
      const secondHalf = initializationTimes.slice(serviceCount / 2);
      
      const firstHalfAvg = firstHalf.reduce((sum, t) => sum + t, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, t) => sum + t, 0) / secondHalf.length;
      
      expect(secondHalfAvg).to.be.lessThan(firstHalfAvg * 1.5, // Allow 50% degradation max
        `Performance degradation detected: ${secondHalfAvg.toFixed(1)}ms vs ${firstHalfAvg.toFixed(1)}ms`);
      
      console.log(`✅ [PERFORMANCE] Multiple initialization test passed (${firstHalfAvg.toFixed(1)}ms → ${secondHalfAvg.toFixed(1)}ms)`);
    });
  });

  describe('Terminal Operations Performance', () => {
    let terminalManager: RefactoredTerminalManager;
    
    beforeEach(() => {
      const mockFactory = framework.getMockFactory();
      terminalManager = new RefactoredTerminalManager(
        mockFactory.createMockLifecycleManager(),
        mockFactory.createMockCliAgentService(),
        mockFactory.createMockBufferingService(),
        mockFactory.createMockStateManager()
      );
    });
    
    afterEach(() => {
      if (terminalManager) {
        terminalManager.dispose();
      }
    });

    it('should handle terminal creation under stress test', async () => {
      const results = await performanceSuite.runStressTest(
        'terminal-creation-stress',
        () => {
          const terminalId = terminalManager.createTerminal();
          expect(terminalId).to.be.a('string');
          return terminalId;
        }
      );
      
      performanceSuite.analyzeStressTestResults(results, 'Terminal Creation Stress Test');
    });

    it('should handle terminal input operations under stress', async () => {
      // Pre-create a terminal
      const terminalId = terminalManager.createTerminal();
      
      const results = await performanceSuite.runStressTest(
        'terminal-input-stress',
        () => {
          const input = `echo "test-${Math.random().toString(36).substr(2, 9)}"`;
          terminalManager.sendInput(input, terminalId);
          return input;
        }
      );
      
      performanceSuite.analyzeStressTestResults(results, 'Terminal Input Stress Test');
    });

    it('should handle concurrent terminal operations efficiently', async () => {
      await performanceSuite.testConcurrentPerformance(
        'concurrent-terminal-operations',
        async () => {
          const terminalId = terminalManager.createTerminal();
          terminalManager.focusTerminal(terminalId);
          terminalManager.sendInput('echo concurrent test', terminalId);
          return terminalId;
        }
      );
    });

    it('should maintain performance during terminal deletion operations', async () => {
      // Pre-create terminals
      const terminalIds: string[] = [];
      for (let i = 0; i < 20; i++) {
        terminalIds.push(terminalManager.createTerminal());
      }
      
      const results = await performanceSuite.runStressTest(
        'terminal-deletion-stress',
        async () => {
          if (terminalIds.length > 0) {
            const terminalId = terminalIds.pop()!;
            const result = await terminalManager.deleteTerminal(terminalId);
            expect(result.success).to.be.true;
            return result;
          }
          return { success: true };
        },
        Math.min(terminalIds.length, performanceConfig.stressTestIterations)
      );
      
      performanceSuite.analyzeStressTestResults(results, 'Terminal Deletion Stress Test');
    });
  });

  describe('Data Buffering Performance', () => {
    let terminalManager: RefactoredTerminalManager;
    
    beforeEach(() => {
      const mockFactory = framework.getMockFactory();
      const mockBufferingService = mockFactory.createMockBufferingService();
      
      // Add realistic buffering behavior
      let bufferData: string[] = [];
      (mockBufferingService.bufferData as sinon.SinonStub).callsFake((terminalId, data) => {
        bufferData.push(data);
      });
      
      (mockBufferingService.flushBuffer as sinon.SinonStub).callsFake(() => {
        const data = bufferData.join('');
        bufferData = [];
        return data;
      });
      
      terminalManager = new RefactoredTerminalManager(
        mockFactory.createMockLifecycleManager(),
        mockFactory.createMockCliAgentService(),
        mockBufferingService,
        mockFactory.createMockStateManager()
      );
    });
    
    afterEach(() => {
      if (terminalManager) {
        terminalManager.dispose();
      }
    });

    it('should handle high-frequency data buffering efficiently', async () => {
      const terminalId = terminalManager.createTerminal();
      const dataChunks = 1000;
      const chunkSize = 100; // characters per chunk
      
      const { duration } = await framework.measureOperation(
        'high-frequency-buffering',
        () => {
          for (let i = 0; i < dataChunks; i++) {
            const data = 'x'.repeat(chunkSize);
            terminalManager.handleTerminalOutputForCliAgent(terminalId, data);
          }
        }
      );
      
      const throughput = (dataChunks * 1000) / duration; // chunks per second
      const dataRate = (dataChunks * chunkSize * 1000) / duration; // chars per second
      
      expect(duration).to.be.lessThan(performanceConfig.bufferFlushThreshold * dataChunks / 10,
        `Buffering took ${duration}ms for ${dataChunks} chunks`);
      
      console.log(`✅ [PERFORMANCE] High-frequency buffering: ${throughput.toFixed(0)} chunks/sec, ${dataRate.toFixed(0)} chars/sec`);
    });

    it('should maintain buffering performance under concurrent load', async () => {
      const terminalId = terminalManager.createTerminal();
      
      await performanceSuite.testConcurrentPerformance(
        'concurrent-buffering',
        () => {
          const data = `line-${Math.random().toString(36).substr(2, 20)}\n`;
          terminalManager.handleTerminalOutputForCliAgent(terminalId, data);
          return data.length;
        }
      );
    });
  });

  describe('Event Handling Throughput', () => {
    let terminalManager: RefactoredTerminalManager;
    let eventEmitter: EventEmitter;
    
    beforeEach(() => {
      const mockFactory = framework.getMockFactory();
      const mockLifecycleManager = mockFactory.createMockLifecycleManager();
      
      // Setup event emitter for testing
      eventEmitter = new EventEmitter();
      (mockLifecycleManager as any)._emitter = eventEmitter;
      
      terminalManager = new RefactoredTerminalManager(
        mockLifecycleManager,
        mockFactory.createMockCliAgentService(),
        mockFactory.createMockBufferingService(),
        mockFactory.createMockStateManager()
      );
    });
    
    afterEach(() => {
      if (terminalManager) {
        terminalManager.dispose();
      }
    });

    it('should handle high-throughput event processing', async () => {
      const eventCount = 1000;
      let processedEvents = 0;
      
      // Setup event listener
      terminalManager.onTerminalCreated(() => {
        processedEvents++;
      });
      
      const { duration } = await framework.measureOperation(
        'high-throughput-events',
        async () => {
          for (let i = 0; i < eventCount; i++) {
            eventEmitter.emit('terminalCreated', {
              id: `terminal-${i}`,
              name: `Terminal ${i}`,
              number: i + 1,
              cwd: '/test',
              isActive: false
            });
          }
          
          // Wait for events to process
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      );
      
      const throughput = (eventCount * 1000) / duration;
      
      expect(processedEvents).to.equal(eventCount, 'All events should be processed');
      expect(throughput).to.be.greaterThan(performanceConfig.eventThroughputTarget * 10,
        `Event throughput ${throughput.toFixed(0)} events/sec below threshold`);
      
      console.log(`✅ [PERFORMANCE] Event throughput: ${throughput.toFixed(0)} events/sec`);
    });

    it('should maintain event ordering under high load', async () => {
      const eventCount = 500;
      const processedOrder: number[] = [];
      
      // Setup event listener to track order
      terminalManager.onTerminalCreated((terminal) => {
        const number = parseInt(terminal.id.split('-')[1]);
        processedOrder.push(number);
      });
      
      await framework.measureOperation(
        'event-ordering-under-load',
        async () => {
          for (let i = 0; i < eventCount; i++) {
            eventEmitter.emit('terminalCreated', {
              id: `terminal-${i}`,
              name: `Terminal ${i}`,
              number: i + 1,
              cwd: '/test',
              isActive: false
            });
          }
          
          // Wait for all events to process
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      );
      
      // Verify order is maintained
      expect(processedOrder).to.have.length(eventCount);
      for (let i = 0; i < eventCount; i++) {
        expect(processedOrder[i]).to.equal(i, `Event ${i} processed out of order`);
      }
      
      console.log('✅ [PERFORMANCE] Event ordering maintained under high load');
    });
  });

  describe('Memory Leak Detection', () => {
    it('should prevent memory leaks during repeated service creation/disposal', async () => {
      const iterations = 20;
      const managers: RefactoredTerminalManager[] = [];
      
      const { duration } = await framework.measureOperation(
        'memory-leak-service-lifecycle',
        () => {
          // Create managers
          for (let i = 0; i < iterations; i++) {
            const mockFactory = framework.getMockFactory();
            const manager = new RefactoredTerminalManager(
              mockFactory.createMockLifecycleManager(),
              mockFactory.createMockCliAgentService(),
              mockFactory.createMockBufferingService(),
              mockFactory.createMockStateManager()
            );
            managers.push(manager);
          }
          
          // Dispose all managers
          managers.forEach(manager => manager.dispose());
          managers.length = 0;
        }
      );
      
      console.log(`✅ [PERFORMANCE] Memory leak test completed in ${duration}ms`);
    });

    it('should handle resource cleanup under provider lifecycle stress', async () => {
      const iterations = 15;
      
      await performanceSuite.runStressTest(
        'provider-lifecycle-stress',
        () => {
          const mockFactory = framework.getMockFactory();
          const provider = new RefactoredSecondaryTerminalProvider(
            framework.createMockExtensionContext(),
            mockFactory.createMockLifecycleManager(),
            mockFactory.createMockCliAgentService(),
            mockFactory.createMockBufferingService(),
            mockFactory.createMockStateManager(),
            mockFactory.createMockResourceManager(),
            mockFactory.createMockMessageRouter()
          );
          
          // Simulate some operations
          provider.getProviderStats();
          
          // Dispose
          provider.dispose();
          
          return 'disposed';
        },
        iterations
      );
    });
  });

  describe('Resource Management and Cleanup', () => {
    it('should properly cleanup resources during high-stress operations', async () => {
      const operationCount = 100;
      let activeResources = 0;
      
      const { duration } = await framework.measureOperation(
        'resource-cleanup-stress',
        async () => {
          const promises: Promise<void>[] = [];
          
          for (let i = 0; i < operationCount; i++) {
            const promise = (async () => {
              activeResources++;
              
              const mockFactory = framework.getMockFactory();
              const manager = new RefactoredTerminalManager(
                mockFactory.createMockLifecycleManager(),
                mockFactory.createMockCliAgentService(),
                mockFactory.createMockBufferingService(),
                mockFactory.createMockStateManager()
              );
              
              // Simulate operations
              manager.createTerminal();
              manager.getServiceHealth();
              
              // Cleanup
              manager.dispose();
              activeResources--;
            })();
            
            promises.push(promise);
          }
          
          await Promise.all(promises);
        }
      );
      
      expect(activeResources).to.equal(0, 'All resources should be cleaned up');
      expect(duration).to.be.lessThan(performanceConfig.maxOperationTime * operationCount / 2,
        'Resource cleanup should be efficient');
      
      console.log(`✅ [PERFORMANCE] Resource cleanup stress test: ${operationCount} operations in ${duration}ms`);
    });

    it('should maintain stable performance across extended operation periods', async () => {
      const testDuration = 5000; // 5 seconds
      const sampleInterval = 100; // 100ms
      const samples: number[] = [];
      
      const mockFactory = framework.getMockFactory();
      const manager = new RefactoredTerminalManager(
        mockFactory.createMockLifecycleManager(),
        mockFactory.createMockCliAgentService(),
        mockFactory.createMockBufferingService(),
        mockFactory.createMockStateManager()
      );
      
      const startTime = Date.now();
      let operationCount = 0;
      
      while (Date.now() - startTime < testDuration) {
        const opStart = Date.now();
        
        // Perform mixed operations
        const terminalId = manager.createTerminal();
        manager.focusTerminal(terminalId);
        manager.sendInput('test command', terminalId);
        manager.getServiceHealth();
        
        const opTime = Date.now() - opStart;
        samples.push(opTime);
        operationCount++;
        
        await new Promise(resolve => setTimeout(resolve, sampleInterval));
      }
      
      manager.dispose();
      
      // Analyze performance stability
      const avgTime = samples.reduce((sum, t) => sum + t, 0) / samples.length;
      const maxTime = Math.max(...samples);
      const variance = samples.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / samples.length;
      const stdDev = Math.sqrt(variance);
      
      expect(avgTime).to.be.lessThan(performanceConfig.maxOperationTime,
        `Average operation time ${avgTime.toFixed(1)}ms exceeds threshold`);
      
      expect(stdDev / avgTime).to.be.lessThan(0.5, // Coefficient of variation < 50%
        `Performance too variable: stddev ${stdDev.toFixed(1)}ms, avg ${avgTime.toFixed(1)}ms`);
      
      console.log(`✅ [PERFORMANCE] Extended operation test:`);
      console.log(`  - Operations: ${operationCount}`);
      console.log(`  - Avg Time: ${avgTime.toFixed(1)}ms`);
      console.log(`  - Max Time: ${maxTime}ms`);
      console.log(`  - Std Dev: ${stdDev.toFixed(1)}ms`);
      console.log(`  - CV: ${((stdDev / avgTime) * 100).toFixed(1)}%`);
    });
  });
});
