/**
 * Image Security Monitoring Service
 * 
 * Advanced security monitoring and abuse detection for image management operations
 * including request pattern analysis, IP blocking, and comprehensive audit logging
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { RedisRateLimitStore } from '../utils/redis-rate-limit-store';

export interface SecurityEvent {
  id: string;
  type: 'upload' | 'download' | 'delete' | 'update' | 'access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip: string;
  userAgent: string;
  endpoint: string;
  details: Record<string, any>;
  timestamp: Date;
  blocked: boolean;
  reason?: string;
}

export interface RequestPattern {
  ip: string;
  userId?: string;
  endpoint: string;
  requestCount: number;
  timeWindow: number;
  suspiciousScore: number;
  lastRequest: Date;
  patterns: {
    rapidRequests: boolean;
    unusualHours: boolean;
    multipleUsers: boolean;
    largeFiles: boolean;
    repeatedFailures: boolean;
  };
}

export interface IPBlockInfo {
  ip: string;
  blockedAt: Date;
  blockedUntil: Date;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  attempts: number;
  userId?: string;
}

export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  suspiciousIPs: number;
  blockedIPs: number;
  securityEvents: number;
  averageSuspiciousScore: number;
  topThreats: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
}

export class ImageSecurityMonitoringService {
  private supabase = getSupabaseClient();
  private redisStore: RedisRateLimitStore;
  private blockedIPs = new Map<string, IPBlockInfo>();
  private requestPatterns = new Map<string, RequestPattern>();

  constructor() {
    this.redisStore = new RedisRateLimitStore();
  }

  /**
   * Analyze request pattern for suspicious activity
   */
  async analyzeRequestPattern(
    ip: string,
    endpoint: string,
    userId?: string,
    requestSize?: number,
    userAgent?: string
  ): Promise<{
    suspicious: boolean;
    score: number;
    reasons: string[];
    shouldBlock: boolean;
  }> {
    const key = `${ip}:${userId || 'anonymous'}`;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * 60 * 60 * 1000;

    // Get or create pattern
    let pattern = this.requestPatterns.get(key);
    if (!pattern) {
      pattern = {
        ip,
        userId,
        endpoint,
        requestCount: 0,
        timeWindow: oneHour,
        suspiciousScore: 0,
        lastRequest: new Date(now),
        patterns: {
          rapidRequests: false,
          unusualHours: false,
          multipleUsers: false,
          largeFiles: false,
          repeatedFailures: false
        }
      };
    }

    // Update pattern
    pattern.requestCount++;
    pattern.lastRequest = new Date(now);
    pattern.endpoint = endpoint;

    const reasons: string[] = [];
    let score = 0;

    // Check for rapid requests (more than 10 per minute)
    const timeSinceLastRequest = now - pattern.lastRequest.getTime();
    if (timeSinceLastRequest < 60000 && pattern.requestCount > 10) {
      pattern.patterns.rapidRequests = true;
      reasons.push('Rapid request pattern detected');
      score += 30;
    }

    // Check for unusual hours (requests between 2 AM and 6 AM)
    const hour = new Date(now).getHours();
    if (hour >= 2 && hour <= 6) {
      pattern.patterns.unusualHours = true;
      reasons.push('Unusual request hours detected');
      score += 15;
    }

    // Check for large file uploads (over 5MB)
    if (requestSize && requestSize > 5 * 1024 * 1024) {
      pattern.patterns.largeFiles = true;
      reasons.push('Large file upload detected');
      score += 20;
    }

    // Check for suspicious user agent
    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      reasons.push('Suspicious user agent detected');
      score += 25;
    }

    // Check for multiple users from same IP
    const userCount = await this.getUserCountFromIP(ip, oneDay);
    if (userCount > 5) {
      pattern.patterns.multipleUsers = true;
      reasons.push('Multiple users from same IP detected');
      score += 35;
    }

    // Check for repeated failures
    const failureCount = await this.getFailureCount(key, oneHour);
    if (failureCount > 5) {
      pattern.patterns.repeatedFailures = true;
      reasons.push('Repeated failures detected');
      score += 40;
    }

    // Check for endpoint abuse
    const endpointCount = await this.getEndpointCount(key, endpoint, oneHour);
    if (endpointCount > 50) {
      reasons.push('Endpoint abuse detected');
      score += 30;
    }

    pattern.suspiciousScore = score;
    this.requestPatterns.set(key, pattern);

    const suspicious = score > 50;
    const shouldBlock = score > 100 || pattern.patterns.rapidRequests;

    return {
      suspicious,
      score,
      reasons,
      shouldBlock
    };
  }

  /**
   * Block IP address for suspicious activity
   */
  async blockIP(
    ip: string,
    reason: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    duration: number = 24 * 60 * 60 * 1000, // 24 hours default
    userId?: string
  ): Promise<void> {
    const blockedUntil = new Date(Date.now() + duration);
    const blockInfo: IPBlockInfo = {
      ip,
      blockedAt: new Date(),
      blockedUntil,
      reason,
      severity,
      attempts: 1,
      userId
    };

    this.blockedIPs.set(ip, blockInfo);

    // Store in database for persistence
    await this.supabase
      .from('security_events')
      .insert({
        type: 'ip_blocked',
        severity,
        ip,
        user_id: userId,
        details: {
          reason,
          blocked_until: blockedUntil.toISOString(),
          duration
        },
        blocked: true
      });

    logger.warn('IP address blocked', {
      ip,
      reason,
      severity,
      blockedUntil: blockedUntil.toISOString(),
      userId
    });
  }

  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ip: string): Promise<IPBlockInfo | null> {
    const blockInfo = this.blockedIPs.get(ip);
    
    if (!blockInfo) {
      return null;
    }

    // Check if block has expired
    if (new Date() > blockInfo.blockedUntil) {
      this.blockedIPs.delete(ip);
      return null;
    }

    return blockInfo;
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    type: SecurityEvent['type'],
    severity: SecurityEvent['severity'],
    ip: string,
    endpoint: string,
    details: Record<string, any>,
    userId?: string,
    userAgent?: string,
    blocked: boolean = false,
    reason?: string
  ): Promise<void> {
    const event: SecurityEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      userId,
      ip,
      userAgent: userAgent || 'Unknown',
      endpoint,
      details,
      timestamp: new Date(),
      blocked,
      reason
    };

    // Store in database
    await this.supabase
      .from('security_events')
      .insert({
        id: event.id,
        type: event.type,
        severity: event.severity,
        user_id: event.userId,
        ip: event.ip,
        user_agent: event.userAgent,
        endpoint: event.endpoint,
        details: event.details,
        timestamp: event.timestamp.toISOString(),
        blocked: event.blocked,
        reason: event.reason
      });

    // Log to console
    const logLevel = severity === 'critical' ? 'error' : 
                    severity === 'high' ? 'warn' : 'info';
    
    logger[logLevel]('Security event logged', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      ip: event.ip,
      userId: event.userId,
      endpoint: event.endpoint,
      blocked: event.blocked,
      reason: event.reason
    });
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(timeRange: number = 24 * 60 * 60 * 1000): Promise<SecurityMetrics> {
    const since = new Date(Date.now() - timeRange);

    const { data: events } = await this.supabase
      .from('security_events')
      .select('*')
      .gte('timestamp', since.toISOString());

    if (!events) {
      return {
        totalRequests: 0,
        blockedRequests: 0,
        suspiciousIPs: 0,
        blockedIPs: 0,
        securityEvents: 0,
        averageSuspiciousScore: 0,
        topThreats: []
      };
    }

    const totalRequests = events.length;
    const blockedRequests = events.filter(e => e.blocked).length;
    const uniqueIPs = new Set(events.map(e => e.ip));
    const suspiciousIPs = events.filter(e => e.severity === 'high' || e.severity === 'critical').length;
    const blockedIPs = this.blockedIPs.size;

    // Calculate average suspicious score
    const scores = events
      .filter(e => e.details?.suspiciousScore)
      .map(e => e.details.suspiciousScore);
    const averageSuspiciousScore = scores.length > 0 ? 
      scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Get top threats
    const threatCounts = events.reduce((acc, event) => {
      const key = `${event.type}_${event.severity}`;
      acc[key] = ((acc[key] as number) || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topThreats = Object.entries(threatCounts)
      .map(([key, count]) => {
        const [type, severity] = key.split('_');
        return { type, count: count as number, severity };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      blockedRequests,
      suspiciousIPs,
      blockedIPs,
      securityEvents: events.length,
      averageSuspiciousScore,
      topThreats
    };
  }

  /**
   * Get request patterns for analysis
   */
  getRequestPatterns(): RequestPattern[] {
    return Array.from(this.requestPatterns.values());
  }

  /**
   * Clean up expired patterns and blocks
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Clean up expired patterns
    for (const [key, pattern] of this.requestPatterns.entries()) {
      if (now - pattern.lastRequest.getTime() > oneDay) {
        this.requestPatterns.delete(key);
      }
    }

    // Clean up expired blocks
    for (const [ip, blockInfo] of this.blockedIPs.entries()) {
      if (now > blockInfo.blockedUntil.getTime()) {
        this.blockedIPs.delete(ip);
      }
    }
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /wget/i,
      /curl/i,
      /python/i,
      /java/i,
      /php/i,
      /perl/i,
      /ruby/i,
      /go-http/i,
      /okhttp/i,
      /apache/i,
      /nginx/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Get user count from IP in time window
   */
  private async getUserCountFromIP(ip: string, timeWindow: number): Promise<number> {
    const since = new Date(Date.now() - timeWindow);
    
    const { data } = await this.supabase
      .from('security_events')
      .select('user_id')
      .eq('ip', ip)
      .gte('timestamp', since.toISOString())
      .not('user_id', 'is', null);

    if (!data) return 0;

    const uniqueUsers = new Set(data.map(e => e.user_id));
    return uniqueUsers.size;
  }

  /**
   * Get failure count for key in time window
   */
  private async getFailureCount(key: string, timeWindow: number): Promise<number> {
    const since = new Date(Date.now() - timeWindow);
    
    const { data } = await this.supabase
      .from('security_events')
      .select('id')
      .eq('ip', key.split(':')[0])
      .gte('timestamp', since.toISOString())
      .eq('severity', 'high');

    return data?.length || 0;
  }

  /**
   * Get endpoint count for key in time window
   */
  private async getEndpointCount(key: string, endpoint: string, timeWindow: number): Promise<number> {
    const since = new Date(Date.now() - timeWindow);
    
    const { data } = await this.supabase
      .from('security_events')
      .select('id')
      .eq('ip', key.split(':')[0])
      .eq('endpoint', endpoint)
      .gte('timestamp', since.toISOString());

    return data?.length || 0;
  }
}
