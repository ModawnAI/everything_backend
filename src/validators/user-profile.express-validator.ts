/**
 * User Profile Express-Validator Schemas
 * 
 * Enhanced validation using express-validator for better integration
 * with Express.js middleware and error handling
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

/**
 * Profile update validation rules
 */
export const validateProfileUpdate = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('이름은 1자 이상 100자 이하여야 합니다.')
    .trim()
    .escape()
    .custom((value) => {
      if (value && !/^[가-힣a-zA-Z\s]+$/.test(value)) {
        throw new Error('이름은 한글, 영문, 공백만 입력 가능합니다.');
      }
      return true;
    }),

  body('nickname')
    .optional()
    .isLength({ max: 50 })
    .withMessage('닉네임은 50자 이하여야 합니다.')
    .trim()
    .escape()
    .custom((value) => {
      if (value && !/^[가-힣a-zA-Z0-9_-]+$/.test(value)) {
        throw new Error('닉네임은 한글, 영문, 숫자, _, - 만 입력 가능합니다.');
      }
      return true;
    }),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('유효한 성별을 선택해주세요.'),

  body('birth_date')
    .optional()
    .isISO8601()
    .withMessage('올바른 날짜 형식(YYYY-MM-DD)을 입력해주세요.')
    .custom((value) => {
      if (value) {
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 14) {
          throw new Error('만 14세 이상이어야 합니다.');
        }
        
        if (age > 120) {
          throw new Error('유효하지 않은 생년월일입니다.');
        }
        
        if (birthDate > today) {
          throw new Error('생년월일은 현재 날짜보다 이전이어야 합니다.');
        }
      }
      return true;
    }),

  body('profile_image_url')
    .optional()
    .isURL()
    .withMessage('유효한 이미지 URL을 입력해주세요.')
    .custom((value) => {
      if (value && !/\.(jpg|jpeg|png|webp)$/i.test(value)) {
        throw new Error('JPG, PNG, WebP 형식의 이미지 URL만 허용됩니다.');
      }
      return true;
    }),

  body('marketing_consent')
    .optional()
    .isBoolean()
    .withMessage('마케팅 동의는 true 또는 false 값이어야 합니다.'),

  // Ensure at least one field is provided
  body().custom((value) => {
    const fields = Object.keys(value);
    if (fields.length === 0) {
      throw new Error('최소 하나의 필드를 업데이트해야 합니다.');
    }
    return true;
  })
];

/**
 * Privacy settings update validation rules
 */
export const validatePrivacySettingsUpdate = [
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
  body().custom((value) => {
    const fields = Object.keys(value);
    if (fields.length === 0) {
      throw new Error('최소 하나의 설정을 업데이트해야 합니다.');
    }
    return true;
  })
];

/**
 * Account deletion validation rules
 */
export const validateAccountDeletion = [
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('탈퇴 사유는 500자 이하여야 합니다.')
    .trim()
    .escape(),

  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('비밀번호는 6자 이상이어야 합니다.')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('비밀번호는 영문과 숫자를 포함해야 합니다.')
];

/**
 * Terms acceptance validation rules
 */
export const validateTermsAcceptance = [
  body().custom((value) => {
    const fields = Object.keys(value);
    if (fields.length > 0) {
      throw new Error('이용약관 동의는 추가 데이터가 필요하지 않습니다.');
    }
    return true;
  })
];

/**
 * Privacy acceptance validation rules
 */
export const validatePrivacyAcceptance = [
  body().custom((value) => {
    const fields = Object.keys(value);
    if (fields.length > 0) {
      throw new Error('개인정보처리방침 동의는 추가 데이터가 필요하지 않습니다.');
    }
    return true;
  })
];

/**
 * Profile image upload validation rules
 */
export const validateProfileImageUpload = [
  // File validation is handled by multer middleware
  // This validates the file object after multer processing
  body().custom((value, { req }) => {
    const file = (req as any).file;
    
    if (!file) {
      throw new Error('이미지 파일을 업로드해주세요.');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.');
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('이미지 파일 크기는 5MB 이하여야 합니다.');
    }

    // Validate filename
    if (!file.originalname || file.originalname.length > 255) {
      throw new Error('파일명이 유효하지 않습니다.');
    }

    return true;
  })
];

/**
 * Query parameter validation rules
 */
export const validateProfileQuery = [
  query('include_settings')
    .optional()
    .isBoolean()
    .withMessage('include_settings는 true 또는 false 값이어야 합니다.'),

  query('include_completion')
    .optional()
    .isBoolean()
    .withMessage('include_completion은 true 또는 false 값이어야 합니다.')
];

export const validateSettingsQuery = [
  query('include_profile')
    .optional()
    .isBoolean()
    .withMessage('include_profile은 true 또는 false 값이어야 합니다.')
];

export const validateProfileCompletionQuery = [
  query('detailed')
    .optional()
    .isBoolean()
    .withMessage('detailed는 true 또는 false 값이어야 합니다.')
];

/**
 * User ID parameter validation
 */
export const validateUserId = [
  param('userId')
    .isUUID()
    .withMessage('유효한 사용자 ID를 입력해주세요.')
];

/**
 * Sanitization middleware for profile data
 */
export const sanitizeProfileData = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize string fields
    if (req.body.name) {
      req.body.name = req.body.name.trim().replace(/\s+/g, ' ');
    }
    
    if (req.body.nickname) {
      req.body.nickname = req.body.nickname.trim().replace(/\s+/g, ' ');
    }
    
    if (req.body.reason) {
      req.body.reason = req.body.reason.trim();
    }

    // Remove any potential XSS attempts
    const stringFields = ['name', 'nickname', 'reason'];
    stringFields.forEach(field => {
      if (req.body[field]) {
        req.body[field] = req.body[field]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    });

    next();
  } catch (error) {
    logger.error('Error sanitizing profile data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id
    });
    next(error);
  }
};

/**
 * Rate limiting validation for profile operations
 */
export const validateProfileRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // This would integrate with your existing rate limiting middleware
  // Additional validation can be added here if needed
  next();
};

/**
 * File upload validation middleware
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  const file = (req as any).file;
  
  if (!file) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NO_FILE_PROVIDED',
        message: '업로드할 파일을 선택해주세요.',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Additional file validation
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (file.size > 5 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: '이미지 파일 크기는 5MB 이하여야 합니다.',
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};
