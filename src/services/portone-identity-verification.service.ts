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
  async verifyIdentity(identityVerificationId: string): Promise<PortOneIdentityVerificationResult> {
    try {
      logger.info('Verifying identity verification', {
        identityVerificationId
      });

      // Get verification record from database
      const record = await this.getVerificationRecord(identityVerificationId);
      if (!record) {
        throw new PortOneIdentityVerificationError(
          '본인인증 요청을 찾을 수 없습니다.',
          'VERIFICATION_NOT_FOUND',
          404
        );
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

      // If userId exists, update user phone verification
      if (record.user_id && verifiedCustomer.phoneNumber) {
        await this.markUserPhoneAsVerified(
          record.user_id,
          verifiedCustomer.phoneNumber,
          verifiedCustomer.ci,
          verifiedCustomer.di
        );
      }

      logger.info('Identity verification completed successfully', {
        identityVerificationId,
        userId: record.user_id,
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
    const normalizedPhone = data.phoneNumber?.replace(/[-.\s]/g, '');

    const record = {
      id: crypto.randomUUID(),
      user_id: data.userId || null,
      phone_number: normalizedPhone || '',
      verification_method: 'portone' as const,
      status: 'pending' as const,
      portone_identity_verification_id: data.identityVerificationId,
      portone_provider: 'danal', // Default to Danal, can be updated
      metadata: data.customData ? JSON.parse(data.customData) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    };

    const { error } = await this.supabase
      .from('phone_verifications')
      .insert(record);

    if (error) {
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
      .from('phone_verifications')
      .select('*')
      .eq('portone_identity_verification_id', identityVerificationId)
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
      .from('phone_verifications')
      .update({
        status: status.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('portone_identity_verification_id', identityVerificationId);

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
    const updateData = {
      status: result.status.toLowerCase(),
      portone_ci: result.ci,
      portone_di: result.di || null,
      portone_verified_name: result.name,
      portone_birth_date: result.birthDate,
      portone_gender: result.gender || null,
      portone_carrier: result.operator || null,
      portone_nationality: result.isForeigner ? 'foreign' : 'domestic',
      phone_number: result.phoneNumber?.replace(/[-.\s]/g, '') || '',
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('phone_verifications')
      .update(updateData)
      .eq('portone_identity_verification_id', identityVerificationId);

    if (error) {
      throw new PortOneIdentityVerificationError(
        '본인인증 결과 업데이트에 실패했습니다.',
        'DATABASE_ERROR',
        500
      );
    }
  }

  /**
   * Mark user's phone as verified
   */
  private async markUserPhoneAsVerified(
    userId: string,
    phoneNumber: string,
    ci: string,
    di?: string
  ): Promise<void> {
    const normalizedPhone = phoneNumber.replace(/[-.\s]/g, '');

    // Update users table
    const { error: userError } = await this.supabase
      .from('users')
      .update({
        phone_verified: true,
        phone_number: normalizedPhone,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (userError) {
      logger.error('Failed to mark user phone as verified', {
        userId,
        phoneNumber: normalizedPhone,
        error: userError.message
      });
    }

    // Store verification data in user_verifications
    try {
      await this.supabase
        .from('user_verifications')
        .upsert({
          user_id: userId,
          verification_type: 'portone_identity',
          verification_data: { ci, di, phone_number: normalizedPhone },
          verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      logger.warn('Failed to store user verification data', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
   * Cleanup expired verification records
   */
  async cleanupExpiredVerifications(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('phone_verifications')
        .update({ status: 'expired' })
        .eq('verification_method', 'portone')
        .lt('expires_at', new Date().toISOString())
        .eq('status', 'pending')
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
