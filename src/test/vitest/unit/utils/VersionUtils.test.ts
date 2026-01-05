import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VersionUtils } from '../../../../utils/VersionUtils';

// Mock vscode module
vi.mock('vscode', () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));

import * as vscode from 'vscode';

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
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: '1.2.3' },
      } as vscode.Extension<unknown>);

      const version = VersionUtils.getExtensionVersion();

      expect(version).toBe('1.2.3');
    });

    it('should cache the version on subsequent calls', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: '1.2.3' },
      } as vscode.Extension<unknown>);

      VersionUtils.getExtensionVersion();
      VersionUtils.getExtensionVersion();
      VersionUtils.getExtensionVersion();

      expect(vscode.extensions.getExtension).toHaveBeenCalledTimes(1);
    });

    it('should return cached version', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: '1.2.3' },
      } as vscode.Extension<unknown>);

      const version1 = VersionUtils.getExtensionVersion();

      // Change the mock return value
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: '4.5.6' },
      } as vscode.Extension<unknown>);

      const version2 = VersionUtils.getExtensionVersion();

      // Should still return cached version
      expect(version1).toBe('1.2.3');
      expect(version2).toBe('1.2.3');
    });

    it('should return Unknown when extension is not found', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const version = VersionUtils.getExtensionVersion();

      expect(version).toBe('Unknown');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[VersionUtils] Extension not found, returning fallback version'
      );

      consoleSpy.mockRestore();
    });

    it('should return Unknown when packageJSON is undefined', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: undefined,
      } as unknown as vscode.Extension<unknown>);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const version = VersionUtils.getExtensionVersion();

      expect(version).toBe('Unknown');
    });

    it('should return Unknown when version is undefined', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: {},
      } as vscode.Extension<unknown>);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const version = VersionUtils.getExtensionVersion();

      expect(version).toBe('Unknown');
    });

    it('should return Unknown when getExtension throws an error', () => {
      vi.mocked(vscode.extensions.getExtension).mockImplementation(() => {
        throw new Error('Extension error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const version = VersionUtils.getExtensionVersion();

      expect(version).toBe('Unknown');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[VersionUtils] Error getting extension version:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getFormattedVersion', () => {
    it('should return version with v prefix', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: '1.2.3' },
      } as vscode.Extension<unknown>);

      const formattedVersion = VersionUtils.getFormattedVersion();

      expect(formattedVersion).toBe('v1.2.3');
    });

    it('should return Unknown without v prefix when version is unknown', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const formattedVersion = VersionUtils.getFormattedVersion();

      expect(formattedVersion).toBe('Unknown');
    });
  });

  describe('getExtensionDisplayInfo', () => {
    it('should return display name and version', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: {
          displayName: 'My Extension',
          version: '1.2.3',
        },
      } as vscode.Extension<unknown>);

      const displayInfo = VersionUtils.getExtensionDisplayInfo();

      expect(displayInfo).toBe('My Extension v1.2.3');
    });

    it('should use Secondary Terminal as default display name', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: {
          version: '1.2.3',
        },
      } as vscode.Extension<unknown>);

      const displayInfo = VersionUtils.getExtensionDisplayInfo();

      expect(displayInfo).toBe('Secondary Terminal v1.2.3');
    });

    it('should return fallback when extension is not found', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const displayInfo = VersionUtils.getExtensionDisplayInfo();

      expect(displayInfo).toBe('Secondary Terminal Unknown');
    });

    it('should return error fallback when getExtension throws', () => {
      vi.mocked(vscode.extensions.getExtension).mockImplementation(() => {
        throw new Error('Extension error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const displayInfo = VersionUtils.getExtensionDisplayInfo();

      expect(displayInfo).toBe('Secondary Terminal Unknown');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[VersionUtils] Error getting extension display info:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('should clear the cached version', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: '1.2.3' },
      } as vscode.Extension<unknown>);

      VersionUtils.getExtensionVersion();
      expect(vscode.extensions.getExtension).toHaveBeenCalledTimes(1);

      VersionUtils.clearCache();

      VersionUtils.getExtensionVersion();
      expect(vscode.extensions.getExtension).toHaveBeenCalledTimes(2);
    });
  });
});
