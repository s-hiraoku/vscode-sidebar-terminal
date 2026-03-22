import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { SplitManager } from '../../../../../../webview/managers/SplitManager';
import { TerminalDomService } from '../../../../../../webview/services/terminal/TerminalDomService';

describe('TerminalDomService', () => {
  let dom: JSDOM;
  let splitManager: SplitManager;
  let service: TerminalDomService;
  let coordinator: any;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <body>
        <div id="terminal-view">
          <div id="terminal-body"></div>
        </div>
      </body>
    `);
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Element', dom.window.Element);

    splitManager = new SplitManager({ postMessageToExtension: vi.fn() } as any);
    coordinator = {
      postMessageToExtension: vi.fn(),
      setActiveTerminalId: vi.fn(),
      closeTerminal: vi.fn(),
      deleteTerminalSafely: vi.fn(),
      handleAiAgentToggle: vi.fn(),
      profileManager: {
        createTerminalWithDefaultProfile: vi.fn(),
      },
      getManagers: vi.fn().mockReturnValue({
        tabs: {
          addTab: vi.fn(),
          handleTerminalRenamed: vi.fn(),
        },
      }),
    };

    service = new TerminalDomService({
      splitManager,
      coordinator,
    });
  });

  afterEach(() => {
    dom.window.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates terminals-wrapper on demand, appends container, and applies active border styling', () => {
    const uiManager = {
      applyVSCodeStyling: vi.fn(),
      updateSingleTerminalBorder: vi.fn(),
    };

    const result = service.createAndInsertContainer({
      terminalId: 'terminal-1',
      terminalName: 'Terminal 1',
      config: { isActive: true } as any,
      terminalNumber: undefined,
      currentSettings: { enableTerminalHeaderEnhancements: true },
      uiManager,
    });

    const wrapper = document.getElementById('terminals-wrapper');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.contains(result.container)).toBe(true);
    expect(result.terminalNumberToUse).toBe(1);
    expect(uiManager.applyVSCodeStyling).toHaveBeenCalledWith(result.container);
    expect(uiManager.updateSingleTerminalBorder).toHaveBeenCalledWith(result.container, true);
  });

  it('reuses the first available terminal number when the id does not encode one', () => {
    splitManager.getTerminals().set('terminal-1', { number: 1 } as any);
    splitManager.getTerminals().set('terminal-3', { number: 3 } as any);

    const result = service.createAndInsertContainer({
      terminalId: 'session-restored',
      terminalName: 'Recovered Terminal',
      config: undefined,
      terminalNumber: undefined,
      currentSettings: undefined,
      uiManager: undefined,
    });

    expect(result.terminalNumberToUse).toBe(2);
  });
});
