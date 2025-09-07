#!/usr/bin/env node

/**
 * Simple test runner to debug test infrastructure issues
 */

const { spawn } = require('child_process');
const path = require('path');

function runTestSubset(testPath, description) {
    console.log(`\n=== Running ${description} ===`);
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const mocha = spawn('./node_modules/.bin/mocha', [
            '--require', './src/test/shared/setup-exit-handler.js',
            '--require', 'out/test/shared/TestSetup.js',
            '--timeout', '5000',
            '--reporter', 'spec',
            '--bail', // Stop on first failure
            testPath
        ], {
            stdio: 'pipe',
            timeout: 30000 // 30 second timeout for process
        });

        let output = '';
        let errorOutput = '';
        let hasOutput = false;

        mocha.stdout.on('data', (data) => {
            hasOutput = true;
            output += data.toString();
            process.stdout.write(data); // Live output
        });

        mocha.stderr.on('data', (data) => {
            hasOutput = true;
            errorOutput += data.toString();
            process.stderr.write(data); // Live error output
        });

        const timeout = setTimeout(() => {
            console.log(`\n❌ Test timed out after 30 seconds: ${description}`);
            mocha.kill('SIGKILL');
            resolve({ 
                success: false, 
                error: 'TIMEOUT', 
                duration: Date.now() - startTime,
                hasOutput 
            });
        }, 30000);

        mocha.on('close', (code) => {
            clearTimeout(timeout);
            const duration = Date.now() - startTime;
            
            if (code === 0) {
                console.log(`\n✅ ${description} completed successfully (${duration}ms)`);
                resolve({ success: true, duration, hasOutput });
            } else {
                console.log(`\n❌ ${description} failed with code ${code} (${duration}ms)`);
                resolve({ 
                    success: false, 
                    error: code, 
                    output: output.slice(-1000), // Last 1000 chars
                    errorOutput: errorOutput.slice(-1000),
                    duration,
                    hasOutput 
                });
            }
        });

        mocha.on('error', (err) => {
            clearTimeout(timeout);
            console.log(`\n💥 ${description} process error:`, err.message);
            resolve({ 
                success: false, 
                error: err.message, 
                duration: Date.now() - startTime,
                hasOutput 
            });
        });
    });
}

async function main() {
    console.log('🔍 Debugging test infrastructure issues...\n');

    const testSuites = [
        {
            path: 'out/test/unit/config/ConfigManager.test.js',
            description: 'ConfigManager tests'
        },
        {
            path: 'out/test/unit/webview/managers/MessageManager.test.js',
            description: 'MessageManager tests'
        },
        {
            path: 'out/test/unit/services/CliAgentDetectionService.test.js',
            description: 'CliAgentDetectionService tests'
        }
    ];

    const results = [];

    for (const suite of testSuites) {
        const result = await runTestSubset(suite.path, suite.description);
        results.push({ ...result, name: suite.description });
        
        // If we get a timeout without any output, the test infrastructure is broken
        if (result.error === 'TIMEOUT' && !result.hasOutput) {
            console.log('\n🚨 Test infrastructure appears to be completely broken - no output produced');
            break;
        }
        
        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 Test Infrastructure Analysis:');
    results.forEach(result => {
        const status = result.success ? '✅ PASS' : 
                      result.error === 'TIMEOUT' ? '⏰ TIMEOUT' : 
                      '❌ FAIL';
        console.log(`  ${status} ${result.name} (${result.duration}ms)`);
        
        if (!result.success && result.error !== 'TIMEOUT') {
            console.log(`    Error: ${result.error}`);
        }
    });

    const timeouts = results.filter(r => r.error === 'TIMEOUT').length;
    const failures = results.filter(r => !r.success && r.error !== 'TIMEOUT').length;
    const successes = results.filter(r => r.success).length;

    console.log('\n📈 Summary:');
    console.log(`  ✅ Successful: ${successes}`);
    console.log(`  ❌ Failed: ${failures}`);
    console.log(`  ⏰ Timed out: ${timeouts}`);

    if (timeouts > 0) {
        console.log('\n🎯 Recommended Actions:');
        console.log('  1. Check TestSetup.ts for infinite loops or hanging operations');
        console.log('  2. Review test mocks for missing stub methods');
        console.log('  3. Look for circular dependencies in test imports');
        console.log('  4. Check for unresolved promises in test setup');
    }
}

main().catch(console.error);