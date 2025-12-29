/**
 * PersistenceMessageHandler Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersistenceMessageHandler } from '../../../../handlers/PersistenceMessageHandler';

// Mock dependencies
const { mockPersistenceService } = vi.hoisted(() => ({
  mockPersistenceService: {
    saveCurrentSession: vi.fn(),
    restoreSession: vi.fn(),
    cleanupExpiredSessions: vi.fn(),
  }
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  extension: vi.fn(),
}));

describe('PersistenceMessageHandler', () => {
  let handler: PersistenceMessageHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new PersistenceMessageHandler(mockPersistenceService as any);
  });

  describe('handleMessage', () => {
    it('should handle saveSession command', async () => {
      mockPersistenceService.saveCurrentSession.mockResolvedValue({
        success: true,
        terminalCount: 2
      });

      const response = await handler.handleMessage({ command: 'saveSession' });
      
      expect(response.success).toBe(true);
      expect(response.terminalCount).toBe(2);
      expect(mockPersistenceService.saveCurrentSession).toHaveBeenCalled();
    });

    it('should handle restoreSession command', async () => {
      mockPersistenceService.restoreSession.mockResolvedValue({
        success: true,
        terminalsRestored: 1,
        terminals: [{ id: 't1' }]
      });

      const response = await handler.handleMessage({ command: 'restoreSession' });
      
      expect(response.success).toBe(true);
      expect(response.terminalCount).toBe(1);
      expect(response.data).toHaveLength(1);
    });

    it('should handle clearSession command', async () => {
      mockPersistenceService.cleanupExpiredSessions.mockResolvedValue(undefined);

      const response = await handler.handleMessage({ command: 'clearSession' });
      
      expect(response.success).toBe(true);
      expect(mockPersistenceService.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should handle alternative command names (persistenceSaveSession, etc)', async () => {
      mockPersistenceService.saveCurrentSession.mockResolvedValue({ success: true });
      await handler.handleMessage({ command: 'persistenceSaveSession' });
      expect(mockPersistenceService.saveCurrentSession).toHaveBeenCalled();
    });

    it('should return error for unknown commands', async () => {
      const response = await handler.handleMessage({ command: 'unknown' as any });
      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown persistence command');
    });
  });

  describe('Error Handling', () => {
    it('should handle service failures gracefully', async () => {
      mockPersistenceService.saveCurrentSession.mockRejectedValue(new Error('Disk full'));
      
      const response = await handler.handleMessage({ command: 'saveSession' });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Disk full');
    });
  });

  describe('Response Helpers', () => {
    it('should create webview messages with timestamps', () => {
      const msg = handler.createWebViewMessage('test', { foo: 'bar' });
      expect(msg.command).toBe('persistenceTestResponse');
      expect(msg.data).toEqual({ foo: 'bar' });
      expect(msg.timestamp).toBeDefined();
    });

    it('should create error responses', () => {
      const msg = handler.createErrorResponse('fail', 'oops');
      expect(msg.success).toBe(false);
      expect(msg.data).toEqual({ error: 'oops' });
    });
  });
});