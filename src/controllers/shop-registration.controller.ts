/**
 * Shop Registration Controller
 * 
 * Handles multi-step shop registration workflow including:
 * - Step-by-step registration process
 * - Korean business license validation
 * - Document upload management
 * - Registration status tracking
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { responseFormatter } from '../utils/response-formatter';
import { 
  validateRegistrationStep,
  validateCompleteRegistration,
  validateShopImage,
  validateKoreanBusinessLicense,
  validateKoreanAddress
} from '../validators/shop-registration.validators';

// Request interfaces
interface ShopRegistrationRequest extends Request {
  body: {
    step?: number;
    data?: any;
    complete_registration?: boolean;
  };
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

interface ShopImageUploadRequest extends Request {
  body: {
    shop_id: string;
    images: Array<{
      image_url: string;
      alt_text?: string;
      is_primary?: boolean;
      display_order?: number;
    }>;
  };
  user?: {
    id: string;
  };
}

interface RegistrationStatusRequest extends Request {
  params: {
    registrationId: string;
  };
  user?: {
    id: string;
  };
}

export class ShopRegistrationController {
  /**
   * POST /api/shop/register
   * Multi-step shop registration endpoint
   */
  async registerShop(req: ShopRegistrationRequest, res: Response): Promise<void> {
    try {
      const { step, data, complete_registration } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.sendUnauthorized('로그인이 필요합니다.');
        return;
      }

      const client = getSupabaseClient();

      // Handle complete registration (all steps at once)
      if (complete_registration && data) {
        await this.handleCompleteRegistration(req, res, userId, data);
        return;
      }

      // Handle step-by-step registration
      if (!step || !data) {
        res.sendBadRequest('등록 단계와 데이터가 필요합니다.');
        return;
      }

      // Validate step data
      const validation = validateRegistrationStep(step, data);
      if (validation.error) {
        res.sendBadRequest('입력 데이터가 유효하지 않습니다.');
        return;
      }

      // Check if user already has a pending registration
      const { data: existingRegistration, error: checkError } = await client
        .from('shops')
        .select('id, shop_status, verification_status')
        .eq('owner_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Failed to check existing registration', {
          error: checkError.message,
          userId
        });
        res.sendInternalServerError('등록 상태 확인 중 오류가 발생했습니다.');
        return;
      }

      // Process the registration step
      const result = await this.processRegistrationStep(userId, step, validation.value.data, existingRegistration);
      
      if (!result.success) {
        res.sendBadRequest(result.error || '등록 처리 중 오류가 발생했습니다.');
        return;
      }

      logger.info('Shop registration step completed', {
        userId,
        step,
        shopId: result.shopId
      });

      res.sendSuccess({
        shop_id: result.shopId,
        step_completed: step,
        next_step: step < 4 ? step + 1 : null,
        registration_complete: step === 4,
        status: result.status
      }, `${step}단계 등록이 완료되었습니다.`);

    } catch (error) {
      logger.error('Shop registration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        step: req.body.step
      });
      res.sendInternalServerError('샵 등록 중 오류가 발생했습니다.');
    }
  }

  /**
   * Handle complete registration (all steps at once)
   */
  private async handleCompleteRegistration(
    req: ShopRegistrationRequest, 
    res: Response, 
    userId: string, 
    data: any
  ): Promise<void> {
    const validation = validateCompleteRegistration(data);
    if (validation.error) {
      res.sendBadRequest('등록 정보가 유효하지 않습니다.');
      return;
    }

    const client = getSupabaseClient();
    
    // Check for existing registration
    const { data: existingShop } = await client
      .from('shops')
      .select('id')
      .eq('owner_id', userId)
      .single();

    if (existingShop) {
      res.sendConflict('이미 등록된 샵이 있습니다.');
      return;
    }

    // Create complete shop registration
    const shopData = {
      owner_id: userId,
      ...validation.value,
      location: `POINT(${validation.value.longitude} ${validation.value.latitude})`,
      shop_status: 'pending_approval',
      verification_status: 'pending',
      shop_type: 'non_partnered',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: shop, error } = await client
      .from('shops')
      .insert(shopData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create complete shop registration', {
        error: error.message,
        userId
      });
      res.sendInternalServerError('샵 등록에 실패했습니다.');
      return;
    }

    logger.info('Complete shop registration created', {
      userId,
      shopId: shop.id
    });

    res.sendCreated({
      shop_id: shop.id,
      status: 'pending_approval',
      verification_status: 'pending',
      message: '샵 등록이 완료되었습니다. 관리자 승인을 기다려주세요.'
    }, '샵 등록이 성공적으로 완료되었습니다.');
  }

  /**
   * Process individual registration step
   */
  private async processRegistrationStep(
    userId: string, 
    step: number, 
    stepData: any, 
    existingShop?: any
  ): Promise<{ success: boolean; shopId?: string; status?: string; error?: string; details?: any }> {
    const client = getSupabaseClient();

    try {
      if (step === 1) {
        // Step 1: Create new shop with basic info or update existing
        if (existingShop) {
          const { error } = await client
            .from('shops')
            .update({
              ...stepData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingShop.id);

          if (error) throw error;
          return { success: true, shopId: existingShop.id, status: existingShop.shop_status };
        } else {
          const { data: shop, error } = await client
            .from('shops')
            .insert({
              owner_id: userId,
              ...stepData,
              shop_status: 'pending_approval',
              verification_status: 'pending',
              shop_type: 'non_partnered',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) throw error;
          return { success: true, shopId: shop.id, status: 'pending_approval' };
        }
      } else {
        // Steps 2-4: Update existing shop
        if (!existingShop) {
          return { 
            success: false, 
            error: '기본 정보를 먼저 등록해주세요.',
            details: { required_step: 1 }
          };
        }

        const updateData: any = { ...stepData, updated_at: new Date().toISOString() };

        // Step 2: Add location data
        if (step === 2 && stepData.latitude && stepData.longitude) {
          updateData.location = `POINT(${stepData.longitude} ${stepData.latitude})`;
        }

        const { error } = await client
          .from('shops')
          .update(updateData)
          .eq('id', existingShop.id);

        if (error) throw error;
        return { success: true, shopId: existingShop.id, status: existingShop.shop_status };
      }
    } catch (error) {
      logger.error('Registration step processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        step
      });
      return { 
        success: false, 
        error: '등록 단계 처리 중 오류가 발생했습니다.',
        details: { step, error_message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * POST /api/shop/register/images
   * Upload shop images
   */
  async uploadShopImages(req: ShopImageUploadRequest, res: Response): Promise<void> {
    try {
      const { shop_id, images } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.sendUnauthorized('로그인이 필요합니다.');
        return;
      }

      if (!shop_id || !images || !Array.isArray(images)) {
        res.sendBadRequest('샵 ID와 이미지 정보가 필요합니다.');
        return;
      }

      const client = getSupabaseClient();

      // Verify shop ownership
      const { data: shop, error: shopError } = await client
        .from('shops')
        .select('id, owner_id')
        .eq('id', shop_id)
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
        res.sendNotFound('샵을 찾을 수 없거나 접근 권한이 없습니다.');
        return;
      }

      // Validate each image
      const validatedImages = [];
      for (const image of images) {
        const validation = validateShopImage(image);
        if (validation.error) {
          res.sendBadRequest('이미지 정보가 유효하지 않습니다.');
          return;
        }
        validatedImages.push({
          shop_id,
          ...validation.value,
          created_at: new Date().toISOString()
        });
      }

      // Insert images
      const { data: insertedImages, error: insertError } = await client
        .from('shop_images')
        .insert(validatedImages)
        .select();

      if (insertError) {
        logger.error('Failed to insert shop images', {
          error: insertError.message,
          shopId: shop_id,
          userId
        });
        res.sendInternalServerError('이미지 업로드에 실패했습니다.');
        return;
      }

      logger.info('Shop images uploaded successfully', {
        shopId: shop_id,
        userId,
        imageCount: insertedImages.length
      });

      res.sendCreated({
        shop_id,
        images: insertedImages,
        uploaded_count: insertedImages.length
      }, '이미지가 성공적으로 업로드되었습니다.');

    } catch (error) {
      logger.error('Shop image upload failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        shopId: req.body.shop_id
      });
      res.sendInternalServerError('이미지 업로드 중 오류가 발생했습니다.');
    }
  }

  /**
   * GET /api/shop/register/status/:registrationId
   * Get registration status
   */
  async getRegistrationStatus(req: RegistrationStatusRequest, res: Response): Promise<void> {
    try {
      const { registrationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.sendUnauthorized('로그인이 필요합니다.');
        return;
      }

      const client = getSupabaseClient();

      const { data: shop, error } = await client
        .from('shops')
        .select(`
          id,
          name,
          shop_status,
          verification_status,
          created_at,
          updated_at,
          business_license_number,
          business_license_image_url,
          shop_images (
            id,
            image_url,
            is_primary,
            display_order
          )
        `)
        .eq('id', registrationId)
        .eq('owner_id', userId)
        .single();

      if (error || !shop) {
        res.sendNotFound('등록 정보를 찾을 수 없습니다.');
        return;
      }

      // Determine completion status
      const completionStatus = {
        basic_info: !!(shop.name),
        business_license: !!(shop.business_license_number && shop.business_license_image_url),
        images: shop.shop_images && shop.shop_images.length > 0,
        overall_complete: shop.shop_status !== 'pending_approval' || shop.verification_status !== 'pending'
      };

      res.sendSuccess({
        shop: {
          id: shop.id,
          name: shop.name,
          status: shop.shop_status,
          verification_status: shop.verification_status,
          created_at: shop.created_at,
          updated_at: shop.updated_at
        },
        completion_status: completionStatus,
        images_count: shop.shop_images?.length || 0,
        next_steps: this.getNextSteps(shop, completionStatus)
      }, '등록 상태를 조회했습니다.');

    } catch (error) {
      logger.error('Failed to get registration status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        registrationId: req.params.registrationId
      });
      res.sendInternalServerError('등록 상태 조회 중 오류가 발생했습니다.');
    }
  }

  /**
   * GET /api/shop/register/validate/business-license/:licenseNumber
   * Validate Korean business license number
   */
  async validateBusinessLicense(req: Request, res: Response): Promise<void> {
    try {
      const { licenseNumber } = req.params;

      if (!licenseNumber) {
        res.sendBadRequest('사업자등록번호를 입력해주세요.');
        return;
      }

      const validation = validateKoreanBusinessLicense(licenseNumber);
      
      if (validation.isValid) {
        res.sendSuccess({
          license_number: licenseNumber,
          is_valid: true,
          formatted_number: licenseNumber.replace(/[-\s]/g, '').replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')
        }, '유효한 사업자등록번호입니다.');
      } else {
        res.sendBadRequest(validation.error || '유효하지 않은 사업자등록번호입니다.');
      }

    } catch (error) {
      logger.error('Business license validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        licenseNumber: req.params.licenseNumber
      });
      responseFormatter.internalServerError(res, '사업자등록번호 검증 중 오류가 발생했습니다.');
    }
  }

  /**
   * Helper method to determine next steps for registration
   */
  private getNextSteps(shop: any, completionStatus: any): string[] {
    const nextSteps = [];

    if (!completionStatus.basic_info) {
      nextSteps.push('기본 정보 입력 완료');
    }

    if (!completionStatus.business_license) {
      nextSteps.push('사업자등록증 업로드');
    }

    if (!completionStatus.images) {
      nextSteps.push('샵 이미지 업로드');
    }

    if (shop.shop_status === 'pending_approval') {
      nextSteps.push('관리자 승인 대기');
    }

    if (nextSteps.length === 0) {
      nextSteps.push('등록 완료');
    }

    return nextSteps;
  }
}
