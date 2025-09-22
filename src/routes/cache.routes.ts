import { Router, Request, Response } from 'express';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CacheStats:
 *       type: object
 *       properties:
 *         hits:
 *           type: number
 *           description: Number of cache hits
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         misses:
 *           type: number
 *           description: Number of cache misses
 *         keys:
 *           type: number
 *           description: Number of cached keys
 *         memory:
 *           type: number
 *           description: Memory usage in bytes
 *         hitRate:
 *           type: number
 *           description: Cache hit rate percentage
 */

/**
 * GET /cache/stats
 * Get cache statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await cacheService.getStats();
    
    logger.info('Cache stats requested', {
      correlationId: (req as any).correlationId,
      stats,
    });

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get cache stats', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_STATS_FAILED',
        message: 'Failed to get cache statistics',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /cache/set
 * Set cache entry
 */

/**
 * @swagger
 * /set:
 *   post:
 *     summary: POST /set (POST /set)
 *     description: POST endpoint for /set
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.post('/set', async (req: Request, res: Response) => {
  try {
    const { key, data, ttl = 3600, prefix, tags = [] } = req.body;

    if (!key || data === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CACHE_REQUEST',
          message: 'Key and data are required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    await cacheService.set(key, data, { ttl, prefix, tags });

    logger.info('Cache entry set', {
      correlationId: (req as any).correlationId,
      key,
      ttl,
      tags,
    });

    res.status(200).json({
      success: true,
      message: 'Cache entry set successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to set cache entry', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_SET_FAILED',
        message: 'Failed to set cache entry',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /cache/get/:key
 * Get cache entry
 */

/**
 * @swagger
 * /get/:key:
 *   get:
 *     summary: /get/:key 조회
 *     description: GET endpoint for /get/:key
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.get('/get/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { prefix } = req.query;

    const data = await cacheService.get(key, prefix as string || undefined);

    if (data === null) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CACHE_MISS',
          message: 'Cache entry not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    logger.info('Cache entry retrieved', {
      correlationId: (req as any).correlationId,
      key,
      prefix,
    });

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get cache entry', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_GET_FAILED',
        message: 'Failed to get cache entry',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * DELETE /cache/delete/:key
 * Delete cache entry
 */

/**
 * @swagger
 * /delete/:key:
 *   delete:
 *     summary: /delete/:key 삭제
 *     description: DELETE endpoint for /delete/:key
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.delete('/delete/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { prefix } = req.query;

    await cacheService.delete(key, prefix as string || undefined);

    logger.info('Cache entry deleted', {
      correlationId: (req as any).correlationId,
      key,
      prefix,
    });

    res.status(200).json({
      success: true,
      message: 'Cache entry deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to delete cache entry', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_DELETE_FAILED',
        message: 'Failed to delete cache entry',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /cache/invalidate
 * Invalidate cache by tags
 */

/**
 * @swagger
 * /invalidate:
 *   post:
 *     summary: POST /invalidate (POST /invalidate)
 *     description: POST endpoint for /invalidate
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.post('/invalidate', async (req: Request, res: Response) => {
  try {
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TAGS',
          message: 'Tags array is required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    await cacheService.invalidateByTags(tags);

    logger.info('Cache invalidated by tags', {
      correlationId: (req as any).correlationId,
      tags,
    });

    res.status(200).json({
      success: true,
      message: 'Cache invalidated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to invalidate cache', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_INVALIDATE_FAILED',
        message: 'Failed to invalidate cache',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /cache/clear
 * Clear all cache
 */

/**
 * @swagger
 * /clear:
 *   post:
 *     summary: POST /clear (POST /clear)
 *     description: POST endpoint for /clear
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.post('/clear', async (req: Request, res: Response) => {
  try {
    await cacheService.clear();

    logger.info('Cache cleared', {
      correlationId: (req as any).correlationId,
    });

    res.status(200).json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to clear cache', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_CLEAR_FAILED',
        message: 'Failed to clear cache',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /cache/warm
 * Warm cache with test data
 */

/**
 * @swagger
 * /warm:
 *   post:
 *     summary: POST /warm (POST /warm)
 *     description: POST endpoint for /warm
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.post('/warm', async (req: Request, res: Response) => {
  try {
    // Warm cache with some test data
    const testData = {
      shops: [
        { id: 1, name: 'Test Shop 1', rating: 4.5 },
        { id: 2, name: 'Test Shop 2', rating: 4.8 },
      ],
      users: [
        { id: 1, name: 'Test User 1', points: 1000 },
        { id: 2, name: 'Test User 2', points: 2500 },
      ],
    };

    await cacheService.set('test:shops', testData.shops, { ttl: 1800, tags: ['shops'] });
    await cacheService.set('test:users', testData.users, { ttl: 1800, tags: ['users'] });

    logger.info('Cache warmed with test data', {
      correlationId: (req as any).correlationId,
    });

    res.status(200).json({
      success: true,
      message: 'Cache warmed successfully',
      data: testData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to warm cache', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_WARM_FAILED',
        message: 'Failed to warm cache',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router; 