/**
 * TerminalTabManager Test Suite
 * Tests duplicate tab handling and tab management
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalTabManager } from '../../../../../webview/managers/TerminalTabManager';

describe('TerminalTabManager addTab duplicate handling', () => {
  let manager: TerminalTabManager;

  beforeEach(() => {
    // Create DOM structure needed by TerminalTabManager
    const terminalView = document.createElement('div');
    terminalView.id = 'terminal-view';
    document.body.appendChild(terminalView);

    const terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    terminalView.appendChild(terminalBody);

    manager = new TerminalTabManager();
    manager.initialize();
  });

  afterEach(() => {
    manager.dispose();
    document.body.innerHTML = '';
  });

  it('does not create duplicate entries when the same terminal id is added twice', () => {
    manager.addTab('terminal-1', 'First');
    manager.addTab('terminal-1', 'First Duplicate');

    const tabs = manager.getAllTabs();
    expect(tabs).toHaveLength(1);
    const tab = tabs[0];
    expect(tab).toBeDefined();
    expect(tab!.name).toBe('First Duplicate');

    const renderedTabs = document.querySelectorAll('.terminal-tab');
    expect(renderedTabs).toHaveLength(1);
  });

  it('should add multiple different tabs correctly', () => {
    manager.addTab('terminal-1', 'Terminal 1');
    manager.addTab('terminal-2', 'Terminal 2');
    manager.addTab('terminal-3', 'Terminal 3');

    const tabs = manager.getAllTabs();
    expect(tabs).toHaveLength(3);

    const renderedTabs = document.querySelectorAll('.terminal-tab');
    expect(renderedTabs).toHaveLength(3);
  });

  it('should remove tab correctly', () => {
    manager.addTab('terminal-1', 'Terminal 1');
    manager.addTab('terminal-2', 'Terminal 2');

    manager.removeTab('terminal-1');

    const tabs = manager.getAllTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.id).toBe('terminal-2');
  });

  it('should update tab name', () => {
    manager.addTab('terminal-1', 'Original Name');

    manager.addTab('terminal-1', 'Updated Name');

    const tabs = manager.getAllTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.name).toBe('Updated Name');
  });
});
