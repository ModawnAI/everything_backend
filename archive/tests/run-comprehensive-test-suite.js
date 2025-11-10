#!/usr/bin/env node

/**
 * Comprehensive Test Suite Runner
 * 
 * Orchestrates all types of tests in the reservation system:
 * - Unit tests with coverage reporting
 * - Integration tests for workflows
 * - Performance and load tests
 * - End-to-end user simulation tests
 * - Security and compliance tests
 * - Database migration tests
 * 
 * Usage:
 *   node scripts/run-comprehensive-test-suite.js [options]
 * 
 * Options:
 *   --unit              Run unit tests only
 *   --integration       Run integration tests only
 *   --performance       Run performance tests only
 *   --e2e               Run end-to-end tests only
 *   --security          Run security tests only
 *   --coverage          Generate coverage reports
 *   --parallel          Run tests in parallel (where possible)
 *   --verbose           Enable verbose output
 *   --ci                CI/CD mode with optimized settings
 *   --quick             Quick test run (skip heavy tests)
 *   --full              Full test suite (default)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  testDirectories: {
    unit: 'tests/unit/',
    integration: 'tests/integration/',
    performance: 'tests/performance/',
    e2e: 'tests/e2e/',
    security: 'tests/security/'
  },
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    critical: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  performanceThresholds: {
    maxExecutionTime: 300000, // 5 minutes
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    minSuccessRate: 0.8 // 80%
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  unit: args.includes('--unit'),
  integration: args.includes('--integration'),
  performance: args.includes('--performance'),
  e2e: args.includes('--e2e'),
  security: args.includes('--security'),
  coverage: args.includes('--coverage'),
  parallel: args.includes('--parallel'),
  verbose: args.includes('--verbose'),
  ci: args.includes('--ci'),
  quick: args.includes('--quick'),
  full: !args.some(arg => arg.startsWith('--') && arg !== '--verbose' && arg !== '--coverage' && arg !== '--parallel')
};

// Test execution results
const testResults = {
  unit: { passed: 0, failed: 0, skipped: 0, duration: 0 },
  integration: { passed: 0, failed: 0, skipped: 0, duration: 0 },
  performance: { passed: 0, failed: 0, skipped: 0, duration: 0 },
  e2e: { passed: 0, failed: 0, skipped: 0, duration: 0 },
  security: { passed: 0, failed: 0, skipped: 0, duration: 0 },
  coverage: { percentage: 0, threshold: 0 },
  totalDuration: 0
};

// Utility functions
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    debug: '🔍'
  }[level];
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function executeCommand(command, options = {}) {
  const defaultOptions = {
    stdio: options.verbose ? 'inherit' : 'pipe',
    encoding: 'utf8',
    timeout: 600000 // 10 minutes
  };
  
  try {
    const result = execSync(command, { ...defaultOptions, ...options });
    return { success: true, output: result, error: null };
  } catch (error) {
    return { success: false, output: error.stdout, error: error.stderr };
  }
}

function parseJestOutput(output) {
  const lines = output.split('\n');
  const result = { passed: 0, failed: 0, skipped: 0 };
  
  for (const line of lines) {
    if (line.includes('Tests:')) {
      const match = line.match(/(\d+) passed|(\d+) failed|(\d+) skipped/g);
      if (match) {
        match.forEach(m => {
          if (m.includes('passed')) result.passed += parseInt(m.match(/\d+/)[0]);
          if (m.includes('failed')) result.failed += parseInt(m.match(/\d+/)[0]);
          if (m.includes('skipped')) result.skipped += parseInt(m.match(/\d+/)[0]);
        });
      }
    }
  }
  
  return result;
}

function generateCoverageReport() {
  log('Generating coverage report...', 'info');
  
  const coverageCommand = 'npm run test:coverage:report';
  const result = executeCommand(coverageCommand);
  
  if (result.success) {
    log('Coverage report generated successfully', 'success');
    
    // Parse coverage percentage from output
    const coverageMatch = result.output.match(/All files\s+\|\s+(\d+\.?\d*)/);
    if (coverageMatch) {
      testResults.coverage.percentage = parseFloat(coverageMatch[1]);
      testResults.coverage.threshold = CONFIG.coverageThresholds.global.statements;
      
      if (testResults.coverage.percentage >= testResults.coverage.threshold) {
        log(`Coverage: ${testResults.coverage.percentage}% (threshold: ${testResults.coverage.threshold}%)`, 'success');
      } else {
        log(`Coverage: ${testResults.coverage.percentage}% (threshold: ${testResults.coverage.threshold}%)`, 'warning');
      }
    }
  } else {
    log('Failed to generate coverage report', 'error');
    log(result.error, 'error');
  }
}

function runUnitTests() {
  log('Running unit tests...', 'info');
  const startTime = Date.now();
  
  const unitCommand = options.verbose ? 
    'npm run test:unit -- --verbose' : 
    'npm run test:unit';
  
  const result = executeCommand(unitCommand);
  const duration = Date.now() - startTime;
  
  if (result.success) {
    const parsed = parseJestOutput(result.output);
    testResults.unit = { ...parsed, duration };
    log(`Unit tests completed: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped (${duration}ms)`, 'success');
  } else {
    testResults.unit = { passed: 0, failed: 1, skipped: 0, duration };
    log('Unit tests failed', 'error');
    if (options.verbose) log(result.error, 'error');
  }
}

function runIntegrationTests() {
  log('Running integration tests...', 'info');
  const startTime = Date.now();
  
  const integrationCommand = options.verbose ? 
    'npm run test:integration -- --verbose' : 
    'npm run test:integration';
  
  const result = executeCommand(integrationCommand);
  const duration = Date.now() - startTime;
  
  if (result.success) {
    const parsed = parseJestOutput(result.output);
    testResults.integration = { ...parsed, duration };
    log(`Integration tests completed: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped (${duration}ms)`, 'success');
  } else {
    testResults.integration = { passed: 0, failed: 1, skipped: 0, duration };
    log('Integration tests failed', 'error');
    if (options.verbose) log(result.error, 'error');
  }
}

function runPerformanceTests() {
  log('Running performance tests...', 'info');
  const startTime = Date.now();
  
  const performanceCommand = options.verbose ? 
    'npm run test:performance:all -- --verbose' : 
    'npm run test:performance:all';
  
  const result = executeCommand(performanceCommand);
  const duration = Date.now() - startTime;
  
  if (result.success) {
    const parsed = parseJestOutput(result.output);
    testResults.performance = { ...parsed, duration };
    log(`Performance tests completed: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped (${duration}ms)`, 'success');
    
    // Check performance thresholds
    if (duration > CONFIG.performanceThresholds.maxExecutionTime) {
      log(`Performance test execution time (${duration}ms) exceeded threshold (${CONFIG.performanceThresholds.maxExecutionTime}ms)`, 'warning');
    }
  } else {
    testResults.performance = { passed: 0, failed: 1, skipped: 0, duration };
    log('Performance tests failed', 'error');
    if (options.verbose) log(result.error, 'error');
  }
}

function runE2ETests() {
  log('Running end-to-end tests...', 'info');
  const startTime = Date.now();
  
  const e2eCommand = options.verbose ? 
    'npm run test:e2e:all -- --verbose' : 
    'npm run test:e2e:all';
  
  const result = executeCommand(e2eCommand);
  const duration = Date.now() - startTime;
  
  if (result.success) {
    const parsed = parseJestOutput(result.output);
    testResults.e2e = { ...parsed, duration };
    log(`E2E tests completed: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped (${duration}ms)`, 'success');
  } else {
    testResults.e2e = { passed: 0, failed: 1, skipped: 0, duration };
    log('E2E tests failed', 'error');
    if (options.verbose) log(result.error, 'error');
  }
}

function runSecurityTests() {
  log('Running security tests...', 'info');
  const startTime = Date.now();
  
  const securityCommand = options.verbose ? 
    'npm run test:security -- --verbose' : 
    'npm run test:security';
  
  const result = executeCommand(securityCommand);
  const duration = Date.now() - startTime;
  
  if (result.success) {
    const parsed = parseJestOutput(result.output);
    testResults.security = { ...parsed, duration };
    log(`Security tests completed: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped (${duration}ms)`, 'success');
  } else {
    testResults.security = { passed: 0, failed: 1, skipped: 0, duration };
    log('Security tests failed', 'error');
    if (options.verbose) log(result.error, 'error');
  }
}

function generateTestReport() {
  log('Generating comprehensive test report...', 'info');
  
  const report = {
    timestamp: new Date().toISOString(),
    duration: testResults.totalDuration,
    summary: {
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0
    },
    details: testResults,
    coverage: testResults.coverage,
    performance: {
      thresholds: CONFIG.performanceThresholds,
      results: {
        unit: testResults.unit.duration,
        integration: testResults.integration.duration,
        performance: testResults.performance.duration,
        e2e: testResults.e2e.duration,
        security: testResults.security.duration
      }
    },
    recommendations: []
  };
  
  // Calculate totals
  Object.values(testResults).forEach(result => {
    if (typeof result === 'object' && result.passed !== undefined) {
      report.summary.totalTests += result.passed + result.failed + result.skipped;
      report.summary.totalPassed += result.passed;
      report.summary.totalFailed += result.failed;
      report.summary.totalSkipped += result.skipped;
    }
  });
  
  // Generate recommendations
  if (testResults.coverage.percentage < testResults.coverage.threshold) {
    report.recommendations.push('Increase test coverage to meet threshold requirements');
  }
  
  if (testResults.performance.duration > CONFIG.performanceThresholds.maxExecutionTime) {
    report.recommendations.push('Optimize performance test execution time');
  }
  
  if (testResults.e2e.failed > 0) {
    report.recommendations.push('Review and fix failing end-to-end tests');
  }
  
  // Save report
  const reportPath = path.join(process.cwd(), 'test-reports', `comprehensive-test-report-${Date.now()}.json`);
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Test report saved to: ${reportPath}`, 'success');
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE TEST SUITE RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${report.summary.totalTests}`);
  console.log(`✅ Passed: ${report.summary.totalPassed}`);
  console.log(`❌ Failed: ${report.summary.totalFailed}`);
  console.log(`⏭️ Skipped: ${report.summary.totalSkipped}`);
  console.log(`⏱️ Total Duration: ${(testResults.totalDuration / 1000).toFixed(2)}s`);
  
  if (testResults.coverage.percentage > 0) {
    console.log(`📈 Coverage: ${testResults.coverage.percentage}%`);
  }
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`   • ${rec}`));
  }
  
  console.log('='.repeat(60));
  
  return report;
}

function main() {
  const startTime = Date.now();
  
  log('🚀 Starting Comprehensive Test Suite', 'info');
  log(`Options: ${JSON.stringify(options, null, 2)}`, 'debug');
  
  try {
    // Run tests based on options
    if (options.full || options.unit) {
      runUnitTests();
    }
    
    if (options.full || options.integration) {
      runIntegrationTests();
    }
    
    if (options.full || options.performance) {
      if (!options.quick) {
        runPerformanceTests();
      } else {
        log('Skipping performance tests in quick mode', 'info');
      }
    }
    
    if (options.full || options.e2e) {
      if (!options.quick) {
        runE2ETests();
      } else {
        log('Skipping E2E tests in quick mode', 'info');
      }
    }
    
    if (options.full || options.security) {
      runSecurityTests();
    }
    
    if (options.coverage) {
      generateCoverageReport();
    }
    
    testResults.totalDuration = Date.now() - startTime;
    
    // Generate final report
    const report = generateTestReport();
    
    // Exit with appropriate code
    const hasFailures = report.summary.totalFailed > 0;
    const exitCode = hasFailures ? 1 : 0;
    
    if (hasFailures) {
      log('❌ Test suite completed with failures', 'error');
    } else {
      log('✅ Test suite completed successfully', 'success');
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    log(`Test suite execution failed: ${error.message}`, 'error');
    if (options.verbose) log(error.stack, 'error');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('Test suite interrupted by user', 'warning');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('Test suite terminated', 'warning');
  process.exit(143);
});

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main, CONFIG, testResults };
