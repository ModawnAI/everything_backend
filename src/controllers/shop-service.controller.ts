/**
 * Shop Service Controller
 * 
 * Handles shop service catalog management operations for shop owners including:
 * - Creating new services
 * - Retrieving service lists
 * - Updating existing services
 * - Deleting services
 * - Managing service availability and ordering
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

interface CreateServiceRequest extends AuthenticatedRequest {
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

interface UpdateServiceRequest extends AuthenticatedRequest {
  params: {
    id: string;
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

interface ServiceListRequest extends AuthenticatedRequest {
  query: {
    category?: ServiceCategory;
    is_available?: string;
    limit?: string;
    offset?: string;
  };
}

export class ShopServiceController {
  /**
   * @swagger
   * /api/shop/services:
   *   get:
   *     summary: Get shop services
   *     description: Retrieve all services for the authenticated shop owner's shop
   *     tags: [Shop Services]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
   *         description: Filter by service category
   *       - in: query
   *         name: is_available
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         description: Filter by availability status
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         description: Maximum number of services to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of services to skip
   *     responses:
   *       200:
   *         description: Services retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     services:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/ShopService'
   *                     totalCount:
   *                       type: integer
   *                       example: 15
   *                     hasMore:
   *                       type: boolean
   *                       example: false
   *                 message:
   *                   type: string
   *                   example: "서비스 목록을 성공적으로 조회했습니다."
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  async getServices(req: ServiceListRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { category, is_available, limit = '50', offset = '0' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // First, get the shop owned by the user
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '등록된 샵이 없습니다.',
            details: '샵 등록을 먼저 완료해주세요.'
          }
        });
        return;
      }

      // Build query for services
      let query = supabase
        .from('shop_services')
        .select('*', { count: 'exact' })
        .eq('shop_id', shop.id)
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
        logger.error('Error fetching shop services', {
          error: error.message,
          userId,
          shopId: shop.id,
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

      logger.info('Shop services retrieved successfully', {
        userId,
        shopId: shop.id,
        serviceCount: services.length,
        totalCount,
        filters: { category, is_available }
      });

      res.status(200).json({
        success: true,
        data: {
          services,
          totalCount,
          hasMore
        },
        message: '서비스 목록을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error in getServices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/shop/services/{id}:
   *   get:
   *     summary: Get service by ID
   *     description: Retrieve a specific service by ID for the authenticated shop owner
   *     tags: [Shop Services]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Service ID
   *     responses:
   *       200:
   *         description: Service retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ShopService'
   *                 message:
   *                   type: string
   *                   example: "서비스 정보를 성공적으로 조회했습니다."
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  async getServiceById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: serviceId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Get service with shop ownership verification
      const { data: service, error } = await supabase
        .from('shop_services')
        .select(`
          *,
          shop:shops!inner(id, owner_id)
        `)
        .eq('id', serviceId)
        .eq('shop.owner_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          res.status(404).json({
            success: false,
            error: {
              code: 'SERVICE_NOT_FOUND',
              message: '서비스를 찾을 수 없습니다.',
              details: '존재하지 않거나 접근 권한이 없는 서비스입니다.'
            }
          });
          return;
        }

        logger.error('Error fetching service by ID', {
          error: error.message,
          userId,
          serviceId,
          code: error.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '서비스 조회 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Remove the shop relation from response
      const { shop, ...serviceData } = service;

      logger.info('Service retrieved successfully', {
        userId,
        serviceId,
        serviceName: service.name
      });

      res.status(200).json({
        success: true,
        data: serviceData,
        message: '서비스 정보를 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error in getServiceById', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        serviceId: req.params.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/shop/services:
   *   post:
   *     summary: Create new service
   *     description: Create a new service for the authenticated shop owner's shop
   *     tags: [Shop Services]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - category
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 255
   *                 example: "젤네일"
   *               description:
   *                 type: string
   *                 maxLength: 1000
   *                 example: "고품질 젤네일 서비스"
   *               category:
   *                 type: string
   *                 enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
   *                 example: "nail"
   *               price_min:
   *                 type: integer
   *                 minimum: 0
   *                 example: 30000
   *               price_max:
   *                 type: integer
   *                 minimum: 0
   *                 example: 50000
   *               duration_minutes:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 480
   *                 example: 60
   *               deposit_amount:
   *                 type: integer
   *                 minimum: 0
   *                 example: 10000
   *               deposit_percentage:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 100
   *                 example: 20.0
   *               is_available:
   *                 type: boolean
   *                 default: true
   *                 example: true
   *               booking_advance_days:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 365
   *                 default: 30
   *                 example: 30
   *               cancellation_hours:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 168
   *                 default: 24
   *                 example: 24
   *               display_order:
   *                 type: integer
   *                 minimum: 0
   *                 default: 0
   *                 example: 1
   *     responses:
   *       201:
   *         description: Service created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ShopService'
   *                 message:
   *                   type: string
   *                   example: "서비스가 성공적으로 생성되었습니다."
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  async createService(req: CreateServiceRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const serviceData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // First, get the shop owned by the user
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '등록된 샵이 없습니다.',
            details: '샵 등록을 먼저 완료해주세요.'
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
          shop_id: shop.id,
          ...serviceData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating service', {
          error: error.message,
          userId,
          shopId: shop.id,
          serviceData,
          code: error.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'CREATE_FAILED',
            message: '서비스 생성 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      logger.info('Service created successfully', {
        userId,
        shopId: shop.id,
        serviceId: newService.id,
        serviceName: newService.name
      });

      res.status(201).json({
        success: true,
        data: newService,
        message: '서비스가 성공적으로 생성되었습니다.'
      });

    } catch (error) {
      logger.error('Error in createService', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/shop/services/{id}:
   *   put:
   *     summary: Update service
   *     description: Update an existing service for the authenticated shop owner
   *     tags: [Shop Services]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Service ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 255
   *                 example: "젤네일 (업데이트)"
   *               description:
   *                 type: string
   *                 maxLength: 1000
   *                 example: "업데이트된 젤네일 서비스 설명"
   *               category:
   *                 type: string
   *                 enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
   *                 example: "nail"
   *               price_min:
   *                 type: integer
   *                 minimum: 0
   *                 example: 35000
   *               price_max:
   *                 type: integer
   *                 minimum: 0
   *                 example: 55000
   *               duration_minutes:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 480
   *                 example: 90
   *               deposit_amount:
   *                 type: integer
   *                 minimum: 0
   *                 example: 15000
   *               deposit_percentage:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 100
   *                 example: 25.0
   *               is_available:
   *                 type: boolean
   *                 example: false
   *               booking_advance_days:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 365
   *                 example: 14
   *               cancellation_hours:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 168
   *                 example: 48
   *               display_order:
   *                 type: integer
   *                 minimum: 0
   *                 example: 2
   *     responses:
   *       200:
   *         description: Service updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ShopService'
   *                 message:
   *                   type: string
   *                   example: "서비스가 성공적으로 업데이트되었습니다."
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  async updateService(req: UpdateServiceRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: serviceId } = req.params;
      const updateData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Validate that there's something to update
      if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '업데이트할 데이터가 없습니다.',
            details: '최소 하나의 필드를 제공해주세요.'
          }
        });
        return;
      }

      // Validate price range
      if (updateData.price_min !== undefined && updateData.price_max !== undefined && 
          updateData.price_min > updateData.price_max) {
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
      if (updateData.deposit_amount && updateData.deposit_percentage) {
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

      const supabase = getSupabaseClient();

      // First, verify the service exists and belongs to the user
      const { data: existingService, error: fetchError } = await supabase
        .from('shop_services')
        .select(`
          id,
          shop_id,
          name,
          shop:shops!inner(id, owner_id)
        `)
        .eq('id', serviceId)
        .eq('shop.owner_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          res.status(404).json({
            success: false,
            error: {
              code: 'SERVICE_NOT_FOUND',
              message: '서비스를 찾을 수 없습니다.',
              details: '존재하지 않거나 접근 권한이 없는 서비스입니다.'
            }
          });
          return;
        }

        logger.error('Error fetching service for update', {
          error: fetchError.message,
          userId,
          serviceId,
          code: fetchError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '서비스 조회 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Update the service
      const { data: updatedService, error: updateError } = await supabase
        .from('shop_services')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', serviceId)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating service', {
          error: updateError.message,
          userId,
          serviceId,
          updateData,
          code: updateError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '서비스 업데이트 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      logger.info('Service updated successfully', {
        userId,
        serviceId,
        serviceName: existingService.name,
        updatedFields: Object.keys(updateData)
      });

      res.status(200).json({
        success: true,
        data: updatedService,
        message: '서비스가 성공적으로 업데이트되었습니다.'
      });

    } catch (error) {
      logger.error('Error in updateService', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        serviceId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/shop/services/{id}:
   *   delete:
   *     summary: Delete service
   *     description: Delete a service from the authenticated shop owner's catalog
   *     tags: [Shop Services]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Service ID
   *     responses:
   *       200:
   *         description: Service deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "서비스가 성공적으로 삭제되었습니다."
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       409:
   *         description: Conflict - Service has active reservations
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               success: false
   *               error:
   *                 code: "SERVICE_HAS_RESERVATIONS"
   *                 message: "예약이 있는 서비스는 삭제할 수 없습니다."
   *                 details: "서비스를 비활성화하거나 예약 완료 후 삭제해주세요."
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  async deleteService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: serviceId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // First, verify the service exists and belongs to the user
      const { data: existingService, error: fetchError } = await supabase
        .from('shop_services')
        .select(`
          id,
          name,
          shop:shops!inner(id, owner_id)
        `)
        .eq('id', serviceId)
        .eq('shop.owner_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          res.status(404).json({
            success: false,
            error: {
              code: 'SERVICE_NOT_FOUND',
              message: '서비스를 찾을 수 없습니다.',
              details: '존재하지 않거나 접근 권한이 없는 서비스입니다.'
            }
          });
          return;
        }

        logger.error('Error fetching service for deletion', {
          error: fetchError.message,
          userId,
          serviceId,
          code: fetchError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '서비스 조회 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Check if service has active reservations
      const { data: reservations, error: reservationError } = await supabase
        .from('reservation_services')
        .select('id')
        .eq('service_id', serviceId)
        .limit(1);

      if (reservationError) {
        logger.error('Error checking service reservations', {
          error: reservationError.message,
          userId,
          serviceId,
          code: reservationError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '서비스 예약 확인 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
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
        .eq('id', serviceId);

      if (deleteError) {
        logger.error('Error deleting service', {
          error: deleteError.message,
          userId,
          serviceId,
          code: deleteError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: '서비스 삭제 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      logger.info('Service deleted successfully', {
        userId,
        serviceId,
        serviceName: existingService.name
      });

      res.status(200).json({
        success: true,
        message: '서비스가 성공적으로 삭제되었습니다.'
      });

    } catch (error) {
      logger.error('Error in deleteService', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        serviceId: req.params.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 삭제 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}

export const shopServiceController = new ShopServiceController();

