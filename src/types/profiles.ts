/**
 * Terminal Profile Types
 * VS Code compatible terminal profile system
 */

// import * as vscode from 'vscode';

/**
 * Operating system type for profile compatibility
 */
export type OSType = 'windows' | 'macos' | 'linux';

/**
 * Terminal profile configuration
 */
export interface ITerminalProfile {
  /** Unique profile identifier */
  id: string;
  
  /** Display name for the profile */
  name: string;
  
  /** Profile description */
  description?: string;
  
  /** Profile icon (VS Code icon name) */
  icon?: string;
  
  /** Shell executable path */
  path: string;
  
  /** Shell arguments */
  args?: string[];
  
  /** Environment variables for this profile */
  env?: Record<string, string>;
  
  /** Working directory override */
  cwd?: string;
  
  /** Color theme override for this profile */
  color?: string;
  
  /** Operating systems this profile is compatible with */
  overrides?: {
    windows?: Partial<ITerminalProfile>;
    osx?: Partial<ITerminalProfile>;
    linux?: Partial<ITerminalProfile>;
  };
  
  /** Whether this is the default profile */
  isDefault?: boolean;
  
  /** Whether this profile is hidden from UI */
  hidden?: boolean;
  
  /** Profile source (built-in, user, extension) */
  source?: 'builtin' | 'user' | 'extension';
}

/**
 * Terminal profile for creation
 */
export interface ITerminalProfileOptions {
  /** Profile to use for terminal creation */
  profile?: ITerminalProfile;
  
  /** Override profile name */
  name?: string;
  
  /** Override working directory */
  cwd?: string;
  
  /** Override environment variables */
  env?: Record<string, string>;
  
  /** Additional shell arguments */
  shellArgs?: string[];
}

/**
 * Platform-specific shell configurations
 */
export interface IPlatformShells {
  windows: {
    cmd: ITerminalProfile;
    powershell: ITerminalProfile;
    pwsh?: ITerminalProfile;
    gitBash?: ITerminalProfile;
    wsl?: ITerminalProfile[];
  };
  osx: {
    bash: ITerminalProfile;
    zsh: ITerminalProfile;
    fish?: ITerminalProfile;
  };
  linux: {
    bash: ITerminalProfile;
    zsh: ITerminalProfile;
    fish?: ITerminalProfile;
    sh: ITerminalProfile;
  };
}

/**
 * Profile manager interface
 */
export interface ITerminalProfileManager {
  /** Get all available profiles */
  getProfiles(): ITerminalProfile[];
  
  /** Get profile by ID */
  getProfile(id: string): ITerminalProfile | undefined;
  
  /** Get default profile for current platform */
  getDefaultProfile(): ITerminalProfile;
  
  /** Create a new profile */
  createProfile(profile: Omit<ITerminalProfile, 'id'>): ITerminalProfile;
  
  /** Update existing profile */
  updateProfile(id: string, updates: Partial<ITerminalProfile>): void;
  
  /** Delete profile */
  deleteProfile(id: string): void;
  
  /** Set default profile */
  setDefaultProfile(id: string): void;
  
  /** Get platform-specific profiles */
  getPlatformProfiles(): any;
  
  /** Refresh profiles from system */
  refreshProfiles(): Promise<void>;
  
  /** Validate profile configuration */
  validateProfile(profile: ITerminalProfile): string[];
}

/**
 * Profile selection UI state
 */
export interface IProfileSelectionState {
  /** Currently selected profile */
  selectedProfileId?: string;
  
  /** Available profiles for selection */
  availableProfiles: ITerminalProfile[];
  
  /** Whether profile selector is visible */
  isVisible: boolean;
  
  /** Filter text for profile search */
  filterText?: string;
}

/**
 * Profile event types
 */
export enum TerminalProfileEventType {
  ProfileAdded = 'profileAdded',
  ProfileRemoved = 'profileRemoved',
  ProfileUpdated = 'profileUpdated',
  DefaultProfileChanged = 'defaultProfileChanged',
  ProfilesRefreshed = 'profilesRefreshed'
}

/**
 * Profile event data
 */
export interface ITerminalProfileEvent {
  type: TerminalProfileEventType;
  profile?: ITerminalProfile;
  profileId?: string;
  previousProfile?: ITerminalProfile;
}