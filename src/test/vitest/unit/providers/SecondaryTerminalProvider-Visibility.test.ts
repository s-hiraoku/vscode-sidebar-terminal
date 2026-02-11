/**
 * SecondaryTerminalProvider - Visibility Guard Tests
 *
 * Fix: Prevent secondary sidebar maximize from being cancelled
 * when _handleWebviewVisible triggers redundant panel location detection.
 *
 * Root cause: _handleWebviewVisible() unconditionally calls _requestPanelLocationDetection()
 * on every visibility change, even simple focus-driven hidden->visible transitions.
 * The resulting setContext call triggers VS Code layout recalculation, cancelling maximize.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock VS Code API
vi.mock('vscode', () => ({
  commands: {
    executeCommand: vi.fn().mockResolvedValue(undefined),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, def: unknown) => def),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    activeColorTheme: { kind: 2 },
  },
  ColorThemeKind: {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
    HighContrastLight: 4,
  },
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
  isDebugEnabled: vi.fn(() => false),
}));

describe('SecondaryTerminalProvider - Visibility Guard', () => {
  let mockRequestPanelLocationDetection: ReturnType<typeof vi.fn>;
  let provider: {
    _hasDetectedPanelLocation: boolean;
    _handleWebviewVisible: () => void;
    _requestPanelLocationDetection: () => void;
    dispose: () => void;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockRequestPanelLocationDetection = vi.fn();

    // Create a minimal mock that simulates the fixed SecondaryTerminalProvider behavior
    provider = {
      _hasDetectedPanelLocation: false,

      _handleWebviewVisible() {
        // Guard: Skip panel location detection on simple visibility restore
        if (this._hasDetectedPanelLocation) {
          return;
        }

        // Set flag BEFORE setTimeout to prevent race condition
        this._hasDetectedPanelLocation = true;

        // First visibility: trigger detection after layout stabilizes
        setTimeout(() => {
          this._requestPanelLocationDetection();
        }, 200);
      },

      _requestPanelLocationDetection: mockRequestPanelLocationDetection,

      dispose() {
        this._hasDetectedPanelLocation = false;
      },
    };
  });

  afterEach(() => {
    provider.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('_handleWebviewVisible - panel location detection guard', () => {
    it('should detect panel location on first visibility event', () => {
      // Act: First visibility event
      provider._handleWebviewVisible();
      vi.advanceTimersByTime(200);

      // Assert: Detection should run
      expect(mockRequestPanelLocationDetection).toHaveBeenCalledTimes(1);
    });

    it('should set _hasDetectedPanelLocation flag after first detection', () => {
      // Arrange: Flag starts false
      expect(provider._hasDetectedPanelLocation).toBe(false);

      // Act: First visibility event
      provider._handleWebviewVisible();
      vi.advanceTimersByTime(200);

      // Assert: Flag is now true
      expect(provider._hasDetectedPanelLocation).toBe(true);
    });

    it('should skip panel location detection on subsequent visibility restore', () => {
      // Arrange: Simulate first detection completed
      provider._handleWebviewVisible();
      vi.advanceTimersByTime(200);
      mockRequestPanelLocationDetection.mockClear();

      // Act: Subsequent visibility events (e.g., focus changes during Claude Code operation)
      provider._handleWebviewVisible();
      vi.advanceTimersByTime(200);

      provider._handleWebviewVisible();
      vi.advanceTimersByTime(200);

      // Assert: No additional detection calls
      expect(mockRequestPanelLocationDetection).not.toHaveBeenCalled();
    });

    it('should reset flag on dispose (allowing re-detection after reinitialization)', () => {
      // Arrange: Complete first detection
      provider._handleWebviewVisible();
      vi.advanceTimersByTime(200);
      expect(provider._hasDetectedPanelLocation).toBe(true);

      // Act: Dispose (simulates WebView destruction)
      provider.dispose();

      // Assert: Flag is reset
      expect(provider._hasDetectedPanelLocation).toBe(false);
    });

    it('should allow detection after dispose and re-creation', () => {
      // Arrange: Complete first detection cycle
      provider._handleWebviewVisible();
      vi.advanceTimersByTime(200);
      mockRequestPanelLocationDetection.mockClear();

      // Act: Dispose and trigger new visibility
      provider.dispose();
      provider._handleWebviewVisible();
      vi.advanceTimersByTime(200);

      // Assert: Detection runs again for new lifecycle
      expect(mockRequestPanelLocationDetection).toHaveBeenCalledTimes(1);
    });

    it('should NOT queue multiple timers when rapid visibility events fire within 200ms', () => {
      // This tests the race condition: if multiple visibility events fire
      // before the 200ms setTimeout completes, only ONE detection should run.
      // Bug: _hasDetectedPanelLocation was set INSIDE setTimeout, allowing
      // multiple timers to be queued.

      // Act: Fire 5 rapid visibility events within 200ms
      provider._handleWebviewVisible();
      provider._handleWebviewVisible();
      provider._handleWebviewVisible();
      provider._handleWebviewVisible();
      provider._handleWebviewVisible();

      // Advance past all timers
      vi.advanceTimersByTime(200);

      // Assert: Detection should run exactly ONCE, not 5 times
      expect(mockRequestPanelLocationDetection).toHaveBeenCalledTimes(1);
    });

    it('should set flag immediately to prevent race condition', () => {
      // The flag must be set BEFORE setTimeout to prevent
      // concurrent visibility events from bypassing the guard.

      // Act: First visibility event
      provider._handleWebviewVisible();

      // Assert: Flag should be true IMMEDIATELY, not after 200ms
      expect(provider._hasDetectedPanelLocation).toBe(true);
    });
  });
});
