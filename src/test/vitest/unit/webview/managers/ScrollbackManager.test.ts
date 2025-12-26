/**
 * ScrollbackManager Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ScrollbackManager,
  ScrollbackOptions,
} from '../../../../../webview/managers/ScrollbackManager';

describe('ScrollbackManager', () => {
  let scrollbackManager: ScrollbackManager;
  let mockTerminal: any;
  let mockSerializeAddon: any;
  let mockBuffer: any;

  beforeEach(() => {
    scrollbackManager = new ScrollbackManager();

    // Create mock buffer
    mockBuffer = {
      baseY: 0,
      cursorY: 10,
      getLine: vi.fn(),
    };

    // Create mock terminal
    mockTerminal = {
      buffer: {
        active: mockBuffer,
      },
      clear: vi.fn(),
      writeln: vi.fn(),
    };

    // Create mock SerializeAddon
    mockSerializeAddon = {
      serialize: vi.fn(),
      dispose: vi.fn(),
    };
  });

  afterEach(() => {
    if (scrollbackManager) {
      scrollbackManager.dispose();
    }
  });

  describe('Terminal Registration', () => {
    it('should register terminal with SerializeAddon', () => {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);

      const stats = scrollbackManager.getStats();
      expect(stats.registeredTerminals).toBe(1);
      expect(stats.terminals).toContain('test-1');
    });

    it('should unregister terminal', () => {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      scrollbackManager.unregisterTerminal('test-1');

      const stats = scrollbackManager.getStats();
      expect(stats.registeredTerminals).toBe(0);
    });

    it('should handle multiple terminals', () => {
      const mockTerminal2 = { ...mockTerminal };
      const mockAddon2 = { ...mockSerializeAddon };

      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      scrollbackManager.registerTerminal('test-2', mockTerminal2, mockAddon2);

      const stats = scrollbackManager.getStats();
      expect(stats.registeredTerminals).toBe(2);
      expect(stats.terminals).toEqual(expect.arrayContaining(['test-1', 'test-2']));
    });
  });

  describe('Save Scrollback', () => {
    beforeEach(() => {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
    });

    it('should save scrollback with ANSI colors', () => {
      const mockContent = '\x1b[31mRed text\x1b[0m\n\x1b[32mGreen text\x1b[0m\n';
      mockSerializeAddon.serialize.mockReturnValue(mockContent);

      const options: ScrollbackOptions = {
        scrollback: 1000,
        trimEmptyLines: false,
        preserveWrappedLines: false,
      };

      const result = scrollbackManager.saveScrollback('test-1', options);

      expect(result).not.toBeNull();
      expect(result!.content).toContain('\x1b[31m'); // ANSI red
      expect(result!.content).toContain('\x1b[32m'); // ANSI green
      expect(mockSerializeAddon.serialize).toHaveBeenCalled();
    });

    it('should return null for unregistered terminal', () => {
      const result = scrollbackManager.saveScrollback('non-existent');

      expect(result).toBeNull();
    });

    it('should trim empty lines when enabled', () => {
      const mockContent = '\n\nContent line\n\n\n';
      mockSerializeAddon.serialize.mockReturnValue(mockContent);

      const options: ScrollbackOptions = {
        trimEmptyLines: true,
        preserveWrappedLines: false,
      };

      const result = scrollbackManager.saveScrollback('test-1', options);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Content line');
      expect(result!.trimmedSize).toBeLessThan(result!.originalSize);
    });

    it('should preserve empty lines when trimming disabled', () => {
      const mockContent = '\n\nContent line\n\n\n';
      mockSerializeAddon.serialize.mockReturnValue(mockContent);

      const options: ScrollbackOptions = {
        trimEmptyLines: false,
        preserveWrappedLines: false,
      };

      const result = scrollbackManager.saveScrollback('test-1', options);

      expect(result).not.toBeNull();
      expect(result!.content).toBe(mockContent);
    });

    it('should calculate size reduction metrics', () => {
      const mockContent = '\n\n\nContent\n\n\n\n\n';
      mockSerializeAddon.serialize.mockReturnValue(mockContent);

      const options: ScrollbackOptions = {
        trimEmptyLines: true,
        preserveWrappedLines: false,
      };

      const result = scrollbackManager.saveScrollback('test-1', options);

      expect(result).not.toBeNull();
      expect(result!.originalSize).toBe(mockContent.length);
      expect(result!.trimmedSize).toBeLessThan(result!.originalSize);
      expect(result!.lineCount).toBeGreaterThan(0);
      expect(typeof result!.timestamp).toBe('number');
    });
  });

  describe('Restore Scrollback', () => {
    beforeEach(() => {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
    });

    it('should restore scrollback with ANSI colors', () => {
      const content = '\x1b[31mRed line\x1b[0m\n\x1b[32mGreen line\x1b[0m';

      const result = scrollbackManager.restoreScrollback('test-1', content);

      expect(result).toBe(true);
      expect(mockTerminal.clear).toHaveBeenCalled();
      expect(mockTerminal.writeln).toHaveBeenCalledTimes(2);
      expect(mockTerminal.writeln.mock.calls[0][0]).toContain('\x1b[31m');
      expect(mockTerminal.writeln.mock.calls[1][0]).toContain('\x1b[32m');
    });

    it('should return false for unregistered terminal', () => {
      const result = scrollbackManager.restoreScrollback('non-existent', 'content');

      expect(result).toBe(false);
    });

    it('should clear terminal before restore', () => {
      const content = 'Line 1\nLine 2';

      scrollbackManager.restoreScrollback('test-1', content);

      expect(mockTerminal.clear).toHaveBeenCalled();
      // Verify clear was called before writeln
      const clearCallOrder = mockTerminal.clear.mock.invocationCallOrder[0];
      const writelnCallOrder = mockTerminal.writeln.mock.invocationCallOrder[0];
      expect(clearCallOrder).toBeLessThan(writelnCallOrder);
    });

    it('should handle empty content', () => {
      const result = scrollbackManager.restoreScrollback('test-1', '');

      expect(result).toBe(true);
      expect(mockTerminal.clear).toHaveBeenCalled();
      expect(mockTerminal.writeln).not.toHaveBeenCalled();
    });

    it('should skip empty lines during restore', () => {
      const content = 'Line 1\n\nLine 2\n';

      scrollbackManager.restoreScrollback('test-1', content);

      // Should only write non-empty lines
      expect(mockTerminal.writeln).toHaveBeenCalledTimes(2);
    });
  });

  describe('Wrapped Line Processing', () => {
    it('should detect wrapped lines', () => {
      // Create mock line with isWrapped = true
      const mockLine: any = {
        translateToString: vi.fn().mockReturnValue('wrapped content'),
        isWrapped: true,
      };

      const mockPrevLine: any = {
        translateToString: vi.fn().mockReturnValue('original start '),
        isWrapped: false,
      };

      mockBuffer.getLine.mockImplementation((index: number) => {
        if (index === 0) return mockPrevLine;
        if (index === 1) return mockLine;
        return null;
      });

      const fullLine = scrollbackManager.getFullBufferLine(mockLine, 1, mockBuffer);

      expect(fullLine).toBe('original start wrapped content');
    });

    it('should handle non-wrapped lines', () => {
      const mockLine: any = {
        translateToString: vi.fn().mockReturnValue('single line'),
        isWrapped: false,
      };

      const fullLine = scrollbackManager.getFullBufferLine(mockLine, 0, mockBuffer);

      expect(fullLine).toBe('single line');
    });

    it('should handle multiple wrapped lines', () => {
      const mockLine3: any = {
        translateToString: vi.fn().mockReturnValue('end'),
        isWrapped: true,
      };

      const mockLine2: any = {
        translateToString: vi.fn().mockReturnValue('middle '),
        isWrapped: true,
      };

      const mockLine1: any = {
        translateToString: vi.fn().mockReturnValue('start '),
        isWrapped: false,
      };

      mockBuffer.getLine.mockImplementation((index: number) => {
        if (index === 0) return mockLine1;
        if (index === 1) return mockLine2;
        if (index === 2) return mockLine3;
        return null;
      });

      const fullLine = scrollbackManager.getFullBufferLine(mockLine3, 2, mockBuffer);

      expect(fullLine).toBe('start middle end');
    });

    it('should handle wrapped line at buffer start', () => {
      const mockLine: any = {
        translateToString: vi.fn().mockReturnValue('content'),
        isWrapped: true, // Wrapped but no previous line
      };

      mockBuffer.getLine.mockImplementation((index: number) => {
        if (index === 0) return mockLine;
        return null;
      });

      const fullLine = scrollbackManager.getFullBufferLine(mockLine, 0, mockBuffer);

      expect(fullLine).toContain('content');
    });
  });

  describe('Buffer Reverse Iterator', () => {
    it('should iterate buffer in reverse order', () => {
      const mockLines = [
        { translateToString: () => 'Line 0' },
        { translateToString: () => 'Line 1' },
        { translateToString: () => 'Line 2' },
      ];

      mockBuffer.getLine.mockImplementation((index: number) => mockLines[index]);

      const lines: any[] = [];
      for (const line of scrollbackManager.getBufferReverseIterator(mockBuffer, 2)) {
        lines.push(line);
      }

      expect(lines.length).toBe(3);
      expect(lines[0].translateToString()).toBe('Line 2');
      expect(lines[1].translateToString()).toBe('Line 1');
      expect(lines[2].translateToString()).toBe('Line 0');
    });

    it('should handle empty buffer', () => {
      mockBuffer.getLine.mockReturnValue(null);

      const lines: any[] = [];
      for (const line of scrollbackManager.getBufferReverseIterator(mockBuffer, 0)) {
        lines.push(line);
      }

      expect(lines.length).toBe(0);
    });

    it('should skip null lines', () => {
      mockBuffer.getLine.mockImplementation((index: number) => {
        if (index === 1) return null; // Skip line 1
        return { translateToString: () => `Line ${index}` };
      });

      const lines: any[] = [];
      for (const line of scrollbackManager.getBufferReverseIterator(mockBuffer, 2)) {
        lines.push(line);
      }

      expect(lines.length).toBe(2);
      expect(lines[0].translateToString()).toBe('Line 2');
      expect(lines[1].translateToString()).toBe('Line 0');
    });
  });

  describe('Statistics', () => {
    it('should return accurate stats', () => {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      scrollbackManager.registerTerminal('test-2', mockTerminal, mockSerializeAddon);

      const stats = scrollbackManager.getStats();

      expect(stats.registeredTerminals).toBe(2);
      expect(stats.terminals).toHaveLength(2);
      expect(stats.terminals).toEqual(expect.arrayContaining(['test-1', 'test-2']));
    });

    it('should return empty stats when no terminals registered', () => {
      const stats = scrollbackManager.getStats();

      expect(stats.registeredTerminals).toBe(0);
      expect(stats.terminals).toHaveLength(0);
    });
  });

  describe('Dispose', () => {
    it('should clear all resources', () => {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      scrollbackManager.registerTerminal('test-2', mockTerminal, mockSerializeAddon);

      scrollbackManager.dispose();

      const stats = scrollbackManager.getStats();
      expect(stats.registeredTerminals).toBe(0);
    });

    it('should not throw on double dispose', () => {
      expect(() => {
        scrollbackManager.dispose();
        scrollbackManager.dispose();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle SerializeAddon errors gracefully', () => {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      mockSerializeAddon.serialize.mockImplementation(() => {
        throw new Error('Serialization failed');
      });

      const result = scrollbackManager.saveScrollback('test-1');

      expect(result).toBeNull();
    });

    it('should handle restore errors gracefully', () => {
      scrollbackManager.registerTerminal('test-1', mockTerminal, mockSerializeAddon);
      mockTerminal.writeln.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const result = scrollbackManager.restoreScrollback('test-1', 'content');

      expect(result).toBe(false);
    });

    it('should handle buffer iteration errors', () => {
      mockBuffer.getLine.mockImplementation(() => {
        throw new Error('Buffer access failed');
      });

      const lines: any[] = [];
      expect(() => {
        for (const line of scrollbackManager.getBufferReverseIterator(mockBuffer, 2)) {
          lines.push(line);
        }
      }).not.toThrow();

      expect(lines.length).toBe(0);
    });
  });
});
