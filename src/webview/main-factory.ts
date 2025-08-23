/**
 * Factory-based WebView Main Entry Point
 *
 * New initialization system using the unified factory pattern for consistent
 * manager creation, dependency injection, and lifecycle management.
 */

import { webview as log } from '../utils/logger';
import type { IManagerCoordinator } from './interfaces/ManagerInterfaces';
import type { IBaseManager } from '../factories/interfaces/ManagerFactoryInterfaces';
import {
  initializeFactory,
  createAllWebViewManagers,
  createEssentialManagers,
  getFormattedFactoryStatistics,
  disposeFactory,
  ManagerType,
} from '../factories';
import { FactoryCompatibleRefactoredTerminalWebviewManager } from './managers/FactoryCompatibleRefactoredTerminalWebviewManager';

// Global state
let terminalManager: FactoryCompatibleRefactoredTerminalWebviewManager | null = null;
let factoryInitialized = false;

/**
 * Initialize WebView using unified factory pattern
 */
async function initializeWebViewWithFactory(): Promise<void> {
  try {
    log('🏭 [FACTORY-MAIN] Initializing WebView with factory pattern...');

    // Check DOM readiness
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      log('❌ [FACTORY-MAIN] terminal-body element not found, retrying...');
      setTimeout(() => initializeWebViewWithFactory(), 100);
      return;
    }

    // 1. Initialize factory system
    if (!factoryInitialized) {
      await initializeFactory();
      factoryInitialized = true;
      log('✅ [FACTORY-MAIN] Factory system initialized');
    }

    // 2. Create main terminal manager (coordinator)
    terminalManager = new FactoryCompatibleRefactoredTerminalWebviewManager({
      managerName: 'MainTerminalWebviewManager',
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    // 3. Initialize terminal manager
    await terminalManager.initialize({
      managerName: 'MainTerminalWebviewManager',
      enableLogging: true,
    });

    // 4. Setup basic terminal container
    terminalManager.initializeSimpleTerminal();

    // 5. Create essential managers through factory
    try {
      const essentialManagers = await createEssentialManagers(terminalManager);
      log('✅ [FACTORY-MAIN] Essential managers created:', Object.keys(essentialManagers));
    } catch (error) {
      log(
        '⚠️ [FACTORY-MAIN] Failed to create some essential managers, continuing with fallback:',
        error
      );
      // Continue with basic functionality
    }

    // 6. Create fallback terminals if needed
    setTimeout(async () => {
      if (terminalManager && terminalManager.getAllTerminalInstances().size === 0) {
        log('🔄 [FACTORY-MAIN] Creating fallback terminals...');

        await terminalManager.createTerminal('terminal-1', 'Terminal 1');
        await terminalManager.createTerminal('terminal-2', 'Terminal 2');
        terminalManager.setActiveTerminalId('terminal-1');

        // Notify extension
        terminalManager.postMessageToExtension({
          command: 'createTerminal',
          terminalId: 'terminal-1',
          terminalName: 'Terminal 1',
          timestamp: Date.now(),
        });
        terminalManager.postMessageToExtension({
          command: 'createTerminal',
          terminalId: 'terminal-2',
          terminalName: 'Terminal 2',
          timestamp: Date.now(),
        });

        log('✅ [FACTORY-MAIN] Fallback terminals created');
      }
    }, 1000);

    // 7. Notify extension of readiness
    terminalManager.postMessageToExtension({
      command: 'webviewReady',
      timestamp: Date.now(),
    });

    // 8. Log factory statistics
    log('📊 [FACTORY-MAIN] Factory Statistics:', getFormattedFactoryStatistics());

    log('✅ [FACTORY-MAIN] WebView initialized successfully with factory pattern');
  } catch (error) {
    log('❌ [FACTORY-MAIN] Failed to initialize WebView with factory:', error);

    // Fallback to legacy initialization
    try {
      log('🔄 [FACTORY-MAIN] Attempting fallback to legacy initialization...');
      const { initializeWebView } = await import('./main');
      await initializeWebView();
    } catch (fallbackError) {
      log('❌ [FACTORY-MAIN] Legacy fallback also failed:', fallbackError);
    }
  }
}

/**
 * Create additional managers on demand
 */
async function createAdditionalManagers(): Promise<void> {
  if (!terminalManager) {
    log('⚠️ [FACTORY-MAIN] No terminal manager available for additional managers');
    return;
  }

  try {
    log('🏭 [FACTORY-MAIN] Creating additional managers...');

    const additionalManagers = await createAllWebViewManagers(terminalManager);
    log('✅ [FACTORY-MAIN] Additional managers created:', Array.from(additionalManagers.keys()));
  } catch (error) {
    log('❌ [FACTORY-MAIN] Failed to create additional managers:', error);
  }
}

/**
 * Get current terminal manager instance
 */
function getTerminalManager(): FactoryCompatibleRefactoredTerminalWebviewManager | null {
  return terminalManager;
}

/**
 * Get manager statistics
 */
function getManagerStats(): unknown {
  if (!terminalManager) {
    return { error: 'No terminal manager available' };
  }

  return {
    factory: getFormattedFactoryStatistics(),
    terminalManager: terminalManager.getManagerStats(),
    factoryInfo: terminalManager.getFactoryInfo(),
  };
}

/**
 * Cleanup and disposal
 */
async function cleanup(): Promise<void> {
  try {
    log('🧹 [FACTORY-MAIN] Starting cleanup...');

    if (terminalManager) {
      terminalManager.dispose();
      terminalManager = null;
    }

    if (factoryInitialized) {
      await disposeFactory();
      factoryInitialized = false;
    }

    log('✅ [FACTORY-MAIN] Cleanup completed');
  } catch (error) {
    log('❌ [FACTORY-MAIN] Cleanup error:', error);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  log('📄 [FACTORY-MAIN] DOM content loaded, initializing...');
  initializeWebViewWithFactory();
});

window.addEventListener('beforeunload', () => {
  log('🚪 [FACTORY-MAIN] Page unloading, cleaning up...');
  cleanup();
});

// Error handling
window.addEventListener('error', (event) => {
  log('❌ [FACTORY-MAIN] Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  log('❌ [FACTORY-MAIN] Unhandled promise rejection:', event.reason);
});

// Hot module replacement support
if (module.hot) {
  module.hot.accept('./managers/FactoryCompatibleRefactoredTerminalWebviewManager', () => {
    log('🔥 [FACTORY-MAIN] Hot reloading factory-compatible terminal manager...');
    // Re-initialize with new module
    initializeWebViewWithFactory();
  });
}

// Global exports for debugging
(window as any).factoryMain = {
  getTerminalManager,
  getManagerStats,
  createAdditionalManagers,
  cleanup,
  initializeWebViewWithFactory,
};
