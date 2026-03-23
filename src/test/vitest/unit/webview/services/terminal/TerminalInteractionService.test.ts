import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { EventHandlerRegistry } from '../../../../../../webview/utils/EventHandlerRegistry';
import { TerminalInteractionService } from '../../../../../../webview/services/terminal/TerminalInteractionService';

describe('TerminalInteractionService', () => {
  let dom: JSDOM;
  let eventRegistry: EventHandlerRegistry;
  let service: TerminalInteractionService;
  let coordinator: any;
  let terminal: any;
  let container: HTMLElement;
  let terminalContent: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><body></body>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Element', dom.window.Element);

    eventRegistry = new EventHandlerRegistry();
    coordinator = {
      postMessageToExtension: vi.fn(),
      shellIntegrationManager: {
        decorateTerminalOutput: vi.fn(),
      },
    };

    terminal = {
      open: vi.fn(),
      attachCustomKeyEventHandler: vi.fn(),
    };
    container = document.createElement('div');
    terminalContent = document.createElement('div');

    service = new TerminalInteractionService({
      coordinator,
      eventRegistry,
      lifecycleController: {
        attachTerminal: vi.fn(),
      } as any,
      eventManager: {
        setupTerminalEvents: vi.fn(),
      } as any,
      focusService: {
        ensureTerminalFocus: vi.fn(),
        setupContainerFocusHandler: vi.fn(),
      } as any,
    });
  });

  afterEach(() => {
    eventRegistry.dispose();
    dom.window.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens the terminal and wires focus, lifecycle, event, and shell integration', () => {
    const applyPostOpenSettings = vi.fn();

    service.setupTerminalInteraction({
      terminalId: 'terminal-1',
      terminal,
      container,
      terminalContent,
      currentSettings: undefined,
      currentFontSettings: undefined,
      configManager: undefined,
      uiManager: undefined,
      applyPostOpenSettings,
    });

    expect(terminal.open).toHaveBeenCalledWith(terminalContent);
    expect(applyPostOpenSettings).toHaveBeenCalled();
    expect(coordinator.shellIntegrationManager.decorateTerminalOutput).toHaveBeenCalledWith(
      terminal,
      'terminal-1'
    );
  });

  it('routes text paste and image paste to the extension instead of xterm default handling', () => {
    service.setupTerminalInteraction({
      terminalId: 'terminal-1',
      terminal,
      container,
      terminalContent,
      currentSettings: undefined,
      currentFontSettings: undefined,
      configManager: undefined,
      uiManager: undefined,
      applyPostOpenSettings: vi.fn(),
    });

    const textPasteEvent = new dom.window.Event('paste', {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent;
    Object.defineProperty(textPasteEvent, 'clipboardData', {
      value: {
        items: [],
        getData: vi.fn().mockReturnValue('hello'),
      },
    });

    terminalContent.dispatchEvent(textPasteEvent);

    expect(coordinator.postMessageToExtension).toHaveBeenCalledWith({
      command: 'pasteText',
      terminalId: 'terminal-1',
      text: 'hello',
    });

    const imagePasteEvent = new dom.window.Event('paste', {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent;
    Object.defineProperty(imagePasteEvent, 'clipboardData', {
      value: {
        items: [{ type: 'image/png' }],
        getData: vi.fn().mockReturnValue(''),
      },
    });

    terminalContent.dispatchEvent(imagePasteEvent);

    expect(coordinator.postMessageToExtension).toHaveBeenCalledWith({
      command: 'input',
      terminalId: 'terminal-1',
      data: '\x16',
    });
  });
});
