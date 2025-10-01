/**
 * TerminalContainerManager Unit Tests
 */

import { TerminalContainerManager } from '../TerminalContainerManager';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';

describe('TerminalContainerManager', () => {
  let containerManager: TerminalContainerManager;
  let mockCoordinator: Partial<IManagerCoordinator>;

  beforeEach(() => {
    // DOM環境のセットアップ
    document.body.innerHTML = '';

    // モックコーディネーター
    mockCoordinator = {
      log: jest.fn(),
      postMessageToExtension: jest.fn(),
    };

    containerManager = new TerminalContainerManager();
    containerManager.setCoordinator(mockCoordinator as IManagerCoordinator);
  });

  afterEach(() => {
    containerManager.dispose();
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(() => containerManager.initialize()).not.toThrow();
    });

    it('should discover existing containers on initialization', () => {
      // 既存のコンテナを作成
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      container1.setAttribute('data-terminal-id', 'terminal-1');
      document.body.appendChild(container1);

      const container2 = document.createElement('div');
      container2.className = 'terminal-container';
      container2.setAttribute('data-terminal-id', 'terminal-2');
      document.body.appendChild(container2);

      // 初期化
      const newManager = new TerminalContainerManager();
      newManager.setCoordinator(mockCoordinator as IManagerCoordinator);
      newManager.initialize();

      // 発見されたコンテナを確認
      const debugInfo = newManager.getDebugInfo();
      expect(debugInfo.cachedContainers).toBe(2);

      newManager.dispose();
    });
  });

  describe('registerContainer', () => {
    it('should register a container', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';
      container.setAttribute('data-terminal-id', 'terminal-1');
      document.body.appendChild(container);

      containerManager.registerContainer('terminal-1', container);

      const retrieved = containerManager.getContainer('terminal-1');
      expect(retrieved).toBe(container);
    });

    it('should set container mode to normal on registration', () => {
      const container = document.createElement('div');
      containerManager.registerContainer('terminal-1', container);

      const debugInfo = containerManager.getDebugInfo();
      expect(debugInfo.modes['terminal-1']).toBe('normal');
    });
  });

  describe('unregisterContainer', () => {
    it('should unregister a container', () => {
      const container = document.createElement('div');
      containerManager.registerContainer('terminal-1', container);

      containerManager.unregisterContainer('terminal-1');

      const debugInfo = containerManager.getDebugInfo();
      expect(debugInfo.cachedContainers).toBe(0);
    });
  });

  describe('setContainerVisibility', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.className = 'terminal-container';
      document.body.appendChild(container);
      containerManager.registerContainer('terminal-1', container);
    });

    it('should hide a container', () => {
      containerManager.setContainerVisibility('terminal-1', false);

      expect(container.classList.contains('hidden-mode')).toBe(true);
    });

    it('should show a hidden container', () => {
      container.classList.add('hidden-mode');

      containerManager.setContainerVisibility('terminal-1', true);

      expect(container.classList.contains('hidden-mode')).toBe(false);
    });

    it('should handle non-existent container gracefully', () => {
      expect(() => {
        containerManager.setContainerVisibility('non-existent', true);
      }).not.toThrow();
    });
  });

  describe('setContainerMode', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.className = 'terminal-container';
      document.body.appendChild(container);
      containerManager.registerContainer('terminal-1', container);
    });

    it('should set normal mode', () => {
      containerManager.setContainerMode('terminal-1', 'normal');

      expect(container.classList.contains('normal-mode')).toBe(true);
      expect(container.classList.contains('fullscreen-mode')).toBe(false);
      expect(container.classList.contains('split-mode')).toBe(false);
    });

    it('should set fullscreen mode', () => {
      containerManager.setContainerMode('terminal-1', 'fullscreen');

      expect(container.classList.contains('fullscreen-mode')).toBe(true);
      expect(container.classList.contains('normal-mode')).toBe(false);
    });

    it('should set split mode', () => {
      containerManager.setContainerMode('terminal-1', 'split');

      expect(container.classList.contains('split-mode')).toBe(true);
      expect(container.classList.contains('normal-mode')).toBe(false);
    });

    it('should switch between modes correctly', () => {
      containerManager.setContainerMode('terminal-1', 'normal');
      expect(container.classList.contains('normal-mode')).toBe(true);

      containerManager.setContainerMode('terminal-1', 'fullscreen');
      expect(container.classList.contains('normal-mode')).toBe(false);
      expect(container.classList.contains('fullscreen-mode')).toBe(true);

      containerManager.setContainerMode('terminal-1', 'split');
      expect(container.classList.contains('fullscreen-mode')).toBe(false);
      expect(container.classList.contains('split-mode')).toBe(true);
    });
  });

  describe('getContainer', () => {
    it('should return cached container', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      containerManager.registerContainer('terminal-1', container);

      const retrieved = containerManager.getContainer('terminal-1');
      expect(retrieved).toBe(container);
    });

    it('should find container in DOM if not cached', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';
      container.setAttribute('data-terminal-id', 'terminal-1');
      document.body.appendChild(container);

      const retrieved = containerManager.getContainer('terminal-1');
      expect(retrieved).toBe(container);
    });

    it('should return null for non-existent container', () => {
      const retrieved = containerManager.getContainer('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should handle stale cache entries', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      containerManager.registerContainer('terminal-1', container);

      // コンテナをDOMから削除
      document.body.removeChild(container);

      // キャッシュから削除されるべき
      const retrieved = containerManager.getContainer('terminal-1');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllContainers', () => {
    it('should return all valid containers', () => {
      const container1 = document.createElement('div');
      document.body.appendChild(container1);
      containerManager.registerContainer('terminal-1', container1);

      const container2 = document.createElement('div');
      document.body.appendChild(container2);
      containerManager.registerContainer('terminal-2', container2);

      const all = containerManager.getAllContainers();
      expect(all.size).toBe(2);
      expect(all.get('terminal-1')).toBe(container1);
      expect(all.get('terminal-2')).toBe(container2);
    });

    it('should remove stale cache entries', () => {
      const container1 = document.createElement('div');
      document.body.appendChild(container1);
      containerManager.registerContainer('terminal-1', container1);

      const container2 = document.createElement('div');
      document.body.appendChild(container2);
      containerManager.registerContainer('terminal-2', container2);

      // container1 をDOMから削除
      document.body.removeChild(container1);

      const all = containerManager.getAllContainers();
      expect(all.size).toBe(1);
      expect(all.get('terminal-2')).toBe(container2);
    });
  });

  describe('resetAllToNormalMode', () => {
    it('should reset all containers to normal mode and make them visible', () => {
      const container1 = document.createElement('div');
      document.body.appendChild(container1);
      containerManager.registerContainer('terminal-1', container1);
      containerManager.setContainerMode('terminal-1', 'fullscreen');
      containerManager.setContainerVisibility('terminal-1', false);

      const container2 = document.createElement('div');
      document.body.appendChild(container2);
      containerManager.registerContainer('terminal-2', container2);
      containerManager.setContainerMode('terminal-2', 'split');

      containerManager.resetAllToNormalMode();

      expect(container1.classList.contains('normal-mode')).toBe(true);
      expect(container1.classList.contains('fullscreen-mode')).toBe(false);
      expect(container1.classList.contains('hidden-mode')).toBe(false);

      expect(container2.classList.contains('normal-mode')).toBe(true);
      expect(container2.classList.contains('split-mode')).toBe(false);
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information', () => {
      const container1 = document.createElement('div');
      containerManager.registerContainer('terminal-1', container1);
      containerManager.setContainerMode('terminal-1', 'fullscreen');

      const container2 = document.createElement('div');
      containerManager.registerContainer('terminal-2', container2);
      containerManager.setContainerMode('terminal-2', 'split');

      const debugInfo = containerManager.getDebugInfo();

      expect(debugInfo.cachedContainers).toBe(2);
      expect(debugInfo.modes['terminal-1']).toBe('fullscreen');
      expect(debugInfo.modes['terminal-2']).toBe('split');
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      containerManager.registerContainer('terminal-1', container);
      containerManager.setContainerMode('terminal-1', 'fullscreen');

      containerManager.dispose();

      const debugInfo = containerManager.getDebugInfo();
      expect(debugInfo.cachedContainers).toBe(0);
      expect(container.classList.contains('normal-mode')).toBe(true);
    });
  });
});
