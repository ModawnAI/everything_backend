/**
 * Admin Shop Service Controller
 *
 * Handles admin operations for managing shop services including:
 * - Retrieving services for any shop
 * - Creating services for shops
 * - Updating shop services
 * - Deleting shop services
 * - Managing service availability across all shops
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ServiceCategory } from '../types/database.types';

// Request interfaces
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

interface AdminCreateServiceRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
  };
  body: {
    name: string;
    description?: string;
    category: ServiceCategory;
    price_min?: number;
    price_max?: number;
    duration_minutes?: number;
    deposit_amount?: number;
    deposit_percentage?: number;
    is_available?: boolean;
    booking_advance_days?: number;
    cancellation_hours?: number;
    display_order?: number;
  };
}

interface AdminUpdateServiceRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
    serviceId: string;
  };
  body: {
    name?: string;
    description?: string;
    category?: ServiceCategory;
    price_min?: number;
    price_max?: number;
    duration_minutes?: number;
    deposit_amount?: number;
    deposit_percentage?: number;
    is_available?: boolean;
    booking_advance_days?: number;
    cancellation_hours?: number;
    display_order?: number;
  };
}

interface AdminServiceListRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
  };
  query: {
    category?: ServiceCategory;
    is_available?: string;
    limit?: string;
    offset?: string;
  };
}

interface AdminServiceByIdRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
    serviceId: string;
  };
}

export class AdminShopServiceController {
  /**
   * Get all services for a specific shop (Admin)
   * GET /api/admin/shops/:shopId/services
   */
  async getShopServices(req: AdminServiceListRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { shopId } = req.params;
      const { category, is_available, limit = '50', offset = '0' } = req.query;

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

      const supabase = getSupabaseClient();

      // Verify shop exists
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, name')
        .eq('id', shopId)
        .maybeSingle();

      if (shopError || !shop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '샵을 찾을 수 없습니다.',
            details: '존재하지 않는 샵 ID입니다.'
          }
        });
        return;
      }

      // Build query for services
      let query = supabase
        .from('shop_services')
        .select('*', { count: 'exact' })
        .eq('shop_id', shopId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      // Apply filters
      if (category) {
        query = query.eq('category', category);
      }

      if (is_available !== undefined) {
        const isAvailableBool = is_available === 'true';
        query = query.eq('is_available', isAvailableBool);
      }

      // Apply pagination
      const limitNum = Math.min(parseInt(limit), 100);
      const offsetNum = Math.max(parseInt(offset), 0);
      query = query.range(offsetNum, offsetNum + limitNum - 1);

      const { data: services, error, count } = await query;

      if (error) {
        logger.error('Admin: Error fetching shop services', {
          error: error.message,
          adminId,
          shopId,
          code: error.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '서비스 목록 조회 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const totalCount = count || 0;
      const hasMore = totalCount > offsetNum + services.length;

      logger.info('Admin: Shop services retrieved successfully', {
        adminId,
        shopId,
        shopName: shop.name,
        serviceCount: services.length,
        totalCount,
        filters: { category, is_available }
      });

      res.status(200).json({
        success: true,
        data: {
          services,
          totalCount,
          hasMore,
          shopInfo: {
            id: shop.id,
            name: shop.name
          }
        },
        message: '서비스 목록을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Admin: Error in getShopServices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        adminId: req.user?.id,
        shopId: req.params.shopId
      });

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
   * Create a new service for a shop (Admin)
   * POST /api/admin/shops/:shopId/services
   */
  async createShopService(req: AdminCreateServiceRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { shopId } = req.params;
      const serviceData = req.body;

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

      const supabase = getSupabaseClient();

      // Verify shop exists
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, name, owner_id')
        .eq('id', shopId)
        .single();

      if (shopError || !shop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '샵을 찾을 수 없습니다.',
            details: '존재하지 않는 샵 ID입니다.'
          }
        });
        return;
      }

      // Validate price range
      if (serviceData.price_min && serviceData.price_max && serviceData.price_min > serviceData.price_max) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRICE_RANGE',
            message: '가격 범위가 올바르지 않습니다.',
            details: '최소 가격은 최대 가격보다 작거나 같아야 합니다.'
          }
        });
        return;
      }

      // Validate deposit settings
      if (serviceData.deposit_amount && serviceData.deposit_percentage) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DEPOSIT_SETTINGS',
            message: '예약금 설정이 올바르지 않습니다.',
            details: '고정 금액과 비율 중 하나만 설정할 수 있습니다.'
          }
        });
        return;
      }

      // Create the service
      const { data: newService, error } = await supabase
        .from('shop_services')
        .insert({
          shop_id: shopId,
          ...serviceData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Admin: Error creating service', {
          error: error.message,
          adminId,
          shopId,
          code: error.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'SERVICE_CREATION_FAILED',
            message: '서비스 생성에 실패했습니다.',
            details: error.message
          }
        });
        return;
      }

      logger.info('Admin: Service created successfully', {
        adminId,
        shopId,
        shopName: shop.name,
        serviceId: newService.id,
        serviceName: newService.name,
        category: newService.category
      });

      res.status(201).json({
        success: true,
        data: newService,
        message: '서비스가 성공적으로 생성되었습니다.'
      });

    } catch (error) {
      logger.error('Admin: Error in createShopService', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        adminId: req.user?.id,
        shopId: req.params.shopId
      });

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
   * Get a specific service by ID (Admin)
   * GET /api/admin/shops/:shopId/services/:serviceId
   */
  async getShopServiceById(req: AdminServiceByIdRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { shopId, serviceId } = req.params;

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

      const supabase = getSupabaseClient();

      // Fetch service with shop verification
      const { data: service, error } = await supabase
        .from('shop_services')
        .select('*')
        .eq('id', serviceId)
        .eq('shop_id', shopId)
        .single();

      if (error || !service) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: '서비스를 찾을 수 없습니다.',
            details: '존재하지 않거나 해당 샵의 서비스가 아닙니다.'
          }
        });
        return;
      }

      logger.info('Admin: Service retrieved successfully', {
        adminId,
        shopId,
        serviceId,
        serviceName: service.name
      });

      res.status(200).json({
        success: true,
        data: service,
        message: '서비스 정보를 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Admin: Error in getShopServiceById', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        adminId: req.user?.id,
        shopId: req.params.shopId,
        serviceId: req.params.serviceId
      });

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
   * Update a service (Admin)
   * PUT /api/admin/shops/:shopId/services/:serviceId
   */
  async updateShopService(req: AdminUpdateServiceRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { shopId, serviceId } = req.params;
      const updateData = req.body;

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

      const supabase = getSupabaseClient();

      // Verify service exists and belongs to the shop
      const { data: existingService, error: fetchError } = await supabase
        .from('shop_services')
        .select('*')
        .eq('id', serviceId)
        .eq('shop_id', shopId)
        .single();

      if (fetchError || !existingService) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: '서비스를 찾을 수 없습니다.',
            details: '존재하지 않거나 해당 샵의 서비스가 아닙니다.'
          }
        });
        return;
      }

      // Validate price range if both are being updated
      const price_min = updateData.price_min ?? existingService.price_min;
      const price_max = updateData.price_max ?? existingService.price_max;

      if (price_min && price_max && price_min > price_max) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRICE_RANGE',
            message: '가격 범위가 올바르지 않습니다.',
            details: '최소 가격은 최대 가격보다 작거나 같아야 합니다.'
          }
        });
        return;
      }

      // Validate deposit settings
      const deposit_amount = updateData.deposit_amount !== undefined ? updateData.deposit_amount : existingService.deposit_amount;
      const deposit_percentage = updateData.deposit_percentage !== undefined ? updateData.deposit_percentage : existingService.deposit_percentage;

      if (deposit_amount && deposit_percentage) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DEPOSIT_SETTINGS',
            message: '예약금 설정이 올바르지 않습니다.',
            details: '고정 금액과 비율 중 하나만 설정할 수 있습니다.'
          }
        });
        return;
      }

      // Update the service
      const { data: updatedService, error } = await supabase
        .from('shop_services')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', serviceId)
        .eq('shop_id', shopId)
        .select()
        .single();

      if (error) {
        logger.error('Admin: Error updating service', {
          error: error.message,
          adminId,
          shopId,
          serviceId,
          code: error.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'SERVICE_UPDATE_FAILED',
            message: '서비스 업데이트에 실패했습니다.',
            details: error.message
          }
        });
        return;
      }

      logger.info('Admin: Service updated successfully', {
        adminId,
        shopId,
        serviceId,
        serviceName: updatedService.name,
        updatedFields: Object.keys(updateData)
      });

      res.status(200).json({
        success: true,
        data: updatedService,
        message: '서비스가 성공적으로 업데이트되었습니다.'
      });

    } catch (error) {
      logger.error('Admin: Error in updateShopService', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        adminId: req.user?.id,
        shopId: req.params.shopId,
        serviceId: req.params.serviceId
      });

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
   * Delete a service (Admin)
   * DELETE /api/admin/shops/:shopId/services/:serviceId
   */
  async deleteShopService(req: AdminServiceByIdRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { shopId, serviceId } = req.params;

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

      const supabase = getSupabaseClient();

      // Verify service exists and belongs to the shop
      const { data: existingService, error: fetchError } = await supabase
        .from('shop_services')
        .select('*')
        .eq('id', serviceId)
        .eq('shop_id', shopId)
        .single();

      if (fetchError || !existingService) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: '서비스를 찾을 수 없습니다.',
            details: '존재하지 않거나 해당 샵의 서비스가 아닙니다.'
          }
        });
        return;
      }

      // Check for active reservations
      const { data: reservations, error: reservationError } = await supabase
        .from('reservations')
        .select('id')
        .eq('service_id', serviceId)
        .in('status', ['requested', 'confirmed'])
        .limit(1);

      if (reservationError) {
        logger.error('Admin: Error checking reservations before delete', {
          error: reservationError.message,
          adminId,
          shopId,
          serviceId
        });
      }

      if (reservations && reservations.length > 0) {
        res.status(409).json({
          success: false,
          error: {
            code: 'SERVICE_HAS_RESERVATIONS',
            message: '예약이 있는 서비스는 삭제할 수 없습니다.',
            details: '서비스를 비활성화하거나 예약 완료 후 삭제해주세요.'
          }
        });
        return;
      }

      // Delete the service
      const { error: deleteError } = await supabase
        .from('shop_services')
        .delete()
        .eq('id', serviceId)
        .eq('shop_id', shopId);

      if (deleteError) {
        logger.error('Admin: Error deleting service', {
          error: deleteError.message,
          adminId,
          shopId,
          serviceId,
          code: deleteError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'SERVICE_DELETION_FAILED',
            message: '서비스 삭제에 실패했습니다.',
            details: deleteError.message
          }
        });
        return;
      }

      logger.info('Admin: Service deleted successfully', {
        adminId,
        shopId,
        serviceId,
        serviceName: existingService.name
      });

      res.status(200).json({
        success: true,
        message: '서비스가 성공적으로 삭제되었습니다.'
      });

    } catch (error) {
      logger.error('Admin: Error in deleteShopService', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        adminId: req.user?.id,
        shopId: req.params.shopId,
        serviceId: req.params.serviceId
      });

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
}

export const adminShopServiceController = new AdminShopServiceController();
