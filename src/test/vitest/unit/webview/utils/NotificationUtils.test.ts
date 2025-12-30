import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as NotificationUtils from '../../../../../webview/utils/NotificationUtils';
import { UIManager } from '../../../../../webview/managers/UIManager';

// Mock dependencies
const mockUIManager = {
  ensureAnimationsLoaded: vi.fn(),
  createNotificationElement: vi.fn(),
};

describe('NotificationUtils', () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    mockUIManager.createNotificationElement.mockImplementation(() => {
      const el = document.createElement('div');
      el.className = 'notification';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'notification-close';
      el.appendChild(closeBtn);
      return el;
    });

    NotificationUtils.setUIManager(mockUIManager as unknown as UIManager);
  });

  afterEach(() => {
    vi.useRealTimers();
    NotificationUtils.clearAllNotifications();
  });

  describe('showNotification', () => {
    it('should create and append notification', () => {
      NotificationUtils.showNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      expect(mockUIManager.createNotificationElement).toHaveBeenCalled();
      expect(document.body.querySelector('.notification')).not.toBeNull();
    });

    it('should remove notification after duration', () => {
      NotificationUtils.showNotification({
        type: 'info',
        title: 'Test',
        message: 'Message',
        duration: 1000
      });

      expect(document.body.querySelector('.notification')).not.toBeNull();

      vi.advanceTimersByTime(1000); // Trigger removal timeout
      vi.advanceTimersByTime(300);  // Trigger animation timeout

      expect(document.body.querySelector('.notification')).toBeNull();
    });

    it('should remove notification on close button click', () => {
      NotificationUtils.showNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      const closeBtn = document.body.querySelector('.notification-close') as HTMLButtonElement;
      closeBtn.click();

      vi.advanceTimersByTime(300); // Trigger animation timeout

      expect(document.body.querySelector('.notification')).toBeNull();
    });
  });

  describe('Utility functions', () => {
    it('showTerminalCloseError should show warning', () => {
      NotificationUtils.showTerminalCloseError(2);
      
      expect(mockUIManager.createNotificationElement).toHaveBeenCalledWith(expect.objectContaining({
        type: 'warning',
        title: 'Cannot close terminal'
      }));
    });

    it('showTerminalKillError should show error', () => {
      NotificationUtils.showTerminalKillError('reason');
      
      expect(mockUIManager.createNotificationElement).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        title: 'Terminal kill failed'
      }));
    });

    it('showCliAgentDetected should show info', () => {
      NotificationUtils.showCliAgentDetected();
      
      expect(mockUIManager.createNotificationElement).toHaveBeenCalledWith(expect.objectContaining({
        type: 'info',
        title: 'CLI Agent Detected'
      }));
    });

    it('showSessionRestoreError should handle different error types', () => {
      NotificationUtils.showSessionRestoreError('error', false, 'file');
      expect(mockUIManager.createNotificationElement).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Session File Missing',
        type: 'warning'
      }));

      NotificationUtils.showSessionRestoreError('error', false, 'corruption');
      expect(mockUIManager.createNotificationElement).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Session Data Corrupted',
        type: 'warning'
      }));

      NotificationUtils.showSessionRestoreError('error', false, 'unknown');
      expect(mockUIManager.createNotificationElement).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Session Restore Failed',
        type: 'error'
      }));
    });
  });

  describe('clearAllNotifications', () => {
    it('should remove all active notifications', () => {
      NotificationUtils.showNotification({ type: 'info', title: '1', message: '1' });
      NotificationUtils.showNotification({ type: 'info', title: '2', message: '2' });

      expect(document.body.querySelectorAll('.notification').length).toBe(2);

      NotificationUtils.clearAllNotifications();
      vi.advanceTimersByTime(300);

      expect(document.body.querySelectorAll('.notification').length).toBe(0);
    });
  });
});
