/**
 * User Behavior Monitoring Service
 * 
 * Comprehensive monitoring system for suspicious payment activities:
 * - Real-time behavior tracking and analysis
 * - Session-based activity monitoring
 * - Device and location pattern analysis
 * - Payment behavior profiling
 * - Risk scoring and alert generation
 * - Behavioral anomaly detection
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface UserSession {
  sessionId: string;
  userId: string;
  startTime: string;
  lastActivity: string;
  duration: number; // in minutes
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  location: {
    country: string;
    region: string;
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  activities: UserActivity[];
  riskScore: number;
  isActive: boolean;
}

export interface UserActivity {
  id: string;
  sessionId: string;
  userId: string;
  activityType: 'login' | 'payment' | 'navigation' | 'search' | 'profile_update' | 'logout';
  timestamp: string;
  details: {
    page?: string;
    action?: string;
    amount?: number;
    paymentMethod?: string;
    targetId?: string;
    metadata?: Record<string, any>;
  };
  riskFactors: string[];
  riskScore: number;
}

export interface BehaviorProfile {
  userId: string;
  sessionPatterns: {
    averageSessionDuration: number;
    typicalSessionTimes: number[];
    mostActiveHours: number[];
    weekendActivity: number;
    sessionFrequency: number;
  };
  paymentPatterns: {
    averageAmount: number;
    amountVariability: number;
    preferredPaymentMethods: Array<{
      method: string;
      frequency: number;
      lastUsed: string;
    }>;
    paymentFrequency: number;
    timeBetweenPayments: number;
  };
  locationPatterns: {
    primaryLocation: {
      country: string;
      region: string;
      city: string;
    };
    travelFrequency: number;
    newLocationRisk: number;
    locationStability: number;
  };
  devicePatterns: {
    primaryDevice: string;
    deviceStability: number;
    newDeviceRisk: number;
    deviceDiversity: number;
  };
  behavioralMetrics: {
    clickRate: number;
    scrollDepth: number;
    timeOnPage: number;
    navigationPattern: string[];
    errorRate: number;
    retryRate: number;
  };
  riskIndicators: {
    velocityScore: number;
    anomalyScore: number;
    consistencyScore: number;
    stabilityScore: number;
    overallRiskScore: number;
  };
  lastUpdated: string;
  profileVersion: string;
}

export interface BehaviorAlert {
  id: string;
  userId: string;
  sessionId?: string;
  alertType: 'suspicious_activity' | 'velocity_anomaly' | 'location_anomaly' | 'device_anomaly' | 'behavior_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  riskScore: number;
  detectedPatterns: string[];
  riskFactors: Array<{
    factor: string;
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

export interface MonitoringConfig {
  sessionTimeout: number; // in minutes
  maxSessionsPerUser: number;
  velocityThresholds: {
    paymentAmount: number;
    paymentFrequency: number;
    sessionDuration: number;
  };
  anomalyThresholds: {
    locationChange: number;
    deviceChange: number;
    behaviorChange: number;
  };
  alertThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export class UserBehaviorMonitoringService {
  private supabase = getSupabaseClient();
  private activeSessions = new Map<string, UserSession>();
  private behaviorProfiles = new Map<string, BehaviorProfile>();
  private readonly SESSION_TIMEOUT = 30; // 30 minutes
  private readonly PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  private readonly defaultConfig: MonitoringConfig = {
    sessionTimeout: 30,
    maxSessionsPerUser: 5,
    velocityThresholds: {
      paymentAmount: 1000000, // 1M KRW
      paymentFrequency: 10, // 10 payments per hour
      sessionDuration: 120 // 2 hours
    },
    anomalyThresholds: {
      locationChange: 0.8,
      deviceChange: 0.7,
      behaviorChange: 0.6
    },
    alertThresholds: {
      low: 30,
      medium: 50,
      high: 70,
      critical: 90
    }
  };

  /**
   * Track user activity and update behavior profile
   */
  async trackUserActivity(activity: Omit<UserActivity, 'id' | 'riskScore' | 'riskFactors'>): Promise<{
    riskScore: number;
    riskFactors: string[];
    alerts: BehaviorAlert[];
    session: UserSession | null;
  }> {
    try {
      logger.info('Tracking user activity', { 
        userId: activity.userId, 
        activityType: activity.activityType 
      });

      // Get or create user session
      const session = await this.getOrCreateSession(activity.sessionId, activity.userId, {
        deviceFingerprint: activity.details.metadata?.deviceFingerprint || '',
        ipAddress: activity.details.metadata?.ipAddress || '',
        userAgent: activity.details.metadata?.userAgent || '',
        location: activity.details.metadata?.location || {
          country: 'unknown',
          region: 'unknown',
          city: 'unknown'
        }
      });

      // Create activity record
      const userActivity: UserActivity = {
        ...activity,
        id: crypto.randomUUID(),
        riskScore: 0,
        riskFactors: []
      };

      // Analyze activity for risk factors
      const analysisResult = await this.analyzeActivity(userActivity, session);
      userActivity.riskScore = analysisResult.riskScore;
      userActivity.riskFactors = analysisResult.riskFactors;

      // Update session with activity
      session.activities.push(userActivity);
      session.lastActivity = activity.timestamp;
      session.duration = this.calculateSessionDuration(session);

      // Update behavior profile
      await this.updateBehaviorProfile(activity.userId, userActivity, session);

      // Generate alerts if necessary
      const alerts = await this.generateBehaviorAlerts(activity.userId, userActivity, session, analysisResult);

      // Log activity
      await this.logUserActivity(userActivity);

      return {
        riskScore: analysisResult.riskScore,
        riskFactors: analysisResult.riskFactors,
        alerts,
        session
      };

    } catch (error) {
      logger.error('Error tracking user activity', {
        userId: activity.userId,
        activityType: activity.activityType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        riskScore: 100, // High risk on error
        riskFactors: ['tracking_error'],
        alerts: [],
        session: null
      };
    }
  }

  /**
   * Get or create user session
   */
  private async getOrCreateSession(
    sessionId: string, 
    userId: string, 
    sessionData: {
      deviceFingerprint: string;
      ipAddress: string;
      userAgent: string;
      location: {
        country: string;
        region: string;
        city: string;
      };
    }
  ): Promise<UserSession> {
    // Check if session exists in cache
    let session = this.activeSessions.get(sessionId);
    
    if (session && this.isSessionValid(session)) {
      return session;
    }

    // Create new session
    session = {
      sessionId,
      userId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      duration: 0,
      deviceFingerprint: sessionData.deviceFingerprint,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      location: sessionData.location,
      activities: [],
      riskScore: 0,
      isActive: true
    };

    // Cache session
    this.activeSessions.set(sessionId, session);

    // Check for concurrent sessions
    await this.checkConcurrentSessions(userId);

    return session;
  }

  /**
   * Analyze activity for risk factors
   */
  private async analyzeActivity(
    activity: UserActivity, 
    session: UserSession
  ): Promise<{
    riskScore: number;
    riskFactors: string[];
  }> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Get user behavior profile
    const profile = await this.getBehaviorProfile(activity.userId);

    // Analyze based on activity type
    switch (activity.activityType) {
      case 'payment':
        const paymentAnalysis = await this.analyzePaymentActivity(activity, session, profile);
        riskFactors.push(...paymentAnalysis.riskFactors);
        riskScore += paymentAnalysis.riskScore;
        break;

      case 'login':
        const loginAnalysis = await this.analyzeLoginActivity(activity, session, profile);
        riskFactors.push(...loginAnalysis.riskFactors);
        riskScore += loginAnalysis.riskScore;
        break;

      case 'navigation':
        const navigationAnalysis = await this.analyzeNavigationActivity(activity, session, profile);
        riskFactors.push(...navigationAnalysis.riskFactors);
        riskScore += navigationAnalysis.riskScore;
        break;

      default:
        // Basic analysis for other activity types
        riskScore = 10; // Low baseline risk
        break;
    }

    // Analyze session patterns
    const sessionAnalysis = await this.analyzeSessionPatterns(session, profile);
    riskFactors.push(...sessionAnalysis.riskFactors);
    riskScore += sessionAnalysis.riskScore;

    // Analyze velocity patterns
    const velocityAnalysis = await this.analyzeVelocityPatterns(activity, session, profile);
    riskFactors.push(...velocityAnalysis.riskFactors);
    riskScore += velocityAnalysis.riskScore;

    return {
      riskScore: Math.min(100, riskScore),
      riskFactors: [...new Set(riskFactors)] // Remove duplicates
    };
  }

  /**
   * Analyze payment activity for suspicious patterns
   */
  private async analyzePaymentActivity(
    activity: UserActivity,
    session: UserSession,
    profile: BehaviorProfile
  ): Promise<{
    riskScore: number;
    riskFactors: string[];
  }> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    const amount = activity.details.amount || 0;
    const paymentMethod = activity.details.paymentMethod || '';

    // Amount analysis
    if (amount > profile.paymentPatterns.averageAmount * 3) {
      riskFactors.push('high_amount_deviation');
      riskScore += 30;
    }

    if (amount > this.defaultConfig.velocityThresholds.paymentAmount) {
      riskFactors.push('exceeds_velocity_threshold');
      riskScore += 25;
    }

    // Payment method analysis
    const preferredMethod = profile.paymentPatterns.preferredPaymentMethods.find(
      pm => pm.method === paymentMethod
    );
    
    if (!preferredMethod || preferredMethod.frequency < 0.1) {
      riskFactors.push('unusual_payment_method');
      riskScore += 20;
    }

    // Time analysis
    const currentHour = new Date(activity.timestamp).getHours();
    if (!profile.sessionPatterns.mostActiveHours.includes(currentHour)) {
      riskFactors.push('unusual_payment_time');
      riskScore += 15;
    }

    // Session duration analysis
    if (session.duration > this.defaultConfig.velocityThresholds.sessionDuration) {
      riskFactors.push('extended_session');
      riskScore += 10;
    }

    return { riskScore, riskFactors };
  }

  /**
   * Analyze login activity for suspicious patterns
   */
  private async analyzeLoginActivity(
    activity: UserActivity,
    session: UserSession,
    profile: BehaviorProfile
  ): Promise<{
    riskScore: number;
    riskFactors: string[];
  }> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Device analysis
    if (session.deviceFingerprint !== profile.devicePatterns.primaryDevice) {
      riskFactors.push('new_device_login');
      riskScore += profile.devicePatterns.newDeviceRisk;
    }

    // Location analysis
    if (session.location.country !== profile.locationPatterns.primaryLocation.country) {
      riskFactors.push('new_location_login');
      riskScore += profile.locationPatterns.newLocationRisk;
    }

    // Time analysis
    const currentHour = new Date(activity.timestamp).getHours();
    if (!profile.sessionPatterns.mostActiveHours.includes(currentHour)) {
      riskFactors.push('unusual_login_time');
      riskScore += 15;
    }

    // IP analysis
    if (this.isSuspiciousIP(session.ipAddress)) {
      riskFactors.push('suspicious_ip');
      riskScore += 25;
    }

    return { riskScore, riskFactors };
  }

  /**
   * Analyze navigation activity for suspicious patterns
   */
  private async analyzeNavigationActivity(
    activity: UserActivity,
    session: UserSession,
    profile: BehaviorProfile
  ): Promise<{
    riskScore: number;
    riskFactors: string[];
  }> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    const page = activity.details.page || '';
    const action = activity.details.action || '';

    // Rapid navigation analysis
    const recentActivities = session.activities
      .filter(a => a.activityType === 'navigation')
      .slice(-10);
    
    if (recentActivities.length > 5) {
      const timeSpan = new Date(activity.timestamp).getTime() - 
                      new Date(recentActivities[0].timestamp).getTime();
      const minutes = timeSpan / (1000 * 60);
      
      if (minutes < 2) { // More than 5 navigations in 2 minutes
        riskFactors.push('rapid_navigation');
        riskScore += 20;
      }
    }

    // Unusual page access patterns
    if (this.isSuspiciousPageAccess(page, action)) {
      riskFactors.push('suspicious_page_access');
      riskScore += 15;
    }

    return { riskScore, riskFactors };
  }

  /**
   * Analyze session patterns for anomalies
   */
  private async analyzeSessionPatterns(
    session: UserSession,
    profile: BehaviorProfile
  ): Promise<{
    riskScore: number;
    riskFactors: string[];
  }> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Session duration analysis
    if (session.duration > profile.sessionPatterns.averageSessionDuration * 2) {
      riskFactors.push('extended_session_duration');
      riskScore += 15;
    }

    // Activity frequency analysis
    const activityCount = session.activities.length;
    const sessionMinutes = session.duration;
    const activityRate = activityCount / Math.max(sessionMinutes, 1);

    if (activityRate > 2) { // More than 2 activities per minute
      riskFactors.push('high_activity_rate');
      riskScore += 20;
    }

    return { riskScore, riskFactors };
  }

  /**
   * Analyze velocity patterns for suspicious activity
   */
  private async analyzeVelocityPatterns(
    activity: UserActivity,
    session: UserSession,
    profile: BehaviorProfile
  ): Promise<{
    riskScore: number;
    riskFactors: string[];
  }> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Payment velocity analysis
    if (activity.activityType === 'payment') {
      const recentPayments = session.activities
        .filter(a => a.activityType === 'payment')
        .slice(-5);
      
      if (recentPayments.length >= 3) {
        const timeSpan = new Date(activity.timestamp).getTime() - 
                        new Date(recentPayments[0].timestamp).getTime();
        const minutes = timeSpan / (1000 * 60);
        
        if (minutes < 10) { // 3+ payments in 10 minutes
          riskFactors.push('high_payment_velocity');
          riskScore += 30;
        }
      }
    }

    // Session velocity analysis
    const userSessions = Array.from(this.activeSessions.values())
      .filter(s => s.userId === activity.userId && s.isActive);
    
    if (userSessions.length > this.defaultConfig.maxSessionsPerUser) {
      riskFactors.push('excessive_concurrent_sessions');
      riskScore += 25;
    }

    return { riskScore, riskFactors };
  }

  /**
   * Get or build user behavior profile
   */
  private async getBehaviorProfile(userId: string): Promise<BehaviorProfile> {
    // Check cache first
    const cached = this.behaviorProfiles.get(userId);
    if (cached && this.isProfileCacheValid(cached.lastUpdated)) {
      return cached;
    }

    try {
      // Get user's historical data
      const { data: activities, error } = await this.supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        throw new Error(`Failed to fetch user activities: ${error.message}`);
      }

      // Build behavior profile
      const profile = await this.buildBehaviorProfile(userId, activities || []);
      
      // Cache profile
      this.behaviorProfiles.set(userId, profile);
      
      return profile;

    } catch (error) {
      logger.error('Error building behavior profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return this.createDefaultBehaviorProfile(userId);
    }
  }

  /**
   * Build comprehensive behavior profile from historical data
   */
  private async buildBehaviorProfile(userId: string, activities: any[]): Promise<BehaviorProfile> {
    // This would be a comprehensive implementation
    // For now, return a simplified version
    return {
      userId,
      sessionPatterns: {
        averageSessionDuration: 30,
        typicalSessionTimes: [9, 10, 11, 14, 15, 16],
        mostActiveHours: [10, 14, 15],
        weekendActivity: 0.3,
        sessionFrequency: 2
      },
      paymentPatterns: {
        averageAmount: 50000,
        amountVariability: 0.3,
        preferredPaymentMethods: [
          { method: 'card', frequency: 0.7, lastUsed: new Date().toISOString() }
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
      lastUpdated: new Date().toISOString(),
      profileVersion: '1.0.0'
    };
  }

  /**
   * Generate behavior alerts based on analysis
   */
  private async generateBehaviorAlerts(
    userId: string,
    activity: UserActivity,
    session: UserSession,
    analysisResult: {
      riskScore: number;
      riskFactors: string[];
    }
  ): Promise<BehaviorAlert[]> {
    const alerts: BehaviorAlert[] = [];

    if (analysisResult.riskScore >= this.defaultConfig.alertThresholds.critical) {
      alerts.push({
        id: crypto.randomUUID(),
        userId,
        sessionId: session.sessionId,
        alertType: 'suspicious_activity',
        severity: 'critical',
        title: 'Critical Risk Activity Detected',
        message: `Critical risk activity detected for user ${userId}: ${analysisResult.riskFactors.join(', ')}`,
        riskScore: analysisResult.riskScore,
        detectedPatterns: analysisResult.riskFactors,
        riskFactors: analysisResult.riskFactors.map(factor => ({
          factor,
          score: 100,
          description: `Risk factor: ${factor}`
        })),
        recommendations: ['Immediate manual review required', 'Consider blocking user account'],
        isResolved: false,
        metadata: {
          activityType: activity.activityType,
          sessionDuration: session.duration,
          deviceFingerprint: session.deviceFingerprint,
          ipAddress: session.ipAddress
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else if (analysisResult.riskScore >= this.defaultConfig.alertThresholds.high) {
      alerts.push({
        id: crypto.randomUUID(),
        userId,
        sessionId: session.sessionId,
        alertType: 'suspicious_activity',
        severity: 'high',
        title: 'High Risk Activity Detected',
        message: `High risk activity detected for user ${userId}: ${analysisResult.riskFactors.join(', ')}`,
        riskScore: analysisResult.riskScore,
        detectedPatterns: analysisResult.riskFactors,
        riskFactors: analysisResult.riskFactors.map(factor => ({
          factor,
          score: 80,
          description: `Risk factor: ${factor}`
        })),
        recommendations: ['Manual review recommended', 'Monitor user activity closely'],
        isResolved: false,
        metadata: {
          activityType: activity.activityType,
          sessionDuration: session.duration
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Log alerts
    for (const alert of alerts) {
      await this.logBehaviorAlert(alert);
    }

    return alerts;
  }

  /**
   * Helper methods
   */
  private isSessionValid(session: UserSession): boolean {
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const minutesSinceLastActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
    return minutesSinceLastActivity < this.SESSION_TIMEOUT;
  }

  private calculateSessionDuration(session: UserSession): number {
    const start = new Date(session.startTime);
    const now = new Date();
    return (now.getTime() - start.getTime()) / (1000 * 60);
  }

  private isSuspiciousIP(ipAddress: string): boolean {
    // Simplified IP analysis - in production, this would use threat intelligence feeds
    const suspiciousIPs = ['192.168.1.100', '10.0.0.1']; // Example suspicious IPs
    return suspiciousIPs.includes(ipAddress);
  }

  private isSuspiciousPageAccess(page: string, action: string): boolean {
    // Check for suspicious page access patterns
    const suspiciousPatterns = [
      'admin', 'internal', 'debug', 'test'
    ];
    
    return suspiciousPatterns.some(pattern => 
      page.toLowerCase().includes(pattern) || 
      action.toLowerCase().includes(pattern)
    );
  }

  private isProfileCacheValid(lastUpdated: string): boolean {
    return Date.now() - new Date(lastUpdated).getTime() < this.PROFILE_CACHE_TTL;
  }

  private createDefaultBehaviorProfile(userId: string): BehaviorProfile {
    return {
      userId,
      sessionPatterns: {
        averageSessionDuration: 30,
        typicalSessionTimes: [9, 10, 11, 14, 15, 16],
        mostActiveHours: [10, 14, 15],
        weekendActivity: 0.3,
        sessionFrequency: 1
      },
      paymentPatterns: {
        averageAmount: 0,
        amountVariability: 0,
        preferredPaymentMethods: [],
        paymentFrequency: 0,
        timeBetweenPayments: 0
      },
      locationPatterns: {
        primaryLocation: {
          country: 'unknown',
          region: 'unknown',
          city: 'unknown'
        },
        travelFrequency: 0,
        newLocationRisk: 50,
        locationStability: 0
      },
      devicePatterns: {
        primaryDevice: 'unknown',
        deviceStability: 0,
        newDeviceRisk: 50,
        deviceDiversity: 0
      },
      behavioralMetrics: {
        clickRate: 0,
        scrollDepth: 0,
        timeOnPage: 0,
        navigationPattern: [],
        errorRate: 0,
        retryRate: 0
      },
      riskIndicators: {
        velocityScore: 0,
        anomalyScore: 0,
        consistencyScore: 0,
        stabilityScore: 0,
        overallRiskScore: 50
      },
      lastUpdated: new Date().toISOString(),
      profileVersion: '1.0.0'
    };
  }

  private async checkConcurrentSessions(userId: string): Promise<void> {
    const userSessions = Array.from(this.activeSessions.values())
      .filter(s => s.userId === userId && s.isActive);
    
    if (userSessions.length > this.defaultConfig.maxSessionsPerUser) {
      // Close oldest sessions
      const sortedSessions = userSessions.sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      
      const sessionsToClose = sortedSessions.slice(0, -this.defaultConfig.maxSessionsPerUser);
      sessionsToClose.forEach(session => {
        session.isActive = false;
        this.activeSessions.delete(session.sessionId);
      });
    }
  }

  private async updateBehaviorProfile(
    userId: string, 
    activity: UserActivity, 
    session: UserSession
  ): Promise<void> {
    // Update behavior profile with new activity data
    // This would involve incremental updates to the profile
    const profile = this.behaviorProfiles.get(userId);
    if (profile) {
      profile.lastUpdated = new Date().toISOString();
      this.behaviorProfiles.set(userId, profile);
    }
  }

  private async logUserActivity(activity: UserActivity): Promise<void> {
    try {
      await this.supabase
        .from('user_activities')
        .insert({
          id: activity.id,
          session_id: activity.sessionId,
          user_id: activity.userId,
          activity_type: activity.activityType,
          timestamp: activity.timestamp,
          details: activity.details,
          risk_factors: activity.riskFactors,
          risk_score: activity.riskScore,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging user activity', { error });
    }
  }

  private async logBehaviorAlert(alert: BehaviorAlert): Promise<void> {
    try {
      await this.supabase
        .from('behavior_alerts')
        .insert({
          id: alert.id,
          user_id: alert.userId,
          session_id: alert.sessionId,
          alert_type: alert.alertType,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          risk_score: alert.riskScore,
          detected_patterns: alert.detectedPatterns,
          risk_factors: alert.riskFactors,
          recommendations: alert.recommendations,
          is_resolved: alert.isResolved,
          metadata: alert.metadata,
          created_at: alert.createdAt,
          updated_at: alert.updatedAt
        });
    } catch (error) {
      logger.error('Error logging behavior alert', { error });
    }
  }
}

export const userBehaviorMonitoringService = new UserBehaviorMonitoringService();

