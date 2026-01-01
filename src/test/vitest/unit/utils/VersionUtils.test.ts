import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VersionUtils } from '../../../../utils/VersionUtils';
import * as vscode from 'vscode';

// Mock VS Code
const mockExtension = {
  packageJSON: {
    version: '1.2.3',
    displayName: 'Test Extension',
  },
};

// Mock vscode module
vi.mock('vscode', () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));

describe('VersionUtils', () => {
  beforeEach(() => {
    // Clear cache before each test
    VersionUtils.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    VersionUtils.clearCache();
  });

  describe('getExtensionVersion', () => {
    it('should return version from extension manifest', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(mockExtension as any);
      expect(VersionUtils.getExtensionVersion()).toBe('1.2.3');
    });

    it('should return cached version on second call', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(mockExtension as any);
      VersionUtils.getExtensionVersion();

      // Clear mock to ensure we hit cache
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      expect(VersionUtils.getExtensionVersion()).toBe('1.2.3');
    });

    it('should return Unknown if extension not found', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(VersionUtils.getExtensionVersion()).toBe('Unknown');
      expect(consoleSpy).toHaveBeenCalledWith('[VersionUtils] Extension not found, returning fallback version');
    });

    it('should cache Unknown if extension not found (fix for error spam)', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // First call - should log warning
      expect(VersionUtils.getExtensionVersion()).toBe('Unknown');
      
      // Second call - should return cached 'Unknown' without calling getExtension again
      vi.mocked(vscode.extensions.getExtension).mockClear();
      expect(VersionUtils.getExtensionVersion()).toBe('Unknown');
      expect(vscode.extensions.getExtension).not.toHaveBeenCalled();
    });

    it('should return Unknown on error', () => {
      vi.mocked(vscode.extensions.getExtension).mockImplementation(() => {
        throw new Error('Test error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(VersionUtils.getExtensionVersion()).toBe('Unknown');
      expect(consoleSpy).toHaveBeenCalledWith('[VersionUtils] Error getting extension version:', expect.any(Error));
    });

    it('should cache Unknown on error (fix for error spam)', () => {
      vi.mocked(vscode.extensions.getExtension).mockImplementation(() => {
        throw new Error('Test error');
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // First call
      expect(VersionUtils.getExtensionVersion()).toBe('Unknown');
      
      // Second call - should return cached 'Unknown' without calling getExtension again
      vi.mocked(vscode.extensions.getExtension).mockClear();
      expect(VersionUtils.getExtensionVersion()).toBe('Unknown');
      expect(vscode.extensions.getExtension).not.toHaveBeenCalled();
    });
  });

  describe('getFormattedVersion', () => {
    it('should format version with v prefix', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(mockExtension as any);
      expect(VersionUtils.getFormattedVersion()).toBe('v1.2.3');
    });

    it('should return Unknown without prefix if version unknown', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(VersionUtils.getFormattedVersion()).toBe('Unknown');
    });
  });

  describe('getExtensionDisplayInfo', () => {
    it('should return display name and version', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(mockExtension as any);
      expect(VersionUtils.getExtensionDisplayInfo()).toBe('Test Extension v1.2.3');
    });

    it('should fallback to default name if display name missing', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: '1.2.3' }
      } as any);
      expect(VersionUtils.getExtensionDisplayInfo()).toBe('Secondary Terminal v1.2.3');
    });

    it('should return fallback when extension is not found', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(VersionUtils.getExtensionDisplayInfo()).toBe('Secondary Terminal Unknown');
    });

    it('should return error fallback when getExtension throws', () => {
      // Mock getExtension to throw for getExtensionDisplayInfo call
      vi.mocked(vscode.extensions.getExtension).mockImplementation(() => {
        throw new Error('Extension error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(VersionUtils.getExtensionDisplayInfo()).toBe('Secondary Terminal Unknown');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[VersionUtils] Error getting extension display info:',
        expect.any(Error)
      );
    });
  });

  describe('clearCache', () => {
    it('should clear the cached version', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(mockExtension as any);

      VersionUtils.getExtensionVersion();
      expect(vscode.extensions.getExtension).toHaveBeenCalledTimes(1);

      VersionUtils.clearCache();

      VersionUtils.getExtensionVersion();
      expect(vscode.extensions.getExtension).toHaveBeenCalledTimes(2);
    });
  });
});