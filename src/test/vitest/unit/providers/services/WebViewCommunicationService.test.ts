/**
 * WebViewCommunicationService Unit Tests
 */

import { describe, it, expect } from 'vitest';

import { WebViewCommunicationService } from '../../../../../providers/services/WebViewCommunicationService';

// Mock VS Code API
vi.mock('vscode', () => ({
  extensions: {
    getExtension: vi.fn().mockReturnValue({
      packageJSON: { version: '1.2.3' }
    }),
  },
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

// Mock error handler
vi.mock('../../../../../utils/feedback', () => ({
  TerminalErrorHandler: {
    handleWebviewError: vi.fn(),
  },
}));

describe('WebViewCommunicationService', () => {
  let service: WebViewCommunicationService;
  let mockWebviewView: any;

  beforeEach(() => {
    service = new WebViewCommunicationService();
    mockWebviewView = {
      webview: {
        postMessage: vi.fn().mockResolvedValue(true),
      },
    };
  });

  describe('View Management', () => {
    it('should set and get the view', () => {
      service.setView(mockWebviewView);
      expect(service.getView()).toBe(mockWebviewView);
      expect(service.isViewAvailable()).toBe(true);
    });

    it('should clear the view', () => {
      service.setView(mockWebviewView);
      service.clearView();
      expect(service.getView()).toBeUndefined();
      expect(service.isViewAvailable()).toBe(false);
    });
  });

  describe('Message Sending', () => {
    it('should send message directly if view is available', async () => {
      service.setView(mockWebviewView);
      const message = { command: 'test' };
      
      await service.sendMessage(message);
      
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(message);
    });

    it('should queue messages if view is not available and flush when set', async () => {
      const message = { command: 'queued' };
      await service.sendMessage(message);
      
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
      
      service.setView(mockWebviewView);
      
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(message);
    });

    it('should handle disposed webview error gracefully', async () => {
      service.setView(mockWebviewView);
      mockWebviewView.webview.postMessage.mockRejectedValue(new Error('Webview is disposed'));
      
      await service.sendMessage({ command: 'test' });
      
      // Should log warning but not re-throw or call error handler for 'disposed' error
      const { TerminalErrorHandler } = await import('../../../../../utils/feedback');
      expect(TerminalErrorHandler.handleWebviewError).not.toHaveBeenCalled();
    });

    it('should call error handler for other message errors', async () => {
      service.setView(mockWebviewView);
      const error = new Error('Generic failure');
      mockWebviewView.webview.postMessage.mockRejectedValue(error);
      
      await service.sendMessage({ command: 'test' });
      
      const { TerminalErrorHandler } = await import('../../../../../utils/feedback');
      expect(TerminalErrorHandler.handleWebviewError).toHaveBeenCalledWith(error);
    });
  });

  describe('Specific Message Helpers', () => {
    beforeEach(() => {
      service.setView(mockWebviewView);
    });

    it('should send version info', async () => {
      await service.sendVersionInfo();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'versionInfo',
        version: 'v1.2.3'
      });
    });

    it('should send settings', async () => {
      const settings = { theme: 'dark' };
      const fontSettings = { fontSize: 14 };
      await service.sendSettings(settings, fontSettings);
      
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'updateSettings',
        settings,
        fontSettings
      });
    });

    it('should send initialization complete', async () => {
      await service.sendInitializationComplete(2);
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'initializationComplete',
        terminalCount: 2
      });
    });

    it('should request panel location detection', async () => {
      await service.requestPanelLocationDetection();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'requestPanelLocationDetection'
      });
    });
  });
});
