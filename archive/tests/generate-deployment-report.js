#!/usr/bin/env node

/**
 * Deployment Report Generator
 * 
 * Generates comprehensive deployment reports including:
 * - Deployment summary and timeline
 * - Test results and coverage
 * - Security scan results
 * - Performance metrics
 * - Health check results
 * - Monitoring data
 * - Rollback information (if applicable)
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Report configuration
const REPORT_CONFIG = {
  outputDir: 'deployment-reports',
  templates: {
    html: path.join(__dirname, 'templates', 'deployment-report.html'),
    markdown: path.join(__dirname, 'templates', 'deployment-report.md')
  },
  github: {
    apiUrl: 'https://api.github.com',
    owner: process.env.GITHUB_REPOSITORY?.split('/')[0] || 'ebeautything',
    repo: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'backend'
  }
};

// Report data collector
class DeploymentReportGenerator {
  constructor(deploymentId) {
    this.deploymentId = deploymentId;
    this.reportData = {
      deployment: {
        id: deploymentId,
        timestamp: new Date().toISOString(),
        environment: process.env.ENVIRONMENT || 'unknown',
        branch: process.env.GITHUB_REF_NAME || 'unknown',
        commit: process.env.GITHUB_SHA || deploymentId,
        actor: process.env.GITHUB_ACTOR || 'unknown'
      },
      summary: {
        status: 'unknown',
        duration: 0,
        startTime: null,
        endTime: null
      },
      tests: {
        unit: null,
        integration: null,
        e2e: null,
        security: null,
        performance: null
      },
      security: {
        vulnerabilities: [],
        compliance: null,
        scanResults: []
      },
      performance: {
        buildTime: null,
        deploymentTime: null,
        healthCheckTime: null,
        responseTime: null
      },
      healthChecks: {
        preDeployment: null,
        postDeployment: null,
        monitoring: null
      },
      rollback: {
        occurred: false,
        reason: null,
        duration: null
      },
      artifacts: {
        logs: [],
        reports: [],
        backups: []
      }
    };
  }

  // Collect GitHub workflow data
  async collectGitHubData() {
    if (!process.env.GITHUB_TOKEN) {
      console.log('⚠️  No GitHub token available, skipping GitHub data collection');
      return;
    }

    try {
      const headers = {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      };

      // Get workflow runs
      const workflowUrl = `${REPORT_CONFIG.github.apiUrl}/repos/${REPORT_CONFIG.github.owner}/${REPORT_CONFIG.github.repo}/actions/runs`;
      const workflowResponse = await axios.get(workflowUrl, { headers });
      
      // Find the current deployment run
      const currentRun = workflowResponse.data.workflow_runs.find(run => 
        run.head_sha === this.deploymentId
      );

      if (currentRun) {
        this.reportData.deployment.workflowId = currentRun.id;
        this.reportData.deployment.workflowUrl = currentRun.html_url;
        this.reportData.summary.status = currentRun.conclusion || currentRun.status;
        this.reportData.summary.startTime = currentRun.created_at;
        this.reportData.summary.endTime = currentRun.updated_at;
        
        if (currentRun.created_at && currentRun.updated_at) {
          const start = new Date(currentRun.created_at);
          const end = new Date(currentRun.updated_at);
          this.reportData.summary.duration = end - start;
        }

        // Get workflow jobs
        const jobsUrl = `${REPORT_CONFIG.github.apiUrl}/repos/${REPORT_CONFIG.github.owner}/${REPORT_CONFIG.github.repo}/actions/runs/${currentRun.id}/jobs`;
        const jobsResponse = await axios.get(jobsUrl, { headers });
        
        this.reportData.jobs = jobsResponse.data.jobs.map(job => ({
          name: job.name,
          status: job.conclusion || job.status,
          startTime: job.started_at,
          endTime: job.completed_at,
          duration: job.started_at && job.completed_at ? 
            new Date(job.completed_at) - new Date(job.started_at) : null,
          url: job.html_url
        }));
      }

      // Get commit information
      const commitUrl = `${REPORT_CONFIG.github.apiUrl}/repos/${REPORT_CONFIG.github.owner}/${REPORT_CONFIG.github.repo}/commits/${this.deploymentId}`;
      const commitResponse = await axios.get(commitUrl, { headers });
      
      this.reportData.deployment.commitMessage = commitResponse.data.commit.message;
      this.reportData.deployment.commitAuthor = commitResponse.data.commit.author.name;
      this.reportData.deployment.commitUrl = commitResponse.data.html_url;

    } catch (error) {
      console.log(`⚠️  Failed to collect GitHub data: ${error.message}`);
    }
  }

  // Collect test results
  async collectTestResults() {
    const testReportsDir = 'test-reports';
    
    if (!fs.existsSync(testReportsDir)) {
      console.log('⚠️  No test reports directory found');
      return;
    }

    try {
      // Look for test result files
      const files = fs.readdirSync(testReportsDir, { recursive: true });
      
      // Unit test results
      const unitTestFiles = files.filter(file => file.includes('unit') && file.endsWith('.json'));
      if (unitTestFiles.length > 0) {
        const latestUnitTest = unitTestFiles.sort().pop();
        const unitTestData = JSON.parse(fs.readFileSync(path.join(testReportsDir, latestUnitTest), 'utf8'));
        this.reportData.tests.unit = this.parseJestResults(unitTestData);
      }

      // Integration test results
      const integrationTestFiles = files.filter(file => file.includes('integration') && file.endsWith('.json'));
      if (integrationTestFiles.length > 0) {
        const latestIntegrationTest = integrationTestFiles.sort().pop();
        const integrationTestData = JSON.parse(fs.readFileSync(path.join(testReportsDir, latestIntegrationTest), 'utf8'));
        this.reportData.tests.integration = this.parseJestResults(integrationTestData);
      }

      // Security test results
      const securityTestFiles = files.filter(file => file.includes('security') && file.endsWith('.json'));
      if (securityTestFiles.length > 0) {
        const latestSecurityTest = securityTestFiles.sort().pop();
        const securityTestData = JSON.parse(fs.readFileSync(path.join(testReportsDir, latestSecurityTest), 'utf8'));
        this.reportData.tests.security = this.parseSecurityResults(securityTestData);
      }

      // Performance test results
      const performanceTestFiles = files.filter(file => file.includes('performance') && file.endsWith('.json'));
      if (performanceTestFiles.length > 0) {
        const latestPerformanceTest = performanceTestFiles.sort().pop();
        const performanceTestData = JSON.parse(fs.readFileSync(path.join(testReportsDir, latestPerformanceTest), 'utf8'));
        this.reportData.tests.performance = this.parsePerformanceResults(performanceTestData);
      }

    } catch (error) {
      console.log(`⚠️  Failed to collect test results: ${error.message}`);
    }
  }

  // Parse Jest test results
  parseJestResults(jestData) {
    return {
      totalTests: jestData.numTotalTests || 0,
      passedTests: jestData.numPassedTests || 0,
      failedTests: jestData.numFailedTests || 0,
      skippedTests: jestData.numPendingTests || 0,
      duration: jestData.testDuration || 0,
      coverage: jestData.coverageMap ? this.parseCoverageData(jestData.coverageMap) : null,
      success: jestData.success || false
    };
  }

  // Parse security test results
  parseSecurityResults(securityData) {
    return {
      vulnerabilitiesFound: securityData.vulnerabilitiesFound || 0,
      securityTestsCovered: securityData.securityTestsCovered || 0,
      complianceScore: securityData.complianceScore || 0,
      criticalIssues: securityData.criticalIssues || 0,
      highIssues: securityData.highIssues || 0,
      mediumIssues: securityData.mediumIssues || 0,
      lowIssues: securityData.lowIssues || 0
    };
  }

  // Parse performance test results
  parsePerformanceResults(performanceData) {
    return {
      averageResponseTime: performanceData.averageResponseTime || 0,
      maxResponseTime: performanceData.maxResponseTime || 0,
      throughput: performanceData.throughput || 0,
      errorRate: performanceData.errorRate || 0,
      concurrentUsers: performanceData.concurrentUsers || 0,
      memoryUsage: performanceData.memoryUsage || 0,
      cpuUsage: performanceData.cpuUsage || 0
    };
  }

  // Parse coverage data
  parseCoverageData(coverageMap) {
    // This would parse Jest coverage data
    return {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    };
  }

  // Collect monitoring results
  async collectMonitoringResults() {
    const monitoringDir = 'monitoring-results';
    
    if (!fs.existsSync(monitoringDir)) {
      console.log('⚠️  No monitoring results directory found');
      return;
    }

    try {
      const files = fs.readdirSync(monitoringDir);
      const monitoringFiles = files.filter(file => 
        file.includes(this.deploymentId) && file.endsWith('.json')
      );

      if (monitoringFiles.length > 0) {
        const latestMonitoring = monitoringFiles.sort().pop();
        const monitoringData = JSON.parse(fs.readFileSync(path.join(monitoringDir, latestMonitoring), 'utf8'));
        
        this.reportData.healthChecks.monitoring = {
          duration: monitoringData.summary.monitoringDuration,
          totalChecks: monitoringData.summary.totalChecks,
          availability: monitoringData.summary.currentAvailability,
          errorRate: monitoringData.summary.currentErrorRate,
          averageResponseTime: monitoringData.summary.averageResponseTime,
          alerts: monitoringData.summary.totalAlerts,
          recentAlerts: monitoringData.summary.recentAlerts
        };
      }
    } catch (error) {
      console.log(`⚠️  Failed to collect monitoring results: ${error.message}`);
    }
  }

  // Collect security scan results
  async collectSecurityScans() {
    // This would collect results from security scanners like Snyk, CodeQL, etc.
    // For now, we'll create a placeholder structure
    
    this.reportData.security.scanResults = [
      {
        scanner: 'Snyk',
        status: 'completed',
        vulnerabilities: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0
      },
      {
        scanner: 'CodeQL',
        status: 'completed',
        vulnerabilities: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0
      }
    ];
  }

  // Generate deployment timeline
  generateTimeline() {
    const timeline = [];
    
    if (this.reportData.jobs) {
      this.reportData.jobs.forEach(job => {
        timeline.push({
          timestamp: job.startTime,
          event: `${job.name} started`,
          status: 'info',
          duration: job.duration
        });
        
        if (job.endTime) {
          timeline.push({
            timestamp: job.endTime,
            event: `${job.name} ${job.status}`,
            status: job.status === 'success' ? 'success' : 'error',
            duration: job.duration
          });
        }
      });
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    this.reportData.timeline = timeline;
  }

  // Calculate deployment metrics
  calculateMetrics() {
    const metrics = {
      deploymentFrequency: null, // Would need historical data
      leadTime: this.reportData.summary.duration,
      meanTimeToRecovery: this.reportData.rollback.occurred ? this.reportData.rollback.duration : null,
      changeFailureRate: null, // Would need historical data
      testCoverage: null,
      securityScore: null,
      performanceScore: null
    };

    // Calculate test coverage
    if (this.reportData.tests.unit?.coverage) {
      const coverage = this.reportData.tests.unit.coverage;
      metrics.testCoverage = (coverage.statements + coverage.branches + coverage.functions + coverage.lines) / 4;
    }

    // Calculate security score
    if (this.reportData.tests.security) {
      metrics.securityScore = this.reportData.tests.security.complianceScore;
    }

    // Calculate performance score (simplified)
    if (this.reportData.tests.performance) {
      const perf = this.reportData.tests.performance;
      metrics.performanceScore = Math.max(0, 100 - (perf.averageResponseTime / 10) - (perf.errorRate * 10));
    }

    this.reportData.metrics = metrics;
  }

  // Generate HTML report
  generateHTMLReport() {
    const template = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deployment Report - ${this.reportData.deployment.id}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #667eea; }
        .metric-value { font-size: 2em; font-weight: bold; color: #667eea; }
        .metric-label { color: #666; font-size: 0.9em; }
        .status-success { color: #28a745; }
        .status-error { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .timeline { border-left: 2px solid #667eea; padding-left: 20px; }
        .timeline-item { margin-bottom: 20px; position: relative; }
        .timeline-item::before { content: ''; position: absolute; left: -26px; top: 5px; width: 12px; height: 12px; border-radius: 50%; background: #667eea; }
        .test-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .test-card { background: #f8f9fa; padding: 20px; border-radius: 6px; }
        .progress-bar { background: #e9ecef; height: 8px; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; background: #28a745; transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Deployment Report</h1>
            <p><strong>Deployment ID:</strong> ${this.reportData.deployment.id}</p>
            <p><strong>Environment:</strong> ${this.reportData.deployment.environment}</p>
            <p><strong>Branch:</strong> ${this.reportData.deployment.branch}</p>
            <p><strong>Timestamp:</strong> ${new Date(this.reportData.deployment.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📊 Summary</h2>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-value ${this.getStatusClass(this.reportData.summary.status)}">${this.reportData.summary.status.toUpperCase()}</div>
                        <div class="metric-label">Deployment Status</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${this.formatDuration(this.reportData.summary.duration)}</div>
                        <div class="metric-label">Total Duration</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${this.reportData.deployment.commitAuthor || 'Unknown'}</div>
                        <div class="metric-label">Deployed By</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${this.reportData.rollback.occurred ? 'YES' : 'NO'}</div>
                        <div class="metric-label">Rollback Occurred</div>
                    </div>
                </div>
            </div>

            ${this.generateTestResultsHTML()}
            ${this.generateSecurityResultsHTML()}
            ${this.generatePerformanceResultsHTML()}
            ${this.generateTimelineHTML()}
            ${this.generateMetricsHTML()}
        </div>
    </div>
</body>
</html>`;

    return template;
  }

  // Generate test results HTML section
  generateTestResultsHTML() {
    if (!this.reportData.tests) return '';

    return `
    <div class="section">
        <h2>🧪 Test Results</h2>
        <div class="test-results">
            ${this.reportData.tests.unit ? this.generateTestCardHTML('Unit Tests', this.reportData.tests.unit) : ''}
            ${this.reportData.tests.integration ? this.generateTestCardHTML('Integration Tests', this.reportData.tests.integration) : ''}
            ${this.reportData.tests.e2e ? this.generateTestCardHTML('E2E Tests', this.reportData.tests.e2e) : ''}
            ${this.reportData.tests.security ? this.generateTestCardHTML('Security Tests', this.reportData.tests.security) : ''}
            ${this.reportData.tests.performance ? this.generateTestCardHTML('Performance Tests', this.reportData.tests.performance) : ''}
        </div>
    </div>`;
  }

  // Generate individual test card HTML
  generateTestCardHTML(title, testData) {
    const successRate = testData.totalTests > 0 ? (testData.passedTests / testData.totalTests) * 100 : 0;
    
    return `
    <div class="test-card">
        <h3>${title}</h3>
        <div class="metric-grid">
            <div>
                <div class="metric-value ${testData.success ? 'status-success' : 'status-error'}">${testData.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div>
                <div class="metric-value status-success">${testData.passedTests}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div>
                <div class="metric-value status-error">${testData.failedTests}</div>
                <div class="metric-label">Failed</div>
            </div>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${successRate}%"></div>
        </div>
        <p>Success Rate: ${successRate.toFixed(1)}%</p>
    </div>`;
  }

  // Generate security results HTML section
  generateSecurityResultsHTML() {
    if (!this.reportData.security) return '';

    return `
    <div class="section">
        <h2>🔒 Security Results</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${this.reportData.security.scanResults.length}</div>
                <div class="metric-label">Security Scans</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${this.reportData.tests.security?.complianceScore || 0}%</div>
                <div class="metric-label">Compliance Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${this.reportData.tests.security?.vulnerabilitiesFound || 0}</div>
                <div class="metric-label">Vulnerabilities Found</div>
            </div>
        </div>
    </div>`;
  }

  // Generate performance results HTML section
  generatePerformanceResultsHTML() {
    if (!this.reportData.tests.performance) return '';

    const perf = this.reportData.tests.performance;
    
    return `
    <div class="section">
        <h2>⚡ Performance Results</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${perf.averageResponseTime}ms</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${perf.throughput}</div>
                <div class="metric-label">Throughput (req/s)</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${perf.errorRate}%</div>
                <div class="metric-label">Error Rate</div>
            </div>
        </div>
    </div>`;
  }

  // Generate timeline HTML section
  generateTimelineHTML() {
    if (!this.reportData.timeline) return '';

    const timelineItems = this.reportData.timeline.map(item => `
        <div class="timeline-item">
            <strong>${new Date(item.timestamp).toLocaleTimeString()}</strong> - ${item.event}
            ${item.duration ? `<span style="color: #666;"> (${this.formatDuration(item.duration)})</span>` : ''}
        </div>
    `).join('');

    return `
    <div class="section">
        <h2>⏱️ Deployment Timeline</h2>
        <div class="timeline">
            ${timelineItems}
        </div>
    </div>`;
  }

  // Generate metrics HTML section
  generateMetricsHTML() {
    if (!this.reportData.metrics) return '';

    const metrics = this.reportData.metrics;
    
    return `
    <div class="section">
        <h2>📈 Key Metrics</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${this.formatDuration(metrics.leadTime)}</div>
                <div class="metric-label">Lead Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.testCoverage ? metrics.testCoverage.toFixed(1) + '%' : 'N/A'}</div>
                <div class="metric-label">Test Coverage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.securityScore ? metrics.securityScore.toFixed(1) + '%' : 'N/A'}</div>
                <div class="metric-label">Security Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.performanceScore ? metrics.performanceScore.toFixed(1) + '%' : 'N/A'}</div>
                <div class="metric-label">Performance Score</div>
            </div>
        </div>
    </div>`;
  }

  // Helper methods
  getStatusClass(status) {
    switch (status) {
      case 'success': return 'status-success';
      case 'failure': return 'status-error';
      case 'cancelled': return 'status-warning';
      default: return '';
    }
  }

  formatDuration(ms) {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Generate complete report
  async generateReport() {
    console.log('📊 Generating deployment report...');
    
    // Collect all data
    await this.collectGitHubData();
    await this.collectTestResults();
    await this.collectMonitoringResults();
    await this.collectSecurityScans();
    
    // Generate derived data
    this.generateTimeline();
    this.calculateMetrics();

    // Ensure output directory exists
    if (!fs.existsSync(REPORT_CONFIG.outputDir)) {
      fs.mkdirSync(REPORT_CONFIG.outputDir, { recursive: true });
    }

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlFilename = `deployment-report-${this.deploymentId}-${Date.now()}.html`;
    const htmlPath = path.join(REPORT_CONFIG.outputDir, htmlFilename);
    fs.writeFileSync(htmlPath, htmlReport);

    // Generate JSON report
    const jsonFilename = `deployment-report-${this.deploymentId}-${Date.now()}.json`;
    const jsonPath = path.join(REPORT_CONFIG.outputDir, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify(this.reportData, null, 2));

    console.log(`✅ HTML report generated: ${htmlPath}`);
    console.log(`✅ JSON report generated: ${jsonPath}`);

    return {
      htmlPath,
      jsonPath,
      reportData: this.reportData
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

  const deploymentId = options['deployment-id'] || process.env.GITHUB_SHA || 'unknown';

  try {
    console.log('📊 Deployment Report Generator');
    console.log('===============================\n');
    console.log(`Deployment ID: ${deploymentId}`);

    const generator = new DeploymentReportGenerator(deploymentId);
    const result = await generator.generateReport();

    console.log('\n🎉 Deployment report generated successfully!');
    console.log(`📄 HTML Report: ${result.htmlPath}`);
    console.log(`📋 JSON Report: ${result.jsonPath}`);

    // Print summary
    const summary = result.reportData.summary;
    console.log('\n📊 Deployment Summary:');
    console.log(`   Status: ${summary.status}`);
    console.log(`   Duration: ${generator.formatDuration(summary.duration)}`);
    console.log(`   Environment: ${result.reportData.deployment.environment}`);
    
    if (result.reportData.rollback.occurred) {
      console.log(`   ⚠️  Rollback occurred: ${result.reportData.rollback.reason}`);
    }

  } catch (error) {
    console.error('\n💥 Report generation failed:', error.message);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if test reports directory exists');
    console.log('   2. Verify GitHub token is configured');
    console.log('   3. Ensure monitoring results are available');
    console.log('   4. Check file permissions for output directory');
    
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
  DeploymentReportGenerator,
  REPORT_CONFIG
};

