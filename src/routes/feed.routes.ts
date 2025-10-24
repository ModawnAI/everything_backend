/**
 * @swagger
 * tags:
 *   - name: Social Feed
 *     description: Social feed management APIs for posts, interactions, and content
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 */

/**
 * Feed Routes
 * 
 * Defines all social feed-related API endpoints including:
 * - Feed post CRUD operations (create, read, update, delete)
 * - Post interaction endpoints (likes, comments)
 * - Feed algorithm and content ranking
 * - Image upload and processing for posts
 * - Rate limiting for post creation (5 posts per hour per user)
 */

import { Router } from 'express';
import multer from 'multer';
import { FeedController } from '../controllers/feed.controller';
import {
  getPersonalizedFeed,
  getTrendingContent,
  recordInteraction,
  getFeedAnalytics,
  getPersonalizedWeights,
  updatePersonalizedWeights
} from '../controllers/feed-ranking.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import { xssProtection } from '../middleware/xss-csrf-protection.middleware';
import { SecurityValidationMiddleware } from '../middleware/security-validation.middleware';
// import {
//   feedSecurityMiddleware,
//   commentSecurityMiddleware,
//   imageSecurityMiddleware
// } from '../middleware/feed-security.middleware';
import {
  requireFeedPostPermission,
  requireFeedCommentPermission,
  requireFeedLikePermission,
  requireFeedReportPermission,
  requireFeedModerationPermission
} from '../middleware/rbac-content-integration.middleware';
import {
  createPostCSRFSanitization,
  createCommentCSRFSanitization,
  createReportCSRFSanitization,
  createUploadCSRFSanitization
} from '../middleware/csrf-sanitization-integration.middleware';
// import {
//   feedPostSchema,
//   commentSchema,
//   reportSchema,
//   validateWithModeration,
//   validateRateLimit
// } from '../validators/feed.validators';

const router = Router();
const feedController = new FeedController();

// Initialize security validation middleware
const securityValidator = new SecurityValidationMiddleware({
  enableThreatDetection: true,
  enableSecurityLogging: true,
  enableInputSanitization: true,
  enableRateLimiting: true,
  maxThreatsPerRequest: 3
});

// Multer configuration for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB per file
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

// Rate limiting configurations
const feedGeneralRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs for general feed operations
    strategy: 'fixed_window'
  }
});

const feedPostCreationRateLimit = rateLimit({
  config: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each user to 5 post creations per hour
    strategy: 'fixed_window',
    keyGenerator: (req: any) => {
      // Use user ID for authenticated requests, fall back to IP
      return req.user?.id || req.ip;
    }
  }
});

const feedInteractionRateLimit = rateLimit({
  config: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // limit each user to 100 interactions (likes/comments) per 5 minutes
    strategy: 'fixed_window'
  }
});

// Apply security middleware to all feed routes
router.use(xssProtection());

// Apply authentication to all routes
router.use(authenticateJWT());

/**
 * @swagger
 * /api/feed/posts:
 *   post:
 *     summary: 새로운 피드 게시물 작성
 *     description: |
 *       텍스트 콘텐츠, 이미지, 해시태그, 위치 태그를 포함한 새로운 소셜 피드 게시물을 작성합니다.
 *       뷰티 서비스 경험을 공유하고 다른 사용자들과 소통할 수 있습니다.
 *       
 *       **주요 기능:**
 *       - 텍스트 콘텐츠 작성 (최대 2000자)
 *       - 이미지 업로드 (최대 10개)
 *       - 해시태그 추가 (최대 10개)
 *       - 위치 및 샵 태그
 *       - 속도 제한 (사용자당 시간당 5개 게시물)
 *       - 자동 콘텐츠 검토
 *       
 *       **인증:** 유효한 JWT 토큰이 필요합니다.
 *       
 *       ---
 *       
 *       **English:** Create a new social feed post with content, images, hashtags, and location tagging.
 *       
 *       **Features:**
 *       - Content validation (max 2000 characters)
 *       - Image upload support (max 10 images)
 *       - Hashtag support (max 10 hashtags)
 *       - Location tagging and shop tagging
 *       - Rate limiting (5 posts per hour per user)
 *       - Automatic content moderation
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Post content text
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *                 example: "Just had an amazing nail service at this salon! 💅 #nails #beauty"
 *               category:
 *                 type: string
 *                 enum: [beauty, lifestyle, review, promotion, general]
 *                 description: Post category
 *                 example: "beauty"
 *               location_tag:
 *                 type: string
 *                 maxLength: 100
 *                 description: Location where the post was created
 *                 example: "강남구, 서울"
 *               tagged_shop_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the shop being tagged in the post
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               hashtags:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 description: Array of hashtags (without # symbol)
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *                 example: ["nails", "beauty", "salon", "manicure"]
 *               images:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   required:
 *                     - image_url
 *                     - display_order
 *                   properties:
 *                     image_url:
 *                       type: string
 *                       format: uri
 *                       description: URL of the uploaded image
 *                     alt_text:
 *                       type: string
 *                       maxLength: 200
 *                       description: Alternative text for accessibility
 *                     display_order:
 *                       type: integer
 *                       minimum: 1
 *                       description: Order in which images should be displayed
 *                 description: Array of images to attach to the post
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Post created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/FeedPost'
 *       400:
 *         description: Validation error or content policy violation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Content exceeds maximum length of 2000 characters"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       429:
 *         description: Rate limit exceeded - Too many posts created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Rate limit exceeded. Maximum 5 posts per hour allowed."
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /posts:
 *   post:
 *     summary: POST /posts (POST /posts)
 *     description: POST endpoint for /posts
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.post('/posts',
  feedGeneralRateLimit,
  feedPostCreationRateLimit,
  // CSRF protection removed - JWT in Authorization header already provides CSRF protection
  requireFeedPostPermission('create'),
  // ...feedSecurityMiddleware(),
  // validateRequestBody(feedPostSchema),
  feedController.createPost.bind(feedController)
);

/**
 * @swagger
 * /api/feed/posts:
 *   get:
 *     summary: feed posts with pagination and filtering 조회
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieve social feed posts with advanced filtering, pagination, and algorithm-based ranking.
 *       
 *       **Features:**
 *       - Algorithm-based ranking (recency 40%, engagement 30%, relevance 20%, author influence 10%)
 *       - Filter by category, hashtags, location, and author
 *       - Pagination support with limit and offset
 *       - User-specific like status included
 *       - Author and shop information included
 *       - Image metadata included
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of posts per page (max 50)
 *         example: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [beauty, lifestyle, review, promotion, general]
 *         description: Filter posts by category
 *         example: "beauty"
 *       - in: query
 *         name: hashtag
 *         schema:
 *           type: string
 *           maxLength: 50
 *         description: Filter posts by hashtag (without # symbol)
 *         example: "nails"
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Filter posts by location (partial match)
 *         example: "강남"
 *       - in: query
 *         name: author_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter posts by specific author
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeedPost'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total:
 *                           type: integer
 *                           example: 150
 *                         totalPages:
 *                           type: integer
 *                           example: 8
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more posts available
 *                       example: true
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /posts:
 *   get:
 *     summary: /posts 조회
 *     description: GET endpoint for /posts
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/posts',
  feedGeneralRateLimit,
  requireFeedPostPermission('list'),
  feedController.getFeedPosts.bind(feedController)
);

/**
 * @swagger
 * /api/feed/posts/{postId}:
 *   get:
 *     summary: a specific feed post by ID 조회
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieve detailed information about a specific feed post including author info, 
 *       images, comments, and user interaction status.
 *       
 *       **Features:**
 *       - Complete post details with author information
 *       - All attached images with metadata
 *       - User's like status for the post
 *       - Tagged shop information if applicable
 *       - View count tracking
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the post
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/FeedPost'
 *       404:
 *         description: Post not found or has been deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Post not found"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /posts/:postId:
 *   get:
 *     summary: /posts/:postId 조회
 *     description: GET endpoint for /posts/:postId
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/posts/:postId',
  feedGeneralRateLimit,
  requireFeedPostPermission('read'),
  feedController.getPostById.bind(feedController)
);

/**
 * @swagger
 * /api/feed/posts/{postId}:
 *   put:
 *     summary: a feed post 수정
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Update an existing feed post. Only the post author can update their own posts.
 *       
 *       **Features:**
 *       - Update content, hashtags, and location
 *       - Add or remove images
 *       - Content validation and moderation
 *       - Author ownership verification
 *       
 *       **Authorization:** Requires valid JWT token. Only post author can update.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the post to update
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Updated post content
 *               hashtags:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 description: Updated hashtags array
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *               location_tag:
 *                 type: string
 *                 maxLength: 100
 *                 description: Updated location tag
 *               images:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   properties:
 *                     image_url:
 *                       type: string
 *                       format: uri
 *                     alt_text:
 *                       type: string
 *                       maxLength: 200
 *                     display_order:
 *                       type: integer
 *                       minimum: 1
 *                 description: Updated images array
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Post updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/FeedPost'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Invalid token or not post author
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /posts/:postId:
 *   put:
 *     summary: PUT /posts/:postId (PUT /posts/:postId)
 *     description: PUT endpoint for /posts/:postId
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.put('/posts/:postId',
  feedGeneralRateLimit,
  // CSRF protection removed - JWT provides protection
  requireFeedPostPermission('update'),
  // validateRequestBody(feedPostSchema),
  feedController.updatePost.bind(feedController)
);

/**
 * @swagger
 * /api/feed/posts/{postId}:
 *   delete:
 *     summary: a feed post 삭제
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Delete a feed post. Only the post author or admin can delete posts.
 *       This performs a soft delete by setting status to 'deleted'.
 *       
 *       **Features:**
 *       - Soft delete (preserves data for analytics)
 *       - Author ownership verification
 *       - Admin override capability
 *       - Cascade handling for likes and comments
 *       
 *       **Authorization:** Requires valid JWT token. Only post author or admin can delete.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the post to delete
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Post deleted successfully"
 *       401:
 *         description: Unauthorized - Invalid token or not post author
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal server error
 */
router.delete('/posts/:postId',
  feedGeneralRateLimit,
  // CSRF protection removed - JWT provides protection
  requireFeedPostPermission('delete'),
  feedController.deletePost.bind(feedController)
);

/**
 * @swagger
 * /api/feed/posts/{postId}/like:
 *   post:
 *     summary: Like or unlike a feed post (Like or unlike a feed post)
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Toggle like status for a feed post. If already liked, removes the like.
 *       If not liked, adds a like. Updates the post's like count.
 *       
 *       **Features:**
 *       - Toggle like/unlike functionality
 *       - Real-time like count updates
 *       - Duplicate like prevention
 *       - Rate limiting for interactions
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the post to like/unlike
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Like status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Post liked successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isLiked:
 *                       type: boolean
 *                       description: Current like status after the operation
 *                       example: true
 *                     likeCount:
 *                       type: integer
 *                       description: Updated total like count
 *                       example: 42
 *       404:
 *         description: Post not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       429:
 *         description: Rate limit exceeded for interactions
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /posts/:postId/like:
 *   post:
 *     summary: POST /posts/:postId/like (POST /posts/:postId/like)
 *     description: POST endpoint for /posts/:postId/like
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.post('/posts/:postId/like',
  feedGeneralRateLimit,
  feedInteractionRateLimit,
  // CSRF protection removed - JWT provides protection
  requireFeedLikePermission('create'),
  feedController.likePost.bind(feedController)
);

/**
 * @swagger
 * /api/feed/posts/{postId}/report:
 *   post:
 *     summary: Report a feed post for policy violations (Report a feed post for policy violations)
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Allows authenticated users to report a feed post for various policy violations.
 *       Reports are tracked and can trigger automatic moderation actions when thresholds are reached.
 *       
 *       **Features:**
 *       - Multiple report categories (spam, harassment, inappropriate content, etc.)
 *       - Optional detailed description
 *       - Automatic duplicate report prevention
 *       - Integration with content moderation system
 *       - Rate limiting to prevent abuse
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Unique ID of the feed post to report
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [spam, harassment, inappropriate_content, fake_information, violence, hate_speech, copyright_violation, impersonation, scam, adult_content, other]
 *                 description: Category of the policy violation
 *                 example: "spam"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional detailed description of the violation
 *                 example: "This post contains repetitive promotional content that appears to be spam"
 *     responses:
 *       200:
 *         description: Post reported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Post reported successfully"
 *       400:
 *         description: Bad request - Invalid report data or duplicate report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missing_reason: "Report reason is required"
 *                     duplicate_report: "You have already reported this post"
 *                     invalid_reason: "Invalid report reason"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Post not found"
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * @swagger
 * /posts/:postId/report:
 *   post:
 *     summary: POST /posts/:postId/report (POST /posts/:postId/report)
 *     description: POST endpoint for /posts/:postId/report
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.post('/posts/:postId/report',
  feedGeneralRateLimit,
  feedInteractionRateLimit,
  // CSRF protection removed - JWT provides protection
  requireFeedReportPermission('create'),
  // validateRequestBody(reportSchema),
  feedController.reportPost.bind(feedController)
);

/**
 * @swagger
 * /api/feed/posts/{postId}/comments:
 *   post:
 *     summary: Add a comment to a feed post (Add a comment to a feed post)
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Add a new comment to a feed post. Comments support text content and
 *       basic formatting. Updates the post's comment count.
 *       
 *       **Features:**
 *       - Text comment support
 *       - Content validation and moderation
 *       - Real-time comment count updates
 *       - Rate limiting for interactions
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the post to comment on
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 500
 *                 description: Comment text content
 *                 example: "Great post! Love the nail art! 💅"
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment added successfully"
 *                 data:
 *                   $ref: '#/components/schemas/FeedComment'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Post not found
 *       429:
 *         description: Rate limit exceeded for interactions
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /posts/:postId/comments:
 *   post:
 *     summary: POST /posts/:postId/comments (POST /posts/:postId/comments)
 *     description: POST endpoint for /posts/:postId/comments
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.post('/posts/:postId/comments',
  feedGeneralRateLimit,
  feedInteractionRateLimit,
  // CSRF protection removed - JWT provides protection
  requireFeedCommentPermission('create'),
  // ...commentSecurityMiddleware(),
  // validateRequestBody(commentSchema),
  feedController.addComment.bind(feedController)
);

/**
 * @swagger
 * /api/feed/posts/{postId}/comments:
 *   get:
 *     summary: comments for a feed post 조회
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieve all comments for a specific feed post with pagination support.
 *       Comments are ordered by creation date (newest first).
 *       
 *       **Features:**
 *       - Pagination support
 *       - Author information included
 *       - Chronological ordering
 *       - Comment count and metadata
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the post
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of comments per page (max 50)
 *         example: 20
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     comments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeedComment'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total:
 *                           type: integer
 *                           example: 45
 *                         totalPages:
 *                           type: integer
 *                           example: 3
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: Post not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /posts/:postId/comments:
 *   get:
 *     summary: /posts/:postId/comments 조회
 *     description: GET endpoint for /posts/:postId/comments
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/posts/:postId/comments',
  feedGeneralRateLimit,
  requireFeedCommentPermission('list'),
  feedController.getComments.bind(feedController)
);

/**
 * @swagger
 * /api/feed/upload-images:
 *   post:
 *     summary: Upload images for feed posts (Upload images for feed posts)
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Upload multiple images for use in feed posts. Images are processed and optimized
 *       automatically using Sharp. Returns URLs that can be used when creating posts.
 *       
 *       **Features:**
 *       - Multiple image upload (max 10 images)
 *       - Automatic image optimization and resizing
 *       - Multiple format generation (thumbnail, medium, large)
 *       - WebP conversion for optimal performance
 *       - File validation and security checks
 *       - Rate limiting for upload operations
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 10
 *                 description: Image files to upload (max 10, 8MB each)
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *               altText_0:
 *                 type: string
 *                 maxLength: 200
 *                 description: Alternative text for first image
 *               altText_1:
 *                 type: string
 *                 maxLength: 200
 *                 description: Alternative text for second image
 *               displayOrder_0:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Display order for first image
 *               displayOrder_1:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Display order for second image
 *           encoding:
 *             images:
 *               contentType: image/jpeg, image/png, image/webp
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Images uploaded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     images:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           imageUrl:
 *                             type: string
 *                             format: uri
 *                             description: Main image URL for feed display
 *                             example: "https://storage.supabase.co/v1/object/public/feed-posts/medium/user123/1640995200000-abc123.webp"
 *                           thumbnailUrl:
 *                             type: string
 *                             format: uri
 *                             description: Thumbnail URL for previews
 *                             example: "https://storage.supabase.co/v1/object/public/feed-posts/thumbnails/user123/1640995200000-abc123.webp"
 *                           altText:
 *                             type: string
 *                             description: Alternative text for accessibility
 *                             example: "Beautiful nail art design"
 *                           displayOrder:
 *                             type: integer
 *                             description: Order in which image should be displayed
 *                             example: 1
 *                           metadata:
 *                             type: object
 *                             properties:
 *                               originalSize:
 *                                 type: integer
 *                                 description: Original file size in bytes
 *                                 example: 2048576
 *                               optimizedSize:
 *                                 type: integer
 *                                 description: Optimized file size in bytes
 *                                 example: 512000
 *                               width:
 *                                 type: integer
 *                                 description: Image width in pixels
 *                                 example: 800
 *                               height:
 *                                 type: integer
 *                                 description: Image height in pixels
 *                                 example: 600
 *                               format:
 *                                 type: string
 *                                 description: Optimized image format
 *                                 example: "webp"
 *       400:
 *         description: Validation error or upload failure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     no_images: "No images provided"
 *                     too_many: "Maximum 10 images allowed per upload"
 *                     invalid_format: "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
 *                     too_large: "File size exceeds maximum limit of 8MB"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       413:
 *         description: Payload too large - File size exceeds limit
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /upload-images:
 *   post:
 *     summary: POST /upload-images (POST /upload-images)
 *     description: POST endpoint for /upload-images
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.post('/upload-images',
  feedGeneralRateLimit,
  feedInteractionRateLimit, // Use interaction rate limit for uploads
  // CSRF protection removed - JWT in Authorization header already provides CSRF protection
  requireFeedPostPermission('create'), // Users need post creation permission to upload images
  // imageSecurityMiddleware(),
  upload.array('images', 10), // Accept up to 10 images
  feedController.uploadImages.bind(feedController)
);

// ========================================
// FEED RANKING AND PERSONALIZATION ROUTES
// ========================================

/**
 * @swagger
 * /api/feed/personalized:
 *   post:
 *     summary: personalized feed for user 조회
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Generates a personalized feed based on user preferences, interaction history,
 *       and sophisticated ranking algorithms. Supports various filtering options and
 *       returns posts with detailed ranking metrics.
 *       
 *       **Features:**
 *       - Personalized content ranking based on user interests
 *       - Time-based filtering (hour, day, week, month)
 *       - Category and location filtering
 *       - Diversity boost to prevent filter bubbles
 *       - Customizable ranking weights
 *       
 *       **Ranking Factors:**
 *       - Recency (40%): How recent the content is
 *       - Engagement (30%): Likes, comments, shares per view
 *       - Relevance (20%): Match with user interests and preferences
 *       - Author Influence (10%): Influencer and verified user content
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 20
 *                 description: Number of posts to return
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *               offset:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 description: Number of posts to skip for pagination
 *               timeWindow:
 *                 type: string
 *                 enum: [hour, day, week, month]
 *                 default: week
 *                 description: Time window for content selection
 *               includeFollowedOnly:
 *                 type: boolean
 *                 default: false
 *                 description: Only include posts from followed users
 *               categoryFilter:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *                 description: Filter by specific categories
 *               locationFilter:
 *                 type: string
 *                 maxLength: 100
 *                 description: Filter by location tag
 *               minQualityScore:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Minimum quality score threshold
 *               diversityBoost:
 *                 type: boolean
 *                 default: true
 *                 description: Apply diversity algorithm to prevent filter bubbles
 *               personalizedWeights:
 *                 type: object
 *                 properties:
 *                   recency:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   engagement:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   relevance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   authorInfluence:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                 description: Custom ranking weights (must sum to 1.0)
 *     responses:
 *       200:
 *         description: Personalized feed generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "123e4567-e89b-12d3-a456-426614174000"
 *                           content:
 *                             type: string
 *                             example: "Amazing nail art design! 💅✨"
 *                           category:
 *                             type: string
 *                             example: "beauty"
 *                           location_tag:
 *                             type: string
 *                             example: "Gangnam-gu, Seoul"
 *                           hashtags:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["nailart", "beauty", "koreanstyle"]
 *                           images:
 *                             type: array
 *                             items:
 *                               type: object
 *                           author:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               name:
 *                                 type: string
 *                               nickname:
 *                                 type: string
 *                               profile_image_url:
 *                                 type: string
 *                               is_influencer:
 *                                 type: boolean
 *                               verification_status:
 *                                 type: string
 *                           stats:
 *                             type: object
 *                             properties:
 *                               like_count:
 *                                 type: integer
 *                               comment_count:
 *                                 type: integer
 *                               share_count:
 *                                 type: integer
 *                               view_count:
 *                                 type: integer
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         nextOffset:
 *                           type: integer
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         rankingFactors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               postId:
 *                                 type: string
 *                               finalScore:
 *                                 type: number
 *                               engagementRate:
 *                                 type: number
 *                               viralityScore:
 *                                 type: number
 *                               qualityScore:
 *                                 type: number
 *                               freshnessScore:
 *                                 type: number
 *                               relevanceScore:
 *                                 type: number
 *                               authorInfluenceScore:
 *                                 type: number
 *                               rankingFactors:
 *                                 type: object
 *                 message:
 *                   type: string
 *                   example: "Personalized feed generated successfully."
 *       400:
 *         description: Validation error
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /personalized:
 *   post:
 *     summary: POST /personalized (POST /personalized)
 *     description: POST endpoint for /personalized
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.post('/personalized',
  feedGeneralRateLimit,
  authenticateJWT,
  getPersonalizedFeed
);

/**
 * @swagger
 * /api/feed/trending:
 *   get:
 *     summary: trending content 조회
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves trending content based on engagement velocity and virality metrics.
 *       Supports filtering by timeframe, category, and location.
 *       
 *       **Trending Calculation:**
 *       - Engagement velocity (70%): Engagement per hour since post creation
 *       - Virality score (30%): High engagement in short time periods
 *       - Real-time updates every 10 minutes
 *       
 *       **Authorization:** Public endpoint, no authentication required.
 *     tags: [Social Feed]
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [hour, day, week]
 *           default: day
 *         description: Time window for trending calculation
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           maxLength: 50
 *         description: Filter by content category
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Filter by location
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of trending posts to return
 *     responses:
 *       200:
 *         description: Trending content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     trending:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           postId:
 *                             type: string
 *                             format: uuid
 *                           trendingScore:
 *                             type: number
 *                             example: 85.7
 *                           category:
 *                             type: string
 *                             example: "beauty"
 *                           location:
 *                             type: string
 *                             example: "Gangnam-gu, Seoul"
 *                           timeframe:
 *                             type: string
 *                             example: "day"
 *                           metrics:
 *                             type: object
 *                             properties:
 *                               engagementVelocity:
 *                                 type: number
 *                               shareRate:
 *                                 type: number
 *                               commentRate:
 *                                 type: number
 *                               uniqueViewers:
 *                                 type: integer
 *                     timeframe:
 *                       type: string
 *                     category:
 *                       type: string
 *                     location:
 *                       type: string
 *                 message:
 *                   type: string
 *                   example: "Trending content retrieved successfully."
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /trending:
 *   get:
 *     summary: /trending 조회
 *     description: GET endpoint for /trending
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/trending',
  getTrendingContent
);

/**
 * @swagger
 * /api/feed/interactions:
 *   post:
 *     summary: Record user interaction for preference learning (Record user interaction for preference learning)
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Records user interactions (likes, comments, shares, views) to improve
 *       personalized feed recommendations and user preference modeling.
 *       
 *       **Interaction Types:**
 *       - like: User liked a post
 *       - comment: User commented on a post
 *       - share: User shared a post
 *       - view: User viewed a post
 *       
 *       **Preference Learning:**
 *       - Category interest updates
 *       - Author preference tracking
 *       - Engagement pattern analysis
 *       - Time-based behavior modeling
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - type
 *                 - postId
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [like, comment, share, view]
 *                   description: Type of interaction
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *                   example: "like"
 *                 postId:
 *                   type: string
 *                   format: uuid
 *                   description: ID of the post interacted with
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 category:
 *                   type: string
 *                   maxLength: 50
 *                   description: Post category (optional)
 *                   example: "beauty"
 *                 authorId:
 *                   type: string
 *                   format: uuid
 *                   description: Post author ID (optional)
 *                   example: "456e7890-e89b-12d3-a456-426614174001"
 *     responses:
 *       200:
 *         description: Interaction recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Interaction recorded successfully for preference learning."
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /interactions:
 *   post:
 *     summary: POST /interactions (POST /interactions)
 *     description: POST endpoint for /interactions
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.post('/interactions',
  feedInteractionRateLimit,
  authenticateJWT,
  recordInteraction
);

/**
 * @swagger
 * /api/feed/analytics:
 *   get:
 *     summary: feed analytics for user 조회
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves comprehensive feed analytics including engagement metrics,
 *       content performance, and personalization insights for the authenticated user.
 *       
 *       **Analytics Include:**
 *       - Total posts created
 *       - Average engagement rate
 *       - Top performing categories
 *       - Engagement trends over time
 *       - Personalization effectiveness score
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: week
 *         description: Time window for analytics
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     responses:
 *       200:
 *         description: Feed analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     analytics:
 *                       type: object
 *                       properties:
 *                         totalPosts:
 *                           type: integer
 *                         avgEngagementRate:
 *                           type: number
 *                         topCategories:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                         engagementTrends:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                               engagement:
 *                                 type: number
 *                         personalizedScore:
 *                           type: number
 *                     timeframe:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "Feed analytics retrieved successfully."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: /analytics 조회
 *     description: GET endpoint for /analytics
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/analytics',
  authenticateJWT,
  getFeedAnalytics
);

/**
 * @swagger
 * /api/feed/weights:
 *   get:
 *     summary: personalized ranking weights 조회
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves the current personalized ranking weights used for the user's
 *       feed algorithm. Shows how different factors are weighted in content ranking.
 *       
 *       **Ranking Factors:**
 *       - Recency: How much recent content is prioritized
 *       - Engagement: How much high-engagement content is prioritized  
 *       - Relevance: How much personalized content is prioritized
 *       - Author Influence: How much influencer content is prioritized
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personalized weights retrieved successfully
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     weights:
 *                       type: object
 *                       properties:
 *                         recency:
 *                           type: number
 *                           example: 0.4
 *                         engagement:
 *                           type: number
 *                           example: 0.3
 *                         relevance:
 *                           type: number
 *                           example: 0.2
 *                         authorInfluence:
 *                           type: number
 *                           example: 0.1
 *                     preferences:
 *                       type: object
 *                       properties:
 *                         categoryInterests:
 *                           type: array
 *                           items:
 *                             type: string
 *                         personalityProfile:
 *                           type: object
 *                     explanation:
 *                       type: object
 *                 message:
 *                   type: string
 *                   example: "Personalized weights retrieved successfully."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /weights:
 *   get:
 *     summary: /weights 조회
 *     description: GET endpoint for /weights
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/weights',
  authenticateJWT,
  getPersonalizedWeights
);

/**
 * @swagger
 * /api/feed/weights:
 *   put:
 *     summary: personalized ranking weights 수정
 *     description: |
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Allows users to customize their feed ranking weights to control
 *       what type of content appears in their personalized feed.
 *       
 *       **Customization Options:**
 *       - Adjust recency vs engagement balance
 *       - Control relevance vs discovery ratio
 *       - Fine-tune influencer content visibility
 *       - Weights must sum to 1.0
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - recency
 *                 - engagement
 *                 - relevance
 *                 - authorInfluence
 *               properties:
 *                 recency:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 1
 *                   description: Weight for content recency (0-1)
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *                   example: 0.4
 *                 engagement:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 1
 *                   description: Weight for content engagement (0-1)
 *                   example: 0.3
 *                 relevance:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 1
 *                   description: Weight for content relevance (0-1)
 *                   example: 0.2
 *                 authorInfluence:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 1
 *                   description: Weight for author influence (0-1)
 *                   example: 0.1
 *     responses:
 *       200:
 *         description: Personalized weights updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     weights:
 *                       type: object
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "Personalized weights updated successfully."
 *       400:
 *         description: Validation error or invalid weights
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /weights:
 *   put:
 *     summary: PUT /weights (PUT /weights)
 *     description: PUT endpoint for /weights
 *       
 *       소셜 피드 관련 API입니다. 게시물 작성, 조회, 상호작용 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.put('/weights',
  authenticateJWT,
  updatePersonalizedWeights
);

export default router;
