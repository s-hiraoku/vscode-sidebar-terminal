
import { describe, it, expect, vi } from 'vitest';
import { DisposableBase, DisposableCallback, toDisposable } from '../../../../patterns/DisposableBase';

// Mock vscode
vi.mock('vscode', () => ({
  Disposable: class {
    static from(..._args: any[]) { return { dispose: vi.fn() }; }
    dispose() {}
  }
}));

// Concrete implementation for testing
class TestDisposable extends DisposableBase {
  public doDisposeCalled = 0;
  
  constructor() {
    super();
  }

  public publicRegisterDisposable<T extends { dispose(): void }>(disposable: T): T {
    return this.registerDisposable(disposable);
  }

  public publicRegisterDisposables(...disposables: { dispose(): void }[]): void {
    this.registerDisposables(...disposables);
  }

  public publicRegisterCleanup(cleanup: () => void): void {
    this.registerCleanup(cleanup);
  }

  public publicThrowIfDisposed(methodName?: string): void {
    this.throwIfDisposed(methodName);
  }

  public get publicDisposableCount(): number {
    return this.disposableCount;
  }

  public get publicCleanupActionCount(): number {
    return this.cleanupActionCount;
  }

  protected doDispose(): void {
    this.doDisposeCalled++;
  }
}

describe('DisposableBase', () => {
  let testObj: TestDisposable;

  beforeEach(() => {
    testObj = new TestDisposable();
  });

  it('should start not disposed', () => {
    expect(testObj.isDisposed()).toBe(false);
  });

  describe('registration', () => {
    it('should track registered disposables', () => {
      testObj.publicRegisterDisposable({ dispose: vi.fn() });
      expect(testObj.publicDisposableCount).toBe(1);
    });

    it('should track registered cleanup actions', () => {
      testObj.publicRegisterCleanup(() => {});
      expect(testObj.publicCleanupActionCount).toBe(1);
    });

    it('should dispose immediately if registered after disposal', () => {
      testObj.dispose();
      const disposable = { dispose: vi.fn() };
      testObj.publicRegisterDisposable(disposable);
      expect(disposable.dispose).toHaveBeenCalled();
    });

    it('should run cleanup immediately if registered after disposal', () => {
      testObj.dispose();
      const cleanup = vi.fn();
      testObj.publicRegisterCleanup(cleanup);
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose resources in LIFO order', () => {
      const order: string[] = [];
      const d1 = { dispose: () => order.push('d1') };
      const d2 = { dispose: () => order.push('d2') };
      
      testObj.publicRegisterDisposable(d1);
      testObj.publicRegisterDisposable(d2);
      
      testObj.dispose();
      
      expect(order).toEqual(['d2', 'd1']);
      expect(testObj.isDisposed()).toBe(true);
    });

    it('should run cleanup actions after disposables', () => {
      const order: string[] = [];
      const d1 = { dispose: () => order.push('disposable') };
      const c1 = () => order.push('cleanup');
      
      testObj.publicRegisterDisposable(d1);
      testObj.publicRegisterCleanup(c1);
      
      testObj.dispose();
      
      expect(order).toEqual(['disposable', 'cleanup']);
    });

    it('should call doDispose exactly once', () => {
      testObj.dispose();
      testObj.dispose();
      expect(testObj.doDisposeCalled).toBe(1);
    });

    it('should handle errors in disposables gracefully', () => {
      const d1 = { dispose: () => { throw new Error('fail'); } };
      const d2 = { dispose: vi.fn() };
      
      testObj.publicRegisterDisposable(d1);
      testObj.publicRegisterDisposable(d2);
      
      // Should not throw
      testObj.dispose();
      
      expect(d2.dispose).toHaveBeenCalled();
    });
  });

  describe('throwIfDisposed', () => {
    it('should throw if already disposed', () => {
      testObj.dispose();
      expect(() => testObj.publicThrowIfDisposed('testMethod')).toThrow('Cannot call testMethod on disposed TestDisposable');
    });

    it('should not throw if not disposed', () => {
      expect(() => testObj.publicThrowIfDisposed()).not.toThrow();
    });
  });
});

describe('DisposableCallback', () => {
  it('should call callback on dispose', () => {
    const cb = vi.fn();
    const d = new DisposableCallback(cb);
    d.dispose();
    expect(cb).toHaveBeenCalled();
    expect(d.isDisposed()).toBe(true);
  });

  it('should only call callback once', () => {
    const cb = vi.fn();
    const d = new DisposableCallback(cb);
    d.dispose();
    d.dispose();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('toDisposable', () => {
  it('should create a working disposable', () => {
    const cb = vi.fn();
    const d = toDisposable(cb);
    d.dispose();
    expect(cb).toHaveBeenCalled();
  });
});
