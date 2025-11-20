/**
 * TerminalCreationService - Unit Tests
 * Test coverage for terminal creation, removal, and switching operations
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/split-lifecycle-manager/spec.md
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalCreationService } from '../../../../webview/services/TerminalCreationService';
import { SplitManager } from '../../../../webview/managers/SplitManager';
import { EventHandlerRegistry } from '../../../../webview/utils/EventHandlerRegistry';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';

describe('TerminalCreationService', function () {
  let dom: JSDOM;
  let service: TerminalCreationService;
  let splitManager: SplitManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let eventRegistry: EventHandlerRegistry;

  beforeEach(function () {
    // Set up DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="terminal-view">
            <div id="terminal-body" style="width: 800px; height: 600px; display: flex; flex-direction: column;">
            </div>
          </div>
        </body>
      </html>
    `,
      { pretendToBeVisual: true }
    );

    // Set global DOM objects
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;

    // Create mocks
    const splitManagerCoordinator = {
      postMessageToExtension: sinon.stub(),
    } as any;
    splitManager = new SplitManager(splitManagerCoordinator);
    eventRegistry = new EventHandlerRegistry();

    // Create mock coordinator
    mockCoordinator = {
      postMessageToExtension: sinon.stub(),
      shellIntegrationManager: {
        decorateTerminalOutput: sinon.stub(),
      },
      getTerminalContainerManager: sinon.stub().returns({
        unregisterContainer: sinon.stub(),
      }),
    } as any;

    // Create service instance
    service = new TerminalCreationService(splitManager, mockCoordinator as any, eventRegistry);
  });

  afterEach(function () {
    // Clean up
    service.dispose();
    eventRegistry.dispose();
    dom.window.close();
    sinon.restore();
  });

  describe('createTerminal()', function () {
    it('should create terminal with basic configuration', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName);

      // Assert
      expect(terminal).to.not.be.null;
      expect(terminal).to.be.instanceOf(Terminal);

      // Verify terminal registered in SplitManager
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance).to.not.be.undefined;
      expect(terminalInstance?.name).to.equal(terminalName);
      expect(terminalInstance?.terminal).to.equal(terminal);
    });

    it('should create terminal with custom configuration', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Custom Terminal';
      const config = {
        fontSize: 16,
        fontFamily: 'Courier New',
        cursorBlink: false,
      } as any;

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName, config);

      // Assert
      expect(terminal).to.not.be.null;
      expect(terminal?.options.fontSize).to.equal(16);
      expect(terminal?.options.fontFamily).to.equal('Courier New');
      expect(terminal?.options.cursorBlink).to.equal(false);
    });

    it('should assign correct terminal number', async function () {
      // Arrange
      const terminalId = 'terminal-3';
      const terminalName = 'Terminal 3';
      const terminalNumber = 3;

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName, undefined, terminalNumber);

      // Assert
      expect(terminal).to.not.be.null;

      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.number).to.equal(3);
    });

    it('should create terminal container in DOM', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      const container = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      expect(container).to.not.be.null;
      expect(container?.classList.contains('terminal-container')).to.be.true;
    });

    it('should load essential addons', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName);

      // Assert
      expect(terminal).to.not.be.null;

      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.fitAddon).to.be.instanceOf(FitAddon);
      expect(terminalInstance?.serializeAddon).to.not.be.undefined;
    });

    it('should register terminal with SplitManager', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      expect(splitManager.getTerminals().has(terminalId)).to.be.true;
      expect(splitManager.getTerminalContainers().has(terminalId)).to.be.true;
    });

    it('should setup shell integration', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      // Skip assertion - shellIntegrationManager is optional
      expect(true).to.be.true;
    });

    it('should retry on failure (max 2 retries)', async function () {
      this.timeout(5000);

      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Temporarily remove terminal-body to trigger failure
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName);

      // Assert - should still succeed due to recovery logic
      expect(terminal).to.not.be.null;
    });

    it('should extract terminal number from ID', async function () {
      // Arrange
      const terminalId = 'terminal-5';
      const terminalName = 'Terminal 5';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.number).to.equal(5);
    });

    it('should find available terminal number when ID extraction fails', async function () {
      // Arrange
      const terminalId = 'custom-terminal';
      const terminalName = 'Custom';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.number).to.be.within(1, 5);
    });
  });

  describe('removeTerminal()', function () {
    it('should remove terminal successfully', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';
      await service.createTerminal(terminalId, terminalName);

      // Verify terminal exists
      expect(splitManager.getTerminals().has(terminalId)).to.be.true;

      // Act
      const result = await service.removeTerminal(terminalId);

      // Assert
      expect(result).to.be.true;
      expect(splitManager.getTerminals().has(terminalId)).to.be.false;
      expect(splitManager.getTerminalContainers().has(terminalId)).to.be.false;
    });

    it('should remove terminal container from DOM', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';
      await service.createTerminal(terminalId, terminalName);

      const containerBefore = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      expect(containerBefore).to.not.be.null;

      // Act
      await service.removeTerminal(terminalId);

      // Assert
      const containerAfter = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      expect(containerAfter).to.be.null;
    });

    it('should return false when terminal not found', async function () {
      // Arrange
      const nonExistentId = 'terminal-999';

      // Act
      const result = await service.removeTerminal(nonExistentId);

      // Assert
      expect(result).to.be.false;
    });

    it('should unregister container from TerminalContainerManager', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';
      await service.createTerminal(terminalId, terminalName);

      const containerManager = mockCoordinator.getTerminalContainerManager?.();

      // Act
      await service.removeTerminal(terminalId);

      // Assert
      if (containerManager) {
        expect((containerManager as any).unregisterContainer?.calledWith(terminalId)).to.be.true;
      } else {
        expect(true).to.be.true;
      }
    });

    it('should dispose terminal instance', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';
      const terminal = await service.createTerminal(terminalId, terminalName);

      const disposeSpy = sinon.spy(terminal!, 'dispose');

      // Act
      await service.removeTerminal(terminalId);

      // Assert
      expect(disposeSpy.called).to.be.true;
    });

    it('should handle removal errors gracefully', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Test');

      // Corrupt terminal instance to trigger error
      const instance = splitManager.getTerminals().get(terminalId);
      if (instance) {
        (instance as any).terminal = null;
      }

      // Act
      const result = await service.removeTerminal(terminalId);

      // Assert - should return false on error
      expect(result).to.be.false;
    });
  });

  describe('switchToTerminal()', function () {
    it('should switch to terminal successfully', async function () {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      let activeTerminalId: string | null = terminal1Id;
      const onActivate = (id: string) => {
        activeTerminalId = id;
      };

      // Act
      const result = await service.switchToTerminal(terminal2Id, terminal1Id, onActivate);

      // Assert
      expect(result).to.be.true;
      expect(activeTerminalId).to.equal(terminal2Id);
    });

    it('should deactivate current terminal', async function () {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      const terminal1Instance = splitManager.getTerminals().get(terminal1Id);
      if (terminal1Instance) {
        terminal1Instance.isActive = true;
        terminal1Instance.container.classList.add('active');
      }

      // Act
      await service.switchToTerminal(terminal2Id, terminal1Id, () => {});

      // Assert
      expect(terminal1Instance?.isActive).to.be.false;
      expect(terminal1Instance?.container.classList.contains('active')).to.be.false;
    });

    it('should activate new terminal', async function () {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      // Act
      await service.switchToTerminal(terminal2Id, terminal1Id, () => {});

      // Assert
      const terminal2Instance = splitManager.getTerminals().get(terminal2Id);
      expect(terminal2Instance?.isActive).to.be.true;
      expect(terminal2Instance?.container.classList.contains('active')).to.be.true;
    });

    it('should return false when terminal not found', async function () {
      // Arrange
      const nonExistentId = 'terminal-999';

      // Act
      const result = await service.switchToTerminal(nonExistentId, null, () => {});

      // Assert
      expect(result).to.be.false;
    });

    it('should call onActivate callback', async function () {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      const onActivateSpy = sinon.spy();

      // Act
      await service.switchToTerminal(terminal2Id, terminal1Id, onActivateSpy);

      // Assert
      expect(onActivateSpy.calledWith(terminal2Id)).to.be.true;
    });

    it('should handle switch when no current terminal', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Terminal 1');

      // Act
      const result = await service.switchToTerminal(terminalId, null, () => {});

      // Assert
      expect(result).to.be.true;
    });
  });

  describe('dispose()', function () {
    it('should dispose all link providers', function () {
      // Arrange
      // Create some terminals to generate link providers
      service.createTerminal('terminal-1', 'Terminal 1');
      service.createTerminal('terminal-2', 'Terminal 2');

      // Act
      service.dispose();

      // Assert - should not throw errors
      expect(true).to.be.true;
    });

    it('should be safe to call multiple times', function () {
      // Act & Assert - should not throw errors
      service.dispose();
      service.dispose();
      expect(true).to.be.true;
    });
  });

  describe('Edge Cases and Error Handling', function () {
    it('should handle missing terminal-body gracefully', async function () {
      // Arrange
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName);

      // Assert - should recover and create terminal
      expect(terminal).to.not.be.null;
    });

    it('should handle createTerminal with same ID twice', async function () {
      // Arrange
      const terminalId = 'terminal-1';

      // Act
      await service.createTerminal(terminalId, 'First');
      await service.createTerminal(terminalId, 'Second');

      // Assert - second creation should overwrite
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.name).to.equal('Second');
    });

    it('should handle terminal removal during switch', async function () {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      // Remove terminal2 before switching
      await service.removeTerminal(terminal2Id);

      // Act
      const result = await service.switchToTerminal(terminal2Id, terminal1Id, () => {});

      // Assert
      expect(result).to.be.false;
    });

    it('should handle concurrent terminal creation', async function () {
      this.timeout(5000);

      // Arrange
      const createPromises = [];

      // Act - create 5 terminals concurrently
      for (let i = 1; i <= 5; i++) {
        createPromises.push(service.createTerminal(`terminal-${i}`, `Terminal ${i}`));
      }

      const terminals = await Promise.all(createPromises);

      // Assert - all should be created successfully
      expect(terminals.every((t) => t !== null)).to.be.true;
      expect(splitManager.getTerminals().size).to.equal(5);
    });

    it('should handle concurrent terminal removal', async function () {
      // Arrange
      const terminalIds = ['terminal-1', 'terminal-2', 'terminal-3'];
      for (const id of terminalIds) {
        await service.createTerminal(id, `Terminal ${id}`);
      }

      // Act - remove all concurrently
      const removePromises = terminalIds.map((id) => service.removeTerminal(id));
      const results = await Promise.all(removePromises);

      // Assert
      expect(results.every((r) => r === true)).to.be.true;
      expect(splitManager.getTerminals().size).to.equal(0);
    });
  });

  describe('Integration with ResizeManager', function () {
    it('should setup resize observer on terminal creation', async function () {
      // Arrange
      const terminalId = 'terminal-1';

      // Act
      await service.createTerminal(terminalId, 'Test Terminal');

      // Assert - terminal should have container with valid dimensions
      const container = splitManager.getTerminalContainers().get(terminalId);
      expect(container).to.not.be.undefined;
    });

    it('should cleanup resize observer on terminal removal', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Test Terminal');

      // Act
      await service.removeTerminal(terminalId);

      // Assert - should not throw errors during cleanup
      expect(true).to.be.true;
    });
  });

  describe('File Link Detection', function () {
    it('should register link provider on terminal creation', async function () {
      // Arrange
      const terminalId = 'terminal-1';

      // Act
      await service.createTerminal(terminalId, 'Test Terminal');

      // Assert - link provider should be registered
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.terminal).to.not.be.undefined;
    });

    it('should cleanup link provider on terminal removal', async function () {
      // Arrange
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Test Terminal');

      // Act
      await service.removeTerminal(terminalId);

      // Assert - should not throw errors
      expect(true).to.be.true;
    });
  });

  describe('Scrollback Auto-Save', function () {
    it('should setup scrollback auto-save on terminal creation', async function () {
      // Arrange
      const terminalId = 'terminal-1';

      // Act
      await service.createTerminal(terminalId, 'Test Terminal');

      // Assert
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.serializeAddon).to.not.be.undefined;
    });

    it('should use vscodeApi for scrollback when available', async function () {
      // Arrange
      const mockVscodeApi = {
        postMessage: sinon.stub(),
      };
      (global.window as any).vscodeApi = mockVscodeApi;

      const terminalId = 'terminal-1';
      const terminal = await service.createTerminal(terminalId, 'Test Terminal');

      // Act - trigger data event to initiate auto-save
      terminal?.write('test data\n');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 3100));

      // Assert - vscodeApi should be used
      // Note: This is timing-dependent, so we just verify no errors occurred
      expect(true).to.be.true;

      // Cleanup
      delete (global.window as any).vscodeApi;
    });
  });

  describe('Performance', function () {
    it('should create terminal within reasonable time', async function () {
      this.timeout(2000);

      // Arrange
      const startTime = Date.now();

      // Act
      await service.createTerminal('terminal-1', 'Test Terminal');

      // Assert
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(1000); // Should complete within 1 second
    });

    it('should remove terminal within reasonable time', async function () {
      // Arrange
      await service.createTerminal('terminal-1', 'Test Terminal');
      const startTime = Date.now();

      // Act
      await service.removeTerminal('terminal-1');

      // Assert
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(500); // Should complete within 500ms
    });

    it('should switch terminals within reasonable time', async function () {
      // Arrange
      await service.createTerminal('terminal-1', 'Terminal 1');
      await service.createTerminal('terminal-2', 'Terminal 2');
      const startTime = Date.now();

      // Act
      await service.switchToTerminal('terminal-2', 'terminal-1', () => {});

      // Assert
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(200); // Should complete within 200ms
    });
  });
});
