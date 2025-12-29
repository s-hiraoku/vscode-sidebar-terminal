import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { PluginConfigurationService } from '../../../../../core/plugins/PluginConfigurationService';
import { PluginManager } from '../../../../../core/plugins/PluginManager';

// Mock VS Code
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

describe('PluginConfigurationService', () => {
  let service: PluginConfigurationService;
  let mockPluginManager: any;
  let mockConfig: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockConfig = {
      get: vi.fn((key, defaultValue) => {
        if (key.includes('enablePluginSystem')) return true;
        if (key.includes('enabled')) return true;
        if (key.includes('confidenceThreshold')) return 0.7;
        return defaultValue;
      }),
    };

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig);

    mockPluginManager = {
      getPlugin: vi.fn().mockReturnValue({
        configure: vi.fn(),
        state: 'registered'
      }),
      activatePlugin: vi.fn().mockResolvedValue(undefined),
      deactivatePlugin: vi.fn().mockResolvedValue(undefined),
    };

    service = new PluginConfigurationService(mockPluginManager as unknown as PluginManager);
  });

  describe('getConfiguration', () => {
    it('should return complete plugin system config', () => {
      const config = service.getConfiguration();
      expect(config.enablePluginSystem).toBe(true);
      expect(config.claude.enabled).toBe(true);
      expect(config.claude.confidenceThreshold).toBe(0.7);
    });
  });

  describe('initialize', () => {
    it('should setup config watcher and apply initial config', () => {
      service.initialize();
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
      expect(mockPluginManager.getPlugin).toHaveBeenCalledWith('claude-agent');
    });
  });

  describe('applyConfiguration', () => {
    it('should deactivate plugins if system is disabled', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key.includes('enablePluginSystem')) return false;
        return true;
      });

      // We need to trigger it via initialize or call a private method if we can
      // Since it's private, we'll initialize and check effects
      service.initialize();
      
      // Should stop early and not configure plugins
      expect(mockPluginManager.activatePlugin).not.toHaveBeenCalled();
    });

    it('should activate enabled plugins', () => {
      const mockPlugin = {
        configure: vi.fn(),
        state: 'registered'
      };
      mockPluginManager.getPlugin.mockReturnValue(mockPlugin);

      service.initialize();
      
      expect(mockPlugin.configure).toHaveBeenCalled();
      expect(mockPluginManager.activatePlugin).toHaveBeenCalledWith('claude-agent');
    });

    it('should deactivate disabled plugins', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key.includes('claude.enabled')) return false;
        return true;
      });
      
      const mockPlugin = {
        configure: vi.fn(),
        state: 'active'
      };
      mockPluginManager.getPlugin.mockReturnValue(mockPlugin);

      service.initialize();
      
      expect(mockPluginManager.deactivatePlugin).toHaveBeenCalledWith('claude-agent');
    });
  });
});
