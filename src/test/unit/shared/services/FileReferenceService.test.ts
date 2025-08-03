/**
 * FileReferenceService Test Suite
 * Tests the unified file reference service for CLI Agent and Copilot integration
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../../utils/CommonTestSetup';
import {
  FileReferenceService,
  FileInfo,
  FileReferenceOptions,
} from '../../../../shared/services/FileReferenceService';
import { FILE_REFERENCE_CONSTANTS } from '../../../../shared/constants/AppConstants';

// Mock VS Code modules
const mockVSCode = {
  window: {
    activeTextEditor: null as any,
    showErrorMessage: sinon.stub(),
    showInformationMessage: sinon.stub(),
  },
  workspace: {
    getWorkspaceFolder: sinon.stub(),
    getConfiguration: sinon.stub(),
  },
  Uri: {
    file: sinon.stub(),
  },
  Range: class MockRange {
    constructor(
      public start: any,
      public end: any
    ) {}
  },
  Position: class MockPosition {
    constructor(
      public line: number,
      public character: number
    ) {}
  },
  env: {
    clipboard: {
      writeText: sinon.stub(),
    },
  },
};

describe('FileReferenceService', () => {
  let testEnv: any;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    testEnv = setupTestEnvironment();

    // Setup VS Code mock
    (global as any).vscode = mockVSCode;

    // Reset all stubs
    Object.values(mockVSCode.window).forEach((stub: any) => {
      if (typeof stub?.reset === 'function') {
        stub.reset();
      }
    });
    Object.values(mockVSCode.workspace).forEach((stub: any) => {
      if (typeof stub?.reset === 'function') {
        stub.reset();
      }
    });
    mockVSCode.env.clipboard.writeText.reset();
  });

  afterEach(() => {
    cleanupTestEnvironment(testEnv);
    sandbox.restore();
    delete (global as any).vscode;
  });

  describe('getActiveFileInfo', () => {
    it('should return null when no active editor', () => {
      mockVSCode.window.activeTextEditor = null;

      const result = FileReferenceService.getActiveFileInfo();
      expect(result).to.be.null;
    });

    it('should return null for untitled documents', () => {
      mockVSCode.window.activeTextEditor = {
        document: {
          fileName: 'Untitled-1',
          isUntitled: true,
          uri: { scheme: 'untitled' },
        },
      };

      const result = FileReferenceService.getActiveFileInfo();
      expect(result).to.be.null;
    });

    it('should return file info for valid file', () => {
      const mockDocument = {
        fileName: '/workspace/src/test.ts',
        isUntitled: false,
        uri: { scheme: 'file' },
      };

      mockVSCode.window.activeTextEditor = {
        document: mockDocument,
        selection: {
          start: { line: 5, character: 0 },
          end: { line: 10, character: 0 },
        },
      };

      mockVSCode.workspace.getWorkspaceFolder.returns({
        uri: { fsPath: '/workspace' },
      });

      const result = FileReferenceService.getActiveFileInfo();

      expect(result).to.not.be.null;
      expect(result!.absolutePath).to.equal('/workspace/src/test.ts');
      expect(result!.relativePath).to.equal('src/test.ts');
      expect(result!.selection).to.deep.equal({
        start: { line: 5, character: 0 },
        end: { line: 10, character: 0 },
      });
    });

    it('should handle workspace folder resolution failure', () => {
      const mockDocument = {
        fileName: '/workspace/src/test.ts',
        isUntitled: false,
        uri: { scheme: 'file' },
      };

      mockVSCode.window.activeTextEditor = {
        document: mockDocument,
      };

      mockVSCode.workspace.getWorkspaceFolder.returns(null);

      const result = FileReferenceService.getActiveFileInfo();
      expect(result).to.be.null;
    });

    it('should handle errors gracefully', () => {
      mockVSCode.window.activeTextEditor = {
        get document() {
          throw new Error('Document access error');
        },
      };

      const result = FileReferenceService.getActiveFileInfo();
      expect(result).to.be.null;
    });
  });

  describe('formatFileReference', () => {
    const mockFileInfo: FileInfo = {
      absolutePath: '/workspace/src/test.ts',
      relativePath: 'src/test.ts',
      selection: {
        start: { line: 5, character: 0 },
        end: { line: 10, character: 0 },
      },
    };

    it('should format CLI Agent reference without line numbers', () => {
      const options: FileReferenceOptions = {
        format: 'cli-agent',
        includeLineNumbers: false,
      };

      const result = FileReferenceService.formatFileReference(mockFileInfo, options);
      expect(result).to.equal('@src/test.ts');
    });

    it('should format CLI Agent reference with line numbers', () => {
      const options: FileReferenceOptions = {
        format: 'cli-agent',
        includeLineNumbers: true,
      };

      const result = FileReferenceService.formatFileReference(mockFileInfo, options);
      expect(result).to.equal('@src/test.ts#L6-L11'); // 1-based line numbers
    });

    it('should format Copilot reference', () => {
      const options: FileReferenceOptions = {
        format: 'copilot',
        includeLineNumbers: true,
      };

      const result = FileReferenceService.formatFileReference(mockFileInfo, options);
      expect(result).to.equal('#file:src/test.ts#L6-L11');
    });

    it('should handle single line selection', () => {
      const singleLineFileInfo: FileInfo = {
        ...mockFileInfo,
        selection: {
          start: { line: 5, character: 0 },
          end: { line: 5, character: 10 },
        },
      };

      const options: FileReferenceOptions = {
        format: 'cli-agent',
        includeLineNumbers: true,
      };

      const result = FileReferenceService.formatFileReference(singleLineFileInfo, options);
      expect(result).to.equal('@src/test.ts#L6');
    });

    it('should use custom line range over selection', () => {
      const options: FileReferenceOptions = {
        format: 'cli-agent',
        includeLineNumbers: true,
        lineRange: { start: 15, end: 20 },
      };

      const result = FileReferenceService.formatFileReference(mockFileInfo, options);
      expect(result).to.equal('@src/test.ts#L15-L20');
    });

    it('should handle no selection and no line range', () => {
      const noSelectionFileInfo: FileInfo = {
        absolutePath: '/workspace/src/test.ts',
        relativePath: 'src/test.ts',
      };

      const options: FileReferenceOptions = {
        format: 'cli-agent',
        includeLineNumbers: true,
      };

      const result = FileReferenceService.formatFileReference(noSelectionFileInfo, options);
      expect(result).to.equal('@src/test.ts');
    });
  });

  describe('Configuration Helpers', () => {
    beforeEach(() => {
      const mockConfig = {
        get: sinon.stub(),
      };
      mockVSCode.workspace.getConfiguration.returns(mockConfig);
    });

    it('should check CLI Agent integration enabled', () => {
      const mockConfig = mockVSCode.workspace.getConfiguration('sidebarTerminal');
      mockConfig.get.withArgs(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS.ENABLE_CLI_AGENT).returns(true);

      const result = FileReferenceService.isCliAgentIntegrationEnabled();
      expect(result).to.be.true;
    });

    it('should check GitHub Copilot integration enabled', () => {
      const mockConfig = mockVSCode.workspace.getConfiguration('sidebarTerminal');
      mockConfig.get.withArgs(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS.ENABLE_COPILOT).returns(false);

      const result = FileReferenceService.isGitHubCopilotIntegrationEnabled();
      expect(result).to.be.false;
    });

    it('should handle configuration access errors', () => {
      mockVSCode.workspace.getConfiguration.throws(new Error('Config error'));

      const result = FileReferenceService.isCliAgentIntegrationEnabled();
      expect(result).to.be.true; // Default fallback
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy text to clipboard successfully', async () => {
      mockVSCode.env.clipboard.writeText.resolves();

      await FileReferenceService.copyToClipboard('test content');

      expect(mockVSCode.env.clipboard.writeText.calledOnce).to.be.true;
      expect(mockVSCode.env.clipboard.writeText.firstCall.args[0]).to.equal('test content');
    });

    it('should handle clipboard errors gracefully', async () => {
      mockVSCode.env.clipboard.writeText.rejects(new Error('Clipboard error'));

      // Should not throw
      await FileReferenceService.copyToClipboard('test content');

      expect(mockVSCode.env.clipboard.writeText.calledOnce).to.be.true;
    });
  });

  describe('Show Messages', () => {
    it('should show info message', () => {
      FileReferenceService.showMessage('Info message', 'info');

      expect(mockVSCode.window.showInformationMessage.calledOnce).to.be.true;
      expect(mockVSCode.window.showInformationMessage.firstCall.args[0]).to.equal('Info message');
    });

    it('should show error message', () => {
      FileReferenceService.showMessage('Error message', 'error');

      expect(mockVSCode.window.showErrorMessage.calledOnce).to.be.true;
      expect(mockVSCode.window.showErrorMessage.firstCall.args[0]).to.equal('Error message');
    });

    it('should handle unknown message type', () => {
      FileReferenceService.showMessage('Unknown type message', 'unknown' as any);

      // Should default to info
      expect(mockVSCode.window.showInformationMessage.calledOnce).to.be.true;
    });
  });

  describe('validateFileReferencePrerequisites', () => {
    beforeEach(() => {
      const mockConfig = {
        get: sinon.stub(),
      };
      mockVSCode.workspace.getConfiguration.returns(mockConfig);
    });

    it('should validate CLI Agent prerequisites successfully', () => {
      const mockConfig = mockVSCode.workspace.getConfiguration('sidebarTerminal');
      mockConfig.get.withArgs(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS.ENABLE_CLI_AGENT).returns(true);

      mockVSCode.window.activeTextEditor = {
        document: {
          fileName: '/workspace/src/test.ts',
          isUntitled: false,
          uri: { scheme: 'file' },
        },
      };

      mockVSCode.workspace.getWorkspaceFolder.returns({
        uri: { fsPath: '/workspace' },
      });

      const result = FileReferenceService.validateFileReferencePrerequisites('cli-agent');

      expect(result.valid).to.be.true;
      expect(result.fileInfo).to.not.be.undefined;
      expect(result.errorMessage).to.be.undefined;
    });

    it('should fail validation when integration is disabled', () => {
      const mockConfig = mockVSCode.workspace.getConfiguration('sidebarTerminal');
      mockConfig.get.withArgs(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS.ENABLE_COPILOT).returns(false);

      const result = FileReferenceService.validateFileReferencePrerequisites('copilot');

      expect(result.valid).to.be.false;
      expect(result.errorMessage).to.include('copilot integration is disabled');
    });

    it('should fail validation when no file info available', () => {
      const mockConfig = mockVSCode.workspace.getConfiguration('sidebarTerminal');
      mockConfig.get.withArgs(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS.ENABLE_CLI_AGENT).returns(true);

      mockVSCode.window.activeTextEditor = null;

      const result = FileReferenceService.validateFileReferencePrerequisites('cli-agent');

      expect(result.valid).to.be.false;
      expect(result.errorMessage).to.include('No active file');
    });
  });

  describe('Integration Tests', () => {
    it('should create complete CLI Agent file reference', () => {
      const mockConfig = mockVSCode.workspace.getConfiguration('sidebarTerminal');
      mockConfig.get.withArgs(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS.ENABLE_CLI_AGENT).returns(true);

      mockVSCode.window.activeTextEditor = {
        document: {
          fileName: '/workspace/src/components/Terminal.tsx',
          isUntitled: false,
          uri: { scheme: 'file' },
        },
        selection: {
          start: { line: 10, character: 0 },
          end: { line: 20, character: 0 },
        },
      };

      mockVSCode.workspace.getWorkspaceFolder.returns({
        uri: { fsPath: '/workspace' },
      });

      const validation = FileReferenceService.validateFileReferencePrerequisites('cli-agent');
      expect(validation.valid).to.be.true;

      const reference = FileReferenceService.formatFileReference(validation.fileInfo!, {
        format: 'cli-agent',
        includeLineNumbers: true,
      });

      expect(reference).to.equal('@src/components/Terminal.tsx#L11-L21');
    });

    it('should create complete Copilot file reference', () => {
      const mockConfig = mockVSCode.workspace.getConfiguration('sidebarTerminal');
      mockConfig.get.withArgs(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS.ENABLE_COPILOT).returns(true);

      mockVSCode.window.activeTextEditor = {
        document: {
          fileName: '/workspace/README.md',
          isUntitled: false,
          uri: { scheme: 'file' },
        },
      };

      mockVSCode.workspace.getWorkspaceFolder.returns({
        uri: { fsPath: '/workspace' },
      });

      const validation = FileReferenceService.validateFileReferencePrerequisites('copilot');
      expect(validation.valid).to.be.true;

      const reference = FileReferenceService.formatFileReference(validation.fileInfo!, {
        format: 'copilot',
        includeLineNumbers: false,
      });

      expect(reference).to.equal('#file:README.md');
    });
  });
});
