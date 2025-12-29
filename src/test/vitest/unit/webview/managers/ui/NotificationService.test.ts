import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from '../../../../../../webview/managers/ui/NotificationService';
import { DOMUtils } from '../../../../../../webview/utils/DOMUtils';

// Mock dependencies
vi.mock('../../../../../../webview/utils/ManagerLogger');
vi.mock('../../../../../../webview/utils/DOMUtils');

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new NotificationService();
    
    // Mock DOMUtils.createElement
    vi.mocked(DOMUtils.createElement).mockImplementation((tag, styles, props) => {
      const el = document.createElement(tag);
      if (styles) Object.assign(el.style, styles);
      if (props) Object.assign(el, props);
      return el as any;
    });
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  describe('createNotificationElement', () => {
    it('should create notification with correct structure', () => {
      const config = {
        type: 'info' as const,
        title: 'Test Title',
        message: 'Test Message',
      };

      const element = service.createNotificationElement(config);
      
      expect(element.classList.contains('terminal-notification')).toBe(true);
      expect(element.textContent).toContain('Test Title');
      expect(element.textContent).toContain('Test Message');
      expect(element.textContent).toContain('ℹ️'); // Default info icon
    });

    it('should use custom icon if provided', () => {
      const config = {
        type: 'success' as const,
        title: 'Title',
        message: 'Message',
        icon: '🚀',
      };

      const element = service.createNotificationElement(config);
      
      expect(element.textContent).toContain('🚀');
    });

    it('should apply correct colors for error', () => {
      const config = {
        type: 'error' as const,
        title: 'Error',
        message: 'Message',
      };

      service.createNotificationElement(config);
      
      expect(DOMUtils.createElement).toHaveBeenCalledWith(
        'div',
        expect.objectContaining({
          border: expect.stringContaining('var(--vscode-notificationError-border'),
        }),
        expect.any(Object)
      );
    });
  });

  describe('ensureAnimationsLoaded', () => {
    it('should inject style tag once', () => {
      service.ensureAnimationsLoaded();
      
      const style = document.getElementById('ui-manager-animations');
      expect(style).not.toBeNull();
      expect(style?.textContent).toContain('@keyframes slideInFromRight');
      
      // Call again, should not duplicate (though difficult to test duplication without spying on appendChild, checking count is enough)
      service.ensureAnimationsLoaded();
      expect(document.querySelectorAll('#ui-manager-animations').length).toBe(1);
    });
  });

  describe('helper methods', () => {
    it('getNotificationColors returns correct values', () => {
      const errorColors = service.getNotificationColors('error');
      expect(errorColors.border).toContain('Error');
      
      const warningColors = service.getNotificationColors('warning');
      expect(warningColors.border).toContain('Warning');
      
      const successColors = service.getNotificationColors('success');
      expect(successColors.border).toContain('success');
      
      const infoColors = service.getNotificationColors('info');
      expect(infoColors.border).toContain('info');
    });

    it('getDefaultIcon returns correct icons', () => {
      expect(service.getDefaultIcon('error')).toBe('❌');
      expect(service.getDefaultIcon('warning')).toBe('⚠️');
      expect(service.getDefaultIcon('success')).toBe('✅');
      expect(service.getDefaultIcon('info')).toBe('ℹ️');
    });
  });
});
