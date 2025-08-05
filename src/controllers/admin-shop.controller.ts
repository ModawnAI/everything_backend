/**
 * Admin Shop Controller
 * 
 * Handles admin-only shop management operations including:
 * - Shop verification and approval workflow
 * - Shop status management
 * - Verification history and audit trails
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ShopVerificationStatus, ShopType, ShopStatus } from '../types/database.types';
import { shopVerificationService } from '../services/shop-verification.service';

// Request interfaces
interface ApproveShopRequest extends Request {
  body: {
    approved: boolean;
    shopType?: ShopType;
    commissionRate?: number;
    notes?: string;
  };
  params: {
    shopId: string;
  };
}

interface GetPendingShopsRequest extends Request {
  query: {
    page?: string;
    limit?: string;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}

interface GetShopVerificationHistoryRequest extends Request {
  params: {
    shopId: string;
  };
  query: {
    page?: string;
    limit?: string;
  };
}

export class AdminShopController {
  /**
   * GET /api/admin/shops/pending
   * Get list of shops pending verification (Admin only)
   */
  async getPendingShops(req: GetPendingShopsRequest, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        category,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const client = getSupabaseClient();

      // Build query
      let query = client
        .from('shops')
        .select(`
          id,
          name,
          description,
          address,
          phone_number,
          email,
          main_category,
          sub_categories,
          business_license_number,
          business_license_image_url,
          verification_status,
          shop_status,
          created_at,
          updated_at,
          owner:users!shops_owner_id_fkey(
            id,
            name,
            email,
            phone_number
          )
        `)
        .eq('verification_status', 'pending');

      // Add search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,address.ilike.%${search}%`);
      }

      // Add category filter
      if (category) {
        query = query.eq('main_category', category);
      }

      // Add sorting
      const validSortFields = ['created_at', 'name', 'main_category'];
      const validSortOrders = ['asc', 'desc'];
      
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';
      
      query = query.order(sortField, { ascending: sortDirection === 'asc' });

      // Add pagination
      query = query.range(offset, offset + limitNum - 1);

      const { data: shops, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch pending shops', {
          error: error.message,
          search,
          category
        });

        res.status(500).json({
          error: {
            code: 'FETCH_PENDING_SHOPS_FAILED',
            message: '승인 대기 중인 샵 목록을 가져오는데 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Get total count for pagination
      const { count: totalCount } = await client
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'pending');

      res.status(200).json({
        success: true,
        data: {
          shops,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount || 0,
            totalPages: Math.ceil((totalCount || 0) / limitNum)
          }
        },
        message: '승인 대기 중인 샵 목록을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.getPendingShops error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * PUT /api/admin/shops/:shopId/approve
   * Approve or reject a shop (Admin only)
   */
  async approveShop(req: ApproveShopRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { approved, shopType, commissionRate, notes } = req.body;
      const adminId = (req as any).user?.id;

      if (!adminId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Process verification using the service
      const verificationRequest: any = {
        shopId,
        adminId,
        approved
      };

      if (shopType) {
        verificationRequest.shopType = shopType;
      }
      if (commissionRate !== undefined) {
        verificationRequest.commissionRate = commissionRate;
      }
      if (notes) {
        verificationRequest.notes = notes;
      }

      const result = await shopVerificationService.processVerification(verificationRequest);

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'VERIFICATION_FAILED',
            message: result.message,
            details: result.errors?.join(', ')
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          shopId: result.shopId,
          action: result.action,
          previousStatus: result.previousStatus,
          newStatus: result.newStatus,
          message: result.message
        }
      });

    } catch (error) {
      logger.error('AdminShopController.approveShop error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/admin/shops/:shopId/verification-history
   * Get shop verification history (Admin only)
   */
  async getShopVerificationHistory(req: GetShopVerificationHistoryRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      const result = await shopVerificationService.getVerificationHistory(shopId, pageNum, limitNum);

      res.status(200).json({
        success: true,
        data: {
          actions: result.history,
          pagination: result.pagination
        },
        message: '샵 인증 이력을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.getShopVerificationHistory error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/admin/shops/verification-stats
   * Get shop verification statistics (Admin only)
   */
  async getVerificationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await shopVerificationService.getVerificationStats();

      res.status(200).json({
        success: true,
        data: stats,
        message: '샵 인증 통계를 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.getVerificationStats error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/admin/shops/:shopId/verification-requirements
   * Check if shop meets verification requirements (Admin only)
   */
  async checkVerificationRequirements(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;

      if (!shopId) {
        res.status(400).json({
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.',
            details: '유효한 샵 ID를 제공해주세요.'
          }
        });
        return;
      }

      const requirements = await shopVerificationService.checkVerificationRequirements(shopId);

      res.status(200).json({
        success: true,
        data: requirements,
        message: '샵 인증 요구사항을 성공적으로 확인했습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.checkVerificationRequirements error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}

export const adminShopController = new AdminShopController(); 