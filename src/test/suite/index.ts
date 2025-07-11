import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

// Setup global mock for node-pty before any test files are loaded
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
      const mockPath = path.resolve(__dirname, '../mocks/node-pty');
      console.log('🔧 [TEST-SUITE] Loading node-pty mock from:', mockPath);
      return originalRequire.call(this, mockPath);
    } catch (error) {
      console.error('❌ [TEST-SUITE] Failed to load node-pty mock:', error);
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

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((c, e) => {
    glob('suite/**/*.test.js', { cwd: testsRoot })
      .then((files: string[]) => {
        // Add files to the test suite
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // Run the mocha test
          mocha.run((failures: number) => {
            if (failures > 0) {
              e(new Error(`${failures} tests failed.`));
            } else {
              c();
            }
          });
        } catch (err) {
          console.error(err);
          e(err);
        }
      })
      .catch((err: Error) => {
        e(err);
      });
  });
}
