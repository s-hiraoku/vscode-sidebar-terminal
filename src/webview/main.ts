/**
 * リファクタリング後のWebViewメインエントリーポイント
 */
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

// Types and constants
import type {
  WebviewMessage,
  VsCodeMessage,
  TerminalConfig,
  TerminalSettings,
  ClaudeCodeState,
  AltClickState,
  TerminalInteractionEvent,
} from '../types/common';
import { webview as log } from '../utils/logger';
import { WEBVIEW_TERMINAL_CONSTANTS, SPLIT_CONSTANTS } from './constants/webview';
import { getWebviewTheme, WEBVIEW_THEME_CONSTANTS } from './utils/WebviewThemeUtils';
import { SplitManager } from './managers/SplitManager';
import { SettingsPanel } from './components/SettingsPanel';
import {
  showTerminalKillError,
  showTerminalCloseError,
  showClaudeCodeDetected,
  showClaudeCodeEnded,
  showAltClickDisabledWarning as _showAltClickDisabledWarning,
  showTerminalInteractionIssue as _showTerminalInteractionIssue,
} from './utils/NotificationUtils';

// Type definitions
interface TerminalMessage extends WebviewMessage {
  terminalId?: string;
  terminalName?: string;
  data?: string;
  config?: TerminalConfig;
  activeTerminalId?: string;
  exitCode?: number;
  settings?: {
    fontSize: number;
    fontFamily: string;
    theme?: string;
    cursorBlink: boolean;
  };
}

declare const acquireVsCodeApi: () => {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

// Main terminal management class
class TerminalWebviewManager {
  public terminal: Terminal | null = null;
  public fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;
  private isComposing: boolean = false;
  public activeTerminalId: string | null = null;

  // Performance optimization: Buffer output and batch writes
  private outputBuffer: string[] = [];
  private bufferFlushTimer: number | null = null;
  private readonly BUFFER_FLUSH_INTERVAL = SPLIT_CONSTANTS.BUFFER_FLUSH_INTERVAL;
  private readonly MAX_BUFFER_SIZE = SPLIT_CONSTANTS.MAX_BUFFER_SIZE;

  // Performance optimization: Debounce resize operations
  private resizeDebounceTimer: number | null = null;
  private readonly RESIZE_DEBOUNCE_DELAY = SPLIT_CONSTANTS.RESIZE_DEBOUNCE_DELAY;

  // Managers
  private splitManager: SplitManager;
  private settingsPanel: SettingsPanel;

  // Current settings
  private currentSettings: TerminalSettings = {
    fontSize: 14,
    fontFamily: 'Consolas, monospace',
    theme: 'auto',
    cursorBlink: true,
    altClickMovesCursor: true,
    multiCursorModifier: 'alt',
  };

  // Claude Code detection and Alt+Click control
  private claudeCodeState: ClaudeCodeState = {
    isActive: false,
  };

  private altClickState: AltClickState = {
    isEnabled: true,
    isTemporarilyDisabled: false,
  };

  // Claude Code detection patterns
  private readonly CLAUDE_CODE_PATTERNS = [
    /claude/i,
    /\[agent\]/i,
    /\[tool\]/i,
    /\[thinking\]/i,
    /anthropic/i,
    /ai\s*assistant/i,
  ];

  // Output monitoring for Claude Code detection
  private outputMonitoringInterval: number | null = null;
  private recentOutputVolume = 0;
  private lastOutputTime = 0;

  constructor() {
    this.splitManager = new SplitManager();
    this.settingsPanel = new SettingsPanel({
      onSettingsChange: (settings) => {
        this.applySettings(settings);
      },
    });

    // Load settings from VS Code state if available
    this.loadSettings();
  }

  public initializeSimpleTerminal(): void {
    const container = document.getElementById('terminal-body');
    if (!container) {
      log('Terminal container not found');
      return;
    }

    log('🎯 [WEBVIEW] Initializing simple terminal');

    // Use the existing terminal-body container
    this.terminalContainer = container;

    // Add terminal container class for border styling
    container.className = 'terminal-container';
    container.setAttribute('data-terminal-id', 'primary');

    // Style the container
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      background: #000;
      width: 100%;
      height: 100%;
      overflow: hidden;
      margin: 0;
      padding: 0;
      gap: 0;
      border: 1px solid transparent;
      transition: border-color 0.2s ease-in-out;
    `;

    // Add placeholder content
    container.innerHTML = `
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
    `;

    if (this.terminalContainer) {
      log('🎯 [WEBVIEW] Simple terminal container initialized successfully');
    } else {
      log('❌ [WEBVIEW] Failed to initialize terminal container');
    }

    // Setup IME support
    this.setupIMEHandling();

    // Setup Alt key visual feedback (VS Code standard)
    this.setupAltKeyVisualFeedback();
  }

  public createTerminal(id: string, name: string, _config: TerminalConfig): void {
    this.setActiveTerminalId(id);
    log('🎯 [WEBVIEW] Creating terminal:', id, name);

    if (!this.terminalContainer) {
      // Try to get the container again
      this.terminalContainer = document.getElementById('terminal-body');
      if (!this.terminalContainer) {
        log('❌ [WEBVIEW] No terminal container available');
        return;
      }
      log('🎯 [WEBVIEW] Terminal container found on retry');
    }

    try {
      const terminalTheme = getWebviewTheme();
      log('🎨 [WEBVIEW] Creating terminal with theme:', terminalTheme);

      // Apply current settings to new terminal
      const terminalOptions = {
        fontSize: this.currentSettings.fontSize,
        fontFamily: this.currentSettings.fontFamily,
        theme:
          this.currentSettings.theme === 'auto'
            ? terminalTheme
            : this.currentSettings.theme === 'dark'
              ? WEBVIEW_THEME_CONSTANTS.DARK_THEME
              : WEBVIEW_THEME_CONSTANTS.LIGHT_THEME,
        cursorBlink: this.currentSettings.cursorBlink,
        allowTransparency: true,
        scrollback: 10000,
        // VS Code standard: Enable Alt+Click cursor positioning
        altClickMovesCursor: this.isVSCodeAltClickEnabled(),
      };

      const terminal = new Terminal(terminalOptions);

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      // Clear placeholder
      const placeholder = document.getElementById('terminal-placeholder');
      if (placeholder) {
        placeholder.remove();
      }

      // Create terminal container div - unified logic for all terminals
      const terminalDiv = document.createElement('div');
      terminalDiv.setAttribute('data-terminal-container', 'terminal');
      terminalDiv.setAttribute('data-terminal-id', id);
      terminalDiv.id = `terminal-container-${id}`;
      terminalDiv.className = 'terminal-container';
      terminalDiv.tabIndex = -1; // Make focusable

      // Set split mode if this is the second terminal
      if (this.splitManager.getTerminals().size >= 1 && !this.splitManager.getIsSplitMode()) {
        this.splitManager.prepareSplitMode('vertical');
      }

      // Add to DOM first
      this.terminalContainer.appendChild(terminalDiv);

      // Register the container with split manager
      this.splitManager.getTerminalContainers().set(id, terminalDiv);

      // Apply flex-based styling to the new terminal
      terminalDiv.style.cssText = `
        width: 100%; 
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        margin: 0;
        padding: 2px;
        min-height: 100px;
        border: none;
        outline: none;
      `;
      log(`📐 [MAIN] Applied flex layout for terminal ${id}`);

      // CRITICAL: Apply flex layout to ALL terminals IMMEDIATELY (before terminal.open)
      log(
        `📐 [MAIN] Applying flex layout to all ${this.splitManager.getTerminalContainers().size} terminals IMMEDIATELY`
      );

      this.splitManager.getTerminalContainers().forEach((container, terminalId) => {
        container.style.cssText = `
          width: 100%; 
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin: 0;
          padding: 2px;
          min-height: 100px;
          border: none;
          outline: none;
        `;

        log(`📐 [MAIN] Applied flex layout to terminal ${terminalId}`);

        // Add click event if not already added
        if (!container.hasAttribute('data-click-handler')) {
          container.setAttribute('data-click-handler', 'true');
          container.addEventListener('click', () => {
            log(
              `🖱️ [CLICK] Terminal clicked: ${terminalId}, current active: ${this.activeTerminalId}`
            );

            // Always ensure the clicked terminal gets focus, even if it's already active
            this.ensureTerminalFocus(terminalId);

            // Switch terminals if different terminal is clicked
            if (this.activeTerminalId !== terminalId) {
              this.switchToTerminal(terminalId);
            }
          });
        }
      });

      // Force layout recalculation BEFORE opening terminal
      this.splitManager.getTerminalContainers().forEach((container) => {
        container.offsetHeight; // Force reflow
      });
      log(
        `📐 [MAIN] Forced layout recalculation for all ${this.splitManager.getTerminalContainers().size} containers`
      );

      const targetContainer = terminalDiv;

      // Open terminal AFTER flex layout is applied
      setTimeout(() => {
        try {
          log(`🎨 [MAIN] Opening terminal ${id} after flex layout applied`);
          terminal.open(targetContainer);

          // Wait longer for DOM and flex layout to fully stabilize before fitting
          setTimeout(() => {
            // Force layout recalculation before fit
            targetContainer.offsetHeight; // Trigger reflow

            const terminalBody = document.getElementById('terminal-body');
            const terminalMain = document.getElementById('terminal');

            log(`🔧 [MAIN] Hierarchy sizes before fit:`, {
              terminal: terminalMain
                ? { w: terminalMain.offsetWidth, h: terminalMain.offsetHeight }
                : 'not found',
              terminalBody: terminalBody
                ? { w: terminalBody.offsetWidth, h: terminalBody.offsetHeight }
                : 'not found',
              targetContainer: { w: targetContainer.offsetWidth, h: targetContainer.offsetHeight },
              containerStyle: targetContainer.style.cssText,
              terminalCount: this.splitManager.getTerminalContainers().size,
            });

            fitAddon.fit();
            terminal.refresh(0, terminal.rows - 1);
            terminal.focus();

            // Add click event to xterm.js terminal area for reliable focus handling
            this.addXtermClickHandler(terminal, id, targetContainer);

            // Only set as main terminal if it's the first one or not in split mode
            if (!this.splitManager.getIsSplitMode() || !this.terminal) {
              this.terminal = terminal;
              this.fitAddon = fitAddon;
            }

            // Switch to the newly created terminal
            this.switchToTerminal(id);

            // Re-fit ALL terminals to ensure consistent sizing
            setTimeout(() => {
              log(`🔧 [MAIN] Re-fitting ALL terminals for consistency`);
              this.splitManager.getTerminals().forEach((terminalData, terminalId) => {
                if (terminalData.fitAddon) {
                  const container = this.splitManager.getTerminalContainers().get(terminalId);
                  if (container) {
                    container.offsetHeight; // Force reflow
                    terminalData.fitAddon.fit();
                    log(
                      `🔧 [MAIN] Re-fitted terminal ${terminalId}, size: ${container.offsetWidth}x${container.offsetHeight}`
                    );
                  }
                }
              });
            }, 200);
          }, 500); // Increased delay for flex layout stabilization
        } catch (openError) {
          log('❌ [WEBVIEW] Error opening terminal:', openError);
        }
      }, 100);

      // Handle terminal input with IME support
      terminal.onData((data) => {
        // Don't block IME input - let xterm.js handle it naturally
        log('🌐 [INPUT] Terminal data received:', {
          data: data,
          length: data.length,
          isComposing: this.isComposing,
          charCodes: Array.from(data).map((c) => c.charCodeAt(0)),
        });

        vscode.postMessage({
          command: 'input' as const,
          data,
          terminalId: this.activeTerminalId || id,
        });
      });

      // Handle terminal focus events for border updates
      // Note: xterm.js doesn't have onFocus, we'll handle focus via DOM events
      terminalDiv.addEventListener('focus', () => {
        log(`🔵 [FOCUS] Terminal ${id} received focus - updating borders`);
        this.setActiveTerminalId(id);
      }, true);

      // Handle resize
      terminal.onResize((size) => {
        vscode.postMessage({
          command: 'resize' as const,
          cols: size.cols,
          rows: size.rows,
          terminalId: id,
        });
      });

      // Store terminal instance
      this.splitManager.setTerminal(id, {
        terminal,
        fitAddon,
        name,
        container: terminalDiv,
      });

      // Set this terminal as active and update borders
      this.setActiveTerminalId(id);

      // Performance optimization: Use debounced resize observer
      if (this.terminalContainer) {
        const resizeObserver = new ResizeObserver(() => {
          if (this.fitAddon && this.terminal) {
            this.debouncedResize(this.terminal.cols, this.terminal.rows);
          }
        });
        resizeObserver.observe(this.terminalContainer);
      }
    } catch (error) {
      log('❌ [WEBVIEW] Error creating terminal:', error);
    }
  }

  public switchToTerminal(id: string): void {
    log('🔄 [WEBVIEW] Switching to terminal:', id);

    this.setActiveTerminalId(id);

    // Apply consistent flex styling to all terminals
    this.splitManager.getTerminalContainers().forEach((container, _terminalId) => {
      container.style.cssText = `
        width: 100%; 
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-height: 100px;
        margin: 0;
        padding: 2px;
        border: none;
        outline: none;
      `;
    });

    // Focus the active terminal and ensure proper fit
    const terminalData = this.splitManager.getTerminals().get(id);
    if (terminalData?.terminal) {
      // Apply immediate focus first
      try {
        terminalData.terminal.focus();
        log(`🎯 [SWITCH] Immediate focus applied to terminal ${id}`);
      } catch (error) {
        log(`⚠️ [SWITCH] Error applying immediate focus to terminal ${id}:`, error);
      }

      // Wait for CSS updates to be applied, then apply delayed focus and fit
      setTimeout(() => {
        const container = this.splitManager.getTerminalContainers().get(id);
        if (container) {
          // Force layout recalculation
          container.offsetHeight;

          log(`🔧 [SWITCH] Container size for terminal ${id}:`, {
            width: container.offsetWidth,
            height: container.offsetHeight,
          });
        }

        // Re-apply focus after layout changes
        try {
          terminalData.terminal.focus();
          if (terminalData.fitAddon) {
            terminalData.fitAddon.fit();
            log(`🔧 [SWITCH] Delayed focus and fit applied for terminal ${id}`);
          }
        } catch (error) {
          log(`⚠️ [SWITCH] Error applying delayed focus to terminal ${id}:`, error);
        }
      }, 50);
    }

    log('✅ [WEBVIEW] Switched to terminal:', id);
  }

  public closeTerminal(id?: string): void {
    // According to the spec: always kill the ACTIVE terminal, not the specified one
    const activeTerminalId = this.activeTerminalId;
    log(
      '🗑️ [WEBVIEW] Close terminal requested for:',
      id,
      'but will close active terminal:',
      activeTerminalId
    );

    if (!activeTerminalId) {
      log('⚠️ [WEBVIEW] No active terminal to close');
      showTerminalKillError('No active terminal to close');
      return;
    }

    // Check if this is a safe kill attempt using the ACTIVE terminal
    if (!this.canKillTerminal(activeTerminalId)) {
      return;
    }

    this.performKillTerminal(activeTerminalId);
  }

  // Track terminals being closed to prevent double processing
  private terminalsBeingClosed = new Set<string>();

  private canKillTerminal(id: string): boolean {
    // Prevent double processing
    if (this.terminalsBeingClosed.has(id)) {
      log('🔄 [WEBVIEW] Terminal already being closed:', id);
      return false;
    }

    const terminalCount = this.splitManager.getTerminals().size;
    const minTerminalCount = 1;

    log('🔧 [WEBVIEW] canKillTerminal check:', {
      terminalId: id,
      terminalCount,
      minTerminalCount,
      activeTerminalId: this.activeTerminalId,
      beingClosed: Array.from(this.terminalsBeingClosed),
    });

    if (terminalCount <= minTerminalCount) {
      log('🛡️ [WEBVIEW] Cannot kill terminal - would go below minimum count');
      this.showLastTerminalWarning(minTerminalCount);
      return false;
    }

    return true;
  }

  private showLastTerminalWarning(minCount: number): void {
    showTerminalCloseError(minCount);
  }

  private performKillTerminal(id: string): void {
    log('🗑️ [WEBVIEW] Performing kill for terminal:', id);

    // Mark terminal as being closed
    this.terminalsBeingClosed.add(id);

    log('🗑️ [WEBVIEW] Current active terminal:', this.activeTerminalId);
    log(
      '🗑️ [WEBVIEW] Terminals before removal:',
      Array.from(this.splitManager.getTerminals().keys())
    );

    // Remove terminal instance
    const terminalData = this.splitManager.getTerminals().get(id);
    if (terminalData) {
      terminalData.terminal.dispose();
      this.splitManager.getTerminals().delete(id);
      log('🗑️ [WEBVIEW] Terminal instance removed:', id);
    }

    // Remove terminal container
    const container = this.splitManager.getTerminalContainers().get(id);
    if (container) {
      container.remove();
      this.splitManager.getTerminalContainers().delete(id);
      log('🗑️ [WEBVIEW] Terminal container removed:', id);
    }

    // Adjust remaining terminal layouts
    const remainingTerminals = Array.from(this.splitManager.getTerminals().keys());
    log('🗑️ [WEBVIEW] Remaining terminals:', remainingTerminals);

    // Update all remaining terminals to use flex layout
    log(`🗑️ [WEBVIEW] Updating ${remainingTerminals.length} remaining terminals with flex layout`);

    remainingTerminals.forEach((terminalId) => {
      const container = this.splitManager.getTerminalContainers().get(terminalId);
      if (container) {
        // Apply unified flex styling to all remaining terminals
        container.style.cssText = `
          width: 100%; 
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 100px;
          margin: 0;
          padding: 2px;
          border: none;
          outline: none;
        `;
        log(`🗑️ [WEBVIEW] Updated terminal ${terminalId} with flex layout`);
      }
    });

    // If this was the active terminal, switch to another one
    if (this.activeTerminalId === id) {
      if (remainingTerminals.length > 0) {
        const nextTerminalId = remainingTerminals[0];
        if (nextTerminalId) {
          this.switchToTerminal(nextTerminalId);
        }
      } else {
        this.activeTerminalId = null;
        this.showTerminalPlaceholder();
      }
    } else {
      // Update status for terminal closure
    }

    // Notify extension about terminal closure ONLY if terminal actually existed
    if (terminalData) {
      vscode.postMessage({
        command: 'terminalClosed',
        terminalId: id,
      });
      log('📤 [WEBVIEW] Sent terminalClosed message to extension for:', id);
    }

    log('✅ [WEBVIEW] Terminal closed:', id);
  }

  /**
   * Handle terminal removal notification from extension (UI cleanup only)
   */
  public handleTerminalRemovedFromExtension(id: string): void {
    log('🗑️ [WEBVIEW] Handling terminal removal from extension:', id);

    // Remove from being closed tracking (if it exists)
    this.terminalsBeingClosed.delete(id);

    // Check if terminal exists in webview
    const terminalData = this.splitManager.getTerminals().get(id);
    const container = this.splitManager.getTerminalContainers().get(id);

    if (!terminalData && !container) {
      log('🔄 [WEBVIEW] Terminal already removed from webview:', id);
      return;
    }

    // UI cleanup only (no extension communication)
    if (terminalData) {
      terminalData.terminal.dispose();
      this.splitManager.getTerminals().delete(id);
      log('🗑️ [WEBVIEW] Terminal instance cleaned up:', id);
    }

    if (container) {
      container.remove();
      this.splitManager.getTerminalContainers().delete(id);
      log('🗑️ [WEBVIEW] Terminal container cleaned up:', id);
    }

    // Update remaining terminals layout
    const remainingTerminals = Array.from(this.splitManager.getTerminals().keys());
    log('🗑️ [WEBVIEW] Remaining terminals after extension removal:', remainingTerminals);

    // Apply flex layout to remaining terminals
    remainingTerminals.forEach((terminalId) => {
      const terminalContainer = this.splitManager.getTerminalContainers().get(terminalId);
      if (terminalContainer) {
        terminalContainer.style.cssText = `
          width: 100%; 
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 100px;
          margin: 0;
          padding: 2px;
          border: none;
          outline: none;
        `;
      }
    });

    // Handle active terminal change
    if (this.activeTerminalId === id) {
      if (remainingTerminals.length > 0) {
        const nextTerminalId = remainingTerminals[0];
        if (nextTerminalId) {
          this.switchToTerminal(nextTerminalId);
        }
      } else {
        this.activeTerminalId = null;
        this.showTerminalPlaceholder();
      }
    }

    log('✅ [WEBVIEW] Terminal removal from extension handled:', id);
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

  public writeToTerminal(data: string, terminalId?: string): void {
    // Monitor output for Claude Code detection
    this.monitorTerminalOutput(data, terminalId);

    // Determine which terminal to write to
    let targetTerminal = this.terminal;

    // First, try to use the specified terminal ID
    if (terminalId) {
      const terminalData = this.splitManager.getTerminals().get(terminalId);
      if (terminalData) {
        targetTerminal = terminalData.terminal;
        log(`📤 [WEBVIEW] Writing to specified terminal: ${terminalId}`);
      } else {
        log(
          `⚠️ [WEBVIEW] Specified terminal not found: ${terminalId}, falling back to active terminal`
        );
      }
    }

    // If no terminal ID specified or terminal not found, use active terminal
    if (!targetTerminal || (!terminalId && this.activeTerminalId)) {
      if (this.activeTerminalId) {
        const terminalData = this.splitManager.getTerminals().get(this.activeTerminalId);
        if (terminalData) {
          targetTerminal = terminalData.terminal;
          log(`📤 [WEBVIEW] Writing to active terminal: ${this.activeTerminalId}`);
        }
      }
    }

    if (targetTerminal) {
      // If a specific terminal ID is provided, write directly to avoid cross-terminal buffering issues
      if (terminalId) {
        targetTerminal.write(data);
        log(`📤 [WEBVIEW] Direct write to terminal ${terminalId}: ${data.length} chars`);
      } else {
        // Use buffering only for active terminal (default behavior)
        // Enhanced buffering strategy for Claude Code compatibility
        const isLargeOutput = data.length >= 1000;
        const bufferFull = this.outputBuffer.length >= this.MAX_BUFFER_SIZE;
        const isClaudeCodeActive = this.claudeCodeState.isActive;
        const isModerateOutput = data.length >= 100; // Medium-sized chunks

        // Immediate flush conditions (prioritized for cursor accuracy)
        const shouldFlushImmediately =
          isLargeOutput || bufferFull || (isClaudeCodeActive && isModerateOutput);

        if (shouldFlushImmediately) {
          this.flushOutputBuffer();
          targetTerminal.write(data);
          const reason = isClaudeCodeActive
            ? 'Claude Code mode'
            : isLargeOutput
              ? 'large output'
              : 'buffer full';
          log(`📤 [WEBVIEW] Immediate write to active terminal: ${data.length} chars (${reason})`);
        } else {
          this.outputBuffer.push(data);
          this.scheduleBufferFlush();
          log(
            `📤 [WEBVIEW] Buffered write to active terminal: ${data.length} chars (buffer: ${this.outputBuffer.length}, Claude Code: ${isClaudeCodeActive})`
          );
        }
      }
    } else {
      log('⚠️ [WEBVIEW] No terminal instance to write to');
    }
  }

  private scheduleBufferFlush(): void {
    if (this.bufferFlushTimer === null) {
      // Dynamic flush interval based on Claude Code state and output frequency
      let flushInterval = this.BUFFER_FLUSH_INTERVAL; // Default 16ms

      if (this.claudeCodeState.isActive) {
        // Claude Code active: Use very aggressive flushing for cursor accuracy
        flushInterval = 4; // 4ms for Claude Code output
      } else if (this.outputBuffer.length > 5) {
        // High-frequency output: Use shorter interval
        flushInterval = 8; // 8ms for frequent output
      }

      this.bufferFlushTimer = window.setTimeout(() => {
        this.flushOutputBuffer();
      }, flushInterval);

      log(
        `📊 [BUFFER] Scheduled flush in ${flushInterval}ms (Claude Code: ${this.claudeCodeState.isActive}, buffer size: ${this.outputBuffer.length})`
      );
    }
  }

  private flushOutputBuffer(): void {
    if (this.bufferFlushTimer !== null) {
      window.clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    if (this.outputBuffer.length > 0) {
      const bufferedData = this.outputBuffer.join('');
      this.outputBuffer = [];

      // Write to active terminal
      let targetTerminal = this.terminal;
      if (this.activeTerminalId) {
        const terminalData = this.splitManager.getTerminals().get(this.activeTerminalId);
        if (terminalData) {
          targetTerminal = terminalData.terminal;
        }
      }

      if (targetTerminal) {
        targetTerminal.write(bufferedData);
      }
    }
  }

  /**
   * Monitor terminal output for Claude Code detection
   */
  private monitorTerminalOutput(data: string, terminalId?: string): void {
    const currentTime = Date.now();
    this.recentOutputVolume += data.length;
    this.lastOutputTime = currentTime;

    // Check for Claude Code patterns in the output
    const containsClaudeCodePattern = this.CLAUDE_CODE_PATTERNS.some((pattern) =>
      pattern.test(data)
    );

    // High-frequency output detection (potential Claude Code activity)
    const isHighFrequencyOutput =
      this.recentOutputVolume > 500 &&
      currentTime - (this.claudeCodeState.startTime || currentTime) < 2000;

    // Large output chunks (typical of Claude Code responses)
    const isLargeOutput = data.length >= 1000;

    if (containsClaudeCodePattern || isHighFrequencyOutput || isLargeOutput) {
      this.activateClaudeCodeMode(terminalId || this.activeTerminalId || '');
    }

    // Reset output volume periodically
    if (!this.outputMonitoringInterval) {
      this.outputMonitoringInterval = window.setTimeout(() => {
        this.recentOutputVolume = 0;
        this.outputMonitoringInterval = null;

        // Deactivate Claude Code mode if no recent activity
        if (currentTime - this.lastOutputTime > 3000 && this.claudeCodeState.isActive) {
          this.deactivateClaudeCodeMode();
        }
      }, 5000);
    }
  }

  /**
   * Activate Claude Code mode and temporarily disable Alt+Click via xterm.js
   */
  private activateClaudeCodeMode(terminalId: string): void {
    if (!this.claudeCodeState.isActive) {
      this.claudeCodeState = {
        isActive: true,
        terminalId,
        startTime: Date.now(),
        outputVolume: 0,
      };

      // VS Code approach: Disable Alt+Click at xterm.js level for performance
      this.setAltClickForAllTerminals(false);

      log('🤖 [CLAUDE-CODE] Claude Code mode activated, Alt+Click disabled via xterm.js');
      this.emitTerminalInteractionEvent('claude-code-start', terminalId);
      this.showClaudeCodeNotification(true);
    }

    // Update output volume
    this.claudeCodeState.outputVolume = (this.claudeCodeState.outputVolume || 0) + 1;
  }

  /**
   * Deactivate Claude Code mode and re-enable Alt+Click via xterm.js
   */
  private deactivateClaudeCodeMode(): void {
    if (this.claudeCodeState.isActive) {
      const terminalId = this.claudeCodeState.terminalId || '';

      this.claudeCodeState = {
        isActive: false,
      };

      // VS Code approach: Re-enable Alt+Click at xterm.js level
      this.setAltClickForAllTerminals(this.isVSCodeAltClickEnabled());

      log('🤖 [CLAUDE-CODE] Claude Code mode deactivated, Alt+Click re-enabled via xterm.js');
      this.emitTerminalInteractionEvent('claude-code-end', terminalId);
      this.showClaudeCodeNotification(false);
    }
  }

  /**
   * Set Alt+Click setting for all terminals at xterm.js level
   */
  private setAltClickForAllTerminals(enabled: boolean): void {
    // Update all existing terminals
    this.splitManager.getTerminals().forEach((terminalData, terminalId) => {
      if (terminalData.terminal && terminalData.terminal.options) {
        terminalData.terminal.options.altClickMovesCursor = enabled;
        log(`⌨️ [CLAUDE-CODE] Set Alt+Click for terminal ${terminalId}: ${enabled}`);
      }
    });

    // Update main terminal if it exists
    if (this.terminal && this.terminal.options) {
      this.terminal.options.altClickMovesCursor = enabled;
      log(`⌨️ [CLAUDE-CODE] Set Alt+Click for main terminal: ${enabled}`);
    }
  }

  /**
   * Show notification about Claude Code state
   */
  private showClaudeCodeNotification(isActive: boolean): void {
    if (isActive) {
      showClaudeCodeDetected();
    } else {
      showClaudeCodeEnded();
    }

    // Also show subtle notification in the terminal for immediate context
    const message = isActive
      ? 'Claude Code detected - Alt+Click temporarily disabled'
      : 'Claude Code ended - Alt+Click re-enabled';
    this.showNotificationInTerminal(message, isActive ? 'info' : 'success');
  }

  /**
   * Show notification in terminal overlay
   */
  private showNotificationInTerminal(message: string, type: 'info' | 'success' | 'warning'): void {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) return;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `claude-code-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 1000;
      max-width: 300px;
      opacity: 0.9;
      transition: opacity 0.3s ease;
      ${type === 'info' ? 'background: rgba(0, 122, 255, 0.8); color: white;' : ''}
      ${type === 'success' ? 'background: rgba(40, 167, 69, 0.8); color: white;' : ''}
      ${type === 'warning' ? 'background: rgba(255, 193, 7, 0.8); color: black;' : ''}
    `;

    // Remove existing notification
    const existingNotification = terminalBody.querySelector('.claude-code-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // Add new notification
    terminalBody.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  /**
   * Emit terminal interaction event for logging
   */
  private emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data?: unknown
  ): void {
    const event: TerminalInteractionEvent = {
      type,
      terminalId,
      timestamp: Date.now(),
      data,
    };

    log(`📊 [INTERACTION] Event: ${type}`, event);
  }

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

  // Split functionality methods
  public initializeSplitControls(): void {
    log('🔀 [WEBVIEW] Split controls ready (using panel commands)');
  }

  public prepareSplitMode(direction: 'horizontal' | 'vertical'): void {
    this.splitManager.prepareSplitMode(direction);
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    this.splitManager.splitTerminal(direction);
  }

  public addNewTerminalToSplit(terminalId: string, terminalName: string): void {
    this.splitManager.addNewTerminalToSplit(terminalId, terminalName);
  }

  private setupIMEHandling(): void {
    log('🌐 [WEBVIEW] Setting up IME handling - let xterm.js handle composition');

    // Let xterm.js handle IME composition natively
    // Only use compositionstart/end to track state, don't send data manually
    document.addEventListener('compositionstart', () => {
      this.isComposing = true;
      log('🌐 [IME] Composition started - blocking terminal input');
    });

    document.addEventListener('compositionend', () => {
      log('🌐 [IME] Composition ended - letting xterm.js handle the data');

      // Reset composition state after a short delay to allow xterm.js to process
      setTimeout(() => {
        this.isComposing = false;
        log('🌐 [IME] Composition state reset');
      }, 10);
    });

    const style = document.createElement('style');
    style.textContent = `
      .xterm-screen {
        min-width: 1px;
      }
      .xterm-composition-view {
        background: rgba(255, 255, 0, 0.3);
        border-bottom: 1px solid #ffff00;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup Alt key visual feedback (VS Code standard)
   * Shows visual cursor indication when Alt key is pressed to indicate Alt+Click functionality
   */
  private setupAltKeyVisualFeedback(): void {
    log('⌨️ [WEBVIEW] Setting up VS Code standard Alt key visual feedback');

    // Add CSS for VS Code standard Alt key visual feedback
    const style = document.createElement('style');
    style.textContent = `
      /* VS Code standard: Show default cursor when Alt is pressed to indicate Alt+Click functionality */
      .alt-active .xterm-screen {
        cursor: default !important;
      }
      .alt-active .xterm-viewport {
        cursor: default !important;
      }
      .alt-active .xterm {
        cursor: default !important;
      }
    `;
    document.head.appendChild(style);

    // Track Alt key state
    let isAltPressed = false;

    // Add keydown event listener for Alt key
    document.addEventListener('keydown', (event) => {
      if (event.altKey && !isAltPressed) {
        isAltPressed = true;
        document.body.classList.add('alt-active');
        log('⌨️ [ALT] Alt key pressed - showing VS Code standard cursor feedback');
      }
    });

    // Add keyup event listener to remove Alt state
    document.addEventListener('keyup', (event) => {
      if (!event.altKey && isAltPressed) {
        isAltPressed = false;
        document.body.classList.remove('alt-active');
        log('⌨️ [ALT] Alt key released - hiding cursor feedback');
      }
    });

    // Handle window focus events to ensure consistent state
    window.addEventListener('blur', () => {
      if (isAltPressed) {
        isAltPressed = false;
        document.body.classList.remove('alt-active');
        log('⌨️ [ALT] Window lost focus - resetting Alt state');
      }
    });
  }

  public setActiveTerminalId(terminalId: string): void {
    this.activeTerminalId = terminalId;
    log('🎯 [WEBVIEW] Active terminal ID set to:', terminalId);
    
    // Update terminal borders to highlight active terminal
    this.updateTerminalBorders(terminalId);
  }

  /**
   * Update terminal borders to highlight the active terminal
   */
  private updateTerminalBorders(activeTerminalId: string): void {
    try {
      // Get all terminal containers
      const allTerminals = this.splitManager.getTerminals();
      
      allTerminals.forEach((terminalData, terminalId) => {
        const container = terminalData.container;
        if (!container) return;

        // Remove existing border classes
        container.classList.remove('active', 'inactive');
        
        // Add appropriate border class
        if (terminalId === activeTerminalId) {
          container.classList.add('active');
          log(`🔵 [BORDER] Added active border to terminal: ${terminalId}`);
        } else {
          container.classList.add('inactive');
          log(`⚪ [BORDER] Added inactive border to terminal: ${terminalId}`);
        }
      });

      // Also update terminal panes if in split mode
      if (this.splitManager.getIsSplitMode()) {
        this.updateSplitTerminalBorders(activeTerminalId);
      }
    } catch (error) {
      log('❌ [BORDER] Error updating terminal borders:', error);
    }
  }

  /**
   * Update borders for split terminal panes
   */
  private updateSplitTerminalBorders(activeTerminalId: string): void {
    try {
      const panes = document.querySelectorAll('.terminal-pane');
      
      panes.forEach((pane) => {
        const paneElement = pane as HTMLElement;
        const terminalContainer = paneElement.querySelector('[data-terminal-id]') as HTMLElement;
        
        if (!terminalContainer) return;
        
        const terminalId = terminalContainer.getAttribute('data-terminal-id');
        
        // Remove existing classes
        paneElement.classList.remove('active', 'inactive');
        
        // Add appropriate class
        if (terminalId === activeTerminalId) {
          paneElement.classList.add('active');
          log(`🔵 [SPLIT-BORDER] Added active border to split pane: ${terminalId}`);
        } else {
          paneElement.classList.add('inactive');
          log(`⚪ [SPLIT-BORDER] Added inactive border to split pane: ${terminalId}`);
        }
      });
    } catch (error) {
      log('❌ [SPLIT-BORDER] Error updating split terminal borders:', error);
    }
  }

  // Getters for split manager integration
  public getIsSplitMode(): boolean {
    return this.splitManager.getIsSplitMode();
  }

  public getSplitManager(): SplitManager {
    return this.splitManager;
  }

  public switchToNextTerminal(): void {
    const terminalIds = Array.from(this.splitManager.getTerminals().keys());
    if (terminalIds.length <= 1) return;

    const currentIndex = terminalIds.indexOf(this.activeTerminalId || '');
    const nextIndex = (currentIndex + 1) % terminalIds.length;
    const nextTerminalId = terminalIds[nextIndex];

    if (nextTerminalId) {
      this.switchToTerminal(nextTerminalId);
    }
  }

  /**
   * Ensure the specified terminal has focus immediately
   */
  public ensureTerminalFocus(terminalId: string): void {
    log(`🎯 [FOCUS] Ensuring focus for terminal: ${terminalId}`);

    const terminalData = this.splitManager.getTerminals().get(terminalId);
    if (!terminalData?.terminal) {
      log(`⚠️ [FOCUS] Terminal not found: ${terminalId}`);
      return;
    }

    try {
      // Force focus immediately without delay
      terminalData.terminal.focus();
      log(`✅ [FOCUS] Focus applied to terminal: ${terminalId}`);

      // Also trigger fit to ensure proper rendering
      if (terminalData.fitAddon) {
        terminalData.fitAddon.fit();
        log(`📏 [FOCUS] Fit applied to terminal: ${terminalId}`);
      }
    } catch (error) {
      log(`❌ [FOCUS] Error focusing terminal ${terminalId}:`, error);
    }
  }

  /**
   * Check if VS Code Alt+Click cursor positioning should be enabled (VS Code standard)
   * VS Code logic: terminal.integrated.altClickMovesCursor && editor.multiCursorModifier === 'alt'
   */
  private isVSCodeAltClickEnabled(): boolean {
    const altClickSetting = this.currentSettings.altClickMovesCursor;
    const multiCursorModifier = this.currentSettings.multiCursorModifier;

    // VS Code standard: Both conditions must be true
    const altClickEnabled = altClickSetting !== undefined ? Boolean(altClickSetting) : true;
    const multiCursorIsAlt = multiCursorModifier === 'alt';

    const result = altClickEnabled && multiCursorIsAlt;
    log(
      `⌨️ [VS-CODE-ALT-CLICK] Setting check: terminal.integrated.altClickMovesCursor=${altClickEnabled}, editor.multiCursorModifier=${multiCursorModifier}, enabled=${result}`
    );

    return result;
  }

  /**
   * Update xterm.js altClickMovesCursor setting dynamically (VS Code standard)
   */
  private updateAltClickSetting(): void {
    const isEnabled = this.isVSCodeAltClickEnabled();

    // Update all existing terminals
    this.splitManager.getTerminals().forEach((terminalData, terminalId) => {
      if (terminalData.terminal && terminalData.terminal.options) {
        terminalData.terminal.options.altClickMovesCursor = isEnabled;
        log(`⌨️ [UPDATE] Updated Alt+Click setting for terminal ${terminalId}: ${isEnabled}`);
      }
    });

    // Update main terminal if it exists
    if (this.terminal && this.terminal.options) {
      this.terminal.options.altClickMovesCursor = isEnabled;
      log(`⌨️ [UPDATE] Updated Alt+Click setting for main terminal: ${isEnabled}`);
    }
  }

  /**
   * Add click event handler to xterm.js DOM elements for reliable focus (VS Code standard)
   */
  private addXtermClickHandler(
    _terminal: Terminal,
    terminalId: string,
    container: HTMLElement
  ): void {
    // Wait for xterm.js to fully render DOM elements
    setTimeout(() => {
      try {
        // Find the xterm viewport element (where terminal content is displayed)
        const xtermViewport = container.querySelector('.xterm-viewport');
        const xtermScreen = container.querySelector('.xterm-screen');
        const xtermRows = container.querySelector('.xterm-rows');

        // Add click handlers to multiple xterm elements to ensure coverage
        const xtermElements = [xtermViewport, xtermScreen, xtermRows].filter(Boolean);

        xtermElements.forEach((element, index) => {
          if (element && !element.hasAttribute('data-terminal-click-handler')) {
            element.setAttribute('data-terminal-click-handler', terminalId);
            element.addEventListener('click', (event) => {
              // VS Code standard: Only prevent bubbling for non-Alt clicks
              // Allow Alt+Click events to reach xterm.js for cursor positioning
              if (!(event as MouseEvent).altKey) {
                event.stopPropagation();
              }

              // VS Code standard: Handle focus management
              this.ensureTerminalFocus(terminalId);

              if (this.activeTerminalId !== terminalId) {
                this.switchToTerminal(terminalId);
              }
            });

            log(
              `✅ [XTERM-CLICK] Added VS Code standard click handler to xterm element ${index} for terminal: ${terminalId}`
            );
          }
        });

        // Also add a general click handler to the entire container as fallback
        if (!container.hasAttribute('data-xterm-fallback-click')) {
          container.setAttribute('data-xterm-fallback-click', terminalId);
          container.addEventListener('click', (event) => {
            // Only handle if the click wasn't already handled by xterm elements
            if (
              event.target &&
              (event.target as Element).closest('.xterm-viewport, .xterm-screen, .xterm-rows')
            ) {
              return; // Let the xterm handlers handle it
            }

            // VS Code standard: Only handle focus for fallback
            this.ensureTerminalFocus(terminalId);

            if (this.activeTerminalId !== terminalId) {
              this.switchToTerminal(terminalId);
            }
          });

          log(
            `✅ [CONTAINER-CLICK] Added fallback click handler to container for terminal: ${terminalId}`
          );
        }
      } catch (error) {
        log(
          `❌ [XTERM-CLICK] Error adding xterm click handlers for terminal ${terminalId}:`,
          error
        );
      }
    }, 100); // Give xterm.js time to render DOM elements
  }

  public openSettings(): void {
    this.settingsPanel.show(this.currentSettings);
  }

  public applySettings(settings: TerminalSettings): void {
    // Update current settings
    this.currentSettings = { ...this.currentSettings, ...settings };

    // Save settings to VS Code state
    this.saveSettings();

    // Apply settings to all terminals
    this.splitManager.getTerminals().forEach((terminalData) => {
      if (terminalData.terminal) {
        const terminal = terminalData.terminal;
        terminal.options.fontSize = settings.fontSize;
        terminal.options.fontFamily = settings.fontFamily;
        terminal.options.cursorBlink = settings.cursorBlink;

        // Apply theme if needed
        if (settings.theme && settings.theme !== 'auto') {
          terminal.options.theme =
            settings.theme === 'dark'
              ? WEBVIEW_THEME_CONSTANTS.DARK_THEME
              : WEBVIEW_THEME_CONSTANTS.LIGHT_THEME;
        } else {
          // Auto theme - use current VS Code theme
          terminal.options.theme = getWebviewTheme();
        }

        // Refresh terminal to apply changes
        if (terminalData.fitAddon) {
          terminalData.fitAddon.fit();
        }
      }
    });

    // Update Alt+Click settings if they changed
    if (settings.altClickMovesCursor !== undefined || settings.multiCursorModifier !== undefined) {
      this.updateAltClickSetting();
    }

    // Also apply to the main terminal if it exists
    if (this.terminal) {
      const terminal = this.terminal;
      terminal.options.fontSize = settings.fontSize;
      terminal.options.fontFamily = settings.fontFamily;
      terminal.options.cursorBlink = settings.cursorBlink;

      if (settings.theme && settings.theme !== 'auto') {
        terminal.options.theme =
          settings.theme === 'dark'
            ? WEBVIEW_THEME_CONSTANTS.DARK_THEME
            : WEBVIEW_THEME_CONSTANTS.LIGHT_THEME;
      } else {
        terminal.options.theme = getWebviewTheme();
      }

      if (this.fitAddon) {
        this.fitAddon.fit();
      }
    }
  }

  private loadSettings(): void {
    try {
      const state = vscode.getState() as { terminalSettings?: TerminalSettings } | undefined;
      if (state?.terminalSettings) {
        this.currentSettings = { ...this.currentSettings, ...state.terminalSettings };
        log('📋 [WEBVIEW] Loaded settings:', this.currentSettings);
      }
    } catch (error) {
      log('❌ [WEBVIEW] Error loading settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      const state =
        (vscode.getState() as { terminalSettings?: TerminalSettings } | undefined) || {};
      vscode.setState({
        ...state,
        terminalSettings: this.currentSettings,
      });
      log('💾 [WEBVIEW] Saved settings:', this.currentSettings);
    } catch (error) {
      log('❌ [WEBVIEW] Error saving settings:', error);
    }
  }

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

    this.fitAddon = null;
    this.terminalContainer = null;
  }
}

// Global instance
const terminalManager = new TerminalWebviewManager();

// Handle messages from the extension
window.addEventListener('message', (event) => {
  const message = event.data as TerminalMessage;
  log('🎯 [WEBVIEW] Message data:', message);

  switch (message.command) {
    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.INIT:
      log('🎯 [WEBVIEW] Received INIT command', message);
      if (message.config) {
        terminalManager.initializeSimpleTerminal();

        if (message.activeTerminalId) {
          terminalManager.setActiveTerminalId(message.activeTerminalId);
        }

        // Apply settings if provided
        if (message.settings) {
          terminalManager.applySettings(message.settings);
        }

        const checkContainerAndCreate = (): void => {
          if (terminalManager.terminalContainer) {
            const terminalId = message.activeTerminalId || 'terminal-initial';
            try {
              if (message.config) {
                terminalManager.createTerminal(terminalId, 'Terminal 1', message.config);
              } else {
                throw new Error('No terminal config provided');
              }
              terminalManager.initializeSplitControls();
            } catch (error) {
              log('❌ [WEBVIEW] Error during terminal creation:', error);
            }
          } else {
            setTimeout(checkContainerAndCreate, 50);
          }
        };

        setTimeout(checkContainerAndCreate, 10);
      } else {
        log('❌ [WEBVIEW] No config provided in INIT message');
      }
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.OUTPUT:
      if (message.data) {
        terminalManager.writeToTerminal(message.data, message.terminalId);
      }
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.EXIT:
      if (message.exitCode !== undefined) {
        terminalManager.writeToTerminal(
          `\r\n[Process exited with code ${message.exitCode ?? 'unknown'}]\r\n`
        );
      }
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.SPLIT:
      log('🔀 [WEBVIEW] Received SPLIT command - preparing split mode');
      terminalManager.prepareSplitMode('vertical');
      log('🔀 [WEBVIEW] Split mode prepared, isSplitMode:', terminalManager.getIsSplitMode());
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED:
      if (message.terminalId && message.terminalName && message.config) {
        log('🔀 [WEBVIEW] Creating terminal:', {
          terminalId: message.terminalId,
          isSplitMode: terminalManager.getIsSplitMode(),
          activeTerminalId: terminalManager.activeTerminalId,
        });

        // createTerminal handles all split logic internally - no need for addNewTerminalToSplit
        terminalManager.createTerminal(message.terminalId, message.terminalName, message.config);
      }
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED:
      if (message.terminalId) {
        log('🗑️ [WEBVIEW] Received terminal removal command for:', message.terminalId);
        // Terminal was already removed on extension side, just cleanup UI
        terminalManager.handleTerminalRemovedFromExtension(message.terminalId);
      }
      break;

    case 'openSettings':
      log('⚙️ [WEBVIEW] Opening settings panel');
      terminalManager.openSettings();
      break;

    case 'settingsResponse':
      log('⚙️ [WEBVIEW] Received settings response:', message.settings);
      if (message.settings) {
        terminalManager.applySettings(message.settings);
      }
      break;

    default:
      if ((message as { command: string }).command === 'killTerminal') {
        log('🗑️ [WEBVIEW] Received killTerminal command');
        terminalManager.closeTerminal(); // Will kill active terminal
      } else {
        log('⚠️ [WEBVIEW] Unknown command received:', message.command);
      }
  }
});

// Enhanced update status function
function updateStatus(_message: string, _type: 'info' | 'success' | 'error' = 'info'): void {}

// Activity listeners disabled to maintain toast behavior
function setupActivityListeners(): void {
  log('📱 [ACTIVITY] Activity listeners disabled to prevent status re-show');
  // Removed activity listeners that were causing status to re-appear
}

document.addEventListener('keydown', (e) => {
  // Ctrl+Tab to switch between terminals
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    terminalManager.switchToNextTerminal();
  }
});

// Notify extension that webview is ready
log('🎯 [WEBVIEW] Webview script starting...');
updateStatus('Webview script loaded');

setupActivityListeners();

function sendReadyMessage(): void {
  log('🎯 [WEBVIEW] Sending READY message to extension');
  updateStatus('Sending ready message to extension');
  try {
    vscode.postMessage({ command: 'ready' as const });
    log('✅ [WEBVIEW] READY message sent successfully');
    updateStatus('Ready message sent, waiting for response...');
  } catch (error) {
    log('❌ [WEBVIEW] Failed to send READY message:', error);
    updateStatus(`ERROR sending ready: ${String(error)}`);
  }
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateStatus('DOM loaded, sending ready message');
    sendReadyMessage();
  });
} else {
  updateStatus('DOM ready, sending ready message');
  sendReadyMessage();
}
