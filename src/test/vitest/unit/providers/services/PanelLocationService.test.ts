/**
 * PanelLocationService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { PanelLocationService, isPanelLocation } from '../../../../../providers/services/PanelLocationService';

// Mock VS Code API
vi.mock('vscode', () => ({
  commands: {
    executeCommand: vi.fn().mockResolvedValue(undefined),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key, def) => def),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('PanelLocationService', () => {
  let service: PanelLocationService;
  let mockSendMessage: any;

  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    service = new PanelLocationService(mockSendMessage);
    vi.useFakeTimers();
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('isPanelLocation', () => {
    it('should validate panel locations correctly', () => {
      expect(isPanelLocation('sidebar')).toBe(true);
      expect(isPanelLocation('panel')).toBe(true);
      expect(isPanelLocation('top')).toBe(false);
      expect(isPanelLocation(null)).toBe(false);
      expect(isPanelLocation(undefined)).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should setup configuration listener', async () => {
      await service.initialize();
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });
  });

  describe('handlePanelLocationReport', () => {
    it('should update cached location and set context', async () => {
      await service.handlePanelLocationReport('panel');
      
      expect(service.getCachedPanelLocation()).toBe('panel');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'panel'
      );
    });

    it('should trigger callback when location changes', async () => {
      const onChange = vi.fn();
      // Default is 'sidebar'
      await service.handlePanelLocationReport('panel', onChange);
      
      expect(onChange).toHaveBeenCalledWith('sidebar', 'panel');
    });

    it('should ignore invalid locations', async () => {
      await service.handlePanelLocationReport('invalid');
      expect(service.getCachedPanelLocation()).toBe('sidebar');
    });
  });

  describe('requestPanelLocationDetection', () => {
    it('should send request message to WebView after debounce', async () => {
      service.requestPanelLocationDetection();
      
      expect(mockSendMessage).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(300);
      
      expect(mockSendMessage).toHaveBeenCalledWith({
        command: 'requestPanelLocationDetection'
      });
    });

    it('should handle errors when sending request', async () => {
      mockSendMessage.mockRejectedValue(new Error('Fail'));
      
      service.requestPanelLocationDetection();
      vi.advanceTimersByTime(300);
      
      // Wait for async execution inside setTimeout
      await vi.runAllTimersAsync();
      
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        expect.anything(),
        'sidebar'
      );
    });
  });

  describe('determineSplitDirection', () => {
    it('should return vertical for sidebar', () => {
      // Default is sidebar
      expect(service.determineSplitDirection()).toBe('vertical');
    });

    it('should return horizontal for panel', async () => {
      await service.handlePanelLocationReport('panel');
      expect(service.determineSplitDirection()).toBe('horizontal');
    });
  });

  describe('handlePanelLocationReport - skip redundant setContext', () => {
    it('should skip setContext when location is unchanged', async () => {
      // Arrange: Report 'panel' first (changes from default 'sidebar')
      await service.handlePanelLocationReport('panel');
      vi.mocked(vscode.commands.executeCommand).mockClear();

      // Act: Report same location again
      await service.handlePanelLocationReport('panel');

      // Assert: setContext should NOT be called for unchanged location
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should call setContext when location changes', async () => {
      // Arrange: Report 'panel' first
      await service.handlePanelLocationReport('panel');
      vi.mocked(vscode.commands.executeCommand).mockClear();

      // Act: Report different location
      await service.handlePanelLocationReport('sidebar');

      // Assert: setContext should be called for changed location
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });

    it('should not trigger onLocationChange callback when location unchanged', async () => {
      const onChange = vi.fn();

      // Arrange: Set location to 'panel'
      await service.handlePanelLocationReport('panel');

      // Act: Report same location with callback
      await service.handlePanelLocationReport('panel', onChange);

      // Assert: Callback should not be called
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should skip setContext when first report matches default location', async () => {
      // The default cached location is 'sidebar'
      // Reporting the same value should not trigger setContext

      // Act: Report 'sidebar' (same as default)
      await service.handlePanelLocationReport('sidebar');

      // Assert: setContext should NOT be called because location hasn't changed
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });
  });

  describe('getCurrentPanelLocation', () => {
    it('should return sidebar if dynamic split is disabled', () => {
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'dynamicSplitDirection') return false;
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });
      
      expect(service.getCurrentPanelLocation()).toBe('sidebar');
    });

    it('should return manual location if set', () => {
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'dynamicSplitDirection') return true;
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });
      
      expect(service.getCurrentPanelLocation()).toBe('panel');
    });
  });
});
