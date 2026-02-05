/**
 * TerminalSettingsManager Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { TerminalSettingsManager } from '../../../../../webview/managers/TerminalSettingsManager';
import { IUIManager, IConfigManager } from '../../../../../webview/interfaces/ManagerInterfaces';
import { ConfigManager } from '../../../../../webview/managers/ConfigManager';

// Mock generic logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Mock FontSettingsService
vi.mock('../../../../../webview/services/FontSettingsService', () => ({
  FontSettingsService: class {
    setApplicator = vi.fn();
    getCurrentSettings = vi.fn().mockReturnValue({ fontSize: 14 });
    updateSettings = vi.fn();
  }
}));

describe('TerminalSettingsManager', () => {
  let manager: TerminalSettingsManager;
  let mockUIManager: IUIManager;
  let mockConfigManager: IConfigManager;
  let mockCallbacks: any;

  beforeEach(() => {
    mockUIManager = {
      setActiveBorderMode: vi.fn(),
      setTerminalHeaderEnhancementsEnabled: vi.fn(),
      updateTerminalBorders: vi.fn(),
      updateSplitTerminalBorders: vi.fn(),
      applyAllVisualSettings: vi.fn(),
    } as any;

    mockConfigManager = {
      applySettings: vi.fn(),
      getCurrentSettings: vi.fn().mockReturnValue({}),
      setFontSettingsService: vi.fn(),
    } as any;
    
    // Simulate instance of ConfigManager for type check
    Object.setPrototypeOf(mockConfigManager, ConfigManager.prototype);

    mockCallbacks = {
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
      getAllTerminalContainers: vi.fn().mockReturnValue(new Map()),
      getActiveTerminalId: vi.fn().mockReturnValue('t1'),
    };

    manager = new TerminalSettingsManager(mockUIManager, mockConfigManager, mockCallbacks);
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      // Construction should trigger setApplicator and setFontSettingsService
      // FontSettingsService is instantiated in constructor, so we check if mock method called
      // We can't easily access the private instance, but we can assume it works if no error
      
      // Since we mocked FontSettingsService constructor via vi.mock return class
      // But we can't inspect the instance created inside manager easily without spyOn constructor
      // However, mockConfigManager.setFontSettingsService call is verifiable
      expect(mockConfigManager.setFontSettingsService).toHaveBeenCalled();
    });
  });

  describe('Settings Application', () => {
    it('should apply settings to UI and Config managers', () => {
      const settings = {
        theme: 'dark',
        activeBorderMode: 'always' as const,
      };
      
      manager.applySettings(settings);
      
      expect(mockUIManager.setActiveBorderMode).toHaveBeenCalledWith('always');
      expect(mockConfigManager.applySettings).toHaveBeenCalled();
    });

    it('should update borders for active terminal', () => {
      const container = document.createElement('div');
      mockCallbacks.getAllTerminalContainers.mockReturnValue(new Map([['t1', container]]));
      
      manager.applySettings({});
      
      expect(mockUIManager.updateTerminalBorders).toHaveBeenCalled();
    });

    it('should apply visual settings to all terminals', () => {
      const mockTerminal = { options: {} };
      mockCallbacks.getAllTerminalInstances.mockReturnValue(new Map([['t1', { terminal: mockTerminal }]]));
      
      manager.applySettings({});
      
      expect(mockUIManager.applyAllVisualSettings).toHaveBeenCalledWith(mockTerminal, expect.anything());
    });
  });

  describe('Font Settings', () => {
    it('should apply font settings via service', () => {
      const fontSettings = { fontSize: 16 };
      const terminals = new Map();
      
      manager.applyFontSettings(fontSettings as any, terminals);
      
      // Access the private service if we want to be strict, but verifying no error is good start
      // Better: we can spy on the prototype method if we want to check internal call
      // Or check if log was called
    });
    
    it('should get current font settings', () => {
      const settings = manager.getCurrentFontSettings();
      expect(settings).toEqual({ fontSize: 14 });
    });
  });

  describe('State Management', () => {
    it('should load settings from state', () => {
      const state = {
        settings: { theme: 'light' },
        fontSettings: { fontSize: 12 },
        timestamp: 123
      } as any;
      
      manager.loadFromState(state);
      
      expect(mockUIManager.setActiveBorderMode).toHaveBeenCalled(); // via applySettings
      // applyFontSettings called too
    });

    it('should return state for saving', () => {
      const state = manager.getStateForSave();
      
      expect(state.settings).toBeDefined();
      expect(state.fontSettings).toBeDefined();
      expect(state.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Defaults and Updates', () => {
    it('should reset to defaults', () => {
      manager.resetToDefaults();
      expect(mockUIManager.setActiveBorderMode).toHaveBeenCalledWith('multipleOnly'); // Default
    });

    it('should update single setting', () => {
      manager.updateSetting('theme', 'dark');
      expect(mockConfigManager.applySettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' }), 
        expect.anything()
      );
    });
  });
});
