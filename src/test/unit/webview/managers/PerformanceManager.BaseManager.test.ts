/**
 * PerformanceManager BaseManager Integration Tests - Enhanced test suite using CommonTestHelpers
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { PerformanceManager } from '../../../../webview/managers/PerformanceManager';
import { 
  createMockCoordinator, 
  setupManagerTest, 
  cleanupManagerTest, 
  TestPatterns,
  DOMTestUtils,
  AsyncTestUtils,
  PerformanceTestUtils
} from '../../../../webview/utils/CommonTestHelpers';

describe('PerformanceManager BaseManager Integration', () => {
  let testSetup: ReturnType<typeof setupManagerTest<PerformanceManager>>;
  let mockTerminal: sinon.SinonStubbedInstance<Terminal>;
  let mockFitAddon: sinon.SinonStubbedInstance<FitAddon>;

  beforeEach(() => {
    // Setup DOM environment
    DOMTestUtils.setupDOM();
    
    // Setup manager with BaseManager functionality
    testSetup = setupManagerTest(PerformanceManager);
    
    // Create mock terminal and fit addon
    mockTerminal = sinon.createStubInstance(Terminal);
    mockFitAddon = sinon.createStubInstance(FitAddon);
    
    // Initialize the manager
    testSetup.manager.initialize(testSetup.coordinator);
  });

  afterEach(() => {
    cleanupManagerTest(testSetup);
    DOMTestUtils.cleanupDOM();
  });

  describe('BaseManager Inheritance', () => {
    it('should properly initialize with BaseManager functionality', () => {
      const { manager } = testSetup;
      
      // Test BaseManager initialization
      TestPatterns.testManagerInitialization(manager, testSetup.coordinator);
      
      // PerformanceManager should have BaseManager methods
      expect(manager).to.have.property('getStatus');
      expect(manager).to.have.property('log');
      expect(manager).to.have.property('dispose');
    });

    it('should use BaseManager logging for all operations', () => {
      const { manager } = testSetup;
      
      // Stub the BaseManager log method
      const logSpy = sinon.spy(manager, 'log');
      
      // Call operations that should use this.log()
      manager.scheduleOutputBuffer('test data', mockTerminal as any);
      manager.flushOutputBuffer();
      
      // Verify BaseManager log was called
      expect(logSpy.callCount).to.be.greaterThan(0);
      expect(logSpy.calledWith(sinon.match('[PERFORMANCE]'))).to.be.true;
    });

    it('should properly dispose with BaseManager cleanup', () => {
      const { manager } = testSetup;
      
      // Setup some operations first
      manager.scheduleOutputBuffer('test', mockTerminal as any);
      manager.setCliAgentMode(true);
      
      // Test manager disposal
      TestPatterns.testManagerDisposal(manager);
    });

    it('should handle performance errors with BaseManager error recovery', () => {
      const { manager } = testSetup;
      
      // Test error handling during flush
      TestPatterns.testErrorHandling(
        manager,
        () => {
          // Force an error by setting invalid terminal
          (manager as any).currentBufferTerminal = null;
          manager.scheduleOutputBuffer('test', null as any);
          manager.flushOutputBuffer();
        }
      );
    });
  });

  describe('Enhanced Output Buffering', () => {
    it('should handle different buffer strategies with proper logging', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Test small input (immediate flush)
      manager.scheduleOutputBuffer('a', mockTerminal as any);
      expect(logSpy.calledWith(sinon.match('Immediate write'))).to.be.true;
      
      logSpy.resetHistory();
      
      // Test medium input (buffered)
      manager.scheduleOutputBuffer('medium length data that should be buffered', mockTerminal as any);
      expect(logSpy.calledWith(sinon.match('Buffered write'))).to.be.true;
      
      // Test large input (immediate flush)
      const largeData = 'a'.repeat(600);
      manager.scheduleOutputBuffer(largeData, mockTerminal as any);
      expect(logSpy.calledWith(sinon.match('large output'))).to.be.true;
    });

    it('should optimize buffer flushing based on CLI Agent mode', async () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Enable CLI Agent mode
      manager.setCliAgentMode(true);
      expect(logSpy.calledWith(sinon.match('CLI Agent mode: ACTIVE'))).to.be.true;
      
      // Buffer some data
      manager.scheduleOutputBuffer('buffered data for CLI agent', mockTerminal as any);
      
      // Should schedule faster flush for CLI Agent mode
      await AsyncTestUtils.waitFor(
        () => logSpy.calledWith(sinon.match('Scheduled flush in 2ms')),
        100,
        5
      );
      
      expect(logSpy.calledWith(sinon.match('CLI Agent: true'))).to.be.true;
    });

    it('should handle buffer overflow and emergency conditions', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Fill buffer to capacity
      const maxBufferSize = 50; // From SPLIT_CONSTANTS.MAX_BUFFER_SIZE
      for (let i = 0; i < maxBufferSize; i++) {
        manager.scheduleOutputBuffer(`data-${i}`, mockTerminal as any);
      }
      
      // Next write should trigger immediate flush due to buffer full
      manager.scheduleOutputBuffer('overflow data', mockTerminal as any);
      expect(logSpy.calledWith(sinon.match('buffer full'))).to.be.true;
    });

    it('should measure buffer performance accurately', () => {
      const { manager } = testSetup;
      
      // Performance test for buffer operations
      const { duration } = PerformanceTestUtils.measureTime(() => {
        // Perform multiple buffer operations
        for (let i = 0; i < 100; i++) {
          manager.scheduleOutputBuffer(`test-${i}`, mockTerminal as any);
        }
        manager.flushOutputBuffer();
      });
      
      // Should handle 100 operations quickly (< 100ms)
      expect(duration).to.be.lessThan(100);
      
      // Buffer should be empty after flush
      const stats = manager.getBufferStats();
      expect(stats.bufferSize).to.equal(0);
    });
  });

  describe('Debounced Resize Operations', () => {
    it('should debounce resize operations effectively', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Test resize debouncing
      TestPatterns.testPerformancePattern(
        () => {
          manager.debouncedResize(80, 24, mockTerminal as any, mockFitAddon as any);
        },
        5, // Call 5 times rapidly
        1, // Should debounce to 1 actual resize
        mockTerminal.resize
      );
      
      expect(logSpy.calledWith(sinon.match('Debounced resize scheduled'))).to.be.true;
    });

    it('should handle resize errors gracefully', async () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Make terminal.resize throw error
      mockTerminal.resize.throws(new Error('Resize failed'));
      
      // Trigger resize
      manager.debouncedResize(80, 24, mockTerminal as any, mockFitAddon as any);
      
      // Wait for debounce delay
      await AsyncTestUtils.waitFor(
        () => logSpy.calledWith(sinon.match('Error during debounced resize')),
        200,
        10
      );
      
      expect(logSpy.calledWith(sinon.match('Resize failed'))).to.be.true;
    });
  });

  describe('CLI Agent Mode Optimization', () => {
    it('should optimize performance for CLI Agent interactions', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Test mode changes
      expect(manager.getCliAgentMode()).to.be.false;
      
      manager.setCliAgentMode(true);
      expect(manager.getCliAgentMode()).to.be.true;
      expect(logSpy.calledWith(sinon.match('CLI Agent mode: ACTIVE'))).to.be.true;
      
      manager.setCliAgentMode(false);
      expect(manager.getCliAgentMode()).to.be.false;
      expect(logSpy.calledWith(sinon.match('CLI Agent mode: INACTIVE'))).to.be.true;
    });

    it('should flush buffers immediately when CLI Agent mode deactivates', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Enable CLI Agent mode and buffer some data
      manager.setCliAgentMode(true);
      manager.scheduleOutputBuffer('cli agent data', mockTerminal as any);
      
      // Disable CLI Agent mode
      manager.setCliAgentMode(false);
      
      // Should trigger immediate flush
      expect(logSpy.calledWith(sinon.match('Flushed buffer'))).to.be.true;
    });

    it('should adapt flush intervals based on CLI Agent activity', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Test normal mode flush interval
      manager.scheduleOutputBuffer('normal data', mockTerminal as any);
      expect(logSpy.calledWith(sinon.match('CLI Agent: false'))).to.be.true;
      
      // Test CLI Agent mode flush interval
      manager.setCliAgentMode(true);
      manager.scheduleOutputBuffer('cli agent data', mockTerminal as any);
      expect(logSpy.calledWith(sinon.match('CLI Agent: true'))).to.be.true;
    });
  });

  describe('Buffer Statistics and Monitoring', () => {
    it('should provide accurate buffer statistics', () => {
      const { manager } = testSetup;
      
      // Initial stats
      let stats = manager.getBufferStats();
      expect(stats.bufferSize).to.equal(0);
      expect(stats.isFlushScheduled).to.be.false;
      expect(stats.isCliAgentMode).to.be.false;
      expect(stats.currentTerminal).to.be.false;
      
      // After buffering
      manager.scheduleOutputBuffer('test data', mockTerminal as any);
      stats = manager.getBufferStats();
      expect(stats.bufferSize).to.be.greaterThan(0);
      expect(stats.currentTerminal).to.be.true;
      
      // After CLI Agent mode
      manager.setCliAgentMode(true);
      stats = manager.getBufferStats();
      expect(stats.isCliAgentMode).to.be.true;
    });

    it('should handle emergency operations correctly', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Buffer some data
      manager.scheduleOutputBuffer('emergency test', mockTerminal as any);
      
      // Test force flush
      manager.forceFlush();
      expect(logSpy.calledWith(sinon.match('Force flushing all buffers'))).to.be.true;
      
      // Buffer more data
      manager.scheduleOutputBuffer('clear test', mockTerminal as any);
      
      // Test clear buffers
      manager.clearBuffers();
      expect(logSpy.calledWith(sinon.match('Clearing all buffers'))).to.be.true;
      
      const stats = manager.getBufferStats();
      expect(stats.bufferSize).to.equal(0);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should manage memory efficiently during high-volume operations', () => {
      const { manager } = testSetup;
      
      // Test memory usage patterns
      PerformanceTestUtils.testMemoryUsage(() => {
        const tempManager = new PerformanceManager();
        tempManager.initialize(createMockCoordinator());
        
        // Simulate high-volume operations
        for (let i = 0; i < 50; i++) {
          tempManager.scheduleOutputBuffer(`data-${i}`, mockTerminal as any);
        }
        
        return tempManager;
      }, 10);
      
      // Original manager should still be functional
      expect(manager.getBufferStats()).to.be.an('object');
    });

    it('should cleanup all timers and references on dispose', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Setup various operations that create timers
      manager.scheduleOutputBuffer('dispose test', mockTerminal as any);
      manager.debouncedResize(80, 24, mockTerminal as any, mockFitAddon as any);
      manager.setCliAgentMode(true);
      
      // Dispose
      manager.dispose();
      
      // Should log disposal process
      expect(logSpy.calledWith(sinon.match('Disposing performance manager'))).to.be.true;
      expect(logSpy.calledWith(sinon.match('Performance manager disposed'))).to.be.true;
      
      // Buffer should be cleared
      const stats = manager.getBufferStats();
      expect(stats.bufferSize).to.equal(0);
      expect(stats.currentTerminal).to.be.false;
      expect(stats.isCliAgentMode).to.be.false;
    });

    it('should handle error recovery during buffer operations', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Make terminal.write throw error
      mockTerminal.write.throws(new Error('Write failed'));
      
      // Buffer data and flush
      manager.scheduleOutputBuffer('error test', mockTerminal as any);
      manager.flushOutputBuffer();
      
      // Should log the error and recover
      expect(logSpy.calledWith(sinon.match('Error during buffer flush'))).to.be.true;
      
      // Manager should still be functional
      expect(manager.getBufferStats().bufferSize).to.equal(0);
    });
  });

  describe('Integration with Terminal Operations', () => {
    it('should integrate properly with buffered write API', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Test buffered write method
      manager.bufferedWrite('api test data', mockTerminal as any, 'test-terminal');
      
      // Should use the same optimization logic
      expect(logSpy.calledWith(sinon.match('[PERFORMANCE]'))).to.be.true;
    });

    it('should preload next operations efficiently', () => {
      const { manager } = testSetup;
      
      // Buffer some data
      manager.scheduleOutputBuffer('preload test', mockTerminal as any);
      
      // Preload next operation
      manager.preloadNextOperation();
      
      // Should schedule flush for existing buffer
      const stats = manager.getBufferStats();
      expect(stats.isFlushScheduled).to.be.true;
    });
  });
});