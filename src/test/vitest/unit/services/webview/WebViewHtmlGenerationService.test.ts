// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  WebViewHtmlGenerationService,
  HtmlGenerationOptions,
  FallbackHtmlOptions,
  ErrorHtmlOptions,
} from '../../../../../services/webview/WebViewHtmlGenerationService';

describe('WebViewHtmlGenerationService', () => {
  let service: WebViewHtmlGenerationService;
  let mockWebview: {
    asWebviewUri: ReturnType<typeof vi.fn>;
    cspSource: string;
    html: string;
    options: Record<string, unknown>;
    onDidReceiveMessage: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
  };
  let mockExtensionUri: vscode.Uri;

  beforeEach(() => {
    // Create mock extension URI
    mockExtensionUri = vscode.Uri.parse('file:///test/extension');

    // Create mock webview
    mockWebview = {
      asWebviewUri: vi.fn(),
      cspSource: 'vscode-resource:',
      html: '',
      options: {},
      onDidReceiveMessage: vi.fn(),
      postMessage: vi.fn(),
    };

    // Mock vscode.Uri.joinPath
    vi.spyOn(vscode.Uri, 'joinPath').mockReturnValue(
      vscode.Uri.parse('file:///test/extension/dist/webview.js')
    );

    // Mock webview.asWebviewUri to return a proper URI
    mockWebview.asWebviewUri.mockReturnValue(vscode.Uri.parse('vscode-resource://test/webview.js'));

    service = new WebViewHtmlGenerationService();
  });

  afterEach(() => {
    service.dispose();
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('generateMainHtml', () => {
    let htmlOptions: HtmlGenerationOptions;

    beforeEach(() => {
      htmlOptions = {
        webview: mockWebview as unknown as vscode.Webview,
        extensionUri: mockExtensionUri,
      };
    });

    it('should generate complete HTML structure', () => {
      const html = service.generateMainHtml(htmlOptions);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('Content-Security-Policy');
      expect(html).toContain('<div id="terminal-body">');
      expect(html).toContain('window.vscodeApi');
    });

    it('should include nonce in CSP and scripts', () => {
      const html = service.generateMainHtml(htmlOptions);

      // Extract nonce from CSP
      const cspMatch = html.match(/script-src 'nonce-([^']+)'/);
      expect(cspMatch).toBeDefined();

      const nonce = cspMatch![1];
      expect(nonce).toBeDefined();
      expect(nonce!.length).toBeGreaterThan(0);

      // Verify nonce is used in scripts
      expect(html).toContain(`nonce="${nonce}"`);
    });

    it('should include webview script URI', () => {
      const html = service.generateMainHtml(htmlOptions);

      expect(html).toContain('vscode-resource://test/webview.js');
      expect(mockWebview.asWebviewUri).toHaveBeenCalledOnce();
    });

    it('should include base styles by default', () => {
      const html = service.generateMainHtml(htmlOptions);

      expect(html).toContain('box-sizing: border-box');
      expect(html).toContain('--vscode-editor-background');
      expect(html).toContain('.terminal-container');
    });

    it('should include split styles by default', () => {
      const html = service.generateMainHtml(htmlOptions);

      expect(html).toContain('.split-container');
      expect(html).toContain('.terminal-pane');
      expect(html).toContain('.splitter');
    });

    it('should include CLI Agent styles by default', () => {
      const html = service.generateMainHtml(htmlOptions);

      expect(html).toContain('.claude-indicator');
      expect(html).toContain('claude-connected');
      expect(html).toContain('@keyframes blink');
    });

    it('should exclude split styles when disabled', () => {
      htmlOptions.includeSplitStyles = false;
      const html = service.generateMainHtml(htmlOptions);

      expect(html).not.toContain('.split-container');
      expect(html).not.toContain('.terminal-pane');
    });

    it('should exclude CLI Agent styles when disabled', () => {
      htmlOptions.includeCliAgentStyles = false;
      const html = service.generateMainHtml(htmlOptions);

      expect(html).not.toContain('.claude-indicator');
      expect(html).not.toContain('claude-connected');
    });

    it('should include custom styles when provided', () => {
      const customStyles = '.custom-style { color: red; }';
      htmlOptions.customStyles = customStyles;

      const html = service.generateMainHtml(htmlOptions);

      expect(html).toContain(customStyles);
    });

    it('should throw error when script URI generation fails', () => {
      mockWebview.asWebviewUri.mockImplementation(() => {
        throw new Error('URI generation failed');
      });

      expect(() => {
        service.generateMainHtml(htmlOptions);
      }).toThrow(/HTML generation failed/);
    });

    it('should handle webview.asWebviewUri errors gracefully', () => {
      mockWebview.asWebviewUri.mockImplementation(() => {
        throw new Error('Mock URI error');
      });

      expect(() => {
        service.generateMainHtml(htmlOptions);
      }).toThrow(/HTML generation failed.*Mock URI error/);
    });
  });

  describe('generateFallbackHtml', () => {
    it('should generate fallback HTML with default options', () => {
      const html = service.generateFallbackHtml();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Terminal Loading...');
      expect(html).toContain('Please wait while the terminal initializes');
      expect(html).toContain('🔄');
      expect(html).toContain('spinner');
    });

    it('should use custom title and message', () => {
      const options: FallbackHtmlOptions = {
        title: 'Custom Loading',
        message: 'Custom message',
        isLoading: true,
      };

      const html = service.generateFallbackHtml(options);

      expect(html).toContain('Custom Loading');
      expect(html).toContain('Custom message');
      expect(html).toContain('spinner');
    });

    it('should not include spinner when not loading', () => {
      const options: FallbackHtmlOptions = {
        isLoading: false,
      };

      const html = service.generateFallbackHtml(options);

      expect(html).not.toContain('spinner');
      expect(html).toContain('⚠️');
    });

    it('should include proper VS Code CSS variables', () => {
      const html = service.generateFallbackHtml();

      expect(html).toContain('--vscode-editor-background');
      expect(html).toContain('--vscode-foreground');
      expect(html).toContain('--vscode-font-family');
    });
  });

  describe('generateErrorHtml', () => {
    it('should generate error HTML with Error object', () => {
      const error = new Error('Test error message');
      const options: ErrorHtmlOptions = { error };

      const html = service.generateErrorHtml(options);

      expect(html).toContain('Terminal Error');
      expect(html).toContain('❌');
      expect(html).toContain('Test error message');
      expect(html).toContain('Error Details');
    });

    it('should generate error HTML with string error', () => {
      const error = 'String error message';
      const options: ErrorHtmlOptions = { error };

      const html = service.generateErrorHtml(options);

      expect(html).toContain('String error message');
    });

    it('should include retry button when allowed', () => {
      const options: ErrorHtmlOptions = {
        error: new Error('Test error'),
        allowRetry: true,
      };

      const html = service.generateErrorHtml(options);

      expect(html).toContain('Try Again');
      expect(html).toContain('window.location.reload()');
    });

    it('should not include retry button when not allowed', () => {
      const options: ErrorHtmlOptions = {
        error: new Error('Test error'),
        allowRetry: false,
      };

      const html = service.generateErrorHtml(options);

      expect(html).not.toContain('Try Again');
    });

    it('should use custom error message when provided', () => {
      const options: ErrorHtmlOptions = {
        error: new Error('Original error'),
        customMessage: 'Custom error display',
      };

      const html = service.generateErrorHtml(options);

      expect(html).toContain('Custom error display');
      // Original error should still be in details
      expect(html).toContain('Original error');
    });

    it('should include proper error styling', () => {
      const options: ErrorHtmlOptions = { error: new Error('Test') };
      const html = service.generateErrorHtml(options);

      expect(html).toContain('--vscode-errorForeground');
      expect(html).toContain('error-container');
      expect(html).toContain('error-message');
    });
  });

  describe('validateHtml', () => {
    it('should validate correct HTML', () => {
      const validHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="script-src 'nonce-abc123';">
</head>
<body></body>
</html>`;

      const result = service.validateHtml(validHtml);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect empty HTML', () => {
      const result = service.validateHtml('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('HTML content is empty');
    });

    it('should detect missing DOCTYPE', () => {
      const html = '<html><body></body></html>';
      const result = service.validateHtml(html);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing DOCTYPE declaration');
    });

    it('should detect missing charset', () => {
      const html = '<!DOCTYPE html><html><body></body></html>';
      const result = service.validateHtml(html);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing charset declaration');
    });

    it('should detect missing CSP', () => {
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body></body>
</html>`;
      const result = service.validateHtml(html);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing Content Security Policy');
    });

    it('should detect missing nonce', () => {
      const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
</head>
<body></body>
</html>`;
      const result = service.validateHtml(html);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing nonce for CSP');
    });
  });

  describe('Error Handling', () => {
    it('should handle vscode.Uri.joinPath errors', () => {
      vi.restoreAllMocks(); // Remove the stub
      vi.spyOn(vscode.Uri, 'joinPath').mockImplementation(() => {
        throw new Error('joinPath failed');
      });

      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview as unknown as vscode.Webview,
        extensionUri: mockExtensionUri,
      };

      expect(() => {
        service.generateMainHtml(htmlOptions);
      }).toThrow(/HTML generation failed.*joinPath failed/);
    });
  });

  describe('Integration Tests', () => {
    it('should generate HTML that passes validation', () => {
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview as unknown as vscode.Webview,
        extensionUri: mockExtensionUri,
      };

      const html = service.generateMainHtml(htmlOptions);
      const validation = service.validateHtml(html);

      expect(validation.isValid).toBe(true);
      if (!validation.isValid) {
        throw new Error(`Validation errors: ${validation.errors.join(', ')}`);
      }
    });

    it('should generate consistent nonce across multiple generations', () => {
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview as unknown as vscode.Webview,
        extensionUri: mockExtensionUri,
      };

      const html1 = service.generateMainHtml(htmlOptions);
      const html2 = service.generateMainHtml(htmlOptions);

      // Extract nonces
      const nonce1Match = html1.match(/nonce="([^"]+)"/);
      const nonce2Match = html2.match(/nonce="([^"]+)"/);

      expect(nonce1Match).toBeDefined();
      expect(nonce2Match).toBeDefined();
      // Nonces should be different (security requirement)
      expect(nonce1Match![1]).not.toBe(nonce2Match![1]);
    });

    it('should handle complete HTML generation lifecycle', () => {
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview as unknown as vscode.Webview,
        extensionUri: mockExtensionUri,
        includeSplitStyles: true,
        includeCliAgentStyles: true,
        customStyles: '.test { color: blue; }',
      };

      // Generate main HTML
      const mainHtml = service.generateMainHtml(htmlOptions);
      expect(mainHtml.length).toBeGreaterThan(1000);

      // Generate fallback HTML
      const fallbackHtml = service.generateFallbackHtml({
        title: 'Loading...',
        isLoading: true,
      });
      expect(fallbackHtml).toContain('Loading...');

      // Generate error HTML
      const errorHtml = service.generateErrorHtml({
        error: new Error('Test error'),
        allowRetry: true,
      });
      expect(errorHtml).toContain('Test error');

      // Validate all HTML
      expect(service.validateHtml(mainHtml).isValid).toBe(true);
      expect(service.validateHtml(fallbackHtml).isValid).toBe(true);
      expect(service.validateHtml(errorHtml).isValid).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should generate HTML within reasonable time', () => {
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview as unknown as vscode.Webview,
        extensionUri: mockExtensionUri,
      };

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        service.generateMainHtml(htmlOptions);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large custom styles efficiently', () => {
      const largeStyles = '.test { ' + 'color: red; '.repeat(1000) + ' }';
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview as unknown as vscode.Webview,
        extensionUri: mockExtensionUri,
        customStyles: largeStyles,
      };

      const startTime = Date.now();
      const html = service.generateMainHtml(htmlOptions);
      const duration = Date.now() - startTime;

      expect(html).toContain(largeStyles);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined webview properties', () => {
      const mockWebviewMinimal = {
        asWebviewUri: vi.fn().mockReturnValue(vscode.Uri.parse('vscode-resource://test')),
        cspSource: null,
        html: '',
        options: {},
        onDidReceiveMessage: vi.fn(),
        postMessage: vi.fn(),
      };

      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebviewMinimal as unknown as vscode.Webview,
        extensionUri: mockExtensionUri,
      };

      // Should still generate HTML even with null cspSource
      const html = service.generateMainHtml(htmlOptions);
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should handle empty extension URI', () => {
      const emptyUri = vscode.Uri.parse('');
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview as unknown as vscode.Webview,
        extensionUri: emptyUri,
      };

      // Should handle gracefully through existing error handling
      expect(() => {
        service.generateMainHtml(htmlOptions);
      }).toThrow();
    });
  });

  describe('dispose', () => {
    it('should dispose without errors', () => {
      expect(() => {
        service.dispose();
      }).not.toThrow();
    });
  });
});
