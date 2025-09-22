/**
 * SMS Verification Service
 * 
 * Handles SMS OTP verification with rate limiting for Korean mobile numbers
 * Complements the existing PASS service for phone verification
 */

import crypto from 'crypto';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { phoneValidationService } from './phone-validation.service';

export interface SMSVerificationRequest {
  phoneNumber: string;
  userId?: string;
  purpose: 'registration' | 'login' | 'password_reset' | 'profile_update';
  ipAddress?: string;
  userAgent?: string;
}

export interface SMSVerificationResult {
  success: boolean;
  verificationId: string;
  expiresAt: Date;
  attemptsRemaining: number;
  nextAttemptAt?: Date;
  error?: string;
}

export interface OTPVerificationRequest {
  verificationId: string;
  otp: string;
  phoneNumber: string;
  userId?: string;
}

export interface OTPVerificationResult {
  success: boolean;
  verified: boolean;
  attemptsRemaining: number;
  error?: string;
  userId?: string;
}

export interface SMSRateLimitInfo {
  phoneNumber: string;
  attemptsToday: number;
  attemptsThisHour: number;
  lastAttemptAt: Date;
  nextAllowedAt: Date;
  isBlocked: boolean;
}

export class SMSVerificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SMSVerificationError';
  }
}

/**
 * SMS Verification Service Implementation
 */
class SMSVerificationService {
  private supabase = getSupabaseClient();
  
  // Rate limiting configuration
  private readonly rateLimits = {
    maxAttemptsPerHour: 3,
    maxAttemptsPerDay: 10,
    otpExpiryMinutes: 5,
    maxOtpAttempts: 3,
    blockDurationHours: 24
  };

  /**
   * Send SMS verification code
   */
  async sendVerificationSMS(request: SMSVerificationRequest): Promise<SMSVerificationResult> {
    try {
      logger.info('SMS verification requested', {
        phoneNumber: request.phoneNumber,
        purpose: request.purpose,
        userId: request.userId
      });

      // Validate phone number format
      const phoneValidation = phoneValidationService.validateKoreanPhoneNumber(request.phoneNumber);
      if (!phoneValidation.isValid || phoneValidation.type !== 'mobile') {
        throw new SMSVerificationError(
          `잘못된 휴대폰 번호입니다: ${phoneValidation.errors.join(', ')}`,
          'INVALID_PHONE_NUMBER',
          400
        );
      }

      const normalizedPhone = phoneValidation.normalized;

      // Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(normalizedPhone);
      if (rateLimitCheck.isBlocked) {
        throw new SMSVerificationError(
          `SMS 발송 한도를 초과했습니다. ${rateLimitCheck.nextAllowedAt.toLocaleString('ko-KR')} 이후에 다시 시도해주세요.`,
          'RATE_LIMIT_EXCEEDED',
          429
        );
      }

      // Generate OTP
      const otp = this.generateOTP();
      const verificationId = this.generateVerificationId();
      const expiresAt = new Date(Date.now() + (this.rateLimits.otpExpiryMinutes * 60 * 1000));

      // Store verification record
      await this.storeVerificationRecord({
        id: verificationId,
        phone_number: normalizedPhone,
        otp_hash: this.hashOTP(otp),
        user_id: request.userId,
        purpose: request.purpose,
        expires_at: expiresAt.toISOString(),
        attempts_remaining: this.rateLimits.maxOtpAttempts,
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
        created_at: new Date().toISOString(),
        verified: false
      });

      // Update rate limiting counters
      await this.updateRateLimitCounters(normalizedPhone);

      // Send SMS (mock implementation - replace with actual SMS service)
      const smsResult = await this.sendSMS(normalizedPhone, otp, request.purpose);
      
      if (!smsResult.success) {
        // Clean up verification record if SMS failed
        await this.cleanupFailedVerification(verificationId);
        throw new SMSVerificationError(
          'SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
          'SMS_SEND_FAILED',
          500
        );
      }

      logger.info('SMS verification sent successfully', {
        verificationId,
        phoneNumber: normalizedPhone,
        purpose: request.purpose,
        expiresAt
      });

      return {
        success: true,
        verificationId,
        expiresAt,
        attemptsRemaining: rateLimitCheck.attemptsThisHour,
        nextAttemptAt: rateLimitCheck.attemptsThisHour >= this.rateLimits.maxAttemptsPerHour ? 
          rateLimitCheck.nextAllowedAt : undefined
      };

    } catch (error) {
      if (error instanceof SMSVerificationError) {
        throw error;
      }

      logger.error('SMS verification failed', {
        phoneNumber: request.phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SMSVerificationError(
        'SMS 인증 요청 처리 중 오류가 발생했습니다.',
        'SMS_VERIFICATION_FAILED',
        500
      );
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(request: OTPVerificationRequest): Promise<OTPVerificationResult> {
    try {
      logger.info('OTP verification requested', {
        verificationId: request.verificationId,
        phoneNumber: request.phoneNumber
      });

      // Validate phone number
      const phoneValidation = phoneValidationService.validateKoreanPhoneNumber(request.phoneNumber);
      if (!phoneValidation.isValid) {
        throw new SMSVerificationError(
          '잘못된 휴대폰 번호입니다.',
          'INVALID_PHONE_NUMBER',
          400
        );
      }

      const normalizedPhone = phoneValidation.normalized;

      // Get verification record
      const { data: verification, error } = await this.supabase
        .from('sms_verifications')
        .select('*')
        .eq('id', request.verificationId)
        .eq('phone_number', normalizedPhone)
        .eq('verified', false)
        .single();

      if (error || !verification) {
        throw new SMSVerificationError(
          '유효하지 않은 인증 요청입니다.',
          'INVALID_VERIFICATION_ID',
          400
        );
      }

      // Check expiration
      if (new Date(verification.expires_at) <= new Date()) {
        await this.markVerificationExpired(request.verificationId);
        throw new SMSVerificationError(
          '인증 시간이 만료되었습니다. 새로운 인증번호를 요청해주세요.',
          'VERIFICATION_EXPIRED',
          400
        );
      }

      // Check attempts remaining
      if (verification.attempts_remaining <= 0) {
        throw new SMSVerificationError(
          '인증 시도 횟수를 초과했습니다. 새로운 인증번호를 요청해주세요.',
          'MAX_ATTEMPTS_EXCEEDED',
          400
        );
      }

      // Verify OTP
      const otpHash = this.hashOTP(request.otp);
      const isValid = otpHash === verification.otp_hash;

      if (isValid) {
        // Mark as verified
        await this.markVerificationSuccess(request.verificationId, request.userId);
        
        logger.info('OTP verification successful', {
          verificationId: request.verificationId,
          phoneNumber: normalizedPhone,
          userId: request.userId
        });

        return {
          success: true,
          verified: true,
          attemptsRemaining: verification.attempts_remaining - 1,
          userId: request.userId
        };
      } else {
        // Decrement attempts
        const newAttemptsRemaining = verification.attempts_remaining - 1;
        await this.decrementVerificationAttempts(request.verificationId, newAttemptsRemaining);

        logger.warn('OTP verification failed - invalid code', {
          verificationId: request.verificationId,
          phoneNumber: normalizedPhone,
          attemptsRemaining: newAttemptsRemaining
        });

        return {
          success: false,
          verified: false,
          attemptsRemaining: newAttemptsRemaining,
          error: newAttemptsRemaining > 0 ? 
            `잘못된 인증번호입니다. ${newAttemptsRemaining}번 더 시도할 수 있습니다.` :
            '인증 시도 횟수를 초과했습니다. 새로운 인증번호를 요청해주세요.'
        };
      }

    } catch (error) {
      if (error instanceof SMSVerificationError) {
        throw error;
      }

      logger.error('OTP verification failed', {
        verificationId: request.verificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SMSVerificationError(
        'OTP 인증 처리 중 오류가 발생했습니다.',
        'OTP_VERIFICATION_FAILED',
        500
      );
    }
  }

  /**
   * Check rate limiting for phone number
   */
  private async checkRateLimit(phoneNumber: string): Promise<SMSRateLimitInfo> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
      const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      // Get recent attempts
      const { data: recentAttempts, error } = await this.supabase
        .from('sms_verifications')
        .select('created_at')
        .eq('phone_number', phoneNumber)
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to check rate limit', { error: error.message, phoneNumber });
        // Allow request if we can't check rate limit
        return {
          phoneNumber,
          attemptsToday: 0,
          attemptsThisHour: 0,
          lastAttemptAt: new Date(0),
          nextAllowedAt: now,
          isBlocked: false
        };
      }

      const attempts = recentAttempts || [];
      const attemptsThisHour = attempts.filter(a => new Date(a.created_at) >= oneHourAgo).length;
      const attemptsToday = attempts.length;
      const lastAttemptAt = attempts.length > 0 ? new Date(attempts[0].created_at) : new Date(0);

      // Check if blocked
      const isBlocked = attemptsThisHour >= this.rateLimits.maxAttemptsPerHour || 
                       attemptsToday >= this.rateLimits.maxAttemptsPerDay;

      // Calculate next allowed time
      let nextAllowedAt = now;
      if (attemptsThisHour >= this.rateLimits.maxAttemptsPerHour) {
        nextAllowedAt = new Date(oneHourAgo.getTime() + (60 * 60 * 1000));
      }

      return {
        phoneNumber,
        attemptsToday,
        attemptsThisHour,
        lastAttemptAt,
        nextAllowedAt,
        isBlocked
      };

    } catch (error) {
      logger.error('Rate limit check failed', {
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Allow request if rate limit check fails
      return {
        phoneNumber,
        attemptsToday: 0,
        attemptsThisHour: 0,
        lastAttemptAt: new Date(0),
        nextAllowedAt: new Date(),
        isBlocked: false
      };
    }
  }

  /**
   * Generate 6-digit OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate unique verification ID
   */
  private generateVerificationId(): string {
    return `sms_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Hash OTP for secure storage
   */
  private hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp + process.env.OTP_SALT || 'default_salt').digest('hex');
  }

  /**
   * Store verification record in database
   */
  private async storeVerificationRecord(record: any): Promise<void> {
    const { error } = await this.supabase
      .from('sms_verifications')
      .insert(record);

    if (error) {
      logger.error('Failed to store verification record', { error: error.message });
      throw new SMSVerificationError(
        'Failed to store verification record',
        'DATABASE_ERROR',
        500
      );
    }
  }

  /**
   * Update rate limiting counters
   */
  private async updateRateLimitCounters(phoneNumber: string): Promise<void> {
    try {
      // This is handled by storing the verification record
      // The rate limit check queries the sms_verifications table
      logger.debug('Rate limit counters updated', { phoneNumber });
    } catch (error) {
      logger.error('Failed to update rate limit counters', {
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send SMS (mock implementation)
   */
  private async sendSMS(phoneNumber: string, otp: string, purpose: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Mock SMS sending - replace with actual SMS service integration
      // For Korean carriers: KT, SK Telecom, LG U+
      
      logger.info('Sending SMS', { phoneNumber, purpose });

      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock success (in production, integrate with actual SMS service)
      const message = this.generateSMSMessage(otp, purpose);
      
      logger.info('SMS sent successfully (mock)', {
        phoneNumber,
        message: message.substring(0, 50) + '...',
        purpose
      });

      return { success: true };

    } catch (error) {
      logger.error('SMS sending failed', {
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate SMS message based on purpose
   */
  private generateSMSMessage(otp: string, purpose: string): string {
    const messages = {
      registration: `[에뷰리띵] 회원가입 인증번호는 ${otp}입니다. 5분 내에 입력해주세요.`,
      login: `[에뷰리띵] 로그인 인증번호는 ${otp}입니다. 5분 내에 입력해주세요.`,
      password_reset: `[에뷰리띵] 비밀번호 재설정 인증번호는 ${otp}입니다. 5분 내에 입력해주세요.`,
      profile_update: `[에뷰리띵] 프로필 변경 인증번호는 ${otp}입니다. 5분 내에 입력해주세요.`
    };

    return messages[purpose as keyof typeof messages] || messages.registration;
  }

  /**
   * Clean up failed verification
   */
  private async cleanupFailedVerification(verificationId: string): Promise<void> {
    try {
      await this.supabase
        .from('sms_verifications')
        .delete()
        .eq('id', verificationId);
    } catch (error) {
      logger.error('Failed to cleanup failed verification', {
        verificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mark verification as expired
   */
  private async markVerificationExpired(verificationId: string): Promise<void> {
    try {
      await this.supabase
        .from('sms_verifications')
        .update({
          verified: false,
          attempts_remaining: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', verificationId);
    } catch (error) {
      logger.error('Failed to mark verification as expired', {
        verificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mark verification as successful
   */
  private async markVerificationSuccess(verificationId: string, userId?: string): Promise<void> {
    try {
      await this.supabase
        .from('sms_verifications')
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          user_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', verificationId);
    } catch (error) {
      logger.error('Failed to mark verification as successful', {
        verificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Decrement verification attempts
   */
  private async decrementVerificationAttempts(verificationId: string, attemptsRemaining: number): Promise<void> {
    try {
      await this.supabase
        .from('sms_verifications')
        .update({
          attempts_remaining: attemptsRemaining,
          updated_at: new Date().toISOString()
        })
        .eq('id', verificationId);
    } catch (error) {
      logger.error('Failed to decrement verification attempts', {
        verificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(verificationId: string): Promise<{
    exists: boolean;
    verified: boolean;
    expired: boolean;
    attemptsRemaining: number;
  }> {
    try {
      const { data: verification, error } = await this.supabase
        .from('sms_verifications')
        .select('verified, expires_at, attempts_remaining')
        .eq('id', verificationId)
        .single();

      if (error || !verification) {
        return {
          exists: false,
          verified: false,
          expired: false,
          attemptsRemaining: 0
        };
      }

      const expired = new Date(verification.expires_at) <= new Date();

      return {
        exists: true,
        verified: verification.verified,
        expired,
        attemptsRemaining: verification.attempts_remaining
      };

    } catch (error) {
      logger.error('Failed to get verification status', {
        verificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        exists: false,
        verified: false,
        expired: false,
        attemptsRemaining: 0
      };
    }
  }

  /**
   * Clean up expired verifications (maintenance task)
   */
  async cleanupExpiredVerifications(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('sms_verifications')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        logger.error('Failed to cleanup expired verifications', { error: error.message });
        return 0;
      }

      const cleanedCount = data?.length || 0;
      logger.info('Cleaned up expired SMS verifications', { count: cleanedCount });

      return cleanedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired verifications', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }
}

// Export singleton instance
export const smsVerificationService = new SMSVerificationService();
export default smsVerificationService;

