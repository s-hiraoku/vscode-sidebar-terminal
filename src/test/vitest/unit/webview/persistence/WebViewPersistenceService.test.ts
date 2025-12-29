
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { WebViewPersistenceService } from '../../../../../webview/persistence/WebViewPersistenceService';

describe('WebViewPersistenceService', () => {
  let dom: JSDOM;
  let service: WebViewPersistenceService;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost'
    });
    
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('localStorage', dom.window.localStorage);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);

    // Clear localStorage before each test
    localStorage.clear();
    service = new WebViewPersistenceService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dom.window.close();
    vi.unstubAllGlobals();
  });

  describe('saveSession', () => {
    it('should save session data to localStorage', async () => {
      const response = await service.saveSession({ requestId: 'req-1' });
      
      expect(response.success).toBe(true);
      expect(localStorage.getItem('secondaryTerminal.webview.session')).not.toBeNull();
    });

    it('should return failure if data exceeds max size', async () => {
      // Mock collectLocalSessionData to return huge data
      const hugeData = {
        version: '2.0.0',
        timestamp: Date.now(),
        terminals: new Array(1000).fill({ id: 't', name: 'x'.repeat(10000) })
      };
      
      // @ts-ignore - mocking private method
      vi.spyOn(service, 'collectLocalSessionData').mockResolvedValue(hugeData);

      const response = await service.saveSession({ requestId: 'req-2' });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Failed to store');
    });
  });

  describe('restoreSession', () => {
    it('should return session data from localStorage', async () => {
      const testData = {
        version: '2.0.0',
        timestamp: Date.now(),
        terminals: [{ id: 'term-1', name: 'Terminal 1' }]
      };
      localStorage.setItem('secondaryTerminal.webview.session', JSON.stringify(testData));

      const response = await service.restoreSession({ requestId: 'req-3' });
      
      expect(response.success).toBe(true);
      expect(response.restoredTerminals).toBe(1);
    });

    it('should return failure if no data found', async () => {
      const response = await service.restoreSession({ requestId: 'req-4' });
      
      expect(response.success).toBe(false);
      expect(response.errors).toContain('No local session data found');
    });
  });

  describe('clearSession', () => {
    it('should remove session data from localStorage', async () => {
      localStorage.setItem('secondaryTerminal.webview.session', 'some-data');
      
      const response = await service.clearSession({ requestId: 'req-5' });
      
      expect(response.success).toBe(true);
      expect(localStorage.getItem('secondaryTerminal.webview.session')).toBeNull();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clear sessions older than 1 day', async () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const oldData = {
        version: '2.0.0',
        timestamp: oldTimestamp,
        terminals: []
      };
      localStorage.setItem('secondaryTerminal.webview.session', JSON.stringify(oldData));

      await service.cleanupExpiredSessions();
      
      expect(localStorage.getItem('secondaryTerminal.webview.session')).toBeNull();
    });

    it('should not clear recent sessions', async () => {
      const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      const recentData = {
        version: '2.0.0',
        timestamp: recentTimestamp,
        terminals: []
      };
      localStorage.setItem('secondaryTerminal.webview.session', JSON.stringify(recentData));

      await service.cleanupExpiredSessions();
      
      expect(localStorage.getItem('secondaryTerminal.webview.session')).not.toBeNull();
    });
  });
});
