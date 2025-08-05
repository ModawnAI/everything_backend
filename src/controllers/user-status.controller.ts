/**
 * User Status Controller
 * 
 * Handles all user status management endpoints including:
 * - Admin status change operations
 * - User violation management
 * - Status history and statistics
 * - Bulk operations
 */

import { Request, Response, NextFunction } from 'express';
import { userStatusService, StatusChangeRequest, UserViolation } from '../services/user-status.service';
import { logger } from '../utils/logger';

// Request interfaces
export interface ChangeUserStatusRequest extends Request {
  user?: { id: string; role: string };
  body: {
    userId: string;
    newStatus: 'active' | 'inactive' | 'suspended' | 'deleted';
    reason: string;
    effectiveDate?: string;
    notes?: string;
  };
}

export interface GetUserStatusHistoryRequest extends Request {
  user?: { id: string };
  params: {
    userId: string;
  };
  query: {
    limit?: string;
  };
}

export interface AddUserViolationRequest extends Request {
  user?: { id: string; role: string };
  body: {
    userId: string;
    violationType: 'spam' | 'inappropriate_content' | 'fraud' | 'harassment' | 'terms_violation' | 'payment_fraud';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidenceUrl?: string;
    reportedBy?: string;
  };
}

export interface GetUserViolationsRequest extends Request {
  user?: { id: string; role: string };
  params: {
    userId: string;
  };
  query: {
    status?: string;
  };
}

export interface ResolveViolationRequest extends Request {
  user?: { id: string; role: string };
  params: {
    violationId: string;
  };
  body: {
    resolution: string;
  };
}

export interface GetUsersByStatusRequest extends Request {
  user?: { id: string; role: string };
  params: {
    status: 'active' | 'inactive' | 'suspended' | 'deleted';
  };
  query: {
    page?: string;
    limit?: string;
  };
}

export interface BulkStatusChangeRequest extends Request {
  user?: { id: string; role: string };
  body: {
    userIds: string[];
    newStatus: 'active' | 'inactive' | 'suspended' | 'deleted';
    reason: string;
  };
}

export interface GetStatusStatsRequest extends Request {
  user?: { id: string; role: string };
  query: {
    days?: string;
  };
}

export class UserStatusController {
  /**
   * PUT /api/admin/users/:userId/status
   * Change user status (Admin only)
   */
  public changeUserStatus = async (req: ChangeUserStatusRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // TODO: Check if user has admin role
      // if (req.user?.role !== 'admin') {
      //   res.status(403).json({
      //     success: false,
      //     error: {
      //       code: 'FORBIDDEN',
      //       message: '관리자 권한이 필요합니다.',
      //       timestamp: new Date().toISOString()
      //     }
      //   });
      //   return;
      // }

      const { userId, newStatus, reason, effectiveDate, notes } = req.body;

      const statusChangeRequest: StatusChangeRequest = {
        userId,
        newStatus,
        reason,
        adminId,
        effectiveDate,
        notes
      };

      const updatedUser = await userStatusService.changeUserStatus(statusChangeRequest);

      res.status(200).json({
        success: true,
        data: {
          user: updatedUser,
          message: '사용자 상태가 성공적으로 변경되었습니다.'
        }
      });
    } catch (error) {
      logger.error('UserStatusController.changeUserStatus error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/admin/users/:userId/status/history
   * Get user status history (Admin only)
   */
  public getUserStatusHistory = async (req: GetUserStatusHistoryRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { userId } = req.params;
      const limit = parseInt(req.query.limit || '20');

      const history = await userStatusService.getUserStatusHistory(userId, limit);

      res.status(200).json({
        success: true,
        data: {
          history,
          message: '사용자 상태 변경 이력을 성공적으로 조회했습니다.'
        }
      });
    } catch (error) {
      logger.error('UserStatusController.getUserStatusHistory error:', { error });
      next(error);
    }
  };

  /**
   * POST /api/admin/users/:userId/violations
   * Add user violation (Admin only)
   */
  public addUserViolation = async (req: AddUserViolationRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { userId, violationType, severity, description, evidenceUrl, reportedBy } = req.body;

      const violation: Omit<UserViolation, 'id' | 'created_at'> = {
        user_id: userId,
        violation_type: violationType,
        severity,
        description,
        evidence_url: evidenceUrl,
        reported_by: reportedBy,
        admin_id: adminId,
        status: 'pending'
      };

      const newViolation = await userStatusService.addUserViolation(violation);

      res.status(201).json({
        success: true,
        data: {
          violation: newViolation,
          message: '사용자 위반 기록이 성공적으로 추가되었습니다.'
        }
      });
    } catch (error) {
      logger.error('UserStatusController.addUserViolation error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/admin/users/:userId/violations
   * Get user violations (Admin only)
   */
  public getUserViolations = async (req: GetUserViolationsRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { userId } = req.params;
      const { status } = req.query;

      const violations = await userStatusService.getUserViolations(userId, status);

      res.status(200).json({
        success: true,
        data: {
          violations,
          message: '사용자 위반 기록을 성공적으로 조회했습니다.'
        }
      });
    } catch (error) {
      logger.error('UserStatusController.getUserViolations error:', { error });
      next(error);
    }
  };

  /**
   * PUT /api/admin/violations/:violationId/resolve
   * Resolve user violation (Admin only)
   */
  public resolveViolation = async (req: ResolveViolationRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { violationId } = req.params;
      const { resolution } = req.body;

      const resolvedViolation = await userStatusService.resolveUserViolation(violationId, adminId, resolution);

      res.status(200).json({
        success: true,
        data: {
          violation: resolvedViolation,
          message: '위반 기록이 성공적으로 해결되었습니다.'
        }
      });
    } catch (error) {
      logger.error('UserStatusController.resolveViolation error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/admin/users/status/:status
   * Get users by status (Admin only)
   */
  public getUsersByStatus = async (req: GetUsersByStatusRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { status } = req.params;
      const page = parseInt(req.query.page || '1');
      const limit = parseInt(req.query.limit || '20');

      const result = await userStatusService.getUsersByStatus(status, page, limit);

      res.status(200).json({
        success: true,
        data: {
          users: result.users,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
          },
          message: `${status} 상태의 사용자를 성공적으로 조회했습니다.`
        }
      });
    } catch (error) {
      logger.error('UserStatusController.getUsersByStatus error:', { error });
      next(error);
    }
  };

  /**
   * POST /api/admin/users/bulk-status-change
   * Bulk status change (Admin only)
   */
  public bulkStatusChange = async (req: BulkStatusChangeRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { userIds, newStatus, reason } = req.body;

      if (!userIds || userIds.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '사용자 ID 목록을 제공해주세요.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const result = await userStatusService.bulkStatusChange(userIds, newStatus, reason, adminId);

      res.status(200).json({
        success: true,
        data: {
          result,
          message: `대량 상태 변경이 완료되었습니다. 성공: ${result.success}, 실패: ${result.failed}`
        }
      });
    } catch (error) {
      logger.error('UserStatusController.bulkStatusChange error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/admin/users/status-stats
   * Get status change statistics (Admin only)
   */
  public getStatusStats = async (req: GetStatusStatsRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const days = parseInt(req.query.days || '30');

      const stats = await userStatusService.getStatusChangeStats(days);

      res.status(200).json({
        success: true,
        data: {
          stats,
          period: `${days}일`,
          message: '상태 변경 통계를 성공적으로 조회했습니다.'
        }
      });
    } catch (error) {
      logger.error('UserStatusController.getStatusStats error:', { error });
      next(error);
    }
  };
}

export const userStatusController = new UserStatusController(); 