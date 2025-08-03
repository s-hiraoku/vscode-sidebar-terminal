/**
 * File Reference Service - Shared logic for file reference commands
 * Eliminates duplication between CLI Agent and Copilot integration commands
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { extension as log } from '../../utils/logger';
import { FILE_REFERENCE_CONSTANTS } from '../constants/AppConstants';

export interface FileInfo {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  workspaceRoot: string;
  selection?: vscode.Selection;
}

export interface FileReferenceOptions {
  format: 'cli-agent' | 'copilot';
  includeLineNumbers?: boolean;
  lineRange?: { start: number; end: number };
}

/**
 * Shared service for file reference functionality
 */
export namespace FileReferenceService {
  /**
   * Get information about the currently active file
   */
  export function getActiveFileInfo(): FileInfo | null {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor?.document) {
        log('No active editor found');
        return null;
      }

      const document = activeEditor.document;
      const absolutePath = document.fileName;

      // Skip untitled files
      if (document.isUntitled || document.uri.scheme !== 'file') {
        log('Skipping untitled or non-file document');
        return null;
      }

      // Get workspace root
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) {
        log('No workspace folder found for current file');
        return null;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const relativePath = path.relative(workspaceRoot, absolutePath);
      const fileName = path.basename(absolutePath);

      const selection = activeEditor.selection;

      return {
        absolutePath,
        relativePath,
        fileName,
        workspaceRoot,
        selection: selection && !selection.isEmpty ? selection : undefined,
      };
    } catch (error) {
      log(`Error getting active file info: ${String(error)}`);
      return null;
    }
  }

  /**
   * Format file reference string based on options
   */
  export function formatFileReference(fileInfo: FileInfo, options: FileReferenceOptions): string {
    const { format, includeLineNumbers = true, lineRange } = options;

    let reference = '';

    // Apply format prefix
    switch (format) {
      case 'cli-agent':
        reference = `${FILE_REFERENCE_CONSTANTS.FORMATS.CLI_AGENT}${fileInfo.relativePath}`;
        break;
      case 'copilot':
        reference = `${FILE_REFERENCE_CONSTANTS.FORMATS.COPILOT}${fileInfo.relativePath}`;
        break;
      default:
        reference = fileInfo.relativePath;
    }

    // Add line numbers if requested and available
    if (includeLineNumbers && (lineRange || fileInfo.selection)) {
      const lines =
        lineRange ||
        (fileInfo.selection
          ? {
              start: fileInfo.selection.start.line + 1, // Convert to 1-based
              end: fileInfo.selection.end.line + 1,
            }
          : null);

      if (lines) {
        if (lines.start === lines.end) {
          reference += `#L${lines.start}`;
        } else {
          reference += `#L${lines.start}-L${lines.end}`;
        }
      }
    }

    return reference;
  }

  /**
   * Check if CLI Agent integration is enabled
   */
  export function isCliAgentIntegrationEnabled(): boolean {
    try {
      const config = vscode.workspace.getConfiguration('secondaryTerminal');
      return config.get<boolean>('enableCliAgentIntegration', true);
    } catch (error) {
      log(`Error checking CLI Agent integration setting: ${String(error)}`);
      return false;
    }
  }

  /**
   * Check if GitHub Copilot integration is enabled
   */
  export function isGitHubCopilotIntegrationEnabled(): boolean {
    try {
      const config = vscode.workspace.getConfiguration('secondaryTerminal');
      return config.get<boolean>('enableGitHubCopilotIntegration', true);
    } catch (error) {
      log(`Error checking GitHub Copilot integration setting: ${String(error)}`);
      return false;
    }
  }

  /**
   * Parse line range from file reference string
   */
  export function parseLineRange(reference: string): { start: number; end: number } | null {
    // Try multi-line range first (#L10-L25)
    const multiLineMatch = reference.match(FILE_REFERENCE_CONSTANTS.PATTERNS.LINE_RANGE);
    if (multiLineMatch && multiLineMatch[1] && multiLineMatch[2]) {
      return {
        start: parseInt(multiLineMatch[1], 10),
        end: parseInt(multiLineMatch[2], 10),
      };
    }

    // Try single line (#L10)
    const singleLineMatch = reference.match(FILE_REFERENCE_CONSTANTS.PATTERNS.SINGLE_LINE);
    if (singleLineMatch && singleLineMatch[1]) {
      const line = parseInt(singleLineMatch[1], 10);
      return {
        start: line,
        end: line,
      };
    }

    return null;
  }

  /**
   * Show user notification for file reference action
   */
  export function showFileReferenceNotification(
    type: 'success' | 'warning' | 'error',
    message: string
  ): void {
    switch (type) {
      case 'success':
        void vscode.window.showInformationMessage(message);
        break;
      case 'warning':
        void vscode.window.showWarningMessage(message);
        break;
      case 'error':
        void vscode.window.showErrorMessage(message);
        break;
    }
  }

  /**
   * Common validation for file reference commands
   */
  export function validateFileReferencePrerequisites(integrationType: 'cli-agent' | 'copilot'): {
    valid: boolean;
    fileInfo?: FileInfo;
    errorMessage?: string;
  } {
    // Check if integration is enabled
    const isEnabled =
      integrationType === 'cli-agent'
        ? isCliAgentIntegrationEnabled()
        : isGitHubCopilotIntegrationEnabled();

    if (!isEnabled) {
      return {
        valid: false,
        errorMessage: `${integrationType} integration is disabled. Enable it in Terminal Settings.`,
      };
    }

    // Get active file info
    const fileInfo = getActiveFileInfo();
    if (!fileInfo) {
      return {
        valid: false,
        errorMessage: 'No active file to reference. Please open a file first.',
      };
    }

    return {
      valid: true,
      fileInfo,
    };
  }
}
