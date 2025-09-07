/**
 * Refactored WebView Main Entry Point
 *
 * 責務分離によるシンプルなエントリーポイント
 * 元のmain.ts（2,153行）から100行以下に削減
 */

// Import logger first to avoid initialization order issues
import { startup, lifecycle, success, error_category, webview as log } from '../utils/logger';
import { createWebViewLogger } from '../utils/ComponentLoggers';

// Initialize WebView logger
const webviewLogger = createWebViewLogger('MainWebView');

// WebView initialization logging
startup('Refactored WebView script started');

import '@xterm/xterm/css/xterm.css';
import { RefactoredTerminalWebviewManager } from './managers/RefactoredTerminalWebviewManager';

/**
 * グローバルターミナルマネージャーインスタンス
 */
let terminalManager: RefactoredTerminalWebviewManager | null = null;

/**
 * WebView初期化のメイン関数
 */
async function initializeWebView(): Promise<void> {
  try {
    lifecycle('Initializing WebView...');

    // DOMが準備できているかを確認
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      error_category('terminal-body element not found in DOM');
      // 少し待ってから再試行
      setTimeout(() => initializeWebView(), 100);
      return;
    }

    webviewLogger.domReady();

    // Terminal Manager を初期化
    terminalManager = new RefactoredTerminalWebviewManager();

    // 初期ターミナルコンテナを設定
    terminalManager.initializeSimpleTerminal();

    // Extension側からのセッション復元またはterminalCreatedメッセージを待つ
    lifecycle('Waiting for Extension to send terminal creation messages...');

    // 🔧 FIX: Request Extension to create initial terminals instead of creating emergency terminals
    // This ensures all terminals have proper PTY backing and shell functionality
    setTimeout(() => {
      if (terminalManager && terminalManager.getAllTerminalInstances().size === 0) {
        lifecycle('⚠️ No terminals received from Extension - requesting initial terminal creation');
        
        // Request Extension to create a terminal with PTY backing
        terminalManager.postMessageToExtension({
          command: 'requestInitialTerminal',
          timestamp: Date.now(),
        });
        
        log('📤 Requested initial terminal creation from Extension');
      }
    }, 2000); // Reduced to 2 seconds for faster response

    webviewLogger.initialized();

    // Note: Resize handling is now managed by RefactoredTerminalWebviewManager's EventHandlerManager
    // Initial resize after a short delay to ensure proper terminal sizing
    setTimeout(() => {
      if (terminalManager) {
        log('🔄 Initial terminal resize');
        // terminalManager.terminalLifecycleManager.resizeAllTerminals(); // Private property, commented out
      }
    }, 300);

    // 初期化完了メッセージをExtensionに送信
    console.log('🔍 [DEBUG] Sending webviewReady message to Extension');
    terminalManager.postMessageToExtension({
      command: 'webviewReady',
      timestamp: Date.now(),
    });
    console.log('🔍 [DEBUG] webviewReady message sent successfully');

    // 📡 Request current state from Extension for proper synchronization
    setTimeout(() => {
      if (terminalManager) {
        log('📡 [STATE] Requesting initial state from Extension...');
        terminalManager.requestLatestState();
        
        // 🔧 [INPUT-FIX] Retroactively attach input handlers to any existing terminals
        // This fixes keyboard input for terminals that existed before the handler fix
        setTimeout(() => {
          if (terminalManager) {
            terminalManager.attachInputHandlersToExistingTerminals();
            log('🔧 [INPUT-FIX] Retroactive input handler attachment completed');
          }
        }, 1000); // Additional delay to ensure terminals are fully initialized
      }
    }, 500); // Small delay to ensure Extension has processed webviewReady

    // 🔍 [DEBUG] Expose terminal manager globally for debugging
    (window as any).terminalManager = terminalManager;

    // 🔧 [DEBUG] Setup debugging keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+D: Toggle debug panel
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        if (terminalManager) {
          terminalManager.toggleDebugPanel();
          log('🔍 [DEBUG] Debug panel toggled via keyboard shortcut');
        }
      }
      
      // Ctrl+Shift+X: Export system diagnostics
      if (event.ctrlKey && event.shiftKey && event.key === 'X') {
        event.preventDefault();
        if (terminalManager) {
          const diagnostics = terminalManager.exportSystemDiagnostics();
          log('🔧 [DIAGNOSTICS] System diagnostics exported via keyboard shortcut');
          
          // Copy to clipboard if possible
          if (navigator.clipboard) {
            navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
              .then(() => log('📋 [CLIPBOARD] Diagnostics copied to clipboard'))
              .catch(err => log('❌ [CLIPBOARD] Failed to copy diagnostics:', err));
          }
        }
      }

      // Ctrl+Shift+R: Force synchronization
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        if (terminalManager) {
          terminalManager.forceSynchronization();
          log('🔄 [FORCE-SYNC] System synchronization forced via keyboard shortcut');
        }
      }

      // Ctrl+Shift+I: Attach input handlers (INPUT-FIX debugging)
      if (event.ctrlKey && event.shiftKey && event.key === 'I') {
        event.preventDefault();
        if (terminalManager) {
          terminalManager.attachInputHandlersToExistingTerminals();
          log('🔧 [INPUT-FIX] Input handlers manually attached via keyboard shortcut');
        }
      }

      // Ctrl+Shift+T: Test terminal input (TEST debugging)
      if (event.ctrlKey && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        if (terminalManager) {
          log('🔧 [TEST] Sending test input to active terminal...');
          terminalManager.postMessageToExtension({
            command: 'input',
            terminalId: terminalManager.getActiveTerminalId(),
            data: 'echo "Test input working"\r',
            timestamp: Date.now(),
          });
          log('🔧 [TEST] Test input sent successfully');
        }
      }
    });

    log('🔧 [DEBUG] Debugging tools initialized - Shortcuts: Ctrl+Shift+D (debug), Ctrl+Shift+X (export), Ctrl+Shift+R (sync), Ctrl+Shift+I (input fix), Ctrl+Shift+T (test input)');

  } catch (error) {
    error_category('Failed to initialize WebView', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      constructor: error?.constructor?.name
    });
    console.error('🚨 Raw error object:', error);
  }
}

/**
 * エラーハンドリングの設定
 */
function setupErrorHandling(): void {
  // Global error handler
  window.addEventListener('error', (event) => {
    error_category('Global error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    error_category('Unhandled promise rejection:', event.reason);
    event.preventDefault(); // Prevent console error
  });

  success('Error handling configured');
}

/**
 * パフォーマンス監視の設定
 */
function setupPerformanceMonitoring(): void {
  // Performance monitoring
  if ('performance' in window && performance.mark) {
    performance.mark('webview-start');

    // 初期化完了後のパフォーマンス計測
    setTimeout(() => {
      performance.mark('webview-initialized');
      performance.measure('webview-initialization', 'webview-start', 'webview-initialized');

      const measurements = performance.getEntriesByType('measure');
      for (const measurement of measurements) {
        log(`Performance: ${measurement.name} took ${measurement.duration.toFixed(2)}ms`);
      }
    }, 100);
  }

  success('Performance monitoring configured');
}

/**
 * DOM準備完了時の初期化
 */
function onDOMContentLoaded(): void {
  webviewLogger.domReady();

  // エラーハンドリングを設定
  setupErrorHandling();

  // パフォーマンス監視を設定
  setupPerformanceMonitoring();

  // WebViewを初期化
  initializeWebView();
}

/**
 * ページ離脱時のクリーンアップ
 */
function onPageUnload(): void {
  lifecycle('Page unloading - cleaning up resources');

  try {
    if (terminalManager) {
      terminalManager.dispose();
      terminalManager = null;
    }
  } catch (error) {
    error_category('Error during cleanup:', error);
  }
}

// DOM ready event handling
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
} else {
  // DOM is already ready
  onDOMContentLoaded();
}

// Page unload event handling
window.addEventListener('beforeunload', onPageUnload);
window.addEventListener('unload', onPageUnload);

// Export for debugging and testing
if (typeof window !== 'undefined') {
  (window as any).terminalManager = terminalManager;
  (window as any).debugLog = log;
}

success('Refactored WebView main script initialized');

/**
 * Development mode utilities
 */
if (process.env.NODE_ENV === 'development') {
  // Development-only logging and debugging
  log('Development mode enabled');

  // Expose debug utilities
  (window as any).getManagerStats = () => {
    return terminalManager?.getManagerStats() || null;
  };

  // Hot reload support (if needed in future)
  const moduleWithHot = module as any;
  if (moduleWithHot.hot) {
    moduleWithHot.hot.accept('./managers/RefactoredTerminalWebviewManager', () => {
      lifecycle('Hot reloading terminal manager...');
      // Hot reload logic would go here
    });
  }
}
