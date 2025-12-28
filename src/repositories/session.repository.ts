/**
 * Session Repository
 * Manages unified sessions table for all user roles
 */

import { BaseRepository } from './base.repository';
import { Session, CreateSessionInput, UserRole } from '../types/unified-auth.types';
import { logger } from '../utils/logger';

export class SessionRepository extends BaseRepository<Session> {
  protected tableName = 'sessions';

  constructor() {
    super();
  }

  /**
   * Find session by token
   */
  async findByToken(token: string): Promise<Session | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to find session by token: ${error.message}`);
      }

      return data as Session;
    } catch (error) {
      logger.error('Error finding session by token', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Find session by refresh token
   */
  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('refresh_token', refreshToken)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to find session by refresh token: ${error.message}`);
      }

      return data as Session;
    } catch (error) {
      logger.error('Error finding session by refresh token', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Find all active sessions for a user
   */
  async findByUserId(userId: string, role: UserRole): Promise<Session[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('user_role', role)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to find sessions by user ID: ${error.message}`);
      }

      return (data || []) as Session[];
    } catch (error) {
      logger.error('Error finding sessions by user ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput, token: string, refreshToken?: string): Promise<Session> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      const refreshExpiresAt = refreshToken ? new Date() : undefined;
      if (refreshExpiresAt) {
        refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 days
      }

      const sessionData = {
        user_id: input.user_id,
        user_role: input.user_role,
        shop_id: input.shop_id,
        token,
        refresh_token: refreshToken,
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        device_id: input.device_id,
        device_name: input.device_name,
        is_active: true,
        last_activity_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        refresh_expires_at: refreshExpiresAt?.toISOString(),
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create session: ${error.message}`);
      }

      logger.info('Session created successfully', {
        userId: input.user_id,
        role: input.user_role,
        sessionId: data.id
      });

      return data as Session;
    } catch (error) {
      logger.error('Error creating session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input
      });
      throw error;
    }
  }

  /**
   * Update last activity timestamp
   */
  async updateLastActivity(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) {
        throw new Error(`Failed to update last activity: ${error.message}`);
      }
    } catch (error) {
      logger.error('Error updating last activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId
      });
      throw error;
    }
  }

  /**
   * Revoke a session
   */
  async revokeSession(
    sessionId: string,
    revokedBy?: string,
    reason?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: revokedBy,
          revocation_reason: reason
        })
        .eq('id', sessionId);

      if (error) {
        throw new Error(`Failed to revoke session: ${error.message}`);
      }

      logger.info('Session revoked', {
        sessionId,
        revokedBy,
        reason
      });
    } catch (error) {
      logger.error('Error revoking session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId
      });
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(
    userId: string,
    role: UserRole,
    revokedBy?: string,
    reason?: string
  ): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: revokedBy,
          revocation_reason: reason
        })
        .eq('user_id', userId)
        .eq('user_role', role)
        .eq('is_active', true)
        .select('id');

      if (error) {
        throw new Error(`Failed to revoke all user sessions: ${error.message}`);
      }

      const count = data?.length || 0;
      logger.info('All user sessions revoked', {
        userId,
        role,
        count,
        revokedBy,
        reason
      });

      return count;
    } catch (error) {
      logger.error('Error revoking all user sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Clean up expired sessions (call cleanup_expired_sessions RPC)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.executeRPC('cleanup_expired_sessions');
      logger.info('Expired sessions cleaned up');
    } catch (error) {
      logger.error('Error cleaning up expired sessions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if session is valid and not expired
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      const session = await this.findById(sessionId);
      if (!session) return false;

      return (
        session.is_active &&
        new Date(session.expires_at) > new Date()
      );
    } catch (error) {
      logger.error('Error checking session validity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId
      });
      return false;
    }
  }

  /**
   * Get active session count for user
   */
  async getActiveSessionCount(userId: string, role: UserRole): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from(this.tableName)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('user_role', role)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to get active session count: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      logger.error('Error getting active session count', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }
}
