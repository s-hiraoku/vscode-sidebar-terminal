/**
 * Refactored WebView Main Entry Point
 *
 * 責務分離によるシンプルなエントリーポイント
 * 元のmain.ts（2,153行）から100行以下に削減
 */

// Import logger first to avoid initialization order issues
import { error_category, webview as log } from '../utils/logger';
import { createWebViewLogger } from '../utils/ComponentLoggers';
import { initializeAccessibility } from './utils/AccessibilityUtils';

// Initialize WebView logger
const webviewLogger = createWebViewLogger('MainWebView');

// 🎯 CRITICAL: Acquire VS Code API once at top level
// This can only be called once per webview instance
declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscodeApi = acquireVsCodeApi();
// Store on window for WebViewApiManager to access
window.vscodeApi = vscodeApi;

// @ts-expect-error CSS import handled by bundler
import '@xterm/xterm/css/xterm.css';
import { LightweightTerminalWebviewManager } from './managers/LightweightTerminalWebviewManager';

declare global {
  interface Window {
    terminalManager?: LightweightTerminalWebviewManager;
    debugLog?: typeof log;
    getManagerStats?: () => ReturnType<LightweightTerminalWebviewManager['getManagerStats']> | null;
    vscodeApi?: ReturnType<typeof acquireVsCodeApi>;
  }
}

/**
 * グローバルターミナルマネージャーインスタンス
 */
let terminalManager: LightweightTerminalWebviewManager | null = null;

/**
 * 🎯 HANDSHAKE PROTOCOL: Track if Extension is ready
 */
let extensionReady = false;
let initializationAttempted = false;

/**
 * WebView初期化のメイン関数
 * 🎯 HANDSHAKE PROTOCOL: This function is now called AFTER receiving extensionReady
 */
async function initializeWebView(): Promise<void> {
  try {
    // Prevent duplicate initialization
    if (initializationAttempted) {
      return;
    }

    // Ensure Extension is ready before proceeding
    if (!extensionReady) {
      return;
    }

    initializationAttempted = true;

    // Check DOM is ready
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      error_category('terminal-body element not found in DOM');
      initializationAttempted = false;
      setTimeout(() => initializeWebView(), 100);
      return;
    }

    webviewLogger.domReady();

    // Initialize accessibility features
    initializeAccessibility();
    log('✅ [A11Y] Accessibility features initialized');

    // Initialize Terminal Manager
    log('🔧 [INIT] Creating LightweightTerminalWebviewManager...');
    terminalManager = new LightweightTerminalWebviewManager();
    log('🔧 [INIT] Calling initializeSimpleTerminal...');
    terminalManager.initializeSimpleTerminal();
    log('🔧 [INIT] initializeSimpleTerminal completed');

    webviewLogger.initialized();

    // 🎯 HANDSHAKE: Notify Extension that WebView is fully initialized and ready for messages
    // This prevents race conditions where terminalCreated messages arrive before handlers are ready
    log('🤝 [HANDSHAKE] About to send webviewInitialized to Extension...');
    vscodeApi.postMessage({
      command: 'webviewInitialized',
      timestamp: Date.now(),
    });
    log('🤝 [HANDSHAKE] Sent webviewInitialized to Extension');

    // 🎯 VS Code Pattern: Extension controls all terminal creation
    // WebView only initializes managers - no independent terminal creation
    // Extension's TerminalInitializationCoordinator handles:
    // 1. Session restoration
    // 2. Creating initial terminal if no sessions exist
    // This prevents duplicate terminal creation race conditions

    // Expose for debugging
    window.terminalManager = terminalManager;

    // Setup debugging keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        if (terminalManager) {
          terminalManager.toggleDebugPanel();
        }
      }

      if (event.ctrlKey && event.shiftKey && event.key === 'X') {
        event.preventDefault();
        if (terminalManager) {
          const diagnostics = terminalManager.exportSystemDiagnostics();
          if (navigator.clipboard) {
            navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2)).catch(() => {
              // Clipboard write may fail in some environments - non-critical
            });
          }
        }
      }

      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        if (terminalManager) {
          terminalManager.forceSynchronization();
        }
      }

      if (event.ctrlKey && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        if (terminalManager) {
          terminalManager.postMessageToExtension({
            command: 'input',
            terminalId: terminalManager.getActiveTerminalId(),
            data: 'echo "Test input working"\r',
            timestamp: Date.now(),
          });
        }
      }
    });
  } catch (error) {
    error_category('Failed to initialize WebView', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      constructor: error?.constructor?.name,
    });
    console.error('🚨 Raw error object:', error);
  }
}

/**
 * エラーハンドリングの設定
 */
function setupErrorHandling(): void {
  window.addEventListener('error', (event) => {
    error_category('Global error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    error_category('Unhandled promise rejection:', event.reason);
    event.preventDefault();
  });
}

/**
 * パフォーマンス監視の設定
 */
function setupPerformanceMonitoring(): void {
  if ('performance' in window && performance.mark) {
    performance.mark('webview-start');
    setTimeout(() => {
      performance.mark('webview-initialized');
      performance.measure('webview-initialization', 'webview-start', 'webview-initialized');
    }, 100);
  }
}

/**
 * 📍 PHASE 3: Panel location monitoring delegated to PanelLocationHandler
 *
 * REMOVED: setupPanelLocationMonitoring() function
 *
 * Reason: Duplicate ResizeObserver causing multiple screen updates
 * - This function created a separate ResizeObserver on document.body
 * - PanelLocationHandler already has ResizeObserver for the same purpose
 * - Having 2 observers caused double detection and double updates
 *
 * Solution: PanelLocationHandler now handles both:
 * 1. Initial detection (when valid dimensions available)
 * 2. Change monitoring (when panel location changes)
 */

/**
 * Set up message listener for extensionReady
 */
function setupHandshakeListener(): void {
  window.addEventListener('message', (event) => {
    const message = event.data;

    if (message.command === 'extensionReady') {
      extensionReady = true;

      if (document.readyState === 'loading') {
        // Will be initialized when DOM is ready
      } else {
        void initializeWebView();
      }
    }
  });

  // Send webviewReady immediately
  vscodeApi.postMessage({
    command: 'webviewReady',
    timestamp: Date.now(),
  });
}

/**
 * DOM準備完了時の初期化
 */
function onDOMContentLoaded(): void {
  webviewLogger.domReady();
  setupErrorHandling();
  setupPerformanceMonitoring();

  if (extensionReady) {
    void initializeWebView();
  }
}

/**
 * ページ離脱時のクリーンアップ
 */
function onPageUnload(): void {
  try {
    if (terminalManager) {
      terminalManager.dispose();
      terminalManager = null;
    }
  } catch (error) {
    error_category('Error during cleanup:', error);
  }
}

// Set up listener immediately (before DOM ready)
setupHandshakeListener();

// DOM ready event handling
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
} else {
  onDOMContentLoaded();
}

// Page unload event handling
window.addEventListener('beforeunload', onPageUnload);
window.addEventListener('unload', onPageUnload);

// Export for debugging
if (typeof window !== 'undefined') {
  window.terminalManager = terminalManager || undefined;
  window.debugLog = log;
}

// Development mode utilities
if (process.env.NODE_ENV === 'development') {
  window.getManagerStats = () => {
    return terminalManager?.getManagerStats() || null;
  };

  const moduleWithHot = module as typeof module & {
    hot?: { accept: (path: string, callback: () => void) => void };
  };
  if (moduleWithHot.hot) {
    moduleWithHot.hot.accept('./managers/RefactoredTerminalWebviewManager', () => {
      // Hot reload logic would go here
    });
  }
}
