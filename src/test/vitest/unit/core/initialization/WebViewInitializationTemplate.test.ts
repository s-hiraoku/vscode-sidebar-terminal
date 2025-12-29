import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebViewInitializationTemplate } from '../../../../../core/initialization/WebViewInitializationTemplate';

// Mock concrete implementation
class TestInitializationTemplate extends WebViewInitializationTemplate {
  public setupViewReferenceCalled = false;
  public registerMessageHandlersCalled = false;
  public initializeContentCalled = false;
  public instantiateManagersCalled = false;
  public postInitializationSetupCalled = false;

  protected async setupViewReference(): Promise<void> {
    this.setupViewReferenceCalled = true;
  }

  protected async registerMessageHandlers(): Promise<void> {
    this.registerMessageHandlersCalled = true;
  }

  protected async initializeContent(): Promise<void> {
    this.initializeContentCalled = true;
  }

  protected override async instantiateManagers(): Promise<void> {
    this.instantiateManagersCalled = true;
  }

  protected override async postInitializationSetup(): Promise<void> {
    this.postInitializationSetupCalled = true;
  }
}

describe('WebViewInitializationTemplate', () => {
  let template: TestInitializationTemplate;

  beforeEach(() => {
    vi.resetAllMocks();
    template = new TestInitializationTemplate();
  });

  it('should execute all phases in order', async () => {
    await template.initialize();

    expect(template.isInitialized()).toBe(true);
    expect(template.setupViewReferenceCalled).toBe(true);
    expect(template.instantiateManagersCalled).toBe(true);
    expect(template.registerMessageHandlersCalled).toBe(true);
    expect(template.initializeContentCalled).toBe(true);
    expect(template.postInitializationSetupCalled).toBe(true);
  });

  it('should prevent duplicate initialization by default', async () => {
    await template.initialize();
    
    // Reset flags
    template.setupViewReferenceCalled = false;
    
    await template.initialize();
    
    expect(template.setupViewReferenceCalled).toBe(false);
  });

  it('should allow duplicate initialization if context permits', async () => {
    await template.initialize();
    
    template.setupViewReferenceCalled = false;
    
    await template.initialize({ skipDuplicates: false });
    
    expect(template.setupViewReferenceCalled).toBe(true);
  });

  it('should track metrics for each phase', async () => {
    await template.initialize();
    
    const metrics = template.getInitializationMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.find(m => m.phase === 'Core Setup')).toBeDefined();
    expect(metrics.every(m => m.success === true)).toBe(true);
  });

  it('should handle errors and track failure metrics', async () => {
    const errorTemplate = new class extends TestInitializationTemplate {
      protected override async initializeContent(): Promise<void> {
        throw new Error('Content failure');
      }
      protected override handleInitializationError(_error: unknown): void {
        // Recovery: don't re-throw
      }
    };

    // Should not throw because we overridden handleInitializationError to recover
    await errorTemplate.initialize();
    
    expect(errorTemplate.isInitialized()).toBe(false);
    const metrics = errorTemplate.getInitializationMetrics();
    const contentMetric = metrics.find(m => m.phase === 'Content Initialization');
    expect(contentMetric?.success).toBe(false);
    expect(String(contentMetric?.error)).toContain('Content failure');
  });

  it('should throw error if errorRecovery is false', async () => {
    const errorTemplate = new class extends TestInitializationTemplate {
      protected override async initializeContent(): Promise<void> {
        throw new Error('Content failure');
      }
    };

    await expect(errorTemplate.initialize({ errorRecovery: false })).rejects.toThrow('Content failure');
  });
});
