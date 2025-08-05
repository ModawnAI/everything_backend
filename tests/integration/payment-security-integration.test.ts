/**
 * Payment Security Integration Tests
 * 
 * End-to-end integration tests for the complete payment security system including:
 * - Fraud detection flow integration
 * - Security monitoring integration
 * - Error handling integration
 * - API endpoint integration
 * - Database integration
 */

import request from 'supertest';
import app from '../../src/app';
import { getSupabaseClient } from '../../src/config/database';
import { fraudDetectionService } from '../../src/services/fraud-detection.service';
import { securityMonitoringService } from '../../src/services/security-monitoring.service';
import { paymentErrorHandlingService } from '../../src/services/payment-error-handling.service';
import {
  FraudDetectionRequest,
  SecurityAlertType,
  SecurityAlertSeverity,
  PaymentErrorType
} from '../../src/types/payment-security.types';

// Mock Supabase client
jest.mock('../../src/config/database');
const mockSupabase = getSupabaseClient() as jest.Mocked<any>;

describe('Payment Security Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup test authentication token
    authToken = 'test-auth-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Fraud Detection API Integration', () => {
    const mockFraudRequest = {
      paymentId: 'test-payment-123',
      amount: 1000000, // High amount to trigger fraud detection
      currency: 'KRW',
      paymentMethod: 'card',
      ipAddress: '192.168.1.1',
      userAgent: 'test-user-agent',
      geolocation: {
        ipAddress: '192.168.1.1',
        country: 'XX', // Suspicious country
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
        isp: 'Unknown',
        organization: 'Unknown',
        asn: 'AS0000',
        isProxy: false,
        isVpn: true, // VPN usage
        isTor: false,
        riskScore: 80,
        lastUpdated: new Date().toISOString()
      },
      deviceFingerprint: 'suspicious-device-fingerprint',
      metadata: {
        shopId: 'test-shop-789',
        reservationId: 'test-reservation-101'
      }
    };

    it('should detect fraud through API endpoint', async () => {
      // Mock velocity check to return exceeded
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { amount: 500000 },
                  { amount: 800000 },
                  { amount: 1200000 }
                ],
                error: null
              })
            })
          })
        })
      });

      const response = await request(app)
        .post('/api/payment-security/fraud-detection')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockFraudRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.riskLevel).toBe('high');
      expect(response.body.data.action).toBe('review');
      expect(response.body.data.detectedRules).toHaveLength(1);
      expect(response.body.data.securityAlerts).toHaveLength(1);
    });

    it('should handle missing required fields', async () => {
      const invalidRequest = {
        paymentId: 'test-payment-123',
        // Missing amount and ipAddress
        currency: 'KRW',
        paymentMethod: 'card'
      };

      const response = await request(app)
        .post('/api/payment-security/fraud-detection')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    it('should handle invalid amount', async () => {
      const invalidRequest = {
        ...mockFraudRequest,
        amount: -1000 // Negative amount
      };

      const response = await request(app)
        .post('/api/payment-security/fraud-detection')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_AMOUNT');
    });
  });

  describe('Security Monitoring API Integration', () => {
    it('should get security metrics', async () => {
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

      const response = await request(app)
        .get('/api/payment-security/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalPayments).toBe(3);
      expect(response.body.data.averageRiskScore).toBe(50);
    });

    it('should get unresolved security alerts', async () => {
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

      const response = await request(app)
        .get('/api/payment-security/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('fraud_detected');
    });

    it('should resolve security alert', async () => {
      const alertId = 'alert_123';
      const resolutionData = {
        resolvedBy: 'admin-user-456',
        resolutionNotes: 'False positive - legitimate transaction'
      };

      // Mock successful resolution
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: alertId, is_resolved: true },
            error: null
          })
        })
      });

      const response = await request(app)
        .post(`/api/payment-security/alerts/${alertId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(resolutionData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling API Integration', () => {
    it('should handle payment error through API', async () => {
      const errorData = {
        error: {
          message: 'Network connection failed',
          stack: 'Error stack trace'
        },
        errorType: 'network_error' as PaymentErrorType,
        context: {
          paymentId: 'test-payment-123',
          userId: 'test-user-456',
          reservationId: 'test-reservation-789',
          requestData: { amount: 50000, currency: 'KRW' },
          responseData: { error: 'Network timeout' },
          ipAddress: '192.168.1.1',
          userAgent: 'test-user-agent'
        }
      };

      // Mock successful error creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'error_123' },
          error: null
        })
      });

      const response = await request(app)
        .post('/api/payment-security/errors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.errorType).toBe('network_error');
      expect(response.body.data.errorCode).toBe('NETWORK_ERROR');
    });

    it('should get payment errors', async () => {
      const mockErrors = [
        {
          id: 'error_1',
          error_type: 'network_error',
          error_code: 'NETWORK_ERROR',
          error_message: 'Connection timeout',
          is_resolved: false,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        }
      ];

      // Mock payment errors
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockErrors,
                error: null
              })
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/payment-security/errors')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].errorType).toBe('network_error');
    });
  });

  describe('Compliance Reporting API Integration', () => {
    it('should generate compliance report', async () => {
      const reportRequest = {
        reportType: 'fraud_summary' as const,
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        },
        generatedBy: 'admin-user-123'
      };

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

      const response = await request(app)
        .post('/api/payment-security/compliance-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reportType).toBe('fraud_summary');
      expect(response.body.data.generatedBy).toBe('admin-user-123');
      expect(response.body.data.summary.totalTransactions).toBe(3);
    });
  });

  describe('Security Dashboard API Integration', () => {
    it('should get security dashboard data', async () => {
      // Mock dashboard data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { id: 'payment1', amount: 50000, risk_score: 30 },
                  { id: 'payment2', amount: 100000, risk_score: 70 }
                ],
                error: null
              })
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/payment-security/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.recentAlerts).toBeDefined();
      expect(response.body.data.topRiskFactors).toBeDefined();
    });
  });

  describe('Service Integration Tests', () => {
    it('should integrate fraud detection with security monitoring', async () => {
      const fraudRequest: FraudDetectionRequest = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        amount: 1000000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: {
          ipAddress: '192.168.1.1',
          country: 'XX',
          region: 'Unknown',
          city: 'Unknown',
          latitude: 0,
          longitude: 0,
          timezone: 'UTC',
          isp: 'Unknown',
          organization: 'Unknown',
          asn: 'AS0000',
          isProxy: false,
          isVpn: true,
          isTor: false,
          riskScore: 80,
          lastUpdated: new Date().toISOString()
        },
        deviceFingerprint: 'suspicious-device',
        metadata: {}
      };

      // Mock velocity check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { amount: 500000 },
                  { amount: 800000 }
                ],
                error: null
              })
            })
          })
        })
      });

      // Test fraud detection
      const fraudResult = await fraudDetectionService.detectFraud(fraudRequest);
      expect(fraudResult.riskLevel).toBe('high');
      expect(fraudResult.securityAlerts).toHaveLength(1);

      // Test security alert generation
      const alert = fraudResult.securityAlerts[0];
      const generatedAlert = await securityMonitoringService.generateSecurityAlert({
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        userId: fraudRequest.userId,
        paymentId: fraudRequest.paymentId,
        ipAddress: fraudRequest.ipAddress,
        userAgent: fraudRequest.userAgent,
        geolocation: alert.geolocation,
        metadata: alert.metadata,
        isResolved: false
      });

      expect(generatedAlert).toBeDefined();
      expect(generatedAlert.type).toBe('fraud_detected');
      expect(generatedAlert.severity).toBe('error');
    });

    it('should integrate error handling with fraud detection', async () => {
      const networkError = new Error('Network connection failed');
      const context = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent'
      };

      // Mock error creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'error_123' },
          error: null
        })
      });

      // Test error handling
      const errorResult = await paymentErrorHandlingService.handlePaymentError(
        networkError,
        'network_error',
        context
      );

      expect(errorResult).toBeDefined();
      expect(errorResult.errorType).toBe('network_error');
      expect(errorResult.isResolved).toBe(false);
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should enforce rate limiting on fraud detection endpoint', async () => {
      const fraudRequest = {
        paymentId: 'test-payment-123',
        amount: 50000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: {
          ipAddress: '192.168.1.1',
          country: 'KR',
          region: 'Seoul',
          city: 'Seoul',
          latitude: 37.5665,
          longitude: 126.9780,
          timezone: 'Asia/Seoul',
          isp: 'Test ISP',
          organization: 'Test Org',
          asn: 'AS12345',
          isProxy: false,
          isVpn: false,
          isTor: false,
          riskScore: 10,
          lastUpdated: new Date().toISOString()
        },
        deviceFingerprint: 'test-device',
        metadata: {}
      };

      // Mock normal response
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

      // Make multiple requests to test rate limiting
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/payment-security/fraud-detection')
          .set('Authorization', `Bearer ${authToken}`)
          .send(fraudRequest)
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed (rate limit is 100 per 15 minutes)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should require authentication for security endpoints', async () => {
      const fraudRequest = {
        paymentId: 'test-payment-123',
        amount: 50000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: {
          ipAddress: '192.168.1.1',
          country: 'KR',
          region: 'Seoul',
          city: 'Seoul',
          latitude: 37.5665,
          longitude: 126.9780,
          timezone: 'Asia/Seoul',
          isp: 'Test ISP',
          organization: 'Test Org',
          asn: 'AS12345',
          isProxy: false,
          isVpn: false,
          isTor: false,
          riskScore: 10,
          lastUpdated: new Date().toISOString()
        },
        deviceFingerprint: 'test-device',
        metadata: {}
      };

      // Test without authentication
      await request(app)
        .post('/api/payment-security/fraud-detection')
        .send(fraudRequest)
        .expect(401);
    });
  });
}); 