// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { SplitResizeManager } from '../../../../../webview/managers/SplitResizeManager';

describe('SplitResizeManager (DOM)', () => {
  it('should preserve combined flexGrow for the resized pair', () => {
    const manager = new SplitResizeManager({
      onResizeComplete: () => {},
      getSplitDirection: () => 'vertical',
    });

    const wrapperBefore = document.createElement('div');
    const wrapperAfter = document.createElement('div');

    wrapperBefore.style.flex = '1 1 0';
    wrapperAfter.style.flex = '1 1 0';

    (manager as any).dragState = {
      isActive: true,
      resizerElement: null,
      startPosition: 0,
      startSizes: { before: 300, after: 300 },
      wrapperBefore,
      wrapperAfter,
      direction: 'vertical',
      combinedFlexGrow: 2,
    };

    (manager as any).handlePointerMoveThrottled({ clientY: 60 } as PointerEvent);

    const beforeFlex = parseFloat(wrapperBefore.style.flex.split(' ')[0]);
    const afterFlex = parseFloat(wrapperAfter.style.flex.split(' ')[0]);

    expect(beforeFlex + afterFlex).toBeCloseTo(2);
  });
});
