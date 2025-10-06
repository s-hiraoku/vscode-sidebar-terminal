/**
 * Terminal Profile Types
 * VS Code compatible terminal profile system
 */

// import * as vscode from 'vscode';

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
