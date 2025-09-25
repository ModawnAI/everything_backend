import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { refreshTokenService } from '../services/refresh-token.service';
import { securityMonitoringService } from '../services/security-monitoring.service';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';

/**
 * Admin Security Controller
 * Handles admin-initiated security actions including forced session invalidation
 */
export class AdminSecurityController {
  /**
   * Rate limiting for admin security actions
   */
  public adminSecurityRateLimit = rateLimit({
    config: {
      max: 50, // 50 requests per 15 minutes for admin actions
      windowMs: 15 * 60 * 1000,
      strategy: 'sliding_window',
      scope: 'ip',
      enableHeaders: true,
      message: {
        error: 'Too many admin security requests. Please try again later.',
        code: 'ADMIN_SECURITY_RATE_LIMIT_EXCEEDED'
      }
    }
  });

  /**
   * Force invalidate all sessions for a specific user
   */
  public forceInvalidateUserSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const adminId = req.user?.id;
      const { userId } = req.params;
      const { reason, keepCurrentSession = false, eventType = 'admin_action' } = req.body;

      if (!adminId) {
        return res.status(401).json({
          error: 'Admin authentication required',
          code: 'ADMIN_AUTHENTICATION_REQUIRED'
        });
      }

      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      // Validate event type
      const validEventTypes = ['admin_action', 'account_compromise', 'suspicious_activity', 'token_theft_detected'];
      if (!validEventTypes.includes(eventType)) {
        return res.status(400).json({
          error: 'Invalid event type',
          code: 'INVALID_EVENT_TYPE',
          validTypes: validEventTypes
        });
      }

      const result = await refreshTokenService.invalidateSessionsOnSecurityEvent(
        userId,
        eventType,
        reason || 'Admin-initiated session invalidation',
        true, // notifyUser
        'high' // priority
      );

      // Log admin action
        await securityMonitoringService.logSecurityEvent({
        event_type: 'admin_session_invalidation',
        user_id: userId,
        source_ip: req.ip,
        user_agent: req.headers['user-agent'] || 'unknown',
        endpoint: req.originalUrl,
        severity: 'high',
        details: {
          adminId,
          reason,
          eventType,
          sessionsInvalidated: result.invalidatedCount,
          sessionsFailed: result.failedCount,
          securityEventId: result.securityEventId
        }
      });

      logger.warn('Admin forced session invalidation', {
        adminId,
        targetUserId: userId,
        reason,
        eventType,
        invalidatedCount: result.invalidatedCount,
        failedCount: result.failedCount,
        securityEventId: result.securityEventId
      });

      res.json({
        success: true,
        message: 'User sessions invalidated successfully',
        data: {
          userId,
          invalidatedCount: result.invalidatedCount,
          failedCount: result.failedCount,
          eventType: result.eventType,
          securityEventId: result.securityEventId,
          notificationSent: result.notificationSent
        }
      });

    } catch (error) {
      logger.error('Failed to force invalidate user sessions', {
        adminId: req.user?.id,
        targetUserId: req.params.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to invalidate user sessions',
        code: 'SESSION_INVALIDATION_FAILED'
      });
    }
  };

  /**
   * Get user session information for admin review
   */
  public getUserSessionInfo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const adminId = req.user?.id;
      const { userId } = req.params;

      if (!adminId) {
        return res.status(401).json({
          error: 'Admin authentication required',
          code: 'ADMIN_AUTHENTICATION_REQUIRED'
        });
      }

      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      // Get active sessions
      const sessionData = await refreshTokenService.getActiveUserSessions(userId);
      
      // Get session analytics
      const analytics = await refreshTokenService.getUserSessionAnalytics(userId);
      
      // Get suspicious activity analysis
      const suspiciousActivity = await refreshTokenService.detectSuspiciousActivity(userId);

      logger.info('Admin retrieved user session info', {
        adminId,
        targetUserId: userId,
        sessionCount: sessionData.totalCount
      });

      res.json({
        success: true,
        data: {
          userId,
          sessions: sessionData.sessions.map(session => ({
            id: session.id,
            deviceId: session.deviceId,
            deviceFingerprint: session.deviceFingerprint,
            deviceInfo: session.deviceInfo,
            locationInfo: session.locationInfo,
            lastActivity: session.lastActivity,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt
          })),
          analytics: {
            totalSessions: analytics.totalSessions,
            activeSessions: analytics.activeSessions,
            deviceTypes: analytics.deviceTypes,
            locations: analytics.locations,
            lastActivity: analytics.lastActivity
          },
          suspiciousActivity: {
            hasExcessiveSessions: suspiciousActivity.hasExcessiveSessions,
            hasHighDeviceDiversity: suspiciousActivity.hasHighDeviceDiversity,
            hasMultipleLocations: suspiciousActivity.hasMultipleLocations,
            riskScore: suspiciousActivity.riskScore,
            recommendations: suspiciousActivity.recommendations
          },
          sessionLimitReached: sessionData.sessionLimitReached
        }
      });

    } catch (error) {
      logger.error('Failed to get user session info for admin', {
        adminId: req.user?.id,
        targetUserId: req.params.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve user session information',
        code: 'SESSION_INFO_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Bulk invalidate sessions for multiple users
   */
  public bulkInvalidateSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const adminId = req.user?.id;
      const { userIds, reason, eventType = 'admin_action' } = req.body;

      if (!adminId) {
        return res.status(401).json({
          error: 'Admin authentication required',
          code: 'ADMIN_AUTHENTICATION_REQUIRED'
        });
      }

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          error: 'User IDs array is required',
          code: 'MISSING_USER_IDS'
        });
      }

      if (userIds.length > 100) {
        return res.status(400).json({
          error: 'Cannot process more than 100 users at once',
          code: 'BULK_LIMIT_EXCEEDED'
        });
      }

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (const userId of userIds) {
        try {
          const result = await refreshTokenService.invalidateSessionsOnSecurityEvent(
            userId,
            eventType,
            reason || 'Bulk admin-initiated session invalidation',
            true, // notifyUser
            'high' // priority
          );

          results.push({
            userId,
            success: true,
            invalidatedCount: result.invalidatedCount,
            failedCount: result.failedCount,
            securityEventId: result.securityEventId
          });

          successCount++;

        } catch (error) {
          results.push({
            userId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          failureCount++;
          
          logger.error('Failed to invalidate sessions for user in bulk operation', {
            adminId,
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Log bulk admin action
        await securityMonitoringService.logSecurityEvent({
        event_type: 'admin_bulk_session_invalidation',
        user_id: null, // No specific user for bulk actions
        source_ip: req.ip,
        user_agent: req.headers['user-agent'] || 'unknown',
        endpoint: req.originalUrl,
        severity: 'high',
        details: {
          adminId,
          reason,
          eventType,
          totalUsers: userIds.length,
          successCount,
          failureCount,
          userIds: userIds.slice(0, 10) // Log first 10 user IDs for reference
        }
      });

      logger.warn('Admin bulk session invalidation completed', {
        adminId,
        totalUsers: userIds.length,
        successCount,
        failureCount,
        reason,
        eventType
      });

      res.json({
        success: true,
        message: 'Bulk session invalidation completed',
        data: {
          totalUsers: userIds.length,
          successCount,
          failureCount,
          results
        }
      });

    } catch (error) {
      logger.error('Failed to perform bulk session invalidation', {
        adminId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to perform bulk session invalidation',
        code: 'BULK_SESSION_INVALIDATION_FAILED'
      });
    }
  };

  /**
   * Get security events related to session invalidation
   */
  public getSecurityEvents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const adminId = req.user?.id;
      const { 
        userId, 
        eventType, 
        severity, 
        limit = 50, 
        offset = 0,
        startDate,
        endDate 
      } = req.query;

      if (!adminId) {
        return res.status(401).json({
          error: 'Admin authentication required',
          code: 'ADMIN_AUTHENTICATION_REQUIRED'
        });
      }

      // This would integrate with security monitoring service
      // For now, return mock data structure
      const events = [];

      logger.info('Admin retrieved security events', {
        adminId,
        filters: { userId, eventType, severity, limit, offset, startDate, endDate }
      });

      res.json({
        success: true,
        data: {
          events,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: 0
          },
          filters: {
            userId,
            eventType,
            severity,
            startDate,
            endDate
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get security events for admin', {
        adminId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve security events',
        code: 'SECURITY_EVENTS_RETRIEVAL_FAILED'
      });
    }
  };
}

export const adminSecurityController = new AdminSecurityController();
