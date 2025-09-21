import Joi from 'joi';
import { ServiceCategory, ShopType, ShopStatus } from '../types/database.types';

// Valid enum values
const VALID_SERVICE_CATEGORIES: ServiceCategory[] = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];
const VALID_SHOP_TYPES: ShopType[] = ['partnered', 'non_partnered'];
const VALID_SHOP_STATUSES: ShopStatus[] = ['active', 'inactive', 'pending_approval', 'suspended', 'deleted'];
const VALID_SORT_BY = ['relevance', 'distance', 'rating', 'price', 'name', 'created_at'];
const VALID_SORT_ORDER = ['asc', 'desc'];

/**
 * Validation schema for shop search endpoint
 * GET /api/shops/search
 */
export const shopSearchSchema = Joi.object({
  // Search query parameters
  q: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.min': '검색어는 최소 1자 이상이어야 합니다.',
      'string.max': '검색어는 최대 100자까지 입력 가능합니다.',
      'string.empty': '검색어는 비워둘 수 없습니다.'
    }),

  query: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.min': '검색어는 최소 1자 이상이어야 합니다.',
      'string.max': '검색어는 최대 100자까지 입력 가능합니다.',
      'string.empty': '검색어는 비워둘 수 없습니다.'
    }),

  // Filter parameters
  category: Joi.string()
    .valid(...VALID_SERVICE_CATEGORIES)
    .optional()
    .messages({
      'any.only': `유효한 카테고리를 선택해주세요. (${VALID_SERVICE_CATEGORIES.join(', ')})`
    }),

  shopType: Joi.string()
    .valid(...VALID_SHOP_TYPES)
    .optional()
    .messages({
      'any.only': `유효한 샵 타입을 선택해주세요. (${VALID_SHOP_TYPES.join(', ')})`
    }),

  status: Joi.string()
    .valid(...VALID_SHOP_STATUSES)
    .default('active')
    .optional()
    .messages({
      'any.only': `유효한 샵 상태를 선택해주세요. (${VALID_SHOP_STATUSES.join(', ')})`
    }),

  onlyFeatured: Joi.string()
    .valid('true', 'false')
    .default('false')
    .optional()
    .messages({
      'any.only': 'onlyFeatured는 true 또는 false여야 합니다.'
    }),

  onlyOpen: Joi.string()
    .valid('true', 'false')
    .default('false')
    .optional()
    .messages({
      'any.only': 'onlyOpen은 true 또는 false여야 합니다.'
    }),

  // Price range filters
  priceMin: Joi.number()
    .min(0)
    .max(1000000)
    .optional()
    .messages({
      'number.base': '최소 가격은 숫자여야 합니다.',
      'number.min': '최소 가격은 0 이상이어야 합니다.',
      'number.max': '최소 가격은 1,000,000 이하여야 합니다.'
    }),

  priceMax: Joi.number()
    .min(0)
    .max(1000000)
    .optional()
    .messages({
      'number.base': '최대 가격은 숫자여야 합니다.',
      'number.min': '최대 가격은 0 이상이어야 합니다.',
      'number.max': '최대 가격은 1,000,000 이하여야 합니다.'
    }),

  // Rating filter
  ratingMin: Joi.number()
    .min(0)
    .max(5)
    .optional()
    .messages({
      'number.base': '최소 평점은 숫자여야 합니다.',
      'number.min': '최소 평점은 0 이상이어야 합니다.',
      'number.max': '최소 평점은 5 이하여야 합니다.'
    }),

  // Location parameters
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .optional()
    .messages({
      'number.base': '위도는 숫자여야 합니다.',
      'number.min': '위도는 -90 이상이어야 합니다.',
      'number.max': '위도는 90 이하여야 합니다.'
    }),

  longitude: Joi.number()
    .min(-180)
    .max(180)
    .optional()
    .messages({
      'number.base': '경도는 숫자여야 합니다.',
      'number.min': '경도는 -180 이상이어야 합니다.',
      'number.max': '경도는 180 이하여야 합니다.'
    }),

  radius: Joi.number()
    .min(0.1)
    .max(50)
    .default(10)
    .optional()
    .messages({
      'number.base': '반경은 숫자여야 합니다.',
      'number.min': '반경은 0.1km 이상이어야 합니다.',
      'number.max': '반경은 50km 이하여야 합니다.'
    }),

  // Bounds parameters for map-based search
  neLat: Joi.number()
    .min(-90)
    .max(90)
    .optional()
    .messages({
      'number.base': '북동쪽 위도는 숫자여야 합니다.',
      'number.min': '북동쪽 위도는 -90 이상이어야 합니다.',
      'number.max': '북동쪽 위도는 90 이하여야 합니다.'
    }),

  neLng: Joi.number()
    .min(-180)
    .max(180)
    .optional()
    .messages({
      'number.base': '북동쪽 경도는 숫자여야 합니다.',
      'number.min': '북동쪽 경도는 -180 이상이어야 합니다.',
      'number.max': '북동쪽 경도는 180 이하여야 합니다.'
    }),

  swLat: Joi.number()
    .min(-90)
    .max(90)
    .optional()
    .messages({
      'number.base': '남서쪽 위도는 숫자여야 합니다.',
      'number.min': '남서쪽 위도는 -90 이상이어야 합니다.',
      'number.max': '남서쪽 위도는 90 이하여야 합니다.'
    }),

  swLng: Joi.number()
    .min(-180)
    .max(180)
    .optional()
    .messages({
      'number.base': '남서쪽 경도는 숫자여야 합니다.',
      'number.min': '남서쪽 경도는 -180 이상이어야 합니다.',
      'number.max': '남서쪽 경도는 180 이하여야 합니다.'
    }),

  // Sorting parameters
  sortBy: Joi.string()
    .valid(...VALID_SORT_BY)
    .default('relevance')
    .optional()
    .messages({
      'any.only': `유효한 정렬 기준을 선택해주세요. (${VALID_SORT_BY.join(', ')})`
    }),

  sortOrder: Joi.string()
    .valid(...VALID_SORT_ORDER)
    .default('desc')
    .optional()
    .messages({
      'any.only': `유효한 정렬 순서를 선택해주세요. (${VALID_SORT_ORDER.join(', ')})`
    }),

  // Pagination parameters
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .messages({
      'number.base': '페이지 크기는 숫자여야 합니다.',
      'number.integer': '페이지 크기는 정수여야 합니다.',
      'number.min': '페이지 크기는 최소 1이어야 합니다.',
      'number.max': '페이지 크기는 최대 100이어야 합니다.'
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
    }),

  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': '페이지 번호는 숫자여야 합니다.',
      'number.integer': '페이지 번호는 정수여야 합니다.',
      'number.min': '페이지 번호는 1 이상이어야 합니다.'
    })
})
.custom((value, helpers) => {
  // Validate that if latitude is provided, longitude must also be provided
  if ((value.latitude && !value.longitude) || (!value.latitude && value.longitude)) {
    return helpers.error('custom.location', {
      message: '위도와 경도는 함께 제공되어야 합니다.'
    });
  }

  // Validate bounds parameters - all four must be provided together
  const boundsParams = [value.neLat, value.neLng, value.swLat, value.swLng];
  const providedBoundsCount = boundsParams.filter(param => param !== undefined).length;
  if (providedBoundsCount > 0 && providedBoundsCount < 4) {
    return helpers.error('custom.bounds', {
      message: '경계 검색을 위해서는 neLat, neLng, swLat, swLng 모든 매개변수가 필요합니다.'
    });
  }

  // Validate bounds logic - northeast should be northeast of southwest
  if (providedBoundsCount === 4) {
    if (value.neLat <= value.swLat || value.neLng <= value.swLng) {
      return helpers.error('custom.boundsLogic', {
        message: '북동쪽 좌표는 남서쪽 좌표보다 커야 합니다.'
      });
    }
  }

  // Validate that location and bounds are not both provided
  if ((value.latitude || value.longitude) && providedBoundsCount === 4) {
    return helpers.error('custom.locationBounds', {
      message: '위치 기반 검색과 경계 기반 검색은 동시에 사용할 수 없습니다.'
    });
  }

  // Validate price range
  if (value.priceMin && value.priceMax && value.priceMin > value.priceMax) {
    return helpers.error('custom.priceRange', {
      message: '최소 가격은 최대 가격보다 작거나 같아야 합니다.'
    });
  }

  // Validate that distance sorting requires location
  if (value.sortBy === 'distance' && (!value.latitude || !value.longitude)) {
    return helpers.error('custom.distanceSort', {
      message: '거리순 정렬을 사용하려면 위치 정보(위도, 경도)가 필요합니다.'
    });
  }

  return value;
})
.messages({
  'custom.location': '{{#message}}',
  'custom.bounds': '{{#message}}',
  'custom.boundsLogic': '{{#message}}',
  'custom.locationBounds': '{{#message}}',
  'custom.priceRange': '{{#message}}',
  'custom.distanceSort': '{{#message}}'
});

/**
 * Validation schema for search suggestions endpoint
 * GET /api/shops/search/suggestions
 */
export const searchSuggestionsSchema = Joi.object({
  q: Joi.string()
    .min(1)
    .max(50)
    .trim()
    .required()
    .messages({
      'string.min': '검색어는 최소 1자 이상이어야 합니다.',
      'string.max': '검색어는 최대 50자까지 입력 가능합니다.',
      'string.empty': '검색어는 필수입니다.',
      'any.required': '검색어는 필수입니다.'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(5)
    .optional()
    .messages({
      'number.base': '제한 개수는 숫자여야 합니다.',
      'number.integer': '제한 개수는 정수여야 합니다.',
      'number.min': '제한 개수는 최소 1이어야 합니다.',
      'number.max': '제한 개수는 최대 10이어야 합니다.'
    })
});

/**
 * Validation schema for popular searches endpoint
 * GET /api/shops/search/popular
 */
export const popularSearchesSchema = Joi.object({
  // No parameters required for popular searches
}).unknown(false);

/**
 * Custom validation functions
 */

/**
 * Validate Korean text input
 */
export const validateKoreanText = (value: string, helpers: Joi.CustomHelpers) => {
  if (!value) return value;
  
  // Allow Korean characters, English letters, numbers, and common punctuation
  const koreanTextPattern = /^[가-힣a-zA-Z0-9\s\-\(\)\.]+$/;
  
  if (!koreanTextPattern.test(value)) {
    return helpers.error('string.pattern.base', {
      message: '한글, 영문, 숫자, 기본 문장부호만 입력 가능합니다.'
    });
  }
  
  return value;
};

/**
 * Validate search query for potential security issues
 */
export const validateSearchQuery = (value: string, helpers: Joi.CustomHelpers) => {
  if (!value) return value;
  
  // Check for potential SQL injection patterns
  const sqlInjectionPattern = /(union|select|insert|update|delete|drop|create|alter|exec|script)/i;
  
  if (sqlInjectionPattern.test(value)) {
    return helpers.error('string.pattern.base', {
      message: '검색어에 허용되지 않는 문자가 포함되어 있습니다.'
    });
  }
  
  // Check for excessive special characters
  const specialCharCount = (value.match(/[^가-힣a-zA-Z0-9\s]/g) || []).length;
  if (specialCharCount > value.length * 0.3) {
    return helpers.error('string.pattern.base', {
      message: '검색어에 특수문자가 너무 많습니다.'
    });
  }
  
  return value;
};

/**
 * Enhanced shop search schema with Korean text validation
 */
export const enhancedShopSearchSchema = shopSearchSchema.keys({
  q: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .custom(validateKoreanText)
    .custom(validateSearchQuery)
    .optional()
    .messages({
      'string.min': '검색어는 최소 1자 이상이어야 합니다.',
      'string.max': '검색어는 최대 100자까지 입력 가능합니다.',
      'string.empty': '검색어는 비워둘 수 없습니다.'
    }),

  query: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .custom(validateKoreanText)
    .custom(validateSearchQuery)
    .optional()
    .messages({
      'string.min': '검색어는 최소 1자 이상이어야 합니다.',
      'string.max': '검색어는 최대 100자까지 입력 가능합니다.',
      'string.empty': '검색어는 비워둘 수 없습니다.'
    })
});

/**
 * Enhanced search suggestions schema with Korean text validation
 */
export const enhancedSearchSuggestionsSchema = searchSuggestionsSchema.keys({
  q: Joi.string()
    .min(1)
    .max(50)
    .trim()
    .custom(validateKoreanText)
    .custom(validateSearchQuery)
    .required()
    .messages({
      'string.min': '검색어는 최소 1자 이상이어야 합니다.',
      'string.max': '검색어는 최대 50자까지 입력 가능합니다.',
      'string.empty': '검색어는 필수입니다.',
      'any.required': '검색어는 필수입니다.'
    })
});
