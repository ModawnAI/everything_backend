#!/usr/bin/env node

/**
 * Deployment Monitoring Script
 * 
 * Continuous monitoring for post-deployment validation:
 * - Real-time health monitoring
 * - Performance metrics tracking
 * - Error rate monitoring
 * - Alert generation and notification
 * - Automated rollback triggers
 * - Comprehensive reporting
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Configuration
const MONITOR_CONFIG = {
  environments: {
    staging: {
      baseUrl: process.env.STAGING_URL || 'https://staging-api.ebeautything.com',
      healthEndpoint: '/health',
      metricsEndpoint: '/metrics',
      statusEndpoint: '/api/status'
    },
    production: {
      baseUrl: process.env.PRODUCTION_URL || 'https://api.ebeautything.com',
      healthEndpoint: '/health',
      metricsEndpoint: '/metrics',
      statusEndpoint: '/api/status'
    }
  },
  monitoring: {
    checkInterval: 10000,        // 10 seconds
    alertThresholds: {
      responseTime: 3000,        // 3 seconds
      errorRate: 10,             // 10%
      availabilityRate: 95,      // 95%
      consecutiveFailures: 3     // 3 consecutive failures
    },
    alertCooldown: 300000,       // 5 minutes
    reportInterval: 60000        // 1 minute
  },
  rollback: {
    autoRollbackEnabled: false,  // Disabled by default for safety
    failureThreshold: 5,         // 5 consecutive failures
    errorRateThreshold: 25       // 25% error rate
  }
};

// Monitoring results storage
class MonitoringResults {
  constructor(environment) {
    this.environment = environment;
    this.startTime = Date.now();
    this.checks = [];
    this.metrics = [];
    this.alerts = [];
    this.consecutiveFailures = 0;
    this.lastAlertTime = 0;
  }

  addCheck(result) {
    this.checks.push({
      timestamp: Date.now(),
      ...result
    });

    // Track consecutive failures
    if (result.status === 'failed') {
      this.consecutiveFailures++;
    } else {
      this.consecutiveFailures = 0;
    }

    // Keep only last 1000 checks to prevent memory issues
    if (this.checks.length > 1000) {
      this.checks = this.checks.slice(-1000);
    }
  }

  addMetric(metric) {
    this.metrics.push({
      timestamp: Date.now(),
      ...metric
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  addAlert(alert) {
    this.alerts.push({
      timestamp: Date.now(),
      ...alert
    });
    this.lastAlertTime = Date.now();
  }

  getRecentChecks(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.checks.filter(check => check.timestamp >= cutoff);
  }

  getRecentMetrics(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  calculateAvailability(minutes = 5) {
    const recentChecks = this.getRecentChecks(minutes);
    if (recentChecks.length === 0) return 100;

    const successfulChecks = recentChecks.filter(check => check.status === 'healthy').length;
    return (successfulChecks / recentChecks.length) * 100;
  }

  calculateErrorRate(minutes = 5) {
    const recentChecks = this.getRecentChecks(minutes);
    if (recentChecks.length === 0) return 0;

    const failedChecks = recentChecks.filter(check => check.status === 'failed').length;
    return (failedChecks / recentChecks.length) * 100;
  }

  calculateAverageResponseTime(minutes = 5) {
    const recentChecks = this.getRecentChecks(minutes);
    const checksWithResponseTime = recentChecks.filter(check => check.responseTime);
    
    if (checksWithResponseTime.length === 0) return 0;

    const totalResponseTime = checksWithResponseTime.reduce((sum, check) => sum + check.responseTime, 0);
    return totalResponseTime / checksWithResponseTime.length;
  }

  getSummary() {
    const totalDuration = Date.now() - this.startTime;
    const totalChecks = this.checks.length;
    const totalAlerts = this.alerts.length;

    return {
      environment: this.environment,
      monitoringDuration: totalDuration,
      totalChecks,
      totalAlerts,
      consecutiveFailures: this.consecutiveFailures,
      currentAvailability: this.calculateAvailability(),
      currentErrorRate: this.calculateErrorRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
      recentAlerts: this.alerts.slice(-10) // Last 10 alerts
    };
  }
}

// HTTP client for monitoring
class MonitoringHttpClient {
  constructor() {
    this.client = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Deployment-Monitor/1.0',
        'Authorization': `Bearer ${process.env.MONITORING_TOKEN || ''}`
      }
    });
  }

  async get(url) {
    const startTime = performance.now();
    try {
      const response = await this.client.get(url);
      const endTime = performance.now();
      
      return {
        success: true,
        status: response.status,
        data: response.data,
        responseTime: endTime - startTime,
        headers: response.headers
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status || 0,
        responseTime: endTime - startTime
      };
    }
  }
}

// Alert manager
class AlertManager {
  constructor() {
    this.webhookUrl = process.env.ALERT_WEBHOOK || process.env.SLACK_WEBHOOK_URL;
  }

  async sendAlert(alert) {
    if (!this.webhookUrl) {
      console.log('⚠️  No webhook URL configured for alerts');
      return;
    }

    try {
      const message = this.formatAlertMessage(alert);
      
      await axios.post(this.webhookUrl, {
        text: message,
        username: 'Deployment Monitor',
        icon_emoji: this.getAlertEmoji(alert.severity)
      });

      console.log(`📢 Alert sent: ${alert.type}`);
    } catch (error) {
      console.error('Failed to send alert:', error.message);
    }
  }

  formatAlertMessage(alert) {
    const emoji = this.getAlertEmoji(alert.severity);
    const timestamp = new Date(alert.timestamp).toISOString();
    
    let message = `${emoji} *Deployment Monitor Alert*\n`;
    message += `*Environment:* ${alert.environment}\n`;
    message += `*Alert Type:* ${alert.type}\n`;
    message += `*Severity:* ${alert.severity}\n`;
    message += `*Time:* ${timestamp}\n`;
    message += `*Details:* ${alert.message}\n`;

    if (alert.metrics) {
      message += `*Metrics:*\n`;
      Object.entries(alert.metrics).forEach(([key, value]) => {
        message += `  • ${key}: ${value}\n`;
      });
    }

    if (alert.recommendedAction) {
      message += `*Recommended Action:* ${alert.recommendedAction}\n`;
    }

    return message;
  }

  getAlertEmoji(severity) {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📢';
    }
  }
}

// Main deployment monitor
class DeploymentMonitor {
  constructor(environment) {
    this.environment = environment;
    this.config = MONITOR_CONFIG.environments[environment];
    this.httpClient = new MonitoringHttpClient();
    this.results = new MonitoringResults(environment);
    this.alertManager = new AlertManager();
    this.isRunning = false;
    this.monitoringInterval = null;
    this.reportingInterval = null;

    if (!this.config) {
      throw new Error(`Unknown environment: ${environment}`);
    }
  }

  // Single health check
  async performHealthCheck() {
    const url = `${this.config.baseUrl}${this.config.healthEndpoint}`;
    const result = await this.httpClient.get(url);

    let status = 'healthy';
    if (!result.success) {
      status = 'failed';
    } else if (result.status !== 200 || result.data?.status !== 'healthy') {
      status = 'degraded';
    }

    const checkResult = {
      type: 'health_check',
      status,
      responseTime: result.responseTime,
      statusCode: result.status,
      url,
      success: result.success,
      error: result.error
    };

    this.results.addCheck(checkResult);
    return checkResult;
  }

  // Performance metrics check
  async collectMetrics() {
    const metricsUrl = `${this.config.baseUrl}${this.config.metricsEndpoint}`;
    const statusUrl = `${this.config.baseUrl}${this.config.statusEndpoint}`;

    const [metricsResult, statusResult] = await Promise.all([
      this.httpClient.get(metricsUrl),
      this.httpClient.get(statusUrl)
    ]);

    const metrics = {
      type: 'performance_metrics',
      metricsAvailable: metricsResult.success,
      statusAvailable: statusResult.success,
      metricsResponseTime: metricsResult.responseTime,
      statusResponseTime: statusResult.responseTime
    };

    if (metricsResult.success && metricsResult.data) {
      metrics.systemMetrics = metricsResult.data;
    }

    if (statusResult.success && statusResult.data) {
      metrics.applicationStatus = statusResult.data;
    }

    this.results.addMetric(metrics);
    return metrics;
  }

  // Check for alert conditions
  async checkAlertConditions() {
    const now = Date.now();
    const timeSinceLastAlert = now - this.results.lastAlertTime;
    
    // Respect alert cooldown
    if (timeSinceLastAlert < MONITOR_CONFIG.monitoring.alertCooldown) {
      return;
    }

    const availability = this.results.calculateAvailability();
    const errorRate = this.results.calculateErrorRate();
    const avgResponseTime = this.results.calculateAverageResponseTime();
    const consecutiveFailures = this.results.consecutiveFailures;

    // Critical: High error rate
    if (errorRate >= MONITOR_CONFIG.monitoring.alertThresholds.errorRate * 2) {
      await this.alertManager.sendAlert({
        environment: this.environment,
        type: 'high_error_rate',
        severity: 'critical',
        message: `Error rate is critically high: ${errorRate.toFixed(1)}%`,
        metrics: { errorRate, availability, avgResponseTime },
        recommendedAction: 'Investigate immediately and consider rollback',
        timestamp: now
      });
      this.results.addAlert({ type: 'high_error_rate', severity: 'critical' });
    }

    // High: Low availability
    else if (availability < MONITOR_CONFIG.monitoring.alertThresholds.availabilityRate) {
      await this.alertManager.sendAlert({
        environment: this.environment,
        type: 'low_availability',
        severity: 'high',
        message: `Availability is below threshold: ${availability.toFixed(1)}%`,
        metrics: { availability, errorRate, avgResponseTime },
        recommendedAction: 'Check application health and logs',
        timestamp: now
      });
      this.results.addAlert({ type: 'low_availability', severity: 'high' });
    }

    // High: Consecutive failures
    else if (consecutiveFailures >= MONITOR_CONFIG.monitoring.alertThresholds.consecutiveFailures) {
      await this.alertManager.sendAlert({
        environment: this.environment,
        type: 'consecutive_failures',
        severity: 'high',
        message: `${consecutiveFailures} consecutive health check failures`,
        metrics: { consecutiveFailures, availability, errorRate },
        recommendedAction: 'Investigate application status immediately',
        timestamp: now
      });
      this.results.addAlert({ type: 'consecutive_failures', severity: 'high' });
    }

    // Medium: High response time
    else if (avgResponseTime > MONITOR_CONFIG.monitoring.alertThresholds.responseTime) {
      await this.alertManager.sendAlert({
        environment: this.environment,
        type: 'high_response_time',
        severity: 'medium',
        message: `Average response time is high: ${avgResponseTime.toFixed(0)}ms`,
        metrics: { avgResponseTime, availability, errorRate },
        recommendedAction: 'Monitor performance and check for bottlenecks',
        timestamp: now
      });
      this.results.addAlert({ type: 'high_response_time', severity: 'medium' });
    }

    // Check for rollback conditions (if enabled)
    if (MONITOR_CONFIG.rollback.autoRollbackEnabled) {
      await this.checkRollbackConditions(errorRate, consecutiveFailures);
    }
  }

  // Check rollback conditions
  async checkRollbackConditions(errorRate, consecutiveFailures) {
    const shouldRollback = 
      errorRate >= MONITOR_CONFIG.rollback.errorRateThreshold ||
      consecutiveFailures >= MONITOR_CONFIG.rollback.failureThreshold;

    if (shouldRollback) {
      console.log('🚨 ROLLBACK CONDITIONS MET - Triggering automatic rollback');
      
      await this.alertManager.sendAlert({
        environment: this.environment,
        type: 'automatic_rollback_triggered',
        severity: 'critical',
        message: `Automatic rollback triggered due to: Error Rate: ${errorRate.toFixed(1)}%, Consecutive Failures: ${consecutiveFailures}`,
        metrics: { errorRate, consecutiveFailures },
        recommendedAction: 'Rollback in progress - monitor closely',
        timestamp: Date.now()
      });

      // Trigger rollback (this would integrate with your deployment system)
      await this.triggerRollback();
    }
  }

  // Trigger rollback (placeholder - integrate with your deployment system)
  async triggerRollback() {
    console.log('🔄 Triggering rollback...');
    
    // This would integrate with your deployment system
    // For example, calling kubectl rollout undo or similar
    
    // For now, just log the action
    console.log('⚠️  Rollback trigger - integrate with deployment system');
  }

  // Generate periodic report
  generateReport() {
    const summary = this.results.getSummary();
    const timestamp = new Date().toISOString();
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 MONITORING REPORT - ${timestamp}`);
    console.log('='.repeat(60));
    console.log(`Environment: ${summary.environment}`);
    console.log(`Monitoring Duration: ${Math.round(summary.monitoringDuration / 1000)}s`);
    console.log(`Total Checks: ${summary.totalChecks}`);
    console.log(`Availability: ${summary.currentAvailability.toFixed(1)}%`);
    console.log(`Error Rate: ${summary.currentErrorRate.toFixed(1)}%`);
    console.log(`Avg Response Time: ${summary.averageResponseTime.toFixed(0)}ms`);
    console.log(`Consecutive Failures: ${summary.consecutiveFailures}`);
    console.log(`Total Alerts: ${summary.totalAlerts}`);
    
    if (summary.recentAlerts.length > 0) {
      console.log('\n🚨 Recent Alerts:');
      summary.recentAlerts.forEach(alert => {
        const alertTime = new Date(alert.timestamp).toLocaleTimeString();
        console.log(`  ${alertTime} - ${alert.type} (${alert.severity})`);
      });
    }
    
    console.log('='.repeat(60));
  }

  // Save monitoring results to file
  saveResults() {
    const resultsDir = 'monitoring-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `monitoring-${this.environment}-${Date.now()}.json`;
    const filepath = path.join(resultsDir, filename);
    
    const data = {
      summary: this.results.getSummary(),
      checks: this.results.checks,
      metrics: this.results.metrics,
      alerts: this.results.alerts
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`💾 Monitoring results saved to: ${filepath}`);
  }

  // Start monitoring
  async startMonitoring(duration) {
    console.log(`🔍 Starting deployment monitoring for ${this.environment}`);
    console.log(`📍 Base URL: ${this.config.baseUrl}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🔄 Check Interval: ${MONITOR_CONFIG.monitoring.checkInterval}ms`);
    console.log('='.repeat(60));

    this.isRunning = true;

    // Set up monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
        await this.collectMetrics();
        await this.checkAlertConditions();
      } catch (error) {
        console.error('Error during monitoring check:', error.message);
      }
    }, MONITOR_CONFIG.monitoring.checkInterval);

    // Set up reporting interval
    this.reportingInterval = setInterval(() => {
      this.generateReport();
    }, MONITOR_CONFIG.monitoring.reportInterval);

    // Stop monitoring after specified duration
    setTimeout(() => {
      this.stopMonitoring();
    }, duration * 1000);

    // Initial check
    await this.performHealthCheck();
    await this.collectMetrics();
  }

  // Stop monitoring
  stopMonitoring() {
    console.log('\n🛑 Stopping deployment monitoring...');
    
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }

    // Generate final report
    this.generateReport();
    this.saveResults();

    const summary = this.results.getSummary();
    
    console.log('\n🎯 FINAL MONITORING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Overall Status: ${summary.currentAvailability >= 95 ? '✅ HEALTHY' : '⚠️ DEGRADED'}`);
    console.log(`Final Availability: ${summary.currentAvailability.toFixed(1)}%`);
    console.log(`Final Error Rate: ${summary.currentErrorRate.toFixed(1)}%`);
    console.log(`Total Alerts Generated: ${summary.totalAlerts}`);
    
    if (summary.totalAlerts === 0) {
      console.log('🎉 No alerts generated - deployment appears stable!');
    } else {
      console.log('⚠️  Alerts were generated - review monitoring results');
    }
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

  const environment = options.environment || 'production';
  const duration = parseInt(options.duration) || 300; // 5 minutes default
  const extended = options.extended === 'true' || options.extended === true;

  try {
    console.log('📊 Deployment Monitoring Tool');
    console.log('==============================\n');

    const monitor = new DeploymentMonitor(environment);
    
    // Adjust monitoring for extended mode
    if (extended) {
      MONITOR_CONFIG.monitoring.checkInterval = 5000; // 5 seconds
      MONITOR_CONFIG.monitoring.reportInterval = 30000; // 30 seconds
      console.log('🔍 Extended monitoring mode enabled');
    }

    await monitor.startMonitoring(duration);

  } catch (error) {
    console.error('\n💥 Monitoring failed with error:', error.message);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if the application is accessible');
    console.log('   2. Verify monitoring token is configured');
    console.log('   3. Confirm webhook URLs for alerts');
    console.log('   4. Check network connectivity');
    
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
  DeploymentMonitor,
  MonitoringResults,
  AlertManager,
  MONITOR_CONFIG
};

