/**
 * PASS Service
 * 
 * Handles PASS 인증서 (PASS certification) integration for secure 
 * phone verification in Korean mobile authentication
 */

import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  PassVerificationRequest,
  PassVerificationResult,
  PassServiceConfig,
  PassVerificationError,
  PhoneVerificationRecord,
  VerificationExpiredError
} from '../types/phone-verification.types';

/**
 * PASS Service Configuration
 */
const passConfig: PassServiceConfig = {
  apiUrl: process.env.PASS_API_URL || 'https://api.pass.go.kr',
  clientId: process.env.PASS_CLIENT_ID || '',
  clientSecret: process.env.PASS_CLIENT_SECRET || '',
  environment: (process.env.PASS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  timeoutMs: parseInt(process.env.PASS_TIMEOUT_MS || '30000')
};

/**
 * PASS API request interface
 */
interface PassApiRequest {
  client_id: string;
  tx_id: string;
  phone_number: string;
  purpose: string;
  return_url: string;
  timestamp: number;
  signature: string;
}

/**
 * PASS API response interface
 */
interface PassApiResponse {
  success: boolean;
  tx_id: string;
  redirect_url?: string;
  error_code?: string;
  error_message?: string;
}

/**
 * PASS Service Implementation
 */
class PassServiceImpl {
  private supabase = getSupabaseClient();

  /**
   * Initialize PASS verification request
   */
  async initiateVerification(request: PassVerificationRequest): Promise<string> {
    try {
      logger.info('Initiating PASS verification', {
        phoneNumber: request.phoneNumber,
        purpose: request.purpose,
        userId: request.userId
      });

      // Validate configuration
      this.validateConfiguration();

      // Generate unique transaction ID
      const txId = this.generateTransactionId();

      // Normalize phone number
      const normalizedPhone = request.phoneNumber.replace(/[-.\s]/g, '');

      // Prepare API request payload
      const timestamp = Date.now();
      const apiPayload = {
        client_id: passConfig.clientId,
        tx_id: txId,
        phone_number: normalizedPhone,
        purpose: request.purpose,
        return_url: request.returnUrl,
        timestamp
      };

      // Generate signature
      const signature = this.generateSignature(apiPayload);
      const requestPayload: PassApiRequest = {
        ...apiPayload,
        signature
      };

      // Make API call to PASS
      const response: AxiosResponse<PassApiResponse> = await axios.post(
        `${passConfig.apiUrl}/v1/auth/initiate`,
        requestPayload,
        {
          timeout: passConfig.timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'EverythingBackend/1.0.0'
          }
        }
      );

      if (!response.data.success || !response.data.redirect_url) {
        throw new PassVerificationError(
          '인증 요청 초기화에 실패했습니다.',
          `API Error: ${response.data.error_code} - ${response.data.error_message}`
        );
      }

      // Store verification record in database
      await this.storeVerificationRecord(txId, request, response.data.redirect_url);

      logger.info('PASS verification initiated successfully', {
        txId,
        phoneNumber: request.phoneNumber,
        redirectUrl: response.data.redirect_url
      });

      return response.data.redirect_url;

    } catch (error) {
      logger.error('Failed to initiate PASS verification', {
        phoneNumber: request.phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof PassVerificationError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          throw new PassVerificationError(
            '잘못된 요청입니다. 휴대폰 번호를 확인해주세요.',
            error.response?.data?.message
          );
        }
        if (error.response?.status === 401) {
          throw new PassVerificationError(
            'PASS 서비스 인증에 실패했습니다.',
            'Invalid credentials'
          );
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new PassVerificationError(
            'PASS 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.',
            `Server error: ${error.response.status}`
          );
        }
      }

      throw new PassVerificationError(
        'PASS 인증 요청 중 오류가 발생했습니다.',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Verify PASS callback result
   */
  async verifyResult(txId: string, result: PassVerificationResult): Promise<boolean> {
    try {
      logger.info('Verifying PASS result', {
        txId,
        result: result.result,
        hasCI: !!result.ci,
        hasDI: !!result.di
      });

      // Get verification record
      const record = await this.getVerificationRecord(txId);
      if (!record) {
        throw new PassVerificationError(
          '인증 요청을 찾을 수 없습니다.',
          `Transaction ID: ${txId}`
        );
      }

      // Check if expired
      if (new Date() > new Date(record.expires_at)) {
        await this.updateVerificationStatus(txId, 'expired');
        throw new VerificationExpiredError('pass');
      }

      // Verify callback signature if implemented by PASS provider
      if (!this.verifyCallbackSignature(result)) {
        throw new PassVerificationError(
          '인증 결과 검증에 실패했습니다.',
          'Invalid callback signature'
        );
      }

      // Update verification record with result
      const isSuccess = result.result === 'success';
      await this.updateVerificationResult(txId, result, isSuccess);

      if (isSuccess && result.ci && result.di) {
        // Update user phone verification status
        if (record.user_id) {
          await this.markUserPhoneAsVerified(record.user_id, record.phone_number, result.ci, result.di);
        }

        logger.info('PASS verification completed successfully', {
          txId,
          userId: record.user_id,
          phoneNumber: record.phone_number
        });

        return true;
      } else {
        logger.warn('PASS verification failed', {
          txId,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage
        });

        return false;
      }

    } catch (error) {
      logger.error('Failed to verify PASS result', {
        txId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof PassVerificationError || error instanceof VerificationExpiredError) {
        throw error;
      }

      throw new PassVerificationError(
        'PASS 인증 결과 처리 중 오류가 발생했습니다.',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get verification record by transaction ID
   */
  async getVerificationRecord(txId: string): Promise<PhoneVerificationRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('phone_verifications')
        .select('*')
        .eq('pass_tx_id', txId)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get verification record', {
        txId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `pass_${timestamp}_${random}`;
  }

  /**
   * Generate HMAC signature for PASS API request
   */
  private generateSignature(payload: Omit<PassApiRequest, 'signature'>): string {
    // Sort keys for consistent signature generation
    const sortedKeys = Object.keys(payload).sort();
    const queryString = sortedKeys
      .map(key => `${key}=${(payload as any)[key]}`)
      .join('&');

    return crypto
      .createHmac('sha256', passConfig.clientSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Verify PASS callback signature
   */
  private verifyCallbackSignature(result: PassVerificationResult): boolean {
    // Note: Signature verification implementation depends on PASS provider specification
    // This is a placeholder implementation - update based on actual PASS documentation
    
    // For now, basic validation
    if (!result.txId || !result.result) {
      return false;
    }

    // In production, implement proper signature verification
    // based on PASS provider's callback signature methodology
    return true;
  }

  /**
   * Store verification record in database
   */
  private async storeVerificationRecord(
    txId: string,
    request: PassVerificationRequest,
    redirectUrl: string
  ): Promise<void> {
    const normalizedPhone = request.phoneNumber.replace(/[-.\s]/g, '');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const record = {
      id: crypto.randomUUID(),
      user_id: request.userId || null,
      phone_number: normalizedPhone,
      verification_method: 'pass' as const,
      status: 'pending' as const,
      pass_tx_id: txId,
      pass_redirect_url: redirectUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    };

    const { error } = await this.supabase
      .from('phone_verifications')
      .insert(record);

    if (error) {
      throw new PassVerificationError(
        '인증 기록 저장에 실패했습니다.',
        error.message
      );
    }
  }

  /**
   * Update verification status
   */
  private async updateVerificationStatus(txId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('phone_verifications')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('pass_tx_id', txId);

    if (error) {
      logger.error('Failed to update verification status', {
        txId,
        status,
        error: error.message
      });
    }
  }

  /**
   * Update verification result with PASS callback data
   */
  private async updateVerificationResult(
    txId: string,
    result: PassVerificationResult,
    isSuccess: boolean
  ): Promise<void> {
    const updateData = {
      status: isSuccess ? 'completed' : 'failed',
      pass_ci: result.ci || null,
      pass_di: result.di || null,
      verified_at: isSuccess ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('phone_verifications')
      .update(updateData)
      .eq('pass_tx_id', txId);

    if (error) {
      throw new PassVerificationError(
        '인증 결과 업데이트에 실패했습니다.',
        error.message
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
    di: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({
        phone_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .eq('phone_number', phoneNumber);

    if (error) {
      logger.error('Failed to mark user phone as verified', {
        userId,
        phoneNumber,
        error: error.message
      });
    }

    // Optionally store CI/DI for future reference
    try {
      await this.supabase
        .from('user_verifications')
        .upsert({
          user_id: userId,
          verification_type: 'phone_pass',
          verification_data: { ci, di, phone_number: phoneNumber },
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
   * Validate PASS service configuration
   */
  private validateConfiguration(): void {
    if (!passConfig.clientId || !passConfig.clientSecret) {
      throw new PassVerificationError(
        'PASS 서비스 설정이 올바르지 않습니다.',
        'Missing client credentials'
      );
    }

    if (!passConfig.apiUrl) {
      throw new PassVerificationError(
        'PASS API URL이 설정되지 않았습니다.',
        'Missing API URL'
      );
    }
  }

  /**
   * Cleanup expired verification records
   */
  async cleanupExpiredVerifications(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('phone_verifications')
        .update({ status: 'expired' })
        .eq('verification_method', 'pass')
        .lt('expires_at', new Date().toISOString())
        .eq('status', 'pending');

      if (error) {
        logger.error('Failed to cleanup expired PASS verifications', {
          error: error.message
        });
      }
    } catch (error) {
      logger.error('Error during PASS verification cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const passService = new PassServiceImpl();

// Export class for testing
export { PassServiceImpl }; 