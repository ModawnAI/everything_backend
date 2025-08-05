/**
 * Admin Adjustment Controller
 * 
 * Handles admin point adjustment endpoints including:
 * - Point adjustment creation and management
 * - Approval workflow management
 * - Audit log viewing and filtering
 * - Adjustment statistics and reporting
 * - Multi-level authorization
 */

import { Request, Response, NextFunction } from 'express';
import { adminAdjustmentService, PointAdjustmentRequest, AuditLogFilter } from '../services/admin-adjustment.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Request interfaces
 */
interface CreateAdjustmentRequest extends AuthenticatedRequest {
  body: {
    userId: string;
    amount: number;
    reason: string;
    adjustmentType: 'add' | 'subtract' | 'expire';
    category: 'customer_service' | 'system_error' | 'fraud_prevention' | 'promotional' | 'compensation' | 'technical_issue' | 'other';
    requiresApproval?: boolean;
    notes?: string;
  };
}

interface ApproveAdjustmentRequest extends AuthenticatedRequest {
  params: {
    adjustmentId: string;
  };
  body: {
    approverLevel: number;
    notes?: string;
  };
}

interface RejectAdjustmentRequest extends AuthenticatedRequest {
  params: {
    adjustmentId: string;
  };
  body: {
    reason: string;
  };
}

interface GetAuditLogsRequest extends AuthenticatedRequest {
  query: {
    adminId?: string;
    actionType?: string;
    targetType?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
    page?: string;
    limit?: string;
  };
}

interface GetAdjustmentStatsRequest extends AuthenticatedRequest {
  query: {
    startDate?: string;
    endDate?: string;
  };
}

export class AdminAdjustmentController {
  /**
   * Create a new point adjustment
   * POST /api/admin/point-adjustments
   */
  async createAdjustment(req: CreateAdjustmentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, amount, reason, adjustmentType, category, requiresApproval, notes } = req.body;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      logger.info('Creating point adjustment', {
        userId,
        amount,
        adjustmentType,
        category,
        adminId
      });

      const adjustment = await adminAdjustmentService.adjustUserPoints({
        userId,
        amount,
        reason,
        adjustmentType,
        category,
        adminId,
        requiresApproval,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Point adjustment created successfully',
        data: adjustment
      });

    } catch (error) {
      logger.error('Error creating point adjustment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create adjustment'
      });
    }
  }

  /**
   * Approve a pending adjustment
   * POST /api/admin/point-adjustments/:adjustmentId/approve
   */
  async approveAdjustment(req: ApproveAdjustmentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { adjustmentId } = req.params;
      const { approverLevel, notes } = req.body;
      const approverId = req.user?.id;

      if (!approverId) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      logger.info('Approving point adjustment', {
        adjustmentId,
        approverId,
        approverLevel
      });

      const adjustment = await adminAdjustmentService.approveAdjustment(
        adjustmentId,
        approverId,
        approverLevel,
        notes
      );

      res.status(200).json({
        success: true,
        message: 'Point adjustment approved successfully',
        data: adjustment
      });

    } catch (error) {
      logger.error('Error approving adjustment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adjustmentId: req.params.adjustmentId
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to approve adjustment'
      });
    }
  }

  /**
   * Reject a pending adjustment
   * POST /api/admin/point-adjustments/:adjustmentId/reject
   */
  async rejectAdjustment(req: RejectAdjustmentRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { adjustmentId } = req.params;
      const { reason } = req.body;
      const rejectorId = req.user?.id;

      if (!rejectorId) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      logger.info('Rejecting point adjustment', {
        adjustmentId,
        rejectorId,
        reason
      });

      const adjustment = await adminAdjustmentService.rejectAdjustment(
        adjustmentId,
        rejectorId,
        reason
      );

      res.status(200).json({
        success: true,
        message: 'Point adjustment rejected successfully',
        data: adjustment
      });

    } catch (error) {
      logger.error('Error rejecting adjustment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adjustmentId: req.params.adjustmentId
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reject adjustment'
      });
    }
  }

  /**
   * Get adjustment by ID
   * GET /api/admin/point-adjustments/:adjustmentId
   */
  async getAdjustment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { adjustmentId } = req.params;

      logger.info('Getting adjustment details', { adjustmentId });

      // This would be implemented in the service
      // For now, we'll return a placeholder response
      res.status(200).json({
        success: true,
        message: 'Adjustment details retrieved successfully',
        data: {
          id: adjustmentId,
          status: 'pending'
        }
      });

    } catch (error) {
      logger.error('Error getting adjustment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adjustmentId: req.params.adjustmentId
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get adjustment'
      });
    }
  }

  /**
   * Get pending adjustments
   * GET /api/admin/point-adjustments/pending
   */
  async getPendingAdjustments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      logger.info('Getting pending adjustments', { adminId });

      // This would be implemented in the service
      // For now, we'll return a placeholder response
      res.status(200).json({
        success: true,
        message: 'Pending adjustments retrieved successfully',
        data: {
          adjustments: [],
          totalCount: 0
        }
      });

    } catch (error) {
      logger.error('Error getting pending adjustments', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get pending adjustments'
      });
    }
  }

  /**
   * Get audit logs with filtering and pagination
   * GET /api/admin/audit-logs
   */
  async getAuditLogs(req: GetAuditLogsRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      const filter: AuditLogFilter = {
        adminId: req.query.adminId,
        actionType: req.query.actionType as any,
        targetType: req.query.targetType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        reason: req.query.reason,
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 20
      };

      logger.info('Getting audit logs', { filter, adminId });

      const auditLogs = await adminAdjustmentService.getAuditLogs(filter);

      res.status(200).json({
        success: true,
        message: 'Audit logs retrieved successfully',
        data: auditLogs
      });

    } catch (error) {
      logger.error('Error getting audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get audit logs'
      });
    }
  }

  /**
   * Get adjustment statistics
   * GET /api/admin/point-adjustments/stats
   */
  async getAdjustmentStats(req: GetAdjustmentStatsRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      const { startDate, endDate } = req.query;

      logger.info('Getting adjustment statistics', { startDate, endDate, adminId });

      const stats = await adminAdjustmentService.getAdjustmentStats(startDate, endDate);

      res.status(200).json({
        success: true,
        message: 'Adjustment statistics retrieved successfully',
        data: stats
      });

    } catch (error) {
      logger.error('Error getting adjustment statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get adjustment statistics'
      });
    }
  }

  /**
   * Get user adjustment history
   * GET /api/admin/point-adjustments/user/:userId
   */
  async getUserAdjustmentHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      logger.info('Getting user adjustment history', { userId, adminId });

      // This would be implemented in the service
      // For now, we'll return a placeholder response
      res.status(200).json({
        success: true,
        message: 'User adjustment history retrieved successfully',
        data: {
          userId,
          adjustments: [],
          totalCount: 0
        }
      });

    } catch (error) {
      logger.error('Error getting user adjustment history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get user adjustment history'
      });
    }
  }

  /**
   * Export audit logs (CSV format)
   * GET /api/admin/audit-logs/export
   */
  async exportAuditLogs(req: GetAuditLogsRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      const filter: AuditLogFilter = {
        adminId: req.query.adminId,
        actionType: req.query.actionType as any,
        targetType: req.query.targetType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        reason: req.query.reason,
        page: 1,
        limit: 10000 // Large limit for export
      };

      logger.info('Exporting audit logs', { filter, adminId });

      const auditLogs = await adminAdjustmentService.getAuditLogs(filter);

      // Generate CSV content
      const csvHeaders = ['ID', 'Admin ID', 'Action Type', 'Target Type', 'Target ID', 'Reason', 'Created At'];
      const csvRows = auditLogs.entries.map(log => [
        log.id,
        log.adminId,
        log.actionType,
        log.targetType,
        log.targetId,
        log.reason,
        log.createdAt
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      res.status(200).send(csvContent);

    } catch (error) {
      logger.error('Error exporting audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export audit logs'
      });
    }
  }
}

// Export singleton instance
export const adminAdjustmentController = new AdminAdjustmentController(); 