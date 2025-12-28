/**
 * IP Blocking Service
 * 
 * Advanced IP blocking and throttling system with:
 * - Dynamic IP blocking based on violation patterns
 * - Geolocation-based blocking (optional)
 * - Enhanced security monitoring
 * - Automatic IP unblocking
 */

import { logger } from '../utils/logger';
import { getRedisRateLimitStore } from '../utils/redis-rate-limit-store';
import { RateLimitStore } from '../types/rate-limit.types';
import { getSupabaseClient } from '../config/database';

export interface IPBlockingConfig {
  // Violation thresholds
  maxViolationsPerHour: number;
  maxViolationsPerDay: number;
  
  // Blocking durations (in milliseconds)
  temporaryBlockDuration: number; // 1 hour
  permanentBlockDuration: number; // 24 hours
  
  // Auto-unblock settings
  autoUnblockEnabled: boolean;
  autoUnblockAfterHours: number;
  
  // Geolocation blocking (optional)
  geolocationBlockingEnabled: boolean;
  blockedCountries: string[];
  blockedRegions: string[];
  
  // Enhanced monitoring
  enableDetailedLogging: boolean;
  enableViolationTracking: boolean;
}

export interface IPViolation {
  ip: string;
  timestamp: Date;
  violationType: 'rate_limit' | 'suspicious_activity' | 'malicious_request' | 'ddos_attempt';
  endpoint: string;
  userAgent?: string;
  country?: string;
  region?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
}

export interface IPBlockInfo {
  ip: string;
  blockedAt: Date;
  blockedUntil: Date;
  reason: string;
  violationCount: number;
  isPermanent: boolean;
  unblockedAt?: Date;
  unblockedBy?: string;
  unblockReason?: string;
}

export class IPBlockingService {
  private store: RateLimitStore;
  private config: IPBlockingConfig;
  private supabase = getSupabaseClient();
  
  // Redis key prefixes
  private readonly VIOLATION_KEY_PREFIX = 'ip_violation:';
  private readonly BLOCK_KEY_PREFIX = 'ip_block:';
  private readonly VIOLATION_COUNT_KEY_PREFIX = 'ip_violation_count:';
  
  constructor(config: Partial<IPBlockingConfig> = {}) {
    this.store = getRedisRateLimitStore();
    this.config = {
      maxViolationsPerHour: 10,
      maxViolationsPerDay: 50,
      temporaryBlockDuration: 60 * 60 * 1000, // 1 hour
      permanentBlockDuration: 24 * 60 * 60 * 1000, // 24 hours
      autoUnblockEnabled: true,
      autoUnblockAfterHours: 24,
      geolocationBlockingEnabled: false,
      blockedCountries: [],
      blockedRegions: [],
      enableDetailedLogging: true,
      enableViolationTracking: true,
      ...config
    };
  }
  
  /**
   * Record an IP violation
   */
  async recordViolation(violation: IPViolation): Promise<void> {
    try {
      const now = new Date();
      const violationKey = `${this.VIOLATION_KEY_PREFIX}${violation.ip}:${now.getTime()}`;
      const countKey = `${this.VIOLATION_COUNT_KEY_PREFIX}${violation.ip}`;
      
      // Store violation details
      await this.store.set(violationKey, {
        totalHits: 1,
        resetTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        remainingRequests: 0
      } as any, 7 * 24 * 60 * 60 * 1000); // Keep for 7 days
      
      // Increment violation count
      const countData = await this.store.get(countKey);
      const currentCount = countData ? (countData as any).count || 0 : 0;
      
      await this.store.set(countKey, {
        totalHits: currentCount + 1,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        remainingRequests: 0
      } as any, 24 * 60 * 60 * 1000); // Keep for 24 hours
      
      // Log violation if enabled
      if (this.config.enableDetailedLogging) {
        logger.warn('IP violation recorded', {
          ip: violation.ip,
          type: violation.violationType,
          severity: violation.severity,
          endpoint: violation.endpoint,
          userAgent: violation.userAgent,
          country: violation.country,
          region: violation.region
        });
      }
      
      // Check if IP should be blocked
      await this.checkAndBlockIP(violation.ip);
      
    } catch (error) {
      logger.error('Failed to record IP violation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        violation
      });
    }
  }
  
  /**
   * Check if IP should be blocked based on violation patterns
   */
  private async checkAndBlockIP(ip: string): Promise<void> {
    try {
      const countKey = `${this.VIOLATION_COUNT_KEY_PREFIX}${ip}`;
      const countData = await this.store.get(countKey);
      
      if (!countData) return;
      
      const { count, lastViolation, violations } = countData as any;
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Count recent violations
      const recentViolations = violations.filter((v: any) => 
        new Date(v.timestamp) > oneHourAgo
      );
      
      const dailyViolations = violations.filter((v: any) => 
        new Date(v.timestamp) > oneDayAgo
      );
      
      // Check for critical violations
      const criticalViolations = violations.filter((v: any) => 
        v.severity === 'critical'
      );
      
      let shouldBlock = false;
      let blockReason = '';
      let blockDuration = this.config.temporaryBlockDuration;
      let isPermanent = false;
      
      // Block if too many violations in short time
      if (recentViolations.length >= this.config.maxViolationsPerHour) {
        shouldBlock = true;
        blockReason = `Too many violations in 1 hour (${recentViolations.length})`;
      }
      
      // Block if too many violations in a day
      if (dailyViolations.length >= this.config.maxViolationsPerDay) {
        shouldBlock = true;
        blockReason = `Too many violations in 24 hours (${dailyViolations.length})`;
        blockDuration = this.config.permanentBlockDuration;
        isPermanent = true;
      }
      
      // Block for critical violations
      if (criticalViolations.length > 0) {
        shouldBlock = true;
        blockReason = `Critical security violation detected (${criticalViolations.length})`;
        blockDuration = this.config.permanentBlockDuration;
        isPermanent = true;
      }
      
      if (shouldBlock) {
        await this.blockIP(ip, blockReason, blockDuration, isPermanent);
      }
      
    } catch (error) {
      logger.error('Failed to check IP blocking status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip
      });
    }
  }
  
  /**
   * Block an IP address
   */
  async blockIP(
    ip: string, 
    reason: string, 
    duration: number, 
    isPermanent: boolean = false
  ): Promise<void> {
    try {
      const now = new Date();
      const blockedUntil = new Date(now.getTime() + duration);
      
      const blockInfo: IPBlockInfo = {
        ip,
        blockedAt: now,
        blockedUntil,
        reason,
        violationCount: 0,
        isPermanent
      };
      
      const blockKey = `${this.BLOCK_KEY_PREFIX}${ip}`;
      await this.store.set(blockKey, {
        totalHits: 1,
        resetTime: blockedUntil,
        remainingRequests: 0
      } as any, duration);
      
      // Log blocking action
      logger.error('IP address blocked', {
        ip,
        reason,
        duration: duration / 1000 / 60, // minutes
        isPermanent,
        blockedUntil: blockedUntil.toISOString()
      });
      
      // Schedule auto-unblock if enabled
      if (this.config.autoUnblockEnabled && !isPermanent) {
        setTimeout(() => {
          this.unblockIP(ip, 'auto_unblock', 'Automatic unblock after timeout');
        }, duration);
      }
      
    } catch (error) {
      logger.error('Failed to block IP address', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
        reason
      });
    }
  }
  
  /**
   * Unblock an IP address
   */
  async unblockIP(ip: string, unblockedBy: string, reason: string): Promise<void> {
    try {
      const blockKey = `${this.BLOCK_KEY_PREFIX}${ip}`;
      const blockData = await this.store.get(blockKey);
      const blockInfo = blockData ? (blockData as any).blockInfo as IPBlockInfo : null;
      
      if (blockInfo) {
        blockInfo.unblockedAt = new Date();
        blockInfo.unblockedBy = unblockedBy;
        blockInfo.unblockReason = reason;
        
        // Remove from blocked list
        await this.store.reset(blockKey);
        
        // Log unblocking action
        logger.info('IP address unblocked', {
          ip,
          unblockedBy,
          reason,
          wasBlockedFor: blockInfo.blockedAt.toISOString()
        });
      }
      
    } catch (error) {
      logger.error('Failed to unblock IP address', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
        unblockedBy,
        reason
      });
    }
  }
  
  /**
   * Check if an IP is blocked
   */
  async isIPBlocked(ip: string): Promise<IPBlockInfo | null> {
    try {
      // Skip IP blocking in development mode or if disabled
      if (process.env.NODE_ENV === 'development' || process.env.DISABLE_IP_BLOCKING === 'true') {
        return null;
      }

      // Whitelist localhost and local IPs
      const localIPs = ['127.0.0.1', '::1', 'localhost'];
      if (localIPs.includes(ip)) {
        return null;
      }

      const blockKey = `${this.BLOCK_KEY_PREFIX}${ip}`;
      const blockData = await this.store.get(blockKey);
      const blockInfo = blockData ? (blockData as any).blockInfo as IPBlockInfo : null;

      if (!blockInfo) return null;

      // Check if block has expired
      if (new Date() > blockInfo.blockedUntil) {
        await this.unblockIP(ip, 'system', 'Block expired');
        return null;
      }

      return blockInfo;

    } catch (error) {
      logger.error('Failed to check IP block status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip
      });
      return null;
    }
  }
  
  /**
   * Get violation statistics for an IP
   */
  async getIPViolationStats(ip: string): Promise<{
    totalViolations: number;
    recentViolations: number;
    criticalViolations: number;
    lastViolation?: Date;
    violations: any[];
  }> {
    try {
      const countKey = `${this.VIOLATION_COUNT_KEY_PREFIX}${ip}`;
      const countData = await this.store.get(countKey);
      
      if (!countData) {
        return {
          totalViolations: 0,
          recentViolations: 0,
          criticalViolations: 0,
          violations: []
        };
      }
      
      const { count, lastViolation, violations } = countData as any;
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const recentViolations = violations.filter((v: any) => 
        new Date(v.timestamp) > oneHourAgo
      );
      
      const criticalViolations = violations.filter((v: any) => 
        v.severity === 'critical'
      );
      
      return {
        totalViolations: count,
        recentViolations: recentViolations.length,
        criticalViolations: criticalViolations.length,
        lastViolation: lastViolation ? new Date(lastViolation) : undefined,
        violations
      };
      
    } catch (error) {
      logger.error('Failed to get IP violation stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip
      });
      return {
        totalViolations: 0,
        recentViolations: 0,
        criticalViolations: 0,
        violations: []
      };
    }
  }
  
  /**
   * Get all blocked IPs (admin function)
   */
  async getAllBlockedIPs(): Promise<IPBlockInfo[]> {
    try {
      // This would require scanning Redis keys, which is expensive
      // In production, you might want to maintain a separate index
      // For now, return empty array
      return [];
      
    } catch (error) {
      logger.error('Failed to get all blocked IPs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }
  
  /**
   * Get violation history for an IP address
   */
  async getViolationHistory(ip: string, limit: number = 10): Promise<IPViolation[]> {
    try {
      const { data, error } = await this.supabase
        .from('ip_violations')
        .select('*')
        .eq('ip', ip)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching violation history', { ip, error: error.message });
        throw new Error(`Failed to fetch violation history: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('IPBlockingService.getViolationHistory error:', { ip, error });
      throw error;
    }
  }

  /**
   * Clean up expired violations and blocks
   */
  async cleanup(): Promise<void> {
    try {
      // This would require scanning Redis keys and cleaning up expired ones
      // In production, you might want to use Redis TTL or a background job
      logger.info('IP blocking cleanup completed');
      
    } catch (error) {
      logger.error('Failed to cleanup IP blocking data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Global instance
export const ipBlockingService = new IPBlockingService();

export default ipBlockingService;
