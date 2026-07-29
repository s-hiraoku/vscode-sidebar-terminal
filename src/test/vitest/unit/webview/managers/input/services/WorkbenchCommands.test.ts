/**
 * WorkbenchCommands Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { isWorkbenchOwnedCommand } from '../../../../../../../webview/managers/input/services/WorkbenchCommands';

describe('isWorkbenchOwnedCommand', () => {
  it.each([
    'workbench.action.showCommands',
    'workbench.action.quickOpen',
    'workbench.action.toggleDevTools',
    'workbench.action.reloadWindow',
    'workbench.action.zoomIn',
    'workbench.action.closePanel',
  ])('claims %s for the workbench', (command) => {
    expect(isWorkbenchOwnedCommand(command)).toBe(true);
  });

  it.each([
    'workbench.action.terminal.new',
    'workbench.action.terminal.clear',
    'workbench.action.terminal.copySelection',
    'workbench.action.terminal.moveToLineStart',
  ])('leaves %s to the webview', (command) => {
    expect(isWorkbenchOwnedCommand(command)).toBe(false);
  });
});
