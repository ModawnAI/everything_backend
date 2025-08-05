/**
 * Comprehensive Security Test Suite
 * 
 * Orchestrates all security tests and provides comprehensive reporting.
 * This file serves as the main entry point for security testing and
 * includes test runners for different security aspects.
 */

import { execSync } from 'child_process';
import path from 'path';

/**
 * Security Test Categories
 */
export enum SecurityTestCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization', 
  RATE_LIMITING = 'rate-limiting',
  INTEGRATION = 'integration',
  PERFORMANCE = 'performance',
  VULNERABILITY = 'vulnerability'
}

/**
 * Security Test Configuration
 */
export interface SecurityTestConfig {
  category: SecurityTestCategory;
  testFile: string;
  description: string;
  criticalLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedDuration: number; // minutes
}

/**
 * Security Test Results
 */
export interface SecurityTestResult {
  category: SecurityTestCategory;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
  vulnerabilities: SecurityVulnerability[];
}

/**
 * Security Vulnerability Report
 */
export interface SecurityVulnerability {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  description: string;
  recommendation: string;
  testCase: string;
}

/**
 * Security Test Suite Configuration
 */
export const SECURITY_TEST_CONFIGS: SecurityTestConfig[] = [
  {
    category: SecurityTestCategory.AUTHENTICATION,
    testFile: 'auth-security.test.ts',
    description: 'JWT authentication security vulnerabilities',
    criticalLevel: 'CRITICAL',
    estimatedDuration: 5
  },
  {
    category: SecurityTestCategory.AUTHORIZATION,
    testFile: 'rbac-security.test.ts', 
    description: 'Role-based access control and privilege escalation',
    criticalLevel: 'CRITICAL',
    estimatedDuration: 7
  },
  {
    category: SecurityTestCategory.RATE_LIMITING,
    testFile: 'rate-limit-security.test.ts',
    description: 'Rate limiting bypass and DDoS protection',
    criticalLevel: 'HIGH',
    estimatedDuration: 10
  },
  {
    category: SecurityTestCategory.INTEGRATION,
    testFile: 'integration-security.test.ts',
    description: 'End-to-end security flow validation',
    criticalLevel: 'HIGH',
    estimatedDuration: 8
  }
];

/**
 * Security Test Runner
 */
export class SecurityTestRunner {
  private testResults: SecurityTestResult[] = [];
  private vulnerabilities: SecurityVulnerability[] = [];

  /**
   * Run all security tests
   */
  async runAllTests(): Promise<SecurityTestSummary> {
    console.log('🔒 Starting Comprehensive Security Test Suite...\n');
    
    const startTime = Date.now();
    
    for (const config of SECURITY_TEST_CONFIGS) {
      console.log(`📋 Running ${config.category} tests...`);
      
      try {
        const result = await this.runTestCategory(config);
        this.testResults.push(result);
        
        console.log(`✅ ${config.category}: ${result.passed} passed, ${result.failed} failed\n`);
      } catch (error) {
        console.error(`❌ Failed to run ${config.category} tests:`, error);
        
        this.testResults.push({
          category: config.category,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          vulnerabilities: []
        });
      }
    }
    
    const endTime = Date.now();
    const totalDuration = (endTime - startTime) / 1000;
    
    const summary = this.generateSummary(totalDuration);
    this.printSummary(summary);
    
    return summary;
  }

  /**
   * Run tests for specific category
   */
  private async runTestCategory(config: SecurityTestConfig): Promise<SecurityTestResult> {
    const testPath = path.join(__dirname, config.testFile);
    const startTime = Date.now();
    
    try {
      // Run Jest tests for the specific file
      const result = execSync(
        `npx jest "${testPath}" --json --passWithNoTests`,
        { 
          encoding: 'utf8',
          cwd: process.cwd(),
          timeout: config.estimatedDuration * 60 * 1000 // Convert minutes to milliseconds
        }
      );
      
      const jestResult = JSON.parse(result);
      const endTime = Date.now();
      
      return {
        category: config.category,
        passed: jestResult.numPassedTests || 0,
        failed: jestResult.numFailedTests || 0,
        skipped: jestResult.numPendingTests || 0,
        duration: (endTime - startTime) / 1000,
        errors: this.extractErrors(jestResult),
        vulnerabilities: this.extractVulnerabilities(jestResult, config)
      };
    } catch (error) {
      const endTime = Date.now();
      
      // Try to parse Jest output even if command failed
      let passed = 0, failed = 0, skipped = 0;
      let errors: string[] = [];
      
      if (error instanceof Error && error.message) {
        try {
          const jestResult = JSON.parse(error.message);
          passed = jestResult.numPassedTests || 0;
          failed = jestResult.numFailedTests || 0;
          skipped = jestResult.numPendingTests || 0;
          errors = this.extractErrors(jestResult);
        } catch {
          errors = [error.message];
          failed = 1;
        }
      }
      
      return {
        category: config.category,
        passed,
        failed,
        skipped,
        duration: (endTime - startTime) / 1000,
        errors,
        vulnerabilities: []
      };
    }
  }

  /**
   * Extract errors from Jest results
   */
  private extractErrors(jestResult: any): string[] {
    const errors: string[] = [];
    
    if (jestResult.testResults) {
      jestResult.testResults.forEach((testFile: any) => {
        if (testFile.assertionResults) {
          testFile.assertionResults.forEach((test: any) => {
            if (test.status === 'failed' && test.failureMessages) {
              errors.push(...test.failureMessages);
            }
          });
        }
      });
    }
    
    return errors;
  }

  /**
   * Extract security vulnerabilities from test results
   */
  private extractVulnerabilities(jestResult: any, config: SecurityTestConfig): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    
    if (jestResult.testResults) {
      jestResult.testResults.forEach((testFile: any) => {
        if (testFile.assertionResults) {
          testFile.assertionResults.forEach((test: any) => {
            if (test.status === 'failed') {
              const vulnerability = this.categorizeVulnerability(test, config);
              if (vulnerability) {
                vulnerabilities.push(vulnerability);
              }
            }
          });
        }
      });
    }
    
    return vulnerabilities;
  }

  /**
   * Categorize failed tests as security vulnerabilities
   */
  private categorizeVulnerability(failedTest: any, config: SecurityTestConfig): SecurityVulnerability | null {
    const testTitle = failedTest.title || 'Unknown test';
    
    // Categorize based on test title patterns
    if (testTitle.includes('privilege escalation') || testTitle.includes('admin')) {
      return {
        severity: 'CRITICAL',
        category: 'Privilege Escalation',
        description: `Failed test: ${testTitle}`,
        recommendation: 'Review and strengthen role-based access controls',
        testCase: testTitle
      };
    }
    
    if (testTitle.includes('token') && (testTitle.includes('invalid') || testTitle.includes('expired'))) {
      return {
        severity: 'HIGH',
        category: 'Authentication Bypass',
        description: `Failed test: ${testTitle}`,
        recommendation: 'Ensure proper token validation and expiration handling',
        testCase: testTitle
      };
    }
    
    if (testTitle.includes('rate limit') || testTitle.includes('bypass')) {
      return {
        severity: 'MEDIUM',
        category: 'Rate Limiting',
        description: `Failed test: ${testTitle}`,
        recommendation: 'Strengthen rate limiting implementation',
        testCase: testTitle
      };
    }
    
    if (testTitle.includes('injection') || testTitle.includes('malicious')) {
      return {
        severity: 'HIGH',
        category: 'Input Validation',
        description: `Failed test: ${testTitle}`,
        recommendation: 'Implement comprehensive input validation and sanitization',
        testCase: testTitle
      };
    }
    
    // Default categorization for other failed tests
    return {
      severity: 'MEDIUM',
      category: config.category,
      description: `Failed test: ${testTitle}`,
      recommendation: 'Review and fix the identified security issue',
      testCase: testTitle
    };
  }

  /**
   * Generate comprehensive test summary
   */
  private generateSummary(totalDuration: number): SecurityTestSummary {
    const totalPassed = this.testResults.reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = this.testResults.reduce((sum, result) => sum + result.failed, 0);
    const totalSkipped = this.testResults.reduce((sum, result) => sum + result.skipped, 0);
    const totalTests = totalPassed + totalFailed + totalSkipped;
    
    // Collect all vulnerabilities
    const allVulnerabilities: SecurityVulnerability[] = [];
    this.testResults.forEach(result => {
      allVulnerabilities.push(...result.vulnerabilities);
    });
    
    // Calculate security score (0-100)
    const securityScore = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    
    // Determine overall security level
    let securityLevel: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR' | 'CRITICAL';
    if (securityScore >= 95) securityLevel = 'EXCELLENT';
    else if (securityScore >= 85) securityLevel = 'GOOD';
    else if (securityScore >= 70) securityLevel = 'MODERATE';
    else if (securityScore >= 50) securityLevel = 'POOR';
    else securityLevel = 'CRITICAL';
    
    return {
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDuration,
      securityScore,
      securityLevel,
      vulnerabilities: allVulnerabilities,
      categoryResults: this.testResults,
      recommendations: this.generateRecommendations(allVulnerabilities)
    };
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(vulnerabilities: SecurityVulnerability[]): string[] {
    const recommendations: string[] = [];
    
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'CRITICAL');
    const highVulns = vulnerabilities.filter(v => v.severity === 'HIGH');
    const mediumVulns = vulnerabilities.filter(v => v.severity === 'MEDIUM');
    
    if (criticalVulns.length > 0) {
      recommendations.push('🚨 IMMEDIATE ACTION REQUIRED: Address critical security vulnerabilities before deployment');
      recommendations.push('🔐 Review and strengthen authentication and authorization mechanisms');
    }
    
    if (highVulns.length > 0) {
      recommendations.push('⚠️ HIGH PRIORITY: Fix high-severity security issues');
      recommendations.push('🛡️ Implement additional security layers and monitoring');
    }
    
    if (mediumVulns.length > 0) {
      recommendations.push('📋 MEDIUM PRIORITY: Address medium-severity issues in next iteration');
    }
    
    if (vulnerabilities.length === 0) {
      recommendations.push('✅ Excellent security posture! Continue monitoring and testing');
      recommendations.push('🔄 Schedule regular security assessments');
    }
    
    return recommendations;
  }

  /**
   * Print comprehensive security summary
   */
  private printSummary(summary: SecurityTestSummary): void {
    console.log('\n' + '='.repeat(70));
    console.log('🔒 COMPREHENSIVE SECURITY TEST SUMMARY');
    console.log('='.repeat(70));
    
    console.log(`\n📊 Overall Results:`);
    console.log(`   Tests Run: ${summary.totalTests}`);
    console.log(`   Passed: ${summary.totalPassed} ✅`);
    console.log(`   Failed: ${summary.totalFailed} ❌`);
    console.log(`   Skipped: ${summary.totalSkipped} ⏭️`);
    console.log(`   Duration: ${summary.totalDuration.toFixed(2)}s`);
    
    console.log(`\n🛡️ Security Assessment:`);
    console.log(`   Security Score: ${summary.securityScore}/100`);
    console.log(`   Security Level: ${summary.securityLevel}`);
    
    if (summary.vulnerabilities.length > 0) {
      console.log(`\n🚨 Vulnerabilities Found:`);
      const vulnsBySeverity = {
        CRITICAL: summary.vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        HIGH: summary.vulnerabilities.filter(v => v.severity === 'HIGH').length,
        MEDIUM: summary.vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        LOW: summary.vulnerabilities.filter(v => v.severity === 'LOW').length
      };
      
      Object.entries(vulnsBySeverity).forEach(([severity, count]) => {
        if (count > 0) {
          console.log(`   ${severity}: ${count}`);
        }
      });
    }
    
    console.log(`\n📋 Category Breakdown:`);
    summary.categoryResults.forEach(result => {
      const passRate = result.passed + result.failed > 0 
        ? ((result.passed / (result.passed + result.failed)) * 100).toFixed(1)
        : '0.0';
      console.log(`   ${result.category}: ${result.passed}/${result.passed + result.failed} (${passRate}%)`);
    });
    
    if (summary.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      summary.recommendations.forEach(rec => {
        console.log(`   ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
  }
}

/**
 * Security Test Summary Interface
 */
export interface SecurityTestSummary {
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  securityScore: number;
  securityLevel: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR' | 'CRITICAL';
  vulnerabilities: SecurityVulnerability[];
  categoryResults: SecurityTestResult[];
  recommendations: string[];
}

/**
 * Run security tests if called directly
 */
if (require.main === module) {
  const runner = new SecurityTestRunner();
  runner.runAllTests()
    .then(summary => {
      process.exit(summary.totalFailed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Security test suite failed:', error);
      process.exit(1);
    });
} 