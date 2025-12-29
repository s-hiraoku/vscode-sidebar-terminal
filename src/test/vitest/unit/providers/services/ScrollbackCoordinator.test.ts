/**
 * ScrollbackCoordinator Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScrollbackCoordinator } from '../../../../../providers/services/ScrollbackCoordinator';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('ScrollbackCoordinator', () => {
  let coordinator: ScrollbackCoordinator;
  let mockSendMessage: any;

  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    coordinator = new ScrollbackCoordinator(mockSendMessage);
    vi.useFakeTimers();
  });

  afterEach(() => {
    coordinator.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('requestScrollbackData', () => {
    it('should send extraction message to WebView', async () => {
      const promise = coordinator.requestScrollbackData('term-1', 500);
      
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'extractScrollbackData',
        terminalId: 'term-1',
        maxLines: 500,
        requestId: expect.any(String)
      }));
      
      coordinator.clearPendingRequests();
      await promise;
    });

    it('should resolve with data when response is received', async () => {
      const promise = coordinator.requestScrollbackData('term-1');
      const requestId = mockSendMessage.mock.calls[0][0].requestId;
      
      coordinator.handleScrollbackDataResponse({
        command: 'scrollbackDataResponse',
        terminalId: 'term-1',
        scrollbackData: ['line1', 'line2'],
        requestId // using injected property
      } as any);
      
      const result = await promise;
      expect(result).toEqual(['line1', 'line2']);
    });

    it('should resolve with empty array on timeout', async () => {
      const promise = coordinator.requestScrollbackData('term-1');
      
      vi.advanceTimersByTime(10000);
      
      const result = await promise;
      expect(result).toEqual([]);
    });

    it('should resolve with empty array on error response', async () => {
      const promise = coordinator.requestScrollbackData('term-1');
      const requestId = mockSendMessage.mock.calls[0][0].requestId;
      
      coordinator.handleScrollbackDataResponse({
        command: 'scrollbackDataResponse',
        error: 'Failed to extract',
        requestId
      } as any);
      
      const result = await promise;
      expect(result).toEqual([]);
    });
  });

  describe('requestMultipleScrollbackData', () => {
    it('should collect data from multiple terminals in parallel', async () => {
      const promise = coordinator.requestMultipleScrollbackData(['t1', 't2']);
      
      // Simulate responses
      const req1 = mockSendMessage.mock.calls.find(c => c[0].terminalId === 't1')[0].requestId;
      const req2 = mockSendMessage.mock.calls.find(c => c[0].terminalId === 't2')[0].requestId;
      
      coordinator.handleScrollbackDataResponse({ requestId: req1, terminalId: 't1', scrollbackData: ['data1'] } as any);
      coordinator.handleScrollbackDataResponse({ requestId: req2, terminalId: 't2', scrollbackData: ['data2'] } as any);
      
      const result = await promise;
      expect(result).toEqual({
        't1': ['data1'],
        't2': ['data2']
      });
    });
  });

  describe('Maintenance', () => {
    it('should track pending requests count', () => {
      coordinator.requestScrollbackData('t1');
      coordinator.requestScrollbackData('t2');
      
      expect(coordinator.getPendingRequestsCount()).toBe(2);
    });

    it('should handle responses with missing requestId gracefully', () => {
      // Should not throw
      coordinator.handleScrollbackDataResponse({ command: 'test' } as any);
    });

    it('should handle responses for non-existent requests gracefully', () => {
      // Should not throw
      coordinator.handleScrollbackDataResponse({ requestId: 'unknown' } as any);
    });
  });
});
