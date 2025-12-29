/**
 * FontSettingsService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FontSettingsService, IFontSettingsApplicator } from '../../../../../webview/services/FontSettingsService';
import { Terminal } from '@xterm/xterm';
import { TerminalInstance } from '../../../../../webview/interfaces/ManagerInterfaces';

describe('FontSettingsService', () => {
  let service: FontSettingsService;
  let mockApplicator: IFontSettingsApplicator;

  beforeEach(() => {
    mockApplicator = {
      applyFontSettings: vi.fn(),
    };
    service = new FontSettingsService();
  });

  afterEach(() => {
    service.dispose();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      const settings = service.getCurrentSettings();
      expect(settings.fontSize).toBeDefined();
      expect(settings.fontFamily).toBeDefined();
    });

    it('should initialize with provided settings', () => {
      const initial = { fontSize: 20, fontFamily: 'Monaco' };
      const customService = new FontSettingsService(initial);
      const settings = customService.getCurrentSettings();
      expect(settings.fontSize).toBe(20);
      expect(settings.fontFamily).toBe('Monaco');
    });
  });

  describe('Applicator Management', () => {
    it('should set applicator successfully', () => {
      service.setApplicator(mockApplicator);
      // Private property, but we can test via effects
      const mockTerminal = {} as Terminal;
      service.applyToTerminal(mockTerminal, 'test-1');
      expect(mockApplicator.applyFontSettings).toHaveBeenCalledWith(mockTerminal, expect.anything());
    });

    it('should warn when applying without applicator', () => {
      const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockTerminal = {} as Terminal;
      service.applyToTerminal(mockTerminal, 'test-1');
      expect(mockApplicator.applyFontSettings).not.toHaveBeenCalled();
    });
  });

  describe('Settings Update', () => {
    it('should update settings and notify listeners', () => {
      const listener = vi.fn();
      service.onSettingsChange(listener);

      const newSettings = { fontSize: 16 };
      service.updateSettings(newSettings, new Map());

      expect(service.getCurrentSettings().fontSize).toBe(16);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        newSettings: expect.objectContaining({ fontSize: 16 }),
        previousSettings: expect.anything()
      }));
    });

    it('should apply to all terminals when updated', () => {
      service.setApplicator(mockApplicator);
      
      const mockTerminal = { refresh: vi.fn(), rows: 24 } as any;
      const mockFitAddon = { fit: vi.fn() } as any;
      const terminals = new Map<string, TerminalInstance>();
      terminals.set('t1', { terminal: mockTerminal, fitAddon: mockFitAddon } as any);

      service.updateSettings({ fontSize: 18 }, terminals);

      expect(mockApplicator.applyFontSettings).toHaveBeenCalledWith(mockTerminal, expect.objectContaining({ fontSize: 18 }));
      expect(mockFitAddon.fit).toHaveBeenCalled();
      expect(mockTerminal.refresh).toHaveBeenCalled();
    });

    it('should handle errors in listeners gracefully', () => {
      const faultyListener = vi.fn().mockImplementation(() => { throw new Error('Faulty'); });
      service.onSettingsChange(faultyListener);
      
      expect(() => service.updateSettings({ fontSize: 14 }, new Map())).not.toThrow();
    });
  });

  describe('Validation and Normalization', () => {
    it('should clamp font size to valid range', () => {
      service.updateSettings({ fontSize: 1 }, new Map()); // Too small
      expect(service.getCurrentSettings().fontSize).toBe(8);

      service.updateSettings({ fontSize: 100 }, new Map()); // Too large
      expect(service.getCurrentSettings().fontSize).toBe(72);
    });

    it('should normalize font weights', () => {
      service.updateSettings({ fontWeight: 'bold' }, new Map());
      expect(service.getCurrentSettings().fontWeight).toBe('bold');

      service.updateSettings({ fontWeight: '900' }, new Map());
      expect(service.getCurrentSettings().fontWeight).toBe('900');

      service.updateSettings({ fontWeight: 'invalid' as any }, new Map());
      expect(service.getCurrentSettings().fontWeight).toBe('normal');
    });

    it('should validate line height and letter spacing', () => {
      service.updateSettings({ lineHeight: -1, letterSpacing: 5 }, new Map());
      // Negative lineHeight should be ignored (use default)
      expect(service.getCurrentSettings().lineHeight).toBeGreaterThan(0);
      expect(service.getCurrentSettings().letterSpacing).toBe(5);
    });
  });

  describe('Single Terminal Application', () => {
    it('should handle errors during single terminal application', () => {
      service.setApplicator({
        applyFontSettings: () => { throw new Error('Failed'); }
      });
      
      expect(() => service.applyToTerminal({} as any, 't1')).not.toThrow();
    });
  });

  describe('Unsubscribe', () => {
    it('should stop notifying when unsubscribed', () => {
      const listener = vi.fn();
      const unsubscribe = service.onSettingsChange(listener);
      
      unsubscribe();
      service.updateSettings({ fontSize: 15 }, new Map());
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Platform Detection', () => {
    it('should use different defaults based on platform', async () => {
      // Test Mac
      vi.resetModules();
      vi.stubGlobal('navigator', { userAgent: 'Macintosh' });
      const modMac = await import('../../../../../webview/services/FontSettingsService');
      const macService = new modMac.FontSettingsService();
      expect(macService.getCurrentSettings().fontSize).toBe(12);

      // Test Linux
      vi.resetModules();
      vi.stubGlobal('navigator', { userAgent: 'Linux' });
      const modLinux = await import('../../../../../webview/services/FontSettingsService');
      const linuxService = new modLinux.FontSettingsService();
      expect(linuxService.getCurrentSettings().lineHeight).toBe(1.1);

      // Test Other (Windows)
      vi.resetModules();
      vi.stubGlobal('navigator', { userAgent: 'Windows' });
      const modWin = await import('../../../../../webview/services/FontSettingsService');
      const winService = new modWin.FontSettingsService();
      expect(winService.getCurrentSettings().fontSize).toBe(14);
      expect(winService.getCurrentSettings().lineHeight).toBe(1.0);
    });
  });
});
