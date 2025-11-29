#!/usr/bin/env node

/**
 * Patch Mocha for Node.js v24 compatibility
 * This script modifies run-helpers.js to handle undefined process.stdout/stderr
 */

const fs = require('fs');
const path = require('path');

const runHelpersPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'mocha',
  'lib',
  'cli',
  'run-helpers.js'
);

// Check if file exists
if (!fs.existsSync(runHelpersPath)) {
  console.log('⚠️ Mocha run-helpers.js not found, skipping patch');
  process.exit(0);
}

// Read the file
let content = fs.readFileSync(runHelpersPath, 'utf8');

// Check if already patched
if (content.includes('// PATCHED FOR NODE.JS V24 COMPATIBILITY')) {
  console.log('✅ Mocha already patched for Node.js v24 compatibility');
  process.exit(0);
}

// Find and patch the exitMocha function
// The problematic code is:
//   const streams = [process.stdout, process.stderr];
//   streams.forEach(stream => {
//     stream.write('', done);
//   });

// Pattern 1: Mocha v10.x style
const patchTarget1 = `const streams = [process.stdout, process.stderr];

  streams.forEach(stream => {
    // submit empty write request and wait for completion
    draining += 1;
    stream.write('', done);
  });`;

const patchReplacement1 = `// PATCHED FOR NODE.JS V24 COMPATIBILITY
  const streams = [process.stdout, process.stderr].filter(Boolean);

  streams.forEach(stream => {
    // submit empty write request and wait for completion
    if (stream && stream.write) {
      draining += 1;
      stream.write('', done);
    }
  });`;

// Pattern 2: Alternative Mocha style
const patchTarget2 = `[process.stdout, process.stderr].forEach(stream => {`;
const patchReplacement2 = `// PATCHED FOR NODE.JS V24 COMPATIBILITY
  [process.stdout, process.stderr].filter(Boolean).forEach(stream => {`;

if (content.includes(patchTarget1)) {
  content = content.replace(patchTarget1, patchReplacement1);
  fs.writeFileSync(runHelpersPath, content);
  console.log('✅ Successfully patched Mocha for Node.js v24 compatibility (pattern 1)');
} else if (content.includes(patchTarget2)) {
  content = content.replace(patchTarget2, patchReplacement2);
  // Also need to patch the stream.write line
  content = content.replace(
    /stream\.write\('',\s*done\);/g,
    `if (stream && stream.write) stream.write('', done); else done();`
  );
  fs.writeFileSync(runHelpersPath, content);
  console.log('✅ Successfully patched Mocha for Node.js v24 compatibility (pattern 2)');
} else {
  console.log('⚠️ Could not find patch target in Mocha run-helpers.js');
  console.log('Content preview:', content.substring(0, 2000));
}

// Patch Runner.js to prevent infinite unhandled loops
const runnerPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'mocha',
  'lib',
  'runner.js'
);

if (fs.existsSync(runnerPath)) {
  let runnerContent = fs.readFileSync(runnerPath, 'utf8');

  // Check if already patched with recursion guard in unhandled function
  if (!runnerContent.includes('_unhandledDepth')) {
    // Add recursion depth counter at the start after 'use strict'
    const useStrictTarget = "'use strict';";
    const useStrictReplacement = `'use strict';

// PATCHED RUNNER FOR NODE.JS V24 - recursion guard
var _unhandledDepth = 0;
var _maxUnhandledDepth = 5;`;

    runnerContent = runnerContent.replace(useStrictTarget, useStrictReplacement);

    // Patch the unhandled function to add recursion guard
    // Find: this.unhandled = (reason, promise) => {
    // Replace with version that has recursion guard
    const unhandledTarget = `this.unhandled = (reason, promise) => {
      if (isMochaError(reason)) {`;
    const unhandledReplacement = `this.unhandled = (reason, promise) => {
      // Recursion guard for Node.js v24 compatibility
      if (_unhandledDepth > _maxUnhandledDepth) {
        console.error('Mocha: Suppressed recursive unhandledRejection (depth:', _unhandledDepth, ')');
        return;
      }
      _unhandledDepth++;
      try {
      if (isMochaError(reason)) {`;

    if (runnerContent.includes(unhandledTarget)) {
      runnerContent = runnerContent.replace(unhandledTarget, unhandledReplacement);

      // Find the closing of the unhandled function and add finally block
      // The function ends with: }; after the try-finally block
      // We need to close the try block we opened
      const closingTarget = `        this._addEventListener(process, 'unhandledRejection', this.unhandled);
        }
      }
    };`;
      const closingReplacement = `        this._addEventListener(process, 'unhandledRejection', this.unhandled);
        }
      }
      } finally {
        _unhandledDepth--;
      }
    };`;

      if (runnerContent.includes(closingTarget)) {
        runnerContent = runnerContent.replace(closingTarget, closingReplacement);
        fs.writeFileSync(runnerPath, runnerContent);
        console.log('✅ Patched Mocha Runner.js unhandled function with recursion guard');
      } else {
        // Try alternative closing pattern
        const altClosingTarget = `this._addEventListener(process, 'unhandledRejection', this.unhandled);
        }
      }
    };`;
        const altClosingReplacement = `this._addEventListener(process, 'unhandledRejection', this.unhandled);
        }
      }
      } finally {
        _unhandledDepth--;
      }
    };`;

        if (runnerContent.includes(altClosingTarget)) {
          runnerContent = runnerContent.replace(altClosingTarget, altClosingReplacement);
          fs.writeFileSync(runnerPath, runnerContent);
          console.log('✅ Patched Mocha Runner.js unhandled function with recursion guard (alt pattern)');
        } else {
          fs.writeFileSync(runnerPath, runnerContent);
          console.log('⚠️ Partial patch applied - could not find closing pattern');
        }
      }
    } else {
      console.log('⚠️ Could not find unhandled function pattern in Runner.js');
    }
  } else {
    console.log('✅ Mocha Runner.js already patched with recursion guard');
  }
} else {
  console.log('⚠️ Mocha runner.js not found');
}
