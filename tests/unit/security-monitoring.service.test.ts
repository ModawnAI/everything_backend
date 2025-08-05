/**
 * Security Monitoring Service Unit Tests
 * 
 * Comprehensive test suite for security monitoring functionality including:
 * - Real-time security alert generation and management
 * - Security metrics and analytics
 * - Compliance reporting and audit trails
 * - Security dashboard data aggregation
 * - Automated security response actions
 */

import { SecurityMonitoringService } from '../../src/services/security-monitoring.service';
import { getSupabaseClient } from '../../src/config/database';
import {
  SecurityAlert,
  SecurityAlertType,
  SecurityAlertSeverity,
  SecurityMetrics,
  ComplianceReport,
  AuditLog
} from '../../src/types/payment-security.types';

// Mock Supabase client
jest.mock('../../src/config/database');
const mockSupabase = getSupabaseClient() as jest.Mocked<any>;

describe('SecurityMonitoringService', () => {
  let securityMonitoringService: SecurityMonitoringService;

  beforeEach(() => {
    securityMonitoringService = new SecurityMonitoringService();
    jest.clearAllMocks();
  });

  describe('generateSecurityAlert', () => {
    const mockAlert = {
      type: 'fraud_detected' as SecurityAlertType,
      severity: 'error' as SecurityAlertSeverity,
      title: 'Suspicious Payment Detected',
      message: 'High-risk payment detected from suspicious location',
      userId: 'test-user-123',
      paymentId: 'test-payment-456',
      reservationId: 'test-reservation-789',
      ipAddress: '192.168.1.1',
      userAgent: 'test-user-agent',
      geolocation: {
        country: 'XX',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0
      },
      metadata: {
        riskScore: 85,
        detectedRules: ['geolocation_mismatch']
      },
      isResolved: false
    };

    it('should generate security alert successfully', async () => {
      // Mock successful database insert
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'alert_123' },
          error: null
        })
      });

      const result = await securityMonitoringService.generateSecurityAlert(mockAlert);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^alert_\d+_/);
      expect(result.type).toBe('fraud_detected');
      expect(result.severity).toBe('error');
      expect(result.title).toBe('Suspicious Payment Detected');
      expect(result.isResolved).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' }
        })
      });

      await expect(securityMonitoringService.generateSecurityAlert(mockAlert))
        .rejects.toThrow('Failed to create security alert: Database connection failed');
    });
  });

  describe('getSecurityMetrics', () => {
    const timeRange = {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-31T23:59:59Z'
    };

    it('should return security metrics successfully', async () => {
      // Mock metrics data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { id: 'payment1', amount: 50000, risk_score: 30 },
                  { id: 'payment2', amount: 100000, risk_score: 70 },
                  { id: 'payment3', amount: 75000, risk_score: 50 }
                ],
                error: null
              })
            })
          })
        })
      });

      const result = await securityMonitoringService.getSecurityMetrics(timeRange);

      expect(result).toBeDefined();
      expect(result.totalPayments).toBe(3);
      expect(result.averageRiskScore).toBe(50);
      expect(result.timeRange).toEqual(timeRange);
    });

    it('should handle empty metrics data', async () => {
      // Mock empty data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      });

      const result = await securityMonitoringService.getSecurityMetrics(timeRange);

      expect(result).toBeDefined();
      expect(result.totalPayments).toBe(0);
      expect(result.totalFraudDetected).toBe(0);
      expect(result.averageRiskScore).toBe(0);
    });
  });

  describe('resolveSecurityAlert', () => {
    it('should resolve security alert successfully', async () => {
      const alertId = 'alert_123';
      const resolvedBy = 'admin-user-456';
      const resolutionNotes = 'False positive - legitimate transaction';

      // Mock successful update
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: alertId, is_resolved: true },
            error: null
          })
        })
      });

      await expect(securityMonitoringService.resolveSecurityAlert(alertId, resolvedBy, resolutionNotes))
        .resolves.not.toThrow();
    });

    it('should handle resolution errors', async () => {
      const alertId = 'alert_123';
      const resolvedBy = 'admin-user-456';

      // Mock database error
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Alert not found' }
          })
        })
      });

      await expect(securityMonitoringService.resolveSecurityAlert(alertId, resolvedBy))
        .rejects.toThrow('Failed to resolve security alert: Alert not found');
    });
  });

  describe('getUnresolvedAlerts', () => {
    it('should return unresolved alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert_1',
          type: 'fraud_detected',
          severity: 'error',
          title: 'Suspicious Payment',
          message: 'High-risk payment detected',
          is_resolved: false,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'alert_2',
          type: 'suspicious_activity',
          severity: 'warning',
          title: 'Unusual Login Pattern',
          message: 'Multiple login attempts detected',
          is_resolved: false,
          created_at: '2024-01-15T11:00:00Z',
          updated_at: '2024-01-15T11:00:00Z'
        }
      ];

      // Mock unresolved alerts
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockAlerts,
                error: null
              })
            })
          })
        })
      });

      const result = await securityMonitoringService.getUnresolvedAlerts(10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('alert_1');
      expect(result[0].type).toBe('fraud_detected');
      expect(result[1].id).toBe('alert_2');
      expect(result[1].type).toBe('suspicious_activity');
    });
  });

  describe('generateComplianceReport', () => {
    const timeRange = {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-31T23:59:59Z'
    };

    it('should generate fraud summary report', async () => {
      // Mock metrics data for report generation
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { id: 'payment1', amount: 50000, risk_score: 30 },
                  { id: 'payment2', amount: 100000, risk_score: 70 },
                  { id: 'payment3', amount: 75000, risk_score: 50 }
                ],
                error: null
              })
            })
          })
        })
      });

      const result = await securityMonitoringService.generateComplianceReport(
        'fraud_summary',
        timeRange,
        'admin-user-123'
      );

      expect(result).toBeDefined();
      expect(result.reportType).toBe('fraud_summary');
      expect(result.timeRange).toEqual(timeRange);
      expect(result.generatedBy).toBe('admin-user-123');
      expect(result.summary.totalTransactions).toBe(3);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should generate security audit report', async () => {
      // Mock audit data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { action: 'security_alert_created', timestamp: '2024-01-15T10:00:00Z' },
                  { action: 'fraud_detected', timestamp: '2024-01-15T11:00:00Z' }
                ],
                error: null
              })
            })
          })
        })
      });

      const result = await securityMonitoringService.generateComplianceReport(
        'security_audit',
        timeRange,
        'admin-user-123'
      );

      expect(result).toBeDefined();
      expect(result.reportType).toBe('security_audit');
      expect(result.details).toBeDefined();
    });
  });

  describe('compliance score calculation', () => {
    it('should calculate high compliance score for good metrics', () => {
      const service = securityMonitoringService as any;
      const goodMetrics: SecurityMetrics = {
        totalPayments: 1000,
        totalFraudDetected: 5,
        totalSecurityAlerts: 10,
        averageRiskScore: 25,
        fraudRate: 0.5,
        topRiskFactors: [],
        topBlockedCountries: [],
        topSuspiciousIPs: [],
        timeRange: { start: '2024-01-01', end: '2024-01-31' }
      };

      const score = service.calculateComplianceScore(goodMetrics);
      expect(score).toBeGreaterThan(80);
    });

    it('should calculate low compliance score for poor metrics', () => {
      const service = securityMonitoringService as any;
      const poorMetrics: SecurityMetrics = {
        totalPayments: 1000,
        totalFraudDetected: 200,
        totalSecurityAlerts: 500,
        averageRiskScore: 75,
        fraudRate: 20,
        topRiskFactors: [],
        topBlockedCountries: [],
        topSuspiciousIPs: [],
        timeRange: { start: '2024-01-01', end: '2024-01-31' }
      };

      const score = service.calculateComplianceScore(poorMetrics);
      expect(score).toBeLessThan(50);
    });
  });

  describe('notification sending', () => {
    it('should send notifications for high severity alerts', async () => {
      const alert: SecurityAlert = {
        id: 'alert_123',
        type: 'fraud_detected',
        severity: 'error',
        title: 'Critical Security Alert',
        message: 'High-risk fraud detected',
        isResolved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock notification sending
      const service = securityMonitoringService as any;
      await expect(service.sendSecurityNotifications(alert)).resolves.not.toThrow();
    });
  });
}); 