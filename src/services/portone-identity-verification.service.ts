/**
 * PortOne V2 Identity Verification Service
 *
 * Handles PortOne V2 identity verification (본인인증) integration
 * Supports: Danal, KCP, KG Inicis phone/unified verification
 */

import { PortOneClient } from '@portone/server-sdk';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import config from '../config/environment';

export interface PortOneIdentityVerificationRequest {
  identityVerificationId: string;
  userId?: string;
  storeId?: string;
  channelKey?: string;
  customer?: {
    id?: string;
    phoneNumber?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
  };
  customData?: string;
  bypass?: Record<string, any>;
}

export interface PortOneIdentityVerificationResult {
  success: boolean;
  identityVerificationId: string;
  status: 'VERIFIED' | 'FAILED' | 'PENDING';
  verifiedCustomer?: {
    ci: string;
    di?: string;
    name: string;
    gender?: 'MALE' | 'FEMALE';
    birthDate: string; // YYYY-MM-DD
    phoneNumber?: string;
    operator?: string; // Carrier
    isForeigner: boolean;
  };
  error?: string;
}

export interface DanalBypassParams {
  IsCarrier?: string; // 'SKT', 'KTF', 'LGT', 'MVNO' or combinations with ';'
  AGELIMIT?: number; // Minimum age requirement
  CPTITLE?: string; // Service URL or path
}

export class PortOneIdentityVerificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PortOneIdentityVerificationError';
  }
}

/**
 * PortOne V2 Identity Verification Service Implementation
 */
class PortOneIdentityVerificationService {
  private client: ReturnType<typeof PortOneClient>;
  private supabase = getSupabaseClient();
  private storeId: string;
  private channelKey: string;

  constructor() {
    // Initialize PortOne V2 client
    this.client = PortOneClient({
      secret: config.payments.portone.v2.apiSecret
    });

    this.storeId = config.payments.portone.v2.storeId;
    this.channelKey = config.payments.portone.v2.channelKey;

    logger.info('PortOne V2 Identity Verification Service initialized', {
      storeId: this.storeId,
      channelKey: this.channelKey
    });
  }

  /**
   * Prepare identity verification request
   * Returns data needed for frontend SDK call
   */
  async prepareVerification(request: PortOneIdentityVerificationRequest): Promise<{
    identityVerificationId: string;
    storeId: string;
    channelKey: string;
  }> {
    try {
      logger.info('Preparing identity verification', {
        identityVerificationId: request.identityVerificationId,
        userId: request.userId,
        hasCustomer: !!request.customer
      });

      // Validate phone number if provided
      if (request.customer?.phoneNumber) {
        const normalized = request.customer.phoneNumber.replace(/[-.\s]/g, '');
        if (!/^01[0-9]{8,9}$/.test(normalized)) {
          throw new PortOneIdentityVerificationError(
            '잘못된 휴대폰 번호 형식입니다. 숫자만 입력해주세요.',
            'INVALID_PHONE_NUMBER',
            400
          );
        }
      }

      // Store verification record for tracking
      await this.storeVerificationRecord({
        identityVerificationId: request.identityVerificationId,
        userId: request.userId,
        phoneNumber: request.customer?.phoneNumber,
        customData: request.customData
      });

      return {
        identityVerificationId: request.identityVerificationId,
        storeId: request.storeId || this.storeId,
        channelKey: request.channelKey || this.channelKey
      };

    } catch (error) {
      logger.error('Failed to prepare identity verification', {
        identityVerificationId: request.identityVerificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof PortOneIdentityVerificationError) {
        throw error;
      }

      throw new PortOneIdentityVerificationError(
        '본인인증 준비 중 오류가 발생했습니다.',
        'VERIFICATION_PREPARATION_FAILED',
        500
      );
    }
  }

  /**
   * Verify identity verification result from PortOne
   * Called after frontend completes verification
   */
  async verifyIdentity(identityVerificationId: string, userId?: string): Promise<PortOneIdentityVerificationResult> {
    try {
      logger.info('Verifying identity verification', {
        identityVerificationId,
        userId
      });

      // Get verification record from database (may not exist if prepare wasn't called)
      let record = await this.getVerificationRecord(identityVerificationId);

      // If record doesn't exist, create one now (for SDK-only flow where prepare wasn't called)
      if (!record) {
        logger.info('No verification record found, creating one for SDK-only flow', {
          identityVerificationId
        });

        await this.storeVerificationRecord({
          identityVerificationId,
          userId
        });

        record = await this.getVerificationRecord(identityVerificationId);
      }

      // Call PortOne API to get verification result
      const verificationResponse = await fetch(
        `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
        {
          headers: {
            'Authorization': `PortOne ${config.payments.portone.v2.apiSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json();
        logger.error('PortOne API error', {
          identityVerificationId,
          status: verificationResponse.status,
          error: errorData
        });
        throw new PortOneIdentityVerificationError(
          '포트원 본인인증 조회에 실패했습니다.',
          'PORTONE_API_ERROR',
          verificationResponse.status
        );
      }

      const identityVerification = await verificationResponse.json();

      if (identityVerification.status !== 'VERIFIED') {
        logger.warn('Identity verification not verified', {
          identityVerificationId,
          status: identityVerification.status
        });

        await this.updateVerificationStatus(identityVerificationId, identityVerification.status);

        return {
          success: false,
          identityVerificationId,
          status: identityVerification.status,
          error: '본인인증이 완료되지 않았습니다.'
        };
      }

      // Extract verified customer data
      const verifiedCustomer = identityVerification.verifiedCustomer;

      if (!verifiedCustomer) {
        throw new PortOneIdentityVerificationError(
          '본인인증 정보를 가져올 수 없습니다.',
          'VERIFIED_CUSTOMER_NOT_FOUND',
          500
        );
      }

      // Update database with verified information
      await this.updateVerificationWithResult(identityVerificationId, {
        status: 'VERIFIED',
        ci: verifiedCustomer.ci,
        di: verifiedCustomer.di,
        name: verifiedCustomer.name,
        gender: verifiedCustomer.gender,
        birthDate: verifiedCustomer.birthDate,
        phoneNumber: verifiedCustomer.phoneNumber,
        operator: verifiedCustomer.operator,
        isForeigner: verifiedCustomer.isForeigner
      });

      // If userId exists (from record or passed in), update user phone verification
      const effectiveUserId = record?.user_id || userId;

      console.log('========================================');
      console.log('[DEBUG] Checking user phone verification update conditions');
      console.log('identityVerificationId:', identityVerificationId);
      console.log('recordUserId:', record?.user_id);
      console.log('passedUserId:', userId);
      console.log('effectiveUserId:', effectiveUserId);
      console.log('hasCI:', !!verifiedCustomer.ci);
      console.log('ci:', verifiedCustomer.ci);
      console.log('phoneNumber:', verifiedCustomer.phoneNumber);
      console.log('willUpdatePhone:', !!(effectiveUserId && verifiedCustomer.ci));
      console.log('========================================');


      if (effectiveUserId && verifiedCustomer.ci) {
        console.log('[DEBUG] Calling markUserPhoneAsVerified');
        console.log('userId:', effectiveUserId);
        console.log('phoneNumber:', verifiedCustomer.phoneNumber || 'undefined');
        console.log('hasCi:', !!verifiedCustomer.ci);
        console.log('hasDi:', !!verifiedCustomer.di);

        // ✅ Mark as verified if we have CI, even if phoneNumber is null
        // PortOne sometimes doesn't return phoneNumber in the response
        await this.markUserPhoneAsVerified(
          effectiveUserId,
          verifiedCustomer.phoneNumber || undefined, // Allow null/undefined
          verifiedCustomer.ci,
          verifiedCustomer.di
        );

        console.log('[DEBUG] markUserPhoneAsVerified completed for userId:', effectiveUserId);
      } else {
        console.log('[DEBUG] Skipping phone verification update - missing userId or CI');
        console.log('hasUserId:', !!effectiveUserId);
        console.log('hasCI:', !!verifiedCustomer.ci);
      }

      logger.info('Identity verification completed successfully', {
        identityVerificationId,
        userId: effectiveUserId,
        name: verifiedCustomer.name
      });

      return {
        success: true,
        identityVerificationId,
        status: 'VERIFIED',
        verifiedCustomer: {
          ci: verifiedCustomer.ci,
          di: verifiedCustomer.di,
          name: verifiedCustomer.name,
          gender: verifiedCustomer.gender,
          birthDate: verifiedCustomer.birthDate,
          phoneNumber: verifiedCustomer.phoneNumber,
          operator: verifiedCustomer.operator,
          isForeigner: verifiedCustomer.isForeigner
        }
      };

    } catch (error) {
      logger.error('Failed to verify identity', {
        identityVerificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof PortOneIdentityVerificationError) {
        throw error;
      }

      throw new PortOneIdentityVerificationError(
        '본인인증 검증 중 오류가 발생했습니다.',
        'VERIFICATION_FAILED',
        500
      );
    }
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(identityVerificationId: string): Promise<{
    exists: boolean;
    status: string;
    verifiedAt?: string;
  }> {
    try {
      const record = await this.getVerificationRecord(identityVerificationId);

      if (!record) {
        return {
          exists: false,
          status: 'NOT_FOUND'
        };
      }

      return {
        exists: true,
        status: record.status,
        verifiedAt: record.verified_at
      };

    } catch (error) {
      logger.error('Failed to get verification status', {
        identityVerificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        exists: false,
        status: 'ERROR'
      };
    }
  }

  /**
   * Store verification record in database
   */
  private async storeVerificationRecord(data: {
    identityVerificationId: string;
    userId?: string;
    phoneNumber?: string;
    customData?: string;
  }): Promise<void> {
    const record = {
      verification_id: data.identityVerificationId,
      store_id: this.storeId,
      channel_key: this.channelKey,
      user_id: data.userId || null,
      status: 'READY',
      custom_data: data.customData ? JSON.parse(data.customData) : null,
      pg_provider: 'danal',
      requested_at: new Date().toISOString(),
      metadata: {}
    };

    const { error } = await this.supabase
      .from('identity_verifications')
      .insert(record);

    if (error) {
      logger.error('Failed to store verification record', { error: error.message, identityVerificationId: data.identityVerificationId });
      throw new PortOneIdentityVerificationError(
        '본인인증 기록 저장에 실패했습니다.',
        'DATABASE_ERROR',
        500
      );
    }
  }

  /**
   * Get verification record by identityVerificationId
   */
  private async getVerificationRecord(identityVerificationId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('identity_verifications')
      .select('*')
      .eq('verification_id', identityVerificationId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Update verification status
   */
  private async updateVerificationStatus(identityVerificationId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('identity_verifications')
      .update({
        status: status,
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('verification_id', identityVerificationId);

    if (error) {
      logger.error('Failed to update verification status', {
        identityVerificationId,
        status,
        error: error.message
      });
    }
  }

  /**
   * Update verification record with PortOne result
   */
  private async updateVerificationWithResult(
    identityVerificationId: string,
    result: {
      status: string;
      ci: string;
      di?: string;
      name: string;
      gender?: string;
      birthDate: string;
      phoneNumber?: string;
      operator?: string;
      isForeigner: boolean;
    }
  ): Promise<void> {
    // Store verified customer info as JSONB
    const verifiedCustomer = {
      ci: result.ci,
      di: result.di || null,
      name: result.name,
      gender: result.gender || null,
      birthDate: result.birthDate,
      phoneNumber: result.phoneNumber?.replace(/[-.\s]/g, '') || null,
      operator: result.operator || null,
      isForeigner: result.isForeigner
    };

    const updateData = {
      status: result.status,
      verified_customer: verifiedCustomer,
      verified_at: new Date().toISOString(),
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('identity_verifications')
      .update(updateData)
      .eq('verification_id', identityVerificationId);

    if (error) {
      logger.error('Failed to update verification result', { error: error.message, identityVerificationId });
      throw new PortOneIdentityVerificationError(
        '본인인증 결과 업데이트에 실패했습니다.',
        'DATABASE_ERROR',
        500
      );
    }
  }

  /**
   * Mark user's phone as verified
   * ✅ CI-based verification - phoneNumber is optional (PortOne may not return it)
   */
  private async markUserPhoneAsVerified(
    userId: string,
    phoneNumber: string | undefined,
    ci: string,
    di?: string
  ): Promise<void> {
    console.log('========================================');
    console.log('[DEBUG] markUserPhoneAsVerified called');
    console.log('userId:', userId);
    console.log('phoneNumber:', phoneNumber || 'undefined');
    console.log('hasCi:', !!ci);
    console.log('hasDi:', !!di);
    console.log('ciLength:', ci?.length || 0);
    console.log('========================================');

    const normalizedPhone = phoneNumber ? phoneNumber.replace(/[-.\s]/g, '') : undefined;

    // Update users table - always set phone_verified to true if we have CI
    const updateData: any = {
      phone_verified: true,
      updated_at: new Date().toISOString()
    };

    // Only update phone_number if we have it from PortOne
    if (normalizedPhone) {
      updateData.phone_number = normalizedPhone;
    }

    console.log('[DEBUG] Updating users table');
    console.log('userId:', userId);
    console.log('updateData:', JSON.stringify(updateData, null, 2));
    console.log('willUpdatePhoneNumber:', !!normalizedPhone);

    const { data, error: userError } = await this.supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select();

    console.log('[DEBUG] Users table update result');
    console.log('userId:', userId);
    console.log('success:', !userError);
    console.log('error:', userError?.message || null);
    console.log('updatedRows:', data?.length || 0);
    console.log('data:', JSON.stringify(data, null, 2));

    if (userError) {
      console.error('[ERROR] Failed to mark user phone as verified');
      console.error('userId:', userId);
      console.error('phoneNumber:', normalizedPhone || 'not provided');
      console.error('error:', userError.message);
      console.error('errorDetails:', JSON.stringify(userError, null, 2));
    } else {
      console.log('[SUCCESS] User phone marked as verified');
      console.log('userId:', userId);
      console.log('phoneNumber:', normalizedPhone || 'not provided');
      console.log('hasPhoneNumber:', !!normalizedPhone);
      console.log('updatedData:', JSON.stringify(data, null, 2));
    }

    // Store verification data in user_verifications
    console.log('[DEBUG] Storing user verification data in user_verifications table');
    try {
      await this.supabase
        .from('user_verifications')
        .upsert({
          user_id: userId,
          verification_type: 'portone_identity',
          verification_data: {
            ci,
            di,
            phone_number: normalizedPhone || null
          },
          verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      console.log('[DEBUG] User verification data stored successfully');
    } catch (error) {
      console.warn('[WARN] Failed to store user verification data');
      console.warn('userId:', userId);
      console.warn('error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Build Danal bypass parameters
   */
  buildDanalBypass(params: DanalBypassParams): Record<string, any> {
    return {
      danal: {
        ...(params.IsCarrier && { IsCarrier: params.IsCarrier }),
        ...(params.AGELIMIT && { AGELIMIT: params.AGELIMIT }),
        ...(params.CPTITLE && { CPTITLE: params.CPTITLE })
      }
    };
  }

  /**
   * Cleanup expired verification records (older than 30 minutes in READY status)
   */
  async cleanupExpiredVerifications(): Promise<number> {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from('identity_verifications')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('status', 'READY')
        .lt('requested_at', thirtyMinutesAgo)
        .select('id');

      if (error) {
        logger.error('Failed to cleanup expired verifications', { error: error.message });
        return 0;
      }

      const count = data?.length || 0;
      logger.info('Cleaned up expired PortOne verifications', { count });
      return count;

    } catch (error) {
      logger.error('Error during verification cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }
}

// Export singleton instance
export const portoneIdentityVerificationService = new PortOneIdentityVerificationService();

// Export class for testing
export { PortOneIdentityVerificationService };
