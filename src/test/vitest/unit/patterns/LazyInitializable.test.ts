import { describe, it, expect } from 'vitest';
import { LazyInitializable, InitializationState, InitializationError, withLazyInitialization } from '../../../../patterns/LazyInitializable';

// Concrete implementation for testing
class TestLazyInitializable extends LazyInitializable {
  public doInitializeCalled = 0;
  public mockInitLogic: () => void | Promise<void> = () => {};

  constructor() {
    super();
  }

  public async publicEnsureInitializedAsync() {
    return await this.ensureInitializedAsync();
  }

  public publicEnsureInitialized() {
    this.ensureInitialized();
  }

  public publicResetInitialization() {
    this.resetInitialization();
  }

  protected doInitialize(): void | Promise<void> {
    this.doInitializeCalled++;
    return this.mockInitLogic();
  }
}

describe('LazyInitializable', () => {
  let testObj: TestLazyInitializable;

  beforeEach(() => {
    testObj = new TestLazyInitializable();
  });

  it('should start in UNINITIALIZED state', () => {
    expect(testObj.initializationState).toBe(InitializationState.UNINITIALIZED);
    expect(testObj.isInitialized).toBe(false);
    expect(testObj.isInitializing).toBe(false);
  });

  describe('ensureInitialized (Sync)', () => {
    it('should initialize successfully', () => {
      testObj.mockInitLogic = () => {}; // Sync logic
      testObj.publicEnsureInitialized();
      expect(testObj.isInitialized).toBe(true);
      expect(testObj.doInitializeCalled).toBe(1);
    });

    it('should only initialize once', () => {
      testObj.mockInitLogic = () => {}; // Sync logic
      testObj.publicEnsureInitialized();
      testObj.publicEnsureInitialized();
      expect(testObj.doInitializeCalled).toBe(1);
    });

    it('should throw InitializationError if doInitialize throws', () => {
      testObj.mockInitLogic = () => {
        throw new Error('Sync fail');
      };
      expect(() => testObj.publicEnsureInitialized()).toThrow(InitializationError);
      expect(testObj.initializationState).toBe(InitializationState.FAILED);
    });
  });

  describe('ensureInitializedAsync', () => {
    it('should initialize successfully', async () => {
      testObj.mockInitLogic = async () => {}; // Async logic
      await testObj.publicEnsureInitializedAsync();
      expect(testObj.isInitialized).toBe(true);
      expect(testObj.doInitializeCalled).toBe(1);
    });

    it('should handle concurrent initialization calls', async () => {
      let resolveInit: () => void;
      const initPromise = new Promise<void>((resolve) => {
        resolveInit = resolve;
      });
      testObj.mockInitLogic = () => initPromise;

      const call1 = testObj.publicEnsureInitializedAsync();
      const call2 = testObj.publicEnsureInitializedAsync();

      expect(testObj.isInitializing).toBe(true);
      
      resolveInit!();
      await Promise.all([call1, call2]);

      expect(testObj.isInitialized).toBe(true);
      expect(testObj.doInitializeCalled).toBe(1);
    });

    it('should throw InitializationError if async initialization fails', async () => {
      testObj.mockInitLogic = async () => {
        throw new Error('Async fail');
      };
      await expect(testObj.publicEnsureInitializedAsync()).rejects.toThrow(InitializationError);
      expect(testObj.initializationState).toBe(InitializationState.FAILED);
    });
  });

  describe('resetInitialization', () => {
    it('should reset state to UNINITIALIZED', async () => {
      testObj.mockInitLogic = async () => {};
      await testObj.publicEnsureInitializedAsync();
      expect(testObj.isInitialized).toBe(true);

      testObj.publicResetInitialization();
      expect(testObj.initializationState).toBe(InitializationState.UNINITIALIZED);
      expect(testObj.isInitialized).toBe(false);

      await testObj.publicEnsureInitializedAsync();
      expect(testObj.doInitializeCalled).toBe(2);
    });
  });
});

describe('withLazyInitialization mixin', () => {
  class BaseClass {
    public baseProp = 'base';
  }

  class MixinTestClass extends withLazyInitialization(BaseClass) {
    public doInitCalled = 0;
    public mockLogic: () => void | Promise<void> = () => {};

    public doInitialize() {
      this.doInitCalled++;
      return this.mockLogic();
    }
    public async triggerInit() {
      await this.ensureInitializedAsync();
    }
    public triggerInitSync() {
      this.ensureInitialized();
    }
  }

  it('should preserve base class functionality', () => {
    const instance = new MixinTestClass();
    expect(instance.baseProp).toBe('base');
  });

  it('should initialize via ensureInitializedAsync', async () => {
    const instance = new MixinTestClass();
    instance.mockLogic = async () => {};
    await instance.triggerInit();
    expect(instance.isInitialized).toBe(true);
    expect(instance.doInitCalled).toBe(1);
  });

  it('should initialize via ensureInitialized', () => {
    const instance = new MixinTestClass();
    instance.mockLogic = () => {}; // Sync logic
    instance.triggerInitSync();
    expect(instance.isInitialized).toBe(true);
    expect(instance.doInitCalled).toBe(1);
  });
});