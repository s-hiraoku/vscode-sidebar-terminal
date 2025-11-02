import { describe, it, beforeEach, afterEach } from 'mocha';
// import { expect } from 'chai';
import { JSDOM } from 'jsdom';
import { TerminalTabManager } from '../../../../webview/managers/TerminalTabManager';

describe('TerminalTabManager addTab duplicate handling', () => {
  let dom: JSDOM;
  let manager: TerminalTabManager;

  beforeEach(() => {
    dom = new JSDOM(`
      <div id="terminal-view">
        <div id="terminal-body"></div>
      </div>
    `);

    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    manager = new TerminalTabManager();
    manager.initialize();
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).document;
  });

  it('does not create duplicate entries when the same terminal id is added twice', () => {
    manager.addTab('terminal-1', 'First');
    manager.addTab('terminal-1', 'First Duplicate');

    const tabs = manager.getAllTabs();
    expect(tabs).to.have.lengthOf(1);
    const tab = tabs[0];
    expect(tab).to.not.be.undefined;
    expect(tab!.name).to.equal('First Duplicate');

    const renderedTabs = dom.window.document.querySelectorAll('.terminal-tab');
    expect(renderedTabs).to.have.lengthOf(1);
  });
});
