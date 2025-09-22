/**
 * Simplified Feed Validators
 * Basic validation schemas for social feed operations
 */

import * as Joi from 'joi';

/**
 * Basic Feed Post Validation Schema
 */
export const feedPostSchema = Joi.object({
  content: Joi.string()
    .min(1)
    .max(2000)
    .required()
    .messages({
      'string.empty': 'Content is required',
      'string.min': 'Content must not be empty',
      'string.max': 'Content must not exceed 2000 characters'
    }),
  category: Joi.string()
    .optional()
    .valid('beauty', 'lifestyle', 'review', 'promotion', 'general')
    .messages({
      'any.only': 'Category must be one of: beauty, lifestyle, review, promotion, general'
    }),
  location_tag: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Location tag must not exceed 100 characters'
    }),
  tagged_shop_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Tagged shop ID must be a valid UUID'
    }),
  hashtags: Joi.array()
    .items(Joi.string().max(50))
    .max(10)
    .unique()
    .optional()
    .messages({
      'array.max': 'Maximum 10 hashtags allowed',
      'array.unique': 'Duplicate hashtags are not allowed',
      'string.max': 'Each hashtag must not exceed 50 characters'
    }),
  images: Joi.array()
    .items(Joi.object({
      image_url: Joi.string().required(),
      alt_text: Joi.string().max(200).optional(),
      display_order: Joi.number().integer().min(1).max(10).required()
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

/**
 * Basic Comment Validation Schema
 */
export const commentSchema = Joi.object({
  content: Joi.string()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.empty': 'Comment content is required',
      'string.min': 'Comment content must not be empty',
      'string.max': 'Comment content must not exceed 500 characters'
    }),
  parent_comment_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Parent comment ID must be a valid UUID'
    })
});

/**
 * Basic Report Validation Schema
 */
export const reportSchema = Joi.object({
  reason: Joi.string()
    .valid(
      'spam',
      'harassment',
      'inappropriate_content',
      'fake_information',
      'violence',
      'hate_speech',
      'copyright_violation',
      'impersonation',
      'scam',
      'adult_content',
      'other'
    )
    .required()
    .messages({
      'any.only': 'Reason must be one of: spam, harassment, inappropriate_content, fake_information, violence, hate_speech, copyright_violation, impersonation, scam, adult_content, other'
    }),
  description: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Description must not exceed 500 characters'
    })
});

/**
 * Basic validation functions for backward compatibility
 */
export const validateFeedPost = (data: any) => {
  return feedPostSchema.validate(data, { abortEarly: false });
};

export const validateComment = (data: any) => {
  return commentSchema.validate(data, { abortEarly: false });
};

export const validateReport = (data: any) => {
  return reportSchema.validate(data, { abortEarly: false });
};

/**
 * Basic moderation validation (simplified)
 */
export const validateWithModeration = async (data: any, contentType: 'post' | 'comment' = 'post') => {
  const schema = contentType === 'post' ? feedPostSchema : commentSchema;
  return schema.validate(data, { abortEarly: false });
};

/**
 * Basic rate limiting validation (simplified)
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
