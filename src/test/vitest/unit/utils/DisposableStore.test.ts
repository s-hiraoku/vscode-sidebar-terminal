import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisposableStore, toDisposable, combineDisposables } from '../../../../utils/DisposableStore';

describe('DisposableStore', () => {
  let store: DisposableStore;

  beforeEach(() => {
    store = new DisposableStore();
  });

  it('should add and dispose items', () => {
    const d1 = { dispose: vi.fn() };
    const d2 = { dispose: vi.fn() };

    store.add(d1);
    store.add(d2);

    expect(store.size).toBe(2);

    store.dispose();

    expect(d1.dispose).toHaveBeenCalled();
    expect(d2.dispose).toHaveBeenCalled();
    expect(store.size).toBe(0);
    expect(store.isDisposed).toBe(true);
  });

  it('should remove items', () => {
    const d1 = { dispose: vi.fn() };
    store.add(d1);
    
    store.remove(d1);
    
    expect(store.size).toBe(0);
    expect(d1.dispose).toHaveBeenCalled();
  });

  it('should clear without disposing', () => {
    const d1 = { dispose: vi.fn() };
    store.add(d1);
    
    store.clear();
    
    expect(store.size).toBe(0);
    expect(d1.dispose).not.toHaveBeenCalled();
  });

  it('should dispose immediately if store is already disposed', () => {
    store.dispose();
    
    const d1 = { dispose: vi.fn() };
    store.add(d1);
    
    expect(d1.dispose).toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it('should handle disposal errors gracefully', () => {
    const d1 = { dispose: vi.fn().mockImplementation(() => { throw new Error('Fail'); }) };
    const d2 = { dispose: vi.fn() };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    store.add(d1);
    store.add(d2);
    
    store.dispose();
    
    expect(d1.dispose).toHaveBeenCalled();
    expect(d2.dispose).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('toDisposable', () => {
  it('should create a disposable from function', () => {
    const fn = vi.fn();
    const d = toDisposable(fn);
    
    d.dispose();
    expect(fn).toHaveBeenCalled();
  });
});

describe('combineDisposables', () => {
  it('should combine multiple disposables', () => {
    const d1 = { dispose: vi.fn() };
    const d2 = { dispose: vi.fn() };
    
    const combined = combineDisposables(d1, d2);
    combined.dispose();
    
    expect(d1.dispose).toHaveBeenCalled();
    expect(d2.dispose).toHaveBeenCalled();
  });
});
