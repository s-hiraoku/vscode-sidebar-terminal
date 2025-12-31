import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigurationService } from '../../../../config/ConfigurationService';
import * as vscode from 'vscode';

const mocks = vi.hoisted(() => {
  return {
    configuration: {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
    onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
});

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue(mocks.configuration),
    onDidChangeConfiguration: mocks.onDidChangeConfiguration,
  },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
}));

vi.mock('../../../../services/FeatureFlagService', () => ({
  FeatureFlagService: class {
    dispose = vi.fn();
    isEnhancedScrollbackEnabled = vi.fn().mockReturnValue(true);
    getScrollbackLineLimit = vi.fn().mockReturnValue(1000);
    isVSCodeStandardIMEEnabled = vi.fn().mockReturnValue(true);
    isVSCodeKeyboardShortcutsEnabled = vi.fn().mockReturnValue(true);
    isVSCodeStandardCursorEnabled = vi.fn().mockReturnValue(true);
    isFullANSISupportEnabled = vi.fn().mockReturnValue(true);
  },
}));

vi.mock('../../../../utils/logger', () => ({
  extension: vi.fn(),
}));

describe('ConfigurationService', () => {
  let service: ConfigurationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = ConfigurationService.getInstance();
  });

  afterEach(() => {
    service.dispose();
  });

  it('should be a singleton', () => {
    const service2 = ConfigurationService.getInstance();
    expect(service).toBe(service2);
  });

  describe('getCachedValue', () => {
    it('should return value from VS Code config and cache it', () => {
      mocks.configuration.get.mockReturnValue('test-value');
      
      const value = service.getCachedValue('section', 'key', 'default');
      
      expect(value).toBe('test-value');
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('section');
      
      // Second call should hit cache
      const value2 = service.getCachedValue('section', 'key', 'default');
      expect(value2).toBe('test-value');
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshValue', () => {
    it('should bypass cache and fetch again', () => {
      mocks.configuration.get.mockReturnValue('val1');
      service.getCachedValue('s', 'k', 'd');
      
      mocks.configuration.get.mockReturnValue('val2');
      const val = service.refreshValue('s', 'k', 'd');
      
      expect(val).toBe('val2');
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateValue', () => {
    it('should update VS Code config and cache', async () => {
      await service.updateValue('section', 'key', 'new-val');
      
      expect(mocks.configuration.update).toHaveBeenCalledWith('key', 'new-val', expect.any(Number));
      
      // Cache should be updated
      mocks.configuration.get.mockClear();
      const cached = service.getCachedValue('section', 'key', 'default');
      expect(cached).toBe('new-val');
      expect(mocks.configuration.get).not.toHaveBeenCalled();
    });
  });

  describe('Feature Flag delegation', () => {
    it('should delegate to feature flag service', () => {
      expect(service.isEnhancedScrollbackEnabled()).toBe(true);
      expect(service.getScrollbackLineLimit()).toBe(1000);
    });
  });

  describe('Events', () => {
    it('should register change handler', () => {
      const handler = vi.fn();
      service.onConfigurationChanged(handler);
      
      // Manually trigger private notification for testing
      (service as any).notifyConfigurationChange('section', {} as any);
      
      expect(handler).toHaveBeenCalledWith('section', '*', null, null);
    });
  });
});
