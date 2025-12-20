/**
 * Admin Blind Request Controller
 *
 * Handles blind request management endpoints for super admins including:
 * - Fetching all blind requests with filters
 * - Processing (approving/rejecting) blind requests
 * - Statistics for blind requests
 */

import { Request, Response } from 'express';
import { adminBlindRequestService, AdminBlindRequestServiceError } from '../services/admin-blind-request.service';
import { logger } from '../utils/logger';

interface AdminRequest extends Request {
  user?: {
    id: string;
    user_role: string;
  };
}

export class AdminBlindRequestController {
  /**
   * GET /api/admin/blind-requests
   * Get all blind requests with filters
   */
  async getRequests(req: AdminRequest, res: Response): Promise<void> {
    try {
      const { page, limit, status, sortBy } = req.query;

      const result = await adminBlindRequestService.getBlindRequests({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as 'pending' | 'approved' | 'rejected' | 'all' | undefined,
        sortBy: sortBy as 'newest' | 'oldest' | undefined,
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof AdminBlindRequestServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error fetching blind requests', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '블라인드 요청 목록을 불러오는 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * GET /api/admin/blind-requests/stats
   * Get blind request statistics
   */
  async getStats(req: AdminRequest, res: Response): Promise<void> {
    try {
      const stats = await adminBlindRequestService.getBlindRequestStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      if (error instanceof AdminBlindRequestServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error fetching blind request stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '통계를 불러오는 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * GET /api/admin/blind-requests/:requestId
   * Get a single blind request by ID
   */
  async getRequestById(req: AdminRequest, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;

      const request = await adminBlindRequestService.getBlindRequestById(requestId);

      if (!request) {
        res.status(404).json({
          error: {
            code: 'BLIND_REQUEST_NOT_FOUND',
            message: '블라인드 요청을 찾을 수 없습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: request
      });
    } catch (error) {
      if (error instanceof AdminBlindRequestServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error fetching blind request', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '블라인드 요청을 불러오는 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * PATCH /api/admin/blind-requests/:requestId
   * Process a blind request (approve or reject)
   */
  async processRequest(req: AdminRequest, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.id;
      const { requestId } = req.params;
      const { status, adminNotes } = req.body;

      if (!adminUserId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      if (!status || !['approved', 'rejected'].includes(status)) {
        res.status(400).json({
          error: {
            code: 'INVALID_STATUS',
            message: '올바른 상태값을 입력해주세요. (approved 또는 rejected)'
          }
        });
        return;
      }

      const result = await adminBlindRequestService.processBlindRequest(requestId, adminUserId, {
        status,
        adminNotes: adminNotes || undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: status === 'approved'
          ? '블라인드 요청이 승인되었습니다.'
          : '블라인드 요청이 반려되었습니다.'
      });
    } catch (error) {
      if (error instanceof AdminBlindRequestServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error processing blind request', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '블라인드 요청 처리 중 오류가 발생했습니다.'
        }
      });
    }
  }
}

export const adminBlindRequestController = new AdminBlindRequestController();
