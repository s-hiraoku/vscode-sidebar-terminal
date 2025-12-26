
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersistenceMessageHandler } from '../../../../handlers/PersistenceMessageHandler';

describe('PersistenceMessageHandler', () => {
  let mockPersistenceService: any;
  let handler: PersistenceMessageHandler;

  beforeEach(() => {
    mockPersistenceService = {
      saveCurrentSession: vi.fn().mockResolvedValue({ success: true, terminalCount: 1 }),
      restoreSession: vi.fn().mockResolvedValue({ success: true, terminalsRestored: 1 }),
      cleanupExpiredSessions: vi.fn().mockResolvedValue(undefined),
    };
    handler = new PersistenceMessageHandler(mockPersistenceService);
  });

  describe('handleMessage', () => {
    it('should handle saveSession command', async () => {
      const result = await handler.handleMessage({ command: 'saveSession', data: { preferCache: true } });
      expect(result.success).toBe(true);
      expect(mockPersistenceService.saveCurrentSession).toHaveBeenCalledWith({ preferCache: true });
    });

    it('should handle persistenceSaveSession command', async () => {
      const result = await handler.handleMessage({ command: 'persistenceSaveSession', data: { preferCache: false } });
      expect(result.success).toBe(true);
      expect(mockPersistenceService.saveCurrentSession).toHaveBeenCalledWith({ preferCache: false });
    });

    it('should handle restoreSession command', async () => {
      const result = await handler.handleMessage({ command: 'restoreSession' });
      expect(result.success).toBe(true);
      expect(mockPersistenceService.restoreSession).toHaveBeenCalled();
    });

    it('should handle persistenceRestoreSession command', async () => {
      const result = await handler.handleMessage({ command: 'persistenceRestoreSession' });
      expect(result.success).toBe(true);
      expect(mockPersistenceService.restoreSession).toHaveBeenCalled();
    });

    it('should handle clearSession command', async () => {
      const result = await handler.handleMessage({ command: 'clearSession' });
      expect(result.success).toBe(true);
      expect(mockPersistenceService.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should handle persistenceClearSession command', async () => {
      const result = await handler.handleMessage({ command: 'persistenceClearSession' });
      expect(result.success).toBe(true);
      expect(mockPersistenceService.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should handle unknown command', async () => {
      const result = await handler.handleMessage({ command: 'unknown' } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown persistence command');
    });

    it('should handle service errors gracefully (save)', async () => {
      mockPersistenceService.saveCurrentSession.mockRejectedValue(new Error('Save failed'));
      const result = await handler.handleMessage({ command: 'saveSession' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Save failed');
    });

    it('should handle service failure response (save)', async () => {
      mockPersistenceService.saveCurrentSession.mockResolvedValue({ success: false, error: 'Logic error' });
      const result = await handler.handleMessage({ command: 'saveSession' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Logic error');
    });

    it('should handle service errors gracefully (restore)', async () => {
      mockPersistenceService.restoreSession.mockRejectedValue(new Error('Restore failed'));
      const result = await handler.handleMessage({ command: 'restoreSession' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Restore failed');
    });

    it('should handle no session found (restore)', async () => {
        mockPersistenceService.restoreSession.mockResolvedValue({ success: true, terminalsRestored: 0 });
        const result = await handler.handleMessage({ command: 'restoreSession' });
        expect(result.success).toBe(true); // Technically handled as success false in response logic for no session
        // Wait, checking logic:
        // if (!result.success || result.terminalsRestored === 0) return { success: true, terminalCount: 0 ... }
        // Ah, it returns success: true even if 0 restored? Let's check the code.
        // Yes: return { success: true, terminalCount: 0, ... }
        expect(result.terminalCount).toBe(0);
        expect(result.error).toContain('No session found');
    });
  });

  describe('Compatibility Methods', () => {
    it('should have registerMessageHandlers method', () => {
      expect(() => handler.registerMessageHandlers()).not.toThrow();
    });

    it('should have handlePersistenceMessage alias', async () => {
      const result = await handler.handlePersistenceMessage({ command: 'saveSession' });
      expect(result.success).toBe(true);
    });

    it('should create webview messages correctly', () => {
      const msg = handler.createWebViewMessage('test', { foo: 'bar' });
      expect(msg.command).toBe('persistenceTestResponse');
      expect(msg.success).toBe(true);
      expect(msg.data).toEqual({ foo: 'bar' });
    });

    it('should create error responses', () => {
      const msg = handler.createErrorResponse('test', 'error message');
      expect(msg.command).toBe('persistenceTestResponse');
      expect(msg.success).toBe(false);
      expect((msg.data as any).error).toBe('error message');
    });

    it('should create success responses', () => {
      const msg = handler.createSuccessResponse('test', { ok: true });
      expect(msg.command).toBe('persistenceTestResponse');
      expect(msg.success).toBe(true);
    });
  });
});
