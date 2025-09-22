#!/usr/bin/env node

/**
 * Security Test Runner
 * 
 * Comprehensive security testing script with multiple configurations:
 * - Basic security tests (quick validation)
 * - Comprehensive security tests (full penetration testing)
 * - Compliance tests (PCI DSS, GDPR validation)
 * - Performance security tests (load testing with security focus)
 * - Vulnerability assessment (automated security scanning)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configurations
const TEST_CONFIGS = {
  basic: {
    name: 'Basic Security Tests',
    description: 'Quick security validation tests',
    testPattern: 'tests/security/payment-security-comprehensive.test.ts',
    timeout: 60000,
    maxWorkers: 2,
    coverage: false
  },
  comprehensive: {
    name: 'Comprehensive Security Tests',
    description: 'Full penetration testing suite',
    testPattern: 'tests/security/*.test.ts',
    timeout: 120000,
    maxWorkers: 1,
    coverage: true
  },
  penetration: {
    name: 'Penetration Testing',
    description: 'Advanced penetration testing scenarios',
    testPattern: 'tests/security/penetration-testing.test.ts',
    timeout: 180000,
    maxWorkers: 1,
    coverage: false
  },
  compliance: {
    name: 'Compliance Testing',
    description: 'PCI DSS and GDPR compliance validation',
    testPattern: 'tests/security/payment-security-comprehensive.test.ts',
    timeout: 90000,
    maxWorkers: 1,
    coverage: true,
    additionalArgs: ['--testNamePattern=Compliance']
  },
  performance: {
    name: 'Performance Security Tests',
    description: 'Security testing under load conditions',
    testPattern: 'tests/security/payment-security-comprehensive.test.ts',
    timeout: 300000,
    maxWorkers: 4,
    coverage: false,
    additionalArgs: ['--testNamePattern=Performance']
  },
  vulnerability: {
    name: 'Vulnerability Assessment',
    description: 'Automated vulnerability scanning',
    testPattern: 'tests/security/*.test.ts',
    timeout: 240000,
    maxWorkers: 1,
    coverage: true,
    additionalArgs: ['--verbose']
  }
};

// Environment validation
function validateEnvironment() {
  console.log('🔍 Validating security test environment...');
  
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
  
  // Check for optional security-specific variables
  const optionalSecurityVars = [
    'TOSS_PAYMENTS_WEBHOOK_SECRET',
    'TOSS_PAYMENTS_ALLOWED_IPS',
    'ENCRYPTION_KEY',
    'TEST_SERVER_URL'
  ];
  
  const missingOptional = optionalSecurityVars.filter(varName => !process.env[varName]);
  if (missingOptional.length > 0) {
    console.warn('⚠️  Optional security environment variables not set:');
    missingOptional.forEach(varName => {
      console.warn(`   - ${varName}`);
    });
    console.warn('Some security tests may be skipped or use default values\n');
  }
  
  console.log('✅ Environment validation completed\n');
}

// Generate security test report
function generateSecurityReport(testResults, config) {
  const timestamp = new Date().toISOString();
  const reportDir = 'test-reports/security';
  
  // Ensure report directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const report = {
    testSuite: config.name,
    description: config.description,
    timestamp,
    configuration: {
      testPattern: config.testPattern,
      timeout: config.timeout,
      maxWorkers: config.maxWorkers,
      coverage: config.coverage
    },
    results: testResults,
    summary: {
      totalTests: testResults.numTotalTests || 0,
      passedTests: testResults.numPassedTests || 0,
      failedTests: testResults.numFailedTests || 0,
      skippedTests: testResults.numPendingTests || 0,
      duration: testResults.testDuration || 0,
      success: testResults.success || false
    },
    securityMetrics: {
      vulnerabilitiesFound: testResults.numFailedTests || 0,
      securityTestsCovered: testResults.numTotalTests || 0,
      complianceScore: testResults.numPassedTests / (testResults.numTotalTests || 1) * 100
    }
  };
  
  const reportFile = path.join(reportDir, `security-test-report-${config.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`📊 Security test report generated: ${reportFile}`);
  return report;
}

// Run security tests with specific configuration
async function runSecurityTests(configName) {
  const config = TEST_CONFIGS[configName];
  
  if (!config) {
    console.error(`❌ Unknown test configuration: ${configName}`);
    console.log('Available configurations:');
    Object.keys(TEST_CONFIGS).forEach(name => {
      console.log(`  - ${name}: ${TEST_CONFIGS[name].description}`);
    });
    process.exit(1);
  }
  
  console.log(`🔒 Starting ${config.name}...`);
  console.log(`📝 Description: ${config.description}`);
  console.log(`🎯 Test Pattern: ${config.testPattern}`);
  console.log(`⏱️  Timeout: ${config.timeout}ms`);
  console.log(`👥 Max Workers: ${config.maxWorkers}`);
  console.log(`📈 Coverage: ${config.coverage ? 'Enabled' : 'Disabled'}\n`);
  
  // Build Jest command
  const jestArgs = [
    '--testPathPattern', config.testPattern,
    '--testTimeout', config.timeout.toString(),
    '--maxWorkers', config.maxWorkers.toString(),
    '--detectOpenHandles',
    '--forceExit'
  ];
  
  // Add coverage if enabled
  if (config.coverage) {
    jestArgs.push(
      '--coverage',
      '--coverageDirectory', 'coverage/security',
      '--coverageReporters', 'text', 'lcov', 'html'
    );
  }
  
  // Add additional arguments
  if (config.additionalArgs) {
    jestArgs.push(...config.additionalArgs);
  }
  
  // Add verbose output for security tests
  jestArgs.push('--verbose');
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    jest.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const results = {
        success: code === 0,
        exitCode: code,
        testDuration: duration,
        // Note: These would be populated by Jest's JSON reporter in a real implementation
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0
      };
      
      console.log(`\n⏱️  Security tests completed in ${duration}ms`);
      
      if (code === 0) {
        console.log('✅ All security tests passed!');
        
        // Generate security report
        const report = generateSecurityReport(results, config);
        
        console.log('\n🔒 Security Test Summary:');
        console.log(`   Configuration: ${config.name}`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Status: PASSED`);
        
        if (config.coverage) {
          console.log('   Coverage report generated in coverage/security/');
        }
        
        resolve(results);
      } else {
        console.log(`❌ Security tests failed with exit code ${code}`);
        
        // Generate failure report
        results.numFailedTests = 1; // Assume at least one failure
        const report = generateSecurityReport(results, config);
        
        console.log('\n🚨 Security Test Failure Summary:');
        console.log(`   Configuration: ${config.name}`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Status: FAILED`);
        console.log(`   Exit Code: ${code}`);
        
        reject(new Error(`Security tests failed with exit code ${code}`));
      }
    });
    
    jest.on('error', (error) => {
      console.error('❌ Failed to start security tests:', error.message);
      reject(error);
    });
  });
}

// Main execution
async function main() {
  const configName = process.argv[2] || 'basic';
  
  console.log('🔒 Payment Security Test Runner');
  console.log('================================\n');
  
  try {
    // Validate environment
    validateEnvironment();
    
    // Run security tests
    await runSecurityTests(configName);
    
    console.log('\n🎉 Security testing completed successfully!');
    
    // Additional security recommendations
    console.log('\n🛡️  Security Recommendations:');
    console.log('   1. Run comprehensive security tests before each deployment');
    console.log('   2. Review security test reports for any new vulnerabilities');
    console.log('   3. Update security tests when adding new payment features');
    console.log('   4. Monitor security metrics and compliance scores');
    console.log('   5. Conduct regular penetration testing with external tools');
    
  } catch (error) {
    console.error('\n💥 Security testing failed:', error.message);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure all required environment variables are set');
    console.log('   2. Check that the test database is accessible');
    console.log('   3. Verify that security services are properly configured');
    console.log('   4. Review test logs for specific error details');
    console.log('   5. Consider running tests with --verbose for more information');
    
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  runSecurityTests,
  TEST_CONFIGS,
  validateEnvironment,
  generateSecurityReport
};

