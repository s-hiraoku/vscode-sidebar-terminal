import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../../../../../core/plugins/PluginManager';
import { EventBus } from '../../../../../core/EventBus';

describe('PluginManager', () => {
  let manager: PluginManager;
  let mockEventBus: any;
  let mockPlugin: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    };

    mockPlugin = {
      metadata: { id: 'test-plugin', name: 'Test Plugin' },
      state: 'registered',
      activate: vi.fn().mockResolvedValue(undefined),
      deactivate: vi.fn().mockResolvedValue(undefined),
      configure: vi.fn(),
      dispose: vi.fn(),
    };

    manager = new PluginManager(mockEventBus as unknown as EventBus);
  });

  describe('registerPlugin', () => {
    it('should register a standard plugin', async () => {
      await manager.registerPlugin(mockPlugin);
      expect(manager.hasPlugin('test-plugin')).toBe(true);
      expect(manager.getPlugin('test-plugin')).toBe(mockPlugin);
    });

    it('should register and activate immediately if requested', async () => {
      await manager.registerPlugin(mockPlugin, { activateImmediately: true });
      expect(mockPlugin.activate).toHaveBeenCalled();
    });

    it('should identify agent plugins', async () => {
      const agentPlugin = {
        ...mockPlugin,
        detect: vi.fn(),
        onAgentActivated: vi.fn(),
        onAgentDeactivated: vi.fn(),
        getAgentType: vi.fn().mockReturnValue('test-agent'),
      };

      await manager.registerPlugin(agentPlugin);
      expect(manager.getAgentPlugins()).toContain(agentPlugin);
    });
  });

  describe('plugin lifecycle', () => {
    beforeEach(async () => {
      await manager.registerPlugin(mockPlugin);
    });

    it('should activate plugin', async () => {
      await manager.activatePlugin('test-plugin');
      expect(mockPlugin.activate).toHaveBeenCalled();
    });

    it('should deactivate plugin', async () => {
      mockPlugin.state = 'active';
      await manager.deactivatePlugin('test-plugin');
      expect(mockPlugin.deactivate).toHaveBeenCalled();
    });

    it('should configure plugin', () => {
      const config = { enabled: true };
      manager.configurePlugin('test-plugin', config);
      expect(mockPlugin.configure).toHaveBeenCalledWith(config);
    });
  });

  describe('error handling', () => {
    it('should throw if manager is disposed', async () => {
      manager.dispose();
      await expect(manager.activatePlugin('any')).rejects.toThrow('PluginManager has been disposed');
    });

    it('should handle activation failures', async () => {
      await manager.registerPlugin(mockPlugin);
      mockPlugin.activate.mockRejectedValue(new Error('Fail'));
      
      await expect(manager.activatePlugin('test-plugin')).rejects.toThrow('Fail');
    });
  });

  describe('disposal', () => {
    it('should dispose all plugins', async () => {
      await manager.registerPlugin(mockPlugin);
      manager.dispose();
      expect(mockPlugin.dispose).toHaveBeenCalled();
      expect(manager.getAllPlugins().length).toBe(0);
    });
  });
});
