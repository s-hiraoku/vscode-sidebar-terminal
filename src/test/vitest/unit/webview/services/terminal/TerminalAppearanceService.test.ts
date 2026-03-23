import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TerminalAppearanceService } from '../../../../../../webview/services/terminal/TerminalAppearanceService';

describe('TerminalAppearanceService', () => {
  let dom: JSDOM;
  let service: TerminalAppearanceService;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><body></body>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Element', dom.window.Element);

    service = new TerminalAppearanceService({
      coordinator: {
        currentSettings: {
          theme: 'dark',
          multiCursorModifier: 'ctrlCmd',
        },
      },
    });
  });

  afterEach(() => {
    dom.window.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('prefers submitted font settings and coordinator theme fallback when preparing config', () => {
    const result = service.prepareTerminalConfig(
      {
        fontFamily: 'JetBrains Mono',
        fontSize: 16,
      } as any,
      {
        getCurrentSettings: vi.fn().mockReturnValue({ theme: 'auto' }),
        getCurrentFontSettings: vi.fn().mockReturnValue({
          fontFamily: 'Fira Code',
          fontSize: 14,
        }),
      }
    );

    expect(result.currentSettings?.theme).toBe('dark');
    expect(result.currentFontSettings?.fontFamily).toBe('JetBrains Mono');
    expect(result.currentFontSettings?.fontSize).toBe(16);
    expect(result.terminalConfig.fontFamily).toBe('JetBrains Mono');
    expect(result.terminalConfig.fontSize).toBe(16);
    expect(result.linkModifier).toBe('ctrlCmd');
  });

  it('applies visual settings and updates terminal backgrounds after open', () => {
    const terminal = {} as any;
    const container = document.createElement('div');
    const terminalContent = document.createElement('div');
    const xterm = document.createElement('div');
    xterm.className = 'xterm';
    const viewport = document.createElement('div');
    viewport.className = 'xterm-viewport';
    container.appendChild(xterm);
    container.appendChild(viewport);

    const uiManager = {
      applyAllVisualSettings: vi.fn(),
      applyFontSettings: vi.fn(),
    };

    service.applyPostOpenSettings({
      terminalId: 'terminal-1',
      terminal,
      container,
      terminalContent,
      currentSettings: { theme: 'dark' },
      currentFontSettings: { fontFamily: 'JetBrains Mono', fontSize: 14 },
      configManager: undefined,
      uiManager,
    });

    expect(uiManager.applyAllVisualSettings).toHaveBeenCalledWith(terminal, { theme: 'dark' });
    expect(uiManager.applyFontSettings).toHaveBeenCalledWith(terminal, {
      fontFamily: 'JetBrains Mono',
      fontSize: 14,
    });
    expect(terminalContent.style.backgroundColor).not.toBe('');
    expect(xterm.style.backgroundColor).not.toBe('');
    expect(viewport.style.backgroundColor).not.toBe('');
  });
});
