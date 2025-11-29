/**
 * RenderingOptimizer Unit Tests
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { RenderingOptimizer } from '../../../../webview/optimizers/RenderingOptimizer';

describe('RenderingOptimizer', function () {
  let optimizer: RenderingOptimizer;
  let mockTerminal: any;
  let mockFitAddon: any;
  let mockContainer: any;

  beforeEach(function () {
    // Create mock terminal
    mockTerminal = {
      loadAddon: sinon.stub(),
      options: {
        smoothScrollDuration: 0,
      },
    };

    // Create mock fit addon
    mockFitAddon = {
      fit: sinon.stub(),
    };

    // Create mock container
    mockContainer = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
    };

    // Create optimizer with default options
    optimizer = new RenderingOptimizer();
  });

  afterEach(function () {
    if (optimizer) {
      optimizer.dispose();
    }
    sinon.restore();
  });

  describe('Dimension Validation', function () {
    it('should accept valid dimensions (>50px)', function () {
      // Create with specific min dimensions
      const customOptimizer = new RenderingOptimizer({
        minWidth: 50,
        minHeight: 50,
      });

      // Mock ResizeObserver
      const mockEntry = {
        contentRect: {
          width: 100,
          height: 100,
        },
      };

      let resizeCallback: any;
      const ResizeObserverStub = sinon.stub(window, 'ResizeObserver').callsFake(function (
        callback: any
      ) {
        resizeCallback = callback;
        return {
          observe: sinon.stub(),
          disconnect: sinon.stub(),
          unobserve: sinon.stub(),
        } as any;
      });

      customOptimizer.setupOptimizedResize(
        mockTerminal,
        mockFitAddon,
        mockContainer,
        'test-terminal'
      );

      // Trigger resize
      resizeCallback([mockEntry]);

      // Wait for debounce
      setTimeout(() => {
        expect(mockFitAddon.fit.called).to.be.true;
      }, 150);

      customOptimizer.dispose();
      ResizeObserverStub.restore();
    });

    it('should reject invalid dimensions (≤50px)', function (done) {
      const customOptimizer = new RenderingOptimizer({
        minWidth: 50,
        minHeight: 50,
        resizeDebounceMs: 10, // Shorter delay for test
      });

      const mockEntry = {
        contentRect: {
          width: 30, // Below minimum
          height: 100,
        },
      };

      let resizeCallback: any;
      const ResizeObserverStub = sinon.stub(window, 'ResizeObserver').callsFake(function (
        callback: any
      ) {
        resizeCallback = callback;
        return {
          observe: sinon.stub(),
          disconnect: sinon.stub(),
          unobserve: sinon.stub(),
        } as any;
      });

      customOptimizer.setupOptimizedResize(
        mockTerminal,
        mockFitAddon,
        mockContainer,
        'test-terminal'
      );

      // Trigger resize with invalid dimensions
      resizeCallback([mockEntry]);

      // Wait for debounce
      setTimeout(() => {
        expect(mockFitAddon.fit.called).to.be.false;
        customOptimizer.dispose();
        ResizeObserverStub.restore();
        done();
      }, 50);
    });
  });

  describe('Device Detection', function () {
    it('should detect trackpad (deltaMode = 0)', function () {
      const trackpadEvent = {
        deltaMode: 0,
      } as WheelEvent;

      const device = optimizer.detectDevice(trackpadEvent);

      expect(device.isTrackpad).to.be.true;
      expect(device.smoothScrollDuration).to.equal(0);
    });

    it('should detect mouse wheel (deltaMode = 1)', function () {
      const mouseEvent = {
        deltaMode: 1,
      } as WheelEvent;

      const device = optimizer.detectDevice(mouseEvent);

      expect(device.isTrackpad).to.be.false;
      expect(device.smoothScrollDuration).to.equal(125);
    });
  });

  describe('Smooth Scroll Duration', function () {
    it('should update terminal smooth scroll duration', function () {
      optimizer.updateSmoothScrollDuration(mockTerminal, 125);

      expect(mockTerminal.options.smoothScrollDuration).to.equal(125);
    });

    it('should setup smooth scrolling with passive listener', function () {
      optimizer.setupSmoothScrolling(mockTerminal, mockContainer, 'test-terminal');

      expect(mockContainer.addEventListener.called).to.be.true;
      expect(mockContainer.addEventListener.firstCall.args[0]).to.equal('wheel');
      expect(mockContainer.addEventListener.firstCall.args[2]).to.deep.equal({
        passive: true,
      });
    });
  });

  describe('WebGL Fallback', function () {
    it('should return false when WebGL is disabled', async function () {
      const noWebGLOptimizer = new RenderingOptimizer({
        enableWebGL: false,
      });

      const result = await noWebGLOptimizer.enableWebGL(mockTerminal, 'test-terminal');

      expect(result).to.be.false;
      expect(mockTerminal.loadAddon.called).to.be.false;

      noWebGLOptimizer.dispose();
    });
  });

  describe('Dispose', function () {
    it('should dispose all resources', function () {
      const ResizeObserverStub = sinon.stub(window, 'ResizeObserver').callsFake(function () {
        return {
          observe: sinon.stub(),
          disconnect: sinon.stub(),
          unobserve: sinon.stub(),
        } as any;
      });

      optimizer.setupOptimizedResize(mockTerminal, mockFitAddon, mockContainer, 'test-terminal');

      optimizer.dispose();

      // Verify cleanup
      expect(() => optimizer.dispose()).to.not.throw();

      ResizeObserverStub.restore();
    });
  });
});
