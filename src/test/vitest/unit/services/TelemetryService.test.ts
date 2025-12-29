import { describe, it, expect, vi } from 'vitest';

import { TelemetryService, TelemetryEventType } from '../../../../services/TelemetryService';

// Mock VS Code API
vi.mock('vscode', () => ({
  env: {
    createTelemetryLogger: vi.fn(),
  },
  Disposable: class {
    dispose = vi.fn();
    static from(..._args: any[]) { return { dispose: vi.fn() }; }
  },
}));

describe('TelemetryService', () => {
  let service: TelemetryService;
  let mockContext: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockLogger = {
      logUsage: vi.fn(),
      logError: vi.fn(),
      dispose: vi.fn(),
    };

    vi.mocked(vscode.env.createTelemetryLogger).mockReturnValue(mockLogger);

    mockContext = {
      subscriptions: [],
    };

    service = new TelemetryService(mockContext, 'test-extension', '1.0.0');
  });

  afterEach(() => {
    service.dispose();
  });

  it('should initialize and register logger', () => {
    expect(vscode.env.createTelemetryLogger).toHaveBeenCalled();
    expect(mockContext.subscriptions).toContain(mockLogger);
  });

  it('should track extension activation', () => {
    service.trackActivation(1234567890);
    expect(mockLogger.logUsage).toHaveBeenCalledWith(
      TelemetryEventType.ExtensionActivated,
      expect.objectContaining({
        extensionId: 'test-extension',
        version: '1.0.0',
        activationTime: 1234567890,
      })
    );
  });

  it('should track extension deactivation with duration', () => {
    const activationTime = Date.now() - 1000;
    service.trackActivation(activationTime);
    
    // Fast forward usually requires fake timers, but here we just check if it calculates something
    service.trackDeactivation();
    
    expect(mockLogger.logUsage).toHaveBeenCalledWith(
      TelemetryEventType.ExtensionDeactivated,
      expect.objectContaining({
        extensionId: 'test-extension',
        sessionDuration: expect.any(Number),
      })
    );
  });

  it('should track terminal created without sensitive info', () => {
    service.trackTerminalCreated('term-123', 'My Profile');
    
    expect(mockLogger.logUsage).toHaveBeenCalledWith(
      TelemetryEventType.TerminalCreated,
      {
        hasProfile: true,
      }
    );
    // Ensure no sensitive data
    expect(mockLogger.logUsage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ terminalId: 'term-123' })
    );
  });

  it('should track cli agent detection', () => {
    service.trackCliAgentDetected('claude');
    
    expect(mockLogger.logUsage).toHaveBeenCalledWith(
      TelemetryEventType.CliAgentDetected,
      {
        agentType: 'claude',
      }
    );
  });

  it('should track errors', () => {
    const error = new Error('Test Error');
    service.trackError(error, 'test-context');
    
    expect(mockLogger.logError).toHaveBeenCalledWith(
      TelemetryEventType.ErrorOccurred,
      expect.objectContaining({
        errorMessage: 'Test Error',
        context: 'test-context',
      })
    );
  });

  it('should measure sync operation performance', () => {
    const result = service.measure('test-op', () => {
      return 'success';
    });
    
    expect(result).toBe('success');
    expect(mockLogger.logUsage).toHaveBeenCalledWith(
      TelemetryEventType.PerformanceMetric,
      expect.objectContaining({
        operation: 'test-op',
        success: true,
        duration: expect.any(Number),
      })
    );
  });

  it('should measure async operation performance', async () => {
    const result = await service.measureAsync('test-async', async () => {
      return 'async-success';
    });
    
    expect(result).toBe('async-success');
    expect(mockLogger.logUsage).toHaveBeenCalledWith(
      TelemetryEventType.PerformanceMetric,
      expect.objectContaining({
        operation: 'test-async',
        success: true,
        duration: expect.any(Number),
      })
    );
  });

  it('should track failure in measurements', () => {
    expect(() => {
      service.measure('fail-op', () => {
        throw new Error('Fail');
      });
    }).toThrow('Fail');
    
    expect(mockLogger.logUsage).toHaveBeenCalledWith(
      TelemetryEventType.PerformanceMetric,
      expect.objectContaining({
        operation: 'fail-op',
        success: false,
      })
    );
  });
});
