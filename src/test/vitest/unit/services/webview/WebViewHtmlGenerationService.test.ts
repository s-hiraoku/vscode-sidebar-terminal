/**
 * WebViewHtmlGenerationService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { WebViewHtmlGenerationService } from '../../../../../services/webview/WebViewHtmlGenerationService';

// Mock VS Code API
vi.mock('vscode', () => ({
  Uri: {
    joinPath: vi.fn((uri, ...parts) => ({ fsPath: `${uri.fsPath}/${parts.join('/')}`, toString: () => `vscode-resource://${uri.fsPath}/${parts.join('/')}` })),
    parse: vi.fn((url) => ({ toString: () => url })),
  },
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

// Mock common utils
vi.mock('../../../../../utils/common', () => ({
  generateNonce: vi.fn().mockReturnValue('mock-nonce'),
}));

describe('WebViewHtmlGenerationService', () => {
  let service: WebViewHtmlGenerationService;
  let mockWebview: any;
  let mockExtensionUri: any;

  beforeEach(() => {
    service = new WebViewHtmlGenerationService();
    mockWebview = {
      asWebviewUri: vi.fn((uri) => uri),
      cspSource: 'vscode-resource:',
    };
    mockExtensionUri = { fsPath: '/test/path' };
  });

  describe('generateMainHtml', () => {
    it('should generate valid HTML with CSP and scripts', () => {
      const html = service.generateMainHtml({
        webview: mockWebview,
        extensionUri: mockExtensionUri,
      });
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Content-Security-Policy');
      expect(html).toContain('nonce="mock-nonce"');
      expect(html).toContain('id="terminal-body"');
      expect(html).toContain('webview.js');
    });

    it('should include optional styles when requested', () => {
      const html = service.generateMainHtml({
        webview: mockWebview,
        extensionUri: mockExtensionUri,
        includeSplitStyles: true,
        includeCliAgentStyles: true,
      });
      
      expect(html).toContain('.claude-indicator');
    });

    it('should validate generated HTML', () => {
      const html = service.generateMainHtml({
        webview: mockWebview,
        extensionUri: mockExtensionUri,
      });
      
      const validation = service.validateHtml(html);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('generateFallbackHtml', () => {
    it('should generate loading HTML by default', () => {
      const html = service.generateFallbackHtml();
      expect(html).toContain('Terminal Loading...');
      expect(html).toContain('spinner');
    });

    it('should allow custom title and message', () => {
      const html = service.generateFallbackHtml({
        title: 'Custom Title',
        message: 'Custom Message',
        isLoading: false
      });
      expect(html).toContain('Custom Title');
      expect(html).toContain('Custom Message');
      expect(html).not.toContain('<div class="spinner"></div>');
    });
  });

  describe('generateErrorHtml', () => {
    it('should generate error page with details', () => {
      const error = new Error('Epic fail');
      const html = service.generateErrorHtml({ error, allowRetry: true });
      
      expect(html).toContain('❌ Terminal Error');
      expect(html).toContain('Epic fail');
      expect(html).toContain('retry-btn');
    });
  });

  describe('Validation', () => {
    it('should fail validation for empty HTML', () => {
      const result = service.validateHtml('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('HTML content is empty');
    });

    it('should fail if critical elements are missing', () => {
      const result = service.validateHtml('<html><body>No CSP</body></html>');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing Content Security Policy');
      expect(result.errors).toContain('Missing nonce for CSP');
    });
  });
});