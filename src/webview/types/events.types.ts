import type { TerminalConfig } from './terminal.types';
import type { PartialTerminalSettings } from '../../types/shared';

export type { TerminalConfig };

export interface WebviewMessageBase {
  readonly command: string;
  readonly timestamp?: number;
}

export interface TerminalCreatedMessage extends WebviewMessageBase {
  readonly command: 'terminalCreated';
  readonly terminalId: string;
  readonly terminalName: string;
  readonly config: TerminalConfig;
}

export interface TerminalOutputMessage extends WebviewMessageBase {
  readonly command: 'output';
  readonly terminalId: string;
  readonly data: string;
}

export interface TerminalInputMessage extends WebviewMessageBase {
  readonly command: 'input';
  readonly terminalId?: string;
  readonly data: string;
}

export interface TerminalResizeMessage extends WebviewMessageBase {
  readonly command: 'resize';
  readonly terminalId?: string;
  readonly cols: number;
  readonly rows: number;
}

export interface SplitCommandMessage extends WebviewMessageBase {
  readonly command: 'split';
  readonly terminalId?: string;
}

export interface SettingsMessage extends WebviewMessageBase {
  readonly command: 'getSettings' | 'updateSettings' | 'settingsResponse';
  readonly settings?: PartialTerminalSettings;
}

export interface OpenSettingsMessage extends WebviewMessageBase {
  readonly command: 'openSettings';
}

export interface ClearCommandMessage extends WebviewMessageBase {
  readonly command: 'clear';
  readonly terminalId?: string;
}

export interface ReadyMessage extends WebviewMessageBase {
  readonly command: 'ready';
}

export interface InitMessage extends WebviewMessageBase {
  readonly command: 'init';
  readonly config?: TerminalConfig;
  readonly terminals?: TerminalConfig[];
  readonly activeTerminalId?: string;
}

export type WebviewMessage =
  | TerminalCreatedMessage
  | TerminalOutputMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | SplitCommandMessage
  | SettingsMessage
  | OpenSettingsMessage
  | ClearCommandMessage
  | ReadyMessage
  | InitMessage
  | CliAgentStatusUpdateMessage;

export type VsCodeMessage = WebviewMessage;

export interface TerminalDataEvent {
  terminalId: string;
  data: string;
}

export interface CliAgentStatusUpdateMessage extends WebviewMessageBase {
  readonly command: 'cliAgentStatusUpdate';
  readonly cliAgentStatus: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType?: string | null; // 🛠️ FIX: Add agentType field
    terminalId?: string; // 🛠️ FIX: Add terminalId for reliable status updates
  };
}

export interface TerminalExitEvent {
  terminalId: string;
  exitCode: number;
}
