/**
 * IMEHandler Cursor Visibility TDD Test Suite
 * Ensures VS Code parity for IME composition cursor behavior
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { IMEHandler } from '../../../../../../../webview/managers/input/handlers/IMEHandler';
import { InputStateManager } from '../../../../../../../webview/managers/input/services/InputStateManager';
import { InputEventService } from '../../../../../../../webview/managers/input/services/InputEventService';

describe('IMEHandler Cursor Visibility', () => {
  let jsdom: JSDOM;
  let handler: IMEHandler;
  let stateManager: InputStateManager;
  let eventService: InputEventService;
  let sharedTimers: Map<string, number>;

  beforeEach(async () => {
    vi.useFakeTimers();

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
    (global as any).window = jsdom.window;
    (global as any).document = jsdom.window.document;
    (global as any).Event = jsdom.window.Event;
    (global as any).CompositionEvent = jsdom.window.CompositionEvent;
    (global as any).InputEvent = jsdom.window.InputEvent;

    sharedTimers = new Map<string, number>();
    stateManager = new InputStateManager(() => {});
    eventService = new InputEventService(() => {});
    handler = new IMEHandler(sharedTimers, stateManager, eventService);

    await handler.initialize();
  });

  afterEach(() => {
    // CRITICAL: Use try-finally to ensure all cleanup happens
    try {
      handler.dispose();
    } finally {
      try {
        eventService.dispose();
      } finally {
        try {
          stateManager.dispose();
        } finally {
          try {
            vi.useRealTimers();
          } finally {
            try {
              // CRITICAL: Close JSDOM window to prevent memory leaks
              jsdom.window.close();
            } finally {
              // CRITICAL: Clean up global DOM state to prevent test pollution
              delete (global as any).window;
              delete (global as any).document;
              delete (global as any).Event;
              delete (global as any).CompositionEvent;
              delete (global as any).InputEvent;
            }
          }
        }
      }
    }
  });

  it('toggles IME cursor class during composition lifecycle', () => {
    const startEvent = new (global as any).CompositionEvent('compositionstart', {
      data: 'あ',
    });

    (global as any).document.dispatchEvent(startEvent);

    expect((global as any).document.body.classList.contains('terminal-ime-composing')).toBe(true);

    const endEvent = new (global as any).CompositionEvent('compositionend', {
      data: 'あ',
    });

    (global as any).document.dispatchEvent(endEvent);
    vi.advanceTimersByTime(1);

    expect((global as any).document.body.classList.contains('terminal-ime-composing')).toBe(false);
  });

  it('injects cursor style once for IME composition handling', () => {
    const styleElement = (global as any).document.getElementById('terminal-ime-cursor-style');
    expect(styleElement).not.toBeNull();
    expect(styleElement!.textContent).toContain('width: 0');

    const startEvent = new (global as any).CompositionEvent('compositionstart', {
      data: '候補',
    });
    (global as any).document.dispatchEvent(startEvent);

    const duplicateCheck = (global as any).document.querySelectorAll('#terminal-ime-cursor-style');
    expect(duplicateCheck.length).toBe(1);

    const endEvent = new (global as any).CompositionEvent('compositionend', {
      data: '候補',
    });
    (global as any).document.dispatchEvent(endEvent);
    vi.advanceTimersByTime(1);

    expect((global as any).document.querySelectorAll('#terminal-ime-cursor-style').length).toBe(1);
  });

  it('clears IME cursor class on dispose', () => {
    (global as any).document.body.classList.add('terminal-ime-composing');

    handler.dispose();

    expect((global as any).document.body.classList.contains('terminal-ime-composing')).toBe(false);
  });

  it('recovers from stuck composition when compositionend is missing', () => {
    const startEvent = new (global as any).CompositionEvent('compositionstart', {
      data: 'あ',
    });
    (global as any).document.dispatchEvent(startEvent);
    expect(handler.isIMEComposing()).toBe(true);

    // Simulate missing compositionend from IME/browser edge case.
    vi.advanceTimersByTime(5000);

    expect(handler.isIMEComposing()).toBe(false);
    expect((global as any).document.body.classList.contains('terminal-ime-composing')).toBe(false);
  });

  it('clears composition state on window blur', () => {
    const startEvent = new (global as any).CompositionEvent('compositionstart', {
      data: '候補',
    });
    (global as any).document.dispatchEvent(startEvent);
    expect(handler.isIMEComposing()).toBe(true);

    (global as any).window.dispatchEvent(new (global as any).Event('blur'));

    expect(handler.isIMEComposing()).toBe(false);
    expect((global as any).document.body.classList.contains('terminal-ime-composing')).toBe(false);
  });
});
