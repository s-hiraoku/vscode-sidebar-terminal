#!/usr/bin/env node

/**
 * Patch Mocha for Node.js v24 compatibility
 * This script modifies runner.js to prevent infinite unhandledRejection loops
 */

const fs = require('fs');
const path = require('path');

// Patch Runner.js to prevent infinite unhandled loops (CRITICAL for Mocha v11 + Node.js v24)
const runnerPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'mocha',
  'lib',
  'runner.js'
);

if (!fs.existsSync(runnerPath)) {
  console.log('⚠️ Mocha runner.js not found');
  process.exit(0);
}

let runnerContent = fs.readFileSync(runnerPath, 'utf8');

// Check if already patched
if (runnerContent.includes('// PATCHED FOR NODE.JS V24')) {
  console.log('✅ Mocha Runner.js already patched for Node.js v24 compatibility');
  process.exit(0);
}

// Mocha v11 has a different structure - it's a class-based Runner
// The problematic code is in the constructor:
//
//   this.unhandled = (reason, promise) => {
//     if (isMochaError(reason)) {
//       ...
//     } else {
//       ...
//       this._removeEventListener(process, 'unhandledRejection', this.unhandled);
//       try {
//         process.emit('unhandledRejection', reason, promise);
//       } finally {
//         this._addEventListener(process, 'unhandledRejection', this.unhandled);
//       }
//     }
//   };

// Patch Strategy: Instead of re-emitting, just log the rejection and skip
// This prevents the infinite loop while still allowing tests to run

const unhandledFunctionStart = `this.unhandled = (reason, promise) => {
      if (isMochaError(reason)) {`;

// Use a module-level (global) depth counter since multiple Runner instances may exist
const unhandledFunctionPatch = `// PATCHED FOR NODE.JS V24: Global recursion guard and skip re-emit
    this.unhandled = (reason, promise) => {
      // Global recursion guard using module-level counter
      if (!Runner._globalUnhandledDepth) Runner._globalUnhandledDepth = 0;
      if (Runner._globalUnhandledDepth > 2) {
        debug('Suppressed recursive unhandledRejection (depth > 2)');
        return;
      }
      Runner._globalUnhandledDepth++;
      try {
      if (isMochaError(reason)) {`;

// Find and patch the unhandled function start
if (runnerContent.includes(unhandledFunctionStart)) {
  runnerContent = runnerContent.replace(unhandledFunctionStart, unhandledFunctionPatch);

  // Now we need to add the finally block to close the try
  // The function ends like this in Mocha v11:
  //         this._addEventListener(process, 'unhandledRejection', this.unhandled);
  //       }
  //     }
  //   };

  const unhandledFunctionEnd = `this._addEventListener(process, 'unhandledRejection', this.unhandled);
        }
      }
    };`;

  const unhandledFunctionEndPatch = `this._addEventListener(process, 'unhandledRejection', this.unhandled);
        }
      }
      } finally {
        Runner._globalUnhandledDepth--;
      }
    };`;

  if (runnerContent.includes(unhandledFunctionEnd)) {
    runnerContent = runnerContent.replace(unhandledFunctionEnd, unhandledFunctionEndPatch);
    fs.writeFileSync(runnerPath, runnerContent);
    console.log('✅ Successfully patched Mocha Runner.js for Node.js v24 compatibility');
  } else {
    // Try with different indentation
    const altEnd = `        this._addEventListener(process, 'unhandledRejection', this.unhandled);
        }
      }
    };`;
    const altEndPatch = `        this._addEventListener(process, 'unhandledRejection', this.unhandled);
        }
      }
      } finally {
        Runner._globalUnhandledDepth--;
      }
    };`;

    if (runnerContent.includes(altEnd)) {
      runnerContent = runnerContent.replace(altEnd, altEndPatch);
      fs.writeFileSync(runnerPath, runnerContent);
      console.log('✅ Successfully patched Mocha Runner.js for Node.js v24 compatibility (alt pattern)');
    } else {
      // Write partial patch anyway
      fs.writeFileSync(runnerPath, runnerContent);
      console.log('⚠️ Partial patch applied - unhandled function start patched, but closing not found');
      console.log('You may need to manually verify runner.js');
    }
  }
} else {
  console.log('⚠️ Could not find unhandled function pattern in Mocha v11 Runner.js');
  console.log('Looking for pattern:', unhandledFunctionStart.substring(0, 100));

  // Show actual content around 'this.unhandled' for debugging
  const idx = runnerContent.indexOf('this.unhandled');
  if (idx !== -1) {
    console.log('Found this.unhandled at index', idx);
    console.log('Context:', runnerContent.substring(idx, idx + 300));
  }
}
