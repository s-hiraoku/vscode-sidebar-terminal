/**
 * CliAgentStatusService Test Suite - CLI Agent status display management
 *
 * TDD Pattern: Covers status updates, debouncing, and header integration
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { CliAgentStatusService } from '../../../../../../webview/managers/ui/CliAgentStatusService';
import { HeaderFactory, TerminalHeaderElements } from '../../../../../../webview/factories/HeaderFactory';

describe('CliAgentStatusService', () => {
  let cliAgentStatusService: CliAgentStatusService;
  let mockHeaderElementsCache: Map<string, TerminalHeaderElements>;
  let mockHeaderElements1: TerminalHeaderElements;
  let mockHeaderElements2: TerminalHeaderElements;
  let insertCliAgentStatusSpy: ReturnType<typeof vi.spyOn>;
  let removeCliAgentStatusSpy: ReturnType<typeof vi.spyOn>;
  let setAiAgentToggleButtonVisibilitySpy: ReturnType<typeof vi.spyOn>;
  let dom: JSDOM;

  beforeEach(() => {
    // CRITICAL: Create JSDOM in beforeEach to prevent test pollution
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
    });

    // Set up global DOM
    (global as any).document = dom.window.document;
    (global as any).window = dom.window;
    (global as any).HTMLElement = dom.window.HTMLElement;

    // Create mock header elements
    const createMockHeaderElements = (terminalName: string): TerminalHeaderElements => {
      const container = document.createElement('div');
      container.className = 'terminal-header';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'terminal-name';
      nameSpan.textContent = terminalName;

      return {
        container,
        nameSpan,
        idSpan: document.createElement('span'),
        titleSection: document.createElement('div'),
        statusSection: document.createElement('div'),
        statusSpan: null,
        indicator: null,
        controlsSection: document.createElement('div'),
        closeButton: document.createElement('button'),
        aiAgentToggleButton: document.createElement('button'),
        splitButton: document.createElement('button'),
      };
    };

    mockHeaderElements1 = createMockHeaderElements('Terminal 1');
    mockHeaderElements2 = createMockHeaderElements('Terminal 2');

    mockHeaderElementsCache = new Map([
      ['terminal-1', mockHeaderElements1],
      ['terminal-2', mockHeaderElements2],
    ]);

    // Spy on HeaderFactory methods
    insertCliAgentStatusSpy = vi
      .spyOn(HeaderFactory, 'insertCliAgentStatus')
      .mockImplementation(() => {});
    removeCliAgentStatusSpy = vi
      .spyOn(HeaderFactory, 'removeCliAgentStatus')
      .mockImplementation(() => {});
    setAiAgentToggleButtonVisibilitySpy = vi
      .spyOn(HeaderFactory, 'setAiAgentToggleButtonVisibility')
      .mockImplementation(() => {});

    cliAgentStatusService = new CliAgentStatusService();
  });

  afterEach(() => {
    // CRITICAL: Use try-finally to ensure all cleanup happens
    try {
      vi.restoreAllMocks();
    } finally {
      try {
        // CRITICAL: Close JSDOM window to prevent memory leaks
        dom.window.close();
      } finally {
        // CRITICAL: Clean up global DOM state to prevent test pollution
        delete (global as any).document;
        delete (global as any).window;
        delete (global as any).HTMLElement;
      }
    }
  });

  describe('Initialization', () => {
    it('should create instance correctly', () => {
      expect(cliAgentStatusService).toBeInstanceOf(CliAgentStatusService);
    });
  });

  describe('Update CLI Agent Status Display', () => {
    it('should update status for matching terminal name', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalledTimes(1);
      expect(insertCliAgentStatusSpy).toHaveBeenCalledWith(
        mockHeaderElements1,
        'connected',
        'Claude Code'
      );
    });

    it('should not insert status for non-matching terminal', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      // Should not insert for Terminal 2
      const callsForTerminal2 = insertCliAgentStatusSpy.mock.calls.filter(
        (call) => call[0] === mockHeaderElements2
      );
      expect(callsForTerminal2.length).toBe(0);
    });

    it('should remove status from all terminals when status is none', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'none',
        mockHeaderElementsCache,
        null
      );

      expect(removeCliAgentStatusSpy).toHaveBeenCalledTimes(2);
    });

    it('should set AI Agent toggle button visibility for all terminals', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(setAiAgentToggleButtonVisibilitySpy).toHaveBeenCalledTimes(2);
    });

    it('should handle disconnected status', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'disconnected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalledWith(
        mockHeaderElements1,
        'disconnected',
        'Claude Code'
      );
    });

    it('should handle null agent type', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'connected',
        mockHeaderElementsCache,
        null
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalledWith(mockHeaderElements1, 'connected', null);
    });

    it('should handle empty cache gracefully', () => {
      const emptyCache = new Map<string, TerminalHeaderElements>();

      expect(() => {
        cliAgentStatusService.updateCliAgentStatusDisplay(
          'Terminal 1',
          'connected',
          emptyCache,
          'Claude Code'
        );
      }).not.toThrow();

      expect(insertCliAgentStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('Update CLI Agent Status By Terminal ID', () => {
    it('should update status for specific terminal ID', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalledTimes(1);
      expect(insertCliAgentStatusSpy).toHaveBeenCalledWith(
        mockHeaderElements1,
        'connected',
        'Claude Code'
      );
    });

    it('should handle disconnected status by terminal ID', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'disconnected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalledWith(
        mockHeaderElements1,
        'disconnected',
        'Claude Code'
      );
    });

    it('should handle none status by terminal ID', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'none',
        mockHeaderElementsCache,
        null
      );

      expect(removeCliAgentStatusSpy).toHaveBeenCalledTimes(1);
      expect(removeCliAgentStatusSpy).toHaveBeenCalledWith(mockHeaderElements1);
    });

    it('should handle missing terminal ID gracefully', () => {
      expect(() => {
        cliAgentStatusService.updateCliAgentStatusByTerminalId(
          'nonexistent-terminal',
          'connected',
          mockHeaderElementsCache,
          'Claude Code'
        );
      }).not.toThrow();

      expect(insertCliAgentStatusSpy).not.toHaveBeenCalled();
    });

    it('should set AI Agent toggle button visibility', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(setAiAgentToggleButtonVisibilitySpy).toHaveBeenCalledTimes(1);
      expect(setAiAgentToggleButtonVisibilitySpy).toHaveBeenCalledWith(
        mockHeaderElements1,
        true,
        'connected'
      );
    });
  });

  describe('Debouncing', () => {
    it('should allow first update', () => {
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).toBe(true);
    });

    it('should block rapid successive updates', () => {
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).toBe(true);
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).toBe(false);
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).toBe(false);
    });

    it('should allow update after debounce period', async () => {
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).toBe(true);

      // Wait for debounce period (100ms) - using real setTimeout
      await new Promise((resolve) => setTimeout(resolve, 110));

      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).toBe(true);
    });
  });

  describe('Agent Type Handling', () => {
    it('should pass Claude Code agent type', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalled();
      expect(insertCliAgentStatusSpy.mock.calls[0][2]).toBe('Claude Code');
    });

    it('should pass GitHub Copilot agent type', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'GitHub Copilot'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalled();
      expect(insertCliAgentStatusSpy.mock.calls[0][2]).toBe('GitHub Copilot');
    });

    it('should pass Gemini CLI agent type', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'Gemini CLI'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalled();
      expect(insertCliAgentStatusSpy.mock.calls[0][2]).toBe('Gemini CLI');
    });
  });

  describe('Status Values', () => {
    it('should handle connected status correctly', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'Test Agent'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalledWith(
        mockHeaderElements1,
        'connected',
        'Test Agent'
      );
    });

    it('should handle disconnected status correctly', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'disconnected',
        mockHeaderElementsCache,
        'Test Agent'
      );

      expect(insertCliAgentStatusSpy).toHaveBeenCalledWith(
        mockHeaderElements1,
        'disconnected',
        'Test Agent'
      );
    });

    it('should handle none status correctly', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'none',
        mockHeaderElementsCache,
        null
      );

      expect(removeCliAgentStatusSpy).toHaveBeenCalledWith(mockHeaderElements1);
    });
  });
});
