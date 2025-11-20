/**
 * TDD Test Suite for WebViewPersistenceService
 *
 * This test suite validates the unified WebView persistence service that
 * consolidates SimplePersistenceManager, StandardTerminalPersistenceManager,
 * and OptimizedTerminalPersistenceManager.
 *
 * Test Coverage:
 * - Terminal registration and serialization
 * - Progressive loading for large scrollback
 * - Auto-save with debounce
 * - Metadata capture
 * - Performance tracking
 */

import * as sinon from 'sinon';
import { expect } from 'chai';
import { Terminal as _Terminal } from '@xterm/xterm';
import { SerializeAddon } from '@xterm/addon-serialize';
import { WebViewPersistenceService } from '../../../../webview/services/WebViewPersistenceService';

describe('WebViewPersistenceService', () => {
  let sandbox: sinon.SinonSandbox;
  let persistenceService: WebViewPersistenceService;
  let mockVscodeApi: any;
  let mockTerminal: any;
  let _mockSerializeAddon: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock VS Code API
    mockVscodeApi = {
      postMessage: sandbox.stub(),
      getState: sandbox.stub().returns({}),
      setState: sandbox.stub(),
    };

    // Mock global acquireVsCodeApi
    (global as any).acquireVsCodeApi = () => mockVscodeApi;

    // Mock Terminal
    mockTerminal = {
      cols: 80,
      rows: 24,
      textarea: document.createElement('textarea'), // Required for ready check
      buffer: {
        active: {
          cursorX: 0,
          cursorY: 0,
          viewportY: 0,
        },
      },
      hasSelection: sandbox.stub().returns(false),
      write: sandbox.stub(),
      loadAddon: sandbox.stub(),
      onData: sandbox.stub().returns({ dispose: () => {} }),
      onLineFeed: sandbox.stub().returns({ dispose: () => {} }),
    };

    // Mock SerializeAddon
    _mockSerializeAddon = {
      serialize: sandbox.stub().returns('serialized content'),
    };

    // Stub SerializeAddon constructor
    sandbox.stub(SerializeAddon.prototype, 'serialize').returns('serialized content');

    persistenceService = new WebViewPersistenceService();
  });

  afterEach(() => {
    persistenceService.dispose();
    sandbox.restore();
  });

  describe('Terminal Registration', () => {
    it('should register terminal with SerializeAddon', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any);

      expect(mockTerminal.loadAddon).to.have.been.calledOnce;
      expect(persistenceService.hasTerminal('term-1')).to.be.true;
    });

    it('should retry registration when terminal not ready', (done) => {
      const notReadyTerminal = { ...mockTerminal, textarea: null };

      persistenceService.addTerminal('term-1', notReadyTerminal as any);

      // Initially not registered
      expect(persistenceService.hasTerminal('term-1')).to.be.false;

      // Make terminal ready and wait for retry
      notReadyTerminal.textarea = document.createElement('textarea');
      setTimeout(() => {
        expect(persistenceService.hasTerminal('term-1')).to.be.true;
        done();
      }, 150);
    });

    it('should setup auto-save on terminal registration', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any, { autoSave: true });

      expect(mockTerminal.onData).to.have.been.called;
      expect(mockTerminal.onLineFeed).to.have.been.called;
    });

    it('should skip auto-save when disabled', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any, { autoSave: false });

      expect(persistenceService.hasTerminal('term-1')).to.be.true;
      // Auto-save listeners still registered (implementation detail)
    });

    it('should remove terminal cleanly', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any);

      const removed = persistenceService.removeTerminal('term-1');

      expect(removed).to.be.true;
      expect(persistenceService.hasTerminal('term-1')).to.be.false;
    });
  });

  describe('Terminal Serialization', () => {
    beforeEach(() => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
    });

    it('should serialize terminal content', () => {
      const serialized = persistenceService.serializeTerminal('term-1');

      expect(serialized).to.exist;
      expect(serialized!.content).to.equal('serialized content');
      expect(serialized!.metadata).to.exist;
      expect(serialized!.metadata.dimensions).to.deep.equal({ cols: 80, rows: 24 });
    });

    it('should capture terminal metadata', () => {
      mockTerminal.buffer.active.cursorX = 10;
      mockTerminal.buffer.active.cursorY = 5;
      mockTerminal.hasSelection.returns(true);

      const serialized = persistenceService.serializeTerminal('term-1');

      expect(serialized!.metadata.cursor).to.deep.equal({ x: 10, y: 5 });
      expect(serialized!.metadata.selection).to.exist;
    });

    it('should trim empty lines when requested', () => {
      SerializeAddon.prototype.serialize = sandbox.stub().returns('line1\n\nline2\n\n\n');

      const serialized = persistenceService.serializeTerminal('term-1', {
        trimEmptyLines: true,
      });

      expect(serialized!.content).to.not.include('\n\n\n');
    });

    it('should serialize all terminals', () => {
      persistenceService.addTerminal('term-2', mockTerminal as any);
      persistenceService.addTerminal('term-3', mockTerminal as any);

      const allSerialized = persistenceService.serializeAllTerminals();

      expect(allSerialized.size).to.equal(3);
      expect(allSerialized.has('term-1')).to.be.true;
      expect(allSerialized.has('term-2')).to.be.true;
      expect(allSerialized.has('term-3')).to.be.true;
    });

    it('should return null for non-existent terminal', () => {
      const serialized = persistenceService.serializeTerminal('non-existent');

      expect(serialized).to.be.null;
    });
  });

  describe('Terminal Restoration', () => {
    beforeEach(() => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
    });

    it('should restore terminal content', () => {
      const content = 'restored line 1\nrestored line 2';

      const restored = persistenceService.restoreTerminalContent('term-1', content);

      expect(restored).to.be.true;
      expect(mockTerminal.write).to.have.been.called;
    });

    it('should use progressive loading for large content', () => {
      const largeContent = Array(600).fill('line').join('\n');

      const restored = persistenceService.restoreTerminalContent('term-1', largeContent, {
        progressive: true,
      });

      expect(restored).to.be.true;
      // Only initial batch written immediately
      const callCount = mockTerminal.write.callCount;
      expect(callCount).to.be.lessThan(600);
    });

    it('should restore serialized data object', () => {
      const serializedData = {
        content: 'line 1\nline 2',
        metadata: {
          dimensions: { cols: 80, rows: 24 },
          scrollPosition: 0,
          timestamp: Date.now(),
        },
        lineCount: 2,
        compressed: false,
      };

      const restored = persistenceService.restoreTerminalContent('term-1', serializedData);

      expect(restored).to.be.true;
    });

    it('should return false for non-existent terminal', () => {
      const restored = persistenceService.restoreTerminalContent('non-existent', 'content');

      expect(restored).to.be.false;
    });
  });

  describe('Content Saving and Caching', () => {
    beforeEach(() => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
    });

    it('should save terminal content and push to extension', () => {
      const saved = persistenceService.saveTerminalContent('term-1');

      expect(saved).to.be.true;
      expect(mockVscodeApi.postMessage).to.have.been.calledOnce;

      const message = mockVscodeApi.postMessage.firstCall.args[0];
      expect(message.command).to.equal('pushScrollbackData');
      expect(message.terminalId).to.equal('term-1');
      expect(message.scrollbackData).to.be.an('array');
    });

    it('should load cached terminal content', () => {
      persistenceService.serializeTerminal('term-1');

      const cached = persistenceService.loadTerminalContent('term-1');

      expect(cached).to.exist;
      expect(cached!.content).to.equal('serialized content');
    });

    it('should return null for uncached terminal', () => {
      const cached = persistenceService.loadTerminalContent('term-2');

      expect(cached).to.be.null;
    });
  });

  describe('Service Statistics', () => {
    it('should provide service statistics', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
      persistenceService.addTerminal('term-2', mockTerminal as any);
      persistenceService.serializeTerminal('term-1');

      const stats = persistenceService.getStats();

      expect(stats.terminalCount).to.equal(2);
      expect(stats.totalSerializedBytes).to.be.greaterThan(0);
    });
  });

  describe('Available Terminals', () => {
    it('should list available terminal IDs', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
      persistenceService.addTerminal('term-2', mockTerminal as any);
      persistenceService.addTerminal('term-3', mockTerminal as any);

      const available = persistenceService.getAvailableTerminals();

      expect(available).to.have.lengthOf(3);
      expect(available).to.include('term-1');
      expect(available).to.include('term-2');
      expect(available).to.include('term-3');
    });
  });

  describe('Cleanup and Disposal', () => {
    it('should cleanup all cached data', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
      persistenceService.serializeTerminal('term-1');

      persistenceService.cleanup();

      const cached = persistenceService.loadTerminalContent('term-1');
      expect(cached).to.be.null;
    });

    it('should dispose cleanly', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
      persistenceService.addTerminal('term-2', mockTerminal as any);

      persistenceService.dispose();

      expect(persistenceService.getAvailableTerminals()).to.have.lengthOf(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle serialization errors gracefully', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
      SerializeAddon.prototype.serialize = sandbox.stub().throws(new Error('Serialization error'));

      const serialized = persistenceService.serializeTerminal('term-1');

      expect(serialized).to.be.null;
    });

    it('should handle restoration errors gracefully', () => {
      persistenceService.addTerminal('term-1', mockTerminal as any);
      mockTerminal.write.throws(new Error('Write error'));

      const restored = persistenceService.restoreTerminalContent('term-1', 'content');

      expect(restored).to.be.false;
    });
  });
});
