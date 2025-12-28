#!/usr/bin/env node

/**
 * Refund Automation Test Runner
 * 
 * Runs comprehensive tests for the refund automation system:
 * - Unit tests for automated refund service
 * - Integration tests with real database
 * - Performance tests for bulk refund processing
 * - Security tests for refund validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configurations
const TEST_CONFIGS = {
  unit: {
    name: 'Unit Tests',
    pattern: 'tests/unit/automated-refund.test.ts',
    timeout: 30000,
    maxWorkers: 1,
    coverage: true
  },
  integration: {
    name: 'Integration Tests',
    pattern: 'tests/integration/refund-automation-integration.test.ts',
    timeout: 60000,
    maxWorkers: 1,
    coverage: true
  },
  comprehensive: {
    name: 'Comprehensive Tests',
    pattern: 'tests/**/*refund*.test.ts',
    timeout: 120000,
    maxWorkers: 2,
    coverage: true
  },
  performance: {
    name: 'Performance Tests',
    pattern: 'tests/performance/*refund*.test.ts',
    timeout: 300000,
    maxWorkers: 1,
    coverage: false
  }
};

function validateEnvironment() {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file');
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

function runTests(configName) {
  const config = TEST_CONFIGS[configName];
  
  if (!config) {
    console.error(`❌ Unknown test configuration: ${configName}`);
    console.error(`Available configurations: ${Object.keys(TEST_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🧪 Running ${config.name}...`);
  console.log(`📁 Pattern: ${config.pattern}`);
  console.log(`⏱️  Timeout: ${config.timeout}ms`);
  console.log(`👥 Max Workers: ${config.maxWorkers}`);

  const jestArgs = [
    '--testPathPattern', config.pattern,
    '--testTimeout', config.timeout.toString(),
    '--maxWorkers', config.maxWorkers.toString(),
    '--verbose',
    '--detectOpenHandles',
    '--forceExit'
  ];

  if (config.coverage) {
    jestArgs.push(
      '--coverage',
      '--coverageDirectory', `coverage/refund-${configName}`,
      '--coverageReporters', 'text', 'lcov', 'html'
    );
  }

  try {
    const command = `npx jest ${jestArgs.join(' ')}`;
    console.log(`\n🚀 Executing: ${command}\n`);
    
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    console.log(`\n✅ ${config.name} completed successfully!`);
    
    if (config.coverage) {
      console.log(`📊 Coverage report generated in: coverage/refund-${configName}/`);
    }

  } catch (error) {
    console.error(`\n❌ ${config.name} failed!`);
    console.error(`Exit code: ${error.status}`);
    process.exit(error.status || 1);
  }
}

function generateReport(results) {
  const reportPath = path.join('test-reports', `refund-test-report-${Date.now()}.json`);
  
  // Ensure reports directory exists
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    testType: 'refund-automation',
    results,
    summary: {
      totalConfigurations: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📋 Test report generated: ${reportPath}`);
  
  return report;
}

function main() {
  const args = process.argv.slice(2);
  const configName = args[0] || 'unit';

  console.log('🔧 Refund Automation Test Runner');
  console.log('================================');

  // Validate environment
  validateEnvironment();

  if (configName === 'all') {
    console.log('\n🎯 Running all test configurations...');
    
    const results = [];
    const configNames = Object.keys(TEST_CONFIGS);
    
    for (const name of configNames) {
      const startTime = Date.now();
      
      try {
        runTests(name);
        results.push({
          configuration: name,
          success: true,
          duration: Date.now() - startTime,
          error: null
        });
      } catch (error) {
        results.push({
          configuration: name,
          success: false,
          duration: Date.now() - startTime,
          error: error.message
        });
      }
    }

    // Generate comprehensive report
    const report = generateReport(results);
    
    console.log('\n📊 Final Summary:');
    console.log(`✅ Passed: ${report.summary.passed}/${report.summary.totalConfigurations}`);
    console.log(`❌ Failed: ${report.summary.failed}/${report.summary.totalConfigurations}`);
    console.log(`⏱️  Total Duration: ${Math.round(report.summary.totalDuration / 1000)}s`);

    if (report.summary.failed > 0) {
      console.log('\n❌ Some test configurations failed:');
      results.filter(r => !r.success).forEach(result => {
        console.log(`   - ${result.configuration}: ${result.error}`);
      });
      process.exit(1);
    }

    console.log('\n🎉 All refund automation tests passed!');
    
  } else {
    runTests(configName);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}

