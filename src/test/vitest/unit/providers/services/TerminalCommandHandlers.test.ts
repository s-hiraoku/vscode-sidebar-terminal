/**
 * TerminalCommandHandlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { TerminalCommandHandlers } from '../../../../../providers/services/TerminalCommandHandlers';

// Mock VS Code API
vi.mock('vscode', () => ({
  env: {
    clipboard: {
      readText: vi.fn().mockResolvedValue('clipboard content'),
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  },
  window: {
    showErrorMessage: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

// Mock UnifiedConfigurationService
const { mockUnifiedConfig } = vi.hoisted(() => ({
  mockUnifiedConfig: {
    getTerminalProfilesConfig: vi.fn().mockReturnValue({ profiles: { linux: {} }, defaultProfiles: {} }),
    getWebViewFontSettings: vi.fn().mockReturnValue({ fontSize: 14 }),
  }
}));

vi.mock('../../../../../config/UnifiedConfigurationService', () => ({
  getUnifiedConfigurationService: vi.fn(() => mockUnifiedConfig),
}));

describe('TerminalCommandHandlers', () => {
  let handlers: TerminalCommandHandlers;
  let mockTerminalManager: any;
  let mockCommService: any;
  let mockLinkResolver: any;

  beforeEach(() => {
    mockTerminalManager = {
      getActiveTerminalId: vi.fn().mockReturnValue('t1'),
      setActiveTerminal: vi.fn(),
      createTerminal: vi.fn().mockReturnValue('t-new'),
      getCurrentState: vi.fn().mockReturnValue({}),
      getTerminals: vi.fn().mockReturnValue([]),
      sendInput: vi.fn(),
      resize: vi.fn(),
      removeTerminal: vi.fn(),
      killTerminal: vi.fn().mockResolvedValue(undefined),
      reorderTerminals: vi.fn(),
      getTerminal: vi.fn().mockReturnValue({ shellPath: '/bin/bash' }),
      switchAiAgentConnection: vi.fn().mockReturnValue({ success: true, newStatus: 'connected' }),
    };
    
    mockCommService = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };
    
    mockLinkResolver = {
      handleOpenTerminalLink: vi.fn(),
    };

    handlers = new TerminalCommandHandlers({
      terminalManager: mockTerminalManager,
      communicationService: mockCommService,
      linkResolver: mockLinkResolver,
      getSplitDirection: () => 'vertical'
    });
    
    vi.clearAllMocks();
  });

  describe('Terminal Lifecycle Commands', () => {
    it('should handle focus terminal', async () => {
      await handlers.handleFocusTerminal({ command: 'focusTerminal', terminalId: 't2' });
      expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('t2');
    });

    it('should handle create terminal', async () => {
      await handlers.handleCreateTerminal({ command: 'createTerminal' });
      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
      expect(mockCommService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'stateUpdate' }));
    });

    it('should handle split terminal', () => {
      handlers.handleSplitTerminal({ command: 'splitTerminal', direction: 'horizontal' });
      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
      expect(mockCommService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ 
        command: 'split',
        direction: 'horizontal'
      }));
    });

    it('should handle kill terminal', async () => {
      await handlers.handleKillTerminal({ command: 'killTerminal', terminalId: 't1' });
      expect(mockTerminalManager.killTerminal).toHaveBeenCalledWith('t1');
      expect(mockCommService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'terminalRemoved' }));
    });
  });

  describe('Terminal Interaction Commands', () => {
    it('should handle terminal input', () => {
      handlers.handleTerminalInput({ command: 'input', terminalId: 't1', data: 'ls\n' });
      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith('ls\n', 't1');
    });

    it('should handle terminal resize', () => {
      handlers.handleTerminalResize({ command: 'resize', terminalId: 't1', cols: 100, rows: 30 });
      expect(mockTerminalManager.resize).toHaveBeenCalledWith(100, 30, 't1');
    });

    it('should handle reorder', async () => {
      await handlers.handleReorderTerminals({ command: 'reorder', order: ['t2', 't1'] });
      expect(mockTerminalManager.reorderTerminals).toHaveBeenCalledWith(['t2', 't1']);
    });
  });

  describe('Clipboard Commands', () => {
    it('should handle clipboard request (paste)', async () => {
      await handlers.handleClipboardRequest({ command: 'paste', terminalId: 't1' });
      expect(vscode.env.clipboard.readText).toHaveBeenCalled();
      // Text is wrapped with bracketed paste mode escape sequences
      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith(
        '\x1b[200~clipboard content\x1b[201~',
        't1'
      );
    });

    it('should handle copy to clipboard', async () => {
      await handlers.handleCopyToClipboard({ command: 'copy', text: 'selected text' });
      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('selected text');
    });
  });

  describe('Other Commands', () => {
    it('should handle terminal link', async () => {
      const msg = { command: 'openLink', linkType: 'url', url: 'http://test.com' };
      await handlers.handleOpenTerminalLink(msg as any);
      expect(mockLinkResolver.handleOpenTerminalLink).toHaveBeenCalledWith(msg);
    });

    it('should handle AI agent switch', async () => {
      await handlers.handleSwitchAiAgent({ command: 'switchAgent', terminalId: 't1' });
      expect(mockTerminalManager.switchAiAgentConnection).toHaveBeenCalledWith('t1');
      expect(mockCommService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'switchAiAgentResponse' }));
    });
  });
});
