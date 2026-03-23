import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CliAgentWaitingDetector } from '../../../../services/CliAgentWaitingDetector';
import { CliAgentPatternRegistry } from '../../../../services/CliAgentPatternRegistry';
import { CliAgentStateStore } from '../../../../services/CliAgentStateStore';

// Mock vscode
vi.mock('vscode', () => ({
  EventEmitter: vi.fn().mockImplementation(function (this: any) {
    this.event = vi.fn();
    this.fire = vi.fn();
    this.dispose = vi.fn();
  }),
  Disposable: {
    from: vi.fn(),
  },
}));

describe('CliAgentWaitingDetector', () => {
  let detector: CliAgentWaitingDetector;
  let registry: CliAgentPatternRegistry;
  let stateStore: CliAgentStateStore;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new CliAgentPatternRegistry();
    stateStore = new CliAgentStateStore();
    detector = new CliAgentWaitingDetector(registry, stateStore);
  });

  afterEach(() => {
    detector.dispose();
    stateStore.dispose();
    vi.useRealTimers();
  });

  describe('analyze', () => {
    it('should detect waiting state when agent is connected and output matches input prompt', () => {
      // Setup: agent connected
      stateStore.setConnectedAgent('terminal-1', 'claude');

      // Analyze output with Claude prompt
      detector.analyze('terminal-1', '❯');

      // Advance past debounce
      vi.advanceTimersByTime(350);

      const state = stateStore.getAgentState('terminal-1');
      expect(state?.isWaitingForInput).toBe(true);
      expect(state?.waitingType).toBe('input');
    });

    it('should detect Claude waiting prompt when prompt line contains trailing context', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');

      detector.analyze('terminal-1', 'Esc to interrupt\n❯ Continue');
      vi.advanceTimersByTime(350);

      const state = stateStore.getAgentState('terminal-1');
      expect(state?.isWaitingForInput).toBe(true);
      expect(state?.waitingType).toBe('input');
    });

    it('should detect Claude waiting prompt with terminal-mode residue after ANSI cleanup', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');

      detector.analyze('terminal-1', '❯ [?2004h');
      vi.advanceTimersByTime(350);

      const state = stateStore.getAgentState('terminal-1');
      expect(state?.isWaitingForInput).toBe(true);
      expect(state?.waitingType).toBe('input');
    });

    it('should detect tool approval waiting state', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');

      detector.analyze('terminal-1', 'Allow once?');
      vi.advanceTimersByTime(350);

      const state = stateStore.getAgentState('terminal-1');
      expect(state?.isWaitingForInput).toBe(true);
      expect(state?.waitingType).toBe('approval');
    });

    it('should not detect waiting state when agent is not connected', () => {
      // No agent connected for this terminal
      detector.analyze('terminal-1', '❯');
      vi.advanceTimersByTime(350);

      const state = stateStore.getAgentState('terminal-1');
      expect(state?.isWaitingForInput).toBeFalsy();
    });

    it('should reset waiting state when new non-prompt output arrives', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');

      // First: detect waiting
      detector.analyze('terminal-1', '❯');
      vi.advanceTimersByTime(350);

      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBe(true);

      // Then: new output arrives (agent starts working)
      detector.analyze('terminal-1', 'Reading file src/main.ts...\nProcessing content...');
      vi.advanceTimersByTime(350);

      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBe(false);
    });

    it('should reset waiting state when work output includes a stale prompt line', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');

      detector.analyze('terminal-1', '❯');
      vi.advanceTimersByTime(350);
      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBe(true);

      detector.analyze(
        'terminal-1',
        '❯ Continue\nReading file src/main.ts...\nProcessing content...'
      );
      vi.advanceTimersByTime(350);

      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBe(false);
    });

    it('should debounce rapid output', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');

      // Rapid output that includes prompt mid-stream
      detector.analyze('terminal-1', '❯');
      vi.advanceTimersByTime(100); // Not past debounce yet

      // More output arrives before debounce fires
      detector.analyze('terminal-1', 'Working on something...');
      vi.advanceTimersByTime(350);

      // Should NOT be waiting because non-prompt output arrived
      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBe(false);
    });

    it('should only detect for the connected terminal agent type', () => {
      stateStore.setConnectedAgent('terminal-1', 'gemini');

      // Claude prompt should not match for gemini terminal
      detector.analyze('terminal-1', '❯');
      vi.advanceTimersByTime(350);

      // ❯ is Claude-specific, gemini uses "gemini >"
      const state = stateStore.getAgentState('terminal-1');
      expect(state?.isWaitingForInput).toBeFalsy();
    });

    it('should detect Gemini waiting for its own prompt pattern', () => {
      stateStore.setConnectedAgent('terminal-1', 'gemini');

      detector.analyze('terminal-1', 'gemini >');
      vi.advanceTimersByTime(350);

      const state = stateStore.getAgentState('terminal-1');
      expect(state?.isWaitingForInput).toBe(true);
      expect(state?.waitingType).toBe('input');
    });

    it('should ignore trivial whitespace-only output', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');

      detector.analyze('terminal-1', '❯');
      vi.advanceTimersByTime(350);
      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBe(true);

      // Whitespace-only output should not reset waiting
      detector.analyze('terminal-1', '   \n  \n');
      vi.advanceTimersByTime(350);

      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clear pending data for a single terminal without affecting others', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');
      stateStore.setConnectedAgent('terminal-2', 'claude');

      detector.analyze('terminal-1', '❯');
      detector.analyze('terminal-2', '❯');

      detector.clearTerminalData('terminal-1');
      vi.advanceTimersByTime(350);

      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBe(false);
      expect(stateStore.getAgentState('terminal-2')?.isWaitingForInput).toBe(true);
    });

    it('should clear all pending timers', () => {
      stateStore.setConnectedAgent('terminal-1', 'claude');
      detector.analyze('terminal-1', '❯');

      // Dispose before timer fires
      detector.dispose();
      vi.advanceTimersByTime(500);

      // Should not have updated state
      expect(stateStore.getAgentState('terminal-1')?.isWaitingForInput).toBeFalsy();
    });
  });
});
