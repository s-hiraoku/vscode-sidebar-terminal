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

/**
 * リサイズに必要な外部依存
 */
export interface IResizeDependencies {
  getTerminals(): Map<string, {
    terminal: { cols: number; rows: number };
    fitAddon: { fit(): void; proposeDimensions(): { cols?: number; rows?: number } | undefined } | null;
    container: HTMLElement | null;
  }>;
}

export class ResizeCoordinator {
  private parentResizeObserver: ResizeObserver | null = null;
  private parentResizeTimer: number | null = null;
  private windowResizeTimer: number | null = null;
  private bodyResizeTimer: number | null = null;
  private bodyResizeObserver: ResizeObserver | null = null;
  private isInitialized = false;

  constructor(private readonly deps: IResizeDependencies) {
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

        if (this.parentResizeTimer !== null) {
          window.clearTimeout(this.parentResizeTimer);
        }

        this.parentResizeTimer = window.setTimeout(() => {
          log(`📐 [RESIZE] Triggering refitAllTerminals after debounce`);
          this.refitAllTerminals();
        }, 50);
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
      if (this.windowResizeTimer !== null) {
        window.clearTimeout(this.windowResizeTimer);
      }
      this.windowResizeTimer = window.setTimeout(() => {
        log('📐 Window resize detected - refitting all terminals');
        this.refitAllTerminals();
        this.windowResizeTimer = null;
      }, 100);
    });
    log('🔍 Window resize listener added');
  }

  /**
   * ボディリサイズオブザーバーを設定
   */
  private setupBodyResizeObserver(): void {
    this.bodyResizeObserver = new ResizeObserver(() => {
      if (this.bodyResizeTimer !== null) {
        window.clearTimeout(this.bodyResizeTimer);
      }
      this.bodyResizeTimer = window.setTimeout(() => {
        log('📐 Body resize detected - refitting all terminals');
        this.refitAllTerminals();
        this.bodyResizeTimer = null;
      }, 100);
    });
    this.bodyResizeObserver.observe(document.body);
    log('🔍 Body ResizeObserver added');
  }

  /**
   * すべてのターミナルをリフィット
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

      // 🔧 CRITICAL FIX: Reset parent container styles ONCE before processing terminals
      // This ensures all parent containers have their width calculated from CSS
      if (terminalsWrapper) {
        terminalsWrapper.style.width = '';
        terminalsWrapper.style.maxWidth = '';
      }
      if (terminalBody) {
        terminalBody.style.width = '';
        terminalBody.style.maxWidth = '';
      }

      // 🔧 CRITICAL FIX: Reset ALL terminal container styles first
      // This must happen before ANY fit() calls to allow CSS to recalculate widths
      terminals.forEach((terminalData) => {
        if (terminalData.container) {
          DOMUtils.resetXtermInlineStyles(terminalData.container, false); // Don't force reflow individually
        }
      });

      // 🔧 CRITICAL FIX: Force a single reflow after all resets
      // This allows the browser to recalculate all container sizes based on CSS
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      document.body.offsetWidth;

      // 🔧 CRITICAL FIX: Use requestAnimationFrame to ensure CSS has been applied
      // before calling fit() on terminals
      requestAnimationFrame(() => {
        terminals.forEach((terminalData, terminalId) => {
          if (terminalData.fitAddon && terminalData.terminal) {
            try {
              const container = terminalData.container;
              const xtermEl = container?.querySelector('.xterm') as HTMLElement;

              // デバッグ: fit前
              log(`📐 [DEBUG] Before fit - ${terminalId}:`);
              log(`  container: ${container?.clientWidth}x${container?.clientHeight}`);

              // 寸法提案をログ
              const proposedDims = terminalData.fitAddon.proposeDimensions();
              log(`📐 [DEBUG] proposeDimensions - ${terminalId}: cols=${proposedDims?.cols}, rows=${proposedDims?.rows}`);

              // fit() を呼び出し
              terminalData.fitAddon.fit();

              // デバッグ: fit後
              log(`📐 [DEBUG] After fit - ${terminalId}:`);
              log(`  .xterm: ${xtermEl?.clientWidth}x${xtermEl?.clientHeight}`);

              log(`✅ Terminal ${terminalId} refitted: ${terminalData.terminal.cols}x${terminalData.terminal.rows}`);
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

    if (this.parentResizeTimer !== null) {
      window.clearTimeout(this.parentResizeTimer);
      this.parentResizeTimer = null;
    }

    if (this.windowResizeTimer !== null) {
      window.clearTimeout(this.windowResizeTimer);
      this.windowResizeTimer = null;
    }

    if (this.bodyResizeTimer !== null) {
      window.clearTimeout(this.bodyResizeTimer);
      this.bodyResizeTimer = null;
    }

    this.isInitialized = false;
    log('✅ ResizeCoordinator disposed');
  }
}
