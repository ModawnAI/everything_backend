/**
 * @swagger
 * tags:
 *   - name: Reviews
 *     description: Shop and service reviews management APIs
 *
 *       리뷰 관리 API입니다. 리뷰 작성, 조회, 수정, 삭제 기능을 제공합니다.
 */

/**
 * Review Routes
 *
 * Handles shop and service reviews with auto-post to feed functionality
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { reviewService } from '../services/review.service';
import { logger } from '../utils/logger';

const router = Router();

// Rate limiters
const reviewLimiter = rateLimit({
  config: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 reviews per hour
    message: 'Too many review requests, please try again later'
  }
});

const generalLimiter = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later'
  }
});

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Create a new review
 *     description: Create a review for a shop with optional auto-post to feed
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shopId
 *               - rating
 *             properties:
 *               shopId:
 *                 type: string
 *                 format: uuid
 *               reservationId:
 *                 type: string
 *                 format: uuid
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               content:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     alt_text:
 *                       type: string
 *               autoPostToFeed:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 */
router.post('/',
  authenticateJWT,
  reviewLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { shopId, reservationId, rating, content, images, autoPostToFeed } = req.body;

      if (!shopId || !rating) {
        res.status(400).json({ success: false, error: 'Shop ID and rating are required' });
        return;
      }

      const result = await reviewService.createReview(
        {
          user_id: userId,
          shop_id: shopId,
          reservation_id: reservationId,
          rating,
          content,
          images
        },
        { autoPostToFeed: autoPostToFeed === true }
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json({
        success: true,
        message: '리뷰가 등록되었습니다.',
        data: result.review
      });

    } catch (error) {
      logger.error('Error creating review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/shops/{shopId}:
 *   get:
 *     summary: Get shop reviews
 *     description: Get all reviews for a specific shop
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get('/shops/:shopId',
  generalLimiter,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const minRating = req.query.minRating ? parseInt(req.query.minRating as string) : undefined;

      const result = await reviewService.getShopReviews(shopId, { limit, offset, minRating });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          reviews: result.reviews,
          pagination: result.pagination
        }
      });

    } catch (error) {
      logger.error('Error fetching shop reviews', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/shops/{shopId}/rating:
 *   get:
 *     summary: Get shop average rating
 *     description: Get the average rating and review count for a shop
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rating retrieved successfully
 */
router.get('/shops/:shopId/rating',
  generalLimiter,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;

      const result = await reviewService.getShopRating(shopId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          rating: result.rating,
          reviewCount: result.count
        }
      });

    } catch (error) {
      logger.error('Error fetching shop rating', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/my:
 *   get:
 *     summary: Get current user's reviews
 *     description: Get all reviews created by the current user
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/my',
  authenticateJWT,
  generalLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await reviewService.getUserReviews(userId, { limit, offset });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          reviews: result.reviews,
          pagination: result.pagination
        }
      });

    } catch (error) {
      logger.error('Error fetching user reviews', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/{reviewId}:
 *   get:
 *     summary: Get a single review
 *     description: Get details of a specific review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Review retrieved successfully
 *       404:
 *         description: Review not found
 */
router.get('/:reviewId',
  generalLimiter,
  async (req: Request, res: Response) => {
    try {
      const { reviewId } = req.params;

      const result = await reviewService.getReview(reviewId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json({
        success: true,
        data: result.review
      });

    } catch (error) {
      logger.error('Error fetching review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: req.params.reviewId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/{reviewId}:
 *   put:
 *     summary: Update a review
 *     description: Update an existing review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               content:
 *                 type: string
 *               images:
 *                 type: array
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Review not found
 */
router.put('/:reviewId',
  authenticateJWT,
  generalLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { reviewId } = req.params;
      const { rating, content, images } = req.body;

      const result = await reviewService.updateReview(reviewId, userId, { rating, content, images });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        message: '리뷰가 수정되었습니다.',
        data: result.review
      });

    } catch (error) {
      logger.error('Error updating review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: req.params.reviewId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review
 *     description: Delete an existing review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Review not found
 */
router.delete('/:reviewId',
  authenticateJWT,
  generalLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { reviewId } = req.params;

      const result = await reviewService.deleteReview(reviewId, userId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        message: '리뷰가 삭제되었습니다.'
      });

    } catch (error) {
      logger.error('Error deleting review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: req.params.reviewId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/{reviewId}/response:
 *   post:
 *     summary: Add owner response to review
 *     description: Shop owner adds a response to a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response added successfully
 *       401:
 *         description: Authentication required or not authorized
 */
router.post('/:reviewId/response',
  authenticateJWT,
  generalLimiter,
  async (req: Request, res: Response) => {
    try {
      const ownerId = (req as any).user?.id;
      if (!ownerId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { reviewId } = req.params;
      const { response } = req.body;

      if (!response) {
        res.status(400).json({ success: false, error: 'Response is required' });
        return;
      }

      const result = await reviewService.addOwnerResponse(reviewId, ownerId, response);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        message: '답변이 등록되었습니다.',
        data: result.review
      });

    } catch (error) {
      logger.error('Error adding owner response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: req.params.reviewId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

export default router;
