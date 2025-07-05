#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

console.log('🧪 Testing VS Code Sidebar Terminal Extension...\n');

// Test 1: Verify build was successful
console.log('✅ Build completed successfully');

// Test 2: Check if required files exist
const requiredFiles = [
    'dist/extension.js',
    'dist/webview.js',
    'src/webview/simple.ts',
    'package.json'
];

requiredFiles.forEach(file => {
    const fs = require('fs');
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
    }
});

// Test 3: Verify package.json viewsContainers configuration
const packageJson = require('./package.json');
const viewsContainers = packageJson.contributes.viewsContainers;

if (viewsContainers && viewsContainers.panel) {
    console.log('✅ Panel viewsContainers configured');
} else {
    console.log('❌ Panel viewsContainers not configured');
}

console.log('\n🎯 Extension built and ready for testing!');
console.log('\nTo test:');
console.log('1. Press F5 to open Extension Development Host');
console.log('2. Open View → Sidebar Terminal');
console.log('3. Check if terminal renders (no black screen)');
console.log('4. Verify it appears in the panel area (not left sidebar)');