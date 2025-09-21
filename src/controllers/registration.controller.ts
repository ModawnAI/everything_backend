/**
 * Registration Flow Controller
 * 
 * Orchestrates the complete user registration flow:
 * Social Login → Profile Setup → Phone Verification → Referral Processing → Account Activation
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { socialAuthService } from '../services/social-auth.service';
import { userService, UserServiceError, UserRegistrationData } from '../services/user.service';
import { UserProfile } from '../types/social-auth.types';
import { smsVerificationService, SMSVerificationError } from '../services/sms-verification.service';
import { passService } from '../services/pass.service';
import { refreshTokenService } from '../services/refresh-token.service';
import { phoneValidationService } from '../services/phone-validation.service';

export interface RegistrationStep {
  step: 'social_login' | 'profile_setup' | 'phone_verification' | 'referral_processing' | 'terms_acceptance' | 'account_activation';
  completed: boolean;
  data?: any;
  nextStep?: string;
  error?: string;
}

export interface RegistrationSession {
  sessionId: string;
  userId?: string;
  socialProvider?: string;
  socialData?: any;
  profileData?: Partial<UserRegistrationData>;
  phoneVerificationId?: string;
  phoneVerified: boolean;
  referralValidated: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  steps: RegistrationStep[];
  currentStep: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLoginRequest {
  provider: 'kakao' | 'apple' | 'google';
  token: string;
  deviceInfo?: {
    userAgent?: string;
    timezone?: string;
    screenResolution?: string;
  };
}

export interface ProfileSetupRequest {
  sessionId: string;
  name: string;
  nickname?: string;
  birthDate: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phoneNumber: string;
  referredByCode?: string;
}

export interface PhoneVerificationRequest {
  sessionId: string;
  method: 'sms' | 'pass';
  phoneNumber: string;
}

export interface OTPVerificationRequest {
  sessionId: string;
  verificationId: string;
  otp: string;
}

export interface TermsAcceptanceRequest {
  sessionId: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingConsent: boolean;
}

/**
 * Registration Flow Controller
 */
export class RegistrationController {
  private supabase = getSupabaseClient();
  private registrationSessions = new Map<string, RegistrationSession>();

  /**
   * Step 1: Social Login
   */
  async socialLogin(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { provider, token, deviceInfo } = req.body as SocialLoginRequest;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Registration social login initiated', {
        provider,
        ipAddress,
        userAgent
      });

      // Authenticate with social provider
      const authResult = await socialAuthService.authenticateWithProvider(provider, token);
      
      if (!authResult.user || !authResult.supabaseUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'SOCIAL_AUTH_FAILED',
            message: '소셜 로그인에 실패했습니다.'
          }
        });
      }

      // Create registration session
      const sessionId = this.generateSessionId();
      const session: RegistrationSession = {
        sessionId,
        userId: authResult.user.id,
        socialProvider: provider,
        socialData: authResult.user,
        phoneVerified: false,
        referralValidated: false,
        termsAccepted: false,
        privacyAccepted: false,
        steps: [
          { step: 'social_login', completed: true, data: { provider, userId: authResult.user.id } }
        ],
        currentStep: 'profile_setup',
        expiresAt: new Date(Date.now() + (30 * 60 * 1000)), // 30 minutes
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store session
      this.registrationSessions.set(sessionId, session);

      // Generate device fingerprint for session tracking
      const deviceFingerprint = refreshTokenService.generateDeviceFingerprint(req.headers, deviceInfo);

      logger.info('Registration social login successful', {
        sessionId,
        userId: authResult.user.id,
        provider,
        nextStep: session.currentStep
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          userId: authResult.user.id,
          currentStep: session.currentStep,
          nextStep: 'profile_setup',
          userInfo: {
            id: authResult.user.id,
            email: authResult.user.email,
            name: authResult.supabaseUser.name,
            profileImage: authResult.supabaseUser.profile_image_url
          },
          expiresAt: session.expiresAt.toISOString()
        }
      });

    } catch (error) {
      logger.error('Registration social login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: req.body.provider
      });

      if (error instanceof Error && error.message.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.'
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SOCIAL_LOGIN_ERROR',
          message: '소셜 로그인 처리 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Step 2: Profile Setup
   */
  async setupProfile(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { sessionId, name, nickname, birthDate, gender, phoneNumber, referredByCode } = req.body as ProfileSetupRequest;

      // Get registration session
      const session = this.registrationSessions.get(sessionId);
      if (!session || session.currentStep !== 'profile_setup') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: '유효하지 않은 등록 세션입니다.'
          }
        });
      }

      // Check session expiration
      if (session.expiresAt <= new Date()) {
        this.registrationSessions.delete(sessionId);
        return res.status(400).json({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: '등록 세션이 만료되었습니다. 다시 시작해주세요.'
          }
        });
      }

      // Validate phone number
      const phoneValidation = phoneValidationService.validateKoreanPhoneNumber(phoneNumber);
      if (!phoneValidation.isValid || phoneValidation.type !== 'mobile') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PHONE_NUMBER',
            message: `잘못된 휴대폰 번호입니다: ${phoneValidation.errors.join(', ')}`
          }
        });
      }

      // Check if phone number is already registered
      const phoneCheck = await userService.isPhoneNumberRegistered(phoneNumber);
      if (phoneCheck.isRegistered) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'PHONE_NUMBER_EXISTS',
            message: '이미 등록된 휴대폰 번호입니다.'
          }
        });
      }

      // Validate referral code if provided
      let referralInfo = null;
      if (referredByCode) {
        referralInfo = await userService.validateReferralCode(referredByCode);
        if (!referralInfo.isValid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_REFERRAL_CODE',
              message: '유효하지 않은 추천 코드입니다.'
            }
          });
        }
      }

      // Update session with profile data
      session.profileData = {
        name,
        nickname,
        birthDate,
        gender,
        phoneNumber: phoneValidation.normalized,
        referredByCode,
        marketingConsent: false, // Will be set in terms acceptance
        termsAccepted: false,
        privacyAccepted: false
      };

      session.referralValidated = !referredByCode || referralInfo?.isValid || false;
      session.currentStep = 'phone_verification';
      session.updatedAt = new Date();

      // Add profile setup step
      session.steps.push({
        step: 'profile_setup',
        completed: true,
        data: {
          name,
          nickname,
          phoneNumber: phoneValidation.formatted,
          referralCode: referredByCode,
          referralValid: session.referralValidated
        }
      });

      logger.info('Registration profile setup completed', {
        sessionId,
        userId: session.userId,
        phoneNumber: phoneValidation.formatted,
        hasReferral: !!referredByCode,
        nextStep: session.currentStep
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          currentStep: session.currentStep,
          nextStep: 'phone_verification',
          profileData: {
            name,
            nickname,
            phoneNumber: phoneValidation.formatted,
            referralCode: referredByCode,
            referralValid: session.referralValidated
          },
          expiresAt: session.expiresAt.toISOString()
        }
      });

    } catch (error) {
      logger.error('Registration profile setup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.body.sessionId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_SETUP_ERROR',
          message: '프로필 설정 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Step 3: Phone Verification - Send SMS/PASS
   */
  async sendPhoneVerification(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { sessionId, method, phoneNumber } = req.body as PhoneVerificationRequest;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Get registration session
      const session = this.registrationSessions.get(sessionId);
      if (!session || session.currentStep !== 'phone_verification') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: '유효하지 않은 등록 세션입니다.'
          }
        });
      }

      // Verify phone number matches profile data
      if (session.profileData?.phoneNumber !== phoneValidationService.getNormalizedPhoneNumber(phoneNumber)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PHONE_NUMBER_MISMATCH',
            message: '프로필에 등록된 휴대폰 번호와 일치하지 않습니다.'
          }
        });
      }

      let verificationResult;

      if (method === 'sms') {
        // Send SMS verification
        verificationResult = await smsVerificationService.sendVerificationSMS({
          phoneNumber,
          userId: session.userId,
          purpose: 'registration',
          ipAddress,
          userAgent
        });

        session.phoneVerificationId = verificationResult.verificationId;
      } else if (method === 'pass') {
        // Send PASS verification
        const passResult = await passService.initiateVerification({
          phoneNumber,
          purpose: 'registration',
          returnUrl: `${req.protocol}://${req.get('host')}/api/registration/verify-pass-callback`,
          userId: session.userId
        });

        session.phoneVerificationId = passResult;
        verificationResult = {
          success: true,
          verificationId: passResult,
          expiresAt: new Date(Date.now() + (10 * 60 * 1000)), // 10 minutes for PASS
          attemptsRemaining: 1
        };
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_VERIFICATION_METHOD',
            message: '지원하지 않는 인증 방법입니다.'
          }
        });
      }

      session.updatedAt = new Date();

      logger.info('Phone verification sent', {
        sessionId,
        method,
        phoneNumber: phoneValidationService.getFormattedPhoneNumber(phoneNumber),
        verificationId: verificationResult.verificationId || session.phoneVerificationId
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          method,
          verificationId: verificationResult.verificationId || session.phoneVerificationId,
          expiresAt: verificationResult.expiresAt?.toISOString(),
          attemptsRemaining: verificationResult.attemptsRemaining,
          nextAttemptAt: verificationResult.nextAttemptAt?.toISOString()
        }
      });

    } catch (error) {
      logger.error('Phone verification send failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.body.sessionId,
        method: req.body.method
      });

      if (error instanceof SMSVerificationError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'PHONE_VERIFICATION_ERROR',
          message: '휴대폰 인증 요청 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Step 3: Phone Verification - Verify OTP
   */
  async verifyPhoneOTP(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { sessionId, verificationId, otp } = req.body as OTPVerificationRequest;

      // Get registration session
      const session = this.registrationSessions.get(sessionId);
      if (!session || session.currentStep !== 'phone_verification') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: '유효하지 않은 등록 세션입니다.'
          }
        });
      }

      if (session.phoneVerificationId !== verificationId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_VERIFICATION_ID',
            message: '유효하지 않은 인증 요청입니다.'
          }
        });
      }

      // Verify OTP
      const verificationResult = await smsVerificationService.verifyOTP({
        verificationId,
        otp,
        phoneNumber: session.profileData!.phoneNumber,
        userId: session.userId
      });

      if (verificationResult.verified) {
        // Phone verification successful
        session.phoneVerified = true;
        session.currentStep = 'terms_acceptance';
        session.updatedAt = new Date();

        // Add phone verification step
        session.steps.push({
          step: 'phone_verification',
          completed: true,
          data: {
            method: 'sms',
            phoneNumber: phoneValidationService.getFormattedPhoneNumber(session.profileData!.phoneNumber),
            verifiedAt: new Date().toISOString()
          }
        });

        logger.info('Phone verification successful', {
          sessionId,
          userId: session.userId,
          phoneNumber: phoneValidationService.getFormattedPhoneNumber(session.profileData!.phoneNumber),
          nextStep: session.currentStep
        });

        res.status(200).json({
          success: true,
          data: {
            sessionId,
            verified: true,
            currentStep: session.currentStep,
            nextStep: 'terms_acceptance',
            expiresAt: session.expiresAt.toISOString()
          }
        });
      } else {
        // Phone verification failed
        logger.warn('Phone verification failed', {
          sessionId,
          verificationId,
          attemptsRemaining: verificationResult.attemptsRemaining,
          error: verificationResult.error
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: verificationResult.error || '인증에 실패했습니다.'
          },
          data: {
            attemptsRemaining: verificationResult.attemptsRemaining
          }
        });
      }

    } catch (error) {
      logger.error('Phone OTP verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.body.sessionId
      });

      if (error instanceof SMSVerificationError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'OTP_VERIFICATION_ERROR',
          message: 'OTP 인증 처리 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Step 4: Terms Acceptance
   */
  async acceptTerms(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { sessionId, termsAccepted, privacyAccepted, marketingConsent } = req.body as TermsAcceptanceRequest;

      // Get registration session
      const session = this.registrationSessions.get(sessionId);
      if (!session || session.currentStep !== 'terms_acceptance') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: '유효하지 않은 등록 세션입니다.'
          }
        });
      }

      // Validate required terms
      if (!termsAccepted || !privacyAccepted) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TERMS_NOT_ACCEPTED',
            message: '이용약관과 개인정보처리방침에 동의해야 합니다.'
          }
        });
      }

      // Update session
      session.termsAccepted = termsAccepted;
      session.privacyAccepted = privacyAccepted;
      session.profileData!.marketingConsent = marketingConsent;
      session.profileData!.termsAccepted = termsAccepted;
      session.profileData!.privacyAccepted = privacyAccepted;
      session.currentStep = 'account_activation';
      session.updatedAt = new Date();

      // Add terms acceptance step
      session.steps.push({
        step: 'terms_acceptance',
        completed: true,
        data: {
          termsAccepted,
          privacyAccepted,
          marketingConsent,
          acceptedAt: new Date().toISOString()
        }
      });

      logger.info('Terms acceptance completed', {
        sessionId,
        userId: session.userId,
        termsAccepted,
        privacyAccepted,
        marketingConsent,
        nextStep: session.currentStep
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          currentStep: session.currentStep,
          nextStep: 'account_activation',
          termsAccepted,
          privacyAccepted,
          marketingConsent,
          expiresAt: session.expiresAt.toISOString()
        }
      });

    } catch (error) {
      logger.error('Terms acceptance failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.body.sessionId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'TERMS_ACCEPTANCE_ERROR',
          message: '약관 동의 처리 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Step 5: Account Activation (Final Step)
   */
  async activateAccount(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { sessionId } = req.body;

      // Get registration session
      const session = this.registrationSessions.get(sessionId);
      if (!session || session.currentStep !== 'account_activation') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: '유효하지 않은 등록 세션입니다.'
          }
        });
      }

      // Validate all requirements are met
      if (!session.phoneVerified || !session.termsAccepted || !session.privacyAccepted || !session.profileData) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INCOMPLETE_REGISTRATION',
            message: '등록 과정이 완료되지 않았습니다.'
          }
        });
      }

      // Validate complete profile data before registration
      if (!session.profileData || !session.profileData.name || !session.profileData.phoneNumber || !session.profileData.birthDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INCOMPLETE_PROFILE_DATA',
            message: '필수 프로필 정보가 누락되었습니다.'
          }
        });
      }

      // Register user with transaction handling
      let userProfile: UserProfile;
      let tokens: any;

      try {
        userProfile = await userService.registerUser(session.userId!, session.profileData as UserRegistrationData);
        logger.info('User registration completed successfully', { 
          userId: userProfile.id,
          sessionId 
        });

        // Generate authentication tokens
        const deviceFingerprint = refreshTokenService.generateDeviceFingerprint(req.headers);
        tokens = await refreshTokenService.generateTokenPair(
          userProfile.id,
          undefined,
          deviceFingerprint
        );
        logger.info('Authentication tokens generated successfully', { 
          userId: userProfile.id 
        });

      } catch (registrationError) {
        logger.error('User registration failed during account activation', {
          error: registrationError instanceof Error ? registrationError.message : 'Unknown error',
          userId: session.userId,
          sessionId
        });

        // Clean up the failed registration
        await this.cleanupFailedRegistration(sessionId, session.userId);

        // Return appropriate error based on the type
        if (registrationError instanceof Error) {
          const errorMessage = registrationError.message;
          
          if (errorMessage.includes('휴대폰 번호')) {
            return res.status(409).json({
              success: false,
              error: {
                code: 'PHONE_NUMBER_CONFLICT',
                message: errorMessage
              }
            });
          } else if (errorMessage.includes('이메일')) {
            return res.status(409).json({
              success: false,
              error: {
                code: 'EMAIL_CONFLICT',
                message: errorMessage
              }
            });
          } else if (errorMessage.includes('닉네임')) {
            return res.status(409).json({
              success: false,
              error: {
                code: 'NICKNAME_CONFLICT',
                message: errorMessage
              }
            });
          } else if (errorMessage.includes('추천')) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'REFERRAL_ERROR',
                message: errorMessage
              }
            });
          }
        }

        return res.status(500).json({
          success: false,
          error: {
            code: 'REGISTRATION_FAILED',
            message: '사용자 등록 중 오류가 발생했습니다. 다시 시도해주세요.'
          }
        });
      }

      // Add final step
      session.steps.push({
        step: 'account_activation',
        completed: true,
        data: {
          userId: userProfile.id,
          activatedAt: new Date().toISOString()
        }
      });

      // Clean up session
      this.registrationSessions.delete(sessionId);

      logger.info('Registration completed successfully', {
        sessionId,
        userId: userProfile.id,
        phoneNumber: phoneValidationService.getFormattedPhoneNumber(session.profileData.phoneNumber),
        hasReferral: !!session.profileData.referredByCode,
        marketingConsent: session.profileData.marketingConsent
      });

      res.status(201).json({
        success: true,
        message: '회원가입이 완료되었습니다.',
        data: {
          user: {
            id: userProfile.id,
            email: userProfile.email,
            name: userProfile.name,
            phoneNumber: phoneValidationService.getFormattedPhoneNumber(session.profileData.phoneNumber),
            profileImage: userProfile.profile_image_url
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn
          },
          registrationSteps: session.steps
        }
      });

    } catch (error) {
      logger.error('Account activation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.body.sessionId
      });

      if (error instanceof UserServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'ACCOUNT_ACTIVATION_ERROR',
          message: '계정 활성화 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get registration session status
   */
  async getSessionStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { sessionId } = req.params;

      const session = this.registrationSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: '등록 세션을 찾을 수 없습니다.'
          }
        });
      }

      // Check expiration
      if (session.expiresAt <= new Date()) {
        this.registrationSessions.delete(sessionId);
        return res.status(400).json({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: '등록 세션이 만료되었습니다.'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          currentStep: session.currentStep,
          steps: session.steps,
          phoneVerified: session.phoneVerified,
          termsAccepted: session.termsAccepted,
          privacyAccepted: session.privacyAccepted,
          expiresAt: session.expiresAt.toISOString(),
          progress: {
            totalSteps: 5,
            completedSteps: session.steps.filter(s => s.completed).length
          }
        }
      });

    } catch (error) {
      logger.error('Get session status failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.params.sessionId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_STATUS_ERROR',
          message: '세션 상태 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up expired sessions (maintenance task)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.registrationSessions.entries()) {
      if (session.expiresAt <= now) {
        this.registrationSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired registration sessions', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Clean up failed registration session and associated data
   */
  async cleanupFailedRegistration(sessionId: string, userId?: string): Promise<void> {
    try {
      logger.info('Cleaning up failed registration', { sessionId, userId });

      // Remove session from memory
      this.registrationSessions.delete(sessionId);

      // If we have a userId, clean up any partial data
      if (userId) {
        try {
          // Clean up phone verifications
          await this.supabase
            .from('phone_verifications')
            .delete()
            .eq('user_id', userId);

          // Clean up refresh tokens
          await this.supabase
            .from('refresh_tokens')
            .delete()
            .eq('user_id', userId);

          logger.info('Failed registration cleanup completed', { sessionId, userId });
        } catch (cleanupError) {
          logger.warn('Some cleanup operations failed', {
            sessionId,
            userId,
            error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup failed registration', {
        sessionId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const registrationController = new RegistrationController();
export default registrationController;
