import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Authentication Analytics Service
 * Provides comprehensive analytics and insights for authentication events
 */

export interface AuthAnalytics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueUsers: number;
  uniqueDevices: number;
  uniqueLocations: number;
  averageSessionDuration: number;
  peakLoginHours: number[];
  deviceTypeDistribution: Record<string, number>;
  browserDistribution: Record<string, number>;
  osDistribution: Record<string, number>;
  locationDistribution: Record<string, number>;
  suspiciousActivityCount: number;
  newDeviceLogins: number;
  sessionInvalidations: number;
  passwordChanges: number;
  accountLockouts: number;
}

export interface AuthTrends {
  period: 'hour' | 'day' | 'week' | 'month';
  data: Array<{
    timestamp: string;
    logins: number;
    failures: number;
    uniqueUsers: number;
    suspiciousActivity: number;
  }>;
}

export interface SecurityInsights {
  riskScore: number;
  topThreats: Array<{
    type: string;
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  recommendations: string[];
  anomalies: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    detectedAt: string;
  }>;
}

export interface UserAuthProfile {
  userId: string;
  totalLogins: number;
  lastLogin: string;
  deviceCount: number;
  locationCount: number;
  riskScore: number;
  suspiciousActivityCount: number;
  averageSessionDuration: number;
  preferredLoginTimes: string[];
  deviceTypes: string[];
  locations: string[];
  recentSecurityEvents: Array<{
    type: string;
    timestamp: string;
    severity: string;
    description: string;
  }>;
}

class AuthAnalyticsService {
  private supabase = getSupabaseClient();

  /**
   * Get comprehensive authentication analytics for a time period
   */
  async getAuthAnalytics(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<AuthAnalytics> {
    try {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Get authentication events from security monitoring
      const { data: authEvents, error: eventsError } = await this.supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'auth_success')
        .gte('timestamp', startDateStr)
        .lte('timestamp', endDateStr)
        .order('timestamp', { ascending: false });

      if (eventsError) {
        logger.error('Failed to fetch auth events for analytics', { error: eventsError.message });
        throw new Error('Failed to fetch authentication data');
      }

      const { data: failureEvents, error: failureError } = await this.supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'auth_failure')
        .gte('timestamp', startDateStr)
        .lte('timestamp', endDateStr);

      if (failureError) {
        logger.error('Failed to fetch auth failure events', { error: failureError.message });
      }

      const { data: suspiciousEvents, error: suspiciousError } = await this.supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'suspicious_activity')
        .gte('timestamp', startDateStr)
        .lte('timestamp', endDateStr);

      if (suspiciousError) {
        logger.error('Failed to fetch suspicious activity events', { error: suspiciousError.message });
      }

      // Calculate analytics
      const totalLogins = authEvents?.length || 0;
      const successfulLogins = authEvents?.length || 0;
      const failedLogins = failureEvents?.length || 0;
      const suspiciousActivityCount = suspiciousEvents?.length || 0;

      // Get unique counts
      const uniqueUsers = new Set(authEvents?.map(e => e.user_id).filter(Boolean) || []).size;
      const uniqueDevices = new Set(authEvents?.map(e => e.details?.deviceFingerprint).filter(Boolean) || []).size;
      const uniqueLocations = new Set(authEvents?.map(e => e.location?.country).filter(Boolean) || []).size;

      // Calculate distributions
      const deviceTypeDistribution = this.calculateDistribution(
        authEvents?.map(e => e.details?.deviceInfo?.deviceType).filter(Boolean) || []
      );

      const browserDistribution = this.calculateDistribution(
        authEvents?.map(e => e.details?.deviceInfo?.browser?.name).filter(Boolean) || []
      );

      const osDistribution = this.calculateDistribution(
        authEvents?.map(e => e.details?.deviceInfo?.os?.name).filter(Boolean) || []
      );

      const locationDistribution = this.calculateDistribution(
        authEvents?.map(e => e.location?.country).filter(Boolean) || []
      );

      // Calculate session duration (mock for now - would need session data)
      const averageSessionDuration = await this.calculateAverageSessionDuration(startDate, endDate);

      // Calculate peak login hours
      const peakLoginHours = this.calculatePeakLoginHours(authEvents || []);

      // Get additional metrics
      const newDeviceLogins = authEvents?.filter(e => e.details?.isNewDevice).length || 0;
      const sessionInvalidations = await this.getSessionInvalidationCount(startDate, endDate);
      const passwordChanges = await this.getPasswordChangeCount(startDate, endDate);
      const accountLockouts = await this.getAccountLockoutCount(startDate, endDate);

      return {
        totalLogins,
        successfulLogins,
        failedLogins,
        uniqueUsers,
        uniqueDevices,
        uniqueLocations,
        averageSessionDuration,
        peakLoginHours,
        deviceTypeDistribution,
        browserDistribution,
        osDistribution,
        locationDistribution,
        suspiciousActivityCount,
        newDeviceLogins,
        sessionInvalidations,
        passwordChanges,
        accountLockouts
      };

    } catch (error) {
      logger.error('Failed to get auth analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate,
        userId
      });
      throw error;
    }
  }

  /**
   * Get authentication trends over time
   */
  async getAuthTrends(
    period: 'hour' | 'day' | 'week' | 'month',
    startDate: Date,
    endDate: Date
  ): Promise<AuthTrends> {
    try {
      const data = [];
      const intervalMs = this.getIntervalMs(period);
      let currentTime = new Date(startDate);

      while (currentTime < endDate) {
        const nextTime = new Date(currentTime.getTime() + intervalMs);
        
        const { data: loginEvents } = await this.supabase
          .from('security_events')
          .select('user_id')
          .eq('event_type', 'auth_success')
          .gte('timestamp', currentTime.toISOString())
          .lt('timestamp', nextTime.toISOString());

        const { data: failureEvents } = await this.supabase
          .from('security_events')
          .select('user_id')
          .eq('event_type', 'auth_failure')
          .gte('timestamp', currentTime.toISOString())
          .lt('timestamp', nextTime.toISOString());

        const { data: suspiciousEvents } = await this.supabase
          .from('security_events')
          .select('user_id')
          .eq('event_type', 'suspicious_activity')
          .gte('timestamp', currentTime.toISOString())
          .lt('timestamp', nextTime.toISOString());

        data.push({
          timestamp: currentTime.toISOString(),
          logins: loginEvents?.length || 0,
          failures: failureEvents?.length || 0,
          uniqueUsers: new Set(loginEvents?.map(e => e.user_id).filter(Boolean) || []).size,
          suspiciousActivity: suspiciousEvents?.length || 0
        });

        currentTime = nextTime;
      }

      return {
        period,
        data
      };

    } catch (error) {
      logger.error('Failed to get auth trends', {
        error: error instanceof Error ? error.message : 'Unknown error',
        period,
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Get security insights and threat analysis
   */
  async getSecurityInsights(startDate: Date, endDate: Date): Promise<SecurityInsights> {
    try {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Get all security events
      const { data: events, error } = await this.supabase
        .from('security_events')
        .select('*')
        .gte('timestamp', startDateStr)
        .lte('timestamp', endDateStr)
        .order('timestamp', { ascending: false });

      if (error) {
        logger.error('Failed to fetch security events for insights', { error: error.message });
        throw new Error('Failed to fetch security data');
      }

      // Calculate risk score
      const riskScore = this.calculateRiskScore(events || []);

      // Identify top threats
      const topThreats = this.identifyTopThreats(events || []);

      // Generate recommendations
      const recommendations = this.generateRecommendations(events || [], riskScore);

      // Detect anomalies
      const anomalies = this.detectAnomalies(events || []);

      return {
        riskScore,
        topThreats,
        recommendations,
        anomalies
      };

    } catch (error) {
      logger.error('Failed to get security insights', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Get user authentication profile
   */
  async getUserAuthProfile(userId: string, days: number = 30): Promise<UserAuthProfile> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // Get user's authentication events
      const { data: authEvents, error } = await this.supabase
        .from('security_events')
        .select('*')
        .eq('user_id', userId)
        .in('event_type', ['auth_success', 'auth_failure', 'suspicious_activity'])
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        logger.error('Failed to fetch user auth events', { error: error.message, userId });
        throw new Error('Failed to fetch user authentication data');
      }

      const successfulLogins = authEvents?.filter(e => e.event_type === 'auth_success') || [];
      const suspiciousEvents = authEvents?.filter(e => e.event_type === 'suspicious_activity') || [];

      // Calculate user metrics
      const totalLogins = successfulLogins.length;
      const lastLogin = successfulLogins[0]?.timestamp || null;
      const deviceCount = new Set(successfulLogins.map(e => e.details?.deviceFingerprint).filter(Boolean)).size;
      const locationCount = new Set(successfulLogins.map(e => e.location?.country).filter(Boolean)).size;
      const riskScore = this.calculateUserRiskScore(successfulLogins, suspiciousEvents);
      const suspiciousActivityCount = suspiciousEvents.length;

      // Calculate session duration
      const averageSessionDuration = await this.calculateUserAverageSessionDuration(userId, startDate, endDate);

      // Get preferred login times
      const preferredLoginTimes = this.calculatePreferredLoginTimes(successfulLogins);

      // Get device types and locations
      const deviceTypes = [...new Set(successfulLogins.map(e => e.details?.deviceInfo?.deviceType).filter(Boolean))];
      const locations = [...new Set(successfulLogins.map(e => e.location?.country).filter(Boolean))];

      // Get recent security events
      const recentSecurityEvents = suspiciousEvents.slice(0, 10).map(event => ({
        type: event.event_type,
        timestamp: event.timestamp,
        severity: event.severity,
        description: event.details?.description || 'Security event detected'
      }));

      return {
        userId,
        totalLogins,
        lastLogin,
        deviceCount,
        locationCount,
        riskScore,
        suspiciousActivityCount,
        averageSessionDuration,
        preferredLoginTimes,
        deviceTypes,
        locations,
        recentSecurityEvents
      };

    } catch (error) {
      logger.error('Failed to get user auth profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        days
      });
      throw error;
    }
  }

  /**
   * Get real-time authentication metrics
   */
  async getRealTimeMetrics(): Promise<{
    activeUsers: number;
    activeSessions: number;
    failedAttemptsLastHour: number;
    suspiciousActivityLastHour: number;
    topThreats: string[];
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Get active users in last hour
      const { data: activeUsers } = await this.supabase
        .from('security_events')
        .select('user_id')
        .eq('event_type', 'auth_success')
        .gte('timestamp', oneHourAgo.toISOString());

      // Get active sessions
      const { data: activeSessions } = await this.supabase
        .from('refresh_tokens')
        .select('id')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      // Get failed attempts in last hour
      const { data: failedAttempts } = await this.supabase
        .from('security_events')
        .select('id')
        .eq('event_type', 'auth_failure')
        .gte('timestamp', oneHourAgo.toISOString());

      // Get suspicious activity in last hour
      const { data: suspiciousActivity } = await this.supabase
        .from('security_events')
        .select('id')
        .eq('event_type', 'suspicious_activity')
        .gte('timestamp', oneHourAgo.toISOString());

      return {
        activeUsers: new Set(activeUsers?.map(u => u.user_id).filter(Boolean) || []).size,
        activeSessions: activeSessions?.length || 0,
        failedAttemptsLastHour: failedAttempts?.length || 0,
        suspiciousActivityLastHour: suspiciousActivity?.length || 0,
        topThreats: ['brute_force', 'suspicious_location', 'device_anomaly'] // Mock data
      };

    } catch (error) {
      logger.error('Failed to get real-time metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Helper methods
  private calculateDistribution(items: string[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    items.forEach(item => {
      distribution[item] = (distribution[item] || 0) + 1;
    });
    return distribution;
  }

  private getIntervalMs(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private calculatePeakLoginHours(events: any[]): number[] {
    const hourCounts: Record<number, number> = {};
    
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private calculateRiskScore(events: any[]): number {
    let score = 0;
    
    events.forEach(event => {
      switch (event.severity) {
        case 'low': score += 1; break;
        case 'medium': score += 3; break;
        case 'high': score += 7; break;
        case 'critical': score += 15; break;
      }
    });

    return Math.min(score / 100, 1); // Normalize to 0-1
  }

  private identifyTopThreats(events: any[]): Array<{type: string, count: number, severity: 'low' | 'medium' | 'high' | 'critical', trend: 'increasing' | 'decreasing' | 'stable'}> {
    const threatCounts: Record<string, {count: number, severity: string}> = {};
    
    events.forEach(event => {
      const threatType = event.details?.threat_type || event.event_type;
      if (!threatCounts[threatType]) {
        threatCounts[threatType] = { count: 0, severity: event.severity };
      }
      threatCounts[threatType].count++;
    });

    return Object.entries(threatCounts)
      .map(([type, data]) => ({
        type,
        count: data.count,
        severity: data.severity as 'low' | 'medium' | 'high' | 'critical',
        trend: 'stable' as 'increasing' | 'decreasing' | 'stable'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private generateRecommendations(events: any[], riskScore: number): string[] {
    const recommendations: string[] = [];
    
    if (riskScore > 0.7) {
      recommendations.push('High risk detected - consider implementing additional security measures');
    }
    
    if (events.filter(e => e.event_type === 'suspicious_activity').length > 10) {
      recommendations.push('Multiple suspicious activities detected - review security policies');
    }
    
    if (events.filter(e => e.details?.isNewDevice).length > 5) {
      recommendations.push('Many new device logins - consider implementing device verification');
    }

    return recommendations;
  }

  private detectAnomalies(events: any[]): Array<{type: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical', detectedAt: string}> {
    const anomalies: Array<{type: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical', detectedAt: string}> = [];
    
    // Detect rapid login attempts
    const recentEvents = events.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
    );
    
    if (recentEvents.length > 50) {
      anomalies.push({
        type: 'rapid_logins',
        description: 'Unusually high number of login attempts in the last hour',
        severity: 'high' as 'low' | 'medium' | 'high' | 'critical',
        detectedAt: new Date().toISOString()
      });
    }

    return anomalies;
  }

  private calculateUserRiskScore(successfulLogins: any[], suspiciousEvents: any[]): number {
    let score = 0;
    
    // Base score from suspicious events
    suspiciousEvents.forEach(event => {
      switch (event.severity) {
        case 'low': score += 2; break;
        case 'medium': score += 5; break;
        case 'high': score += 10; break;
        case 'critical': score += 20; break;
      }
    });

    // Penalty for many new devices
    const newDeviceCount = successfulLogins.filter(e => e.details?.isNewDevice).length;
    score += newDeviceCount * 2;

    // Penalty for many locations
    const locationCount = new Set(successfulLogins.map(e => e.location?.country).filter(Boolean)).size;
    if (locationCount > 3) {
      score += (locationCount - 3) * 3;
    }

    return Math.min(score / 100, 1); // Normalize to 0-1
  }

  private calculatePreferredLoginTimes(events: any[]): string[] {
    const hourCounts: Record<number, number> = {};
    
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);
  }

  private async calculateAverageSessionDuration(startDate: Date, endDate: Date): Promise<number> {
    // Mock implementation - would calculate from actual session data
    return 3600000; // 1 hour in milliseconds
  }

  private async calculateUserAverageSessionDuration(userId: string, startDate: Date, endDate: Date): Promise<number> {
    // Mock implementation - would calculate from user's session data
    return 1800000; // 30 minutes in milliseconds
  }

  private async getSessionInvalidationCount(startDate: Date, endDate: Date): Promise<number> {
    const { data } = await this.supabase
      .from('security_events')
      .select('id')
      .eq('event_type', 'session_invalidation')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());
    
    return data?.length || 0;
  }

  private async getPasswordChangeCount(startDate: Date, endDate: Date): Promise<number> {
    const { data } = await this.supabase
      .from('security_events')
      .select('id')
      .eq('event_type', 'password_change')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());
    
    return data?.length || 0;
  }

  private async getAccountLockoutCount(startDate: Date, endDate: Date): Promise<number> {
    const { data } = await this.supabase
      .from('security_events')
      .select('id')
      .eq('event_type', 'account_lockout')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());
    
    return data?.length || 0;
  }
}

export const authAnalyticsService = new AuthAnalyticsService();
