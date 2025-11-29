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
