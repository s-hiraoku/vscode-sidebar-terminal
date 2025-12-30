import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsPanel } from '../../../../../webview/components/SettingsPanel';
import { DOMUtils } from '../../../../../webview/utils/DOMUtils';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('SettingsPanel', () => {
  let panel: SettingsPanel;
  let onSettingsChange: any;
  let onClose: any;

  beforeEach(() => {
    document.body.innerHTML = '';
    onSettingsChange = vi.fn();
    onClose = vi.fn();
    panel = new SettingsPanel({ onSettingsChange, onClose });
  });

  afterEach(() => {
    panel.dispose();
  });

  describe('show', () => {
    it('should create and append panel to body', () => {
      panel.show();
      expect(document.body.querySelector('#settings-panel')).not.toBeNull();
      expect(panel.visible).toBe(true);
    });

    it('should populate settings if provided', () => {
      panel.show({
        activeBorderMode: 'always',
        enableCliAgentIntegration: false,
      });

      const select = document.body.querySelector('#active-border-mode') as HTMLSelectElement;
      const checkbox = document.body.querySelector('#cli-agent-integration') as HTMLInputElement;

      expect(select.value).toBe('always');
      expect(checkbox.checked).toBe(false);
    });

    it('should hide existing panel if show is called again', () => {
      panel.show();
      expect(document.body.querySelectorAll('#settings-panel').length).toBe(1);
      
      const hideSpy = vi.spyOn(panel, 'hide');
      panel.show();
      expect(hideSpy).toHaveBeenCalled();
      // Wait for re-creation logic if async, but it's sync.
      // Wait, if panel already visible, show() calls hide() then returns.
      // It does NOT re-create in that implementation:
      /*
      if (this.isVisible) {
        this.hide();
        return;
      }
      */
      // So panel should be gone.
      expect(document.body.querySelector('#settings-panel')).toBeNull();
    });
  });

  describe('hide', () => {
    it('should remove panel from body and call onClose', () => {
      panel.show();
      panel.hide();
      expect(document.body.querySelector('#settings-panel')).toBeNull();
      expect(panel.visible).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Apply Settings', () => {
    it('should collect settings and call onSettingsChange', () => {
      panel.show();
      
      // Change values
      const select = document.body.querySelector('#active-border-mode') as HTMLSelectElement;
      select.value = 'none';
      const checkbox = document.body.querySelector('#cli-agent-integration') as HTMLInputElement;
      checkbox.checked = false;

      // Click apply
      const applyBtn = document.body.querySelector('#apply-settings') as HTMLButtonElement;
      applyBtn.click();

      expect(onSettingsChange).toHaveBeenCalledWith({
        activeBorderMode: 'none',
        enableCliAgentIntegration: false,
      });
      
      // Should hide after apply
      expect(panel.visible).toBe(false);
    });
  });

  describe('Reset Settings', () => {
    it('should reset values to default', () => {
      panel.show({
        activeBorderMode: 'none',
        enableCliAgentIntegration: false,
      });

      const resetBtn = document.body.querySelector('#reset-settings') as HTMLButtonElement;
      resetBtn.click();

      const select = document.body.querySelector('#active-border-mode') as HTMLSelectElement;
      const checkbox = document.body.querySelector('#cli-agent-integration') as HTMLInputElement;

      expect(select.value).toBe('multipleOnly');
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Interactions', () => {
    it('should close on close button click', () => {
      panel.show();
      const closeBtn = document.body.querySelector('#close-settings') as HTMLButtonElement;
      closeBtn.click();
      expect(panel.visible).toBe(false);
    });

    it('should close on background click', () => {
      panel.show();
      const panelEl = document.body.querySelector('#settings-panel') as HTMLElement;
      panelEl.click();
      expect(panel.visible).toBe(false);
    });

    it('should close on Escape key', () => {
      panel.show();
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.documentElement.dispatchEvent(event);
      expect(panel.visible).toBe(false);
    });
  });
});
