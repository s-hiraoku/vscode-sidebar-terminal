import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { TerminalManager } from '../../terminals/TerminalManager';

/**
 * Session Manager interface for message handlers
 */
export interface ISessionManager {
  getSessionInfo(): { hasValidSession: boolean; sessionData?: any };
  restoreSession(force: boolean): Promise<{ success: boolean; message?: string; terminals?: any[] }>;
  saveSession(terminals: any[]): Promise<void>;
}

/**
 * Profile Manager interface for terminal profiles
 */
export interface IProfileManager {
  getProfiles(): any[];
  getDefaultProfile(): any;
  createProfile(profile: any): any;
  createTerminalWithProfile(profileId: string, options?: any): any;
  updateProfile(profileId: string, profile: any): void;
  deleteProfile(profileId: string): void;
  setDefaultProfile(profileId: string): void;
}

/**
 * Context interface for message handlers
 */
export interface IMessageHandlerContext {
  extensionContext: vscode.ExtensionContext;
  terminalManager: TerminalManager;
  webview: vscode.Webview | undefined;
  standardSessionManager?: ISessionManager;
  profileManager?: IProfileManager;
  sendMessage: (message: WebviewMessage) => Promise<void>;
  terminalIdMapping?: Map<string, string>;
}

/**
 * Base interface for all message handlers
 */
export interface IMessageHandler {
  canHandle(message: WebviewMessage): boolean;
  handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;
}

/**
 * WebView state manager interface
 */
export interface IWebViewStateManager {
  isInitialized(): boolean;
  setInitialized(value: boolean): void;
  getCurrentSettings(): PartialTerminalSettings;
  getCurrentFontSettings(): WebViewFontSettings;
  getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string };
  getPanelLocation(): 'sidebar' | 'panel';
  requestPanelLocationDetection(context: IMessageHandlerContext): void;
}

/**
 * CLI Agent service interface
 */
export interface ICliAgentWebViewService {
  sendStatusUpdate(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null,
    context: IMessageHandlerContext
  ): void;
  sendFullStateSync(context: IMessageHandlerContext): void;
  setupListeners(context: IMessageHandlerContext): vscode.Disposable[];
}

/**
 * Settings manager interface
 */
export interface IWebViewSettingsManager {
  getCurrentSettings(): PartialTerminalSettings;
  getCurrentFontSettings(): WebViewFontSettings;
  getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string };
  updateSettings(settings: PartialTerminalSettings): Promise<void>;
  setupConfigurationChangeListeners(context: IMessageHandlerContext): vscode.Disposable;
}

/**
 * HTML generator interface
 */
export interface IWebViewHtmlGenerator {
  generateMainHtml(webview: vscode.Webview): string;
  generateFallbackHtml(): string;
  generateErrorHtml(error: unknown): string;
}

/**
 * Terminal event handler interface
 */
export interface ITerminalEventHandler {
  setupEventListeners(context: IMessageHandlerContext): vscode.Disposable[];
  clearEventListeners(): void;
}
