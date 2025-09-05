/**
 * Terminal Profile System Types
 * Provides profile-based terminal configuration similar to VS Code's integrated terminal
 */


/**
 * Terminal profile configuration
 * Each profile represents a specific shell configuration with its own settings
 */
export interface TerminalProfile {
  /** Unique identifier for the profile */
  readonly id: string;
  
  /** Display name for the profile */
  readonly name: string;
  
  /** Optional icon for the profile (codicon name) */
  readonly icon?: string;
  
  /** Color for the profile (hex or theme color) */
  readonly color?: string;
  
  /** Shell executable path */
  readonly path: string;
  
  /** Arguments to pass to the shell */
  readonly args?: string[] | string;
  
  /** Environment variables for this profile */
  readonly env?: Record<string, string>;
  
  /** Working directory for terminals created with this profile */
  readonly cwd?: string;
  
  /** Whether to use this profile as default */
  readonly isDefault?: boolean;
  
  /** Whether this is an auto-detected profile */
  readonly isAutoDetected?: boolean;
  
  /** Platform-specific overrides */
  readonly overrides?: {
    windows?: Partial<TerminalProfile>;
    linux?: Partial<TerminalProfile>;
    darwin?: Partial<TerminalProfile>;
  };
}

/**
 * Profile source - where the profile comes from
 */
export enum ProfileSource {
  /** User-defined profile */
  User = 'user',
  /** Auto-detected by the system */
  AutoDetect = 'autoDetect',
  /** Contributed by an extension */
  Extension = 'extension',
  /** Built-in default profile */
  Default = 'default'
}

/**
 * Extended profile with metadata
 */
export interface TerminalProfileMetadata extends TerminalProfile {
  /** Source of the profile */
  readonly source: ProfileSource;
  
  /** Whether the profile is currently available */
  readonly isAvailable: boolean;
  
  /** Validation errors if any */
  readonly validationErrors?: string[];
  
  /** Last used timestamp */
  lastUsed?: number;
  
  /** Usage count */
  usageCount?: number;
}

/**
 * Profile selection result
 */
export interface ProfileSelectionResult {
  /** Selected profile */
  profile: TerminalProfile;
  
  /** Whether to set as default */
  setAsDefault?: boolean;
  
  /** Whether to save to settings */
  saveToSettings?: boolean;
}

/**
 * Profile manager configuration
 */
export interface ProfileManagerConfig {
  /** Available profiles */
  profiles: Record<string, TerminalProfile>;
  
  /** Default profile ID */
  defaultProfile?: string;
  
  /** Platform-specific default profiles */
  defaultProfiles?: {
    windows?: string;
    linux?: string;
    darwin?: string;
  };
  
  /** Whether to auto-detect available shells */
  autoDetectProfiles?: boolean;
  
  /** Whether to show profile selector on new terminal */
  showProfileSelector?: boolean;
}

/**
 * Common shell profiles for different platforms
 */
export interface CommonShellProfiles {
  /** PowerShell profiles */
  powershell?: TerminalProfile;
  pwsh?: TerminalProfile;
  
  /** Command Prompt */
  cmd?: TerminalProfile;
  
  /** Git Bash */
  gitbash?: TerminalProfile;
  
  /** Bash */
  bash?: TerminalProfile;
  
  /** Zsh */
  zsh?: TerminalProfile;
  
  /** Fish */
  fish?: TerminalProfile;
  
  /** WSL */
  wsl?: TerminalProfile;
}

/**
 * Profile validation result
 */
export interface ProfileValidation {
  /** Whether the profile is valid */
  isValid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Validation warnings */
  warnings: string[];
  
  /** Suggested fixes */
  suggestions?: string[];
}

/**
 * Profile quick pick item for VS Code quick pick
 */
export interface ProfileQuickPickItem {
  /** Display label */
  label: string;
  
  /** Description text */
  description?: string;
  
  /** Detail text */
  detail?: string;
  
  /** Icon ID */
  iconId?: string;
  
  /** Associated profile */
  profile: TerminalProfile;
  
  /** Quick pick buttons */
  buttons?: Array<{
    iconPath: string;
    tooltip: string;
  }>;
}

/**
 * Profile detection result
 */
export interface ProfileDetectionResult {
  /** Detected profiles */
  profiles: TerminalProfile[];
  
  /** Detection errors */
  errors?: string[];
  
  /** Platform-specific notes */
  notes?: string[];
}

/**
 * Profile import/export format
 */
export interface ProfileExportData {
  /** Format version */
  version: string;
  
  /** Export timestamp */
  timestamp: number;
  
  /** Profiles to export */
  profiles: TerminalProfile[];
  
  /** Default profile ID */
  defaultProfile?: string;
  
  /** Platform information */
  platform?: string;
}