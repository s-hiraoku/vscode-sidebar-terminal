#!/usr/bin/env node

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TDDWorkflowAutomation {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.currentPhase = 'red';
    this.sessionStartTime = new Date();
  }

  async start() {
    console.clear();
    console.log('🚀 TDD Workflow Automation');
    console.log('='.repeat(50));
    console.log('This tool will guide you through the TDD cycle');
    console.log('Press Ctrl+C to exit at any time\n');
    
    await this.runCycle();
  }

  async runCycle() {
    while (true) {
      console.log(`\n📍 Current Phase: ${this.getPhaseEmoji()} ${this.currentPhase.toUpperCase()}`);
      console.log('-'.repeat(50));
      
      this.showPhaseInstructions();
      
      const action = await this.askQuestion('\nPress Enter to run tests, or type "skip" to skip this phase: ');
      
      if (action.toLowerCase() === 'skip') {
        this.moveToNextPhase();
        continue;
      }
      
      const success = await this.runPhase();
      
      if (success) {
        const next = await this.askQuestion('\n✅ Phase completed! Press Enter to continue to next phase, or "q" to quit: ');
        if (next.toLowerCase() === 'q') {
          this.showSessionSummary();
          break;
        }
        this.moveToNextPhase();
      } else {
        const retry = await this.askQuestion('\n⚠️ Phase not completed. Press Enter to retry, "skip" to skip, or "q" to quit: ');
        if (retry.toLowerCase() === 'q') {
          this.showSessionSummary();
          break;
        } else if (retry.toLowerCase() === 'skip') {
          this.moveToNextPhase();
        }
      }
    }
    
    this.rl.close();
  }

  showPhaseInstructions() {
    switch (this.currentPhase) {
      case 'red':
        console.log('\n🔴 RED Phase Instructions:');
        console.log('1. Write a test for the next bit of functionality');
        console.log('2. The test should fail because the functionality doesn\'t exist yet');
        console.log('3. Make sure the test fails for the right reason');
        console.log('\nExample: Write a test for a new function before implementing it');
        break;
        
      case 'green':
        console.log('\n🟢 GREEN Phase Instructions:');
        console.log('1. Write just enough code to make the test pass');
        console.log('2. Don\'t worry about code quality or optimization');
        console.log('3. The goal is to see the test turn green as quickly as possible');
        console.log('\nExample: Implement the function with hardcoded values if needed');
        break;
        
      case 'refactor':
        console.log('\n🔵 REFACTOR Phase Instructions:');
        console.log('1. Improve the code without changing its behavior');
        console.log('2. Remove duplication, improve naming, simplify logic');
        console.log('3. Run tests frequently to ensure nothing breaks');
        console.log('\nExample: Extract magic numbers to constants, split large functions');
        break;
    }
  }

  async runPhase() {
    console.log(`\n🧪 Running ${this.currentPhase} phase...`);
    
    try {
      execSync(`npm run tdd:${this.currentPhase}`, { 
        stdio: 'inherit',
        encoding: 'utf8'
      });
      
      // Check if phase was successful based on the metrics file
      const metricsPath = path.join(process.cwd(), 'tdd-metrics.json');
      if (fs.existsSync(metricsPath)) {
        const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
        const lastCycle = metrics.cycles[metrics.cycles.length - 1];
        const phaseResult = lastCycle[this.currentPhase];
        
        return phaseResult && phaseResult.success;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  moveToNextPhase() {
    switch (this.currentPhase) {
      case 'red':
        this.currentPhase = 'green';
        break;
      case 'green':
        this.currentPhase = 'refactor';
        break;
      case 'refactor':
        this.currentPhase = 'red';
        console.log('\n🔄 Starting new TDD cycle...');
        break;
    }
  }

  getPhaseEmoji() {
    switch (this.currentPhase) {
      case 'red': return '🔴';
      case 'green': return '🟢';
      case 'refactor': return '🔵';
      default: return '⚪';
    }
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  showSessionSummary() {
    const duration = Math.round((new Date() - this.sessionStartTime) / 1000 / 60);
    
    console.log('\n📊 TDD Session Summary');
    console.log('='.repeat(50));
    console.log(`Duration: ${duration} minutes`);
    
    // Load and display metrics
    const metricsPath = path.join(process.cwd(), 'tdd-metrics.json');
    if (fs.existsSync(metricsPath)) {
      const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
      const sessionCycles = metrics.cycles.filter(c => 
        new Date(c.startTime) >= this.sessionStartTime
      );
      
      console.log(`Cycles completed: ${sessionCycles.filter(c => c.red && c.green && c.refactor).length}`);
      console.log(`Total tests run: ${sessionCycles.reduce((sum, c) => {
        const tests = [c.red, c.green, c.refactor].filter(p => p).map(p => p.results.total);
        return sum + Math.max(...tests, 0);
      }, 0)}`);
    }
    
    console.log('\n✨ Great TDD session! Keep up the good work!');
  }
}

// Start the automation
if (require.main === module) {
  const automation = new TDDWorkflowAutomation();
  automation.start().catch(console.error);
}

module.exports = TDDWorkflowAutomation;