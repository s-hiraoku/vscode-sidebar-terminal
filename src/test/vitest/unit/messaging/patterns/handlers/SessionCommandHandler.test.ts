
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionCommandHandler } from '../../../../../../messaging/patterns/handlers/SessionCommandHandler';
import { IMessageHandlerContext } from '../../../../../../messaging/patterns/core/IMessageHandler';

describe('SessionCommandHandler', () => {
  let handler: SessionCommandHandler;
  let mockCoordinator: any;
  let mockContext: IMessageHandlerContext;

  beforeEach(() => {
    handler = new SessionCommandHandler();
    mockCoordinator = {
      restoreSession: vi.fn().mockResolvedValue(undefined),
    };
    mockContext = {
      coordinator: mockCoordinator,
      log: vi.fn(),
      postMessage: vi.fn(),
      metadata: {},
    };
  });

  it('should have the correct name and priority', () => {
    expect(handler.getName()).toBe('SessionCommandHandler');
    expect(handler.getPriority()).toBe(60);
  });

  it('should handle sessionRestore command', async () => {
    const terminals = [{ id: 't1' }];
    const msg = { command: 'sessionRestore', terminals, activeTerminalId: 't1' };
    await handler.handle(msg as any, mockContext);
    
    expect(mockCoordinator.restoreSession).toHaveBeenCalledWith({
      terminals,
      activeTerminalId: 't1',
      config: undefined
    });
  });

  it('should handle sessionRestoreStarted command', async () => {
    await handler.handle({ command: 'sessionRestoreStarted' } as any, mockContext);
    expect(mockContext.log).toHaveBeenCalledWith('info', expect.stringContaining('Session restore started'));
  });

  it('should handle sessionRestoreProgress command', async () => {
    await handler.handle({ command: 'sessionRestoreProgress', progress: 1, total: 2 } as any, mockContext);
    // BaseCommandHandler.log calls ctx.log(level, msg, ...args)
    // When no args are passed to this.log, args is an empty array in this.log(level, msg, ...args)
    // but context.log receives it as spread.
    expect(mockContext.log).toHaveBeenCalledWith('debug', expect.stringContaining('1/2'));
  });

  it('should handle sessionRestoreCompleted command', async () => {
    await handler.handle({ command: 'sessionRestoreCompleted', restoredCount: 5 } as any, mockContext);
    expect(mockContext.log).toHaveBeenCalledWith('info', expect.stringContaining('5 terminals restored'));
  });

  it('should handle sessionRestoreError command', async () => {
    await handler.handle({ command: 'sessionRestoreError', error: 'fail' } as any, mockContext);
    expect(mockContext.log).toHaveBeenCalledWith('error', expect.stringContaining('Session restore failed'), 'fail');
  });

  it('should handle sessionSaved command', async () => {
    await handler.handle({ command: 'sessionSaved', terminalCount: 3 } as any, mockContext);
    expect(mockContext.log).toHaveBeenCalledWith('info', expect.stringContaining('Session saved: 3 terminals'));
  });

  it('should handle sessionCleared command', async () => {
    await handler.handle({ command: 'sessionCleared' } as any, mockContext);
    expect(mockContext.log).toHaveBeenCalledWith('info', expect.stringContaining('Session cleared'));
  });

  it('should handle terminalRestoreError command', async () => {
    await handler.handle({ command: 'terminalRestoreError', terminalId: 't1', error: 'dead' } as any, mockContext);
    expect(mockContext.log).toHaveBeenCalledWith('error', expect.stringContaining('Terminal restore error for t1'), 'dead');
  });

  it('should continue if terminals missing in sessionRestore (validateRequired is guard only)', async () => {
    await handler.handle({ command: 'sessionRestore' } as any, mockContext);
    expect(mockCoordinator.restoreSession).toHaveBeenCalled();
  });
});
