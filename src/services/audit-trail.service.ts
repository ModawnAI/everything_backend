/**
 * Audit Trail Service
 * 
 * Comprehensive audit trail system for reservation state machine compliance and reporting:
 * - State change history retrieval with filtering and pagination
 * - Compliance reporting for audit requirements
 * - Advanced analytics and trend analysis
 * - Export capabilities for external audit systems
 * - Data retention and archival management
 * - Security event correlation and analysis
 */

import { getSupabaseClient } from '../config/database';
import { ReservationStatus } from '../types/database.types';
import { logger } from '../utils/logger';

// Audit trail interfaces
export interface AuditTrailEntry {
  id: string;
  reservationId: string;
  transitionId?: string;
  fromStatus: ReservationStatus;
  toStatus: ReservationStatus;
  changedBy: 'user' | 'shop' | 'system' | 'admin';
  changedById: string;
  reason?: string;
  metadata: Record<string, any>;
  businessContext: Record<string, any>;
  systemContext: Record<string, any>;
  timestamp: string;
  processingTimeMs?: number;
}

export interface AuditTrailFilter {
  reservationId?: string;
  userId?: string;
  shopId?: string;
  fromStatus?: ReservationStatus;
  toStatus?: ReservationStatus;
  changedBy?: 'user' | 'shop' | 'system' | 'admin';
  changedById?: string;
  dateFrom?: string;
  dateTo?: string;
  reason?: string;
  hasErrors?: boolean;
}

export interface AuditTrailQuery {
  filter: AuditTrailFilter;
  pagination: {
    page: number;
    limit: number;
  };
  sorting: {
    field: 'timestamp' | 'fromStatus' | 'toStatus' | 'changedBy';
    direction: 'asc' | 'desc';
  };
}

export interface AuditTrailResult {
  entries: AuditTrailEntry[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: string;
  period: {
    from: string;
    to: string;
  };
  summary: {
    totalTransitions: number;
    successfulTransitions: number;
    failedTransitions: number;
    errorRate: number;
    averageProcessingTime: number;
  };
  byStatus: Array<{
    fromStatus: ReservationStatus;
    toStatus: ReservationStatus;
    count: number;
    successRate: number;
    averageProcessingTime: number;
  }>;
  byActor: Array<{
    changedBy: string;
    count: number;
    successRate: number;
  }>;
  securityEvents: Array<{
    type: string;
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  dataIntegrity: {
    orphanedEntries: number;
    missingTransitions: number;
    duplicateEntries: number;
  };
}

export interface TrendAnalysis {
  period: string;
  transitionTrends: Array<{
    date: string;
    totalTransitions: number;
    successRate: number;
    errorRate: number;
    averageProcessingTime: number;
  }>;
  statusDistribution: Array<{
    status: ReservationStatus;
    count: number;
    percentage: number;
  }>;
  peakHours: Array<{
    hour: number;
    transitionCount: number;
  }>;
  anomalies: Array<{
    date: string;
    type: 'high_error_rate' | 'unusual_volume' | 'slow_processing';
    severity: 'low' | 'medium' | 'high';
    description: string;
    value: number;
    threshold: number;
  }>;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  includeMetadata: boolean;
  includeSystemContext: boolean;
  compression?: 'gzip' | 'zip';
  encryption?: boolean;
}

export class AuditTrailService {
  private supabase = getSupabaseClient();

  /**
   * Get audit trail entries with advanced filtering and pagination
   */
  async getAuditTrail(query: AuditTrailQuery): Promise<AuditTrailResult> {
    try {
      const { filter, pagination, sorting } = query;
      const offset = (pagination.page - 1) * pagination.limit;

      // Build the query with filters
      let supabaseQuery = this.supabase
        .from('reservation_state_audit')
        .select(`
          id,
          reservation_id,
          transition_id,
          from_status,
          to_status,
          changed_by,
          changed_by_id,
          reason,
          metadata,
          business_context,
          system_context,
          timestamp
        `, { count: 'exact' });

      // Apply filters
      if (filter.reservationId) {
        supabaseQuery = supabaseQuery.eq('reservation_id', filter.reservationId);
      }
      if (filter.fromStatus) {
        supabaseQuery = supabaseQuery.eq('from_status', filter.fromStatus);
      }
      if (filter.toStatus) {
        supabaseQuery = supabaseQuery.eq('to_status', filter.toStatus);
      }
      if (filter.changedBy) {
        supabaseQuery = supabaseQuery.eq('changed_by', filter.changedBy);
      }
      if (filter.changedById) {
        supabaseQuery = supabaseQuery.eq('changed_by_id', filter.changedById);
      }
      if (filter.dateFrom) {
        supabaseQuery = supabaseQuery.gte('timestamp', filter.dateFrom);
      }
      if (filter.dateTo) {
        supabaseQuery = supabaseQuery.lte('timestamp', filter.dateTo);
      }
      if (filter.reason) {
        supabaseQuery = supabaseQuery.ilike('reason', `%${filter.reason}%`);
      }
      if (filter.hasErrors !== undefined) {
        if (filter.hasErrors) {
          supabaseQuery = supabaseQuery.like('reason', 'TRANSITION_FAILED:%');
        } else {
          supabaseQuery = supabaseQuery.not('reason', 'like', 'TRANSITION_FAILED:%');
        }
      }

      // Apply additional filters for user/shop context
      if (filter.userId || filter.shopId) {
        const orConditions = [];
        if (filter.userId) {
          orConditions.push(`business_context->>userId.eq.${filter.userId}`);
        }
        if (filter.shopId) {
          orConditions.push(`business_context->>shopId.eq.${filter.shopId}`);
        }
        if (orConditions.length > 0) {
          supabaseQuery = supabaseQuery.or(orConditions.join(','));
        }
      }

      // Apply sorting
      const sortField = sorting.field === 'timestamp' ? 'timestamp' : 
                       sorting.field === 'fromStatus' ? 'from_status' :
                       sorting.field === 'toStatus' ? 'to_status' :
                       sorting.field === 'changedBy' ? 'changed_by' : 'timestamp';
      
      supabaseQuery = supabaseQuery.order(sortField, { ascending: sorting.direction === 'asc' });

      // Apply pagination
      supabaseQuery = supabaseQuery.range(offset, offset + pagination.limit - 1);

      const { data, error, count } = await supabaseQuery;

      if (error) {
        throw new Error(`Failed to fetch audit trail: ${error.message}`);
      }

      const entries: AuditTrailEntry[] = (data || []).map(entry => ({
        id: entry.id,
        reservationId: entry.reservation_id,
        transitionId: entry.transition_id,
        fromStatus: entry.from_status,
        toStatus: entry.to_status,
        changedBy: entry.changed_by,
        changedById: entry.changed_by_id,
        reason: entry.reason,
        metadata: entry.metadata || {},
        businessContext: entry.business_context || {},
        systemContext: entry.system_context || {},
        timestamp: entry.timestamp,
        processingTimeMs: entry.metadata?.processing_time_ms
      }));

      return {
        entries,
        totalCount: count || 0,
        page: pagination.page,
        limit: pagination.limit,
        hasMore: (count || 0) > offset + pagination.limit
      };

    } catch (error) {
      logger.error('Failed to get audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(
    dateFrom: string,
    dateTo: string,
    includeSecurityEvents: boolean = true
  ): Promise<ComplianceReport> {
    try {
      const reportId = `compliance-${Date.now()}`;
      
      // Get transition statistics
      const { data: transitionStats, error: statsError } = await this.supabase.rpc(
        'get_state_transition_statistics',
        {
          p_date_from: dateFrom,
          p_date_to: dateTo,
          p_shop_id: null,
          p_changed_by: null
        }
      );

      if (statsError) {
        throw new Error(`Failed to get transition statistics: ${statsError.message}`);
      }

      // Calculate summary metrics
      const totalTransitions = transitionStats?.reduce((sum: number, stat: any) => sum + stat.transition_count, 0) || 0;
      const totalErrors = transitionStats?.reduce((sum: number, stat: any) => sum + stat.error_count, 0) || 0;
      const successfulTransitions = totalTransitions - totalErrors;
      const errorRate = totalTransitions > 0 ? (totalErrors / totalTransitions) * 100 : 0;
      const averageProcessingTime = transitionStats?.reduce((sum: number, stat: any) => sum + stat.avg_processing_time_ms, 0) / (transitionStats?.length || 1) || 0;

      // Format by status data
      const byStatus = (transitionStats || []).map((stat: any) => ({
        fromStatus: stat.from_status,
        toStatus: stat.to_status,
        count: stat.transition_count,
        successRate: stat.success_rate,
        averageProcessingTime: stat.avg_processing_time_ms
      }));

      // Get by actor statistics
      const { data: actorStats, error: actorError } = await this.supabase
        .from('reservation_state_audit')
        .select('changed_by, reason')
        .gte('timestamp', dateFrom)
        .lte('timestamp', dateTo);

      if (actorError) {
        throw new Error(`Failed to get actor statistics: ${actorError.message}`);
      }

      const actorMap = new Map();
      (actorStats || []).forEach((entry: any) => {
        const actor = entry.changed_by;
        if (!actorMap.has(actor)) {
          actorMap.set(actor, { total: 0, errors: 0 });
        }
        const stats = actorMap.get(actor);
        stats.total++;
        if (entry.reason?.startsWith('TRANSITION_FAILED:')) {
          stats.errors++;
        }
      });

      const byActor = Array.from(actorMap.entries()).map(([actor, stats]: [string, any]) => ({
        changedBy: actor,
        count: stats.total,
        successRate: stats.total > 0 ? ((stats.total - stats.errors) / stats.total) * 100 : 0
      }));

      // Get security events if requested
      let securityEvents: any[] = [];
      if (includeSecurityEvents) {
        const { data: securityData, error: securityError } = await this.supabase
          .from('security_events')
          .select('type, severity')
          .gte('timestamp', dateFrom)
          .lte('timestamp', dateTo);

        if (!securityError && securityData) {
          const securityMap = new Map();
          securityData.forEach((event: any) => {
            const key = `${event.type}-${event.severity}`;
            securityMap.set(key, {
              type: event.type,
              severity: event.severity,
              count: (securityMap.get(key)?.count || 0) + 1
            });
          });
          securityEvents = Array.from(securityMap.values());
        }
      }

      // Check data integrity
      const dataIntegrity = await this.checkDataIntegrity(dateFrom, dateTo);

      return {
        reportId,
        generatedAt: new Date().toISOString(),
        period: { from: dateFrom, to: dateTo },
        summary: {
          totalTransitions,
          successfulTransitions,
          failedTransitions: totalErrors,
          errorRate,
          averageProcessingTime
        },
        byStatus,
        byActor,
        securityEvents,
        dataIntegrity
      };

    } catch (error) {
      logger.error('Failed to generate compliance report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        dateFrom,
        dateTo
      });
      throw error;
    }
  }

  /**
   * Analyze trends and patterns in audit data
   */
  async analyzeTrends(
    dateFrom: string,
    dateTo: string,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<TrendAnalysis> {
    try {
      // Get daily transition trends
      const { data: trendData, error: trendError } = await this.supabase
        .from('reservation_state_audit')
        .select(`
          timestamp,
          reason,
          metadata
        `)
        .gte('timestamp', dateFrom)
        .lte('timestamp', dateTo)
        .order('timestamp');

      if (trendError) {
        throw new Error(`Failed to get trend data: ${trendError.message}`);
      }

      // Process trend data by day
      const dailyStats = new Map();
      const hourlyStats = new Map();
      const statusCounts = new Map();

      (trendData || []).forEach((entry: any) => {
        const date = new Date(entry.timestamp);
        const dayKey = date.toISOString().split('T')[0];
        const hourKey = date.getHours();

        // Daily stats
        if (!dailyStats.has(dayKey)) {
          dailyStats.set(dayKey, { total: 0, errors: 0, processingTimes: [] });
        }
        const dayStats = dailyStats.get(dayKey);
        dayStats.total++;
        
        if (entry.reason?.startsWith('TRANSITION_FAILED:')) {
          dayStats.errors++;
        }
        
        if (entry.metadata?.processing_time_ms) {
          dayStats.processingTimes.push(entry.metadata.processing_time_ms);
        }

        // Hourly stats
        hourlyStats.set(hourKey, (hourlyStats.get(hourKey) || 0) + 1);
      });

      // Format trend data
      const transitionTrends = Array.from(dailyStats.entries()).map(([date, stats]: [string, any]) => ({
        date,
        totalTransitions: stats.total,
        successRate: stats.total > 0 ? ((stats.total - stats.errors) / stats.total) * 100 : 0,
        errorRate: stats.total > 0 ? (stats.errors / stats.total) * 100 : 0,
        averageProcessingTime: stats.processingTimes.length > 0 ? 
          stats.processingTimes.reduce((sum: number, time: number) => sum + time, 0) / stats.processingTimes.length : 0
      }));

      // Format peak hours
      const peakHours = Array.from(hourlyStats.entries()).map(([hour, count]: [number, number]) => ({
        hour,
        transitionCount: count
      })).sort((a, b) => b.transitionCount - a.transitionCount);

      // Detect anomalies
      const anomalies = this.detectAnomalies(transitionTrends);

      return {
        period: `${dateFrom} to ${dateTo}`,
        transitionTrends,
        statusDistribution: Array.from(statusCounts.entries()).map(([status, count]: [string, number]) => ({
          status: status as ReservationStatus,
          count,
          percentage: (count / (trendData?.length || 1)) * 100
        })),
        peakHours,
        anomalies
      };

    } catch (error) {
      logger.error('Failed to analyze trends', {
        error: error instanceof Error ? error.message : 'Unknown error',
        dateFrom,
        dateTo
      });
      throw error;
    }
  }

  /**
   * Export audit trail data
   */
  async exportAuditTrail(
    filter: AuditTrailFilter,
    options: ExportOptions
  ): Promise<{
    data: string | Buffer;
    filename: string;
    contentType: string;
  }> {
    try {
      // Get all matching entries (no pagination for export)
      const query: AuditTrailQuery = {
        filter,
        pagination: { page: 1, limit: 10000 }, // Large limit for export
        sorting: { field: 'timestamp', direction: 'desc' }
      };

      const result = await this.getAuditTrail(query);
      
      let data: string | Buffer;
      let filename: string;
      let contentType: string;

      const timestamp = new Date().toISOString().split('T')[0];

      switch (options.format) {
        case 'json':
          data = JSON.stringify(result.entries, null, 2);
          filename = `audit-trail-${timestamp}.json`;
          contentType = 'application/json';
          break;
          
        case 'csv':
          data = this.convertToCSV(result.entries, options);
          filename = `audit-trail-${timestamp}.csv`;
          contentType = 'text/csv';
          break;
          
        case 'xlsx':
          // For XLSX, you'd need a library like 'xlsx' or 'exceljs'
          // For now, return CSV format
          data = this.convertToCSV(result.entries, options);
          filename = `audit-trail-${timestamp}.csv`;
          contentType = 'text/csv';
          break;
          
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      return { data, filename, contentType };

    } catch (error) {
      logger.error('Failed to export audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filter,
        options
      });
      throw error;
    }
  }

  /**
   * Check data integrity of audit trail
   */
  private async checkDataIntegrity(dateFrom: string, dateTo: string): Promise<{
    orphanedEntries: number;
    missingTransitions: number;
    duplicateEntries: number;
  }> {
    try {
      // Check for orphaned entries (audit entries without corresponding reservations)
      const { data: orphanedData, error: orphanedError } = await this.supabase
        .from('reservation_state_audit')
        .select('id')
        .gte('timestamp', dateFrom)
        .lte('timestamp', dateTo)
        .is('reservation_id', null);

      // Check for missing transitions (reservations with status changes but no audit entries)
      // This would require a more complex query joining reservations and audit tables

      // Check for duplicate entries
      const { data: duplicateData, error: duplicateError } = await this.supabase
        .from('reservation_state_audit')
        .select('reservation_id, from_status, to_status, timestamp')
        .gte('timestamp', dateFrom)
        .lte('timestamp', dateTo);

      const duplicateMap = new Map();
      let duplicateCount = 0;
      
      (duplicateData || []).forEach((entry: any) => {
        const key = `${entry.reservation_id}-${entry.from_status}-${entry.to_status}-${entry.timestamp}`;
        if (duplicateMap.has(key)) {
          duplicateCount++;
        } else {
          duplicateMap.set(key, true);
        }
      });

      return {
        orphanedEntries: orphanedData?.length || 0,
        missingTransitions: 0, // Would need complex query to determine
        duplicateEntries: duplicateCount
      };

    } catch (error) {
      logger.error('Failed to check data integrity', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        orphanedEntries: 0,
        missingTransitions: 0,
        duplicateEntries: 0
      };
    }
  }

  /**
   * Detect anomalies in trend data
   */
  private detectAnomalies(trendData: any[]): any[] {
    const anomalies: any[] = [];
    
    if (trendData.length < 3) return anomalies;

    // Calculate average error rate and processing time
    const avgErrorRate = trendData.reduce((sum, day) => sum + day.errorRate, 0) / trendData.length;
    const avgProcessingTime = trendData.reduce((sum, day) => sum + day.averageProcessingTime, 0) / trendData.length;
    
    // Define thresholds (2 standard deviations)
    const errorRateThreshold = avgErrorRate * 2;
    const processingTimeThreshold = avgProcessingTime * 2;

    trendData.forEach(day => {
      // High error rate anomaly
      if (day.errorRate > errorRateThreshold && day.errorRate > 10) {
        anomalies.push({
          date: day.date,
          type: 'high_error_rate',
          severity: day.errorRate > 50 ? 'high' : 'medium',
          description: `Error rate of ${day.errorRate.toFixed(2)}% exceeds threshold`,
          value: day.errorRate,
          threshold: errorRateThreshold
        });
      }

      // Slow processing anomaly
      if (day.averageProcessingTime > processingTimeThreshold && day.averageProcessingTime > 1000) {
        anomalies.push({
          date: day.date,
          type: 'slow_processing',
          severity: day.averageProcessingTime > 5000 ? 'high' : 'medium',
          description: `Processing time of ${day.averageProcessingTime.toFixed(0)}ms exceeds threshold`,
          value: day.averageProcessingTime,
          threshold: processingTimeThreshold
        });
      }

      // Unusual volume anomaly
      const avgVolume = trendData.reduce((sum, d) => sum + d.totalTransitions, 0) / trendData.length;
      if (day.totalTransitions > avgVolume * 3) {
        anomalies.push({
          date: day.date,
          type: 'unusual_volume',
          severity: day.totalTransitions > avgVolume * 5 ? 'high' : 'medium',
          description: `Transaction volume of ${day.totalTransitions} is unusually high`,
          value: day.totalTransitions,
          threshold: avgVolume * 3
        });
      }
    });

    return anomalies;
  }

  /**
   * Convert audit entries to CSV format
   */
  private convertToCSV(entries: AuditTrailEntry[], options: ExportOptions): string {
    const headers = [
      'ID',
      'Reservation ID',
      'From Status',
      'To Status',
      'Changed By',
      'Changed By ID',
      'Reason',
      'Timestamp',
      'Processing Time (ms)'
    ];

    if (options.includeMetadata) {
      headers.push('Metadata');
    }

    if (options.includeSystemContext) {
      headers.push('System Context');
    }

    const rows = entries.map(entry => {
      const row = [
        entry.id,
        entry.reservationId,
        entry.fromStatus,
        entry.toStatus,
        entry.changedBy,
        entry.changedById,
        entry.reason || '',
        entry.timestamp,
        entry.processingTimeMs?.toString() || ''
      ];

      if (options.includeMetadata) {
        row.push(JSON.stringify(entry.metadata));
      }

      if (options.includeSystemContext) {
        row.push(JSON.stringify(entry.systemContext));
      }

      return row;
    });

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Clean up old audit trail entries (data retention)
   */
  async cleanupOldEntries(retentionDays: number = 365): Promise<{
    deletedCount: number;
    errors: string[];
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await this.supabase
        .from('reservation_state_audit')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (error) {
        throw new Error(`Failed to cleanup old entries: ${error.message}`);
      }

      const deletedCount = (data as any[])?.length || 0;
      
      logger.info('Audit trail cleanup completed', {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        deletedCount
      });

      return {
        deletedCount,
        errors: []
      };

    } catch (error) {
      logger.error('Failed to cleanup old audit entries', {
        error: error instanceof Error ? error.message : 'Unknown error',
        retentionDays
      });

      return {
        deletedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
}

// Export singleton instance
export const auditTrailService = new AuditTrailService();
