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
import { LightweightTerminalWebviewManager } from './managers/LightweightTerminalWebviewManager';

declare global {
  interface Window {
    terminalManager?: LightweightTerminalWebviewManager;
    debugLog?: typeof log;
    getManagerStats?: () => ReturnType<LightweightTerminalWebviewManager['getManagerStats']> | null;
  }
}

/**
 * グローバルターミナルマネージャーインスタンス
 */
let terminalManager: LightweightTerminalWebviewManager | null = null;

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
    terminalManager = new LightweightTerminalWebviewManager();

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
    log('🔍 [DEBUG] Sending webviewReady message to Extension');
    terminalManager.postMessageToExtension({
      command: 'webviewReady',
      timestamp: Date.now(),
    });
    log('🔍 [DEBUG] webviewReady message sent successfully');

    // 📡 Request current state from Extension for proper synchronization
    setTimeout(() => {
      if (terminalManager) {
        log('📡 [STATE] Requesting initial state from Extension...');
        terminalManager.requestLatestState();

        // 🔄 Request session restoration from Extension
        log('🔄 [RESTORATION] Requesting session restoration from Extension...');
        terminalManager.postMessageToExtension({
          command: 'requestSessionRestore',
          timestamp: Date.now(),
        });

      }
    }, 500); // Small delay to ensure Extension has processed webviewReady

    // 🔍 [DEBUG] Expose terminal manager globally for debugging
    window.terminalManager = terminalManager;

    // 📍 Setup panel location monitoring (immediately after terminalManager initialization)
    log('🔧 [DEBUG] Setting up panel location monitoring...');
    console.log('🔧 [DEBUG-CONSOLE] Setting up panel location monitoring...');
    try {
      setupPanelLocationMonitoring();
      log('🔧 [DEBUG] Panel location monitoring setup completed');
      console.log('🔧 [DEBUG-CONSOLE] Panel location monitoring setup completed');
    } catch (error) {
      error_category('🔧 [DEBUG] Failed to setup panel location monitoring:', error);
      console.error('🔧 [DEBUG-CONSOLE] Failed to setup panel location monitoring:', error);
    }

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
            navigator.clipboard
              .writeText(JSON.stringify(diagnostics, null, 2))
              .then(() => log('📋 [CLIPBOARD] Diagnostics copied to clipboard'))
              .catch((err) => log('❌ [CLIPBOARD] Failed to copy diagnostics:', err));
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

    log(
      '🔧 [DEBUG] Debugging tools initialized - Shortcuts: Ctrl+Shift+D (debug), Ctrl+Shift+X (export), Ctrl+Shift+R (sync), Ctrl+Shift+T (test input)'
    );
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
 * パネル位置監視の設定
 * WebView全体のリサイズを監視して、パネル位置の変更を検出
 */
function setupPanelLocationMonitoring(): void {
  try {
    console.log('📍 [PANEL-MONITOR-CONSOLE] Setting up panel location monitoring...');
    log('📍 [PANEL-MONITOR] Setting up panel location monitoring...');
    console.log(`📍 [PANEL-MONITOR-CONSOLE] terminalManager exists: ${!!terminalManager}`);
    log(`📍 [PANEL-MONITOR] terminalManager exists: ${!!terminalManager}`);
    console.log(`📍 [PANEL-MONITOR-CONSOLE] document.body exists: ${!!document.body}`);
    log(`📍 [PANEL-MONITOR] document.body exists: ${!!document.body}`);

    let previousAspectRatio: number | null = null;
    let isInitialized = false;
    let resizeCount = 0;
    const ASPECT_RATIO_THRESHOLD = 1.2;

    // ResizeObserverでdocument.bodyのサイズ変更を監視
    const resizeObserver = new ResizeObserver((entries) => {
      resizeCount++;
      console.log(`📍 [PANEL-MONITOR-CONSOLE] ResizeObserver fired! (count: ${resizeCount})`);
      log(`📍 [PANEL-MONITOR] ResizeObserver fired! (count: ${resizeCount})`);

      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        console.log(`📍 [PANEL-MONITOR-CONSOLE] Dimensions: ${width}px × ${height}px`);
        log(`📍 [PANEL-MONITOR] Dimensions: ${width}px × ${height}px`);

        if (width === 0 || height === 0) {
          log(`📍 [PANEL-MONITOR] Skipping: invalid dimensions`);
          continue;
        }

        const aspectRatio = width / height;
        log(`📍 [PANEL-MONITOR] Aspect ratio: ${aspectRatio.toFixed(3)}`);

        const isPanelLocation = aspectRatio > ASPECT_RATIO_THRESHOLD;
        const detectedLocation = isPanelLocation ? 'panel' : 'sidebar';

        // 初回測定: 現在の位置を報告（この情報がExtensionのベースラインになる）
        if (!isInitialized) {
          previousAspectRatio = aspectRatio;
          isInitialized = true;
          console.log(`📍 [PANEL-MONITOR-CONSOLE] Initial measurement: ${aspectRatio.toFixed(3)} (${detectedLocation})`);
          log(`📍 [PANEL-MONITOR] Initial measurement: ${aspectRatio.toFixed(3)} (${detectedLocation})`);

          // 🔧 FIX: 初回測定時も位置を報告してExtensionに初期状態を知らせる
          // これにより、次回の移動時に正しく変更を検出できる
          if (terminalManager) {
            log(`📍 [PANEL-MONITOR] Sending initial location to Extension: ${detectedLocation}`);
            terminalManager.postMessageToExtension({
              command: 'reportPanelLocation',
              location: detectedLocation,
              timestamp: Date.now(),
            });
            log(`📍 [PANEL-MONITOR] ✅ Initial location reported: ${detectedLocation}`);

            // 🆕 WebView側のSplitManagerも直接更新（モードボタンが即座に押される場合に備えて）
            const splitManager = terminalManager.getSplitManager?.();
            if (splitManager) {
              splitManager.setPanelLocation(detectedLocation);
              log(`📍 [PANEL-MONITOR] ✅ SplitManager panel location updated: ${detectedLocation}`);
            }

            // 🎯 FIX: Update terminals-wrapper flexDirection on initial detection
            // Panel → row (横並び), Sidebar → column (縦並び)
            const terminalsWrapper = document.getElementById('terminals-wrapper');
            if (terminalsWrapper) {
              const initialFlexDirection = isPanelLocation ? 'row' : 'column';
              terminalsWrapper.style.flexDirection = initialFlexDirection;
              console.log(`📍 [PANEL-MONITOR-CONSOLE] ✅ Updated terminals-wrapper flexDirection: ${initialFlexDirection}`);
              log(`📍 [PANEL-MONITOR] ✅ Updated terminals-wrapper flexDirection on initial detection: ${initialFlexDirection}`);
            } else {
              console.warn(`📍 [PANEL-MONITOR-CONSOLE] ⚠️ terminals-wrapper not found yet - will retry`);
              log(`📍 [PANEL-MONITOR] ⚠️ terminals-wrapper not found yet - will retry`);

              // terminals-wrapper がまだ存在しない場合、少し待ってからリトライ
              setTimeout(() => {
                const wrapper = document.getElementById('terminals-wrapper');
                if (wrapper) {
                  const flexDirection = isPanelLocation ? 'row' : 'column';
                  wrapper.style.flexDirection = flexDirection;
                  console.log(`📍 [PANEL-MONITOR-CONSOLE] ✅ [RETRY] Updated terminals-wrapper flexDirection: ${flexDirection}`);
                  log(`📍 [PANEL-MONITOR] ✅ [RETRY] Updated terminals-wrapper flexDirection: ${flexDirection}`);
                } else {
                  console.error(`📍 [PANEL-MONITOR-CONSOLE] ❌ terminals-wrapper still not found after retry`);
                  log(`📍 [PANEL-MONITOR] ❌ terminals-wrapper still not found after retry`);
                }
              }, 100);
            }
          }
          continue;
        }

        // アスペクト比が閾値をまたいで変わった場合のみ報告
        // これにより、パネル位置の実質的な変更のみを検出
        if (previousAspectRatio !== null) {
          const wasPanelLocation = previousAspectRatio > ASPECT_RATIO_THRESHOLD;

          log(`📍 [PANEL-MONITOR] Was panel: ${wasPanelLocation}, Is panel: ${isPanelLocation}`);

          if (wasPanelLocation !== isPanelLocation) {
            log(`📍 [PANEL-MONITOR] 🚨 DETECTED PANEL LOCATION CHANGE! Aspect ratio: ${previousAspectRatio.toFixed(3)} → ${aspectRatio.toFixed(3)}`);
            log(`📍 [PANEL-MONITOR] Location changed: ${wasPanelLocation ? 'panel' : 'sidebar'} → ${detectedLocation}`);

            // パネル位置が変わったことをExtensionに報告
            if (terminalManager) {
              log(`📍 [PANEL-MONITOR] Sending message to Extension: ${detectedLocation}`);
              terminalManager.postMessageToExtension({
                command: 'reportPanelLocation',
                location: detectedLocation,
                timestamp: Date.now(),
              });
              log(`📍 [PANEL-MONITOR] ✅ Reported new location: ${detectedLocation}`);

              // 🆕 Keep SplitManager's internal state in sync with the current location
              const splitManager = terminalManager.getSplitManager?.();
              if (splitManager) {
                splitManager.setPanelLocation(detectedLocation);
                log(`📍 [PANEL-MONITOR] ✅ SplitManager panel location updated: ${detectedLocation}`);
              }
            } else {
              log(`📍 [PANEL-MONITOR] ⚠️ terminalManager is null, cannot send message`);
            }
          } else {
            log(`📍 [PANEL-MONITOR] No location change detected (still ${detectedLocation})`);
          }
        }

        previousAspectRatio = aspectRatio;
      }
    });

    // document.bodyを監視
    console.log(`📍 [PANEL-MONITOR-CONSOLE] Starting to observe document.body...`);
    log(`📍 [PANEL-MONITOR] Starting to observe document.body...`);
    resizeObserver.observe(document.body);
    console.log('📍 [PANEL-MONITOR-CONSOLE] ✅ Panel location monitoring started successfully');
    log('📍 [PANEL-MONITOR] ✅ Panel location monitoring started successfully');
  } catch (error) {
    console.error('📍 [PANEL-MONITOR-CONSOLE] ❌ Failed to setup panel location monitoring:', error);
    error_category('📍 [PANEL-MONITOR] ❌ Failed to setup panel location monitoring:', error);
  }
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
  window.terminalManager = terminalManager || undefined;
  window.debugLog = log;
}

success('Refactored WebView main script initialized');

/**
 * Development mode utilities
 */
if (process.env.NODE_ENV === 'development') {
  // Development-only logging and debugging
  log('Development mode enabled');

  // Expose debug utilities
  window.getManagerStats = () => {
    return terminalManager?.getManagerStats() || null;
  };

  // Hot reload support (if needed in future)
  const moduleWithHot = module as typeof module & {
    hot?: { accept: (path: string, callback: () => void) => void };
  };
  if (moduleWithHot.hot) {
    moduleWithHot.hot.accept('./managers/RefactoredTerminalWebviewManager', () => {
      lifecycle('Hot reloading terminal manager...');
      // Hot reload logic would go here
    });
  }
}
