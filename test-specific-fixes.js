#!/usr/bin/env node

/**
 * Test specific fixes made to infrastructure
 */

const { spawn } = require('child_process');

function runSpecificTest(testFile, description) {
    console.log(`\n=== Testing ${description} ===`);
    
    return new Promise((resolve) => {
        const mocha = spawn('./node_modules/.bin/mocha', [
            '--require', './src/test/shared/setup-exit-handler.js',
            '--require', 'out/test/shared/TestSetup.js',
            '--timeout', '10000',
            '--reporter', 'spec',
            '--bail',
            testFile
        ], {
            stdio: 'pipe',
            timeout: 20000
        });

        let output = '';
        let errorOutput = '';

        mocha.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            // Show only test results, not debug logs
            if (text.includes('✔') || text.includes('✓') || text.includes('×') || text.includes('failing') || text.includes('passing')) {
                process.stdout.write(text);
            }
        });

        mocha.stderr.on('data', (data) => {
            errorOutput += data.toString();
            process.stderr.write(data);
        });

        const timeout = setTimeout(() => {
            console.log(`\n❌ Test timed out: ${description}`);
            mocha.kill('SIGKILL');
            resolve({ success: false, error: 'TIMEOUT' });
        }, 20000);

        mocha.on('close', (code) => {
            clearTimeout(timeout);
            
            // Extract test results from output
            const passMatch = output.match(/(\d+) passing/);
            const failMatch = output.match(/(\d+) failing/);
            const passes = passMatch ? parseInt(passMatch[1]) : 0;
            const fails = failMatch ? parseInt(failMatch[1]) : 0;
            
            if (code === 0) {
                console.log(`\n✅ ${description}: ${passes} passing, 0 failing`);
                resolve({ success: true, passes, fails: 0 });
            } else {
                console.log(`\n🔧 ${description}: ${passes} passing, ${fails} failing (needs more work)`);
                resolve({ success: false, passes, fails, output: output.slice(-2000) });
            }
        });

        mocha.on('error', (err) => {
            clearTimeout(timeout);
            console.log(`\n💥 ${description} error:`, err.message);
            resolve({ success: false, error: err.message });
        });
    });
}

async function main() {
    console.log('🔧 Testing specific infrastructure fixes...\n');

    const testFiles = [
        {
            file: 'out/test/unit/webview/managers/MessageManager.test.js',
            description: 'MessageManager Priority Queue Fix'
        },
        {
            file: 'out/test/unit/services/CliAgentDetectionService.test.js',
            description: 'CliAgentDetectionService Pattern Fix'
        }
    ];

    const results = [];
    let totalPasses = 0;
    let totalFails = 0;

    for (const test of testFiles) {
        const result = await runSpecificTest(test.file, test.description);
        results.push(result);
        
        if (result.passes) totalPasses += result.passes;
        if (result.fails) totalFails += result.fails;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 Fix Validation Results:');
    console.log(`✅ Total Passing: ${totalPasses}`);
    console.log(`❌ Total Failing: ${totalFails}`);
    
    const successfulFixes = results.filter(r => r.success).length;
    const totalFixes = results.length;
    
    console.log(`🎯 Fix Success Rate: ${successfulFixes}/${totalFixes} (${Math.round((successfulFixes/totalFixes) * 100)}%)`);
    
    if (totalFails > 0) {
        console.log('\n🔍 Next Steps:');
        console.log('  - Review failing test details in output above');
        console.log('  - Update test expectations or fix implementation');
        console.log('  - Focus on core refactoring areas that are now stable');
    }
}

main().catch(console.error);