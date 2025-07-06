import type { StatusType } from './terminal.types';

export interface ExtensionConfig {
  fontSize: number;
  fontFamily: string;
  theme: string;
  cursorBlink: boolean;
  maxTerminals: number;
  minTerminalHeight: number;
  autoHideStatus: boolean;
  statusDisplayDuration: number;
  showWebViewHeader: boolean;
  webViewTitle: string;
  showSampleIcons: boolean;
  sampleIconOpacity: number;
  headerFontSize: number;
  headerIconSize: number;
  sampleIconSize: number;
}

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