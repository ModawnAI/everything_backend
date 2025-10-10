/**
 * Shop Service Validation Schemas
 * 
 * Joi validation schemas for shop service management endpoints
 */

import Joi from 'joi';

/**
 * Schema for creating a new service
 */
export const createServiceSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(255)
    .trim()
    .required()
    .messages({
      'string.empty': '서비스명은 필수입니다.',
      'string.min': '서비스명은 최소 1자 이상이어야 합니다.',
      'string.max': '서비스명은 최대 255자까지 가능합니다.',
      'any.required': '서비스명은 필수입니다.'
    }),

  description: Joi.string()
    .max(1000)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': '서비스 설명은 최대 1000자까지 가능합니다.'
    }),

  category: Joi.string()
    .valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair')
    .required()
    .messages({
      'any.only': '유효하지 않은 서비스 카테고리입니다. (nail, eyelash, waxing, eyebrow_tattoo, hair 중 선택)',
      'any.required': '서비스 카테고리는 필수입니다.'
    }),

  price_min: Joi.number()
    .integer()
    .min(0)
    .max(10000000)
    .optional()
    .messages({
      'number.base': '최소 가격은 숫자여야 합니다.',
      'number.integer': '최소 가격은 정수여야 합니다.',
      'number.min': '최소 가격은 0원 이상이어야 합니다.',
      'number.max': '최소 가격은 1,000만원 이하여야 합니다.'
    }),

  price_max: Joi.number()
    .integer()
    .min(0)
    .max(10000000)
    .optional()
    .messages({
      'number.base': '최대 가격은 숫자여야 합니다.',
      'number.integer': '최대 가격은 정수여야 합니다.',
      'number.min': '최대 가격은 0원 이상이어야 합니다.',
      'number.max': '최대 가격은 1,000만원 이하여야 합니다.'
    }),

  duration_minutes: Joi.number()
    .integer()
    .min(1)
    .max(480) // 8 hours max
    .optional()
    .messages({
      'number.base': '소요 시간은 숫자여야 합니다.',
      'number.integer': '소요 시간은 정수여야 합니다.',
      'number.min': '소요 시간은 최소 1분 이상이어야 합니다.',
      'number.max': '소요 시간은 최대 8시간(480분) 이하여야 합니다.'
    }),

  deposit_amount: Joi.number()
    .integer()
    .min(0)
    .max(1000000)
    .optional()
    .messages({
      'number.base': '예약금 금액은 숫자여야 합니다.',
      'number.integer': '예약금 금액은 정수여야 합니다.',
      'number.min': '예약금 금액은 0원 이상이어야 합니다.',
      'number.max': '예약금 금액은 100만원 이하여야 합니다.'
    }),

  deposit_percentage: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .optional()
    .messages({
      'number.base': '예약금 비율은 숫자여야 합니다.',
      'number.min': '예약금 비율은 0% 이상이어야 합니다.',
      'number.max': '예약금 비율은 100% 이하여야 합니다.',
      'number.precision': '예약금 비율은 소수점 둘째 자리까지만 입력 가능합니다.'
    }),

  is_available: Joi.boolean()
    .default(true)
    .optional()
    .messages({
      'boolean.base': '서비스 제공 여부는 true 또는 false여야 합니다.'
    }),

  booking_advance_days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .optional()
    .messages({
      'number.base': '사전 예약 가능 일수는 숫자여야 합니다.',
      'number.integer': '사전 예약 가능 일수는 정수여야 합니다.',
      'number.min': '사전 예약 가능 일수는 최소 1일 이상이어야 합니다.',
      'number.max': '사전 예약 가능 일수는 최대 365일 이하여야 합니다.'
    }),

  cancellation_hours: Joi.number()
    .integer()
    .min(1)
    .max(168) // 7 days max
    .default(24)
    .optional()
    .messages({
      'number.base': '취소 가능 시간은 숫자여야 합니다.',
      'number.integer': '취소 가능 시간은 정수여야 합니다.',
      'number.min': '취소 가능 시간은 최소 1시간 이상이어야 합니다.',
      'number.max': '취소 가능 시간은 최대 7일(168시간) 이하여야 합니다.'
    }),

  display_order: Joi.number()
    .integer()
    .min(0)
    .max(999)
    .default(0)
    .optional()
    .messages({
      'number.base': '노출 순서는 숫자여야 합니다.',
      'number.integer': '노출 순서는 정수여야 합니다.',
      'number.min': '노출 순서는 0 이상이어야 합니다.',
      'number.max': '노출 순서는 999 이하여야 합니다.'
    })
})
.custom((value, helpers) => {
  // Validate price range
  if (value.price_min !== undefined && value.price_max !== undefined) {
    if (value.price_min > value.price_max) {
      return helpers.error('custom.priceRange', {
        message: '최소 가격은 최대 가격보다 작거나 같아야 합니다.'
      });
    }
  }

  // Validate deposit settings - only one should be provided
  if (value.deposit_amount !== undefined && value.deposit_percentage !== undefined) {
    return helpers.error('custom.depositConflict', {
      message: '예약금 고정 금액과 비율 중 하나만 설정할 수 있습니다.'
    });
  }

  return value;
})
.messages({
  'custom.priceRange': '{{#message}}',
  'custom.depositConflict': '{{#message}}'
});

/**
 * Schema for updating an existing service
 * All fields are optional since this is for updates
 */
export const updateServiceSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(255)
    .trim()
    .optional()
    .messages({
      'string.empty': '서비스명은 비어있을 수 없습니다.',
      'string.min': '서비스명은 최소 1자 이상이어야 합니다.',
      'string.max': '서비스명은 최대 255자까지 가능합니다.'
    }),

  description: Joi.string()
    .max(1000)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': '서비스 설명은 최대 1000자까지 가능합니다.'
    }),

  category: Joi.string()
    .valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair')
    .optional()
    .messages({
      'any.only': '유효하지 않은 서비스 카테고리입니다. (nail, eyelash, waxing, eyebrow_tattoo, hair 중 선택)'
    }),

  price_min: Joi.number()
    .integer()
    .min(0)
    .max(10000000)
    .optional()
    .messages({
      'number.base': '최소 가격은 숫자여야 합니다.',
      'number.integer': '최소 가격은 정수여야 합니다.',
      'number.min': '최소 가격은 0원 이상이어야 합니다.',
      'number.max': '최소 가격은 1,000만원 이하여야 합니다.'
    }),

  price_max: Joi.number()
    .integer()
    .min(0)
    .max(10000000)
    .optional()
    .messages({
      'number.base': '최대 가격은 숫자여야 합니다.',
      'number.integer': '최대 가격은 정수여야 합니다.',
      'number.min': '최대 가격은 0원 이상이어야 합니다.',
      'number.max': '최대 가격은 1,000만원 이하여야 합니다.'
    }),

  duration_minutes: Joi.number()
    .integer()
    .min(1)
    .max(480)
    .optional()
    .messages({
      'number.base': '소요 시간은 숫자여야 합니다.',
      'number.integer': '소요 시간은 정수여야 합니다.',
      'number.min': '소요 시간은 최소 1분 이상이어야 합니다.',
      'number.max': '소요 시간은 최대 8시간(480분) 이하여야 합니다.'
    }),

  deposit_amount: Joi.number()
    .integer()
    .min(0)
    .max(1000000)
    .optional()
    .messages({
      'number.base': '예약금 금액은 숫자여야 합니다.',
      'number.integer': '예약금 금액은 정수여야 합니다.',
      'number.min': '예약금 금액은 0원 이상이어야 합니다.',
      'number.max': '예약금 금액은 100만원 이하여야 합니다.'
    }),

  deposit_percentage: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .optional()
    .messages({
      'number.base': '예약금 비율은 숫자여야 합니다.',
      'number.min': '예약금 비율은 0% 이상이어야 합니다.',
      'number.max': '예약금 비율은 100% 이하여야 합니다.',
      'number.precision': '예약금 비율은 소수점 둘째 자리까지만 입력 가능합니다.'
    }),

  is_available: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '서비스 제공 여부는 true 또는 false여야 합니다.'
    }),

  booking_advance_days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .optional()
    .messages({
      'number.base': '사전 예약 가능 일수는 숫자여야 합니다.',
      'number.integer': '사전 예약 가능 일수는 정수여야 합니다.',
      'number.min': '사전 예약 가능 일수는 최소 1일 이상이어야 합니다.',
      'number.max': '사전 예약 가능 일수는 최대 365일 이하여야 합니다.'
    }),

  cancellation_hours: Joi.number()
    .integer()
    .min(1)
    .max(168)
    .optional()
    .messages({
      'number.base': '취소 가능 시간은 숫자여야 합니다.',
      'number.integer': '취소 가능 시간은 정수여야 합니다.',
      'number.min': '취소 가능 시간은 최소 1시간 이상이어야 합니다.',
      'number.max': '취소 가능 시간은 최대 7일(168시간) 이하여야 합니다.'
    }),

  display_order: Joi.number()
    .integer()
    .min(0)
    .max(999)
    .optional()
    .messages({
      'number.base': '노출 순서는 숫자여야 합니다.',
      'number.integer': '노출 순서는 정수여야 합니다.',
      'number.min': '노출 순서는 0 이상이어야 합니다.',
      'number.max': '노출 순서는 999 이하여야 합니다.'
    })
})
.min(1)
.custom((value, helpers) => {
  // Validate price range
  if (value.price_min !== undefined && value.price_max !== undefined) {
    if (value.price_min > value.price_max) {
      return helpers.error('custom.priceRange', {
        message: '최소 가격은 최대 가격보다 작거나 같아야 합니다.'
      });
    }
  }

  // Validate deposit settings - only one should be provided
  if (value.deposit_amount !== undefined && value.deposit_percentage !== undefined) {
    return helpers.error('custom.depositConflict', {
      message: '예약금 고정 금액과 비율 중 하나만 설정할 수 있습니다.'
    });
  }

  return value;
})
.messages({
  'object.min': '업데이트할 필드를 최소 1개 이상 제공해주세요.',
  'custom.priceRange': '{{#message}}',
  'custom.depositConflict': '{{#message}}'
});

/**
 * Schema for service list query parameters
 */
export const serviceListQuerySchema = Joi.object({
  category: Joi.string()
    .valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair')
    .optional()
    .messages({
      'any.only': '유효하지 않은 서비스 카테고리입니다.'
    }),

  is_available: Joi.string()
    .valid('true', 'false')
    .optional()
    .messages({
      'any.only': 'is_available은 true 또는 false여야 합니다.'
    }),

  limit: Joi.string()
    .pattern(/^\d+$/)
    .optional()
    .messages({
      'string.pattern.base': 'limit은 숫자여야 합니다.'
    }),

  offset: Joi.string()
    .pattern(/^\d+$/)
    .optional()
    .messages({
      'string.pattern.base': 'offset은 숫자여야 합니다.'
    })
});

/**
 * Schema for service ID parameter
 */
export const serviceIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': '유효하지 않은 서비스 ID입니다.'
    }),
  serviceId: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': '유효하지 않은 서비스 ID입니다.'
    })
}).or('id', 'serviceId').messages({
  'object.missing': '서비스 ID는 필수입니다.'
});

/**
 * Validation middleware function for creating services
 */
export const validateCreateService = (req: any, res: any, next: any) => {
  const { error, value } = createServiceSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력 데이터가 유효하지 않습니다.',
        details: validationErrors
      }
    });
  }

  req.body = value;
  next();
};

/**
 * Validation middleware function for updating services
 */
export const validateUpdateService = (req: any, res: any, next: any) => {
  const { error, value } = updateServiceSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력 데이터가 유효하지 않습니다.',
        details: validationErrors
      }
    });
  }

  req.body = value;
  next();
};

/**
 * Validation middleware function for service list queries
 */
export const validateServiceListQuery = (req: any, res: any, next: any) => {
  const { error, value } = serviceListQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '쿼리 파라미터가 유효하지 않습니다.',
        details: validationErrors
      }
    });
  }

  req.query = value;
  next();
};

/**
 * Validation middleware function for service ID parameter
 */
export const validateServiceId = (req: any, res: any, next: any) => {
  const { error, value } = serviceIdSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '서비스 ID가 유효하지 않습니다.',
        details: validationErrors
      }
    });
  }

  req.params = value;
  next();
};

