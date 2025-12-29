/**
 * TerminalConfigService Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { TerminalConfigService } from '../../../../../../webview/services/terminal/TerminalConfigService';

describe('TerminalConfigService', () => {
  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = TerminalConfigService.getDefaultConfig();
      expect(config.cursorBlink).toBe(true);
      expect(config.scrollback).toBe(2000);
    });

    it('should handle platform specific font size', async () => {
      // Test Mac
      vi.resetModules();
      vi.stubGlobal('navigator', { userAgent: 'Macintosh' });
      const modMac = await import('../../../../../../webview/services/terminal/TerminalConfigService');
      const macConfig = modMac.TerminalConfigService.getDefaultConfig();
      expect(macConfig.fontSize).toBe(12);

      // Test Linux
      vi.resetModules();
      vi.stubGlobal('navigator', { userAgent: 'Linux' });
      const modLinux = await import('../../../../../../webview/services/terminal/TerminalConfigService');
      const linuxConfig = modLinux.TerminalConfigService.getDefaultConfig();
      expect(linuxConfig.fontSize).toBe(14);
      expect(linuxConfig.lineHeight).toBe(1.1);
    });
  });

  describe('mergeConfig', () => {
    it('should override defaults with user settings', () => {
      const merged = TerminalConfigService.mergeConfig({
        fontSize: 20,
        cursorStyle: 'bar'
      });
      
      expect(merged.fontSize).toBe(20);
      expect(merged.cursorStyle).toBe('bar');
      expect(merged.cursorBlink).toBe(true); // preserved default
    });
  });

  describe('validateConfig', () => {
    it('should accept valid config', () => {
      expect(TerminalConfigService.validateConfig({ fontSize: 14 })).toBe(true);
    });

    it('should reject invalid font size', () => {
      expect(TerminalConfigService.validateConfig({ fontSize: 2 })).toBe(false);
      expect(TerminalConfigService.validateConfig({ fontSize: 100 })).toBe(false);
    });

    it('should reject invalid scrollback', () => {
      expect(TerminalConfigService.validateConfig({ scrollback: -1 })).toBe(false);
    });
  });
});