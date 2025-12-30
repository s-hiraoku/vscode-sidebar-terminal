import { describe, it, expect } from 'vitest';
import { arraysEqual, isArrayEqual, haveSameElements, unique, chunk } from '../../../../utils/arrayUtils';

describe('ArrayUtils', () => {
  describe('arraysEqual', () => {
    it('should return true for identical arrays', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
      expect(arraysEqual([], [])).toBe(true);
    });

    it('should return false for arrays with different lengths', () => {
      expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return false for arrays with different elements', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should return false for arrays with same elements in different order', () => {
      expect(arraysEqual([1, 2, 3], [3, 2, 1])).toBe(false);
    });
  });

  describe('isArrayEqual (alias)', () => {
    it('should behave same as arraysEqual', () => {
      expect(isArrayEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(isArrayEqual([1, 2], [1, 3])).toBe(false);
    });
  });

  describe('haveSameElements', () => {
    it('should return true for arrays with same elements in same order', () => {
      expect(haveSameElements([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return true for arrays with same elements in different order', () => {
      expect(haveSameElements([1, 2, 3], [3, 1, 2])).toBe(true);
    });

    it('should return false for arrays with different lengths', () => {
      expect(haveSameElements([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return false for arrays with different elements', () => {
      expect(haveSameElements([1, 2, 3], [1, 2, 4])).toBe(false);
    });
  });

  describe('unique', () => {
    it('should remove duplicates', () => {
      expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
      expect(unique(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });

    it('should return empty array for empty input', () => {
      expect(unique([])).toEqual([]);
    });

    it('should handle array with no duplicates', () => {
      expect(unique([1, 2, 3])).toEqual([1, 2, 3]);
    });
  });

  describe('chunk', () => {
    it('should chunk array correctly', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle chunk size larger than array', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it('should handle exact multiples', () => {
      expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
    });

    it('should handle empty array', () => {
      expect(chunk([], 2)).toEqual([]);
    });
  });
});
