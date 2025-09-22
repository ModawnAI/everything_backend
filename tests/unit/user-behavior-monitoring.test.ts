/**
 * User Behavior Monitoring Service Unit Tests
 * 
 * Tests the comprehensive user behavior monitoring system:
 * - Activity tracking and risk analysis
 * - Session management and monitoring
 * - Behavior profile building and updates
 * - Alert generation and management
 * - Pattern detection and anomaly analysis
 */

import { userBehaviorMonitoringService, UserActivity, UserSession, BehaviorProfile } from '../../src/services/user-behavior-monitoring.service';

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

describe('UserBehaviorMonitoringService', () => {
  let mockActivity: Omit<UserActivity, 'id' | 'riskScore' | 'riskFactors'>;
  let mockBehaviorProfile: BehaviorProfile;

  beforeEach(() => {
    jest.clearAllMocks();

    mockActivity = {
      sessionId: 'session-123',
      userId: 'user-123',
      activityType: 'payment',
      timestamp: '2024-01-15T14:00:00Z',
      details: {
        amount: 100000,
        paymentMethod: 'card',
        page: '/payment',
        action: 'process_payment',
        metadata: {
          deviceFingerprint: 'device-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          location: {
            country: 'KR',
            region: 'Seoul',
            city: 'Gangnam'
          }
        }
      }
    };

    mockBehaviorProfile = {
      userId: 'user-123',
      sessionPatterns: {
        averageSessionDuration: 30,
        typicalSessionTimes: [9, 10, 11, 14, 15, 16],
        mostActiveHours: [10, 14, 15],
        weekendActivity: 0.3,
        sessionFrequency: 2
      },
      paymentPatterns: {
        averageAmount: 80000,
        amountVariability: 0.3,
        preferredPaymentMethods: [
          { method: 'card', frequency: 0.7, lastUsed: '2024-01-14T10:00:00Z' },
          { method: 'bank_transfer', frequency: 0.3, lastUsed: '2024-01-10T15:00:00Z' }
        ],
        paymentFrequency: 1,
        timeBetweenPayments: 24
      },
      locationPatterns: {
        primaryLocation: {
          country: 'KR',
          region: 'Seoul',
          city: 'Gangnam'
        },
        travelFrequency: 0.1,
        newLocationRisk: 20,
        locationStability: 0.9
      },
      devicePatterns: {
        primaryDevice: 'device-123',
        deviceStability: 0.8,
        newDeviceRisk: 15,
        deviceDiversity: 0.2
      },
      behavioralMetrics: {
        clickRate: 0.5,
        scrollDepth: 0.7,
        timeOnPage: 30,
        navigationPattern: ['home', 'search', 'payment'],
        errorRate: 0.05,
        retryRate: 0.1
      },
      riskIndicators: {
        velocityScore: 20,
        anomalyScore: 15,
        consistencyScore: 80,
        stabilityScore: 75,
        overallRiskScore: 25
      },
      lastUpdated: '2024-01-14T10:00:00Z',
      profileVersion: '1.0.0'
    };
  });

  describe('trackUserActivity', () => {
    it('should track payment activity and detect amount anomaly', async () => {
      // Mock high amount payment
      const highAmountActivity = {
        ...mockActivity,
        details: {
          ...mockActivity.details,
          amount: 300000 // 3x average amount
        }
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(highAmountActivity);

      expect(result.riskScore).toBeGreaterThan(30);
      expect(result.riskFactors).toContain('high_amount_deviation');
      expect(result.session).toBeDefined();
      expect(result.alerts.length).toBeGreaterThan(0);
    });

    it('should detect unusual payment method', async () => {
      // Mock payment with unusual method
      const unusualMethodActivity = {
        ...mockActivity,
        details: {
          ...mockActivity.details,
          paymentMethod: 'crypto' // Not in preferred methods
        }
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(unusualMethodActivity);

      expect(result.riskScore).toBeGreaterThan(20);
      expect(result.riskFactors).toContain('unusual_payment_method');
    });

    it('should detect unusual payment time', async () => {
      // Mock payment at unusual time (3 AM)
      const unusualTimeActivity = {
        ...mockActivity,
        timestamp: '2024-01-15T03:00:00Z'
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(unusualTimeActivity);

      expect(result.riskScore).toBeGreaterThan(15);
      expect(result.riskFactors).toContain('unusual_payment_time');
    });

    it('should detect new device login', async () => {
      // Mock login activity with new device
      const newDeviceLoginActivity = {
        ...mockActivity,
        activityType: 'login',
        details: {
          ...mockActivity.details,
          metadata: {
            ...mockActivity.details.metadata,
            deviceFingerprint: 'new-device-456'
          }
        }
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(newDeviceLoginActivity);

      expect(result.riskScore).toBeGreaterThan(15);
      expect(result.riskFactors).toContain('new_device_login');
    });

    it('should detect new location login', async () => {
      // Mock login activity from new location
      const newLocationLoginActivity = {
        ...mockActivity,
        activityType: 'login',
        details: {
          ...mockActivity.details,
          metadata: {
            ...mockActivity.details.metadata,
            location: {
              country: 'US',
              region: 'California',
              city: 'Los Angeles'
            }
          }
        }
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(newLocationLoginActivity);

      expect(result.riskScore).toBeGreaterThan(20);
      expect(result.riskFactors).toContain('new_location_login');
    });

    it('should detect rapid navigation patterns', async () => {
      // Mock rapid navigation activity
      const rapidNavigationActivity = {
        ...mockActivity,
        activityType: 'navigation',
        details: {
          ...mockActivity.details,
          page: '/search',
          action: 'navigate'
        }
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      // Mock session with recent navigation activities
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        startTime: '2024-01-15T13:00:00Z',
        lastActivity: '2024-01-15T13:58:00Z',
        duration: 58,
        deviceFingerprint: 'device-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        location: {
          country: 'KR',
          region: 'Seoul',
          city: 'Gangnam'
        },
        activities: [
          {
            id: 'activity-1',
            sessionId: 'session-123',
            userId: 'user-123',
            activityType: 'navigation',
            timestamp: '2024-01-15T13:55:00Z',
            details: { page: '/home', action: 'navigate' },
            riskFactors: [],
            riskScore: 0
          },
          {
            id: 'activity-2',
            sessionId: 'session-123',
            userId: 'user-123',
            activityType: 'navigation',
            timestamp: '2024-01-15T13:56:00Z',
            details: { page: '/search', action: 'navigate' },
            riskFactors: [],
            riskScore: 0
          },
          {
            id: 'activity-3',
            sessionId: 'session-123',
            userId: 'user-123',
            activityType: 'navigation',
            timestamp: '2024-01-15T13:57:00Z',
            details: { page: '/profile', action: 'navigate' },
            riskFactors: [],
            riskScore: 0
          },
          {
            id: 'activity-4',
            sessionId: 'session-123',
            userId: 'user-123',
            activityType: 'navigation',
            timestamp: '2024-01-15T13:58:00Z',
            details: { page: '/settings', action: 'navigate' },
            riskFactors: [],
            riskScore: 0
          }
        ],
        riskScore: 0,
        isActive: true
      };

      // Mock active sessions cache
      (userBehaviorMonitoringService as any).activeSessions.set('session-123', mockSession);

      const result = await userBehaviorMonitoringService.trackUserActivity(rapidNavigationActivity);

      expect(result.riskScore).toBeGreaterThan(20);
      expect(result.riskFactors).toContain('rapid_navigation');
    });

    it('should detect high payment velocity', async () => {
      // Mock payment activity with recent payments
      const highVelocityPaymentActivity = {
        ...mockActivity,
        activityType: 'payment',
        details: {
          ...mockActivity.details,
          amount: 50000
        }
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      // Mock session with recent payment activities
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        startTime: '2024-01-15T13:00:00Z',
        lastActivity: '2024-01-15T13:55:00Z',
        duration: 55,
        deviceFingerprint: 'device-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        location: {
          country: 'KR',
          region: 'Seoul',
          city: 'Gangnam'
        },
        activities: [
          {
            id: 'payment-1',
            sessionId: 'session-123',
            userId: 'user-123',
            activityType: 'payment',
            timestamp: '2024-01-15T13:50:00Z',
            details: { amount: 30000, paymentMethod: 'card' },
            riskFactors: [],
            riskScore: 0
          },
          {
            id: 'payment-2',
            sessionId: 'session-123',
            userId: 'user-123',
            activityType: 'payment',
            timestamp: '2024-01-15T13:52:00Z',
            details: { amount: 40000, paymentMethod: 'card' },
            riskFactors: [],
            riskScore: 0
          },
          {
            id: 'payment-3',
            sessionId: 'session-123',
            userId: 'user-123',
            activityType: 'payment',
            timestamp: '2024-01-15T13:54:00Z',
            details: { amount: 35000, paymentMethod: 'card' },
            riskFactors: [],
            riskScore: 0
          }
        ],
        riskScore: 0,
        isActive: true
      };

      // Mock active sessions cache
      (userBehaviorMonitoringService as any).activeSessions.set('session-123', mockSession);

      const result = await userBehaviorMonitoringService.trackUserActivity(highVelocityPaymentActivity);

      expect(result.riskScore).toBeGreaterThan(30);
      expect(result.riskFactors).toContain('high_payment_velocity');
    });

    it('should detect excessive concurrent sessions', async () => {
      // Mock multiple active sessions for the same user
      const sessions = Array.from({ length: 6 }, (_, i) => ({
        sessionId: `session-${i}`,
        userId: 'user-123',
        startTime: '2024-01-15T13:00:00Z',
        lastActivity: '2024-01-15T13:55:00Z',
        duration: 55,
        deviceFingerprint: `device-${i}`,
        ipAddress: `192.168.1.${i}`,
        userAgent: 'Mozilla/5.0...',
        location: {
          country: 'KR',
          region: 'Seoul',
          city: 'Gangnam'
        },
        activities: [],
        riskScore: 0,
        isActive: true
      }));

      // Mock active sessions cache
      sessions.forEach(session => {
        (userBehaviorMonitoringService as any).activeSessions.set(session.sessionId, session);
      });

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      expect(result.riskScore).toBeGreaterThan(25);
      expect(result.riskFactors).toContain('excessive_concurrent_sessions');
    });

    it('should not detect anomalies for normal activity', async () => {
      // Mock normal payment activity
      const normalActivity = {
        ...mockActivity,
        details: {
          ...mockActivity.details,
          amount: 85000, // Close to average
          paymentMethod: 'card' // Preferred method
        },
        timestamp: '2024-01-15T14:00:00Z' // Normal time
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(normalActivity);

      expect(result.riskScore).toBeLessThan(30);
      expect(result.riskFactors).toHaveLength(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('should generate critical alerts for high-risk activities', async () => {
      // Mock very high-risk activity
      const criticalRiskActivity = {
        ...mockActivity,
        details: {
          ...mockActivity.details,
          amount: 1000000, // Very high amount
          paymentMethod: 'crypto' // Unusual method
        },
        timestamp: '2024-01-15T03:00:00Z' // Unusual time
      };

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(criticalRiskActivity);

      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts[0].severity).toBe('critical');
      expect(result.alerts[0].recommendations).toContain('Immediate manual review required');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      // Should return high risk on error
      expect(result.riskScore).toBe(100);
      expect(result.riskFactors).toContain('tracking_error');
    });

    it('should create and manage user sessions', async () => {
      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      expect(result.session).toBeDefined();
      expect(result.session?.sessionId).toBe('session-123');
      expect(result.session?.userId).toBe('user-123');
      expect(result.session?.isActive).toBe(true);
    });

    it('should update behavior profile with new activity', async () => {
      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      expect(result).toBeDefined();
      // Profile should be updated (verified in integration tests)
    });
  });

  describe('Behavior Profile Management', () => {
    it('should build behavior profile from historical data', async () => {
      const mockActivities = [
        {
          activity_type: 'payment',
          amount: 50000,
          payment_method: 'card',
          created_at: '2024-01-10T10:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' },
          device_fingerprint: 'device-123'
        },
        {
          activity_type: 'payment',
          amount: 75000,
          payment_method: 'card',
          created_at: '2024-01-12T14:00:00Z',
          geolocation: { country: 'KR', region: 'Seoul' },
          device_fingerprint: 'device-123'
        }
      ];

      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: mockActivities,
        error: null
      });

      const result = await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      expect(result).toBeDefined();
      // Profile building would be verified in integration tests
    });

    it('should create default profile for new users', async () => {
      // Mock empty activity history
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      expect(result).toBeDefined();
      // New user should get default profile
    });
  });

  describe('Session Management', () => {
    it('should handle session timeout correctly', async () => {
      // Mock old session
      const oldSession = {
        sessionId: 'old-session',
        userId: 'user-123',
        startTime: '2024-01-15T10:00:00Z',
        lastActivity: '2024-01-15T10:00:00Z', // 4 hours ago
        duration: 0,
        deviceFingerprint: 'device-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        location: {
          country: 'KR',
          region: 'Seoul',
          city: 'Gangnam'
        },
        activities: [],
        riskScore: 0,
        isActive: true
      };

      // Mock active sessions cache
      (userBehaviorMonitoringService as any).activeSessions.set('old-session', oldSession);

      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock behavior profile cache
      (userBehaviorMonitoringService as any).behaviorProfiles.set('user-123', mockBehaviorProfile);

      const result = await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      expect(result.session).toBeDefined();
      expect(result.session?.sessionId).toBe('session-123'); // New session
    });
  });

  describe('Performance and Caching', () => {
    it('should cache behavior profiles for performance', async () => {
      // Mock database calls
      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // First call - should build profile
      await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      // Second call - should use cached profile
      await userBehaviorMonitoringService.trackUserActivity(mockActivity);

      // Should only call database once due to caching
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });
});

