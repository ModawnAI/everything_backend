#!/usr/bin/env node

/**
 * Deployment Health Check Script
 * 
 * Comprehensive health checking for deployment pipeline:
 * - Pre-deployment health validation
 * - Post-deployment health verification
 * - Blue-green deployment health checks
 * - Traffic verification and monitoring
 * - Rollback verification
 * - Extended monitoring and alerting
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  environments: {
    staging: {
      baseUrl: process.env.STAGING_URL || 'https://staging-api.ebeautything.com',
      healthEndpoint: '/health',
      readinessEndpoint: '/health/ready',
      detailedHealthEndpoint: '/health/detailed'
    },
    production: {
      baseUrl: process.env.PRODUCTION_URL || 'https://api.ebeautything.com',
      healthEndpoint: '/health',
      readinessEndpoint: '/health/ready',
      detailedHealthEndpoint: '/health/detailed'
    }
  },
  timeouts: {
    healthCheck: 10000,      // 10 seconds
    readinessCheck: 15000,   // 15 seconds
    detailedCheck: 30000,    // 30 seconds
    trafficVerification: 60000 // 60 seconds
  },
  retries: {
    maxRetries: 5,
    retryDelay: 2000,        // 2 seconds
    backoffMultiplier: 1.5
  },
  thresholds: {
    responseTime: 2000,      // 2 seconds
    successRate: 95,         // 95%
    errorRate: 5,            // 5%
    availabilityRate: 99     // 99%
  }
};

// Health check results
class HealthCheckResults {
  constructor() {
    this.checks = [];
    this.startTime = Date.now();
    this.environment = null;
    this.deployment = null;
  }

  addCheck(name, status, details = {}) {
    this.checks.push({
      name,
      status,
      timestamp: new Date().toISOString(),
      duration: details.duration || 0,
      details
    });
  }

  getOverallStatus() {
    const failed = this.checks.filter(check => check.status === 'failed');
    const degraded = this.checks.filter(check => check.status === 'degraded');
    
    if (failed.length > 0) return 'failed';
    if (degraded.length > 0) return 'degraded';
    return 'healthy';
  }

  getSummary() {
    const totalDuration = Date.now() - this.startTime;
    const totalChecks = this.checks.length;
    const healthyChecks = this.checks.filter(check => check.status === 'healthy').length;
    const degradedChecks = this.checks.filter(check => check.status === 'degraded').length;
    const failedChecks = this.checks.filter(check => check.status === 'failed').length;

    return {
      environment: this.environment,
      deployment: this.deployment,
      overallStatus: this.getOverallStatus(),
      totalDuration,
      totalChecks,
      healthyChecks,
      degradedChecks,
      failedChecks,
      successRate: (healthyChecks / totalChecks) * 100,
      checks: this.checks
    };
  }
}

// HTTP client with retry logic
class HttpClient {
  constructor() {
    this.client = axios.create({
      timeout: CONFIG.timeouts.healthCheck,
      headers: {
        'User-Agent': 'Deployment-Health-Check/1.0',
        'Authorization': `Bearer ${process.env.HEALTH_CHECK_TOKEN || ''}`
      }
    });
  }

  async get(url, options = {}) {
    const maxRetries = options.maxRetries || CONFIG.retries.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = performance.now();
        const response = await this.client.get(url, {
          timeout: options.timeout || CONFIG.timeouts.healthCheck
        });
        const endTime = performance.now();
        
        return {
          ...response,
          responseTime: endTime - startTime,
          attempt
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = CONFIG.retries.retryDelay * Math.pow(CONFIG.retries.backoffMultiplier, attempt - 1);
          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Health check service
class DeploymentHealthChecker {
  constructor(environment, deployment = 'main') {
    this.environment = environment;
    this.deployment = deployment;
    this.config = CONFIG.environments[environment];
    this.httpClient = new HttpClient();
    this.results = new HealthCheckResults();
    this.results.environment = environment;
    this.results.deployment = deployment;

    if (!this.config) {
      throw new Error(`Unknown environment: ${environment}`);
    }
  }

  // Basic health check
  async checkBasicHealth() {
    console.log('🔍 Running basic health check...');
    
    try {
      const url = `${this.config.baseUrl}${this.config.healthEndpoint}`;
      const response = await this.httpClient.get(url);
      
      const isHealthy = response.status === 200 && response.data.status === 'healthy';
      const status = isHealthy ? 'healthy' : 'degraded';
      
      this.results.addCheck('basic_health', status, {
        duration: response.responseTime,
        statusCode: response.status,
        responseData: response.data,
        url
      });

      console.log(`✅ Basic health check: ${status} (${response.responseTime.toFixed(2)}ms)`);
      return status === 'healthy';
    } catch (error) {
      this.results.addCheck('basic_health', 'failed', {
        error: error.message,
        url: `${this.config.baseUrl}${this.config.healthEndpoint}`
      });
      
      console.log(`❌ Basic health check failed: ${error.message}`);
      return false;
    }
  }

  // Readiness check
  async checkReadiness() {
    console.log('🔍 Running readiness check...');
    
    try {
      const url = `${this.config.baseUrl}${this.config.readinessEndpoint}`;
      const response = await this.httpClient.get(url, {
        timeout: CONFIG.timeouts.readinessCheck
      });
      
      const isReady = response.status === 200 && response.data.ready === true;
      const status = isReady ? 'healthy' : 'degraded';
      
      this.results.addCheck('readiness', status, {
        duration: response.responseTime,
        statusCode: response.status,
        responseData: response.data,
        url
      });

      console.log(`✅ Readiness check: ${status} (${response.responseTime.toFixed(2)}ms)`);
      return status === 'healthy';
    } catch (error) {
      this.results.addCheck('readiness', 'failed', {
        error: error.message,
        url: `${this.config.baseUrl}${this.config.readinessEndpoint}`
      });
      
      console.log(`❌ Readiness check failed: ${error.message}`);
      return false;
    }
  }

  // Detailed health check
  async checkDetailedHealth() {
    console.log('🔍 Running detailed health check...');
    
    try {
      const url = `${this.config.baseUrl}${this.config.detailedHealthEndpoint}`;
      const response = await this.httpClient.get(url, {
        timeout: CONFIG.timeouts.detailedCheck
      });
      
      const healthData = response.data;
      const overallHealthy = healthData.status === 'healthy';
      const hasUnhealthyComponents = healthData.checks && 
        Object.values(healthData.checks).some(check => 
          typeof check === 'object' && check.status === 'unhealthy'
        );
      
      let status = 'healthy';
      if (!overallHealthy || hasUnhealthyComponents) {
        status = 'degraded';
      }
      
      this.results.addCheck('detailed_health', status, {
        duration: response.responseTime,
        statusCode: response.status,
        responseData: healthData,
        url,
        componentStatus: this.analyzeComponentHealth(healthData)
      });

      console.log(`✅ Detailed health check: ${status} (${response.responseTime.toFixed(2)}ms)`);
      
      // Log component status
      if (healthData.checks) {
        this.logComponentHealth(healthData.checks);
      }
      
      return status === 'healthy';
    } catch (error) {
      this.results.addCheck('detailed_health', 'failed', {
        error: error.message,
        url: `${this.config.baseUrl}${this.config.detailedHealthEndpoint}`
      });
      
      console.log(`❌ Detailed health check failed: ${error.message}`);
      return false;
    }
  }

  // Performance check
  async checkPerformance() {
    console.log('🔍 Running performance check...');
    
    const performanceTests = [
      { endpoint: this.config.healthEndpoint, name: 'health_performance' },
      { endpoint: '/api/health', name: 'api_performance' },
      { endpoint: '/api/status', name: 'status_performance' }
    ];

    let allPassed = true;
    const performanceResults = [];

    for (const test of performanceTests) {
      try {
        const url = `${this.config.baseUrl}${test.endpoint}`;
        const response = await this.httpClient.get(url);
        
        const responseTime = response.responseTime;
        const isPerformant = responseTime <= CONFIG.thresholds.responseTime;
        
        performanceResults.push({
          endpoint: test.endpoint,
          responseTime,
          isPerformant,
          status: response.status
        });

        if (!isPerformant) {
          allPassed = false;
        }

        console.log(`  ${test.name}: ${responseTime.toFixed(2)}ms ${isPerformant ? '✅' : '⚠️'}`);
      } catch (error) {
        performanceResults.push({
          endpoint: test.endpoint,
          error: error.message,
          isPerformant: false
        });
        allPassed = false;
        console.log(`  ${test.name}: Failed - ${error.message}`);
      }
    }

    const status = allPassed ? 'healthy' : 'degraded';
    this.results.addCheck('performance', status, {
      performanceResults,
      averageResponseTime: performanceResults
        .filter(r => r.responseTime)
        .reduce((sum, r) => sum + r.responseTime, 0) / performanceResults.length
    });

    console.log(`✅ Performance check: ${status}`);
    return allPassed;
  }

  // Traffic verification (for blue-green deployments)
  async verifyTraffic() {
    console.log('🔍 Verifying traffic routing...');
    
    const testRequests = 10;
    const successfulRequests = [];
    const failedRequests = [];

    for (let i = 0; i < testRequests; i++) {
      try {
        const url = `${this.config.baseUrl}${this.config.healthEndpoint}`;
        const response = await this.httpClient.get(url);
        
        successfulRequests.push({
          attempt: i + 1,
          responseTime: response.responseTime,
          status: response.status,
          deployment: response.headers['x-deployment'] || 'unknown'
        });
      } catch (error) {
        failedRequests.push({
          attempt: i + 1,
          error: error.message
        });
      }
      
      // Small delay between requests
      await this.httpClient.sleep(100);
    }

    const successRate = (successfulRequests.length / testRequests) * 100;
    const isHealthy = successRate >= CONFIG.thresholds.successRate;
    const status = isHealthy ? 'healthy' : 'failed';

    this.results.addCheck('traffic_verification', status, {
      testRequests,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      successRate,
      deploymentDistribution: this.analyzeDeploymentDistribution(successfulRequests)
    });

    console.log(`✅ Traffic verification: ${status} (${successRate.toFixed(1)}% success rate)`);
    return isHealthy;
  }

  // Rollback verification
  async verifyRollback() {
    console.log('🔍 Verifying rollback...');
    
    // Wait for rollback to complete
    await this.httpClient.sleep(10000);
    
    const rollbackChecks = [
      () => this.checkBasicHealth(),
      () => this.checkReadiness(),
      () => this.verifyTraffic()
    ];

    let allPassed = true;
    for (const check of rollbackChecks) {
      const result = await check();
      if (!result) {
        allPassed = false;
      }
    }

    const status = allPassed ? 'healthy' : 'failed';
    this.results.addCheck('rollback_verification', status, {
      allChecksPass: allPassed
    });

    console.log(`✅ Rollback verification: ${status}`);
    return allPassed;
  }

  // Analyze component health
  analyzeComponentHealth(healthData) {
    if (!healthData.checks) return {};

    const componentStatus = {};
    
    const analyzeComponent = (name, component) => {
      if (typeof component === 'object' && component.status) {
        componentStatus[name] = {
          status: component.status,
          message: component.message,
          responseTime: component.responseTime
        };
      } else if (typeof component === 'object') {
        // Nested components
        Object.keys(component).forEach(subName => {
          analyzeComponent(`${name}.${subName}`, component[subName]);
        });
      }
    };

    Object.keys(healthData.checks).forEach(name => {
      analyzeComponent(name, healthData.checks[name]);
    });

    return componentStatus;
  }

  // Log component health
  logComponentHealth(checks) {
    console.log('📊 Component Health Status:');
    
    const logComponent = (name, component, indent = '  ') => {
      if (typeof component === 'object' && component.status) {
        const statusIcon = component.status === 'healthy' ? '✅' : 
                          component.status === 'degraded' ? '⚠️' : '❌';
        const responseTime = component.responseTime ? 
          ` (${component.responseTime.toFixed(2)}ms)` : '';
        console.log(`${indent}${statusIcon} ${name}: ${component.status}${responseTime}`);
      } else if (typeof component === 'object') {
        console.log(`${indent}📁 ${name}:`);
        Object.keys(component).forEach(subName => {
          logComponent(subName, component[subName], indent + '  ');
        });
      }
    };

    Object.keys(checks).forEach(name => {
      logComponent(name, checks[name]);
    });
  }

  // Analyze deployment distribution
  analyzeDeploymentDistribution(requests) {
    const distribution = {};
    requests.forEach(req => {
      const deployment = req.deployment || 'unknown';
      distribution[deployment] = (distribution[deployment] || 0) + 1;
    });
    return distribution;
  }

  // Run comprehensive health check
  async runComprehensiveCheck(options = {}) {
    console.log(`🚀 Starting comprehensive health check for ${this.environment} environment`);
    console.log(`📍 Base URL: ${this.config.baseUrl}`);
    console.log(`🏷️  Deployment: ${this.deployment}`);
    console.log('=' .repeat(60));

    const checks = [
      { name: 'Basic Health', fn: () => this.checkBasicHealth() },
      { name: 'Readiness', fn: () => this.checkReadiness() },
      { name: 'Detailed Health', fn: () => this.checkDetailedHealth() },
      { name: 'Performance', fn: () => this.checkPerformance() }
    ];

    if (options.includeTrafficVerification) {
      checks.push({ name: 'Traffic Verification', fn: () => this.verifyTraffic() });
    }

    let overallSuccess = true;
    for (const check of checks) {
      console.log(`\n🔍 ${check.name}...`);
      const result = await check.fn();
      if (!result) {
        overallSuccess = false;
      }
    }

    const summary = this.results.getSummary();
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 HEALTH CHECK SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Environment: ${summary.environment}`);
    console.log(`Deployment: ${summary.deployment}`);
    console.log(`Overall Status: ${summary.overallStatus.toUpperCase()}`);
    console.log(`Total Duration: ${summary.totalDuration}ms`);
    console.log(`Success Rate: ${summary.successRate.toFixed(1)}%`);
    console.log(`Checks: ${summary.healthyChecks}✅ ${summary.degradedChecks}⚠️ ${summary.failedChecks}❌`);

    return {
      success: overallSuccess,
      summary
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.substring(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (value !== true) i++; // Skip next argument if it was used as value
    }
  }

  const environment = options.environment || 'staging';
  const deployment = options.deployment || 'main';
  const timeout = parseInt(options.timeout) || 300; // 5 minutes default

  try {
    console.log('🏥 Deployment Health Check Tool');
    console.log('================================\n');

    const checker = new DeploymentHealthChecker(environment, deployment);
    
    // Set timeout for entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timed out after ${timeout} seconds`)), timeout * 1000);
    });

    let result;
    
    if (options['pre-deployment']) {
      console.log('🔍 Running pre-deployment health check...');
      result = await Promise.race([
        checker.runComprehensiveCheck(),
        timeoutPromise
      ]);
    } else if (options['verify-traffic']) {
      console.log('🔍 Verifying traffic routing...');
      const trafficResult = await Promise.race([
        checker.verifyTraffic(),
        timeoutPromise
      ]);
      result = { success: trafficResult, summary: checker.results.getSummary() };
    } else if (options['verify-rollback']) {
      console.log('🔍 Verifying rollback...');
      const rollbackResult = await Promise.race([
        checker.verifyRollback(),
        timeoutPromise
      ]);
      result = { success: rollbackResult, summary: checker.results.getSummary() };
    } else {
      // Default comprehensive check
      result = await Promise.race([
        checker.runComprehensiveCheck({ includeTrafficVerification: true }),
        timeoutPromise
      ]);
    }

    // Output results
    if (result.success) {
      console.log('\n🎉 All health checks passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Health checks failed!');
      console.log('\n📋 Failed Checks:');
      result.summary.checks
        .filter(check => check.status === 'failed')
        .forEach(check => {
          console.log(`  ❌ ${check.name}: ${check.details.error || 'Unknown error'}`);
        });
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Health check failed with error:', error.message);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if the application is running');
    console.log('   2. Verify network connectivity');
    console.log('   3. Confirm environment variables are set');
    console.log('   4. Check application logs for errors');
    
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
  DeploymentHealthChecker,
  HttpClient,
  HealthCheckResults,
  CONFIG
};

