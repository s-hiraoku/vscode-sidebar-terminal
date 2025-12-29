/**
 * KeybindingService Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { KeybindingService } from '../../../../../../../webview/managers/input/services/KeybindingService';

describe('KeybindingService', () => {
  let service: KeybindingService;
  let logger: any;

  beforeEach(() => {
    logger = vi.fn();
    service = new KeybindingService(logger);
    
    // Stub navigator
    vi.stubGlobal('navigator', { 
      platform: 'MacIntel',
      clipboard: { readText: vi.fn() }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Settings Management', () => {
    it('should update sendKeybindingsToShell', () => {
      service.updateSettings({ sendKeybindingsToShell: true });
      // Implicitly check via logger or behavior
      // We can't access private property easily, but behavior test covers it
      expect(logger).toHaveBeenCalledWith(expect.stringContaining('sendKeybindingsToShell updated: true'));
    });

    it('should update commandsToSkipShell', () => {
      service.updateSettings({ commandsToSkipShell: ['test.command', '-workbench.action.quickOpen'] });
      expect(logger).toHaveBeenCalledWith(expect.stringContaining('Added command'));
      expect(logger).toHaveBeenCalledWith(expect.stringContaining('Removed command'));
    });

    it('should update allowChords', () => {
      service.updateSettings({ allowChords: false });
      expect(logger).toHaveBeenCalledWith(expect.stringContaining('allowChords updated: false'));
    });
  });

  describe('Keybinding Resolution', () => {
    it('should resolve mac keybindings', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      
      const event = new KeyboardEvent('keydown', { key: 'p', metaKey: true });
      const command = service.resolveKeybinding(event);
      
      expect(command).toBe('workbench.action.quickOpen');
    });

    it('should resolve windows/linux keybindings', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      
      const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true });
      const command = service.resolveKeybinding(event);
      
      expect(command).toBe('workbench.action.quickOpen');
    });

    it('should resolve complex combinations', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      
      const event = new KeyboardEvent('keydown', { key: '5', metaKey: true, shiftKey: true });
      const command = service.resolveKeybinding(event);
      
      expect(command).toBe('workbench.action.terminal.split');
    });

    it('should return null for unknown combinations', () => {
      const event = new KeyboardEvent('keydown', { key: 'unknown' });
      const command = service.resolveKeybinding(event);
      
      expect(command).toBeNull();
    });
  });

  describe('shouldSkipShell', () => {
    it('should skip shell for commands in skip list', () => {
      service.updateSettings({ sendKeybindingsToShell: false });
      
      const event = new KeyboardEvent('keydown', { key: 'p', metaKey: true });
      const skip = service.shouldSkipShell(event, 'workbench.action.quickOpen');
      
      expect(skip).toBe(true);
    });

    it('should NOT skip shell if sendKeybindingsToShell is true', () => {
      service.updateSettings({ sendKeybindingsToShell: true });
      
      const event = new KeyboardEvent('keydown', { key: 'p', metaKey: true });
      const skip = service.shouldSkipShell(event, 'workbench.action.quickOpen');
      
      expect(skip).toBe(false);
    });

    it('should skip shell in chord mode', () => {
      service.setChordMode(true);
      service.updateSettings({ allowChords: true });
      
      const event = new KeyboardEvent('keydown', { key: 'a' });
      const skip = service.shouldSkipShell(event);
      
      expect(skip).toBe(true);
    });

    it('should NOT skip shell in chord mode if escape pressed', () => {
      service.setChordMode(true);
      
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const skip = service.shouldSkipShell(event);
      
      expect(skip).toBe(false);
    });

    it('should detect system keybindings (Windows Alt+F4)', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      
      const event = new KeyboardEvent('keydown', { key: 'F4', altKey: true });
      const skip = service.shouldSkipShell(event);
      
      expect(skip).toBe(true);
    });

    it('should detect mnemonics on Windows', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      service.updateSettings({ allowMnemonics: true });
      
      const event = new KeyboardEvent('keydown', { key: 'f', altKey: true });
      const skip = service.shouldSkipShell(event);
      
      expect(skip).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should manage chord mode', () => {
      service.setChordMode(true);
      expect(service.isChordMode()).toBe(true);
      
      service.setChordMode(false);
      expect(service.isChordMode()).toBe(false);
    });
  });
});