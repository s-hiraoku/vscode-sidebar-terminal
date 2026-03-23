/**
 * TerminalAutoSaveService Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { TerminalAutoSaveService } from '../../../../../../webview/services/terminal/TerminalAutoSaveService';

// Mock dependencies
vi.mock('../../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TerminalAutoSaveService', () => {
  let service: TerminalAutoSaveService;
  let mockCoordinator: any;
  let mockTerminal: any;
  let mockSerializeAddon: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCoordinator = {
      postMessageToExtension: vi.fn(),
    };
    mockTerminal = {
      onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onLineFeed: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      rows: 24,
    };
    mockSerializeAddon = {
      serialize: vi.fn().mockReturnValue('mock\nscrollback\ndata'),
    };

    service = new TerminalAutoSaveService(mockCoordinator);

    // Reset static state
    (TerminalAutoSaveService as any).restoringTerminals.clear();
    (TerminalAutoSaveService as any).periodicSaveTimers.forEach((t: any) => clearInterval(t));
    (TerminalAutoSaveService as any).periodicSaveTimers.clear();
    (TerminalAutoSaveService as any).registeredTerminals.clear();
    (TerminalAutoSaveService as any).visibilityHandlerSetup = false;

    // Mock vscodeApi
    (window as any).vscodeApi = {
      postMessage: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('setupScrollbackAutoSave', () => {
    it('should setup event listeners and periodic timer', () => {
      service.setupScrollbackAutoSave(mockTerminal, 't1', mockSerializeAddon);

      expect(mockTerminal.onData).toHaveBeenCalled();
      expect(mockTerminal.onLineFeed).toHaveBeenCalled();
      expect((TerminalAutoSaveService as any).periodicSaveTimers.has('t1')).toBe(true);
    });

    it('should trigger save after data event and delay', async () => {
      service.setupScrollbackAutoSave(mockTerminal, 't1', mockSerializeAddon);
      const onDataCallback = mockTerminal.onData.mock.calls[0][0];

      onDataCallback('some input');

      // Delay is 3000ms inside pushScrollbackToExtension, but there might be other timers
      await vi.advanceTimersByTimeAsync(5000);

      expect((window as any).vscodeApi.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pushScrollbackData',
          terminalId: 't1',
          scrollbackData: ['mock', 'scrollback', 'data'],
        })
      );
    });

    it('should skip save if terminal is restoring', () => {
      TerminalAutoSaveService.markTerminalRestoring('t1');
      service.setupScrollbackAutoSave(mockTerminal, 't1', mockSerializeAddon);

      const onDataCallback = mockTerminal.onData.mock.calls[0][0];
      onDataCallback('data');

      vi.advanceTimersByTime(3000);
      expect((window as any).vscodeApi.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('Restoration State', () => {
    it('should manage restoring state with delay', () => {
      TerminalAutoSaveService.markTerminalRestoring('t1');
      expect(TerminalAutoSaveService.isTerminalRestoring('t1')).toBe(true);

      TerminalAutoSaveService.markTerminalRestored('t1');
      expect(TerminalAutoSaveService.isTerminalRestoring('t1')).toBe(true); // Still true due to 5s delay

      vi.advanceTimersByTime(5000);
      expect(TerminalAutoSaveService.isTerminalRestoring('t1')).toBe(false);
    });
  });

  describe('Visibility Changes', () => {
    it('should save all scrollback when page hidden', () => {
      service.setupScrollbackAutoSave(mockTerminal, 't1', mockSerializeAddon);

      // Mock visibilityState
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

      // Trigger event
      document.dispatchEvent(new Event('visibilitychange'));

      expect((window as any).vscodeApi.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeSleep: true,
        })
      );
    });

    it('should request refresh when page visible after long delay', () => {
      service.setupScrollbackAutoSave(mockTerminal, 't1', mockSerializeAddon);

      // Hide
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      (TerminalAutoSaveService as any).lastHiddenAt = Date.now();
      document.dispatchEvent(new Event('visibilitychange'));

      // Wait > 60s
      vi.advanceTimersByTime(61000);

      // Show
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect((window as any).vscodeApi.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'requestScrollbackRefresh',
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should clear periodic timer on terminal removal', () => {
      service.setupScrollbackAutoSave(mockTerminal, 't1', mockSerializeAddon);
      const _timer = (TerminalAutoSaveService as any).periodicSaveTimers.get('t1');

      TerminalAutoSaveService.clearPeriodicSaveTimer('t1');

      expect((TerminalAutoSaveService as any).periodicSaveTimers.has('t1')).toBe(false);
    });

    it('should also remove from registeredTerminals when clearing periodic timer', () => {
      service.setupScrollbackAutoSave(mockTerminal, 't1', mockSerializeAddon);

      // Verify registered
      expect((TerminalAutoSaveService as any).registeredTerminals.has('t1')).toBe(true);

      TerminalAutoSaveService.clearPeriodicSaveTimer('t1');

      // Should be removed from registeredTerminals too
      expect((TerminalAutoSaveService as any).registeredTerminals.has('t1')).toBe(false);
    });
  });

  describe('Bug #5: disposeAll clears all static Maps', () => {
    it('should provide a disposeAll method that clears all static state', () => {
      // Setup multiple terminals
      service.setupScrollbackAutoSave(mockTerminal, 't1', mockSerializeAddon);
      service.setupScrollbackAutoSave(mockTerminal, 't2', mockSerializeAddon);
      TerminalAutoSaveService.markTerminalRestoring('t3');

      // Verify state exists
      expect((TerminalAutoSaveService as any).periodicSaveTimers.size).toBeGreaterThan(0);
      expect((TerminalAutoSaveService as any).registeredTerminals.size).toBeGreaterThan(0);
      expect((TerminalAutoSaveService as any).restoringTerminals.size).toBeGreaterThan(0);

      // Call disposeAll
      TerminalAutoSaveService.disposeAll();

      // All static Maps should be cleared
      expect((TerminalAutoSaveService as any).periodicSaveTimers.size).toBe(0);
      expect((TerminalAutoSaveService as any).registeredTerminals.size).toBe(0);
      expect((TerminalAutoSaveService as any).restoringTerminals.size).toBe(0);
    });
  });
});
