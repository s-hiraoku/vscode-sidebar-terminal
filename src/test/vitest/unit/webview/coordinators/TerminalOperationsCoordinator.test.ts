/**
 * TerminalOperationsCoordinator Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TerminalOperationsCoordinator } from '../../../../../webview/coordinators/TerminalOperationsCoordinator';

// Mock logger
vi.mock('../../../../../webview/utils/logger', () => ({
  webview: vi.fn(),
}));

describe('TerminalOperationsCoordinator', () => {
  let coordinator: TerminalOperationsCoordinator;
  let mockDeps: any;

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockDeps = {
      getActiveTerminalId: vi.fn().mockReturnValue('t1'),
      setActiveTerminalId: vi.fn(),
      getTerminalInstance: vi.fn(),
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
      getTerminalStats: vi.fn().mockReturnValue({ totalTerminals: 1, activeTerminalId: 't1', terminalIds: ['t1'] }),
      postMessageToExtension: vi.fn(),
      showWarning: vi.fn(),
      createTerminalInstance: vi.fn().mockResolvedValue({}),
      removeTerminalInstance: vi.fn().mockResolvedValue(true),
      getTerminalCount: vi.fn().mockReturnValue(1),
      ensureSplitModeBeforeCreation: vi.fn().mockResolvedValue(undefined),
      refreshSplitLayout: vi.fn(),
      prepareDisplayForDeletion: vi.fn(),
      updateTerminalBorders: vi.fn(),
      focusTerminal: vi.fn(),
      addTab: vi.fn(),
      setActiveTab: vi.fn(),
      removeTab: vi.fn(),
      saveSession: vi.fn().mockResolvedValue(true),
      removeCliAgentState: vi.fn(),
    };

    coordinator = new TerminalOperationsCoordinator(mockDeps);
  });

  afterEach(() => {
    coordinator.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('createTerminal', () => {
    it('should create terminal successfully', async () => {
      mockDeps.canCreateTerminal = () => true;
      mockDeps.getTerminalCount.mockReturnValue(0);
      
      const result = await coordinator.createTerminal('t-new', 'New Terminal');
      
      expect(result).toBeTruthy();
      expect(mockDeps.createTerminalInstance).toHaveBeenCalled();
      expect(mockDeps.addTab).toHaveBeenCalled();
    });

    it('should prevent duplicate creations', async () => {
      coordinator.markTerminalCreationPending('t1');
      await coordinator.createTerminal('t1', 'Duplicate');
      
      expect(mockDeps.createTerminalInstance).not.toHaveBeenCalled();
    });

    it('should block creation if limit reached', async () => {
      mockDeps.getTerminalCount.mockReturnValue(5);
      
      const result = await coordinator.createTerminal('t-limit', 'Limit Test');
      
      expect(result).toBeNull();
      expect(mockDeps.showWarning).toHaveBeenCalled();
    });
  });

  describe('deleteTerminalSafely', () => {
    it('should prevent deleting last terminal', async () => {
      mockDeps.getTerminalStats.mockReturnValue({ totalTerminals: 1 });
      mockDeps.getTerminalInstance.mockReturnValue({ terminal: {} });
      
      const result = await coordinator.deleteTerminalSafely('t1');
      
      expect(result).toBe(false);
      expect(mockDeps.showWarning).toHaveBeenCalled();
    });

    it('should send delete request to extension', async () => {
      mockDeps.getTerminalStats.mockReturnValue({ totalTerminals: 2 });
      mockDeps.getTerminalInstance.mockReturnValue({});
      
      const result = await coordinator.deleteTerminalSafely('t1');
      
      expect(result).toBe(true);
      expect(mockDeps.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'deleteTerminal',
        terminalId: 't1'
      }));
    });
  });

  describe('Queueing', () => {
    it('should queue and process creation requests', async () => {
      coordinator.queueTerminalCreation('Queued');
      expect(coordinator.getPendingCreationsCount()).toBe(1);
      
      // Assume limit reached, then state update clears it
      coordinator.processPendingCreationRequests();
      
      expect(mockDeps.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'createTerminal',
        terminalName: 'Queued'
      }));
    });
  });

  describe('Disposal', () => {
    it('should clear all state', () => {
      coordinator.markTerminalCreationPending('t1');
      coordinator.dispose();
      expect(coordinator.isTerminalCreationPending('t1')).toBe(false);
    });
  });
});
