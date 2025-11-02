/* eslint-disable */
// @ts-nocheck

// import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

// Import shared test setup
import '../test-setup';
import { CopilotIntegrationCommand } from '../../../commands/CopilotIntegrationCommand';

describe('CopilotIntegrationCommand', () => {
  let copilotIntegrationCommand: CopilotIntegrationCommand;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create CopilotIntegrationCommand instance
    copilotIntegrationCommand = new CopilotIntegrationCommand();

    // Mock VS Code workspace configuration
    const mockConfig = {
      get: sandbox.stub().returns(true), // GitHub Copilot integration enabled by default
    };
    (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

    // Mock commands
    (vscode.commands.executeCommand as sinon.SinonStub).resolves();

    // Mock notifications
    (vscode.window.showInformationMessage as sinon.SinonStub).resolves();
    (vscode.window.showErrorMessage as sinon.SinonStub).resolves();
    (vscode.window.showWarningMessage as sinon.SinonStub).resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('handleActivateCopilot', () => {
    beforeEach(() => {
      // Mock workspace folders
      (vscode.workspace as any).workspaceFolders = [
        {
          uri: { fsPath: '/workspace/project' },
        },
      ];

      // Mock active editor (no selection by default)
      const mockDocument = {
        fileName: '/workspace/project/src/test.ts',
      };
      const mockSelection = {
        isEmpty: true,
        start: { line: 0 },
        end: { line: 0 },
      };
      (vscode.window as any).activeTextEditor = {
        document: mockDocument,
        selection: mockSelection,
      };
    });

    it('should activate Copilot Chat and send file reference when file is open', () => {
      copilotIntegrationCommand.handleActivateCopilot();

      expect(vscode.commands.executeCommand).to.have.been.calledWith('workbench.action.chat.open');
    });

    it('should activate Copilot Chat without file reference when no file is open', () => {
      (vscode.window as any).activeTextEditor = null;

      copilotIntegrationCommand.handleActivateCopilot();

      expect(vscode.commands.executeCommand).to.have.been.calledWith('workbench.action.chat.open');
    });

    it('should show information message when integration is disabled', () => {
      // Reset executeCommand spy to ensure clean state
      (vscode.commands.executeCommand as sinon.SinonStub).resetHistory();

      // Mock integration disabled
      const mockConfig = {
        get: sandbox.stub().returns(false),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      copilotIntegrationCommand.handleActivateCopilot();

      expect(vscode.window.showInformationMessage).to.have.been.calledWith(
        'GitHub Copilot integration is disabled. Enable it in Terminal Settings.'
      );
      expect(vscode.commands.executeCommand).to.not.have.been.called;
    });

    it('should handle command execution errors gracefully', async () => {
      // Mock command failure
      (vscode.commands.executeCommand as sinon.SinonStub).rejects(new Error('Command failed'));

      // Should handle error gracefully without throwing
      await expect(copilotIntegrationCommand.handleActivateCopilot()).to.not.be.rejected;

      // Should show error message
      expect(vscode.window.showErrorMessage).to.have.been.called;
    });
  });

  describe('formatCopilotFileReference', () => {
    it('should format file reference with #file: prefix', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
      };

      const result = (copilotIntegrationCommand as any).formatCopilotFileReference(fileInfo);

      expect(result).to.equal('#file:src/test.ts  ');
    });

    it('should format file reference with #file: prefix even with selection', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
        selection: {
          startLine: 5,
          endLine: 5,
          hasSelection: true,
        },
      };

      const result = (copilotIntegrationCommand as any).formatCopilotFileReference(fileInfo);

      // Line numbers are not included in #file: format
      expect(result).to.equal('#file:src/test.ts  ');
    });

    it('should format file reference with #file: prefix for multi-line selection', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
        selection: {
          startLine: 3,
          endLine: 7,
          hasSelection: true,
        },
      };

      const result = (copilotIntegrationCommand as any).formatCopilotFileReference(fileInfo);

      // Line numbers are not included in #file: format
      expect(result).to.equal('#file:src/test.ts  ');
    });
  });

  describe('isGitHubCopilotIntegrationEnabled', () => {
    it('should return true when setting is enabled', () => {
      const result = (copilotIntegrationCommand as any).isGitHubCopilotIntegrationEnabled();
      expect(result).to.be.true;
    });

    it('should return false when setting is disabled', () => {
      const mockConfig = {
        get: sandbox.stub().returns(false),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      const result = (copilotIntegrationCommand as any).isGitHubCopilotIntegrationEnabled();
      expect(result).to.be.false;
    });

    it('should return default value (true) when setting is not found', () => {
      const mockConfig = {
        get: sandbox.stub().callsFake((key: string, defaultValue: any) => defaultValue),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      const result = (copilotIntegrationCommand as any).isGitHubCopilotIntegrationEnabled();
      expect(result).to.be.true; // Default value should be true
    });
  });
});
