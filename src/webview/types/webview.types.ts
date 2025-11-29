import type { CliAgentStatusType } from './terminal.types';

export type { CliAgentStatusType };

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

export type ThemeColors = Record<string, string>;
