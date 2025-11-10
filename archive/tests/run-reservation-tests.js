#!/usr/bin/env node

/**
 * Reservation System Test Runner
 * 
 * Comprehensive test runner for reservation system testing including:
 * - Unit tests
 * - Integration tests
 * - Performance tests
 * - Load tests
 * - Coverage reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ReservationTestRunner {
  constructor() {
    this.testResults = {
      unit: { passed: 0, failed: 0, skipped: 0 },
      integration: { passed: 0, failed: 0, skipped: 0 },
      performance: { passed: 0, failed: 0, skipped: 0 },
      load: { passed: 0, failed: 0, skipped: 0 },
    };
    this.coverageReport = null;
    this.startTime = Date.now();
  }

  /**
   * Run all reservation system tests
   */
  async runAllTests(options = {}) {
    console.log('🚀 Starting Reservation System Test Suite');
    console.log('==========================================');

    const {
      unit = true,
      integration = true,
      performance = false,
      load = false,
      coverage = true,
      verbose = false,
      parallel = false,
    } = options;

    try {
      // Run unit tests
      if (unit) {
        console.log('\n📋 Running Unit Tests...');
        await this.runUnitTests({ verbose });
      }

      // Run integration tests
      if (integration) {
        console.log('\n🔗 Running Integration Tests...');
        await this.runIntegrationTests({ verbose });
      }

      // Run performance tests
      if (performance) {
        console.log('\n⚡ Running Performance Tests...');
        await this.runPerformanceTests({ verbose });
      }

      // Run load tests
      if (load) {
        console.log('\n🔥 Running Load Tests...');
        await this.runLoadTests({ verbose });
      }

      // Generate coverage report
      if (coverage) {
        console.log('\n📊 Generating Coverage Report...');
        await this.generateCoverageReport();
      }

      // Print summary
      this.printSummary();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run unit tests
   */
  async runUnitTests(options = {}) {
    const { verbose = false } = options;
    
    try {
      const command = [
        'npm',
        'run',
        'test:reservation:unit',
        ...(verbose ? ['--verbose'] : [])
      ].join(' ');

      console.log(`Executing: ${command}`);
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log('✅ Unit tests completed successfully');
      this.parseTestResults(output, 'unit');

    } catch (error) {
      console.error('❌ Unit tests failed:', error.message);
      this.testResults.unit.failed++;
      throw error;
    }
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests(options = {}) {
    const { verbose = false } = options;
    
    try {
      const command = [
        'npm',
        'run',
        'test:reservation:integration',
        ...(verbose ? ['--verbose'] : [])
      ].join(' ');

      console.log(`Executing: ${command}`);
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log('✅ Integration tests completed successfully');
      this.parseTestResults(output, 'integration');

    } catch (error) {
      console.error('❌ Integration tests failed:', error.message);
      this.testResults.integration.failed++;
      throw error;
    }
  }

  /**
   * Run performance tests
   */
  async runPerformanceTests(options = {}) {
    const { verbose = false } = options;
    
    try {
      const command = [
        'npm',
        'run',
        'test:performance',
        ...(verbose ? ['--verbose'] : [])
      ].join(' ');

      console.log(`Executing: ${command}`);
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log('✅ Performance tests completed successfully');
      this.parseTestResults(output, 'performance');

    } catch (error) {
      console.error('❌ Performance tests failed:', error.message);
      this.testResults.performance.failed++;
      throw error;
    }
  }

  /**
   * Run load tests
   */
  async runLoadTests(options = {}) {
    const { verbose = false } = options;
    
    try {
      const command = [
        'npm',
        'run',
        'test:load',
        ...(verbose ? ['--verbose'] : [])
      ].join(' ');

      console.log(`Executing: ${command}`);
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log('✅ Load tests completed successfully');
      this.parseTestResults(output, 'load');

    } catch (error) {
      console.error('❌ Load tests failed:', error.message);
      this.testResults.load.failed++;
      throw error;
    }
  }

  /**
   * Generate coverage report
   */
  async generateCoverageReport() {
    try {
      const command = 'npm run test:coverage:reservation';
      
      console.log(`Executing: ${command}`);
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Parse coverage report
      this.coverageReport = this.parseCoverageReport(output);
      
      console.log('✅ Coverage report generated successfully');
      this.printCoverageReport();

    } catch (error) {
      console.error('❌ Coverage report generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Parse test results from Jest output
   */
  parseTestResults(output, testType) {
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed|(\d+) failed|(\d+) skipped/g);
        if (match) {
          match.forEach(m => {
            const parts = m.split(' ');
            const count = parseInt(parts[0]);
            const status = parts[1];
            
            if (status === 'passed') {
              this.testResults[testType].passed += count;
            } else if (status === 'failed') {
              this.testResults[testType].failed += count;
            } else if (status === 'skipped') {
              this.testResults[testType].skipped += count;
            }
          });
        }
      }
    }
  }

  /**
   * Parse coverage report
   */
  parseCoverageReport(output) {
    const lines = output.split('\n');
    const coverage = {
      statements: { covered: 0, total: 0, percentage: 0 },
      branches: { covered: 0, total: 0, percentage: 0 },
      functions: { covered: 0, total: 0, percentage: 0 },
      lines: { covered: 0, total: 0, percentage: 0 },
    };

    for (const line of lines) {
      if (line.includes('All files')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 6) {
          coverage.statements = {
            covered: parseInt(parts[1]) || 0,
            total: parseInt(parts[2]) || 0,
            percentage: parseFloat(parts[3]) || 0,
          };
          coverage.branches = {
            covered: parseInt(parts[4]) || 0,
            total: parseInt(parts[5]) || 0,
            percentage: parseFloat(parts[6]) || 0,
          };
          coverage.functions = {
            covered: parseInt(parts[7]) || 0,
            total: parseInt(parts[8]) || 0,
            percentage: parseFloat(parts[9]) || 0,
          };
          coverage.lines = {
            covered: parseInt(parts[10]) || 0,
            total: parseInt(parts[11]) || 0,
            percentage: parseFloat(parts[12]) || 0,
          };
        }
      }
    }

    return coverage;
  }

  /**
   * Print coverage report
   */
  printCoverageReport() {
    if (!this.coverageReport) {
      console.log('❌ No coverage report available');
      return;
    }

    console.log('\n📊 Coverage Report');
    console.log('==================');
    console.log(`Statements: ${this.coverageReport.statements.percentage.toFixed(1)}% (${this.coverageReport.statements.covered}/${this.coverageReport.statements.total})`);
    console.log(`Branches:   ${this.coverageReport.branches.percentage.toFixed(1)}% (${this.coverageReport.branches.covered}/${this.coverageReport.branches.total})`);
    console.log(`Functions:  ${this.coverageReport.functions.percentage.toFixed(1)}% (${this.coverageReport.functions.covered}/${this.coverageReport.functions.total})`);
    console.log(`Lines:      ${this.coverageReport.lines.percentage.toFixed(1)}% (${this.coverageReport.lines.covered}/${this.coverageReport.lines.total})`);

    // Check coverage thresholds
    const thresholds = {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    };

    const failed = Object.keys(thresholds).filter(key => 
      this.coverageReport[key].percentage < thresholds[key]
    );

    if (failed.length > 0) {
      console.log(`\n⚠️  Coverage below threshold for: ${failed.join(', ')}`);
    } else {
      console.log('\n✅ All coverage thresholds met');
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);

    console.log('\n📋 Test Summary');
    console.log('================');
    
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    Object.keys(this.testResults).forEach(testType => {
      const results = this.testResults[testType];
      if (results.passed > 0 || results.failed > 0 || results.skipped > 0) {
        const status = results.failed > 0 ? '❌' : '✅';
        console.log(`${status} ${testType.toUpperCase()}: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
        
        totalPassed += results.passed;
        totalFailed += results.failed;
        totalSkipped += results.skipped;
      }
    });

    console.log(`\n⏱️  Total Duration: ${duration}s`);
    console.log(`📊 Total: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);

    if (totalFailed > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
    }
  }

  /**
   * Run specific test categories
   */
  async runCategory(category, options = {}) {
    switch (category) {
      case 'unit':
        return await this.runUnitTests(options);
      case 'integration':
        return await this.runIntegrationTests(options);
      case 'performance':
        return await this.runPerformanceTests(options);
      case 'load':
        return await this.runLoadTests(options);
      case 'coverage':
        return await this.generateCoverageReport();
      default:
        throw new Error(`Unknown test category: ${category}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    unit: !args.includes('--skip-unit'),
    integration: !args.includes('--skip-integration'),
    performance: args.includes('--performance'),
    load: args.includes('--load'),
    coverage: !args.includes('--skip-coverage'),
    verbose: args.includes('--verbose'),
  };

  const category = args.find(arg => arg.startsWith('--category='));
  if (category) {
    const testCategory = category.split('=')[1];
    const runner = new ReservationTestRunner();
    runner.runCategory(testCategory, options)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    const runner = new ReservationTestRunner();
    runner.runAllTests(options)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = ReservationTestRunner;
