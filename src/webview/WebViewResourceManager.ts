/**
 * WebView Resource Manager
 *
 * Manages resources for WebView components including CSS, assets, and external resources.
 */

import { IManagerLifecycle } from './interfaces/ManagerInterfaces';

export interface WebViewResource {
  id: string;
  type: 'css' | 'js' | 'font' | 'image' | 'other';
  url: string;
  content?: string;
  loaded: boolean;
  error?: Error;
}

export interface ResourceLoadOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
}

export interface IWebViewResourceManager extends IManagerLifecycle {
  loadCSS(id: string, url: string, options?: ResourceLoadOptions): Promise<WebViewResource>;
  loadJS(id: string, url: string, options?: ResourceLoadOptions): Promise<WebViewResource>;
  loadImage(id: string, url: string, options?: ResourceLoadOptions): Promise<WebViewResource>;
  loadFont(id: string, url: string, options?: ResourceLoadOptions): Promise<WebViewResource>;
  getResource(id: string): WebViewResource | undefined;
  isResourceLoaded(id: string): boolean;
  getAllResources(): WebViewResource[];
  unloadResource(id: string): void;
  clearAllResources(): void;
  isReady(): boolean;
}

export class WebViewResourceManager implements IWebViewResourceManager {
  private resources = new Map<string, WebViewResource>();
  private loadingPromises = new Map<string, Promise<WebViewResource>>();
  private disposed = false;

  constructor() {}

  async initialize(): Promise<void> {
    // Initialize default resources if needed
  }

  /**
   * Load a CSS resource
   */
  async loadCSS(id: string, url: string, options?: ResourceLoadOptions): Promise<WebViewResource> {
    return this.loadResource(
      {
        id,
        type: 'css',
        url,
        loaded: false,
      },
      options
    );
  }

  /**
   * Load a JavaScript resource
   */
  async loadJS(id: string, url: string, options?: ResourceLoadOptions): Promise<WebViewResource> {
    return this.loadResource(
      {
        id,
        type: 'js',
        url,
        loaded: false,
      },
      options
    );
  }

  /**
   * Load an image resource
   */
  async loadImage(
    id: string,
    url: string,
    options?: ResourceLoadOptions
  ): Promise<WebViewResource> {
    return this.loadResource(
      {
        id,
        type: 'image',
        url,
        loaded: false,
      },
      options
    );
  }

  /**
   * Load a font resource
   */
  async loadFont(id: string, url: string, options?: ResourceLoadOptions): Promise<WebViewResource> {
    return this.loadResource(
      {
        id,
        type: 'font',
        url,
        loaded: false,
      },
      options
    );
  }

  /**
   * Generic resource loading method
   */
  private async loadResource(
    resource: WebViewResource,
    options?: ResourceLoadOptions
  ): Promise<WebViewResource> {
    if (this.disposed) {
      throw new Error('WebViewResourceManager has been disposed');
    }

    // Check if resource is already loaded
    const existing = this.resources.get(resource.id);
    if (existing && existing.loaded) {
      return existing;
    }

    // Check if loading is already in progress
    const loadingPromise = this.loadingPromises.get(resource.id);
    if (loadingPromise) {
      return loadingPromise;
    }

    // Start loading
    const promise = this.performLoad(resource, options);
    this.loadingPromises.set(resource.id, promise);

    try {
      const loadedResource = await promise;
      this.resources.set(resource.id, loadedResource);
      this.loadingPromises.delete(resource.id);
      return loadedResource;
    } catch (error) {
      this.loadingPromises.delete(resource.id);
      throw error;
    }
  }

  /**
   * Perform the actual resource loading
   */
  private async performLoad(
    resource: WebViewResource,
    options: ResourceLoadOptions = {}
  ): Promise<WebViewResource> {
    const { timeout = 5000, retries = 3 } = options;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        switch (resource.type) {
          case 'css':
            await this.loadCSSResource(resource, timeout);
            break;
          case 'js':
            await this.loadJSResource(resource, timeout);
            break;
          case 'image':
            await this.loadImageResource(resource, timeout);
            break;
          case 'font':
            await this.loadFontResource(resource, timeout);
            break;
          default:
            await this.loadGenericResource(resource, timeout);
        }

        resource.loaded = true;
        return resource;
      } catch (error) {
        if (attempt === retries - 1) {
          resource.error = error as Error;
          throw error;
        }
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to load resource ${resource.id} after ${retries} attempts`);
  }

  /**
   * Load CSS resource
   */
  private async loadCSSResource(resource: WebViewResource, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = resource.url;

      const timeoutId = setTimeout(() => {
        reject(new Error(`CSS load timeout: ${resource.url}`));
      }, timeout);

      link.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      link.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load CSS: ${resource.url}`));
      };

      document.head.appendChild(link);
    });
  }

  /**
   * Load JavaScript resource
   */
  private async loadJSResource(resource: WebViewResource, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = resource.url;

      const timeoutId = setTimeout(() => {
        reject(new Error(`JS load timeout: ${resource.url}`));
      }, timeout);

      script.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load JS: ${resource.url}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Load image resource
   */
  private async loadImageResource(resource: WebViewResource, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      const timeoutId = setTimeout(() => {
        reject(new Error(`Image load timeout: ${resource.url}`));
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load image: ${resource.url}`));
      };

      img.src = resource.url;
    });
  }

  /**
   * Load font resource
   */
  private async loadFontResource(resource: WebViewResource, timeout: number): Promise<void> {
    if ('fonts' in document) {
      try {
        await (document as any).fonts.load(`1em ${resource.url}`);
      } catch (error) {
        throw new Error(`Failed to load font: ${resource.url}`);
      }
    } else {
      // Fallback for older browsers
      await this.loadCSSResource(resource, timeout);
    }
  }

  /**
   * Load generic resource via fetch
   */
  private async loadGenericResource(resource: WebViewResource, timeout: number): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(resource.url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      resource.content = await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get a loaded resource
   */
  getResource(id: string): WebViewResource | undefined {
    return this.resources.get(id);
  }

  /**
   * Check if a resource is loaded
   */
  isResourceLoaded(id: string): boolean {
    const resource = this.resources.get(id);
    return resource?.loaded ?? false;
  }

  /**
   * Get all loaded resources
   */
  getAllResources(): WebViewResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Unload a resource
   */
  unloadResource(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      // Remove from DOM if applicable
      if (resource.type === 'css') {
        const links = document.querySelectorAll(`link[href="${resource.url}"]`);
        links.forEach((link) => link.remove());
      } else if (resource.type === 'js') {
        const scripts = document.querySelectorAll(`script[src="${resource.url}"]`);
        scripts.forEach((script) => script.remove());
      }

      this.resources.delete(id);
    }
  }

  /**
   * Clear all resources
   */
  clearAllResources(): void {
    for (const id of this.resources.keys()) {
      this.unloadResource(id);
    }
  }

  /**
   * Check if resource manager is ready
   */
  isReady(): boolean {
    return !this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;

    this.clearAllResources();
    this.loadingPromises.clear();
    this.disposed = true;
  }
}
