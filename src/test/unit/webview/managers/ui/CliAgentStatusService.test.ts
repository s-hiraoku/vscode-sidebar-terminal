/**
 * CliAgentStatusService Test Suite - CLI Agent status display management
 *
 * TDD Pattern: Covers status updates, debouncing, and header integration
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});
(global as any).document = dom.window.document;
(global as any).window = dom.window;
(global as any).HTMLElement = dom.window.HTMLElement;

import { CliAgentStatusService } from '../../../../../webview/managers/ui/CliAgentStatusService';
import { HeaderFactory, TerminalHeaderElements } from '../../../../../webview/factories/HeaderFactory';

describe('CliAgentStatusService', () => {
  let cliAgentStatusService: CliAgentStatusService;
  let mockHeaderElementsCache: Map<string, TerminalHeaderElements>;
  let mockHeaderElements1: TerminalHeaderElements;
  let mockHeaderElements2: TerminalHeaderElements;
  let insertCliAgentStatusStub: sinon.SinonStub;
  let removeCliAgentStatusStub: sinon.SinonStub;
  let setAiAgentToggleButtonVisibilityStub: sinon.SinonStub;

  beforeEach(() => {
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

    // Stub HeaderFactory methods
    insertCliAgentStatusStub = sinon.stub(HeaderFactory, 'insertCliAgentStatus');
    removeCliAgentStatusStub = sinon.stub(HeaderFactory, 'removeCliAgentStatus');
    setAiAgentToggleButtonVisibilityStub = sinon.stub(HeaderFactory, 'setAiAgentToggleButtonVisibility');

    cliAgentStatusService = new CliAgentStatusService();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Initialization', () => {
    it('should create instance correctly', () => {
      expect(cliAgentStatusService).to.be.instanceOf(CliAgentStatusService);
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

      expect(insertCliAgentStatusStub.calledOnce).to.be.true;
      expect(insertCliAgentStatusStub.calledWith(mockHeaderElements1, 'connected', 'Claude Code')).to.be.true;
    });

    it('should not insert status for non-matching terminal', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      // Should not insert for Terminal 2
      const callsForTerminal2 = insertCliAgentStatusStub.getCalls().filter(
        (call) => call.args[0] === mockHeaderElements2
      );
      expect(callsForTerminal2.length).to.equal(0);
    });

    it('should remove status from all terminals when status is none', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'none',
        mockHeaderElementsCache,
        null
      );

      expect(removeCliAgentStatusStub.callCount).to.equal(2);
    });

    it('should set AI Agent toggle button visibility for all terminals', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(setAiAgentToggleButtonVisibilityStub.callCount).to.equal(2);
    });

    it('should handle disconnected status', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'disconnected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(insertCliAgentStatusStub.calledWith(mockHeaderElements1, 'disconnected', 'Claude Code')).to.be.true;
    });

    it('should handle null agent type', () => {
      cliAgentStatusService.updateCliAgentStatusDisplay(
        'Terminal 1',
        'connected',
        mockHeaderElementsCache,
        null
      );

      expect(insertCliAgentStatusStub.calledWith(mockHeaderElements1, 'connected', null)).to.be.true;
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
      }).to.not.throw();

      expect(insertCliAgentStatusStub.called).to.be.false;
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

      expect(insertCliAgentStatusStub.calledOnce).to.be.true;
      expect(insertCliAgentStatusStub.calledWith(mockHeaderElements1, 'connected', 'Claude Code')).to.be.true;
    });

    it('should handle disconnected status by terminal ID', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'disconnected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(insertCliAgentStatusStub.calledWith(mockHeaderElements1, 'disconnected', 'Claude Code')).to.be.true;
    });

    it('should handle none status by terminal ID', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'none',
        mockHeaderElementsCache,
        null
      );

      expect(removeCliAgentStatusStub.calledOnce).to.be.true;
      expect(removeCliAgentStatusStub.calledWith(mockHeaderElements1)).to.be.true;
    });

    it('should handle missing terminal ID gracefully', () => {
      expect(() => {
        cliAgentStatusService.updateCliAgentStatusByTerminalId(
          'nonexistent-terminal',
          'connected',
          mockHeaderElementsCache,
          'Claude Code'
        );
      }).to.not.throw();

      expect(insertCliAgentStatusStub.called).to.be.false;
    });

    it('should set AI Agent toggle button visibility', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'Claude Code'
      );

      expect(setAiAgentToggleButtonVisibilityStub.calledOnce).to.be.true;
      expect(setAiAgentToggleButtonVisibilityStub.calledWith(mockHeaderElements1, true, 'connected')).to.be.true;
    });
  });

  describe('Debouncing', () => {
    it('should allow first update', () => {
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).to.be.true;
    });

    it('should block rapid successive updates', () => {
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).to.be.true;
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).to.be.false;
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).to.be.false;
    });

    it('should allow update after debounce period', async () => {
      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).to.be.true;

      // Wait for debounce period (100ms)
      await new Promise((resolve) => setTimeout(resolve, 110));

      expect(cliAgentStatusService.shouldProcessCliAgentUpdate()).to.be.true;
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

      expect(insertCliAgentStatusStub.called).to.be.true;
      expect(insertCliAgentStatusStub.firstCall.args[2]).to.equal('Claude Code');
    });

    it('should pass GitHub Copilot agent type', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'GitHub Copilot'
      );

      expect(insertCliAgentStatusStub.called).to.be.true;
      expect(insertCliAgentStatusStub.firstCall.args[2]).to.equal('GitHub Copilot');
    });

    it('should pass Gemini CLI agent type', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'connected',
        mockHeaderElementsCache,
        'Gemini CLI'
      );

      expect(insertCliAgentStatusStub.called).to.be.true;
      expect(insertCliAgentStatusStub.firstCall.args[2]).to.equal('Gemini CLI');
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

      expect(insertCliAgentStatusStub.calledWith(mockHeaderElements1, 'connected', 'Test Agent')).to.be.true;
    });

    it('should handle disconnected status correctly', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'disconnected',
        mockHeaderElementsCache,
        'Test Agent'
      );

      expect(insertCliAgentStatusStub.calledWith(mockHeaderElements1, 'disconnected', 'Test Agent')).to.be.true;
    });

    it('should handle none status correctly', () => {
      cliAgentStatusService.updateCliAgentStatusByTerminalId(
        'terminal-1',
        'none',
        mockHeaderElementsCache,
        null
      );

      expect(removeCliAgentStatusStub.calledWith(mockHeaderElements1)).to.be.true;
    });
  });
});
