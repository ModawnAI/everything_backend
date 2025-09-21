/**
 * Shop Profile Controller
 * 
 * Handles shop profile management operations for shop owners including:
 * - Retrieving own shop profile information
 * - Updating shop profile details
 * - Managing shop settings and preferences
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { Shop, ServiceCategory, ShopStatus, ShopType } from '../types/database.types';
import { shopCategoriesService } from '../services/shop-categories.service';

// Request interfaces
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

interface ShopProfileUpdateRequest extends AuthenticatedRequest {
  body: {
    name?: string;
    description?: string;
    phone_number?: string;
    email?: string;
    address?: string;
    detailed_address?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
    main_category?: ServiceCategory;
    sub_categories?: ServiceCategory[];
    operating_hours?: Record<string, any>;
    payment_methods?: string[];
    kakao_channel_url?: string;
    business_license_number?: string;
  };
}

export class ShopProfileController {
  /**
   * @swagger
   * /api/shop/profile:
   *   get:
   *     summary: Get shop owner's profile
   *     description: Retrieve the authenticated shop owner's shop profile information
   *     tags: [Shop Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Shop profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/Shop'
   *                 message:
   *                   type: string
   *                   example: "샵 프로필을 성공적으로 조회했습니다."
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Forbidden - User is not a shop owner
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Shop not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async getShopProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

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

      // Get shop owned by the authenticated user
      const { data: shop, error } = await supabase
        .from('shops')
        .select(`
          *,
          shop_services:shop_services(
            id,
            name,
            category,
            price_min,
            price_max,
            duration,
            description,
            is_available,
            display_order,
            created_at,
            updated_at
          ),
          shop_images:shop_images(
            id,
            image_url,
            alt_text,
            is_primary,
            display_order,
            created_at
          )
        `)
        .eq('owner_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No shop found for this user
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

        logger.error('Error fetching shop profile', {
          error: error.message,
          userId,
          code: error.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '샵 프로필 조회 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Log successful profile retrieval
      logger.info('Shop profile retrieved successfully', {
        userId,
        shopId: shop.id,
        shopName: shop.name
      });

      res.status(200).json({
        success: true,
        data: shop,
        message: '샵 프로필을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error in getShopProfile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 프로필 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/shop/profile:
   *   put:
   *     summary: Update shop owner's profile
   *     description: Update the authenticated shop owner's shop profile information
   *     tags: [Shop Profile]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 maxLength: 255
   *                 description: Shop name
   *                 example: "네일아트 전문점"
   *               description:
   *                 type: string
   *                 maxLength: 1000
   *                 description: Shop description
   *                 example: "프리미엄 네일아트 서비스를 제공합니다"
   *               phone_number:
   *                 type: string
   *                 description: Contact phone number
   *                 example: "02-1234-5678"
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Contact email
   *                 example: "contact@nailshop.com"
   *               address:
   *                 type: string
   *                 description: Shop address
   *                 example: "서울시 강남구 테헤란로 123"
   *               detailed_address:
   *                 type: string
   *                 maxLength: 500
   *                 description: Detailed address
   *                 example: "2층 201호"
   *               postal_code:
   *                 type: string
   *                 description: Postal code
   *                 example: "06234"
   *               latitude:
   *                 type: number
   *                 minimum: -90
   *                 maximum: 90
   *                 description: Shop latitude
   *                 example: 37.5665
   *               longitude:
   *                 type: number
   *                 minimum: -180
   *                 maximum: 180
   *                 description: Shop longitude
   *                 example: 126.9780
   *               main_category:
   *                 type: string
   *                 enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
   *                 description: Primary service category
   *                 example: "nail"
   *               sub_categories:
   *                 type: array
   *                 items:
   *                   type: string
   *                   enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
   *                 description: Additional service categories
   *                 example: ["nail", "eyelash"]
   *               operating_hours:
   *                 type: object
   *                 description: Operating hours by day
   *                 example: {
   *                   "monday": {"open": "09:00", "close": "21:00", "is_open": true},
   *                   "tuesday": {"open": "09:00", "close": "21:00", "is_open": true}
   *                 }
   *               payment_methods:
   *                 type: array
   *                 items:
   *                   type: string
   *                   enum: [cash, card, transfer, mobile_pay, point]
   *                 description: Accepted payment methods
   *                 example: ["card", "mobile_pay"]
   *               kakao_channel_url:
   *                 type: string
   *                 format: uri
   *                 description: KakaoTalk channel URL
   *                 example: "https://pf.kakao.com/_example"
   *               business_license_number:
   *                 type: string
   *                 maxLength: 50
   *                 description: Business license number
   *                 example: "123-45-67890"
   *     responses:
   *       200:
   *         description: Shop profile updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/Shop'
   *                 message:
   *                   type: string
   *                   example: "샵 프로필이 성공적으로 업데이트되었습니다."
   *       400:
   *         description: Bad request - Invalid input data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Forbidden - User is not a shop owner
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Shop not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async updateShopProfile(req: ShopProfileUpdateRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
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

      const supabase = getSupabaseClient();

      // First, verify that the shop exists and belongs to the user
      const { data: existingShop, error: fetchError } = await supabase
        .from('shops')
        .select('id, name, owner_id')
        .eq('owner_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
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

        logger.error('Error fetching shop for update', {
          error: fetchError.message,
          userId,
          code: fetchError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '샵 정보 조회 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Validate categories using categories service
      if (updateData.main_category || updateData.sub_categories) {
        try {
          const categories = await shopCategoriesService.getAllCategories({ includeInactive: false, withServiceTypes: false });
          const validCategories = categories.map(cat => cat.id as ServiceCategory);
          
          // Validate main category
          if (updateData.main_category && !validCategories.includes(updateData.main_category)) {
            res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_MAIN_CATEGORY',
                message: '유효하지 않은 메인 카테고리입니다.',
                details: `유효한 카테고리: ${validCategories.join(', ')}`
              }
            });
            return;
          }

          // Validate sub categories
          if (updateData.sub_categories && Array.isArray(updateData.sub_categories)) {
            const invalidSubCategories = updateData.sub_categories.filter(cat => !validCategories.includes(cat));
            if (invalidSubCategories.length > 0) {
              res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_SUB_CATEGORIES',
                  message: '유효하지 않은 서브 카테고리가 있습니다.',
                  details: `유효하지 않은 카테고리: ${invalidSubCategories.join(', ')}. 유효한 카테고리: ${validCategories.join(', ')}`
                }
              });
              return;
            }
          }
        } catch (error) {
          logger.error('Error validating categories', { error, mainCategory: updateData.main_category, subCategories: updateData.sub_categories });
          // Fallback to hardcoded validation if service fails
          const validCategories: ServiceCategory[] = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];
          
          if (updateData.main_category && !validCategories.includes(updateData.main_category)) {
            res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_MAIN_CATEGORY',
                message: '유효하지 않은 메인 카테고리입니다.',
                details: `유효한 카테고리: ${validCategories.join(', ')}`
              }
            });
            return;
          }

          if (updateData.sub_categories && Array.isArray(updateData.sub_categories)) {
            const invalidSubCategories = updateData.sub_categories.filter(cat => !validCategories.includes(cat));
            if (invalidSubCategories.length > 0) {
              res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_SUB_CATEGORIES',
                  message: '유효하지 않은 서브 카테고리가 있습니다.',
                  details: `유효하지 않은 카테고리: ${invalidSubCategories.join(', ')}. 유효한 카테고리: ${validCategories.join(', ')}`
                }
              });
              return;
            }
          }
        }
      }

      // Prepare update data with timestamp
      const updatePayload = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      // If latitude and longitude are provided, update the PostGIS location field
      if (updateData.latitude !== undefined && updateData.longitude !== undefined) {
        // Note: PostGIS location will be updated via database trigger or we can use ST_MakePoint
        // For now, we'll let the database handle the location field update based on lat/lng
      }

      // Update the shop
      const { data: updatedShop, error: updateError } = await supabase
        .from('shops')
        .update(updatePayload)
        .eq('id', existingShop.id)
        .select(`
          *,
          shop_services:shop_services(
            id,
            name,
            category,
            price_min,
            price_max,
            duration,
            description,
            is_available,
            display_order,
            created_at,
            updated_at
          ),
          shop_images:shop_images(
            id,
            image_url,
            alt_text,
            is_primary,
            display_order,
            created_at
          )
        `)
        .single();

      if (updateError) {
        logger.error('Error updating shop profile', {
          error: updateError.message,
          userId,
          shopId: existingShop.id,
          updateData,
          code: updateError.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '샵 프로필 업데이트 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Log successful update
      logger.info('Shop profile updated successfully', {
        userId,
        shopId: existingShop.id,
        shopName: existingShop.name,
        updatedFields: Object.keys(updateData)
      });

      res.status(200).json({
        success: true,
        data: updatedShop,
        message: '샵 프로필이 성공적으로 업데이트되었습니다.'
      });

    } catch (error) {
      logger.error('Error in updateShopProfile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 프로필 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * @swagger
   * /api/shop/profile/status:
   *   get:
   *     summary: Get shop profile completion status
   *     description: Check the completion status of shop profile setup
   *     tags: [Shop Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Profile status retrieved successfully
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
   *                     completionPercentage:
   *                       type: number
   *                       example: 85
   *                     requiredFields:
   *                       type: array
   *                       items:
   *                         type: string
   *                       example: ["name", "address", "main_category", "phone_number"]
   *                     completedFields:
   *                       type: array
   *                       items:
   *                         type: string
   *                       example: ["name", "address", "main_category"]
   *                     missingFields:
   *                       type: array
   *                       items:
   *                         type: string
   *                       example: ["phone_number"]
   *                     shopStatus:
   *                       type: string
   *                       example: "pending_approval"
   *                     verificationStatus:
   *                       type: string
   *                       example: "pending"
   *                 message:
   *                   type: string
   *                   example: "프로필 상태를 조회했습니다."
   */
  async getProfileStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

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

      // Get shop profile
      const { data: shop, error } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
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

        logger.error('Error fetching shop for status check', {
          error: error.message,
          userId,
          code: error.code
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '샵 상태 조회 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Define required fields for profile completion
      const requiredFields = [
        'name',
        'address',
        'main_category',
        'phone_number',
        'business_license_number',
        'business_license_image_url'
      ];

      // Check which fields are completed
      const completedFields = requiredFields.filter(field => {
        const value = shop[field];
        return value !== null && value !== undefined && value !== '';
      });

      const missingFields = requiredFields.filter(field => !completedFields.includes(field));
      const completionPercentage = Math.round((completedFields.length / requiredFields.length) * 100);

      res.status(200).json({
        success: true,
        data: {
          completionPercentage,
          requiredFields,
          completedFields,
          missingFields,
          shopStatus: shop.shop_status,
          verificationStatus: shop.verification_status,
          shopId: shop.id,
          shopName: shop.name
        },
        message: '프로필 상태를 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error in getProfileStatus', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '프로필 상태 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}

export const shopProfileController = new ShopProfileController();
