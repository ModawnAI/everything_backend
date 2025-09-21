/**
 * User Profile Validation Schemas
 * 
 * Comprehensive validation schemas for user profile management operations
 */

import Joi from 'joi';
import { securitySafeStringSchema, passwordStrengthSchema } from './security.validators';

// Profile update validation schema
export const profileUpdateSchema = Joi.object({
  name: securitySafeStringSchema
    .min(1)
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.min': '이름은 최소 1자 이상이어야 합니다.',
      'string.max': '이름은 최대 100자까지 입력 가능합니다.',
      'string.empty': '이름을 입력해주세요.'
    }),

  nickname: securitySafeStringSchema
    .max(50)
    .trim()
    .optional()
    .messages({
      'string.max': '닉네임은 최대 50자까지 입력 가능합니다.'
    }),

  gender: Joi.string()
    .valid('male', 'female', 'other', 'prefer_not_to_say')
    .optional()
    .messages({
      'any.only': '유효한 성별을 선택해주세요.'
    }),

  birth_date: Joi.date()
    .max('now')
    .optional()
    .custom((value, helpers) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 14) {
        return helpers.error('any.invalid', { message: '만 14세 이상이어야 합니다.' });
      }
      
      if (age > 120) {
        return helpers.error('any.invalid', { message: '유효하지 않은 생년월일입니다.' });
      }
      
      return value;
    })
    .messages({
      'date.max': '생년월일은 현재 날짜보다 이전이어야 합니다.',
      'any.invalid': '유효하지 않은 생년월일입니다.'
    }),

  profile_image_url: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': '유효한 이미지 URL을 입력해주세요.'
    }),

  marketing_consent: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '마케팅 동의는 true 또는 false 값이어야 합니다.'
    })
}).min(1).messages({
  'object.min': '최소 하나의 필드를 업데이트해야 합니다.'
});

// Privacy settings update validation schema
export const privacySettingsUpdateSchema = Joi.object({
  push_notifications_enabled: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '푸시 알림 설정은 true 또는 false 값이어야 합니다.'
    }),

  reservation_notifications: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '예약 알림 설정은 true 또는 false 값이어야 합니다.'
    }),

  event_notifications: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '이벤트 알림 설정은 true 또는 false 값이어야 합니다.'
    }),

  marketing_notifications: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '마케팅 알림 설정은 true 또는 false 값이어야 합니다.'
    }),

  location_tracking_enabled: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '위치 추적 설정은 true 또는 false 값이어야 합니다.'
    }),

  language_preference: Joi.string()
    .valid('ko', 'en', 'ja', 'zh')
    .optional()
    .messages({
      'any.only': '지원되는 언어를 선택해주세요. (ko, en, ja, zh)'
    }),

  currency_preference: Joi.string()
    .valid('KRW', 'USD', 'JPY', 'CNY')
    .optional()
    .messages({
      'any.only': '지원되는 통화를 선택해주세요. (KRW, USD, JPY, CNY)'
    }),

  theme_preference: Joi.string()
    .valid('light', 'dark', 'auto')
    .optional()
    .messages({
      'any.only': '지원되는 테마를 선택해주세요. (light, dark, auto)'
    })
}).min(1).messages({
  'object.min': '최소 하나의 설정을 업데이트해야 합니다.'
});

// Account deletion validation schema
export const accountDeletionSchema = Joi.object({
  reason: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': '탈퇴 사유는 최대 500자까지 입력 가능합니다.'
    }),

  password: passwordStrengthSchema
    .optional()
    .messages({
      'string.empty': '비밀번호를 입력해주세요.'
    })
});

// Profile image upload validation schema
export const profileImageUploadSchema = Joi.object({
  file: Joi.object({
    fieldname: Joi.string().valid('image').required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string()
      .valid('image/jpeg', 'image/jpg', 'image/png', 'image/webp')
      .required()
      .messages({
        'any.only': 'JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.'
      }),
    size: Joi.number()
      .max(5 * 1024 * 1024) // 5MB
      .required()
      .messages({
        'number.max': '이미지 파일 크기는 5MB 이하여야 합니다.'
      }),
    buffer: Joi.binary().required()
  }).required()
    .messages({
      'any.required': '이미지 파일을 업로드해주세요.'
    })
});

// Terms acceptance validation schema
export const termsAcceptanceSchema = Joi.object({
  // No body required for terms acceptance
}).empty();

// Privacy acceptance validation schema
export const privacyAcceptanceSchema = Joi.object({
  // No body required for privacy acceptance
}).empty();

// Profile completion query validation schema
export const profileCompletionQuerySchema = Joi.object({
  // No query parameters required
}).empty();

// Settings query validation schema
export const settingsQuerySchema = Joi.object({
  // No query parameters required
}).empty();

// Profile query validation schema
export const profileQuerySchema = Joi.object({
  // No query parameters required
}).empty(); 