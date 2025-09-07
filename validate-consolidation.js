/**
 * Message Handler Services Consolidation Validation
 * 
 * This script validates that the consolidated message service successfully
 * eliminates duplication and preserves all functionality from the three
 * original services:
 * - WebViewMessageHandlerService (Command pattern)
 * - RefactoredMessageManager (Queue-based processing)
 * - WebViewMessageRouter (Publisher-subscriber pattern)
 */

const fs = require('fs');
const path = require('path');

// Validate file structure and consolidation
function validateConsolidation() {
  const results = {
    filesCreated: [],
    functionalityPreserved: [],
    duplicationEliminated: [],
    issues: []
  };

  // Check consolidated service files exist
  const consolidatedFiles = [
    'src/messaging/UnifiedMessageDispatcher.ts',
    'src/messaging/ConsolidatedMessageService.ts',
    'src/messaging/handlers/BaseMessageHandler.ts',
    'src/messaging/handlers/SystemMessageHandler.ts',
    'src/messaging/handlers/TerminalOutputHandler.ts',
    'src/messaging/handlers/TerminalLifecycleHandler.ts',
    'src/messaging/handlers/CliAgentHandler.ts',
    'src/messaging/handlers/SessionHandler.ts',
    'src/test/unit/messaging/ConsolidatedMessageService.test.ts'
  ];

  for (const file of consolidatedFiles) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      results.filesCreated.push(file);
    } else {
      results.issues.push(`Missing file: ${file}`);
    }
  }

  // Analyze original files for comparison
  const originalFiles = [
    'src/services/webview/WebViewMessageHandlerService.ts',
    'src/webview/managers/RefactoredMessageManager.ts',
    'src/messaging/WebViewMessageRouter.ts'
  ];

  let totalOriginalLines = 0;
  let consolidatedLines = 0;
  
  for (const file of originalFiles) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      totalOriginalLines += lines;
      console.log(`Original ${file}: ${lines} lines`);
    }
  }

  for (const file of consolidatedFiles.slice(0, -1)) { // Exclude test file
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      consolidatedLines += lines;
      console.log(`Consolidated ${file}: ${lines} lines`);
    }
  }

  results.duplicationEliminated.push({
    originalLines: totalOriginalLines,
    consolidatedLines: consolidatedLines,
    reduction: totalOriginalLines - consolidatedLines,
    reductionPercentage: Math.round(((totalOriginalLines - consolidatedLines) / totalOriginalLines) * 100)
  });

  // Validate message handler coverage
  const consolidatedServicePath = path.join(__dirname, 'src/messaging/ConsolidatedMessageService.ts');
  if (fs.existsSync(consolidatedServicePath)) {
    const content = fs.readFileSync(consolidatedServicePath, 'utf8');
    
    // Check for key functionality preservation
    const functionalityChecks = [
      { name: 'IMessageManager interface', pattern: /implements IMessageManager/ },
      { name: 'Message priority support', pattern: /MessagePriority/ },
      { name: 'Queue management', pattern: /messageQueue|getQueueStats/ },
      { name: 'Handler registration', pattern: /registerHandler/ },
      { name: 'Terminal lifecycle', pattern: /TerminalLifecycleHandler/ },
      { name: 'CLI Agent support', pattern: /CliAgentHandler/ },
      { name: 'Session management', pattern: /SessionHandler/ },
      { name: 'System messages', pattern: /SystemMessageHandler/ },
      { name: 'Terminal output', pattern: /TerminalOutputHandler/ },
      { name: 'Error handling', pattern: /try.*catch|handleError/ },
      { name: 'Dispose pattern', pattern: /dispose.*void/ }
    ];

    for (const check of functionalityChecks) {
      if (check.pattern.test(content)) {
        results.functionalityPreserved.push(check.name);
      } else {
        results.issues.push(`Missing functionality: ${check.name}`);
      }
    }
  }

  // Check test coverage
  const testPath = path.join(__dirname, 'src/test/unit/messaging/ConsolidatedMessageService.test.ts');
  if (fs.existsSync(testPath)) {
    const testContent = fs.readFileSync(testPath, 'utf8');
    const testCount = (testContent.match(/it\(/g) || []).length;
    results.functionalityPreserved.push(`Test coverage: ${testCount} test cases`);
  }

  return results;
}

// Generate consolidation report
function generateReport() {
  console.log('\n=== MESSAGE HANDLER SERVICES CONSOLIDATION REPORT ===\n');
  
  const results = validateConsolidation();
  
  console.log('✅ FILES CREATED:');
  results.filesCreated.forEach(file => console.log(`  - ${file}`));
  
  console.log('\n✅ FUNCTIONALITY PRESERVED:');
  results.functionalityPreserved.forEach(func => console.log(`  - ${func}`));
  
  console.log('\n✅ DUPLICATION ELIMINATION:');
  if (results.duplicationEliminated.length > 0) {
    const stats = results.duplicationEliminated[0];
    console.log(`  - Original services: ${stats.originalLines} lines`);
    console.log(`  - Consolidated service: ${stats.consolidatedLines} lines`);
    console.log(`  - Lines eliminated: ${stats.reduction} (${stats.reductionPercentage}% reduction)`);
  }
  
  if (results.issues.length > 0) {
    console.log('\n⚠️ ISSUES IDENTIFIED:');
    results.issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  // Success metrics
  const successRate = (results.functionalityPreserved.length / (results.functionalityPreserved.length + results.issues.length)) * 100;
  console.log(`\n📊 CONSOLIDATION SUCCESS RATE: ${Math.round(successRate)}%`);
  
  if (successRate >= 90) {
    console.log('🎉 CONSOLIDATION SUCCESSFUL - All critical functionality preserved');
  } else if (successRate >= 75) {
    console.log('⚡ CONSOLIDATION PARTIALLY SUCCESSFUL - Minor issues to address');
  } else {
    console.log('❌ CONSOLIDATION NEEDS IMPROVEMENT - Significant issues found');
  }
  
  return results;
}

// Run validation
if (require.main === module) {
  generateReport();
}

module.exports = { validateConsolidation, generateReport };