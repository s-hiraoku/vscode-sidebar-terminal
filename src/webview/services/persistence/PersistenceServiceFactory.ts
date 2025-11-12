/**
 * WebView Persistence Service Factory
 *
 * Clean Architecture - Factory Pattern
 * Creates persistence service for WebView context.
 */

import {
  IPersistenceService,
  IPersistenceServiceFactory,
  PersistenceConfig,
} from '../../../interfaces/IPersistenceService';
import { WebViewPersistenceService } from './WebViewPersistenceService';

/**
 * Persistence service factory for WebView context
 */
export class WebViewPersistenceServiceFactory
  implements IPersistenceServiceFactory
{
  createService(config: PersistenceConfig): IPersistenceService {
    return new WebViewPersistenceService(config);
  }
}

/**
 * Default persistence configuration for WebView
 */
export const defaultWebViewPersistenceConfig: PersistenceConfig = {
  maxSessions: 20, // Lower limit for browser storage
  maxScrollbackSize: 1000, // Smaller scrollback for browser
  enableAutoSave: false, // Manual save in WebView
  autoSaveInterval: 0,
};

/**
 * Create persistence service for WebView context
 */
export function createWebViewPersistenceService(
  config: Partial<PersistenceConfig> = {}
): IPersistenceService {
  const factory = new WebViewPersistenceServiceFactory();
  const mergedConfig = {
    ...defaultWebViewPersistenceConfig,
    ...config,
  };
  return factory.createService(mergedConfig);
}
