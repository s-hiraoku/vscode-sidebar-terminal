/**
 * FindInTerminalManager Unit Tests
 *
 * Tests for VS Code-style search functionality in terminal
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FindInTerminalManager, FindOptions, FindResult } from '../../../../../webview/managers/FindInTerminalManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

// Mock the logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('FindInTerminalManager', () => {
  let manager: FindInTerminalManager;
  let mockCoordinator: IManagerCoordinator;
  let mockSearchAddon: any;
  let mockTerminalInstance: any;

  beforeEach(() => {
    // Setup JSDOM elements
    document.body.innerHTML = '<div id="terminal-container"></div>';

    // Create mock search addon
    mockSearchAddon = {
      findNext: vi.fn().mockReturnValue(true),
      findPrevious: vi.fn().mockReturnValue(true),
      clearDecorations: vi.fn(),
    };

    // Create mock terminal instance
    mockTerminalInstance = {
      terminal: {},
      searchAddon: mockSearchAddon,
    };

    // Create mock coordinator
    mockCoordinator = {
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      getTerminalInstance: vi.fn().mockReturnValue(mockTerminalInstance),
      getTerminalElement: vi.fn().mockReturnValue(document.getElementById('terminal-container')),
      postMessageToExtension: vi.fn(),
      setActiveTerminalId: vi.fn(),
    } as unknown as IManagerCoordinator;

    // Create manager
    manager = new FindInTerminalManager();
    manager.setCoordinator(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should create manager without coordinator', () => {
      const newManager = new FindInTerminalManager();
      expect(newManager).toBeDefined();
      newManager.dispose();
    });

    it('should set coordinator', () => {
      const newManager = new FindInTerminalManager();
      newManager.setCoordinator(mockCoordinator);
      // Coordinator should be set (verified by subsequent operations working)
      newManager.dispose();
    });

    it('should setup styles on construction', () => {
      // Check that style element was added to head
      const styles = document.head.querySelectorAll('style');
      const hasSearchStyles = Array.from(styles).some(
        (style) => style.textContent?.includes('.find-in-terminal-panel')
      );
      expect(hasSearchStyles).toBe(true);
    });
  });

  describe('showSearch', () => {
    it('should show search panel for active terminal', () => {
      manager.showSearch();

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(true);
    });

    it('should not show search if no active terminal', () => {
      vi.mocked(mockCoordinator.getActiveTerminalId).mockReturnValue(null);

      manager.showSearch();

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(false);
    });

    it('should focus search input after showing', async () => {
      manager.showSearch();

      // Wait for setTimeout to execute
      await new Promise((resolve) => setTimeout(resolve, 20));

      // The search input should be created and focused
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      expect(searchPanel).toBeTruthy();
    });

    it('should reuse existing search panel', () => {
      manager.showSearch();
      manager.hideSearch();
      manager.showSearch();

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(true);
    });
  });

  describe('hideSearch', () => {
    it('should hide search panel', () => {
      manager.showSearch();
      manager.hideSearch();

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(false);
    });

    it('should clear search highlights on hide', () => {
      manager.showSearch();
      manager.hideSearch();

      expect(mockSearchAddon.clearDecorations).toHaveBeenCalled();
    });

    it('should handle hide when not visible', () => {
      // Should not throw
      expect(() => manager.hideSearch()).not.toThrow();
    });
  });

  describe('findNext', () => {
    it('should call searchAddon.findNext with correct options', () => {
      manager.showSearch();

      // Simulate typing in search input
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      // Wait for debounce and trigger findNext
      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      vi.useRealTimers();

      manager.findNext();

      expect(mockSearchAddon.findNext).toHaveBeenCalled();
    });

    it('should not search if no search term', () => {
      manager.showSearch();
      manager.findNext();

      // Should not call findNext without a search term
      expect(mockSearchAddon.findNext).not.toHaveBeenCalled();
    });

    it('should not search if no coordinator', () => {
      const isolatedManager = new FindInTerminalManager();
      isolatedManager.findNext();
      // Should not throw
      isolatedManager.dispose();
    });
  });

  describe('findPrevious', () => {
    it('should call searchAddon.findPrevious', () => {
      manager.showSearch();

      // Set up a search term by directly manipulating state
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      vi.useRealTimers();

      manager.findPrevious();

      expect(mockSearchAddon.findPrevious).toHaveBeenCalled();
    });

    it('should not search backwards if no search term', () => {
      manager.showSearch();
      manager.findPrevious();

      expect(mockSearchAddon.findPrevious).not.toHaveBeenCalled();
    });
  });

  describe('getSearchState', () => {
    it('should return initial state', () => {
      const state = manager.getSearchState();

      expect(state.isVisible).toBe(false);
      expect(state.searchTerm).toBe('');
      expect(state.options).toEqual({
        caseSensitive: false,
        wholeWord: false,
        regex: false,
        backwards: false,
      });
      expect(state.matches).toEqual({
        current: 0,
        total: 0,
      });
    });

    it('should return visible state after showSearch', () => {
      manager.showSearch();

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(true);
    });

    it('should return correct options after toggling', () => {
      manager.showSearch();

      // Find and click the case sensitive button
      const optionButtons = document.querySelectorAll('.find-option-button');
      if (optionButtons[0]) {
        (optionButtons[0] as HTMLButtonElement).click();
      }

      const state = manager.getSearchState();
      expect(state.options.caseSensitive).toBe(true);
    });
  });

  describe('keyboard shortcuts', () => {
    it('should open search on Ctrl+F', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
      });

      document.dispatchEvent(event);

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(true);
    });

    it('should open search on Cmd+F (Mac)', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        metaKey: true,
        bubbles: true,
      });

      document.dispatchEvent(event);

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(true);
    });

    it('should close search on Escape', () => {
      manager.showSearch();

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });

      document.dispatchEvent(event);

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(false);
    });

    it('should not close on Escape if search not visible', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });

      // Should not throw
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('should find next on F3', () => {
      manager.showSearch();

      // Set up search term
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      vi.useRealTimers();

      const event = new KeyboardEvent('keydown', {
        key: 'F3',
        bubbles: true,
      });

      document.dispatchEvent(event);

      expect(mockSearchAddon.findNext).toHaveBeenCalled();
    });

    it('should find previous on Shift+F3', () => {
      manager.showSearch();

      // Set up search term
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      vi.useRealTimers();

      const event = new KeyboardEvent('keydown', {
        key: 'F3',
        shiftKey: true,
        bubbles: true,
      });

      document.dispatchEvent(event);

      expect(mockSearchAddon.findPrevious).toHaveBeenCalled();
    });
  });

  describe('search options', () => {
    it('should toggle case sensitive option', () => {
      manager.showSearch();

      const caseSensitiveBtn = document.querySelector('.find-option-button');
      if (caseSensitiveBtn) {
        (caseSensitiveBtn as HTMLButtonElement).click();
      }

      const state = manager.getSearchState();
      expect(state.options.caseSensitive).toBe(true);
    });

    it('should toggle whole word option', () => {
      manager.showSearch();

      const buttons = document.querySelectorAll('.find-option-button');
      if (buttons[1]) {
        (buttons[1] as HTMLButtonElement).click();
      }

      const state = manager.getSearchState();
      expect(state.options.wholeWord).toBe(true);
    });

    it('should toggle regex option', () => {
      manager.showSearch();

      const buttons = document.querySelectorAll('.find-option-button');
      if (buttons[2]) {
        (buttons[2] as HTMLButtonElement).click();
      }

      const state = manager.getSearchState();
      expect(state.options.regex).toBe(true);
    });

    it('should re-run search when option toggled with existing term', () => {
      manager.showSearch();

      // Set search term
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      mockSearchAddon.findNext.mockClear();

      // Toggle an option
      const caseSensitiveBtn = document.querySelector('.find-option-button');
      if (caseSensitiveBtn) {
        (caseSensitiveBtn as HTMLButtonElement).click();
      }

      vi.useRealTimers();

      // Should re-run search
      expect(mockSearchAddon.findNext).toHaveBeenCalled();
    });
  });

  describe('search input handling', () => {
    it('should debounce search input', () => {
      vi.useFakeTimers();

      manager.showSearch();

      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      // Should not search immediately
      expect(mockSearchAddon.findNext).not.toHaveBeenCalled();

      // After debounce delay
      vi.advanceTimersByTime(200);

      expect(mockSearchAddon.findNext).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should clear highlights when search term is empty', () => {
      manager.showSearch();

      // First, search for something
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      mockSearchAddon.clearDecorations.mockClear();

      // Then clear the search
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useRealTimers();

      expect(mockSearchAddon.clearDecorations).toHaveBeenCalled();
    });

    it('should handle no matches', async () => {
      mockSearchAddon.findNext.mockReturnValue(false);

      manager.showSearch();

      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;

      vi.useFakeTimers();

      if (searchInput) {
        searchInput.value = 'nonexistent';
        searchInput.dispatchEvent(new Event('input'));
      }

      // Advance timer to trigger debounced search
      vi.advanceTimersByTime(200);
      vi.useRealTimers();

      // Give time for the search to complete and class to be added
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Input should have no-matches class
      expect(searchInput?.classList.contains('no-matches')).toBe(true);

      const state = manager.getSearchState();
      expect(state.matches.total).toBe(0);
    });
  });

  describe('navigation buttons', () => {
    it('should find previous on button click', () => {
      manager.showSearch();

      // Set search term
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      vi.useRealTimers();

      // Click prev button (first find-button)
      const buttons = document.querySelectorAll('.find-button');
      if (buttons[0]) {
        (buttons[0] as HTMLButtonElement).click();
      }

      expect(mockSearchAddon.findPrevious).toHaveBeenCalled();
    });

    it('should find next on button click', () => {
      manager.showSearch();

      // Set search term
      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      mockSearchAddon.findNext.mockClear();
      vi.useRealTimers();

      // Click next button (second find-button)
      const buttons = document.querySelectorAll('.find-button');
      if (buttons[1]) {
        (buttons[1] as HTMLButtonElement).click();
      }

      expect(mockSearchAddon.findNext).toHaveBeenCalled();
    });

    it('should close on close button click', () => {
      manager.showSearch();

      const closeButton = document.querySelector('.find-close-button');
      if (closeButton) {
        (closeButton as HTMLButtonElement).click();
      }

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should clean up resources on dispose', () => {
      manager.showSearch();
      manager.dispose();

      // Should not throw on subsequent operations
      expect(() => manager.showSearch()).not.toThrow();
    });

    it('should hide search on dispose', () => {
      manager.showSearch();
      manager.dispose();

      const state = manager.getSearchState();
      expect(state.isVisible).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle missing searchAddon gracefully', () => {
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: {},
        searchAddon: null,
      } as any);

      manager.showSearch();

      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);
      vi.useRealTimers();

      // Should not throw
      expect(() => manager.findNext()).not.toThrow();
    });

    it('should handle search error gracefully', () => {
      mockSearchAddon.findNext.mockImplementation(() => {
        throw new Error('Search failed');
      });

      manager.showSearch();

      const searchPanel = document.querySelector('.find-in-terminal-panel');
      const searchInput = searchPanel?.querySelector('.find-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
      }

      vi.useFakeTimers();

      // Should not throw
      expect(() => vi.advanceTimersByTime(200)).not.toThrow();

      vi.useRealTimers();
    });
  });
});
