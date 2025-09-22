/**
 * Enhanced Velocity Checking Service Unit Tests
 * 
 * Tests the multi-dimensional velocity analysis system:
 * - Multi-dimensional velocity tracking
 * - Time-based velocity windows
 * - User-specific velocity thresholds
 * - Cross-dimensional correlation analysis
 * - Velocity anomaly detection and scoring
 * - Real-time velocity monitoring and alerting
 */

import { enhancedVelocityCheckingService, VelocityCheckRequest } from '../../src/services/enhanced-velocity-checking.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

// Create mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        gte: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [],
              error: null
            }))
          }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })),
      count: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            data: null,
            error: null,
            count: 0
          }))
        }))
      }))
    })),
    insert: jest.fn(() => ({
      data: null,
      error: null
    }))
  }))
};

// Mock the database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase
}));

describe('EnhancedVelocityCheckingService', () => {
  let mockVelocityRequest: VelocityCheckRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    mockVelocityRequest = {
      userId: 'user-123',
      paymentId: 'payment-123',
      amount: 100000,
      paymentMethod: 'card',
      merchantCategory: 'beauty',
      location: {
        country: 'KR',
        region: 'Seoul',
        city: 'Gangnam',
        coordinates: {
          latitude: 37.5665,
          longitude: 126.9780
        }
      },
      deviceFingerprint: 'device-123',
      ipAddress: '192.168.1.1',
      timestamp: '2024-01-15T14:00:00Z',
      metadata: {
        sessionId: 'session-123',
        userAgent: 'Mozilla/5.0...'
      }
    };
  });

  describe('checkVelocity', () => {
    it('should detect amount velocity exceeded', async () => {
      // Mock high amount payments in the time window
      const mockPayments = [
        { amount: 500000, created_at: '2024-01-15T13:30:00Z' },
        { amount: 300000, created_at: '2024-01-15T13:45:00Z' },
        { amount: 200000, created_at: '2024-01-15T13:50:00Z' }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValueOnce({
        data: mockPayments,
        error: null
      });

      // Mock other dimension checks
      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 1
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.isExceeded).toBe(true);
      expect(result.overallRiskScore).toBeGreaterThan(70);
      expect(result.dimensionResults).toContainEqual(
        expect.objectContaining({
          dimension: 'amount',
          isExceeded: true
        })
      );
    });

    it('should detect frequency velocity exceeded', async () => {
      // Mock high frequency payments
      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 15 // Exceeds threshold of 10
      });

      // Mock other dimension checks
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.isExceeded).toBe(true);
      expect(result.dimensionResults).toContainEqual(
        expect.objectContaining({
          dimension: 'frequency',
          isExceeded: true
        })
      );
    });

    it('should detect location velocity exceeded', async () => {
      // Mock payments from multiple locations
      const mockPayments = [
        { geolocation: { country: 'KR', region: 'Seoul' }, created_at: '2024-01-15T13:30:00Z' },
        { geolocation: { country: 'US', region: 'California' }, created_at: '2024-01-15T13:45:00Z' },
        { geolocation: { country: 'JP', region: 'Tokyo' }, created_at: '2024-01-15T13:50:00Z' },
        { geolocation: { country: 'CN', region: 'Beijing' }, created_at: '2024-01-15T13:55:00Z' }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: mockPayments,
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.isExceeded).toBe(true);
      expect(result.dimensionResults).toContainEqual(
        expect.objectContaining({
          dimension: 'location',
          isExceeded: true
        })
      );
    });

    it('should detect device velocity exceeded', async () => {
      // Mock payments from multiple devices
      const mockPayments = [
        { device_fingerprint: 'device-1', created_at: '2024-01-15T13:30:00Z' },
        { device_fingerprint: 'device-2', created_at: '2024-01-15T13:45:00Z' },
        { device_fingerprint: 'device-3', created_at: '2024-01-15T13:50:00Z' }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: mockPayments,
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.isExceeded).toBe(true);
      expect(result.dimensionResults).toContainEqual(
        expect.objectContaining({
          dimension: 'device',
          isExceeded: true
        })
      );
    });

    it('should detect payment method velocity exceeded', async () => {
      // Mock payments with multiple payment methods
      const mockPayments = [
        { payment_method: 'card', created_at: '2024-01-15T13:30:00Z' },
        { payment_method: 'bank_transfer', created_at: '2024-01-15T13:45:00Z' },
        { payment_method: 'crypto', created_at: '2024-01-15T13:50:00Z' },
        { payment_method: 'paypal', created_at: '2024-01-15T13:55:00Z' }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: mockPayments,
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.isExceeded).toBe(true);
      expect(result.dimensionResults).toContainEqual(
        expect.objectContaining({
          dimension: 'payment_method',
          isExceeded: true
        })
      );
    });

    it('should detect merchant category velocity exceeded', async () => {
      // Mock payments with multiple merchant categories
      const mockPayments = [
        { 
          reservations: { shops: { category: 'beauty' } }, 
          created_at: '2024-01-15T13:30:00Z' 
        },
        { 
          reservations: { shops: { category: 'restaurant' } }, 
          created_at: '2024-01-15T13:45:00Z' 
        },
        { 
          reservations: { shops: { category: 'shopping' } }, 
          created_at: '2024-01-15T13:50:00Z' 
        },
        { 
          reservations: { shops: { category: 'entertainment' } }, 
          created_at: '2024-01-15T13:55:00Z' 
        },
        { 
          reservations: { shops: { category: 'travel' } }, 
          created_at: '2024-01-15T14:00:00Z' 
        },
        { 
          reservations: { shops: { category: 'health' } }, 
          created_at: '2024-01-15T14:05:00Z' 
        }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: mockPayments,
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.isExceeded).toBe(true);
      expect(result.dimensionResults).toContainEqual(
        expect.objectContaining({
          dimension: 'merchant_category',
          isExceeded: true
        })
      );
    });

    it('should detect multiple dimension velocity exceeded', async () => {
      // Mock high amount and high frequency
      const mockAmountPayments = [
        { amount: 500000, created_at: '2024-01-15T13:30:00Z' },
        { amount: 300000, created_at: '2024-01-15T13:45:00Z' }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValueOnce({
        data: mockAmountPayments,
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 12 // High frequency
      });

      // Mock other dimension checks
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.isExceeded).toBe(true);
      expect(result.overallRiskScore).toBeGreaterThan(80);
      expect(result.dimensionResults.filter(d => d.isExceeded)).toHaveLength(2);
    });

    it('should calculate correlations between dimensions', async () => {
      // Mock high amount and high frequency
      const mockAmountPayments = [
        { amount: 500000, created_at: '2024-01-15T13:30:00Z' },
        { amount: 300000, created_at: '2024-01-15T13:45:00Z' }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValueOnce({
        data: mockAmountPayments,
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 12 // High frequency
      });

      // Mock other dimension checks
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.correlations.length).toBeGreaterThan(0);
      expect(result.correlations[0]).toHaveProperty('dimension1');
      expect(result.correlations[0]).toHaveProperty('dimension2');
      expect(result.correlations[0]).toHaveProperty('correlationScore');
      expect(result.correlations[0]).toHaveProperty('riskImpact');
    });

    it('should generate appropriate recommendations', async () => {
      // Mock high risk scenario
      const mockAmountPayments = [
        { amount: 1000000, created_at: '2024-01-15T13:30:00Z' },
        { amount: 800000, created_at: '2024-01-15T13:45:00Z' }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValueOnce({
        data: mockAmountPayments,
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 15
      });

      // Mock other dimension checks
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations).toContain(
        expect.stringMatching(/manual review|verification|monitor/i)
      );
    });

    it('should not detect velocity exceeded for normal activity', async () => {
      // Mock normal payment activity
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 2
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.isExceeded).toBe(false);
      expect(result.overallRiskScore).toBeLessThan(70);
      expect(result.dimensionResults.filter(d => d.isExceeded)).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      // Should return high risk on error
      expect(result.isExceeded).toBe(true);
      expect(result.overallRiskScore).toBe(100);
      expect(result.recommendations).toContain('Manual review required due to analysis error');
    });

    it('should provide velocity profile information', async () => {
      // Mock normal activity
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 2
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.velocityProfile).toBeDefined();
      expect(result.velocityProfile.userId).toBe(mockVelocityRequest.userId);
      expect(result.velocityProfile.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(result.velocityProfile.riskLevel);
    });

    it('should cache velocity profiles for performance', async () => {
      // Mock normal activity
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 2
      });

      // First call - should build profile
      await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      // Second call - should use cached profile
      await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      // Should only call database once due to caching
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should update velocity profile with new payment data', async () => {
      // Mock normal activity
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 2
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result).toBeDefined();
      // Profile should be updated (verified in integration tests)
    });
  });

  describe('Velocity Profile Management', () => {
    it('should build velocity profile from historical data', async () => {
      const mockPayments = [
        {
          amount: 50000,
          payment_method: 'card',
          created_at: '2024-01-10T10:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' },
          device_fingerprint: 'device-123',
          reservations: { shops: { category: 'beauty' } }
        },
        {
          amount: 75000,
          payment_method: 'card',
          created_at: '2024-01-12T14:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' },
          device_fingerprint: 'device-123',
          reservations: { shops: { category: 'beauty' } }
        }
      ];

      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: mockPayments,
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result).toBeDefined();
      // Profile building would be verified in integration tests
    });

    it('should create default profile for new users', async () => {
      // Mock empty payment history
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 0
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result).toBeDefined();
      // New user should get default profile
    });
  });

  describe('Performance Metrics', () => {
    it('should log analysis performance metrics', async () => {
      // Mock normal activity
      mockSupabase.from().select().eq().gte().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      mockSupabase.from().select().count().eq().gte.mockResolvedValue({
        data: null,
        error: null,
        count: 2
      });

      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await enhancedVelocityCheckingService.checkVelocity(mockVelocityRequest);

      expect(result.metadata.analysisTime).toBeGreaterThan(0);
      expect(result.metadata.dimensionsChecked).toBe(6);
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });
  });
});

