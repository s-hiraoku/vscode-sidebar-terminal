import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FocusTerminalHandler } from '../../../../../../services/webview/messageHandlers/FocusTerminalHandler';
import { IMessageHandlerContext } from '../../../../../../services/webview/interfaces';

// Mock dependencies
vi.mock('../../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('FocusTerminalHandler', () => {
  let handler: FocusTerminalHandler;
  let mockTerminalManager: any;
  let mockContext: IMessageHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockTerminalManager = {
      getActiveTerminalId: vi.fn(),
      setActiveTerminal: vi.fn(),
    };

    mockContext = {
      terminalManager: mockTerminalManager,
    } as any;

    handler = new FocusTerminalHandler([]);
  });

  it('should focus terminal when valid ID provided', async () => {
    const message = { command: 'focusTerminal', terminalId: 't1' };
    mockTerminalManager.getActiveTerminalId.mockReturnValueOnce('t0').mockReturnValueOnce('t1');

    await handler.handle(message, mockContext);

    expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('t1');
  });

  it('should ignore if no terminal ID provided', async () => {
    const message = { command: 'focusTerminal' };
    await handler.handle(message as any, mockContext);
    expect(mockTerminalManager.setActiveTerminal).not.toHaveBeenCalled();
  });
});
