/**
 * ResizeCoordinator
 *
 * ターミナルのリサイズ処理を一元管理するコーディネーター
 * LightweightTerminalWebviewManagerから抽出された責務:
 * - ResizeObserverの管理
 * - ウィンドウリサイズイベントの処理
 * - ターミナルのrefit処理
 */

import { webview as log } from '../../utils/logger';
import { DOMUtils } from '../utils/DOMUtils';
import { Debouncer } from '../utils/DebouncedEventBuffer';
import { RESIZE_COORDINATOR_CONSTANTS } from '../constants/webview';

/**
 * リサイズに必要な外部依存
 */
export interface IResizeDependencies {
  getTerminals(): Map<string, {
    terminal: { cols: number; rows: number };
    fitAddon: { fit(): void; proposeDimensions(): { cols?: number; rows?: number } | undefined } | null;
    container: HTMLElement | null;
  }>;
  /**
   * PTYプロセスへリサイズを通知
   * VS Code pattern: fit()後にPTYのcols/rowsを更新する必要がある
   */
  notifyResize?(terminalId: string, cols: number, rows: number): void;
}

export class ResizeCoordinator {
  private parentResizeObserver: ResizeObserver | null = null;
  private bodyResizeObserver: ResizeObserver | null = null;
  private isInitialized = false;

  // Use Debouncer utility for consistent debouncing
  private readonly parentResizeDebouncer: Debouncer;
  private readonly windowResizeDebouncer: Debouncer;
  private readonly bodyResizeDebouncer: Debouncer;

  constructor(private readonly deps: IResizeDependencies) {
    // Initialize debouncers with appropriate delays
    this.parentResizeDebouncer = new Debouncer(
      () => {
        log(`📐 [RESIZE] Triggering refitAllTerminals after debounce`);
        this.refitAllTerminals();
      },
      { delay: RESIZE_COORDINATOR_CONSTANTS.PARENT_RESIZE_DEBOUNCE_MS, name: 'parentResize' }
    );

    this.windowResizeDebouncer = new Debouncer(
      () => {
        log('📐 Window resize detected - refitting all terminals');
        this.refitAllTerminals();
      },
      { delay: RESIZE_COORDINATOR_CONSTANTS.WINDOW_RESIZE_DEBOUNCE_MS, name: 'windowResize' }
    );

    this.bodyResizeDebouncer = new Debouncer(
      () => {
        log('📐 Body resize detected - refitting all terminals');
        this.refitAllTerminals();
      },
      { delay: RESIZE_COORDINATOR_CONSTANTS.BODY_RESIZE_DEBOUNCE_MS, name: 'bodyResize' }
    );

    log('✅ ResizeCoordinator initialized');
  }

  /**
   * リサイズ監視を開始
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.setupWindowResizeListener();
    this.setupBodyResizeObserver();
    this.isInitialized = true;

    log('✅ ResizeCoordinator fully initialized');
  }

  /**
   * ターミナル親コンテナのResizeObserverを設定
   */
  public setupParentContainerResizeObserver(): void {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      log('⚠️ terminal-body not found for parent ResizeObserver');
      return;
    }

    log('🔧 Setting up ResizeObserver on document.body, terminal-body, and terminals-wrapper');

    this.parentResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const targetId = (entry.target as HTMLElement).id || 'body';
        log(`📐 [RESIZE] ${targetId} resized: ${width}x${height}`);

        // Use debouncer instead of manual setTimeout
        this.parentResizeDebouncer.trigger();
      }
    });

    this.parentResizeObserver.observe(document.body);
    this.parentResizeObserver.observe(terminalBody);

    const terminalsWrapper = document.getElementById('terminals-wrapper');
    if (terminalsWrapper) {
      this.parentResizeObserver.observe(terminalsWrapper);
      log('✅ ResizeObserver also observing terminals-wrapper');
    }

    log('✅ Parent container ResizeObserver setup complete');
  }

  /**
   * ウィンドウリサイズリスナーを設定
   */
  private setupWindowResizeListener(): void {
    window.addEventListener('resize', () => {
      // Use debouncer instead of manual setTimeout
      this.windowResizeDebouncer.trigger();
    });
    log('🔍 Window resize listener added');
  }

  /**
   * ボディリサイズオブザーバーを設定
   */
  private setupBodyResizeObserver(): void {
    this.bodyResizeObserver = new ResizeObserver(() => {
      // Use debouncer instead of manual setTimeout
      this.bodyResizeDebouncer.trigger();
    });
    this.bodyResizeObserver.observe(document.body);
    log('🔍 Body ResizeObserver added');
  }

  /**
   * すべてのターミナルをリフィット
   *
   * 🎯 VS Code Pattern: Direct dimension calculation
   * Instead of relying solely on FitAddon, we calculate dimensions from
   * the actual container size, ensuring terminals expand to fill available space.
   */
  public refitAllTerminals(): void {
    try {
      const terminals = this.deps.getTerminals();

      // デバッグ情報
      const body = document.body;
      const terminalBody = document.getElementById('terminal-body');
      const terminalsWrapper = document.getElementById('terminals-wrapper');
      log(`📐 [DEBUG] body: ${body.clientWidth}x${body.clientHeight}`);
      log(`📐 [DEBUG] terminal-body: ${terminalBody?.clientWidth}x${terminalBody?.clientHeight}`);
      log(`📐 [DEBUG] terminals-wrapper: ${terminalsWrapper?.clientWidth}x${terminalsWrapper?.clientHeight}`);

      // 🔧 CRITICAL FIX: Reset ALL terminal container styles first
      // This must happen before ANY fit() calls to allow CSS to recalculate widths
      terminals.forEach((terminalData) => {
        if (terminalData.container) {
          DOMUtils.resetXtermInlineStyles(terminalData.container, false);
        }
      });

      // 🔧 CRITICAL FIX: Force a single reflow after all resets
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      document.body.offsetWidth;

      // 🔧 VS Code Pattern: Use requestAnimationFrame for proper timing
      requestAnimationFrame(() => {
        terminals.forEach((terminalData, terminalId) => {
          if (terminalData.fitAddon && terminalData.terminal) {
            try {
              const container = terminalData.container;
              if (!container) return;

              // デバッグ: fit前
              const xtermEl = container.querySelector('.xterm') as HTMLElement;
              const contentEl = container.querySelector('.terminal-content') as HTMLElement;
              log(`📐 [DEBUG] Before reset - ${terminalId}:`);
              log(`  container: ${container.clientWidth}x${container.clientHeight}`);
              log(`  .terminal-content: ${contentEl?.clientWidth}x${contentEl?.clientHeight}`);
              log(`  .xterm: ${xtermEl?.clientWidth}x${xtermEl?.clientHeight}`);
              if (xtermEl) {
                log(`  .xterm inline style: width=${xtermEl.style.width}, height=${xtermEl.style.height}`);
              }

              // 🎯 Reset styles and fit() - VS Code pattern
              // Reset styles right before fit to ensure clean state
              DOMUtils.resetXtermInlineStyles(container, true);

              // デバッグ: reset後
              log(`📐 [DEBUG] After reset - ${terminalId}:`);
              log(`  container: ${container.clientWidth}x${container.clientHeight}`);
              log(`  .terminal-content: ${contentEl?.clientWidth}x${contentEl?.clientHeight}`);
              log(`  .xterm: ${xtermEl?.clientWidth}x${xtermEl?.clientHeight}`);

              terminalData.fitAddon?.fit();

              // 🔧 CRITICAL FIX (Issue #368): Call fit() again after frame to ensure canvas updates
              // AND defer PTY notification until AFTER the second fit() completes
              // This ensures TUI applications (vim, htop, zellij) receive correct dimensions
              requestAnimationFrame(() => {
                DOMUtils.resetXtermInlineStyles(container, true);
                terminalData.fitAddon?.fit();

                // 🎯 VS Code Pattern: Notify PTY about new dimensions AFTER double-fit
                // This is CRITICAL - without this, the shell process doesn't know about the new size
                // Issue #368: PTY must be notified AFTER second fit() to get accurate dimensions
                const newCols = terminalData.terminal.cols;
                const newRows = terminalData.terminal.rows;
                if (this.deps.notifyResize) {
                  this.deps.notifyResize(terminalId, newCols, newRows);
                  log(`📨 PTY resize notification sent: ${terminalId} (${newCols}x${newRows})`);
                }

                // デバッグ: fit後
                log(`📐 [DEBUG] After fit - ${terminalId}:`);
                log(`  .xterm: ${xtermEl?.clientWidth}x${xtermEl?.clientHeight}`);
                if (xtermEl) {
                  log(`  .xterm inline style: width=${xtermEl.style.width}, height=${xtermEl.style.height}`);
                }

                log(`✅ Terminal ${terminalId} refitted: ${newCols}x${newRows}`);
              });
            } catch (error) {
              log(`⚠️ Failed to refit terminal ${terminalId}:`, error);
            }
          }
        });
      });
    } catch (error) {
      log('❌ Error refitting all terminals:', error);
    }
  }

  /**
   * パネル位置変更イベントリスナーを設定
   */
  public setupPanelLocationListener(): void {
    window.addEventListener('terminal-panel-location-changed', () => {
      log('📍 Panel location changed event received - refitting all terminals');
      this.refitAllTerminals();
    });
    log('🔍 Panel location change listener added');
  }

  /**
   * リソース解放
   */
  public dispose(): void {
    if (this.parentResizeObserver) {
      this.parentResizeObserver.disconnect();
      this.parentResizeObserver = null;
    }

    if (this.bodyResizeObserver) {
      this.bodyResizeObserver.disconnect();
      this.bodyResizeObserver = null;
    }

    // Dispose debouncers (cancels pending operations and cleans up timers)
    this.parentResizeDebouncer.dispose();
    this.windowResizeDebouncer.dispose();
    this.bodyResizeDebouncer.dispose();

    this.isInitialized = false;
    log('✅ ResizeCoordinator disposed');
  }
}
