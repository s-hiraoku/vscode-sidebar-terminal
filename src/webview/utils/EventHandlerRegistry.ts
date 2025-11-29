/**
 * EventHandlerRegistry Utility
 *
 * Centralized event listener management to eliminate code duplication
 * across InputManager, TerminalLifecycleCoordinator, and other managers
 */

import { webview as log } from '../../utils/logger';

export interface EventListenerConfig {
  element: EventTarget;
  type: string;
  listener: EventListener;
  options?: boolean | AddEventListenerOptions;
}

export interface RegisteredEventListener extends EventListenerConfig {
  key: string;
  registeredAt: number;
}

interface Disposable {
  dispose(): void;
}

/**
 * Centralized event handler registry
 * Provides automatic cleanup and organized event listener management
 */
export class EventHandlerRegistry implements Disposable {
  private listeners = new Map<string, RegisteredEventListener>();
  private disposed = false;

  /**
   * Register an event listener with automatic cleanup tracking
   * @param key Unique identifier for this listener
   * @param element Element to attach listener to
   * @param type Event type (e.g., 'click', 'keydown')
   * @param listener Event listener function
   * @param options Event listener options
   */
  register(
    key: string,
    element: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (this.disposed) {
      log(`⚠️ EventRegistry: Cannot register ${key} - registry is disposed`);
      return;
    }

    // Remove existing listener with same key
    this.unregister(key);

    try {
      // Add the event listener
      element.addEventListener(type, listener, options);

      // Store the listener info for cleanup
      const registeredListener: RegisteredEventListener = {
        key,
        element,
        type,
        listener,
        options,
        registeredAt: Date.now(),
      };

      this.listeners.set(key, registeredListener);

      log(`📡 EventRegistry: Registered ${key} (${type} on ${this.getElementName(element)})`);
    } catch (error) {
      log(`❌ EventRegistry: Failed to register ${key}:`, error);
    }
  }

  /**
   * Register multiple event listeners at once
   * @param configs Array of event listener configurations
   */
  registerMultiple(configs: Array<EventListenerConfig & { key: string }>): void {
    for (const config of configs) {
      this.register(config.key, config.element, config.type, config.listener, config.options);
    }
  }

  /**
   * Unregister a specific event listener
   * @param key The listener key to remove
   */
  unregister(key: string): boolean {
    const listener = this.listeners.get(key);
    if (!listener) {
      return false;
    }

    try {
      listener.element.removeEventListener(listener.type, listener.listener, listener.options);

      this.listeners.delete(key);

      log(`🧹 EventRegistry: Unregistered ${key} (${listener.type})`);
      return true;
    } catch (error) {
      log(`❌ EventRegistry: Failed to unregister ${key}:`, error);
      return false;
    }
  }

  /**
   * Unregister multiple listeners by key pattern
   * @param pattern RegExp pattern to match keys
   */
  unregisterByPattern(pattern: RegExp): number {
    const keysToRemove = Array.from(this.listeners.keys()).filter((key) => pattern.test(key));

    let removed = 0;
    for (const key of keysToRemove) {
      if (this.unregister(key)) {
        removed++;
      }
    }

    log(`🧹 EventRegistry: Unregistered ${removed} listeners matching pattern ${pattern}`);
    return removed;
  }

  /**
   * Check if a listener is registered
   * @param key The listener key to check
   */
  isRegistered(key: string): boolean {
    return this.listeners.has(key);
  }

  /**
   * Get all registered listener keys
   */
  getRegisteredKeys(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get the count of registered listeners
   */
  getRegisteredCount(): number {
    return this.listeners.size;
  }

  /**
   * Get detailed information about a specific listener
   * @param key The listener key
   */
  getListenerInfo(key: string): RegisteredEventListener | null {
    return this.listeners.get(key) || null;
  }

  /**
   * Get statistics about registered listeners
   */
  getStats(): {
    totalListeners: number;
    eventTypes: string[];
    elements: string[];
    oldestRegistration: number | null;
    newestRegistration: number | null;
  } {
    const listeners = Array.from(this.listeners.values());

    return {
      totalListeners: listeners.length,
      eventTypes: [...new Set(listeners.map((l) => l.type))],
      elements: [...new Set(listeners.map((l) => this.getElementName(l.element)))],
      oldestRegistration:
        listeners.length > 0 ? Math.min(...listeners.map((l) => l.registeredAt)) : null,
      newestRegistration:
        listeners.length > 0 ? Math.max(...listeners.map((l) => l.registeredAt)) : null,
    };
  }

  /**
   * Create a scoped registry for a specific component
   * All listeners registered through this scope will have a prefix
   * @param prefix Prefix for all keys in this scope
   */
  createScope(prefix: string): ScopedEventRegistry {
    return new ScopedEventRegistry(this, prefix);
  }

  /**
   * Clean up all registered event listeners
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    const listenerCount = this.listeners.size;
    log(`🧹 EventRegistry: Disposing ${listenerCount} listeners...`);

    // Remove all listeners
    for (const [key] of this.listeners) {
      this.unregister(key);
    }

    this.disposed = true;
    log('✅ EventRegistry: Disposed');
  }

  /**
   * Get a human-readable name for an element
   */
  private getElementName(element: EventTarget): string {
    if (element === window) return 'window';
    if (element === document) return 'document';
    if (element instanceof HTMLElement) {
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className ? `.${element.className.split(' ')[0]}` : ''}`;
    }
    return 'unknown';
  }
}

/**
 * Scoped event registry that automatically prefixes all keys
 */
export class ScopedEventRegistry {
  constructor(
    private registry: EventHandlerRegistry,
    private prefix: string
  ) {}

  register(
    key: string,
    element: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.registry.register(`${this.prefix}:${key}`, element, type, listener, options);
  }

  registerMultiple(configs: Array<EventListenerConfig & { key: string }>): void {
    const prefixedConfigs = configs.map((config) => ({
      ...config,
      key: `${this.prefix}:${config.key}`,
    }));
    this.registry.registerMultiple(prefixedConfigs);
  }

  unregister(key: string): boolean {
    return this.registry.unregister(`${this.prefix}:${key}`);
  }

  unregisterAll(): number {
    return this.registry.unregisterByPattern(new RegExp(`^${this.prefix}:`));
  }

  isRegistered(key: string): boolean {
    return this.registry.isRegistered(`${this.prefix}:${key}`);
  }

  getRegisteredKeys(): string[] {
    return this.registry
      .getRegisteredKeys()
      .filter((key) => key.startsWith(`${this.prefix}:`))
      .map((key) => key.substring(this.prefix.length + 1));
  }
}

// Create a global instance for convenience
export const globalEventRegistry = new EventHandlerRegistry();
