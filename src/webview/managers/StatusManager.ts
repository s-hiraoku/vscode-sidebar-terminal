import { TERMINAL_CONSTANTS, CSS_CLASSES } from '../constants';
import { PerformanceUtils } from '../utils/PerformanceUtils';
import { DOMUtils } from '../utils/DOMUtils';
import { ErrorHandler } from '../utils/ErrorHandler';
import type { StatusType, LayoutDimensions } from '../types/webview.types';

/**
 * ステータスメッセージとレイアウト管理を担当するクラス
 */
export class StatusManager {
  private statusElement: HTMLElement | null = null;
  private hideTimer: number | null = null;
  private readonly DEFAULT_DISPLAY_DURATION = TERMINAL_CONSTANTS.DELAYS.STATUS_HIDE_DELAY;
  private readonly ERROR_DISPLAY_DURATION = TERMINAL_CONSTANTS.DELAYS.ERROR_STATUS_DELAY;
  private lastMessage = '';
  private lastType: StatusType = 'info';
  private isStatusVisible = false;
  private readonly STATUS_HEIGHT = TERMINAL_CONSTANTS.SIZES.STATUS_BAR_HEIGHT;
  private layoutAdjustTimer: number | null = null;

  /**
   * ステータスメッセージを表示
   */
  public showStatus(message: string, type: StatusType = 'info'): void {
    try {
      this.lastMessage = message;
      this.lastType = type;

      const statusEl = this.getOrCreateStatusElement();
      statusEl.textContent = message;
      statusEl.className = `${CSS_CLASSES.STATUS} ${CSS_CLASSES[`STATUS_${type.toUpperCase()}` as keyof typeof CSS_CLASSES]}`;

      this.showStatusElement();
      this.adjustTerminalLayout(true);
      this.clearTimer();

      const autoHide = true; // TODO: Read from configuration
      if (autoHide) {
        const duration =
          type === 'error' ? this.ERROR_DISPLAY_DURATION : this.DEFAULT_DISPLAY_DURATION;
        this.hideTimer = window.setTimeout(() => {
          this.hideStatusWithAnimation();
        }, duration);
      }

      console.log(`🎯 [STATUS] [${type.toUpperCase()}] ${message}`);
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(error as Error, 'StatusManager.showStatus');
    }
  }

  /**
   * ステータスを即座に非表示
   */
  public hideStatus(): void {
    try {
      if (this.statusElement) {
        this.statusElement.style.display = 'none';
      }
      this.clearTimer();
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(error as Error, 'StatusManager.hideStatus');
    }
  }

  /**
   * アニメーション付きでステータスを非表示
   */
  private hideStatusWithAnimation(): void {
    try {
      if (this.statusElement) {
        this.statusElement.style.opacity = '0';
        this.statusElement.style.transform = 'translateY(-100%)';

        setTimeout(() => {
          this.hideStatusElement();
          this.adjustTerminalLayout(false);
        }, TERMINAL_CONSTANTS.DELAYS.FADE_DURATION);
      }
      this.clearTimer();
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(
        error as Error,
        'StatusManager.hideStatusWithAnimation'
      );
    }
  }

  /**
   * ユーザーアクティビティ時に最後のステータスを再表示
   */
  public showLastStatusOnActivity(): void {
    try {
      if (this.lastMessage && this.statusElement?.style.display === 'none') {
        console.log('📱 [STATUS] Showing status due to user activity');
        this.showStatus(this.lastMessage, this.lastType);
      }
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(
        error as Error,
        'StatusManager.showLastStatusOnActivity'
      );
    }
  }

  /**
   * ステータス要素を取得または作成
   */
  private getOrCreateStatusElement(): HTMLElement {
    try {
      if (!this.statusElement) {
        this.statusElement = DOMUtils.getElement('#status');
        if (this.statusElement) {
          this.setupStatusInteraction();
          this.addStatusStyles();
        }
      }
      return this.statusElement || document.createElement('div');
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(
        error as Error,
        'StatusManager.getOrCreateStatusElement'
      );
      return document.createElement('div');
    }
  }

  /**
   * ステータス要素のインタラクション設定
   */
  private setupStatusInteraction(): void {
    if (!this.statusElement) return;

    try {
      // マウスホバーでタイマーを停止
      DOMUtils.addEventListenerSafe(this.statusElement, 'mouseenter', () => {
        this.clearTimer();
      });

      // マウスリーブでタイマーを再開（短縮版）
      DOMUtils.addEventListenerSafe(this.statusElement, 'mouseleave', () => {
        this.hideTimer = window.setTimeout(() => {
          this.hideStatusWithAnimation();
        }, TERMINAL_CONSTANTS.DELAYS.HOVER_STATUS_DELAY);
      });

      // クリックで即座に非表示
      DOMUtils.addEventListenerSafe(this.statusElement, 'click', () => {
        this.hideStatusWithAnimation();
      });
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(
        error as Error,
        'StatusManager.setupStatusInteraction'
      );
    }
  }

  /**
   * ステータススタイルを追加
   */
  private addStatusStyles(): void {
    try {
      if (!DOMUtils.exists('#status-styles')) {
        const style = DOMUtils.createElement('style', {}, { id: 'status-styles' });
        style.textContent = `
          .${CSS_CLASSES.STATUS} {
            transition: opacity 0.3s ease, transform 0.3s ease;
            cursor: pointer;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: ${this.STATUS_HEIGHT}px;
            z-index: 1000;
          }
          .${CSS_CLASSES.STATUS_INFO} {
            background: var(--vscode-statusBar-background, #007acc);
            color: var(--vscode-statusBar-foreground, #ffffff);
          }
          .${CSS_CLASSES.STATUS_SUCCESS} {
            background: var(--vscode-statusBarItem-prominentBackground, #16825d);
            color: var(--vscode-statusBarItem-prominentForeground, #ffffff);
          }
          .${CSS_CLASSES.STATUS_ERROR} {
            background: var(--vscode-errorBackground, #f14c4c);
            color: var(--vscode-errorForeground, #ffffff);
          }
          .${CSS_CLASSES.STATUS_WARNING} {
            background: var(--vscode-notificationWarning-background, #ffcc02);
            color: var(--vscode-notificationWarning-foreground, #000000);
          }
          .${CSS_CLASSES.STATUS}:hover {
            opacity: 0.8;
          }
          #terminal-body {
            transition: height 0.3s ease-out;
            overflow: hidden;
          }
          .${CSS_CLASSES.SPLIT_CONTAINER} {
            transition: height 0.3s ease-out;
          }
        `;
        document.head.appendChild(style);
      }
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(
        error as Error,
        'StatusManager.addStatusStyles'
      );
    }
  }

  /**
   * タイマーをクリア
   */
  private clearTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  /**
   * ステータス要素を表示
   */
  private showStatusElement(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'block';
      this.statusElement.style.opacity = '1';
      this.statusElement.style.transform = 'translateY(0)';
      this.isStatusVisible = true;
    }
  }

  /**
   * ステータス要素を非表示
   */
  private hideStatusElement(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
      this.isStatusVisible = false;
      this.statusElement.style.opacity = '1';
      this.statusElement.style.transform = 'translateY(0)';
    }
  }

  /**
   * ターミナルレイアウトを調整
   */
  private adjustTerminalLayout(statusVisible: boolean): void {
    try {
      console.log(`📐 [LAYOUT] Adjusting terminal layout, status visible: ${statusVisible}`);

      const dimensions = this.calculateLayoutDimensions(statusVisible);
      if (!dimensions) return;

      this.updateTerminalBodyHeight(dimensions);
      this.adjustSplitContainersHeight(dimensions.availableHeight);
      this.resizeAllTerminals();

      console.log(
        `✅ [LAYOUT] Terminal layout adjusted: ${dimensions.availableHeight}px available`
      );
    } catch (error) {
      ErrorHandler.getInstance().handleLayoutError(
        error as Error,
        'StatusManager.adjustTerminalLayout'
      );
    }
  }

  /**
   * レイアウト寸法を計算
   */
  private calculateLayoutDimensions(statusVisible: boolean): LayoutDimensions | null {
    try {
      const terminalContainer = DOMUtils.getElement('#terminal');
      const terminalHeader = DOMUtils.getElement('#terminal-header');
      const webviewHeader = DOMUtils.getElement('#webview-header');

      if (!terminalContainer) {
        console.warn('⚠️ [LAYOUT] Terminal container not found');
        return null;
      }

      const containerHeight = terminalContainer.clientHeight;
      const webviewHeaderHeight = webviewHeader
        ? webviewHeader.clientHeight
        : TERMINAL_CONSTANTS.SIZES.HEADER_HEIGHT;
      const terminalHeaderHeight = terminalHeader
        ? terminalHeader.clientHeight
        : TERMINAL_CONSTANTS.SIZES.TERMINAL_HEADER_HEIGHT;
      const totalHeaderHeight = webviewHeaderHeight + terminalHeaderHeight;
      const statusHeight = statusVisible ? this.STATUS_HEIGHT : 0;
      const availableHeight = containerHeight - totalHeaderHeight - statusHeight;

      return {
        containerHeight,
        headerHeight: totalHeaderHeight,
        statusHeight,
        availableHeight,
      };
    } catch (error) {
      ErrorHandler.getInstance().handleLayoutError(
        error as Error,
        'StatusManager.calculateLayoutDimensions'
      );
      return null;
    }
  }

  /**
   * ターミナルボディの高さを更新
   */
  private updateTerminalBodyHeight(dimensions: LayoutDimensions): void {
    const terminalBody = DOMUtils.getElement('#terminal-body');
    if (terminalBody) {
      terminalBody.style.height = `${dimensions.availableHeight}px`;
    }
  }

  /**
   * 分割コンテナの高さを調整
   */
  private adjustSplitContainersHeight(availableHeight: number): void {
    try {
      const splitContainers = document.querySelectorAll(`.${CSS_CLASSES.SPLIT_CONTAINER}`);
      if (splitContainers.length > 0) {
        console.log(`📐 [LAYOUT] Adjusting ${splitContainers.length} split containers`);

        const splitCount = splitContainers.length;
        const splitterHeight = TERMINAL_CONSTANTS.SIZES.SPLITTER_HEIGHT;
        const totalSplitterHeight = (splitCount - 1) * splitterHeight;
        const terminalHeight = Math.floor((availableHeight - totalSplitterHeight) / splitCount);

        splitContainers.forEach((container) => {
          (container as HTMLElement).style.height = `${terminalHeight}px`;
        });
      }
    } catch (error) {
      ErrorHandler.getInstance().handleLayoutError(
        error as Error,
        'StatusManager.adjustSplitContainersHeight'
      );
    }
  }

  /**
   * 全ターミナルをリサイズ
   */
  private resizeAllTerminals(): void {
    try {
      // メインターミナルのリサイズ
      const windowWithManager = window as unknown as Record<string, unknown> & {
        terminalManager?: {
          terminal?: { fit?: () => void };
          fitAddon?: { fit: () => void };
          secondaryTerminal?: { fit?: () => void };
          secondaryFitAddon?: { fit: () => void };
          terminals?: Map<string, { fitAddon: { fit: () => void } }>;
        };
      };

      const terminalManager = windowWithManager.terminalManager;
      if (terminalManager?.terminal && terminalManager?.fitAddon) {
        setTimeout(() => {
          terminalManager.fitAddon?.fit();
        }, 100);
      }

      // セカンダリターミナルのリサイズ
      if (terminalManager?.secondaryTerminal && terminalManager?.secondaryFitAddon) {
        setTimeout(() => {
          terminalManager.secondaryFitAddon?.fit();
        }, 100);
      }

      // 複数ターミナルのリサイズ
      if (terminalManager?.terminals) {
        terminalManager.terminals.forEach((terminalData) => {
          if (terminalData.fitAddon) {
            setTimeout(() => {
              terminalData.fitAddon.fit();
            }, 100);
          }
        });
      }
    } catch (error) {
      ErrorHandler.getInstance().handleLayoutError(
        error as Error,
        'StatusManager.resizeAllTerminals'
      );
    }
  }

  /**
   * レイアウト管理の初期化
   */
  public initializeLayoutManagement(): void {
    try {
      this.setupLayoutResizeObserver();

      const debouncedAdjustLayout = PerformanceUtils.debounce(() => {
        this.adjustTerminalLayout(this.isStatusVisible);
      }, TERMINAL_CONSTANTS.DELAYS.RESIZE_DEBOUNCE_DELAY);

      DOMUtils.addEventListenerSafe(
        window as unknown as HTMLElement,
        'resize',
        debouncedAdjustLayout
      );

      console.log('📐 [LAYOUT] Layout management initialized');
    } catch (error) {
      ErrorHandler.getInstance().handleLayoutError(
        error as Error,
        'StatusManager.initializeLayoutManagement'
      );
    }
  }

  /**
   * レイアウトリサイズオブザーバーをセットアップ
   */
  private setupLayoutResizeObserver(): void {
    try {
      const terminalContainer = DOMUtils.getElement('#terminal');
      if (!terminalContainer) return;

      const resizeObserver = new ResizeObserver(
        PerformanceUtils.debounce(() => {
          console.log('📐 [LAYOUT] Container resized, readjusting layout');
          this.adjustTerminalLayout(this.isStatusVisible);
        }, TERMINAL_CONSTANTS.DELAYS.RESIZE_DEBOUNCE_DELAY)
      );

      resizeObserver.observe(terminalContainer);
      console.log('📐 [LAYOUT] Layout resize observer set up');
    } catch (error) {
      ErrorHandler.getInstance().handleLayoutError(
        error as Error,
        'StatusManager.setupLayoutResizeObserver'
      );
    }
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    try {
      this.clearTimer();
      if (this.layoutAdjustTimer !== null) {
        window.clearTimeout(this.layoutAdjustTimer);
        this.layoutAdjustTimer = null;
      }
      this.statusElement = null;
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(error as Error, 'StatusManager.dispose');
    }
  }
}
