import { describe, it, expect } from 'vitest';
import {
  arraysEqual,
  isArrayEqual,
  haveSameElements,
  unique,
  chunk,
} from '../../../../utils/arrayUtils';

describe('arraysEqual', () => {
  describe('with primitive values', () => {
    it('should return true for empty arrays', () => {
      expect(arraysEqual([], [])).toBe(true);
    });

    it('should return true for equal arrays of numbers', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return true for equal arrays of strings', () => {
      expect(arraysEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
    });

    it('should return false for arrays with different lengths', () => {
      expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return false for arrays with different values', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should return false for arrays with same values in different order', () => {
      expect(arraysEqual([1, 2, 3], [3, 2, 1])).toBe(false);
    });

    it('should return true for single-element arrays', () => {
      expect(arraysEqual([1], [1])).toBe(true);
    });

    it('should handle arrays with null and undefined', () => {
      expect(arraysEqual([null, undefined], [null, undefined])).toBe(true);
      expect(arraysEqual([null], [undefined])).toBe(false);
    });

    it('should handle arrays with boolean values', () => {
      expect(arraysEqual([true, false], [true, false])).toBe(true);
      expect(arraysEqual([true, false], [false, true])).toBe(false);
    });
  });

  describe('with objects', () => {
    it('should return false for arrays with same object values but different references', () => {
      expect(arraysEqual([{ a: 1 }], [{ a: 1 }])).toBe(false);
    });

    it('should return true for arrays with same object references', () => {
      const obj = { a: 1 };
      expect(arraysEqual([obj], [obj])).toBe(true);
    });
  });
});

describe('isArrayEqual', () => {
  it('should be an alias for arraysEqual', () => {
    expect(isArrayEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isArrayEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isArrayEqual([1, 2, 3], [3, 2, 1])).toBe(false);
  });
});

describe('haveSameElements', () => {
  it('should return true for empty arrays', () => {
    expect(haveSameElements([], [])).toBe(true);
  });

  it('should return true for arrays with same elements in same order', () => {
    expect(haveSameElements([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('should return true for arrays with same elements in different order', () => {
    expect(haveSameElements([1, 2, 3], [3, 2, 1])).toBe(true);
  });

  it('should return false for arrays with different lengths', () => {
    expect(haveSameElements([1, 2], [1, 2, 3])).toBe(false);
  });

  it('should return false for arrays with different elements', () => {
    expect(haveSameElements([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it('should handle arrays with duplicates by Set conversion', () => {
    // Set conversion means duplicates are counted differently
    expect(haveSameElements([1, 1, 2], [1, 2, 2])).toBe(true); // Both sets are {1, 2}
    expect(haveSameElements([1, 1, 2], [1, 2, 3])).toBe(false);
  });

  it('should return false when set sizes differ', () => {
    // Different unique element counts
    expect(haveSameElements([1, 1, 1], [1, 2, 3])).toBe(false);
  });

  it('should handle strings', () => {
    expect(haveSameElements(['a', 'b', 'c'], ['c', 'b', 'a'])).toBe(true);
    expect(haveSameElements(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('should handle mixed types', () => {
    expect(haveSameElements([1, 'a', true], ['a', true, 1])).toBe(true);
    expect(haveSameElements([1, 'a', true], [1, 'a', false])).toBe(false);
  });
});

describe('unique', () => {
  it('should return empty array for empty input', () => {
    expect(unique([])).toEqual([]);
  });

  it('should return same array when no duplicates', () => {
    expect(unique([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('should remove duplicate numbers', () => {
    expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  it('should remove duplicate strings', () => {
    expect(unique(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('should preserve order of first occurrence', () => {
    expect(unique([3, 1, 2, 1, 3, 2])).toEqual([3, 1, 2]);
  });

  it('should handle single-element arrays', () => {
    expect(unique([1])).toEqual([1]);
  });

  it('should handle arrays with only duplicates', () => {
    expect(unique([1, 1, 1, 1])).toEqual([1]);
  });

  it('should handle null and undefined', () => {
    expect(unique([null, undefined, null, undefined])).toEqual([null, undefined]);
  });

  it('should not deduplicate objects by value', () => {
    const result = unique([{ a: 1 }, { a: 1 }]);
    expect(result).toHaveLength(2); // Different object references
  });

  it('should deduplicate same object references', () => {
    const obj = { a: 1 };
    expect(unique([obj, obj, obj])).toEqual([obj]);
  });
});

describe('chunk', () => {
  it('should return empty array for empty input', () => {
    expect(chunk([], 2)).toEqual([]);
  });

  it('should split array into chunks of specified size', () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('should handle array with length not divisible by chunk size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('should handle chunk size of 1', () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it('should handle chunk size larger than array', () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('should handle chunk size equal to array length', () => {
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it('should handle single-element array', () => {
    expect(chunk([1], 1)).toEqual([[1]]);
    expect(chunk([1], 5)).toEqual([[1]]);
  });

  it('should work with string arrays', () => {
    expect(chunk(['a', 'b', 'c', 'd'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('should work with mixed-type arrays', () => {
    expect(chunk([1, 'a', true, null], 2)).toEqual([
      [1, 'a'],
      [true, null],
    ]);
  });

  it('should handle large arrays efficiently', () => {
    const largeArray = Array.from({ length: 100 }, (_, i) => i);
    const result = chunk(largeArray, 10);

    expect(result).toHaveLength(10);
    expect(result[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result[9]).toEqual([90, 91, 92, 93, 94, 95, 96, 97, 98, 99]);
  });
});
