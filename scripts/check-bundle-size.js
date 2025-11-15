#!/usr/bin/env node

/**
 * Bundle Size Check Script
 *
 * This script checks the size of the bundled files and compares them against
 * the defined size budgets. It's designed to be used in CI pipelines.
 *
 * Exit codes:
 * 0 - All bundles are within budget
 * 1 - One or more bundles exceed the budget
 */

const fs = require('fs');
const path = require('path');

// Size budgets in bytes (Issue #239)
const SIZE_BUDGETS = {
  'extension.js': 1024 * 1024, // 1MB
  'webview.js': 800 * 1024,    // 800KB
};

const DIST_DIR = path.join(__dirname, '..', 'dist');

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
  const kb = bytes / 1024;
  const mb = kb / 1024;

  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  return `${kb.toFixed(2)} KB`;
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Main function to check bundle sizes
 */
function checkBundleSizes() {
  console.log('📦 Checking bundle sizes...\n');

  let hasFailures = false;
  let totalSize = 0;

  for (const [filename, budget] of Object.entries(SIZE_BUDGETS)) {
    const filePath = path.join(DIST_DIR, filename);
    const size = getFileSize(filePath);

    if (size === null) {
      hasFailures = true;
      continue;
    }

    totalSize += size;
    const percentage = ((size / budget) * 100).toFixed(1);
    const status = size <= budget ? '✅' : '❌';

    console.log(`${status} ${filename}`);
    console.log(`   Size: ${formatBytes(size)} / ${formatBytes(budget)} (${percentage}%)`);

    if (size > budget) {
      const excess = size - budget;
      console.log(`   ⚠️  Exceeds budget by ${formatBytes(excess)}`);
      hasFailures = true;
    }

    console.log('');
  }

  console.log(`📊 Total bundle size: ${formatBytes(totalSize)}`);
  console.log(`🎯 Target: < 2 MB (${(totalSize / (2 * 1024 * 1024) * 100).toFixed(1)}%)\n`);

  if (hasFailures) {
    console.error('❌ Bundle size check failed!');
    console.error('Some bundles exceed the size budget.');
    process.exit(1);
  } else {
    console.log('✅ All bundles are within budget!');
    process.exit(0);
  }
}

// Run the check
checkBundleSizes();
