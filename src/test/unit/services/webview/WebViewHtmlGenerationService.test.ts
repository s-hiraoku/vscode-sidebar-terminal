import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { 
  WebViewHtmlGenerationService, 
  HtmlGenerationOptions,
  FallbackHtmlOptions,
  ErrorHtmlOptions
} from '../../../../services/webview/WebViewHtmlGenerationService';

describe('WebViewHtmlGenerationService', () => {
  let service: WebViewHtmlGenerationService;
  let mockWebview: sinon.SinonStubbedInstance<vscode.Webview>;
  let mockExtensionUri: vscode.Uri;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create mock extension URI
    mockExtensionUri = vscode.Uri.parse('file:///test/extension');
    
    // Create mock webview
    mockWebview = {
      asWebviewUri: sandbox.stub(),
      cspSource: 'vscode-resource:',
      html: '',
      options: {},
      onDidReceiveMessage: sandbox.stub(),
      postMessage: sandbox.stub(),
    } as any;
    
    // Mock vscode.Uri.joinPath
    sandbox.stub(vscode.Uri, 'joinPath').returns(vscode.Uri.parse('file:///test/extension/dist/webview.js'));
    
    // Mock webview.asWebviewUri to return a proper URI
    mockWebview.asWebviewUri.returns(vscode.Uri.parse('vscode-resource://test/webview.js'));
    
    service = new WebViewHtmlGenerationService();
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });

  describe('Constructor', () => {
    it('should initialize service', () => {
      assert.ok(service);
    });
  });

  describe('generateMainHtml', () => {
    let htmlOptions: HtmlGenerationOptions;

    beforeEach(() => {
      htmlOptions = {
        webview: mockWebview,
        extensionUri: mockExtensionUri,
      };
    });

    it('should generate complete HTML structure', () => {
      const html = service.generateMainHtml(htmlOptions);
      
      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('<html lang="en">'));
      assert.ok(html.includes('<meta charset="UTF-8">'));
      assert.ok(html.includes('Content-Security-Policy'));
      assert.ok(html.includes('<div id="terminal-body">'));
      assert.ok(html.includes('window.vscodeApi'));
    });

    it('should include nonce in CSP and scripts', () => {
      const html = service.generateMainHtml(htmlOptions);
      
      // Extract nonce from CSP
      const cspMatch = html.match(/script-src 'nonce-([^']+)'/);
      assert.ok(cspMatch, 'CSP should include nonce');
      
      const nonce = cspMatch[1];
      assert.ok(nonce && nonce.length > 0, 'Nonce should not be empty');
      
      // Verify nonce is used in scripts
      assert.ok(html.includes(`nonce="${nonce}"`));
    });

    it('should include webview script URI', () => {
      const html = service.generateMainHtml(htmlOptions);
      
      assert.ok(html.includes('vscode-resource://test/webview.js'));
      assert.ok(mockWebview.asWebviewUri.calledOnce);
    });

    it('should include base styles by default', () => {
      const html = service.generateMainHtml(htmlOptions);
      
      assert.ok(html.includes('box-sizing: border-box'));
      assert.ok(html.includes('--vscode-editor-background'));
      assert.ok(html.includes('.terminal-container'));
    });

    it('should include split styles by default', () => {
      const html = service.generateMainHtml(htmlOptions);
      
      assert.ok(html.includes('.split-container'));
      assert.ok(html.includes('.terminal-pane'));
      assert.ok(html.includes('.splitter'));
    });

    it('should include CLI Agent styles by default', () => {
      const html = service.generateMainHtml(htmlOptions);
      
      assert.ok(html.includes('.claude-indicator'));
      assert.ok(html.includes('claude-connected'));
      assert.ok(html.includes('@keyframes blink'));
    });

    it('should exclude split styles when disabled', () => {
      htmlOptions.includeSplitStyles = false;
      const html = service.generateMainHtml(htmlOptions);
      
      assert.ok(!html.includes('.split-container'));
      assert.ok(!html.includes('.terminal-pane'));
    });

    it('should exclude CLI Agent styles when disabled', () => {
      htmlOptions.includeCliAgentStyles = false;
      const html = service.generateMainHtml(htmlOptions);
      
      assert.ok(!html.includes('.claude-indicator'));
      assert.ok(!html.includes('claude-connected'));
    });

    it('should include custom styles when provided', () => {
      const customStyles = '.custom-style { color: red; }';
      htmlOptions.customStyles = customStyles;
      
      const html = service.generateMainHtml(htmlOptions);
      
      assert.ok(html.includes(customStyles));
    });

    it('should throw error when script URI generation fails', () => {
      mockWebview.asWebviewUri.throws(new Error('URI generation failed'));
      
      assert.throws(() => {
        service.generateMainHtml(htmlOptions);
      }, /HTML generation failed/);
    });

    it('should handle webview.asWebviewUri errors gracefully', () => {
      (mockWebview.asWebviewUri as sinon.SinonStub).throws(new Error('Mock URI error'));
      
      assert.throws(() => {
        service.generateMainHtml(htmlOptions);
      }, /HTML generation failed.*Mock URI error/);
    });
  });

  describe('generateFallbackHtml', () => {
    it('should generate fallback HTML with default options', () => {
      const html = service.generateFallbackHtml();
      
      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('Terminal Loading...'));
      assert.ok(html.includes('Please wait while the terminal initializes'));
      assert.ok(html.includes('🔄'));
      assert.ok(html.includes('spinner'));
    });

    it('should use custom title and message', () => {
      const options: FallbackHtmlOptions = {
        title: 'Custom Loading',
        message: 'Custom message',
        isLoading: true
      };
      
      const html = service.generateFallbackHtml(options);
      
      assert.ok(html.includes('Custom Loading'));
      assert.ok(html.includes('Custom message'));
      assert.ok(html.includes('spinner'));
    });

    it('should not include spinner when not loading', () => {
      const options: FallbackHtmlOptions = {
        isLoading: false
      };
      
      const html = service.generateFallbackHtml(options);
      
      assert.ok(!html.includes('spinner'));
      assert.ok(html.includes('⚠️'));
    });

    it('should include proper VS Code CSS variables', () => {
      const html = service.generateFallbackHtml();
      
      assert.ok(html.includes('--vscode-editor-background'));
      assert.ok(html.includes('--vscode-foreground'));
      assert.ok(html.includes('--vscode-font-family'));
    });
  });

  describe('generateErrorHtml', () => {
    it('should generate error HTML with Error object', () => {
      const error = new Error('Test error message');
      const options: ErrorHtmlOptions = { error };
      
      const html = service.generateErrorHtml(options);
      
      assert.ok(html.includes('Terminal Error'));
      assert.ok(html.includes('❌'));
      assert.ok(html.includes('Test error message'));
      assert.ok(html.includes('Error Details'));
    });

    it('should generate error HTML with string error', () => {
      const error = 'String error message';
      const options: ErrorHtmlOptions = { error };
      
      const html = service.generateErrorHtml(options);
      
      assert.ok(html.includes('String error message'));
    });

    it('should include retry button when allowed', () => {
      const options: ErrorHtmlOptions = {
        error: new Error('Test error'),
        allowRetry: true
      };
      
      const html = service.generateErrorHtml(options);
      
      assert.ok(html.includes('Try Again'));
      assert.ok(html.includes('window.location.reload()'));
    });

    it('should not include retry button when not allowed', () => {
      const options: ErrorHtmlOptions = {
        error: new Error('Test error'),
        allowRetry: false
      };
      
      const html = service.generateErrorHtml(options);
      
      assert.ok(!html.includes('Try Again'));
    });

    it('should use custom error message when provided', () => {
      const options: ErrorHtmlOptions = {
        error: new Error('Original error'),
        customMessage: 'Custom error display'
      };
      
      const html = service.generateErrorHtml(options);
      
      assert.ok(html.includes('Custom error display'));
      // Original error should still be in details
      assert.ok(html.includes('Original error'));
    });

    it('should include proper error styling', () => {
      const options: ErrorHtmlOptions = { error: new Error('Test') };
      const html = service.generateErrorHtml(options);
      
      assert.ok(html.includes('--vscode-errorForeground'));
      assert.ok(html.includes('error-container'));
      assert.ok(html.includes('error-message'));
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
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should detect empty HTML', () => {
      const result = service.validateHtml('');
      
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('HTML content is empty'));
    });

    it('should detect missing DOCTYPE', () => {
      const html = '<html><body></body></html>';
      const result = service.validateHtml(html);
      
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('Missing DOCTYPE declaration'));
    });

    it('should detect missing charset', () => {
      const html = '<!DOCTYPE html><html><body></body></html>';
      const result = service.validateHtml(html);
      
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('Missing charset declaration'));
    });

    it('should detect missing CSP', () => {
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body></body>
</html>`;
      const result = service.validateHtml(html);
      
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('Missing Content Security Policy'));
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
      
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('Missing nonce for CSP'));
    });
  });

  describe('Error Handling', () => {
    it('should handle vscode.Uri.joinPath errors', () => {
      sandbox.restore(); // Remove the stub
      sandbox.stub(vscode.Uri, 'joinPath').throws(new Error('joinPath failed'));
      
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview,
        extensionUri: mockExtensionUri,
      };
      
      assert.throws(() => {
        service.generateMainHtml(htmlOptions);
      }, /HTML generation failed.*joinPath failed/);
    });
  });

  describe('Integration Tests', () => {
    it('should generate HTML that passes validation', () => {
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview,
        extensionUri: mockExtensionUri,
      };
      
      const html = service.generateMainHtml(htmlOptions);
      const validation = service.validateHtml(html);
      
      assert.strictEqual(validation.isValid, true, `Validation errors: ${validation.errors.join(', ')}`);
    });

    it('should generate consistent nonce across multiple generations', () => {
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview,
        extensionUri: mockExtensionUri,
      };
      
      const html1 = service.generateMainHtml(htmlOptions);
      const html2 = service.generateMainHtml(htmlOptions);
      
      // Extract nonces
      const nonce1Match = html1.match(/nonce="([^"]+)"/);
      const nonce2Match = html2.match(/nonce="([^"]+)"/);
      
      assert.ok(nonce1Match && nonce2Match);
      // Nonces should be different (security requirement)
      assert.notStrictEqual(nonce1Match[1], nonce2Match[1]);
    });

    it('should handle complete HTML generation lifecycle', () => {
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview,
        extensionUri: mockExtensionUri,
        includeSplitStyles: true,
        includeCliAgentStyles: true,
        customStyles: '.test { color: blue; }'
      };
      
      // Generate main HTML
      const mainHtml = service.generateMainHtml(htmlOptions);
      assert.ok(mainHtml.length > 1000);
      
      // Generate fallback HTML
      const fallbackHtml = service.generateFallbackHtml({
        title: 'Loading...',
        isLoading: true
      });
      assert.ok(fallbackHtml.includes('Loading...'));
      
      // Generate error HTML
      const errorHtml = service.generateErrorHtml({
        error: new Error('Test error'),
        allowRetry: true
      });
      assert.ok(errorHtml.includes('Test error'));
      
      // Validate all HTML
      assert.ok(service.validateHtml(mainHtml).isValid);
      assert.ok(service.validateHtml(fallbackHtml).isValid);
      assert.ok(service.validateHtml(errorHtml).isValid);
    });
  });

  describe('Performance Tests', () => {
    it('should generate HTML within reasonable time', () => {
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview,
        extensionUri: mockExtensionUri,
      };
      
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        service.generateMainHtml(htmlOptions);
      }
      
      const duration = Date.now() - startTime;
      assert.ok(duration < 1000, `HTML generation took ${duration}ms for 100 iterations`);
    });

    it('should handle large custom styles efficiently', () => {
      const largeStyles = '.test { ' + 'color: red; '.repeat(1000) + ' }';
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview,
        extensionUri: mockExtensionUri,
        customStyles: largeStyles
      };
      
      const startTime = Date.now();
      const html = service.generateMainHtml(htmlOptions);
      const duration = Date.now() - startTime;
      
      assert.ok(html.includes(largeStyles));
      assert.ok(duration < 100, `Large styles processing took ${duration}ms`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined webview properties', () => {
      const mockWebviewMinimal = {
        asWebviewUri: sandbox.stub().returns(vscode.Uri.parse('vscode-resource://test')),
        cspSource: null,
        html: '',
        options: {},
        onDidReceiveMessage: sandbox.stub(),
        postMessage: sandbox.stub(),
      } as any;
      
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebviewMinimal,
        extensionUri: mockExtensionUri,
      };
      
      // Should still generate HTML even with null cspSource
      const html = service.generateMainHtml(htmlOptions);
      assert.ok(html.includes('<!DOCTYPE html>'));
    });

    it('should handle empty extension URI', () => {
      const emptyUri = vscode.Uri.parse('');
      const htmlOptions: HtmlGenerationOptions = {
        webview: mockWebview,
        extensionUri: emptyUri,
      };
      
      // Should handle gracefully through existing error handling
      assert.throws(() => {
        service.generateMainHtml(htmlOptions);
      });
    });
  });

  describe('dispose', () => {
    it('should dispose without errors', () => {
      assert.doesNotThrow(() => {
        service.dispose();
      });
    });
  });
});