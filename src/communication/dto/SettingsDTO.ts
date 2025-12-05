/**
 * Communication Layer - Settings Data Transfer Objects
 *
 * Defines DTOs for settings-related data transfer between Extension and WebView layers.
 *
 * @see Issue #223 - Phase 1: Communication Layer Definition
 */

import type { ActiveBorderMode } from '../../types/shared';

/**
 * Terminal settings DTO
 * Transferred from Extension to WebView
 */
export interface TerminalSettingsDTO {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontWeightBold?: string;
  lineHeight?: number;
  letterSpacing?: number;
  theme?: 'auto' | 'dark' | 'light';
  cursorBlink?: boolean;
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorWidth?: number;
  scrollback?: number;
  altClickMovesCursor?: boolean;
  activeBorderMode?: ActiveBorderMode;
  sendKeybindingsToShell?: boolean;
  allowChords?: boolean;
  allowMnemonics?: boolean;
  dynamicSplitDirection?: boolean;
  panelLocation?: 'auto' | 'sidebar' | 'panel';
}

/**
 * Settings update request DTO
 * Sent from WebView to Extension
 */
export interface UpdateSettingsRequestDTO {
  settings: Partial<TerminalSettingsDTO>;
  source: 'webview' | 'extension';
}

/**
 * Settings response DTO
 * Sent from Extension to WebView
 */
export interface SettingsResponseDTO {
  settings: TerminalSettingsDTO;
  timestamp: number;
  success: boolean;
  error?: string;
}

/**
 * Font settings DTO
 * Specific to font configuration
 */
export interface FontSettingsDTO {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontWeightBold?: string;
  lineHeight?: number;
  letterSpacing?: number;
}
