/**
 * Shop Registration Validators
 * 
 * Comprehensive validation schemas for multi-step shop registration workflow
 * including Korean business license validation and document upload support
 */

import Joi from 'joi';

/**
 * Korean Business License Number Validation
 * Format: XXX-XX-XXXXX (10 digits total)
 * Includes checksum validation algorithm
 */
export function validateKoreanBusinessLicense(licenseNumber: string): { isValid: boolean; error?: string } {
  // Remove hyphens and spaces
  const cleanNumber = licenseNumber.replace(/[-\s]/g, '');
  
  // Check if it's exactly 10 digits
  if (!/^\d{10}$/.test(cleanNumber)) {
    return {
      isValid: false,
      error: '사업자등록번호는 10자리 숫자여야 합니다. (예: 123-45-67890)'
    };
  }
  
  // Korean business license checksum validation
  const digits = cleanNumber.split('').map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }
  
  // Add special calculation for 9th digit
  sum += Math.floor((digits[8] * 5) / 10);
  
  const checkDigit = (10 - (sum % 10)) % 10;
  
  if (checkDigit !== digits[9]) {
    return {
      isValid: false,
      error: '유효하지 않은 사업자등록번호입니다. 체크섬이 일치하지 않습니다.'
    };
  }
  
  return { isValid: true };
}

/**
 * Korean Address Validation
 * Validates Korean address format and postal code
 */
export function validateKoreanAddress(address: string, postalCode?: string): { isValid: boolean; error?: string } {
  // Basic address validation
  if (!address || address.trim().length < 5) {
    return {
      isValid: false,
      error: '주소는 최소 5자 이상이어야 합니다.'
    };
  }
  
  // Korean address pattern validation (basic)
  const koreanAddressPattern = /^[가-힣\s\d-]+$/;
  if (!koreanAddressPattern.test(address)) {
    return {
      isValid: false,
      error: '주소는 한글, 숫자, 하이픈만 포함할 수 있습니다.'
    };
  }
  
  // Postal code validation (Korean format: XXXXX or XXX-XXX)
  if (postalCode) {
    const cleanPostalCode = postalCode.replace(/-/g, '');
    if (!/^\d{5}$/.test(cleanPostalCode)) {
      return {
        isValid: false,
        error: '우편번호는 5자리 숫자여야 합니다. (예: 12345 또는 123-45)'
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Step 1: Basic Shop Information Validation
 */
export const shopBasicInfoSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[가-힣a-zA-Z0-9\s&.-]+$/)
    .messages({
      'string.empty': '샵명을 입력해주세요.',
      'string.min': '샵명은 최소 2자 이상이어야 합니다.',
      'string.max': '샵명은 최대 100자까지 입력 가능합니다.',
      'string.pattern.base': '샵명에는 한글, 영문, 숫자, 공백, &, ., - 만 사용할 수 있습니다.',
      'any.required': '샵명은 필수 항목입니다.'
    }),
    
  description: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.max': '샵 소개는 최대 1000자까지 입력 가능합니다.'
    }),
    
  phone_number: Joi.string()
    .pattern(/^(010|011|016|017|018|019)-?\d{3,4}-?\d{4}$/)
    .required()
    .messages({
      'string.pattern.base': '올바른 휴대폰 번호 형식을 입력해주세요. (예: 010-1234-5678)',
      'any.required': '연락처는 필수 항목입니다.'
    }),
    
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': '올바른 이메일 형식을 입력해주세요.'
    }),
    
  main_category: Joi.string()
    .valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair')
    .required()
    .messages({
      'any.only': '주 서비스 카테고리를 선택해주세요.',
      'any.required': '주 서비스 카테고리는 필수 항목입니다.'
    }),
    
  sub_categories: Joi.array()
    .items(Joi.string().valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'))
    .max(3)
    .optional()
    .messages({
      'array.max': '부가 서비스는 최대 3개까지 선택 가능합니다.',
      'any.only': '유효하지 않은 서비스 카테고리입니다.'
    })
});

/**
 * Step 2: Address and Location Validation
 */
export const shopAddressSchema = Joi.object({
  address: Joi.string()
    .min(5)
    .max(200)
    .required()
    .custom((value, helpers) => {
      const validation = validateKoreanAddress(value);
      if (!validation.isValid) {
        return helpers.error('any.custom', { message: validation.error });
      }
      return value;
    })
    .messages({
      'string.empty': '주소를 입력해주세요.',
      'string.min': '주소는 최소 5자 이상이어야 합니다.',
      'string.max': '주소는 최대 200자까지 입력 가능합니다.',
      'any.required': '주소는 필수 항목입니다.',
      'any.custom': '{#message}'
    }),
    
  detailed_address: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': '상세주소는 최대 100자까지 입력 가능합니다.'
    }),
    
  postal_code: Joi.string()
    .pattern(/^\d{5}$/)
    .required()
    .messages({
      'string.pattern.base': '우편번호는 5자리 숫자여야 합니다. (예: 12345)',
      'any.required': '우편번호는 필수 항목입니다.'
    }),
    
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .precision(8)
    .required()
    .messages({
      'number.min': '위도는 -90 이상이어야 합니다.',
      'number.max': '위도는 90 이하여야 합니다.',
      'any.required': '위치 정보(위도)는 필수 항목입니다.'
    }),
    
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .precision(8)
    .required()
    .messages({
      'number.min': '경도는 -180 이상이어야 합니다.',
      'number.max': '경도는 180 이하여야 합니다.',
      'any.required': '위치 정보(경도)는 필수 항목입니다.'
    })
});

/**
 * Step 3: Business License Validation
 */
export const businessLicenseSchema = Joi.object({
  business_license_number: Joi.string()
    .required()
    .custom((value, helpers) => {
      const validation = validateKoreanBusinessLicense(value);
      if (!validation.isValid) {
        return helpers.error('any.custom', { message: validation.error });
      }
      return value.replace(/[-\s]/g, ''); // Return cleaned number
    })
    .messages({
      'string.empty': '사업자등록번호를 입력해주세요.',
      'any.required': '사업자등록번호는 필수 항목입니다.',
      'any.custom': '{#message}'
    }),
    
  business_license_image_url: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': '올바른 이미지 URL 형식이어야 합니다.',
      'string.empty': '사업자등록증 이미지를 업로드해주세요.',
      'any.required': '사업자등록증 이미지는 필수 항목입니다.'
    })
});

/**
 * Step 4: Operating Information Validation
 */
export const operatingInfoSchema = Joi.object({
  operating_hours: Joi.object({
    monday: Joi.object({
      open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      is_closed: Joi.boolean().default(false)
    }).optional(),
    tuesday: Joi.object({
      open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      is_closed: Joi.boolean().default(false)
    }).optional(),
    wednesday: Joi.object({
      open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      is_closed: Joi.boolean().default(false)
    }).optional(),
    thursday: Joi.object({
      open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      is_closed: Joi.boolean().default(false)
    }).optional(),
    friday: Joi.object({
      open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      is_closed: Joi.boolean().default(false)
    }).optional(),
    saturday: Joi.object({
      open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      is_closed: Joi.boolean().default(false)
    }).optional(),
    sunday: Joi.object({
      open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null),
      is_closed: Joi.boolean().default(false)
    }).optional()
  }).optional(),
  
  payment_methods: Joi.array()
    .items(Joi.string().valid('toss_payments', 'kakao_pay', 'naver_pay', 'card', 'bank_transfer'))
    .min(1)
    .max(5)
    .required()
    .messages({
      'array.min': '최소 1개의 결제 수단을 선택해주세요.',
      'array.max': '최대 5개의 결제 수단까지 선택 가능합니다.',
      'any.only': '유효하지 않은 결제 수단입니다.',
      'any.required': '결제 수단은 필수 항목입니다.'
    }),
    
  kakao_channel_url: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': '올바른 카카오톡 채널 URL 형식을 입력해주세요.'
    })
});

/**
 * Complete Shop Registration Validation (All Steps Combined)
 */
export const completeShopRegistrationSchema = Joi.object({
  // Step 1: Basic Info
  ...shopBasicInfoSchema.describe().keys,
  
  // Step 2: Address
  ...shopAddressSchema.describe().keys,
  
  // Step 3: Business License
  ...businessLicenseSchema.describe().keys,
  
  // Step 4: Operating Info
  ...operatingInfoSchema.describe().keys
});

/**
 * Shop Image Upload Validation
 */
export const shopImageSchema = Joi.object({
  image_url: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': '올바른 이미지 URL 형식이어야 합니다.',
      'any.required': '이미지 URL은 필수 항목입니다.'
    }),
    
  alt_text: Joi.string()
    .max(200)
    .optional()
    .messages({
      'string.max': '이미지 설명은 최대 200자까지 입력 가능합니다.'
    }),
    
  is_primary: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': '대표 이미지 여부는 true 또는 false여야 합니다.'
    }),
    
  display_order: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(0)
    .messages({
      'number.integer': '표시 순서는 정수여야 합니다.',
      'number.min': '표시 순서는 0 이상이어야 합니다.',
      'number.max': '표시 순서는 10 이하여야 합니다.'
    })
});

/**
 * Multi-Step Registration Progress Validation
 */
export const registrationStepSchema = Joi.object({
  step: Joi.number()
    .integer()
    .min(1)
    .max(4)
    .required()
    .messages({
      'number.integer': '단계는 정수여야 합니다.',
      'number.min': '단계는 1 이상이어야 합니다.',
      'number.max': '단계는 4 이하여야 합니다.',
      'any.required': '등록 단계는 필수 항목입니다.'
    }),
    
  data: Joi.alternatives()
    .conditional('step', {
      is: 1,
      then: shopBasicInfoSchema,
      otherwise: Joi.alternatives()
        .conditional('step', {
          is: 2,
          then: shopAddressSchema,
          otherwise: Joi.alternatives()
            .conditional('step', {
              is: 3,
              then: businessLicenseSchema,
              otherwise: operatingInfoSchema
            })
        })
    })
    .required()
    .messages({
      'any.required': '단계별 데이터는 필수 항목입니다.'
    })
});

/**
 * Validation Helper Functions
 */
export const validateRegistrationStep = (step: number, data: any) => {
  const stepValidation = registrationStepSchema.validate({ step, data });
  return stepValidation;
};

export const validateCompleteRegistration = (data: any) => {
  return completeShopRegistrationSchema.validate(data, { abortEarly: false });
};

export const validateShopImage = (data: any) => {
  return shopImageSchema.validate(data);
};
