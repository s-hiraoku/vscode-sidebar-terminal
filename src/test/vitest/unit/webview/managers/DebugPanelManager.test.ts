/**
 * DebugPanelManager Unit Tests
 *
 * Tests for debug panel display and system diagnostics including:
 * - Panel visibility toggle
 * - State update display
 * - Performance counters
 * - System diagnostics export
 * - Uptime calculation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebugPanelManager } from '../../../../../webview/managers/DebugPanelManager';
import type { TerminalState } from '../../../../../types/shared';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Mock navigator for diagnostics tests
const mockNavigator = {
  userAgent: 'MockBrowser/1.0',
  platform: 'MockOS',
  language: 'en-US',
  cookieEnabled: true,
  onLine: true,
};

// Helper to create mock terminal state
function createMockTerminalState(options: Partial<TerminalState> = {}): TerminalState {
  return {
    terminals: options.terminals ?? [
      { id: 'terminal-1', isActive: true, number: 1 },
      { id: 'terminal-2', isActive: false, number: 2 },
    ],
    availableSlots: options.availableSlots ?? [3, 4, 5],
    activeTerminalId: options.activeTerminalId ?? 'terminal-1',
    maxTerminals: options.maxTerminals ?? 5,
    ...options,
  } as TerminalState;
}

describe('DebugPanelManager', () => {
  let manager: DebugPanelManager;
  let originalDocument: Document;
  let mockDocument: any;

  beforeEach(() => {
    // Setup DOM mock
    originalDocument = global.document;
    mockDocument = {
      getElementById: vi.fn().mockReturnValue(null),
      createElement: vi.fn().mockImplementation((tag) => ({
        tagName: tag.toUpperCase(),
        style: { cssText: '' },
        appendChild: vi.fn(),
        remove: vi.fn(),
        innerHTML: '',
        textContent: '',
        onclick: null,
        id: '',
      })),
      body: {
        appendChild: vi.fn(),
      },
    };
    global.document = mockDocument as any;

    // Mock navigator
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
    });

    manager = new DebugPanelManager();
  });

  afterEach(() => {
    global.document = originalDocument;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('toggle', () => {
    it('should enable debug mode on first toggle', () => {
      expect(manager.isActive()).toBe(false);

      manager.toggle();

      expect(manager.isActive()).toBe(true);
    });

    it('should disable debug mode on second toggle', () => {
      manager.toggle();
      manager.toggle();

      expect(manager.isActive()).toBe(false);
    });

    it('should update display when toggled with state', () => {
      const state = createMockTerminalState();

      manager.toggle(state);

      expect(manager.isActive()).toBe(true);
    });

    it('should remove panel when toggling off', () => {
      const mockPanel = {
        remove: vi.fn(),
      };
      mockDocument.getElementById.mockReturnValue(mockPanel);

      manager.toggle(); // Enable
      manager.toggle(); // Disable

      expect(mockPanel.remove).toHaveBeenCalled();
    });
  });

  describe('isActive', () => {
    it('should return false initially', () => {
      expect(manager.isActive()).toBe(false);
    });

    it('should return true after enabling', () => {
      manager.toggle();

      expect(manager.isActive()).toBe(true);
    });
  });

  describe('updateDisplay', () => {
    it('should increment state updates counter', () => {
      const state = createMockTerminalState();
      const initialCounters = manager.getCounters();

      manager.updateDisplay(state);

      const updatedCounters = manager.getCounters();
      expect(updatedCounters.stateUpdates).toBe(initialCounters.stateUpdates + 1);
    });

    it('should update lastSync timestamp', () => {
      vi.useFakeTimers();
      const testDate = new Date('2025-01-01T12:00:00Z');
      vi.setSystemTime(testDate);

      const state = createMockTerminalState();
      manager.updateDisplay(state);

      const counters = manager.getCounters();
      expect(counters.lastSync).toBe(testDate.toISOString());
    });

    it('should not display info when debug mode is inactive', () => {
      const state = createMockTerminalState();

      manager.updateDisplay(state);

      // No panel should be created when debug mode is off
      expect(mockDocument.createElement).not.toHaveBeenCalled();
    });

    it('should display info when debug mode is active', () => {
      manager.toggle(); // Enable debug mode
      const state = createMockTerminalState();

      manager.updateDisplay(state, 'test-operation');

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
    });
  });

  describe('incrementStateUpdates', () => {
    it('should increment the counter', () => {
      const initialCount = manager.getCounters().stateUpdates;

      manager.incrementStateUpdates();
      manager.incrementStateUpdates();
      manager.incrementStateUpdates();

      expect(manager.getCounters().stateUpdates).toBe(initialCount + 3);
    });

    it('should update lastSync', () => {
      vi.useFakeTimers();
      const testDate = new Date('2025-06-15T10:30:00Z');
      vi.setSystemTime(testDate);

      manager.incrementStateUpdates();

      expect(manager.getCounters().lastSync).toBe(testDate.toISOString());
    });
  });

  describe('getCounters', () => {
    it('should return a copy of counters', () => {
      const counters1 = manager.getCounters();
      const counters2 = manager.getCounters();

      expect(counters1).not.toBe(counters2);
      expect(counters1).toEqual(counters2);
    });

    it('should have initial values', () => {
      const counters = manager.getCounters();

      expect(counters.stateUpdates).toBe(0);
      expect(counters.lastSync).toBe('never');
      expect(counters.systemStartTime).toBeGreaterThan(0);
    });
  });

  describe('exportDiagnostics', () => {
    it('should return complete diagnostics object', () => {
      const systemStatus = {
        ready: true,
        state: null,
        pendingOperations: { deletions: [], creations: 0 },
      };

      const diagnostics = manager.exportDiagnostics(systemStatus, 5);

      expect(diagnostics).toHaveProperty('timestamp');
      expect(diagnostics).toHaveProperty('systemStatus');
      expect(diagnostics).toHaveProperty('performanceCounters');
      expect(diagnostics).toHaveProperty('configuration');
      expect(diagnostics).toHaveProperty('extensionCommunication');
      expect(diagnostics).toHaveProperty('troubleshootingInfo');
    });

    it('should include correct system status', () => {
      const systemStatus = {
        ready: false,
        state: null,
        pendingOperations: { deletions: ['t1', 't2'], creations: 3 },
      };

      const diagnostics = manager.exportDiagnostics(systemStatus, 5);

      expect(diagnostics.systemStatus).toEqual(systemStatus);
    });

    it('should include configuration with debug mode', () => {
      manager.toggle(); // Enable debug mode
      const systemStatus = {
        ready: true,
        state: null,
        pendingOperations: { deletions: [], creations: 0 },
      };

      const diagnostics = manager.exportDiagnostics(systemStatus, 10);

      expect(diagnostics.configuration.debugMode).toBe(true);
      expect(diagnostics.configuration.maxTerminals).toBe(10);
    });

    it('should include troubleshooting info from navigator', () => {
      const systemStatus = {
        ready: true,
        state: null,
        pendingOperations: { deletions: [], creations: 0 },
      };

      const diagnostics = manager.exportDiagnostics(systemStatus, 5);

      expect(diagnostics.troubleshootingInfo.userAgent).toBe('MockBrowser/1.0');
      expect(diagnostics.troubleshootingInfo.platform).toBe('MockOS');
      expect(diagnostics.troubleshootingInfo.language).toBe('en-US');
      expect(diagnostics.troubleshootingInfo.cookieEnabled).toBe(true);
      expect(diagnostics.troubleshootingInfo.onLine).toBe(true);
    });

    it('should include performance counters snapshot', () => {
      manager.incrementStateUpdates();
      manager.incrementStateUpdates();

      const systemStatus = {
        ready: true,
        state: null,
        pendingOperations: { deletions: [], creations: 0 },
      };

      const diagnostics = manager.exportDiagnostics(systemStatus, 5);

      expect(diagnostics.performanceCounters.stateUpdates).toBe(2);
    });
  });

  describe('getUptime', () => {
    it('should return seconds for short uptime', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const freshManager = new DebugPanelManager();
      vi.advanceTimersByTime(45000); // 45 seconds

      const uptime = freshManager.getUptime();

      expect(uptime).toBe('45s');
    });

    it('should return minutes and seconds for medium uptime', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const freshManager = new DebugPanelManager();
      vi.advanceTimersByTime(185000); // 3 minutes 5 seconds

      const uptime = freshManager.getUptime();

      expect(uptime).toBe('3m 5s');
    });

    it('should return hours and minutes for long uptime', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const freshManager = new DebugPanelManager();
      vi.advanceTimersByTime(7500000); // 2 hours 5 minutes

      const uptime = freshManager.getUptime();

      expect(uptime).toBe('2h 5m');
    });
  });

  describe('setCallbacks', () => {
    it('should store callbacks for external integration', () => {
      const callbacks = {
        getSystemStatus: vi.fn().mockReturnValue({
          ready: true,
          state: null,
          pendingOperations: { deletions: [], creations: 0 },
        }),
        forceSynchronization: vi.fn(),
        requestLatestState: vi.fn(),
      };

      manager.setCallbacks(callbacks);
      manager.toggle(); // Enable debug mode
      const state = createMockTerminalState();

      manager.updateDisplay(state);

      expect(callbacks.getSystemStatus).toHaveBeenCalled();
    });
  });

  describe('updatePerformanceCounters', () => {
    it('should update DOM elements if they exist', () => {
      const mockElements = {
        'debug-state-updates': { textContent: '' },
        'debug-last-sync': { textContent: '' },
        'debug-uptime': { textContent: '' },
      };

      mockDocument.getElementById.mockImplementation((id: string) => mockElements[id] || null);

      manager.incrementStateUpdates();
      manager.updatePerformanceCounters();

      expect(mockElements['debug-state-updates'].textContent).toBe('1');
    });

    it('should handle missing DOM elements gracefully', () => {
      mockDocument.getElementById.mockReturnValue(null);

      expect(() => manager.updatePerformanceCounters()).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should remove the panel', () => {
      const mockPanel = {
        remove: vi.fn(),
      };
      mockDocument.getElementById.mockReturnValue(mockPanel);

      manager.toggle(); // Enable
      manager.dispose();

      expect(mockPanel.remove).toHaveBeenCalled();
    });

    it('should set debug mode to inactive', () => {
      manager.toggle(); // Enable
      expect(manager.isActive()).toBe(true);

      manager.dispose();

      expect(manager.isActive()).toBe(false);
    });
  });

  describe('Panel Display', () => {
    it('should create panel with correct ID', () => {
      manager.toggle();
      const state = createMockTerminalState();

      manager.updateDisplay(state);

      expect(mockDocument.getElementById).toHaveBeenCalledWith('terminal-debug-info');
    });

    it('should use existing panel if already created', () => {
      const existingPanel = {
        innerHTML: '',
        id: 'terminal-debug-info',
        style: { cssText: '' },
      };
      mockDocument.getElementById.mockReturnValue(existingPanel);

      manager.toggle();
      const state = createMockTerminalState();

      manager.updateDisplay(state);

      // Should not create a new div since one already exists
      expect(mockDocument.createElement).not.toHaveBeenCalledWith('div');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty terminal list', () => {
      manager.toggle();
      const state = createMockTerminalState({
        terminals: [],
        availableSlots: [1, 2, 3, 4, 5],
        activeTerminalId: null,
      });

      expect(() => manager.updateDisplay(state)).not.toThrow();
    });

    it('should handle full terminal slots', () => {
      manager.toggle();
      const state = createMockTerminalState({
        terminals: [
          { id: 'terminal-1', isActive: true, number: 1 },
          { id: 'terminal-2', isActive: false, number: 2 },
          { id: 'terminal-3', isActive: false, number: 3 },
          { id: 'terminal-4', isActive: false, number: 4 },
          { id: 'terminal-5', isActive: false, number: 5 },
        ],
        availableSlots: [],
        maxTerminals: 5,
      });

      expect(() => manager.updateDisplay(state)).not.toThrow();
    });

    it('should handle unknown maxTerminals in diagnostics', () => {
      const systemStatus = {
        ready: true,
        state: null,
        pendingOperations: { deletions: [], creations: 0 },
      };

      const diagnostics = manager.exportDiagnostics(systemStatus, 'unknown');

      expect(diagnostics.configuration.maxTerminals).toBe('unknown');
    });
  });
});
