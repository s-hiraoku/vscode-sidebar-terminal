import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ThemeManager } from '../../../../../webview/utils/ThemeManager';

describe('ThemeManager', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div class="test-element"></div></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('getComputedStyle', dom.window.getComputedStyle);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);

    ThemeManager.dispose();
  });

  afterEach(() => {
    ThemeManager.dispose();
    vi.restoreAllMocks();
    dom.window.close();
    vi.unstubAllGlobals();
  });

  describe('getThemeColors', () => {
    it('should return default colors initially', () => {
      const colors = ThemeManager.getThemeColors();
      expect(colors.background).toBe('#1e1e1e');
    });

    it('should update colors from CSS variables', () => {
      document.documentElement.style.setProperty('--vscode-editor-background', '#ff0000');
      
      ThemeManager.initialize();
      const colors = ThemeManager.getThemeColors();
      
      expect(colors.background).toBe('#ff0000');
    });
  });

  describe('applyTheme', () => {
    it('should apply colors to element style', () => {
      const element = document.createElement('div');
      ThemeManager.applyTheme(element, { background: '#00ff00', foreground: '#0000ff' });
      
      expect(element.style.background).toBe('rgb(0, 255, 0)');
      expect(element.style.color).toBe('rgb(0, 0, 255)');
    });

    it('should use current theme colors if no custom theme provided', () => {
      const element = document.createElement('div');
      document.documentElement.style.setProperty('--vscode-editor-background', '#ff0000');
      ThemeManager.initialize();
      
      ThemeManager.applyTheme(element);
      expect(element.style.background).toBe('rgb(255, 0, 0)');
    });
  });

  describe('createTerminalTheme', () => {
    it('should create a terminal theme with VS Code colors', () => {
      document.documentElement.style.setProperty('--vscode-terminalCursor-foreground', '#ffff00');
      ThemeManager.initialize();
      
      const theme = ThemeManager.createTerminalTheme();
      expect(theme.cursor).toBe('#ffff00');
    });

    it('should allow overrides', () => {
      const theme = ThemeManager.createTerminalTheme({ background: '#000000' });
      expect(theme.background).toBe('#000000');
    });
  });

  describe('updateElementTheme', () => {
    it('should update all elements matching selector', () => {
      const el1 = document.createElement('div');
      el1.className = 'my-class';
      const el2 = document.createElement('div');
      el2.className = 'my-class';
      document.body.appendChild(el1);
      document.body.appendChild(el2);
      
      ThemeManager.updateElementTheme('.my-class', { backgroundColor: 'red' } as any);
      
      expect(el1.style.backgroundColor).toBe('red');
      expect(el2.style.backgroundColor).toBe('red');
    });
  });

  describe('getThemeVariables', () => {
    it('should return map of VS Code variables', () => {
      document.documentElement.style.setProperty('--vscode-editor-background', '#123456');
      
      const variables = ThemeManager.getThemeVariables();
      expect(variables['--vscode-editor-background']).toBe('#123456');
    });
  });
});