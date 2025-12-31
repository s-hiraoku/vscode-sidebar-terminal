import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigurationMigrator } from '../../../../config/ConfigurationMigrator';
import { getUnifiedConfigurationService } from '../../../../config/UnifiedConfigurationService';
import * as vscode from 'vscode';

// Mock dependencies
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

const mockUnifiedService = {
  initialize: vi.fn(),
  get: vi.fn(),
  getExtensionTerminalConfig: vi.fn().mockReturnValue({}),
  getWebViewFontSettings: vi.fn().mockReturnValue({}),
  getAltClickSettings: vi.fn().mockReturnValue({ altClickMovesCursor: true }),
  getFontSize: vi.fn().mockReturnValue(14),
  getFontFamily: vi.fn().mockReturnValue('monospace'),
  getWebViewTerminalSettings: vi.fn().mockReturnValue({}),
  getCompleteExtensionConfig: vi.fn().mockReturnValue({ fontSize: 14, fontFamily: 'monospace' }),
  isFeatureEnabled: vi.fn().mockReturnValue(true),
  onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  getDebugInfo: vi.fn().mockReturnValue({}),
  getCompleteExtensionTerminalConfig: vi.fn().mockReturnValue({}),
};

vi.mock('../../../../config/UnifiedConfigurationService', () => ({
  getUnifiedConfigurationService: vi.fn(() => mockUnifiedService),
}));

describe('ConfigurationMigrator', () => {
  let migrator: ConfigurationMigrator;
  let mockContext: any;
  let globalState: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    globalState = new Map();
    
    mockContext = {
      globalState: {
        get: vi.fn((key) => globalState.get(key)),
        update: vi.fn((key, value) => {
          globalState.set(key, value);
          return Promise.resolve();
        }),
      },
      extension: {
        packageJSON: { version: '1.0.0' }
      }
    };

    // Default VS Code config mocks
    (vscode.workspace.getConfiguration as any).mockReturnValue({
      get: vi.fn((key) => 'value'),
      update: vi.fn().mockResolvedValue(undefined),
    });

    migrator = new ConfigurationMigrator(mockContext);
  });

  describe('isMigrationCompleted', () => {
    it('should return true if completed marker exists', async () => {
      globalState.set('configurationMigrationCompleted', {});
      expect(await migrator.isMigrationCompleted()).toBe(true);
    });

    it('should return false if marker missing', async () => {
      expect(await migrator.isMigrationCompleted()).toBe(false);
    });
  });

  describe('migrateAll', () => {
    it('should perform migration and create backup', async () => {
      const result = await migrator.migrateAll();
      
      expect(result.success).toBe(true);
      expect(result.backupCreated).toBe(true);
      expect(mockContext.globalState.update).toHaveBeenCalledWith('configurationBackup', expect.any(Object));
      expect(mockContext.globalState.update).toHaveBeenCalledWith('configurationMigrationCompleted', expect.any(Object));
      expect(mockUnifiedService.initialize).toHaveBeenCalled();
    });

    it('should handle migration errors', async () => {
      mockUnifiedService.get.mockImplementationOnce(() => { throw new Error('Failed'); });
      
      const result = await migrator.migrateAll();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateCurrentConfiguration', () => {
    it('should return valid if all keys present', async () => {
      mockUnifiedService.get.mockReturnValue('some-value');
      
      const validation = await migrator.validateCurrentConfiguration();
      expect(validation.isValid).toBe(true);
    });

    it('should return invalid if keys missing', async () => {
      mockUnifiedService.get.mockReturnValue(undefined);
      
      const validation = await migrator.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.missingKeys.length).toBeGreaterThan(0);
    });
  });

  describe('rollbackMigration', () => {
    it('should restore from backup', async () => {
      globalState.set('configurationBackup', {
        configurations: {
          'terminal.integrated.fontSize': 12
        }
      });

      const success = await migrator.rollbackMigration();
      
      expect(success).toBe(true);
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('terminal.integrated');
      expect(mockContext.globalState.update).toHaveBeenCalledWith('configurationMigrationCompleted', undefined);
    });

    it('should return false if no backup found', async () => {
      const success = await migrator.rollbackMigration();
      expect(success).toBe(false);
    });
  });
});
