/**
 * Session Tracking Middleware
 * 
 * Comprehensive session tracking and device fingerprinting middleware
 * for enhanced security monitoring and user experience
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { generateEnhancedDeviceFingerprint, EnhancedDeviceFingerprint, AuthenticatedRequest } from './auth.middleware';
import { securityMonitoringService } from '../services/security-monitoring.service';

/**
 * Session tracking data interface
 */
export interface SessionTrackingData {
  sessionId: string;
  userId?: string;
  deviceFingerprint: EnhancedDeviceFingerprint;
  requestPath: string;
  requestMethod: string;
  timestamp: Date;
  responseTime?: number;
  statusCode?: number;
  ipAddress: string;
  geolocation?: {
    country?: string;
    city?: string;
    region?: string;
  };
}

/**
 * Session analytics interface
 */
export interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  uniqueDevices: number;
  deviceTypes: Record<string, number>;
  browsers: Record<string, number>;
  operatingSystems: Record<string, number>;
  averageSessionDuration: number;
  topCountries: Array<{ country: string; count: number }>;
  suspiciousActivityCount: number;
}

/**
 * Session tracking middleware class
 */
export class SessionTrackingMiddleware {
  private supabase = getSupabaseClient();
  private readonly SESSION_TIMEOUT_MINUTES = 30;
  private readonly SUSPICIOUS_REQUEST_THRESHOLD = 100; // requests per minute

  /**
   * Track session activity for authenticated requests
   */
  trackAuthenticatedSession() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();

      try {
        if (req.user && req.session) {
          // Generate enhanced device fingerprint
          const deviceFingerprint = generateEnhancedDeviceFingerprint(req, {
            timezone: req.headers['x-timezone'],
            screenResolution: req.headers['x-screen-resolution']
          });

          // Track the session activity
          const trackingData: SessionTrackingData = {
            sessionId: req.session.id,
            userId: req.user.id,
            deviceFingerprint,
            requestPath: req.path,
            requestMethod: req.method,
            timestamp: new Date(),
            ipAddress: req.ip || 'unknown'
          };

          // Store session activity (non-blocking)
          this.storeSessionActivity(trackingData).catch(error => {
            logger.error('Failed to store session activity', {
              error: error instanceof Error ? error.message : 'Unknown error',
              sessionId: req.session?.id,
              userId: req.user?.id
            });
          });

          // Check for suspicious activity patterns
          this.detectSuspiciousActivity(trackingData).catch(error => {
            logger.error('Failed to detect suspicious activity', {
              error: error instanceof Error ? error.message : 'Unknown error',
              sessionId: req.session?.id
            });
          });
        }

        // Continue with the request
        next();

        // Track response time after request completion
        const responseTime = Date.now() - startTime;
        if (req.session) {
          this.updateSessionResponseTime(req.session.id, responseTime, res.statusCode).catch(error => {
            logger.debug('Failed to update session response time', { error });
          });
        }

      } catch (error) {
        logger.error('Session tracking middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method
        });
        
        // Don't fail the request due to tracking errors
        next();
      }
    };
  }

  /**
   * Track session activity for anonymous requests
   */
  trackAnonymousSession() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Generate device fingerprint for anonymous tracking
        const deviceFingerprint = generateEnhancedDeviceFingerprint(req);
        
        // Create anonymous session tracking
        const trackingData: SessionTrackingData = {
          sessionId: `anon_${deviceFingerprint.fingerprint}`,
          deviceFingerprint,
          requestPath: req.path,
          requestMethod: req.method,
          timestamp: new Date(),
          ipAddress: req.ip || 'unknown'
        };

        // Store anonymous activity (non-blocking)
        this.storeAnonymousActivity(trackingData).catch(error => {
          logger.debug('Failed to store anonymous activity', { error });
        });

        next();
      } catch (error) {
        logger.error('Anonymous session tracking error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        next();
      }
    };
  }

  /**
   * Store session activity in database
   */
  private async storeSessionActivity(data: SessionTrackingData): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('session_activities')
        .insert({
          session_id: data.sessionId,
          user_id: data.userId,
          device_fingerprint: data.deviceFingerprint.fingerprint,
          device_info: {
            userAgent: data.deviceFingerprint.userAgent,
            browser: data.deviceFingerprint.browser,
            os: data.deviceFingerprint.os,
            platform: data.deviceFingerprint.platform,
            deviceType: data.deviceFingerprint.deviceType,
            timezone: data.deviceFingerprint.timezone,
            screenResolution: data.deviceFingerprint.screenResolution
          },
          request_path: data.requestPath,
          request_method: data.requestMethod,
          ip_address: data.ipAddress,
          timestamp: data.timestamp.toISOString(),
          response_time: data.responseTime,
          status_code: data.statusCode
        });

      if (error) {
        throw new Error(`Failed to store session activity: ${error.message}`);
      }

      logger.debug('Session activity stored', {
        sessionId: data.sessionId,
        userId: data.userId,
        path: data.requestPath
      });

    } catch (error) {
      logger.error('Error storing session activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: data.sessionId
      });
      throw error;
    }
  }

  /**
   * Store anonymous activity
   */
  private async storeAnonymousActivity(data: SessionTrackingData): Promise<void> {
    try {
      // Store in a separate table or with anonymous flag
      const { error } = await this.supabase
        .from('anonymous_activities')
        .insert({
          session_fingerprint: data.sessionId,
          device_fingerprint: data.deviceFingerprint.fingerprint,
          device_info: {
            browser: data.deviceFingerprint.browser,
            os: data.deviceFingerprint.os,
            deviceType: data.deviceFingerprint.deviceType
          },
          request_path: data.requestPath,
          request_method: data.requestMethod,
          ip_address: data.ipAddress,
          timestamp: data.timestamp.toISOString()
        });

      if (error && !error.message.includes('does not exist')) {
        // Only log if it's not a table doesn't exist error
        logger.debug('Failed to store anonymous activity', { error: error.message });
      }

    } catch (error) {
      logger.debug('Error storing anonymous activity', { error });
    }
  }

  /**
   * Update session response time
   */
  private async updateSessionResponseTime(sessionId: string, responseTime: number, statusCode: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('session_activities')
        .update({
          response_time: responseTime,
          status_code: statusCode,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) {
        logger.debug('Failed to update session response time', { error: error.message });
      }

    } catch (error) {
      logger.debug('Error updating session response time', { error });
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private async detectSuspiciousActivity(data: SessionTrackingData): Promise<void> {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Check request frequency from same IP
      const { data: recentRequests, error } = await this.supabase
        .from('session_activities')
        .select('id')
        .eq('ip_address', data.ipAddress)
        .gte('timestamp', oneMinuteAgo.toISOString())
        .limit(this.SUSPICIOUS_REQUEST_THRESHOLD + 1);

      if (error) {
        logger.debug('Failed to check suspicious activity', { error: error.message });
        return;
      }

      if (recentRequests && recentRequests.length > this.SUSPICIOUS_REQUEST_THRESHOLD) {
        // Log suspicious activity
        await securityMonitoringService.logSecurityEvent({
          event_type: 'suspicious_activity',
          user_id: data.userId,
          source_ip: data.ipAddress,
          user_agent: data.deviceFingerprint.userAgent,
          endpoint: data.requestPath,
          severity: 'high',
          details: {
            activity_type: 'high_request_frequency',
            request_count: recentRequests.length,
            time_window: '1_minute',
            deviceFingerprint: data.deviceFingerprint.fingerprint
          }
        });

        logger.warn('Suspicious activity detected', {
          ipAddress: data.ipAddress,
          requestCount: recentRequests.length,
          userId: data.userId,
          deviceFingerprint: data.deviceFingerprint.fingerprint
        });
      }

    } catch (error) {
      logger.error('Error detecting suspicious activity', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get session analytics for a user
   */
  async getSessionAnalytics(userId: string, days: number = 30): Promise<SessionAnalytics> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: sessions, error } = await this.supabase
        .from('session_activities')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString());

      if (error) {
        throw new Error(`Failed to get session analytics: ${error.message}`);
      }

      if (!sessions || sessions.length === 0) {
        return {
          totalSessions: 0,
          activeSessions: 0,
          uniqueDevices: 0,
          deviceTypes: {},
          browsers: {},
          operatingSystems: {},
          averageSessionDuration: 0,
          topCountries: [],
          suspiciousActivityCount: 0
        };
      }

      // Process analytics
      const uniqueDevices = new Set(sessions.map(s => s.device_fingerprint)).size;
      const deviceTypes: Record<string, number> = {};
      const browsers: Record<string, number> = {};
      const operatingSystems: Record<string, number> = {};

      sessions.forEach(session => {
        const deviceInfo = session.device_info || {};
        
        // Count device types
        const deviceType = deviceInfo.deviceType || 'unknown';
        deviceTypes[deviceType] = (deviceTypes[deviceType] || 0) + 1;

        // Count browsers
        const browserName = deviceInfo.browser?.name || 'unknown';
        browsers[browserName] = (browsers[browserName] || 0) + 1;

        // Count operating systems
        const osName = deviceInfo.os?.name || 'unknown';
        operatingSystems[osName] = (operatingSystems[osName] || 0) + 1;
      });

      return {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => {
          const lastActivity = new Date(s.timestamp);
          const now = new Date();
          return (now.getTime() - lastActivity.getTime()) < (this.SESSION_TIMEOUT_MINUTES * 60 * 1000);
        }).length,
        uniqueDevices,
        deviceTypes,
        browsers,
        operatingSystems,
        averageSessionDuration: 0, // Would need session start/end tracking
        topCountries: [], // Would need geolocation data
        suspiciousActivityCount: 0 // Would need to query security events
      };

    } catch (error) {
      logger.error('Error getting session analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Clean up old session activities
   */
  async cleanupOldSessions(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error, count } = await this.supabase
        .from('session_activities')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (error) {
        throw new Error(`Failed to cleanup old sessions: ${error.message}`);
      }

      logger.info('Cleaned up old session activities', { 
        deletedCount: count || 0,
        cutoffDate: cutoffDate.toISOString()
      });

      return count || 0;

    } catch (error) {
      logger.error('Error cleaning up old sessions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

// Export singleton instance
export const sessionTrackingMiddleware = new SessionTrackingMiddleware();
export default sessionTrackingMiddleware;

