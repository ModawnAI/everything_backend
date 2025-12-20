/**
 * Shop Entry Request Controller
 * Handles shop entry request endpoints for both users and admin
 */

import { Request, Response } from 'express';
import { shopEntryRequestService } from '../services/shop-entry-request.service';
import { logger } from '../utils/logger';
import { ShopEntryRequestStatus } from '../types/shop-entry-request.types';

export class ShopEntryRequestController {
  /**
   * POST /api/shop-entry-requests
   * Submit a new shop entry request (public)
   */
  async submitRequest(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const {
        shop_name,
        shop_address,
        shop_phone,
        shop_category,
        additional_info,
        requester_email,
        requester_phone,
      } = req.body;

      // Validate required fields
      if (!shop_name) {
        res.status(400).json({
          success: false,
          error: 'shop_name is required',
        });
        return;
      }

      const request = await shopEntryRequestService.submitRequest(
        {
          shopName: shop_name,
          shopAddress: shop_address,
          shopPhone: shop_phone,
          shopCategory: shop_category,
          additionalInfo: additional_info,
          requesterEmail: requester_email,
          requesterPhone: requester_phone,
        },
        user?.id
      );

      if (!request) {
        res.status(500).json({
          success: false,
          error: 'Failed to submit shop entry request',
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: request,
        message: '입점 요청이 성공적으로 접수되었습니다.',
      });
    } catch (error) {
      logger.error('Failed to submit shop entry request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to submit shop entry request',
      });
    }
  }

  // =============================================
  // ADMIN METHODS
  // =============================================

  /**
   * GET /api/admin/shop-entry-requests
   * List all shop entry requests (admin)
   */
  async listRequests(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, status, sort_by, sort_order } = req.query;

      const result = await shopEntryRequestService.listRequests({
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        status: status as ShopEntryRequestStatus | undefined,
        sortBy: sort_by as any,
        sortOrder: sort_order as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to list shop entry requests', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to list shop entry requests',
      });
    }
  }

  /**
   * GET /api/admin/shop-entry-requests/:id
   * Get a single shop entry request by ID (admin)
   */
  async getRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const request = await shopEntryRequestService.getRequestById(id);

      if (!request) {
        res.status(404).json({
          success: false,
          error: 'Shop entry request not found',
        });
        return;
      }

      res.json({
        success: true,
        data: request,
      });
    } catch (error) {
      logger.error('Failed to get shop entry request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get shop entry request',
      });
    }
  }

  /**
   * PATCH /api/admin/shop-entry-requests/:id
   * Update shop entry request status (admin)
   */
  async updateRequestStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const { status, admin_notes } = req.body;

      // Validate status
      const validStatuses: ShopEntryRequestStatus[] = [
        'pending',
        'contacted',
        'registered',
        'rejected',
      ];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status. Must be one of: pending, contacted, registered, rejected',
        });
        return;
      }

      const request = await shopEntryRequestService.updateRequestStatus(
        id,
        {
          status,
          adminNotes: admin_notes,
        },
        user?.id
      );

      if (!request) {
        res.status(404).json({
          success: false,
          error: 'Shop entry request not found or update failed',
        });
        return;
      }

      res.json({
        success: true,
        data: request,
        message: '상태가 업데이트되었습니다.',
      });
    } catch (error) {
      logger.error('Failed to update shop entry request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update shop entry request',
      });
    }
  }

  /**
   * DELETE /api/admin/shop-entry-requests/:id
   * Delete a shop entry request (admin)
   */
  async deleteRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const success = await shopEntryRequestService.deleteRequest(id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Shop entry request not found or delete failed',
        });
        return;
      }

      res.json({
        success: true,
        message: '입점 요청이 삭제되었습니다.',
      });
    } catch (error) {
      logger.error('Failed to delete shop entry request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete shop entry request',
      });
    }
  }

  /**
   * GET /api/admin/shop-entry-requests/statistics
   * Get shop entry request statistics (admin)
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await shopEntryRequestService.getStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get shop entry request statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get shop entry request statistics',
      });
    }
  }
}

export const shopEntryRequestController = new ShopEntryRequestController();
export default shopEntryRequestController;
