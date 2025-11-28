/**
 * IMEHandler Cursor Visibility TDD Test Suite
 * Ensures VS Code parity for IME composition cursor behavior
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

import { IMEHandler } from '../../../../../../webview/managers/input/handlers/IMEHandler';
import { InputStateManager } from '../../../../../../webview/managers/input/services/InputStateManager';
import { InputEventService } from '../../../../../../webview/managers/input/services/InputEventService';

describe('IMEHandler Cursor Visibility', () => {
  let jsdom: JSDOM;
  let handler: IMEHandler;
  let stateManager: InputStateManager;
  let eventService: InputEventService;
  let sharedTimers: Map<string, number>;
  let clock: sinon.SinonFakeTimers;

  beforeEach(async () => {
    jsdom = new JSDOM(
      `<!DOCTYPE html>
       <html>
         <head></head>
         <body>
           <div class="terminal-container">
             <div class="xterm">
               <div class="xterm-cursor-layer"><canvas></canvas></div>
               <span class="xterm-cursor"></span>
             </div>
           </div>
         </body>
       </html>`,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
      }
    );

    // Setup globals for handler
    global.window = jsdom.window as any;
    global.document = jsdom.window.document;
    global.Event = jsdom.window.Event;
    global.CompositionEvent = jsdom.window.CompositionEvent;
    global.InputEvent = jsdom.window.InputEvent;

    sharedTimers = new Map<string, number>();
    stateManager = new InputStateManager(() => {});
    eventService = new InputEventService(() => {});
    handler = new IMEHandler(sharedTimers, stateManager, eventService);

    clock = sinon.useFakeTimers();
    await handler.initialize();
  });

  afterEach(() => {
    handler.dispose();
    eventService.dispose();
    stateManager.dispose();
    clock.restore();

    jsdom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).Event;
    delete (global as any).CompositionEvent;
    delete (global as any).InputEvent;
  });

  it('toggles IME cursor class during composition lifecycle', () => {
    const startEvent = new (global as any).CompositionEvent('compositionstart', {
      data: 'あ',
    });

    document.dispatchEvent(startEvent);

    expect(document.body.classList.contains('terminal-ime-composing')).to.be.true;

    const endEvent = new (global as any).CompositionEvent('compositionend', {
      data: 'あ',
    });

    document.dispatchEvent(endEvent);
    clock.tick(1);

    expect(document.body.classList.contains('terminal-ime-composing')).to.be.false;
  });

  it('injects cursor style once for IME composition handling', () => {
    const styleElement = document.getElementById('terminal-ime-cursor-style');
    expect(styleElement).to.not.be.null;
    expect(styleElement!.textContent).to.contain('width: 0');

    const startEvent = new (global as any).CompositionEvent('compositionstart', {
      data: '候補',
    });
    document.dispatchEvent(startEvent);

    const duplicateCheck = document.querySelectorAll('#terminal-ime-cursor-style');
    expect(duplicateCheck.length).to.equal(1);

    const endEvent = new (global as any).CompositionEvent('compositionend', {
      data: '候補',
    });
    document.dispatchEvent(endEvent);
    clock.tick(1);

    expect(document.querySelectorAll('#terminal-ime-cursor-style').length).to.equal(1);
  });

  it('clears IME cursor class on dispose', () => {
    document.body.classList.add('terminal-ime-composing');

    handler.dispose();

    expect(document.body.classList.contains('terminal-ime-composing')).to.be.false;
  });
});
