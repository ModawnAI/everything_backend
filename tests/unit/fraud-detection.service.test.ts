/**
 * Fraud Detection Service Unit Tests
 * 
 * Comprehensive test suite for fraud detection functionality including:
 * - Velocity checking for payment patterns
 * - Geolocation validation and IP reputation
 * - Device fingerprinting and behavioral analysis
 * - Real-time risk scoring and fraud detection
 * - Security alert generation and monitoring
 */

import { FraudDetectionService } from '../../src/services/fraud-detection.service';
import { getSupabaseClient } from '../../src/config/database';
import {
  FraudDetectionRequest,
  FraudDetectionResponse,
  FraudRiskLevel,
  FraudAction,
  SecurityAlertType,
  SecurityAlertSeverity,
  GeolocationData
} from '../../src/types/payment-security.types';

// Mock Supabase client
jest.mock('../../src/config/database');
const mockSupabase = getSupabaseClient() as jest.Mocked<any>;

describe('FraudDetectionService', () => {
  let fraudDetectionService: FraudDetectionService;

  // Helper function to create complete geolocation data
  const createGeolocationData = (overrides: Partial<GeolocationData> = {}): GeolocationData => ({
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
    lastUpdated: new Date().toISOString(),
    ...overrides
  });

  beforeEach(() => {
    fraudDetectionService = new FraudDetectionService();
    jest.clearAllMocks();
  });

  describe('detectFraud', () => {
    const mockRequest: FraudDetectionRequest = {
      paymentId: 'test-payment-123',
      userId: 'test-user-456',
      amount: 50000,
      currency: 'KRW',
      paymentMethod: 'card',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      geolocation: createGeolocationData(),
      deviceFingerprint: 'test-device-fingerprint-123',
      metadata: {
        shopId: 'test-shop-789',
        reservationId: 'test-reservation-101'
      }
    };

    it('should detect fraud with high risk score for suspicious amount', async () => {
      // Mock velocity check to return exceeded
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { amount: 1000000 },
                  { amount: 2000000 },
                  { amount: 1500000 }
                ],
                error: null
              })
            })
          })
        })
      });

      const result = await fraudDetectionService.detectFraud(mockRequest);

      expect(result).toBeDefined();
      expect(result.riskLevel).toBe('high');
      expect(result.action).toBe('review');
      expect(result.detectedRules).toHaveLength(1);
      expect(result.securityAlerts).toHaveLength(1);
      expect(result.securityAlerts[0].type).toBe('fraud_detected');
      expect(result.securityAlerts[0].severity).toBe('error');
    });

    it('should detect fraud for geolocation mismatch', async () => {
      const suspiciousRequest = {
        ...mockRequest,
        geolocation: createGeolocationData({ country: 'XX' })
      };

      // Mock geolocation check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      const result = await fraudDetectionService.detectFraud(suspiciousRequest);

      expect(result).toBeDefined();
      expect(result.riskLevel).toBe('medium');
      expect(result.action).toBe('challenge');
      expect(result.detectedRules).toHaveLength(1);
      expect(result.securityAlerts).toHaveLength(1);
    });

    it('should detect fraud for suspicious device fingerprint', async () => {
      const suspiciousRequest = {
        ...mockRequest,
        deviceFingerprint: 'suspicious-device-fingerprint'
      };

      // Mock device fingerprint check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ risk_score: 85 }], // High risk score
            error: null
          })
        })
      });

      const result = await fraudDetectionService.detectFraud(suspiciousRequest);

      expect(result).toBeDefined();
      expect(result.riskLevel).toBe('high');
      expect(result.action).toBe('review');
      expect(result.detectedRules).toHaveLength(1);
    });

    it('should return low risk for normal transaction', async () => {
      // Mock all checks to return normal results
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          }),
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      const result = await fraudDetectionService.detectFraud(mockRequest);

      expect(result).toBeDefined();
      expect(result.riskLevel).toBe('low');
      expect(result.action).toBe('allow');
      expect(result.detectedRules).toHaveLength(0);
      expect(result.securityAlerts).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' }
              })
            })
          })
        })
      });

      const result = await fraudDetectionService.detectFraud(mockRequest);

      expect(result).toBeDefined();
      expect(result.riskLevel).toBe('medium'); // Default to medium risk on error
      expect(result.action).toBe('review');
      expect(result.securityAlerts).toHaveLength(1);
      expect(result.securityAlerts[0].type).toBe('system_error');
    });
  });

  describe('velocity checks', () => {
    it('should detect high payment amount velocity', async () => {
      const request: FraudDetectionRequest = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        amount: 1000000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: createGeolocationData(),
        deviceFingerprint: 'test-device',
        metadata: {}
      };

      // Mock high amount velocity
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

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.riskLevel).toBe('high');
      expect(result.detectedRules.some(rule => rule.ruleId === 'velocity_payment_amount')).toBe(true);
    });

    it('should detect high payment frequency velocity', async () => {
      const request: FraudDetectionRequest = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        amount: 50000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: createGeolocationData(),
        deviceFingerprint: 'test-device',
        metadata: {}
      };

      // Mock high frequency velocity
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { id: 'payment1' },
                  { id: 'payment2' },
                  { id: 'payment3' },
                  { id: 'payment4' },
                  { id: 'payment5' }
                ],
                error: null
              })
            })
          })
        })
      });

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.riskLevel).toBe('medium');
      expect(result.detectedRules.some(rule => rule.ruleId === 'payment_frequency_high')).toBe(true);
    });
  });

  describe('geolocation validation', () => {
    it('should detect suspicious country', async () => {
      const request: FraudDetectionRequest = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        amount: 50000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: createGeolocationData({ country: 'XX' }),
        deviceFingerprint: 'test-device',
        metadata: {}
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.riskLevel).toBe('medium');
      expect(result.detectedRules.some(rule => rule.ruleId === 'geolocation_mismatch')).toBe(true);
    });

    it('should detect VPN usage', async () => {
      const request: FraudDetectionRequest = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        amount: 50000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: createGeolocationData({ isVpn: true }),
        deviceFingerprint: 'test-device',
        metadata: {}
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.riskLevel).toBe('medium');
      expect(result.detectedRules.some(rule => rule.ruleId === 'vpn_detection')).toBe(true);
    });
  });

  describe('device fingerprint analysis', () => {
    it('should detect suspicious device fingerprint', async () => {
      const request: FraudDetectionRequest = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        amount: 50000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: createGeolocationData(),
        deviceFingerprint: 'suspicious-device-fingerprint',
        metadata: {}
      };

      // Mock high device risk score
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ risk_score: 85 }],
            error: null
          })
        })
      });

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.riskLevel).toBe('high');
      expect(result.detectedRules.some(rule => rule.ruleId === 'device_fingerprint_suspicious')).toBe(true);
    });
  });

  describe('behavioral analysis', () => {
    it('should detect unusual payment time', async () => {
      const request: FraudDetectionRequest = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        amount: 50000,
        currency: 'KRW',
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent',
        geolocation: createGeolocationData(),
        deviceFingerprint: 'test-device',
        metadata: {
          paymentTime: '03:00:00' // Unusual time
        }
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.riskLevel).toBe('medium');
      expect(result.detectedRules.some(rule => rule.ruleId === 'unusual_payment_time')).toBe(true);
    });
  });

  describe('risk level calculation', () => {
    it('should calculate correct risk level based on score', () => {
      const service = fraudDetectionService as any;
      
      expect(service.calculateRiskLevel(10)).toBe('low');
      expect(service.calculateRiskLevel(30)).toBe('low');
      expect(service.calculateRiskLevel(50)).toBe('medium');
      expect(service.calculateRiskLevel(70)).toBe('medium');
      expect(service.calculateRiskLevel(85)).toBe('high');
      expect(service.calculateRiskLevel(95)).toBe('high');
    });
  });

  describe('action determination', () => {
    it('should determine correct action based on risk level', () => {
      const service = fraudDetectionService as any;
      
      expect(service.determineAction('low', [])).toBe('allow');
      expect(service.determineAction('medium', [])).toBe('challenge');
      expect(service.determineAction('high', [])).toBe('review');
    });
  });
}); 