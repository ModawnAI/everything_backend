/**
 * Security Monitoring Service
 * 
 * Comprehensive security monitoring system for payment transactions including:
 * - Real-time security alert generation and management
 * - Security metrics and analytics
 * - Compliance reporting and audit trails
 * - Security dashboard data aggregation
 * - Automated security response actions
 */

import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import {
  SecurityAlert,
  SecurityAlertType,
  SecurityAlertSeverity,
  SecurityMonitoringConfig,
  SecurityMetrics,
  ComplianceReport,
  AuditLog,
  GeolocationData,
  FraudRiskLevel
} from '../types/payment-security.types';

export class SecurityMonitoringService {
  private supabase = getSupabaseClient();
  private readonly defaultConfig: SecurityMonitoringConfig = {
    id: 'default',
    name: 'Default Security Monitoring',
    description: 'Default security monitoring configuration',
    isEnabled: true,
    alertThreshold: 50, // Risk score threshold for alerts
    autoBlockThreshold: 80, // Risk score threshold for auto-blocking
    monitoringInterval: 5, // 5 minutes
    retentionDays: 90, // 90 days
    notificationChannels: ['email', 'slack'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  /**
   * Generate security alert
   */
  async generateSecurityAlert(alert: Omit<SecurityAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecurityAlert> {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const securityAlert: SecurityAlert = {
        id: alertId,
        ...alert,
        createdAt: now,
        updatedAt: now
      };

      // Insert alert into database
      const { error } = await this.supabase
        .from('security_alerts')
        .insert({
          id: securityAlert.id,
          type: securityAlert.type,
          severity: securityAlert.severity,
          title: securityAlert.title,
          message: securityAlert.message,
          user_id: securityAlert.userId,
          payment_id: securityAlert.paymentId,
          reservation_id: securityAlert.reservationId,
          ip_address: securityAlert.ipAddress,
          user_agent: securityAlert.userAgent,
          geolocation: securityAlert.geolocation,
          metadata: securityAlert.metadata,
          is_resolved: securityAlert.isResolved,
          resolved_at: securityAlert.resolvedAt,
          resolved_by: securityAlert.resolvedBy,
          created_at: securityAlert.createdAt,
          updated_at: securityAlert.updatedAt
        });

      if (error) {
        logger.error('Error creating security alert', { error, alertId });
        throw new Error(`Failed to create security alert: ${error.message}`);
      }

      // Send notifications if configured
      await this.sendSecurityNotifications(securityAlert);

      // Log audit trail
      await this.logAuditTrail({
        action: 'security_alert_created',
        resourceType: 'security_alert',
        resourceId: alertId,
        ...(alert.userId && { userId: alert.userId }),
        metadata: { alertType: alert.type, severity: alert.severity }
      });

      logger.info('Security alert generated', {
        alertId,
        type: alert.type,
        severity: alert.severity,
        userId: alert.userId,
        paymentId: alert.paymentId
      });

      return securityAlert;

    } catch (error) {
      logger.error('Error generating security alert', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        alert 
      });
      throw error;
    }
  }

  /**
   * Get security metrics for dashboard
   */
  async getSecurityMetrics(timeRange: { start: string; end: string }): Promise<SecurityMetrics> {
    try {
      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);

      // Get total payments in time range
      const { count: totalPayments, error: paymentsError } = await this.supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (paymentsError) {
        logger.error('Error getting total payments', { error: paymentsError });
      }

      // Get total fraud detected
      const { count: totalFraudDetected, error: fraudError } = await this.supabase
        .from('payment_security_events')
        .select('*', { count: 'exact', head: true })
        .eq('fraud_detected', true)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (fraudError) {
        logger.error('Error getting fraud detected count', { error: fraudError });
      }

      // Get total security alerts
      const { count: totalSecurityAlerts, error: alertsError } = await this.supabase
        .from('security_alerts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (alertsError) {
        logger.error('Error getting security alerts count', { error: alertsError });
      }

      // Get average risk score
      const { data: riskScores, error: riskError } = await this.supabase
        .from('payment_security_events')
        .select('risk_score')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (riskError) {
        logger.error('Error getting risk scores', { error: riskError });
      }

      const averageRiskScore = riskScores && riskScores.length > 0
        ? riskScores.reduce((sum, event) => sum + event.risk_score, 0) / riskScores.length
        : 0;

      // Calculate fraud rate
      const fraudRate = totalPayments && totalPayments > 0
        ? (totalFraudDetected || 0) / totalPayments * 100
        : 0;

      // Get top risk factors
      const topRiskFactors = await this.getTopRiskFactors(startDate, endDate);

      // Get top blocked countries
      const topBlockedCountries = await this.getTopBlockedCountries(startDate, endDate);

      // Get top suspicious IPs
      const topSuspiciousIPs = await this.getTopSuspiciousIPs(startDate, endDate);

      return {
        totalPayments: totalPayments || 0,
        totalFraudDetected: totalFraudDetected || 0,
        totalSecurityAlerts: totalSecurityAlerts || 0,
        averageRiskScore: Math.round(averageRiskScore * 100) / 100,
        fraudRate: Math.round(fraudRate * 100) / 100,
        topRiskFactors,
        topBlockedCountries,
        topSuspiciousIPs,
        timeRange
      };

    } catch (error) {
      logger.error('Error getting security metrics', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timeRange 
      });

      // Return default metrics on error
      return {
        totalPayments: 0,
        totalFraudDetected: 0,
        totalSecurityAlerts: 0,
        averageRiskScore: 0,
        fraudRate: 0,
        topRiskFactors: [],
        topBlockedCountries: [],
        topSuspiciousIPs: [],
        timeRange
      };
    }
  }

  /**
   * Get top risk factors
   */
  private async getTopRiskFactors(startDate: Date, endDate: Date): Promise<Array<{
    factor: string;
    count: number;
    percentage: number;
  }>> {
    try {
      const { data: events, error } = await this.supabase
        .from('payment_security_events')
        .select('security_alerts')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('security_alerts', 'is', null);

      if (error || !events) {
        return [];
      }

      const factorCounts: Record<string, number> = {};
      let totalAlerts = 0;

      events.forEach(event => {
        if (event.security_alerts && Array.isArray(event.security_alerts)) {
          event.security_alerts.forEach((alert: any) => {
            const factor = alert.type || 'unknown';
            factorCounts[factor] = (factorCounts[factor] || 0) + 1;
            totalAlerts++;
          });
        }
      });

      const factors = Object.entries(factorCounts)
        .map(([factor, count]) => ({
          factor,
          count,
          percentage: totalAlerts > 0 ? Math.round((count / totalAlerts) * 100 * 100) / 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return factors;

    } catch (error) {
      logger.error('Error getting top risk factors', { error });
      return [];
    }
  }

  /**
   * Get top blocked countries
   */
  private async getTopBlockedCountries(startDate: Date, endDate: Date): Promise<Array<{
    country: string;
    count: number;
    percentage: number;
  }>> {
    try {
      const { data: alerts, error } = await this.supabase
        .from('security_alerts')
        .select('geolocation')
        .eq('type', 'geolocation_violation')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('geolocation', 'is', null);

      if (error || !alerts) {
        return [];
      }

      const countryCounts: Record<string, number> = {};
      let totalViolations = 0;

      alerts.forEach(alert => {
        if (alert.geolocation && alert.geolocation.country) {
          const country = alert.geolocation.country;
          countryCounts[country] = (countryCounts[country] || 0) + 1;
          totalViolations++;
        }
      });

      const countries = Object.entries(countryCounts)
        .map(([country, count]) => ({
          country,
          count,
          percentage: totalViolations > 0 ? Math.round((count / totalViolations) * 100 * 100) / 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return countries;

    } catch (error) {
      logger.error('Error getting top blocked countries', { error });
      return [];
    }
  }

  /**
   * Get top suspicious IPs
   */
  private async getTopSuspiciousIPs(startDate: Date, endDate: Date): Promise<Array<{
    ipAddress: string;
    count: number;
    riskScore: number;
  }>> {
    try {
      const { data: events, error } = await this.supabase
        .from('payment_security_events')
        .select('ip_address, risk_score')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .gte('risk_score', 70) // Only high-risk events
        .not('ip_address', 'is', null);

      if (error || !events) {
        return [];
      }

      const ipCounts: Record<string, { count: number; totalRiskScore: number }> = {};

      events.forEach(event => {
        if (event.ip_address && event.risk_score !== undefined) {
          const ipAddress = event.ip_address;
          const riskScore = event.risk_score;
          if (!ipCounts[ipAddress]) {
            ipCounts[ipAddress] = { count: 0, totalRiskScore: 0 };
          }
          ipCounts[ipAddress].count++;
          ipCounts[ipAddress].totalRiskScore += riskScore;
        }
      });

      const ips = Object.entries(ipCounts)
        .map(([ipAddress, data]) => ({
          ipAddress,
          count: data.count,
          riskScore: Math.round(data.totalRiskScore / data.count * 100) / 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return ips;

    } catch (error) {
      logger.error('Error getting top suspicious IPs', { error });
      return [];
    }
  }

  /**
   * Resolve security alert
   */
  async resolveSecurityAlert(alertId: string, resolvedBy: string, resolutionNotes?: string): Promise<void> {
    try {
      const now = new Date().toISOString();

      const { error } = await this.supabase
        .from('security_alerts')
        .update({
          is_resolved: true,
          resolved_at: now,
          resolved_by: resolvedBy,
          updated_at: now
        })
        .eq('id', alertId);

      if (error) {
        logger.error('Error resolving security alert', { error, alertId });
        throw new Error(`Failed to resolve security alert: ${error.message}`);
      }

      // Log audit trail
      await this.logAuditTrail({
        action: 'security_alert_resolved',
        resourceType: 'security_alert',
        resourceId: alertId,
        adminId: resolvedBy,
        metadata: { resolutionNotes }
      });

      logger.info('Security alert resolved', { alertId, resolvedBy });

    } catch (error) {
      logger.error('Error resolving security alert', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId,
        resolvedBy 
      });
      throw error;
    }
  }

  /**
   * Get unresolved security alerts
   */
  async getUnresolvedAlerts(limit: number = 50): Promise<SecurityAlert[]> {
    try {
      const { data: alerts, error } = await this.supabase
        .from('security_alerts')
        .select('*')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error getting unresolved alerts', { error });
        return [];
      }

      return alerts?.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        userId: alert.user_id,
        paymentId: alert.payment_id,
        reservationId: alert.reservation_id,
        ipAddress: alert.ip_address,
        userAgent: alert.user_agent,
        geolocation: alert.geolocation,
        metadata: alert.metadata,
        isResolved: alert.is_resolved,
        resolvedAt: alert.resolved_at,
        resolvedBy: alert.resolved_by,
        createdAt: alert.created_at,
        updatedAt: alert.updated_at
      })) || [];

    } catch (error) {
      logger.error('Error getting unresolved alerts', { error });
      return [];
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    reportType: 'fraud_summary' | 'security_audit' | 'compliance_check' | 'risk_assessment',
    timeRange: { start: string; end: string },
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);

      // Get security metrics for the time range
      const metrics = await this.getSecurityMetrics(timeRange);

      // Calculate compliance score based on various factors
      const complianceScore = this.calculateComplianceScore(metrics);

      // Generate recommendations
      const recommendations = this.generateComplianceRecommendations(metrics, complianceScore);

      // Create report
      const report: ComplianceReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        reportType,
        timeRange,
        summary: {
          totalTransactions: metrics.totalPayments,
          totalFraudDetected: metrics.totalFraudDetected,
          totalSecurityAlerts: metrics.totalSecurityAlerts,
          averageRiskScore: metrics.averageRiskScore,
          complianceScore
        },
        details: {
          metrics,
          riskFactors: metrics.topRiskFactors,
          blockedCountries: metrics.topBlockedCountries,
          suspiciousIPs: metrics.topSuspiciousIPs
        },
        recommendations,
        generatedBy,
        createdAt: new Date().toISOString()
      };

      // Store report in database
      const { error } = await this.supabase
        .from('compliance_reports')
        .insert({
          id: report.id,
          report_type: report.reportType,
          time_range: report.timeRange,
          summary: report.summary,
          details: report.details,
          recommendations: report.recommendations,
          generated_by: report.generatedBy,
          created_at: report.createdAt
        });

      if (error) {
        logger.error('Error storing compliance report', { error });
      }

      // Log audit trail
      await this.logAuditTrail({
        action: 'compliance_report_generated',
        resourceType: 'compliance_report',
        resourceId: report.id,
        adminId: generatedBy,
        metadata: { reportType, timeRange }
      });

      logger.info('Compliance report generated', {
        reportId: report.id,
        reportType,
        generatedBy,
        complianceScore
      });

      return report;

    } catch (error) {
      logger.error('Error generating compliance report', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        reportType,
        timeRange 
      });
      throw error;
    }
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(metrics: SecurityMetrics): number {
    let score = 100;

    // Deduct points for high fraud rate
    if (metrics.fraudRate > 5) {
      score -= 30;
    } else if (metrics.fraudRate > 2) {
      score -= 15;
    } else if (metrics.fraudRate > 1) {
      score -= 5;
    }

    // Deduct points for high average risk score
    if (metrics.averageRiskScore > 70) {
      score -= 25;
    } else if (metrics.averageRiskScore > 50) {
      score -= 15;
    } else if (metrics.averageRiskScore > 30) {
      score -= 5;
    }

    // Deduct points for high number of security alerts
    if (metrics.totalSecurityAlerts > 100) {
      score -= 20;
    } else if (metrics.totalSecurityAlerts > 50) {
      score -= 10;
    } else if (metrics.totalSecurityAlerts > 20) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(metrics: SecurityMetrics, complianceScore: number): string[] {
    const recommendations: string[] = [];

    if (complianceScore < 70) {
      recommendations.push('Immediate security review required');
      recommendations.push('Consider implementing additional fraud detection measures');
    }

    if (metrics.fraudRate > 2) {
      recommendations.push('Fraud rate is above acceptable threshold - review detection rules');
      recommendations.push('Consider implementing stricter payment verification');
    }

    if (metrics.averageRiskScore > 50) {
      recommendations.push('Average risk score is high - review risk assessment criteria');
      recommendations.push('Consider implementing additional security measures');
    }

    if (metrics.totalSecurityAlerts > 50) {
      recommendations.push('High number of security alerts - review alert thresholds');
      recommendations.push('Consider implementing automated response actions');
    }

    if (metrics.topBlockedCountries.length > 0) {
      recommendations.push('Review blocked countries list and update as needed');
    }

    if (metrics.topSuspiciousIPs.length > 0) {
      recommendations.push('Monitor suspicious IP addresses and consider blacklisting');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture is good - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Send security notifications
   */
  private async sendSecurityNotifications(alert: SecurityAlert): Promise<void> {
    try {
      const config = await this.getSecurityMonitoringConfig();

      if (!config.isEnabled) {
        return;
      }

      // Check if alert severity meets threshold
      const severityScore = this.getSeverityScore(alert.severity);
      if (severityScore < this.getSeverityScore('warning')) {
        return;
      }

      // Send notifications through configured channels
      for (const channel of config.notificationChannels) {
        try {
          await this.sendNotification(channel, alert);
        } catch (error) {
          logger.error('Error sending notification', { channel, error, alertId: alert.id });
        }
      }

    } catch (error) {
      logger.error('Error in sendSecurityNotifications', { error });
    }
  }

  /**
   * Send notification through specific channel
   */
  private async sendNotification(channel: string, alert: SecurityAlert): Promise<void> {
    // This would integrate with actual notification services
    // For now, just log the notification
    logger.info('Security notification sent', {
      channel,
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title
    });
  }

  /**
   * Get severity score
   */
  private getSeverityScore(severity: SecurityAlertSeverity): number {
    switch (severity) {
      case 'critical': return 4;
      case 'error': return 3;
      case 'warning': return 2;
      case 'info': return 1;
      default: return 0;
    }
  }

  /**
   * Get security monitoring configuration
   */
  private async getSecurityMonitoringConfig(): Promise<SecurityMonitoringConfig> {
    try {
      const { data: config, error } = await this.supabase
        .from('security_monitoring_configs')
        .select('*')
        .eq('is_enabled', true)
        .single();

      if (error || !config) {
        return this.defaultConfig;
      }

      return {
        id: config.id,
        name: config.name,
        description: config.description,
        isEnabled: config.is_enabled,
        alertThreshold: config.alert_threshold,
        autoBlockThreshold: config.auto_block_threshold,
        monitoringInterval: config.monitoring_interval,
        retentionDays: config.retention_days,
        notificationChannels: config.notification_channels,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      };

    } catch (error) {
      logger.error('Error getting security monitoring config', { error });
      return this.defaultConfig;
    }
  }

  /**
   * Log audit trail
   */
  private async logAuditTrail(auditLog: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert({
          action: auditLog.action,
          resource_type: auditLog.resourceType,
          resource_id: auditLog.resourceId,
          user_id: auditLog.userId,
          admin_id: auditLog.adminId,
          old_values: auditLog.oldValues,
          new_values: auditLog.newValues,
          ip_address: auditLog.ipAddress,
          user_agent: auditLog.userAgent,
          metadata: auditLog.metadata,
          timestamp: new Date().toISOString()
        });

      if (error) {
        logger.error('Error logging audit trail', { error });
      }

    } catch (error) {
      logger.error('Error in logAuditTrail', { error });
    }
  }
}

export const securityMonitoringService = new SecurityMonitoringService(); 