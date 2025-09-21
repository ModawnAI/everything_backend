/**
 * Audit Trail Controller
 * 
 * REST API endpoints for audit trail management and compliance reporting
 */

import { Request, Response } from 'express';
import { auditTrailService, AuditTrailQuery, AuditTrailFilter, ExportOptions } from '../services/audit-trail.service';
import { logger } from '../utils/logger';
import { ReservationStatus } from '../types/database.types';

export class AuditTrailController {
  /**
   * GET /api/admin/audit-trail
   * Get audit trail entries with filtering and pagination
   */
  async getAuditTrail(req: Request, res: Response): Promise<void> {
    try {
      const {
        reservationId,
        userId,
        shopId,
        fromStatus,
        toStatus,
        changedBy,
        changedById,
        dateFrom,
        dateTo,
        reason,
        hasErrors,
        page = '1',
        limit = '50',
        sortField = 'timestamp',
        sortDirection = 'desc'
      } = req.query;

      // Build filter
      const filter: AuditTrailFilter = {};
      if (reservationId) filter.reservationId = reservationId as string;
      if (userId) filter.userId = userId as string;
      if (shopId) filter.shopId = shopId as string;
      if (fromStatus) filter.fromStatus = fromStatus as ReservationStatus;
      if (toStatus) filter.toStatus = toStatus as ReservationStatus;
      if (changedBy) filter.changedBy = changedBy as 'user' | 'shop' | 'system' | 'admin';
      if (changedById) filter.changedById = changedById as string;
      if (dateFrom) filter.dateFrom = dateFrom as string;
      if (dateTo) filter.dateTo = dateTo as string;
      if (reason) filter.reason = reason as string;
      if (hasErrors !== undefined) filter.hasErrors = hasErrors === 'true';

      // Build query
      const query: AuditTrailQuery = {
        filter,
        pagination: {
          page: parseInt(page as string, 10),
          limit: Math.min(parseInt(limit as string, 10), 1000) // Max 1000 per page
        },
        sorting: {
          field: sortField as 'timestamp' | 'fromStatus' | 'toStatus' | 'changedBy',
          direction: sortDirection as 'asc' | 'desc'
        }
      };

      const result = await auditTrailService.getAuditTrail(query);

      res.json({
        success: true,
        data: result,
        meta: {
          query: {
            filter,
            pagination: query.pagination,
            sorting: query.sorting
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'AUDIT_TRAIL_FETCH_FAILED',
          message: 'Failed to fetch audit trail',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * GET /api/admin/audit-trail/compliance-report
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(req: Request, res: Response): Promise<void> {
    try {
      const {
        dateFrom,
        dateTo,
        includeSecurityEvents = 'true'
      } = req.query;

      if (!dateFrom || !dateTo) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_DATE_RANGE',
            message: 'Date range (dateFrom and dateTo) is required',
            details: 'Please provide both dateFrom and dateTo query parameters'
          }
        });
        return;
      }

      const report = await auditTrailService.generateComplianceReport(
        dateFrom as string,
        dateTo as string,
        includeSecurityEvents === 'true'
      );

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Failed to generate compliance report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'COMPLIANCE_REPORT_FAILED',
          message: 'Failed to generate compliance report',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * GET /api/admin/audit-trail/trends
   * Analyze trends and patterns in audit data
   */
  async analyzeTrends(req: Request, res: Response): Promise<void> {
    try {
      const {
        dateFrom,
        dateTo,
        granularity = 'day'
      } = req.query;

      if (!dateFrom || !dateTo) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_DATE_RANGE',
            message: 'Date range (dateFrom and dateTo) is required',
            details: 'Please provide both dateFrom and dateTo query parameters'
          }
        });
        return;
      }

      const analysis = await auditTrailService.analyzeTrends(
        dateFrom as string,
        dateTo as string,
        granularity as 'hour' | 'day' | 'week'
      );

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      logger.error('Failed to analyze trends', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'TREND_ANALYSIS_FAILED',
          message: 'Failed to analyze trends',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * POST /api/admin/audit-trail/export
   * Export audit trail data
   */
  async exportAuditTrail(req: Request, res: Response): Promise<void> {
    try {
      const {
        filter = {},
        format = 'json',
        includeMetadata = true,
        includeSystemContext = false,
        compression,
        encryption = false
      } = req.body;

      const options: ExportOptions = {
        format: format as 'json' | 'csv' | 'xlsx',
        includeMetadata,
        includeSystemContext,
        compression: compression as 'gzip' | 'zip' | undefined,
        encryption
      };

      const result = await auditTrailService.exportAuditTrail(filter, options);

      // Set appropriate headers for file download
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      
      if (options.compression === 'gzip') {
        res.setHeader('Content-Encoding', 'gzip');
      }

      res.send(result.data);

    } catch (error) {
      logger.error('Failed to export audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        requestBody: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: 'Failed to export audit trail',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * GET /api/admin/audit-trail/reservation/:reservationId
   * Get complete audit trail for a specific reservation
   */
  async getReservationAuditTrail(req: Request, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;

      if (!reservationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_RESERVATION_ID',
            message: 'Reservation ID is required',
            details: 'Please provide a valid reservation ID'
          }
        });
        return;
      }

      const query: AuditTrailQuery = {
        filter: { reservationId },
        pagination: { page: 1, limit: 1000 },
        sorting: { field: 'timestamp', direction: 'asc' }
      };

      const result = await auditTrailService.getAuditTrail(query);

      res.json({
        success: true,
        data: {
          reservationId,
          auditTrail: result.entries,
          totalEntries: result.totalCount
        }
      });

    } catch (error) {
      logger.error('Failed to get reservation audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        userId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'RESERVATION_AUDIT_FAILED',
          message: 'Failed to get reservation audit trail',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * POST /api/admin/audit-trail/cleanup
   * Clean up old audit trail entries (data retention)
   */
  async cleanupOldEntries(req: Request, res: Response): Promise<void> {
    try {
      const { retentionDays = 365 } = req.body;

      if (retentionDays < 30) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RETENTION_PERIOD',
            message: 'Retention period must be at least 30 days',
            details: 'For compliance reasons, audit trail data must be retained for at least 30 days'
          }
        });
        return;
      }

      const result = await auditTrailService.cleanupOldEntries(retentionDays);

      logger.info('Audit trail cleanup initiated by admin', {
        userId: (req as any).user?.id,
        retentionDays,
        deletedCount: result.deletedCount
      });

      res.json({
        success: true,
        data: {
          deletedCount: result.deletedCount,
          retentionDays,
          errors: result.errors,
          message: `Successfully cleaned up ${result.deletedCount} old audit entries`
        }
      });

    } catch (error) {
      logger.error('Failed to cleanup audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        requestBody: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'CLEANUP_FAILED',
          message: 'Failed to cleanup old audit entries',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * GET /api/admin/audit-trail/stats
   * Get audit trail statistics and health metrics
   */
  async getAuditTrailStats(req: Request, res: Response): Promise<void> {
    try {
      const {
        dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
        dateTo = new Date().toISOString()
      } = req.query;

      // Get basic statistics
      const query: AuditTrailQuery = {
        filter: {
          dateFrom: dateFrom as string,
          dateTo: dateTo as string
        },
        pagination: { page: 1, limit: 1 },
        sorting: { field: 'timestamp', direction: 'desc' }
      };

      const result = await auditTrailService.getAuditTrail(query);

      // Get error statistics
      const errorQuery: AuditTrailQuery = {
        filter: {
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
          hasErrors: true
        },
        pagination: { page: 1, limit: 1 },
        sorting: { field: 'timestamp', direction: 'desc' }
      };

      const errorResult = await auditTrailService.getAuditTrail(errorQuery);

      const stats = {
        period: {
          from: dateFrom,
          to: dateTo
        },
        totalEntries: result.totalCount,
        errorEntries: errorResult.totalCount,
        successEntries: result.totalCount - errorResult.totalCount,
        errorRate: result.totalCount > 0 ? (errorResult.totalCount / result.totalCount) * 100 : 0,
        successRate: result.totalCount > 0 ? ((result.totalCount - errorResult.totalCount) / result.totalCount) * 100 : 0
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to get audit trail stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FETCH_FAILED',
          message: 'Failed to get audit trail statistics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
}

// Export singleton instance
export const auditTrailController = new AuditTrailController();
