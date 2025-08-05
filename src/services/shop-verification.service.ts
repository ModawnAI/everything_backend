/**
 * Shop Verification Service
 * 
 * Handles shop verification business logic including:
 * - Document validation and verification
 * - Status transition management
 * - Notification handling
 * - Verification history tracking
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ShopVerificationStatus, ShopType, ShopStatus } from '../types/database.types';

// Types
export interface VerificationDocument {
  type: 'business_license' | 'identity_document' | 'address_proof' | 'other';
  url: string;
  filename: string;
  uploadedAt: Date;
  verified: boolean;
  verificationNotes?: string;
}

export interface VerificationRequest {
  shopId: string;
  adminId: string;
  approved: boolean;
  shopType?: ShopType;
  commissionRate?: number;
  notes?: string;
  documents?: VerificationDocument[];
}

export interface VerificationResult {
  success: boolean;
  shopId: string;
  previousStatus: ShopVerificationStatus;
  newStatus: ShopVerificationStatus;
  action: 'approved' | 'rejected';
  message: string;
  errors?: string[];
}

export interface VerificationHistory {
  id: string;
  shopId: string;
  adminId: string;
  actionType: 'shop_approved' | 'shop_rejected' | 'shop_suspended';
  reason: string;
  createdAt: Date;
  adminName?: string;
  adminEmail?: string;
}

export class ShopVerificationService {
  private supabase = getSupabaseClient();

  /**
   * Validate shop verification documents
   */
  async validateDocuments(shopId: string): Promise<{ isValid: boolean; issues: string[] }> {
    try {
      const { data: shop, error } = await this.supabase
        .from('shops')
        .select('business_license_number, business_license_image_url')
        .eq('id', shopId)
        .single();

      if (error || !shop) {
        return { isValid: false, issues: ['샵 정보를 찾을 수 없습니다.'] };
      }

      const issues: string[] = [];

      // Check business license number
      if (!shop.business_license_number) {
        issues.push('사업자등록번호가 필요합니다.');
      }

      // Check business license image
      if (!shop.business_license_image_url) {
        issues.push('사업자등록증 이미지가 필요합니다.');
      }

      // TODO: Add more document validation rules
      // - Image quality validation
      // - Document format validation
      // - OCR text extraction and validation
      // - Cross-reference with government databases

      return {
        isValid: issues.length === 0,
        issues
      };

    } catch (error) {
      logger.error('Document validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      return { isValid: false, issues: ['문서 검증 중 오류가 발생했습니다.'] };
    }
  }

  /**
   * Process shop verification request
   */
  async processVerification(request: VerificationRequest): Promise<VerificationResult> {
    try {
      const { shopId, adminId, approved, shopType, commissionRate, notes } = request;

      // Get current shop data
      const { data: shop, error: fetchError } = await this.supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();

      if (fetchError || !shop) {
        return {
          success: false,
          shopId,
          previousStatus: 'pending',
          newStatus: 'pending',
          action: approved ? 'approved' : 'rejected',
          message: '샵을 찾을 수 없습니다.',
          errors: ['유효한 샵 ID를 확인해주세요.']
        };
      }

      if (shop.verification_status !== 'pending') {
        return {
          success: false,
          shopId,
          previousStatus: shop.verification_status,
          newStatus: shop.verification_status,
          action: approved ? 'approved' : 'rejected',
          message: '승인 대기 중인 샵만 처리할 수 있습니다.',
          errors: [`현재 상태: ${shop.verification_status}`]
        };
      }

      // Validate documents if approving
      if (approved) {
        const documentValidation = await this.validateDocuments(shopId);
        if (!documentValidation.isValid) {
          return {
            success: false,
            shopId,
            previousStatus: shop.verification_status,
            newStatus: shop.verification_status,
            action: 'rejected',
            message: '문서 검증에 실패했습니다.',
            errors: documentValidation.issues
          };
        }
      }

      // Prepare update data
      const updateData: any = {
        verification_status: approved ? 'verified' : 'rejected',
        shop_status: approved ? 'active' : 'inactive',
        updated_at: new Date().toISOString()
      };

      if (approved) {
        if (shopType) {
          updateData.shop_type = shopType;
        }
        if (commissionRate !== undefined) {
          updateData.commission_rate = commissionRate;
        }
        updateData.partnership_started_at = new Date().toISOString();
      }

      // Update shop
      const { data: updatedShop, error: updateError } = await this.supabase
        .from('shops')
        .update(updateData)
        .eq('id', shopId)
        .select()
        .single();

      if (updateError) {
        logger.error('Failed to update shop verification status', {
          error: updateError.message,
          shopId,
          approved
        });

        return {
          success: false,
          shopId,
          previousStatus: shop.verification_status,
          newStatus: shop.verification_status,
          action: approved ? 'approved' : 'rejected',
          message: '샵 상태 업데이트에 실패했습니다.',
          errors: ['잠시 후 다시 시도해주세요.']
        };
      }

      // Log admin action
      const actionType = approved ? 'shop_approved' : 'shop_rejected';
      const { error: actionError } = await this.supabase
        .from('admin_actions')
        .insert({
          admin_id: adminId,
          action_type: actionType,
          target_type: 'shop',
          target_id: shopId,
          reason: notes || (approved ? '샵 승인 완료' : '샵 승인 거절'),
          created_at: new Date().toISOString()
        });

      if (actionError) {
        logger.error('Failed to log admin action', {
          error: actionError.message,
          adminId,
          shopId,
          actionType
        });
        // Don't fail the request, just log the error
      }

      // Send notification to shop owner
      await this.sendVerificationNotification(shop.owner_id, approved, notes);

      logger.info('Shop verification processed successfully', {
        shopId,
        adminId,
        approved,
        previousStatus: shop.verification_status,
        newStatus: updateData.verification_status
      });

      return {
        success: true,
        shopId,
        previousStatus: shop.verification_status,
        newStatus: updateData.verification_status,
        action: approved ? 'approved' : 'rejected',
        message: approved ? '샵이 성공적으로 승인되었습니다.' : '샵 승인이 거절되었습니다.'
      };

    } catch (error) {
      logger.error('Shop verification processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });

      return {
        success: false,
        shopId: request.shopId,
        previousStatus: 'pending',
        newStatus: 'pending',
        action: request.approved ? 'approved' : 'rejected',
        message: '샵 인증 처리 중 오류가 발생했습니다.',
        errors: ['서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.']
      };
    }
  }

  /**
   * Get shop verification history
   */
  async getVerificationHistory(shopId: string, page: number = 1, limit: number = 20): Promise<{
    history: VerificationHistory[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const offset = (page - 1) * limit;

      const { data: actions, error, count } = await this.supabase
        .from('admin_actions')
        .select(`
          id,
          action_type,
          reason,
          created_at,
          admin:users!admin_actions_admin_id_fkey(
            name,
            email
          )
        `)
        .eq('target_type', 'shop')
        .eq('target_id', shopId)
        .in('action_type', ['shop_approved', 'shop_rejected', 'shop_suspended'])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to fetch verification history', {
          error: error.message,
          shopId
        });
        throw new Error('인증 이력을 가져오는데 실패했습니다.');
      }

      // Get total count for pagination
      const { count: totalCount } = await this.supabase
        .from('admin_actions')
        .select('*', { count: 'exact', head: true })
        .eq('target_type', 'shop')
        .eq('target_id', shopId)
        .in('action_type', ['shop_approved', 'shop_rejected', 'shop_suspended']);

      const history: VerificationHistory[] = (actions || []).map((action: any) => ({
        id: action.id,
        shopId: action.target_id,
        adminId: action.admin_id,
        actionType: action.action_type,
        reason: action.reason,
        createdAt: new Date(action.created_at),
        adminName: action.admin?.name,
        adminEmail: action.admin?.email
      }));

      return {
        history,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit)
        }
      };

    } catch (error) {
      logger.error('Get verification history failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      throw error;
    }
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(): Promise<{
    overall: {
      pending: number;
      verified: number;
      rejected: number;
      total: number;
    };
    recent: {
      approved: number;
      rejected: number;
      total: number;
    };
    period: string;
  }> {
    try {
      // Get verification status counts
      const { data: statusCounts, error: statusError } = await this.supabase
        .from('shops')
        .select('verification_status')
        .in('verification_status', ['pending', 'verified', 'rejected']);

      if (statusError) {
        logger.error('Failed to fetch verification stats', {
          error: statusError.message
        });
        throw new Error('인증 통계를 가져오는데 실패했습니다.');
      }

      // Calculate counts
      const stats = {
        pending: 0,
        verified: 0,
        rejected: 0,
        total: statusCounts?.length || 0
      };

      statusCounts?.forEach(shop => {
        if (shop.verification_status === 'pending') stats.pending++;
        else if (shop.verification_status === 'verified') stats.verified++;
        else if (shop.verification_status === 'rejected') stats.rejected++;
      });

      // Get recent verification activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentActions, error: actionsError } = await this.supabase
        .from('admin_actions')
        .select('action_type, created_at')
        .in('action_type', ['shop_approved', 'shop_rejected'])
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (actionsError) {
        logger.error('Failed to fetch recent verification actions', {
          error: actionsError.message
        });
      }

      const recentStats = {
        approved: 0,
        rejected: 0,
        total: recentActions?.length || 0
      };

      recentActions?.forEach(action => {
        if (action.action_type === 'shop_approved') recentStats.approved++;
        else if (action.action_type === 'shop_rejected') recentStats.rejected++;
      });

      return {
        overall: stats,
        recent: recentStats,
        period: '30일'
      };

    } catch (error) {
      logger.error('Get verification stats failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Send verification notification to shop owner
   */
  private async sendVerificationNotification(
    ownerId: string,
    approved: boolean,
    notes?: string
  ): Promise<void> {
    try {
      // TODO: Implement notification service
      // This would typically send:
      // - Push notification
      // - Email notification
      // - In-app notification
      
      logger.info('Verification notification sent', {
        ownerId,
        approved,
        notes
      });

    } catch (error) {
      logger.error('Failed to send verification notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ownerId,
        approved
      });
      // Don't fail the verification process if notification fails
    }
  }

  /**
   * Check if shop meets verification requirements
   */
  async checkVerificationRequirements(shopId: string): Promise<{
    meetsRequirements: boolean;
    missingRequirements: string[];
    recommendations: string[];
  }> {
    try {
      const { data: shop, error } = await this.supabase
        .from('shops')
        .select(`
          *,
          owner:users!shops_owner_id_fkey(
            id,
            name,
            email,
            phone_number,
            user_status
          )
        `)
        .eq('id', shopId)
        .single();

      if (error || !shop) {
        return {
          meetsRequirements: false,
          missingRequirements: ['샵 정보를 찾을 수 없습니다.'],
          recommendations: ['유효한 샵 ID를 확인해주세요.']
        };
      }

      const missingRequirements: string[] = [];
      const recommendations: string[] = [];

      // Check business license
      if (!shop.business_license_number) {
        missingRequirements.push('사업자등록번호');
        recommendations.push('사업자등록번호를 입력해주세요.');
      }

      if (!shop.business_license_image_url) {
        missingRequirements.push('사업자등록증 이미지');
        recommendations.push('사업자등록증 이미지를 업로드해주세요.');
      }

      // Check owner information
      if (!shop.owner) {
        missingRequirements.push('샵 소유자 정보');
        recommendations.push('샵 소유자 정보를 확인해주세요.');
      } else {
        if (shop.owner.user_status !== 'active') {
          missingRequirements.push('활성화된 소유자 계정');
          recommendations.push('소유자 계정이 활성화되어야 합니다.');
        }
      }

      // Check required shop information
      if (!shop.name || !shop.address || !shop.main_category) {
        missingRequirements.push('기본 샵 정보');
        recommendations.push('샵명, 주소, 주 서비스 카테고리를 입력해주세요.');
      }

      // Check contact information
      if (!shop.phone_number && !shop.email) {
        missingRequirements.push('연락처 정보');
        recommendations.push('전화번호 또는 이메일을 입력해주세요.');
      }

      return {
        meetsRequirements: missingRequirements.length === 0,
        missingRequirements,
        recommendations
      };

    } catch (error) {
      logger.error('Check verification requirements failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });

      return {
        meetsRequirements: false,
        missingRequirements: ['요구사항 확인 중 오류가 발생했습니다.'],
        recommendations: ['잠시 후 다시 시도해주세요.']
      };
    }
  }
}

export const shopVerificationService = new ShopVerificationService(); 