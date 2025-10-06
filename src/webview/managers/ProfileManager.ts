/**
 * Profile Manager
 * Manages terminal profiles in the webview with VS Code-style profile selection
 * - Profile discovery and caching
 * - Profile selector UI coordination
 * - Profile-based terminal creation
 * - Default profile management
 */

import { IManagerCoordinator, IProfileManager } from '../interfaces/ManagerInterfaces';
import { ITerminalProfile } from '../../types/profiles';
import { ProfileSelector } from '../components/ProfileSelector';
import { webview as log } from '../../utils/logger';

export class ProfileManager implements IProfileManager {
  private coordinator: IManagerCoordinator | null = null;
  private profileSelector: ProfileSelector | null = null;
  private profileSelectorContainer: HTMLElement | null = null;
  private availableProfiles: Map<string, ITerminalProfile> = new Map();
  private defaultProfileId: string | null = null;
  private selectedProfileId: string | undefined;
  private lastRefreshTime = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  constructor() {
    this.setupProfileSelectorContainer();
  }

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
  }

  /**
   * Initialize profile manager
   */
  public async initialize(): Promise<void> {
    if (!this.coordinator) {
      console.error('ProfileManager: Coordinator not set');
      return;
    }

    this.setupProfileSelectorContainer();
    await this.refreshProfiles();
    log('🎯 Profile Manager initialized with', this.availableProfiles.size, 'profiles');
  }

  private setupProfileSelectorContainer(): void {
    // Create container for profile selector dialog
    let container = document.getElementById('profile-selector-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'profile-selector-container';
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    this.profileSelectorContainer = container;
    this.profileSelector = new ProfileSelector(container);
  }

  /**
   * Show profile selector dialog
   */
  public showProfileSelector(onProfileSelected?: (profileId: string) => void): void {
    if (!this.profileSelector || !this.coordinator) {
      console.warn('ProfileManager: Profile selector not available');
      return;
    }

    const profiles = Array.from(this.availableProfiles.values());
    if (profiles.length === 0) {
      this.coordinator.getManagers().notification.showWarning('No terminal profiles available');
      return;
    }

    this.profileSelector.show(
      profiles,
      this.defaultProfileId || undefined,
      (profileId: string) => {
        this.selectedProfileId = profileId;
        if (onProfileSelected) {
          onProfileSelected(profileId);
        } else {
          // Default action: create terminal with selected profile
          this.createTerminalWithProfile(profileId);
        }
      },
      () => {
        this.selectedProfileId = undefined;
      }
    );

    log('🎯 Profile selector shown with', profiles.length, 'profiles');
  }

  /**
   * Hide profile selector dialog
   */
  public hideProfileSelector(): void {
    if (this.profileSelector) {
      this.profileSelector.hide();
    }
    this.selectedProfileId = undefined;
  }

  /**
   * Get available profiles (with caching)
   */
  public async getAvailableProfiles(): Promise<ITerminalProfile[]> {
    const now = Date.now();
    if (now - this.lastRefreshTime > this.CACHE_DURATION) {
      await this.refreshProfiles();
    }

    return Array.from(this.availableProfiles.values());
  }

  /**
   * Get profile by ID
   */
  public getProfile(profileId: string): ITerminalProfile | undefined {
    return this.availableProfiles.get(profileId);
  }

  /**
   * Get default profile
   */
  public getDefaultProfile(): ITerminalProfile | undefined {
    if (this.defaultProfileId) {
      return this.availableProfiles.get(this.defaultProfileId);
    }

    // Fallback to first available profile
    const profiles = Array.from(this.availableProfiles.values());
    return profiles.find((p) => p.isDefault) || profiles[0];
  }

  /**
   * Set default profile
   */
  public async setDefaultProfile(profileId: string): Promise<void> {
    if (!this.coordinator) {
      throw new Error('ProfileManager: Coordinator not available');
    }

    const profile = this.availableProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Update local state
    this.availableProfiles.forEach((p) => {
      p.isDefault = p.id === profileId;
    });
    this.defaultProfileId = profileId;

    // Notify extension
    this.coordinator.postMessageToExtension({
      command: 'setDefaultProfile',
      profileId: profileId,
    });

    log('🎯 Default profile set to:', profileId);
  }

  /**
   * Refresh profiles from extension
   */
  public async refreshProfiles(): Promise<void> {
    if (!this.coordinator) {
      console.warn('ProfileManager: Cannot refresh profiles - coordinator not available');
      return;
    }

    try {
      // Request profiles from extension
      this.coordinator.postMessageToExtension({
        command: 'getTerminalProfiles',
      });

      log('🎯 Requested profile refresh from extension');
    } catch (error) {
      console.error('ProfileManager: Failed to refresh profiles:', error);
    }
  }

  /**
   * Handle profiles received from extension
   */
  public updateProfiles(profiles: ITerminalProfile[], defaultProfileId?: string): void {
    this.availableProfiles.clear();

    profiles.forEach((profile) => {
      this.availableProfiles.set(profile.id, profile);
    });

    if (defaultProfileId) {
      this.defaultProfileId = defaultProfileId;
    } else {
      // Find default profile
      const defaultProfile = profiles.find((p) => p.isDefault);
      this.defaultProfileId = defaultProfile?.id || profiles[0]?.id || null;
    }

    this.lastRefreshTime = Date.now();

    // Update profile selector if visible
    if (this.profileSelector && this.profileSelector.isVisible) {
      this.profileSelector.updateProfiles(profiles);
    }

    log(
      '🎯 Updated profiles:',
      profiles.length,
      'profiles, default:',
      this.defaultProfileId
    );
  }

  /**
   * Create terminal with specific profile
   */
  public async createTerminalWithProfile(profileId: string, name?: string): Promise<void> {
    if (!this.coordinator) {
      throw new Error('ProfileManager: Coordinator not available');
    }

    const profile = this.availableProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Generate terminal name if not provided
    const terminalName = name || `${profile.name} Terminal`;
    const terminalId = this.generateTerminalId();

    try {
      // Create terminal with profile via coordinator
      await this.coordinator.createTerminal(terminalId, terminalName, {
        profileId: profileId,
        shell: profile.path,
        args: profile.args,
        env: profile.env,
        cwd: profile.cwd,
      });

      log('🎯 Created terminal with profile:', profileId, '→', terminalId);
    } catch (error) {
      console.error('ProfileManager: Failed to create terminal with profile:', error);

      if (this.coordinator.getManagers().notification) {
        this.coordinator
          .getManagers()
          .notification.showWarning(`Failed to create terminal with profile "${profile.name}"`);
      }

      throw error;
    }
  }

  /**
   * Check if profile selector is visible
   */
  public isProfileSelectorVisible(): boolean {
    return this.profileSelector?.isVisible ?? false;
  }

  /**
   * Get currently selected profile ID
   */
  public getSelectedProfileId(): string | undefined {
    return this.selectedProfileId;
  }

  /**
   * Quick profile switching via keyboard shortcuts
   */
  public async switchToProfileByIndex(index: number): Promise<void> {
    const profiles = Array.from(this.availableProfiles.values());
    const profile = profiles[index];

    if (profile) {
      await this.createTerminalWithProfile(profile.id);
    }
  }

  /**
   * Create terminal with default profile
   */
  public async createTerminalWithDefaultProfile(name?: string): Promise<void> {
    const defaultProfile = this.getDefaultProfile();
    if (!defaultProfile) {
      throw new Error('No default profile available');
    }

    await this.createTerminalWithProfile(defaultProfile.id, name);
  }

  /**
   * Handle profile-related messages from extension
   */
  public handleMessage(message: any): void {
    switch (message.command) {
      case 'profilesUpdated':
        this.updateProfiles(message.profiles, message.defaultProfileId);
        break;

      case 'defaultProfileChanged':
        if (message.profileId) {
          this.defaultProfileId = message.profileId;
          // Update default flag on profiles
          this.availableProfiles.forEach((p) => {
            p.isDefault = p.id === message.profileId;
          });
        }
        break;

      default:
        console.warn('ProfileManager: Unknown message command:', message.command);
    }
  }

  private generateTerminalId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `terminal-${timestamp}-${random}`;
  }

  /**
   * Get profile statistics
   */
  public getStats(): {
    totalProfiles: number;
    defaultProfile: string | null;
    lastRefresh: number;
    selectorVisible: boolean;
  } {
    return {
      totalProfiles: this.availableProfiles.size,
      defaultProfile: this.defaultProfileId,
      lastRefresh: this.lastRefreshTime,
      selectorVisible: this.isProfileSelectorVisible(),
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.profileSelector) {
      this.profileSelector.dispose();
      this.profileSelector = null;
    }

    if (this.profileSelectorContainer && this.profileSelectorContainer.parentNode) {
      this.profileSelectorContainer.parentNode.removeChild(this.profileSelectorContainer);
    }

    this.availableProfiles.clear();
    this.coordinator = null;
    this.selectedProfileId = undefined;
    this.defaultProfileId = null;

    log('🎯 Profile Manager disposed');
  }
}
