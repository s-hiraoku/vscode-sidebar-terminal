/**
 * Terminal Profile Manager
 * Manages terminal profiles similar to VS Code's profile system
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import {
  ITerminalProfile,
  ITerminalProfileManager,
  ITerminalProfileOptions,
  // IPlatformShells,
  OSType,
  TerminalProfileEventType,
  ITerminalProfileEvent
} from '../types/profiles';
import { provider as log } from '../utils/logger';

export class TerminalProfileManager extends EventEmitter implements ITerminalProfileManager {
  private _profiles = new Map<string, ITerminalProfile>();
  private _defaultProfileId?: string;
  private _platform: OSType;
  private _initialized = false;

  constructor() {
    super();
    this._platform = this._detectPlatform();
    log(`🎯 [PROFILES] Profile Manager initialized for platform: ${this._platform}`);
  }

  /**
   * Initialize the profile manager with built-in and user profiles
   */
  public async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    try {
      // Add built-in profiles for current platform
      this._addBuiltInProfiles();

      // Load user profiles from VS Code settings
      await this._loadUserProfiles();

      // Set default profile if not already set
      if (!this._defaultProfileId) {
        const builtInProfiles = Array.from(this._profiles.values())
          .filter(p => p.source === 'builtin');
        if (builtInProfiles.length > 0) {
          this._defaultProfileId = builtInProfiles[0]?.id;
        }
      }

      this._initialized = true;
      this.emit('initialized');
      log(`🎯 [PROFILES] Profile Manager initialized with ${this._profiles.size} profiles`);

    } catch (error) {
      log(`❌ [PROFILES] Failed to initialize Profile Manager: ${error}`);
      throw error;
    }
  }

  /**
   * Get all available profiles
   */
  public getProfiles(): ITerminalProfile[] {
    return Array.from(this._profiles.values())
      .filter(profile => !profile.hidden)
      .sort((a, b) => {
        // Default profile first, then alphabetical
        if (a.id === this._defaultProfileId) return -1;
        if (b.id === this._defaultProfileId) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Get profile by ID
   */
  public getProfile(id: string): ITerminalProfile | undefined {
    return this._profiles.get(id);
  }

  /**
   * Get default profile for current platform
   */
  public getDefaultProfile(): ITerminalProfile {
    if (this._defaultProfileId) {
      const defaultProfile = this._profiles.get(this._defaultProfileId);
      if (defaultProfile) {
        return defaultProfile;
      }
    }

    // Fallback to first available profile
    const profiles = this.getProfiles();
    if (profiles.length > 0) {
      return profiles[0]!;
    }

    // Emergency fallback - create a basic profile
    return this._createEmergencyProfile();
  }

  /**
   * Create a new profile
   */
  public createProfile(profile: Omit<ITerminalProfile, 'id'>): ITerminalProfile {
    const id = this._generateProfileId(profile.name);
    const newProfile: ITerminalProfile = {
      ...profile,
      id,
      source: profile.source || 'user'
    };

    // Validate the profile
    const errors = this.validateProfile(newProfile);
    if (errors.length > 0) {
      throw new Error(`Invalid profile: ${errors.join(', ')}`);
    }

    this._profiles.set(id, newProfile);

    // Save to user settings if it's a user profile
    if (newProfile.source === 'user') {
      this._saveUserProfiles();
    }

    this._emitEvent({
      type: TerminalProfileEventType.ProfileAdded,
      profile: newProfile
    });

    log(`🎯 [PROFILES] Created new profile: ${newProfile.name} (${id})`);
    return newProfile;
  }

  /**
   * Update existing profile
   */
  public updateProfile(id: string, updates: Partial<ITerminalProfile>): void {
    const existingProfile = this._profiles.get(id);
    if (!existingProfile) {
      throw new Error(`Profile not found: ${id}`);
    }

    const previousProfile = { ...existingProfile };
    const updatedProfile = { ...existingProfile, ...updates, id }; // Ensure ID doesn't change

    // Validate the updated profile
    const errors = this.validateProfile(updatedProfile);
    if (errors.length > 0) {
      throw new Error(`Invalid profile update: ${errors.join(', ')}`);
    }

    this._profiles.set(id, updatedProfile);

    // Save to user settings if it's a user profile
    if (updatedProfile.source === 'user') {
      this._saveUserProfiles();
    }

    this._emitEvent({
      type: TerminalProfileEventType.ProfileUpdated,
      profile: updatedProfile,
      previousProfile
    });

    log(`🎯 [PROFILES] Updated profile: ${updatedProfile.name} (${id})`);
  }

  /**
   * Delete profile
   */
  public deleteProfile(id: string): void {
    const profile = this._profiles.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    if (profile.source === 'builtin') {
      throw new Error('Cannot delete built-in profiles');
    }

    this._profiles.delete(id);

    // If this was the default profile, set a new default
    if (this._defaultProfileId === id) {
      const remainingProfiles = this.getProfiles();
      this._defaultProfileId = remainingProfiles.length > 0 ? remainingProfiles[0]?.id : undefined;
    }

    // Save to user settings
    this._saveUserProfiles();

    this._emitEvent({
      type: TerminalProfileEventType.ProfileRemoved,
      profileId: id,
      profile
    });

    log(`🎯 [PROFILES] Deleted profile: ${profile.name} (${id})`);
  }

  /**
   * Set default profile
   */
  public setDefaultProfile(id: string): void {
    const profile = this._profiles.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    const previousDefaultId = this._defaultProfileId;
    this._defaultProfileId = id;

    // Save to user settings
    this._saveUserSettings();

    this._emitEvent({
      type: TerminalProfileEventType.DefaultProfileChanged,
      profile,
      profileId: previousDefaultId
    });

    log(`🎯 [PROFILES] Set default profile: ${profile.name} (${id})`);
  }

  /**
   * Get platform-specific profiles
   */
  public getPlatformProfiles(): any {
    // This would return the platform-specific profiles
    // Implementation depends on platform detection logic
    return {};
  }

  /**
   * Refresh profiles from system
   */
  public async refreshProfiles(): Promise<void> {
    // Re-detect available shells and update built-in profiles
    this._addBuiltInProfiles();
    await this._loadUserProfiles();

    this._emitEvent({
      type: TerminalProfileEventType.ProfilesRefreshed
    });

    log('🎯 [PROFILES] Profiles refreshed from system');
  }

  /**
   * Validate profile configuration
   */
  public validateProfile(profile: ITerminalProfile): string[] {
    const errors: string[] = [];

    if (!profile.id) {
      errors.push('Profile ID is required');
    }

    if (!profile.name?.trim()) {
      errors.push('Profile name is required');
    }

    if (!profile.path?.trim()) {
      errors.push('Shell path is required');
    }

    // Validate shell path exists (if it's an absolute path)
    if (profile.path && path.isAbsolute(profile.path)) {
      try {
        if (!fs.existsSync(profile.path)) {
          errors.push(`Shell path does not exist: ${profile.path}`);
        }
      } catch (e) {
        // Ignore file system errors during validation
      }
    }

    // Validate environment variables
    if (profile.env) {
      for (const [key, value] of Object.entries(profile.env)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          errors.push(`Invalid environment variable: ${key} = ${value}`);
        }
      }
    }

    return errors;
  }

  /**
   * Create terminal with specific profile
   */
  public createTerminalWithProfile(
    profileId: string, 
    options?: ITerminalProfileOptions
  ): { profile: ITerminalProfile; config: any } {
    const profile = this.getProfile(profileId) || this.getDefaultProfile();
    
    // Apply platform-specific overrides
    const platformProfile = this._applyPlatformOverrides(profile);

    // Apply options overrides
    const finalProfile = {
      ...platformProfile,
      ...(options?.name && { name: options.name }),
      ...(options?.cwd && { cwd: options.cwd }),
      ...(options?.env && { env: { ...platformProfile.env, ...options.env } })
    };

    // Create terminal configuration
    const terminalConfig = {
      name: finalProfile.name,
      shell: finalProfile.path,
      args: [...(finalProfile.args || []), ...(options?.shellArgs || [])],
      env: finalProfile.env,
      cwd: finalProfile.cwd,
      color: finalProfile.color,
      icon: finalProfile.icon
    };

    log(`🎯 [PROFILES] Creating terminal with profile: ${finalProfile.name}`);
    return { profile: finalProfile, config: terminalConfig };
  }

  // Private methods

  private _detectPlatform(): OSType {
    const platform = os.platform();
    switch (platform) {
      case 'win32': return 'windows';
      case 'darwin': return 'macos';
      default: return 'linux';
    }
  }

  private _addBuiltInProfiles(): void {
    const profiles = this._getBuiltInProfilesForPlatform();
    
    for (const profile of profiles) {
      this._profiles.set(profile.id, profile);
    }

    log(`🎯 [PROFILES] Added ${profiles.length} built-in profiles for ${this._platform}`);
  }

  private _getBuiltInProfilesForPlatform(): ITerminalProfile[] {
    switch (this._platform) {
      case 'windows':
        return [
          {
            id: 'builtin-cmd',
            name: 'Command Prompt',
            description: 'Windows Command Prompt',
            path: 'C:\\Windows\\System32\\cmd.exe',
            icon: 'terminal-cmd',
            source: 'builtin',
            isDefault: true
          },
          {
            id: 'builtin-powershell',
            name: 'PowerShell',
            description: 'Windows PowerShell',
            path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
            icon: 'terminal-powershell',
            source: 'builtin'
          }
        ];

      case 'macos':
        return [
          {
            id: 'builtin-zsh',
            name: 'zsh',
            description: 'Z shell',
            path: '/bin/zsh',
            icon: 'terminal',
            source: 'builtin',
            isDefault: true
          },
          {
            id: 'builtin-bash',
            name: 'bash',
            description: 'Bash shell',
            path: '/bin/bash',
            icon: 'terminal-bash',
            source: 'builtin'
          }
        ];

      case 'linux':
        return [
          {
            id: 'builtin-bash',
            name: 'bash',
            description: 'Bash shell',
            path: '/bin/bash',
            icon: 'terminal-bash',
            source: 'builtin',
            isDefault: true
          },
          {
            id: 'builtin-sh',
            name: 'sh',
            description: 'Bourne shell',
            path: '/bin/sh',
            icon: 'terminal',
            source: 'builtin'
          }
        ];

      default:
        return [];
    }
  }

  private async _loadUserProfiles(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('sidebarTerminal');
      const userProfiles = config.get<ITerminalProfile[]>('profiles', []);
      const defaultProfileId = config.get<string>('defaultProfile');

      for (const profile of userProfiles) {
        if (profile.source === 'user') {
          this._profiles.set(profile.id, profile);
        }
      }

      if (defaultProfileId) {
        this._defaultProfileId = defaultProfileId;
      }

      log(`🎯 [PROFILES] Loaded ${userProfiles.length} user profiles from settings`);

    } catch (error) {
      log(`⚠️ [PROFILES] Error loading user profiles: ${error}`);
    }
  }

  private _saveUserProfiles(): void {
    try {
      const userProfiles = Array.from(this._profiles.values())
        .filter(profile => profile.source === 'user');

      const config = vscode.workspace.getConfiguration('sidebarTerminal');
      config.update('profiles', userProfiles, vscode.ConfigurationTarget.Global);

      log(`🎯 [PROFILES] Saved ${userProfiles.length} user profiles to settings`);

    } catch (error) {
      log(`❌ [PROFILES] Error saving user profiles: ${error}`);
    }
  }

  private _saveUserSettings(): void {
    try {
      const config = vscode.workspace.getConfiguration('sidebarTerminal');
      if (this._defaultProfileId) {
        config.update('defaultProfile', this._defaultProfileId, vscode.ConfigurationTarget.Global);
      }

      log('🎯 [PROFILES] Saved user settings');

    } catch (error) {
      log(`❌ [PROFILES] Error saving user settings: ${error}`);
    }
  }

  private _generateProfileId(name: string): string {
    const baseName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let counter = 1;
    let id = `user-${baseName}`;

    while (this._profiles.has(id)) {
      id = `user-${baseName}-${counter}`;
      counter++;
    }

    return id;
  }

  private _applyPlatformOverrides(profile: ITerminalProfile): ITerminalProfile {
    if (!profile.overrides) {
      return profile;
    }

    const platformKey = this._platform === 'macos' ? 'osx' : this._platform;
    const overrideKey = platformKey as keyof typeof profile.overrides;
    const override = profile.overrides[overrideKey];

    if (!override) {
      return profile;
    }

    return {
      ...profile,
      ...override
    };
  }

  private _createEmergencyProfile(): ITerminalProfile {
    const emergency: ITerminalProfile = {
      id: 'emergency-shell',
      name: 'System Shell',
      description: 'Emergency fallback shell',
      path: process.env.SHELL || '/bin/sh',
      source: 'builtin',
      icon: 'terminal'
    };

    log('⚠️ [PROFILES] Created emergency profile');
    return emergency;
  }

  private _emitEvent(event: ITerminalProfileEvent): void {
    this.emit('profileEvent', event);
    log(`🎯 [PROFILES] Event: ${event.type}`);
  }

  public dispose(): void {
    this._profiles.clear();
    this.removeAllListeners();
    log('🎯 [PROFILES] Profile Manager disposed');
  }
}