import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VersionUtils } from '../../../../utils/VersionUtils';
import * as vscode from 'vscode';

// Mock VS Code
const mockExtension = {
  packageJSON: {
    version: '1.2.3',
    displayName: 'Test Extension',
  },
};

vi.mock('vscode', () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));

describe('VersionUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    VersionUtils.clearCache();
  });

  describe('getExtensionVersion', () => {
    it('should return version from extension manifest', () => {
      (vscode.extensions.getExtension as any).mockReturnValue(mockExtension);
      expect(VersionUtils.getExtensionVersion()).toBe('1.2.3');
    });

    it('should return cached version on second call', () => {
      (vscode.extensions.getExtension as any).mockReturnValue(mockExtension);
      VersionUtils.getExtensionVersion();
      
      // Clear mock to ensure we hit cache
      (vscode.extensions.getExtension as any).mockReturnValue(undefined);
      expect(VersionUtils.getExtensionVersion()).toBe('1.2.3');
    });

    it('should return Unknown if extension not found', () => {
      (vscode.extensions.getExtension as any).mockReturnValue(undefined);
      expect(VersionUtils.getExtensionVersion()).toBe('Unknown');
    });

    it('should return Unknown on error', () => {
      (vscode.extensions.getExtension as any).mockImplementation(() => {
        throw new Error('Test error');
      });
      expect(VersionUtils.getExtensionVersion()).toBe('Unknown');
    });
  });

  describe('getFormattedVersion', () => {
    it('should format version with v prefix', () => {
      (vscode.extensions.getExtension as any).mockReturnValue(mockExtension);
      expect(VersionUtils.getFormattedVersion()).toBe('v1.2.3');
    });

    it('should return Unknown without prefix if version unknown', () => {
      (vscode.extensions.getExtension as any).mockReturnValue(undefined);
      expect(VersionUtils.getFormattedVersion()).toBe('Unknown');
    });
  });

  describe('getExtensionDisplayInfo', () => {
    it('should return display name and version', () => {
      (vscode.extensions.getExtension as any).mockReturnValue(mockExtension);
      expect(VersionUtils.getExtensionDisplayInfo()).toBe('Test Extension v1.2.3');
    });

    it('should fallback to default name if display name missing', () => {
      (vscode.extensions.getExtension as any).mockReturnValue({
        packageJSON: { version: '1.2.3' }
      });
      expect(VersionUtils.getExtensionDisplayInfo()).toBe('Secondary Terminal v1.2.3');
    });

    it('should handle errors gracefully', () => {
      (vscode.extensions.getExtension as any).mockImplementation(() => {
        throw new Error('Test error');
      });
      expect(VersionUtils.getExtensionDisplayInfo()).toBe('Secondary Terminal Unknown');
    });
  });
});
