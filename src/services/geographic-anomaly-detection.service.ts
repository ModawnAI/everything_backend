/**
 * Geographic Anomaly Detection Service
 * 
 * IP-based geographic anomaly detection for payment fraud prevention:
 * - IP geolocation analysis and validation
 * - Geographic distance and travel time calculations
 * - VPN/Proxy detection and risk assessment
 * - Country/region risk scoring and blacklisting
 * - Time zone consistency validation
 * - Geographic pattern analysis and anomaly detection
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface GeolocationData {
  ipAddress: string;
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isp: string;
  organization: string;
  asn: string;
  riskScore: number;
  confidence: number;
  lastUpdated: string;
}

export interface GeographicAnomalyRequest {
  userId: string;
  paymentId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  previousLocation?: {
    country: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  metadata?: Record<string, any>;
}

export interface GeographicAnomalyResult {
  isAnomaly: boolean;
  anomalyScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  detectedAnomalies: Array<{
    type: 'new_country' | 'impossible_travel' | 'vpn_proxy' | 'high_risk_country' | 'timezone_mismatch' | 'suspicious_isp';
    severity: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    description: string;
    details: Record<string, any>;
  }>;
  geolocationData: GeolocationData;
  travelAnalysis: {
    distance: number; // in kilometers
    travelTime: number; // in hours
    isPossible: boolean;
    requiredSpeed: number; // km/h
    timeDifference: number; // in hours
  };
  recommendations: string[];
  metadata: {
    analysisTime: number;
    dataSource: string;
    timestamp: string;
  };
}

export interface CountryRiskProfile {
  countryCode: string;
  countryName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  factors: Array<{
    factor: string;
    score: number;
    description: string;
  }>;
  isBlocked: boolean;
  requiresVerification: boolean;
  lastUpdated: string;
}

export interface UserGeographicProfile {
  userId: string;
  primaryLocation: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  travelPatterns: {
    frequentCountries: Array<{
      country: string;
      frequency: number;
      lastVisit: string;
    }>;
    travelFrequency: number;
    maxDistance: number;
    averageDistance: number;
  };
  riskIndicators: {
    vpnUsage: number;
    proxyUsage: number;
    newLocationRisk: number;
    timezoneConsistency: number;
  };
  lastUpdated: string;
  profileVersion: string;
}

export interface GeographicAlert {
  id: string;
  userId: string;
  paymentId: string;
  alertType: 'geographic_anomaly' | 'impossible_travel' | 'high_risk_location' | 'vpn_detection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  location: {
    current: GeolocationData;
    previous?: GeolocationData;
  };
  anomalyDetails: Array<{
    type: string;
    severity: string;
    score: number;
    description: string;
  }>;
  recommendations: string[];
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export class GeographicAnomalyDetectionService {
  private supabase = getSupabaseClient();
  private geolocationCache = new Map<string, GeolocationData>();
  private countryRiskProfiles = new Map<string, CountryRiskProfile>();
  private userGeographicProfiles = new Map<string, UserGeographicProfile>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MODEL_VERSION = '1.0.0';

  // High-risk countries (simplified list)
  private readonly HIGH_RISK_COUNTRIES = ['XX', 'YY', 'ZZ']; // Example blocked countries
  private readonly REQUIRES_VERIFICATION_COUNTRIES = ['US', 'CN', 'RU']; // Example countries requiring verification

  /**
   * Detect geographic anomalies for a payment request
   */
  async detectGeographicAnomaly(request: GeographicAnomalyRequest): Promise<GeographicAnomalyResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting geographic anomaly detection', { 
        userId: request.userId, 
        paymentId: request.paymentId,
        ipAddress: request.ipAddress
      });

      // Get geolocation data for the IP address
      const geolocationData = await this.getGeolocationData(request.ipAddress);
      
      // Get user's geographic profile
      const userProfile = await this.getUserGeographicProfile(request.userId);
      
      // Detect various types of anomalies
      const detectedAnomalies = await this.detectAnomalies(request, geolocationData, userProfile);
      
      // Calculate travel analysis if previous location exists
      const travelAnalysis = request.previousLocation 
        ? this.analyzeTravel(request.previousLocation, geolocationData, request.timestamp)
        : this.getDefaultTravelAnalysis();
      
      // Calculate overall anomaly score
      const anomalyScore = this.calculateAnomalyScore(detectedAnomalies, travelAnalysis);
      
      // Determine risk level
      const riskLevel = this.determineRiskLevel(anomalyScore, detectedAnomalies);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(detectedAnomalies, travelAnalysis, riskLevel);
      
      // Update user profile with new location
      await this.updateUserGeographicProfile(request.userId, geolocationData);
      
      // Generate alerts if necessary
      if (anomalyScore >= 70) {
        await this.generateGeographicAlert(request, geolocationData, detectedAnomalies, anomalyScore);
      }

      const analysisTime = Date.now() - startTime;
      
      logger.info('Geographic anomaly detection completed', {
        userId: request.userId,
        paymentId: request.paymentId,
        anomalyScore,
        riskLevel,
        detectedAnomalies: detectedAnomalies.length,
        analysisTime
      });

      return {
        isAnomaly: anomalyScore >= 70,
        anomalyScore,
        riskLevel,
        detectedAnomalies,
        geolocationData,
        travelAnalysis,
        recommendations,
        metadata: {
          analysisTime,
          dataSource: 'ip-api',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Error in geographic anomaly detection', {
        userId: request.userId,
        paymentId: request.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return safe default
      return {
        isAnomaly: true,
        anomalyScore: 100,
        riskLevel: 'critical',
        detectedAnomalies: [{
          type: 'suspicious_isp',
          severity: 'critical',
          score: 100,
          description: 'Geographic analysis failed - manual review required',
          details: { error: 'Analysis failed' }
        }],
        geolocationData: this.getDefaultGeolocationData(request.ipAddress),
        travelAnalysis: this.getDefaultTravelAnalysis(),
        recommendations: ['Manual review required due to analysis error'],
        metadata: {
          analysisTime: Date.now() - startTime,
          dataSource: 'error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get geolocation data for an IP address
   */
  private async getGeolocationData(ipAddress: string): Promise<GeolocationData> {
    // Check cache first
    const cached = this.geolocationCache.get(ipAddress);
    if (cached && this.isCacheValid(cached.lastUpdated)) {
      return cached;
    }

    try {
      // In production, this would call a real geolocation API
      const geolocationData = await this.fetchGeolocationFromAPI(ipAddress);
      
      // Cache the result
      this.geolocationCache.set(ipAddress, geolocationData);
      
      return geolocationData;

    } catch (error) {
      logger.error('Error fetching geolocation data', { ipAddress, error });
      return this.getDefaultGeolocationData(ipAddress);
    }
  }

  /**
   * Fetch geolocation data from external API (simplified implementation)
   */
  private async fetchGeolocationFromAPI(ipAddress: string): Promise<GeolocationData> {
    // This is a simplified implementation
    // In production, you would call a real geolocation API like ipapi, ipinfo, or MaxMind
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock geolocation data based on IP patterns
    const isLocalIP = ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('127.');
    
    if (isLocalIP) {
      return {
        ipAddress,
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
    }

    // Mock data for external IPs
    const mockData = {
      '8.8.8.8': {
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
        confidence: 98
      },
      '1.1.1.1': {
        country: 'Australia',
        countryCode: 'AU',
        region: 'New South Wales',
        regionCode: 'NSW',
        city: 'Sydney',
        latitude: -33.8688,
        longitude: 151.2093,
        timezone: 'Australia/Sydney',
        isVpn: false,
        isProxy: false,
        isTor: false,
        isp: 'Cloudflare Inc',
        organization: 'Cloudflare',
        asn: 'AS13335',
        riskScore: 15,
        confidence: 97
      }
    };

    const data = mockData[ipAddress as keyof typeof mockData] || {
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      regionCode: 'XX',
      city: 'Unknown',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      isVpn: true, // Unknown IPs are treated as suspicious
      isProxy: true,
      isTor: false,
      isp: 'Unknown',
      organization: 'Unknown',
      asn: 'AS00000',
      riskScore: 80,
      confidence: 10
    };

    return {
      ipAddress,
      ...data,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Detect various types of geographic anomalies
   */
  private async detectAnomalies(
    request: GeographicAnomalyRequest,
    geolocationData: GeolocationData,
    userProfile: UserGeographicProfile
  ): Promise<Array<{
    type: 'new_country' | 'impossible_travel' | 'vpn_proxy' | 'high_risk_country' | 'timezone_mismatch' | 'suspicious_isp';
    severity: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    description: string;
    details: Record<string, any>;
  }>> {
    const anomalies: Array<{
      type: 'new_country' | 'impossible_travel' | 'vpn_proxy' | 'high_risk_country' | 'timezone_mismatch' | 'suspicious_isp';
      severity: 'low' | 'medium' | 'high' | 'critical';
      score: number;
      description: string;
      details: Record<string, any>;
    }> = [];

    // Check for new country
    if (geolocationData.countryCode !== userProfile.primaryLocation.countryCode) {
      const frequency = userProfile.travelPatterns.frequentCountries.find(
        c => c.country === geolocationData.country
      )?.frequency || 0;
      
      const score = frequency < 0.1 ? 80 : 40;
      anomalies.push({
        type: 'new_country',
        severity: score >= 70 ? 'high' : 'medium',
        score,
        description: `Payment from new country: ${geolocationData.country}`,
        details: {
          currentCountry: geolocationData.country,
          previousCountry: userProfile.primaryLocation.country,
          frequency
        }
      });
    }

    // Check for VPN/Proxy usage
    if (geolocationData.isVpn || geolocationData.isProxy) {
      const score = geolocationData.isTor ? 95 : 70;
      anomalies.push({
        type: 'vpn_proxy',
        severity: score >= 90 ? 'critical' : 'high',
        score,
        description: `Payment attempted using ${geolocationData.isTor ? 'Tor' : geolocationData.isVpn ? 'VPN' : 'Proxy'}`,
        details: {
          isVpn: geolocationData.isVpn,
          isProxy: geolocationData.isProxy,
          isTor: geolocationData.isTor
        }
      });
    }

    // Check for high-risk country
    if (this.HIGH_RISK_COUNTRIES.includes(geolocationData.countryCode)) {
      anomalies.push({
        type: 'high_risk_country',
        severity: 'critical',
        score: 100,
        description: `Payment from high-risk country: ${geolocationData.country}`,
        details: {
          country: geolocationData.country,
          countryCode: geolocationData.countryCode,
          isBlocked: true
        }
      });
    }

    // Check for suspicious ISP
    if (this.isSuspiciousISP(geolocationData.isp, geolocationData.organization)) {
      anomalies.push({
        type: 'suspicious_isp',
        severity: 'medium',
        score: 60,
        description: `Payment from suspicious ISP: ${geolocationData.isp}`,
        details: {
          isp: geolocationData.isp,
          organization: geolocationData.organization,
          asn: geolocationData.asn
        }
      });
    }

    // Check for timezone mismatch
    if (request.previousLocation) {
      const timezoneMismatch = this.checkTimezoneMismatch(
        request.previousLocation,
        geolocationData,
        request.timestamp
      );
      
      if (timezoneMismatch.isMismatch) {
        anomalies.push({
          type: 'timezone_mismatch',
          severity: timezoneMismatch.severity,
          score: timezoneMismatch.score,
          description: timezoneMismatch.description,
          details: timezoneMismatch.details
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyze travel between two locations
   */
  private analyzeTravel(
    previousLocation: {
      country: string;
      region: string;
      city: string;
      latitude: number;
      longitude: number;
      timestamp: string;
    },
    currentLocation: GeolocationData,
    currentTimestamp: string
  ): {
    distance: number;
    travelTime: number;
    isPossible: boolean;
    requiredSpeed: number;
    timeDifference: number;
  } {
    // Calculate distance using Haversine formula
    const distance = this.calculateDistance(
      previousLocation.latitude,
      previousLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    // Calculate time difference
    const timeDifference = (new Date(currentTimestamp).getTime() - new Date(previousLocation.timestamp).getTime()) / (1000 * 60 * 60); // hours

    // Calculate required speed
    const requiredSpeed = timeDifference > 0 ? distance / timeDifference : 0;

    // Determine if travel is possible (assuming max speed of 1000 km/h for commercial aircraft)
    const isPossible = requiredSpeed <= 1000;

    return {
      distance,
      travelTime: timeDifference,
      isPossible,
      requiredSpeed,
      timeDifference
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check for timezone mismatch
   */
  private checkTimezoneMismatch(
    previousLocation: { timestamp: string },
    currentLocation: GeolocationData,
    currentTimestamp: string
  ): {
    isMismatch: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    description: string;
    details: Record<string, any>;
  } {
    // This is a simplified implementation
    // In production, you would use a proper timezone library
    
    const timeDifference = (new Date(currentTimestamp).getTime() - new Date(previousLocation.timestamp).getTime()) / (1000 * 60 * 60);
    
    // If time difference is very small but locations are far apart, it's suspicious
    if (timeDifference < 1 && timeDifference > 0) {
      return {
        isMismatch: true,
        severity: 'high',
        score: 80,
        description: 'Impossible travel time detected',
        details: {
          timeDifference,
          previousTimestamp: previousLocation.timestamp,
          currentTimestamp
        }
      };
    }

    return {
      isMismatch: false,
      severity: 'low',
      score: 0,
      description: '',
      details: {}
    };
  }

  /**
   * Check if ISP is suspicious
   */
  private isSuspiciousISP(isp: string, organization: string): boolean {
    const suspiciousKeywords = [
      'vpn', 'proxy', 'tor', 'anonymous', 'privacy', 'hide',
      'mask', 'fake', 'spoof', 'relay', 'tunnel'
    ];
    
    const combined = `${isp} ${organization}`.toLowerCase();
    return suspiciousKeywords.some(keyword => combined.includes(keyword));
  }

  /**
   * Calculate overall anomaly score
   */
  private calculateAnomalyScore(
    anomalies: Array<{ score: number }>,
    travelAnalysis: { isPossible: boolean; requiredSpeed: number }
  ): number {
    if (anomalies.length === 0) return 0;
    
    const maxAnomalyScore = Math.max(...anomalies.map(a => a.score));
    const avgAnomalyScore = anomalies.reduce((sum, a) => sum + a.score, 0) / anomalies.length;
    
    // Combine with travel analysis
    let travelPenalty = 0;
    if (!travelAnalysis.isPossible) {
      travelPenalty = 50;
    } else if (travelAnalysis.requiredSpeed > 500) {
      travelPenalty = 30;
    }
    
    return Math.min(100, maxAnomalyScore + travelPenalty);
  }

  /**
   * Determine risk level based on anomaly score and detected anomalies
   */
  private determineRiskLevel(
    anomalyScore: number,
    anomalies: Array<{ severity: string }>
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (anomalyScore >= 90 || anomalies.some(a => a.severity === 'critical')) {
      return 'critical';
    }
    if (anomalyScore >= 70 || anomalies.some(a => a.severity === 'high')) {
      return 'high';
    }
    if (anomalyScore >= 40 || anomalies.some(a => a.severity === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    anomalies: Array<{ type: string; severity: string; description: string }>,
    travelAnalysis: { isPossible: boolean },
    riskLevel: string
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical') {
      recommendations.push('Immediate manual review required - critical geographic risk detected');
      recommendations.push('Consider blocking payment and contacting user');
    } else if (riskLevel === 'high') {
      recommendations.push('High geographic risk detected - manual review recommended');
      recommendations.push('Request additional verification from user');
    } else if (riskLevel === 'medium') {
      recommendations.push('Elevated geographic risk - enhanced monitoring recommended');
    }

    // Specific recommendations based on anomaly types
    if (anomalies.some(a => a.type === 'vpn_proxy')) {
      recommendations.push('VPN/Proxy usage detected - verify user identity');
    }
    
    if (anomalies.some(a => a.type === 'impossible_travel')) {
      recommendations.push('Impossible travel detected - verify user location');
    }
    
    if (anomalies.some(a => a.type === 'high_risk_country')) {
      recommendations.push('High-risk country detected - additional verification required');
    }

    if (!travelAnalysis.isPossible) {
      recommendations.push('Impossible travel time - verify user location and timing');
    }

    if (recommendations.length === 0) {
      recommendations.push('No immediate action required');
    }

    return recommendations;
  }

  /**
   * Get or build user geographic profile
   */
  private async getUserGeographicProfile(userId: string): Promise<UserGeographicProfile> {
    // Check cache first
    const cached = this.userGeographicProfiles.get(userId);
    if (cached && this.isCacheValid(cached.lastUpdated)) {
      return cached;
    }

    try {
      // Get user's historical location data
      const { data: locations, error } = await this.supabase
        .from('payment_security_events')
        .select('geolocation, created_at')
        .eq('user_id', userId)
        .not('geolocation', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(`Failed to fetch location data: ${error.message}`);
      }

      // Build geographic profile
      const profile = this.buildGeographicProfile(userId, locations || []);
      
      // Cache profile
      this.userGeographicProfiles.set(userId, profile);
      
      return profile;

    } catch (error) {
      logger.error('Error building geographic profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return this.createDefaultGeographicProfile(userId);
    }
  }

  /**
   * Build comprehensive geographic profile from historical data
   */
  private buildGeographicProfile(userId: string, locations: any[]): UserGeographicProfile {
    if (locations.length === 0) {
      return this.createDefaultGeographicProfile(userId);
    }

    // Find primary location (most frequent)
    const countryCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();
    const cityCounts = new Map<string, number>();
    
    locations.forEach(location => {
      const geo = location.geolocation;
      if (geo) {
        countryCounts.set(geo.country, (countryCounts.get(geo.country) || 0) + 1);
        regionCounts.set(geo.region, (regionCounts.get(geo.region) || 0) + 1);
        cityCounts.set(geo.city, (cityCounts.get(geo.city) || 0) + 1);
      }
    });

    const primaryCountry = this.findMostFrequent(Array.from(countryCounts.keys())) || 'Unknown';
    const primaryRegion = this.findMostFrequent(Array.from(regionCounts.keys())) || 'Unknown';
    const primaryCity = this.findMostFrequent(Array.from(cityCounts.keys())) || 'Unknown';

    // Calculate travel patterns
    const uniqueCountries = new Set(locations.map(l => l.geolocation?.country).filter(c => c));
    const frequentCountries = Array.from(uniqueCountries).map(country => ({
      country,
      frequency: countryCounts.get(country) || 0,
      lastVisit: new Date().toISOString() // Simplified
    }));

    return {
      userId,
      primaryLocation: {
        country: primaryCountry,
        countryCode: this.getCountryCode(primaryCountry),
        region: primaryRegion,
        city: primaryCity,
        latitude: 37.5665, // Default to Seoul
        longitude: 126.9780,
        timezone: 'Asia/Seoul'
      },
      travelPatterns: {
        frequentCountries,
        travelFrequency: uniqueCountries.size / Math.max(locations.length, 1),
        maxDistance: 0, // Would calculate actual distances
        averageDistance: 0
      },
      riskIndicators: {
        vpnUsage: 0.1, // Would calculate from historical data
        proxyUsage: 0.05,
        newLocationRisk: uniqueCountries.size > 3 ? 50 : 20,
        timezoneConsistency: 0.9
      },
      lastUpdated: new Date().toISOString(),
      profileVersion: this.MODEL_VERSION
    };
  }

  /**
   * Helper methods
   */
  private isCacheValid(lastUpdated: string): boolean {
    return Date.now() - new Date(lastUpdated).getTime() < this.CACHE_TTL;
  }

  private findMostFrequent<T>(values: T[]): T | null {
    if (values.length === 0) return null;
    
    const counts = new Map<T, number>();
    values.forEach(val => counts.set(val, (counts.get(val) || 0) + 1));
    
    let maxCount = 0;
    let mostFrequent: T | null = null;
    
    counts.forEach((count, val) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = val;
      }
    });
    
    return mostFrequent;
  }

  private getCountryCode(countryName: string): string {
    const countryMap: Record<string, string> = {
      'South Korea': 'KR',
      'United States': 'US',
      'China': 'CN',
      'Japan': 'JP',
      'Unknown': 'XX'
    };
    return countryMap[countryName] || 'XX';
  }

  private getDefaultGeolocationData(ipAddress: string): GeolocationData {
    return {
      ipAddress,
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
  }

  private getDefaultTravelAnalysis() {
    return {
      distance: 0,
      travelTime: 0,
      isPossible: true,
      requiredSpeed: 0,
      timeDifference: 0
    };
  }

  private createDefaultGeographicProfile(userId: string): UserGeographicProfile {
    return {
      userId,
      primaryLocation: {
        country: 'Unknown',
        countryCode: 'XX',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC'
      },
      travelPatterns: {
        frequentCountries: [],
        travelFrequency: 0,
        maxDistance: 0,
        averageDistance: 0
      },
      riskIndicators: {
        vpnUsage: 0,
        proxyUsage: 0,
        newLocationRisk: 50,
        timezoneConsistency: 0
      },
      lastUpdated: new Date().toISOString(),
      profileVersion: this.MODEL_VERSION
    };
  }

  private async updateUserGeographicProfile(userId: string, geolocationData: GeolocationData): Promise<void> {
    // Update user profile with new location data
    const profile = this.userGeographicProfiles.get(userId);
    if (profile) {
      profile.lastUpdated = new Date().toISOString();
      this.userGeographicProfiles.set(userId, profile);
    }
  }

  private async generateGeographicAlert(
    request: GeographicAnomalyRequest,
    geolocationData: GeolocationData,
    anomalies: Array<{ type: string; severity: string; description: string }>,
    anomalyScore: number
  ): Promise<void> {
    const alert: GeographicAlert = {
      id: crypto.randomUUID(),
      userId: request.userId,
      paymentId: request.paymentId,
      alertType: 'geographic_anomaly',
      severity: anomalyScore >= 90 ? 'critical' : 
               anomalyScore >= 70 ? 'high' : 'medium',
      title: 'Geographic Anomaly Detected',
      message: `Geographic anomaly detected for user ${request.userId}: ${anomalies.map(a => a.description).join(', ')}`,
      location: {
        current: geolocationData
      },
      anomalyDetails: anomalies.map(a => ({
        type: a.type,
        severity: a.severity,
        score: 0, // Would be calculated
        description: a.description
      })),
      recommendations: this.generateRecommendations(anomalies, { isPossible: true }, 'high'),
      isResolved: false,
      metadata: {
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        timestamp: request.timestamp
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Log alert
    try {
      await this.supabase
        .from('geographic_alerts')
        .insert({
          id: alert.id,
          user_id: alert.userId,
          payment_id: alert.paymentId,
          alert_type: alert.alertType,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          location: alert.location,
          anomaly_details: alert.anomalyDetails,
          recommendations: alert.recommendations,
          is_resolved: alert.isResolved,
          metadata: alert.metadata,
          created_at: alert.createdAt,
          updated_at: alert.updatedAt
        });
    } catch (error) {
      logger.error('Error logging geographic alert', { error });
    }
  }
}

export const geographicAnomalyDetectionService = new GeographicAnomalyDetectionService();

