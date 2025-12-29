/**
 * WebViewLifecycleManager Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { WebViewLifecycleManager } from '../../../../../providers/services/WebViewLifecycleManager';

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

describe('WebViewLifecycleManager', () => {
  let manager: WebViewLifecycleManager;
  let mockContext: any;
  let mockHtmlService: any;
  let mockWebviewView: any;

  beforeEach(() => {
    mockContext = {
      extensionUri: { fsPath: '/test/path' }
    };
    mockHtmlService = {
      generateFallbackHtml: vi.fn().mockReturnValue('<html>fallback</html>'),
      generateErrorHtml: vi.fn().mockReturnValue('<html>error</html>'),
    };
    mockWebviewView = {
      webview: {
        options: {},
        html: '',
      },
      visible: true,
      onDidChangeVisibility: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
    
    manager = new WebViewLifecycleManager(mockContext, mockHtmlService);
  });

  describe('Initialization and State', () => {
    it('should set and get the view', () => {
      manager.setView(mockWebviewView);
      expect(manager.getView()).toBe(mockWebviewView);
      expect(manager.isWebviewAvailable()).toBe(true);
    });

    it('should manage body rendered state', () => {
      expect(manager.isBodyRendered()).toBe(false);
      manager.setBodyRendered(true);
      expect(manager.isBodyRendered()).toBe(true);
    });

    it('should manage message listener flag', () => {
      expect(manager.isMessageListenerRegistered()).toBe(false);
      manager.setMessageListenerRegistered(true);
      expect(manager.isMessageListenerRegistered()).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should configure webview options', () => {
      manager.configureWebview(mockWebviewView);
      
      expect(mockWebviewView.webview.options.enableScripts).toBe(true);
      expect(mockWebviewView.webview.options.localResourceRoots).toContain(mockContext.extensionUri);
    });
  });

  describe('HTML Setting', () => {
    it('should set HTML successfully', () => {
      const content = '<html>test</html>';
      manager.setWebviewHtml(mockWebviewView, content);
      
      expect(mockWebviewView.webview.html).toBe(content);
      expect(manager.getPerformanceMetrics().htmlSetOperations).toBe(1);
    });

    it('should use fallback HTML if content is empty', () => {
      expect(() => manager.setWebviewHtml(mockWebviewView, '')).toThrow();
      expect(mockWebviewView.webview.html).toBe('<html>fallback</html>');
    });

    it('should handle setup error gracefully', () => {
      const error = new Error('Setup failed');
      manager.handleSetupError(mockWebviewView, error);
      
      expect(mockWebviewView.webview.html).toBe('<html>error</html>');
      expect(mockHtmlService.generateErrorHtml).toHaveBeenCalledWith(expect.objectContaining({ error }));
    });
  });

  describe('Visibility Handling', () => {
    it('should register visibility listener and trigger callbacks', () => {
      const onVisible = vi.fn();
      const onHidden = vi.fn();
      
      manager.registerVisibilityListener(mockWebviewView, onVisible, onHidden);
      
      const callback = mockWebviewView.onDidChangeVisibility.mock.calls[0][0];
      
      // Trigger visible
      mockWebviewView.visible = true;
      callback();
      expect(onVisible).toHaveBeenCalled();
      
      // Trigger hidden
      mockWebviewView.visible = false;
      callback();
      expect(onHidden).toHaveBeenCalled();
    });
  });

  describe('Performance Tracking', () => {
    it('should track resolve start', () => {
      manager.trackResolveStart();
      expect(manager.getPerformanceMetrics().resolveWebviewViewCallCount).toBe(1);
    });

    it('should track various timings', () => {
      vi.useFakeTimers();
      const start = manager.trackResolveStart();
      
      vi.advanceTimersByTime(150);
      manager.trackPanelMovement(start);
      expect(manager.getPerformanceMetrics().lastPanelMovementTime).toBe(150);
      
      vi.advanceTimersByTime(50);
      manager.trackInitializationComplete(start);
      expect(manager.getPerformanceMetrics().totalInitializationTime).toBe(200);
      
      vi.useRealTimers();
    });

    it('should track listener registrations', () => {
      manager.trackListenerRegistration();
      expect(manager.getPerformanceMetrics().listenerRegistrations).toBe(1);
    });

    it('should log performance metrics without throwing', () => {
      expect(() => manager.logPerformanceMetrics()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should reset for new view', () => {
      manager.setBodyRendered(true);
      manager.resetForNewView();
      
      // htmlSet should be reset, but bodyRendered should remain (as per impl)
      expect(manager.isBodyRendered()).toBe(true);
    });

    it('should clear state on dispose', () => {
      manager.setBodyRendered(true);
      manager.dispose();
      
      expect(manager.isBodyRendered()).toBe(false);
      expect(manager.getView()).toBeUndefined();
    });
  });
});
