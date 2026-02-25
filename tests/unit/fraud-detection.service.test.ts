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

import { createMockSupabase, createQueryMock, setupMockQuery, createDatabaseMock } from '../utils/supabase-mock-helper';

const mockSupabase = createMockSupabase();

jest.mock('../../src/config/database', () => createDatabaseMock(mockSupabase));
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/config/environment', () => ({
  config: { NODE_ENV: 'test' }
}));

// Mock external services used by fraud-detection
jest.mock('../../src/services/real-time-pattern-analysis.service', () => ({
  realTimePatternAnalysisService: {
    analyzePaymentPattern: jest.fn().mockResolvedValue({
      isAnomaly: false,
      anomalyScore: 0,
      confidence: 0,
      detectedPatterns: [],
      riskFactors: [],
      recommendations: [],
      modelVersion: 'test',
      analysisTime: 0
    })
  }
}));

jest.mock('../../src/services/geographic-anomaly-detection.service', () => ({
  geographicAnomalyDetectionService: {
    detectGeographicAnomaly: jest.fn().mockResolvedValue({
      isAnomaly: false,
      anomalyScore: 0,
      riskLevel: 'low',
      detectedAnomalies: [],
      geolocationData: null,
      travelAnalysis: null,
      recommendations: [],
      metadata: { analysisTime: 0, dataSource: 'test' }
    })
  }
}));

jest.mock('../../src/services/automated-payment-blocking.service', () => ({
  automatedPaymentBlockingService: {
    makeBlockingDecision: jest.fn().mockResolvedValue({
      shouldBlock: false,
      blockingReason: '',
      blockingRule: '',
      severity: 'low',
      confidence: 0,
      actions: [],
      overrideRequired: false,
      reviewRequired: false,
      metadata: {}
    })
  }
}));

import { FraudDetectionService } from '../../src/services/fraud-detection.service';
import {
  FraudDetectionRequest,
  GeolocationData
} from '../../src/types/payment-security.types';

describe('FraudDetectionService', () => {
  let fraudDetectionService: FraudDetectionService;

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

  const createDefaultRequest = (overrides: Partial<FraudDetectionRequest> = {}): FraudDetectionRequest => ({
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
    },
    ...overrides
  });

  /**
   * Helper to set up DB mocks for a normal (low-risk) scenario.
   * - fraud_detection_rules: returns empty (uses defaults)
   * - payments velocity queries: returns empty arrays / 0 counts
   * - device_fingerprints: returns not found (new device, risk 70)
   * - payment_security_events: insert success
   * - payments (amount history for anomaly check): returns empty
   */
  function setupNormalMocks() {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_detection_rules') {
        return createQueryMock({ data: null, error: { message: 'Not found' } });
      }
      if (table === 'payments') {
        // Returns empty array for velocity checks and anomaly checks
        return createQueryMock({ data: [], error: null, count: 0 });
      }
      if (table === 'device_fingerprints') {
        // Not found = new device (risk 70, which is <=70 threshold so no rule triggered)
        return createQueryMock({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
      }
      if (table === 'payment_security_events') {
        return createQueryMock({ data: { id: 'event-1' }, error: null });
      }
      return createQueryMock({ data: null, error: null });
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    fraudDetectionService = new FraudDetectionService();
  });

  describe('detectFraud', () => {
    it('should return low risk for normal transaction', async () => {
      setupNormalMocks();

      const result = await fraudDetectionService.detectFraud(createDefaultRequest());

      expect(result).toBeDefined();
      expect(result.riskLevel).toBe('low');
      expect(result.action).toBe('allow');
      expect(result.detectedRules).toHaveLength(0);
    });

    it('should detect high velocity payment amounts', async () => {
      // payments table returns high amount sum
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'fraud_detection_rules') {
          return createQueryMock({ data: null, error: { message: 'Not found' } });
        }
        if (table === 'payments') {
          // Amount velocity: >1M KRW total
          return createQueryMock({ data: [{ amount: 500000 }, { amount: 800000 }], error: null, count: 2 });
        }
        if (table === 'device_fingerprints') {
          return createQueryMock({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
        }
        if (table === 'payment_security_events') {
          return createQueryMock({ data: { id: 'event-1' }, error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await fraudDetectionService.detectFraud(createDefaultRequest({ amount: 1000000 }));

      expect(result).toBeDefined();
      expect(result.detectedRules.some(r => r.ruleId === 'velocity_payment_amount')).toBe(true);
    });

    it('should detect geolocation mismatch for blocked country', async () => {
      setupNormalMocks();

      const result = await fraudDetectionService.detectFraud(
        createDefaultRequest({ geolocation: createGeolocationData({ country: 'XX' }) })
      );

      expect(result).toBeDefined();
      expect(result.detectedRules.some(r => r.ruleId === 'geolocation_mismatch')).toBe(true);
      expect(result.securityAlerts.length).toBeGreaterThan(0);
    });

    it('should detect VPN usage', async () => {
      setupNormalMocks();

      const result = await fraudDetectionService.detectFraud(
        createDefaultRequest({ geolocation: createGeolocationData({ isVpn: true }) })
      );

      expect(result).toBeDefined();
      // VPN adds 60 to risk score in one check. With ruleCount=1, avgScore=60, riskLevel='high'
      expect(result.securityAlerts.some(a => a.title.includes('VPN'))).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      // Each sub-check has its own try/catch so DB errors are caught individually.
      // The service degrades gracefully: returns a valid response with low risk
      // since no fraud rules are triggered when all checks fail silently.
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await fraudDetectionService.detectFraud(createDefaultRequest());

      expect(result).toBeDefined();
      // Graceful degradation: returns valid response despite errors
      expect(result.riskLevel).toBeDefined();
      expect(result.action).toBeDefined();
      expect(result.detectedRules).toBeDefined();
    });
  });

  describe('velocity checks', () => {
    it('should detect high payment amount velocity', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'fraud_detection_rules') {
          return createQueryMock({ data: null, error: { message: 'Not found' } });
        }
        if (table === 'payments') {
          return createQueryMock({ data: [{ amount: 500000 }, { amount: 800000 }, { amount: 1200000 }], error: null, count: 3 });
        }
        if (table === 'device_fingerprints') {
          return createQueryMock({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
        }
        if (table === 'payment_security_events') {
          return createQueryMock({ data: { id: 'event-1' }, error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await fraudDetectionService.detectFraud(createDefaultRequest({ amount: 1000000 }));

      expect(result.detectedRules.some(rule => rule.ruleId === 'velocity_payment_amount')).toBe(true);
    });

    it('should detect high payment frequency velocity', async () => {
      // 6 payments in the last hour > threshold of 5
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'fraud_detection_rules') {
          return createQueryMock({ data: null, error: { message: 'Not found' } });
        }
        if (table === 'payments') {
          return createQueryMock({ data: [{ amount: 10000 }], error: null, count: 6 });
        }
        if (table === 'device_fingerprints') {
          return createQueryMock({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
        }
        if (table === 'payment_security_events') {
          return createQueryMock({ data: { id: 'event-1' }, error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await fraudDetectionService.detectFraud(createDefaultRequest());

      expect(result.detectedRules.some(rule => rule.ruleId === 'payment_frequency_high')).toBe(true);
    });
  });

  describe('geolocation validation', () => {
    it('should detect suspicious country', async () => {
      setupNormalMocks();

      const result = await fraudDetectionService.detectFraud(
        createDefaultRequest({ geolocation: createGeolocationData({ country: 'XX' }) })
      );

      expect(result.detectedRules.some(rule => rule.ruleId === 'geolocation_mismatch')).toBe(true);
    });

    it('should detect VPN usage', async () => {
      setupNormalMocks();

      const result = await fraudDetectionService.detectFraud(
        createDefaultRequest({ geolocation: createGeolocationData({ isVpn: true }) })
      );

      // VPN adds alerts
      expect(result.securityAlerts.some(a => a.title.includes('VPN'))).toBe(true);
    });
  });

  describe('device fingerprint analysis', () => {
    it('should detect suspicious device fingerprint', async () => {
      // Device fingerprints table returns a device with high risk score
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'device_fingerprints') {
          return createQueryMock({
            data: { fingerprint: 'suspicious', risk_score: 85, is_suspicious: false, last_seen: new Date().toISOString() },
            error: null
          });
        }
        if (table === 'fraud_detection_rules') {
          return createQueryMock({ data: null, error: { message: 'Not found' } });
        }
        if (table === 'payments') {
          return createQueryMock({ data: [], error: null, count: 0 });
        }
        if (table === 'payment_security_events') {
          return createQueryMock({ data: { id: 'event-1' }, error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await fraudDetectionService.detectFraud(
        createDefaultRequest({ deviceFingerprint: 'suspicious-device' })
      );

      expect(result.detectedRules.some(rule => rule.ruleId === 'device_fingerprint_suspicious')).toBe(true);
    });
  });

  describe('risk level calculation', () => {
    it('should calculate correct risk level based on score', () => {
      const service = fraudDetectionService as any;

      // Actual thresholds: >=80 critical, >=60 high, >=30 medium, <30 low
      expect(service.calculateRiskLevel(10)).toBe('low');
      expect(service.calculateRiskLevel(29)).toBe('low');
      expect(service.calculateRiskLevel(30)).toBe('medium');
      expect(service.calculateRiskLevel(50)).toBe('medium');
      expect(service.calculateRiskLevel(59)).toBe('medium');
      expect(service.calculateRiskLevel(60)).toBe('high');
      expect(service.calculateRiskLevel(79)).toBe('high');
      expect(service.calculateRiskLevel(80)).toBe('critical');
      expect(service.calculateRiskLevel(95)).toBe('critical');
    });
  });

  describe('action determination', () => {
    it('should determine correct action based on risk level', () => {
      const service = fraudDetectionService as any;

      expect(service.determineAction('low', [])).toBe('allow');
      expect(service.determineAction('medium', [])).toBe('challenge');
      expect(service.determineAction('high', [])).toBe('review');
      expect(service.determineAction('critical', [])).toBe('block');
    });

    it('should return monitor when low risk but has detected rules', () => {
      const service = fraudDetectionService as any;

      expect(service.determineAction('low', [{ ruleId: 'test' }])).toBe('monitor');
    });
  });
});
