/**
 * FileReferenceCommand Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';

import '../../../shared/TestSetup';
import { FileReferenceCommand } from '../../../../commands/FileReferenceCommand';

describe('FileReferenceCommand', () => {
  let fileReferenceCommand: FileReferenceCommand;
  let mockTerminalManager: {
    hasActiveTerminal: ReturnType<typeof vi.fn>;
    getActiveTerminalId: ReturnType<typeof vi.fn>;
    getConnectedAgents: ReturnType<typeof vi.fn>;
    sendInput: ReturnType<typeof vi.fn>;
    focusTerminal: ReturnType<typeof vi.fn>;
    refreshCliAgentState: ReturnType<typeof vi.fn>;
    getCurrentGloballyActiveAgent: ReturnType<typeof vi.fn>;
  };
  let mockActiveEditor: any;
  let mockDocument: any;
  let mockSelection: any;

  beforeEach(() => {
    // Mock TerminalManager
    mockTerminalManager = {
      hasActiveTerminal: vi.fn().mockReturnValue(true),
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      getConnectedAgents: vi.fn().mockReturnValue([
        {
          terminalId: 'terminal-1',
          agentInfo: { type: 'claude' },
        },
      ]),
      sendInput: vi.fn(),
      focusTerminal: vi.fn(),
      refreshCliAgentState: vi.fn().mockReturnValue(false),
      getCurrentGloballyActiveAgent: vi.fn().mockReturnValue({
        terminalId: 'terminal-1',
        agentType: 'claude',
      }),
    };

    // Create FileReferenceCommand instance
    fileReferenceCommand = new FileReferenceCommand(mockTerminalManager as any);

    // Mock VS Code workspace configuration
    const mockConfig = {
      get: vi.fn().mockReturnValue(true), // CLI Agent integration enabled
    };
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

    // Mock workspace folders
    (vscode.workspace as any).workspaceFolders = [
      {
        uri: { fsPath: '/workspace/project' },
      },
    ];

    // Mock document
    mockDocument = {
      fileName: '/workspace/project/src/test.ts',
    };

    // Mock selection (empty by default)
    mockSelection = {
      isEmpty: true,
      start: { line: 0 },
      end: { line: 0 },
    };

    // Mock active editor
    mockActiveEditor = {
      document: mockDocument,
      selection: mockSelection,
    };

    (vscode.window as any).activeTextEditor = mockActiveEditor;

    // Mock commands
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    // Mock notifications
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
    vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getActiveFileInfo', () => {
    it('should return file info without selection when no text is selected', () => {
      const result = (fileReferenceCommand as any).getActiveFileInfo();

      expect(result).toEqual({
        baseName: 'test.ts',
        fullPath: '/workspace/project/src/test.ts',
        relativePath: 'src/test.ts',
        selection: undefined,
      });
    });

    it('should return file info with single line selection', () => {
      // Mock single line selection (line 5)
      mockSelection.isEmpty = false;
      mockSelection.start = { line: 4 }; // 0-based
      mockSelection.end = { line: 4 }; // 0-based

      const result = (fileReferenceCommand as any).getActiveFileInfo();

      expect(result).toEqual({
        baseName: 'test.ts',
        fullPath: '/workspace/project/src/test.ts',
        relativePath: 'src/test.ts',
        selection: {
          startLine: 5, // 1-based
          endLine: 5, // 1-based
          hasSelection: true,
        },
      });
    });

    it('should return file info with multi-line selection', () => {
      // Mock multi-line selection (lines 3-7)
      mockSelection.isEmpty = false;
      mockSelection.start = { line: 2 }; // 0-based
      mockSelection.end = { line: 6 }; // 0-based

      const result = (fileReferenceCommand as any).getActiveFileInfo();

      expect(result).toEqual({
        baseName: 'test.ts',
        fullPath: '/workspace/project/src/test.ts',
        relativePath: 'src/test.ts',
        selection: {
          startLine: 3, // 1-based
          endLine: 7, // 1-based
          hasSelection: true,
        },
      });
    });

    it('should return null when no active editor', () => {
      (vscode.window as any).activeTextEditor = null;

      const result = (fileReferenceCommand as any).getActiveFileInfo();

      expect(result).toBeNull();
    });
  });

  describe('formatFileReference', () => {
    it('should format file reference without line numbers when no selection', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
      };

      const result = (fileReferenceCommand as any).formatFileReference(fileInfo);

      expect(result).toBe('@src/test.ts ');
    });

    it('should format file reference with single line number', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
        selection: {
          startLine: 5,
          endLine: 5,
          hasSelection: true,
        },
      };

      const result = (fileReferenceCommand as any).formatFileReference(fileInfo);

      expect(result).toBe('@src/test.ts#L5 ');
    });

    it('should format file reference with line range', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
        selection: {
          startLine: 3,
          endLine: 7,
          hasSelection: true,
        },
      };

      const result = (fileReferenceCommand as any).formatFileReference(fileInfo);

      expect(result).toBe('@src/test.ts#L3-L7 ');
    });
  });

  describe('handleSendAtMention', () => {
    it('should send file reference without line numbers when no selection', async () => {
      fileReferenceCommand.handleSendAtMention();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify that the correct text was sent
      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith('@src/test.ts ', 'terminal-1');
    });

    it('should send file reference with line numbers when text is selected', async () => {
      // Mock selection
      mockSelection.isEmpty = false;
      mockSelection.start = { line: 2 }; // 0-based
      mockSelection.end = { line: 6 }; // 0-based

      fileReferenceCommand.handleSendAtMention();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify that the correct text with line range was sent
      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith(
        '@src/test.ts#L3-L7 ',
        'terminal-1'
      );
    });

    it('should show warning when no active editor', () => {
      (vscode.window as any).activeTextEditor = null;

      fileReferenceCommand.handleSendAtMention();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'No active file to mention. Please open a file first.'
      );
    });

    it('should show warning when CLI Agent integration is disabled', () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue(false), // CLI Agent integration disabled
      };
      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      fileReferenceCommand.handleSendAtMention();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'File reference shortcuts are disabled. Enable them in Terminal Settings.'
      );
    });
  });
});
