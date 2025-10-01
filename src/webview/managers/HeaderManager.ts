import { SAMPLE_ICONS, UI_CONSTANTS } from '../constants';
import { DOMUtils } from '../utils/DOMUtils';
import { ErrorHandler } from '../utils/ErrorHandler';
import type { HeaderConfig, SampleIcon } from '../types/webview.types';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';

/**
 * WebViewヘッダーの管理を担当するクラス
 */
export class HeaderManager {
  private headerElement: HTMLElement | null = null;
  private coordinator: IManagerCoordinator | null = null;
  private config: HeaderConfig = {
    showHeader: true,
    title: 'Terminal',
    showIcons: true,
    iconSize: UI_CONSTANTS.SIZES.SAMPLE_ICON_SIZE,
    fontSize: UI_CONSTANTS.SIZES.TITLE_FONT_SIZE,
  };

  /**
   * コーディネーターを設定
   */
  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
  }

  /**
   * ヘッダー設定を更新
   */
  public updateConfig(config: Partial<HeaderConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.headerElement) {
      this.recreateHeader();
    }
  }

  /**
   * WebViewヘッダーを作成
   */
  public createWebViewHeader(): void {
    try {
      console.log('🎯 [HEADER] Creating WebView header');

      if (!this.config.showHeader) {
        console.log('🎯 [HEADER] WebView header disabled by configuration');
        return;
      }

      this.removeExistingHeader();
      this.createHeaderContainer();
      this.createHeaderContent();
      this.insertHeaderIntoDOM();
      this.updateTerminalCountBadge();

      console.log('✅ [HEADER] WebView header created successfully');
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(
        error as Error,
        'HeaderManager.createWebViewHeader'
      );
    }
  }

  /**
   * ターミナル数バッジを更新
   */
  public updateTerminalCountBadge(): void {
    try {
      const badge = DOMUtils.getElement('#terminal-count-badge');
      if (!badge) return;

      const terminalTabs = DOMUtils.getElement('#terminal-tabs');
      const terminalCount = terminalTabs ? terminalTabs.childElementCount : 0;

      badge.textContent = terminalCount.toString();

      // カウントに基づいて色を変更
      let backgroundColor = 'var(--vscode-badge-background, #007acc)';
      if (terminalCount === 0) {
        backgroundColor = 'var(--vscode-errorBackground, #f14c4c)';
      } else if (terminalCount >= 5) {
        backgroundColor = 'var(--vscode-notificationWarning-background, #ffcc02)';
      } else if (terminalCount >= 3) {
        backgroundColor = 'var(--vscode-charts-orange, #ff8c00)';
      }

      badge.style.background = backgroundColor;

      console.log(`🎯 [HEADER] Terminal count badge updated: ${terminalCount}`);
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(
        error as Error,
        'HeaderManager.updateTerminalCountBadge'
      );
    }
  }

  /**
   * 既存のヘッダーを削除
   */
  private removeExistingHeader(): void {
    if (this.headerElement) {
      DOMUtils.safeRemove(this.headerElement);
      this.headerElement = null;
    }
  }

  /**
   * ヘッダーコンテナを作成
   */
  private createHeaderContainer(): void {
    this.headerElement = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${UI_CONSTANTS.SPACING.HEADER_PADDING / 2}px ${UI_CONSTANTS.SPACING.HEADER_PADDING}px`,
        background: 'var(--vscode-titleBar-activeBackground, #3c3c3c)',
        borderBottom: '1px solid var(--vscode-titleBar-border, #454545)',
        color: 'var(--vscode-titleBar-activeForeground, #cccccc)',
        fontSize: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        minHeight: `${UI_CONSTANTS.SIZES.HEADER_HEIGHT}px`,
        flexShrink: '0',
      },
      {
        id: 'webview-header',
      }
    );
  }

  /**
   * ヘッダーコンテンツを作成
   */
  private createHeaderContent(): void {
    if (!this.headerElement) return;

    const titleSection = this.createTitleSection();
    const commandSection = this.createCommandSection();

    DOMUtils.appendChildren(this.headerElement, titleSection, commandSection);
  }

  /**
   * タイトルセクションを作成
   */
  private createTitleSection(): HTMLElement {
    const titleSection = DOMUtils.createElement('div', {
      display: 'flex',
      alignItems: 'center',
      gap: `${UI_CONSTANTS.SPACING.TITLE_GAP}px`,
      flex: '1',
    });

    const terminalIcon = this.createTerminalIcon();
    const titleText = this.createTitleText();
    const countBadge = this.createCountBadge();

    DOMUtils.appendChildren(titleSection, terminalIcon, titleText, countBadge);

    return titleSection;
  }

  /**
   * ターミナルアイコンを作成
   */
  private createTerminalIcon(): HTMLElement {
    return DOMUtils.createElement(
      'span',
      {
        fontSize: `${UI_CONSTANTS.SIZES.TERMINAL_ICON_SIZE}px`,
        opacity: '0.8',
        lineHeight: '1',
      },
      {
        textContent: '🖥️',
      }
    );
  }

  /**
   * タイトルテキストを作成
   */
  private createTitleText(): HTMLElement {
    return DOMUtils.createElement(
      'span',
      {
        fontSize: `${this.config.fontSize}px`,
        fontWeight: '600',
        letterSpacing: '0.02em',
        lineHeight: '1.2',
      },
      {
        textContent: this.config.title,
      }
    );
  }

  /**
   * カウントバッジを作成
   */
  private createCountBadge(): HTMLElement {
    return DOMUtils.createElement(
      'span',
      {
        background: 'var(--vscode-badge-background, #007acc)',
        color: 'var(--vscode-badge-foreground, #ffffff)',
        borderRadius: '12px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: '500',
        minWidth: '20px',
        textAlign: 'center',
        lineHeight: '18px',
      },
      {
        id: 'terminal-count-badge',
        textContent: '1',
      }
    );
  }

  /**
   * コマンドセクションを作成
   */
  private createCommandSection(): HTMLElement {
    const commandSection = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        gap: `${UI_CONSTANTS.SPACING.ICON_GAP}px`,
        position: 'relative',
      },
      {
        className: 'sample-icons',
      }
    );

    if (this.config.showIcons) {
      // 🆕 Add split mode button first
      this.addSplitModeButton(commandSection);

      // Existing sample icons
      this.addSampleIcons(commandSection);
      this.addHelpTooltip(commandSection);
    }

    return commandSection;
  }

  /**
   * 🆕 分割モード切り替えボタンを追加
   */
  private addSplitModeButton(container: HTMLElement): void {
    const splitButton = DOMUtils.createElement(
      'button',
      {
        background: 'transparent',
        border: 'none',
        color: 'var(--vscode-foreground)',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '16px',
        transition: 'background-color 0.2s ease, color 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: `${UI_CONSTANTS.SIZES.ICON_BUTTON_SIZE}px`,
        height: `${UI_CONSTANTS.SIZES.ICON_BUTTON_SIZE}px`,
      },
      {
        innerHTML: '⊞', // Unicode split icon
        title: 'Toggle Split View',
        className: 'split-mode-toggle-button',
      }
    );

    // Click handler
    DOMUtils.addEventListenerSafe(splitButton, 'click', () => {
      const displayManager = this.coordinator?.getDisplayModeManager?.();
      if (displayManager) {
        displayManager.toggleSplitMode();

        // Update button visual feedback
        const currentMode = displayManager.getCurrentMode();
        splitButton.classList.toggle('active', currentMode === 'split');

        console.log(`🆕 [HEADER] Split mode toggled: ${currentMode}`);
      }
    });

    // Hover effect
    DOMUtils.addEventListenerSafe(splitButton, 'mouseenter', () => {
      splitButton.style.background = 'var(--vscode-toolbar-hoverBackground)';
    });

    DOMUtils.addEventListenerSafe(splitButton, 'mouseleave', () => {
      const displayManager = this.coordinator?.getDisplayModeManager?.();
      const isActive = displayManager?.getCurrentMode() === 'split';
      splitButton.style.background = isActive
        ? 'var(--vscode-button-background)'
        : 'transparent';
    });

    container.appendChild(splitButton);
  }

  /**
   * サンプルアイコンを追加
   */
  private addSampleIcons(container: HTMLElement): void {
    const sampleIconOpacity = 0.4; // TODO: Get from configuration

    SAMPLE_ICONS.forEach((sample) => {
      const iconElement = this.createSampleIcon(sample, sampleIconOpacity);
      container.appendChild(iconElement);
    });
  }

  /**
   * サンプルアイコンを作成
   */
  private createSampleIcon(sample: SampleIcon, opacity: number): HTMLElement {
    const iconElement = DOMUtils.createElement(
      'div',
      {
        background: 'transparent',
        color: 'var(--vscode-descriptionForeground, #969696)',
        fontSize: `${this.config.iconSize}px`,
        padding: `${UI_CONSTANTS.SPACING.ICON_PADDING}px`,
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: `${UI_CONSTANTS.SIZES.ICON_BUTTON_SIZE}px`,
        height: `${UI_CONSTANTS.SIZES.ICON_BUTTON_SIZE}px`,
        opacity: opacity.toString(),
        cursor: 'default',
        userSelect: 'none',
        filter: 'grayscale(30%)',
        transition: 'opacity 0.2s ease',
      },
      {
        className: 'sample-icon',
        textContent: sample.icon,
        title: sample.title,
      }
    );

    this.addSampleIconInteraction(iconElement, opacity);

    return iconElement;
  }

  /**
   * サンプルアイコンのインタラクションを追加
   */
  private addSampleIconInteraction(iconElement: HTMLElement, baseOpacity: number): void {
    DOMUtils.addEventListenerSafe(iconElement, 'mouseenter', () => {
      iconElement.style.opacity = '0.6';
    });

    DOMUtils.addEventListenerSafe(iconElement, 'mouseleave', () => {
      iconElement.style.opacity = baseOpacity.toString();
    });
  }

  /**
   * ヘルプツールチップを追加
   */
  private addHelpTooltip(container: HTMLElement): void {
    const helpTooltip = DOMUtils.createElement(
      'div',
      {
        position: 'absolute',
        bottom: '-35px',
        right: '0',
        background: 'var(--vscode-tooltip-background, #2c2c2c)',
        border: '1px solid var(--vscode-tooltip-border, #454545)',
        borderRadius: '3px',
        padding: '6px 8px',
        fontSize: '10px',
        color: 'var(--vscode-tooltip-foreground, #cccccc)',
        whiteSpace: 'nowrap',
        zIndex: '1001',
        opacity: '0',
        transition: 'opacity 0.2s ease',
        pointerEvents: 'none',
      },
      {
        className: 'help-tooltip',
      }
    );

    helpTooltip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 4px;">
        <span>📌</span>
        <span>Sample Icons (Display Only)</span>
      </div>
      <div style="margin-top: 2px; color: var(--vscode-descriptionForeground, #969696);">
        Use VS Code panel buttons for actions
      </div>
    `;

    this.addTooltipInteraction(container, helpTooltip);
    container.appendChild(helpTooltip);
  }

  /**
   * ツールチップのインタラクションを追加
   */
  private addTooltipInteraction(container: HTMLElement, tooltip: HTMLElement): void {
    DOMUtils.addEventListenerSafe(container, 'mouseenter', () => {
      tooltip.style.opacity = '1';
    });

    DOMUtils.addEventListenerSafe(container, 'mouseleave', () => {
      tooltip.style.opacity = '0';
    });
  }

  /**
   * ヘッダーをDOMに挿入
   */
  private insertHeaderIntoDOM(): void {
    if (!this.headerElement) return;

    const mainContainer = DOMUtils.getElement('#terminal');
    if (mainContainer && mainContainer.firstChild) {
      mainContainer.insertBefore(this.headerElement, mainContainer.firstChild);
    } else if (mainContainer) {
      mainContainer.appendChild(this.headerElement);
    }
  }

  /**
   * ヘッダーを再作成
   */
  private recreateHeader(): void {
    this.createWebViewHeader();
  }

  /**
   * 🆕 分割ボタンの状態を更新（外部から呼び出し可能）
   */
  public updateSplitButtonState(isSplitMode: boolean): void {
    const button = this.headerElement?.querySelector('.split-mode-toggle-button');
    if (button) {
      button.classList.toggle('active', isSplitMode);

      // Update background color
      if (isSplitMode) {
        (button as HTMLElement).style.background = 'var(--vscode-button-background)';
      } else {
        (button as HTMLElement).style.background = 'transparent';
      }
    }
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    try {
      this.removeExistingHeader();
      this.coordinator = null;
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(error as Error, 'HeaderManager.dispose');
    }
  }
}
