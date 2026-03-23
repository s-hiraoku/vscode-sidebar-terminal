/**
 * PanelLocationHandler Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue('auto'),
    }),
    onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

import * as vscode from 'vscode';
import {
  PanelLocationHandler,
  IPanelLocationHandlerDependencies,
} from '../../../../../providers/handlers/PanelLocationHandler';
import { WebviewMessage } from '../../../../../types/common';

function createMockDeps(): IPanelLocationHandlerDependencies {
  return {
    panelLocationService: {
      handlePanelLocationReport: vi.fn().mockResolvedValue(undefined),
      requestPanelLocationDetection: vi.fn().mockResolvedValue(undefined),
      determineSplitDirection: vi.fn().mockReturnValue('vertical'),
      getCurrentPanelLocation: vi.fn().mockReturnValue('sidebar'),
      getCachedPanelLocation: vi.fn().mockReturnValue('sidebar'),
      initialize: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    } as any,
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PanelLocationHandler', () => {
  let handler: PanelLocationHandler;
  let deps: IPanelLocationHandlerDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    deps = createMockDeps();
    handler = new PanelLocationHandler(deps);

    // Default: auto mode
    (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn().mockReturnValue('auto'),
    });
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  describe('handleReportPanelLocation', () => {
    it('should ignore unsolicited panel location reports', async () => {
      const message = {
        command: 'reportPanelLocation',
        location: 'panel',
      } as unknown as WebviewMessage;

      await handler.handleReportPanelLocation(message);

      expect(deps.panelLocationService.handlePanelLocationReport).not.toHaveBeenCalled();
    });

    it('should accept solicited panel location reports', async () => {
      // First request detection to set pending state
      handler.requestPanelLocationDetection();

      const message = {
        command: 'reportPanelLocation',
        location: 'panel',
      } as unknown as WebviewMessage;

      await handler.handleReportPanelLocation(message);

      expect(deps.panelLocationService.handlePanelLocationReport).toHaveBeenCalledWith('panel');
    });

    it('should ignore reports with missing location', async () => {
      handler.requestPanelLocationDetection();

      const message = {
        command: 'reportPanelLocation',
      } as unknown as WebviewMessage;

      await handler.handleReportPanelLocation(message);

      expect(deps.panelLocationService.handlePanelLocationReport).not.toHaveBeenCalled();
    });

    it('should clear pending state after accepting report', async () => {
      handler.requestPanelLocationDetection();

      const message = {
        command: 'reportPanelLocation',
        location: 'sidebar',
      } as unknown as WebviewMessage;

      await handler.handleReportPanelLocation(message);

      expect(handler.isDetectionPending).toBe(false);
    });
  });

  describe('requestPanelLocationDetection', () => {
    it('should set pending state in auto mode', () => {
      handler.requestPanelLocationDetection();

      expect(handler.isDetectionPending).toBe(true);
      expect(deps.panelLocationService.requestPanelLocationDetection).toHaveBeenCalled();
    });

    it('should skip detection in manual mode', () => {
      (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
        get: vi.fn().mockReturnValue('sidebar'),
      });

      handler.requestPanelLocationDetection();

      expect(handler.isDetectionPending).toBe(false);
      expect(deps.panelLocationService.requestPanelLocationDetection).not.toHaveBeenCalled();
    });

    it('should auto-clear pending state on timeout', () => {
      handler.requestPanelLocationDetection();
      expect(handler.isDetectionPending).toBe(true);

      // Advance past the 2000ms timeout
      vi.advanceTimersByTime(2000);

      expect(handler.isDetectionPending).toBe(false);
    });

    it('should reset timeout on subsequent requests', () => {
      handler.requestPanelLocationDetection();
      vi.advanceTimersByTime(1500);
      expect(handler.isDetectionPending).toBe(true);

      // Request again, should reset the 2000ms timer
      handler.requestPanelLocationDetection();
      vi.advanceTimersByTime(1500);
      expect(handler.isDetectionPending).toBe(true);

      // Advance past the new timeout
      vi.advanceTimersByTime(500);
      expect(handler.isDetectionPending).toBe(false);
    });
  });

  describe('clearPanelLocationDetectionPending', () => {
    it('should clear pending flag and timeout', () => {
      handler.requestPanelLocationDetection();
      expect(handler.isDetectionPending).toBe(true);

      handler.clearPanelLocationDetectionPending('test');

      expect(handler.isDetectionPending).toBe(false);
    });

    it('should be a no-op when nothing is pending', () => {
      // Should not throw
      handler.clearPanelLocationDetectionPending('test');
      expect(handler.isDetectionPending).toBe(false);
    });
  });

  describe('handleWebviewVisible', () => {
    it('should request detection on first visibility', () => {
      handler.handleWebviewVisible();

      expect(handler.hasDetectedPanelLocation).toBe(true);

      // Detection is scheduled after 200ms delay
      vi.advanceTimersByTime(200);

      expect(handler.isDetectionPending).toBe(true);
      expect(deps.panelLocationService.requestPanelLocationDetection).toHaveBeenCalled();
    });

    it('should skip detection on subsequent visibility events', () => {
      handler.handleWebviewVisible();
      vi.advanceTimersByTime(200);

      vi.clearAllMocks();

      handler.handleWebviewVisible();
      vi.advanceTimersByTime(200);

      expect(deps.panelLocationService.requestPanelLocationDetection).not.toHaveBeenCalled();
    });

    it('should set flag before timeout to prevent race conditions', () => {
      handler.handleWebviewVisible();

      // Flag is set immediately, not after timeout
      expect(handler.hasDetectedPanelLocation).toBe(true);
    });
  });

  describe('setupPanelLocationChangeListener', () => {
    it('should register a configuration change listener', () => {
      handler.setupPanelLocationChangeListener();

      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });

    it('should return a disposable', () => {
      const disposable = handler.setupPanelLocationChangeListener();

      expect(disposable).toBeDefined();
      expect(typeof disposable.dispose).toBe('function');
    });
  });

  describe('resetDetectionState', () => {
    it('should reset hasDetectedPanelLocation flag', () => {
      handler.handleWebviewVisible();
      expect(handler.hasDetectedPanelLocation).toBe(true);

      handler.resetDetectionState();
      expect(handler.hasDetectedPanelLocation).toBe(false);
    });

    it('should clear pending detection state', () => {
      handler.requestPanelLocationDetection();
      expect(handler.isDetectionPending).toBe(true);

      handler.resetDetectionState();
      expect(handler.isDetectionPending).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should clear pending state on dispose', () => {
      handler.requestPanelLocationDetection();
      expect(handler.isDetectionPending).toBe(true);

      handler.dispose();

      expect(handler.isDetectionPending).toBe(false);
    });

    it('should dispose registered listeners', () => {
      const disposable = handler.setupPanelLocationChangeListener();
      const disposeFn = disposable.dispose;

      handler.dispose();

      expect(disposeFn).toHaveBeenCalled();
    });
  });
});
