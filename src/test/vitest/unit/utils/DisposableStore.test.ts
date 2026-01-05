import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisposableStore, toDisposable, combineDisposables } from '../../../../utils/DisposableStore';

describe('DisposableStore', () => {
  let store: DisposableStore;

  beforeEach(() => {
    store = new DisposableStore();
  });

  describe('add', () => {
    it('should add disposable to the store', () => {
      const disposable = { dispose: vi.fn() };

      store.add(disposable);

      expect(store.size).toBe(1);
    });

    it('should return the added disposable for chaining', () => {
      const disposable = { dispose: vi.fn() };

      const result = store.add(disposable);

      expect(result).toBe(disposable);
    });

    it('should add multiple disposables', () => {
      const disposable1 = { dispose: vi.fn() };
      const disposable2 = { dispose: vi.fn() };
      const disposable3 = { dispose: vi.fn() };

      store.add(disposable1);
      store.add(disposable2);
      store.add(disposable3);

      expect(store.size).toBe(3);
    });

    it('should dispose immediately when adding to already disposed store', () => {
      const disposable = { dispose: vi.fn() };
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      store.dispose();
      store.add(disposable);

      expect(disposable.dispose).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DisposableStore] Attempting to add disposable to already disposed store'
      );

      consoleSpy.mockRestore();
    });

    it('should still return disposable even when store is disposed', () => {
      const disposable = { dispose: vi.fn() };
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      store.dispose();
      const result = store.add(disposable);

      expect(result).toBe(disposable);
    });
  });

  describe('remove', () => {
    it('should remove and dispose a specific disposable', () => {
      const disposable = { dispose: vi.fn() };

      store.add(disposable);
      store.remove(disposable);

      expect(store.size).toBe(0);
      expect(disposable.dispose).toHaveBeenCalled();
    });

    it('should not throw when removing non-existent disposable', () => {
      const disposable = { dispose: vi.fn() };

      expect(() => store.remove(disposable)).not.toThrow();
      expect(disposable.dispose).not.toHaveBeenCalled();
    });

    it('should only remove the specified disposable', () => {
      const disposable1 = { dispose: vi.fn() };
      const disposable2 = { dispose: vi.fn() };

      store.add(disposable1);
      store.add(disposable2);
      store.remove(disposable1);

      expect(store.size).toBe(1);
      expect(disposable1.dispose).toHaveBeenCalled();
      expect(disposable2.dispose).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should remove all disposables without disposing them', () => {
      const disposable1 = { dispose: vi.fn() };
      const disposable2 = { dispose: vi.fn() };

      store.add(disposable1);
      store.add(disposable2);
      store.clear();

      expect(store.size).toBe(0);
      expect(disposable1.dispose).not.toHaveBeenCalled();
      expect(disposable2.dispose).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose all disposables in LIFO order', () => {
      const disposeOrder: number[] = [];
      const disposable1 = { dispose: () => disposeOrder.push(1) };
      const disposable2 = { dispose: () => disposeOrder.push(2) };
      const disposable3 = { dispose: () => disposeOrder.push(3) };

      store.add(disposable1);
      store.add(disposable2);
      store.add(disposable3);
      store.dispose();

      expect(disposeOrder).toEqual([3, 2, 1]); // LIFO order
    });

    it('should set isDisposed to true', () => {
      expect(store.isDisposed).toBe(false);

      store.dispose();

      expect(store.isDisposed).toBe(true);
    });

    it('should clear the disposables array after dispose', () => {
      const disposable = { dispose: vi.fn() };

      store.add(disposable);
      store.dispose();

      expect(store.size).toBe(0);
    });

    it('should not throw when disposing twice', () => {
      store.dispose();

      expect(() => store.dispose()).not.toThrow();
    });

    it('should not dispose items again when called twice', () => {
      const disposable = { dispose: vi.fn() };

      store.add(disposable);
      store.dispose();
      store.dispose();

      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in disposable.dispose gracefully', () => {
      const errorDisposable = {
        dispose: () => {
          throw new Error('Dispose error');
        },
      };
      const normalDisposable = { dispose: vi.fn() };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      store.add(normalDisposable);
      store.add(errorDisposable);

      expect(() => store.dispose()).not.toThrow();
      expect(normalDisposable.dispose).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DisposableStore] Error disposing item:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle undefined disposables gracefully', () => {
      // @ts-expect-error - Testing edge case with null
      store['_disposables'].push(undefined);

      expect(() => store.dispose()).not.toThrow();
    });
  });

  describe('size', () => {
    it('should return 0 for empty store', () => {
      expect(store.size).toBe(0);
    });

    it('should return correct count after additions', () => {
      store.add({ dispose: vi.fn() });
      store.add({ dispose: vi.fn() });

      expect(store.size).toBe(2);
    });

    it('should return correct count after removals', () => {
      const disposable = { dispose: vi.fn() };
      store.add(disposable);
      store.add({ dispose: vi.fn() });
      store.remove(disposable);

      expect(store.size).toBe(1);
    });
  });

  describe('isDisposed', () => {
    it('should return false initially', () => {
      expect(store.isDisposed).toBe(false);
    });

    it('should return true after dispose', () => {
      store.dispose();

      expect(store.isDisposed).toBe(true);
    });
  });
});

describe('toDisposable', () => {
  it('should create a disposable from a cleanup function', () => {
    const cleanup = vi.fn();

    const disposable = toDisposable(cleanup);

    expect(disposable).toHaveProperty('dispose');
  });

  it('should call cleanup function when disposed', () => {
    const cleanup = vi.fn();

    const disposable = toDisposable(cleanup);
    disposable.dispose();

    expect(cleanup).toHaveBeenCalled();
  });

  it('should allow multiple dispose calls', () => {
    const cleanup = vi.fn();

    const disposable = toDisposable(cleanup);
    disposable.dispose();
    disposable.dispose();

    expect(cleanup).toHaveBeenCalledTimes(2);
  });
});

describe('combineDisposables', () => {
  it('should combine multiple disposables into one', () => {
    const disposable1 = { dispose: vi.fn() };
    const disposable2 = { dispose: vi.fn() };
    const disposable3 = { dispose: vi.fn() };

    const combined = combineDisposables(disposable1, disposable2, disposable3);
    combined.dispose();

    expect(disposable1.dispose).toHaveBeenCalled();
    expect(disposable2.dispose).toHaveBeenCalled();
    expect(disposable3.dispose).toHaveBeenCalled();
  });

  it('should handle empty array', () => {
    const combined = combineDisposables();

    expect(() => combined.dispose()).not.toThrow();
  });

  it('should handle null/undefined disposables gracefully', () => {
    const disposable1 = { dispose: vi.fn() };
    // @ts-expect-error - Testing edge case
    const combined = combineDisposables(disposable1, null, undefined);

    expect(() => combined.dispose()).not.toThrow();
    expect(disposable1.dispose).toHaveBeenCalled();
  });

  it('should handle errors in individual disposables', () => {
    const errorDisposable = {
      dispose: () => {
        throw new Error('Dispose error');
      },
    };
    const normalDisposable = { dispose: vi.fn() };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const combined = combineDisposables(normalDisposable, errorDisposable);

    expect(() => combined.dispose()).not.toThrow();
    expect(normalDisposable.dispose).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[combineDisposables] Error disposing item:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
