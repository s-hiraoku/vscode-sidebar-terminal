#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TDDTestRunner {
  constructor() {
    this.phase = process.argv[2] || 'red';
    this.metricsPath = path.join(process.cwd(), 'tdd-metrics.json');
  }

  run() {
    console.log(`\n🔴🟢🔵 TDD Phase: ${this.phase.toUpperCase()}`);
    console.log('='.repeat(50));

    switch (this.phase) {
      case 'red':
        this.runRedPhase();
        break;
      case 'green':
        this.runGreenPhase();
        break;
      case 'refactor':
        this.runRefactorPhase();
        break;
      default:
        console.error('❌ Invalid phase. Use: red, green, or refactor');
        process.exit(1);
    }
  }

  runRedPhase() {
    console.log('🔴 RED Phase: Write a failing test\n');
    console.log('Instructions:');
    console.log('1. Write a test that describes the desired behavior');
    console.log('2. Run the test to ensure it fails');
    console.log('3. The test should fail for the right reason\n');
    
    this.runTests((results) => {
      if (results.failing > 0 && results.passing === 0) {
        console.log('\n✅ RED phase successful! You have a failing test.');
        console.log('   Next: Run `npm run tdd:green` to make it pass');
      } else if (results.failing === 0) {
        console.log('\n⚠️ No failing tests found. Make sure your new test fails first!');
      } else {
        console.log('\n⚠️ Some tests are passing. In RED phase, only the new test should exist.');
      }
      
      this.recordMetrics('red', results);
    });
  }

  runGreenPhase() {
    console.log('🟢 GREEN Phase: Make the test pass\n');
    console.log('Instructions:');
    console.log('1. Write the minimum code to make the test pass');
    console.log('2. Don\'t worry about code quality yet');
    console.log('3. Focus only on making the test green\n');
    
    this.runTests((results) => {
      if (results.failing === 0 && results.passing > 0) {
        console.log('\n✅ GREEN phase successful! All tests are passing.');
        console.log('   Next: Run `npm run tdd:refactor` to improve the code');
      } else {
        console.log(`\n⚠️ ${results.failing} tests are still failing.`);
        console.log('   Keep working until all tests pass!');
      }
      
      this.recordMetrics('green', results);
    });
  }

  runRefactorPhase() {
    console.log('🔵 REFACTOR Phase: Improve the code\n');
    console.log('Instructions:');
    console.log('1. Improve code quality without changing behavior');
    console.log('2. Remove duplication and improve naming');
    console.log('3. Ensure all tests still pass\n');
    
    // First run tests
    this.runTests((results) => {
      if (results.failing === 0) {
        console.log('✅ Tests are passing. Running code quality checks...\n');
        
        // Run linter
        try {
          console.log('📝 Running ESLint...');
          execSync('npm run lint', { stdio: 'inherit' });
          console.log('✅ ESLint passed!\n');
        } catch (error) {
          console.log('⚠️ ESLint found issues. Fix them as part of refactoring.\n');
        }
        
        // Run type check
        try {
          console.log('🔍 Running TypeScript compiler...');
          execSync('npm run compile', { stdio: 'inherit' });
          console.log('✅ TypeScript compilation successful!\n');
        } catch (error) {
          console.log('⚠️ TypeScript errors found. Fix them as part of refactoring.\n');
        }
        
        console.log('\n✅ REFACTOR phase complete!');
        console.log('   Next: Start a new cycle with `npm run tdd:red`');
      } else {
        console.log('\n❌ Tests are failing! You broke something during refactoring.');
        console.log('   Fix the tests before continuing.');
      }
      
      this.recordMetrics('refactor', results);
    });
  }

  runTests(callback) {
    console.log('🧪 Running tests...\n');
    
    let output = '';
    const testProcess = spawn('npm', ['test'], {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });

    testProcess.stderr.on('data', (data) => {
      output += data.toString();
      process.stderr.write(data);
    });

    testProcess.on('close', (code) => {
      const results = this.parseTestResults(output);
      callback(results);
    });
  }

  parseTestResults(output) {
    const results = {
      passing: 0,
      failing: 0,
      pending: 0,
      total: 0,
      duration: 0
    };

    // Parse Mocha output
    const passingMatch = output.match(/(\d+) passing/);
    const failingMatch = output.match(/(\d+) failing/);
    const pendingMatch = output.match(/(\d+) pending/);
    const durationMatch = output.match(/\((\d+)ms\)/);

    if (passingMatch) results.passing = parseInt(passingMatch[1]);
    if (failingMatch) results.failing = parseInt(failingMatch[1]);
    if (pendingMatch) results.pending = parseInt(pendingMatch[1]);
    if (durationMatch) results.duration = parseInt(durationMatch[1]);
    
    results.total = results.passing + results.failing + results.pending;
    
    return results;
  }

  recordMetrics(phase, results) {
    let metrics = { cycles: [] };
    
    // Load existing metrics
    if (fs.existsSync(this.metricsPath)) {
      try {
        metrics = JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'));
      } catch (error) {
        console.warn('Could not read existing metrics, starting fresh');
      }
    }

    // Find or create current cycle
    let currentCycle = metrics.cycles[metrics.cycles.length - 1];
    if (!currentCycle || currentCycle.refactor) {
      // Start new cycle
      currentCycle = {
        startTime: new Date().toISOString(),
        red: null,
        green: null,
        refactor: null
      };
      metrics.cycles.push(currentCycle);
    }

    // Record phase results
    currentCycle[phase] = {
      timestamp: new Date().toISOString(),
      results: results,
      success: this.validatePhase(phase, results)
    };

    // Save metrics
    fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2));
    
    // Calculate and display statistics
    this.displayStatistics(metrics);
  }

  validatePhase(phase, results) {
    switch (phase) {
      case 'red':
        return results.failing > 0;
      case 'green':
        return results.failing === 0 && results.passing > 0;
      case 'refactor':
        return results.failing === 0;
      default:
        return false;
    }
  }

  displayStatistics(metrics) {
    console.log('\n📊 TDD Statistics:');
    console.log('-'.repeat(30));
    
    const completeCycles = metrics.cycles.filter(c => 
      c.red && c.green && c.refactor
    ).length;
    
    const totalCycles = metrics.cycles.length;
    const currentCycle = metrics.cycles[metrics.cycles.length - 1];
    
    console.log(`Total cycles started: ${totalCycles}`);
    console.log(`Complete cycles: ${completeCycles}`);
    console.log(`Compliance rate: ${totalCycles > 0 ? Math.round((completeCycles / totalCycles) * 100) : 0}%`);
    
    // Current cycle status
    console.log('\nCurrent cycle status:');
    console.log(`- RED: ${currentCycle.red ? '✅' : '⏳'}`);
    console.log(`- GREEN: ${currentCycle.green ? '✅' : '⏳'}`);
    console.log(`- REFACTOR: ${currentCycle.refactor ? '✅' : '⏳'}`);
  }
}

// Run the test runner
if (require.main === module) {
  const runner = new TDDTestRunner();
  runner.run();
}

module.exports = TDDTestRunner;