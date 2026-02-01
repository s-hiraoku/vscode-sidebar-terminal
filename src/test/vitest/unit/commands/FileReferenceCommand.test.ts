import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';

// Import shared test setup
import { FileReferenceCommand } from '../../../../commands/FileReferenceCommand';

describe('FileReferenceCommand', () => {
  let fileReferenceCommand: FileReferenceCommand;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTerminalManager: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockActiveEditor: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDocument: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      getCurrentGloballyActiveAgent: vi.fn(),
      focusTerminal: vi.fn().mockResolvedValue(undefined),
      sendInput: vi.fn(),
      refreshCliAgentState: vi.fn().mockReturnValue(false),
    };

    // Create FileReferenceCommand instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fileReferenceCommand = new FileReferenceCommand(mockTerminalManager as any);

    // Mock VS Code workspace configuration
    const mockConfig = {
      get: vi.fn().mockReturnValue(true), // CLI Agent integration enabled
    };
    (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);

    // Mock workspace folders
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vscode.window as any).activeTextEditor = mockActiveEditor;

    // Mock commands
    (vscode.commands.executeCommand as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Mock notifications
    (vscode.window.showInformationMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (vscode.window.showWarningMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getActiveFileInfo', () => {
    it('should return file info without selection when no text is selected', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vscode.window as any).activeTextEditor = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (fileReferenceCommand as any).getActiveFileInfo();

      expect(result).toBeNull();
    });
  });

  describe('formatFileReference', () => {
    it('should format file reference without line numbers when no selection', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (fileReferenceCommand as any).formatFileReference(fileInfo);

      expect(result).toBe('@src/test.ts#L3-L7 ');
    });
  });

  describe('handleSendAtMention', () => {
    it('should send file reference without line numbers when no selection', async () => {
      fileReferenceCommand.handleSendAtMention();

      // Verify that the correct text was sent
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith(
        '@src/test.ts ',
        'terminal-1'
      );
    });

    it('should send file reference with line numbers when text is selected', async () => {
      // Mock selection
      mockSelection.isEmpty = false;
      mockSelection.start = { line: 2 }; // 0-based
      mockSelection.end = { line: 6 }; // 0-based

      fileReferenceCommand.handleSendAtMention();

      // Verify that the correct text with line range was sent
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith(
        '@src/test.ts#L3-L7 ',
        'terminal-1'
      );
    });

    it('should show warning when no active editor', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);

      fileReferenceCommand.handleSendAtMention();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'File reference shortcuts are disabled. Enable them in Terminal Settings.'
      );
    });
  });
});
