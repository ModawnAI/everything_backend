/**
 * User Settings Validation Schemas
 * 
 * Comprehensive validation schemas for user settings management
 */

import Joi from 'joi';
import { securitySafeStringSchema } from './security.validators';

// User settings update validation schema
export const userSettingsUpdateSchema = Joi.object({
  // Notification settings
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

  // Privacy settings
  location_tracking_enabled: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '위치 추적 설정은 true 또는 false 값이어야 합니다.'
    }),

  // Preference settings
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

// Bulk settings update validation schema
export const bulkSettingsUpdateSchema = Joi.object({
  settings: userSettingsUpdateSchema.required().messages({
    'any.required': '설정 데이터가 필요합니다.'
  })
});

// Settings reset validation schema
export const settingsResetSchema = Joi.object({
  confirm: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': '설정 초기화를 확인해주세요.',
      'any.required': '설정 초기화 확인이 필요합니다.'
    })
});

// Settings history query validation schema
export const settingsHistoryQuerySchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50)
    .optional()
    .messages({
      'number.base': '제한 수는 숫자여야 합니다.',
      'number.integer': '제한 수는 정수여야 합니다.',
      'number.min': '제한 수는 최소 1이어야 합니다.',
      'number.max': '제한 수는 최대 100까지 가능합니다.'
    }),

  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .optional()
    .messages({
      'number.base': '오프셋은 숫자여야 합니다.',
      'number.integer': '오프셋은 정수여야 합니다.',
      'number.min': '오프셋은 0 이상이어야 합니다.'
    })
});

// Settings category query validation schema
export const settingsCategoryQuerySchema = Joi.object({
  category: Joi.string()
    .valid('notifications', 'privacy', 'preferences', 'all')
    .default('all')
    .optional()
    .messages({
      'any.only': '지원되는 카테고리를 선택해주세요.'
    })
});

// Settings validation rule query schema
export const settingsValidationRuleQuerySchema = Joi.object({
  field: Joi.string()
    .optional()
    .messages({
      'string.base': '필드명은 문자열이어야 합니다.'
    })
});

// Settings search query validation schema
export const settingsSearchQuerySchema = Joi.object({
  q: securitySafeStringSchema
    .max(100)
    .optional()
    .messages({
      'string.max': '검색어는 최대 100자까지 입력 가능합니다.'
    }),

  category: Joi.string()
    .valid('notifications', 'privacy', 'preferences')
    .optional()
    .messages({
      'any.only': '지원되는 카테고리를 선택해주세요.'
    }),

  type: Joi.string()
    .valid('boolean', 'string', 'select', 'number')
    .optional()
    .messages({
      'any.only': '지원되는 타입을 선택해주세요.'
    })
});

// Settings export query validation schema
export const settingsExportQuerySchema = Joi.object({
  format: Joi.string()
    .valid('json', 'csv')
    .default('json')
    .optional()
    .messages({
      'any.only': '지원되는 형식을 선택해주세요. (json, csv)'
    }),

  include_history: Joi.boolean()
    .default(false)
    .optional()
    .messages({
      'boolean.base': '히스토리 포함 여부는 true 또는 false 값이어야 합니다.'
    })
});

// Settings import validation schema
export const settingsImportSchema = Joi.object({
  settings: userSettingsUpdateSchema.required().messages({
    'any.required': '설정 데이터가 필요합니다.'
  }),

  overwrite: Joi.boolean()
    .default(false)
    .optional()
    .messages({
      'boolean.base': '덮어쓰기 여부는 true 또는 false 값이어야 합니다.'
    }),

  backup: Joi.boolean()
    .default(true)
    .optional()
    .messages({
      'boolean.base': '백업 여부는 true 또는 false 값이어야 합니다.'
    })
});

// Settings validation helper functions
export const validateSettingsField = (field: string, value: any): { valid: boolean; message?: string } => {
  const schema = userSettingsUpdateSchema.extract(field);
  const { error } = schema.validate(value);
  
  if (error) {
    return {
      valid: false,
      message: error.details[0].message
    };
  }
  
  return { valid: true };
};

export const validateSettingsObject = (settings: any): { valid: boolean; errors: string[] } => {
  const { error } = userSettingsUpdateSchema.validate(settings);
  
  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message)
    };
  }
  
  return { valid: true, errors: [] };
};

// Settings default values helper
export const getDefaultSettings = (): Record<string, any> => {
  return {
    push_notifications_enabled: true,
    reservation_notifications: true,
    event_notifications: true,
    marketing_notifications: false,
    location_tracking_enabled: true,
    language_preference: 'ko',
    currency_preference: 'KRW',
    theme_preference: 'light'
  };
};

// Settings field metadata helper
export const getSettingsFieldMetadata = (field: string): {
  name: string;
  description: string;
  type: string;
  defaultValue: any;
  options?: Array<{ value: any; label: string }>;
} | null => {
  const fieldMetadata: Record<string, any> = {
    push_notifications_enabled: {
      name: '푸시 알림',
      description: '모든 푸시 알림을 받습니다',
      type: 'boolean',
      defaultValue: true
    },
    reservation_notifications: {
      name: '예약 알림',
      description: '예약 관련 알림을 받습니다',
      type: 'boolean',
      defaultValue: true
    },
    event_notifications: {
      name: '이벤트 알림',
      description: '이벤트 및 프로모션 알림을 받습니다',
      type: 'boolean',
      defaultValue: true
    },
    marketing_notifications: {
      name: '마케팅 알림',
      description: '마케팅 정보 및 광고 알림을 받습니다',
      type: 'boolean',
      defaultValue: false
    },
    location_tracking_enabled: {
      name: '위치 추적',
      description: '위치 기반 서비스를 사용합니다',
      type: 'boolean',
      defaultValue: true
    },
    language_preference: {
      name: '언어',
      description: '앱에서 사용할 언어를 선택하세요',
      type: 'select',
      defaultValue: 'ko',
      options: [
        { value: 'ko', label: '한국어' },
        { value: 'en', label: 'English' },
        { value: 'ja', label: '日본語' },
        { value: 'zh', label: '中文' }
      ]
    },
    currency_preference: {
      name: '통화',
      description: '가격 표시에 사용할 통화를 선택하세요',
      type: 'select',
      defaultValue: 'KRW',
      options: [
        { value: 'KRW', label: '원 (₩)' },
        { value: 'USD', label: 'Dollar ($)' },
        { value: 'JPY', label: 'Yen (¥)' },
        { value: 'CNY', label: 'Yuan (¥)' }
      ]
    },
    theme_preference: {
      name: '테마',
      description: '앱의 테마를 선택하세요',
      type: 'select',
      defaultValue: 'light',
      options: [
        { value: 'light', label: '라이트 모드' },
        { value: 'dark', label: '다크 모드' },
        { value: 'auto', label: '시스템 설정 따름' }
      ]
    }
  };

  return fieldMetadata[field] || null;
};
