/**
 * Adaptive Rate Limiting Service
 * 
 * Intelligent rate limiting that adapts based on user behavior, spam scores,
 * and system load. Integrates with spam detection for dynamic protection.
 */

import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { spamDetectionService } from './spam-detection.service';
import { RateLimitConfig, RateLimitResult } from '../types/rate-limit.types';

export interface AdaptiveRateLimitConfig {
  baseConfig: RateLimitConfig;
  adaptiveMultipliers: {
    spamScore: {
      low: number;    // 0-25 spam score
      medium: number; // 26-50 spam score
      high: number;   // 51-75 spam score
      critical: number; // 76-100 spam score
    };
    userTrust: {
      new: number;        // < 7 days old
      untrusted: number;  // 7-30 days, low engagement
      trusted: number;    // 30+ days, good engagement
      verified: number;   // Verified users
    };
    systemLoad: {
      low: number;    // < 50% CPU/Memory
      medium: number; // 50-75% CPU/Memory
      high: number;   // 75-90% CPU/Memory
      critical: number; // > 90% CPU/Memory
    };
    contentType: {
      post: number;
      comment: number;
      like: number;
      report: number;
      upload: number;
    };
  };
  emergencyMode: {
    enabled: boolean;
    triggerThreshold: number; // System load percentage
    emergencyMultiplier: number;
    maxDurationMinutes: number;
  };
}

export interface UserTrustProfile {
  userId: string;
  trustLevel: 'new' | 'untrusted' | 'trusted' | 'verified';
  accountAge: number; // days
  engagementScore: number; // 0-100
  violationHistory: ViolationRecord[];
  spamScore: number; // 0-100
  lastActivity: Date;
  rateLimitViolations: number;
  successfulInteractions: number;
}

export interface ViolationRecord {
  type: 'spam' | 'rate_limit' | 'content_violation' | 'abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  details: any;
  resolved: boolean;
}

export interface SystemLoadMetrics {
  cpu: number; // 0-100
  memory: number; // 0-100
  activeConnections: number;
  requestsPerSecond: number;
  errorRate: number; // 0-100
  timestamp: Date;
}

export interface AdaptiveRateLimitResult extends RateLimitResult {
  appliedMultiplier: number;
  trustLevel: string;
  spamScore: number;
  systemLoad: number;
  reasoning: string[];
  adaptiveConfig: RateLimitConfig;
}

class AdaptiveRateLimitService {
  private supabase = getSupabaseClient();
  private config: AdaptiveRateLimitConfig;
  private systemMetrics: SystemLoadMetrics;
  private emergencyModeActive = false;
  private emergencyModeStartTime?: Date;

  constructor(config?: Partial<AdaptiveRateLimitConfig>) {
    this.config = {
      baseConfig: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        strategy: 'sliding_window',
        scope: 'user',
        enableHeaders: true,
        message: 'Rate limit exceeded'
      },
      adaptiveMultipliers: {
        spamScore: {
          low: 1.0,     // No restriction
          medium: 0.7,  // 30% reduction
          high: 0.4,    // 60% reduction
          critical: 0.1 // 90% reduction
        },
        userTrust: {
          new: 0.5,        // 50% of normal limits
          untrusted: 0.7,  // 30% reduction
          trusted: 1.0,    // Normal limits
          verified: 1.5    // 50% increase
        },
        systemLoad: {
          low: 1.2,      // 20% increase when system is healthy
          medium: 1.0,   // Normal limits
          high: 0.6,     // 40% reduction
          critical: 0.2  // 80% reduction
        },
        contentType: {
          post: 1.0,     // Base multiplier
          comment: 1.2,  // Comments are less resource intensive
          like: 2.0,     // Likes are very light
          report: 0.5,   // Reports should be limited
          upload: 0.3    // Uploads are resource intensive
        }
      },
      emergencyMode: {
        enabled: true,
        triggerThreshold: 90, // 90% system load
        emergencyMultiplier: 0.1, // 90% reduction
        maxDurationMinutes: 30
      },
      ...config
    };

    this.systemMetrics = {
      cpu: 0,
      memory: 0,
      activeConnections: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      timestamp: new Date()
    };

    // Start system monitoring
    this.startSystemMonitoring();
  }

  /**
   * Calculate adaptive rate limit for a user and action
   */
  async calculateAdaptiveRateLimit(
    userId: string,
    contentType: keyof AdaptiveRateLimitConfig['adaptiveMultipliers']['contentType'],
    baseConfig?: RateLimitConfig
  ): Promise<{
    config: RateLimitConfig;
    reasoning: string[];
    appliedMultiplier: number;
    trustProfile: UserTrustProfile;
  }> {
    const reasoning: string[] = [];
    let totalMultiplier = 1.0;
    
    const config = baseConfig || this.config.baseConfig;
    
    // Get user trust profile
    const trustProfile = await this.getUserTrustProfile(userId);
    
    // Apply spam score multiplier
    const spamMultiplier = this.getSpamScoreMultiplier(trustProfile.spamScore);
    totalMultiplier *= spamMultiplier;
    reasoning.push(`Spam score (${trustProfile.spamScore}): ${spamMultiplier}x`);
    
    // Apply user trust multiplier
    const trustMultiplier = this.config.adaptiveMultipliers.userTrust[trustProfile.trustLevel];
    totalMultiplier *= trustMultiplier;
    reasoning.push(`Trust level (${trustProfile.trustLevel}): ${trustMultiplier}x`);
    
    // Apply system load multiplier
    const systemMultiplier = this.getSystemLoadMultiplier();
    totalMultiplier *= systemMultiplier;
    reasoning.push(`System load: ${systemMultiplier}x`);
    
    // Apply content type multiplier
    const contentMultiplier = this.config.adaptiveMultipliers.contentType[contentType];
    totalMultiplier *= contentMultiplier;
    reasoning.push(`Content type (${contentType}): ${contentMultiplier}x`);
    
    // Apply emergency mode if active
    if (this.emergencyModeActive) {
      totalMultiplier *= this.config.emergencyMode.emergencyMultiplier;
      reasoning.push(`Emergency mode: ${this.config.emergencyMode.emergencyMultiplier}x`);
    }
    
    // Calculate final limits
    const adaptiveConfig: RateLimitConfig = {
      ...config,
      max: Math.max(1, Math.floor(config.max * totalMultiplier)),
      windowMs: config.windowMs // Keep window the same
    };
    
    return {
      config: adaptiveConfig,
      reasoning,
      appliedMultiplier: totalMultiplier,
      trustProfile
    };
  }

  /**
   * Get user trust profile
   */
  async getUserTrustProfile(userId: string): Promise<UserTrustProfile> {
    try {
      // Get user basic info
      const { data: user } = await this.supabase
        .from('users')
        .select('created_at, spam_score, is_verified')
        .eq('id', userId)
        .single();

      if (!user) {
        return this.createDefaultTrustProfile(userId);
      }

      const accountAge = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const spamScore = user.spam_score || 0;

      // Get engagement metrics
      const engagementScore = await this.calculateEngagementScore(userId);
      
      // Get violation history
      const violationHistory = await this.getViolationHistory(userId);
      
      // Determine trust level
      const trustLevel = this.determineTrustLevel(accountAge, engagementScore, violationHistory, user.is_verified);

      return {
        userId,
        trustLevel,
        accountAge,
        engagementScore,
        violationHistory,
        spamScore,
        lastActivity: new Date(),
        rateLimitViolations: violationHistory.filter(v => v.type === 'rate_limit').length,
        successfulInteractions: Math.max(0, engagementScore * 10) // Rough estimate
      };

    } catch (error) {
      logger.warn('Failed to get user trust profile', { userId, error });
      return this.createDefaultTrustProfile(userId);
    }
  }

  /**
   * Calculate user engagement score
   */
  private async calculateEngagementScore(userId: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Get recent activity counts
      const [postsResult, commentsResult, likesResult] = await Promise.all([
        this.supabase
          .from('feed_posts')
          .select('id')
          .eq('author_id', userId)
          .gte('created_at', thirtyDaysAgo.toISOString()),
        
        this.supabase
          .from('feed_comments')
          .select('id')
          .eq('author_id', userId)
          .gte('created_at', thirtyDaysAgo.toISOString()),
        
        this.supabase
          .from('post_likes')
          .select('id')
          .eq('user_id', userId)
          .gte('created_at', thirtyDaysAgo.toISOString())
      ]);

      const posts = postsResult.data?.length || 0;
      const comments = commentsResult.data?.length || 0;
      const likes = likesResult.data?.length || 0;

      // Calculate engagement score (0-100)
      const score = Math.min(100, (posts * 5) + (comments * 3) + (likes * 1));
      return score;

    } catch (error) {
      logger.warn('Failed to calculate engagement score', { userId, error });
      return 0;
    }
  }

  /**
   * Get user violation history
   */
  private async getViolationHistory(userId: string): Promise<ViolationRecord[]> {
    try {
      // This would typically come from a violations/moderation log table
      // For now, return empty array - implement based on your moderation system
      return [];
    } catch (error) {
      logger.warn('Failed to get violation history', { userId, error });
      return [];
    }
  }

  /**
   * Determine user trust level
   */
  private determineTrustLevel(
    accountAge: number,
    engagementScore: number,
    violationHistory: ViolationRecord[],
    isVerified: boolean
  ): 'new' | 'untrusted' | 'trusted' | 'verified' {
    if (isVerified) return 'verified';
    
    const recentViolations = violationHistory.filter(v => 
      (Date.now() - v.timestamp.getTime()) < (30 * 24 * 60 * 60 * 1000) // Last 30 days
    );

    if (accountAge < 7) return 'new';
    
    if (recentViolations.length > 0 || engagementScore < 20) return 'untrusted';
    
    if (accountAge >= 30 && engagementScore >= 50) return 'trusted';
    
    return 'untrusted';
  }

  /**
   * Create default trust profile for unknown users
   */
  private createDefaultTrustProfile(userId: string): UserTrustProfile {
    return {
      userId,
      trustLevel: 'new',
      accountAge: 0,
      engagementScore: 0,
      violationHistory: [],
      spamScore: 50, // Neutral score for unknown users
      lastActivity: new Date(),
      rateLimitViolations: 0,
      successfulInteractions: 0
    };
  }

  /**
   * Get spam score multiplier
   */
  private getSpamScoreMultiplier(spamScore: number): number {
    if (spamScore >= 76) return this.config.adaptiveMultipliers.spamScore.critical;
    if (spamScore >= 51) return this.config.adaptiveMultipliers.spamScore.high;
    if (spamScore >= 26) return this.config.adaptiveMultipliers.spamScore.medium;
    return this.config.adaptiveMultipliers.spamScore.low;
  }

  /**
   * Get system load multiplier
   */
  private getSystemLoadMultiplier(): number {
    const maxLoad = Math.max(this.systemMetrics.cpu, this.systemMetrics.memory);
    
    if (maxLoad >= 90) return this.config.adaptiveMultipliers.systemLoad.critical;
    if (maxLoad >= 75) return this.config.adaptiveMultipliers.systemLoad.high;
    if (maxLoad >= 50) return this.config.adaptiveMultipliers.systemLoad.medium;
    return this.config.adaptiveMultipliers.systemLoad.low;
  }

  /**
   * Record rate limit violation
   */
  async recordViolation(userId: string, details: {
    endpoint: string;
    limit: number;
    actual: number;
    windowMs: number;
  }): Promise<void> {
    try {
      // Update user's violation count
      const { data: currentUser } = await this.supabase
        .from('users')
        .select('rate_limit_violations')
        .eq('id', userId)
        .single();

      const currentViolations = currentUser?.rate_limit_violations || 0;
      
      await this.supabase
        .from('users')
        .update({ 
          rate_limit_violations: currentViolations + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Log the violation for analysis
      logger.warn('Rate limit violation recorded', {
        userId,
        ...details,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to record rate limit violation', { userId, error });
    }
  }

  /**
   * Record successful interaction
   */
  async recordSuccessfulInteraction(userId: string, contentType: string): Promise<void> {
    try {
      // Update user's successful interaction count
      const { data: currentUser } = await this.supabase
        .from('users')
        .select('successful_interactions')
        .eq('id', userId)
        .single();

      const currentInteractions = currentUser?.successful_interactions || 0;
      
      await this.supabase
        .from('users')
        .update({ 
          successful_interactions: currentInteractions + 1,
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    } catch (error) {
      logger.warn('Failed to record successful interaction', { userId, error });
    }
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    // Update system metrics every 30 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);

    // Check emergency mode every minute
    setInterval(() => {
      this.checkEmergencyMode();
    }, 60000);
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    try {
      // In a real implementation, you would get actual system metrics
      // For now, simulate some metrics
      this.systemMetrics = {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        activeConnections: Math.floor(Math.random() * 1000),
        requestsPerSecond: Math.floor(Math.random() * 100),
        errorRate: Math.random() * 10,
        timestamp: new Date()
      };

    } catch (error) {
      logger.warn('Failed to update system metrics', { error });
    }
  }

  /**
   * Check and manage emergency mode
   */
  private checkEmergencyMode(): void {
    if (!this.config.emergencyMode.enabled) return;

    const maxLoad = Math.max(this.systemMetrics.cpu, this.systemMetrics.memory);
    const shouldActivate = maxLoad >= this.config.emergencyMode.triggerThreshold;

    if (shouldActivate && !this.emergencyModeActive) {
      this.activateEmergencyMode();
    } else if (!shouldActivate && this.emergencyModeActive) {
      this.deactivateEmergencyMode();
    } else if (this.emergencyModeActive && this.emergencyModeStartTime) {
      // Check if emergency mode has been active too long
      const duration = Date.now() - this.emergencyModeStartTime.getTime();
      const maxDuration = this.config.emergencyMode.maxDurationMinutes * 60 * 1000;
      
      if (duration > maxDuration) {
        this.deactivateEmergencyMode();
        logger.warn('Emergency mode deactivated due to max duration reached');
      }
    }
  }

  /**
   * Activate emergency mode
   */
  private activateEmergencyMode(): void {
    this.emergencyModeActive = true;
    this.emergencyModeStartTime = new Date();
    
    logger.warn('Emergency mode activated', {
      systemLoad: {
        cpu: this.systemMetrics.cpu,
        memory: this.systemMetrics.memory
      },
      multiplier: this.config.emergencyMode.emergencyMultiplier
    });
  }

  /**
   * Deactivate emergency mode
   */
  private deactivateEmergencyMode(): void {
    this.emergencyModeActive = false;
    this.emergencyModeStartTime = undefined;
    
    logger.info('Emergency mode deactivated');
  }

  /**
   * Get current system status
   */
  getSystemStatus(): {
    metrics: SystemLoadMetrics;
    emergencyMode: boolean;
    emergencyModeDuration?: number;
  } {
    return {
      metrics: this.systemMetrics,
      emergencyMode: this.emergencyModeActive,
      emergencyModeDuration: this.emergencyModeStartTime ? 
        Date.now() - this.emergencyModeStartTime.getTime() : undefined
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AdaptiveRateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const adaptiveRateLimitService = new AdaptiveRateLimitService();
