/**
 * Terminal Profile Service - VS Code標準ターミナルプロファイルシステム
 * VS Code のターミナルプロファイル機能に準拠したプロファイル管理システム
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import {
  TerminalProfile,
  TerminalPlatform,
  ProfileSelectionResult,
  TerminalProfilesConfig,
  CONFIG_SECTIONS,
  CONFIG_KEYS,
} from '../types/shared';

export class TerminalProfileService {
  private readonly platform: TerminalPlatform;
  private profileCache: Map<string, TerminalProfile> = new Map();

  constructor() {
    this.platform = this.getCurrentPlatform();
  }

  /**
   * Get current platform for profile selection
   */
  private getCurrentPlatform(): TerminalPlatform {
    const platform = os.platform();
    switch (platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'osx';
      default:
        return 'linux';
    }
  }

  /**
   * Get all available terminal profiles for current platform
   */
  public async getAvailableProfiles(): Promise<Record<string, TerminalProfile>> {
    const profiles = this.getConfiguredProfiles();
    
    // If inherit VS Code profiles is enabled, merge with VS Code's profiles
    const inheritVSCode = vscode.workspace.getConfiguration(CONFIG_SECTIONS.SIDEBAR_TERMINAL)
      .get<boolean>(CONFIG_KEYS.INHERIT_VSCODE_PROFILES, true);
      
    if (inheritVSCode) {
      const vscodeProfiles = await this.getVSCodeProfiles();
      return { ...vscodeProfiles, ...profiles };
    }
    
    return profiles;
  }

  /**
   * Get configured profiles from extension settings
   */
  private getConfiguredProfiles(): Record<string, TerminalProfile> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTIONS.SIDEBAR_TERMINAL);
    
    let profileKey: string;
    switch (this.platform) {
      case 'windows':
        profileKey = CONFIG_KEYS.PROFILES_WINDOWS;
        break;
      case 'linux':
        profileKey = CONFIG_KEYS.PROFILES_LINUX;
        break;
      case 'osx':
        profileKey = CONFIG_KEYS.PROFILES_OSX;
        break;
    }
    
    return config.get<Record<string, TerminalProfile | null>>(profileKey, {});
  }

  /**
   * Get VS Code's built-in terminal profiles
   */
  private async getVSCodeProfiles(): Promise<Record<string, TerminalProfile>> {
    const config = vscode.workspace.getConfiguration('terminal.integrated');
    
    let profileKey: string;
    switch (this.platform) {
      case 'windows':
        profileKey = 'profiles.windows';
        break;
      case 'linux':
        profileKey = 'profiles.linux';
        break;
      case 'osx':
        profileKey = 'profiles.osx';
        break;
    }
    
    const vscodeProfiles = config.get<Record<string, any>>(profileKey, {});
    
    // Convert VS Code profile format to our format
    const convertedProfiles: Record<string, TerminalProfile> = {};
    
    for (const [name, profile] of Object.entries(vscodeProfiles)) {
      if (profile && typeof profile === 'object' && profile.path) {
        convertedProfiles[name] = {
          path: profile.path,
          args: profile.args,
          cwd: profile.cwd,
          env: profile.env,
          icon: profile.icon,
          color: profile.color,
          isVisible: profile.isVisible,
          overrideName: profile.overrideName,
          useColor: profile.useColor,
        };
      }
    }
    
    return convertedProfiles;
  }

  /**
   * Get default profile for current platform
   */
  public getDefaultProfile(): string | null {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTIONS.SIDEBAR_TERMINAL);
    
    let defaultKey: string;
    switch (this.platform) {
      case 'windows':
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS;
        break;
      case 'linux':
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_LINUX;
        break;
      case 'osx':
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_OSX;
        break;
    }
    
    return config.get<string | null>(defaultKey, null);
  }

  /**
   * Resolve which profile to use for a new terminal
   */
  public async resolveProfile(requestedProfile?: string): Promise<ProfileSelectionResult> {
    const availableProfiles = await this.getAvailableProfiles();
    
    // If specific profile requested, try to use it
    if (requestedProfile && availableProfiles[requestedProfile]) {
      return {
        profile: availableProfiles[requestedProfile],
        profileName: requestedProfile,
        platform: this.platform,
        isDefault: false,
        source: 'user',
      };
    }
    
    // Try to use default profile
    const defaultProfileName = this.getDefaultProfile();
    if (defaultProfileName && availableProfiles[defaultProfileName]) {
      return {
        profile: availableProfiles[defaultProfileName],
        profileName: defaultProfileName,
        platform: this.platform,
        isDefault: true,
        source: 'default',
      };
    }
    
    // Fallback to first available profile
    const profileNames = Object.keys(availableProfiles);
    if (profileNames.length > 0) {
      const firstProfileName = profileNames[0];
      return {
        profile: availableProfiles[firstProfileName],
        profileName: firstProfileName,
        platform: this.platform,
        isDefault: false,
        source: 'auto-detected',
      };
    }
    
    // Ultimate fallback - create basic shell profile
    return this.createFallbackProfile();
  }

  /**
   * Create a fallback profile when no profiles are configured
   */
  private createFallbackProfile(): ProfileSelectionResult {
    let shellPath: string;
    let shellArgs: string[] = [];
    
    switch (this.platform) {
      case 'windows':
        shellPath = process.env.COMSPEC || 'cmd.exe';
        break;
      case 'osx':
        shellPath = process.env.SHELL || '/bin/zsh';
        break;
      default:
        shellPath = process.env.SHELL || '/bin/bash';
        break;
    }
    
    return {
      profile: {
        path: shellPath,
        args: shellArgs,
      },
      profileName: 'Fallback Shell',
      platform: this.platform,
      isDefault: false,
      source: 'auto-detected',
    };
  }

  /**
   * Auto-detect available shells on the system
   */
  public async autoDetectProfiles(): Promise<Record<string, TerminalProfile>> {
    const detectedProfiles: Record<string, TerminalProfile> = {};
    
    const shellCandidates = this.getShellCandidates();
    
    for (const candidate of shellCandidates) {
      const shellExists = await this.checkShellExists(candidate.path);
      if (shellExists) {
        detectedProfiles[candidate.name] = {
          path: candidate.path,
          args: candidate.args || [],
          icon: candidate.icon,
          isVisible: true,
        };
      }
    }
    
    return detectedProfiles;
  }

  /**
   * Get shell candidates for auto-detection
   */
  private getShellCandidates(): Array<{
    name: string;
    path: string;
    args?: string[];
    icon?: string;
  }> {
    switch (this.platform) {
      case 'windows':
        return [
          { name: 'Command Prompt', path: 'cmd.exe', icon: 'terminal-cmd' },
          { name: 'PowerShell', path: 'powershell.exe', icon: 'terminal-powershell' },
          { name: 'PowerShell Core', path: 'pwsh.exe', icon: 'terminal-powershell' },
          { name: 'Git Bash', path: 'C:\\Program Files\\Git\\bin\\bash.exe', icon: 'terminal-bash' },
          { name: 'Windows Subsystem for Linux', path: 'wsl.exe', icon: 'terminal-ubuntu' },
        ];
      
      case 'osx':
        return [
          { name: 'zsh', path: '/bin/zsh', icon: 'terminal-bash' },
          { name: 'bash', path: '/bin/bash', icon: 'terminal-bash' },
          { name: 'fish', path: '/usr/local/bin/fish', icon: 'terminal-bash' },
          { name: 'tcsh', path: '/bin/tcsh', icon: 'terminal-bash' },
        ];
      
      default: // linux
        return [
          { name: 'bash', path: '/bin/bash', icon: 'terminal-bash' },
          { name: 'zsh', path: '/bin/zsh', icon: 'terminal-bash' },
          { name: 'fish', path: '/usr/bin/fish', icon: 'terminal-bash' },
          { name: 'dash', path: '/bin/dash', icon: 'terminal-bash' },
          { name: 'sh', path: '/bin/sh', icon: 'terminal-bash' },
        ];
    }
  }

  /**
   * Check if a shell executable exists
   */
  private async checkShellExists(shellPath: string): Promise<boolean> {
    try {
      await fs.promises.access(shellPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get complete profiles configuration
   */
  public async getProfilesConfig(): Promise<TerminalProfilesConfig> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTIONS.SIDEBAR_TERMINAL);
    
    return {
      profiles: {
        windows: config.get(CONFIG_KEYS.PROFILES_WINDOWS, {}),
        linux: config.get(CONFIG_KEYS.PROFILES_LINUX, {}),
        osx: config.get(CONFIG_KEYS.PROFILES_OSX, {}),
      },
      defaultProfiles: {
        windows: config.get(CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS, null),
        linux: config.get(CONFIG_KEYS.DEFAULT_PROFILE_LINUX, null),
        osx: config.get(CONFIG_KEYS.DEFAULT_PROFILE_OSX, null),
      },
      autoDetection: {
        enabled: config.get(CONFIG_KEYS.ENABLE_PROFILE_AUTO_DETECTION, true),
        searchPaths: [],
        useCache: true,
        cacheExpiration: 3600000, // 1 hour
      },
      inheritVSCodeProfiles: config.get(CONFIG_KEYS.INHERIT_VSCODE_PROFILES, true),
    };
  }

  /**
   * Update profile configuration
   */
  public async updateProfileConfig(
    platform: TerminalPlatform,
    profileName: string,
    profile: TerminalProfile | null
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTIONS.SIDEBAR_TERMINAL);
    
    let profileKey: string;
    switch (platform) {
      case 'windows':
        profileKey = CONFIG_KEYS.PROFILES_WINDOWS;
        break;
      case 'linux':
        profileKey = CONFIG_KEYS.PROFILES_LINUX;
        break;
      case 'osx':
        profileKey = CONFIG_KEYS.PROFILES_OSX;
        break;
    }
    
    const currentProfiles = config.get<Record<string, TerminalProfile | null>>(profileKey, {});
    const updatedProfiles = {
      ...currentProfiles,
      [profileName]: profile,
    };
    
    await config.update(profileKey, updatedProfiles, vscode.ConfigurationTarget.Global);
  }

  /**
   * Set default profile for platform
   */
  public async setDefaultProfile(platform: TerminalPlatform, profileName: string | null): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTIONS.SIDEBAR_TERMINAL);
    
    let defaultKey: string;
    switch (platform) {
      case 'windows':
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS;
        break;
      case 'linux':
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_LINUX;
        break;
      case 'osx':
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_OSX;
        break;
    }
    
    await config.update(defaultKey, profileName, vscode.ConfigurationTarget.Global);
  }
}