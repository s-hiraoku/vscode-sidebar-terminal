/**
 * GridLayoutCalculator Unit Tests
 *
 * Tests for the grid layout calculation logic used when 6-10 terminals
 * are displayed in split mode within a panel (maximized secondary sidebar).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistribution,
  shouldUseGrid,
  getGridTemplateColumns,
} from '../../../../../webview/utils/GridLayoutCalculator';

describe('GridLayoutCalculator', () => {
  describe('calculateDistribution', () => {
    it('should return { row1: 0, row2: 0 } for 0 terminals', () => {
      const result = calculateDistribution(0);
      expect(result).toEqual({ row1: 0, row2: 0 });
    });

    it('should return { row1: 1, row2: 0 } for 1 terminal', () => {
      const result = calculateDistribution(1);
      expect(result).toEqual({ row1: 1, row2: 0 });
    });

    it('should return { row1: 3, row2: 2 } for 5 terminals', () => {
      const result = calculateDistribution(5);
      expect(result).toEqual({ row1: 3, row2: 2 });
    });

    it('should return { row1: 3, row2: 3 } for 6 terminals', () => {
      const result = calculateDistribution(6);
      expect(result).toEqual({ row1: 3, row2: 3 });
    });

    it('should return { row1: 4, row2: 3 } for 7 terminals', () => {
      const result = calculateDistribution(7);
      expect(result).toEqual({ row1: 4, row2: 3 });
    });

    it('should return { row1: 4, row2: 4 } for 8 terminals', () => {
      const result = calculateDistribution(8);
      expect(result).toEqual({ row1: 4, row2: 4 });
    });

    it('should return { row1: 5, row2: 4 } for 9 terminals', () => {
      const result = calculateDistribution(9);
      expect(result).toEqual({ row1: 5, row2: 4 });
    });

    it('should return { row1: 5, row2: 5 } for 10 terminals', () => {
      const result = calculateDistribution(10);
      expect(result).toEqual({ row1: 5, row2: 5 });
    });

    it('should handle 11 terminals (beyond max)', () => {
      const result = calculateDistribution(11);
      expect(result).toEqual({ row1: 6, row2: 5 });
    });
  });

  describe('shouldUseGrid', () => {
    it('should return false for fewer than 6 terminals', () => {
      expect(shouldUseGrid(5, 'panel', true)).toBe(false);
      expect(shouldUseGrid(1, 'panel', true)).toBe(false);
      expect(shouldUseGrid(0, 'panel', true)).toBe(false);
    });

    it('should return true for 6 terminals in panel mode with split', () => {
      expect(shouldUseGrid(6, 'panel', true)).toBe(true);
    });

    it('should return true for 10 terminals in panel mode with split', () => {
      expect(shouldUseGrid(10, 'panel', true)).toBe(true);
    });

    it('should return false when not in split mode', () => {
      expect(shouldUseGrid(6, 'panel', false)).toBe(false);
      expect(shouldUseGrid(10, 'panel', false)).toBe(false);
    });

    it('should return false for sidebar location', () => {
      expect(shouldUseGrid(6, 'sidebar', true)).toBe(false);
      expect(shouldUseGrid(10, 'sidebar', true)).toBe(false);
    });

    it('should return true for 7, 8, 9 terminals in panel split mode', () => {
      expect(shouldUseGrid(7, 'panel', true)).toBe(true);
      expect(shouldUseGrid(8, 'panel', true)).toBe(true);
      expect(shouldUseGrid(9, 'panel', true)).toBe(true);
    });
  });

  describe('getGridTemplateColumns', () => {
    it('should return repeat(1, 1fr) for 1 column', () => {
      expect(getGridTemplateColumns(1)).toBe('repeat(1, 1fr)');
    });

    it('should return repeat(3, 1fr) for 3 columns', () => {
      expect(getGridTemplateColumns(3)).toBe('repeat(3, 1fr)');
    });

    it('should return repeat(4, 1fr) for 4 columns', () => {
      expect(getGridTemplateColumns(4)).toBe('repeat(4, 1fr)');
    });

    it('should return repeat(5, 1fr) for 5 columns', () => {
      expect(getGridTemplateColumns(5)).toBe('repeat(5, 1fr)');
    });
  });
});
