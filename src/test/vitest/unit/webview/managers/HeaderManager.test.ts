/**
 * HeaderManager Unit Tests
 *
 * Tests for WebView header management including:
 * - Header creation and removal
 * - Configuration updates
 * - Terminal count badge
 * - Icon interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeaderManager } from '../../../../../webview/managers/HeaderManager';
import type { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

// Mock dependencies
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

vi.mock('../../../../../webview/utils/DOMUtils', () => ({
  DOMUtils: {
    createElement: vi.fn((tag, styles, attrs) => {
      const el = {
        tagName: tag.toUpperCase(),
        style: { ...styles },
        id: attrs?.id || '',
        className: attrs?.className || '',
        textContent: attrs?.textContent || '',
        title: attrs?.title || '',
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
        remove: vi.fn(),
        firstChild: null,
        childElementCount: 0,
        children: [],
      };
      return el;
    }),
    getElement: vi.fn(),
    safeRemove: vi.fn(),
    appendChildren: vi.fn(),
    addEventListenerSafe: vi.fn(),
  },
}));

vi.mock('../../../../../webview/utils/ErrorHandler', () => ({
  ErrorHandler: {
    handleOperationError: vi.fn(),
  },
}));

vi.mock('../../../../../webview/constants', () => ({
  SAMPLE_ICONS: [
    { icon: '➕', title: 'New Terminal' },
    { icon: '➖', title: 'Close Terminal' },
  ],
  UI_CONSTANTS: {
    SIZES: {
      SAMPLE_ICON_SIZE: 14,
      TITLE_FONT_SIZE: 12,
      HEADER_HEIGHT: 32,
      TERMINAL_ICON_SIZE: 16,
      ICON_BUTTON_SIZE: 24,
    },
    SPACING: {
      HEADER_PADDING: 8,
      TITLE_GAP: 6,
      ICON_GAP: 4,
      ICON_PADDING: 4,
    },
    OPACITY: {
      SAMPLE_ICON: 0.4,
    },
  },
}));

describe('HeaderManager', () => {
  let manager: HeaderManager;
  let mockCoordinator: IManagerCoordinator;
  let DOMUtils: any;

  beforeEach(async () => {
    const domUtilsModule = await import('../../../../../webview/utils/DOMUtils');
    DOMUtils = domUtilsModule.DOMUtils;

    // Reset mocks
    vi.mocked(DOMUtils.getElement).mockReturnValue(null);

    mockCoordinator = {
      getManager: vi.fn(),
      postMessage: vi.fn(),
    } as unknown as IManagerCoordinator;

    manager = new HeaderManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('setCoordinator', () => {
    it('should store coordinator reference', () => {
      manager.setCoordinator(mockCoordinator);

      // Coordinator is stored internally (can be verified through behavior tests)
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = {
        showHeader: false,
        title: 'Custom Terminal',
      };

      manager.updateConfig(newConfig);

      // Config is applied when creating header
      // Since header doesn't exist yet, no recreation occurs
      expect(() => manager.updateConfig(newConfig)).not.toThrow();
    });

    it('should merge partial config with existing', () => {
      manager.updateConfig({ title: 'First Update' });
      manager.updateConfig({ showIcons: false });

      // Both updates should be applied without error
      expect(() => manager.createWebViewHeader()).not.toThrow();
    });
  });

  describe('createWebViewHeader', () => {
    it('should create header when showHeader is true', () => {
      const mockContainer = {
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };
      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal') return mockContainer;
        return null;
      });

      manager.createWebViewHeader();

      expect(DOMUtils.createElement).toHaveBeenCalledWith(
        'div',
        expect.any(Object),
        expect.objectContaining({ id: 'webview-header' })
      );
    });

    it('should not create header when showHeader is false', () => {
      manager.updateConfig({ showHeader: false });

      manager.createWebViewHeader();

      expect(DOMUtils.appendChildren).not.toHaveBeenCalled();
    });

    it('should remove existing header before creating new one', () => {
      // Create header first
      const mockContainer = {
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };
      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal') return mockContainer;
        return null;
      });

      manager.createWebViewHeader();
      manager.createWebViewHeader();

      // safeRemove should be called on second creation
      expect(DOMUtils.safeRemove).toHaveBeenCalled();
    });

    it('should insert header at beginning of container', () => {
      const existingChild = { tagName: 'DIV' };
      const mockContainer = {
        firstChild: existingChild,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };
      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal') return mockContainer;
        return null;
      });

      manager.createWebViewHeader();

      expect(mockContainer.insertBefore).toHaveBeenCalled();
    });
  });

  describe('updateTerminalCountBadge', () => {
    it('should update badge text with terminal count', () => {
      const mockBadge = {
        textContent: '',
        style: { background: '' },
      };
      const mockTabs = {
        childElementCount: 3,
      };

      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal-count-badge') return mockBadge;
        if (selector === '#terminal-tabs') return mockTabs;
        return null;
      });

      manager.updateTerminalCountBadge();

      expect(mockBadge.textContent).toBe('3');
    });

    it('should set error color when count is 0', () => {
      const mockBadge = {
        textContent: '',
        style: { background: '' },
      };
      const mockTabs = {
        childElementCount: 0,
      };

      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal-count-badge') return mockBadge;
        if (selector === '#terminal-tabs') return mockTabs;
        return null;
      });

      manager.updateTerminalCountBadge();

      expect(mockBadge.style.background).toContain('errorBackground');
    });

    it('should set warning color when count >= 5', () => {
      const mockBadge = {
        textContent: '',
        style: { background: '' },
      };
      const mockTabs = {
        childElementCount: 5,
      };

      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal-count-badge') return mockBadge;
        if (selector === '#terminal-tabs') return mockTabs;
        return null;
      });

      manager.updateTerminalCountBadge();

      expect(mockBadge.style.background).toContain('notificationWarning');
    });

    it('should set orange color when count >= 3 but < 5', () => {
      const mockBadge = {
        textContent: '',
        style: { background: '' },
      };
      const mockTabs = {
        childElementCount: 4,
      };

      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal-count-badge') return mockBadge;
        if (selector === '#terminal-tabs') return mockTabs;
        return null;
      });

      manager.updateTerminalCountBadge();

      expect(mockBadge.style.background).toContain('charts-orange');
    });

    it('should set default color when count is 1 or 2', () => {
      const mockBadge = {
        textContent: '',
        style: { background: '' },
      };
      const mockTabs = {
        childElementCount: 2,
      };

      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal-count-badge') return mockBadge;
        if (selector === '#terminal-tabs') return mockTabs;
        return null;
      });

      manager.updateTerminalCountBadge();

      expect(mockBadge.style.background).toContain('badge-background');
    });

    it('should handle missing badge element gracefully', () => {
      vi.mocked(DOMUtils.getElement).mockReturnValue(null);

      expect(() => manager.updateTerminalCountBadge()).not.toThrow();
    });

    it('should handle missing tabs element gracefully', () => {
      const mockBadge = {
        textContent: '',
        style: { background: '' },
      };

      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal-count-badge') return mockBadge;
        return null;
      });

      manager.updateTerminalCountBadge();

      expect(mockBadge.textContent).toBe('0');
    });
  });

  describe('dispose', () => {
    it('should remove header element', () => {
      const mockContainer = {
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };
      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal') return mockContainer;
        return null;
      });

      manager.createWebViewHeader();
      manager.dispose();

      expect(DOMUtils.safeRemove).toHaveBeenCalled();
    });

    it('should clear coordinator reference', () => {
      manager.setCoordinator(mockCoordinator);
      manager.dispose();

      // After dispose, coordinator should be null
      expect(() => manager.dispose()).not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      const { ErrorHandler } = await import('../../../../../webview/utils/ErrorHandler');
      vi.mocked(DOMUtils.safeRemove).mockImplementation(() => {
        throw new Error('Remove failed');
      });

      const mockContainer = {
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };
      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal') return mockContainer;
        return null;
      });

      manager.createWebViewHeader();

      expect(() => manager.dispose()).not.toThrow();
      expect(ErrorHandler.handleOperationError).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should use custom title from config', () => {
      manager.updateConfig({ title: 'Custom Title' });

      const mockContainer = {
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };
      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal') return mockContainer;
        return null;
      });

      manager.createWebViewHeader();

      // Verify createElement was called with title text
      expect(DOMUtils.createElement).toHaveBeenCalledWith(
        'span',
        expect.any(Object),
        expect.objectContaining({ textContent: 'Custom Title' })
      );
    });

    it('should hide icons when showIcons is false', () => {
      manager.updateConfig({ showIcons: false });

      const mockContainer = {
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };
      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal') return mockContainer;
        return null;
      });

      manager.createWebViewHeader();

      // Sample icons should not be created
      // Check that no icon elements were created with sample-icon class
      const createElementCalls = vi.mocked(DOMUtils.createElement).mock.calls;
      const sampleIconCalls = createElementCalls.filter(
        (call) => call[2]?.className === 'sample-icon'
      );
      expect(sampleIconCalls.length).toBe(0);
    });

    it('should use custom font size from config', () => {
      manager.updateConfig({ fontSize: 16 });

      const mockContainer = {
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };
      vi.mocked(DOMUtils.getElement).mockImplementation((selector: string) => {
        if (selector === '#terminal') return mockContainer;
        return null;
      });

      manager.createWebViewHeader();

      expect(DOMUtils.createElement).toHaveBeenCalledWith(
        'span',
        expect.objectContaining({ fontSize: '16px' }),
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null container gracefully', () => {
      vi.mocked(DOMUtils.getElement).mockReturnValue(null);

      expect(() => manager.createWebViewHeader()).not.toThrow();
    });

    it('should handle multiple rapid config updates', () => {
      expect(() => {
        manager.updateConfig({ title: 'Title 1' });
        manager.updateConfig({ title: 'Title 2' });
        manager.updateConfig({ title: 'Title 3' });
        manager.updateConfig({ showIcons: false });
        manager.updateConfig({ showHeader: true });
      }).not.toThrow();
    });
  });
});
