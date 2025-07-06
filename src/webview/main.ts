import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

// Import types and constants for webview
import type { WebviewMessage, VsCodeMessage, TerminalConfig } from '../types/common';

// Constants for webview (duplicated to avoid import issues)
const WEBVIEW_CONSTANTS = {
  DARK_THEME: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#000000',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  },
  LIGHT_THEME: {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#000000',
    cursorAccent: '#ffffff',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5',
  },
};

const TERMINAL_CONSTANTS = {
  TERMINAL_REMOVE_DELAY: 2000,
  COMMANDS: {
    READY: 'ready',
    INIT: 'init',
    INPUT: 'input',
    OUTPUT: 'output',
    RESIZE: 'resize',
    CLEAR: 'clear',
    EXIT: 'exit',
    SPLIT: 'split',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
    SWITCH_TERMINAL: 'switchTerminal',
  },
};

declare const acquireVsCodeApi: () => {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

// Performance-optimized terminal management with split support
class TerminalWebviewManager {
  public terminal: Terminal | null = null;
  public fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;
  private isComposing: boolean = false;
  public activeTerminalId: string | null = null;

  // Split functionality
  public secondaryTerminal: Terminal | null = null;
  public secondaryTerminalId: string | null = null;
  public secondaryFitAddon: FitAddon | null = null;
  private secondaryContainer: HTMLElement | null = null;
  public isSplitMode = false;
  private splitDirection: 'horizontal' | 'vertical' | null = null;

  // Performance optimization: Buffer output and batch writes
  private outputBuffer: string[] = [];
  private bufferFlushTimer: number | null = null;
  private readonly BUFFER_FLUSH_INTERVAL = 16; // ~60fps
  private readonly MAX_BUFFER_SIZE = 100;

  // Performance optimization: Debounce resize operations
  private resizeDebounceTimer: number | null = null;
  private readonly RESIZE_DEBOUNCE_DELAY = 150;

  // Multiple terminal management
  public terminals = new Map<string, { terminal: Terminal; fitAddon: FitAddon; name: string }>();
  private terminalContainers = new Map<string, HTMLElement>();

  // Multi-split layout management
  private splitTerminals = new Map<string, HTMLElement>();
  private maxSplitCount = 5;
  private minTerminalHeight = 100; // px

  // WebView header management
  public headerElement: HTMLElement | null = null;

  public initializeSimpleTerminal(): void {
    const container = document.getElementById('terminal');
    if (!container) {
      console.error('Terminal container not found');
      updateStatus('ERROR: Terminal container not found', 'error');
      return;
    }

    updateStatus('Initializing simple terminal');
    console.log('🎯 [WEBVIEW] Initializing simple terminal');

    // Create a simple terminal container with buttons
    container.innerHTML = `
      <div id="terminal-header" style="
        display: flex;
        background: var(--vscode-tab-inactiveBackground, #2d2d30);
        border-bottom: 1px solid var(--vscode-tab-border, #333);
        padding: 4px 8px;
        gap: 4px;
        align-items: center;
        justify-content: space-between;
        min-height: 32px;
      ">
        <div id="terminal-tabs" style="
          display: flex;
          gap: 2px;
          flex: 1;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        "></div>
      </div>
      <div id="terminal-body" style="
        flex: 1;
        background: #000;
        position: relative;
        height: calc(100% - 32px);
        min-height: 200px;
      ">
        <div id="terminal-placeholder" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #888;
          font-family: monospace;
          font-size: 14px;
          text-align: center;
        ">
          <div>Terminal Ready</div>
          <div style="font-size: 12px; margin-top: 8px;">Waiting for initialization...</div>
        </div>
      </div>
    `;

    // Force DOM update by using a small delay
    setTimeout(() => {
      this.terminalContainer = document.getElementById('terminal-body');

      if (this.terminalContainer) {
        updateStatus('Simple terminal view initialized', 'success');
        console.log('🎯 [WEBVIEW] Simple terminal container created successfully');
        console.log('🎯 [WEBVIEW] Container element:', this.terminalContainer);
      } else {
        updateStatus('ERROR: Failed to create terminal container', 'error');
        console.error('❌ [WEBVIEW] Failed to create terminal container');
        console.error('❌ [WEBVIEW] Available elements:', document.querySelectorAll('*'));
      }
    }, 1);

    // Setup IME support
    this.setupIMEHandling();

    // Create webview header if enabled
    this.createWebViewHeader();
  }

  public addTerminalTab(id: string, name: string): void {
    const tabsContainer = document.getElementById('terminal-tabs');
    if (!tabsContainer) {
      console.error('❌ [WEBVIEW] Terminal tabs container not found');
      return;
    }

    // Check if tab already exists
    if (document.getElementById(`tab-${id}`)) {
      console.log('🎯 [WEBVIEW] Tab already exists for terminal:', id);
      return;
    }

    const tab = document.createElement('div');
    tab.id = `tab-${id}`;
    tab.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--vscode-tab-inactiveBackground, #2d2d30);
      border: 1px solid var(--vscode-tab-border, #333);
      border-radius: 3px 3px 0 0;
      color: var(--vscode-tab-inactiveForeground, #969696);
      font-size: 11px;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      min-width: 80px;
      max-width: 150px;
    `;

    const tabLabel = document.createElement('span');
    tabLabel.textContent = name;
    tabLabel.style.cssText = `
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: var(--vscode-tab-inactiveForeground, #969696);
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
    `;
    closeBtn.title = 'Close Terminal';

    // Tab click to switch
    tab.addEventListener('click', (e) => {
      if (e.target !== closeBtn) {
        this.switchToTerminal(id);
      }
    });

    // Close button click
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTerminal(id);
    });

    // Close button hover
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'var(--vscode-button-hoverBackground, #1f3447)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
    });

    tab.appendChild(tabLabel);
    tab.appendChild(closeBtn);
    tabsContainer.appendChild(tab);

    console.log('✅ [WEBVIEW] Added tab for terminal:', id, name);

    // Update terminal count badge
    this.updateTerminalCountBadge();
  }

  public switchToTerminal(id: string): void {
    console.log('🔄 [WEBVIEW] Switching to terminal:', id);

    // Update active terminal ID
    this.setActiveTerminalId(id);

    // Hide all terminal containers
    this.terminalContainers.forEach((container, terminalId) => {
      container.style.display = terminalId === id ? 'block' : 'none';
    });

    // Update tab appearances
    const tabsContainer = document.getElementById('terminal-tabs');
    if (tabsContainer) {
      tabsContainer.childNodes.forEach((tabNode) => {
        const tab = tabNode as HTMLElement;
        const isActive = tab.id === `tab-${id}`;

        tab.style.background = isActive
          ? 'var(--vscode-tab-activeBackground, #1e1e1e)'
          : 'var(--vscode-tab-inactiveBackground, #2d2d30)';
        tab.style.color = isActive
          ? 'var(--vscode-tab-activeForeground, #ffffff)'
          : 'var(--vscode-tab-inactiveForeground, #969696)';
      });
    }

    // Focus the active terminal
    const terminalData = this.terminals.get(id);
    if (terminalData?.terminal) {
      terminalData.terminal.focus();
      if (terminalData.fitAddon) {
        terminalData.fitAddon.fit();
      }
    }

    console.log('✅ [WEBVIEW] Switched to terminal:', id);
  }

  public closeTerminal(id: string): void {
    console.log('🗑️ [WEBVIEW] Close terminal requested:', id);

    // Check if this is a safe kill attempt
    if (!this.canKillTerminal(id)) {
      return;
    }

    // Check if confirmation is needed
    if (this.shouldShowKillConfirmation()) {
      this.showKillConfirmationDialog(id);
      return;
    }

    // Perform the actual kill
    this.performKillTerminal(id);
  }

  private canKillTerminal(_id: string): boolean {
    const terminalCount = this.terminals.size;
    const minTerminalCount = this.getMinTerminalCount();

    if (terminalCount <= minTerminalCount) {
      console.warn('🛡️ [WEBVIEW] Cannot kill terminal - would go below minimum count');
      this.showLastTerminalWarning(minTerminalCount);
      return false;
    }

    return true;
  }

  private getMinTerminalCount(): number {
    // For now, default to 1. Later this will be read from settings
    return 1;
  }

  private shouldShowKillConfirmation(): boolean {
    // For now, default to false. Later this will be read from settings
    return false;
  }

  private showLastTerminalWarning(minCount: number): void {
    const warningOverlay = document.createElement('div');
    warningOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--vscode-notifications-background, #1e1e1e);
      border: 2px solid var(--vscode-errorBackground, #f14c4c);
      border-radius: 6px;
      padding: 16px 20px;
      color: var(--vscode-errorForeground, #ffffff);
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      animation: shake 0.5s ease-in-out;
      text-align: center;
    `;

    warningOverlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center; margin-bottom: 8px;">
        <span style="font-size: 16px;">⚠️</span>
        <span><strong>Cannot close terminal</strong></span>
      </div>
      <div style="margin-bottom: 4px;">
        Must keep at least ${minCount} terminal${minCount > 1 ? 's' : ''} open
      </div>
      <div style="font-size: 10px; opacity: 0.8;">
        Create a new terminal first if you want to replace this one
      </div>
    `;

    // Add shake animation CSS if not already added
    if (!document.getElementById('terminal-warning-styles')) {
      const style = document.createElement('style');
      style.id = 'terminal-warning-styles';
      style.textContent = `
        @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%) translateX(0); }
          25% { transform: translate(-50%, -50%) translateX(-5px); }
          75% { transform: translate(-50%, -50%) translateX(5px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(warningOverlay);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (warningOverlay.parentNode) {
        warningOverlay.remove();
      }
    }, 3000);
  }

  private showKillConfirmationDialog(terminalId: string): void {
    const terminalData = this.terminals.get(terminalId);
    const terminalName = terminalData?.name || 'Unknown Terminal';

    const confirmDialog = document.createElement('div');
    confirmDialog.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    confirmDialog.innerHTML = `
      <div style="
        background: var(--vscode-editor-background, #1e1e1e);
        border: 1px solid var(--vscode-widget-border, #454545);
        border-radius: 6px;
        padding: 20px;
        min-width: 300px;
        text-align: center;
      ">
        <h3 style="margin: 0 0 12px 0; color: var(--vscode-foreground);">
          Close Terminal?
        </h3>
        <p style="margin: 0 0 20px 0; color: var(--vscode-descriptionForeground); font-size: 12px;">
          Are you sure you want to close "<strong>${terminalName}</strong>"?<br>
          Any running processes will be terminated.
        </p>
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button id="kill-cancel-${terminalId}" style="
            background: transparent;
            border: 1px solid var(--vscode-widget-border);
            color: var(--vscode-foreground);
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
          ">Cancel</button>
          <button id="kill-confirm-${terminalId}" style="
            background: var(--vscode-errorBackground, #f14c4c);
            border: 1px solid var(--vscode-errorBackground, #f14c4c);
            color: var(--vscode-errorForeground, #ffffff);
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
          ">Close Terminal</button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmDialog);

    // Event handlers
    const cancelBtn = confirmDialog.querySelector(`#kill-cancel-${terminalId}`);
    const confirmBtn = confirmDialog.querySelector(`#kill-confirm-${terminalId}`);

    const closeDialog = (): void => {
      confirmDialog.remove();
    };

    cancelBtn?.addEventListener('click', closeDialog);

    confirmBtn?.addEventListener('click', () => {
      closeDialog();
      this.performKillTerminal(terminalId);
    });

    // ESC key to cancel
    const escHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closeDialog();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  private performKillTerminal(id: string): void {
    console.log('🗑️ [WEBVIEW] Performing kill for terminal:', id);

    // Remove terminal instance
    const terminalData = this.terminals.get(id);
    if (terminalData) {
      terminalData.terminal.dispose();
      this.terminals.delete(id);
    }

    // Remove terminal container
    const container = this.terminalContainers.get(id);
    if (container) {
      container.remove();
      this.terminalContainers.delete(id);
    }

    // Remove tab
    const tab = document.getElementById(`tab-${id}`);
    if (tab) {
      tab.remove();
    }

    // If this was the active terminal, switch to another one
    if (this.activeTerminalId === id) {
      const remainingTerminals = Array.from(this.terminals.keys());
      if (remainingTerminals.length > 0) {
        const nextTerminalId = remainingTerminals[0];
        if (nextTerminalId) {
          this.switchToTerminal(nextTerminalId);
        }
      } else {
        this.activeTerminalId = null;
        // Show placeholder if no terminals left
        this.showTerminalPlaceholder();
      }
    }

    // Notify extension about terminal closure
    vscode.postMessage({
      command: 'terminalClosed',
      terminalId: id,
    });

    console.log('✅ [WEBVIEW] Terminal closed:', id);

    // Update terminal count badge
    this.updateTerminalCountBadge();
  }

  private showTerminalPlaceholder(): void {
    const terminalBody = document.getElementById('terminal-body');
    if (terminalBody) {
      terminalBody.innerHTML = `
        <div id="terminal-placeholder" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #888;
          font-family: monospace;
          font-size: 14px;
          text-align: center;
        ">
          <div>No Terminal</div>
          <div style="font-size: 12px; margin-top: 8px;">Create a new terminal to get started</div>
        </div>
      `;
    }
  }

  public openSettingsPanel(): void {
    console.log('⚙️ [WEBVIEW] Opening settings panel');

    // Check if settings panel already exists
    let settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
      // Toggle visibility if already exists
      const isVisible = settingsPanel.style.display !== 'none';
      settingsPanel.style.display = isVisible ? 'none' : 'flex';
      return;
    }

    // Create settings panel
    settingsPanel = document.createElement('div');
    settingsPanel.id = 'settings-panel';
    settingsPanel.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const settingsDialog = document.createElement('div');
    settingsDialog.style.cssText = `
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-widget-border, #454545);
      border-radius: 6px;
      padding: 20px;
      min-width: 400px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    `;

    settingsDialog.innerHTML = `
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--vscode-widget-border, #454545);
        padding-bottom: 10px;
      ">
        <h3 style="
          margin: 0;
          color: var(--vscode-foreground, #cccccc);
          font-size: 16px;
          font-weight: 600;
        ">Terminal Settings</h3>
        <button id="close-settings" style="
          background: transparent;
          border: none;
          color: var(--vscode-foreground, #cccccc);
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          border-radius: 3px;
        ">×</button>
      </div>

      <div id="settings-content">
        <div style="margin-bottom: 16px;">
          <label style="
            display: block;
            color: var(--vscode-foreground, #cccccc);
            font-size: 12px;
            margin-bottom: 6px;
            font-weight: 500;
          ">Font Size</label>
          <input type="range" id="font-size-slider" min="10" max="24" value="14" style="
            width: 100%;
            margin-bottom: 4px;
          ">
          <div style="
            display: flex;
            justify-content: space-between;
            color: var(--vscode-descriptionForeground, #888);
            font-size: 11px;
          ">
            <span>10px</span>
            <span id="font-size-value">14px</span>
            <span>24px</span>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="
            display: block;
            color: var(--vscode-foreground, #cccccc);
            font-size: 12px;
            margin-bottom: 6px;
            font-weight: 500;
          ">Font Family</label>
          <select id="font-family-select" style="
            width: 100%;
            padding: 6px 8px;
            background: var(--vscode-input-background, #3c3c3c);
            border: 1px solid var(--vscode-widget-border, #454545);
            border-radius: 3px;
            color: var(--vscode-foreground, #cccccc);
            font-size: 12px;
          ">
            <option value="Consolas, monospace">Consolas</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="Monaco, monospace">Monaco</option>
            <option value="'SF Mono', monospace">SF Mono</option>
            <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
          </select>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="
            display: block;
            color: var(--vscode-foreground, #cccccc);
            font-size: 12px;
            margin-bottom: 6px;
            font-weight: 500;
          ">Theme</label>
          <select id="theme-select" style="
            width: 100%;
            padding: 6px 8px;
            background: var(--vscode-input-background, #3c3c3c);
            border: 1px solid var(--vscode-widget-border, #454545);
            border-radius: 3px;
            color: var(--vscode-foreground, #cccccc);
            font-size: 12px;
          ">
            <option value="auto">Auto (Follow VS Code)</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="
            display: flex;
            align-items: center;
            color: var(--vscode-foreground, #cccccc);
            font-size: 12px;
            cursor: pointer;
          ">
            <input type="checkbox" id="cursor-blink" style="margin-right: 8px;">
            Enable cursor blinking
          </label>
        </div>

        <div style="
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          border-top: 1px solid var(--vscode-widget-border, #454545);
          padding-top: 16px;
        ">
          <button id="reset-settings" style="
            background: transparent;
            border: 1px solid var(--vscode-widget-border, #454545);
            color: var(--vscode-foreground, #cccccc);
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
          ">Reset</button>
          <button id="apply-settings" style="
            background: var(--vscode-button-background, #0e639c);
            border: 1px solid var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #ffffff);
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
          ">Apply</button>
        </div>
      </div>
    `;

    settingsPanel.appendChild(settingsDialog);
    document.body.appendChild(settingsPanel);

    // Setup event handlers for settings panel
    this.setupSettingsPanelEventHandlers();

    // Load current settings
    this.loadCurrentSettings();
  }

  private setupSettingsPanelEventHandlers(): void {
    // Close button
    const closeBtn = document.getElementById('close-settings');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeSettingsPanel();
      });
    }

    // Click outside to close
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
      settingsPanel.addEventListener('click', (e) => {
        if (e.target === settingsPanel) {
          this.closeSettingsPanel();
        }
      });
    }

    // Font size slider
    const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement;
    const fontSizeValue = document.getElementById('font-size-value');
    if (fontSizeSlider && fontSizeValue) {
      fontSizeSlider.addEventListener('input', () => {
        fontSizeValue.textContent = `${fontSizeSlider.value}px`;
      });
    }

    // Apply button
    const applyBtn = document.getElementById('apply-settings');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.applySettings();
      });
    }

    // Reset button
    const resetBtn = document.getElementById('reset-settings');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetSettings();
      });
    }
  }

  private closeSettingsPanel(): void {
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
      settingsPanel.remove();
    }
  }

  private loadCurrentSettings(): void {
    // Load current settings and populate form
    console.log('⚙️ [WEBVIEW] Loading current settings');

    // Request current settings from extension
    vscode.postMessage({
      command: 'getSettings',
    });
  }

  private applySettings(): void {
    console.log('⚙️ [WEBVIEW] Applying settings');

    const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement;
    const fontFamilySelect = document.getElementById('font-family-select') as HTMLSelectElement;
    const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
    const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;

    const settings = {
      fontSize: parseInt(fontSizeSlider?.value || '14'),
      fontFamily: fontFamilySelect?.value || 'Consolas, monospace',
      theme: themeSelect?.value || 'auto',
      cursorBlink: cursorBlinkCheckbox?.checked || true,
    };

    // Send settings to extension
    vscode.postMessage({
      command: 'updateSettings',
      settings,
    });

    // Apply settings immediately to current terminal
    this.applySettingsToTerminal(settings);

    this.closeSettingsPanel();
  }

  private resetSettings(): void {
    console.log('⚙️ [WEBVIEW] Resetting settings to defaults');

    const defaultSettings = {
      fontSize: 14,
      fontFamily: 'Consolas, monospace',
      theme: 'auto',
      cursorBlink: true,
    };

    // Update form with defaults
    const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement;
    const fontSizeValue = document.getElementById('font-size-value');
    const fontFamilySelect = document.getElementById('font-family-select') as HTMLSelectElement;
    const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
    const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;

    if (fontSizeSlider) fontSizeSlider.value = defaultSettings.fontSize.toString();
    if (fontSizeValue) fontSizeValue.textContent = `${defaultSettings.fontSize}px`;
    if (fontFamilySelect) fontFamilySelect.value = defaultSettings.fontFamily;
    if (themeSelect) themeSelect.value = defaultSettings.theme;
    if (cursorBlinkCheckbox) cursorBlinkCheckbox.checked = defaultSettings.cursorBlink;
  }

  private applySettingsToTerminal(settings: {
    fontSize: number;
    fontFamily: string;
    theme: string;
    cursorBlink: boolean;
  }): void {
    console.log('⚙️ [WEBVIEW] Applying settings to terminal:', settings);

    // Determine the theme to use
    let terminalTheme;
    if (settings.theme === 'auto') {
      terminalTheme = getTheme();
    } else if (settings.theme === 'dark') {
      terminalTheme = WEBVIEW_CONSTANTS.DARK_THEME;
    } else if (settings.theme === 'light') {
      terminalTheme = WEBVIEW_CONSTANTS.LIGHT_THEME;
    } else {
      terminalTheme = getTheme(); // Fallback to auto detection
    }

    console.log('🎨 [WEBVIEW] Applying theme:', settings.theme, 'resolved to:', terminalTheme);

    // Apply to main terminal
    if (this.terminal) {
      this.terminal.options.fontSize = settings.fontSize;
      this.terminal.options.fontFamily = settings.fontFamily;
      this.terminal.options.cursorBlink = settings.cursorBlink;
      this.terminal.options.theme = terminalTheme;

      // Force refresh to apply changes
      this.terminal.refresh(0, this.terminal.rows - 1);

      if (this.fitAddon) {
        this.fitAddon.fit();
      }
    }

    // Apply to secondary terminal if exists
    if (this.secondaryTerminal) {
      this.secondaryTerminal.options.fontSize = settings.fontSize;
      this.secondaryTerminal.options.fontFamily = settings.fontFamily;
      this.secondaryTerminal.options.cursorBlink = settings.cursorBlink;
      this.secondaryTerminal.options.theme = terminalTheme;

      // Force refresh to apply changes
      this.secondaryTerminal.refresh(0, this.secondaryTerminal.rows - 1);

      if (this.secondaryFitAddon) {
        this.secondaryFitAddon.fit();
      }
    }
  }

  public populateSettingsForm(settings: {
    fontSize: number;
    fontFamily: string;
    theme?: string;
    cursorBlink: boolean;
  }): void {
    console.log('⚙️ [WEBVIEW] Populating settings form with:', settings);

    const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement;
    const fontSizeValue = document.getElementById('font-size-value');
    const fontFamilySelect = document.getElementById('font-family-select') as HTMLSelectElement;
    const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
    const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;

    if (fontSizeSlider) fontSizeSlider.value = settings.fontSize.toString();
    if (fontSizeValue) fontSizeValue.textContent = `${settings.fontSize}px`;
    if (fontFamilySelect) fontFamilySelect.value = settings.fontFamily;
    if (themeSelect && settings.theme) themeSelect.value = settings.theme;
    if (cursorBlinkCheckbox) cursorBlinkCheckbox.checked = settings.cursorBlink;
  }

  private setupIMEHandling(): void {
    console.log('🌐 [WEBVIEW] Setting up IME handling');

    // Listen for composition events on the document
    document.addEventListener('compositionstart', (_e) => {
      console.log('🌐 [WEBVIEW] Composition started');
      this.isComposing = true;
    });

    document.addEventListener('compositionupdate', (e) => {
      console.log('🌐 [WEBVIEW] Composition updating:', e.data);
      // Don't send data during composition updates
    });

    document.addEventListener('compositionend', (e) => {
      console.log('🌐 [WEBVIEW] Composition ended:', e.data);
      this.isComposing = false;

      // Send the composed text when IME composition is complete
      if (e.data && this.terminal) {
        console.log('🌐 [WEBVIEW] Sending composed text:', e.data);
        vscode.postMessage({
          command: 'input' as const,
          data: e.data,
          terminalId: this.activeTerminalId || 'terminal-initial',
        });
      }
    });

    // Add CSS for IME stability
    const style = document.createElement('style');
    style.textContent = `
      .xterm-screen {
        min-width: 1px; /* IME input stability fix */
      }
      .xterm-composition-view {
        background: rgba(255, 255, 0, 0.3);
        border-bottom: 1px solid #ffff00;
      }
    `;
    document.head.appendChild(style);

    console.log('🌐 [WEBVIEW] IME handling setup complete');
  }

  public setActiveTerminalId(terminalId: string): void {
    this.activeTerminalId = terminalId;
    console.log('🎯 [WEBVIEW] Active terminal ID set to:', terminalId);
  }

  public createTerminal(id: string, name: string, config: TerminalConfig): void {
    updateStatus(`Creating terminal: ${name}`);
    this.setActiveTerminalId(id); // Set active terminal ID immediately
    console.log('🎯 [WEBVIEW] Creating terminal:', id, name);
    console.log('🎯 [WEBVIEW] Terminal container available:', !!this.terminalContainer);

    if (!this.terminalContainer) {
      console.error('❌ [WEBVIEW] No terminal container available');
      updateStatus('ERROR: No terminal container');
      return;
    }

    try {
      const terminalTheme = getTheme();
      console.log('🎨 [WEBVIEW] Creating terminal with theme:', terminalTheme);

      const terminal = new Terminal({
        fontSize: config.fontSize || 14,
        fontFamily: config.fontFamily || 'monospace',
        theme: terminalTheme,
        cursorBlink: true,
        allowTransparency: true,
        scrollback: 10000,
      });

      updateStatus(`Terminal instance created: ${name}`);
      console.log('🎯 [WEBVIEW] Terminal instance created successfully');

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      updateStatus(`Loading addons for: ${name}`);
      console.log('🎯 [WEBVIEW] Terminal addons loaded');

      if (this.terminalContainer) {
        // Clear placeholder immediately
        const placeholder = document.getElementById('terminal-placeholder');
        if (placeholder) {
          placeholder.remove();
          console.log('🎯 [WEBVIEW] Placeholder removed');
        } else {
          console.log('🎯 [WEBVIEW] No placeholder found to remove');
        }

        updateStatus(`Opening terminal: ${name}`);
        console.log('🎯 [WEBVIEW] Opening terminal in container');

        // Create a terminal container div if not in split mode
        let targetContainer = this.terminalContainer;

        if (!this.isSplitMode) {
          // Create initial terminal container
          const terminalDiv = document.createElement('div');
          terminalDiv.style.cssText = 'width: 100%; height: 100%;';
          terminalDiv.setAttribute('data-terminal-container', 'primary');
          terminalDiv.id = 'primary-terminal';
          this.terminalContainer.appendChild(terminalDiv);
          targetContainer = terminalDiv;
        }

        // Give the DOM time to settle before opening terminal
        setTimeout(() => {
          try {
            console.log('🎯 [WEBVIEW] Calling terminal.open()');
            terminal.open(targetContainer);
            console.log('🎯 [WEBVIEW] Terminal.open() completed');

            updateStatus(`Terminal opened: ${name}`);

            // Wait for terminal to be fully rendered
            setTimeout(() => {
              updateStatus(`Fitting terminal: ${name}`);
              console.log('🎯 [WEBVIEW] Fitting terminal');

              try {
                fitAddon.fit();
                console.log('🎯 [WEBVIEW] Terminal fitted successfully');

                // Force refresh after fitting
                terminal.refresh(0, terminal.rows - 1);

                console.log('🎯 [WEBVIEW] Focusing terminal and ready for pty connection');
                terminal.focus();

                updateStatus(`✅ ${name} ACTIVE`, 'success');

                // Store reference
                this.terminal = terminal;
                this.fitAddon = fitAddon;
              } catch (fitError) {
                console.error('❌ [WEBVIEW] Error during fitting:', fitError);
                updateStatus(`Error fitting: ${String(fitError)}`, 'error');
              }
            }, 300);
          } catch (openError) {
            console.error('❌ [WEBVIEW] Error opening terminal:', openError);
            updateStatus(`Error opening: ${String(openError)}`, 'error');
          }
        }, 100);
      } else {
        console.error('❌ [WEBVIEW] No terminal container available!');
        updateStatus('ERROR: No terminal container');
      }

      // Handle terminal input with special key processing
      terminal.onData((data) => {
        console.log(
          '🎯 [WEBVIEW] Terminal input data:',
          data,
          'length:',
          data.length,
          'charCode:',
          data.charCodeAt(0)
        );

        // Skip processing if we're in IME composition mode
        if (this.isComposing) {
          console.log('🌐 [WEBVIEW] Skipping input during IME composition');
          return;
        }

        // Handle special keys
        const charCode = data.charCodeAt(0);

        // Process the input based on character codes
        if (charCode === 127) {
          // Backspace key (DEL character) - convert to proper backspace
          console.log(
            '⌫ [WEBVIEW] DEL character detected (Backspace key), converting to backspace'
          );
          vscode.postMessage({
            command: 'input' as const,
            data: '\x08', // Send proper backspace character
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 8) {
          // BS (backspace) character - send as-is
          console.log('⌫ [WEBVIEW] BS character detected');
          vscode.postMessage({
            command: 'input' as const,
            data: data, // Pass through as-is
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 13) {
          // Enter key
          console.log('↵ [WEBVIEW] Enter detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\r', // Ensure proper line ending
            terminalId: this.activeTerminalId || id,
          });
        } else if (data.startsWith('\x1b[')) {
          // Arrow keys and other escape sequences
          console.log('🔄 [WEBVIEW] Escape sequence detected:', JSON.stringify(data));
          vscode.postMessage({
            command: 'input' as const,
            data: data,
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 3) {
          // Ctrl+C (SIGINT)
          console.log('🛑 [WEBVIEW] Ctrl+C detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\x03',
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 12) {
          // Ctrl+L (clear screen)
          console.log('🧹 [WEBVIEW] Ctrl+L detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\x0c',
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 4) {
          // Ctrl+D (EOF)
          console.log('📄 [WEBVIEW] Ctrl+D detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\x04',
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 9) {
          // Tab (for completion)
          console.log('⭾ [WEBVIEW] Tab detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\x09',
            terminalId: this.activeTerminalId || id,
          });
        } else {
          // Regular character input
          vscode.postMessage({
            command: 'input' as const,
            data,
            terminalId: this.activeTerminalId || id,
          });
        }
      });

      // Handle resize
      terminal.onResize((size) => {
        vscode.postMessage({
          command: 'resize' as const,
          cols: size.cols,
          rows: size.rows,
          terminalId: id,
        });
      });

      // Performance optimization: Use debounced resize observer
      if (this.terminalContainer) {
        const resizeObserver = new ResizeObserver(() => {
          if (this.fitAddon && this.terminal) {
            // Use debounced resize to prevent excessive calls during window resizing
            this.debouncedResize(this.terminal.cols, this.terminal.rows);
          }
        });
        resizeObserver.observe(this.terminalContainer);
      }

      console.log('🎯 [WEBVIEW] Terminal creation completed successfully');
    } catch (error) {
      console.error('❌ [WEBVIEW] Error creating terminal:', error);
      updateStatus(`Error creating terminal: ${String(error)}`, 'error');
    }
  }

  public clearTerminal(): void {
    if (this.terminal) {
      console.log('🧹 [WEBVIEW] Clearing terminal screen');
      this.terminal.clear();
      // Also clear scrollback
      this.terminal.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
      updateStatus('Terminal cleared', 'success');
    }
  }

  public writeToTerminal(data: string): void {
    if (this.terminal) {
      // Performance optimization: Buffer small outputs for batching
      if (data.length < 1000 && this.outputBuffer.length < this.MAX_BUFFER_SIZE) {
        this.outputBuffer.push(data);
        this.scheduleBufferFlush();
      } else {
        // Flush any buffered data first, then write large data directly
        this.flushOutputBuffer();
        this.terminal.write(data);
      }
    } else {
      console.warn('⚠️ [WEBVIEW] No terminal instance to write to');
    }
  }

  public writeToSecondaryTerminal(data: string): void {
    if (this.secondaryTerminal) {
      console.log('📝 [WEBVIEW] Writing to secondary terminal:', data.length, 'chars');
      this.secondaryTerminal.write(data);
    } else {
      console.warn('⚠️ [WEBVIEW] No secondary terminal instance to write to');
    }
  }

  private scheduleBufferFlush(): void {
    if (this.bufferFlushTimer === null) {
      this.bufferFlushTimer = window.setTimeout(() => {
        this.flushOutputBuffer();
      }, this.BUFFER_FLUSH_INTERVAL);
    }
  }

  private flushOutputBuffer(): void {
    if (this.bufferFlushTimer !== null) {
      window.clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    if (this.outputBuffer.length > 0 && this.terminal) {
      const bufferedData = this.outputBuffer.join('');
      this.outputBuffer = [];
      this.terminal.write(bufferedData);
    }
  }

  // Performance optimization: Debounced resize to prevent excessive calls
  public debouncedResize(cols: number, rows: number): void {
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = window.setTimeout(() => {
      if (this.fitAddon && this.terminal) {
        this.terminal.resize(cols, rows);
        this.fitAddon.fit();
      }
      this.resizeDebounceTimer = null;
    }, this.RESIZE_DEBOUNCE_DELAY);
  }

  // Split functionality methods (controlled by panel commands)
  public initializeSplitControls(): void {
    console.log('🔀 [WEBVIEW] Split controls ready (using panel commands)');
    // No UI controls needed - using VS Code panel commands
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    // Debug current state
    this.logSplitState();

    // Use the new multi-split system
    if (direction === 'vertical') {
      this.addTerminalToMultiSplit();
    } else {
      // Keep horizontal split as the old 2-pane split for now
      this.performHorizontalSplit();
    }
  }

  private addTerminalToMultiSplit(): void {
    console.log('📐 [WEBVIEW] Adding terminal to multi-split layout');

    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.showSplitLimitWarning(layoutInfo.reason || 'Cannot add more terminals');
      return;
    }

    // Get the current active terminal ID to add to split
    if (!this.activeTerminalId) {
      console.error('❌ [WEBVIEW] No active terminal to add to split');
      return;
    }

    const activeTerminalData = this.terminals.get(this.activeTerminalId);
    if (!activeTerminalData) {
      console.error('❌ [WEBVIEW] Active terminal data not found');
      return;
    }

    // If this is the first split, convert to multi-split layout
    if (this.splitTerminals.size === 0) {
      this.initializeMultiSplitLayout();
    }

    // Add current terminal to split layout
    this.addTerminalToSplitLayout(this.activeTerminalId, activeTerminalData.name);

    console.log('✅ [WEBVIEW] Terminal added to multi-split layout');
  }

  private calculateSplitLayout(): { canSplit: boolean; terminalHeight: number; reason?: string } {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      return { canSplit: false, terminalHeight: 0, reason: 'Terminal body not found' };
    }

    const availableHeight = terminalBody.clientHeight;
    const headerHeight = 24; // Terminal header height
    const splitterHeight = 4; // Splitter height

    // Current split count plus the one we want to add
    const nextSplitCount = this.splitTerminals.size + 1;

    // Check maximum split limit
    if (nextSplitCount > this.maxSplitCount) {
      return {
        canSplit: false,
        terminalHeight: 0,
        reason: `Maximum ${this.maxSplitCount} terminals can be displayed in split view`,
      };
    }

    // Calculate required height for all terminals with headers and splitters
    const totalHeaderHeight = nextSplitCount * headerHeight;
    const totalSplitterHeight = Math.max(0, nextSplitCount - 1) * splitterHeight;
    const availableTerminalHeight = availableHeight - totalHeaderHeight - totalSplitterHeight;

    // Calculate height per terminal
    const terminalHeight = Math.floor(availableTerminalHeight / nextSplitCount);

    // Check minimum height constraint
    if (terminalHeight < this.minTerminalHeight) {
      return {
        canSplit: false,
        terminalHeight: 0,
        reason: `Terminal height would be too small (min: ${this.minTerminalHeight}px)`,
      };
    }

    return { canSplit: true, terminalHeight };
  }

  private initializeMultiSplitLayout(): void {
    console.log('📐 [WEBVIEW] Initializing multi-split layout');

    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      console.error('❌ [WEBVIEW] Terminal body not found');
      return;
    }

    // Set up flex column layout for vertical splits
    terminalBody.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    `;

    this.isSplitMode = true;
    this.splitDirection = 'vertical';
    console.log('✅ [WEBVIEW] Multi-split layout initialized');
  }

  private addTerminalToSplitLayout(terminalId: string, terminalName: string): void {
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      console.error('❌ [WEBVIEW] Cannot add terminal to split layout');
      return;
    }

    // Create split terminal container
    const splitContainer = this.createSplitTerminalContainer(
      terminalId,
      terminalName,
      layoutInfo.terminalHeight
    );

    // Add to split layout
    this.addToSplitDOM(splitContainer);

    // Redistribute existing terminals
    this.redistributeSplitTerminals(layoutInfo.terminalHeight);

    // Store reference
    this.splitTerminals.set(terminalId, splitContainer);

    console.log('✅ [WEBVIEW] Terminal added to split layout:', terminalId);
  }

  private createSplitTerminalContainer(id: string, name: string, height: number): HTMLElement {
    const container = document.createElement('div');
    container.id = `split-terminal-${id}`;
    container.className = 'split-terminal-container';
    container.style.cssText = `
      height: ${height}px;
      min-height: ${this.minTerminalHeight}px;
      background: #000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
    `;

    // Create terminal header
    const header = document.createElement('div');
    header.style.cssText = `
      height: 24px;
      background: var(--vscode-tab-inactiveBackground, #2d2d30);
      color: var(--vscode-foreground, #cccccc);
      font-size: 11px;
      display: flex;
      align-items: center;
      padding: 0 8px;
      border-bottom: 1px solid var(--vscode-tab-border, #333);
      flex-shrink: 0;
    `;
    header.textContent = name;

    // Create terminal area
    const terminalArea = document.createElement('div');
    terminalArea.id = `split-terminal-area-${id}`;
    terminalArea.style.cssText = `
      flex: 1;
      background: #000;
      overflow: hidden;
    `;

    container.appendChild(header);
    container.appendChild(terminalArea);

    return container;
  }

  private addToSplitDOM(container: HTMLElement): void {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      console.error('❌ [WEBVIEW] Terminal body not found');
      return;
    }

    // Add splitter if this is not the first terminal
    if (this.splitTerminals.size > 0) {
      const splitter = this.createSplitter();
      terminalBody.appendChild(splitter);
    }

    terminalBody.appendChild(container);
  }

  private createSplitter(): HTMLElement {
    const splitter = document.createElement('div');
    splitter.className = 'split-resizer';
    splitter.style.cssText = `
      height: 4px;
      background: var(--vscode-widget-border, #454545);
      cursor: row-resize;
      flex-shrink: 0;
      transition: background-color 0.2s ease;
    `;

    splitter.addEventListener('mouseenter', (): void => {
      splitter.style.background = 'var(--vscode-focusBorder, #007acc)';
    });

    splitter.addEventListener('mouseleave', (): void => {
      splitter.style.background = 'var(--vscode-widget-border, #454545)';
    });

    return splitter;
  }

  private redistributeSplitTerminals(newHeight: number): void {
    console.log(
      `📐 [WEBVIEW] Redistributing ${this.splitTerminals.size} terminals to height: ${newHeight}px`
    );

    this.splitTerminals.forEach((container, terminalId) => {
      container.style.height = `${newHeight}px`;

      // Resize terminal instance if it exists
      const terminalData = this.terminals.get(terminalId);
      if (terminalData?.fitAddon) {
        setTimeout(() => {
          terminalData.fitAddon.fit();
        }, 100);
      }
    });
  }

  private showSplitLimitWarning(reason: string): void {
    console.warn('⚠️ [WEBVIEW] Split limit reached:', reason);

    const warning = document.createElement('div');
    warning.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--vscode-notifications-background, #1e1e1e);
      border: 2px solid var(--vscode-notificationWarning-border, #ffcc02);
      border-radius: 6px;
      padding: 12px 16px;
      color: var(--vscode-notificationWarning-foreground, #ffffff);
      font-size: 11px;
      z-index: 10000;
      max-width: 300px;
      text-align: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    `;

    warning.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; justify-content: center;">
        <span>⚠️</span>
        <strong>Split Limit Reached</strong>
      </div>
      <div style="font-size: 10px;">${reason}</div>
    `;

    document.body.appendChild(warning);

    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
      }
    }, 4000);
  }

  private performHorizontalSplit(): void {
    // Keep the existing horizontal split logic for backward compatibility
    if (this.isSplitMode) {
      console.warn('🔀 [WEBVIEW] Already in split mode - ignoring split request');
      return;
    }

    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      console.error('❌ [WEBVIEW] Terminal body not found');
      return;
    }

    try {
      this.performSplit('horizontal', terminalBody);
      console.log('✅ [WEBVIEW] Horizontal split operation completed successfully');
    } catch (error) {
      console.error('❌ [WEBVIEW] Split operation failed:', error);
      this.cleanupSplitElements();
      throw error;
    }
  }

  private performSplit(direction: 'horizontal' | 'vertical', terminalBody: HTMLElement): void {
    // Set split direction and mode
    this.splitDirection = direction;
    this.isSplitMode = true;

    // Modify terminal body for split layout
    terminalBody.style.display = 'flex';
    terminalBody.style.flexDirection = direction === 'horizontal' ? 'row' : 'column';

    // Get existing terminal container or create one
    let existingTerminal = terminalBody.querySelector('[data-terminal-container]');

    if (!existingTerminal) {
      // If no terminal container exists, wrap the terminal in a container
      const primaryContainer = document.createElement('div');
      primaryContainer.style.cssText = 'width: 100%; height: 100%;';
      primaryContainer.setAttribute('data-terminal-container', 'primary');
      primaryContainer.id = 'primary-terminal';

      // Move all existing content into the container
      while (terminalBody.firstChild) {
        primaryContainer.appendChild(terminalBody.firstChild);
      }

      terminalBody.appendChild(primaryContainer);
      existingTerminal = primaryContainer;
    }

    if (existingTerminal) {
      // Make existing terminal take half space
      (existingTerminal as HTMLElement).style.flex = '1';
      (existingTerminal as HTMLElement).style.minWidth =
        direction === 'horizontal' ? '200px' : 'auto';
      (existingTerminal as HTMLElement).style.minHeight =
        direction === 'vertical' ? '100px' : 'auto';
    }

    // Create splitter
    const splitter = document.createElement('div');
    splitter.style.cssText = `
      background: var(--vscode-widget-border, #454545);
      ${direction === 'horizontal' ? 'width: 4px; cursor: col-resize;' : 'height: 4px; cursor: row-resize;'}
      flex-shrink: 0;
    `;
    splitter.addEventListener('mouseenter', () => {
      splitter.style.background = 'var(--vscode-focusBorder, #007acc)';
    });
    splitter.addEventListener('mouseleave', () => {
      splitter.style.background = 'var(--vscode-widget-border, #454545)';
    });

    // Create secondary terminal container
    const secondaryContainer = document.createElement('div');
    secondaryContainer.style.cssText = `
      flex: 1;
      background: #000;
      ${direction === 'horizontal' ? 'min-width: 200px;' : 'min-height: 100px;'}
    `;
    secondaryContainer.setAttribute('data-terminal-container', 'secondary');
    secondaryContainer.id = 'secondary-terminal';

    // Add to DOM
    terminalBody.appendChild(splitter);
    terminalBody.appendChild(secondaryContainer);

    // Mark that secondary container is ready for terminal
    this.secondaryContainer = secondaryContainer;

    // Update UI (no controls to update - using panel commands)

    // Resize terminals
    setTimeout(() => {
      if (this.fitAddon && this.terminal) {
        this.fitAddon.fit();
      }
    }, 100);

    // Notify extension that split was completed
    console.log('🔀 [WEBVIEW] Split layout completed');
  }

  public createSecondaryTerminal(id: string, name: string, config: TerminalConfig): void {
    if (!this.secondaryContainer) {
      console.error('❌ [WEBVIEW] Secondary container not found');
      return;
    }

    try {
      updateStatus(`Creating secondary terminal: ${name}`);
      console.log('🔀 [WEBVIEW] Creating secondary terminal:', id, name);

      this.secondaryTerminalId = id;

      const terminalTheme = getTheme();
      console.log('🎨 [WEBVIEW] Creating secondary terminal with theme:', terminalTheme);

      this.secondaryTerminal = new Terminal({
        fontSize: config.fontSize || 14,
        fontFamily: config.fontFamily || 'Consolas, monospace',
        cursorBlink: true,
        theme: terminalTheme,
        allowTransparency: true,
        scrollback: 10000,
      });

      this.secondaryFitAddon = new FitAddon();
      this.secondaryTerminal.loadAddon(this.secondaryFitAddon);
      this.secondaryTerminal.loadAddon(new WebLinksAddon());

      // Open in secondary container
      this.secondaryTerminal.open(this.secondaryContainer);

      // Fit after opening
      setTimeout(() => {
        if (this.secondaryFitAddon && this.secondaryTerminal) {
          this.secondaryFitAddon.fit();
          this.secondaryTerminal.refresh(0, this.secondaryTerminal.rows - 1);
          this.secondaryTerminal.focus();
        }
      }, 50);

      // Set up event handlers for secondary terminal
      this.secondaryTerminal.onData((data) => {
        vscode.postMessage({
          command: 'input' as const,
          data,
          terminalId: this.secondaryTerminalId || 'secondary',
        });
      });

      console.log('✅ [WEBVIEW] Secondary terminal created successfully');
      updateStatus(`✅ ${name} ACTIVE`, 'success');
    } catch (error) {
      console.error('❌ [WEBVIEW] Error creating secondary terminal:', error);
      updateStatus(`ERROR: ${String(error)}`, 'error');
    }
  }

  public unsplitTerminal(): void {
    // Debug current state
    this.logSplitState();

    if (!this.isSplitMode) {
      console.log('🔀 [WEBVIEW] Not in split mode - checking for orphaned elements');

      // Check for orphaned DOM elements
      const orphanedSplitter = document.querySelector('[style*="cursor:"]');
      const orphanedSecondary = document.getElementById('secondary-terminal');

      if (orphanedSplitter || orphanedSecondary) {
        console.warn('🔀 [WEBVIEW] Found orphaned split elements - cleaning up');
        this.cleanupSplitElements();
      }
      return;
    }

    console.log('🔀 [WEBVIEW] Starting unsplit operation');

    try {
      // Use centralized cleanup
      this.cleanupSplitElements();

      // Resize main terminal
      setTimeout(() => {
        this.resizeTerminals();
      }, 100);

      console.log('✅ [WEBVIEW] Unsplit operation completed successfully');
    } catch (error) {
      console.error('❌ [WEBVIEW] Unsplit operation failed:', error);
      // Force cleanup even if error occurred
      this.cleanupSplitElements();
    }
  }

  private cleanupSplitElements(): void {
    console.log('🧹 [WEBVIEW] Cleaning up split elements');

    // Remove all splitter elements
    const splitters = document.querySelectorAll('[style*="cursor:"]');
    splitters.forEach((splitter, index) => {
      console.log(`🧹 [WEBVIEW] Removing splitter ${index + 1}`);
      splitter.remove();
    });

    // Remove secondary terminal container
    const secondaryContainer = document.getElementById('secondary-terminal');
    if (secondaryContainer) {
      console.log('🧹 [WEBVIEW] Removing secondary terminal container');
      secondaryContainer.remove();
    }

    // Clean up secondary terminal instance
    if (this.secondaryTerminal) {
      console.log('🧹 [WEBVIEW] Disposing secondary terminal');
      this.secondaryTerminal.dispose();
      this.secondaryTerminal = null;
    }

    if (this.secondaryFitAddon) {
      this.secondaryFitAddon = null;
    }

    // Reset terminal body layout
    const terminalBody = document.getElementById('terminal-body');
    if (terminalBody) {
      terminalBody.style.display = 'block';
      terminalBody.style.flexDirection = '';

      // Reset existing terminal styles
      const existingTerminal = terminalBody.querySelector('[data-terminal-container]');
      if (existingTerminal) {
        (existingTerminal as HTMLElement).style.flex = '';
        (existingTerminal as HTMLElement).style.minWidth = '';
        (existingTerminal as HTMLElement).style.minHeight = '';
      }
    }

    // Reset state variables
    this.isSplitMode = false;
    this.splitDirection = null;
    this.secondaryTerminalId = null;
    this.secondaryContainer = null;

    console.log('✅ [WEBVIEW] Split cleanup completed');
  }

  private logSplitState(): void {
    const splitState = {
      isSplitMode: this.isSplitMode,
      splitDirection: this.splitDirection,
      secondaryTerminalId: this.secondaryTerminalId,
      hasSecondaryTerminal: !!this.secondaryTerminal,
      hasSecondaryContainer: !!this.secondaryContainer,
      domSplitters: document.querySelectorAll('[style*="cursor:"]').length,
      domSecondaryContainer: !!document.getElementById('secondary-terminal'),
      terminalBodyDisplay: document.getElementById('terminal-body')?.style.display,
      terminalBodyFlexDirection: document.getElementById('terminal-body')?.style.flexDirection,
    };

    console.log('🔀 [DEBUG] Current split state:', splitState);
  }

  // Split controls managed by VS Code panel - no internal UI needed

  private resizeTerminals(): void {
    if (this.fitAddon && this.terminal) {
      this.fitAddon.fit();
    }

    if (this.isSplitMode && this.secondaryFitAddon && this.secondaryTerminal) {
      this.secondaryFitAddon.fit();
    }
  }

  // Performance optimization: Cleanup method
  public dispose(): void {
    this.flushOutputBuffer();

    if (this.bufferFlushTimer !== null) {
      window.clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }

    if (this.secondaryTerminal) {
      this.secondaryTerminal.dispose();
      this.secondaryTerminal = null;
    }

    this.fitAddon = null;
    this.secondaryFitAddon = null;
    this.terminalContainer = null;
    this.secondaryContainer = null;
  }
}

// Global instance
const terminalManager = new TerminalWebviewManager();

function getTheme(): { [key: string]: string } {
  // VS Code provides CSS variables for theme detection
  const style = getComputedStyle(document.body);

  // Get the background color and convert to RGB values
  const bgColor =
    style.getPropertyValue('--vscode-editor-background') ||
    style.getPropertyValue('--vscode-panel-background') ||
    style.backgroundColor;

  console.log('🎨 [WEBVIEW] Detected background color:', bgColor);

  // Check if dark theme by analyzing background color
  let isDark = true; // Default to dark

  if (bgColor) {
    // Handle hex colors
    if (bgColor.startsWith('#')) {
      const hex = bgColor.substring(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      isDark = brightness < 128;
    }
    // Handle rgb/rgba colors
    else if (bgColor.includes('rgb')) {
      const values = bgColor.match(/\d+/g);
      if (values && values.length >= 3) {
        const r = parseInt(values[0] || '0');
        const g = parseInt(values[1] || '0');
        const b = parseInt(values[2] || '0');
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        isDark = brightness < 128;
      }
    }
    // Handle specific dark theme indicators
    else if (
      bgColor.includes('1e1e1e') ||
      bgColor.includes('2d2d30') ||
      bgColor.includes('252526')
    ) {
      isDark = true;
    }
    // Handle light theme indicators
    else if (
      bgColor.includes('ffffff') ||
      bgColor.includes('f3f3f3') ||
      bgColor.includes('fffffe')
    ) {
      isDark = false;
    }
  }

  console.log('🎨 [WEBVIEW] Theme detected as:', isDark ? 'dark' : 'light');

  const theme = isDark ? WEBVIEW_CONSTANTS.DARK_THEME : WEBVIEW_CONSTANTS.LIGHT_THEME;
  console.log('🎨 [WEBVIEW] Applied theme:', theme);

  return theme;
}

// Handle messages from the extension
window.addEventListener('message', (event) => {
  console.log('🎯 [WEBVIEW] Received message event:', event);
  const message = event.data as WebviewMessage;
  console.log('🎯 [WEBVIEW] Message data:', message);
  console.log('🎯 [WEBVIEW] Message command:', message.command);

  switch (message.command) {
    case TERMINAL_CONSTANTS.COMMANDS.INIT:
      updateStatus('Received INIT command');
      console.log('🎯 [WEBVIEW] Received INIT command', message);
      if (message.config) {
        updateStatus('Initializing terminal UI');
        console.log('🎯 [WEBVIEW] Initializing simple terminal');
        terminalManager.initializeSimpleTerminal();

        // Set active terminal ID
        if (message.activeTerminalId) {
          terminalManager.setActiveTerminalId(message.activeTerminalId);
          console.log('🎯 [WEBVIEW] Set active terminal ID:', message.activeTerminalId);
        }

        // Wait for terminal container to be available
        const checkContainerAndCreate = (): void => {
          updateStatus('Checking terminal container availability');
          console.log('🎯 [WEBVIEW] Checking terminal container...');
          console.log('🎯 [WEBVIEW] Container available:', !!terminalManager.terminalContainer);

          if (terminalManager.terminalContainer) {
            updateStatus('Creating initial terminal');
            console.log('🎯 [WEBVIEW] Creating initial terminal');
            const terminalId = message.activeTerminalId || 'terminal-initial';

            try {
              if (message.config) {
                terminalManager.createTerminal(terminalId, 'Terminal 1', message.config);
              } else {
                throw new Error('No terminal config provided');
              }

              // Initialize split controls after terminal is ready
              terminalManager.initializeSplitControls();

              updateStatus('Terminal ready');
              console.log('🎯 [WEBVIEW] Terminal initialization completed');
            } catch (error) {
              console.error('❌ [WEBVIEW] Error during terminal creation:', error);
              updateStatus(`ERROR: ${String(error)}`, 'error');
            }
          } else {
            console.log('🎯 [WEBVIEW] Container not ready, waiting...');
            updateStatus('Waiting for container...');
            setTimeout(checkContainerAndCreate, 50);
          }
        };

        setTimeout(checkContainerAndCreate, 10);
      } else {
        updateStatus('ERROR: No config');
        console.error('❌ [WEBVIEW] No config provided in INIT message');
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.OUTPUT:
      if (message.data) {
        console.log(
          '📥 [WEBVIEW] Received output data:',
          message.data.length,
          'chars:',
          JSON.stringify(message.data.substring(0, 50)),
          'terminalId:',
          message.terminalId
        );

        // Route output to correct terminal
        if (
          message.terminalId === terminalManager.secondaryTerminalId &&
          terminalManager.secondaryTerminal
        ) {
          terminalManager.writeToSecondaryTerminal(message.data);
        } else {
          terminalManager.writeToTerminal(message.data);
        }
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.CLEAR:
      terminalManager.clearTerminal();
      break;

    case TERMINAL_CONSTANTS.COMMANDS.EXIT:
      if (message.exitCode !== undefined) {
        terminalManager.writeToTerminal(
          `\r\n[Process exited with code ${message.exitCode ?? 'unknown'}]\r\n`
        );
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.SPLIT:
      console.log('🔀 [WEBVIEW] Received SPLIT command');
      // Default to vertical split (top/bottom)
      terminalManager.splitTerminal('vertical');
      break;

    case TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED:
      if (message.terminalId && message.terminalName && message.config) {
        // If we're in split mode and this is a new terminal, treat it as secondary
        if (
          terminalManager.isSplitMode &&
          !terminalManager.secondaryTerminal &&
          message.terminalId !== terminalManager.activeTerminalId
        ) {
          console.log('🔀 [WEBVIEW] Creating secondary terminal in split mode');
          terminalManager.createSecondaryTerminal(
            message.terminalId,
            message.terminalName,
            message.config
          );
        } else {
          terminalManager.createTerminal(message.terminalId, message.terminalName, message.config);
        }

        // Update terminal count badge after creating terminal
        terminalManager.updateTerminalCountBadge();
      }
      break;

    case 'settingsResponse':
      if (message.settings) {
        console.log('⚙️ [WEBVIEW] Received settings from extension:', message.settings);
        terminalManager.populateSettingsForm(message.settings);
      }
      break;

    case 'openSettings':
      console.log('⚙️ [WEBVIEW] Received openSettings command from panel');
      terminalManager.openSettingsPanel();
      break;

    case TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED:
      if (message.terminalId) {
        console.log('🗑️ [WEBVIEW] Received terminal removal command for:', message.terminalId);
        terminalManager.closeTerminal(message.terminalId);

        // Update terminal count badge after removing terminal
        terminalManager.updateTerminalCountBadge();
      }
      break;

    default:
      console.warn('⚠️ [WEBVIEW] Unknown command received:', message.command);
  }
});

// Status Manager for auto-hide functionality with layout adjustment
class StatusManager {
  private statusElement: HTMLElement | null = null;
  private hideTimer: number | null = null;
  private readonly DEFAULT_DISPLAY_DURATION = 3000; // 3 seconds
  private readonly ERROR_DISPLAY_DURATION = 5000; // 5 seconds for errors
  private lastMessage = '';
  private lastType: 'info' | 'success' | 'error' = 'info';
  private isStatusVisible = false;
  private readonly STATUS_HEIGHT = 24; // Status bar height in pixels
  private layoutAdjustTimer: NodeJS.Timeout | null = null;

  public showStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.lastMessage = message;
    this.lastType = type;

    // Get or create status element
    const statusEl = this.getOrCreateStatusElement();
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;

    // Show status with animation
    this.showStatusElement();

    // Adjust terminal layout to accommodate status
    this.adjustTerminalLayout(true);

    // Clear existing timer
    this.clearTimer();

    // Check if auto-hide is enabled (for now, always true - will read from settings later)
    const autoHide = true;
    if (autoHide) {
      // Set timer based on message type
      const duration =
        type === 'error' ? this.ERROR_DISPLAY_DURATION : this.DEFAULT_DISPLAY_DURATION;

      this.hideTimer = window.setTimeout(() => {
        this.hideStatusWithAnimation();
      }, duration);
    }

    console.log(`🎯 [WEBVIEW] [${type.toUpperCase()}]`, message);
  }

  public hideStatus(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
    }
    this.clearTimer();
  }

  private hideStatusWithAnimation(): void {
    if (this.statusElement) {
      // Fade out animation
      this.statusElement.style.opacity = '0';
      this.statusElement.style.transform = 'translateY(-100%)';

      // Hide after animation completes and adjust layout
      setTimeout(() => {
        this.hideStatusElement();
        this.adjustTerminalLayout(false);
      }, 300);
    }
    this.clearTimer();
  }

  public showLastStatusOnActivity(): void {
    if (this.lastMessage && this.statusElement?.style.display === 'none') {
      console.log('📱 [STATUS] Showing status due to user activity');
      this.showStatus(this.lastMessage, this.lastType);
    }
  }

  private getOrCreateStatusElement(): HTMLElement {
    if (!this.statusElement) {
      this.statusElement = document.getElementById('status');
      if (this.statusElement) {
        this.setupStatusInteraction();
        this.addStatusStyles();
      }
    }
    return this.statusElement || document.createElement('div');
  }

  private setupStatusInteraction(): void {
    if (this.statusElement) {
      // Mouse hover stops the timer
      this.statusElement.addEventListener('mouseenter', () => {
        this.clearTimer();
      });

      // Mouse leave restarts timer (shorter duration)
      this.statusElement.addEventListener('mouseleave', () => {
        this.hideTimer = window.setTimeout(() => {
          this.hideStatusWithAnimation();
        }, 1000); // 1 second after mouse leaves
      });

      // Click to immediately hide
      this.statusElement.addEventListener('click', () => {
        this.hideStatusWithAnimation();
      });
    }
  }

  private addStatusStyles(): void {
    // Add status styling if not already added
    if (!document.getElementById('status-styles')) {
      const style = document.createElement('style');
      style.id = 'status-styles';
      style.textContent = `
        .status {
          transition: opacity 0.3s ease, transform 0.3s ease;
          cursor: pointer;
        }
        .status-info {
          background: var(--vscode-statusBar-background, #007acc);
          color: var(--vscode-statusBar-foreground, #ffffff);
        }
        .status-success {
          background: var(--vscode-statusBarItem-prominentBackground, #16825d);
          color: var(--vscode-statusBarItem-prominentForeground, #ffffff);
        }
        .status-error {
          background: var(--vscode-errorBackground, #f14c4c);
          color: var(--vscode-errorForeground, #ffffff);
        }
        .status:hover {
          opacity: 0.8;
        }

        /* Layout adjustment styles */
        #terminal-body {
          transition: height 0.3s ease-out;
          overflow: hidden;
        }

        .split-terminal-container {
          transition: height 0.3s ease-out;
        }

        /* Status bar positioning */
        .status {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 24px;
          z-index: 1000;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private clearTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private showStatusElement(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'block';
      this.statusElement.style.opacity = '1';
      this.statusElement.style.transform = 'translateY(0)';
      this.isStatusVisible = true;
    }
  }

  private hideStatusElement(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
      this.isStatusVisible = false;

      // Reset styles for next show
      this.statusElement.style.opacity = '1';
      this.statusElement.style.transform = 'translateY(0)';
    }
  }

  private adjustTerminalLayout(statusVisible: boolean): void {
    console.log(`📐 [LAYOUT] Adjusting terminal layout, status visible: ${statusVisible}`);

    const terminalContainer = document.getElementById('terminal');
    const terminalBody = document.getElementById('terminal-body');
    const terminalHeader = document.getElementById('terminal-header');

    if (!terminalContainer || !terminalBody) {
      console.warn('⚠️ [LAYOUT] Terminal containers not found');
      return;
    }

    // Calculate container height
    const containerHeight = terminalContainer.clientHeight;
    const headerHeight = terminalHeader ? terminalHeader.clientHeight : 32;
    const statusHeight = statusVisible ? this.STATUS_HEIGHT : 0;

    // Calculate available height for terminal body
    const availableHeight = containerHeight - headerHeight - statusHeight;

    // Adjust terminal body height
    terminalBody.style.height = `${availableHeight}px`;

    // Adjust split containers if present
    this.adjustSplitContainersHeight(availableHeight);

    // Resize all terminal instances
    this.resizeAllTerminals();

    console.log(`✅ [LAYOUT] Terminal layout adjusted: ${availableHeight}px available`);
  }

  private adjustSplitContainersHeight(availableHeight: number): void {
    const splitContainers = document.querySelectorAll('.split-terminal-container');
    if (splitContainers.length > 0) {
      console.log(`📐 [LAYOUT] Adjusting ${splitContainers.length} split containers`);

      // Recalculate height for each split terminal
      const splitCount = splitContainers.length;
      const splitterHeight = 4;
      const totalSplitterHeight = (splitCount - 1) * splitterHeight;
      const terminalHeight = Math.floor((availableHeight - totalSplitterHeight) / splitCount);

      splitContainers.forEach((container) => {
        (container as HTMLElement).style.height = `${terminalHeight}px`;
      });
    }
  }

  private resizeAllTerminals(): void {
    // Resize main terminal
    if (terminalManager.terminal && terminalManager.fitAddon) {
      setTimeout(() => {
        terminalManager.fitAddon?.fit();
      }, 100);
    }

    // Resize secondary terminal
    if (terminalManager.secondaryTerminal && terminalManager.secondaryFitAddon) {
      setTimeout(() => {
        terminalManager.secondaryFitAddon?.fit();
      }, 100);
    }

    // Resize multiple terminals
    terminalManager.terminals.forEach((terminalData) => {
      if (terminalData.fitAddon) {
        setTimeout(() => {
          terminalData.fitAddon.fit();
        }, 100);
      }
    });
  }

  public initializeLayoutManagement(): void {
    // Setup resize observer for dynamic layout adjustment
    this.setupLayoutResizeObserver();

    // Handle window resize events
    window.addEventListener('resize', () => {
      // Debounced layout adjustment
      if (this.layoutAdjustTimer) {
        clearTimeout(this.layoutAdjustTimer);
      }
      this.layoutAdjustTimer = setTimeout(() => {
        this.adjustTerminalLayout(this.isStatusVisible);
      }, 150);
    });

    console.log('📐 [LAYOUT] Layout management initialized');
  }

  private setupLayoutResizeObserver(): void {
    const terminalContainer = document.getElementById('terminal');
    if (!terminalContainer) return;

    const resizeObserver = new ResizeObserver((_entries) => {
      console.log('📐 [LAYOUT] Container resized, readjusting layout');

      // Maintain status display state during layout adjustment
      this.adjustTerminalLayout(this.isStatusVisible);
    });

    resizeObserver.observe(terminalContainer);
    console.log('📐 [LAYOUT] Layout resize observer set up');
  }
}

// Add method declarations to the TerminalWebviewManager interface
declare global {
  interface TerminalWebviewManager {
    createWebViewHeader(): void;
    updateTerminalCountBadge(): void;
  }
}

// WebView Header Management for TerminalWebviewManager
TerminalWebviewManager.prototype.createWebViewHeader = function (
  this: TerminalWebviewManager
): void {
  console.log('🎯 [WEBVIEW] Creating WebView header');

  // Check if header should be shown (user setting)
  const showHeader = true; // TODO: Get from configuration
  if (!showHeader) {
    console.log('🎯 [WEBVIEW] WebView header disabled by configuration');
    return;
  }

  // Remove existing header if present
  if (this.headerElement) {
    this.headerElement.remove();
    this.headerElement = null;
  }

  // Create header container
  this.headerElement = document.createElement('div');
  this.headerElement.id = 'webview-header';
  this.headerElement.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: var(--vscode-titleBar-activeBackground, #3c3c3c);
    border-bottom: 1px solid var(--vscode-titleBar-border, #454545);
    color: var(--vscode-titleBar-activeForeground, #cccccc);
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
    min-height: 28px;
    flex-shrink: 0;
  `;

  // Create title section inline
  const titleSection = document.createElement('div');
  titleSection.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  `;

  // Terminal icon
  const terminalIcon = document.createElement('span');
  terminalIcon.textContent = '🖥️';
  terminalIcon.style.cssText = `
    font-size: 12px;
    opacity: 0.8;
  `;

  // Title text
  const titleText = document.createElement('span');
  titleText.textContent = 'Terminal';
  titleText.style.cssText = `
    font-weight: 500;
    letter-spacing: 0.02em;
  `;

  // Terminal count badge
  const countBadge = document.createElement('span');
  countBadge.id = 'terminal-count-badge';
  countBadge.style.cssText = `
    background: var(--vscode-badge-background, #007acc);
    color: var(--vscode-badge-foreground, #ffffff);
    border-radius: 10px;
    padding: 1px 6px;
    font-size: 9px;
    font-weight: 600;
    min-width: 16px;
    text-align: center;
    line-height: 16px;
  `;

  titleSection.appendChild(terminalIcon);
  titleSection.appendChild(titleText);
  titleSection.appendChild(countBadge);

  // Create sample icons section (display only)
  const commandSection = document.createElement('div');
  commandSection.className = 'sample-icons';
  commandSection.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
  `;

  // Check if sample icons should be shown (TODO: Read from settings)
  const showSampleIcons = true; // TODO: Get from configuration
  const sampleIconOpacity = 0.4; // TODO: Get from configuration

  if (showSampleIcons) {
    // Sample icons for display only (no functionality)
    const sampleIcons = [
      { icon: '➕', title: 'New Terminal (Use panel button)' },
      { icon: '⫶', title: 'Split Terminal (Use panel button)' },
      { icon: '🧹', title: 'Clear Terminal (Use panel button)' },
      { icon: '🗑️', title: 'Kill Terminal (Use panel button)' },
      { icon: '⚙️', title: 'Settings (Use panel button)' },
    ];

    sampleIcons.forEach((sample) => {
      const iconElement = document.createElement('div'); // Use div instead of button
      iconElement.className = 'sample-icon';
      iconElement.textContent = sample.icon;
      iconElement.title = sample.title;
      iconElement.style.cssText = `
        background: transparent;
        color: var(--vscode-descriptionForeground, #969696);
        font-size: 12px;
        padding: 4px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        opacity: ${sampleIconOpacity};
        cursor: default;
        user-select: none;
        filter: grayscale(30%);
      `;

      // Subtle hover effect to show it's non-interactive
      iconElement.addEventListener('mouseenter', () => {
        iconElement.style.opacity = '0.6';
      });

      iconElement.addEventListener('mouseleave', () => {
        iconElement.style.opacity = '0.4';
      });

      commandSection.appendChild(iconElement);
    });

    // Add help tooltip
    const helpTooltip = document.createElement('div');
    helpTooltip.className = 'help-tooltip';
    helpTooltip.style.cssText = `
    position: absolute;
    bottom: -35px;
    right: 0;
    background: var(--vscode-tooltip-background, #2c2c2c);
    border: 1px solid var(--vscode-tooltip-border, #454545);
    border-radius: 3px;
    padding: 6px 8px;
    font-size: 10px;
    color: var(--vscode-tooltip-foreground, #cccccc);
    white-space: nowrap;
    z-index: 1001;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  `;
    helpTooltip.innerHTML = `
    <div style="display: flex; align-items: center; gap: 4px;">
      <span>📌</span>
      <span>Sample Icons (Display Only)</span>
    </div>
    <div style="margin-top: 2px; color: var(--vscode-descriptionForeground, #969696);">
      Use VS Code panel buttons for actions
    </div>
  `;

    // Show tooltip on hover
    commandSection.addEventListener('mouseenter', () => {
      helpTooltip.style.opacity = '1';
    });

    commandSection.addEventListener('mouseleave', () => {
      helpTooltip.style.opacity = '0';
    });

    commandSection.appendChild(helpTooltip);
  }

  // Assemble header
  this.headerElement.appendChild(titleSection);
  this.headerElement.appendChild(commandSection);

  // Insert header at the top of the main container
  const mainContainer = document.getElementById('terminal');
  if (mainContainer && mainContainer.firstChild) {
    mainContainer.insertBefore(this.headerElement, mainContainer.firstChild);
  } else if (mainContainer) {
    mainContainer.appendChild(this.headerElement);
  }

  console.log('✅ [WEBVIEW] WebView header created successfully');
};

TerminalWebviewManager.prototype.updateTerminalCountBadge = function (
  this: TerminalWebviewManager
): void {
  const badge = document.getElementById('terminal-count-badge');
  if (!badge) {
    return;
  }

  // Count active terminals
  const terminalTabs = document.getElementById('terminal-tabs');
  const terminalCount = terminalTabs ? terminalTabs.childElementCount : 0;

  badge.textContent = terminalCount.toString();

  // Update badge color based on count
  let backgroundColor = 'var(--vscode-badge-background, #007acc)';
  if (terminalCount === 0) {
    backgroundColor = 'var(--vscode-errorBackground, #f14c4c)';
  } else if (terminalCount >= 5) {
    backgroundColor = 'var(--vscode-notificationWarning-background, #ffcc02)';
  } else if (terminalCount >= 3) {
    backgroundColor = 'var(--vscode-charts-orange, #ff8c00)';
  }

  badge.style.background = backgroundColor;

  console.log(`🎯 [WEBVIEW] Terminal count badge updated: ${terminalCount}`);
};

// Global status manager instance
const statusManager = new StatusManager();

// Initialize layout management
statusManager.initializeLayoutManagement();

// Enhanced update status function with auto-hide
function updateStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  statusManager.showStatus(message, type);
}

// Setup activity listeners for status re-display
function setupActivityListeners(): void {
  // Keyboard activity
  document.addEventListener('keydown', () => {
    statusManager.showLastStatusOnActivity();
  });

  // Mouse activity (excluding status element clicks)
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement)?.closest('.status')) {
      statusManager.showLastStatusOnActivity();
    }
  });

  // Focus events
  window.addEventListener('focus', () => {
    statusManager.showLastStatusOnActivity();
  });

  console.log('📱 [WEBVIEW] Activity listeners set up for status re-display');
}

// ESC key to hide status immediately
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    statusManager.hideStatus();
  }
});

// Notify extension that webview is ready
console.log('🎯 [WEBVIEW] Webview script starting...');
updateStatus('Webview script loaded');

// Initialize activity listeners
setupActivityListeners();

function sendReadyMessage(): void {
  console.log('🎯 [WEBVIEW] Sending READY message to extension');
  updateStatus('Sending ready message to extension');
  try {
    vscode.postMessage({ command: 'ready' as const });
    console.log('✅ [WEBVIEW] READY message sent successfully');
    updateStatus('Ready message sent, waiting for response...');
  } catch (error) {
    console.error('❌ [WEBVIEW] Failed to send READY message:', error);
    updateStatus(`ERROR sending ready: ${String(error)}`);
  }
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  console.log('🎯 [WEBVIEW] DOM is loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 [WEBVIEW] DOMContentLoaded event fired');
    updateStatus('DOM loaded, sending ready message');
    sendReadyMessage();
  });
} else {
  console.log('🎯 [WEBVIEW] DOM is already ready');
  updateStatus('DOM ready, sending ready message');
  sendReadyMessage();
}
