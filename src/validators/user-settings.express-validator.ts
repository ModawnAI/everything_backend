/**
 * User Settings Express-Validator Rules
 * 
 * Express-validator rules for user settings management
 */

import { body, query, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Validation error handler middleware
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));

    logger.warn('Validation errors detected', {
      errors: formattedErrors,
      endpoint: req.path,
      method: req.method,
      userId: (req as any).user?.id
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력 데이터가 유효하지 않습니다.',
        details: formattedErrors,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  next();
};

// User settings update validation rules
export const validateUserSettingsUpdate = [
  body('push_notifications_enabled')
    .optional()
    .isBoolean()
    .withMessage('푸시 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('reservation_notifications')
    .optional()
    .isBoolean()
    .withMessage('예약 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('event_notifications')
    .optional()
    .isBoolean()
    .withMessage('이벤트 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('marketing_notifications')
    .optional()
    .isBoolean()
    .withMessage('마케팅 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('location_tracking_enabled')
    .optional()
    .isBoolean()
    .withMessage('위치 추적 설정은 true 또는 false 값이어야 합니다.'),

  body('language_preference')
    .optional()
    .isIn(['ko', 'en', 'ja', 'zh'])
    .withMessage('지원되는 언어를 선택해주세요. (ko, en, ja, zh)'),

  body('currency_preference')
    .optional()
    .isIn(['KRW', 'USD', 'JPY', 'CNY'])
    .withMessage('지원되는 통화를 선택해주세요. (KRW, USD, JPY, CNY)'),

  body('theme_preference')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('지원되는 테마를 선택해주세요. (light, dark, auto)'),

  // Ensure at least one field is provided
  body()
    .custom((value) => {
      const fields = Object.keys(value);
      if (fields.length === 0) {
        throw new Error('최소 하나의 설정을 업데이트해야 합니다.');
      }
      return true;
    }),

  handleValidationErrors
];

// Bulk settings update validation rules
export const validateBulkSettingsUpdate = [
  body('settings')
    .isObject()
    .withMessage('설정 데이터가 필요합니다.'),

  body('settings.push_notifications_enabled')
    .optional()
    .isBoolean()
    .withMessage('푸시 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.reservation_notifications')
    .optional()
    .isBoolean()
    .withMessage('예약 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.event_notifications')
    .optional()
    .isBoolean()
    .withMessage('이벤트 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.marketing_notifications')
    .optional()
    .isBoolean()
    .withMessage('마케팅 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.location_tracking_enabled')
    .optional()
    .isBoolean()
    .withMessage('위치 추적 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.language_preference')
    .optional()
    .isIn(['ko', 'en', 'ja', 'zh'])
    .withMessage('지원되는 언어를 선택해주세요. (ko, en, ja, zh)'),

  body('settings.currency_preference')
    .optional()
    .isIn(['KRW', 'USD', 'JPY', 'CNY'])
    .withMessage('지원되는 통화를 선택해주세요. (KRW, USD, JPY, CNY)'),

  body('settings.theme_preference')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('지원되는 테마를 선택해주세요. (light, dark, auto)'),

  handleValidationErrors
];

// Settings reset validation rules
export const validateSettingsReset = [
  body('confirm')
    .isBoolean()
    .custom((value) => {
      if (value !== true) {
        throw new Error('설정 초기화를 확인해주세요.');
      }
      return true;
    })
    .withMessage('설정 초기화 확인이 필요합니다.'),

  handleValidationErrors
];

// Settings history query validation rules
export const validateSettingsHistoryQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('제한 수는 1-100 사이의 정수여야 합니다.'),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('오프셋은 0 이상의 정수여야 합니다.'),

  handleValidationErrors
];

// Settings category query validation rules
export const validateSettingsCategoryQuery = [
  query('category')
    .optional()
    .isIn(['notifications', 'privacy', 'preferences', 'all'])
    .withMessage('지원되는 카테고리를 선택해주세요.'),

  handleValidationErrors
];

// Settings validation rule query validation rules
export const validateSettingsValidationRuleQuery = [
  query('field')
    .optional()
    .isString()
    .withMessage('필드명은 문자열이어야 합니다.'),

  handleValidationErrors
];

// Settings search query validation rules
export const validateSettingsSearchQuery = [
  query('q')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('검색어는 최대 100자까지 입력 가능합니다.'),

  query('category')
    .optional()
    .isIn(['notifications', 'privacy', 'preferences'])
    .withMessage('지원되는 카테고리를 선택해주세요.'),

  query('type')
    .optional()
    .isIn(['boolean', 'string', 'select', 'number'])
    .withMessage('지원되는 타입을 선택해주세요.'),

  handleValidationErrors
];

// Settings export query validation rules
export const validateSettingsExportQuery = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('지원되는 형식을 선택해주세요. (json, csv)'),

  query('include_history')
    .optional()
    .isBoolean()
    .withMessage('히스토리 포함 여부는 true 또는 false 값이어야 합니다.'),

  handleValidationErrors
];

// Settings import validation rules
export const validateSettingsImport = [
  body('settings')
    .isObject()
    .withMessage('설정 데이터가 필요합니다.'),

  body('overwrite')
    .optional()
    .isBoolean()
    .withMessage('덮어쓰기 여부는 true 또는 false 값이어야 합니다.'),

  body('backup')
    .optional()
    .isBoolean()
    .withMessage('백업 여부는 true 또는 false 값이어야 합니다.'),

  // Validate settings object structure
  body('settings.push_notifications_enabled')
    .optional()
    .isBoolean()
    .withMessage('푸시 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.reservation_notifications')
    .optional()
    .isBoolean()
    .withMessage('예약 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.event_notifications')
    .optional()
    .isBoolean()
    .withMessage('이벤트 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.marketing_notifications')
    .optional()
    .isBoolean()
    .withMessage('마케팅 알림 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.location_tracking_enabled')
    .optional()
    .isBoolean()
    .withMessage('위치 추적 설정은 true 또는 false 값이어야 합니다.'),

  body('settings.language_preference')
    .optional()
    .isIn(['ko', 'en', 'ja', 'zh'])
    .withMessage('지원되는 언어를 선택해주세요. (ko, en, ja, zh)'),

  body('settings.currency_preference')
    .optional()
    .isIn(['KRW', 'USD', 'JPY', 'CNY'])
    .withMessage('지원되는 통화를 선택해주세요. (KRW, USD, JPY, CNY)'),

  body('settings.theme_preference')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('지원되는 테마를 선택해주세요. (light, dark, auto)'),

  handleValidationErrors
];

// Settings field validation rules
export const validateSettingsField = [
  param('field')
    .isString()
    .withMessage('필드명은 문자열이어야 합니다.'),

  body('value')
    .notEmpty()
    .withMessage('값이 필요합니다.'),

  handleValidationErrors
];

// Settings validation rules for specific field
export const validateSettingsFieldValue = (field: string, value: any): { valid: boolean; message?: string } => {
  const validationRules: Record<string, (value: any) => { valid: boolean; message?: string }> = {
    push_notifications_enabled: (val) => {
      if (typeof val !== 'boolean') {
        return { valid: false, message: '푸시 알림 설정은 true 또는 false 값이어야 합니다.' };
      }
      return { valid: true };
    },
    reservation_notifications: (val) => {
      if (typeof val !== 'boolean') {
        return { valid: false, message: '예약 알림 설정은 true 또는 false 값이어야 합니다.' };
      }
      return { valid: true };
    },
    event_notifications: (val) => {
      if (typeof val !== 'boolean') {
        return { valid: false, message: '이벤트 알림 설정은 true 또는 false 값이어야 합니다.' };
      }
      return { valid: true };
    },
    marketing_notifications: (val) => {
      if (typeof val !== 'boolean') {
        return { valid: false, message: '마케팅 알림 설정은 true 또는 false 값이어야 합니다.' };
      }
      return { valid: true };
    },
    location_tracking_enabled: (val) => {
      if (typeof val !== 'boolean') {
        return { valid: false, message: '위치 추적 설정은 true 또는 false 값이어야 합니다.' };
      }
      return { valid: true };
    },
    language_preference: (val) => {
      if (!['ko', 'en', 'ja', 'zh'].includes(val)) {
        return { valid: false, message: '지원되는 언어를 선택해주세요. (ko, en, ja, zh)' };
      }
      return { valid: true };
    },
    currency_preference: (val) => {
      if (!['KRW', 'USD', 'JPY', 'CNY'].includes(val)) {
        return { valid: false, message: '지원되는 통화를 선택해주세요. (KRW, USD, JPY, CNY)' };
      }
      return { valid: true };
    },
    theme_preference: (val) => {
      if (!['light', 'dark', 'auto'].includes(val)) {
        return { valid: false, message: '지원되는 테마를 선택해주세요. (light, dark, auto)' };
      }
      return { valid: true };
    }
  };

  const validator = validationRules[field];
  if (!validator) {
    return { valid: false, message: '지원되지 않는 설정 필드입니다.' };
  }

  return validator(value);
};
