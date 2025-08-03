/**
 * NotificationUtils unit tests
 */
/* eslint-disable */
// @ts-nocheck
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

use(sinonChai);
import {
  showTerminalCloseError,
  showTerminalKillError,
  showSplitLimitWarning,
  showNotification,
  NotificationConfig,
} from '../../../webview/utils/NotificationUtils';
import { 
  setupTestEnvironment, 
  cleanupTestEnvironment, 
  TestEnvironment 
} from '../../utils/CommonTestSetup';

describe('NotificationUtils', () => {
  let testEnv: TestEnvironment;

  beforeEach(() => {
    testEnv = setupTestEnvironment({ 
      withClock: true, 
      withNotificationContainer: true 
    });
  });

  afterEach(() => {
    cleanupTestEnvironment(testEnv);
  });

  describe('showTerminalCloseError', () => {
    it('should show warning notification for single terminal', () => {
      showTerminalCloseError(1);

      // 通知が作成されているかチェック (正しいクラス名を使用)
      const notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('Must keep at least 1 terminal open');
    });

    it('should show warning notification for multiple terminals', () => {
      showTerminalCloseError(3);

      const notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('Must keep at least 3 terminals open');
    });
  });

  describe('showTerminalKillError', () => {
    it('should show error notification with custom reason', () => {
      const reason = 'Process is busy';
      showTerminalKillError(reason);

      const notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('Terminal kill failed');
      expect(notification.textContent).to.include(reason);
    });
  });

  describe('showSplitLimitWarning', () => {
    it('should show warning notification for split limit', () => {
      const reason = 'Maximum 5 terminals allowed';
      showSplitLimitWarning(reason);

      const notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('Split Limit Reached');
      expect(notification.textContent).to.include(reason);
    });
  });

  describe('showNotification', () => {
    it('should create notification with all config properties', () => {
      const config: NotificationConfig = {
        type: 'success',
        title: 'Test Title',
        message: 'Test Message',
        duration: 2000,
        icon: '✅',
      };

      showNotification(config);

      const notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('Test Title');
      expect(notification.textContent).to.include('Test Message');
      expect(notification.textContent).to.include('✅');
    });

    it.skip('should auto-remove notification after duration', () => {
      const config: NotificationConfig = {
        type: 'info',
        title: 'Auto Remove',
        message: 'This will disappear',
        duration: 1000,
      };

      showNotification(config);

      // 通知が存在することを確認
      let notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      // 時間を進める
      clock.tick(1000);

      // 通知が削除されていることを確認
      notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(0);
    });

    it.skip('should use default duration when not specified', () => {
      const config: NotificationConfig = {
        type: 'info',
        title: 'Default Duration',
        message: 'Uses default',
      };

      showNotification(config);

      // 通知が存在することを確認
      let notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      // デフォルトの時間未満では削除されない
      clock.tick(3000);
      notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      // デフォルトの時間（4000ms）後には削除される
      clock.tick(1000);
      notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(0);
    });

    it('should handle multiple notifications', () => {
      showNotification({
        type: 'info',
        title: 'First',
        message: 'First notification',
      });

      showNotification({
        type: 'warning',
        title: 'Second',
        message: 'Second notification',
      });

      const notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(2);
    });

    it('should handle notification without icon', () => {
      const config: NotificationConfig = {
        type: 'info',
        title: 'No Icon',
        message: 'This has no icon',
      };

      showNotification(config);

      const notifications = testEnv.document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);

      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('No Icon');
      expect(notification.textContent).to.include('This has no icon');
    });
  });
});
