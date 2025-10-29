/**
 * Service Registration for DIContainer
 *
 * This module provides service registration helpers for the DI container.
 * Services are registered here and will be bootstrapped in ExtensionLifecycle (Phase 2 Week 3).
 */

import type { DIContainer } from './DIContainer';
import { ServiceLifetime } from './DIContainer';
import type { EventBus } from './EventBus';
import { BufferManagementService } from '../services/buffer/BufferManagementService';
import { IBufferManagementService } from '../services/buffer/IBufferManagementService';
import { TerminalStateService } from '../services/state/TerminalStateService';
import { ITerminalStateService } from '../services/state/ITerminalStateService';
import { PluginManager } from './plugins/PluginManager';
import { ClaudePlugin } from '../plugins/agents/ClaudePlugin';
import { CopilotPlugin } from '../plugins/agents/CopilotPlugin';
import { GeminiPlugin } from '../plugins/agents/GeminiPlugin';
import { CodexPlugin } from '../plugins/agents/CodexPlugin';

/**
 * Register Phase 2 services in the DI container
 *
 * This function will be called from ExtensionLifecycle.activate() in Phase 2 Week 3.
 * For now, it serves as documentation of service dependencies.
 *
 * @param container DI container instance
 * @param eventBus Shared EventBus instance
 */
export function registerPhase2Services(
  container: DIContainer,
  eventBus: EventBus
): void {
  // Register BufferManagementService (Phase 2 Week 1)
  container.register(
    IBufferManagementService,
    () => new BufferManagementService(eventBus),
    ServiceLifetime.Singleton
  );

  // Register TerminalStateService (Phase 2 Week 2)
  container.register(
    ITerminalStateService,
    () => new TerminalStateService(eventBus),
    ServiceLifetime.Singleton
  );

  // Future Phase 2 services will be registered here:
  // - Additional services as needed
}

/**
 * Register Phase 3 plugins in the DI container
 *
 * This function registers the PluginManager and all agent plugins.
 * It will be called from ExtensionLifecycle.activate() in Phase 3.
 *
 * @param container DI container instance
 * @param eventBus Shared EventBus instance
 */
export async function registerPhase3Plugins(
  container: DIContainer,
  eventBus: EventBus
): Promise<PluginManager> {
  // Create PluginManager instance
  const pluginManager = new PluginManager(eventBus);

  // Register agent plugins
  const claudePlugin = new ClaudePlugin();
  const copilotPlugin = new CopilotPlugin();
  const geminiPlugin = new GeminiPlugin();
  const codexPlugin = new CodexPlugin();

  // Register and activate plugins
  await pluginManager.registerPlugin(claudePlugin, {
    activateImmediately: true,
    config: { enabled: true },
  });

  await pluginManager.registerPlugin(copilotPlugin, {
    activateImmediately: true,
    config: { enabled: true },
  });

  await pluginManager.registerPlugin(geminiPlugin, {
    activateImmediately: true,
    config: { enabled: true },
  });

  await pluginManager.registerPlugin(codexPlugin, {
    activateImmediately: true,
    config: { enabled: true },
  });

  return pluginManager;
}

/**
 * Service resolution helper for testing and gradual migration
 *
 * Provides a way to manually create services with proper dependencies
 * before full DI integration in Phase 2 Week 3.
 */
export class ServiceFactory {
  /**
   * Create a BufferManagementService instance
   *
   * @param eventBus EventBus instance for event publishing
   * @returns BufferManagementService instance
   */
  static createBufferManagementService(
    eventBus: EventBus
  ): BufferManagementService {
    return new BufferManagementService(eventBus);
  }

  /**
   * Create a TerminalStateService instance
   *
   * @param eventBus EventBus instance for event publishing
   * @returns TerminalStateService instance
   */
  static createTerminalStateService(
    eventBus: EventBus
  ): TerminalStateService {
    return new TerminalStateService(eventBus);
  }
}
