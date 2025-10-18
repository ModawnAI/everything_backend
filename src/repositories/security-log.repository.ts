/**
 * Security Log Repository
 * Manages comprehensive audit logging for all security events
 */

import { BaseRepository } from './base.repository';
import { SecurityLog, CreateSecurityLogInput, SecurityEventCategory, SecuritySeverity, UserRole } from '../types/unified-auth.types';
import { logger } from '../utils/logger';

export class SecurityLogRepository extends BaseRepository<SecurityLog> {
  protected tableName = 'security_logs';

  constructor() {
    super();
  }

  /**
   * Create a security log entry
   */
  async createLog(input: CreateSecurityLogInput): Promise<SecurityLog> {
    try {
      const logData = {
        user_id: input.user_id,
        user_role: input.user_role,
        event_type: input.event_type,
        event_category: input.event_category,
        severity: input.severity,
        description: input.description,
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        device_id: input.device_id,
        session_id: input.session_id,
        resource_type: input.resource_type,
        resource_id: input.resource_id,
        old_value: input.old_value,
        new_value: input.new_value,
        metadata: input.metadata,
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(logData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create security log: ${error.message}`);
      }

      // Log critical events to system logger
      if (input.severity === 'critical' || input.severity === 'error') {
        logger.warn('Critical security event', {
          event_type: input.event_type,
          user_id: input.user_id,
          severity: input.severity,
          description: input.description
        });
      }

      return data as SecurityLog;
    } catch (error) {
      logger.error('Error creating security log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input
      });
      throw error;
    }
  }

  /**
   * Get security logs by user
   */
  async getLogsByUser(
    userId: string,
    role: UserRole,
    limit: number = 100
  ): Promise<SecurityLog[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('user_role', role)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get user security logs: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error getting user security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Get security logs by category
   */
  async getLogsByCategory(
    category: SecurityEventCategory,
    limit: number = 100
  ): Promise<SecurityLog[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('event_category', category)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get category security logs: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error getting category security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category
      });
      throw error;
    }
  }

  /**
   * Get security logs by severity
   */
  async getLogsBySeverity(
    severity: SecuritySeverity,
    limit: number = 100
  ): Promise<SecurityLog[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('severity', severity)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get severity security logs: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error getting severity security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        severity
      });
      throw error;
    }
  }

  /**
   * Get security logs in time range
   */
  async getLogsInTimeRange(
    startDate: Date,
    endDate: Date,
    options: {
      userId?: string;
      role?: UserRole;
      category?: SecurityEventCategory;
      severity?: SecuritySeverity;
      limit?: number;
    } = {}
  ): Promise<SecurityLog[]> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      if (options.role) {
        query = query.eq('user_role', options.role);
      }

      if (options.category) {
        query = query.eq('event_category', options.category);
      }

      if (options.severity) {
        query = query.eq('severity', options.severity);
      }

      query = query.order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get time range security logs: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error getting time range security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate,
        options
      });
      throw error;
    }
  }

  /**
   * Get security logs by session
   */
  async getLogsBySession(
    sessionId: string,
    limit: number = 100
  ): Promise<SecurityLog[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get session security logs: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error getting session security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId
      });
      throw error;
    }
  }

  /**
   * Get security logs by IP address
   */
  async getLogsByIP(
    ipAddress: string,
    limit: number = 100
  ): Promise<SecurityLog[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('ip_address', ipAddress)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get IP security logs: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error getting IP security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress
      });
      throw error;
    }
  }

  /**
   * Get security logs by resource
   */
  async getLogsByResource(
    resourceType: string,
    resourceId: string,
    limit: number = 100
  ): Promise<SecurityLog[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get resource security logs: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error getting resource security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resourceType,
        resourceId
      });
      throw error;
    }
  }

  /**
   * Search security logs by event type
   */
  async searchByEventType(
    eventType: string,
    limit: number = 100
  ): Promise<SecurityLog[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to search security logs by event type: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error searching security logs by event type', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType
      });
      throw error;
    }
  }

  /**
   * Get recent critical events
   */
  async getRecentCriticalEvents(
    hoursAgo: number = 24,
    limit: number = 50
  ): Promise<SecurityLog[]> {
    try {
      const timeThreshold = new Date();
      timeThreshold.setHours(timeThreshold.getHours() - hoursAgo);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('severity', 'critical')
        .gte('created_at', timeThreshold.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get recent critical events: ${error.message}`);
      }

      return (data || []) as SecurityLog[];
    } catch (error) {
      logger.error('Error getting recent critical events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursAgo
      });
      throw error;
    }
  }

  /**
   * Get security event statistics
   */
  async getStatistics(
    userId?: string,
    role?: UserRole,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    bySeverity: Record<SecuritySeverity, number>;
    byCategory: Record<SecurityEventCategory, number>;
  }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('severity, event_category');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (role) {
        query = query.eq('user_role', role);
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get security statistics: ${error.message}`);
      }

      const logs = (data || []) as SecurityLog[];

      const bySeverity: Record<SecuritySeverity, number> = {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0
      };

      const byCategory: Record<SecurityEventCategory, number> = {
        authentication: 0,
        authorization: 0,
        session: 0,
        account: 0,
        data_access: 0,
        configuration: 0,
        system: 0
      };

      logs.forEach(log => {
        bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
        byCategory[log.event_category] = (byCategory[log.event_category] || 0) + 1;
      });

      return {
        totalEvents: logs.length,
        bySeverity,
        byCategory
      };
    } catch (error) {
      logger.error('Error getting security statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Delete old security logs (cleanup)
   */
  async deleteOldLogs(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lte('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to delete old security logs: ${error.message}`);
      }

      const deletedCount = data?.length || 0;
      logger.info('Old security logs deleted', {
        count: deletedCount,
        cutoffDate
      });

      return deletedCount;
    } catch (error) {
      logger.error('Error deleting old security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        daysOld
      });
      throw error;
    }
  }
}
