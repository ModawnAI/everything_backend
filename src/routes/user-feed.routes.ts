import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import feedController from '../controllers/feed.controller';
import {
  createPostLimiter,
  interactionLimiter,
  generalFeedLimiter
} from '../middleware/feed-rate-limit.middleware';
import { feedUploadErrorHandler } from '../middleware/feed-upload.middleware';

/**
 * User Feed Routes
 *
 * Handles all user-specific feed operations:
 * - POST /api/user/feed/posts - Create new post
 * - GET /api/user/feed/posts - Get user's feed
 * - GET /api/user/feed/posts/:postId - Get specific post
 * - PUT /api/user/feed/posts/:postId - Update post
 * - DELETE /api/user/feed/posts/:postId - Delete post
 * - POST /api/user/feed/posts/:postId/like - Like post
 * - DELETE /api/user/feed/posts/:postId/like - Unlike post
 * - POST /api/user/feed/posts/:postId/comments - Add comment
 * - GET /api/user/feed/posts/:postId/comments - Get comments
 * - PUT /api/user/feed/comments/:commentId - Update comment
 * - DELETE /api/user/feed/comments/:commentId - Delete comment
 * - POST /api/user/feed/comments/:commentId/like - Like comment
 * - POST /api/user/feed/posts/:postId/report - Report post
 * - POST /api/user/feed/upload-images - Upload images
 */

const router = Router();

// All user feed routes require authentication
router.use(authenticateJWT());

/**
 * @swagger
 * /api/user/feed/posts:
 *   post:
 *     tags:
 *       - User Feed
 *     summary: Create a new feed post
 *     description: Create a new feed post as a regular user
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
 *                 description: Post content
 *               category:
 *                 type: string
 *                 description: Post category
 *               locationTag:
 *                 type: string
 *                 description: Location tag
 *               taggedShopId:
 *                 type: string
 *                 description: Tagged shop ID
 *               hashtags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *                 description: Hashtags (max 10)
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     imageUrl:
 *                       type: string
 *                     altText:
 *                       type: string
 *                     displayOrder:
 *                       type: number
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Rate limit exceeded (5 posts per hour)
 */
router.post('/posts',
  createPostLimiter, // 5 posts per hour rate limit
  feedController.createPost.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts:
 *   get:
 *     tags:
 *       - User Feed
 *     summary: Get user's feed posts
 *     description: Get paginated feed posts with filtering options
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: hashtag
 *         schema:
 *           type: string
 *         description: Filter by hashtag
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *         description: Filter by author ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, popular, trending]
 *           default: recent
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Feed posts retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/posts',
  generalFeedLimiter, // 200 requests per 15 minutes
  feedController.getFeedPosts.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/my-posts:
 *   get:
 *     tags:
 *       - User Feed
 *     summary: Get user's own posts
 *     description: Get the most recent 10 posts created by the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's posts retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/my-posts',
  generalFeedLimiter, // 200 requests per 15 minutes
  feedController.getMyPosts.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/discover:
 *   get:
 *     tags:
 *       - User Feed
 *     summary: Get discover feed
 *     description: Get the most recent 10 posts from other users and shops (excluding own posts)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Discover feed retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/discover',
  generalFeedLimiter, // 200 requests per 15 minutes
  feedController.getDiscoverFeed.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/saved:
 *   get:
 *     tags:
 *       - User Feed
 *     summary: Get saved (bookmarked) posts
 *     description: Get posts that the user has saved/bookmarked
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Saved posts retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/saved',
  generalFeedLimiter,
  feedController.getSavedPosts.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}:
 *   get:
 *     tags:
 *       - User Feed
 *     summary: Get a specific feed post
 *     description: Get detailed information about a specific post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *       404:
 *         description: Post not found
 *       401:
 *         description: Authentication required
 */
router.get('/posts/:postId',
  generalFeedLimiter, // 200 requests per 15 minutes
  feedController.getPostById.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}:
 *   put:
 *     tags:
 *       - User Feed
 *     summary: Update a feed post
 *     description: Update own feed post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
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
 *               category:
 *                 type: string
 *               locationTag:
 *                 type: string
 *               taggedShopId:
 *                 type: string
 *               hashtags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       400:
 *         description: Invalid input or not authorized
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Post not found
 */
router.put('/posts/:postId',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.updatePost.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}:
 *   delete:
 *     tags:
 *       - User Feed
 *     summary: Delete a feed post
 *     description: Delete own feed post (soft delete)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       400:
 *         description: Not authorized to delete this post
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Post not found
 */
router.delete('/posts/:postId',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.deletePost.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}/like:
 *   post:
 *     tags:
 *       - User Feed
 *     summary: Like a feed post
 *     description: Like a feed post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post liked successfully
 *       400:
 *         description: Post already liked
 *       401:
 *         description: Authentication required
 */
router.post('/posts/:postId/like',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.likePost.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}/like:
 *   delete:
 *     tags:
 *       - User Feed
 *     summary: Unlike a feed post
 *     description: Remove like from a feed post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post unliked successfully
 *       401:
 *         description: Authentication required
 */
router.delete('/posts/:postId/like',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.unlikePost.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}/save:
 *   post:
 *     tags:
 *       - User Feed
 *     summary: Save (bookmark) a post
 *     description: Save a post to the user's saved/bookmarked list
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post saved successfully
 *       400:
 *         description: Post already saved
 *       401:
 *         description: Authentication required
 */
router.post('/posts/:postId/save',
  interactionLimiter,
  feedController.savePost.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}/save:
 *   delete:
 *     tags:
 *       - User Feed
 *     summary: Unsave (remove bookmark) a post
 *     description: Remove a post from the user's saved/bookmarked list
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post unsaved successfully
 *       401:
 *         description: Authentication required
 */
router.delete('/posts/:postId/save',
  interactionLimiter,
  feedController.unsavePost.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}/saved-status:
 *   get:
 *     tags:
 *       - User Feed
 *     summary: Check if post is saved
 *     description: Check if the post is saved/bookmarked by the user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Saved status retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/posts/:postId/saved-status',
  generalFeedLimiter,
  feedController.getPostSavedStatus.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}/comments:
 *   post:
 *     tags:
 *       - User Feed
 *     summary: Add a comment to a post
 *     description: Add a comment to a feed post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
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
 *                 maxLength: 1000
 *                 description: Comment content
 *               parentCommentId:
 *                 type: string
 *                 description: Parent comment ID for replies
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 */
router.post('/posts/:postId/comments',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.addComment.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}/comments:
 *   get:
 *     tags:
 *       - User Feed
 *     summary: Get comments for a post
 *     description: Get paginated comments for a feed post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/posts/:postId/comments',
  generalFeedLimiter, // 200 requests per 15 minutes
  feedController.getComments.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/comments/{commentId}:
 *   put:
 *     tags:
 *       - User Feed
 *     summary: Update a comment
 *     description: Update own comment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
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
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Invalid input or not authorized
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Comment not found
 */
router.put('/comments/:commentId',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.updateComment.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/comments/{commentId}:
 *   delete:
 *     tags:
 *       - User Feed
 *     summary: Delete a comment
 *     description: Delete own comment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       400:
 *         description: Not authorized to delete this comment
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Comment not found
 */
router.delete('/comments/:commentId',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.deleteComment.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/comments/{commentId}/like:
 *   post:
 *     tags:
 *       - User Feed
 *     summary: Like a comment
 *     description: Like a comment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment liked successfully
 *       400:
 *         description: Comment already liked
 *       401:
 *         description: Authentication required
 */
router.post('/comments/:commentId/like',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.likeComment.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/posts/{postId}/report:
 *   post:
 *     tags:
 *       - User Feed
 *     summary: Report a feed post
 *     description: Report a feed post for moderation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
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
 *                 description: Reason for reporting
 *               description:
 *                 type: string
 *                 description: Additional details
 *     responses:
 *       200:
 *         description: Post reported successfully
 *       400:
 *         description: Already reported or invalid input
 *       401:
 *         description: Authentication required
 */
router.post('/posts/:postId/report',
  interactionLimiter, // 100 interactions per 5 minutes
  feedController.reportPost.bind(feedController)
);

/**
 * @swagger
 * /api/user/feed/upload-images:
 *   post:
 *     tags:
 *       - User Feed
 *     summary: Upload images for feed posts
 *     description: Upload images to be used in feed posts (max 10 images)
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
 *               altText_0:
 *                 type: string
 *                 description: Alt text for first image
 *               altText_1:
 *                 type: string
 *                 description: Alt text for second image
 *               displayOrder_0:
 *                 type: integer
 *                 description: Display order for first image
 *               displayOrder_1:
 *                 type: integer
 *                 description: Display order for second image
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *       400:
 *         description: Invalid input or too many images
 *       401:
 *         description: Authentication required
 */
router.post('/upload-images',
  interactionLimiter, // 100 interactions per 5 minutes
  feedUploadErrorHandler, // Standardized multer upload with error handling
  feedController.uploadImages.bind(feedController)
);

export default router;
