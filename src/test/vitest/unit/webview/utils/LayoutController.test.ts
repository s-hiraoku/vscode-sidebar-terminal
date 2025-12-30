import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LayoutController } from '../../../../../webview/utils/LayoutController';

describe('LayoutController', () => {
  let controller: LayoutController;

  beforeEach(() => {
    controller = new LayoutController();
  });

  it('should initialize as disabled by default', () => {
    expect(controller.isLayoutEnabled).toBe(false);
  });

  it('should initialize with provided state', () => {
    const enabledController = new LayoutController(true);
    expect(enabledController.isLayoutEnabled).toBe(true);
  });

  it('should enable layout', () => {
    controller.enableLayout();
    expect(controller.isLayoutEnabled).toBe(true);
  });

  it('should disable layout', () => {
    controller.enableLayout();
    controller.disableLayout();
    expect(controller.isLayoutEnabled).toBe(false);
  });

  it('should reset to disabled', () => {
    controller.enableLayout();
    controller.reset();
    expect(controller.isLayoutEnabled).toBe(false);
  });

  describe('executeIfEnabled', () => {
    it('should execute callback if enabled', () => {
      controller.enableLayout();
      const callback = vi.fn().mockReturnValue('result');
      const result = controller.executeIfEnabled(callback);
      expect(callback).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should not execute callback if disabled', () => {
      const callback = vi.fn();
      const result = controller.executeIfEnabled(callback);
      expect(callback).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('withLayoutDisabled', () => {
    it('should disable layout during callback and restore it', () => {
      controller.enableLayout();
      expect(controller.isLayoutEnabled).toBe(true);

      const callback = vi.fn().mockImplementation(() => {
        expect(controller.isLayoutEnabled).toBe(false);
        return 'success';
      });

      const result = controller.withLayoutDisabled(callback);

      expect(callback).toHaveBeenCalled();
      expect(result).toBe('success');
      expect(controller.isLayoutEnabled).toBe(true);
    });

    it('should restore layout state even if callback throws', () => {
      controller.enableLayout();
      expect(controller.isLayoutEnabled).toBe(true);

      expect(() => {
        controller.withLayoutDisabled(() => {
          throw new Error('Test Error');
        });
      }).toThrow('Test Error');

      expect(controller.isLayoutEnabled).toBe(true);
    });

    it('should restore disabled state correctly', () => {
      // Start disabled
      expect(controller.isLayoutEnabled).toBe(false);

      controller.withLayoutDisabled(() => {
        expect(controller.isLayoutEnabled).toBe(false);
      });

      expect(controller.isLayoutEnabled).toBe(false);
    });
  });
});
