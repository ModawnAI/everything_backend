/**
 * Social Authentication Validators
 * 
 * Joi validation schemas for social login endpoints
 * with comprehensive validation rules
 */

import Joi from 'joi';
import { SocialProvider } from '../types/social-auth.types';
import { securitySafeStringSchema, passwordStrengthSchema } from './security.validators';

/**
 * Device info validation schema
 */
const deviceInfoSchema = Joi.object({
  deviceId: Joi.string().trim().max(255).optional(),
  platform: Joi.string().valid('ios', 'android', 'web').optional(),
  appVersion: Joi.string().trim().max(50).optional(),
  osVersion: Joi.string().trim().max(50).optional()
}).optional();

/**
 * Korean phone number validation
 * Supports formats: 010-1234-5678, 010.1234.5678, 01012345678
 */
const koreanPhoneNumberSchema = Joi.string()
  .pattern(/^010[-.]?[0-9]{4}[-.]?[0-9]{4}$/)
  .required()
  .messages({
    'string.pattern.base': '올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)',
    'any.required': '휴대폰 번호는 필수입니다.'
  });

/**
 * Birth date validation (YYYY-MM-DD format, age 14-100)
 */
const birthDateSchema = Joi.date()
  .max('now')
  .min(new Date(new Date().getFullYear() - 100, 0, 1))
  .required()
  .custom((value, helpers) => {
    const today = new Date();
    const birthDate = new Date(value);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 14) {
      return helpers.error('date.min.age');
    }
    
    return value;
  })
  .messages({
    'date.base': '올바른 생년월일 형식이 아닙니다.',
    'date.max': '생년월일은 오늘 이전이어야 합니다.',
    'date.min': '생년월일이 너무 오래되었습니다.',
    'date.min.age': '14세 이상만 가입할 수 있습니다.',
    'any.required': '생년월일은 필수입니다.'
  });

/**
 * Referral code validation (6-20 alphanumeric characters)
 */
const referralCodeSchema = Joi.string()
  .alphanum()
  .min(6)
  .max(20)
  .uppercase()
  .optional()
  .messages({
    'string.alphanum': '추천코드는 영문자와 숫자만 가능합니다.',
    'string.min': '추천코드는 최소 6자 이상이어야 합니다.',
    'string.max': '추천코드는 최대 20자까지 가능합니다.',
    'string.uppercase': '추천코드는 대문자여야 합니다.'
  });

/**
 * Phone verification initiation schema
 */
export const phoneVerificationInitiateSchema = Joi.object({
  phoneNumber: koreanPhoneNumberSchema,
  method: Joi.string()
    .valid('sms', 'pass')
    .default('pass')
    .messages({
      'any.only': '인증 방법은 sms 또는 pass 중 하나여야 합니다.'
    }),
  userId: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': '유효하지 않은 사용자 ID입니다.'
    })
});

/**
 * Phone verification confirmation schema
 */
export const phoneVerificationConfirmSchema = Joi.object({
  txId: Joi.string()
    .trim()
    .min(10)
    .max(100)
    .required()
    .messages({
      'any.required': '거래 ID는 필수입니다.',
      'string.min': '거래 ID가 너무 짧습니다.',
      'string.max': '거래 ID가 너무 깁니다.'
    }),

  // For SMS verification
  otpCode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .when('method', {
      is: 'sms',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.pattern.base': '인증 코드는 6자리 숫자여야 합니다.',
      'any.required': '인증 코드는 필수입니다.'
    }),

  // For PASS verification result
  passResult: Joi.object({
    result: Joi.string()
      .valid('success', 'failure')
      .required()
      .messages({
        'any.only': '인증 결과는 success 또는 failure여야 합니다.',
        'any.required': '인증 결과는 필수입니다.'
      }),
    ci: Joi.string().optional(),
    di: Joi.string().optional(),
    errorCode: Joi.string().optional(),
    errorMessage: Joi.string().optional()
  }).when('method', {
    is: 'pass',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),

  method: Joi.string()
    .valid('sms', 'pass')
    .default('pass')
    .messages({
      'any.only': '인증 방법은 sms 또는 pass 중 하나여야 합니다.'
    })
});

/**
 * PASS callback validation schema
 */
export const passCallbackSchema = Joi.object({
  txId: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': '거래 ID는 필수입니다.'
    }),

  result: Joi.string()
    .valid('success', 'failure')
    .required()
    .messages({
      'any.only': '인증 결과는 success 또는 failure여야 합니다.',
      'any.required': '인증 결과는 필수입니다.'
    }),

  ci: Joi.string().optional(),
  di: Joi.string().optional(),
  errorCode: Joi.string().optional(),
  errorMessage: Joi.string().optional(),

  // PASS signature validation fields
  timestamp: Joi.number().optional(),
  signature: Joi.string().optional()
});

/**
 * User registration validation schema
 */
export const userRegistrationSchema = Joi.object({
  name: securitySafeStringSchema
    .trim()
    .min(2)
    .max(50)
    .required()
    .pattern(/^[가-힣a-zA-Z\s]+$/)
    .messages({
      'string.min': '이름은 최소 2자 이상이어야 합니다.',
      'string.max': '이름은 최대 50자까지 가능합니다.',
      'string.pattern.base': '이름은 한글, 영문자, 공백만 가능합니다.',
      'any.required': '이름은 필수입니다.'
    }),

  email: Joi.string()
    .email()
    .max(255)
    .optional()
    .messages({
      'string.email': '올바른 이메일 형식이 아닙니다.',
      'string.max': '이메일은 최대 255자까지 가능합니다.'
    }),

  phoneNumber: koreanPhoneNumberSchema,

  birthDate: birthDateSchema,

  gender: Joi.string()
    .valid('male', 'female', 'other', 'prefer_not_to_say')
    .optional()
    .messages({
      'any.only': '성별은 male, female, other, prefer_not_to_say 중 하나여야 합니다.'
    }),

  nickname: Joi.string()
    .trim()
    .min(2)
    .max(20)
    .optional()
    .pattern(/^[가-힣a-zA-Z0-9_]+$/)
    .messages({
      'string.min': '닉네임은 최소 2자 이상이어야 합니다.',
      'string.max': '닉네임은 최대 20자까지 가능합니다.',
      'string.pattern.base': '닉네임은 한글, 영문자, 숫자, 언더스코어만 가능합니다.'
    }),

  referredByCode: referralCodeSchema,

  marketingConsent: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': '마케팅 동의는 true 또는 false여야 합니다.'
    }),

  termsAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': '이용약관 동의는 필수입니다.',
      'any.required': '이용약관 동의는 필수입니다.'
    }),

  privacyAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': '개인정보처리방침 동의는 필수입니다.',
      'any.required': '개인정보처리방침 동의는 필수입니다.'
    })
});

/**
 * Profile update validation schema (similar to registration but all optional except required fields)
 */
export const userProfileUpdateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .pattern(/^[가-힣a-zA-Z\s]+$/)
    .messages({
      'string.min': '이름은 최소 2자 이상이어야 합니다.',
      'string.max': '이름은 최대 50자까지 가능합니다.',
      'string.pattern.base': '이름은 한글, 영문자, 공백만 가능합니다.'
    }),

  email: Joi.string()
    .email()
    .max(255)
    .optional()
    .messages({
      'string.email': '올바른 이메일 형식이 아닙니다.',
      'string.max': '이메일은 최대 255자까지 가능합니다.'
    }),

  phoneNumber: Joi.string()
    .pattern(/^010[-.]?[0-9]{4}[-.]?[0-9]{4}$/)
    .optional()
    .messages({
      'string.pattern.base': '올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)'
    }),

  birthDate: Joi.date()
    .max('now')
    .min(new Date(new Date().getFullYear() - 100, 0, 1))
    .optional()
    .custom((value, helpers) => {
      const today = new Date();
      const birthDate = new Date(value);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 14) {
        return helpers.error('date.min.age');
      }
      
      return value;
    })
    .messages({
      'date.base': '올바른 생년월일 형식이 아닙니다.',
      'date.max': '생년월일은 오늘 이전이어야 합니다.',
      'date.min': '생년월일이 너무 오래되었습니다.',
      'date.min.age': '14세 이상만 가입할 수 있습니다.'
    }),

  gender: Joi.string()
    .valid('male', 'female', 'other', 'prefer_not_to_say')
    .optional()
    .messages({
      'any.only': '성별은 male, female, other, prefer_not_to_say 중 하나여야 합니다.'
    }),

  nickname: Joi.string()
    .trim()
    .min(2)
    .max(20)
    .optional()
    .pattern(/^[가-힣a-zA-Z0-9_]+$/)
    .messages({
      'string.min': '닉네임은 최소 2자 이상이어야 합니다.',
      'string.max': '닉네임은 최대 20자까지 가능합니다.',
      'string.pattern.base': '닉네임은 한글, 영문자, 숫자, 언더스코어만 가능합니다.'
    }),

  marketingConsent: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '마케팅 동의는 true 또는 false여야 합니다.'
    })
});

/**
 * Social login request validation schema
 */
export const socialLoginSchema = Joi.object({
  provider: Joi.string()
    .valid('kakao', 'apple', 'google', 'naver')
    .required()
    .messages({
      'any.required': 'Provider is required',
      'any.only': 'Provider must be one of: kakao, apple, google, naver'
    }),

  token: Joi.string()
    .trim()
    .min(10)
    .max(10000)
    .required()
    .messages({
      'any.required': 'Token is required',
      'string.empty': 'Token cannot be empty',
      'string.min': 'Token is too short',
      'string.max': 'Token is too long'
    }),

  fcmToken: Joi.string()
    .trim()
    .min(10)
    .max(1000)
    .optional()
    .messages({
      'string.min': 'FCM token is too short',
      'string.max': 'FCM token is too long'
    }),

  deviceInfo: deviceInfoSchema
});

/**
 * Provider-specific token validation
 */
export const providerTokenValidation = {
  /**
   * Kakao token validation
   */
  kakao: Joi.string()
    .trim()
    .min(20)
    .max(2000)
    .pattern(/^[A-Za-z0-9_-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Kakao token format',
      'string.min': 'Kakao token is too short',
      'string.max': 'Kakao token is too long'
    }),

  /**
   * Apple ID token validation (JWT format)
   */
  apple: Joi.string()
    .trim()
    .min(50)
    .max(5000)
    .pattern(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Apple ID token format (must be valid JWT)',
      'string.min': 'Apple ID token is too short',
      'string.max': 'Apple ID token is too long'
    }),

  /**
   * Google access token validation
   */
  google: Joi.string()
    .trim()
    .min(20)
    .max(2000)
    .pattern(/^[A-Za-z0-9_-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Google token format',
      'string.min': 'Google token is too short',
      'string.max': 'Google token is too long'
    }),

  /**
   * Naver access token validation
   */
  naver: Joi.string()
    .trim()
    .min(20)
    .max(2000)
    .pattern(/^[A-Za-z0-9._-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Naver token format',
      'string.min': 'Naver token is too short',
      'string.max': 'Naver token is too long'
    })
};

/**
 * FCM token registration validation schema
 */
export const fcmTokenRegistrationSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'User ID is required',
      'string.guid': 'Invalid user ID format'
    }),

  token: Joi.string()
    .trim()
    .min(10)
    .max(1000)
    .required()
    .messages({
      'any.required': 'FCM token is required',
      'string.min': 'FCM token is too short',
      'string.max': 'FCM token is too long'
    }),

  deviceId: Joi.string().trim().max(255).optional(),
  platform: Joi.string().valid('ios', 'android', 'web').optional(),
  appVersion: Joi.string().trim().max(50).optional(),
  osVersion: Joi.string().trim().max(50).optional()
});

/**
 * Provider query parameter validation
 */
export const providerQuerySchema = Joi.object({
  provider: Joi.string()
    .valid('kakao', 'apple', 'google', 'naver')
    .optional()
    .messages({
      'any.only': 'Provider must be one of: kakao, apple, google, naver'
    })
});

/**
 * Social login analytics validation schema
 */
export const socialLoginAnalyticsSchema = Joi.object({
  provider: Joi.string()
    .valid('kakao', 'apple', 'google', 'naver')
    .required(),

  isNewUser: Joi.boolean()
    .required(),

  platform: Joi.string()
    .valid('ios', 'android', 'web')
    .optional(),

  success: Joi.boolean()
    .required(),

  errorCode: Joi.string()
    .trim()
    .max(100)
    .optional(),

  timestamp: Joi.date()
    .required(),

  userId: Joi.string()
    .uuid()
    .optional(),

  deviceInfo: deviceInfoSchema
});

/**
 * Social login audit log validation schema
 */
export const socialLoginAuditSchema = Joi.object({
  user_id: Joi.string()
    .uuid()
    .optional(),

  provider: Joi.string()
    .valid('kakao', 'apple', 'google', 'naver')
    .required(),

  action: Joi.string()
    .valid('login_attempt', 'login_success', 'login_failure', 'token_validation', 'user_creation')
    .required(),

  ip_address: Joi.string()
    .ip({ version: ['ipv4', 'ipv6'] })
    .required()
    .messages({
      'string.ip': 'Invalid IP address format'
    }),

  user_agent: Joi.string()
    .trim()
    .max(1000)
    .required(),

  success: Joi.boolean()
    .required(),

  error_code: Joi.string()
    .trim()
    .max(100)
    .optional(),

  error_message: Joi.string()
    .trim()
    .max(500)
    .optional(),

  provider_user_id: Joi.string()
    .trim()
    .max(255)
    .optional(),

  timestamp: Joi.date()
    .required(),

  request_id: Joi.string()
    .trim()
    .max(100)
    .optional(),

  session_id: Joi.string()
    .trim()
    .max(255)
    .optional()
});

/**
 * Validate social login request with provider-specific token validation
 */
export function validateSocialLoginWithProvider(provider: SocialProvider, requestBody: any) {
  // First validate the general structure
  const { error: generalError, value: generalValue } = socialLoginSchema.validate(requestBody, {
    abortEarly: false,
    stripUnknown: true
  });

  if (generalError) {
    return { error: generalError, value: null };
  }

  // Then validate provider-specific token format
  const tokenValidation = providerTokenValidation[provider];
  const { error: tokenError } = tokenValidation.validate(generalValue.token);

  if (tokenError) {
    // Convert token validation error to match general error format
    const customError = new Joi.ValidationError(
      `Token validation failed: ${tokenError.message}`,
      [{
        message: tokenError.message,
        path: ['token'],
        type: `${provider}.token.invalid`,
        context: { value: generalValue.token }
      }],
      generalValue
    );
    return { error: customError, value: null };
  }

  return { error: null, value: generalValue };
}

/**
 * Common validation options
 */
export const validationOptions = {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false
};

/**
 * Custom validation error formatter
 */
export function formatValidationError(error: Joi.ValidationError) {
  const errors = error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message,
    value: detail.context?.value
  }));

  return {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: errors,
    timestamp: new Date().toISOString()
  };
}

/**
 * Rate limiting validation for social login
 */
export const socialLoginRateLimitSchema = Joi.object({
  provider: Joi.string()
    .valid('kakao', 'apple', 'google')
    .required(),

  maxAttempts: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10),

  windowMs: Joi.number()
    .integer()
    .min(60000) // 1 minute minimum
    .max(3600000) // 1 hour maximum
    .default(900000), // 15 minutes

  blockDuration: Joi.number()
    .integer()
    .min(60000) // 1 minute minimum
    .max(86400000) // 24 hours maximum
    .default(900000) // 15 minutes
});

/**
 * Environment configuration validation for social providers
 */
export const socialProviderConfigSchema = Joi.object({
  kakao: Joi.object({
    restApiKey: Joi.string()
      .trim()
      .min(10)
      .required()
      .messages({
        'any.required': 'Kakao REST API key is required',
        'string.min': 'Kakao REST API key is too short'
      }),

    adminKey: Joi.string()
      .trim()
      .min(10)
      .optional(),

    userInfoUrl: Joi.string()
      .uri()
      .required(),

    tokenInfoUrl: Joi.string()
      .uri()
      .required()
  }).required(),

  apple: Joi.object({
    clientId: Joi.string()
      .trim()
      .min(10)
      .required()
      .messages({
        'any.required': 'Apple client ID is required'
      }),

    teamId: Joi.string()
      .trim()
      .length(10)
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'any.required': 'Apple team ID is required',
        'string.length': 'Apple team ID must be exactly 10 characters',
        'string.pattern.base': 'Apple team ID must contain only uppercase letters and numbers'
      }),

    keyId: Joi.string()
      .trim()
      .length(10)
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'any.required': 'Apple key ID is required',
        'string.length': 'Apple key ID must be exactly 10 characters'
      }),

    privateKey: Joi.string()
      .trim()
      .min(100)
      .required()
      .messages({
        'any.required': 'Apple private key is required'
      }),

    publicKeyUrl: Joi.string()
      .uri()
      .required()
  }).required(),

  google: Joi.object({
    clientId: Joi.string()
      .trim()
      .min(10)
      .required()
      .messages({
        'any.required': 'Google client ID is required'
      }),

    clientSecret: Joi.string()
      .trim()
      .min(10)
      .required()
      .messages({
        'any.required': 'Google client secret is required'
      }),

    userInfoUrl: Joi.string()
      .uri()
      .required(),

    tokenInfoUrl: Joi.string()
      .uri()
      .required()
  }).required()
});

export default {
  userRegistrationSchema,
  userProfileUpdateSchema,
  socialLoginSchema,
  providerTokenValidation,
  fcmTokenRegistrationSchema,
  providerQuerySchema,
  socialLoginAnalyticsSchema,
  socialLoginAuditSchema,
  validateSocialLoginWithProvider,
  validationOptions,
  formatValidationError,
  socialLoginRateLimitSchema,
  socialProviderConfigSchema
}; 