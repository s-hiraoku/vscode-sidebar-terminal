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
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      await service.handlePanelLocationReport('panel');
      
      expect(service.getCachedPanelLocation()).toBe('panel');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'panel'
      );
    });

    it('should trigger callback when location changes', async () => {
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      const onChange = vi.fn();
      // Default is 'sidebar'
      await service.handlePanelLocationReport('panel', onChange);
      
      expect(onChange).toHaveBeenCalledWith('sidebar', 'panel');
    });

    it('should ignore invalid locations', async () => {
      await service.handlePanelLocationReport('invalid');
      expect(service.getCachedPanelLocation()).toBe('sidebar');
    });

    it('should skip setContext in auto mode but still update cache', async () => {
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'panelLocation') return 'auto';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      await service.handlePanelLocationReport('panel');

      expect(service.getCachedPanelLocation()).toBe('panel');
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'panel'
      );
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

    it('should NOT call setContext in error path even in manual mode', async () => {
      // On detection failure, setContext should never be called as fallback.
      // Manual mode users have explicit settings that getCurrentPanelLocation()
      // respects, so overriding context key would contradict their preference.
      mockSendMessage.mockRejectedValue(new Error('Fail'));

      const mockGet = vi.fn().mockImplementation((key: string, def: unknown) => {
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      // Change cached location to 'panel'
      await service.handlePanelLocationReport('panel');
      vi.mocked(vscode.commands.executeCommand).mockClear();

      service.requestPanelLocationDetection();
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Assert: setContext should NOT be called - respect user's manual 'panel' setting
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should NOT call setContext in error path when panelLocation is auto mode', async () => {
      // Bug: The error fallback unconditionally calls setContext('sidebar')
      // even in auto mode, causing VS Code layout recalculation that
      // cancels the secondary sidebar maximize state.
      mockSendMessage.mockRejectedValue(new Error('Fail'));

      const mockGet = vi.fn().mockImplementation((key: string, def: unknown) => {
        if (key === 'panelLocation') return 'auto';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      service.requestPanelLocationDetection();
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Assert: setContext should NOT be called in auto mode
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });

    it('should NOT call setContext in error path when cached location is already sidebar', async () => {
      // If cached location is already 'sidebar', calling setContext('sidebar')
      // is redundant and triggers unnecessary layout recalculation.
      mockSendMessage.mockRejectedValue(new Error('Fail'));

      const mockGet = vi.fn().mockImplementation((key: string, def: unknown) => {
        if (key === 'panelLocation') return 'panel'; // manual mode
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      // Default cached location is 'sidebar', so fallback to 'sidebar' is redundant
      service.requestPanelLocationDetection();
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Assert: setContext should NOT be called because location hasn't changed
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });
  });

  describe('determineSplitDirection', () => {
    it('should return vertical for sidebar', () => {
      // Reset mock to default behavior to avoid leaking from previous tests
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string, def: unknown) => def),
      });
      // Default cached location is sidebar
      expect(service.determineSplitDirection()).toBe('vertical');
    });

    it('should return horizontal for panel', async () => {
      await service.handlePanelLocationReport('panel');
      expect(service.determineSplitDirection()).toBe('horizontal');
    });
  });

  describe('handlePanelLocationReport - skip redundant setContext', () => {
    it('should skip setContext when location is unchanged', async () => {
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      // Arrange: Report 'panel' first (changes from default 'sidebar')
      await service.handlePanelLocationReport('panel');
      vi.mocked(vscode.commands.executeCommand).mockClear();

      // Act: Report same location again
      await service.handlePanelLocationReport('panel');

      // Assert: setContext should NOT be called for unchanged location
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should call setContext when location changes', async () => {
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

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
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      const onChange = vi.fn();

      // Arrange: Set location to 'panel'
      await service.handlePanelLocationReport('panel');

      // Act: Report same location with callback
      await service.handlePanelLocationReport('panel', onChange);

      // Assert: Callback should not be called
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should skip setContext when first report matches default location', async () => {
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      (vscode.workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

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
