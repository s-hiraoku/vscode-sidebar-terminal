/**
 * NotificationUtils unit tests
 */
import * as sinon from 'sinon';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

use(sinonChai);
import { JSDOM } from 'jsdom';
import {
  showTerminalCloseError,
  showTerminalKillError,
  showSplitLimitWarning,
  showNotification,
  NotificationConfig
} from '../../../webview/utils/NotificationUtils';

describe('NotificationUtils', () => {
  let dom: JSDOM;
  let document: Document;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    // JSDOM環境をセットアップ
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="notification-container"></div>
        </body>
      </html>
    `);
    document = dom.window.document;
    
    // グローバルに設定
    (global as any).document = document;
    (global as any).window = dom.window;
    (global as any).HTMLElement = dom.window.HTMLElement;
    
    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    sandbox.restore();
    
    // クリーンアップ
    delete (global as any).document;
    delete (global as any).window;
    delete (global as any).HTMLElement;
  });

  describe('showTerminalCloseError', () => {
    it('should show warning notification for single terminal', () => {
      showTerminalCloseError(1);
      
      // 通知が作成されているかチェック (正しいクラス名を使用)
      const notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);
      
      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('Must keep at least 1 terminal open');
    });

    it('should show warning notification for multiple terminals', () => {
      showTerminalCloseError(3);
      
      const notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);
      
      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('Must keep at least 3 terminals open');
    });
  });

  describe('showTerminalKillError', () => {
    it('should show error notification with custom reason', () => {
      const reason = 'Process is busy';
      showTerminalKillError(reason);
      
      const notifications = document.querySelectorAll('.terminal-notification');
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
      
      const notifications = document.querySelectorAll('.terminal-notification');
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
        icon: '✅'
      };
      
      showNotification(config);
      
      const notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);
      
      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('Test Title');
      expect(notification.textContent).to.include('Test Message');
      expect(notification.textContent).to.include('✅');
    });

    it('should auto-remove notification after duration', () => {
      const config: NotificationConfig = {
        type: 'info',
        title: 'Auto Remove',
        message: 'This will disappear',
        duration: 1000
      };
      
      showNotification(config);
      
      // 通知が存在することを確認
      let notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);
      
      // 時間を進める
      clock.tick(1000);
      
      // 通知が削除されていることを確認
      notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(0);
    });

    it('should use default duration when not specified', () => {
      const config: NotificationConfig = {
        type: 'info',
        title: 'Default Duration',
        message: 'Uses default'
      };
      
      showNotification(config);
      
      // 通知が存在することを確認
      let notifications = document.querySelectorAll('.notification');
      expect(notifications.length).to.equal(1);
      
      // デフォルトの時間未満では削除されない
      clock.tick(3000);
      notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);
      
      // デフォルトの時間（4000ms）後には削除される
      clock.tick(1000);
      notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(0);
    });

    it('should handle multiple notifications', () => {
      showNotification({
        type: 'info',
        title: 'First',
        message: 'First notification'
      });
      
      showNotification({
        type: 'warning',
        title: 'Second',
        message: 'Second notification'
      });
      
      const notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(2);
    });

    it('should handle notification without icon', () => {
      const config: NotificationConfig = {
        type: 'info',
        title: 'No Icon',
        message: 'This has no icon'
      };
      
      showNotification(config);
      
      const notifications = document.querySelectorAll('.terminal-notification');
      expect(notifications.length).to.equal(1);
      
      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).to.include('No Icon');
      expect(notification.textContent).to.include('This has no icon');
    });
  });
});