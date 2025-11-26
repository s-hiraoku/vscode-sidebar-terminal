/**
 * Keybinding Service
 *
 * Handles VS Code keybinding resolution and command execution.
 * Extracted from InputManager for better separation of concerns.
 */

import { IManagerCoordinator } from '../../../interfaces/ManagerInterfaces';

/**
 * VS Code keybinding settings
 */
export interface KeybindingSettings {
  sendKeybindingsToShell?: boolean;
  commandsToSkipShell?: string[];
  allowChords?: boolean;
  allowMnemonics?: boolean;
}

/**
 * Terminal interaction event emitter type
 */
export type TerminalInteractionEmitter = (
  type: string,
  terminalId: string,
  data: unknown,
  manager: IManagerCoordinator
) => void;

/**
 * KeybindingService
 *
 * Responsibilities:
 * - VS Code keybinding resolution
 * - Command skip shell determination
 * - Keybinding map management
 * - Command execution delegation
 */
export class KeybindingService {
  // VS Code keybinding system state
  private sendKeybindingsToShell = false;
  private commandsToSkipShell = new Set<string>();
  private isInChordMode = false;
  private allowChords = true;
  private allowMnemonics = true;

  // VS Code standard terminal commands to skip shell
  private readonly DEFAULT_COMMANDS_TO_SKIP_SHELL = new Set([
    'workbench.action.quickOpen',
    'workbench.action.showCommands',
    'workbench.action.terminal.new',
    'workbench.action.terminal.split',
    'workbench.action.terminal.kill',
    'workbench.action.terminal.clear',
    'workbench.action.terminal.scrollUp',
    'workbench.action.terminal.scrollDown',
    'workbench.action.terminal.scrollToTop',
    'workbench.action.terminal.scrollToBottom',
    'workbench.action.terminal.focusNext',
    'workbench.action.terminal.focusPrevious',
    'workbench.action.terminal.toggleTerminal',
    'workbench.action.closePanel',
    'workbench.action.maximizePanel',
    'workbench.action.toggleDevTools',
    'workbench.action.reloadWindow',
    'workbench.action.zoomIn',
    'workbench.action.zoomOut',
    'workbench.action.zoomReset',
  ]);

  constructor(private readonly logger: (message: string) => void) {
    // Initialize with default commands
    this.commandsToSkipShell = new Set(this.DEFAULT_COMMANDS_TO_SKIP_SHELL);
  }

  /**
   * Update VS Code keybinding system settings
   */
  public updateSettings(settings: KeybindingSettings): void {
    if (settings.sendKeybindingsToShell !== undefined) {
      this.sendKeybindingsToShell = settings.sendKeybindingsToShell;
      this.logger(`sendKeybindingsToShell updated: ${this.sendKeybindingsToShell}`);
    }

    if (settings.commandsToSkipShell) {
      this.commandsToSkipShell.clear();

      // Start with default commands
      this.DEFAULT_COMMANDS_TO_SKIP_SHELL.forEach((cmd) => this.commandsToSkipShell.add(cmd));

      // Process custom commands
      for (const command of settings.commandsToSkipShell) {
        if (command.startsWith('-')) {
          // Remove command (override default)
          const commandToRemove = command.substring(1);
          this.commandsToSkipShell.delete(commandToRemove);
          this.logger(`Removed command from skip list: ${commandToRemove}`);
        } else {
          // Add command to skip
          this.commandsToSkipShell.add(command);
          this.logger(`Added command to skip list: ${command}`);
        }
      }

      this.logger(`commandsToSkipShell updated: ${this.commandsToSkipShell.size} commands`);
    }

    if (settings.allowChords !== undefined) {
      this.allowChords = settings.allowChords;
      this.logger(`allowChords updated: ${this.allowChords}`);
    }

    if (settings.allowMnemonics !== undefined) {
      this.allowMnemonics = settings.allowMnemonics;
      this.logger(`allowMnemonics updated: ${this.allowMnemonics}`);
    }
  }

  /**
   * Set chord mode state
   */
  public setChordMode(isInChordMode: boolean): void {
    this.isInChordMode = isInChordMode;
  }

  /**
   * Check if in chord mode
   */
  public isChordMode(): boolean {
    return this.isInChordMode;
  }

  /**
   * VS Code keybinding resolution - determines if keybinding should be handled by VS Code or shell
   */
  public shouldSkipShell(event: KeyboardEvent, resolvedCommand?: string): boolean {
    // Check for chord mode
    if (this.isInChordMode && this.allowChords && event.key !== 'Escape') {
      this.logger('In chord mode - skipping shell');
      return true;
    }

    // Check specific command skip list
    if (
      resolvedCommand &&
      this.commandsToSkipShell.has(resolvedCommand) &&
      !this.sendKeybindingsToShell
    ) {
      this.logger(`Command ${resolvedCommand} in skip list - skipping shell`);
      return true;
    }

    // Check for mnemonics (Alt key on Windows/Linux)
    if (
      this.allowMnemonics &&
      event.altKey &&
      (navigator.platform.includes('Win') || navigator.platform.includes('Linux'))
    ) {
      this.logger('Alt key mnemonic detected - skipping shell');
      return true;
    }

    // Hardcoded system keybindings
    if (this.isSystemKeybinding(event)) {
      this.logger('System keybinding detected - skipping shell');
      return true;
    }

    return false;
  }

  /**
   * Check if keybinding is a system-level keybinding
   */
  private isSystemKeybinding(event: KeyboardEvent): boolean {
    // Alt+F4 on Windows
    if (navigator.platform.includes('Win') && event.altKey && event.key === 'F4') {
      return true;
    }

    // Cmd+Q on macOS
    if (navigator.platform.includes('Mac') && event.metaKey && event.key === 'q') {
      return true;
    }

    // Ctrl+V without clipboard API support
    if (event.ctrlKey && event.key === 'v' && !navigator.clipboard?.readText) {
      return true;
    }

    return false;
  }

  /**
   * Resolve keyboard event to VS Code command
   */
  public resolveKeybinding(event: KeyboardEvent): string | null {
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey;
    const alt = event.altKey;
    const shift = event.shiftKey;
    const meta = event.metaKey;

    const isMac = navigator.platform.includes('Mac');

    // VS Code standard terminal keybindings
    const keybindingMap = this.buildKeybindingMap(isMac);

    // Create key combination string
    const parts = [];
    if (ctrl && !isMac) parts.push('ctrl');
    if (meta && isMac) parts.push('meta');
    if (alt) parts.push('alt');
    if (shift) parts.push('shift');
    parts.push(key);

    const keyCombo = parts.join('+');
    const resolved = keybindingMap[keyCombo];

    if (resolved) {
      this.logger(`Resolved keybinding: ${keyCombo} → ${resolved}`);
    }

    return resolved || null;
  }

  /**
   * Build keybinding map based on platform
   */
  private buildKeybindingMap(isMac: boolean): Record<string, string> {
    return {
      // Terminal management - cross-platform
      [`${isMac ? 'meta' : 'ctrl'}+shift+\``]: 'workbench.action.terminal.new',
      [`${isMac ? 'meta' : 'ctrl'}+shift+5`]: 'workbench.action.terminal.split',
      [`${isMac ? 'meta' : 'ctrl'}+shift+w`]: 'workbench.action.terminal.kill',
      [`${isMac ? 'meta' : 'ctrl'}+shift+k`]: 'workbench.action.terminal.clear',

      // Navigation - cross-platform
      [`${isMac ? 'meta' : 'ctrl'}+p`]: 'workbench.action.quickOpen',
      [`${isMac ? 'meta' : 'ctrl'}+shift+p`]: 'workbench.action.showCommands',
      [`${isMac ? 'meta' : 'ctrl'}+tab`]: 'workbench.action.terminal.focusNext',
      [`${isMac ? 'meta' : 'ctrl'}+shift+tab`]: 'workbench.action.terminal.focusPrevious',
      [`${isMac ? 'meta' : 'ctrl'}+\``]: 'workbench.action.terminal.toggleTerminal',

      // Scrolling
      'shift+pageup': 'workbench.action.terminal.scrollUp',
      'shift+pagedown': 'workbench.action.terminal.scrollDown',
      'ctrl+alt+pageup': 'workbench.action.terminal.scrollUp',
      'ctrl+alt+pagedown': 'workbench.action.terminal.scrollDown',
      'ctrl+shift+arrowup': 'workbench.action.terminal.scrollUp',
      'ctrl+shift+arrowdown': 'workbench.action.terminal.scrollDown',
      'ctrl+home': 'workbench.action.terminal.scrollToTop',
      'ctrl+end': 'workbench.action.terminal.scrollToBottom',
      'shift+home': 'workbench.action.terminal.scrollToTop',
      'shift+end': 'workbench.action.terminal.scrollToBottom',
      'meta+alt+pageup': 'workbench.action.terminal.scrollUp',
      'meta+alt+pagedown': 'workbench.action.terminal.scrollDown',
      'meta+home': 'workbench.action.terminal.scrollToTop',
      'meta+end': 'workbench.action.terminal.scrollToBottom',
      'meta+arrowup': 'workbench.action.terminal.scrollToPreviousCommand',
      'meta+arrowdown': 'workbench.action.terminal.scrollToNextCommand',
      'ctrl+arrowup': 'workbench.action.terminal.scrollToPreviousCommand',
      'ctrl+arrowdown': 'workbench.action.terminal.scrollToNextCommand',

      // Panel management
      [`${isMac ? 'meta' : 'ctrl'}+j`]: 'workbench.action.togglePanel',
      [`${isMac ? 'meta' : 'ctrl'}+shift+u`]: 'workbench.action.closePanel',
      [`${isMac ? 'meta' : 'ctrl'}+shift+e`]: 'workbench.action.toggleSidebarVisibility',

      // Development tools
      f12: 'workbench.action.toggleDevTools',
      [`${isMac ? 'meta' : 'ctrl'}+r`]: 'workbench.action.reloadWindow',
      [`${isMac ? 'meta' : 'ctrl'}+shift+r`]: 'workbench.action.reloadWindowWithExtensionsDisabled',

      // Zoom
      [`${isMac ? 'meta' : 'ctrl'}+=`]: 'workbench.action.zoomIn',
      [`${isMac ? 'meta' : 'ctrl'}+-`]: 'workbench.action.zoomOut',
      [`${isMac ? 'meta' : 'ctrl'}+0`]: 'workbench.action.zoomReset',

      // Copy/paste
      [`${isMac ? 'meta' : 'ctrl'}+c`]: 'workbench.action.terminal.copySelection',
      [`${isMac ? 'meta' : 'ctrl'}+shift+c`]: 'workbench.action.terminal.copySelection',
      [`${isMac ? 'meta' : 'ctrl'}+v`]: 'workbench.action.terminal.paste',
      [`${isMac ? 'meta' : 'ctrl'}+shift+v`]: 'workbench.action.terminal.paste',
      [`${isMac ? 'meta' : 'ctrl'}+a`]: 'workbench.action.terminal.selectAll',

      // Find
      [`${isMac ? 'meta' : 'ctrl'}+f`]: 'workbench.action.terminal.focusFind',
      [`${isMac ? 'meta' : 'ctrl'}+g`]: 'workbench.action.terminal.findNext',
      [`${isMac ? 'meta' : 'ctrl'}+shift+g`]: 'workbench.action.terminal.findPrevious',

      // Terminal size
      [`${isMac ? 'meta' : 'ctrl'}+shift+=`]: 'workbench.action.terminal.sizeToContentWidth',

      // Additional shortcuts
      [`${isMac ? 'meta' : 'ctrl'}+shift+c`]: 'workbench.action.terminal.openNativeConsole',
      f1: 'workbench.action.showCommands',
      escape: 'workbench.action.terminal.hideFind',

      // Platform specific
      ...(isMac
        ? {
            'meta+k': 'workbench.action.terminal.clear',
            'meta+backspace': 'workbench.action.terminal.deleteWordLeft',
            'meta+delete': 'workbench.action.terminal.deleteWordRight',
            'meta+arrowleft': 'workbench.action.terminal.moveToLineStart',
            'meta+arrowright': 'workbench.action.terminal.moveToLineEnd',
          }
        : {
            'ctrl+l': 'workbench.action.terminal.clear',
            'ctrl+backspace': 'workbench.action.terminal.deleteWordLeft',
            'ctrl+delete': 'workbench.action.terminal.deleteWordRight',
            home: 'workbench.action.terminal.moveToLineStart',
            end: 'workbench.action.terminal.moveToLineEnd',
          }),
    };
  }
}
