import * as path from 'path';
import { runTests } from '@vscode/test-electron';

// Setup node-pty mock before anything else
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable prefer-rest-params */
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
/* eslint-enable prefer-rest-params */
/* eslint-enable @typescript-eslint/no-unsafe-return */
/* eslint-enable @typescript-eslint/no-unsafe-call */
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
/* eslint-enable @typescript-eslint/no-var-requires */

async function main(): Promise<void> {
  try {
    console.log('🚀 [TEST] Starting VS Code extension tests...');
    
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    console.log('📁 [TEST] Extension path:', extensionDevelopmentPath);

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    console.log('🧪 [TEST] Test suite path:', extensionTestsPath);

    // Platform-specific launch args
    const baseLaunchArgs = [
      '--headless',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--no-sandbox',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-pings',
    ];

    // Add platform-specific args
    const platformArgs = process.platform === 'darwin' 
      ? ['--disable-features=VizDisplayCompositor'] // macOS specific
      : ['--no-zygote', '--single-process', '--disable-setuid-sandbox', '--disable-web-security'];

    const launchArgs = [...baseLaunchArgs, ...platformArgs];
    console.log('⚙️ [TEST] Launch args:', launchArgs.join(' '));

    // Download VS Code, unzip it and run the integration test
    console.log('📥 [TEST] Starting VS Code test runner...');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs,
      timeout: 60000, // 60 second timeout
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
      console.error('💀 [TEST] Tests timed out - this may indicate a hanging test or VS Code startup issue');
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
