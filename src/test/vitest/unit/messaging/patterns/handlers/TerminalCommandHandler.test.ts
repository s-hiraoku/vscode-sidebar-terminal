
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalCommandHandler } from '../../../../../../messaging/patterns/handlers/TerminalCommandHandler';
import { IMessageHandlerContext } from '../../../../../../messaging/patterns/core/IMessageHandler';

describe('TerminalCommandHandler', () => {
  let handler: TerminalCommandHandler;
  let mockCoordinator: any;
  let mockContext: IMessageHandlerContext;

  beforeEach(() => {
    handler = new TerminalCommandHandler();
    mockCoordinator = {
      initializeTerminal: vi.fn(),
      getTerminalInstance: vi.fn(),
      createTerminal: vi.fn(),
      setActiveTerminal: vi.fn(),
      removeTerminal: vi.fn(),
      getActiveTerminalId: vi.fn().mockReturnValue('active-term'),
    };
    mockContext = {
      coordinator: mockCoordinator,
      log: vi.fn(),
      postMessage: vi.fn(),
      metadata: {},
    };
  });

  it('should have the correct name and priority', () => {
    expect(handler.getName()).toBe('TerminalCommandHandler');
    expect(handler.getPriority()).toBe(75);
  });

  it('should support all specified terminal commands', () => {
    const commands = handler.getSupportedCommands();
    expect(commands).toContain('init');
    expect(commands).toContain('output');
    expect(commands).toContain('terminalCreated');
    expect(commands).toContain('clear');
  });

  it('should handle init command', async () => {
    const msg = { command: 'init' };
    await handler.handle(msg as any, mockContext);
    expect(mockCoordinator.initializeTerminal).toHaveBeenCalledWith(msg);
  });

  it('should handle output command', async () => {
    const mockTerminal = { write: vi.fn() };
    mockCoordinator.getTerminalInstance.mockReturnValue({ terminal: mockTerminal });
    
    const msg = { command: 'output', terminalId: 't1', data: 'hello' };
    await handler.handle(msg as any, mockContext);
    
    expect(mockCoordinator.getTerminalInstance).toHaveBeenCalledWith('t1');
    expect(mockTerminal.write).toHaveBeenCalledWith('hello');
  });

  it('should handle terminalCreated command', async () => {
    const msg = { command: 'terminalCreated', terminalId: 't1' };
    await handler.handle(msg as any, mockContext);
    expect(mockCoordinator.createTerminal).toHaveBeenCalledWith(msg);
  });

  it('should handle focusTerminal command', async () => {
    const msg = { command: 'focusTerminal', terminalId: 't1' };
    await handler.handle(msg as any, mockContext);
    expect(mockCoordinator.setActiveTerminal).toHaveBeenCalledWith('t1');
  });

  it('should handle terminalRemoved command', async () => {
    const msg = { command: 'terminalRemoved', terminalId: 't1' };
    await handler.handle(msg as any, mockContext);
    expect(mockCoordinator.removeTerminal).toHaveBeenCalledWith('t1');
  });

  it('should handle clear command', async () => {
    const mockTerminal = { clear: vi.fn() };
    mockCoordinator.getTerminalInstance.mockReturnValue({ terminal: mockTerminal });
    
    const msg = { command: 'clear', terminalId: 't1' };
    await handler.handle(msg as any, mockContext);
    
    expect(mockTerminal.clear).toHaveBeenCalled();
  });

  it('should handle clear command without ID (use active)', async () => {
    const mockTerminal = { clear: vi.fn() };
    mockCoordinator.getTerminalInstance.mockReturnValue({ terminal: mockTerminal });
    
    const msg = { command: 'clear' };
    await handler.handle(msg as any, mockContext);
    
    expect(mockCoordinator.getActiveTerminalId).toHaveBeenCalled();
    expect(mockCoordinator.getTerminalInstance).toHaveBeenCalledWith('active-term');
    expect(mockTerminal.clear).toHaveBeenCalled();
  });

  it('should throw error if coordinator is missing', async () => {
    mockContext.coordinator = undefined;
    await expect(handler.handle({ command: 'init' } as any, mockContext)).rejects.toThrow('Coordinator not available');
  });
});
