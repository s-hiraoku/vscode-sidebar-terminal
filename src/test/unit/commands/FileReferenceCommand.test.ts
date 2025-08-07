/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

// Import shared test setup
import '../test-setup';
import { FileReferenceCommand } from '../../../commands/FileReferenceCommand';
import { TerminalManager } from '../../../terminals/TerminalManager';

describe('FileReferenceCommand', () => {
  let fileReferenceCommand: FileReferenceCommand;
  let mockTerminalManager: sinon.SinonStubbedInstance<TerminalManager>;
  let mockActiveEditor: any;
  let mockDocument: any;
  let mockSelection: any;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock TerminalManager
    mockTerminalManager = sandbox.createStubInstance(TerminalManager);
    mockTerminalManager.hasActiveTerminal.returns(true);
    mockTerminalManager.getActiveTerminalId.returns('terminal-1');
    mockTerminalManager.getConnectedAgents.returns([
      {
        terminalId: 'terminal-1',
        agentInfo: { type: 'claude', status: 'connected' },
      },
    ]);

    // Create FileReferenceCommand instance
    fileReferenceCommand = new FileReferenceCommand(mockTerminalManager as any);

    // Mock VS Code workspace configuration
    const mockConfig = {
      get: sandbox.stub().returns(true), // CLI Agent integration enabled
    };
    (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

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
    (vscode.commands.executeCommand as sinon.SinonStub).resolves();

    // Mock notifications
    (vscode.window.showInformationMessage as sinon.SinonStub).resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getActiveFileInfo', () => {
    it('should return file info without selection when no text is selected', () => {
      const result = (fileReferenceCommand as any).getActiveFileInfo();

      expect(result).to.deep.equal({
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

      expect(result).to.deep.equal({
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

      expect(result).to.deep.equal({
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

      expect(result).to.be.null;
    });
  });

  describe('formatFileReference', () => {
    it('should format file reference without line numbers when no selection', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
      };

      const result = (fileReferenceCommand as any).formatFileReference(fileInfo);

      expect(result).to.equal('@src/test.ts ');
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

      expect(result).to.equal('@src/test.ts#L5 ');
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

      expect(result).to.equal('@src/test.ts#L3-L7 ');
    });
  });

  describe('handleSendAtMention', () => {
    it('should send file reference without line numbers when no selection', (done) => {
      fileReferenceCommand.handleSendAtMention();

      // Verify that the correct text was sent
      setTimeout(() => {
        try {
          expect(mockTerminalManager.sendInput).to.have.been.calledWith(
            '@src/test.ts ',
            'terminal-1'
          );
          done();
        } catch (error) {
          done(error);
        }
      }, 200);
    });

    it('should send file reference with line numbers when text is selected', (done) => {
      // Mock selection
      mockSelection.isEmpty = false;
      mockSelection.start = { line: 2 }; // 0-based
      mockSelection.end = { line: 6 }; // 0-based

      fileReferenceCommand.handleSendAtMention();

      // Verify that the correct text with line range was sent
      setTimeout(() => {
        try {
          expect(mockTerminalManager.sendInput).to.have.been.calledWith(
            '@src/test.ts#L3-L7 ',
            'terminal-1'
          );
          done();
        } catch (error) {
          done(error);
        }
      }, 200);
    });

    it('should show warning when no active editor', () => {
      (vscode.window as any).activeTextEditor = null;

      fileReferenceCommand.handleSendAtMention();

      expect(vscode.window.showWarningMessage).to.have.been.calledWith(
        'No active file to mention. Please open a file first.'
      );
    });

    it('should show warning when CLI Agent integration is disabled', () => {
      const mockConfig = {
        get: sandbox.stub().returns(false), // CLI Agent integration disabled
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      fileReferenceCommand.handleSendAtMention();

      expect(vscode.window.showInformationMessage).to.have.been.calledWith(
        'File reference shortcuts are disabled. Enable them in Terminal Settings.'
      );
    });
  });
});
