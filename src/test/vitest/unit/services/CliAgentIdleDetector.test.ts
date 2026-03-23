import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CliAgentIdleDetector } from '../../../../services/CliAgentIdleDetector';
import { CliAgentStateStore } from '../../../../services/CliAgentStateStore';

const mockGetConfig = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfig(...args),
  },
  EventEmitter: vi.fn().mockImplementation(function (this: any) {
    const listeners: any[] = [];
    this.event = (listener: any) => {
      listeners.push(listener);
      return { dispose: () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); } };
    };
    this.fire = (data: any) => { listeners.forEach((l) => l(data)); };
    this.dispose = () => { listeners.length = 0; };
  }),
}));

function setDefaultConfig(overrides: Record<string, any> = {}) {
  const settings: Record<string, any> = {
    'agentIdleDetection.timeoutMs': 3000,
    ...overrides,
  };
  mockGetConfig.mockReturnValue({
    get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
      return settings[key] ?? defaultValue;
    }),
  });
}

describe('CliAgentIdleDetector', () => {
  let detector: CliAgentIdleDetector;
  let stateStore: CliAgentStateStore;

  beforeEach(() => {
    vi.useFakeTimers();
    setDefaultConfig();
    stateStore = new CliAgentStateStore();
    detector = new CliAgentIdleDetector(stateStore);
  });

  afterEach(() => {
    detector.dispose();
    stateStore.dispose();
    vi.useRealTimers();
  });

  describe('resetTimer', () => {
    it('should fire idle waiting after timeout when no more output', () => {
      // Set up connected agent first
      stateStore.setConnectedAgent('terminal-1', 'claude');
      const spy = vi.fn();
      stateStore.onAgentWaitingChange(spy);

      detector.resetTimer('terminal-1');
      vi.advanceTimersByTime(3000);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          terminalId: 'terminal-1',
          isWaiting: true,
          waitingType: 'idle',
        })
      );
    });

    it('should not fire idle if output arrives before timeout', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');
      const spy = vi.fn();
      stateStore.onAgentWaitingChange(spy);

      detector.resetTimer('terminal-1');
      vi.advanceTimersByTime(2000);

      // More output arrives, resets timer
      detector.resetTimer('terminal-1');
      vi.advanceTimersByTime(2000);

      // Only 2s since last reset, not yet 3s
      expect(spy).not.toHaveBeenCalled();

      // Now complete the timeout
      vi.advanceTimersByTime(1000);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not fire idle if agent is not connected', () => {
      const spy = vi.fn();
      stateStore.onAgentWaitingChange(spy);

      detector.resetTimer('terminal-1');
      vi.advanceTimersByTime(3000);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should not fire idle if already waiting (idle)', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');
      const spy = vi.fn();
      stateStore.onAgentWaitingChange(spy);

      detector.resetTimer('terminal-1');
      vi.advanceTimersByTime(3000);
      expect(spy).toHaveBeenCalledTimes(1);

      // Timer fires again — should not duplicate due to redundancy prevention
      detector.resetTimer('terminal-1');
      vi.advanceTimersByTime(3000);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should use configured timeout from settings', () => {
      setDefaultConfig({ 'agentIdleDetection.timeoutMs': 5000 });
      stateStore.setConnectedAgent('terminal-1', 'claude');
      const spy = vi.fn();
      stateStore.onAgentWaitingChange(spy);

      detector.resetTimer('terminal-1');
      vi.advanceTimersByTime(3000);
      expect(spy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearIdleWaiting', () => {
    it('should clear idle waiting state when output resumes', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');
      const events: any[] = [];
      stateStore.onAgentWaitingChange((e) => events.push(e));

      detector.resetTimer('terminal-1');
      vi.advanceTimersByTime(3000);

      // Agent becomes idle
      expect(events).toHaveLength(1);
      expect(events[0].isWaiting).toBe(true);

      // Output resumes — should clear idle waiting
      detector.clearIdleWaiting('terminal-1');
      expect(events).toHaveLength(2);
      expect(events[1].isWaiting).toBe(false);
    });

    it('should not clear non-idle waiting (input/approval)', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');
      stateStore.setAgentWaiting('terminal-1', true, 'approval');

      const spy = vi.fn();
      stateStore.onAgentWaitingChange(spy);

      detector.clearIdleWaiting('terminal-1');
      // Should NOT have been called because waiting type is approval, not idle
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('cancelTimer', () => {
    it('should prevent idle detection after timer cancelled', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');
      const spy = vi.fn();
      stateStore.onAgentWaitingChange(spy);

      detector.resetTimer('terminal-1');
      detector.cancelTimer('terminal-1');
      vi.advanceTimersByTime(5000);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should cancel all timers on dispose', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');
      stateStore.setConnectedAgent('terminal-2', 'gemini');
      const spy = vi.fn();
      stateStore.onAgentWaitingChange(spy);

      detector.resetTimer('terminal-1');
      detector.resetTimer('terminal-2');
      detector.dispose();
      vi.advanceTimersByTime(5000);

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
