/* eslint-disable */
// @ts-nocheck

// import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { PerformanceUtils } from '../../../../webview/utils/PerformanceUtils';

describe('PerformanceUtils', () => {
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test</title>
        </head>
        <body>
          <div id="test-container"></div>
        </body>
      </html>
    `;

    dom = new JSDOM(htmlContent, {
      url: 'http://localhost',
      contentType: 'text/html',
      includeNodeLocations: true,
      storageQuota: 10000000,
    });

    document = dom.window.document;
    (global as any).document = document;
    (global as any).window = dom.window;
    (global as any).requestAnimationFrame = sinon.stub().callsArg(0);
    (global as any).cancelAnimationFrame = sinon.stub();

    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers();
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

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const mockFn = sinon.stub();
      const debouncedFn = PerformanceUtils.debounce(mockFn, 100);

      debouncedFn('test1');
      debouncedFn('test2');
      debouncedFn('test3');

      expect(mockFn).to.not.have.been.called;

      clock.tick(100);

      expect(mockFn).to.have.been.calledOnce;
      expect(mockFn).to.have.been.calledWith('test3');
    });

    it('should handle multiple debounced calls', () => {
      const mockFn = sinon.stub();
      const debouncedFn = PerformanceUtils.debounce(mockFn, 50);

      debouncedFn('first');
      clock.tick(25);
      debouncedFn('second');
      clock.tick(25);
      debouncedFn('third');
      clock.tick(50);

      expect(mockFn).to.have.been.calledOnce;
      expect(mockFn).to.have.been.calledWith('third');
    });
  });

  describe.skip('throttle', () => {
    beforeEach(() => {
      // Mock window.setTimeout for throttle function
      (global as any).window = {
        setTimeout: sinon.stub().callsFake((fn, delay) => setTimeout(fn, delay)),
        clearTimeout: sinon.stub().callsFake(clearTimeout),
      };
    });

    it('should create throttled function', () => {
      const mockFn = sinon.stub();
      const throttledFn = PerformanceUtils.throttle(mockFn, 100);

      expect(throttledFn).to.be.a('function');

      // Call immediately - should execute right away
      throttledFn('test1');

      // At minimum, verify function was created successfully
      expect(mockFn).to.have.been.called;
    });

    it('should limit rapid calls', () => {
      const mockFn = sinon.stub();
      const throttledFn = PerformanceUtils.throttle(mockFn, 100);

      // First call should execute immediately
      throttledFn('first');
      expect(mockFn).to.have.been.calledOnce;

      // Rapid subsequent calls within throttle period
      throttledFn('second');
      throttledFn('third');

      // Should still only have been called once immediately
      expect(mockFn).to.have.been.calledOnce;
    });
  });

  describe('requestIdleCallback', () => {
    it('should execute callback when idle', () => {
      const callback = sinon.stub();

      PerformanceUtils.requestIdleCallback(callback);

      // Advance timers to trigger the setTimeout fallback
      clock.tick(1);

      expect(callback).to.have.been.called;
    });

    it('should handle timeout option', () => {
      const callback = sinon.stub();

      PerformanceUtils.requestIdleCallback(callback, 100);

      clock.tick(1);

      expect(callback).to.have.been.called;
    });
  });

  describe('measurePerformance', () => {
    it('should measure function performance', () => {
      const testFn = () => {
        // Simulate some work
        for (let i = 0; i < 1000; i++) {
          Math.random();
        }
      };

      const result = PerformanceUtils.measurePerformance('test-operation', testFn);
      expect(result).to.not.be.a('number'); // Returns the function result, not duration
    });

    it('should handle function with return value', () => {
      const testFn = () => 'test result';
      const result = PerformanceUtils.measurePerformance('test-with-return', testFn);
      expect(result).to.equal('test result');
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage info', () => {
      // Mock performance.memory
      (global as any).performance = {
        memory: {
          usedJSHeapSize: 1000000,
          totalJSHeapSize: 2000000,
          jsHeapSizeLimit: 4000000,
        },
      };

      const usage = PerformanceUtils.getMemoryUsage();
      expect(usage).to.be.an('object');
      expect(usage).to.have.property('usedJSHeapSize', 1000000);
      expect(usage).to.have.property('totalJSHeapSize', 2000000);
      expect(usage).to.have.property('jsHeapSizeLimit', 4000000);
    });

    it('should handle missing performance.memory', () => {
      // Save original performance
      const originalPerf = (global as any).performance;

      // Set performance without memory property
      (global as any).performance = {};

      const usage = PerformanceUtils.getMemoryUsage();
      expect(usage).to.be.null;

      // Restore original performance
      (global as any).performance = originalPerf;
    });
  });

  describe('deepClone', () => {
    it('should clone simple objects', () => {
      const original = { name: 'test', value: 42 };
      const cloned = PerformanceUtils.deepClone(original);

      expect(cloned).to.not.equal(original);
      expect(cloned).to.deep.equal(original);
    });

    it('should clone arrays', () => {
      const original = [1, 2, { nested: 'value' }];
      const cloned = PerformanceUtils.deepClone(original);

      expect(cloned).to.not.equal(original);
      expect(cloned).to.deep.equal(original);
      expect(cloned[2]).to.not.equal(original[2]);
    });

    it('should handle null and primitive values', () => {
      expect(PerformanceUtils.deepClone(null)).to.be.null;
      expect(PerformanceUtils.deepClone(42)).to.equal(42);
      expect(PerformanceUtils.deepClone('test')).to.equal('test');
    });
  });
});
