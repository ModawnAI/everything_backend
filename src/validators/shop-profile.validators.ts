/**
 * Shop Profile Validation Schemas
 * 
 * Joi validation schemas for shop profile management endpoints
 */

import Joi from 'joi';

/**
 * Schema for updating shop profile information
 * All fields are optional since this is for updates
 */
export const updateShopProfileSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(255)
    .trim()
    .optional()
    .messages({
      'string.empty': '샵명은 비어있을 수 없습니다.',
      'string.min': '샵명은 최소 1자 이상이어야 합니다.',
      'string.max': '샵명은 최대 255자까지 가능합니다.'
    }),

  description: Joi.string()
    .max(1000)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': '샵 설명은 최대 1000자까지 가능합니다.'
    }),

  phone_number: Joi.string()
    .pattern(/^[0-9-+\s()]+$/)
    .max(20)
    .trim()
    .optional()
    .messages({
      'string.pattern.base': '전화번호 형식이 올바르지 않습니다.',
      'string.max': '전화번호는 최대 20자까지 가능합니다.'
    }),

  email: Joi.string()
    .email()
    .max(255)
    .trim()
    .optional()
    .messages({
      'string.email': '이메일 형식이 올바르지 않습니다.',
      'string.max': '이메일은 최대 255자까지 가능합니다.'
    }),

  address: Joi.string()
    .min(1)
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.empty': '주소는 비어있을 수 없습니다.',
      'string.min': '주소는 최소 1자 이상이어야 합니다.',
      'string.max': '주소는 최대 500자까지 가능합니다.'
    }),

  detailed_address: Joi.string()
    .max(500)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': '상세주소는 최대 500자까지 가능합니다.'
    }),

  postal_code: Joi.string()
    .pattern(/^[0-9-]+$/)
    .max(10)
    .trim()
    .optional()
    .messages({
      'string.pattern.base': '우편번호는 숫자와 하이픈만 입력 가능합니다.',
      'string.max': '우편번호는 최대 10자까지 가능합니다.'
    }),

  latitude: Joi.number()
    .min(-90)
    .max(90)
    .optional()
    .messages({
      'number.min': '위도는 -90~90 범위 내에서 입력해주세요.',
      'number.max': '위도는 -90~90 범위 내에서 입력해주세요.'
    }),

  longitude: Joi.number()
    .min(-180)
    .max(180)
    .optional()
    .messages({
      'number.min': '경도는 -180~180 범위 내에서 입력해주세요.',
      'number.max': '경도는 -180~180 범위 내에서 입력해주세요.'
    }),

  main_category: Joi.string()
    .valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair')
    .optional()
    .messages({
      'any.only': '유효하지 않은 서비스 카테고리입니다. (nail, eyelash, waxing, eyebrow_tattoo, hair 중 선택)'
    }),

  sub_categories: Joi.array()
    .items(
      Joi.string().valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair')
    )
    .max(5)
    .unique()
    .optional()
    .messages({
      'array.base': '부가 서비스는 배열 형태로 입력해주세요.',
      'array.max': '부가 서비스는 최대 5개까지 선택 가능합니다.',
      'array.unique': '중복된 서비스 카테고리는 선택할 수 없습니다.',
      'any.only': '유효하지 않은 서비스 카테고리입니다.'
    }),

  operating_hours: Joi.object()
    .pattern(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
      Joi.object({
        open: Joi.string()
          .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
          .required()
          .messages({
            'string.pattern.base': '영업 시작 시간은 HH:mm 형식이어야 합니다.',
            'any.required': '영업 시작 시간은 필수입니다.'
          }),
        close: Joi.string()
          .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
          .required()
          .messages({
            'string.pattern.base': '영업 종료 시간은 HH:mm 형식이어야 합니다.',
            'any.required': '영업 종료 시간은 필수입니다.'
          }),
        is_open: Joi.boolean()
          .default(true)
          .messages({
            'boolean.base': '영업 여부는 true 또는 false여야 합니다.'
          })
      }).required()
    )
    .optional()
    .messages({
      'object.base': '영업시간은 객체 형태로 입력해주세요.'
    }),

  payment_methods: Joi.array()
    .items(
      Joi.string().valid('cash', 'card', 'transfer', 'mobile_pay', 'point')
    )
    .min(1)
    .max(5)
    .unique()
    .optional()
    .messages({
      'array.base': '결제 수단은 배열 형태로 입력해주세요.',
      'array.min': '최소 1개의 결제 수단을 선택해주세요.',
      'array.max': '결제 수단은 최대 5개까지 선택 가능합니다.',
      'array.unique': '중복된 결제 수단은 선택할 수 없습니다.',
      'any.only': '유효하지 않은 결제 수단입니다. (cash, card, transfer, mobile_pay, point 중 선택)'
    }),

  kakao_channel_url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.uri': '카카오톡 채널 URL 형식이 올바르지 않습니다.',
      'string.max': '카카오톡 채널 URL은 최대 500자까지 가능합니다.'
    }),

  business_license_number: Joi.string()
    .pattern(/^[0-9-]+$/)
    .max(50)
    .trim()
    .optional()
    .messages({
      'string.pattern.base': '사업자등록번호는 숫자와 하이픈만 입력 가능합니다.',
      'string.max': '사업자등록번호는 최대 50자까지 가능합니다.'
    })
})
.min(1)
.messages({
  'object.min': '업데이트할 필드를 최소 1개 이상 제공해주세요.'
});

/**
 * Custom validation for operating hours
 * Ensures that close time is after open time
 */
export const validateOperatingHours = (operatingHours: Record<string, any>): string[] => {
  const errors: string[] = [];
  
  if (!operatingHours || typeof operatingHours !== 'object') {
    return errors;
  }

  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const [day, hours] of Object.entries(operatingHours)) {
    if (!validDays.includes(day)) {
      errors.push(`유효하지 않은 요일입니다: ${day}`);
      continue;
    }

    if (typeof hours !== 'object' || !hours) {
      errors.push(`${day}의 영업시간 형식이 올바르지 않습니다.`);
      continue;
    }

    const { open, close, is_open } = hours;

    if (is_open !== false) { // If not explicitly closed
      if (!open || !close) {
        errors.push(`${day}의 영업 시작/종료 시간이 필요합니다.`);
        continue;
      }

      // Parse time strings to compare
      const [openHour, openMin] = open.split(':').map(Number);
      const [closeHour, closeMin] = close.split(':').map(Number);
      
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;

      // Handle overnight hours (e.g., 22:00 - 02:00)
      if (closeMinutes <= openMinutes && closeMinutes < 12 * 60) {
        // This is likely overnight hours, which is valid
        continue;
      }

      if (closeMinutes <= openMinutes) {
        errors.push(`${day}의 종료 시간은 시작 시간보다 늦어야 합니다.`);
      }
    }
  }

  return errors;
};

/**
 * Schema for profile status endpoint (no body validation needed)
 */
export const profileStatusSchema = Joi.object({}).optional();

/**
 * Validation middleware function for shop profile updates
 */
export const validateShopProfileUpdate = (req: any, res: any, next: any) => {
  const { error, value } = updateShopProfileSchema.validate(req.body, {
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

  // Additional validation for operating hours
  if (value.operating_hours) {
    const operatingHoursErrors = validateOperatingHours(value.operating_hours);
    if (operatingHoursErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '영업시간 설정이 유효하지 않습니다.',
          details: operatingHoursErrors.map(error => ({ field: 'operating_hours', message: error }))
        }
      });
    }
  }

  // Set validated and sanitized data
  req.body = value;
  next();
};
