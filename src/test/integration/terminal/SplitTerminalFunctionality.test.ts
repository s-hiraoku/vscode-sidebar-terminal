/**
 * Integration Tests for Split Terminal Functionality - Following t-wada's TDD Methodology
 *
 * These tests verify the complete split terminal system:
 * - Terminal layout management and positioning
 * - Split operations (horizontal, vertical, grid)
 * - Panel location detection and adaptation
 * - Terminal focus and activation flow
 * - Resource management during splits
 * - Performance characteristics of split operations
 *
 * TDD Integration Approach:
 * 1. RED: Write failing tests for complete split workflows
 * 2. GREEN: Implement split coordination between components
 * 3. REFACTOR: Optimize split operations while maintaining functionality
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupTestEnvironment, resetTestEnvironment, mockVscode } from '../../shared/TestSetup';
import { SplitManager } from '../../../webview/managers/SplitManager';
import { TerminalLifecycleManager } from '../../../webview/managers/TerminalLifecycleManager';
import { UIManager } from '../../../webview/managers/UIManager';

describe('Split Terminal Functionality - Integration TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let splitManager: SplitManager;
  let lifecycleManager: TerminalLifecycleManager;
  let uiManager: UIManager;
  let mockCoordinator: any;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();

    // Create mock terminal container
    mockContainer = document.createElement('div');
    mockContainer.id = 'terminal-container';
    mockContainer.style.width = '800px';
    mockContainer.style.height = '600px';
    document.body.appendChild(mockContainer);

    // Mock coordinator
    mockCoordinator = {
      getManager: sandbox.stub(),
      isReady: sandbox.stub().returns(true),
      dispose: sandbox.stub(),
      initialize: sandbox.stub(),
      getContainer: sandbox.stub().returns(mockContainer),
      logger: sandbox.stub()
    };

    // Initialize managers
    splitManager = new SplitManager();
    lifecycleManager = new TerminalLifecycleManager(splitManager, mockCoordinator);
    uiManager = new UIManager();

    // Setup coordinator responses
    mockCoordinator.getManager.withArgs('SplitManager').returns(splitManager);
    mockCoordinator.getManager.withArgs('TerminalLifecycleManager').returns(lifecycleManager);
    mockCoordinator.getManager.withArgs('UIManager').returns(uiManager);
  });

  afterEach(() => {
    resetTestEnvironment();
    if (mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
    splitManager.dispose();
    lifecycleManager.dispose();
    uiManager.dispose();
    sandbox.restore();
  });

  describe('Terminal Split Operations', () => {

    describe('RED Phase - Basic Split Functionality', () => {

      it('should create horizontal split from single terminal', async () => {
        // RED: Horizontal split should create two terminal instances

        // Step 1: Create initial terminal
        const initialTerminal = await lifecycleManager.createTerminal(
          'terminal-1',
          'Initial Terminal',
          { cwd: process.cwd() }
        );

        expect(initialTerminal).to.exist;
        expect(initialTerminal).to.not.be.null;
        if (!initialTerminal) throw new Error('Terminal creation failed');
        expect(initialTerminal.id).to.be.a('string');

        // Step 2: Perform horizontal split
        splitManager.splitTerminal('horizontal');

        // Step 3: Verify split mode is enabled
        expect(splitManager.getIsSplitMode()).to.be.true;

        // Step 4: Verify DOM structure
        const splitContainers = mockContainer.querySelectorAll('.split-container');
        expect(splitContainers).to.have.length(2);

        const topContainer = splitContainers[0] as HTMLElement;
        const bottomContainer = splitContainers[1] as HTMLElement;

        expect(topContainer.style.height).to.equal('50%');
        expect(bottomContainer.style.height).to.equal('50%');
      });

      it('should create vertical split from single terminal', async () => {
        // RED: Vertical split should create side-by-side terminals

        // Step 1: Create initial terminal
        const initialTerminal = await lifecycleManager.createTerminal(
          'terminal-1',
          'Initial Terminal',
          { cwd: process.cwd() }
        );

        // Step 2: Perform vertical split
        const splitResult = await splitManager.splitVertical(initialTerminal.id);

        expect(splitResult.success).to.be.true;
        expect(splitResult.newTerminalId).to.be.a('string');

        // Step 3: Verify layout structure
        const layout = splitManager.getCurrentLayout();
        expect(layout.type).to.equal('vertical');
        expect(layout.terminals).to.have.length(2);

        // Step 4: Verify DOM structure
        const splitContainers = mockContainer.querySelectorAll('.split-container');
        expect(splitContainers).to.have.length(2);

        const leftContainer = splitContainers[0] as HTMLElement;
        const rightContainer = splitContainers[1] as HTMLElement;

        expect(leftContainer.style.width).to.equal('50%');
        expect(rightContainer.style.width).to.equal('50%');
      });

      it('should create complex grid layout with multiple splits', async () => {
        // RED: Multiple splits should create grid layout

        // Step 1: Create initial terminal
        const terminal1 = await lifecycleManager.createTerminal({ name: 'Terminal 1' });

        // Step 2: Create first split (horizontal)
        const horizontalSplit = await splitManager.splitHorizontal(terminal1.id);
        const terminal2Id = horizontalSplit.newTerminalId;

        // Step 3: Split top terminal vertically
        const verticalSplit1 = await splitManager.splitVertical(terminal1.id);
        const _terminal3Id = verticalSplit1.newTerminalId;

        // Step 4: Split bottom terminal vertically
        const verticalSplit2 = await splitManager.splitVertical(terminal2Id);
        const _terminal4Id = verticalSplit2.newTerminalId;

        // Step 5: Verify complex layout
        const layout = splitManager.getCurrentLayout();
        expect(layout.type).to.equal('grid');
        expect(layout.terminals).to.have.length(4);

        // Step 6: Verify grid structure (2x2)
        const gridContainers = mockContainer.querySelectorAll('.grid-item');
        expect(gridContainers).to.have.length(4);

        // Each grid item should be 50% x 50%
        gridContainers.forEach((container) => {
          const element = container as HTMLElement;
          expect(element.style.width).to.equal('50%');
          expect(element.style.height).to.equal('50%');
        });
      });

      it('should handle terminal focus across split panes', async () => {
        // RED: Focus should move correctly between split terminals

        // Step 1: Create split terminal setup
        const terminal1 = await lifecycleManager.createTerminal({ name: 'Terminal 1' });
        const splitResult = await splitManager.splitHorizontal(terminal1.id);
        const terminal2Id = splitResult.newTerminalId;

        // Step 2: Focus first terminal
        await splitManager.focusTerminal(terminal1.id);
        let activeTerminal = splitManager.getActiveTerminal();
        expect(activeTerminal?.id).to.equal(terminal1.id);

        // Step 3: Focus second terminal
        await splitManager.focusTerminal(terminal2Id);
        activeTerminal = splitManager.getActiveTerminal();
        expect(activeTerminal?.id).to.equal(terminal2Id);

        // Step 4: Navigate with keyboard shortcuts
        await splitManager.focusNext();
        activeTerminal = splitManager.getActiveTerminal();
        expect(activeTerminal?.id).to.equal(terminal1.id); // Should cycle back

        await splitManager.focusPrevious();
        activeTerminal = splitManager.getActiveTerminal();
        expect(activeTerminal?.id).to.equal(terminal2Id); // Should go back
      });

    });

  });

  describe('Panel Location Detection and Adaptation', () => {

    describe('RED Phase - Location-Aware Split Behavior', () => {

      it('should detect sidebar panel location and adjust layout', async () => {
        // RED: Split behavior should adapt to panel location

        // Mock sidebar panel location
        mockVscode.window.activeTerminal = {
          creationOptions: { location: { viewColumn: -1 } } // Sidebar
        };

        const terminal = await lifecycleManager.createTerminal({ name: 'Sidebar Terminal' });

        // Sidebar should prefer vertical splits for better space utilization
        const splitResult = await splitManager.autoSplit(terminal.id);

        expect(splitResult.success).to.be.true;
        expect(splitResult.splitType).to.equal('vertical');

        const layout = splitManager.getCurrentLayout();
        expect(layout.adaptedForLocation).to.equal('sidebar');
      });

      it('should detect panel location and optimize split orientation', async () => {
        // RED: Panel location should influence split decisions

        // Mock panel at bottom
        mockVscode.window.activeTerminal = {
          creationOptions: { location: { viewColumn: 'bottom' } }
        };

        const terminal = await lifecycleManager.createTerminal({ name: 'Panel Terminal' });

        // Bottom panel should prefer horizontal splits
        const splitResult = await splitManager.autoSplit(terminal.id);

        expect(splitResult.success).to.be.true;
        expect(splitResult.splitType).to.equal('horizontal');

        const layout = splitManager.getCurrentLayout();
        expect(layout.adaptedForLocation).to.equal('panel');
      });

      it('should handle panel size constraints for split operations', async () => {
        // RED: Split operations should respect panel size limits

        // Mock small panel
        mockContainer.style.width = '300px';
        mockContainer.style.height = '200px';

        const terminal = await lifecycleManager.createTerminal({ name: 'Small Panel Terminal' });

        // Should prevent split when panel is too small
        const splitResult = await splitManager.splitVertical(terminal.id);

        expect(splitResult.success).to.be.false;
        expect(splitResult.reason).to.include('insufficient space');

        // Should suggest alternative
        expect(splitResult.suggestion).to.equal('horizontal');
      });

      it('should adapt split layout when panel is resized', async () => {
        // RED: Layout should adapt to panel resize events

        const terminal1 = await lifecycleManager.createTerminal({ name: 'Terminal 1' });
        const _splitResult = await splitManager.splitVertical(terminal1.id);

        // Verify initial vertical layout
        let layout = splitManager.getCurrentLayout();
        expect(layout.type).to.equal('vertical');

        // Simulate panel resize to narrow width
        mockContainer.style.width = '300px';
        splitManager.handlePanelResize({ width: 300, height: 600 });

        // Layout should adapt to horizontal
        layout = splitManager.getCurrentLayout();
        expect(layout.type).to.equal('horizontal');
        expect(layout.adaptationReason).to.equal('width_constraint');
      });

    });

  });

  describe('Split Operation Performance and Resource Management', () => {

    describe('RED Phase - Performance Characteristics', () => {

      it('should perform split operations within acceptable time limits', async () => {
        // RED: Split operations should be fast

        const terminal = await lifecycleManager.createTerminal({ name: 'Performance Test' });

        const startTime = Date.now();

        // Perform multiple split operations
        const operations = [];
        for (let i = 0; i < 10; i++) {
          if (i % 2 === 0) {
            operations.push(splitManager.splitHorizontal(terminal.id));
          } else {
            operations.push(splitManager.splitVertical(terminal.id));
          }
        }

        await Promise.all(operations);
        const endTime = Date.now();

        expect(endTime - startTime).to.be.lessThan(1000); // Should complete within 1 second
      });

      it('should manage memory efficiently during split operations', async () => {
        // RED: Split operations should not cause memory leaks

        const initialMemory = process.memoryUsage().heapUsed;

        // Create and destroy many split layouts
        for (let i = 0; i < 50; i++) {
          const terminal = await lifecycleManager.createTerminal({ name: `Test ${i}` });
          await splitManager.splitHorizontal(terminal.id);
          await splitManager.splitVertical(terminal.id);

          // Clean up
          await splitManager.closeSplitLayout();
          await lifecycleManager.deleteTerminal(terminal.id);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 10MB)
        expect(memoryIncrease).to.be.lessThan(10 * 1024 * 1024);
      });

      it('should handle concurrent split operations safely', async () => {
        // RED: Concurrent splits should not cause conflicts

        const terminal = await lifecycleManager.createTerminal({ name: 'Concurrent Test' });

        // Attempt multiple concurrent splits
        const concurrentSplits = [
          splitManager.splitHorizontal(terminal.id),
          splitManager.splitVertical(terminal.id),
          splitManager.splitHorizontal(terminal.id),
          splitManager.splitVertical(terminal.id)
        ];

        const results = await Promise.allSettled(concurrentSplits);

        // Only one should succeed, others should be gracefully rejected
        const successfulSplits = results.filter(r => r.status === 'fulfilled').length;
        expect(successfulSplits).to.equal(1);

        // Failed operations should have meaningful error messages
        const failedSplits = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
        failedSplits.forEach(failed => {
          expect(failed.reason.message).to.include('split operation in progress');
        });
      });

      it('should optimize DOM updates during complex split layouts', async () => {
        // RED: DOM updates should be batched for performance

        const terminal = await lifecycleManager.createTerminal({ name: 'DOM Test' });

        // Count DOM mutations
        let mutationCount = 0;
        const observer = new MutationObserver((mutations) => {
          mutationCount += mutations.length;
        });

        observer.observe(mockContainer, {
          childList: true,
          subtree: true,
          attributes: true
        });

        // Perform complex split sequence
        await splitManager.splitHorizontal(terminal.id);
        const layout1 = splitManager.getCurrentLayout();

        await splitManager.splitVertical(layout1.terminals[0].id);
        await splitManager.splitVertical(layout1.terminals[1].id);

        observer.disconnect();

        // Should have reasonable number of DOM mutations (batched updates)
        expect(mutationCount).to.be.lessThan(20); // Efficient DOM updates
      });

    });

  });

  describe('Split Layout State Management', () => {

    describe('RED Phase - State Consistency', () => {

      it('should maintain consistent state across split operations', async () => {
        // RED: Split state should remain consistent

        const terminal1 = await lifecycleManager.createTerminal({ name: 'State Test 1' });
        const splitResult = await splitManager.splitHorizontal(terminal1.id);
        const _terminal2Id = splitResult.newTerminalId;

        // Verify initial state
        let layout = splitManager.getCurrentLayout();
        expect(layout.terminals).to.have.length(2);
        expect(layout.type).to.equal('horizontal');

        // Perform another split
        await splitManager.splitVertical(terminal1.id);

        // State should be updated correctly
        layout = splitManager.getCurrentLayout();
        expect(layout.terminals).to.have.length(3);
        expect(layout.type).to.equal('grid');

        // All terminal references should be valid
        layout.terminals.forEach(terminal => {
          expect(terminal.id).to.be.a('string');
          expect(terminal.element).to.exist;
          expect(terminal.bounds).to.exist;
          expect(terminal.bounds.width).to.be.greaterThan(0);
          expect(terminal.bounds.height).to.be.greaterThan(0);
        });
      });

      it('should restore split layout state after panel reload', async () => {
        // RED: Split layouts should be restorable

        // Create complex split layout
        const terminal1 = await lifecycleManager.createTerminal({ name: 'Restore Test 1' });
        await splitManager.splitHorizontal(terminal1.id);
        const layout1 = splitManager.getCurrentLayout();

        await splitManager.splitVertical(layout1.terminals[0].id);
        const originalLayout = splitManager.getCurrentLayout();

        // Serialize layout state
        const serializedState = splitManager.serializeLayout();
        expect(serializedState).to.be.a('string');

        // Simulate panel reload - dispose and recreate
        splitManager.dispose();
        splitManager = new SplitManager();

        // Restore layout state
        const restoreResult = await splitManager.restoreLayout(serializedState);
        expect(restoreResult.success).to.be.true;

        // Verify restored layout matches original
        const restoredLayout = splitManager.getCurrentLayout();
        expect(restoredLayout.type).to.equal(originalLayout.type);
        expect(restoredLayout.terminals).to.have.length(originalLayout.terminals.length);
      });

      it('should handle terminal closure in split layouts gracefully', async () => {
        // RED: Split layouts should adapt when terminals are closed

        // Create 3-terminal layout
        const terminal1 = await lifecycleManager.createTerminal({ name: 'Close Test 1' });
        const splitResult1 = await splitManager.splitHorizontal(terminal1.id);
        const terminal2Id = splitResult1.newTerminalId;

        const splitResult2 = await splitManager.splitVertical(terminal1.id);
        const _terminal3Id = splitResult2.newTerminalId;

        // Verify 3-terminal grid layout
        let layout = splitManager.getCurrentLayout();
        expect(layout.terminals).to.have.length(3);
        expect(layout.type).to.equal('grid');

        // Close middle terminal
        await splitManager.closeTerminalInSplit(terminal2Id);

        // Layout should adapt to 2-terminal layout
        layout = splitManager.getCurrentLayout();
        expect(layout.terminals).to.have.length(2);
        expect(layout.type).to.equal('vertical'); // Should revert to simpler layout

        // Remaining terminals should resize to fill space
        layout.terminals.forEach(terminal => {
          expect(terminal.bounds.width).to.be.greaterThan(300); // Should be larger now
        });
      });

      it('should maintain split boundaries during container resize', async () => {
        // RED: Split boundaries should adapt to container size changes

        const terminal1 = await lifecycleManager.createTerminal({ name: 'Resize Test 1' });
        const splitResult = await splitManager.splitVertical(terminal1.id);
        const terminal2Id = splitResult.newTerminalId;

        // Get initial split boundaries
        const initialLayout = splitManager.getCurrentLayout();
        const initialBounds1 = initialLayout.terminals.find(t => t.id === terminal1.id)?.bounds;
        const initialBounds2 = initialLayout.terminals.find(t => t.id === terminal2Id)?.bounds;

        expect(initialBounds1?.width).to.equal(400); // 50% of 800px
        expect(initialBounds2?.width).to.equal(400); // 50% of 800px

        // Resize container
        mockContainer.style.width = '1200px';
        splitManager.handlePanelResize({ width: 1200, height: 600 });

        // Split boundaries should update proportionally
        const resizedLayout = splitManager.getCurrentLayout();
        const resizedBounds1 = resizedLayout.terminals.find(t => t.id === terminal1.id)?.bounds;
        const resizedBounds2 = resizedLayout.terminals.find(t => t.id === terminal2Id)?.bounds;

        expect(resizedBounds1?.width).to.equal(600); // 50% of 1200px
        expect(resizedBounds2?.width).to.equal(600); // 50% of 1200px

        // Total width should match container
        const totalWidth = (resizedBounds1?.width || 0) + (resizedBounds2?.width || 0);
        expect(totalWidth).to.equal(1200);
      });

    });

  });

  describe('Advanced Split Features', () => {

    describe('RED Phase - Advanced Split Capabilities', () => {

      it('should support custom split ratios', async () => {
        // RED: Splits should support custom size ratios

        const terminal = await lifecycleManager.createTerminal({ name: 'Ratio Test' });

        // Create split with 70-30 ratio
        const splitResult = await splitManager.splitHorizontal(terminal.id, { ratio: 0.7 });

        expect(splitResult.success).to.be.true;

        const layout = splitManager.getCurrentLayout();
        const terminal1Bounds = layout.terminals[0].bounds;
        const terminal2Bounds = layout.terminals[1].bounds;

        // First terminal should be 70% of height
        expect(terminal1Bounds.height).to.be.approximately(420, 5); // 70% of 600px
        expect(terminal2Bounds.height).to.be.approximately(180, 5); // 30% of 600px
      });

      it('should support draggable split dividers', async () => {
        // RED: Split dividers should be draggable for resizing

        const terminal1 = await lifecycleManager.createTerminal({ name: 'Drag Test 1' });
        const _splitResult = await splitManager.splitVertical(terminal1.id);

        const _layout = splitManager.getCurrentLayout();

        // Find the split divider element
        const divider = mockContainer.querySelector('.split-divider') as HTMLElement;
        expect(divider).to.exist;

        // Simulate drag operation (move divider 100px to the right)
        const dragResult = await splitManager.dragSplitDivider(divider, { deltaX: 100, deltaY: 0 });

        expect(dragResult.success).to.be.true;

        // Terminal sizes should update
        const updatedLayout = splitManager.getCurrentLayout();
        const leftTerminal = updatedLayout.terminals[0];
        const rightTerminal = updatedLayout.terminals[1];

        expect(leftTerminal.bounds.width).to.equal(500); // 400 + 100
        expect(rightTerminal.bounds.width).to.equal(300); // 400 - 100
      });

      it('should support split preset layouts', async () => {
        // RED: Preset layouts should be quickly applicable

        const terminal = await lifecycleManager.createTerminal({ name: 'Preset Test' });

        // Apply preset: 2x2 grid layout
        const presetResult = await splitManager.applyPresetLayout('2x2-grid', terminal.id);

        expect(presetResult.success).to.be.true;
        expect(presetResult.createdTerminals).to.have.length(3); // 3 new terminals created

        const layout = splitManager.getCurrentLayout();
        expect(layout.terminals).to.have.length(4); // Original + 3 new
        expect(layout.type).to.equal('grid');

        // Verify grid positioning
        const gridPositions = layout.terminals.map(t => t.gridPosition);
        expect(gridPositions).to.deep.include({ row: 0, col: 0 });
        expect(gridPositions).to.deep.include({ row: 0, col: 1 });
        expect(gridPositions).to.deep.include({ row: 1, col: 0 });
        expect(gridPositions).to.deep.include({ row: 1, col: 1 });
      });

      it('should support split layout templates', async () => {
        // RED: Custom layouts should be savable and reusable

        // Create custom layout
        const terminal1 = await lifecycleManager.createTerminal({ name: 'Template Test 1' });
        await splitManager.splitHorizontal(terminal1.id, { ratio: 0.3 });
        const layout1 = splitManager.getCurrentLayout();

        await splitManager.splitVertical(layout1.terminals[1].id, { ratio: 0.6 });

        const customLayout = splitManager.getCurrentLayout();

        // Save as template
        const saveResult = await splitManager.saveLayoutTemplate('custom-dev-layout', customLayout);
        expect(saveResult.success).to.be.true;

        // Clear current layout
        await splitManager.closeSplitLayout();

        // Create new terminal and apply template
        const newTerminal = await lifecycleManager.createTerminal({ name: 'Template Apply Test' });
        const applyResult = await splitManager.applyLayoutTemplate('custom-dev-layout', newTerminal.id);

        expect(applyResult.success).to.be.true;

        // Verify template was applied correctly
        const appliedLayout = splitManager.getCurrentLayout();
        expect(appliedLayout.type).to.equal(customLayout.type);
        expect(appliedLayout.terminals).to.have.length(customLayout.terminals.length);

        // Verify ratios are preserved
        const firstTerminalHeight = appliedLayout.terminals[0].bounds.height;
        expect(firstTerminalHeight).to.be.approximately(180, 5); // 30% of 600px
      });

    });

  });

});