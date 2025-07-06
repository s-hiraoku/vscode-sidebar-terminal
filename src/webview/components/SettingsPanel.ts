import { DOMUtils } from '../utils/DOMUtils';
import { ErrorHandler } from '../utils/ErrorHandler';
import type { TerminalSettings } from '../types/terminal.types';

/**
 * 設定パネルコンポーネント
 */
export class SettingsPanel {
  private panelElement: HTMLElement | null = null;
  private isVisible = false;
  private onSettingsChange?: (settings: TerminalSettings) => void;
  private onClose?: () => void;

  /**
   * コンストラクタ
   */
  constructor(options?: {
    onSettingsChange?: (settings: TerminalSettings) => void;
    onClose?: () => void;
  }) {
    this.onSettingsChange = options?.onSettingsChange;
    this.onClose = options?.onClose;
  }

  /**
   * 設定パネルを表示
   */
  public show(currentSettings?: TerminalSettings): void {
    try {
      if (this.isVisible) {
        this.hide();
        return;
      }

      this.createPanel();
      this.populateSettings(currentSettings);
      this.setupEventListeners();
      this.showPanel();

      console.log('⚙️ [SETTINGS] Settings panel opened');
    } catch (error) {
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
    this.panelElement = DOMUtils.createElement('div', {
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
    }, {
      id: 'settings-panel',
    });

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
        ${this.createFontSizeControl()}
        ${this.createFontFamilyControl()}
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
   * フォントサイズコントロールを作成
   */
  private createFontSizeControl(): string {
    return `
      <div>
        <label style="
          color: var(--vscode-foreground, #cccccc);
          font-size: 13px;
          font-weight: 500;
          display: block;
          margin-bottom: 6px;
        ">Font Size</label>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input
            type="range"
            id="font-size-slider"
            min="8"
            max="24"
            value="14"
            style="flex: 1;"
          />
          <span id="font-size-value" style="
            color: var(--vscode-descriptionForeground, #969696);
            font-size: 12px;
            min-width: 40px;
            text-align: right;
          ">14px</span>
        </div>
      </div>
    `;
  }

  /**
   * フォントファミリーコントロールを作成
   */
  private createFontFamilyControl(): string {
    return `
      <div>
        <label style="
          color: var(--vscode-foreground, #cccccc);
          font-size: 13px;
          font-weight: 500;
          display: block;
          margin-bottom: 6px;
        ">Font Family</label>
        <select id="font-family-select" style="
          background: var(--vscode-input-background, #3c3c3c);
          color: var(--vscode-input-foreground, #cccccc);
          border: 1px solid var(--vscode-input-border, #454545);
          padding: 6px 8px;
          border-radius: 3px;
          width: 100%;
          font-size: 13px;
        ">
          <option value="Consolas, monospace">Consolas</option>
          <option value="'Monaco', monospace">Monaco</option>
          <option value="'Menlo', monospace">Menlo</option>
          <option value="'Ubuntu Mono', monospace">Ubuntu Mono</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="'SF Mono', monospace">SF Mono</option>
        </select>
      </div>
    `;
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
    DOMUtils.addEventListenerSafe(document, 'keydown', (e) => {
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

    // フォントサイズスライダー
    const fontSizeSlider = this.panelElement.querySelector('#font-size-slider') as HTMLInputElement;
    const fontSizeValue = this.panelElement.querySelector('#font-size-value');
    DOMUtils.addEventListenerSafe(fontSizeSlider, 'input', () => {
      if (fontSizeValue) {
        fontSizeValue.textContent = `${fontSizeSlider.value}px`;
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
      const defaultSettings: TerminalSettings = {
        fontSize: 14,
        fontFamily: 'Consolas, monospace',
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
  private collectSettings(): TerminalSettings {
    if (!this.panelElement) {
      throw new Error('Settings panel not available');
    }

    const fontSizeSlider = this.panelElement.querySelector('#font-size-slider') as HTMLInputElement;
    const fontFamilySelect = this.panelElement.querySelector('#font-family-select') as HTMLSelectElement;
    const themeSelect = this.panelElement.querySelector('#theme-select') as HTMLSelectElement;
    const cursorBlinkCheckbox = this.panelElement.querySelector('#cursor-blink') as HTMLInputElement;

    return {
      fontSize: parseInt(fontSizeSlider?.value || '14'),
      fontFamily: fontFamilySelect?.value || 'Consolas, monospace',
      theme: themeSelect?.value || 'auto',
      cursorBlink: cursorBlinkCheckbox?.checked || true,
    };
  }

  /**
   * 設定値をフォームに反映
   */
  private populateSettings(settings?: TerminalSettings): void {
    if (!settings || !this.panelElement) return;

    try {
      const fontSizeSlider = this.panelElement.querySelector('#font-size-slider') as HTMLInputElement;
      const fontSizeValue = this.panelElement.querySelector('#font-size-value');
      const fontFamilySelect = this.panelElement.querySelector('#font-family-select') as HTMLSelectElement;
      const themeSelect = this.panelElement.querySelector('#theme-select') as HTMLSelectElement;
      const cursorBlinkCheckbox = this.panelElement.querySelector('#cursor-blink') as HTMLInputElement;

      if (fontSizeSlider) {
        fontSizeSlider.value = settings.fontSize.toString();
        if (fontSizeValue) {
          fontSizeValue.textContent = `${settings.fontSize}px`;
        }
      }

      if (fontFamilySelect) {
        fontFamilySelect.value = settings.fontFamily;
      }

      if (themeSelect && settings.theme) {
        themeSelect.value = settings.theme;
      }

      if (cursorBlinkCheckbox) {
        cursorBlinkCheckbox.checked = settings.cursorBlink;
      }
    } catch (error) {
      ErrorHandler.getInstance().handleSettingsError(error as Error, 'SettingsPanel.populateSettings');
    }
  }

  /**
   * パネルを表示
   */
  private showPanel(): void {
    if (this.panelElement) {
      document.body.appendChild(this.panelElement);
      this.isVisible = true;

      // アニメーション用の初期スタイル
      this.panelElement.style.opacity = '0';
      
      requestAnimationFrame(() => {
        if (this.panelElement) {
          this.panelElement.style.transition = 'opacity 0.2s ease';
          this.panelElement.style.opacity = '1';
        }
      });
    }
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    this.hide();
  }
}