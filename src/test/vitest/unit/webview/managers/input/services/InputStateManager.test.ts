import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputStateManager } from '../../../../../../../webview/managers/input/services/InputStateManager';

describe('InputStateManager', () => {
  let manager: InputStateManager;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = vi.fn();
    manager = new InputStateManager(mockLogger);
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const state = manager.getState();
      expect(state.ime.isActive).toBe(false);
      expect(state.altClick.isVSCodeAltClickEnabled).toBe(false);
      expect(state.keyboard.isInChordMode).toBe(false);
      expect(state.agent.isAgentMode).toBe(false);
    });
  });

  describe('State Updates', () => {
    it('should update IME state and notify listeners', () => {
      const listener = vi.fn();
      manager.addStateListener('ime', listener);

      manager.updateIMEState({ isActive: true, data: 'あ' });

      expect(manager.getStateSection('ime').isActive).toBe(true);
      expect(manager.getStateSection('ime').data).toBe('あ');
      expect(listener).toHaveBeenCalled();
    });

    it('should notify global listeners on any change', () => {
      const globalListener = vi.fn();
      manager.addStateListener('*', globalListener);

      manager.updateAltClickState({ isAltKeyPressed: true });

      expect(globalListener).toHaveBeenCalledWith(
        expect.objectContaining({ isAltKeyPressed: true }),
        expect.anything(),
        'altClick'
      );
    });

    it('should deep clone state to prevent external mutations', () => {
      const state = manager.getState();
      (state.ime as any).isActive = true; // Attempt mutation
      
      expect(manager.getStateSection('ime').isActive).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should log warning for invalid IME state (active but empty)', () => {
      manager.updateIMEState({ isActive: true, data: '', lastEvent: 'update' });
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('IME active but no composition data'));
    });

    it('should log error for negative offsets', () => {
      manager.updateIMEState({ startOffset: -1 });
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Invalid IME offset values'));
    });
  });

  describe('History and Critical State', () => {
    it('should record history of changes', () => {
      manager.updateAgentState({ isAgentMode: true });
      manager.updateAgentState({ agentType: 'claude' });

      const history = manager.getStateHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[history.length - 1].stateKey).toBe('agent');
    });

    it('should detect critical state correctly', () => {
      expect(manager.hasCriticalStateActive()).toBe(false);
      
      manager.updateIMEState({ isActive: true });
      expect(manager.hasCriticalStateActive()).toBe(true);
      
      manager.resetAllState();
      expect(manager.hasCriticalStateActive()).toBe(false);
      
      manager.updateKeyboardState({ isInChordMode: true });
      expect(manager.hasCriticalStateActive()).toBe(true);
    });
  });

  describe('Lifecycle', () => {
    it('should remove listeners', () => {
      const listener = vi.fn();
      manager.addStateListener('ime', listener);
      manager.removeStateListener('ime', listener);

      manager.updateIMEState({ isActive: true });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should reset all state', () => {
      manager.updateAltClickState({ clickCount: 5 });
      manager.resetAllState();
      expect(manager.getStateSection('altClick').clickCount).toBe(0);
    });

    it('should cleanup on dispose', () => {
      manager.addStateListener('ime', vi.fn());
      manager.dispose();
      
      // Verification of internal cleanup (listeners cleared)
      expect(manager.getStateHistory()).toEqual([]);
    });
  });
});