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
import { AdminAnalyticsService } from '../services/admin-analytics.service';

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
  private analyticsService = new AdminAnalyticsService();

  /**
   * GET /api/admin/shops
   * Get all shops with filtering and pagination (Admin only)
   */
  async getAllShops(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        category,
        shopType,
        verificationStatus,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 per page
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
          detailed_address,
          phone_number,
          email,
          main_category,
          sub_categories,
          shop_type,
          shop_status,
          verification_status,
          commission_rate,
          is_featured,
          created_at,
          updated_at,
          shop_services(
            id,
            name,
            category,
            price_min,
            price_max,
            duration_minutes,
            is_available,
            display_order
          ),
          owner:users!shops_owner_id_fkey(
            id,
            name,
            email,
            phone_number
          )
        `, { count: 'exact' });

      // Apply filters
      if (status) {
        query = query.eq('shop_status', status);
      }
      if (category) {
        query = query.eq('main_category', category);
      }
      if (shopType) {
        query = query.eq('shop_type', shopType);
      }
      if (verificationStatus) {
        query = query.eq('verification_status', verificationStatus);
      }
      // Add search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,address.ilike.%${search}%`);
      }

      // Add sorting
      const validSortFields = ['created_at', 'name', 'main_category', 'shop_status', 'verification_status'];
      const validSortOrders = ['asc', 'desc'];

      const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'created_at';
      const sortDirection = validSortOrders.includes(sortOrder as string) ? sortOrder : 'desc';

      query = query.order(sortField as string, { ascending: sortDirection === 'asc' });

      // Add pagination
      query = query.range(offset, offset + limitNum - 1);

      const { data: shops, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch shops', {
          error: error.message,
          filters: { status, category, shopType, verificationStatus }
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'FETCH_SHOPS_FAILED',
            message: '샵 목록을 가져오는데 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          shops: shops || [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
          }
        },
        message: '샵 목록을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.getAllShops error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/admin/shops/:shopId
   * Get detailed shop information by ID (Admin only)
   */
  async getShopById(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      const client = getSupabaseClient();

      // Fetch shop with all related data including services
      const { data: shop, error } = await client
        .from('shops')
        .select(`
          *,
          shop_services(
            id,
            name,
            description,
            category,
            price_min,
            price_max,
            duration_minutes,
            deposit_amount,
            deposit_percentage,
            is_available,
            booking_advance_days,
            cancellation_hours,
            display_order
          ),
          shop_images(
            id,
            image_url,
            alt_text,
            display_order,
            is_primary
          )
        `)
        .eq('id', shopId)
        .maybeSingle();

      if (error || !shop) {
        logger.error('Failed to fetch shop by ID', {
          shopId,
          error: error?.message
        });

        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '샵을 찾을 수 없습니다.',
            details: '요청하신 샵이 존재하지 않거나 삭제되었습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          shop: shop
        }
      });

    } catch (error: any) {
      logger.error('Unexpected error fetching shop by ID', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_SHOP_FAILED',
          message: '샵 정보를 가져오는데 실패했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/admin/shops/search
   * Search all shops (Admin only)
   */
  async searchShops(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        category,
        verificationStatus,
        shopStatus,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.body;

      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 100); // Max 100 per page
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
          shop_type,
          commission_rate,
          created_at,
          updated_at,
          owner:users!shops_owner_id_fkey(
            id,
            name,
            email,
            phone_number
          )
        `, { count: 'exact' });

      // Add search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,address.ilike.%${search}%`);
      }

      // Add category filter
      if (category) {
        query = query.eq('main_category', category);
      }

      // Add verification status filter
      if (verificationStatus) {
        query = query.eq('verification_status', verificationStatus);
      }

      // Add shop status filter
      if (shopStatus) {
        query = query.eq('shop_status', shopStatus);
      }

      // Add sorting
      const validSortFields = ['created_at', 'name', 'main_category', 'verification_status', 'shop_status'];
      const validSortOrders = ['asc', 'desc'];

      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

      query = query.order(sortField, { ascending: sortDirection === 'asc' });

      // Add pagination
      query = query.range(offset, offset + limitNum - 1);

      const { data: shops, error, count } = await query;

      if (error) {
        logger.error('Failed to search shops', {
          error: error.message,
          search,
          category,
          verificationStatus,
          shopStatus
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'SEARCH_SHOPS_FAILED',
            message: '샵 검색에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          shops,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
          }
        },
        message: '샵 검색을 성공적으로 완료했습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.searchShops error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

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
          commission_rate,
          created_at,
          updated_at,
          shop_services(
            id,
            name,
            category,
            price_min,
            price_max,
            duration_minutes,
            is_available,
            display_order
          ),
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

  /**
   * POST /api/admin/shops
   * Create a new shop (Admin only)
   */
  async createShop(req: Request, res: Response): Promise<void> {
    try {
      const shopData = req.body;
      const adminId = (req as any).user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Validate required fields
      if (!shopData.name || !shopData.address || !shopData.main_category) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: '샵명, 주소, 주 서비스 카테고리는 필수입니다.'
          }
        });
        return;
      }

      const client = getSupabaseClient();

      // Prepare shop data with admin-specific fields
      const newShop: any = {
        name: shopData.name,
        description: shopData.description || null,
        address: shopData.address,
        detailed_address: shopData.detailed_address || null,
        postal_code: shopData.postal_code || null,
        phone_number: shopData.phone_number || null,
        email: shopData.email || null,
        main_category: shopData.main_category,
        sub_categories: shopData.sub_categories || [],
        operating_hours: shopData.operating_hours || null,
        payment_methods: shopData.payment_methods || [],
        kakao_channel_url: shopData.kakao_channel_url || null,
        business_license_number: shopData.business_license_number || null,
        business_license_image_url: shopData.business_license_image_url || null,

        // Admin can specify these fields directly
        owner_id: shopData.owner_id || adminId,
        shop_status: shopData.shop_status || 'active',
        verification_status: shopData.verification_status || 'verified',
        shop_type: shopData.shop_type || 'partnered',
        commission_rate: shopData.commission_rate || 0,
        is_featured: shopData.is_featured || false,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Create shop location if coordinates provided
      if (shopData.latitude && shopData.longitude) {
        newShop.location = `POINT(${shopData.longitude} ${shopData.latitude})`;
      }

      const { data: shop, error } = await client
        .from('shops')
        .insert(newShop)
        .select()
        .single();

      if (error) {
        logger.error('Admin failed to create shop', {
          error: error.message,
          shopData,
          adminId
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'SHOP_CREATION_FAILED',
            message: '샵 생성에 실패했습니다.',
            details: error.message
          }
        });
        return;
      }

      logger.info('Admin created shop successfully', {
        shopId: shop.id,
        adminId,
        shopName: shop.name
      });

      res.status(201).json({
        success: true,
        data: shop,
        message: '샵이 성공적으로 생성되었습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.createShop error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * PUT /api/admin/shops/:shopId
   * Update shop information (Admin only)
   */
  async updateShop(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const updateData = req.body;
      const adminId = (req as any).user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      const client = getSupabaseClient();

      // Check if shop exists
      const { data: existingShop, error: fetchError } = await client
        .from('shops')
        .select('id, name, shop_status')
        .eq('id', shopId)
        .single();

      if (fetchError || !existingShop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '해당 샵을 찾을 수 없습니다.',
            details: '샵이 존재하지 않습니다.'
          }
        });
        return;
      }

      // Prepare update data
      const shopUpdateData: any = { ...updateData };

      // Update location if coordinates provided
      if (updateData.latitude && updateData.longitude) {
        shopUpdateData.location = `POINT(${updateData.longitude} ${updateData.latitude})`;
      }

      // Add updated timestamp
      shopUpdateData.updated_at = new Date().toISOString();

      const { data: updatedShop, error } = await client
        .from('shops')
        .update(shopUpdateData)
        .eq('id', shopId)
        .select()
        .single();

      if (error) {
        logger.error('Admin failed to update shop', {
          error: error.message,
          shopId,
          updateData,
          adminId
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'SHOP_UPDATE_FAILED',
            message: '샵 정보 업데이트에 실패했습니다.',
            details: error.message
          }
        });
        return;
      }

      logger.info('Admin updated shop successfully', {
        shopId,
        adminId,
        shopName: updatedShop.name
      });

      res.status(200).json({
        success: true,
        data: updatedShop,
        message: '샵 정보가 성공적으로 업데이트되었습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.updateShop error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * DELETE /api/admin/shops/:shopId
   * Delete shop (Admin only, supports soft and hard delete)
   */
  async deleteShop(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { permanent = 'false' } = req.query;
      const adminId = (req as any).user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      const client = getSupabaseClient();

      // Check if shop exists
      const { data: existingShop, error: fetchError } = await client
        .from('shops')
        .select('id, name, shop_status')
        .eq('id', shopId)
        .single();

      if (fetchError || !existingShop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '해당 샵을 찾을 수 없습니다.',
            details: '샵이 존재하지 않거나 이미 삭제되었습니다.'
          }
        });
        return;
      }

      const isPermanent = permanent === 'true';

      if (isPermanent) {
        // Hard delete - permanently remove from database
        const { error } = await client
          .from('shops')
          .delete()
          .eq('id', shopId);

        if (error) {
          logger.error('Admin failed to permanently delete shop', {
            error: error.message,
            shopId,
            adminId
          });

          res.status(500).json({
            success: false,
            error: {
              code: 'SHOP_DELETION_FAILED',
              message: '샵 영구 삭제에 실패했습니다.',
              details: error.message
            }
          });
          return;
        }

        logger.warn('Admin permanently deleted shop', {
          shopId,
          shopName: existingShop.name,
          adminId
        });

        res.status(200).json({
          success: true,
          message: '샵이 영구적으로 삭제되었습니다.'
        });
      } else {
        // Soft delete - update status to deleted
        const { error } = await client
          .from('shops')
          .update({
            shop_status: 'deleted',
            updated_at: new Date().toISOString()
          })
          .eq('id', shopId);

        if (error) {
          logger.error('Admin failed to soft delete shop', {
            error: error.message,
            shopId,
            adminId
          });

          res.status(500).json({
            success: false,
            error: {
              code: 'SHOP_DELETION_FAILED',
              message: '샵 삭제에 실패했습니다.',
              details: error.message
            }
          });
          return;
        }

        logger.info('Admin soft deleted shop', {
          shopId,
          shopName: existingShop.name,
          adminId
        });

        res.status(200).json({
          success: true,
          message: '샵이 성공적으로 삭제되었습니다.'
        });
      }

    } catch (error) {
      logger.error('AdminShopController.deleteShop error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * Get shop analytics data
   */
  async getShopAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { period = '30d' } = req.query;

      // Validate shopId
      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Check if shop exists
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, name, main_category')
        .eq('id', shopId)
        .single();

      if (shopError || !shop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '해당 샵을 찾을 수 없습니다.'
          }
        });
        return;
      }

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get services count
      const { data: services, error: servicesError } = await supabase
        .from('shop_services')
        .select('id, name, category, price_min, price_max, is_available')
        .eq('shop_id', shopId);

      if (servicesError) {
        logger.error('Failed to fetch shop services for analytics', {
          error: servicesError.message,
          shopId
        });
      }

      // Mock analytics data (replace with real data when booking system is implemented)
      const analyticsData = {
        shopInfo: {
          id: shop.id,
          name: shop.name,
          category: shop.main_category
        },
        period: period,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        },
        services: {
          total: services?.length || 0,
          active: services?.filter(s => s.is_available)?.length || 0,
          categories: [...new Set(services?.map(s => s.category) || [])],
          priceRange: {
            min: Math.min(...(services?.map(s => s.price_min).filter(p => p) || [0])),
            max: Math.max(...(services?.map(s => s.price_max).filter(p => p) || [0]))
          }
        },
        bookings: {
          total: 0,
          confirmed: 0,
          pending: 0,
          cancelled: 0,
          completed: 0,
          revenue: 0
        },
        customers: {
          total: 0,
          new: 0,
          returning: 0,
          averageBookings: 0
        },
        performance: {
          averageRating: 0,
          reviewCount: 0,
          responseRate: 0,
          utilizationRate: 0
        }
      };

      logger.info('Shop analytics retrieved', {
        shopId,
        shopName: shop.name,
        period,
        servicesCount: services?.length || 0
      });

      res.status(200).json({
        success: true,
        data: analyticsData
      });

    } catch (error) {
      logger.error('AdminShopController.getShopAnalytics error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/admin/shops/:shopId/reservations
   * Get shop reservations (Admin only)
   */
  async getShopReservations(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { page = '1', limit = '20', status } = req.query;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const offset = (pageNum - 1) * limitNum;

      const supabase = getSupabaseClient();

      // Build query for reservations
      let query = supabase
        .from('reservations')
        .select(`
          id,
          user_id,
          shop_id,
          status,
          reservation_date,
          reservation_time,
          total_amount,
          deposit_amount,
          remaining_amount,
          points_used,
          points_earned,
          special_requests,
          confirmed_at,
          completed_at,
          cancelled_at,
          created_at,
          updated_at
        `, { count: 'exact' })
        .eq('shop_id', shopId);

      // Add status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      // Add sorting and pagination
      query = query
        .order('reservation_date', { ascending: false })
        .order('reservation_time', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data: reservations, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch shop reservations', {
          error: error.message,
          shopId
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'FETCH_RESERVATIONS_FAILED',
            message: '예약 목록을 가져오는데 실패했습니다.',
            details: error.message
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          reservations: reservations || [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
          }
        },
        message: '샵 예약 목록을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.getShopReservations error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/admin/data-integrity/validate
   * Validate data integrity across all analytics tables
   */
  async validateDataIntegrity(req: Request, res: Response): Promise<void> {
    try {
      logger.info('AdminShopController.validateDataIntegrity called');

      const integrityReport = await this.analyticsService.validateDataIntegrity();

      logger.info('Data integrity validation completed', {
        isValid: integrityReport.isValid,
        issuesCount: integrityReport.issues.length
      });

      res.status(200).json({
        success: true,
        data: integrityReport,
        message: integrityReport.isValid ?
          '모든 데이터가 올바른 관계를 유지하고 있습니다.' :
          `${integrityReport.issues.length}개의 데이터 무결성 문제가 발견되었습니다.`
      });

    } catch (error) {
      logger.error('AdminShopController.validateDataIntegrity error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '데이터 무결성 검증 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/admin/data-integrity/cleanup
   * Clean up orphaned analytics data
   */
  async cleanupOrphanedData(req: Request, res: Response): Promise<void> {
    try {
      logger.info('AdminShopController.cleanupOrphanedData called');

      const cleanupResult = await this.analyticsService.cleanupOrphanedAnalyticsData();

      const totalCleaned = Object.values(cleanupResult).reduce((sum, count) => sum + count, 0);

      logger.info('Orphaned data cleanup completed', {
        totalCleaned,
        breakdown: cleanupResult
      });

      res.status(200).json({
        success: true,
        data: {
          totalCleaned,
          breakdown: cleanupResult
        },
        message: totalCleaned > 0 ?
          `${totalCleaned}개의 고아 데이터가 정리되었습니다.` :
          '정리할 고아 데이터가 없습니다.'
      });

    } catch (error) {
      logger.error('AdminShopController.cleanupOrphanedData error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '고아 데이터 정리 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/admin/data-integrity/status
   * Get current data integrity status
   */
  async getDataIntegrityStatus(req: Request, res: Response): Promise<void> {
    try {
      logger.info('AdminShopController.getDataIntegrityStatus called');

      // Get basic integrity report
      const integrityReport = await this.analyticsService.validateDataIntegrity();

      // Get additional statistics
      const supabase = getSupabaseClient();

      const [
        { count: totalShops },
        { count: totalUsers },
        { count: totalReservations },
        { count: totalPayments },
        { count: totalAnalytics }
      ] = await Promise.all([
        supabase.from('shops').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('reservations').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('*', { count: 'exact', head: true }),
        supabase.from('referral_analytics').select('*', { count: 'exact', head: true })
      ]);

      const statusReport = {
        ...integrityReport,
        statistics: {
          totalShops: totalShops || 0,
          totalUsers: totalUsers || 0,
          totalReservations: totalReservations || 0,
          totalPayments: totalPayments || 0,
          totalAnalytics: totalAnalytics || 0
        },
        lastChecked: new Date().toISOString()
      };

      logger.info('Data integrity status retrieved', {
        isValid: statusReport.isValid,
        statistics: statusReport.statistics
      });

      res.status(200).json({
        success: true,
        data: statusReport
      });

    } catch (error) {
      logger.error('AdminShopController.getDataIntegrityStatus error:', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '데이터 무결성 상태 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}

export const adminShopController = new AdminShopController(); 