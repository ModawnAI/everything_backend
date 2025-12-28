/**
 * Login Attempt Repository
 * Tracks login attempts for all user roles
 */

import { BaseRepository } from './base.repository';
import { LoginAttempt, UserRole } from '../types/unified-auth.types';
import { logger } from '../utils/logger';

export class LoginAttemptRepository extends BaseRepository<LoginAttempt> {
  protected tableName = 'login_attempts';

  constructor() {
    super();
  }

  /**
   * Record a login attempt
   */
  async recordAttempt(
    email: string,
    role: UserRole,
    result: 'success' | 'failure' | 'blocked',
    options: {
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      deviceId?: string;
      failureReason?: string;
      sessionId?: string;
    } = {}
  ): Promise<LoginAttempt> {
    try {
      const attemptData = {
        user_id: options.userId,
        user_role: role,
        email,
        ip_address: options.ipAddress,
        user_agent: options.userAgent,
        device_id: options.deviceId,
        attempt_result: result,
        failure_reason: options.failureReason,
        attempted_at: new Date().toISOString(),
        session_id: options.sessionId
      };

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(attemptData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record login attempt: ${error.message}`);
      }

      logger.info('Login attempt recorded', {
        email,
        role,
        result,
        userId: options.userId
      });

      return data as LoginAttempt;
    } catch (error) {
      logger.error('Error recording login attempt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        role,
        result
      });
      throw error;
    }
  }

  /**
   * Get recent failed attempts for an email
   */
  async getRecentFailedAttempts(
    email: string,
    role: UserRole,
    minutesAgo: number = 15
  ): Promise<LoginAttempt[]> {
    try {
      const timeThreshold = new Date();
      timeThreshold.setMinutes(timeThreshold.getMinutes() - minutesAgo);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('email', email)
        .eq('user_role', role)
        .eq('attempt_result', 'failure')
        .gte('attempted_at', timeThreshold.toISOString())
        .order('attempted_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get recent failed attempts: ${error.message}`);
      }

      return (data || []) as LoginAttempt[];
    } catch (error) {
      logger.error('Error getting recent failed attempts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        role
      });
      throw error;
    }
  }

  /**
   * Get recent attempts by IP address
   */
  async getRecentAttemptsByIP(
    ipAddress: string,
    minutesAgo: number = 15
  ): Promise<LoginAttempt[]> {
    try {
      const timeThreshold = new Date();
      timeThreshold.setMinutes(timeThreshold.getMinutes() - minutesAgo);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('ip_address', ipAddress)
        .gte('attempted_at', timeThreshold.toISOString())
        .order('attempted_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get recent attempts by IP: ${error.message}`);
      }

      return (data || []) as LoginAttempt[];
    } catch (error) {
      logger.error('Error getting recent attempts by IP', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress
      });
      throw error;
    }
  }

  /**
   * Get login attempt history for a user
   */
  async getUserLoginHistory(
    userId: string,
    role: UserRole,
    limit: number = 50
  ): Promise<LoginAttempt[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('user_role', role)
        .order('attempted_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get user login history: ${error.message}`);
      }

      return (data || []) as LoginAttempt[];
    } catch (error) {
      logger.error('Error getting user login history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Count failed attempts in time window
   */
  async countFailedAttempts(
    email: string,
    role: UserRole,
    minutesAgo: number = 15
  ): Promise<number> {
    try {
      const timeThreshold = new Date();
      timeThreshold.setMinutes(timeThreshold.getMinutes() - minutesAgo);

      const { count, error } = await this.supabase
        .from(this.tableName)
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .eq('user_role', role)
        .eq('attempt_result', 'failure')
        .gte('attempted_at', timeThreshold.toISOString());

      if (error) {
        throw new Error(`Failed to count failed attempts: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      logger.error('Error counting failed attempts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        role
      });
      throw error;
    }
  }

  /**
   * Get login statistics for a user
   */
  async getLoginStatistics(userId: string, role: UserRole): Promise<{
    totalAttempts: number;
    successfulLogins: number;
    failedAttempts: number;
    blockedAttempts: number;
    lastSuccessfulLogin?: Date;
    lastFailedLogin?: Date;
  }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('attempt_result, attempted_at')
        .eq('user_id', userId)
        .eq('user_role', role)
        .order('attempted_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get login statistics: ${error.message}`);
      }

      const attempts = (data || []) as LoginAttempt[];
      const stats = {
        totalAttempts: attempts.length,
        successfulLogins: attempts.filter(a => a.attempt_result === 'success').length,
        failedAttempts: attempts.filter(a => a.attempt_result === 'failure').length,
        blockedAttempts: attempts.filter(a => a.attempt_result === 'blocked').length,
        lastSuccessfulLogin: attempts.find(a => a.attempt_result === 'success')?.attempted_at,
        lastFailedLogin: attempts.find(a => a.attempt_result === 'failure')?.attempted_at
      };

      return stats;
    } catch (error) {
      logger.error('Error getting login statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }
}
