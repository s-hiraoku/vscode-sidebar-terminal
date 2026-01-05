import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecondaryTerminalMessageRouter } from '../../../../providers/SecondaryTerminalMessageRouter';

describe('SecondaryTerminalMessageRouter', () => {
  let router: SecondaryTerminalMessageRouter;

  beforeEach(() => {
    router = new SecondaryTerminalMessageRouter();
  });

  it('should register and dispatch messages', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    router.register('testCommand', handler);
    
    expect(router.has('testCommand')).toBe(true);
    
    const result = await router.dispatch({ command: 'testCommand' } as any);
    
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalled();
  });

  it('should return false for unknown commands', async () => {
    const result = await router.dispatch({ command: 'unknown' } as any);
    expect(result).toBe(false);
  });

  it('should handle undefined commands during registration', () => {
    router.register(undefined, vi.fn());
    expect(router.getRegisteredCommands().length).toBe(0);
  });

  it('should clear handlers', () => {
    router.register('c1', vi.fn());
    router.clear();
    expect(router.has('c1')).toBe(false);
  });

  it('should reset handlers', () => {
    router.register('c1', vi.fn());
    router.reset();
    expect(router.has('c1')).toBe(false);
  });
});
