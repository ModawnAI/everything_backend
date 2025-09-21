/**
 * Feed Validators
 * 
 * Validation schemas for social feed operations
 */

import Joi from 'joi';

/**
 * Feed Post Validation Schema
 */
export const validateFeedPost = (data: any) => {
  const schema = Joi.object({
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
      .valid('hair', 'nail', 'skin', 'eyebrow', 'eyelash', 'makeup', 'other')
      .messages({
        'any.only': 'Category must be one of: hair, nail, skin, eyebrow, eyelash, makeup, other'
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
      .optional()
      .messages({
        'array.max': 'Maximum 10 hashtags allowed',
        'string.max': 'Each hashtag must not exceed 50 characters'
      }),
    images: Joi.array()
      .items(Joi.object({
        image_url: Joi.string().uri().required(),
        alt_text: Joi.string().max(200).optional(),
        display_order: Joi.number().integer().min(0).max(9).required()
      }))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 images allowed',
        'string.uri': 'Image URL must be a valid URI',
        'string.max': 'Alt text must not exceed 200 characters',
        'number.min': 'Display order must be at least 0',
        'number.max': 'Display order must be at most 9'
      })
  });

  return schema.validate(data, { abortEarly: false });
};

/**
 * Comment Validation Schema
 */
export const validateComment = (data: any) => {
  const schema = Joi.object({
    content: Joi.string()
      .min(1)
      .max(1000)
      .required()
      .messages({
        'string.empty': 'Comment content is required',
        'string.min': 'Comment content must not be empty',
        'string.max': 'Comment content must not exceed 1000 characters'
      }),
    parent_comment_id: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Parent comment ID must be a valid UUID'
      })
  });

  return schema.validate(data, { abortEarly: false });
};

/**
 * Feed Query Validation Schema
 */
export const validateFeedQuery = (data: any) => {
  const schema = Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .optional()
      .default(1)
      .messages({
        'number.min': 'Page must be at least 1',
        'number.max': 'Page must not exceed 1000'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 50'
      }),
    category: Joi.string()
      .valid('hair', 'nail', 'skin', 'eyebrow', 'eyelash', 'makeup', 'other')
      .optional()
      .messages({
        'any.only': 'Category must be one of: hair, nail, skin, eyebrow, eyelash, makeup, other'
      }),
    hashtag: Joi.string()
      .max(50)
      .optional()
      .messages({
        'string.max': 'Hashtag must not exceed 50 characters'
      }),
    location: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.max': 'Location must not exceed 100 characters'
      }),
    author_id: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Author ID must be a valid UUID'
      }),
    sort: Joi.string()
      .valid('recent', 'popular', 'trending')
      .optional()
      .default('recent')
      .messages({
        'any.only': 'Sort must be one of: recent, popular, trending'
      })
  });

  return schema.validate(data, { abortEarly: false });
};

/**
 * Report Validation Schema
 */
export const validateReport = (data: any) => {
  const schema = Joi.object({
    reason: Joi.string()
      .valid(
        'spam',
        'harassment',
        'inappropriate_content',
        'fake_information',
        'violence',
        'hate_speech',
        'other'
      )
      .required()
      .messages({
        'any.only': 'Reason must be one of: spam, harassment, inappropriate_content, fake_information, violence, hate_speech, other'
      }),
    description: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Description must not exceed 500 characters'
      })
  });

  return schema.validate(data, { abortEarly: false });
};
