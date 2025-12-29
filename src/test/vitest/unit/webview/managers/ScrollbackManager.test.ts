import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScrollbackManager } from '../../../../../webview/managers/ScrollbackManager';

describe('ScrollbackManager', () => {
  let manager: ScrollbackManager;
  let mockTerminal: any;
  let mockSerializeAddon: any;

  beforeEach(() => {
    manager = new ScrollbackManager();
    manager.initialize();

    mockSerializeAddon = {
      serialize: vi.fn().mockReturnValue('line1\nline2\n\n'),
    };

    mockTerminal = {
      clear: vi.fn(),
      writeln: vi.fn(),
      buffer: {
        active: {
          baseY: 0,
          cursorY: 1,
          getLine: vi.fn().mockImplementation((i) => ({
            translateToString: () => `text${i}`,
            isWrapped: false
          }))
        }
      }
    };
  });

  afterEach(() => {
    manager.dispose();
    vi.restoreAllMocks();
  });

  describe('Registration', () => {
    it('should register and unregister terminals', () => {
      manager.registerTerminal('t1', mockTerminal, mockSerializeAddon);
      expect(manager.getStats().registeredTerminals).toBe(1);
      
      manager.unregisterTerminal('t1');
      expect(manager.getStats().registeredTerminals).toBe(0);
    });
  });

  describe('saveScrollback', () => {
    it('should save and process scrollback data', () => {
      manager.registerTerminal('t1', mockTerminal, mockSerializeAddon);
      
      // Update mock to match serialize output
      mockTerminal.buffer.active.getLine.mockImplementation((i) => {
        if (i === 0) return { translateToString: () => 'line1', isWrapped: false };
        if (i === 1) return { translateToString: () => 'line2', isWrapped: false };
        return null;
      });

      const result = manager.saveScrollback('t1', { trimEmptyLines: true });
      
      expect(result).not.toBeNull();
      if (result) {
        expect(mockSerializeAddon.serialize).toHaveBeenCalled();
        expect(result.content).toBe('line1\nline2');
        expect(result.lineCount).toBe(2);
      }
    });

    it('should return null for unregistered terminal', () => {
      const result = manager.saveScrollback('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('restoreScrollback', () => {
    it('should restore content to terminal', () => {
      manager.registerTerminal('t1', mockTerminal, mockSerializeAddon);
      
      const success = manager.restoreScrollback('t1', 'row1\nrow2');
      
      expect(success).toBe(true);
      expect(mockTerminal.clear).toHaveBeenCalled();
      expect(mockTerminal.writeln).toHaveBeenCalledWith('row1');
      expect(mockTerminal.writeln).toHaveBeenCalledWith('row2');
    });
  });

  describe('Buffer Operations', () => {
    it('should reconstruct full buffer line with wrapping', () => {
      const mockBuffer = {
        getLine: vi.fn().mockImplementation((i) => {
          if (i === 0) return { translateToString: () => 'part1', isWrapped: false };
          if (i === 1) return { translateToString: () => 'part2', isWrapped: true };
          return null;
        })
      };
      
      const line1 = mockBuffer.getLine(1);
      const full = manager.getFullBufferLine(line1 as any, 1, mockBuffer);
      
      expect(full).toBe('part1part2');
    });

    it('should iterate buffer in reverse', () => {
      const mockBuffer = {
        getLine: vi.fn().mockImplementation((i) => ({ id: i }))
      };
      
      const iterator = manager.getBufferReverseIterator(mockBuffer, 2);
      const results = Array.from(iterator);
      
      expect(results).toHaveLength(3);
      expect((results[0] as any).id).toBe(2);
      expect((results[1] as any).id).toBe(1);
      expect((results[2] as any).id).toBe(0);
    });
  });
});