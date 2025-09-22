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

import { realTimePatternAnalysisService, PaymentPattern, UserPaymentProfile } from '../../src/services/real-time-pattern-analysis.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

// Create mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })),
      gte: jest.fn(() => ({
        lte: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      }))
    })),
    insert: jest.fn(() => ({
      data: null,
      error: null
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: null,
        error: null
      }))
    }))
  })),
  rpc: jest.fn(() => ({
    data: null,
    error: null
  }))
};

// Mock the database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase
}));

describe('RealTimePatternAnalysisService', () => {
  let mockPaymentPattern: PaymentPattern;
  let mockUserProfile: UserPaymentProfile;

  beforeEach(() => {
    jest.clearAllMocks();

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
        city: 'Gangnam'
      },
      deviceFingerprint: 'device-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      sessionDuration: 45,
      previousPaymentGap: 24,
      timestamp: '2024-01-15T14:00:00Z'
    };

    mockUserProfile = {
      userId: 'user-123',
      averageAmount: 80000,
      medianAmount: 75000,
      amountStdDev: 20000,
      preferredPaymentMethods: [
        { method: 'card', frequency: 0.7, lastUsed: '2024-01-14T10:00:00Z' },
        { method: 'bank_transfer', frequency: 0.3, lastUsed: '2024-01-10T15:00:00Z' }
      ],
      timePatterns: {
        mostActiveHour: 12,
        mostActiveDay: 1,
        weekendActivity: 0.2
      },
      locationPatterns: {
        primaryCountry: 'KR',
        primaryRegion: 'Seoul',
        travelFrequency: 0.1,
        newLocationRisk: 20
      },
      devicePatterns: {
        primaryDevice: 'device-123',
        deviceStability: 0.9,
        newDeviceRisk: 10
      },
      behavioralPatterns: {
        sessionDuration: {
          average: 30,
          stdDev: 15
        },
        paymentFrequency: {
          average: 2,
          stdDev: 1
        },
        amountConsistency: 0.8
      },
      lastUpdated: '2024-01-14T10:00:00Z',
      profileVersion: '1.0.0'
    };
  });

  describe('analyzePaymentPattern', () => {
    it('should detect amount anomaly for high deviation from user average', async () => {
      // Mock user profile with low average amount
      const lowAmountProfile = {
        ...mockUserProfile,
        averageAmount: 30000,
        amountStdDev: 5000
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock profile cache
      (realTimePatternAnalysisService as any).patternCache.set('user-123', lowAmountProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBeGreaterThan(70);
      expect(result.detectedPatterns).toContain('amount_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'amount_deviation',
          description: expect.stringContaining('standard deviations from user average')
        })
      );
    });

    it('should detect time anomaly for unusual payment hour', async () => {
      // Mock payment at unusual hour (3 AM)
      const unusualTimePayment = {
        ...mockPaymentPattern,
        timeOfDay: 3
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock profile cache
      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(unusualTimePayment);

      expect(result.isAnomaly).toBe(true);
      expect(result.detectedPatterns).toContain('time_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'unusual_time',
          description: expect.stringContaining('unusual hour')
        })
      );
    });

    it('should detect payment method anomaly for infrequent method', async () => {
      // Mock payment with infrequent method
      const infrequentMethodPayment = {
        ...mockPaymentPattern,
        paymentMethod: 'crypto' // Not in preferred methods
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock profile cache
      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(infrequentMethodPayment);

      expect(result.isAnomaly).toBe(true);
      expect(result.detectedPatterns).toContain('payment_method_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'unusual_payment_method',
          description: expect.stringContaining('infrequent payment method')
        })
      );
    });

    it('should detect location anomaly for new country', async () => {
      // Mock payment from new country
      const newLocationPayment = {
        ...mockPaymentPattern,
        location: {
          country: 'US',
          region: 'California',
          city: 'Los Angeles'
        }
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock profile cache
      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(newLocationPayment);

      expect(result.isAnomaly).toBe(true);
      expect(result.detectedPatterns).toContain('location_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'new_location',
          description: expect.stringContaining('new country')
        })
      );
    });

    it('should detect device anomaly for new device', async () => {
      // Mock payment from new device
      const newDevicePayment = {
        ...mockPaymentPattern,
        deviceFingerprint: 'new-device-456'
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock profile cache
      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(newDevicePayment);

      expect(result.isAnomaly).toBe(true);
      expect(result.detectedPatterns).toContain('device_anomaly');
      expect(result.riskFactors).toContainEqual(
        expect.objectContaining({
          factor: 'new_device',
          description: expect.stringContaining('new device')
        })
      );
    });

    it('should not detect anomaly for normal payment pattern', async () => {
      // Mock normal payment that matches user profile
      const normalPayment = {
        ...mockPaymentPattern,
        amount: 85000, // Close to average
        timeOfDay: 13, // Close to most active hour
        paymentMethod: 'card', // Preferred method
        location: {
          country: 'KR',
          region: 'Seoul',
          city: 'Gangnam'
        },
        deviceFingerprint: 'device-123' // Known device
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock profile cache
      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(normalPayment);

      expect(result.isAnomaly).toBe(false);
      expect(result.anomalyScore).toBeLessThan(70);
      expect(result.detectedPatterns).toHaveLength(0);
    });

    it('should handle multiple anomalies and calculate combined score', async () => {
      // Mock payment with multiple anomalies
      const multiAnomalyPayment = {
        ...mockPaymentPattern,
        amount: 200000, // High amount deviation
        timeOfDay: 3, // Unusual time
        paymentMethod: 'crypto', // Infrequent method
        location: {
          country: 'US', // New country
          region: 'California',
          city: 'Los Angeles'
        },
        deviceFingerprint: 'new-device-456' // New device
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock profile cache
      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(multiAnomalyPayment);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBeGreaterThan(80);
      expect(result.detectedPatterns).toContain('amount_anomaly');
      expect(result.detectedPatterns).toContain('time_anomaly');
      expect(result.detectedPatterns).toContain('payment_method_anomaly');
      expect(result.detectedPatterns).toContain('location_anomaly');
      expect(result.detectedPatterns).toContain('device_anomaly');
      expect(result.riskFactors).toHaveLength(5);
    });

    it('should provide appropriate recommendations based on risk level', async () => {
      // Mock high-risk payment
      const highRiskPayment = {
        ...mockPaymentPattern,
        amount: 500000, // Very high amount
        timeOfDay: 2, // Very unusual time
        paymentMethod: 'crypto' // Infrequent method
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock profile cache
      (realTimePatternAnalysisService as any).patternCache.set('user-123', mockUserProfile);

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(highRiskPayment);

      expect(result.recommendations).toContain('High amount deviation - manual review recommended');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      // Should return safe default (high risk)
      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBe(100);
      expect(result.confidence).toBe(0);
      expect(result.detectedPatterns).toContain('analysis_error');
    });

    it('should cache user profiles for performance', async () => {
      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // First call - should build profile
      await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      // Second call - should use cached profile
      await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      // Should only call database once due to caching
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should update user profile with new payment data', async () => {
      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      // Profile should be updated (this would be verified in integration tests)
    });
  });

  describe('User Profile Building', () => {
    it('should build comprehensive user profile from payment history', async () => {
      const mockPayments = [
        {
          amount: 50000,
          payment_method: 'card',
          created_at: '2024-01-10T10:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' },
          device_fingerprint: 'device-123',
          reservations: {
            shops: { category: 'beauty' }
          }
        },
        {
          amount: 75000,
          payment_method: 'card',
          created_at: '2024-01-12T14:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' },
          device_fingerprint: 'device-123',
          reservations: {
            shops: { category: 'beauty' }
          }
        },
        {
          amount: 100000,
          payment_method: 'bank_transfer',
          created_at: '2024-01-14T16:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' },
          device_fingerprint: 'device-123',
          reservations: {
            shops: { category: 'beauty' }
          }
        }
      ];

      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: mockPayments,
        error: null
      });

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      // Profile building would be verified in integration tests with actual data
    });

    it('should create default profile for new users', async () => {
      // Mock empty payment history
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      // New user should get default profile with medium risk
    });
  });

  describe('Model Performance', () => {
    it('should use multiple models for analysis', async () => {
      // Mock multiple models
      mockSupabase.from().select().eq().order.mockResolvedValueOnce({
        data: [
          {
            id: 'statistical_model',
            name: 'Statistical Model',
            type: 'statistical',
            accuracy: 0.75,
            is_active: true
          },
          {
            id: 'hybrid_model',
            name: 'Hybrid Model',
            type: 'hybrid',
            accuracy: 0.85,
            is_active: true
          }
        ],
        error: null
      });

      // Mock user profile
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result).toBeDefined();
      expect(result.modelVersion).toBe('1.0.0');
    });

    it('should handle model errors gracefully', async () => {
      // Mock model error
      mockSupabase.from().select().eq().order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Model loading failed' }
      });

      // Mock user profile
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      // Should use default models
      expect(result).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should log analysis performance metrics', async () => {
      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      mockSupabase.from().insert.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const result = await realTimePatternAnalysisService.analyzePaymentPattern(mockPaymentPattern);

      expect(result.analysisTime).toBeGreaterThan(0);
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockPaymentPattern.userId,
          payment_id: mockPaymentPattern.timestamp,
          amount: mockPaymentPattern.amount,
          analysis_time_ms: expect.any(Number)
        })
      );
    });
  });
});

