import { DOMUtils } from '../utils/DOMUtils';
import { ErrorHandler } from '../utils/ErrorHandler';
import type { PartialTerminalSettings } from '../../types/shared';

/**
 * 設定パネルコンポーネント
 */
export class SettingsPanel {
  private panelElement: HTMLElement | null = null;
  private isVisible = false;
  private onSettingsChange?: (settings: PartialTerminalSettings) => void;
  private onClose?: () => void;

  /**
   * コンストラクタ
   */
  constructor(options?: {
    onSettingsChange?: (settings: PartialTerminalSettings) => void;
    onClose?: () => void;
  }) {
    this.onSettingsChange = options?.onSettingsChange;
    this.onClose = options?.onClose;
  }

  /**
   * 設定パネルを表示
   */
  public show(currentSettings?: PartialTerminalSettings): void {
    console.log('⚙️ [SETTINGS] Starting to show settings panel, isVisible:', this.isVisible);
    try {
      if (this.isVisible) {
        console.log('⚙️ [SETTINGS] Panel already visible, hiding first');
        this.hide();
        return;
      }

      console.log('⚙️ [SETTINGS] Creating panel...');
      this.createPanel();
      console.log('⚙️ [SETTINGS] Populating settings...');
      this.populateSettings(currentSettings);
      console.log('⚙️ [SETTINGS] Setting up event listeners...');
      this.setupEventListeners();
      console.log('⚙️ [SETTINGS] Showing panel...');
      this.showPanel();

      console.log('⚙️ [SETTINGS] Settings panel opened successfully');
    } catch (error) {
      console.error('❌ [SETTINGS] Error in show():', error);
      ErrorHandler.getInstance().handleGenericError(error as Error, 'SettingsPanel.show');
    }
  }

  /**
   * 設定パネルを非表示
   */
  public hide(): void {
    try {
      if (this.panelElement) {
        DOMUtils.safeRemove(this.panelElement);
        this.panelElement = null;
      }
      this.isVisible = false;
      this.onClose?.();

      console.log('⚙️ [SETTINGS] Settings panel closed');
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(error as Error, 'SettingsPanel.hide');
    }
  }

  /**
   * パネルが表示されているかどうか
   */
  public get visible(): boolean {
    return this.isVisible;
  }

  /**
   * 設定パネルを作成
   */
  private createPanel(): void {
    this.panelElement = DOMUtils.createElement(
      'div',
      {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        background: 'rgba(0, 0, 0, 0.8)',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      {
        id: 'settings-panel',
      }
    );

    const settingsContent = this.createSettingsContent();
    this.panelElement.appendChild(settingsContent);
  }

  /**
   * 設定コンテンツを作成
   */
  private createSettingsContent(): HTMLElement {
    const content = DOMUtils.createElement('div', {
      background: 'var(--vscode-editor-background, #1e1e1e)',
      border: '1px solid var(--vscode-widget-border, #454545)',
      borderRadius: '6px',
      padding: '24px',
      minWidth: '400px',
      maxWidth: '600px',
      maxHeight: '80vh',
      overflow: 'auto',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    });

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="color: var(--vscode-foreground, #cccccc); margin: 0; font-size: 18px; font-weight: 600;">
          Terminal Settings
        </h2>
        <button id="close-settings" style="
          background: transparent;
          border: none;
          color: var(--vscode-foreground, #cccccc);
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
          border-radius: 3px;
        " title="Close">✕</button>
      </div>

      <div style="display: grid; gap: 16px;">
        ${this.createThemeControl()}
        ${this.createCursorBlinkControl()}
      </div>

      <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
        <button id="reset-settings" style="
          background: var(--vscode-button-secondaryBackground, #5a5a5a);
          color: var(--vscode-button-secondaryForeground, #cccccc);
          border: 1px solid var(--vscode-widget-border, #454545);
          padding: 8px 16px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 13px;
        ">Reset to Defaults</button>
        <button id="apply-settings" style="
          background: var(--vscode-button-background, #0e639c);
          color: var(--vscode-button-foreground, #ffffff);
          border: none;
          padding: 8px 16px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 13px;
        ">Apply Settings</button>
      </div>
    `;

    return content;
  }

  /**
   * テーマコントロールを作成
   */
  private createThemeControl(): string {
    return `
      <div>
        <label style="
          color: var(--vscode-foreground, #cccccc);
          font-size: 13px;
          font-weight: 500;
          display: block;
          margin-bottom: 6px;
        ">Theme</label>
        <select id="theme-select" style="
          background: var(--vscode-input-background, #3c3c3c);
          color: var(--vscode-input-foreground, #cccccc);
          border: 1px solid var(--vscode-input-border, #454545);
          padding: 6px 8px;
          border-radius: 3px;
          width: 100%;
          font-size: 13px;
        ">
          <option value="auto">Auto (Follow VS Code)</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
    `;
  }

  /**
   * カーソル点滅コントロールを作成
   */
  private createCursorBlinkControl(): string {
    return `
      <div>
        <label style="
          color: var(--vscode-foreground, #cccccc);
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        ">
          <input
            type="checkbox"
            id="cursor-blink"
            checked
            style="
              width: 16px;
              height: 16px;
              cursor: pointer;
            "
          />
          Enable Cursor Blinking
        </label>
      </div>
    `;
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.panelElement) return;

    // 閉じるボタン
    const closeBtn = this.panelElement.querySelector('#close-settings');
    DOMUtils.addEventListenerSafe(closeBtn as HTMLElement, 'click', () => {
      this.hide();
    });

    // ESCキーで閉じる
    DOMUtils.addEventListenerSafe(document.documentElement, 'keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // 背景クリックで閉じる
    DOMUtils.addEventListenerSafe(this.panelElement, 'click', (e) => {
      if (e.target === this.panelElement) {
        this.hide();
      }
    });

    // 適用ボタン
    const applyBtn = this.panelElement.querySelector('#apply-settings');
    DOMUtils.addEventListenerSafe(applyBtn as HTMLElement, 'click', () => {
      this.applySettings();
    });

    // リセットボタン
    const resetBtn = this.panelElement.querySelector('#reset-settings');
    DOMUtils.addEventListenerSafe(resetBtn as HTMLElement, 'click', () => {
      this.resetSettings();
    });
  }

  /**
   * 設定を適用
   */
  private applySettings(): void {
    try {
      const settings = this.collectSettings();
      this.onSettingsChange?.(settings);
      this.hide();
    } catch (error) {
      ErrorHandler.getInstance().handleSettingsError(error as Error, 'SettingsPanel.applySettings');
    }
  }

  /**
   * 設定をリセット
   */
  private resetSettings(): void {
    try {
      const defaultSettings: PartialTerminalSettings = {
        theme: 'auto',
        cursorBlink: true,
      };

      this.populateSettings(defaultSettings);
    } catch (error) {
      ErrorHandler.getInstance().handleSettingsError(error as Error, 'SettingsPanel.resetSettings');
    }
  }

  /**
   * 現在の設定値を収集
   */
  private collectSettings(): PartialTerminalSettings {
    if (!this.panelElement) {
      throw new Error('Settings panel not available');
    }

    const themeSelect = this.panelElement.querySelector('#theme-select') as HTMLSelectElement;
    const cursorBlinkCheckbox = this.panelElement.querySelector(
      '#cursor-blink'
    ) as HTMLInputElement;

    return {
      theme: themeSelect?.value || 'auto',
      cursorBlink: cursorBlinkCheckbox?.checked || true,
    };
  }

  /**
   * 設定値をフォームに反映
   */
  private populateSettings(settings?: PartialTerminalSettings): void {
    if (!settings || !this.panelElement) return;

    try {
      const themeSelect = this.panelElement.querySelector('#theme-select') as HTMLSelectElement;
      const cursorBlinkCheckbox = this.panelElement.querySelector(
        '#cursor-blink'
      ) as HTMLInputElement;

      if (themeSelect && settings.theme) {
        themeSelect.value = settings.theme;
      }

      if (cursorBlinkCheckbox && settings.cursorBlink !== undefined) {
        cursorBlinkCheckbox.checked = settings.cursorBlink;
      }
    } catch (error) {
      ErrorHandler.getInstance().handleSettingsError(
        error as Error,
        'SettingsPanel.populateSettings'
      );
    }
  }

  /**
   * パネルを表示
   */
  private showPanel(): void {
    if (this.panelElement) {
      console.log('⚙️ [SETTINGS] Adding panel to document.body...');
      document.body.appendChild(this.panelElement);
      this.isVisible = true;
      console.log('⚙️ [SETTINGS] Panel added, isVisible set to true');

      // Ensure panel is visible immediately for debugging
      this.panelElement.style.zIndex = '10000';
      this.panelElement.style.position = 'fixed';
      this.panelElement.style.top = '0';
      this.panelElement.style.left = '0';
      this.panelElement.style.right = '0';
      this.panelElement.style.bottom = '0';
      this.panelElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';

      // アニメーション用の初期スタイル
      this.panelElement.style.opacity = '0';

      requestAnimationFrame(() => {
        if (this.panelElement) {
          this.panelElement.style.transition = 'opacity 0.2s ease';
          this.panelElement.style.opacity = '1';
          console.log('⚙️ [SETTINGS] Animation applied, panel should be visible');
        }
      });
    } else {
      console.error('❌ [SETTINGS] panelElement is null, cannot show panel');
    }
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    this.hide();
  }
}
