/**
 * Terminal Link Resolver
 *
 * Handles terminal link opening (file links and URLs)
 * Extracted from SecondaryTerminalProvider for better separation of concerns
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promises as fsPromises } from 'fs';
import { provider as log } from '../../utils/logger';
import { showError } from '../../utils/feedback';
import { WebviewMessage } from '../../types/common';
import { safeProcessCwd } from '../../utils/common';

/**
 * Terminal information interface for CWD resolution
 */
export interface TerminalInfo {
  cwd?: string;
}

/**
 * Terminal Link Resolver
 *
 * Responsibilities:
 * - URL link opening in external browser
 * - File link resolution with multiple path candidates
 * - File opening in editor with line/column navigation
 * - Path normalization and candidate building
 */
export class TerminalLinkResolver {
  constructor(private readonly getTerminal: (terminalId: string) => TerminalInfo | undefined) {}

  /**
   * Handle terminal link opening
   */
  public async handleOpenTerminalLink(message: WebviewMessage): Promise<void> {
    const linkType = message.linkType;
    if (!linkType) {
      log('🔗 [LINK-RESOLVER] Link message missing linkType');
      return;
    }

    // Handle URL links
    if (linkType === 'url') {
      await this._handleUrlLink(message);
      return;
    }

    // Handle file links
    await this._handleFileLink(message);
  }

  /**
   * Handle URL link opening
   */
  private async _handleUrlLink(message: WebviewMessage): Promise<void> {
    const targetUrl = message.url;
    if (!targetUrl) {
      log('🔗 [LINK-RESOLVER] URL link missing url field');
      return;
    }

    try {
      log(`🔗 [LINK-RESOLVER] Opening URL from terminal: ${targetUrl}`);
      await vscode.env.openExternal(vscode.Uri.parse(targetUrl));
    } catch (error) {
      log('❌ [LINK-RESOLVER] Failed to open URL link:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showError(`Failed to open link in browser. ${errorMessage}`);
    }
  }

  /**
   * Handle file link opening
   */
  private async _handleFileLink(message: WebviewMessage): Promise<void> {
    const filePath = message.filePath;
    if (!filePath) {
      log('🔗 [LINK-RESOLVER] File link missing filePath');
      return;
    }

    const resolvedUri = await this.resolveFileLink(filePath, message.terminalId);
    if (!resolvedUri) {
      showError(`Unable to locate file from terminal link. Path: ${filePath}`);
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(resolvedUri);
      const editor = await vscode.window.showTextDocument(document, { preview: true });

      // Navigate to specific line/column if provided
      if (typeof message.lineNumber === 'number' && !Number.isNaN(message.lineNumber)) {
        const line = Math.max(0, message.lineNumber - 1);
        const columnValue =
          typeof message.columnNumber === 'number' && !Number.isNaN(message.columnNumber)
            ? Math.max(0, message.columnNumber - 1)
            : 0;
        const position = new vscode.Position(line, columnValue);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }

      log(`🔗 [LINK-RESOLVER] Opened file link: ${resolvedUri.fsPath}`);
    } catch (error) {
      log('❌ [LINK-RESOLVER] Failed to open file link:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showError(`Failed to open file from terminal link. ${errorMessage}`);
    }
  }

  /**
   * Resolve file link to VS Code URI
   *
   * Tries multiple path candidates:
   * 1. Terminal CWD + relative path
   * 2. Workspace folders + relative path
   * 3. Process CWD + relative path
   * 4. Absolute path (if provided)
   */
  public async resolveFileLink(filePath: string, terminalId?: string): Promise<vscode.Uri | null> {
    const candidates = this.buildPathCandidates(filePath, terminalId);

    for (const candidate of candidates) {
      try {
        const stat = await fsPromises.stat(candidate);
        if (stat.isFile()) {
          log(`🔗 [LINK-RESOLVER] Resolved file path: ${candidate}`);
          return vscode.Uri.file(candidate);
        }
      } catch (error) {
        // Ignore missing candidates
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          log('⚠️ [LINK-RESOLVER] Error while checking file candidate:', error);
        }
      }
    }

    log(`❌ [LINK-RESOLVER] Failed to resolve file path: ${filePath}`);
    return null;
  }

  /**
   * Build path candidates for file resolution
   *
   * Generates multiple candidate paths by combining:
   * - Terminal CWD (if available)
   * - Workspace folders
   * - Process CWD
   * - Absolute paths
   */
  public buildPathCandidates(filePath: string, terminalId?: string): string[] {
    const normalizedInput = this.normalizeLinkPath(filePath);
    const candidates = new Set<string>();

    // If absolute path, use it directly
    if (path.isAbsolute(normalizedInput)) {
      candidates.add(normalizedInput);
    } else {
      // Try terminal CWD
      if (terminalId) {
        const terminal = this.getTerminal(terminalId);
        if (terminal?.cwd) {
          candidates.add(path.resolve(terminal.cwd, normalizedInput));
        }
      }

      // Try workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders || [];
      for (const folder of workspaceFolders) {
        candidates.add(path.resolve(folder.uri.fsPath, normalizedInput));
      }

      // Try process CWD
      candidates.add(path.resolve(safeProcessCwd(), normalizedInput));
    }

    const candidateArray = Array.from(candidates);
    log(`🔗 [LINK-RESOLVER] Path candidates for "${filePath}":`, candidateArray);
    return candidateArray;
  }

  /**
   * Normalize link path
   *
   * Handles:
   * - Tilde expansion (~/)
   * - Path separator normalization
   * - Trimming whitespace
   */
  public normalizeLinkPath(input: string): string {
    let normalized = input.trim();
    if (!normalized) {
      return normalized;
    }

    // Expand tilde to home directory
    if (normalized.startsWith('~')) {
      normalized = path.join(os.homedir(), normalized.slice(1));
    }

    // Convert Windows-style separators to native separators
    normalized = normalized.replace(/\\/g, path.sep);

    return normalized;
  }
}
