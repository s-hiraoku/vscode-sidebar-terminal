/**
 * Persistence Service Factory
 *
 * Clean Architecture - Factory Pattern
 * Creates appropriate persistence service based on runtime context.
 *
 * This factory abstracts away the implementation details and provides
 * a unified way to obtain persistence services.
 */

import * as vscode from 'vscode';
import {
  IPersistenceService,
  IPersistenceServiceFactory,
  PersistenceConfig,
} from '../../interfaces/IPersistenceService';
import { ExtensionPersistenceService } from './ExtensionPersistenceService';

/**
 * Persistence service factory for Extension context
 */
export class ExtensionPersistenceServiceFactory
  implements IPersistenceServiceFactory
{
  constructor(private readonly context: vscode.ExtensionContext) {}

  createService(config: PersistenceConfig): IPersistenceService {
    return new ExtensionPersistenceService(this.context, config);
  }
}

/**
 * Default persistence configuration
 */
export const defaultPersistenceConfig: PersistenceConfig = {
  maxSessions: 50,
  maxScrollbackSize: 2000,
  enableAutoSave: true,
  autoSaveInterval: 30000, // 30 seconds
};

/**
 * Create persistence service for Extension context
 */
export function createExtensionPersistenceService(
  context: vscode.ExtensionContext,
  config: Partial<PersistenceConfig> = {}
): IPersistenceService {
  const factory = new ExtensionPersistenceServiceFactory(context);
  const mergedConfig = {
    ...defaultPersistenceConfig,
    ...config,
  };
  return factory.createService(mergedConfig);
}
