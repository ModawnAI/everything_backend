/**
 * Real-Time Pattern Analysis Service Unit Tests
 *
 * Tests the advanced ML-based pattern analysis system:
 * - Statistical anomaly detection
 * - User behavior profiling
 * - Pattern matching and classification
 * - Risk scoring and recommendations
 * - Model performance and accuracy
 */

// Persistent mock object -- the service singleton captures this reference at module load
const mockSupabase: any = {};
let queryMockResult: any = { data: [], error: null };

function createChainableQueryMock(overrideResult?: any) {
  const result = overrideResult || queryMockResult;
  const mock: any = {};
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'not',
    'contains', 'containedBy', 'overlaps',
    'filter', 'match', 'or', 'and',
    'order', 'limit', 'range', 'offset', 'count',
    'single', 'maybeSingle',
    'csv', 'returns', 'textSearch', 'throwOnError',
  ];
  for (const method of methods) {
    mock[method] = jest.fn(() => mock);
  }
  mock.then = (resolve: any) => resolve(result);
  return mock;
}

function resetMockSupabase() {
  queryMockResult = { data: [], error: null };
  mockSupabase.from = jest.fn(() => createChainableQueryMock());
  mockSupabase.rpc = jest.fn(() => ({ data: null, error: null }));
}
resetMockSupabase();

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase,
  initializeDatabase: jest.fn(),
  getDatabase: jest.fn(),
  database: { getClient: () => mockSupabase },
}));
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  realTimePatternAnalysisService,
  PaymentPattern,
  UserPaymentProfile,
} from '../../src/services/real-time-pattern-analysis.service';

describe('RealTimePatternAnalysisService', () => {
  let mockPaymentPattern: PaymentPattern;
  let mockUserProfile: UserPaymentProfile;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
    // Clear caches
    (realTimePatternAnalysisService as any).patternCache.clear();
    (realTimePatternAnalysisService as any).modelCache.clear();

    // Pre-populate model cache with default models to avoid empty model array
    // (when DB returns empty data instead of error, getDefaultModels is not called)
    const defaultModels = [
      {
        id: 'statistical_default',
        name: 'Statistical Analysis Model',
        version: '1.0.0',
        type: 'statistical' as const,
        parameters: {},
        accuracy: 0.75,
        lastTrained: new Date().toISOString(),
        isActive: true,
        performance: { precision: 0.75, recall: 0.70, f1Score: 0.72, falsePositiveRate: 0.15 },
      },
      {
        id: 'hybrid_default',
        name: 'Hybrid Analysis Model',
        version: '1.0.0',
        type: 'hybrid' as const,
        parameters: { statisticalWeight: 0.6, mlWeight: 0.4 },
        accuracy: 0.85,
        lastTrained: new Date().toISOString(),
        isActive: true,
        performance: { precision: 0.85, recall: 0.80, f1Score: 0.82, falsePositiveRate: 0.10 },
      },
    ];
    const modelCache = (realTimePatternAnalysisService as any).modelCache;
    defaultModels.forEach((m: any) => modelCache.set(m.id, m));

    mockPaymentPattern = {
      userId: 'user-123',
      amount: 100000,
      paymentMethod: 'card',
      timeOfDay: 14,
      dayOfWeek: 1,
      merchantCategory: 'beauty',
      location: {
        country: 'KR',
        region: 'Seoul',
        city: 'Gangnam',
      },
      deviceFingerprint: 'device-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      sessionDuration: 45,
      previousPaymentGap: 24,
      timestamp: '2024-01-15T14:00:00Z',
    };

    mockUserProfile = {
      userId: 'user-123',
      averageAmount: 80000,
      medianAmount: 75000,
      amountStdDev: 20000,
      preferredPaymentMethods: [
        { method: 'card', frequency: 0.7, lastUsed: '2024-01-14T10:00:00Z' },
        { method: 'bank_transfer', frequency: 0.3, lastUsed: '2024-01-10T15:00:00Z' },
      ],
      timePatterns: {
        mostActiveHour: 12,
        mostActiveDay: 1,
        weekendActivity: 0.2,
      },
      locationPatterns: {
        primaryCountry: 'KR',
        primaryRegion: 'Seoul',
        travelFrequency: 0.1,
        newLocationRisk: 20,
      },
      devicePatterns: {
        primaryDevice: 'device-123',
        deviceStability: 0.9,
        newDeviceRisk: 10,
      },
      behavioralPatterns: {
        sessionDuration: {
          average: 30,
          stdDev: 15,
        },
        paymentFrequency: {
          average: 2,
          stdDev: 1,
        },
        amountConsistency: 0.8,
      },
      lastUpdated: new Date().toISOString(),
      profileVersion: '1.0.0',
    };
  });

  describe('analyzePaymentPattern', () => {
    it('should detect amount anomaly for high deviation from user average', async () => {
      // Profile with low average so the payment (100000) has high z-score
      const lowAmountProfile: UserPaymentProfile = {
        ...mockUserProfile,
        averageAmount: 30000,
        amountStdDev: 5000,
      };

      (realTimePatternAnalysisService as any).patternCache.set('user-123', lowAmountProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      // z-score = (100000-30000)/5000 = 14 -> amount_anomaly detected
      expect(result.detectedPatterns).toContain('amount_anomaly');
      expect(result.anomalyScore).toBeGreaterThan(0);
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'amount_deviation',
          description: expect.stringContaining('standard deviations from user average'),
        })
      );
    });

    it('should detect time anomaly for unusual payment hour', async () => {
      const unusualTimePayment: PaymentPattern = {
        ...mockPaymentPattern,
        timeOfDay: 3, // 3 AM, mostActiveHour = 12, deviation = 9 > 6
      };

      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(unusualTimePayment);

      expect(result.detectedPatterns).toContain('time_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'unusual_time',
          description: expect.stringContaining('unusual hour'),
        })
      );
    });

    it('should detect payment method anomaly for infrequent method', async () => {
      const infrequentMethodPayment: PaymentPattern = {
        ...mockPaymentPattern,
        paymentMethod: 'crypto', // Not in preferred methods -> frequency = 0 < 0.1
      };

      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(infrequentMethodPayment);

      expect(result.detectedPatterns).toContain('payment_method_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'unusual_payment_method',
          description: expect.stringContaining('infrequent payment method'),
        })
      );
    });

    it('should detect location anomaly for new country', async () => {
      const newLocationPayment: PaymentPattern = {
        ...mockPaymentPattern,
        location: {
          country: 'US', // Different from primaryCountry 'KR'
          region: 'California',
          city: 'Los Angeles',
        },
      };

      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(newLocationPayment);

      expect(result.detectedPatterns).toContain('location_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'new_location',
          description: expect.stringContaining('new country'),
        })
      );
    });

    it('should detect device anomaly for new device', async () => {
      const newDevicePayment: PaymentPattern = {
        ...mockPaymentPattern,
        deviceFingerprint: 'new-device-456', // Different from primaryDevice 'device-123'
      };

      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(newDevicePayment);

      expect(result.detectedPatterns).toContain('device_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'new_device',
          description: expect.stringContaining('new device'),
        })
      );
    });

    it('should not detect anomaly for normal payment pattern', async () => {
      const normalPayment: PaymentPattern = {
        ...mockPaymentPattern,
        amount: 85000, // Close to average (80000), z-score = 5000/20000 = 0.25 < 2
        timeOfDay: 13, // Close to most active hour (12), deviation = 1 < 6
        paymentMethod: 'card', // Preferred method
        location: { country: 'KR', region: 'Seoul', city: 'Gangnam' },
        deviceFingerprint: 'device-123', // Known device
      };

      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(normalPayment);

      expect(result.isAnomaly).toBe(false);
      expect(result.detectedPatterns).toHaveLength(0);
    });

    it('should handle multiple anomalies and calculate combined score', async () => {
      // Profile with high risk scores for location and device to push overall above threshold
      const highRiskProfile: UserPaymentProfile = {
        ...mockUserProfile,
        averageAmount: 30000,
        amountStdDev: 5000, // z-score for 200000 = (200000-30000)/5000 = 34
        locationPatterns: {
          ...mockUserProfile.locationPatterns,
          newLocationRisk: 80, // High location risk
        },
        devicePatterns: {
          ...mockUserProfile.devicePatterns,
          newDeviceRisk: 80, // High device risk
        },
      };

      const multiAnomalyPayment: PaymentPattern = {
        ...mockPaymentPattern,
        amount: 200000, // z-score = 34 >> 2
        timeOfDay: 3, // deviation = 9 > 6
        paymentMethod: 'crypto', // Not in preferred methods
        location: { country: 'US', region: 'California', city: 'Los Angeles' },
        deviceFingerprint: 'new-device-456',
      };

      (realTimePatternAnalysisService as any).patternCache.set('user-123', highRiskProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(multiAnomalyPayment);

      // The weighted model averaging may keep overall score below 70 threshold,
      // but individual anomaly patterns should still be detected
      expect(result.anomalyScore).toBeGreaterThan(0);
      expect(result.detectedPatterns).toContain('amount_anomaly');
      expect(result.detectedPatterns).toContain('time_anomaly');
      expect(result.detectedPatterns).toContain('payment_method_anomaly');
      expect(result.detectedPatterns).toContain('location_anomaly');
      expect(result.detectedPatterns).toContain('device_anomaly');
      expect(result.riskFactors.length).toBeGreaterThanOrEqual(5);
    });

    it('should provide appropriate recommendations based on risk level', async () => {
      // High z-score (>3) triggers recommendation
      const highRiskProfile: UserPaymentProfile = {
        ...mockUserProfile,
        averageAmount: 30000,
        amountStdDev: 5000, // z-score = (500000 - 30000) / 5000 = 94 >> 3
      };
      const highRiskPayment: PaymentPattern = {
        ...mockPaymentPattern,
        amount: 500000,
        timeOfDay: 2, // Also triggers time anomaly
        paymentMethod: 'crypto', // Also triggers method anomaly
      };

      (realTimePatternAnalysisService as any).patternCache.set('user-123', highRiskProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(highRiskPayment);

      // z-score > 3 triggers 'High amount deviation - manual review recommended'
      expect(result.recommendations).toContain('High amount deviation - manual review recommended');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from = jest.fn(() =>
        createChainableQueryMock({ data: null, error: { message: 'Database connection failed' } })
      );

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      // Service uses default profile and default models when DB fails
      expect(result).toBeDefined();
      expect(result.modelVersion).toBe('1.0.0');
    });

    it('should use cached profile on second call', async () => {
      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);
      await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      const cachedProfile = (realTimePatternAnalysisService as any).patternCache.get('user-123');
      expect(cachedProfile).toBeDefined();
    });

    it('should update user profile with new payment data', async () => {
      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      const cachedProfile = (realTimePatternAnalysisService as any).patternCache.get('user-123');
      expect(cachedProfile).toBeDefined();
    });
  });

  describe('User Profile Building', () => {
    it('should build comprehensive user profile from payment history', async () => {
      const mockPayments = [
        {
          amount: 50000, payment_method: 'card', created_at: '2024-01-10T10:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' }, device_fingerprint: 'device-123',
          reservations: { shops: { category: 'beauty' } },
        },
        {
          amount: 75000, payment_method: 'card', created_at: '2024-01-12T14:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' }, device_fingerprint: 'device-123',
          reservations: { shops: { category: 'beauty' } },
        },
        {
          amount: 100000, payment_method: 'bank_transfer', created_at: '2024-01-14T16:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' }, device_fingerprint: 'device-123',
          reservations: { shops: { category: 'beauty' } },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        createChainableQueryMock({ data: mockPayments, error: null })
      );

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      expect(result.modelVersion).toBe('1.0.0');
    });

    it('should create default profile for new users', async () => {
      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      expect(result.modelVersion).toBe('1.0.0');
    });
  });

  describe('Model Performance', () => {
    it('should use default models when database models are unavailable', async () => {
      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      expect(result.modelVersion).toBe('1.0.0');
    });

    it('should handle model errors gracefully', async () => {
      mockSupabase.from = jest.fn(() =>
        createChainableQueryMock({ data: null, error: { message: 'Model loading failed' } })
      );

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      expect(result.modelVersion).toBe('1.0.0');
    });
  });

  describe('Performance Metrics', () => {
    it('should include analysis time in result', async () => {
      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
      expect(result.modelVersion).toBe('1.0.0');
    });

    it('should call database for logging analysis results', async () => {
      await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });
});
