/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
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

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const mockFn = sinon.stub();
      const throttledFn = PerformanceUtils.throttle(mockFn, 100);

      throttledFn('test1');
      throttledFn('test2');
      throttledFn('test3');

      expect(mockFn).to.have.been.calledOnce;
      expect(mockFn).to.have.been.calledWith('test1');

      clock.tick(100);
      throttledFn('test4');

      expect(mockFn).to.have.been.calledTwice;
      expect(mockFn).to.have.been.calledWith('test4');
    });

    it('should handle rapid calls correctly', () => {
      const mockFn = sinon.stub();
      const throttledFn = PerformanceUtils.throttle(mockFn, 50);

      throttledFn('first');
      expect(mockFn).to.have.been.calledOnce;

      clock.tick(25);
      throttledFn('second');
      expect(mockFn).to.have.been.calledOnce;

      clock.tick(25);
      throttledFn('third');
      expect(mockFn).to.have.been.calledTwice;
    });
  });

  describe('requestIdleCallback', () => {
    it('should execute callback when idle', (done) => {
      const callback = sinon.stub();

      PerformanceUtils.requestIdleCallback(callback);

      // Since we're using fake timers, we need to handle this differently
      setTimeout(() => {
        expect(callback).to.have.been.called;
        done();
      }, 0);
    });

    it('should handle timeout option', (done) => {
      const callback = sinon.stub();

      PerformanceUtils.requestIdleCallback(callback, { timeout: 100 });

      setTimeout(() => {
        expect(callback).to.have.been.called;
        done();
      }, 0);
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

      const result = PerformanceUtils.measurePerformance(testFn);
      expect(result).to.be.a('number');
      expect(result).to.be.greaterThan(0);
    });

    it('should handle function with return value', () => {
      const testFn = () => 'test result';
      const result = PerformanceUtils.measurePerformance(testFn);
      expect(result).to.be.a('number');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(PerformanceUtils.formatBytes(0)).to.equal('0 Bytes');
      expect(PerformanceUtils.formatBytes(1024)).to.equal('1 KB');
      expect(PerformanceUtils.formatBytes(1048576)).to.equal('1 MB');
      expect(PerformanceUtils.formatBytes(1073741824)).to.equal('1 GB');
    });

    it('should handle negative values', () => {
      expect(PerformanceUtils.formatBytes(-1024)).to.equal('-1 KB');
    });

    it('should handle decimal precision', () => {
      expect(PerformanceUtils.formatBytes(1536, 1)).to.equal('1.5 KB');
      expect(PerformanceUtils.formatBytes(1536, 2)).to.equal('1.50 KB');
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
      expect(usage.used).to.be.a('string');
      expect(usage.total).to.be.a('string');
      expect(usage.limit).to.be.a('string');
    });

    it('should handle missing performance.memory', () => {
      delete (global as any).performance;

      const usage = PerformanceUtils.getMemoryUsage();
      expect(usage).to.be.an('object');
      expect(usage.used).to.equal('N/A');
      expect(usage.total).to.equal('N/A');
      expect(usage.limit).to.equal('N/A');
    });
  });
});
