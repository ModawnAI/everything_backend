import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { refreshTokenService } from '../services/refresh-token.service';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';

/**
 * User Sessions Controller
 * Handles user session management endpoints
 */
export class UserSessionsController {
  /**
   * Rate limiting for session management endpoints
   */
  public sessionManagementRateLimit = rateLimit({
    config: {
      max: 20, // 20 requests per 15 minutes
      windowMs: 15 * 60 * 1000,
      strategy: 'sliding_window',
      scope: 'ip',
      enableHeaders: true,
      message: {
        error: 'Too many session management requests. Please try again later.',
        code: 'SESSION_MANAGEMENT_RATE_LIMIT_EXCEEDED'
      }
    }
  });

  /**
   * Get all active sessions for the authenticated user
   */
  public getActiveSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const currentSessionId = req.headers['x-session-id'] as string;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const sessions = await refreshTokenService.getActiveUserSessions(userId);

      // Mark current session if provided
      const sessionsWithCurrent = currentSessionId
        ? sessions.map(session => ({
            ...session,
            isCurrentDevice: session.id === currentSessionId
          }))
        : sessions;

      logger.info('Active sessions retrieved', {
        userId,
        sessionCount: sessions.length
      });

      res.json({
        success: true,
        data: {
          sessions: sessionsWithCurrent.map(session => ({
            id: session.id,
            deviceId: session.device_id,
            platform: session.platform || 'unknown',
            appVersion: session.app_version || 'unknown',
            lastActivity: session.last_activity,
            createdAt: session.created_at,
            expiresAt: session.expires_at,
            isCurrentDevice: session.isCurrentDevice || false
          })),
          totalCount: sessions.length,
          sessionLimitReached: sessions.length >= 5,
          maxDevices: 5 // From refresh token service
        }
      });

    } catch (error) {
      logger.error('Failed to get active sessions', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve active sessions',
        code: 'SESSION_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Revoke a specific session
   */
  public revokeSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.params;
      const reason = req.body.reason || 'user_requested';

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID is required',
          code: 'MISSING_SESSION_ID'
        });
      }

      await refreshTokenService.revokeUserSession(userId, sessionId);

      logger.info('Session revoked by user', {
        userId,
        sessionId,
        reason
      });

      res.json({
        success: true,
        message: 'Session revoked successfully'
      });

    } catch (error) {
      logger.error('Failed to revoke session', {
        userId: req.user?.id,
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to revoke session',
        code: 'SESSION_REVOCATION_FAILED'
      });
    }
  };

  /**
   * Revoke all other sessions (keep current session active)
   */
  public revokeAllOtherSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const currentSessionId = req.headers['x-session-id'] as string;
      const reason = req.body.reason || 'user_requested_logout_others';

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      await refreshTokenService.revokeAllOtherSessions(userId, currentSessionId);

      logger.info('All other sessions revoked by user', {
        userId,
        currentSessionId,
        reason
      });

      res.json({
        success: true,
        message: 'All other sessions revoked successfully'
      });

    } catch (error) {
      logger.error('Failed to revoke all other sessions', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to revoke all other sessions',
        code: 'BULK_SESSION_REVOCATION_FAILED'
      });
    }
  };

  /**
   * Get session analytics for the user
   */
  public getSessionAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const analytics = await refreshTokenService.getUserSessionAnalytics(userId);
      const suspiciousActivity = await refreshTokenService.detectSuspiciousActivity(userId);

      logger.debug('Session analytics retrieved', {
        userId,
        totalSessions: analytics.totalSessions
      });

      res.json({
        success: true,
        data: {
          ...analytics,
          suspiciousActivity: suspiciousActivity
        }
      });

    } catch (error) {
      logger.error('Failed to get session analytics', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve session analytics',
        code: 'SESSION_ANALYTICS_FAILED'
      });
    }
  };
}

export const userSessionsController = new UserSessionsController();
