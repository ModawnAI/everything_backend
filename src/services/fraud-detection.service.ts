/**
 * Fraud Detection Service
 * 
 * Comprehensive fraud detection system for payment transactions including:
 * - Velocity checking for payment patterns
 * - Geolocation validation and IP reputation
 * - Device fingerprinting and behavioral analysis
 * - Real-time risk scoring and fraud detection
 * - Security alert generation and monitoring
 */

import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import {
  FraudDetectionRequest,
  FraudDetectionResponse,
  FraudDetectionRule,
  FraudDetectionResult,
  SecurityAlert,
  VelocityCheck,
  GeolocationData,
  DeviceFingerprint,
  FraudRiskLevel,
  FraudAction,
  SecurityAlertType,
  SecurityAlertSeverity
} from '../types/payment-security.types';

export class FraudDetectionService {
  private supabase = getSupabaseClient();
  private readonly defaultRules: FraudDetectionRule[] = [
    {
      id: 'velocity_payment_amount',
      name: 'Payment Amount Velocity Check',
      description: 'Detect unusual payment amount patterns within time windows',
      detectionType: 'velocity_check',
      conditions: [
        {
          field: 'amount',
          operator: 'greater_than',
          value: 1000000, // 1M KRW
          timeWindow: 60, // 1 hour
          threshold: 3
        }
      ],
      riskLevel: 'high',
      action: 'review',
      isActive: true,
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'geolocation_mismatch',
      name: 'Geolocation Mismatch Detection',
      description: 'Detect payments from unusual geographic locations',
      detectionType: 'geolocation_mismatch',
      conditions: [
        {
          field: 'country',
          operator: 'not_in',
          value: ['KR', 'US', 'JP', 'CN'], // Allowed countries
          threshold: 1
        }
      ],
      riskLevel: 'medium',
      action: 'challenge',
      isActive: true,
      priority: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'device_fingerprint_suspicious',
      name: 'Suspicious Device Fingerprint',
      description: 'Detect payments from suspicious or new devices',
      detectionType: 'device_fingerprint',
      conditions: [
        {
          field: 'device_risk_score',
          operator: 'greater_than',
          value: 70,
          threshold: 1
        }
      ],
      riskLevel: 'high',
      action: 'review',
      isActive: true,
      priority: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'payment_frequency_high',
      name: 'High Payment Frequency',
      description: 'Detect unusually high payment frequency',
      detectionType: 'velocity_check',
      conditions: [
        {
          field: 'payment_count',
          operator: 'greater_than',
          value: 5,
          timeWindow: 60, // 1 hour
          threshold: 1
        }
      ],
      riskLevel: 'medium',
      action: 'monitor',
      isActive: true,
      priority: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'amount_anomaly',
      name: 'Payment Amount Anomaly',
      description: 'Detect payment amounts that deviate significantly from user patterns',
      detectionType: 'amount_anomaly',
      conditions: [
        {
          field: 'amount_deviation',
          operator: 'greater_than',
          value: 200, // 200% deviation from average
          threshold: 1
        }
      ],
      riskLevel: 'medium',
      action: 'review',
      isActive: true,
      priority: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  /**
   * Perform comprehensive fraud detection on a payment request
   */
  async detectFraud(request: FraudDetectionRequest): Promise<FraudDetectionResponse> {
    try {
      logger.info('Starting fraud detection for payment', { paymentId: request.paymentId });

      const startTime = Date.now();
      const detectedRules: FraudDetectionResult[] = [];
      const securityAlerts: SecurityAlert[] = [];
      let totalRiskScore = 0;
      let ruleCount = 0;

      // Get active fraud detection rules
      const rules = await this.getActiveFraudRules();
      
      // Perform velocity checks
      const velocityResults = await this.performVelocityChecks(request);
      detectedRules.push(...velocityResults.detectedRules);
      securityAlerts.push(...velocityResults.alerts);
      totalRiskScore += velocityResults.riskScore;
      ruleCount += velocityResults.ruleCount;

      // Perform geolocation validation
      const geolocationResults = await this.validateGeolocation(request);
      detectedRules.push(...geolocationResults.detectedRules);
      securityAlerts.push(...geolocationResults.alerts);
      totalRiskScore += geolocationResults.riskScore;
      ruleCount += geolocationResults.ruleCount;

      // Perform device fingerprint analysis
      const deviceResults = await this.analyzeDeviceFingerprint(request);
      detectedRules.push(...deviceResults.detectedRules);
      securityAlerts.push(...deviceResults.alerts);
      totalRiskScore += deviceResults.riskScore;
      ruleCount += deviceResults.ruleCount;

      // Perform behavioral analysis
      const behavioralResults = await this.performBehavioralAnalysis(request);
      detectedRules.push(...behavioralResults.detectedRules);
      securityAlerts.push(...behavioralResults.alerts);
      totalRiskScore += behavioralResults.riskScore;
      ruleCount += behavioralResults.ruleCount;

      // Calculate final risk score (average)
      const finalRiskScore = ruleCount > 0 ? Math.min(100, totalRiskScore / ruleCount) : 0;
      
      // Determine risk level and action
      const riskLevel = this.calculateRiskLevel(finalRiskScore);
      const action = this.determineAction(riskLevel, detectedRules);

      // Generate recommendations
      const recommendations = this.generateRecommendations(detectedRules, finalRiskScore);

      // Log security event
      await this.logSecurityEvent({
        eventType: 'fraud_detected',
        paymentId: request.paymentId,
        userId: request.userId,
        amount: request.amount,
        currency: request.currency,
        paymentMethod: request.paymentMethod,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        geolocation: request.geolocation,
        deviceFingerprint: request.deviceFingerprint,
        riskScore: finalRiskScore,
        fraudDetected: action !== 'allow',
        securityAlerts,
        metadata: request.metadata,
        timestamp: new Date().toISOString()
      });

      const processingTime = Date.now() - startTime;
      logger.info('Fraud detection completed', {
        paymentId: request.paymentId,
        riskScore: finalRiskScore,
        riskLevel,
        action,
        detectedRules: detectedRules.length,
        alerts: securityAlerts.length,
        processingTime
      });

      return {
        isAllowed: action === 'allow',
        riskScore: finalRiskScore,
        riskLevel,
        action,
        detectedRules,
        securityAlerts,
        recommendations,
        metadata: {
          processingTime,
          rulesEvaluated: ruleCount,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Error in fraud detection', { 
        paymentId: request.paymentId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      // Return safe default response
      return {
        isAllowed: false,
        riskScore: 100,
        riskLevel: 'critical',
        action: 'block',
        detectedRules: [],
        securityAlerts: [{
          id: 'system_error',
          type: 'system_error',
          severity: 'critical',
          title: 'Fraud Detection System Error',
          message: 'Fraud detection system encountered an error',
          paymentId: request.paymentId,
          userId: request.userId,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
          isResolved: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        recommendations: ['Contact support immediately'],
        metadata: { error: true }
      };
    }
  }

  /**
   * Perform velocity checks for payment patterns
   */
  private async performVelocityChecks(request: FraudDetectionRequest): Promise<{
    detectedRules: FraudDetectionResult[];
    alerts: SecurityAlert[];
    riskScore: number;
    ruleCount: number;
  }> {
    const detectedRules: FraudDetectionResult[] = [];
    const alerts: SecurityAlert[] = [];
    let totalRiskScore = 0;
    let ruleCount = 0;

    try {
      // Check payment amount velocity
      const amountVelocity = await this.checkPaymentAmountVelocity(request);
      if (amountVelocity.isExceeded) {
        const rule = this.defaultRules.find(r => r.id === 'velocity_payment_amount');
        if (rule) {
          detectedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            detectionType: rule.detectionType,
            riskLevel: rule.riskLevel,
            action: rule.action,
            confidence: 85,
            triggeredAt: new Date().toISOString(),
            details: {
              currentAmount: amountVelocity.currentAmount,
              threshold: amountVelocity.threshold,
              timeWindow: amountVelocity.timeWindow
            }
          });
          totalRiskScore += 85;
          ruleCount++;

          alerts.push({
            id: `velocity_amount_${request.paymentId}`,
            type: 'suspicious_activity',
            severity: 'warning',
            title: 'High Payment Amount Velocity Detected',
            message: `Unusual payment amount pattern detected for user ${request.userId}`,
            userId: request.userId,
            paymentId: request.paymentId,
            ipAddress: request.ipAddress,
            metadata: amountVelocity,
            isResolved: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Check payment frequency velocity
      const frequencyVelocity = await this.checkPaymentFrequencyVelocity(request);
      if (frequencyVelocity.isExceeded) {
        const rule = this.defaultRules.find(r => r.id === 'payment_frequency_high');
        if (rule) {
          detectedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            detectionType: rule.detectionType,
            riskLevel: rule.riskLevel,
            action: rule.action,
            confidence: 75,
            triggeredAt: new Date().toISOString(),
            details: {
              currentCount: frequencyVelocity.currentCount,
              threshold: frequencyVelocity.threshold,
              timeWindow: frequencyVelocity.timeWindow
            }
          });
          totalRiskScore += 75;
          ruleCount++;

          alerts.push({
            id: `velocity_frequency_${request.paymentId}`,
            type: 'suspicious_activity',
            severity: 'warning',
            title: 'High Payment Frequency Detected',
            message: `Unusual payment frequency detected for user ${request.userId}`,
            userId: request.userId,
            paymentId: request.paymentId,
            ipAddress: request.ipAddress,
            metadata: frequencyVelocity,
            isResolved: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      logger.error('Error in velocity checks', { 
        paymentId: request.paymentId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return {
      detectedRules,
      alerts,
      riskScore: totalRiskScore,
      ruleCount
    };
  }

  /**
   * Validate geolocation and IP reputation
   */
  private async validateGeolocation(request: FraudDetectionRequest): Promise<{
    detectedRules: FraudDetectionResult[];
    alerts: SecurityAlert[];
    riskScore: number;
    ruleCount: number;
  }> {
    const detectedRules: FraudDetectionResult[] = [];
    const alerts: SecurityAlert[] = [];
    let totalRiskScore = 0;
    let ruleCount = 0;

    try {
      if (request.geolocation) {
        // Check for blocked countries
        const blockedCountries = ['XX', 'YY', 'ZZ']; // Example blocked countries
        if (blockedCountries.includes(request.geolocation.country)) {
          const rule = this.defaultRules.find(r => r.id === 'geolocation_mismatch');
          if (rule) {
            detectedRules.push({
              ruleId: rule.id,
              ruleName: rule.name,
              detectionType: rule.detectionType,
              riskLevel: 'high',
              action: 'block',
              confidence: 95,
              triggeredAt: new Date().toISOString(),
              details: {
                country: request.geolocation.country,
                blockedCountries
              }
            });
            totalRiskScore += 95;
            ruleCount++;

            alerts.push({
              id: `geolocation_blocked_${request.paymentId}`,
              type: 'geolocation_violation',
              severity: 'error',
              title: 'Payment from Blocked Country',
              message: `Payment attempted from blocked country: ${request.geolocation.country}`,
              userId: request.userId,
              paymentId: request.paymentId,
              ipAddress: request.ipAddress,
              geolocation: request.geolocation,
              metadata: { blockedCountries },
              isResolved: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }

        // Check for VPN/Proxy usage
        if (request.geolocation.isVpn || request.geolocation.isProxy) {
          totalRiskScore += 60;
          ruleCount++;

          alerts.push({
            id: `geolocation_vpn_${request.paymentId}`,
            type: 'suspicious_activity',
            severity: 'warning',
            title: 'VPN/Proxy Usage Detected',
            message: `Payment attempted using VPN or proxy service`,
            userId: request.userId,
            paymentId: request.paymentId,
            ipAddress: request.ipAddress,
            geolocation: request.geolocation,
            metadata: { 
              isVpn: request.geolocation.isVpn,
              isProxy: request.geolocation.isProxy 
            },
            isResolved: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      logger.error('Error in geolocation validation', { 
        paymentId: request.paymentId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return {
      detectedRules,
      alerts,
      riskScore: totalRiskScore,
      ruleCount
    };
  }

  /**
   * Analyze device fingerprint for suspicious patterns
   */
  private async analyzeDeviceFingerprint(request: FraudDetectionRequest): Promise<{
    detectedRules: FraudDetectionResult[];
    alerts: SecurityAlert[];
    riskScore: number;
    ruleCount: number;
  }> {
    const detectedRules: FraudDetectionResult[] = [];
    const alerts: SecurityAlert[] = [];
    let totalRiskScore = 0;
    let ruleCount = 0;

    try {
      if (request.deviceFingerprint) {
        // Check if device fingerprint is suspicious
        const deviceRiskScore = await this.calculateDeviceRiskScore(request.deviceFingerprint);
        
        if (deviceRiskScore > 70) {
          const rule = this.defaultRules.find(r => r.id === 'device_fingerprint_suspicious');
          if (rule) {
            detectedRules.push({
              ruleId: rule.id,
              ruleName: rule.name,
              detectionType: rule.detectionType,
              riskLevel: rule.riskLevel,
              action: rule.action,
              confidence: deviceRiskScore,
              triggeredAt: new Date().toISOString(),
              details: {
                deviceRiskScore,
                deviceFingerprint: request.deviceFingerprint
              }
            });
            totalRiskScore += deviceRiskScore;
            ruleCount++;

            alerts.push({
              id: `device_suspicious_${request.paymentId}`,
              type: 'device_mismatch',
              severity: 'warning',
              title: 'Suspicious Device Detected',
              message: `Payment attempted from suspicious device`,
              userId: request.userId,
              paymentId: request.paymentId,
              ipAddress: request.ipAddress,
              metadata: { 
                deviceRiskScore,
                deviceFingerprint: request.deviceFingerprint 
              },
              isResolved: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

    } catch (error) {
      logger.error('Error in device fingerprint analysis', { 
        paymentId: request.paymentId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return {
      detectedRules,
      alerts,
      riskScore: totalRiskScore,
      ruleCount
    };
  }

  /**
   * Perform behavioral analysis based on user patterns
   */
  private async performBehavioralAnalysis(request: FraudDetectionRequest): Promise<{
    detectedRules: FraudDetectionResult[];
    alerts: SecurityAlert[];
    riskScore: number;
    ruleCount: number;
  }> {
    const detectedRules: FraudDetectionResult[] = [];
    const alerts: SecurityAlert[] = [];
    let totalRiskScore = 0;
    let ruleCount = 0;

    try {
      // Check for amount anomalies compared to user's payment history
      const amountAnomaly = await this.checkAmountAnomaly(request);
      if (amountAnomaly.isAnomaly) {
        const rule = this.defaultRules.find(r => r.id === 'amount_anomaly');
        if (rule) {
          detectedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            detectionType: rule.detectionType,
            riskLevel: rule.riskLevel,
            action: rule.action,
            confidence: amountAnomaly.confidence,
            triggeredAt: new Date().toISOString(),
            details: {
              currentAmount: request.amount,
              averageAmount: amountAnomaly.averageAmount,
              deviation: amountAnomaly.deviation
            }
          });
          totalRiskScore += amountAnomaly.confidence;
          ruleCount++;

          alerts.push({
            id: `amount_anomaly_${request.paymentId}`,
            type: 'suspicious_activity',
            severity: 'warning',
            title: 'Payment Amount Anomaly Detected',
            message: `Payment amount significantly differs from user's usual pattern`,
            userId: request.userId,
            paymentId: request.paymentId,
            metadata: amountAnomaly,
            isResolved: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      logger.error('Error in behavioral analysis', { 
        paymentId: request.paymentId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return {
      detectedRules,
      alerts,
      riskScore: totalRiskScore,
      ruleCount
    };
  }

  /**
   * Check payment amount velocity
   */
  private async checkPaymentAmountVelocity(request: FraudDetectionRequest): Promise<{
    isExceeded: boolean;
    currentAmount: number;
    threshold: number;
    timeWindow: number;
  }> {
    try {
      const timeWindow = 60; // 1 hour
      const threshold = 1000000; // 1M KRW

      const { data: payments, error } = await this.supabase
        .from('payments')
        .select('amount')
        .eq('user_id', request.userId)
        .gte('created_at', new Date(Date.now() - timeWindow * 60 * 1000).toISOString())
        .eq('payment_status', 'fully_paid');

      if (error) {
        logger.error('Error checking payment amount velocity', { error });
        return { isExceeded: false, currentAmount: 0, threshold, timeWindow };
      }

      const currentAmount = payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      const isExceeded = currentAmount > threshold;

      return { isExceeded, currentAmount, threshold, timeWindow };

    } catch (error) {
      logger.error('Error in payment amount velocity check', { error });
      return { isExceeded: false, currentAmount: 0, threshold: 1000000, timeWindow: 60 };
    }
  }

  /**
   * Check payment frequency velocity
   */
  private async checkPaymentFrequencyVelocity(request: FraudDetectionRequest): Promise<{
    isExceeded: boolean;
    currentCount: number;
    threshold: number;
    timeWindow: number;
  }> {
    try {
      const timeWindow = 60; // 1 hour
      const threshold = 5; // 5 payments per hour

      const { count, error } = await this.supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', request.userId)
        .gte('created_at', new Date(Date.now() - timeWindow * 60 * 1000).toISOString())
        .eq('payment_status', 'fully_paid');

      if (error) {
        logger.error('Error checking payment frequency velocity', { error });
        return { isExceeded: false, currentCount: 0, threshold, timeWindow };
      }

      const currentCount = count || 0;
      const isExceeded = currentCount > threshold;

      return { isExceeded, currentCount, threshold, timeWindow };

    } catch (error) {
      logger.error('Error in payment frequency velocity check', { error });
      return { isExceeded: false, currentCount: 0, threshold: 5, timeWindow: 60 };
    }
  }

  /**
   * Calculate device risk score
   */
  private async calculateDeviceRiskScore(deviceFingerprint: string): Promise<number> {
    try {
      // Check if device fingerprint exists in database
      const { data: device, error } = await this.supabase
        .from('device_fingerprints')
        .select('*')
        .eq('fingerprint', deviceFingerprint)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        logger.error('Error calculating device risk score', { error });
        return 50; // Default medium risk
      }

      if (!device) {
        // New device - higher risk
        return 70;
      }

      // Calculate risk based on device history
      let riskScore = 0;

      // Check if device is marked as suspicious
      if (device.is_suspicious) {
        riskScore += 40;
      }

      // Check device risk score from database
      riskScore += device.risk_score || 0;

      // Check last seen time - very old devices might be suspicious
      const lastSeen = new Date(device.last_seen);
      const daysSinceLastSeen = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSeen > 30) {
        riskScore += 20;
      }

      return Math.min(100, riskScore);

    } catch (error) {
      logger.error('Error calculating device risk score', { error });
      return 50; // Default medium risk
    }
  }

  /**
   * Check for amount anomalies
   */
  private async checkAmountAnomaly(request: FraudDetectionRequest): Promise<{
    isAnomaly: boolean;
    averageAmount: number;
    deviation: number;
    confidence: number;
  }> {
    try {
      // Get user's payment history
      const { data: payments, error } = await this.supabase
        .from('payments')
        .select('amount')
        .eq('user_id', request.userId)
        .eq('payment_status', 'fully_paid')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !payments || payments.length === 0) {
        return { isAnomaly: false, averageAmount: 0, deviation: 0, confidence: 0 };
      }

      const amounts = payments.map(p => p.amount);
      const averageAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
      const deviation = ((request.amount - averageAmount) / averageAmount) * 100;

      // Consider it an anomaly if deviation is more than 200%
      const isAnomaly = Math.abs(deviation) > 200;
      const confidence = Math.min(100, Math.abs(deviation) / 2);

      return { isAnomaly, averageAmount, deviation, confidence };

    } catch (error) {
      logger.error('Error checking amount anomaly', { error });
      return { isAnomaly: false, averageAmount: 0, deviation: 0, confidence: 0 };
    }
  }

  /**
   * Get active fraud detection rules
   */
  private async getActiveFraudRules(): Promise<FraudDetectionRule[]> {
    try {
      const { data: rules, error } = await this.supabase
        .from('fraud_detection_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) {
        logger.error('Error fetching fraud detection rules', { error });
        return this.defaultRules.filter(rule => rule.isActive);
      }

      return rules || this.defaultRules.filter(rule => rule.isActive);

    } catch (error) {
      logger.error('Error getting active fraud rules', { error });
      return this.defaultRules.filter(rule => rule.isActive);
    }
  }

  /**
   * Calculate risk level based on risk score
   */
  private calculateRiskLevel(riskScore: number): FraudRiskLevel {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }

  /**
   * Determine action based on risk level and detected rules
   */
  private determineAction(riskLevel: FraudRiskLevel, detectedRules: FraudDetectionResult[]): FraudAction {
    if (riskLevel === 'critical') return 'block';
    if (riskLevel === 'high') return 'review';
    if (riskLevel === 'medium') return 'challenge';
    if (detectedRules.length > 0) return 'monitor';
    return 'allow';
  }

  /**
   * Generate recommendations based on detected rules
   */
  private generateRecommendations(detectedRules: FraudDetectionResult[], riskScore: number): string[] {
    const recommendations: string[] = [];

    if (riskScore >= 80) {
      recommendations.push('Immediate manual review required');
      recommendations.push('Consider blocking user account temporarily');
    }

    if (riskScore >= 60) {
      recommendations.push('Additional verification recommended');
      recommendations.push('Monitor user activity closely');
    }

    if (detectedRules.some(rule => rule.detectionType === 'geolocation_mismatch')) {
      recommendations.push('Verify user location and travel plans');
    }

    if (detectedRules.some(rule => rule.detectionType === 'velocity_check')) {
      recommendations.push('Review payment frequency patterns');
    }

    if (detectedRules.some(rule => rule.detectionType === 'device_fingerprint')) {
      recommendations.push('Verify device ownership and security');
    }

    if (recommendations.length === 0) {
      recommendations.push('No immediate action required');
    }

    return recommendations;
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('payment_security_events')
        .insert({
          event_type: event.eventType,
          payment_id: event.paymentId,
          user_id: event.userId,
          reservation_id: event.reservationId,
          amount: event.amount,
          currency: event.currency,
          payment_method: event.paymentMethod,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          geolocation: event.geolocation,
          device_fingerprint: event.deviceFingerprint,
          risk_score: event.riskScore,
          fraud_detected: event.fraudDetected,
          security_alerts: event.securityAlerts,
          metadata: event.metadata,
          timestamp: event.timestamp
        });

      if (error) {
        logger.error('Error logging security event', { error });
      }

    } catch (error) {
      logger.error('Error in logSecurityEvent', { error });
    }
  }
}

export const fraudDetectionService = new FraudDetectionService(); 