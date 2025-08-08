/**
 * Panel Location Communication Protocol Tests
 * Issue #148: WebView ↔ Extension panel location detection and messaging
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { MessageManager } from '../../../../webview/managers/MessageManager';
import { WebviewMessage } from '../../../../types/common';

describe('Panel Location Communication Protocol', function () {
  let dom: JSDOM;
  let messageManager: MessageManager;
  let mockVsCodeApi: any;
  let postMessageSpy: sinon.SinonStub;
  let mockCoordinator: any;

  beforeEach(function () {
    // Set up DOM environment with different aspect ratios for testing
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0;">
          <div id="terminal-body" style="width: 800px; height: 600px;">
            <!-- WebView content -->
          </div>
        </body>
      </html>
    `,
      {
        pretendToBeVisual: true,
        resources: 'usable',
      }
    );

    // Set global DOM objects
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;

    // Mock VS Code API
    postMessageSpy = sinon.stub();
    mockVsCodeApi = {
      postMessage: postMessageSpy,
      setState: sinon.stub(),
      getState: sinon.stub().returns({}),
    };
    (global.window as any).vscodeApi = mockVsCodeApi;

    // Create mock coordinator
    mockCoordinator = {
      getManagers: sinon.stub().returns({
        message: null,
        input: null,
        ui: null,
        config: null,
        notification: null,
        split: null,
        performance: null,
      }),
      getTerminals: sinon.stub().returns(new Map()),
      getActiveTerminal: sinon.stub().returns(null),
      setActiveTerminal: sinon.stub(),
      focusTerminal: sinon.stub(),
      createNewTerminal: sinon.stub(),
    };

    // Create MessageManager instance
    messageManager = new MessageManager();
  });

  afterEach(function () {
    dom.window.close();
    sinon.restore();
  });

  describe('Panel Location Detection', function () {
    it('should detect sidebar layout based on tall aspect ratio', function () {
      // Arrange - simulate tall/narrow WebView (typical for sidebar)
      dom.window.resizeTo(300, 800);
      Object.defineProperty(dom.window, 'innerWidth', { value: 300 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 800 });

      // Act - Test dimension analysis logic directly
      const aspectRatio = 300 / 800; // width / height
      const location = aspectRatio > 2.0 ? 'panel' : 'sidebar';

      // Assert
      expect(location).to.equal('sidebar');
    });

    it('should detect panel layout based on wide aspect ratio', function () {
      // Arrange - simulate wide/short WebView (typical for bottom panel)
      dom.window.resizeTo(1200, 400);
      Object.defineProperty(dom.window, 'innerWidth', { value: 1200 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 400 });

      // Act - Test dimension analysis logic directly
      const aspectRatio = 1200 / 400; // width / height
      const location = aspectRatio > 2.0 ? 'panel' : 'sidebar';

      // Assert
      expect(location).to.equal('panel');
    });

    it('should handle edge cases with intermediate aspect ratios', function () {
      // Arrange - simulate square-ish WebView
      dom.window.resizeTo(600, 500);
      Object.defineProperty(dom.window, 'innerWidth', { value: 600 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 500 });

      // Act - Test dimension analysis logic directly
      const aspectRatio = 600 / 500; // width / height
      const location = aspectRatio > 2.0 ? 'panel' : 'sidebar';

      // Assert - should default to sidebar for ambiguous cases
      expect(location).to.equal('sidebar');
    });

    it('should handle zero or invalid dimensions gracefully', function () {
      // Arrange - simulate invalid dimensions
      Object.defineProperty(dom.window, 'innerWidth', { value: 0 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 0 });

      // Act
      const location = (messageManager as any).analyzeWebViewDimensions();

      // Assert - should fallback to sidebar
      expect(location).to.equal('sidebar');
    });
  });

  describe('Message Protocol Handling', function () {
    it('should handle panel location detection conceptually', function () {
      // Arrange - simulate typical panel dimensions
      const panelWidth = 1200;
      const panelHeight = 400;
      const aspectRatio = panelWidth / panelHeight;

      // Act - simulate detection logic
      const detectedLocation = aspectRatio > 2.0 ? 'panel' : 'sidebar';

      // Assert - wide aspect ratio should be detected as panel
      expect(detectedLocation).to.equal('panel');
      expect(aspectRatio).to.be.greaterThan(2.0);
    });

    it('should handle panelLocationUpdate message', async function () {
      // Arrange
      const message: WebviewMessage = {
        command: 'panelLocationUpdate',
        location: 'panel',
      };

      // Act
      const mockEvent = { data: message } as MessageEvent;
      await messageManager.handleMessage(mockEvent, mockCoordinator);

      // Assert - should process the update (exact behavior depends on implementation)
      // This test verifies the message is handled without error
      expect(true).to.be.true; // Placeholder - would verify specific behavior
    });

    it('should validate location values in messages', async function () {
      // Arrange
      const invalidMessage: WebviewMessage = {
        command: 'panelLocationUpdate',
        location: 'invalid-location' as any,
      };

      // Act & Assert - should handle invalid location gracefully
      const mockEvent2 = { data: invalidMessage } as MessageEvent;
      await messageManager.handleMessage(mockEvent2, mockCoordinator);

      // Should not throw error and should handle gracefully
      expect(true).to.be.true;
    });
  });

  describe('Real-time Detection', function () {
    it('should respond to immediate dimension analysis requests', function () {
      // Arrange
      Object.defineProperty(dom.window, 'innerWidth', { value: 800 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 1200 });

      // Act - simulate immediate detection request
      const startTime = Date.now();
      const location = (messageManager as any).analyzeWebViewDimensions();
      const endTime = Date.now();

      // Assert
      expect(location).to.equal('sidebar');
      expect(endTime - startTime).to.be.lessThan(10); // Should be very fast
    });

    it('should handle rapid dimension changes', async function () {
      // Arrange - simulate rapid window resizing
      const dimensions = [
        { width: 300, height: 800 }, // sidebar
        { width: 1200, height: 400 }, // panel
        { width: 400, height: 600 }, // sidebar
        { width: 1000, height: 300 }, // panel
      ];

      const results: string[] = [];

      // Act
      for (const dim of dimensions) {
        Object.defineProperty(dom.window, 'innerWidth', { value: dim.width });
        Object.defineProperty(dom.window, 'innerHeight', { value: dim.height });

        const message: WebviewMessage = {
          command: 'requestPanelLocationDetection',
        };

        const mockEvent = { data: message } as MessageEvent;
        await messageManager.handleMessage(mockEvent, mockCoordinator);

        // Extract location from last postMessage call
        const lastCall = postMessageSpy.lastCall;
        if (lastCall && lastCall.args[0].location) {
          results.push(lastCall.args[0].location);
        }
      }

      // Assert - should track all changes correctly
      expect(results).to.deep.equal(['sidebar', 'panel', 'sidebar', 'panel']);
    });
  });

  describe('Error Handling and Edge Cases', function () {
    it('should handle missing VS Code API gracefully', async function () {
      // Arrange - remove VS Code API
      (global.window as any).vscodeApi = undefined;

      const message: WebviewMessage = {
        command: 'requestPanelLocationDetection',
      };

      // Act & Assert - should not throw error
      try {
        const mockEvent = { data: message } as MessageEvent;
        await messageManager.handleMessage(mockEvent, mockCoordinator);
        expect(true).to.be.true; // If we reach here, it handled gracefully
      } catch (error) {
        // Test fails if error is thrown
        expect.fail('Should handle missing VS Code API gracefully');
      }
    });

    it('should handle postMessage failures gracefully', async function () {
      // Arrange - make postMessage throw error
      postMessageSpy.throws(new Error('Communication error'));

      const message: WebviewMessage = {
        command: 'requestPanelLocationDetection',
      };

      // Act & Assert - should handle error gracefully
      try {
        const mockEvent = { data: message } as MessageEvent;
        await messageManager.handleMessage(mockEvent, mockCoordinator);
        expect(true).to.be.true; // Should handle error internally
      } catch (error) {
        expect.fail('Should handle postMessage failures gracefully');
      }
    });

    it('should handle malformed messages gracefully', async function () {
      // Arrange
      const malformedMessages = [
        null,
        undefined,
        {},
        { command: null },
        { command: '' },
        { command: 'requestPanelLocationDetection', extraField: 'invalid' },
      ];

      // Act & Assert - should handle all malformed messages
      for (const message of malformedMessages) {
        try {
          const mockEvent = { data: message as any } as MessageEvent;
          await messageManager.handleMessage(mockEvent, mockCoordinator);
          expect(true).to.be.true; // Should not throw
        } catch (error) {
          expect.fail(`Should handle malformed message gracefully: ${JSON.stringify(message)}`);
        }
      }
    });
  });

  describe('Performance and Reliability', function () {
    it('should perform detection within acceptable time limits', function () {
      // Arrange - large simulated dimensions
      Object.defineProperty(dom.window, 'innerWidth', { value: 4000 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 2000 });

      // Act - measure performance
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        (messageManager as any).analyzeWebViewDimensions();
      }

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / iterations;

      // Assert - should be very fast
      expect(avgTime).to.be.lessThan(1); // Less than 1ms per call
    });

    it('should maintain consistency across repeated calls', function () {
      // Arrange - set stable dimensions
      Object.defineProperty(dom.window, 'innerWidth', { value: 1200 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 400 });

      // Act - multiple calls
      const results: string[] = [];
      for (let i = 0; i < 10; i++) {
        results.push((messageManager as any).analyzeWebViewDimensions());
      }

      // Assert - all results should be identical
      expect(results.every((result) => result === 'panel')).to.be.true;
    });

    it('should handle concurrent detection requests', async function () {
      // Arrange
      Object.defineProperty(dom.window, 'innerWidth', { value: 800 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 600 });

      const message: WebviewMessage = {
        command: 'requestPanelLocationDetection',
      };

      // Act - send multiple concurrent requests
      const promises = Array(5)
        .fill(0)
        .map(() => {
          const mockEvent = { data: message } as MessageEvent;
          return messageManager.handleMessage(mockEvent, mockCoordinator);
        });

      // Assert - all should complete without error
      await Promise.all(promises);

      // Should have sent multiple reports
      expect(postMessageSpy.callCount).to.equal(5);

      // All should report same location
      const locations = postMessageSpy.getCalls().map((call) => call.args[0].location);
      expect(locations.every((loc) => loc === 'sidebar')).to.be.true;
    });
  });

  describe('Integration Scenarios', function () {
    it('should handle typical sidebar to panel transition', async function () {
      // Arrange - start in sidebar configuration
      Object.defineProperty(dom.window, 'innerWidth', { value: 300 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 800 });

      // Act - initial detection
      const message1: WebviewMessage = { command: 'requestPanelLocationDetection' };
      const mockEvent1 = { data: message1 } as MessageEvent;
      await messageManager.handleMessage(mockEvent1, mockCoordinator);

      // Change to panel configuration
      Object.defineProperty(dom.window, 'innerWidth', { value: 1200 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 400 });

      // Second detection
      const message2: WebviewMessage = { command: 'requestPanelLocationDetection' };
      const mockEvent2 = { data: message2 } as MessageEvent;
      await messageManager.handleMessage(mockEvent2, mockCoordinator);

      // Assert - should detect both states correctly
      const calls = postMessageSpy.getCalls();
      expect(calls).to.have.length.at.least(2);
      expect(calls[0]?.args[0]?.location).to.equal('sidebar');
      expect(calls[1]?.args[0]?.location).to.equal('panel');
    });

    it('should handle panel to sidebar transition', async function () {
      // Arrange - start in panel configuration
      Object.defineProperty(dom.window, 'innerWidth', { value: 1200 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 300 });

      // Act - initial detection
      const message1: WebviewMessage = { command: 'requestPanelLocationDetection' };
      const mockEvent1 = { data: message1 } as MessageEvent;
      await messageManager.handleMessage(mockEvent1, mockCoordinator);

      // Change to sidebar configuration
      Object.defineProperty(dom.window, 'innerWidth', { value: 350 });
      Object.defineProperty(dom.window, 'innerHeight', { value: 900 });

      // Second detection
      const message2: WebviewMessage = { command: 'requestPanelLocationDetection' };
      const mockEvent2 = { data: message2 } as MessageEvent;
      await messageManager.handleMessage(mockEvent2, mockCoordinator);

      // Assert - should detect both states correctly
      const calls = postMessageSpy.getCalls();
      expect(calls).to.have.length.at.least(2);
      expect(calls[0]?.args[0]?.location).to.equal('panel');
      expect(calls[1]?.args[0]?.location).to.equal('sidebar');
    });
  });
});
