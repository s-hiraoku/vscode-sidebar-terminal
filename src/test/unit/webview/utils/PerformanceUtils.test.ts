/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { PerformanceUtils } from '../../../../webview/utils/PerformanceUtils';

// Mock VS Code API
const mockVscode = {
  workspace: {
    getConfiguration: sinon.stub(),
  },
  window: {
    showErrorMessage: sinon.stub(),
    showWarningMessage: sinon.stub(),
    showInformationMessage: sinon.stub(),
  },
  ExtensionContext: sinon.stub(),
  ViewColumn: { One: 1 },
  TreeDataProvider: sinon.stub(),
  EventEmitter: sinon.stub(),
  CancellationToken: sinon.stub(),
  commands: {
    registerCommand: sinon.stub(),
    executeCommand: sinon.stub(),
  },
};

// Setup test environment
function setupTestEnvironment() {
  // Mock VS Code module
  (global as any).vscode = mockVscode;

  // Mock Node.js modules
  (global as any).require = sinon.stub();
  (global as any).module = { exports: {} };
  (global as any).process = {
    platform: 'linux',
    env: {
      NODE_ENV: 'test',
    },
  };
}

describe('PerformanceUtils', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;
  let perfUtils: PerformanceUtils;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    setupTestEnvironment();

    // Mock console before JSDOM creation
    (global as Record<string, unknown>).console = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    // Set up process.nextTick before JSDOM creation
    const originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      nextTick: (callback: () => void) => setImmediate(callback),
      env: { ...originalProcess.env, NODE_ENV: 'test' },
    };

    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-container"></div>
        </body>
      </html>
    `);
    document = dom.window.document;
    (global as any).document = document;
    (global as any).window = dom.window;
    (global as any).requestAnimationFrame = sinon.stub().callsArg(0);
    (global as any).cancelAnimationFrame = sinon.stub();

    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers();
    perfUtils = new PerformanceUtils();
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
    }
    if (clock) {
      clock.restore();
    }
    if (dom) {
      dom.window.close();
    }
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(perfUtils).to.be.an('object');
      expect(perfUtils.isMonitoring).to.be.false;
      expect(perfUtils.bufferSize).to.equal(1000);
    });

    it('should initialize with custom configuration', () => {
      const customPerfUtils = new PerformanceUtils({
        bufferSize: 500,
        enableMonitoring: true,
        sampleInterval: 100,
      });

      expect(customPerfUtils.bufferSize).to.equal(500);
      expect(customPerfUtils.isMonitoring).to.be.true;
    });
  });

  describe('debounce method', () => {
    it('should debounce function calls', () => {
      const fn = sinon.spy();
      const debouncedFn = perfUtils.debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).to.not.have.been.called;

      clock.tick(100);

      expect(fn).to.have.been.calledOnce;
    });

    it('should pass arguments to debounced function', () => {
      const fn = sinon.spy();
      const debouncedFn = perfUtils.debounce(fn, 100);

      debouncedFn('arg1', 'arg2');

      clock.tick(100);

      expect(fn).to.have.been.calledWith('arg1', 'arg2');
    });

    it('should reset debounce timer on subsequent calls', () => {
      const fn = sinon.spy();
      const debouncedFn = perfUtils.debounce(fn, 100);

      debouncedFn();
      clock.tick(50);
      debouncedFn();
      clock.tick(50);

      expect(fn).to.not.have.been.called;

      clock.tick(50);

      expect(fn).to.have.been.calledOnce;
    });
  });

  describe('throttle method', () => {
    it('should throttle function calls', () => {
      const fn = sinon.spy();
      const throttledFn = perfUtils.throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).to.have.been.calledOnce;

      clock.tick(100);
      throttledFn();

      expect(fn).to.have.been.calledTwice;
    });

    it('should pass arguments to throttled function', () => {
      const fn = sinon.spy();
      const throttledFn = perfUtils.throttle(fn, 100);

      throttledFn('arg1', 'arg2');

      expect(fn).to.have.been.calledWith('arg1', 'arg2');
    });

    it('should handle immediate execution', () => {
      const fn = sinon.spy();
      const throttledFn = perfUtils.throttle(fn, 100, { immediate: true });

      throttledFn();

      expect(fn).to.have.been.calledOnce;
    });
  });

  describe('buffer management', () => {
    it('should create buffer with specified size', () => {
      const buffer = perfUtils.createBuffer(100);

      expect(buffer.size).to.equal(100);
      expect(buffer.length).to.equal(0);
    });

    it('should add items to buffer', () => {
      const buffer = perfUtils.createBuffer(3);

      buffer.add('item1');
      buffer.add('item2');

      expect(buffer.length).to.equal(2);
      expect(buffer.get(0)).to.equal('item1');
      expect(buffer.get(1)).to.equal('item2');
    });

    it('should maintain buffer size limit', () => {
      const buffer = perfUtils.createBuffer(2);

      buffer.add('item1');
      buffer.add('item2');
      buffer.add('item3');

      expect(buffer.length).to.equal(2);
      expect(buffer.get(0)).to.equal('item2');
      expect(buffer.get(1)).to.equal('item3');
    });

    it('should flush buffer contents', () => {
      const buffer = perfUtils.createBuffer(3);

      buffer.add('item1');
      buffer.add('item2');

      const items = buffer.flush();

      expect(items).to.deep.equal(['item1', 'item2']);
      expect(buffer.length).to.equal(0);
    });

    it('should clear buffer', () => {
      const buffer = perfUtils.createBuffer(3);

      buffer.add('item1');
      buffer.add('item2');
      buffer.clear();

      expect(buffer.length).to.equal(0);
    });
  });

  describe('batch processing', () => {
    it('should process items in batches', () => {
      const processor = sinon.spy();
      const items = ['item1', 'item2', 'item3', 'item4', 'item5'];

      perfUtils.processBatch(items, processor, 2);

      expect(processor).to.have.been.calledTwice;
      expect(processor.firstCall.args[0]).to.deep.equal(['item1', 'item2']);
      expect(processor.secondCall.args[0]).to.deep.equal(['item3', 'item4']);
    });

    it('should handle remaining items in final batch', () => {
      const processor = sinon.spy();
      const items = ['item1', 'item2', 'item3'];

      perfUtils.processBatch(items, processor, 2);

      expect(processor).to.have.been.calledTwice;
      expect(processor.secondCall.args[0]).to.deep.equal(['item3']);
    });

    it('should process batches with delay', async () => {
      const processor = sinon.spy();
      const items = ['item1', 'item2', 'item3'];

      perfUtils.processBatchWithDelay(items, processor, 2, 10);

      expect(processor).to.have.been.calledOnce;

      clock.tick(10);

      expect(processor).to.have.been.calledTwice;
    });
  });

  describe('memory monitoring', () => {
    it('should start memory monitoring', () => {
      perfUtils.startMemoryMonitoring();

      expect(perfUtils.isMonitoring).to.be.true;
    });

    it('should stop memory monitoring', () => {
      perfUtils.startMemoryMonitoring();
      perfUtils.stopMemoryMonitoring();

      expect(perfUtils.isMonitoring).to.be.false;
    });

    it('should collect memory usage data', () => {
      const memoryUsage = perfUtils.getMemoryUsage();

      expect(memoryUsage).to.be.an('object');
      expect(memoryUsage).to.have.property('used');
      expect(memoryUsage).to.have.property('total');
    });

    it('should detect memory leaks', () => {
      const isLeak = perfUtils.detectMemoryLeak();

      expect(isLeak).to.be.a('boolean');
    });
  });

  describe('performance timing', () => {
    it('should measure execution time', () => {
      const timer = perfUtils.startTimer('test-operation');

      clock.tick(100);

      const duration = perfUtils.endTimer('test-operation');

      expect(duration).to.be.a('number');
      expect(duration).to.be.greaterThan(0);
    });

    it('should handle multiple timers', () => {
      perfUtils.startTimer('timer1');
      perfUtils.startTimer('timer2');

      clock.tick(50);
      const duration1 = perfUtils.endTimer('timer1');

      clock.tick(50);
      const duration2 = perfUtils.endTimer('timer2');

      expect(duration1).to.be.lessThan(duration2);
    });

    it('should handle non-existent timer', () => {
      const duration = perfUtils.endTimer('non-existent');

      expect(duration).to.equal(0);
    });
  });

  describe('FPS monitoring', () => {
    it('should start FPS monitoring', () => {
      perfUtils.startFPSMonitoring();

      expect(perfUtils.isFPSMonitoring).to.be.true;
    });

    it('should stop FPS monitoring', () => {
      perfUtils.startFPSMonitoring();
      perfUtils.stopFPSMonitoring();

      expect(perfUtils.isFPSMonitoring).to.be.false;
    });

    it('should calculate FPS', () => {
      perfUtils.startFPSMonitoring();

      // Simulate frame updates
      for (let i = 0; i < 10; i++) {
        perfUtils.updateFPS();
        clock.tick(16); // ~60 FPS
      }

      const fps = perfUtils.getFPS();

      expect(fps).to.be.a('number');
      expect(fps).to.be.greaterThan(0);
    });
  });

  describe('optimization strategies', () => {
    it('should provide optimization suggestions', () => {
      const suggestions = perfUtils.getOptimizationSuggestions();

      expect(suggestions).to.be.an('array');
      expect(suggestions.length).to.be.greaterThan(0);
    });

    it('should analyze performance bottlenecks', () => {
      const bottlenecks = perfUtils.analyzeBottlenecks();

      expect(bottlenecks).to.be.an('array');
    });

    it('should optimize based on metrics', () => {
      const metrics = {
        memoryUsage: 80,
        fps: 30,
        averageFrameTime: 33,
      };

      const optimizations = perfUtils.optimizeBasedOnMetrics(metrics);

      expect(optimizations).to.be.an('object');
      expect(optimizations).to.have.property('suggestions');
    });
  });

  describe('resource management', () => {
    it('should track resource usage', () => {
      perfUtils.trackResource('terminal-1', 'terminal');
      perfUtils.trackResource('webview-1', 'webview');

      const usage = perfUtils.getResourceUsage();

      expect(usage).to.be.an('object');
      expect(usage.terminal).to.equal(1);
      expect(usage.webview).to.equal(1);
    });

    it('should release tracked resources', () => {
      perfUtils.trackResource('terminal-1', 'terminal');
      perfUtils.releaseResource('terminal-1', 'terminal');

      const usage = perfUtils.getResourceUsage();

      expect(usage.terminal).to.equal(0);
    });

    it('should detect resource leaks', () => {
      for (let i = 0; i < 100; i++) {
        perfUtils.trackResource(`terminal-${i}`, 'terminal');
      }

      const leaks = perfUtils.detectResourceLeaks();

      expect(leaks).to.be.an('array');
      expect(leaks.length).to.be.greaterThan(0);
    });
  });

  describe('adaptive performance', () => {
    it('should adjust performance based on system load', () => {
      const settings = perfUtils.getAdaptiveSettings();

      expect(settings).to.be.an('object');
      expect(settings).to.have.property('bufferSize');
      expect(settings).to.have.property('updateInterval');
    });

    it('should scale performance based on metrics', () => {
      const metrics = {
        cpuUsage: 90,
        memoryUsage: 80,
        fps: 20,
      };

      const scaledSettings = perfUtils.scalePerformance(metrics);

      expect(scaledSettings).to.be.an('object');
      expect(scaledSettings.bufferSize).to.be.lessThan(1000);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      perfUtils.startMemoryMonitoring();
      perfUtils.startFPSMonitoring();

      perfUtils.cleanup();

      expect(perfUtils.isMonitoring).to.be.false;
      expect(perfUtils.isFPSMonitoring).to.be.false;
    });

    it('should handle cleanup when not monitoring', () => {
      expect(() => perfUtils.cleanup()).to.not.throw();
    });
  });

  describe('error handling', () => {
    it('should handle errors in debounced functions', () => {
      const fn = sinon.stub().throws(new Error('Test error'));
      const debouncedFn = perfUtils.debounce(fn, 100);

      debouncedFn();

      expect(() => clock.tick(100)).to.not.throw();
    });

    it('should handle errors in throttled functions', () => {
      const fn = sinon.stub().throws(new Error('Test error'));
      const throttledFn = perfUtils.throttle(fn, 100);

      expect(() => throttledFn()).to.not.throw();
    });

    it('should handle errors in batch processing', () => {
      const processor = sinon.stub().throws(new Error('Processing error'));
      const items = ['item1', 'item2'];

      expect(() => perfUtils.processBatch(items, processor, 1)).to.not.throw();
    });
  });
});
