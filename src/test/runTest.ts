import * as path from 'path';
import { runTests } from '@vscode/test-electron';

// Setup node-pty mock before anything else

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'node-pty') {
    try {
      const mockPath = path.resolve(__dirname, './mocks/node-pty');
      console.log('🔧 [TEST] Loading node-pty mock from:', mockPath);
      return originalRequire.call(this, mockPath);
    } catch (error) {
      console.error('❌ [TEST] Failed to load node-pty mock:', error);
      // Fallback to inline mock for Windows compatibility
      return {
        spawn: () => ({
          pid: 1234,
          cols: 80,
          rows: 24,
          handleFlowControl: false,
          onData: () => {},
          onExit: () => {},
          write: () => {},
          resize: () => {},
          kill: () => {},
        }),
      };
    }
  }
  return originalRequire.apply(this, arguments);
};

async function main(): Promise<void> {
  try {
    console.log('🚀 [TEST] Starting VS Code extension tests...');

    // Setup for container environment
    if (process.env.CI || process.env.DOCKER_CONTAINER) {
      console.log('🐳 [TEST] Detected CI/container environment, setting up virtual display...');
      process.env.DISPLAY = ':99';
    }

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    console.log('📁 [TEST] Extension path:', extensionDevelopmentPath);

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    console.log('🧪 [TEST] Test suite path:', extensionTestsPath);

    // Container-optimized args to prevent SIGTRAP
    const launchArgs = [
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-features=VizDisplayCompositor',
      '--use-gl=swiftshader',
      '--enable-features=UseOzonePlatform',
      '--ozone-platform=headless',
    ];

    console.log('⚙️ [TEST] Launch args:', launchArgs.join(' '));

    // Download VS Code, unzip it and run the integration test
    console.log('📥 [TEST] Starting VS Code test runner...');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs,
      timeout: 120000, // 120 second timeout for CI stability
      version: '1.85.0', // Pin to stable version
    });

    console.log('✅ [TEST] All tests completed successfully!');
  } catch (err) {
    console.error('❌ [TEST] Test execution failed:', err);

    // Log detailed error information
    if (err instanceof Error) {
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    }

    // Exit with specific code for different error types
    if (err instanceof Error && err.message.includes('timeout')) {
      console.error(
        '💀 [TEST] Tests timed out - this may indicate a hanging test or VS Code startup issue'
      );
      process.exit(2);
    } else if (err instanceof Error && err.message.includes('ENOENT')) {
      console.error('💀 [TEST] File not found - check VS Code installation or test paths');
      process.exit(3);
    } else {
      console.error('💀 [TEST] Unknown test failure');
      process.exit(1);
    }
  }
}

void main();
