
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeybindingService } from '../../../../../../../webview/managers/input/services/KeybindingService';

describe('KeybindingService', () => {
  let service: KeybindingService;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = vi.fn();
    service = new KeybindingService(mockLogger);
    vi.stubGlobal('navigator', { platform: 'Win32' });
  });

  describe('Keybinding Resolution', () => {
    it('should resolve split terminal on Windows', () => {
      const event = {
        key: '5',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false
      } as KeyboardEvent;
      
      expect(service.resolveKeybinding(event)).toBe('workbench.action.terminal.split');
    });

    it('should resolve split terminal on macOS', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      const event = {
        key: '5',
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        metaKey: true
      } as KeyboardEvent;
      
      expect(service.resolveKeybinding(event)).toBe('workbench.action.terminal.split');
    });

    it('should resolve clear terminal correctly by platform', () => {
      // Windows: Ctrl+L (Legacy shell support included in map)
      const winEvent = { key: 'l', ctrlKey: true } as any;
      expect(service.resolveKeybinding(winEvent)).toBe('workbench.action.terminal.clear');

      // Mac: Meta+K
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      const macEvent = { key: 'k', metaKey: true } as any;
      expect(service.resolveKeybinding(macEvent)).toBe('workbench.action.terminal.clear');
    });
  });

  describe('shouldSkipShell', () => {
    it('should skip shell for default terminal commands', () => {
      const event = {} as KeyboardEvent;
      expect(service.shouldSkipShell(event, 'workbench.action.terminal.new')).toBe(true);
    });

    it('should NOT skip shell if sendKeybindingsToShell is true', () => {
      service.updateSettings({ sendKeybindingsToShell: true });
      const event = {} as KeyboardEvent;
      expect(service.shouldSkipShell(event, 'workbench.action.terminal.new')).toBe(false);
    });

    it('should skip shell in chord mode', () => {
      service.setChordMode(true);
      const event = { key: 'a' } as KeyboardEvent;
      expect(service.shouldSkipShell(event)).toBe(true);
    });

    it('should NOT skip shell for Escape even in chord mode', () => {
      service.setChordMode(true);
      const event = { key: 'Escape' } as KeyboardEvent;
      expect(service.shouldSkipShell(event)).toBe(false);
    });
  });

  describe('Settings Updates', () => {
    it('should allow adding custom commands to skip list', () => {
      service.updateSettings({ commandsToSkipShell: ['my.custom.command'] });
      expect(service.shouldSkipShell({} as any, 'my.custom.command')).toBe(true);
    });

    it('should allow removing default commands from skip list using minus prefix', () => {
      service.updateSettings({ commandsToSkipShell: ['-workbench.action.terminal.new'] });
      expect(service.shouldSkipShell({} as any, 'workbench.action.terminal.new')).toBe(false);
    });
  });

  describe('System Keybindings', () => {
    it('should detect Cmd+Q on Mac', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      const event = { key: 'q', metaKey: true } as any;
      expect(service.shouldSkipShell(event)).toBe(true);
    });

    it('should detect Alt+F4 on Win', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      const event = { key: 'F4', altKey: true } as any;
      expect(service.shouldSkipShell(event)).toBe(true);
    });
  });
});
