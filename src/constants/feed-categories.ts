/**
 * Feed Post Category Constants
 *
 * Centralized definition of valid feed post categories.
 * These values MUST match the database constraint in:
 * supabase/migrations/20251024_fix_feed_posts_category_type.sql
 */

/**
 * Valid feed post category values
 * These are the ONLY values accepted by the database
 */
export const FEED_POST_CATEGORIES = {
  // Service categories (5)
  NAIL: 'nail',
  EYELASH: 'eyelash',
  WAXING: 'waxing',
  EYEBROW_TATTOO: 'eyebrow_tattoo',
  HAIR: 'hair',

  // Content categories (7)
  REVIEW: 'review',
  TUTORIAL: 'tutorial',
  BEFORE_AFTER: 'before_after',
  PROMOTION: 'promotion',
  NEWS: 'news',
  QUESTION: 'question',
  GENERAL: 'general',
} as const;

/**
 * TypeScript type for feed post categories
 */
export type FeedPostCategory = typeof FEED_POST_CATEGORIES[keyof typeof FEED_POST_CATEGORIES];

/**
 * Array of all valid category values
 */
export const VALID_FEED_CATEGORIES: readonly FeedPostCategory[] = Object.values(FEED_POST_CATEGORIES);

/**
 * Category metadata for UI display and validation
 */
export const FEED_CATEGORY_METADATA: Record<FeedPostCategory, {
  label: string;
  description: string;
  group: 'service' | 'content';
  icon?: string;
}> = {
  // Service categories
  [FEED_POST_CATEGORIES.NAIL]: {
    label: 'Nail',
    description: 'Nail care and art related posts',
    group: 'service',
    icon: '💅',
  },
  [FEED_POST_CATEGORIES.EYELASH]: {
    label: 'Eyelash',
    description: 'Eyelash extension and care posts',
    group: 'service',
    icon: '👁️',
  },
  [FEED_POST_CATEGORIES.WAXING]: {
    label: 'Waxing',
    description: 'Waxing and hair removal posts',
    group: 'service',
    icon: '✨',
  },
  [FEED_POST_CATEGORIES.EYEBROW_TATTOO]: {
    label: 'Eyebrow Tattoo',
    description: 'Eyebrow tattoo and semi-permanent makeup posts',
    group: 'service',
    icon: '🖊️',
  },
  [FEED_POST_CATEGORIES.HAIR]: {
    label: 'Hair',
    description: 'Hair styling and care posts',
    group: 'service',
    icon: '💇',
  },

  // Content categories
  [FEED_POST_CATEGORIES.REVIEW]: {
    label: 'Review',
    description: 'Product or service reviews',
    group: 'content',
    icon: '⭐',
  },
  [FEED_POST_CATEGORIES.TUTORIAL]: {
    label: 'Tutorial',
    description: 'How-to guides and tutorials',
    group: 'content',
    icon: '📚',
  },
  [FEED_POST_CATEGORIES.BEFORE_AFTER]: {
    label: 'Before/After',
    description: 'Before and after comparison photos',
    group: 'content',
    icon: '🔄',
  },
  [FEED_POST_CATEGORIES.PROMOTION]: {
    label: 'Promotion',
    description: 'Promotional offers and discounts',
    group: 'content',
    icon: '🎁',
  },
  [FEED_POST_CATEGORIES.NEWS]: {
    label: 'News',
    description: 'Beauty industry news and updates',
    group: 'content',
    icon: '📰',
  },
  [FEED_POST_CATEGORIES.QUESTION]: {
    label: 'Question',
    description: 'Questions and help requests',
    group: 'content',
    icon: '❓',
  },
  [FEED_POST_CATEGORIES.GENERAL]: {
    label: 'General',
    description: 'General posts and discussions',
    group: 'content',
    icon: '📝',
  },
};

/**
 * Get category metadata by category value
 */
export function getCategoryMetadata(category: FeedPostCategory) {
  return FEED_CATEGORY_METADATA[category];
}

/**
 * Check if a value is a valid feed post category
 */
export function isValidFeedCategory(value: any): value is FeedPostCategory {
  return VALID_FEED_CATEGORIES.includes(value as FeedPostCategory);
}

/**
 * Get categories by group
 */
export function getCategoriesByGroup(group: 'service' | 'content'): FeedPostCategory[] {
  return VALID_FEED_CATEGORIES.filter(
    category => FEED_CATEGORY_METADATA[category].group === group
  );
}

/**
 * Service categories only
 */
export const SERVICE_CATEGORIES = getCategoriesByGroup('service');

/**
 * Content categories only
 */
export const CONTENT_CATEGORIES = getCategoriesByGroup('content');
