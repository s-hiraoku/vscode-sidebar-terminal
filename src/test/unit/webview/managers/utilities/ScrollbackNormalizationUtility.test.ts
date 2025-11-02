/**
 * ScrollbackNormalizationUtility Tests
 *
 * Tests for scrollback data normalization and transformation
 */

import { expect } from 'chai';
import {
  ScrollbackNormalizationUtility,
  ScrollbackLine,
} from '../../../../../webview/managers/utilities/ScrollbackNormalizationUtility';

describe('ScrollbackNormalizationUtility', () => {
  describe('normalizeScrollbackContent', () => {
    it('should normalize string array to ScrollbackLine array', () => {
      const input = ['line 1', 'line 2', 'line 3'];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).to.have.lengthOf(3);
      expect(result[0]).to.deep.equal({ content: 'line 1', type: 'output' });
      expect(result[1]).to.deep.equal({ content: 'line 2', type: 'output' });
      expect(result[2]).to.deep.equal({ content: 'line 3', type: 'output' });
    });

    it('should normalize object array with type fields', () => {
      const input = [
        { content: 'output line', type: 'output' },
        { content: 'input line', type: 'input' },
        { content: 'error line', type: 'error' },
      ];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).to.have.lengthOf(3);
      expect(result[0]!.type).to.equal('output');
      expect(result[1]!.type).to.equal('input');
      expect(result[2]!.type).to.equal('error');
    });

    it('should normalize object array with timestamps', () => {
      const timestamp = Date.now();
      const input = [
        { content: 'line 1', type: 'output', timestamp },
      ];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).to.have.lengthOf(1);
      expect(result[0]!.timestamp).to.equal(timestamp);
    });

    it('should normalize invalid type to output', () => {
      const input = [
        { content: 'line 1', type: 'invalid-type' },
      ];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).to.have.lengthOf(1);
      expect(result[0]!.type).to.equal('output');
    });

    it('should handle empty array', () => {
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent([]);
      expect(result).to.be.an('array').that.is.empty;
    });

    it('should handle null/undefined input', () => {
      expect(ScrollbackNormalizationUtility.normalizeScrollbackContent(null)).to.be.empty;
      expect(ScrollbackNormalizationUtility.normalizeScrollbackContent(undefined)).to.be.empty;
    });

    it('should filter out objects without content field', () => {
      const input = [
        { content: 'valid line' },
        { noContent: 'invalid' },
        { content: 'another valid line' },
      ];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).to.have.lengthOf(2);
      expect(result[0]!.content).to.equal('valid line');
      expect(result[1]!.content).to.equal('another valid line');
    });

    it('should filter out objects with non-string content', () => {
      const input = [
        { content: 'valid line' },
        { content: 123 },
        { content: null },
      ];
      const result = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);

      expect(result).to.have.lengthOf(1);
      expect(result[0]!.content).to.equal('valid line');
    });
  });

  describe('formatScrollbackForTransfer', () => {
    it('should format lines for transfer', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'input' },
      ];
      const result = ScrollbackNormalizationUtility.formatScrollbackForTransfer(input);

      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.have.property('content');
      expect(result[0]).to.have.property('type');
    });

    it('should include timestamp if present', () => {
      const timestamp = Date.now();
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output', timestamp },
      ];
      const result = ScrollbackNormalizationUtility.formatScrollbackForTransfer(input);

      expect(result[0]!.timestamp).to.equal(timestamp);
    });

    it('should default type to output if not specified', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1' } as ScrollbackLine,
      ];
      const result = ScrollbackNormalizationUtility.formatScrollbackForTransfer(input);

      expect(result[0]!.type).to.equal('output');
    });
  });

  describe('toStringArray', () => {
    it('should convert to string array', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'input' },
      ];
      const result = ScrollbackNormalizationUtility.toStringArray(input);

      expect(result).to.deep.equal(['line 1', 'line 2']);
    });

    it('should handle empty array', () => {
      const result = ScrollbackNormalizationUtility.toStringArray([]);
      expect(result).to.be.an('array').that.is.empty;
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

      expect(result).to.have.lengthOf(2);
      expect(result[0]!.content).to.equal('line 1');
      expect(result[1]!.content).to.equal('line 2');
    });

    it('should keep structural empty lines when specified', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: '', type: 'output' },
        { content: 'line 2', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.filterEmptyLines(input, true);

      expect(result).to.have.lengthOf(3);
    });

    it('should remove leading empty lines when keeping structural', () => {
      const input: ScrollbackLine[] = [
        { content: '', type: 'output' },
        { content: 'line 1', type: 'output' },
        { content: '', type: 'output' },
        { content: 'line 2', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.filterEmptyLines(input, true);

      expect(result).to.have.lengthOf(3);
      expect(result[0]!.content).to.equal('line 1');
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

      expect(result).to.have.lengthOf(3);
      expect(result[2]!.content).to.equal('line 2');
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

      expect(result).to.have.lengthOf(2);
      expect(result[0]!.content).to.equal('line 3');
      expect(result[1]!.content).to.equal('line 4');
    });

    it('should truncate from start when specified', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'output' },
        { content: 'line 3', type: 'output' },
        { content: 'line 4', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.truncate(input, 2, false);

      expect(result).to.have.lengthOf(2);
      expect(result[0]!.content).to.equal('line 1');
      expect(result[1]!.content).to.equal('line 2');
    });

    it('should return all lines if count is larger than array', () => {
      const input: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
        { content: 'line 2', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.truncate(input, 10);

      expect(result).to.have.lengthOf(2);
    });

    it('should handle empty array', () => {
      const result = ScrollbackNormalizationUtility.truncate([], 5);
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('merge', () => {
    it('should merge multiple arrays', () => {
      const array1: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
      ];
      const array2: ScrollbackLine[] = [
        { content: 'line 2', type: 'output' },
      ];
      const array3: ScrollbackLine[] = [
        { content: 'line 3', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.merge(array1, array2, array3);

      expect(result).to.have.lengthOf(3);
      expect(result[0]!.content).to.equal('line 1');
      expect(result[1]!.content).to.equal('line 2');
      expect(result[2]!.content).to.equal('line 3');
    });

    it('should handle empty arrays', () => {
      const array1: ScrollbackLine[] = [];
      const array2: ScrollbackLine[] = [
        { content: 'line 1', type: 'output' },
      ];
      const result = ScrollbackNormalizationUtility.merge(array1, array2);

      expect(result).to.have.lengthOf(1);
      expect(result[0]!.content).to.equal('line 1');
    });

    it('should handle no arguments', () => {
      const result = ScrollbackNormalizationUtility.merge();
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('isValidLine', () => {
    it('should validate valid line', () => {
      const line: ScrollbackLine = {
        content: 'test',
        type: 'output',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).to.be.true;
    });

    it('should validate line with timestamp', () => {
      const line: ScrollbackLine = {
        content: 'test',
        type: 'output',
        timestamp: Date.now(),
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).to.be.true;
    });

    it('should validate line without type', () => {
      const line = {
        content: 'test',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).to.be.true;
    });

    it('should reject line without content', () => {
      const line = {
        type: 'output',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).to.be.false;
    });

    it('should reject line with non-string content', () => {
      const line = {
        content: 123,
        type: 'output',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).to.be.false;
    });

    it('should reject line with invalid type', () => {
      const line = {
        content: 'test',
        type: 'invalid',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).to.be.false;
    });

    it('should reject line with non-number timestamp', () => {
      const line = {
        content: 'test',
        type: 'output',
        timestamp: 'not-a-number',
      };
      expect(ScrollbackNormalizationUtility.isValidLine(line)).to.be.false;
    });

    it('should reject null', () => {
      expect(ScrollbackNormalizationUtility.isValidLine(null)).to.be.false;
    });

    it('should reject undefined', () => {
      expect(ScrollbackNormalizationUtility.isValidLine(undefined)).to.be.false;
    });

    it('should reject non-object', () => {
      expect(ScrollbackNormalizationUtility.isValidLine('string')).to.be.false;
      expect(ScrollbackNormalizationUtility.isValidLine(123)).to.be.false;
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

      expect(result).to.have.lengthOf(2);
      expect(result[0]!.content).to.equal('valid');
      expect(result[1]!.content).to.equal('also valid');
    });

    it('should default missing type to output', () => {
      const input = [
        { content: 'line 1' },
      ];
      const result = ScrollbackNormalizationUtility.sanitize(input);

      expect(result[0]!.type).to.equal('output');
    });

    it('should preserve valid types', () => {
      const input = [
        { content: 'out', type: 'output' },
        { content: 'in', type: 'input' },
        { content: 'err', type: 'error' },
      ];
      const result = ScrollbackNormalizationUtility.sanitize(input);

      expect(result[0]!.type).to.equal('output');
      expect(result[1]!.type).to.equal('input');
      expect(result[2]!.type).to.equal('error');
    });

    it('should preserve timestamps', () => {
      const timestamp = Date.now();
      const input = [
        { content: 'test', timestamp },
      ];
      const result = ScrollbackNormalizationUtility.sanitize(input);

      expect(result[0]!.timestamp).to.equal(timestamp);
    });

    it('should handle empty array', () => {
      const result = ScrollbackNormalizationUtility.sanitize([]);
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('Integration Tests', () => {
    it('should normalize, filter, and truncate in sequence', () => {
      const input = [
        'line 1',
        'line 2',
        '',
        'line 3',
        'line 4',
        '',
      ];

      const normalized = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);
      const filtered = ScrollbackNormalizationUtility.filterEmptyLines(normalized);
      const truncated = ScrollbackNormalizationUtility.truncate(filtered, 2);

      expect(truncated).to.have.lengthOf(2);
      expect(truncated[0]!.content).to.equal('line 3');
      expect(truncated[1]!.content).to.equal('line 4');
    });

    it('should merge, sanitize, and format in sequence', () => {
      const array1 = [{ content: 'line 1', type: 'output' as const }];
      const array2 = [{ content: 'line 2' }];

      const merged = ScrollbackNormalizationUtility.merge(array1, array2);
      const sanitized = ScrollbackNormalizationUtility.sanitize(merged);
      const formatted = ScrollbackNormalizationUtility.formatScrollbackForTransfer(sanitized);

      expect(formatted).to.have.lengthOf(2);
      expect(formatted[0]!.type).to.equal('output');
      expect(formatted[1]!.type).to.equal('output');
    });

    it('should convert to string array after processing', () => {
      const input = ['  line 1  ', '', 'line 2', '  '];

      const normalized = ScrollbackNormalizationUtility.normalizeScrollbackContent(input);
      const filtered = ScrollbackNormalizationUtility.filterEmptyLines(normalized);
      const strings = ScrollbackNormalizationUtility.toStringArray(filtered);

      expect(strings).to.deep.equal(['  line 1  ', 'line 2']);
    });
  });
});
