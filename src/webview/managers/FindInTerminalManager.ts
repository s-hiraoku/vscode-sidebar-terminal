/**
 * Find in Terminal Manager
 * Implements VS Code-style search functionality for terminal content
 * - Ctrl+F search panel
 * - F3/Shift+F3 navigation
 * - Search highlighting and regex support
 * - Case-sensitive search options
 */

import { IManagerCoordinator, IFindInTerminalManager } from '../interfaces/ManagerInterfaces';
import { webview as log } from '../../utils/logger';

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  backwards: boolean;
}

export interface FindResult {
  found: boolean;
  matchIndex: number;
  totalMatches: number;
}

/**
 * Find in Terminal Manager
 * Provides VS Code-style find functionality for terminals
 */

export class FindInTerminalManager implements IFindInTerminalManager {
  private coordinator: IManagerCoordinator | null = null;
  private searchPanel: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private matchCounter: HTMLElement | null = null;
  private currentTerminalId: string | null = null;
  private lastSearchTerm: string = '';
  private findOptions: FindOptions = {
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    backwards: false,
  };

  // Search state tracking
  private isSearchVisible = false;
  private currentMatchIndex = 0;
  private totalMatches = 0;

  constructor() {
    this.setupStyles();
    this.setupKeyboardShortcuts();
  }

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
  }

  /**
   * Setup CSS styles for search panel
   */
  private setupStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .find-in-terminal-panel {
        position: absolute;
        top: 10px;
        right: 10px;
        background: var(--vscode-editor-findMatchBackground);
        border: 1px solid var(--vscode-contrastBorder);
        border-radius: 4px;
        padding: 8px;
        display: none;
        z-index: 1000;
        min-width: 300px;
        box-shadow: 0 2px 8px var(--vscode-widget-shadow);
      }

      .find-in-terminal-panel.visible {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .find-search-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .find-input {
        flex: 1;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        color: var(--vscode-input-foreground);
        padding: 4px 8px;
        border-radius: 2px;
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
        outline: none;
      }

      .find-input:focus {
        border-color: var(--vscode-focusBorder);
        box-shadow: 0 0 0 1px var(--vscode-focusBorder);
      }

      .find-input.no-matches {
        border-color: var(--vscode-inputValidation-errorBorder);
        background: var(--vscode-inputValidation-errorBackground);
      }

      .find-button {
        background: var(--vscode-button-secondaryBackground);
        border: 1px solid var(--vscode-button-border);
        color: var(--vscode-button-secondaryForeground);
        padding: 2px 6px;
        border-radius: 2px;
        cursor: pointer;
        font-size: 11px;
        min-width: 24px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .find-button:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      .find-button:active {
        background: var(--vscode-button-background);
      }

      .find-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .find-button.active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }

      .find-options-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
      }

      .find-match-counter {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        min-width: 60px;
        text-align: center;
      }

      .find-option-button {
        background: transparent;
        border: 1px solid var(--vscode-button-border);
        color: var(--vscode-foreground);
        padding: 2px 6px;
        border-radius: 2px;
        cursor: pointer;
        font-size: 10px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .find-option-button:hover {
        background: var(--vscode-toolbar-hoverBackground);
      }

      .find-option-button.active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }

      .find-close-button {
        background: transparent;
        border: none;
        color: var(--vscode-foreground);
        cursor: pointer;
        padding: 2px;
        border-radius: 2px;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .find-close-button:hover {
        background: var(--vscode-toolbar-hoverBackground);
      }

      /* Search highlight styles */
      .terminal .xterm-search-highlight {
        background-color: var(--vscode-editor-findMatchBackground) !important;
        color: var(--vscode-editor-foreground) !important;
      }

      .terminal .xterm-search-highlight.current {
        background-color: var(--vscode-editor-findMatchHighlightBackground) !important;
        color: var(--vscode-editor-foreground) !important;
        border: 1px solid var(--vscode-editor-findMatchBorder);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup keyboard shortcuts for search functionality
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Ctrl+F / Cmd+F - Open search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        this.showSearch();
        return;
      }

      // Escape - Close search
      if (event.key === 'Escape' && this.isSearchVisible) {
        event.preventDefault();
        this.hideSearch();
        return;
      }

      // F3 - Find next
      if (event.key === 'F3' && this.isSearchVisible) {
        event.preventDefault();
        if (event.shiftKey) {
          this.findPrevious();
        } else {
          this.findNext();
        }
        return;
      }

      // Enter in search input - Find next
      if (event.key === 'Enter' && this.isSearchVisible && event.target === this.searchInput) {
        event.preventDefault();
        if (event.shiftKey) {
          this.findPrevious();
        } else {
          this.findNext();
        }
        return;
      }
    });
  }

  /**
   * Show search panel for current terminal
   */
  public showSearch(): void {
    const activeTerminalId = this.coordinator?.getActiveTerminalId();
    if (!activeTerminalId) {
      log('No active terminal for search');
      return;
    }

    this.currentTerminalId = activeTerminalId;

    if (!this.searchPanel) {
      this.createSearchPanel();
    }

    // Position search panel in active terminal container
    const terminalContainer = this.coordinator?.getTerminalElement(activeTerminalId);
    if (terminalContainer) {
      terminalContainer.style.position = 'relative';
      terminalContainer.appendChild(this.searchPanel!);
    }

    this.searchPanel!.classList.add('visible');
    this.isSearchVisible = true;

    // Focus search input
    setTimeout(() => {
      this.searchInput?.focus();
      this.searchInput?.select();
    }, 10);

    log(`🔍 Search panel opened for terminal: ${activeTerminalId}`);
  }

  /**
   * Hide search panel
   */
  public hideSearch(): void {
    if (!this.searchPanel) return;

    this.searchPanel.classList.remove('visible');
    this.isSearchVisible = false;

    // Clear search highlights
    this.clearSearchHighlights();

    // Remove panel from DOM
    if (this.searchPanel.parentNode) {
      this.searchPanel.parentNode.removeChild(this.searchPanel);
    }

    log('🔍 Search panel closed');
  }

  /**
   * Create search panel UI
   */
  private createSearchPanel(): void {
    this.searchPanel = document.createElement('div');
    this.searchPanel.className = 'find-in-terminal-panel';

    // Search input row
    const searchRow = document.createElement('div');
    searchRow.className = 'find-search-row';

    // Search input
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'find-input';
    this.searchInput.placeholder = 'Find in terminal...';
    this.searchInput.value = this.lastSearchTerm;

    // Search input event handlers
    this.searchInput.addEventListener('input', () => {
      this.onSearchInputChange();
    });

    // Navigation buttons
    const findPrevButton = this.createButton('⬆', 'Find previous (Shift+F3)', () =>
      this.findPrevious()
    );
    const findNextButton = this.createButton('⬇', 'Find next (F3)', () => this.findNext());

    // Match counter
    this.matchCounter = document.createElement('div');
    this.matchCounter.className = 'find-match-counter';
    this.updateMatchCounter();

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'find-close-button';
    closeButton.textContent = '✕'; // Safe: fixed character
    closeButton.title = 'Close (Escape)';
    closeButton.addEventListener('click', () => this.hideSearch());

    searchRow.appendChild(this.searchInput);
    searchRow.appendChild(findPrevButton);
    searchRow.appendChild(findNextButton);
    searchRow.appendChild(this.matchCounter);
    searchRow.appendChild(closeButton);

    // Options row
    const optionsRow = document.createElement('div');
    optionsRow.className = 'find-options-row';

    const caseSensitiveButton = this.createOptionButton('Aa', 'Match case', 'caseSensitive');
    const wholeWordButton = this.createOptionButton('AB', 'Match whole word', 'wholeWord');
    const regexButton = this.createOptionButton('.*', 'Use regular expression', 'regex');

    optionsRow.appendChild(caseSensitiveButton);
    optionsRow.appendChild(wholeWordButton);
    optionsRow.appendChild(regexButton);

    this.searchPanel.appendChild(searchRow);
    this.searchPanel.appendChild(optionsRow);
  }

  /**
   * Create button element
   */
  private createButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'find-button';
    button.textContent = text; // Safe: textContent escapes HTML
    button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Create option toggle button
   */
  private createOptionButton(
    text: string,
    title: string,
    option: keyof FindOptions
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'find-option-button';
    button.textContent = text; // Safe: textContent escapes HTML
    button.title = title;

    if (this.findOptions[option]) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => {
      this.findOptions[option] = !this.findOptions[option];
      button.classList.toggle('active', this.findOptions[option]);

      // Re-run search with new options
      if (this.lastSearchTerm) {
        this.performSearch(this.lastSearchTerm);
      }
    });

    return button;
  }

  /**
   * Handle search input changes
   */
  private onSearchInputChange(): void {
    const searchTerm = this.searchInput?.value || '';
    this.lastSearchTerm = searchTerm;

    if (searchTerm.length === 0) {
      this.clearSearchHighlights();
      this.updateMatchCounter();
      return;
    }

    // Debounce search
    clearTimeout((this as any).searchTimeout);
    (this as any).searchTimeout = setTimeout(() => {
      this.performSearch(searchTerm);
    }, 150);
  }

  /**
   * Perform search in current terminal
   */
  private performSearch(searchTerm: string): void {
    if (!this.currentTerminalId || !this.coordinator) {
      return;
    }

    const terminalInstance = this.coordinator.getTerminalInstance(this.currentTerminalId);
    if (!terminalInstance?.searchAddon) {
      log('Search addon not available for terminal:', this.currentTerminalId);
      return;
    }

    try {
      // Prepare search options for xterm.js
      const searchOptions = {
        caseSensitive: this.findOptions.caseSensitive,
        wholeWord: this.findOptions.wholeWord,
        regex: this.findOptions.regex,
      };

      // Perform search
      const found = terminalInstance.searchAddon.findNext(searchTerm, searchOptions);

      if (found) {
        this.searchInput?.classList.remove('no-matches');
        // Note: xterm.js SearchAddon doesn't provide match count directly
        this.currentMatchIndex = 1;
        this.totalMatches = 1; // Approximation
      } else {
        this.searchInput?.classList.add('no-matches');
        this.currentMatchIndex = 0;
        this.totalMatches = 0;
      }

      this.updateMatchCounter();
    } catch (error) {
      log('Search failed:', error);
      this.searchInput?.classList.add('no-matches');
      this.updateMatchCounter();
    }
  }

  /**
   * Find next occurrence
   */
  public findNext(): void {
    if (!this.lastSearchTerm || !this.currentTerminalId || !this.coordinator) {
      return;
    }

    const terminalInstance = this.coordinator.getTerminalInstance(this.currentTerminalId);
    if (!terminalInstance?.searchAddon) {
      return;
    }

    const searchOptions = {
      caseSensitive: this.findOptions.caseSensitive,
      wholeWord: this.findOptions.wholeWord,
      regex: this.findOptions.regex,
    };

    const found = terminalInstance.searchAddon.findNext(this.lastSearchTerm, searchOptions);

    if (found) {
      this.currentMatchIndex = Math.min(this.currentMatchIndex + 1, this.totalMatches);
      this.updateMatchCounter();
    }
  }

  /**
   * Find previous occurrence
   */
  public findPrevious(): void {
    if (!this.lastSearchTerm || !this.currentTerminalId || !this.coordinator) {
      return;
    }

    const terminalInstance = this.coordinator.getTerminalInstance(this.currentTerminalId);
    if (!terminalInstance?.searchAddon) {
      return;
    }

    const searchOptions = {
      caseSensitive: this.findOptions.caseSensitive,
      wholeWord: this.findOptions.wholeWord,
      regex: this.findOptions.regex,
    };

    const found = terminalInstance.searchAddon.findPrevious(this.lastSearchTerm, searchOptions);

    if (found) {
      this.currentMatchIndex = Math.max(this.currentMatchIndex - 1, 1);
      this.updateMatchCounter();
    }
  }

  /**
   * Clear search highlights
   */
  private clearSearchHighlights(): void {
    if (!this.currentTerminalId || !this.coordinator) {
      return;
    }

    const terminalInstance = this.coordinator.getTerminalInstance(this.currentTerminalId);
    if (terminalInstance?.searchAddon) {
      terminalInstance.searchAddon.clearDecorations();
    }
  }

  /**
   * Update match counter display
   */
  private updateMatchCounter(): void {
    if (!this.matchCounter) return;

    if (this.totalMatches === 0) {
      this.matchCounter.textContent = 'No results';
    } else {
      this.matchCounter.textContent = `${this.currentMatchIndex} of ${this.totalMatches}`;
    }
  }

  /**
   * Get current search state
   */
  public getSearchState(): {
    isVisible: boolean;
    searchTerm: string;
    options: {
      caseSensitive: boolean;
      wholeWord: boolean;
      regex: boolean;
      backwards: boolean;
    };
    matches: { current: number; total: number };
  } {
    return {
      isVisible: this.isSearchVisible,
      searchTerm: this.lastSearchTerm,
      options: { ...this.findOptions },
      matches: {
        current: this.currentMatchIndex,
        total: this.totalMatches,
      },
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.hideSearch();

    if (this.searchPanel) {
      this.searchPanel.remove();
      this.searchPanel = null;
    }

    this.searchInput = null;
    this.matchCounter = null;
    this.coordinator = null;
    this.currentTerminalId = null;

    log('🔍 Find in Terminal Manager disposed');
  }
}
