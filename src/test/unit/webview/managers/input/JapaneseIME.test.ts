/**
 * Japanese IME Input Handling TDD Test Suite
 * Following t-wada's TDD methodology for comprehensive Japanese IME testing
 * RED-GREEN-REFACTOR cycles with focus on complex Japanese input scenarios
 * Tests based on real-world Japanese IME behavior patterns
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import {
  InputEventService,
  EventHandlerConfig as _EventHandlerConfig,
} from '../../../../../webview/managers/input/services/InputEventService';
import {
  InputStateManager,
  IMECompositionState as _IMECompositionState,
} from '../../../../../webview/managers/input/services/InputStateManager';

// Japanese IME test data representing real input scenarios
const JAPANESE_IME_TEST_DATA = {
  // Hiragana input: "konnichiwa" -> "こんにちは"
  konnichiwa: {
    input: ['k', 'o', 'n', 'n', 'i', 'c', 'h', 'i', 'w', 'a'],
    composition: ['k', 'ko', 'kon', 'konn', 'konni', 'konnichi', 'konnichiw', 'konnichiwa'],
    result: 'こんにちは',
  },
  // Kanji conversion: "nihon" -> "日本"
  nihon: {
    input: ['n', 'i', 'h', 'o', 'n'],
    composition: ['n', 'ni', 'nih', 'niho', 'nihon'],
    intermediate: 'にほん',
    candidates: ['日本', 'ニホン', 'にほん', '二本', '弐本'],
    result: '日本',
  },
  // Complex phrase: "kyou wa ii tenki desu ne" -> "今日はいい天気ですね"
  phrase: {
    input: 'kyou wa ii tenki desu ne'.split(''),
    segments: [
      { romaji: 'kyou', hiragana: 'きょう', kanji: '今日' },
      { romaji: 'wa', hiragana: 'は', kanji: 'は' },
      { romaji: 'ii', hiragana: 'いい', kanji: 'いい' },
      { romaji: 'tenki', hiragana: 'てんき', kanji: '天気' },
      { romaji: 'desu', hiragana: 'です', kanji: 'です' },
      { romaji: 'ne', hiragana: 'ね', kanji: 'ね' },
    ],
    result: '今日はいい天気ですね',
  },
};

// Mock Japanese IME behavior
class MockJapaneseIME {
  private eventService: InputEventService;
  private stateManager: InputStateManager;
  private element: Element;
  private currentComposition: string = '';
  private isComposing: boolean = false;

  constructor(eventService: InputEventService, stateManager: InputStateManager, element: Element) {
    this.eventService = eventService;
    this.stateManager = stateManager;
    this.element = element;

    this.setupIMEEventHandling();
  }

  private setupIMEEventHandling(): void {
    this.eventService.registerEventHandler(
      'ime-keydown',
      this.element,
      'keydown',
      this.handleKeyDown.bind(this),
      { debounce: false }
    );

    this.eventService.registerEventHandler(
      'ime-compositionstart',
      this.element,
      'compositionstart',
      this.handleCompositionStart.bind(this),
      { debounce: false }
    );

    this.eventService.registerEventHandler(
      'ime-compositionupdate',
      this.element,
      'compositionupdate',
      this.handleCompositionUpdate.bind(this),
      { debounce: false }
    );

    this.eventService.registerEventHandler(
      'ime-compositionend',
      this.element,
      'compositionend',
      this.handleCompositionEnd.bind(this),
      { debounce: false }
    );
  }

  private handleKeyDown(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    // Handle IME mode switching (typically Alt+~ on Windows)
    if (keyEvent.altKey && keyEvent.key === '~') {
      this.toggleIMEMode();
    }
  }

  private handleCompositionStart(event: Event): void {
    const compEvent = event as CompositionEvent;
    this.isComposing = true;
    this.currentComposition = compEvent.data || '';

    this.stateManager.updateIMEState({
      isActive: true,
      data: this.currentComposition,
      startOffset: 0,
      endOffset: this.currentComposition.length,
      lastEvent: 'start',
      timestamp: Date.now(),
    });
  }

  private handleCompositionUpdate(event: Event): void {
    const compEvent = event as CompositionEvent;
    if (this.isComposing) {
      this.currentComposition = compEvent.data || '';

      this.stateManager.updateIMEState({
        data: this.currentComposition,
        endOffset: this.currentComposition.length,
        lastEvent: 'update',
        timestamp: Date.now(),
      });
    }
  }

  private handleCompositionEnd(event: Event): void {
    const compEvent = event as CompositionEvent;
    this.currentComposition = compEvent.data || '';
    this.isComposing = false;

    this.stateManager.updateIMEState({
      isActive: false,
      data: this.currentComposition,
      endOffset: this.currentComposition.length,
      lastEvent: 'end',
      timestamp: Date.now(),
    });
  }

  private toggleIMEMode(): void {
    // Simulate IME mode toggle
    const imeState = this.stateManager.getStateSection('ime');
    if (imeState.isActive) {
      // Force composition end
      this.element.dispatchEvent(
        new (global as any).CompositionEvent('compositionend', {
          data: this.currentComposition,
        })
      );
    }
  }

  // Simulate Japanese input sequence
  public simulateJapaneseInput(sequence: string[], finalText: string): void {
    // Start composition
    this.element.dispatchEvent(
      new (global as any).CompositionEvent('compositionstart', {
        data: sequence[0] || '',
      })
    );

    // Simulate incremental composition updates
    for (let i = 1; i < sequence.length; i++) {
      this.element.dispatchEvent(
        new (global as any).CompositionEvent('compositionupdate', {
          data: sequence[i],
        })
      );
    }

    // End composition with final result
    this.element.dispatchEvent(
      new (global as any).CompositionEvent('compositionend', {
        data: finalText,
      })
    );
  }

  public getCurrentComposition(): string {
    return this.currentComposition;
  }

  public isCurrentlyComposing(): boolean {
    return this.isComposing;
  }
}

describe('Japanese IME Input Handling TDD Test Suite', () => {
  let jsdom: JSDOM;
  let clock: sinon.SinonFakeTimers;
  let inputElement: Element;
  let eventService: InputEventService;
  let stateManager: InputStateManager;
  let japaneseIME: MockJapaneseIME;
  let logMessages: string[];

  beforeEach(() => {
    // Arrange: Setup DOM environment with Japanese locale
    jsdom = new JSDOM(
      `
      <!DOCTYPE html>
      <html lang="ja">
        <body>
          <input type="text" id="japanese-input" lang="ja" />
          <div id="terminal" contenteditable="true" lang="ja"></div>
        </body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable',
      }
    );

    // Setup global environment
    global.window = jsdom.window as any;
    global.document = jsdom.window.document;
    global.Event = jsdom.window.Event;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;
    global.CompositionEvent = jsdom.window.CompositionEvent;

    // Setup input element
    inputElement = document.getElementById('japanese-input')!;

    // Setup fake timers
    clock = sinon.useFakeTimers();

    // Setup services
    logMessages = [];
    const mockLogger = (message: string) => {
      logMessages.push(message);
    };

    eventService = new InputEventService(mockLogger);
    stateManager = new InputStateManager(mockLogger);

    // Setup Japanese IME mock
    japaneseIME = new MockJapaneseIME(eventService, stateManager, inputElement);
  });

  afterEach(() => {
    // Cleanup
    clock.restore();
    eventService.dispose();
    stateManager.dispose();
    jsdom.window.close();
  });

  describe('TDD Red Phase: Basic Japanese IME Composition', () => {
    describe('Hiragana Input Processing', () => {
      it('should handle basic hiragana composition sequence', () => {
        const testData = JAPANESE_IME_TEST_DATA.konnichiwa;

        // Act: Simulate "konnichiwa" input
        japaneseIME.simulateJapaneseInput(testData.composition, testData.result);

        // Assert: Final IME state should be correct
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;
        expect(imeState.data).to.equal(testData.result);
        expect(imeState.lastEvent).to.equal('end');

        // Assert: All composition events should be processed
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.be.greaterThan(testData.composition.length);
      });

      it('should track composition progress through hiragana input', () => {
        const _testData = JAPANESE_IME_TEST_DATA.konnichiwa;
        const stateChanges: any[] = [];

        // Arrange: Track IME state changes
        stateManager.addStateListener('ime', (newState, _previousState) => {
          stateChanges.push({
            data: newState.data,
            isActive: newState.isActive,
            lastEvent: newState.lastEvent,
          });
        });

        // Act: Simulate step-by-step composition
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'k',
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: 'ko',
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: 'kon',
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: 'こん',
          })
        );

        // Assert: Should track each composition stage
        expect(stateChanges.length).to.equal(4); // start + 2 updates + end
        expect(stateChanges[0].data).to.equal('k');
        expect(stateChanges[0].isActive).to.be.true;
        expect(stateChanges[0].lastEvent).to.equal('start');

        expect(stateChanges[1].data).to.equal('ko');
        expect(stateChanges[1].lastEvent).to.equal('update');

        expect(stateChanges[3].data).to.equal('こん');
        expect(stateChanges[3].isActive).to.be.false;
        expect(stateChanges[3].lastEvent).to.equal('end');
      });

      it('should handle composition cancellation during hiragana input', () => {
        // Act: Start composition and cancel
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'konni',
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: 'konnichiwa',
          })
        );

        // Cancel composition (empty result)
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: '',
          })
        );

        // Assert: Should handle cancellation gracefully
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;
        expect(imeState.data).to.equal('');
        expect(imeState.lastEvent).to.equal('end');
      });
    });

    describe('Kanji Conversion Processing', () => {
      it('should handle kanji conversion from hiragana', () => {
        const testData = JAPANESE_IME_TEST_DATA.nihon;

        // Act: Simulate hiragana to kanji conversion
        // First phase: romaji to hiragana
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'n',
          })
        );

        testData.composition.forEach((stage, index) => {
          if (index > 0) {
            inputElement.dispatchEvent(
              new (global as any).CompositionEvent('compositionupdate', {
                data: stage,
              })
            );
          }
        });

        // Intermediate state: hiragana before conversion
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: testData.intermediate,
          })
        );

        // Final conversion to kanji
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: testData.result,
          })
        );

        // Assert: Final result should be kanji
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.data).to.equal(testData.result);
        expect(imeState.isActive).to.be.false;
      });

      it('should maintain composition state during kanji candidate selection', () => {
        const testData = JAPANESE_IME_TEST_DATA.nihon;
        const stateHistory: any[] = [];

        // Arrange: Track all state changes
        stateManager.addStateListener('ime', (newState) => {
          stateHistory.push({
            data: newState.data,
            timestamp: newState.timestamp,
            isActive: newState.isActive,
          });
        });

        // Act: Simulate extended kanji selection process
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'nihon',
          })
        );

        // Show hiragana intermediate
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: testData.intermediate,
          })
        );

        // Simulate candidate selection (multiple updates)
        testData.candidates.forEach((candidate, _index) => {
          clock.tick(100); // Time between candidate changes
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionupdate', {
              data: candidate,
            })
          );
        });

        // Final selection
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: testData.result,
          })
        );

        // Assert: Should track all candidate changes
        expect(stateHistory.length).to.be.greaterThan(testData.candidates.length);

        // Assert: Should maintain active state throughout selection
        const activeStates = stateHistory.filter((state) => state.isActive);
        expect(activeStates.length).to.be.greaterThan(0);

        // Assert: Final state should be correct
        const finalState = stateHistory[stateHistory.length - 1];
        expect(finalState.data).to.equal(testData.result);
        expect(finalState.isActive).to.be.false;
      });

      it('should handle kanji candidate selection abandonment', () => {
        const testData = JAPANESE_IME_TEST_DATA.nihon;

        // Act: Start kanji conversion process
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'nihon',
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: testData.intermediate, // にほん
          })
        );

        // Show some kanji candidates
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: '日本',
          })
        );

        // User decides to abandon kanji and stick with hiragana
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: testData.intermediate, // Back to にほん
          })
        );

        // Assert: Should handle abandonment gracefully
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.data).to.equal(testData.intermediate);
        expect(imeState.isActive).to.be.false;
        expect(imeState.lastEvent).to.equal('end');
      });
    });
  });

  describe('TDD Red Phase: Complex Japanese Input Scenarios', () => {
    describe('Multi-Segment Phrase Input', () => {
      it('should handle complex phrase with multiple conversions', () => {
        const testData = JAPANESE_IME_TEST_DATA.phrase;

        // Act: Simulate complex phrase input
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'k',
          })
        );

        // Simulate incremental building of the entire phrase
        const romajiPhrase = testData.segments.map((seg) => seg.romaji).join(' ');
        let currentComposition = '';

        for (let i = 0; i < romajiPhrase.length; i++) {
          currentComposition += romajiPhrase[i];
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionupdate', {
              data: currentComposition,
            })
          );
        }

        // Convert to hiragana
        const hiraganaPhrase = testData.segments.map((seg) => seg.hiragana).join('');
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: hiraganaPhrase,
          })
        );

        // Final kanji conversion
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: testData.result,
          })
        );

        // Assert: Should handle complex phrase correctly
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.data).to.equal(testData.result);
        expect(imeState.isActive).to.be.false;

        // Assert: Should have processed many composition events
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.be.greaterThan(romajiPhrase.length);
      });

      it('should handle partial phrase conversion with mixed results', () => {
        // Act: Simulate partial conversion where some words become kanji, others remain hiragana
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'kyouwaii',
          })
        );

        // Convert first part to kanji
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: '今日はいい',
          })
        );

        // Add more text
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: '今日はいいてんき',
          })
        );

        // Final mixed result
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: '今日はいい天気',
          })
        );

        // Assert: Should handle mixed conversion results
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.data).to.equal('今日はいい天気');
        expect(imeState.isActive).to.be.false;
      });

      it('should track composition boundaries in multi-segment input', () => {
        const compositionStages: string[] = [];

        // Arrange: Track all composition data changes
        stateManager.addStateListener('ime', (newState) => {
          if (newState.data && newState.data !== '') {
            compositionStages.push(newState.data);
          }
        });

        // Act: Simulate step-by-step phrase building
        const stages = [
          'k',
          'ky',
          'kyo',
          'kyou',
          'kyou ',
          'kyou w',
          'kyou wa',
          'きょう は',
          '今日 は',
          '今日は',
        ];

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: stages[0],
          })
        );

        stages.slice(1).forEach((stage) => {
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionupdate', {
              data: stage,
            })
          );
        });

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: '今日は',
          })
        );

        // Assert: Should track all intermediate stages
        expect(compositionStages.length).to.be.greaterThan(stages.length);
        expect(compositionStages[0]).to.equal('k');
        expect(compositionStages[compositionStages.length - 1]).to.equal('今日は');
      });
    });

    describe('IME Mode Switching', () => {
      it('should handle IME mode toggle during composition', () => {
        // Act: Start composition
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'test',
          })
        );

        expect(stateManager.getStateSection('ime').isActive).to.be.true;

        // Act: Simulate IME mode toggle (Alt+~)
        const altTildeEvent = new (global as any).KeyboardEvent('keydown', {
          key: '~',
          altKey: true,
        });
        inputElement.dispatchEvent(altTildeEvent);

        // Should force composition end
        // (Mock IME will dispatch compositionend)

        // Assert: IME should be deactivated
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;
        expect(imeState.lastEvent).to.equal('end');
      });

      it('should handle rapid IME mode switching', () => {
        // Act: Rapid mode switching
        for (let i = 0; i < 5; i++) {
          // Start composition
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionstart', {
              data: `test${i}`,
            })
          );

          // Toggle IME mode
          const toggleEvent = new (global as any).KeyboardEvent('keydown', {
            key: '~',
            altKey: true,
          });
          inputElement.dispatchEvent(toggleEvent);

          clock.tick(10);
        }

        // Assert: Should handle rapid switching gracefully
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;

        // Assert: No errors should occur
        const errorLogs = logMessages.filter((msg) => msg.toLowerCase().includes('error'));
        expect(errorLogs.length).to.equal(0);
      });
    });
  });

  describe('TDD Red Phase: IME State Validation for Japanese Input', () => {
    describe('Japanese-Specific State Validation', () => {
      it('should validate Japanese character composition data', () => {
        // Act: Update IME state with Japanese characters
        stateManager.updateIMEState({
          isActive: true,
          data: 'こんにちは',
          startOffset: 0,
          endOffset: 5, // 5 Japanese characters
          lastEvent: 'update',
          timestamp: Date.now(),
        });

        // Assert: Should validate without errors
        const warningLogs = logMessages.filter((msg) => msg.includes('State validation warnings'));
        expect(warningLogs.length).to.equal(0);
      });

      it('should handle mixed romaji and Japanese character validation', () => {
        // Act: Update with mixed composition data (typical during conversion)
        stateManager.updateIMEState({
          isActive: true,
          data: 'konこん', // Mixed romaji and hiragana
          startOffset: 0,
          endOffset: 6,
          lastEvent: 'update',
          timestamp: Date.now(),
        });

        // Assert: Should handle mixed content without validation errors
        const errorLogs = logMessages.filter((msg) => msg.includes('State validation errors'));
        expect(errorLogs.length).to.equal(0);
      });

      it('should validate composition boundaries for multi-byte characters', () => {
        // Act: Test various Japanese character boundary scenarios
        const testCases = [
          { data: 'あ', startOffset: 0, endOffset: 1 },
          { data: 'あいう', startOffset: 0, endOffset: 3 },
          { data: '今日', startOffset: 0, endOffset: 2 },
          { data: 'ひらがな漢字', startOffset: 0, endOffset: 6 },
        ];

        testCases.forEach((testCase, index) => {
          stateManager.updateIMEState({
            isActive: true,
            data: testCase.data,
            startOffset: testCase.startOffset,
            endOffset: testCase.endOffset,
            lastEvent: 'update',
            timestamp: Date.now() + index,
          });
        });

        // Assert: All should validate correctly
        const errorLogs = logMessages.filter((msg) => msg.includes('State validation errors'));
        expect(errorLogs.length).to.equal(0);
      });
    });

    describe('IME Composition Lifecycle Validation', () => {
      it('should validate complete Japanese IME composition lifecycle', () => {
        const stateChanges: any[] = [];

        // Arrange: Track state changes for validation
        stateManager.addStateListener('ime', (newState, previousState) => {
          stateChanges.push({
            from: previousState.lastEvent,
            to: newState.lastEvent,
            isActive: newState.isActive,
            hasData: newState.data.length > 0,
          });
        });

        // Act: Complete Japanese input lifecycle
        stateManager.updateIMEState({
          isActive: true,
          data: 'k',
          lastEvent: 'start',
          timestamp: Date.now(),
        });

        stateManager.updateIMEState({
          data: 'ko',
          lastEvent: 'update',
          timestamp: Date.now() + 1,
        });

        stateManager.updateIMEState({
          data: 'こ',
          lastEvent: 'update',
          timestamp: Date.now() + 2,
        });

        stateManager.updateIMEState({
          isActive: false,
          data: 'こ',
          lastEvent: 'end',
          timestamp: Date.now() + 3,
        });

        // Assert: Should have proper lifecycle progression
        expect(stateChanges.length).to.equal(4);
        expect(stateChanges[0].to).to.equal('start');
        expect(stateChanges[1].to).to.equal('update');
        expect(stateChanges[3].to).to.equal('end');
        expect(stateChanges[3].isActive).to.be.false;

        // Assert: No validation errors during lifecycle
        const errorLogs = logMessages.filter((msg) => msg.includes('State validation errors'));
        expect(errorLogs.length).to.equal(0);
      });

      it('should detect and warn about abnormal IME state transitions', () => {
        // Act: Abnormal transition - end without start
        stateManager.updateIMEState({
          isActive: false,
          data: 'unexpected',
          lastEvent: 'end',
          timestamp: Date.now(),
        });

        // Act: Another abnormal transition - active but no data and not start
        stateManager.updateIMEState({
          isActive: true,
          data: '',
          lastEvent: 'update', // Update without start
          timestamp: Date.now() + 1,
        });

        // Assert: Should generate validation warnings
        const warningLogs = logMessages.filter((msg) => msg.includes('State validation warnings'));
        expect(warningLogs.length).to.be.greaterThan(0);
      });
    });
  });

  describe('TDD Red Phase: Performance and Edge Cases', () => {
    describe('High-Frequency Japanese Input', () => {
      it('should handle rapid Japanese composition updates efficiently', () => {
        const startTime = Date.now();

        // Act: Simulate very rapid Japanese typing
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'a',
          })
        );

        // Generate rapid composition updates (typical for fast Japanese typing)
        const rapidSequence = [
          'a',
          'ar',
          'ari',
          'arig',
          'ariga',
          'arigas',
          'arigat',
          'arigato',
          'arigatos',
          'ありが',
          'ありがと',
          'ありがとうご',
          'ありがとうございま',
          'ありがとうございます',
        ];

        rapidSequence.forEach((stage, _index) => {
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionupdate', {
              data: stage,
            })
          );
          clock.tick(1); // Minimal time between updates
        });

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: 'ありがとうございます',
          })
        );

        const endTime = Date.now();

        // Assert: Should process all events efficiently
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.equal(rapidSequence.length + 2); // +2 for start and end

        // Assert: Processing should be reasonably fast
        expect(endTime - startTime).to.be.lessThan(1000);

        // Assert: Final state should be correct
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.data).to.equal('ありがとうございます');
        expect(imeState.isActive).to.be.false;
      });

      it('should maintain accuracy under high-frequency updates', () => {
        let updateCount = 0;
        const allUpdates: string[] = [];

        // Arrange: Track every single update
        stateManager.addStateListener('ime', (newState) => {
          updateCount++;
          if (newState.data) {
            allUpdates.push(newState.data);
          }
        });

        // Act: Generate many rapid updates
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'n',
          })
        );

        for (let i = 1; i <= 100; i++) {
          const data = 'n'.repeat(i % 10) + 'ih' + 'o'.repeat(i % 5);
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionupdate', {
              data: data,
            })
          );
        }

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: '日本語入力テスト',
          })
        );

        // Assert: Should track all updates accurately
        expect(updateCount).to.equal(102); // 1 start + 100 updates + 1 end
        expect(allUpdates.length).to.be.greaterThan(100);
        expect(allUpdates[allUpdates.length - 1]).to.equal('日本語入力テスト');
      });
    });

    describe('Edge Cases in Japanese IME', () => {
      it('should handle empty composition data gracefully', () => {
        // Act: Various empty data scenarios
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: '',
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: '',
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: '',
          })
        );

        // Assert: Should handle empty data without errors
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;
        expect(imeState.data).to.equal('');

        const errorLogs = logMessages.filter((msg) => msg.toLowerCase().includes('error'));
        expect(errorLogs.length).to.equal(0);
      });

      it('should handle very long Japanese composition strings', () => {
        // Arrange: Create very long Japanese composition
        const longJapaneseText = 'これは非常に長い日本語の文章です。'.repeat(50); // 50 repetitions

        // Act: Process long composition
        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionstart', {
            data: 'k',
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionupdate', {
            data: longJapaneseText,
          })
        );

        inputElement.dispatchEvent(
          new (global as any).CompositionEvent('compositionend', {
            data: longJapaneseText,
          })
        );

        // Assert: Should handle long text without issues
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.data).to.equal(longJapaneseText);
        expect(imeState.data.length).to.be.greaterThan(1000);
        expect(imeState.isActive).to.be.false;
      });

      it('should handle special Japanese punctuation and symbols', () => {
        // Act: Test various Japanese punctuation
        const specialCharacters = [
          '。',
          '、',
          '？',
          '！',
          '「',
          '」',
          '『',
          '』',
          '（',
          '）',
          '・',
          '〜',
          '：',
          '；',
          '※',
          '§',
        ];

        specialCharacters.forEach((char, _index) => {
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionstart', {
              data: char,
            })
          );

          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionend', {
              data: char,
            })
          );

          // Verify each character is handled
          const imeState = stateManager.getStateSection('ime');
          expect(imeState.data).to.equal(char);
        });

        // Assert: All special characters processed
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.equal(specialCharacters.length * 2);
      });

      it('should handle corrupted composition events gracefully', () => {
        // Act: Simulate corrupted/malformed events
        try {
          // Null data
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionstart', {
              data: null as any,
            })
          );

          // Undefined data
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionupdate', {
              data: undefined as any,
            })
          );

          // Very unusual data
          inputElement.dispatchEvent(
            new (global as any).CompositionEvent('compositionend', {
              data: '\uFEFF\u200B\u200C', // Zero-width characters
            })
          );
        } catch (error) {
          // Should not throw errors
        }

        // Assert: Should handle corrupted events gracefully
        const errorLogs = logMessages.filter((msg) => msg.toLowerCase().includes('error'));
        expect(errorLogs.length).to.equal(0);

        // Should maintain stable state
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;
      });
    });

    describe('Memory Management for Japanese IME', () => {
      it('should manage memory efficiently with long Japanese input sessions', () => {
        // Act: Simulate extended Japanese input session
        for (let session = 0; session < 10; session++) {
          for (let phrase = 0; phrase < 20; phrase++) {
            inputElement.dispatchEvent(
              new (global as any).CompositionEvent('compositionstart', {
                data: 'test',
              })
            );

            // Simulate complex phrase
            for (let stage = 0; stage < 15; stage++) {
              inputElement.dispatchEvent(
                new (global as any).CompositionEvent('compositionupdate', {
                  data: `日本語テスト${session}${phrase}${stage}`,
                })
              );
            }

            inputElement.dispatchEvent(
              new (global as any).CompositionEvent('compositionend', {
                data: `日本語テスト完了${session}${phrase}`,
              })
            );
          }
        }

        // Assert: Should process all events without memory issues
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.be.greaterThan(3000); // 10*20*15 + overhead

        // Assert: State history should be managed (not growing unbounded)
        const history = stateManager.getStateHistory(200);
        expect(history.length).to.be.lessThanOrEqual(100); // Should be capped

        // Assert: No memory-related errors
        const errorLogs = logMessages.filter(
          (msg) => msg.toLowerCase().includes('memory') || msg.toLowerCase().includes('error')
        );
        expect(errorLogs.length).to.equal(0);
      });
    });
  });
});
