/**
 * TerminalClipboardHandler - Handles clipboard, find, and terminal editing operations
 *
 * Extracted from InputManager to reduce method size and improve testability.
 * Contains:
 * - handleTerminalCopy: Copy selection to clipboard via extension messaging
 * - handleTerminalPaste: Request clipboard content from extension
 * - handleTerminalSelectAll: Select all terminal content
 * - handleTerminalFind/FindNext/FindPrevious/HideFind: Search operations
 * - handleTerminalClear: Clear terminal (delegates to TerminalOperationsService)
 * - handleTerminalDeleteWordLeft/Right: Word deletion operations
 * - handleTerminalMoveToLineStart/End: Line movement operations
 * - handleTerminalSizeToContent: Size terminal to content width
 */

import { IManagerCoordinator } from '../../../interfaces/ManagerInterfaces';
import { TerminalOperationsService } from '../services/TerminalOperationsService';

/**
 * Dependencies required by TerminalClipboardHandler from InputManager
 */
export interface ITerminalClipboardHandlerDeps {
  /** Logger function */
  logger: (message: string, ...args: unknown[]) => void;
  /** Terminal operations service for clear/word/line operations */
  terminalOperationsService: TerminalOperationsService;
}

/**
 * TerminalClipboardHandler - Routes clipboard, find, and editing operations
 */
export class TerminalClipboardHandler {
  constructor(private readonly deps: ITerminalClipboardHandlerDeps) {}

  /**
   * Handle terminal copy selection.
   * In VS Code WebView, navigator.clipboard may not work.
   * Sends selection to Extension to copy via VS Code API.
   */
  public handleTerminalCopy(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) {
      return;
    }

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance) {
      return;
    }

    const terminal = terminalInstance.terminal;
    const hasSelection = terminal.hasSelection();

    if (hasSelection) {
      const selection = terminal.getSelection();

      if (selection) {
        this.deps.logger(
          `Copying selection from terminal ${activeTerminalId} (${selection.length} chars)`
        );

        manager.postMessageToExtension({
          command: 'copyToClipboard',
          terminalId: activeTerminalId,
          text: selection,
        });

        // Clear selection after copy (like VS Code terminal)
        terminal.clearSelection();
      }
    }
  }

  /**
   * Handle terminal paste operation.
   * In VS Code WebView, navigator.clipboard may not work.
   * Requests clipboard content from Extension via messaging.
   */
  public handleTerminalPaste(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) {
      return;
    }

    this.deps.logger(
      `Requesting clipboard content from Extension for terminal ${activeTerminalId}`
    );

    manager.postMessageToExtension({
      command: 'requestClipboardContent',
      terminalId: activeTerminalId,
    });
  }

  /**
   * Handle terminal select all operation
   */
  public handleTerminalSelectAll(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance) return;

    terminalInstance.terminal.selectAll();
    this.deps.logger(`Selected all in terminal ${activeTerminalId}`);
  }

  /**
   * Handle terminal find operation
   */
  public handleTerminalFind(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance || !terminalInstance.searchAddon) {
      this.deps.logger(`Search addon not available for terminal ${activeTerminalId}`);
      return;
    }

    try {
      const searchTerm = prompt('Find in terminal:');
      if (searchTerm) {
        terminalInstance.searchAddon.findNext(searchTerm);
        this.deps.logger(`Searching for "${searchTerm}" in terminal ${activeTerminalId}`);
      }
    } catch (error) {
      this.deps.logger(`Find operation failed: ${error}`);
    }
  }

  /**
   * Handle terminal find next
   */
  public handleTerminalFindNext(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (terminalInstance?.searchAddon) {
      terminalInstance.searchAddon.findNext('', { incremental: false });
      this.deps.logger(`Find next in terminal ${activeTerminalId}`);
    }
  }

  /**
   * Handle terminal find previous
   */
  public handleTerminalFindPrevious(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (terminalInstance?.searchAddon) {
      terminalInstance.searchAddon.findPrevious('', { incremental: false });
      this.deps.logger(`Find previous in terminal ${activeTerminalId}`);
    }
  }

  /**
   * Handle hide terminal find
   */
  public handleTerminalHideFind(_manager: IManagerCoordinator): void {
    this.deps.logger('Hide terminal find requested');
  }

  /**
   * Handle terminal clear operation - delegates to TerminalOperationsService
   */
  public handleTerminalClear(manager: IManagerCoordinator): void {
    this.deps.terminalOperationsService.clearTerminal(manager);
  }

  /**
   * Handle terminal word deletion operations - delegates to TerminalOperationsService
   */
  public handleTerminalDeleteWordLeft(manager: IManagerCoordinator): void {
    this.deps.terminalOperationsService.deleteWordLeft(manager);
  }

  public handleTerminalDeleteWordRight(manager: IManagerCoordinator): void {
    this.deps.terminalOperationsService.deleteWordRight(manager);
  }

  /**
   * Handle terminal line movement operations - delegates to TerminalOperationsService
   */
  public handleTerminalMoveToLineStart(manager: IManagerCoordinator): void {
    this.deps.terminalOperationsService.moveToLineStart(manager);
  }

  public handleTerminalMoveToLineEnd(manager: IManagerCoordinator): void {
    this.deps.terminalOperationsService.moveToLineEnd(manager);
  }

  /**
   * Handle terminal size to content - delegates to TerminalOperationsService
   */
  public handleTerminalSizeToContent(manager: IManagerCoordinator): void {
    this.deps.terminalOperationsService.sizeToContent(manager);
  }
}
