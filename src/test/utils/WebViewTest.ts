import { BaseTest } from './BaseTest';
import * as sinon from 'sinon';

/**
 * Specialized base class for WebView-related tests
 *
 * Features:
 * - Mock WebView creation and messaging
 * - Message queue simulation
 * - WebView state management
 * - HTML content generation helpers
 *
 * Usage:
 * ```typescript
 * class MyWebViewTest extends WebViewTest {
 *   protected override setup(): void {
 *     super.setup();
 *     // Custom WebView setup
 *   }
 * }
 * ```
 */
export abstract class WebViewTest extends BaseTest {
  protected mockWebview!: MockWebview;
  protected messageQueue: any[] = [];

  protected override setup(): void {
    super.setup();

    // Create mock webview
    this.mockWebview = this.createMockWebview();
  }

  protected override teardown(): void {
    this.messageQueue = [];
    super.teardown();
  }

  /**
   * Create a mock webview with common methods
   */
  protected createMockWebview(): MockWebview {
    const postMessage = this.sandbox.stub().callsFake((message: any) => {
      this.messageQueue.push(message);
      return Promise.resolve();
    });

    return {
      postMessage,
      onDidReceiveMessage: this.sandbox.stub(),
      asWebviewUri: this.sandbox.stub().callsFake((uri: any) => uri),
      cspSource: 'mock-csp-source',
      html: '',
    };
  }

  /**
   * Simulate receiving a message from webview
   */
  protected simulateWebviewMessage(message: any): void {
    const handler = this.mockWebview.onDidReceiveMessage.getCall(0)?.args[0];
    if (handler) {
      handler(message);
    }
  }

  /**
   * Get messages posted to webview
   */
  protected getPostedMessages(): any[] {
    return this.messageQueue;
  }

  /**
   * Get last posted message
   */
  protected getLastPostedMessage(): any | undefined {
    return this.messageQueue[this.messageQueue.length - 1];
  }

  /**
   * Clear message queue
   */
  protected clearMessageQueue(): void {
    this.messageQueue = [];
    this.mockWebview.postMessage.resetHistory();
  }

  /**
   * Assert message was posted
   */
  protected assertMessagePosted(
    command: string,
    additionalChecks?: (message: any) => boolean
  ): void {
    const found = this.messageQueue.find((msg) => {
      if (msg.command !== command) return false;
      if (additionalChecks) return additionalChecks(msg);
      return true;
    });

    if (!found) {
      throw new Error(
        `Expected message with command "${command}" to be posted, ` +
        `but found: ${JSON.stringify(this.messageQueue.map((m) => m.command))}`
      );
    }
  }

  /**
   * Wait for message to be posted
   */
  protected async waitForMessage(
    command: string,
    timeout: number = 1000
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const message = this.messageQueue.find((m) => m.command === command);
      if (message) return message;

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error(
      `Timeout waiting for message with command "${command}". ` +
      `Found: ${JSON.stringify(this.messageQueue.map((m) => m.command))}`
    );
  }

  /**
   * Create mock HTML content
   */
  protected createMockHtml(bodyContent: string = ''): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test WebView</title>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
  }

  /**
   * Mock WebView ready state
   */
  protected setWebViewReady(ready: boolean = true): void {
    if (ready) {
      this.simulateWebviewMessage({ command: 'webviewReady' });
    }
  }
}

/**
 * Mock WebView interface
 */
export interface MockWebview {
  postMessage: sinon.SinonStub;
  onDidReceiveMessage: sinon.SinonStub;
  asWebviewUri: sinon.SinonStub;
  cspSource: string;
  html: string;
}
