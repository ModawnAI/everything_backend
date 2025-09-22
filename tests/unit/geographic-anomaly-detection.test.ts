/**
 * Unit Tests for Geographic Anomaly Detection Service
 * 
 * Tests for IP-based geographic anomaly detection including:
 * - Geolocation data fetching and caching
 * - Anomaly detection algorithms
 * - Travel analysis and impossible travel detection
 * - Country risk assessment
 * - User geographic profiling
 * - Alert generation and management
 */

import { GeographicAnomalyDetectionService, GeolocationData, GeographicAnomalyRequest } from '../../src/services/geographic-anomaly-detection.service';
import { getSupabaseClient } from '../../src/config/database';

// Mock Supabase client
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn()
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('GeographicAnomalyDetectionService', () => {
  let service: GeographicAnomalyDetectionService;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      data: null,
      error: null
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    service = new GeographicAnomalyDetectionService();
  });

  describe('detectGeographicAnomaly', () => {
    it('should detect no anomaly for normal payment from known location', async () => {
      const request: GeographicAnomalyRequest = {
        userId: 'user-123',
        paymentId: 'payment-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString()
      };

      // Mock successful geolocation data fetch
      const mockGeolocationData: GeolocationData = {
        ipAddress: '192.168.1.1',
        country: 'South Korea',
        countryCode: 'KR',
        region: 'Seoul',
        regionCode: '11',
        city: 'Seoul',
        latitude: 37.5665,
        longitude: 126.9780,
        timezone: 'Asia/Seoul',
        isVpn: false,
        isProxy: false,
        isTor: false,
        isp: 'Local Network',
        organization: 'Local ISP',
        asn: 'AS12345',
        riskScore: 10,
        confidence: 95,
        lastUpdated: new Date().toISOString()
      };

      // Mock user profile data
      mockSupabase.data = [{
        geolocation: mockGeolocationData,
        created_at: new Date().toISOString()
      }];

      const result = await service.detectGeographicAnomaly(request);

      expect(result.isAnomaly).toBe(false);
      expect(result.anomalyScore).toBeLessThan(70);
      expect(result.riskLevel).toBe('low');
      expect(result.detectedAnomalies).toHaveLength(0);
      expect(result.geolocationData.country).toBe('South Korea');
    });

    it('should detect VPN/Proxy usage anomaly', async () => {
      const request: GeographicAnomalyRequest = {
        userId: 'user-123',
        paymentId: 'payment-123',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString()
      };

      // Mock geolocation data with VPN
      const mockGeolocationData: GeolocationData = {
        ipAddress: '1.2.3.4',
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'Mountain View',
        latitude: 37.386,
        longitude: -122.0838,
        timezone: 'America/Los_Angeles',
        isVpn: true,
        isProxy: false,
        isTor: false,
        isp: 'VPN Provider',
        organization: 'VPN Corp',
        asn: 'AS12345',
        riskScore: 80,
        confidence: 90,
        lastUpdated: new Date().toISOString()
      };

      mockSupabase.data = [{
        geolocation: mockGeolocationData,
        created_at: new Date().toISOString()
      }];

      const result = await service.detectGeographicAnomaly(request);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBeGreaterThanOrEqual(70);
      expect(result.riskLevel).toBe('high');
      expect(result.detectedAnomalies).toHaveLength(1);
      expect(result.detectedAnomalies[0].type).toBe('vpn_proxy');
      expect(result.detectedAnomalies[0].severity).toBe('high');
    });

    it('should detect new country anomaly', async () => {
      const request: GeographicAnomalyRequest = {
        userId: 'user-123',
        paymentId: 'payment-123',
        ipAddress: '8.8.8.8',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString()
      };

      // Mock user profile with different primary location
      mockSupabase.data = [{
        geolocation: {
          country: 'South Korea',
          countryCode: 'KR',
          region: 'Seoul',
          city: 'Seoul',
          latitude: 37.5665,
          longitude: 126.9780,
          timezone: 'Asia/Seoul'
        },
        created_at: new Date().toISOString()
      }];

      const result = await service.detectGeographicAnomaly(request);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBeGreaterThanOrEqual(70);
      expect(result.riskLevel).toBe('high');
      expect(result.detectedAnomalies).toHaveLength(1);
      expect(result.detectedAnomalies[0].type).toBe('new_country');
      expect(result.detectedAnomalies[0].description).toContain('new country');
    });

    it('should detect high-risk country anomaly', async () => {
      const request: GeographicAnomalyRequest = {
        userId: 'user-123',
        paymentId: 'payment-123',
        ipAddress: '5.6.7.8',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString()
      };

      // Mock geolocation data for high-risk country
      const mockGeolocationData: GeolocationData = {
        ipAddress: '5.6.7.8',
        country: 'Unknown',
        countryCode: 'XX',
        region: 'Unknown',
        regionCode: 'XX',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
        isVpn: true,
        isProxy: true,
        isTor: false,
        isp: 'Unknown',
        organization: 'Unknown',
        asn: 'AS00000',
        riskScore: 100,
        confidence: 0,
        lastUpdated: new Date().toISOString()
      };

      mockSupabase.data = [{
        geolocation: mockGeolocationData,
        created_at: new Date().toISOString()
      }];

      const result = await service.detectGeographicAnomaly(request);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBe(100);
      expect(result.riskLevel).toBe('critical');
      expect(result.detectedAnomalies).toHaveLength(2); // high_risk_country + vpn_proxy
      expect(result.detectedAnomalies.some(a => a.type === 'high_risk_country')).toBe(true);
      expect(result.detectedAnomalies.some(a => a.type === 'vpn_proxy')).toBe(true);
    });

    it('should detect impossible travel anomaly', async () => {
      const request: GeographicAnomalyRequest = {
        userId: 'user-123',
        paymentId: 'payment-123',
        ipAddress: '8.8.8.8',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        previousLocation: {
          country: 'South Korea',
          region: 'Seoul',
          city: 'Seoul',
          latitude: 37.5665,
          longitude: 126.9780,
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
        }
      };

      mockSupabase.data = [{
        geolocation: {
          country: 'South Korea',
          countryCode: 'KR',
          region: 'Seoul',
          city: 'Seoul',
          latitude: 37.5665,
          longitude: 126.9780,
          timezone: 'Asia/Seoul'
        },
        created_at: new Date().toISOString()
      }];

      const result = await service.detectGeographicAnomaly(request);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBeGreaterThanOrEqual(70);
      expect(result.riskLevel).toBe('high');
      expect(result.travelAnalysis.distance).toBeGreaterThan(0);
      expect(result.travelAnalysis.isPossible).toBe(true); // Same location, so possible
    });

    it('should handle analysis errors gracefully', async () => {
      const request: GeographicAnomalyRequest = {
        userId: 'user-123',
        paymentId: 'payment-123',
        ipAddress: 'invalid-ip',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString()
      };

      // Mock Supabase error
      mockSupabase.error = new Error('Database connection failed');

      const result = await service.detectGeographicAnomaly(request);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBe(100);
      expect(result.riskLevel).toBe('critical');
      expect(result.detectedAnomalies).toHaveLength(1);
      expect(result.detectedAnomalies[0].type).toBe('suspicious_isp');
      expect(result.detectedAnomalies[0].description).toContain('analysis failed');
    });
  });

  describe('geolocation data handling', () => {
    it('should cache geolocation data correctly', async () => {
      const ipAddress = '8.8.8.8';
      
      // First call should fetch from API
      const result1 = await service['getGeolocationData'](ipAddress);
      expect(result1.country).toBe('United States');
      expect(result1.countryCode).toBe('US');

      // Second call should use cache
      const result2 = await service['getGeolocationData'](ipAddress);
      expect(result2).toEqual(result1);
    });

    it('should handle local IP addresses correctly', async () => {
      const localIPs = ['192.168.1.1', '10.0.0.1', '127.0.0.1'];
      
      for (const ip of localIPs) {
        const result = await service['getGeolocationData'](ip);
        expect(result.country).toBe('South Korea');
        expect(result.countryCode).toBe('KR');
        expect(result.isVpn).toBe(false);
        expect(result.isProxy).toBe(false);
        expect(result.riskScore).toBe(10);
      }
    });

    it('should handle unknown IP addresses as suspicious', async () => {
      const unknownIP = '999.999.999.999';
      const result = await service['getGeolocationData'](unknownIP);
      
      expect(result.country).toBe('Unknown');
      expect(result.countryCode).toBe('XX');
      expect(result.isVpn).toBe(true);
      expect(result.isProxy).toBe(true);
      expect(result.riskScore).toBe(80);
      expect(result.confidence).toBe(10);
    });
  });

  describe('travel analysis', () => {
    it('should calculate distance correctly between two points', () => {
      const distance = service['calculateDistance'](37.5665, 126.9780, 37.386, -122.0838);
      expect(distance).toBeGreaterThan(9000); // Seoul to Mountain View is ~9000+ km
      expect(distance).toBeLessThan(10000);
    });

    it('should detect impossible travel for very short time intervals', () => {
      const previousLocation = {
        country: 'South Korea',
        region: 'Seoul',
        city: 'Seoul',
        latitude: 37.5665,
        longitude: 126.9780,
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
      };

      const currentLocation: GeolocationData = {
        ipAddress: '8.8.8.8',
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'Mountain View',
        latitude: 37.386,
        longitude: -122.0838,
        timezone: 'America/Los_Angeles',
        isVpn: false,
        isProxy: false,
        isTor: false,
        isp: 'Google LLC',
        organization: 'Google',
        asn: 'AS15169',
        riskScore: 20,
        confidence: 98,
        lastUpdated: new Date().toISOString()
      };

      const travelAnalysis = service['analyzeTravel'](
        previousLocation,
        currentLocation,
        new Date().toISOString()
      );

      expect(travelAnalysis.distance).toBeGreaterThan(9000);
      expect(travelAnalysis.travelTime).toBeLessThan(1); // Less than 1 hour
      expect(travelAnalysis.isPossible).toBe(false); // Impossible to travel 9000+ km in 5 minutes
      expect(travelAnalysis.requiredSpeed).toBeGreaterThan(1000); // km/h
    });

    it('should allow reasonable travel times', () => {
      const previousLocation = {
        country: 'South Korea',
        region: 'Seoul',
        city: 'Seoul',
        latitude: 37.5665,
        longitude: 126.9780,
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
      };

      const currentLocation: GeolocationData = {
        ipAddress: '8.8.8.8',
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'Mountain View',
        latitude: 37.386,
        longitude: -122.0838,
        timezone: 'America/Los_Angeles',
        isVpn: false,
        isProxy: false,
        isTor: false,
        isp: 'Google LLC',
        organization: 'Google',
        asn: 'AS15169',
        riskScore: 20,
        confidence: 98,
        lastUpdated: new Date().toISOString()
      };

      const travelAnalysis = service['analyzeTravel'](
        previousLocation,
        currentLocation,
        new Date().toISOString()
      );

      expect(travelAnalysis.distance).toBeGreaterThan(9000);
      expect(travelAnalysis.travelTime).toBe(12);
      expect(travelAnalysis.isPossible).toBe(true); // Possible to travel 9000+ km in 12 hours
      expect(travelAnalysis.requiredSpeed).toBeLessThan(1000); // km/h
    });
  });

  describe('anomaly detection algorithms', () => {
    it('should detect VPN/Proxy usage correctly', () => {
      const isSuspicious = service['isSuspiciousISP']('VPN Provider Inc', 'Privacy Corp');
      expect(isSuspicious).toBe(true);

      const isNotSuspicious = service['isSuspiciousISP']('Google LLC', 'Google Inc');
      expect(isNotSuspicious).toBe(false);
    });

    it('should calculate anomaly score correctly', () => {
      const anomalies = [
        { score: 80, severity: 'high' },
        { score: 60, severity: 'medium' }
      ];
      const travelAnalysis = { isPossible: true, requiredSpeed: 100 };

      const score = service['calculateAnomalyScore'](anomalies, travelAnalysis);
      expect(score).toBe(80); // Max score from anomalies
    });

    it('should add travel penalty to anomaly score', () => {
      const anomalies = [
        { score: 50, severity: 'medium' }
      ];
      const travelAnalysis = { isPossible: false, requiredSpeed: 2000 };

      const score = service['calculateAnomalyScore'](anomalies, travelAnalysis);
      expect(score).toBe(100); // 50 + 50 penalty = 100 (capped)
    });

    it('should determine risk level correctly', () => {
      expect(service['determineRiskLevel'](95, [{ severity: 'critical' }])).toBe('critical');
      expect(service['determineRiskLevel'](75, [{ severity: 'high' }])).toBe('high');
      expect(service['determineRiskLevel'](50, [{ severity: 'medium' }])).toBe('medium');
      expect(service['determineRiskLevel'](20, [{ severity: 'low' }])).toBe('low');
    });
  });

  describe('user geographic profiling', () => {
    it('should build geographic profile from historical data', () => {
      const locations = [
        {
          geolocation: {
            country: 'South Korea',
            countryCode: 'KR',
            region: 'Seoul',
            city: 'Seoul'
          },
          created_at: new Date().toISOString()
        },
        {
          geolocation: {
            country: 'South Korea',
            countryCode: 'KR',
            region: 'Seoul',
            city: 'Seoul'
          },
          created_at: new Date().toISOString()
        },
        {
          geolocation: {
            country: 'United States',
            countryCode: 'US',
            region: 'California',
            city: 'Mountain View'
          },
          created_at: new Date().toISOString()
        }
      ];

      const profile = service['buildGeographicProfile']('user-123', locations);

      expect(profile.userId).toBe('user-123');
      expect(profile.primaryLocation.country).toBe('South Korea');
      expect(profile.travelPatterns.frequentCountries).toHaveLength(2);
      expect(profile.travelPatterns.frequentCountries[0].country).toBe('South Korea');
      expect(profile.travelPatterns.frequentCountries[0].frequency).toBe(2);
    });

    it('should create default profile for user with no history', () => {
      const profile = service['createDefaultGeographicProfile']('user-123');

      expect(profile.userId).toBe('user-123');
      expect(profile.primaryLocation.country).toBe('Unknown');
      expect(profile.travelPatterns.frequentCountries).toHaveLength(0);
      expect(profile.riskIndicators.newLocationRisk).toBe(50);
    });
  });

  describe('recommendations generation', () => {
    it('should generate appropriate recommendations for critical risk', () => {
      const anomalies = [
        { type: 'high_risk_country', severity: 'critical', description: 'High risk country' }
      ];
      const travelAnalysis = { isPossible: false };
      const riskLevel = 'critical';

      const recommendations = service['generateRecommendations'](anomalies, travelAnalysis, riskLevel);

      expect(recommendations).toContain('Immediate manual review required - critical geographic risk detected');
      expect(recommendations).toContain('Consider blocking payment and contacting user');
    });

    it('should generate specific recommendations for VPN usage', () => {
      const anomalies = [
        { type: 'vpn_proxy', severity: 'high', description: 'VPN usage detected' }
      ];
      const travelAnalysis = { isPossible: true };
      const riskLevel = 'high';

      const recommendations = service['generateRecommendations'](anomalies, travelAnalysis, riskLevel);

      expect(recommendations).toContain('VPN/Proxy usage detected - verify user identity');
    });

    it('should generate no action recommendation for low risk', () => {
      const anomalies: any[] = [];
      const travelAnalysis = { isPossible: true };
      const riskLevel = 'low';

      const recommendations = service['generateRecommendations'](anomalies, travelAnalysis, riskLevel);

      expect(recommendations).toContain('No immediate action required');
    });
  });

  describe('error handling', () => {
    it('should handle geolocation API failures', async () => {
      const request: GeographicAnomalyRequest = {
        userId: 'user-123',
        paymentId: 'payment-123',
        ipAddress: 'api-failure-ip',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString()
      };

      // Mock API failure by throwing error in fetchGeolocationFromAPI
      jest.spyOn(service as any, 'fetchGeolocationFromAPI').mockRejectedValue(new Error('API failure'));

      const result = await service.detectGeographicAnomaly(request);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyScore).toBe(100);
      expect(result.riskLevel).toBe('critical');
    });

    it('should handle database errors gracefully', async () => {
      const request: GeographicAnomalyRequest = {
        userId: 'user-123',
        paymentId: 'payment-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString()
      };

      // Mock database error
      mockSupabase.error = new Error('Database connection failed');

      const result = await service.detectGeographicAnomaly(request);

      expect(result.isAnomaly).toBe(false); // Should still work with default profile
      expect(result.geolocationData.country).toBe('South Korea');
    });
  });

  describe('performance and caching', () => {
    it('should use cached geolocation data when available', async () => {
      const ipAddress = '8.8.8.8';
      
      // First call
      await service['getGeolocationData'](ipAddress);
      
      // Second call should use cache
      const startTime = Date.now();
      await service['getGeolocationData'](ipAddress);
      const endTime = Date.now();
      
      // Should be very fast (cached)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should cache user profiles correctly', async () => {
      const userId = 'user-123';
      
      // Mock user profile data
      mockSupabase.data = [{
        geolocation: {
          country: 'South Korea',
          countryCode: 'KR',
          region: 'Seoul',
          city: 'Seoul'
        },
        created_at: new Date().toISOString()
      }];

      // First call
      const profile1 = await service['getUserGeographicProfile'](userId);
      
      // Second call should use cache
      const profile2 = await service['getUserGeographicProfile'](userId);
      
      expect(profile1).toEqual(profile2);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Only called once due to caching
    });
  });
});

