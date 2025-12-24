/**
 * CopilotIntegrationCommand Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';

// Import shared test setup
import '../../../shared/TestSetup';
import { CopilotIntegrationCommand } from '../../../../commands/CopilotIntegrationCommand';

describe('CopilotIntegrationCommand', () => {
  let copilotIntegrationCommand: CopilotIntegrationCommand;

  beforeEach(() => {
    // Create CopilotIntegrationCommand instance
    copilotIntegrationCommand = new CopilotIntegrationCommand();

    // Mock VS Code workspace configuration
    const mockConfig = {
      get: vi.fn().mockReturnValue(true), // GitHub Copilot integration enabled by default
    };
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

    // Mock commands
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    // Mock notifications
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
    vi.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
    vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.chat.open',
        expect.objectContaining({ query: expect.stringContaining('#file:') })
      );
    });

    it('should activate Copilot Chat without file reference when no file is open', () => {
      (vscode.window as any).activeTextEditor = null;

      copilotIntegrationCommand.handleActivateCopilot();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.chat.open');
    });

    it('should show information message when integration is disabled', () => {
      // Reset executeCommand spy to ensure clean state
      vi.mocked(vscode.commands.executeCommand).mockClear();

      // Mock integration disabled
      const mockConfig = {
        get: vi.fn().mockReturnValue(false),
      };
      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      copilotIntegrationCommand.handleActivateCopilot();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'GitHub Copilot integration is disabled. Enable it in Terminal Settings.'
      );
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should handle command execution errors gracefully', async () => {
      // Mock command failure
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(new Error('Command failed'));

      // Should handle error gracefully without throwing
      await expect(copilotIntegrationCommand.handleActivateCopilot()).resolves.not.toThrow();

      // Should show error message
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('formatCopilotFileReference', () => {
    it('should format file reference with #file: prefix', () => {
      const fileInfo = {
        relativePath: 'src/test.ts',
      };

      const result = (copilotIntegrationCommand as any).formatCopilotFileReference(fileInfo);

      expect(result).toBe('#file:src/test.ts  ');
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
      expect(result).toBe('#file:src/test.ts  ');
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
      expect(result).toBe('#file:src/test.ts  ');
    });
  });

  describe('isGitHubCopilotIntegrationEnabled', () => {
    it('should return true when setting is enabled', () => {
      const result = (copilotIntegrationCommand as any).isGitHubCopilotIntegrationEnabled();
      expect(result).toBe(true);
    });

    it('should return false when setting is disabled', () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue(false),
      };
      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      const result = (copilotIntegrationCommand as any).isGitHubCopilotIntegrationEnabled();
      expect(result).toBe(false);
    });

    it('should return default value (true) when setting is not found', () => {
      const mockConfig = {
        get: vi.fn().mockImplementation((key: string, defaultValue: any) => defaultValue),
      };
      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

      const result = (copilotIntegrationCommand as any).isGitHubCopilotIntegrationEnabled();
      expect(result).toBe(true); // Default value should be true
    });
  });
});
