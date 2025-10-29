/**
 * EventBus Unit Tests
 *
 * Tests for the typed event bus system.
 */

import { expect } from 'chai';
import {
  EventBus,
  createEventType,
  Event,
} from '../../../core/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.dispose();
  });

  describe('Event Type Creation', () => {
    it('should create event type with name', () => {
      const TestEvent = createEventType<{ value: number }>('test.event');

      expect(TestEvent.name).to.equal('test.event');
    });

    it('should create different event types with different names', () => {
      const Event1 = createEventType<string>('event1');
      const Event2 = createEventType<string>('event2');

      expect(Event1.name).to.not.equal(Event2.name);
    });
  });

  describe('Subscribe and Publish', () => {
    it('should subscribe to an event', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let called = false;

      eventBus.subscribe(TestEvent, () => {
        called = true;
      });

      eventBus.publish(TestEvent, { value: 42 });

      expect(called).to.be.true;
    });

    it('should receive event data in handler', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let receivedValue = 0;

      eventBus.subscribe(TestEvent, (event) => {
        receivedValue = event.data.value;
      });

      eventBus.publish(TestEvent, { value: 42 });

      expect(receivedValue).to.equal(42);
    });

    it('should include metadata in event', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let receivedEvent: Event<{ value: number }> | undefined;

      eventBus.subscribe(TestEvent, (event) => {
        receivedEvent = event;
      });

      eventBus.publish(TestEvent, { value: 42 });

      expect(receivedEvent).to.exist;
      if (receivedEvent) {
        expect(receivedEvent.type).to.equal(TestEvent);
        expect(receivedEvent.data.value).to.equal(42);
        expect(receivedEvent.timestamp).to.be.instanceOf(Date);
        expect(receivedEvent.id).to.be.a('string');
      }
    });

    it('should notify multiple subscribers', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let count = 0;

      eventBus.subscribe(TestEvent, () => {
        count++;
      });
      eventBus.subscribe(TestEvent, () => {
        count++;
      });
      eventBus.subscribe(TestEvent, () => {
        count++;
      });

      eventBus.publish(TestEvent, { value: 42 });

      expect(count).to.equal(3);
    });

    it('should not notify unsubscribed handlers', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let called = false;

      const subscription = eventBus.subscribe(TestEvent, () => {
        called = true;
      });

      subscription.dispose();
      eventBus.publish(TestEvent, { value: 42 });

      expect(called).to.be.false;
    });

    it('should not affect other event types', () => {
      const Event1 = createEventType<{ value: number }>('event1');
      const Event2 = createEventType<{ value: number }>('event2');
      let count1 = 0;
      let count2 = 0;

      eventBus.subscribe(Event1, () => {
        count1++;
      });
      eventBus.subscribe(Event2, () => {
        count2++;
      });

      eventBus.publish(Event1, { value: 1 });

      expect(count1).to.equal(1);
      expect(count2).to.equal(0);
    });
  });

  describe('Subscription Management', () => {
    it('should return disposable subscription', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      const subscription = eventBus.subscribe(TestEvent, () => {});

      expect(subscription).to.have.property('dispose');
      expect(subscription.dispose).to.be.a('function');
    });

    it('should allow multiple dispose calls', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      const subscription = eventBus.subscribe(TestEvent, () => {});

      subscription.dispose();
      subscription.dispose(); // Should not throw

      expect(true).to.be.true; // Test passes if no error
    });

    it('should get subscriber count', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      expect(eventBus.getSubscriberCount(TestEvent)).to.equal(0);

      eventBus.subscribe(TestEvent, () => {});
      expect(eventBus.getSubscriberCount(TestEvent)).to.equal(1);

      eventBus.subscribe(TestEvent, () => {});
      expect(eventBus.getSubscriberCount(TestEvent)).to.equal(2);
    });

    it('should update subscriber count after disposal', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      const sub1 = eventBus.subscribe(TestEvent, () => {});
      const sub2 = eventBus.subscribe(TestEvent, () => {});

      expect(eventBus.getSubscriberCount(TestEvent)).to.equal(2);

      sub1.dispose();
      expect(eventBus.getSubscriberCount(TestEvent)).to.equal(1);

      sub2.dispose();
      expect(eventBus.getSubscriberCount(TestEvent)).to.equal(0);
    });

    it('should get total subscriptions', () => {
      const Event1 = createEventType<string>('event1');
      const Event2 = createEventType<string>('event2');

      expect(eventBus.totalSubscriptions).to.equal(0);

      eventBus.subscribe(Event1, () => {});
      expect(eventBus.totalSubscriptions).to.equal(1);

      eventBus.subscribe(Event2, () => {});
      expect(eventBus.totalSubscriptions).to.equal(2);

      eventBus.subscribe(Event1, () => {});
      expect(eventBus.totalSubscriptions).to.equal(3);
    });
  });

  describe('Async Handlers', () => {
    it('should support async handlers', async () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let completed = false;

      eventBus.subscribe(TestEvent, async (_event) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completed = true;
      });

      eventBus.publish(TestEvent, { value: 42 });

      // Give async handler time to complete
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(completed).to.be.true;
    });

    it('should catch async handler errors', async () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let otherHandlerCalled = false;

      eventBus.subscribe(TestEvent, async () => {
        throw new Error('Async error');
      });

      eventBus.subscribe(TestEvent, () => {
        otherHandlerCalled = true;
      });

      eventBus.publish(TestEvent, { value: 42 });

      // Give time for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Other handler should still be called
      expect(otherHandlerCalled).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should isolate handler errors', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let handler2Called = false;
      let handler3Called = false;

      eventBus.subscribe(TestEvent, () => {
        throw new Error('Handler error');
      });

      eventBus.subscribe(TestEvent, () => {
        handler2Called = true;
      });

      eventBus.subscribe(TestEvent, () => {
        handler3Called = true;
      });

      eventBus.publish(TestEvent, { value: 42 });

      expect(handler2Called).to.be.true;
      expect(handler3Called).to.be.true;
    });

    it('should not prevent event publishing after handler error', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let callCount = 0;

      eventBus.subscribe(TestEvent, () => {
        throw new Error('Error');
      });

      eventBus.publish(TestEvent, { value: 1 });
      eventBus.publish(TestEvent, { value: 2 });

      eventBus.subscribe(TestEvent, () => {
        callCount++;
      });

      eventBus.publish(TestEvent, { value: 3 });

      expect(callCount).to.equal(1);
    });
  });

  describe('Event History and Replay', () => {
    it('should record events in history', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      eventBus.publish(TestEvent, { value: 1 });
      eventBus.publish(TestEvent, { value: 2 });
      eventBus.publish(TestEvent, { value: 3 });

      const history = eventBus.replay();

      expect(history).to.have.length(3);
      if (history.length === 3) {
        expect(history[0]?.data).to.deep.equal({ value: 1 });
        expect(history[1]?.data).to.deep.equal({ value: 2 });
        expect(history[2]?.data).to.deep.equal({ value: 3 });
      }
    });

    it('should replay events since timestamp', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      eventBus.publish(TestEvent, { value: 1 });

      const cutoffTime = new Date();

      // Small delay to ensure timestamp difference
      const delay = new Promise((resolve) => setTimeout(resolve, 10));
      return delay.then(() => {
        eventBus.publish(TestEvent, { value: 2 });
        eventBus.publish(TestEvent, { value: 3 });

        const recentEvents = eventBus.replay(cutoffTime);

        expect(recentEvents).to.have.length(2);
        if (recentEvents.length === 2) {
          expect(recentEvents[0]?.data).to.deep.equal({ value: 2 });
          expect(recentEvents[1]?.data).to.deep.equal({ value: 3 });
        }
      });
    });

    it('should get history size', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      expect(eventBus.historySize).to.equal(0);

      eventBus.publish(TestEvent, { value: 1 });
      expect(eventBus.historySize).to.equal(1);

      eventBus.publish(TestEvent, { value: 2 });
      expect(eventBus.historySize).to.equal(2);
    });

    it('should clear history', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      eventBus.publish(TestEvent, { value: 1 });
      eventBus.publish(TestEvent, { value: 2 });

      expect(eventBus.historySize).to.equal(2);

      eventBus.clearHistory();

      expect(eventBus.historySize).to.equal(0);
    });

    it('should limit history size', () => {
      const limitedBus = new EventBus({ maxHistorySize: 3 });
      const TestEvent = createEventType<{ value: number }>('test');

      limitedBus.publish(TestEvent, { value: 1 });
      limitedBus.publish(TestEvent, { value: 2 });
      limitedBus.publish(TestEvent, { value: 3 });
      limitedBus.publish(TestEvent, { value: 4 });

      const history = limitedBus.replay();

      expect(history).to.have.length(3);
      if (history.length === 3) {
        expect(history[0]?.data).to.deep.equal({ value: 2 });
        expect(history[1]?.data).to.deep.equal({ value: 3 });
        expect(history[2]?.data).to.deep.equal({ value: 4 });
      }

      limitedBus.dispose();
    });
  });

  describe('Disposal', () => {
    it('should dispose all subscriptions', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let callCount = 0;

      eventBus.subscribe(TestEvent, () => {
        callCount++;
      });
      eventBus.subscribe(TestEvent, () => {
        callCount++;
      });

      eventBus.dispose();

      eventBus.publish(TestEvent, { value: 42 });

      expect(callCount).to.equal(0);
    });

    it('should clear history on disposal', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      eventBus.publish(TestEvent, { value: 1 });
      eventBus.publish(TestEvent, { value: 2 });

      eventBus.dispose();

      expect(eventBus.historySize).to.equal(0);
    });

    it('should throw error when using disposed event bus', () => {
      const TestEvent = createEventType<{ value: number }>('test');

      eventBus.dispose();

      expect(() => eventBus.subscribe(TestEvent, () => {})).to.throw(
        'Cannot use disposed EventBus'
      );
    });

    it('should allow multiple dispose calls', () => {
      eventBus.dispose();
      eventBus.dispose(); // Should not throw

      expect(true).to.be.true;
    });
  });

  describe('Complex Event Scenarios', () => {
    it('should handle event published during handler execution', () => {
      const Event1 = createEventType<{ value: number }>('event1');
      const Event2 = createEventType<{ value: number }>('event2');
      let event2CallCount = 0;

      eventBus.subscribe(Event1, () => {
        eventBus.publish(Event2, { value: 100 });
      });

      eventBus.subscribe(Event2, () => {
        event2CallCount++;
      });

      eventBus.publish(Event1, { value: 1 });

      expect(event2CallCount).to.equal(1);
    });

    it('should handle subscription during handler execution', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let laterHandlerCalled = false;

      eventBus.subscribe(TestEvent, () => {
        eventBus.subscribe(TestEvent, () => {
          laterHandlerCalled = true;
        });
      });

      eventBus.publish(TestEvent, { value: 1 });
      expect(laterHandlerCalled).to.be.false; // New handler not called yet

      eventBus.publish(TestEvent, { value: 2 });
      expect(laterHandlerCalled).to.be.true; // New handler called now
    });

    it('should handle unsubscribe during handler execution', () => {
      const TestEvent = createEventType<{ value: number }>('test');
      let handler2Called = false;
      let subscription2: any;

      eventBus.subscribe(TestEvent, () => {
        if (subscription2) {
          subscription2.dispose();
        }
      });

      subscription2 = eventBus.subscribe(TestEvent, () => {
        handler2Called = true;
      });

      eventBus.publish(TestEvent, { value: 1 });

      // Handler 2 should be called in first publish (before disposal)
      expect(handler2Called).to.be.true;

      handler2Called = false;
      eventBus.publish(TestEvent, { value: 2 });

      // Handler 2 should not be called after disposal
      expect(handler2Called).to.be.false;
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for event data', () => {
      interface CustomData {
        id: number;
        name: string;
        active: boolean;
      }

      const CustomEvent = createEventType<CustomData>('custom');
      let receivedData: CustomData | null = null;

      eventBus.subscribe(CustomEvent, (event) => {
        receivedData = event.data;
      });

      eventBus.publish(CustomEvent, {
        id: 42,
        name: 'Test',
        active: true,
      });

      expect(receivedData).to.deep.equal({
        id: 42,
        name: 'Test',
        active: true,
      });
    });
  });
});
