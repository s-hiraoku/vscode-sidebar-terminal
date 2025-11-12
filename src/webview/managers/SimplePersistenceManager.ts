import {
  SimpleSessionData,
  SessionContinuationMessage,
  ISimplePersistenceManager,
  SIMPLE_PERSISTENCE,
} from '../../types/SimplePersistence';
import { Debouncer, PerformanceMonitor } from '../../utils/PerformanceOptimizer';
import { webview as log } from '../../utils/logger';
import { BaseManager } from './BaseManager';

/**
 * Simple Terminal Persistence Manager
 * Phase 2: Realistic session continuation approach
 *
 * Replaces complex SerializeAddon-based persistence with:
 * - Simple session metadata storage
 * - Session continuation messages
 * - Reliable terminal recreation
 *
 * Extended BaseManager for consistent lifecycle management (Issue #216)
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */
export class SimplePersistenceManager extends BaseManager implements ISimplePersistenceManager {
  private vscodeApi: {
    getState(): any;
    setState(state: any): void;
    postMessage(message: any): void;
  };

  private saveDebouncer: Debouncer;
  private performanceMonitor: PerformanceMonitor;

  constructor(vscodeApi: any) {
    super('SimplePersistenceManager', {
      enableLogging: false, // Use webview logger instead
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });

    this.vscodeApi = vscodeApi;
    this.performanceMonitor = PerformanceMonitor.getInstance();

    // 🚀 PHASE 3: Debounced saving to reduce frequent saves
    this.saveDebouncer = new Debouncer(
      async () => {
        await this.performSaveSession();
      },
      500 // 500ms debounce delay
    );

    log('🆕 [SIMPLE-PERSISTENCE] SimplePersistenceManager initialized with debouncing');
  }

  /**
   * Initialize manager
   */
  protected doInitialize(): void {
    this.logger('SimplePersistenceManager initialized');
  }

  /**
   * 🚀 PHASE 3: Debounced save session (public interface)
   */
  public async saveSession(): Promise<boolean> {
    // Use debouncer to reduce frequent saves
    this.saveDebouncer.execute();
    return true; // Assume success for debounced operation
  }

  /**
   * Internal method that performs the actual save operation
   */
  private async performSaveSession(): Promise<boolean> {
    this.performanceMonitor.startTimer('session-save');

    try {
      // Get current terminal information from DOM
      const terminalContainers = document.querySelectorAll('[data-terminal-id]');
      const activeTerminal = document.querySelector('[data-terminal-id].active');

      const terminalCount = terminalContainers.length;
      const activeTerminalId = activeTerminal?.getAttribute('data-terminal-id') || null;

      // Extract terminal names from headers
      const terminalNames: string[] = [];
      terminalContainers.forEach((container) => {
        const nameElement = container.querySelector('.terminal-name, .header-title');
        const name = nameElement?.textContent || `Terminal ${terminalNames.length + 1}`;
        terminalNames.push(name);
      });

      const sessionData: SimpleSessionData = {
        terminalCount,
        activeTerminalId,
        terminalNames,
        timestamp: Date.now(),
        version: SIMPLE_PERSISTENCE.VERSION,
      };

      // Save to VS Code state
      const currentState = this.vscodeApi.getState() || {};
      currentState[SIMPLE_PERSISTENCE.STORAGE_KEY] = sessionData;
      this.vscodeApi.setState(currentState);

      const saveTime = this.performanceMonitor.endTimer('session-save');

      log('✅ [SIMPLE-PERSISTENCE] Session saved:', {
        terminalCount,
        activeTerminalId,
        terminalNames,
        saveTimeMs: saveTime,
      });

      return true;
    } catch (error) {
      this.performanceMonitor.endTimer('session-save');
      log('❌ [SIMPLE-PERSISTENCE] Failed to save session:', error);
      return false;
    }
  }

  /**
   * Load previous session state
   */
  public async loadSession(): Promise<SimpleSessionData | null> {
    try {
      const currentState = this.vscodeApi.getState();
      if (!currentState || !currentState[SIMPLE_PERSISTENCE.STORAGE_KEY]) {
        log('📭 [SIMPLE-PERSISTENCE] No previous session found');
        return null;
      }

      const sessionData = currentState[SIMPLE_PERSISTENCE.STORAGE_KEY] as SimpleSessionData;

      // Validate session data
      if (!sessionData.version || !sessionData.timestamp) {
        log('⚠️ [SIMPLE-PERSISTENCE] Invalid session data, ignoring');
        return null;
      }

      // Check if session is not too old (optional: 7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (Date.now() - sessionData.timestamp > maxAge) {
        log('🗓️ [SIMPLE-PERSISTENCE] Session too old, ignoring');
        await this.clearSession();
        return null;
      }

      log('✅ [SIMPLE-PERSISTENCE] Session loaded:', {
        terminalCount: sessionData.terminalCount,
        activeTerminalId: sessionData.activeTerminalId,
        age: Math.round((Date.now() - sessionData.timestamp) / 1000 / 60) + ' minutes',
      });

      return sessionData;
    } catch (error) {
      log('❌ [SIMPLE-PERSISTENCE] Failed to load session:', error);
      return null;
    }
  }

  /**
   * Clear saved session
   */
  public async clearSession(): Promise<void> {
    try {
      const currentState = this.vscodeApi.getState() || {};
      delete currentState[SIMPLE_PERSISTENCE.STORAGE_KEY];
      this.vscodeApi.setState(currentState);

      log('🗑️ [SIMPLE-PERSISTENCE] Session cleared');
    } catch (error) {
      log('❌ [SIMPLE-PERSISTENCE] Failed to clear session:', error);
    }
  }

  /**
   * Get session continuation message for user
   */
  public getSessionMessage(sessionData: SimpleSessionData): SessionContinuationMessage {
    const terminalText = sessionData.terminalCount === 1 ? 'terminal' : 'terminals';
    const timeAgo = this.getTimeAgo(sessionData.timestamp);

    return {
      type: 'restored',
      message: `🔄 Session restored: ${sessionData.terminalCount} ${terminalText} from ${timeAgo}`,
      details:
        sessionData.terminalNames.length > 0
          ? `Terminals: ${sessionData.terminalNames.join(', ')}`
          : undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * Get welcome message for new sessions
   */
  public getWelcomeMessage(): SessionContinuationMessage {
    return {
      type: 'welcome',
      message: '🚀 New terminal session started',
      details: 'VS Code Sidebar Terminal ready',
      timestamp: Date.now(),
    };
  }

  /**
   * Format timestamp as "time ago"
   */
  private getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  /**
   * Display session continuation message in terminal
   */
  public displaySessionMessage(
    message: SessionContinuationMessage,
    terminalElement?: HTMLElement
  ): void {
    const messageHtml = `
      <div style="
        color: #00d4aa;
        background: rgba(0, 212, 170, 0.1);
        padding: 8px 12px;
        margin: 4px 0;
        border-left: 3px solid #00d4aa;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 12px;
        line-height: 1.4;
      ">
        <div style="font-weight: bold;">${message.message}</div>
        ${message.details ? `<div style="opacity: 0.8; margin-top: 2px;">${message.details}</div>` : ''}
      </div>
    `;

    if (terminalElement) {
      // Insert at the beginning of terminal
      terminalElement.insertAdjacentHTML('afterbegin', messageHtml);
    } else {
      // Log to console as fallback
      log(
        `📢 [SESSION-MESSAGE] ${message.message}${message.details ? ` - ${message.details}` : ''}`
      );
    }
  }

  /**
   * Dispose resources
   * Called by BaseManager.dispose() for cleanup
   */
  protected doDispose(): void {
    // Cancel any pending debounced saves
    if (this.saveDebouncer) {
      this.saveDebouncer.cancel?.();
    }

    log('🧹 [SIMPLE-PERSISTENCE] SimplePersistenceManager disposed');
  }
}
