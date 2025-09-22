/**
 * Feed Validators
 * 
 * Comprehensive validation schemas for social feed operations with security enhancements
 */

import * as Joi from 'joi';
import * as DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { SECURITY_PATTERNS } from './security.validators';

// Create DOMPurify instance for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Security validation patterns
const HASHTAG_PATTERN = /^[a-zA-Z0-9가-힣_]+$/; // Alphanumeric + Korean + underscore only
const LOCATION_PATTERN = /^[a-zA-Z0-9가-힣\s\-.,()]+$/; // Safe location characters
const SAFE_URL_PATTERN = /^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;

// Content moderation patterns
const SPAM_INDICATORS = [
  /\b(buy now|click here|limited time|act now|don't miss|urgent|free money)\b/gi,
  /\b(지금 구매|클릭하세요|한정 시간|놓치지 마세요|긴급|무료 돈)\b/gi,
  /(http[s]?:\/\/[^\s]+){3,}/gi, // Multiple URLs
  /(.)\1{10,}/gi, // Repeated characters (spam pattern)
];

const PROFANITY_PATTERNS = [
  /\b(fuck|shit|damn|bitch|asshole|cunt|piss)\b/gi,
  /\b(시발|씨발|지랄|개새끼|좆|꺼져|닥쳐|병신)\b/gi,
];

/**
 * Custom Joi validators for security
 */
const customValidators = {
  // Sanitize HTML content
  sanitizeHtml: (value: string, helpers: any) => {
    if (typeof value !== 'string') return value;
    
    // Check for XSS patterns first
    if (SECURITY_PATTERNS.XSS_SCRIPT?.test(value) || 
        SECURITY_PATTERNS.XSS_EVENT_HANDLERS?.test(value) ||
        SECURITY_PATTERNS.XSS_JAVASCRIPT?.test(value)) {
      return helpers.error('content.xss');
    }
    
    // Sanitize the content
    const sanitized = purify.sanitize(value, {
      ALLOWED_TAGS: [], // No HTML tags allowed in feed content
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
    
    return sanitized.trim();
  },

  // Validate hashtags
  validateHashtag: (value: string, helpers: any) => {
    if (typeof value !== 'string') return value;
    
    // Remove # prefix if present
    const hashtag = value.startsWith('#') ? value.slice(1) : value;
    
    // Check pattern
    if (!HASHTAG_PATTERN.test(hashtag)) {
      return helpers.error('hashtag.invalid');
    }
    
    // Check for spam patterns
    for (const pattern of SPAM_INDICATORS) {
      if (pattern.test(hashtag)) {
        return helpers.error('hashtag.spam');
      }
    }
    
    // Check for profanity
    for (const pattern of PROFANITY_PATTERNS) {
      if (pattern.test(hashtag)) {
        return helpers.error('hashtag.inappropriate');
      }
    }
    
    return hashtag.toLowerCase(); // Normalize to lowercase
  },

  // Validate location tags
  validateLocation: (value: string, helpers: any) => {
    if (typeof value !== 'string') return value;
    
    // Check pattern
    if (!LOCATION_PATTERN.test(value)) {
      return helpers.error('location.invalid');
    }
    
    // Check for spam patterns
    for (const pattern of SPAM_INDICATORS) {
      if (pattern.test(value)) {
        return helpers.error('location.spam');
      }
    }
    
    return value.trim();
  },

  // Validate image URLs
  validateImageUrl: (value: string, helpers: any) => {
    if (typeof value !== 'string') return value;
    
    // Check basic URL pattern
    if (!SAFE_URL_PATTERN.test(value)) {
      return helpers.error('image.invalid_url');
    }
    
    // Check for suspicious patterns
    if (value.includes('javascript:') || value.includes('data:') || value.includes('vbscript:')) {
      return helpers.error('image.unsafe_protocol');
    }
    
    // Must be HTTPS for security
    if (!value.startsWith('https://')) {
      return helpers.error('image.https_required');
    }
    
    return value;
  },

  // Content moderation check
  moderateContent: (value: string, helpers: any) => {
    if (typeof value !== 'string') return value;
    
    // Check for spam indicators
    let spamScore = 0;
    for (const pattern of SPAM_INDICATORS) {
      if (pattern.test(value)) {
        spamScore++;
      }
    }
    
    if (spamScore >= 2) {
      return helpers.error('content.spam');
    }
    
    // Check for excessive profanity
    let profanityCount = 0;
    for (const pattern of PROFANITY_PATTERNS) {
      const matches = value.match(pattern);
      if (matches) {
        profanityCount += matches.length;
      }
    }
    
    if (profanityCount >= 3) {
      return helpers.error('content.excessive_profanity');
    }
    
    // Check for excessive caps (shouting)
    const capsRatio = (value.match(/[A-Z]/g) || []).length / value.length;
    if (value.length > 20 && capsRatio > 0.7) {
      return helpers.error('content.excessive_caps');
    }
    
    return value;
  }
};

// Extend Joi with custom validators
const JoiExtended = Joi.extend({
  type: 'secureString',
  base: Joi.string(),
  messages: {
    'content.xss': 'Content contains potentially malicious code',
    'content.spam': 'Content appears to be spam',
    'content.excessive_profanity': 'Content contains excessive inappropriate language',
    'content.excessive_caps': 'Content contains excessive capitalization',
    'hashtag.invalid': 'Hashtag contains invalid characters',
    'hashtag.spam': 'Hashtag appears to be spam',
    'hashtag.inappropriate': 'Hashtag contains inappropriate content',
    'location.invalid': 'Location contains invalid characters',
    'location.spam': 'Location appears to be spam',
    'image.invalid_url': 'Image URL format is invalid',
    'image.unsafe_protocol': 'Image URL uses unsafe protocol',
    'image.https_required': 'Image URL must use HTTPS protocol'
  },
  rules: {
    sanitize: {
      method() {
        return this.$_addRule('sanitize');
      },
      validate: customValidators.sanitizeHtml
    },
    hashtag: {
      method() {
        return this.$_addRule('hashtag');
      },
      validate: customValidators.validateHashtag
    },
    location: {
      method() {
        return this.$_addRule('location');
      },
      validate: customValidators.validateLocation
    },
    imageUrl: {
      method() {
        return this.$_addRule('imageUrl');
      },
      validate: customValidators.validateImageUrl
    },
    moderate: {
      method() {
        return this.$_addRule('moderate');
      },
      validate: customValidators.moderateContent
    }
  }
});

/**
 * Enhanced Feed Post Validation Schema with Security
 */
export const feedPostSchema = JoiExtended.object({
  content: (JoiExtended as any).secureString()
      .min(1)
      .max(2000)
      .required()
    .sanitize()
    .moderate()
      .messages({
        'string.empty': 'Content is required',
        'string.min': 'Content must not be empty',
        'string.max': 'Content must not exceed 2000 characters'
      }),
  category: JoiExtended.string()
      .optional()
    .valid('beauty', 'lifestyle', 'review', 'promotion', 'general')
      .messages({
      'any.only': 'Category must be one of: beauty, lifestyle, review, promotion, general'
      }),
  location_tag: (JoiExtended as any).secureString()
      .max(100)
      .optional()
    .location()
      .messages({
        'string.max': 'Location tag must not exceed 100 characters'
      }),
  tagged_shop_id: JoiExtended.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Tagged shop ID must be a valid UUID'
      }),
  hashtags: JoiExtended.array()
    .items((JoiExtended as any).secureString().max(50).hashtag())
      .max(10)
    .unique()
      .optional()
      .messages({
        'array.max': 'Maximum 10 hashtags allowed',
      'array.unique': 'Duplicate hashtags are not allowed',
        'string.max': 'Each hashtag must not exceed 50 characters'
      }),
  images: JoiExtended.array()
    .items(JoiExtended.object({
      image_url: (JoiExtended as any).secureString().required().imageUrl(),
      alt_text: (JoiExtended as any).secureString().max(200).optional().sanitize(),
      display_order: JoiExtended.number().integer().min(1).max(10).required()
      }))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 images allowed',
        'string.max': 'Alt text must not exceed 200 characters',
      'number.min': 'Display order must be at least 1',
      'number.max': 'Display order must be at most 10'
      })
  });

// Keep the function version for backward compatibility
export const validateFeedPost = (data: any) => {
  return feedPostSchema.validate(data, { abortEarly: false });
};

/**
 * Enhanced Comment Validation Schema with Security
 */
export const commentSchema = JoiExtended.object({
  content: (JoiExtended as any).secureString()
      .min(1)
    .max(500)
      .required()
    .sanitize()
    .moderate()
      .messages({
        'string.empty': 'Comment content is required',
        'string.min': 'Comment content must not be empty',
      'string.max': 'Comment content must not exceed 500 characters'
      }),
  parent_comment_id: JoiExtended.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Parent comment ID must be a valid UUID'
      })
  });

// Keep the function version for backward compatibility
export const validateComment = (data: any) => {
  return commentSchema.validate(data, { abortEarly: false });
};

/**
 * Enhanced Feed Query Validation Schema with Security
 */
export const feedQuerySchema = JoiExtended.object({
  page: JoiExtended.number()
      .integer()
      .min(1)
      .max(1000)
      .optional()
      .default(1)
      .messages({
        'number.min': 'Page must be at least 1',
        'number.max': 'Page must not exceed 1000'
      }),
  limit: JoiExtended.number()
      .integer()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 50'
      }),
  category: JoiExtended.string()
    .valid('beauty', 'lifestyle', 'review', 'promotion', 'general')
      .optional()
      .messages({
      'any.only': 'Category must be one of: beauty, lifestyle, review, promotion, general'
      }),
  hashtag: (JoiExtended as any).secureString()
      .max(50)
      .optional()
    .hashtag()
      .messages({
        'string.max': 'Hashtag must not exceed 50 characters'
      }),
  location: (JoiExtended as any).secureString()
      .max(100)
      .optional()
    .location()
      .messages({
        'string.max': 'Location must not exceed 100 characters'
      }),
  author_id: JoiExtended.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Author ID must be a valid UUID'
      }),
  sort: JoiExtended.string()
      .valid('recent', 'popular', 'trending')
      .optional()
      .default('recent')
      .messages({
        'any.only': 'Sort must be one of: recent, popular, trending'
      })
  });

export const validateFeedQuery = (data: any) => {
  return feedQuerySchema.validate(data, { abortEarly: false });
};

/**
 * Enhanced Report Validation Schema with Security
 */
export const reportSchema = JoiExtended.object({
  reason: JoiExtended.string()
      .valid(
        'spam',
        'harassment',
        'inappropriate_content',
        'fake_information',
        'violence',
        'hate_speech',
      'copyright_violation',
      'impersonation',
        'other'
      )
      .required()
      .messages({
      'any.only': 'Reason must be one of: spam, harassment, inappropriate_content, fake_information, violence, hate_speech, copyright_violation, impersonation, other'
      }),
  description: (JoiExtended as any).secureString()
      .max(500)
      .optional()
    .sanitize()
      .messages({
        'string.max': 'Description must not exceed 500 characters'
      })
  });

export const validateReport = (data: any) => {
  return reportSchema.validate(data, { abortEarly: false });
};

/**
 * Image Upload Validation Schema
 */
export const imageUploadSchema = JoiExtended.object({
  altText: (JoiExtended as any).secureString()
    .max(200)
    .optional()
    .sanitize()
    .messages({
      'string.max': 'Alt text must not exceed 200 characters'
    }),
  displayOrder: JoiExtended.number()
    .integer()
    .min(1)
    .max(10)
    .optional()
    .default(1)
    .messages({
      'number.min': 'Display order must be at least 1',
      'number.max': 'Display order must be at most 10'
    })
});

/**
 * Content Moderation Integration
 */
export const validateWithModeration = async (data: any, contentType: 'post' | 'comment' = 'post') => {
  // First run standard validation
  const schema = contentType === 'post' ? feedPostSchema : commentSchema;
  const validation = schema.validate(data, { abortEarly: false });
  
  if (validation.error) {
    return validation;
  }

  // Additional security checks for content moderation
  const content = validation.value.content;
  if (content && typeof content === 'string') {
    // Check for suspicious patterns that might bypass initial validation
    const suspiciousPatterns = [
      /\b(admin|administrator|moderator|staff)\b/gi, // Impersonation attempts
      /\b(password|login|signin|account)\b/gi, // Phishing attempts
      /\b(download|install|exe|zip|rar)\b/gi, // Malware distribution
      /\b(bitcoin|crypto|investment|trading)\b/gi, // Financial scams
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return {
          error: {
            details: [{
              message: 'Content contains suspicious patterns and requires manual review',
              path: ['content'],
              type: 'content.suspicious'
            }]
          }
        };
      }
    }

    // Check for excessive repetition (spam indicator)
    const words = content.toLowerCase().split(/\s+/);
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const maxRepeats = Math.max(...Object.values(wordCount));
    if (maxRepeats > 5 && content.length > 50) {
      return {
        error: {
          details: [{
            message: 'Content contains excessive repetition',
            path: ['content'],
            type: 'content.repetitive'
          }]
        }
      };
    }
  }

  return validation;
};

/**
 * Rate Limiting Validation
 */
export const validateRateLimit = (userActivity: {
  postsToday: number;
  commentsToday: number;
  likesToday: number;
  reportsToday: number;
}) => {
  const limits = {
    maxPostsPerDay: 10,
    maxCommentsPerDay: 100,
    maxLikesPerDay: 500,
    maxReportsPerDay: 20
  };

  const violations = [];

  if (userActivity.postsToday >= limits.maxPostsPerDay) {
    violations.push('Daily post limit exceeded');
  }
  if (userActivity.commentsToday >= limits.maxCommentsPerDay) {
    violations.push('Daily comment limit exceeded');
  }
  if (userActivity.likesToday >= limits.maxLikesPerDay) {
    violations.push('Daily like limit exceeded');
  }
  if (userActivity.reportsToday >= limits.maxReportsPerDay) {
    violations.push('Daily report limit exceeded');
  }

  return {
    isValid: violations.length === 0,
    violations,
    limits
  };
};

// =============================================
// FEED STORAGE VALIDATION SCHEMAS
// =============================================

/**
 * Feed Post Filters Validation Schema
 */
export const feedPostFiltersSchema = JoiExtended.object({
  // Basic Filters
  authorId: JoiExtended.string().uuid().optional(),
  category: JoiExtended.string().valid('beauty', 'lifestyle', 'review', 'promotion', 'general').optional(),
  status: JoiExtended.string().valid('active', 'hidden', 'reported', 'deleted').optional(),
  moderationStatus: JoiExtended.string().valid('approved', 'flagged', 'hidden', 'removed', 'banned', 'warned').optional(),
  
  // Content Filters
  hashtags: JoiExtended.array().items(JoiExtended.string().max(50).hashtag()).max(10).optional(),
  taggedShopId: JoiExtended.string().uuid().optional(),
  locationTag: JoiExtended.string().max(100).location().optional(),
  hasImages: JoiExtended.boolean().optional(),
  
  // Engagement Filters
  minLikes: JoiExtended.number().integer().min(0).optional(),
  maxLikes: JoiExtended.number().integer().min(0).optional(),
  minComments: JoiExtended.number().integer().min(0).optional(),
  maxComments: JoiExtended.number().integer().min(0).optional(),
  minViews: JoiExtended.number().integer().min(0).optional(),
  
  // Time Filters
  createdAfter: JoiExtended.date().iso().optional(),
  createdBefore: JoiExtended.date().iso().optional(),
  updatedAfter: JoiExtended.date().iso().optional(),
  updatedBefore: JoiExtended.date().iso().optional(),
  
  // Sorting and Pagination
  sortBy: JoiExtended.string().valid('created_at', 'updated_at', 'like_count', 'comment_count', 'view_count', 'trending_score').optional(),
  sortOrder: JoiExtended.string().valid('asc', 'desc').optional(),
  limit: JoiExtended.number().integer().min(1).max(100).default(20),
  offset: JoiExtended.number().integer().min(0).default(0),
  cursor: JoiExtended.string().optional(),
  
  // User Context
  userId: JoiExtended.string().uuid().optional(),
  includeHidden: JoiExtended.boolean().default(false),
  includeReported: JoiExtended.boolean().default(false)
}).messages({
  'object.unknown': 'Unknown filter parameter: {#label}',
  'any.only': 'Invalid value for {#label}. Must be one of: {#valids}',
  'number.min': '{#label} must be at least {#limit}',
  'number.max': '{#label} must not exceed {#limit}',
  'array.max': 'Maximum {#limit} hashtags allowed'
});

/**
 * Comment Filters Validation Schema
 */
export const commentFiltersSchema = JoiExtended.object({
  authorId: JoiExtended.string().uuid().optional(),
  parentCommentId: JoiExtended.string().uuid().optional(),
  status: JoiExtended.string().valid('active', 'hidden', 'deleted').optional(),
  moderationStatus: JoiExtended.string().valid('approved', 'flagged', 'hidden', 'removed', 'banned', 'warned').optional(),
  
  // Engagement Filters
  minLikes: JoiExtended.number().integer().min(0).optional(),
  maxLikes: JoiExtended.number().integer().min(0).optional(),
  
  // Time Filters
  createdAfter: JoiExtended.date().iso().optional(),
  createdBefore: JoiExtended.date().iso().optional(),
  
  // Sorting and Pagination
  sortBy: JoiExtended.string().valid('created_at', 'like_count').default('created_at'),
  sortOrder: JoiExtended.string().valid('asc', 'desc').default('desc'),
  limit: JoiExtended.number().integer().min(1).max(50).default(20),
  offset: JoiExtended.number().integer().min(0).default(0),
  
  // User Context
  userId: JoiExtended.string().uuid().optional(),
  includeHidden: JoiExtended.boolean().default(false)
}).messages({
  'object.unknown': 'Unknown filter parameter: {#label}',
  'any.only': 'Invalid value for {#label}. Must be one of: {#valids}'
});

/**
 * Feed Storage Configuration Validation Schema
 */
export const feedStorageConfigSchema = JoiExtended.object({
  cache: JoiExtended.object({
    ttl: JoiExtended.number().integer().min(60).max(86400).required(), // 1 minute to 24 hours
    maxSize: JoiExtended.number().integer().min(10).max(1000).required(), // 10MB to 1GB
    strategy: JoiExtended.string().valid('lru', 'lfu', 'fifo').required()
  }).required(),
  
  storage: JoiExtended.object({
    provider: JoiExtended.string().valid('supabase', 'aws_s3', 'gcp_storage').required(),
    bucket: JoiExtended.string().min(3).max(63).required(),
    region: JoiExtended.string().optional(),
    compression: JoiExtended.boolean().default(true),
    encryption: JoiExtended.boolean().default(true)
  }).required(),
  
  performance: JoiExtended.object({
    batchSize: JoiExtended.number().integer().min(1).max(1000).default(100),
    maxConcurrency: JoiExtended.number().integer().min(1).max(50).default(10),
    retryAttempts: JoiExtended.number().integer().min(0).max(5).default(3),
    retryDelay: JoiExtended.number().integer().min(100).max(10000).default(1000)
  }).required()
}).messages({
  'any.required': '{#label} is required for feed storage configuration',
  'number.min': '{#label} must be at least {#limit}',
  'number.max': '{#label} must not exceed {#limit}',
  'string.min': '{#label} must be at least {#limit} characters long',
  'string.max': '{#label} must not exceed {#limit} characters'
});

/**
 * Content Performance Validation Schema
 */
export const contentPerformanceSchema = JoiExtended.object({
  content_id: JoiExtended.string().uuid().required(),
  content_type: JoiExtended.string().valid('post', 'comment').required(),
  views: JoiExtended.number().integer().min(0).default(0),
  likes: JoiExtended.number().integer().min(0).default(0),
  comments: JoiExtended.number().integer().min(0).default(0),
  shares: JoiExtended.number().integer().min(0).default(0),
  saves: JoiExtended.number().integer().min(0).default(0),
  reports: JoiExtended.number().integer().min(0).default(0),
  engagement_rate: JoiExtended.number().min(0).max(100).default(0),
  reach: JoiExtended.number().integer().min(0).default(0),
  impressions: JoiExtended.number().integer().min(0).default(0),
  click_through_rate: JoiExtended.number().min(0).max(100).optional(),
  conversion_rate: JoiExtended.number().min(0).max(100).optional(),
  
  demographic_breakdown: JoiExtended.object({
    age_groups: JoiExtended.object().pattern(JoiExtended.string(), JoiExtended.number().integer().min(0)),
    genders: JoiExtended.object().pattern(JoiExtended.string(), JoiExtended.number().integer().min(0)),
    locations: JoiExtended.object().pattern(JoiExtended.string(), JoiExtended.number().integer().min(0))
  }).default({}),
  
  time_metrics: JoiExtended.object({
    peak_engagement_hour: JoiExtended.number().integer().min(0).max(23).default(12),
    average_view_duration: JoiExtended.number().min(0).default(0),
    bounce_rate: JoiExtended.number().min(0).max(100).default(0)
  }).default({})
}).messages({
  'any.required': '{#label} is required for content performance tracking',
  'number.min': '{#label} must be at least {#limit}',
  'number.max': '{#label} must not exceed {#limit}',
  'any.only': '{#label} must be one of: {#valids}'
});

/**
 * Moderation Queue Item Validation Schema
 */
export const moderationQueueItemSchema = JoiExtended.object({
  content_id: JoiExtended.string().uuid().required(),
  content_type: JoiExtended.string().valid('post', 'comment').required(),
  priority: JoiExtended.string().valid('low', 'medium', 'high', 'critical').required(),
  reason: JoiExtended.string().min(10).max(500).required(),
  report_count: JoiExtended.number().integer().min(1).required(),
  moderation_score: JoiExtended.number().min(0).max(100).required(),
  
  violations: JoiExtended.array().items(
    JoiExtended.object({
      type: JoiExtended.string().valid('profanity', 'spam', 'harassment', 'inappropriate', 'fake_content', 'phishing', 'hate_speech').required(),
      description: JoiExtended.string().min(5).max(200).required(),
      severity: JoiExtended.string().valid('low', 'medium', 'high', 'critical').required(),
      confidence: JoiExtended.number().min(0).max(100).required(),
      context: JoiExtended.string().max(500).optional()
    })
  ).min(1).required(),
  
  assigned_to: JoiExtended.string().uuid().optional(),
  due_date: JoiExtended.date().iso().min('now').optional()
}).messages({
  'any.required': '{#label} is required for moderation queue items',
  'string.min': '{#label} must be at least {#limit} characters long',
  'string.max': '{#label} must not exceed {#limit} characters',
  'number.min': '{#label} must be at least {#limit}',
  'number.max': '{#label} must not exceed {#limit}',
  'array.min': 'At least {#limit} violation must be specified',
  'date.min': 'Due date must be in the future'
});

/**
 * Bulk Operation Validation Schema
 */
export const bulkOperationSchema = JoiExtended.object({
  operation: JoiExtended.string().valid('create', 'update', 'delete', 'moderate').required(),
  items: JoiExtended.array().items(
    JoiExtended.object({
      id: JoiExtended.string().uuid().required(),
      data: JoiExtended.object().optional()
    })
  ).min(1).max(100).required(),
  
  options: JoiExtended.object({
    skipValidation: JoiExtended.boolean().default(false),
    continueOnError: JoiExtended.boolean().default(true),
    batchSize: JoiExtended.number().integer().min(1).max(50).default(10),
    timeout: JoiExtended.number().integer().min(1000).max(300000).default(30000) // 1s to 5min
  }).default({})
}).messages({
  'any.required': '{#label} is required for bulk operations',
  'array.min': 'At least {#limit} item must be provided',
  'array.max': 'Maximum {#limit} items allowed per bulk operation',
  'number.min': '{#label} must be at least {#limit}',
  'number.max': '{#label} must not exceed {#limit}'
});

// Export validation functions for backward compatibility
export const validateFeedPostFilters = (data: any) => {
  return feedPostFiltersSchema.validate(data, { abortEarly: false });
};

export const validateCommentFilters = (data: any) => {
  return commentFiltersSchema.validate(data, { abortEarly: false });
};

export const validateFeedStorageConfig = (data: any) => {
  return feedStorageConfigSchema.validate(data, { abortEarly: false });
};

export const validateContentPerformance = (data: any) => {
  return contentPerformanceSchema.validate(data, { abortEarly: false });
};

export const validateModerationQueueItem = (data: any) => {
  return moderationQueueItemSchema.validate(data, { abortEarly: false });
};

export const validateBulkOperation = (data: any) => {
  return bulkOperationSchema.validate(data, { abortEarly: false });
};
