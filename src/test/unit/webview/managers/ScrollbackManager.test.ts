/**
 * ScrollbackManager Unit Tests
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { ScrollbackManager, ScrollbackOptions } from '../../../../webview/managers/ScrollbackManager';
import { IBufferLine as _IBufferLine } from '@xterm/xterm';

describe('ScrollbackManager', function () {
  let scrollbackManager: ScrollbackManager;
  let mockTerminal: any;
  let mockSerializeAddon: any;
  let mockBuffer: any;

  beforeEach(function () {
    scrollbackManager = new ScrollbackManager();

    // Create mock buffer
    mockBuffer = {
      baseY: 0,
      cursorY: 10,
      getLine: sinon.stub(),
    };

    // Create mock terminal
    mockTerminal = {
      buffer: {
        active: mockBuffer,
      },
      clear: sinon.stub(),
      writeln: sinon.stub(),
    };

    // Create mock SerializeAddon
    mockSerializeAddon = {
      serialize: sinon.stub(),
      dispose: sinon.stub(),
    };
  });

  afterEach(function () {
    if (scrollbackManager) {
      scrollbackManager.dispose();
    }
    sinon.restore();
  });

  describe('Terminal Registration', function () {
    it('should register terminal with SerializeAddon', function () {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);

      const stats = scrollbackManager.getStats();
      expect(stats.registeredTerminals).to.equal(1);
      expect(stats.terminals).to.include('test-1');
    });

    it('should unregister terminal', function () {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      scrollbackManager.unregisterTerminal('test-1');

      const stats = scrollbackManager.getStats();
      expect(stats.registeredTerminals).to.equal(0);
    });

    it('should handle multiple terminals', function () {
      const mockTerminal2 = { ...mockTerminal };
      const mockAddon2 = { ...mockSerializeAddon };

      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      scrollbackManager.registerTerminal('test-2', mockTerminal2, mockAddon2);

      const stats = scrollbackManager.getStats();
      expect(stats.registeredTerminals).to.equal(2);
      expect(stats.terminals).to.have.members(['test-1', 'test-2']);
    });
  });

  describe('Save Scrollback', function () {
    beforeEach(function () {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
    });

    it('should save scrollback with ANSI colors', function () {
      const mockContent = '\x1b[31mRed text\x1b[0m\n\x1b[32mGreen text\x1b[0m\n';
      mockSerializeAddon.serialize.returns(mockContent);

      const options: ScrollbackOptions = {
        scrollback: 1000,
        trimEmptyLines: false,
        preserveWrappedLines: false,
      };

      const result = scrollbackManager.saveScrollback('test-1', options);

      expect(result).to.not.be.null;
      expect(result!.content).to.include('\x1b[31m'); // ANSI red
      expect(result!.content).to.include('\x1b[32m'); // ANSI green
      expect(mockSerializeAddon.serialize.called).to.be.true;
    });

    it('should return null for unregistered terminal', function () {
      const result = scrollbackManager.saveScrollback('non-existent');

      expect(result).to.be.null;
    });

    it('should trim empty lines when enabled', function () {
      const mockContent = '\n\nContent line\n\n\n';
      mockSerializeAddon.serialize.returns(mockContent);

      const options: ScrollbackOptions = {
        trimEmptyLines: true,
        preserveWrappedLines: false,
      };

      const result = scrollbackManager.saveScrollback('test-1', options);

      expect(result).to.not.be.null;
      expect(result!.content).to.equal('Content line');
      expect(result!.trimmedSize).to.be.lessThan(result!.originalSize);
    });

    it('should preserve empty lines when trimming disabled', function () {
      const mockContent = '\n\nContent line\n\n\n';
      mockSerializeAddon.serialize.returns(mockContent);

      const options: ScrollbackOptions = {
        trimEmptyLines: false,
        preserveWrappedLines: false,
      };

      const result = scrollbackManager.saveScrollback('test-1', options);

      expect(result).to.not.be.null;
      expect(result!.content).to.equal(mockContent);
    });

    it('should calculate size reduction metrics', function () {
      const mockContent = '\n\n\nContent\n\n\n\n\n';
      mockSerializeAddon.serialize.returns(mockContent);

      const options: ScrollbackOptions = {
        trimEmptyLines: true,
        preserveWrappedLines: false,
      };

      const result = scrollbackManager.saveScrollback('test-1', options);

      expect(result).to.not.be.null;
      expect(result!.originalSize).to.equal(mockContent.length);
      expect(result!.trimmedSize).to.be.lessThan(result!.originalSize);
      expect(result!.lineCount).to.be.greaterThan(0);
      expect(result!.timestamp).to.be.a('number');
    });
  });

  describe('Restore Scrollback', function () {
    beforeEach(function () {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
    });

    it('should restore scrollback with ANSI colors', function () {
      const content = '\x1b[31mRed line\x1b[0m\n\x1b[32mGreen line\x1b[0m';

      const result = scrollbackManager.restoreScrollback('test-1', content);

      expect(result).to.be.true;
      expect(mockTerminal.clear.called).to.be.true;
      expect(mockTerminal.writeln.calledTwice).to.be.true;
      expect(mockTerminal.writeln.firstCall.args[0]).to.include('\x1b[31m');
      expect(mockTerminal.writeln.secondCall.args[0]).to.include('\x1b[32m');
    });

    it('should return false for unregistered terminal', function () {
      const result = scrollbackManager.restoreScrollback('non-existent', 'content');

      expect(result).to.be.false;
    });

    it('should clear terminal before restore', function () {
      const content = 'Line 1\nLine 2';

      scrollbackManager.restoreScrollback('test-1', content);

      expect(mockTerminal.clear.called).to.be.true;
      expect(mockTerminal.clear.calledBefore(mockTerminal.writeln)).to.be.true;
    });

    it('should handle empty content', function () {
      const result = scrollbackManager.restoreScrollback('test-1', '');

      expect(result).to.be.true;
      expect(mockTerminal.clear.called).to.be.true;
      expect(mockTerminal.writeln.called).to.be.false;
    });

    it('should skip empty lines during restore', function () {
      const content = 'Line 1\n\nLine 2\n';

      scrollbackManager.restoreScrollback('test-1', content);

      // Should only write non-empty lines
      expect(mockTerminal.writeln.calledTwice).to.be.true;
    });
  });

  describe('Wrapped Line Processing', function () {
    it('should detect wrapped lines', function () {
      // Create mock line with isWrapped = true
      const mockLine: any = {
        translateToString: sinon.stub().returns('wrapped content'),
        isWrapped: true,
      };

      const mockPrevLine: any = {
        translateToString: sinon.stub().returns('original start '),
        isWrapped: false,
      };

      mockBuffer.getLine.withArgs(0).returns(mockPrevLine);
      mockBuffer.getLine.withArgs(1).returns(mockLine);

      const fullLine = scrollbackManager.getFullBufferLine(mockLine, 1, mockBuffer);

      expect(fullLine).to.equal('original start wrapped content');
    });

    it('should handle non-wrapped lines', function () {
      const mockLine: any = {
        translateToString: sinon.stub().returns('single line'),
        isWrapped: false,
      };

      const fullLine = scrollbackManager.getFullBufferLine(mockLine, 0, mockBuffer);

      expect(fullLine).to.equal('single line');
    });

    it('should handle multiple wrapped lines', function () {
      const mockLine3: any = {
        translateToString: sinon.stub().returns('end'),
        isWrapped: true,
      };

      const mockLine2: any = {
        translateToString: sinon.stub().returns('middle '),
        isWrapped: true,
      };

      const mockLine1: any = {
        translateToString: sinon.stub().returns('start '),
        isWrapped: false,
      };

      mockBuffer.getLine.withArgs(0).returns(mockLine1);
      mockBuffer.getLine.withArgs(1).returns(mockLine2);
      mockBuffer.getLine.withArgs(2).returns(mockLine3);

      const fullLine = scrollbackManager.getFullBufferLine(mockLine3, 2, mockBuffer);

      expect(fullLine).to.equal('start middle end');
    });

    it('should handle wrapped line at buffer start', function () {
      const mockLine: any = {
        translateToString: sinon.stub().returns('content'),
        isWrapped: true, // Wrapped but no previous line
      };

      mockBuffer.getLine.withArgs(0).returns(mockLine);

      const fullLine = scrollbackManager.getFullBufferLine(mockLine, 0, mockBuffer);

      expect(fullLine).to.include('content');
    });
  });

  describe('Buffer Reverse Iterator', function () {
    it('should iterate buffer in reverse order', function () {
      const mockLines = [
        { translateToString: () => 'Line 0' },
        { translateToString: () => 'Line 1' },
        { translateToString: () => 'Line 2' },
      ];

      mockBuffer.getLine.callsFake((index: number) => mockLines[index]);

      const lines: any[] = [];
      for (const line of scrollbackManager.getBufferReverseIterator(mockBuffer, 2)) {
        lines.push(line);
      }

      expect(lines.length).to.equal(3);
      expect(lines[0].translateToString()).to.equal('Line 2');
      expect(lines[1].translateToString()).to.equal('Line 1');
      expect(lines[2].translateToString()).to.equal('Line 0');
    });

    it('should handle empty buffer', function () {
      mockBuffer.getLine.returns(null);

      const lines: any[] = [];
      for (const line of scrollbackManager.getBufferReverseIterator(mockBuffer, 0)) {
        lines.push(line);
      }

      expect(lines.length).to.equal(0);
    });

    it('should skip null lines', function () {
      mockBuffer.getLine.callsFake((index: number) => {
        if (index === 1) return null; // Skip line 1
        return { translateToString: () => `Line ${index}` };
      });

      const lines: any[] = [];
      for (const line of scrollbackManager.getBufferReverseIterator(mockBuffer, 2)) {
        lines.push(line);
      }

      expect(lines.length).to.equal(2);
      expect(lines[0].translateToString()).to.equal('Line 2');
      expect(lines[1].translateToString()).to.equal('Line 0');
    });
  });

  describe('Statistics', function () {
    it('should return accurate stats', function () {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      scrollbackManager.registerTerminal('test-2', mockTerminal, mockSerializeAddon);

      const stats = scrollbackManager.getStats();

      expect(stats.registeredTerminals).to.equal(2);
      expect(stats.terminals).to.have.lengthOf(2);
      expect(stats.terminals).to.include.members(['test-1', 'test-2']);
    });

    it('should return empty stats when no terminals registered', function () {
      const stats = scrollbackManager.getStats();

      expect(stats.registeredTerminals).to.equal(0);
      expect(stats.terminals).to.have.lengthOf(0);
    });
  });

  describe('Dispose', function () {
    it('should clear all resources', function () {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      scrollbackManager.registerTerminal('test-2', mockTerminal, mockSerializeAddon);

      scrollbackManager.dispose();

      const stats = scrollbackManager.getStats();
      expect(stats.registeredTerminals).to.equal(0);
    });

    it('should not throw on double dispose', function () {
      expect(() => {
        scrollbackManager.dispose();
        scrollbackManager.dispose();
      }).to.not.throw();
    });
  });

  describe('Error Handling', function () {
    it('should handle SerializeAddon errors gracefully', function () {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      mockSerializeAddon.serialize.throws(new Error('Serialization failed'));

      const result = scrollbackManager.saveScrollback('test-1');

      expect(result).to.be.null;
    });

    it('should handle restore errors gracefully', function () {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      mockTerminal.writeln.throws(new Error('Write failed'));

      const result = scrollbackManager.restoreScrollback('test-1', 'content');

      expect(result).to.be.false;
    });

    it('should handle buffer iteration errors', function () {
      mockBuffer.getLine.throws(new Error('Buffer access failed'));

      const lines: any[] = [];
      expect(() => {
        for (const line of scrollbackManager.getBufferReverseIterator(mockBuffer, 2)) {
          lines.push(line);
        }
      }).to.not.throw();

      expect(lines.length).to.equal(0);
    });
  });
});
