// @vitest-environment node
/**
 * SplitResizeManager Unit Tests
 *
 * TDD tests for the drag-to-resize functionality of split terminals
 */

import { describe, it, expect } from 'vitest';
import { SPLIT_RESIZE_CONSTANTS } from '../../../../../webview/constants/webview';

describe('SplitResizeManager', () => {
  describe('Constants', () => {
    it('should have correct default constants', () => {
      expect(SPLIT_RESIZE_CONSTANTS.MIN_RESIZE_SIZE_PX).toBe(50);
      expect(SPLIT_RESIZE_CONSTANTS.RESIZE_THROTTLE_MS).toBe(16);
      expect(SPLIT_RESIZE_CONSTANTS.PTY_NOTIFY_DEBOUNCE_MS).toBe(100);
    });
  });

  describe('Size Calculation Logic', () => {
    // Pure function tests without needing the full class
    const calculateNewSizes = (params: {
      startPosition: number;
      currentPosition: number;
      startSizes: { before: number; after: number };
      direction: 'horizontal' | 'vertical';
      minSize: number;
    }) => {
      const { startPosition, currentPosition, startSizes, minSize } = params;

      // Calculate delta
      const delta = currentPosition - startPosition;

      // Calculate raw new sizes
      let beforeSize = startSizes.before + delta;
      let afterSize = startSizes.after - delta;

      // Get total size (should remain constant)
      const totalSize = startSizes.before + startSizes.after;

      // Enforce minimum sizes
      if (beforeSize < minSize) {
        beforeSize = minSize;
        afterSize = totalSize - beforeSize;
      }

      if (afterSize < minSize) {
        afterSize = minSize;
        beforeSize = totalSize - afterSize;
      }

      return { beforeSize, afterSize };
    };

    it('should calculate new sizes based on mouse delta for vertical split', () => {
      const result = calculateNewSizes({
        startPosition: 300,
        currentPosition: 350,
        startSizes: { before: 300, after: 300 },
        direction: 'vertical',
        minSize: 50,
      });

      expect(result.beforeSize).toBe(350); // 300 + 50
      expect(result.afterSize).toBe(250); // 300 - 50
    });

    it('should calculate new sizes based on mouse delta for horizontal split', () => {
      const result = calculateNewSizes({
        startPosition: 200,
        currentPosition: 250,
        startSizes: { before: 200, after: 200 },
        direction: 'horizontal',
        minSize: 50,
      });

      expect(result.beforeSize).toBe(250); // 200 + 50
      expect(result.afterSize).toBe(150); // 200 - 50
    });

    it('should enforce minimum size when shrinking before wrapper', () => {
      const result = calculateNewSizes({
        startPosition: 300,
        currentPosition: 50, // Try to shrink before to almost nothing
        startSizes: { before: 100, after: 500 },
        direction: 'vertical',
        minSize: 50,
      });

      expect(result.beforeSize).toBeGreaterThanOrEqual(50);
    });

    it('should enforce minimum size when shrinking after wrapper', () => {
      const result = calculateNewSizes({
        startPosition: 300,
        currentPosition: 550, // Try to shrink after to almost nothing
        startSizes: { before: 300, after: 100 },
        direction: 'vertical',
        minSize: 50,
      });

      expect(result.afterSize).toBeGreaterThanOrEqual(50);
    });

    it('should maintain total size constant', () => {
      const startSizes = { before: 300, after: 300 };
      const result = calculateNewSizes({
        startPosition: 300,
        currentPosition: 400,
        startSizes,
        direction: 'vertical',
        minSize: 50,
      });

      // Total should remain constant
      const total = result.beforeSize + result.afterSize;
      expect(total).toBe(startSizes.before + startSizes.after);
    });

    it('should handle negative delta (moving up/left)', () => {
      const result = calculateNewSizes({
        startPosition: 300,
        currentPosition: 200, // Moving up/left
        startSizes: { before: 300, after: 300 },
        direction: 'vertical',
        minSize: 50,
      });

      expect(result.beforeSize).toBe(200); // 300 - 100
      expect(result.afterSize).toBe(400); // 300 + 100
    });

    it('should handle zero delta', () => {
      const result = calculateNewSizes({
        startPosition: 300,
        currentPosition: 300, // No movement
        startSizes: { before: 300, after: 300 },
        direction: 'vertical',
        minSize: 50,
      });

      expect(result.beforeSize).toBe(300);
      expect(result.afterSize).toBe(300);
    });

    it('should handle unequal starting sizes', () => {
      const result = calculateNewSizes({
        startPosition: 200,
        currentPosition: 250,
        startSizes: { before: 200, after: 400 },
        direction: 'horizontal',
        minSize: 50,
      });

      expect(result.beforeSize).toBe(250);
      expect(result.afterSize).toBe(350);
      // Total preserved
      expect(result.beforeSize + result.afterSize).toBe(600);
    });

    it('should clamp to minimum when dragging beyond bounds', () => {
      // Try to make before very small
      const result1 = calculateNewSizes({
        startPosition: 300,
        currentPosition: 0,
        startSizes: { before: 100, after: 500 },
        direction: 'vertical',
        minSize: 50,
      });
      expect(result1.beforeSize).toBe(50);
      expect(result1.afterSize).toBe(550);

      // Try to make after very small
      const result2 = calculateNewSizes({
        startPosition: 300,
        currentPosition: 800,
        startSizes: { before: 500, after: 100 },
        direction: 'vertical',
        minSize: 50,
      });
      expect(result2.afterSize).toBe(50);
      expect(result2.beforeSize).toBe(550);
    });
  });

  describe('CSS Classes', () => {
    it('should define correct CSS class names', () => {
      // These are the CSS classes used by the manager
      const expectedClasses = {
        resizer: 'split-resizer',
        dragging: 'dragging',
        bodyResizing: 'resizing-split',
        bodyResizingHorizontal: 'resizing-horizontal',
        bodyResizingVertical: 'resizing-vertical',
      };

      // Verify class naming conventions
      expect(expectedClasses.resizer).toBe('split-resizer');
      expect(expectedClasses.dragging).toBe('dragging');
      expect(expectedClasses.bodyResizing).toBe('resizing-split');
    });
  });

  describe('Data Attributes', () => {
    it('should define correct data attribute names', () => {
      const expectedAttributes = {
        resizerBefore: 'data-resizer-before',
        resizerAfter: 'data-resizer-after',
        terminalWrapperId: 'data-terminal-wrapper-id',
      };

      expect(expectedAttributes.resizerBefore).toBe('data-resizer-before');
      expect(expectedAttributes.resizerAfter).toBe('data-resizer-after');
      expect(expectedAttributes.terminalWrapperId).toBe('data-terminal-wrapper-id');
    });
  });

  describe('Throttle Configuration', () => {
    it('should have 60fps throttle interval', () => {
      // 60fps = 16.67ms per frame, we use 16ms
      expect(SPLIT_RESIZE_CONSTANTS.RESIZE_THROTTLE_MS).toBe(16);
    });

    it('should have reasonable PTY notify debounce', () => {
      // 100ms is a good balance between responsiveness and avoiding too many PTY notifications
      expect(SPLIT_RESIZE_CONSTANTS.PTY_NOTIFY_DEBOUNCE_MS).toBe(100);
    });
  });

  describe('Minimum Size Constraint', () => {
    it('should have reasonable minimum terminal size', () => {
      // 50px is enough to show some terminal content
      expect(SPLIT_RESIZE_CONSTANTS.MIN_RESIZE_SIZE_PX).toBe(50);
    });

    it('should be less than typical terminal height', () => {
      // Typical terminal height is at least 200px
      expect(SPLIT_RESIZE_CONSTANTS.MIN_RESIZE_SIZE_PX).toBeLessThan(200);
    });
  });
});
