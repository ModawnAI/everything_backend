/**
 * Social Authentication Controller
 * 
 * Handles social login endpoints for Kakao, Apple, and Google providers
 * with comprehensive error handling and logging
 */

import { Request, Response, NextFunction } from 'express';
import { socialAuthService } from '../services/social-auth.service';
import { userService, UserServiceError, UserRegistrationData } from '../services/user.service';
import { passService } from '../services/pass.service';
import { refreshTokenService } from '../services/refresh-token.service';
import { logger } from '../utils/logger';
import {
  SocialLoginRequest,
  SocialLoginResponse,
  SocialProvider,
  SocialAuthError,
  InvalidProviderTokenError,
  ProviderApiError,
  UserCreationError,
  AccountLinkingError,
  FcmTokenRegistration,
  SocialLoginAnalytics,
  SocialLoginAuditLog
} from '../types/social-auth.types';
import {
  PassVerificationRequest,
  PassVerificationResult,
  VerificationInitiationResponse,
  VerificationConfirmationResponse,
  PhoneVerificationError,
  PassVerificationError,
  VerificationExpiredError,
  VerificationLimitExceededError
} from '../types/phone-verification.types';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getSupabaseClient } from '../config/database';

/**
 * User registration request interface
 */
interface UserRegistrationRequest extends Request {
  body: UserRegistrationData;
}

/**
 * User registration response interface
 */
interface UserRegistrationResponse {
  success: boolean;
  data?: {
    user: any;
    profileComplete: boolean;
    referralCode: string;
    message: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

/**
 * Phone verification request interfaces
 */
interface PhoneVerificationInitiateRequest extends Request {
  body: {
    phoneNumber: string;
    method: 'sms' | 'pass';
    userId?: string;
  };
}

interface PhoneVerificationConfirmRequest extends Request {
  body: {
    txId: string;
    otpCode?: string;
    passResult?: PassVerificationResult;
    method: 'sms' | 'pass';
  };
}

interface PassCallbackRequest extends Request {
  body: PassVerificationResult & {
    timestamp?: number;
    signature?: string;
  };
}

/**
 * Social Authentication Controller Class
 */
export class SocialAuthController {
  private supabase = getSupabaseClient();

  /**
   * POST /api/auth/send-verification-code
   * Initiate phone verification (PASS or SMS)
   */
  public sendVerificationCode = async (req: PhoneVerificationInitiateRequest, res: Response<VerificationInitiationResponse>, next: NextFunction): Promise<void> => {
    const requestId = `verify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const { phoneNumber, method = 'pass', userId } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Phone verification initiation attempt', {
        phoneNumber,
        method,
        userId,
        requestId,
        ipAddress,
        userAgent
      });

      if (method === 'pass') {
        // PASS 인증서 verification
        const redirectUrl = await passService.initiateVerification({
          phoneNumber,
          purpose: 'phone_verification',
          returnUrl: `${process.env.APP_URL}/api/auth/pass/callback`,
          ...(userId && { userId })
        });

        const duration = Date.now() - startTime;
        logger.info('PASS verification initiated successfully', {
          phoneNumber,
          redirectUrl,
          duration,
          requestId
        });

        res.status(200).json({
          success: true,
          data: {
            method: 'pass',
            txId: requestId,
            redirectUrl,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            message: 'PASS 인증을 진행해주세요'
          }
        });

      } else if (method === 'sms') {
        // SMS OTP verification (placeholder implementation)
        // Note: Implement SMS service integration based on your preferred provider
        throw new PhoneVerificationError(
          'SMS 인증은 현재 지원되지 않습니다. PASS 인증을 이용해주세요.',
          'SMS_NOT_SUPPORTED',
          501,
          'sms'
        );

      } else {
        throw new PhoneVerificationError(
          '지원되지 않는 인증 방법입니다.',
          'UNSUPPORTED_METHOD',
          400
        );
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Phone verification initiation failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof PhoneVerificationError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '인증 요청 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * POST /api/auth/verify-phone
   * Confirm phone verification (PASS or SMS)
   */
  public verifyPhone = async (req: PhoneVerificationConfirmRequest, res: Response<VerificationConfirmationResponse>, next: NextFunction): Promise<void> => {
    const requestId = `confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const { txId, otpCode, passResult, method = 'pass' } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Phone verification confirmation attempt', {
        txId,
        method,
        hasOtpCode: !!otpCode,
        hasPassResult: !!passResult,
        requestId,
        ipAddress,
        userAgent
      });

      let isVerified = false;
      let verificationRecord;

      if (method === 'pass' && passResult) {
        // PASS verification
        isVerified = await passService.verifyResult(txId, passResult);
        verificationRecord = await passService.getVerificationRecord(txId);

      } else if (method === 'sms' && otpCode) {
        // SMS OTP verification (placeholder)
        throw new PhoneVerificationError(
          'SMS 인증은 현재 지원되지 않습니다.',
          'SMS_NOT_SUPPORTED',
          501,
          'sms'
        );

      } else {
        throw new PhoneVerificationError(
          '잘못된 인증 요청입니다.',
          'INVALID_VERIFICATION_REQUEST',
          400
        );
      }

      const duration = Date.now() - startTime;

      if (isVerified) {
        logger.info('Phone verification completed successfully', {
          txId,
          method,
          userId: verificationRecord?.user_id,
          phoneNumber: verificationRecord?.phone_number,
          duration,
          requestId
        });

        res.status(200).json({
          success: true,
          data: {
            verified: true,
            ...(verificationRecord?.user_id && { userId: verificationRecord.user_id }),
            phoneNumber: verificationRecord?.phone_number || '',
            method,
            message: '휴대폰 인증이 완료되었습니다.'
          }
        });

      } else {
        logger.warn('Phone verification failed', {
          txId,
          method,
          duration,
          requestId
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: '인증에 실패했습니다. 다시 시도해주세요.',
            timestamp: new Date().toISOString()
          }
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Phone verification confirmation failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof PhoneVerificationError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '인증 확인 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * POST /api/auth/pass/callback
   * Handle PASS verification callback
   */
  public handlePassCallback = async (req: PassCallbackRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = `callback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const { txId, result, ci, di, errorCode, errorMessage } = req.body;

      logger.info('PASS callback received', {
        txId,
        result,
        hasCI: !!ci,
        hasDI: !!di,
        errorCode,
        requestId
      });

      const passResult: PassVerificationResult = {
        txId,
        result,
        ...(ci && { ci }),
        ...(di && { di }),
        ...(errorCode && { errorCode }),
        ...(errorMessage && { errorMessage })
      };

      const isVerified = await passService.verifyResult(txId, passResult);

      const duration = Date.now() - startTime;

      if (isVerified) {
        logger.info('PASS callback processed successfully', {
          txId,
          duration,
          requestId
        });

        // For web interface, redirect to success page
        res.redirect(`${process.env.APP_URL}/auth/verify-success?txId=${txId}`);

      } else {
        logger.warn('PASS callback verification failed', {
          txId,
          errorCode,
          errorMessage,
          duration,
          requestId
        });

        // For web interface, redirect to error page
        res.redirect(`${process.env.APP_URL}/auth/verify-error?error=${errorCode || 'UNKNOWN_ERROR'}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('PASS callback handling failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // For web interface, redirect to error page
      res.redirect(`${process.env.APP_URL}/auth/verify-error?error=CALLBACK_ERROR`);
    }
  };

  /**
   * POST /api/auth/register
   * Complete user registration with profile information
   */
  public registerUser = async (req: UserRegistrationRequest, res: Response<UserRegistrationResponse>, next: NextFunction): Promise<void> => {
    const requestId = `register-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const registrationData: UserRegistrationData = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('User registration attempt', {
        phoneNumber: registrationData.phoneNumber,
        hasEmail: !!registrationData.email,
        hasReferralCode: !!registrationData.referredByCode,
        requestId,
        ipAddress,
        userAgent
      });

      // Create user in Supabase Auth first
      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email: registrationData.email || `${Date.now()}@temp.placeholder.com`,
        password: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        options: {
          data: {
            name: registrationData.name,
            phone: registrationData.phoneNumber
          }
        }
      });

      if (authError || !authData.user) {
        logger.error('Supabase Auth user creation failed', {
          error: authError?.message,
          requestId
        });

        throw new UserServiceError(
          '사용자 계정 생성에 실패했습니다.',
          'AUTH_USER_CREATION_FAILED',
          500
        );
      }

      // Register user in our database
      try {
        const user = await userService.registerUser(authData.user.id, registrationData);

        const duration = Date.now() - startTime;
        logger.info('User registration completed successfully', {
          userId: user.id,
          hasReferralCode: !!registrationData.referredByCode,
          duration,
          requestId
        });

        // Get user's referral code
        const { data: userWithReferral } = await this.supabase
          .from('users')
          .select('referral_code')
          .eq('id', user.id)
          .single();

        const response: UserRegistrationResponse = {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              phone: user.phone,
              user_role: user.user_role,
              user_status: user.user_status,
              created_at: user.created_at
            },
            profileComplete: true,
            referralCode: userWithReferral?.referral_code || '',
            message: '회원가입이 완료되었습니다.'
          }
        };

        res.status(201).json(response);

      } catch (error) {
        // If our database registration fails, clean up the Auth user
        if (authData.user?.id) {
          try {
            await this.supabase.auth.admin.deleteUser(authData.user.id);
          } catch (cleanupError) {
            logger.error('Failed to cleanup Auth user after registration failure', {
              userId: authData.user.id,
              error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
            });
          }
        }

        throw error;
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('User registration failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '회원가입 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * Handle social login for all providers
   */
  public socialLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = `social-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      const { provider, token, fcmToken, deviceInfo }: SocialLoginRequest = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Log audit event - login attempt
      await this.logSocialLoginAudit({
        provider,
        action: 'login_attempt',
        ip_address: ipAddress,
        user_agent: userAgent,
        success: false, // Will update if successful
        request_id: requestId
      });

      logger.info('Social login attempt', {
        provider,
        requestId,
        hasToken: !!token,
        hasFcmToken: !!fcmToken,
        deviceInfo,
        ipAddress,
        userAgent
      });

      // Validate provider
      if (!['kakao', 'apple', 'google'].includes(provider)) {
        throw new SocialAuthError('Invalid provider', 'INVALID_PROVIDER', 400);
      }

      // Validate token
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        throw new SocialAuthError('Token is required', 'MISSING_TOKEN', 400);
      }

      // Validate provider token and get user data
      let validationResult;
      try {
        switch (provider) {
          case 'kakao':
            validationResult = await socialAuthService.validateKakaoToken(token);
            break;
          case 'apple':
            validationResult = await socialAuthService.validateAppleToken(token);
            break;
          case 'google':
            validationResult = await socialAuthService.validateGoogleToken(token);
            break;
          default:
            throw new SocialAuthError('Unsupported provider', 'UNSUPPORTED_PROVIDER', 400);
        }

        // Log audit event - token validation
        await this.logSocialLoginAudit({
          provider,
          action: 'token_validation',
          ip_address: ipAddress,
          user_agent: userAgent,
          success: true,
          provider_user_id: validationResult.providerUserId,
          request_id: requestId
        });

      } catch (error) {
        logger.error('Token validation failed', {
          provider,
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (error instanceof InvalidProviderTokenError || error instanceof ProviderApiError) {
          throw error;
        }

        throw new SocialAuthError(
          'Token validation failed',
          'TOKEN_VALIDATION_FAILED',
          401,
          provider
        );
      }

      // Check if user exists or create new user
      let user;
      let isNewUser = false;

      try {
        // First try to find existing user by provider ID
        user = await socialAuthService.getUserByProviderId(provider, validationResult.providerUserId);

        if (!user) {
          // Create new user
          user = await socialAuthService.createOrUpdateUser(provider, validationResult);
          isNewUser = true;

          // Log audit event - user creation
          await this.logSocialLoginAudit({
            user_id: user.id,
            provider,
            action: 'user_creation',
            ip_address: ipAddress,
            user_agent: userAgent,
            success: true,
            provider_user_id: validationResult.providerUserId,
            request_id: requestId
          });

          logger.info('New user created via social login', {
            provider,
            userId: user.id,
            userEmail: user.email,
            requestId
          });
        } else {
          logger.info('Existing user found for social login', {
            provider,
            userId: user.id,
            userStatus: user.user_status,
            requestId
          });
        }

      } catch (error) {
        logger.error('Failed to create or retrieve user', {
          provider,
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (error instanceof UserCreationError || error instanceof AccountLinkingError) {
          throw error;
        }

        throw new SocialAuthError(
          'Failed to process user account',
          'USER_PROCESSING_ERROR',
          500,
          provider
        );
      }

      // Check user status
      if (user.user_status !== 'active') {
        logger.warn('Social login attempted with inactive user', {
          provider,
          userId: user.id,
          userStatus: user.user_status,
          requestId
        });

        throw new SocialAuthError(
          `Account is ${user.user_status}`,
          'ACCOUNT_INACTIVE',
          403,
          provider
        );
      }

      // Generate JWT tokens
      let accessToken: string;
      let refreshToken: string;
      let expiresIn: number;

      try {
        // Create refresh token with device info
        const deviceDetails = {
          ...(deviceInfo?.deviceId && { deviceId: deviceInfo.deviceId }),
          ...(userAgent && { userAgent }),
          ...(ipAddress && { ipAddress })
        };

        const tokenPair = await refreshTokenService.createTokenPair({
          userId: user.id,
          ...deviceDetails
        });

        accessToken = tokenPair.accessToken;
        refreshToken = tokenPair.refreshToken;
        expiresIn = tokenPair.expiresIn;

      } catch (error) {
        logger.error('Failed to generate tokens', {
          provider,
          userId: user.id,
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        throw new SocialAuthError(
          'Failed to generate authentication tokens',
          'TOKEN_GENERATION_ERROR',
          500,
          provider
        );
      }

      // Register FCM token if provided
      if (fcmToken && fcmToken.trim().length > 0) {
        try {
          await this.registerFcmToken({
            userId: user.id,
            token: fcmToken,
            deviceId: deviceInfo?.deviceId,
            platform: deviceInfo?.platform,
            appVersion: deviceInfo?.appVersion,
            osVersion: deviceInfo?.osVersion
          });

          logger.info('FCM token registered for social login', {
            provider,
            userId: user.id,
            requestId
          });
        } catch (error) {
          // Don't fail the login if FCM registration fails
          logger.warn('Failed to register FCM token', {
            provider,
            userId: user.id,
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Check profile completion status
      const profileComplete = !!(
        user.name &&
        user.email &&
        user.phone &&
        user.birth_date
      );

      // Log successful login
      await this.logSocialLoginAudit({
        user_id: user.id,
        provider,
        action: 'login_success',
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
        provider_user_id: validationResult.providerUserId,
        request_id: requestId
      });

      // Log analytics
      await this.logSocialLoginAnalytics({
        provider,
        isNewUser,
        platform: deviceInfo?.platform,
        success: true,
        userId: user.id,
        deviceInfo
      });

      const duration = Date.now() - startTime;
      logger.info('Social login completed successfully', {
        provider,
        userId: user.id,
        isNewUser,
        profileComplete,
        duration,
        requestId
      });

      // Prepare response
      const response: SocialLoginResponse = {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            user_role: user.user_role,
            user_status: user.user_status,
            profile_image_url: user.profile_image_url,
            phone: user.phone,
            birth_date: user.birth_date,
            created_at: user.created_at,
            updated_at: user.updated_at
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn
          },
          isNewUser,
          profileComplete
        },
        message: isNewUser ? 'Account created successfully' : 'Login successful'
      };

      res.status(200).json(response);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Social login failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Log failed analytics
      if (req.body?.provider) {
        await this.logSocialLoginAnalytics({
          provider: req.body.provider,
          isNewUser: false,
          platform: req.body.deviceInfo?.platform,
          success: false,
          errorCode: error instanceof SocialAuthError ? error.code : 'UNKNOWN_ERROR',
          deviceInfo: req.body.deviceInfo
        });
      }

      // Handle specific error types
      if (error instanceof SocialAuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            provider: error.provider,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * Get provider configuration status
   */
  public getProviderStatus = async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const validation = socialAuthService.validateConfiguration();
      
      const response = {
        success: true,
        data: {
          configurationValid: validation.isValid,
          providers: {
            kakao: { 
              configured: !validation.errors.some(e => e.includes('KAKAO')),
              available: true
            },
            apple: { 
              configured: !validation.errors.some(e => e.includes('APPLE')),
              available: true
            },
            google: { 
              configured: !validation.errors.some(e => e.includes('GOOGLE')),
              available: true
            }
          },
          ...(validation.errors.length > 0 && { 
            configurationErrors: validation.errors 
          })
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Failed to get provider status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get provider status',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * Register FCM token for push notifications
   */
  private async registerFcmToken(registration: FcmTokenRegistration): Promise<void> {
    try {
      // Check if token already exists
      const { data: existingToken } = await this.supabase
        .from('push_tokens')
        .select('id, is_active')
        .eq('user_id', registration.userId)
        .eq('token', registration.token)
        .single();

      if (existingToken) {
        if (!existingToken.is_active) {
          // Reactivate existing token
          await this.supabase
            .from('push_tokens')
            .update({
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingToken.id);
        }
        return;
      }

      // Create new FCM token entry
      const tokenData = {
        user_id: registration.userId,
        token: registration.token,
        platform: registration.platform || 'unknown',
        device_id: registration.deviceId,
        app_version: registration.appVersion,
        os_version: registration.osVersion,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await this.supabase
        .from('push_tokens')
        .insert(tokenData);

    } catch (error) {
      logger.error('Failed to register FCM token', {
        userId: registration.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Log social login audit event
   */
  private async logSocialLoginAudit(logData: Omit<SocialLoginAuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEntry = {
        ...logData,
        timestamp: new Date().toISOString()
      };

      await this.supabase
        .from('audit_logs')
        .insert({
          user_id: auditEntry.user_id,
          action: `social_${auditEntry.action}`,
          resource: 'social_auth',
          resource_id: auditEntry.provider_user_id,
          details: {
            provider: auditEntry.provider,
            success: auditEntry.success,
            error_code: auditEntry.error_code,
            error_message: auditEntry.error_message,
            request_id: auditEntry.request_id,
            session_id: auditEntry.session_id
          },
          ip_address: auditEntry.ip_address,
          user_agent: auditEntry.user_agent,
          timestamp: auditEntry.timestamp
        });

    } catch (error) {
      // Don't fail the main operation if audit logging fails
      logger.warn('Failed to log social login audit event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        logData
      });
    }
  }

  /**
   * Log social login analytics
   */
  private async logSocialLoginAnalytics(analytics: SocialLoginAnalytics): Promise<void> {
    try {
      // Here you would typically send to an analytics service
      // For now, just log to our application logs
      logger.info('Social login analytics', {
        ...analytics,
        timestamp: new Date().toISOString()
      });

      // Optionally store in database for reporting
      // Implementation depends on your analytics requirements

    } catch (error) {
      logger.warn('Failed to log social login analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        analytics
      });
    }
  }
}

// Export singleton instance
export const socialAuthController = new SocialAuthController(); 