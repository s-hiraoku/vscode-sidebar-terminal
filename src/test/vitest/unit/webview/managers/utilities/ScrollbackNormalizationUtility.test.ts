/**
 * ScrollbackNormalizationUtility Tests
 *
 * Tests for scrollback data normalization and transformation
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect } from 'vitest';
import {
  ScrollbackNormalizationUtility,
  ScrollbackLine,
} from '../../../../../../webview/managers/utilities/ScrollbackNormalizationUtility';

describe('ScrollbackNormalizationUtility', () => {
  describe('normalizeScrollbackContent', () => {
    it('should normalize string array to ScrollbackLine array', () => {
      const input = ['line 1', 'line 2', 'line 3'];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ content: 'line 1', type: 'output' });
      expect(result[1]).toEqual({ content: 'line 2', type: 'output' });
      expect(result[2]).toEqual({ content: 'line 3', type: 'output' });
    });

    it('should normalize object array with type fields', () => {
      const input = [
        { content: 'output line', type: 'output' },
        { content: 'input line', type: 'input' },
        { content: 'error line', type: 'error' },
      ];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).toHaveLength(3);
      expect(result[0]!.type).toBe('output');
      expect(result[1]!.type).toBe('input');
      expect(result[2]!.type).toBe('error');
    });

    it('should normalize object array with timestamps', () => {
      const timestamp = Date.now();
      const input = [{ content: 'line 1', type: 'output', timestamp }];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).toHaveLength(1);
      expect(result[0]!.timestamp).toBe(timestamp);
    });

    it('should normalize invalid type to output', () => {
      const input = [{ content: 'line 1', type: 'invalid-type' }];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe('output');
    });

    it('should handle empty array', () => {
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent([]);
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });

    it('should handle null/undefined input', () => {
      expect(ScrollbackNormalizationUtility.normalizeScrollbackContent(null)).toHaveLength(0);
      expect(ScrollbackNormalizationUtility.normalizeScrollbackContent(undefined)).toHaveLength(0);
    });

    it('should filter out objects without content field', () => {
      const input = [
        { content: 'valid line' },
        { noContent: 'invalid' },
        { content: 'another valid line' },
      ];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).toHaveLength(2);
      expect(result[0]!.content).toBe('valid line');
      expect(result[1]!.content).toBe('another valid line');
    });

    it('should filter out objects with non-string content', () => {
      const input = [{ content: 'valid line' }, { content: 123 }, { content: null }];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe('valid line');
    });
  });

  describe('formatScrollbackForTransfer', () => {
    it('should format lines for transfer', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'input' },
      ];
      const result = ScrollbackNormalizationUtility.formatScrollbackForTransfer(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('content');
      expect(result[0]).toHaveProperty('type');
    });

    it('should include timestamp if present', () => {
      const timestamp = Date.now();
      const input: ScrollbackLine[] = [{ content: 'line 1', type: 'output', timestamp }];
      const result = ScrollbackNormalizationUtility.formatScrollbackForTransfer(input);

      expect(result[0]!.timestamp).toBe(timestamp);
    });

    it('should default type to output if not specified', () => {
      const input: ScrollbackLine[] = [{ content: 'line 1' } as ScrollbackLine];
      const result = ScrollbackNormalizationUtility.formatScrollbackForTransfer(input);

      expect(result[0]!.type).toBe('output');
    });
  });

  describe('toStringArray', () => {
    it('should convert to string array', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'input' },
      ];
      const result = ScrollbackNormalizationUtility.toStringArray(input);

      expect(result).toEqual(['line 1', 'line 2']);
    });

    it('should handle empty array', () => {
      const result = ScrollbackNormalizationUtility.toStringArray([]);
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterEmptyLines', () => {
    it('should filter all empty lines by default', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: '', type: 'output' },
        { content: 'line 2', type: 'output' },
        { content: '  ', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.filterEmptyLines(input);

      expect(result).toHaveLength(2);
      expect(result[0]!.content).toBe('line 1');
      expect(result[1]!.content).toBe('line 2');
    });

    it('should keep structural empty lines when specified', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: '', type: 'output' },
        { content: 'line 2', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.filterEmptyLines(input, true);

      expect(result).toHaveLength(3);
    });

    it('should remove leading empty lines when keeping structural', () => {
      const input: ScrollbackLine[] = [
        { content: '', type: 'output' },
        { content: 'line 1', type: 'output' },
        { content: '', type: 'output' },
        { content: 'line 2', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.filterEmptyLines(input, true);

      expect(result).toHaveLength(3);
      expect(result[0]!.content).toBe('line 1');
    });

    it('should remove trailing empty lines when keeping structural', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: '', type: 'output' },
        { content: 'line 2', type: 'output' },
        { content: '', type: 'output' },
        { content: '  ', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.filterEmptyLines(input, true);

      expect(result).toHaveLength(3);
      expect(result[2]!.content).toBe('line 2');
    });
  });

  describe('truncate', () => {
    it('should truncate from end by default', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'output' },
        { content: 'line 3', type: 'output' },
        { content: 'line 4', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.truncate(input, 2);

      expect(result).toHaveLength(2);
      expect(result[0]!.content).toBe('line 3');
      expect(result[1]!.content).toBe('line 4');
    });

    it('should truncate from start when specified', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'output' },
        { content: 'line 3', type: 'output' },
        { content: 'line 4', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.truncate(input, 2, false);

      expect(result).toHaveLength(2);
      expect(result[0]!.content).toBe('line 1');
      expect(result[1]!.content).toBe('line 2');
    });

    it('should return all lines if count is larger than array', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.truncate(input, 10);

      expect(result).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const result = ScrollbackNormalizationUtility.truncate([], 5);
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });
  });

  describe('merge', () => {
    it('should merge multiple arrays', () => {
      const array1: ScrollbackLine[] = [{ content: 'line 1', type: 'output' }];
      const array2: ScrollbackLine[] = [{ content: 'line 2', type: 'output' }];
      const array3: ScrollbackLine[] = [{ content: 'line 3', type: 'output' }];
      const result = ScrollbackNormalizationUtility.merge(array1, array2, array3);

      expect(result).toHaveLength(3);
      expect(result[0]!.content).toBe('line 1');
      expect(result[1]!.content).toBe('line 2');
      expect(result[2]!.content).toBe('line 3');
    });

    it('should handle empty arrays', () => {
      const array1: ScrollbackLine[] = [];
      const array2: ScrollbackLine[] = [{ content: 'line 1', type: 'output' }];
      const result = ScrollbackNormalizationUtility.merge(array1, array2);

      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe('line 1');
    });

    it('should handle no arguments', () => {
      const result = ScrollbackNormalizationUtility.merge();
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });
  });

  describe('isValidLine', () => {
    it('should validate valid line', () => {
      const line: ScrollbackLine = {
        content: 'test',
        type: 'output',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).toBe(true);
    });

    it('should validate line with timestamp', () => {
      const line: ScrollbackLine = {
        content: 'test',
        type: 'output',
        timestamp: Date.now(),
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).toBe(true);
    });

    it('should validate line without type', () => {
      const line = {
        content: 'test',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).toBe(true);
    });

    it('should reject line without content', () => {
      const line = {
        type: 'output',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).toBe(false);
    });

    it('should reject line with non-string content', () => {
      const line = {
        content: 123,
        type: 'output',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).toBe(false);
    });

    it('should reject line with invalid type', () => {
      const line = {
        content: 'test',
        type: 'invalid',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).toBe(false);
    });

    it('should reject line with non-number timestamp', () => {
      const line = {
        content: 'test',
        type: 'output',
        timestamp: 'not-a-number',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).toBe(false);
    });

    it('should reject null', () => {
      expect(ScrollbackNormalizationUtility.isValidLine(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(ScrollbackNormalizationUtility.isValidLine(undefined)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(ScrollbackNormalizationUtility.isValidLine('string')).toBe(false);
      expect(ScrollbackNormalizationUtility.isValidLine(123)).toBe(false);
    });
  });

  describe('sanitize', () => {
    it('should sanitize array of lines', () => {
      const input = [
        { content: 'valid', type: 'output' },
        { noContent: 'invalid' },
        { content: 'also valid' },
        { content: 123 },
      ];
      const result = ScrollbackNormalizationUtility.sanitize(input);

      expect(result).toHaveLength(2);
      expect(result[0]!.content).toBe('valid');
      expect(result[1]!.content).toBe('also valid');
    });

    it('should default missing type to output', () => {
      const input = [{ content: 'line 1' }];
      const result = ScrollbackNormalizationUtility.sanitize(input);

      expect(result[0]!.type).toBe('output');
    });

    it('should preserve valid types', () => {
      const input = [
        { content: 'out', type: 'output' },
        { content: 'in', type: 'input' },
        { content: 'err', type: 'error' },
      ];
      const result = ScrollbackNormalizationUtility.sanitize(input);

      expect(result[0]!.type).toBe('output');
      expect(result[1]!.type).toBe('input');
      expect(result[2]!.type).toBe('error');
    });

    it('should preserve timestamps', () => {
      const timestamp = Date.now();
      const input = [{ content: 'test', timestamp }];
      const result = ScrollbackNormalizationUtility.sanitize(input);

      expect(result[0]!.timestamp).toBe(timestamp);
    });

    it('should handle empty array', () => {
      const result = ScrollbackNormalizationUtility.sanitize([]);
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    it('should normalize, filter, and truncate in sequence', () => {
      const input = ['line 1', 'line 2', '', 'line 3', 'line 4', ''];

      const normalized = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);
      const filtered = ScrollbackNormalizationUtility.filterEmptyLines(normalized);
      const truncated = ScrollbackNormalizationUtility.truncate(filtered, 2);

      expect(truncated).toHaveLength(2);
      expect(truncated[0]!.content).toBe('line 3');
      expect(truncated[1]!.content).toBe('line 4');
    });

    it('should merge, sanitize, and format in sequence', () => {
      const array1 = [{ content: 'line 1', type: 'output' as const }];
      const array2 = [{ content: 'line 2' }];

      const merged = ScrollbackNormalizationUtility.merge(array1, array2);
      const sanitized = ScrollbackNormalizationUtility.sanitize(merged);
      const formatted = ScrollbackNormalizationUtility.formatScrollbackForTransfer(sanitized);

      expect(formatted).toHaveLength(2);
      expect(formatted[0]!.type).toBe('output');
      expect(formatted[1]!.type).toBe('output');
    });

    it('should convert to string array after processing', () => {
      const input = ['  line 1  ', '', 'line 2', '  '];

      const normalized = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);
      const filtered = ScrollbackNormalizationUtility.filterEmptyLines(normalized);
      const strings = ScrollbackNormalizationUtility.toStringArray(filtered);

      expect(strings).toEqual(['  line 1  ', 'line 2']);
    });
  });
});
