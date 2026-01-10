/**
 * Terminal Command Handlers Service
 *
 * Handles terminal-specific WebView message commands.
 * Extracted from SecondaryTerminalProvider for better separation of concerns.
 */

import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import { TerminalManager } from '../../terminals/TerminalManager';
import { safeProcessCwd } from '../../utils/common';
import { TerminalErrorHandler } from '../../utils/feedback';
import { provider as log } from '../../utils/logger';
import {
  hasTerminalId,
  hasResizeParams,
  hasInputData,
  hasDirection,
} from '../../types/type-guards';
import { SplitDirection } from './PanelLocationService';
import { WebViewCommunicationService } from './WebViewCommunicationService';
import { TerminalLinkResolver } from './TerminalLinkResolver';
import { getUnifiedConfigurationService } from '../../config/UnifiedConfigurationService';
import { ITerminalProfile } from '../../types/profiles';

/**
 * Dependencies required by TerminalCommandHandlers
 */
export interface TerminalCommandHandlersDeps {
  terminalManager: TerminalManager;
  communicationService: WebViewCommunicationService;
  linkResolver: TerminalLinkResolver;
  getSplitDirection: () => SplitDirection;
}

/**
 * TerminalCommandHandlers
 *
 * Consolidates all terminal-related message handlers:
 * - Focus terminal
 * - Split terminal
 * - Create terminal
 * - Kill/Delete terminal
 * - Terminal input
 * - Terminal resize
 * - Terminal reorder
 * - Terminal link handling
 * - Clipboard operations
 * - AI Agent switching
 */
export class TerminalCommandHandlers {
  constructor(private readonly deps: TerminalCommandHandlersDeps) {}

  /**
   * Handle focus terminal command
   */
  public async handleFocusTerminal(message: WebviewMessage): Promise<void> {
    log('🎯 [HANDLER] ========== FOCUS TERMINAL COMMAND RECEIVED ==========');
    if (!hasTerminalId(message)) {
      log('❌ [HANDLER] No terminal ID provided for focusTerminal');
      return;
    }

    try {
      const currentActive = this.deps.terminalManager.getActiveTerminalId();
      log(`🔍 [HANDLER] Current active terminal: ${currentActive}`);
      log(`🔍 [HANDLER] Requested active terminal: ${message.terminalId}`);
      this.deps.terminalManager.setActiveTerminal(message.terminalId);
      const newActive = this.deps.terminalManager.getActiveTerminalId();
      log(`🔍 [HANDLER] Verified active terminal after update: ${newActive}`);

      if (newActive === message.terminalId) {
        log(`✅ [HANDLER] Active terminal successfully updated to: ${message.terminalId}`);
      } else {
        log(
          `❌ [HANDLER] Active terminal update failed. Expected: ${message.terminalId}, Got: ${newActive}`
        );
      }
    } catch (error) {
      log(`❌ [HANDLER] Error setting active terminal:`, error);
    }
  }

  /**
   * Handle split terminal command
   */
  public handleSplitTerminal(message: WebviewMessage): void {
    log('🔀 [HANDLER] Splitting terminal from webview...');
    const direction = hasDirection(message) ? message.direction : undefined;
    try {
      this.performSplit(direction);
    } catch (error) {
      log('❌ [HANDLER] Failed to split terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * Perform terminal split operation
   */
  public performSplit(direction?: SplitDirection): void {
    const effectiveDirection = direction || this.deps.getSplitDirection();
    log(`🔀 [HANDLER] Splitting terminal in direction: ${effectiveDirection}`);

    const newTerminalId = this.deps.terminalManager.createTerminal();
    this.deps.terminalManager.setActiveTerminal(newTerminalId);

    void this.deps.communicationService.sendMessage({
      command: 'split',
      terminalId: newTerminalId,
      direction: effectiveDirection,
    });

    void this.deps.communicationService.sendMessage({
      command: 'stateUpdate',
      state: this.deps.terminalManager.getCurrentState(),
    });

    log(`✅ [HANDLER] Terminal split complete: ${newTerminalId}`);
  }

  /**
   * Handle create terminal command
   */
  public async handleCreateTerminal(_message: WebviewMessage): Promise<void> {
    log('🎨 [HANDLER] Creating new terminal from WebView request');
    try {
      const terminalId = this.deps.terminalManager.createTerminal();
      log(`✅ [HANDLER] Terminal created: ${terminalId}`);

      this.deps.terminalManager.setActiveTerminal(terminalId);
      await this.deps.communicationService.sendMessage({
        command: 'stateUpdate',
        state: this.deps.terminalManager.getCurrentState(),
      });
    } catch (error) {
      log('❌ [HANDLER] Failed to create terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * Handle request initial terminal command
   */
  public async handleRequestInitialTerminal(_message: WebviewMessage): Promise<void> {
    log('🎯 [HANDLER] Initial terminal requested by WebView');
    try {
      const currentTerminals = this.deps.terminalManager.getTerminals();
      if (currentTerminals.length === 0) {
        const terminalId = this.deps.terminalManager.createTerminal();
        this.deps.terminalManager.setActiveTerminal(terminalId);
        log(`✅ [HANDLER] Initial terminal created: ${terminalId}`);
      } else {
        log(`📊 [HANDLER] Terminals already exist (${currentTerminals.length}), skipping creation`);
      }

      await this.deps.communicationService.sendMessage({
        command: 'stateUpdate',
        state: this.deps.terminalManager.getCurrentState(),
      });
    } catch (error) {
      log('❌ [HANDLER] Failed to handle initial terminal request:', error);
    }
  }

  /**
   * Handle terminal input
   */
  public handleTerminalInput(message: WebviewMessage): void {
    if (!hasTerminalId(message) || !hasInputData(message)) {
      log('⚠️ [HANDLER] Invalid terminal input message');
      return;
    }

    this.deps.terminalManager.sendInput(message.data, message.terminalId);
  }

  /**
   * Handle terminal resize
   */
  public handleTerminalResize(message: WebviewMessage): void {
    if (!hasTerminalId(message) || !hasResizeParams(message)) {
      log('⚠️ [HANDLER] Invalid terminal resize message');
      return;
    }

    this.deps.terminalManager.resize(message.cols, message.rows, message.terminalId);
  }

  /**
   * Handle terminal closed event
   */
  public async handleTerminalClosed(message: WebviewMessage): Promise<void> {
    if (!hasTerminalId(message)) {
      log('⚠️ [HANDLER] Terminal closed message missing terminalId');
      return;
    }

    try {
      log(`🗑️ [HANDLER] Terminal closed by WebView: ${message.terminalId}`);
      this.deps.terminalManager.removeTerminal(message.terminalId);
    } catch (error) {
      log('❌ [HANDLER] Failed to handle terminal closed:', error);
    }
  }

  /**
   * Handle kill terminal command
   */
  public async handleKillTerminal(message: WebviewMessage): Promise<void> {
    if (!hasTerminalId(message)) {
      log('⚠️ [HANDLER] Kill terminal message missing terminalId');
      return;
    }

    try {
      log(`🗑️ [HANDLER] Killing terminal: ${message.terminalId}`);
      await this.performKillTerminal(message.terminalId);
    } catch (error) {
      log('❌ [HANDLER] Failed to kill terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * Handle delete terminal command
   */
  public async handleDeleteTerminal(message: WebviewMessage): Promise<void> {
    if (!hasTerminalId(message)) {
      log('⚠️ [HANDLER] Delete terminal message missing terminalId');
      return;
    }

    try {
      log(`🗑️ [HANDLER] Deleting terminal: ${message.terminalId}`);
      await this.performKillTerminal(message.terminalId);
    } catch (error) {
      log('❌ [HANDLER] Failed to delete terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * Perform kill terminal operation
   */
  public async performKillTerminal(terminalId: string): Promise<void> {
    log(`🗑️ [HANDLER] Killing terminal: ${terminalId}`);

    // 🔧 FIX: await killTerminal to ensure deletion completes before sending messages
    try {
      await this.deps.terminalManager.killTerminal(terminalId);
    } catch (error) {
      // killTerminal throws if it fails (e.g., last terminal protection)
      log(`⚠️ [HANDLER] killTerminal failed:`, error);
      // Send failure response to WebView
      await this.deps.communicationService.sendMessage({
        command: 'deleteTerminalResponse',
        terminalId: terminalId,
        success: false,
        reason: error instanceof Error ? error.message : 'Terminal deletion failed',
      });
      return;
    }

    await this.deps.communicationService.sendMessage({
      command: 'terminalRemoved',
      terminalId: terminalId,
    });

    await this.deps.communicationService.sendMessage({
      command: 'stateUpdate',
      state: this.deps.terminalManager.getCurrentState(),
    });

    log(`✅ [HANDLER] Terminal killed: ${terminalId}`);
  }

  /**
   * Handle reorder terminals command
   */
  public async handleReorderTerminals(message: WebviewMessage): Promise<void> {
    const order = Array.isArray(message.order)
      ? message.order.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];

    if (order.length === 0) {
      log('🔁 [HANDLER] Reorder request missing valid order array');
      return;
    }

    try {
      log('🔁 [HANDLER] Applying terminal reorder:', order);
      this.deps.terminalManager.reorderTerminals(order);
    } catch (error) {
      log('❌ [HANDLER] Failed to reorder terminals:', error);
    }
  }

  /**
   * Handle open terminal link command
   */
  public async handleOpenTerminalLink(message: WebviewMessage): Promise<void> {
    log(
      `🔗 [HANDLER] openTerminalLink received: type=${message.linkType} url=${message.url ?? ''} file=${message.filePath ?? ''} terminal=${message.terminalId ?? ''}`
    );
    await this.deps.linkResolver.handleOpenTerminalLink(message);
  }

  /**
   * Handle get terminal profiles command
   */
  public async handleGetTerminalProfiles(): Promise<void> {
    try {
      const configService = getUnifiedConfigurationService();
      const profilesConfig = configService.getTerminalProfilesConfig();

      const platform: 'windows' | 'linux' | 'osx' =
        process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';

      const platformProfiles = profilesConfig.profiles[platform] || {};
      const defaultProfileId = profilesConfig.defaultProfiles[platform];

      const profiles: ITerminalProfile[] = Object.entries(platformProfiles).map(([id, profile]) => {
        const normalized = profile as any;
        return {
          id,
          name: normalized?.name ?? id,
          description: normalized?.description,
          icon: normalized?.icon,
          path: normalized?.path ?? '',
          args: normalized?.args,
          env: normalized?.env,
          cwd: normalized?.cwd,
          color: normalized?.color,
          isDefault: defaultProfileId ? defaultProfileId === id : Boolean(normalized?.isDefault),
          hidden: normalized?.hidden,
          source: normalized?.source,
        } as ITerminalProfile;
      });

      await this.deps.communicationService.sendMessage({
        command: 'profilesUpdated' as const,
        profiles,
        defaultProfileId: defaultProfileId ?? profiles.find((p) => p.isDefault)?.id ?? null,
      } as unknown as WebviewMessage);
    } catch (error) {
      log('❌ [HANDLER] Failed to fetch terminal profiles:', error);
      await this.deps.communicationService.sendMessage({
        command: 'profilesUpdated' as const,
        profiles: [],
        defaultProfileId: null,
        error: (error as Error).message ?? String(error),
      } as unknown as WebviewMessage);
    }
  }

  /**
   * Handle clipboard request (paste)
   */
  public async handleClipboardRequest(message: WebviewMessage): Promise<void> {
    if (!hasTerminalId(message)) {
      log('⚠️ [HANDLER] Clipboard request missing terminalId');
      return;
    }

    try {
      log('📋 [HANDLER] Reading clipboard content...');
      const clipboardText = await vscode.env.clipboard.readText();

      if (!clipboardText) {
        log('⚠️ [HANDLER] Clipboard is empty');
        return;
      }

      log(`📋 [HANDLER] Clipboard content length: ${clipboardText.length} characters`);

      // Normalize line endings to carriage return (VS Code standard terminal behavior)
      let processedText = clipboardText.replace(/\r?\n/g, '\r');

      // Wrap with bracketed paste mode escape sequences (VS Code standard terminal behavior)
      processedText = `\x1b[200~${processedText}\x1b[201~`;

      // Send to terminal using sendInput
      // Note: VS Code standard terminal does NOT escape special characters on paste.
      // Text is written directly to PTY, matching VS Code's behavior.
      log(`📋 [HANDLER] Pasting to terminal ${message.terminalId}`);
      this.deps.terminalManager.sendInput(processedText, message.terminalId);

      log('✅ [HANDLER] Clipboard content pasted successfully');
    } catch (error) {
      log('❌ [HANDLER] Failed to handle clipboard request:', error);
      await vscode.window.showErrorMessage('Failed to paste clipboard content into terminal');
    }
  }

  /**
   * Handle copy to clipboard command
   */
  public async handleCopyToClipboard(message: WebviewMessage): Promise<void> {
    const text = (message as any)?.text;
    if (typeof text !== 'string' || text.length === 0) {
      log('⚠️ [HANDLER] copyToClipboard called without text');
      return;
    }

    try {
      await vscode.env.clipboard.writeText(text);
      log(
        `📋 [HANDLER] Copied ${text.length} chars from terminal ${message.terminalId ?? 'unknown'}`
      );
    } catch (error) {
      log('❌ [HANDLER] Failed to copy text to clipboard:', error);
    }
  }

  /**
   * Handle image paste for Claude Code
   * Saves the image to a temp file and sends the file path to the terminal
   */
  public async handlePasteImage(message: WebviewMessage): Promise<void> {
    if (!hasTerminalId(message)) {
      log('⚠️ [HANDLER] pasteImage missing terminalId');
      return;
    }

    const imageData = (message as any)?.imageData as string;
    const imageType = (message as any)?.imageType as string;

    if (!imageData || !imageType) {
      log('⚠️ [HANDLER] pasteImage missing imageData or imageType');
      return;
    }

    try {
      log(`🖼️ [HANDLER] Processing image paste for terminal ${message.terminalId}`);

      // Extract base64 data (remove data:image/xxx;base64, prefix)
      const base64Match = imageData.match(/^data:image\/[a-z]+;base64,(.+)$/i);
      if (!base64Match || !base64Match[1]) {
        log('⚠️ [HANDLER] Invalid base64 image data format');
        return;
      }
      const base64Content = base64Match[1];

      // Determine file extension from MIME type (sanitized for security)
      const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
      const rawExtension = imageType.replace('image/', '').toLowerCase();
      const extension = validExtensions.includes(rawExtension) ? rawExtension : 'png';

      // Create temp file path
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      const filename = `claude-paste-${timestamp}.${extension}`;
      const tempFilePath = path.join(tempDir, filename);

      // Write image to temp file (async to avoid blocking event loop)
      const imageBuffer = Buffer.from(base64Content, 'base64');
      await fs.promises.writeFile(tempFilePath, imageBuffer);

      // Schedule cleanup after 5 minutes (Claude Code should have read it by then)
      setTimeout(() => {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            log(`🧹 [HANDLER] Cleaned up temp image: ${tempFilePath}`);
          }
        } catch {
          // Ignore cleanup errors
        }
      }, 5 * 60 * 1000);

      log(`🖼️ [HANDLER] Saved image to temp file: ${tempFilePath}`);

      // Send the file path to the terminal PTY
      // Claude Code expects the file path as input
      this.deps.terminalManager.sendInput(tempFilePath, message.terminalId);

      log(`🖼️ [HANDLER] Sent image path to terminal ${message.terminalId}`);
    } catch (error) {
      log('❌ [HANDLER] Failed to handle image paste:', error);
    }
  }

  /**
   * Handle AI Agent connection switch
   * Issue #122: AI Agent connection toggle button functionality
   */
  public async handleSwitchAiAgent(message: WebviewMessage): Promise<void> {
    const terminalId = message.terminalId;
    const action = (message as any)?.action || 'activate';

    log(`📎 [HANDLER] switchAiAgent received: terminalId=${terminalId}, action=${action}`);

    if (!terminalId) {
      log('⚠️ [HANDLER] switchAiAgent called without terminalId');
      return;
    }

    try {
      // Call TerminalManager's switchAiAgentConnection method
      const result = this.deps.terminalManager.switchAiAgentConnection(terminalId);

      log(
        `📎 [HANDLER] switchAiAgentConnection result: success=${result.success}, newStatus=${result.newStatus}, agentType=${result.agentType}`
      );

      // Send response back to WebView
      this.deps.communicationService.sendMessage({
        command: 'switchAiAgentResponse',
        terminalId,
        success: result.success,
        newStatus: result.newStatus,
        agentType: result.agentType,
        reason: result.reason,
      } as WebviewMessage);

      if (result.success) {
        log(`✅ [HANDLER] AI Agent switch succeeded: ${terminalId} -> ${result.newStatus}`);
      } else {
        log(`⚠️ [HANDLER] AI Agent switch failed: ${terminalId}, reason: ${result.reason}`);
      }
    } catch (error) {
      log('❌ [HANDLER] Error handling switchAiAgent:', error);

      // Send error response to WebView
      this.deps.communicationService.sendMessage({
        command: 'switchAiAgentResponse',
        terminalId,
        success: false,
        reason: 'Internal error occurred',
      } as WebviewMessage);
    }
  }

  /**
   * Handle text paste from WebView
   * Used when clipboard text is read in WebView and sent to extension for terminal input
   */
  public async handlePasteText(message: WebviewMessage): Promise<void> {
    if (!hasTerminalId(message)) {
      log('⚠️ [HANDLER] pasteText missing terminalId');
      return;
    }

    const text = (message as any)?.text;
    if (typeof text !== 'string' || text.length === 0) {
      log('⚠️ [HANDLER] pasteText called without text');
      return;
    }

    try {
      log(`📋 [HANDLER] Processing text paste for terminal ${message.terminalId}`);
      log(`📋 [HANDLER] Text length: ${text.length} characters`);

      // Normalize line endings to carriage return (VS Code standard terminal behavior)
      // This ensures consistent behavior across platforms
      let processedText = text.replace(/\r?\n/g, '\r');

      // Wrap with bracketed paste mode escape sequences (VS Code standard terminal behavior)
      // This tells the shell that this is pasted content, preventing each line from being
      // executed as a separate command. Most modern shells support this mode.
      // \x1b[200~ = start bracketed paste, \x1b[201~ = end bracketed paste
      processedText = `\x1b[200~${processedText}\x1b[201~`;

      // Send to terminal using sendInput
      // Note: VS Code standard terminal does NOT escape special characters on paste.
      // Text is written directly to PTY, matching VS Code's behavior.
      this.deps.terminalManager.sendInput(processedText, message.terminalId);

      log('✅ [HANDLER] Text pasted successfully');
    } catch (error) {
      log('❌ [HANDLER] Failed to paste text:', error);
    }
  }

  /**
   * Initialize terminal state and send to WebView
   */
  public async initializeTerminals(): Promise<void> {
    log('🔧 [HANDLER] Initializing terminals...');

    // Include font settings in terminalCreated message
    const configService = getUnifiedConfigurationService();
    const fontSettings = configService.getWebViewFontSettings();

    const terminals = this.deps.terminalManager.getTerminals();
    for (const terminal of terminals) {
      const displayModeOverride =
        'consumeCreationDisplayModeOverride' in this.deps.terminalManager &&
        typeof (this.deps.terminalManager as any).consumeCreationDisplayModeOverride === 'function'
          ? (this.deps.terminalManager as any).consumeCreationDisplayModeOverride(terminal.id)
          : null;
      await this.deps.communicationService.sendMessage({
        command: 'terminalCreated',
        terminal: {
          id: terminal.id,
          name: terminal.name,
          cwd: terminal.cwd || safeProcessCwd(),
          isActive: terminal.id === this.deps.terminalManager.getActiveTerminalId(),
        },
        // 🔧 Include font settings directly in the message
        config: {
          fontSettings,
          ...(displayModeOverride ? { displayModeOverride } : {}),
        },
      });
    }

    await this.deps.communicationService.sendMessage({
      command: 'stateUpdate',
      state: this.deps.terminalManager.getCurrentState(),
    });

    log('✅ [HANDLER] Terminal initialization complete');
  }
}
