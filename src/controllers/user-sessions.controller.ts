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

      const sessionData = await refreshTokenService.getActiveUserSessions(userId);

      // Mark current session if provided
      if (currentSessionId) {
        sessionData.sessions = sessionData.sessions.map(session => ({
          ...session,
          isCurrentDevice: session.id === currentSessionId
        }));
      }

      logger.info('Active sessions retrieved', {
        userId,
        sessionCount: sessionData.totalCount,
        sessionLimitReached: sessionData.sessionLimitReached
      });

      res.json({
        success: true,
        data: {
          sessions: sessionData.sessions.map(session => ({
            id: session.id,
            deviceId: session.deviceId,
            deviceInfo: {
              type: session.deviceInfo?.deviceType || 'unknown',
              browser: session.deviceInfo?.browser?.name || 'unknown',
              os: session.deviceInfo?.os?.name || 'unknown',
              userAgent: session.deviceInfo?.userAgent || 'unknown'
            },
            location: session.locationInfo ? {
              country: session.locationInfo.country,
              city: session.locationInfo.city,
              region: session.locationInfo.region
            } : null,
            lastActivity: session.lastActivity,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isCurrentDevice: session.isCurrentDevice || false
          })),
          totalCount: sessionData.totalCount,
          sessionLimitReached: sessionData.sessionLimitReached,
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

      const success = await refreshTokenService.revokeUserSession(userId, sessionId, reason);

      if (!success) {
        return res.status(404).json({
          error: 'Session not found or already revoked',
          code: 'SESSION_NOT_FOUND'
        });
      }

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

      const result = await refreshTokenService.revokeAllOtherSessions(userId, currentSessionId, reason);

      logger.info('All other sessions revoked by user', {
        userId,
        currentSessionId,
        revokedCount: result.revokedCount,
        failedCount: result.failedCount,
        reason
      });

      res.json({
        success: true,
        message: 'All other sessions revoked successfully',
        data: {
          revokedCount: result.revokedCount,
          failedCount: result.failedCount
        }
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
        totalSessions: analytics.totalSessions,
        activeSessions: analytics.activeSessions
      });

      res.json({
        success: true,
        data: {
          ...analytics,
          suspiciousActivity: {
            hasExcessiveSessions: suspiciousActivity.hasExcessiveSessions,
            hasHighDeviceDiversity: suspiciousActivity.hasHighDeviceDiversity,
            hasMultipleLocations: suspiciousActivity.hasMultipleLocations,
            riskScore: suspiciousActivity.riskScore,
            recommendations: suspiciousActivity.recommendations
          }
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
