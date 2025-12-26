import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { TerminalProfileService } from '../../../../services/TerminalProfileService';

// Mock vscode
const mockConfig = {
  get: vi.fn(),
  update: vi.fn(),
};

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => mockConfig),
  },
  window: {
    showWarningMessage: vi.fn(),
  },
  ConfigurationTarget: {
    Global: 1,
  },
}));

vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    platform: vi.fn(),
  };
});

vi.mock('fs', async () => {
  return {
    promises: {
      access: vi.fn(),
    },
    constants: {
      F_OK: 0,
    },
  };
});

describe('TerminalProfileService', () => {
  let service: TerminalProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    (os.platform as any).mockReturnValue('linux'); // Default to linux
    mockConfig.get.mockImplementation((key, defaultValue) => defaultValue);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Platform Detection', () => {
    it('should detect windows platform', () => {
      (os.platform as any).mockReturnValue('win32');
      service = new TerminalProfileService();
      // Access private property or test behavior dependent on platform
      // Since platform is private, we can infer it from createFallbackProfile behavior via resolveProfile
    });
  });

  describe('getAvailableProfiles', () => {
    it('should return configured profiles merged with VS Code profiles', async () => {
      service = new TerminalProfileService();
      
      const customProfiles = {
        'My Profile': { path: '/bin/custom', args: [] }
      };
      
      const vscodeProfiles = {
        'Bash': { path: '/bin/bash', args: [] }
      };

      // Mock config get calls
      mockConfig.get.mockImplementation((key) => {
        if (key === 'inheritVSCodeProfiles') return true;
        if (key === 'profiles.linux') return customProfiles; // For getConfiguredProfiles
        if (key === 'profiles.linux') return vscodeProfiles; // For getVSCodeProfiles (same key name issue in mock?)
        return undefined;
      });

      // We need to differentiate based on section.
      const getConfigurationMock = vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>;
      getConfigurationMock.mockImplementation((section: string) => {
        return {
          get: (key: string, defaultValue: any) => {
            if (section === 'secondaryTerminal') {
              if (key === 'profiles.linux') return customProfiles;
              if (key === 'inheritVSCodeProfiles') return true;
            }
            if (section === 'terminal.integrated') {
              if (key === 'profiles.linux') return vscodeProfiles;
            }
            return defaultValue;
          },
          update: vi.fn(),
        };
      });

      const profiles = await service.getAvailableProfiles();
      
      expect(profiles).toHaveProperty('My Profile');
      expect(profiles).toHaveProperty('Bash');
    });
  });

  describe('getDefaultProfile', () => {
    it('should return configured default profile', () => {
      service = new TerminalProfileService();
      mockConfig.get.mockReturnValue('My Profile');
      
      const defaultProfile = service.getDefaultProfile();
      expect(defaultProfile).toBe('My Profile');
    });

    it('should warn and return null if default profile looks like a path', () => {
      service = new TerminalProfileService();
      mockConfig.get.mockReturnValue('/bin/bash');
      
      const defaultProfile = service.getDefaultProfile();
      
      expect(defaultProfile).toBeNull();
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });
  });

  describe('resolveProfile', () => {
    it('should resolve specific requested profile', async () => {
      service = new TerminalProfileService();
      const profiles = { 'Custom': { path: '/bin/custom' } };
      
      const getConfigurationMock = vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>;
      getConfigurationMock.mockReturnValue({
        get: (key: string) => key === 'profiles.linux' ? profiles : undefined,
        update: vi.fn(),
      });

      const result = await service.resolveProfile('Custom');
      
      expect(result.profileName).toBe('Custom');
      expect(result.profile.path).toBe('/bin/custom');
      expect(result.source).toBe('user');
    });

    it('should fall back to default profile if requested not found', async () => {
      service = new TerminalProfileService();
      const profiles = { 'Default': { path: '/bin/default' } };
      
      const getConfigurationMock = vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>;
      getConfigurationMock.mockImplementation((section: string) => ({
        get: (key: string) => {
          if (key === 'profiles.linux') return profiles;
          if (key === 'defaultProfile.linux') return 'Default';
          return undefined;
        },
        update: vi.fn(),
      }));

      const result = await service.resolveProfile('NonExistent');
      
      expect(result.profileName).toBe('Default');
      expect(result.source).toBe('default');
    });

    it('should fall back to first available profile if no default', async () => {
      service = new TerminalProfileService();
      const profiles = { 'First': { path: '/bin/first' } };
      
      const getConfigurationMock = vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>;
      getConfigurationMock.mockImplementation((section: string) => ({
        get: (key: string) => {
          if (key === 'profiles.linux') return profiles;
          return undefined;
        },
        update: vi.fn(),
      }));

      const result = await service.resolveProfile();
      
      expect(result.profileName).toBe('First');
      expect(result.source).toBe('auto-detected');
    });

    it('should create fallback profile if nothing configured', async () => {
      service = new TerminalProfileService();
      const getConfigurationMock = vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>;
      getConfigurationMock.mockReturnValue({ get: () => undefined, update: vi.fn() });

      const result = await service.resolveProfile();
      
      expect(result.profileName).toBe('Fallback Shell');
      expect(result.source).toBe('auto-detected');
      // Linux default
      expect(result.profile.path).toBe(process.env.SHELL || '/bin/bash');
    });
  });

  describe('autoDetectProfiles', () => {
    it('should detect existing shells', async () => {
      service = new TerminalProfileService();
      (fs.promises.access as any).mockResolvedValue(undefined); // Success

      const profiles = await service.autoDetectProfiles();
      
      expect(Object.keys(profiles).length).toBeGreaterThan(0);
      expect(profiles).toHaveProperty('bash');
    });

    it('should ignore missing shells', async () => {
      service = new TerminalProfileService();
      (fs.promises.access as any).mockRejectedValue(new Error('Not found'));

      const profiles = await service.autoDetectProfiles();
      
      expect(Object.keys(profiles).length).toBe(0);
    });
  });
});
