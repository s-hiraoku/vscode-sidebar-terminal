import type { StatusType } from './terminal.types';
import { CompleteExtensionConfig } from '../../types/shared';

export type { StatusType };

/**
 * WebView拡張設定
 * @deprecated shared.ts の CompleteExtensionConfig を使用してください
 */
export type ExtensionConfig = CompleteExtensionConfig;

export interface StatusOptions {
  type: StatusType;
  duration?: number;
  persistent?: boolean;
}

export interface LayoutDimensions {
  containerHeight: number;
  headerHeight: number;
  statusHeight: number;
  availableHeight: number;
}

export interface HeaderConfig {
  showHeader: boolean;
  title: string;
  showIcons: boolean;
  iconSize: number;
  fontSize: number;
}

export interface SampleIcon {
  icon: string;
  title: string;
  disabled?: boolean;
}

export interface TooltipConfig {
  text: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export type ThemeColors = Record<string, string>;

export interface WebviewState {
  isInitialized: boolean;
  activeTerminalId: string | null;
  isSplitMode: boolean;
  terminalCount: number;
}
