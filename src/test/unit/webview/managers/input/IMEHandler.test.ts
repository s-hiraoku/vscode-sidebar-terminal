/**
 * IME Handler Tests
 * 
 * Comprehensive tests for Japanese input handling and IME composition
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { IMEHandler } from '../../../../../webview/managers/input/handlers/IMEHandler';

describe('IMEHandler - Japanese Input Handling', () => {
  let imeHandler: IMEHandler;
  let mockDebounceTimers: Map<string, number>;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockDebounceTimers = new Map();
    imeHandler = new IMEHandler(mockDebounceTimers);
  });

  afterEach(() => {
    imeHandler.dispose();
    sandbox.restore();
  });

  describe('Basic IME Composition Lifecycle', () => {
    it('should handle composition start correctly', () => {
      imeHandler.initialize();
      
      // Simulate composition start event
      const compositionStartEvent = new CompositionEvent('compositionstart', {
        data: 'n'
      });
      
      document.dispatchEvent(compositionStartEvent);
      
      assert.strictEqual(imeHandler.isIMEComposing(), true);
    });

    it('should handle composition update correctly', () => {
      imeHandler.initialize();
      
      // Start composition
      const compositionStartEvent = new CompositionEvent('compositionstart', {
        data: 'n'
      });
      document.dispatchEvent(compositionStartEvent);
      
      // Update composition
      const compositionUpdateEvent = new CompositionEvent('compositionupdate', {
        data: 'に'
      });
      document.dispatchEvent(compositionUpdateEvent);
      
      assert.strictEqual(imeHandler.isIMEComposing(), true);
    });

    it('should handle composition end with buffer correctly', (done) => {
      imeHandler.initialize();
      
      // Start composition
      const compositionStartEvent = new CompositionEvent('compositionstart', {
        data: 'n'
      });
      document.dispatchEvent(compositionStartEvent);
      
      // End composition
      const compositionEndEvent = new CompositionEvent('compositionend', {
        data: 'に'
      });
      document.dispatchEvent(compositionEndEvent);
      
      // Should still be composing immediately after end
      assert.strictEqual(imeHandler.isIMEComposing(), true);
      
      // Should detect composition end data
      assert.strictEqual(imeHandler.isCompositionEndData('に'), true);
      
      // Wait for buffer timeout
      setTimeout(() => {
        assert.strictEqual(imeHandler.isIMEComposing(), false);
        assert.strictEqual(imeHandler.isCompositionEndData('に'), false);
        done();
      }, 60);
    });
  });

  describe('Japanese Input Scenarios', () => {
    it('should handle typical Japanese hiragana input', (done) => {
      imeHandler.initialize();
      
      // Simulate typing "こんにちは" (hello)
      const events = [
        { type: 'compositionstart', data: 'k' },
        { type: 'compositionupdate', data: 'こ' },
        { type: 'compositionend', data: 'こ' },
      ];
      
      events.forEach(event => {
        const compositionEvent = new CompositionEvent(event.type, { data: event.data });
        document.dispatchEvent(compositionEvent);
      });
      
      // Check composition end data detection
      assert.strictEqual(imeHandler.isCompositionEndData('こ'), true);
      
      setTimeout(() => {
        assert.strictEqual(imeHandler.isIMEComposing(), false);
        assert.strictEqual(imeHandler.isCompositionEndData('こ'), false);
        done();
      }, 60);
    });

    it('should handle kanji conversion', (done) => {
      imeHandler.initialize();
      
      // Simulate typing "漢字" (kanji)
      const events = [
        { type: 'compositionstart', data: 'k' },
        { type: 'compositionupdate', data: 'か' },
        { type: 'compositionupdate', data: 'かん' },
        { type: 'compositionupdate', data: 'かんじ' },
        { type: 'compositionupdate', data: '漢字' },
        { type: 'compositionend', data: '漢字' },
      ];
      
      events.forEach(event => {
        const compositionEvent = new CompositionEvent(event.type, { data: event.data });
        document.dispatchEvent(compositionEvent);
      });
      
      // Should remain in composition until timeout
      assert.strictEqual(imeHandler.isIMEComposing(), true);
      assert.strictEqual(imeHandler.isCompositionEndData('漢字'), true);
      
      setTimeout(() => {
        assert.strictEqual(imeHandler.isIMEComposing(), false);
        assert.strictEqual(imeHandler.isCompositionEndData('漢字'), false);
        done();
      }, 60);
    });

    it('should handle complex input with multiple characters', (done) => {
      imeHandler.initialize();
      
      // Simulate typing "日本語入力テスト" (Japanese input test)
      const finalText = '日本語入力テスト';
      
      const events = [
        { type: 'compositionstart', data: 'n' },
        { type: 'compositionupdate', data: 'に' },
        { type: 'compositionupdate', data: 'にほ' },
        { type: 'compositionupdate', data: 'にほん' },
        { type: 'compositionupdate', data: 'にほんご' },
        { type: 'compositionupdate', data: '日本語' },
        { type: 'compositionupdate', data: '日本語に' },
        { type: 'compositionupdate', data: '日本語にゅ' },
        { type: 'compositionupdate', data: '日本語入力' },
        { type: 'compositionupdate', data: '日本語入力て' },
        { type: 'compositionupdate', data: '日本語入力てす' },
        { type: 'compositionupdate', data: '日本語入力てすと' },
        { type: 'compositionupdate', data: '日本語入力テスト' },
        { type: 'compositionend', data: finalText },
      ];
      
      events.forEach(event => {
        const compositionEvent = new CompositionEvent(event.type, { data: event.data });
        document.dispatchEvent(compositionEvent);
      });
      
      assert.strictEqual(imeHandler.isCompositionEndData(finalText), true);
      
      setTimeout(() => {
        assert.strictEqual(imeHandler.isIMEComposing(), false);
        done();
      }, 60);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty composition data', () => {
      imeHandler.initialize();
      
      const compositionEndEvent = new CompositionEvent('compositionend', {
        data: ''
      });
      document.dispatchEvent(compositionEndEvent);
      
      assert.strictEqual(imeHandler.isCompositionEndData(''), true);
    });

    it('should handle null/undefined composition data', () => {
      imeHandler.initialize();
      
      // @ts-ignore - testing edge case
      const compositionEndEvent = new CompositionEvent('compositionend', {});
      document.dispatchEvent(compositionEndEvent);
      
      assert.strictEqual(imeHandler.isCompositionEndData(''), true);
    });

    it('should handle multiple composition end events', (done) => {
      imeHandler.initialize();
      
      // First composition end
      const event1 = new CompositionEvent('compositionend', { data: 'あ' });
      document.dispatchEvent(event1);
      
      // Second composition end (should override the first)
      setTimeout(() => {
        const event2 = new CompositionEvent('compositionend', { data: 'い' });
        document.dispatchEvent(event2);
        
        assert.strictEqual(imeHandler.isCompositionEndData('い'), true);
        assert.strictEqual(imeHandler.isCompositionEndData('あ'), false);
        
        done();
      }, 10);
    });

    it('should clear pending events correctly', () => {
      const mockTimer1 = 123;
      const mockTimer2 = 456;
      const mockTimer3 = 789;
      
      mockDebounceTimers.set('input-event', mockTimer1);
      mockDebounceTimers.set('keydown-handler', mockTimer2);
      mockDebounceTimers.set('terminal-data', mockTimer3);
      mockDebounceTimers.set('other-event', 999);
      
      const clearTimeoutSpy = sandbox.spy(global, 'clearTimeout');
      
      imeHandler.clearPendingInputEvents();
      
      // Should clear input-related events
      assert.ok(clearTimeoutSpy.calledWith(mockTimer1));
      assert.ok(clearTimeoutSpy.calledWith(mockTimer2));
      assert.ok(clearTimeoutSpy.calledWith(mockTimer3));
      
      // Should not clear other events
      assert.ok(!clearTimeoutSpy.calledWith(999));
      
      // Should remove cleared timers from map
      assert.strictEqual(mockDebounceTimers.has('input-event'), false);
      assert.strictEqual(mockDebounceTimers.has('keydown-handler'), false);
      assert.strictEqual(mockDebounceTimers.has('terminal-data'), false);
      assert.strictEqual(mockDebounceTimers.has('other-event'), true);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should properly dispose of resources', () => {
      imeHandler.initialize();
      
      // Start composition to create timer
      const compositionEndEvent = new CompositionEvent('compositionend', { data: 'test' });
      document.dispatchEvent(compositionEndEvent);
      
      const clearTimeoutSpy = sandbox.spy(global, 'clearTimeout');
      
      imeHandler.dispose();
      
      // Should have cleared the timer
      assert.ok(clearTimeoutSpy.called);
      assert.strictEqual(imeHandler.isIMEComposing(), false);
      assert.strictEqual(imeHandler.isCompositionEndData('test'), false);
    });

    it('should handle dispose before timer expiration', (done) => {
      imeHandler.initialize();
      
      // Start composition
      const compositionEndEvent = new CompositionEvent('compositionend', { data: 'test' });
      document.dispatchEvent(compositionEndEvent);
      
      // Dispose immediately
      imeHandler.dispose();
      
      // Wait longer than buffer time
      setTimeout(() => {
        // Should remain disposed (no timer callback)
        assert.strictEqual(imeHandler.isIMEComposing(), false);
        done();
      }, 100);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with rapid composition cycles', (done) => {
      imeHandler.initialize();
      
      let completedCycles = 0;
      const totalCycles = 3;
      
      const runCompositionCycle = (text: string) => {
        const events = [
          { type: 'compositionstart', data: text[0] },
          { type: 'compositionupdate', data: text },
          { type: 'compositionend', data: text },
        ];
        
        events.forEach(event => {
          const compositionEvent = new CompositionEvent(event.type, { data: event.data });
          document.dispatchEvent(compositionEvent);
        });
        
        setTimeout(() => {
          completedCycles++;
          if (completedCycles === totalCycles) {
            assert.strictEqual(imeHandler.isIMEComposing(), false);
            done();
          }
        }, 60);
      };
      
      // Run multiple rapid cycles
      runCompositionCycle('あ');
      setTimeout(() => runCompositionCycle('い'), 20);
      setTimeout(() => runCompositionCycle('う'), 40);
    });

    it('should handle composition interruption', () => {
      imeHandler.initialize();
      
      // Start composition
      const compositionStartEvent = new CompositionEvent('compositionstart', { data: 'n' });
      document.dispatchEvent(compositionStartEvent);
      
      assert.strictEqual(imeHandler.isIMEComposing(), true);
      
      // Interrupt with new start (canceling previous)
      const newCompositionStartEvent = new CompositionEvent('compositionstart', { data: 'k' });
      document.dispatchEvent(newCompositionStartEvent);
      
      assert.strictEqual(imeHandler.isIMEComposing(), true);
      
      // End the new composition
      const compositionEndEvent = new CompositionEvent('compositionend', { data: 'こ' });
      document.dispatchEvent(compositionEndEvent);
      
      assert.strictEqual(imeHandler.isCompositionEndData('こ'), true);
    });
  });
});