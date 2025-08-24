/**
 * WebView Message Router
 * 
 * Routes messages between WebView and Extension Host
 */

import { IManagerLifecycle } from '../webview/interfaces/ManagerInterfaces';

export type MessageType = 
  | 'init'
  | 'output'
  | 'input'
  | 'resize'
  | 'clear'
  | 'killTerminal'
  | 'deleteTerminal'
  | 'createTerminal'
  | 'switchTerminal'
  | 'stateUpdate'
  | 'settings'
  | 'notification'
  | 'error';

export interface WebViewMessage {
  type: MessageType;
  id?: string;
  data?: unknown;
  timestamp: number;
  source: 'webview' | 'extension';
}

export interface MessageHandler {
  (message: WebViewMessage): Promise<void> | void;
}

export interface MessageRoute {
  type: MessageType;
  handler: MessageHandler;
  priority: number;
}

export interface IWebViewMessageRouter extends IManagerLifecycle {
  registerHandler(type: MessageType, handler: MessageHandler, priority?: number): void;
  unregisterHandler(type: MessageType, handler: MessageHandler): void;
  sendToExtension(type: MessageType, data?: unknown, id?: string): void;
  broadcast(type: MessageType, data?: unknown): Promise<void>;
  getStats(): { queueSize: number; isProcessing: boolean; registeredRoutes: number; totalRoutes: number };
  clearQueue(): void;
  isReady(): boolean;
}

export class WebViewMessageRouter implements IWebViewMessageRouter {
  private routes = new Map<MessageType, MessageRoute[]>();
  private messageQueue: WebViewMessage[] = [];
  private isProcessing = false;
  private disposed = false;
  private vscodeApi?: any;

  constructor() {
    this.vscodeApi = this.acquireVsCodeApi();
  }

  async initialize(): Promise<void> {
    this.setupMessageListener();
  }

  /**
   * Acquire VS Code API for WebView communication
   */
  private acquireVsCodeApi(): any {
    if (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) {
      return (window as any).acquireVsCodeApi();
    }
    return null;
  }

  /**
   * Setup message listener from Extension Host
   */
  private setupMessageListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (event.data && typeof event.data === 'object') {
          this.handleIncomingMessage({
            ...event.data,
            timestamp: event.data.timestamp || Date.now(),
            source: 'extension'
          });
        }
      });
    }
  }

  /**
   * Register a message handler
   */
  registerHandler(type: MessageType, handler: MessageHandler, priority: number = 0): void {
    if (this.disposed) {
      throw new Error('WebViewMessageRouter has been disposed');
    }

    const route: MessageRoute = { type, handler, priority };
    
    if (!this.routes.has(type)) {
      this.routes.set(type, []);
    }

    const routes = this.routes.get(type)!;
    routes.push(route);
    
    // Sort by priority (higher priority first)
    routes.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(type: MessageType, handler: MessageHandler): void {
    const routes = this.routes.get(type);
    if (routes) {
      const index = routes.findIndex(route => route.handler === handler);
      if (index !== -1) {
        routes.splice(index, 1);
      }
      
      if (routes.length === 0) {
        this.routes.delete(type);
      }
    }
  }

  /**
   * Send message to Extension Host
   */
  sendToExtension(type: MessageType, data?: unknown, id?: string): void {
    if (this.disposed || !this.vscodeApi) {
      console.warn('Cannot send message: router disposed or VS Code API unavailable');
      return;
    }

    const message: WebViewMessage = {
      type,
      id,
      data,
      timestamp: Date.now(),
      source: 'webview'
    };

    try {
      this.vscodeApi.postMessage(message);
    } catch (error) {
      console.error('Failed to send message to extension:', error);
    }
  }

  /**
   * Handle incoming message from Extension Host
   */
  private handleIncomingMessage(message: WebViewMessage): void {
    if (this.disposed) return;

    this.messageQueue.push(message);
    this.processMessageQueue();
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.messageQueue.length > 0 && !this.disposed) {
        const message = this.messageQueue.shift()!;
        await this.routeMessage(message);
      }
    } catch (error) {
      console.error('Error processing message queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Route message to registered handlers
   */
  private async routeMessage(message: WebViewMessage): Promise<void> {
    const routes = this.routes.get(message.type);
    if (!routes || routes.length === 0) {
      console.warn(`No handler registered for message type: ${message.type}`);
      return;
    }

    // Execute handlers in priority order
    for (const route of routes) {
      try {
        await route.handler(message);
      } catch (error) {
        console.error(`Error in message handler for ${message.type}:`, error);
      }
    }
  }

  /**
   * Broadcast message to all handlers of a type
   */
  async broadcast(type: MessageType, data?: unknown): Promise<void> {
    const message: WebViewMessage = {
      type,
      data,
      timestamp: Date.now(),
      source: 'webview'
    };

    await this.routeMessage(message);
  }

  /**
   * Get message queue statistics
   */
  getStats(): {
    queueSize: number;
    isProcessing: boolean;
    registeredRoutes: number;
    totalRoutes: number;
  } {
    let totalRoutes = 0;
    for (const routes of this.routes.values()) {
      totalRoutes += routes.length;
    }

    return {
      queueSize: this.messageQueue.length,
      isProcessing: this.isProcessing,
      registeredRoutes: this.routes.size,
      totalRoutes
    };
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue.length = 0;
  }

  /**
   * Check if router is ready to send messages
   */
  isReady(): boolean {
    return !this.disposed && this.vscodeApi != null;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.clearQueue();
    this.routes.clear();
    this.isProcessing = false;
    this.vscodeApi = null;
  }
}