
import { describe, it, expect } from 'vitest';
import { ThemeUtils } from '../../../../../webview/utils/ThemeUtils';

describe('ThemeUtils', () => {
  beforeEach(() => {
    // Reset document body styles
    document.body.style.backgroundColor = '';
    document.body.style.setProperty('--vscode-editor-background', '');
    document.body.style.setProperty('--vscode-panel-background', '');
  });

  describe('detectTheme', () => {
    it('should detect dark theme from hex color', () => {
      document.body.style.setProperty('--vscode-editor-background', '#1e1e1e');
      expect(ThemeUtils.detectTheme()).toBe('dark');
    });

    it('should detect light theme from hex color', () => {
      document.body.style.setProperty('--vscode-editor-background', '#ffffff');
      expect(ThemeUtils.detectTheme()).toBe('light');
    });

    it('should detect dark theme from rgb color', () => {
      document.body.style.setProperty('--vscode-editor-background', 'rgb(30, 30, 30)');
      expect(ThemeUtils.detectTheme()).toBe('dark');
    });

    it('should detect light theme from rgb color', () => {
      document.body.style.setProperty('--vscode-editor-background', 'rgb(255, 255, 255)');
      expect(ThemeUtils.detectTheme()).toBe('light');
    });

    it('should fallback to panel background', () => {
      document.body.style.setProperty('--vscode-panel-background', '#ffffff');
      expect(ThemeUtils.detectTheme()).toBe('light');
    });

    it('should fallback to body background color', () => {
      document.body.style.backgroundColor = '#ffffff';
      expect(ThemeUtils.detectTheme()).toBe('light');
    });

    it('should default to dark if no color found', () => {
      expect(ThemeUtils.detectTheme()).toBe('dark');
    });
  });

  describe('getThemeColors', () => {
    it('should return dark theme colors when theme is dark', () => {
      const colors = ThemeUtils.getThemeColors('dark');
      expect(colors).toBeDefined();
      // Assuming THEME_CONSTANTS.DARK_THEME has background
      expect(colors.background).toBeDefined();
    });

    it('should return light theme colors when theme is light', () => {
      const colors = ThemeUtils.getThemeColors('light');
      expect(colors).toBeDefined();
    });

    it('should detect theme when theme is auto', () => {
      document.body.style.setProperty('--vscode-editor-background', '#ffffff');
      const colors = ThemeUtils.getThemeColors('auto');
      // Should match light theme
      expect(colors.background).toBe('#ffffff');
    });
  });

  describe('calculateBrightness', () => {
    it('should calculate brightness for hex colors', () => {
      expect(ThemeUtils.calculateBrightness('#000000')).toBe(0);
      expect(ThemeUtils.calculateBrightness('#ffffff')).toBe(255);
    });

    it('should calculate brightness for rgb colors', () => {
      expect(ThemeUtils.calculateBrightness('rgb(0, 0, 0)')).toBe(0);
      expect(ThemeUtils.calculateBrightness('rgb(255, 255, 255)')).toBe(255);
    });

    it('should return 0 for invalid colors', () => {
      expect(ThemeUtils.calculateBrightness('invalid')).toBe(0);
    });
  });

  describe('isDarkColor', () => {
    it('should return true for dark colors', () => {
      expect(ThemeUtils.isDarkColor('#000000')).toBe(true);
      expect(ThemeUtils.isDarkColor('#7f7f7f')).toBe(true);
    });

    it('should return false for light colors', () => {
      expect(ThemeUtils.isDarkColor('#ffffff')).toBe(false);
      expect(ThemeUtils.isDarkColor('#808080')).toBe(false);
    });
  });

  describe('getVSCodeColor', () => {
    it('should return value from CSS variable', () => {
      document.documentElement.style.setProperty('--vscode-test-color', '#ff0000');
      expect(ThemeUtils.getVSCodeColor('test-color', '#000000')).toBe('#ff0000');
    });

    it('should return fallback if variable not found', () => {
      expect(ThemeUtils.getVSCodeColor('non-existent', '#000000')).toBe('#000000');
    });
  });
});
