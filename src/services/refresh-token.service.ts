import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import database from '../config/database';
import { logger } from '../utils/logger';
import {
  RefreshTokenData,
  TokenPair,
  RefreshTokenError,
  RefreshTokenExpiredError,
  RefreshTokenRevokedError
} from '../types/security.types';

interface DeviceDetails {
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  ipAddress?: string;
  userAgent?: string;
}

class RefreshTokenService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  async generateTokenPair(userId: string, deviceDetails?: DeviceDetails): Promise<TokenPair> {
    try {
      const refreshToken = this.generateRefreshToken();
      const tokenHash = this.hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY_MS);

      const { error } = await database.getClient()
        .from('refresh_tokens')
        .insert({
          user_id: userId,
          token_hash: tokenHash,
          device_id: deviceDetails?.deviceId,
          device_name: deviceDetails?.deviceName,
          device_type: deviceDetails?.deviceType,
          user_agent: deviceDetails?.userAgent,
          ip_address: deviceDetails?.ipAddress,
          expires_at: expiresAt.toISOString(),
          is_active: true
        });

      if (error) {
        logger.error('Failed to store refresh token', { error, userId });
        throw new RefreshTokenError('Failed to generate token pair');
      }

      const accessToken = jwt.sign(
        { userId, type: 'access' },
        config.auth.jwtSecret,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY }
      );

      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        refreshExpiresIn: 7 * 24 * 60 * 60
      };
    } catch (error) {
      logger.error('Error generating token pair', { error, userId });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to generate tokens');
    }
  }

  async refreshTokens(refreshToken: string, deviceDetails?: DeviceDetails): Promise<TokenPair> {
    try {
      const tokenHash = this.hashToken(refreshToken);

      const { data: tokenData, error } = await database.getClient()
        .from('refresh_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .eq('is_active', true)
        .single();

      if (error || !tokenData) {
        throw new RefreshTokenError('Invalid refresh token');
      }

      if (tokenData.revoked || tokenData.revoked_at) {
        throw new RefreshTokenRevokedError();
      }

      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        throw new RefreshTokenExpiredError();
      }

      await database.getClient()
        .from('refresh_tokens')
        .update({
          last_used_at: new Date().toISOString(),
          ...(deviceDetails?.ipAddress && { ip_address: deviceDetails.ipAddress }),
          ...(deviceDetails?.userAgent && { user_agent: deviceDetails.userAgent })
        })
        .eq('id', tokenData.id);

      const accessToken = jwt.sign(
        { userId: tokenData.user_id, type: 'access' },
        config.auth.jwtSecret,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY }
      );

      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        refreshExpiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      };
    } catch (error) {
      logger.error('Error refreshing tokens', { error });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to refresh tokens');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    return this.refreshTokens(refreshToken);
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(refreshToken);

      const { error } = await database.getClient()
        .from('refresh_tokens')
        .update({
          is_active: false,
          revoked: true,
          revoked_at: new Date().toISOString()
        })
        .eq('token_hash', tokenHash);

      if (error) {
        logger.error('Failed to revoke refresh token', { error });
        throw new RefreshTokenError('Failed to revoke token');
      }
    } catch (error) {
      logger.error('Error revoking refresh token', { error });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to revoke token');
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      const { error } = await database.getClient()
        .from('refresh_tokens')
        .update({
          is_active: false,
          revoked: true,
          revoked_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        logger.error('Failed to revoke user tokens', { error, userId });
        throw new RefreshTokenError('Failed to revoke all tokens');
      }
    } catch (error) {
      logger.error('Error revoking all user tokens', { error, userId });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to revoke all tokens');
    }
  }

  async getUserRefreshTokens(userId: string): Promise<RefreshTokenData[]> {
    try {
      const { data, error } = await database.getClient()
        .from('refresh_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get user refresh tokens', { error, userId });
        throw new RefreshTokenError('Failed to get user sessions');
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting user refresh tokens', { error, userId });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to get user sessions');
    }
  }

  async getUserActiveTokens(userId: string): Promise<RefreshTokenData[]> {
    return this.getUserRefreshTokens(userId);
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      const { data, error } = await database.getClient()
        .from('refresh_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        logger.error('Failed to cleanup expired tokens', { error });
        throw new RefreshTokenError('Failed to cleanup expired tokens');
      }

      const count = data?.length || 0;
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired refresh tokens`);
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning up expired tokens', { error });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to cleanup expired tokens');
    }
  }

  generateDeviceFingerprint(userAgent?: string, ipAddress?: string): string {
    const data = `${userAgent || 'unknown'}:${ipAddress || 'unknown'}`;
    return createHash('md5').update(data).digest('hex');
  }

  async getActiveUserSessions(userId: string): Promise<any[]> {
    try {
      const { data, error } = await database.getClient()
        .from('refresh_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false });

      if (error) {
        logger.error('Failed to get active user sessions', { error, userId });
        throw new RefreshTokenError('Failed to get active sessions');
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting active user sessions', { error, userId });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to get active sessions');
    }
  }

  async getUserSessionAnalytics(userId: string): Promise<any> {
    try {
      const sessions = await this.getActiveUserSessions(userId);
      return {
        totalSessions: sessions.length,
        devices: [...new Set(sessions.map(s => s.device_type).filter(Boolean))],
        locations: [...new Set(sessions.map(s => s.ip_address).filter(Boolean))],
        lastActivity: sessions[0]?.last_used_at || null,
        sessionsPerDevice: sessions.reduce((acc, s) => {
          const device = s.device_type || 'unknown';
          acc[device] = (acc[device] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch (error) {
      logger.error('Error getting session analytics', { error, userId });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to get session analytics');
    }
  }

  async detectSuspiciousActivity(userId: string): Promise<any[]> {
    try {
      const sessions = await this.getActiveUserSessions(userId);
      const suspicious = [];

      // Check for multiple sessions from different IPs
      const uniqueIps = [...new Set(sessions.map(s => s.ip_address).filter(Boolean))];
      if (uniqueIps.length > 3) {
        suspicious.push({
          type: 'multiple_ips',
          severity: 'medium',
          message: `User has sessions from ${uniqueIps.length} different IP addresses`
        });
      }

      // Check for rapid session creation
      const recentSessions = sessions.filter(s => {
        const created = new Date(s.created_at);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return created > hourAgo;
      });
      if (recentSessions.length > 5) {
        suspicious.push({
          type: 'rapid_session_creation',
          severity: 'high',
          message: `${recentSessions.length} sessions created in the last hour`
        });
      }

      return suspicious;
    } catch (error) {
      logger.error('Error detecting suspicious activity', { error, userId });
      return [];
    }
  }

  async revokeUserSession(sessionId: string): Promise<void> {
    try {
      const { error } = await database.getClient()
        .from('refresh_tokens')
        .update({
          is_active: false,
          revoked: true,
          revoked_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        logger.error('Failed to revoke user session', { error, sessionId });
        throw new RefreshTokenError('Failed to revoke session');
      }
    } catch (error) {
      logger.error('Error revoking user session', { error, sessionId });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to revoke session');
    }
  }

  async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    try {
      const { error } = await database.getClient()
        .from('refresh_tokens')
        .update({
          is_active: false,
          revoked: true,
          revoked_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .neq('id', currentSessionId)
        .eq('is_active', true);

      if (error) {
        logger.error('Failed to revoke other sessions', { error, userId });
        throw new RefreshTokenError('Failed to revoke other sessions');
      }
    } catch (error) {
      logger.error('Error revoking other sessions', { error, userId });
      throw error instanceof RefreshTokenError ? error : new RefreshTokenError('Failed to revoke other sessions');
    }
  }
}

export const refreshTokenService = new RefreshTokenService();
export { RefreshTokenError, RefreshTokenExpiredError, RefreshTokenRevokedError };