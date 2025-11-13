/**
 * Search Routes
 *
 * General search endpoints for suggestions and autocomplete
 */

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Rate limiting for search endpoints
const searchRateLimit = rateLimit({
  config: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    strategy: 'fixed_window'
  }
});

router.use(searchRateLimit);

/**
 * POST /api/search/suggestions
 * Get search suggestions based on query
 *
 * Body: { query: string, limit?: number }
 *
 * Returns: { success: true, data: { suggestions: Array } }
 */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const { query, limit = 10 } = req.body;

    // Validate query
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query is required'
        }
      });
    }

    // Trim and validate length
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 1) {
      return res.json({
        success: true,
        data: {
          suggestions: []
        }
      });
    }

    const client = getSupabaseClient();

    // Search shops for suggestions
    const { data: shops, error } = await client
      .from('shops')
      .select('id, name, address, main_category')
      .or(`name.ilike.%${trimmedQuery}%,address.ilike.%${trimmedQuery}%`)
      .eq('shop_status', 'active')
      .limit(Math.min(limit, 20))
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch search suggestions', {
        error: error.message,
        query: trimmedQuery
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: '검색 제안을 불러올 수 없습니다.'
        }
      });
    }

    // Format suggestions
    const suggestions = (shops || []).map(shop => ({
      type: 'shop',
      id: shop.id,
      name: shop.name,
      address: shop.address,
      category: shop.main_category,
      url: `/shops/${shop.id}`
    }));

    res.json({
      success: true,
      data: {
        suggestions
      }
    });

  } catch (error) {
    logger.error('Error in search suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '검색 제안 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions (GET alternative)
 *
 * Query: ?query=string&limit=number
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { query, limit = '10' } = req.query;

    // Validate query
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query is required'
        }
      });
    }

    // Trim and validate length
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 1) {
      return res.json({
        success: true,
        data: {
          suggestions: []
        }
      });
    }

    const limitNum = parseInt(limit as string) || 10;
    const client = getSupabaseClient();

    // Search shops for suggestions
    const { data: shops, error } = await client
      .from('shops')
      .select('id, name, address, main_category')
      .or(`name.ilike.%${trimmedQuery}%,address.ilike.%${trimmedQuery}%`)
      .eq('shop_status', 'active')
      .limit(Math.min(limitNum, 20))
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch search suggestions', {
        error: error.message,
        query: trimmedQuery
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: '검색 제안을 불러올 수 없습니다.'
        }
      });
    }

    // Format suggestions
    const suggestions = (shops || []).map(shop => ({
      type: 'shop',
      id: shop.id,
      name: shop.name,
      address: shop.address,
      category: shop.main_category,
      url: `/shops/${shop.id}`
    }));

    res.json({
      success: true,
      data: {
        suggestions
      }
    });

  } catch (error) {
    logger.error('Error in search suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '검색 제안 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * POST /api/search
 * General search endpoint
 *
 * Body: { query: string, type?: 'shops' | 'services', limit?: number }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { query, type = 'shops', limit = 20 } = req.body;

    // Validate query
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query is required'
        }
      });
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 1) {
      return res.json({
        success: true,
        data: {
          results: []
        }
      });
    }

    const client = getSupabaseClient();

    // Search based on type
    if (type === 'shops') {
      const { data: shops, error } = await client
        .from('shops')
        .select('*')
        .or(`name.ilike.%${trimmedQuery}%,description.ilike.%${trimmedQuery}%,address.ilike.%${trimmedQuery}%`)
        .eq('shop_status', 'active')
        .limit(limit)
        .order('name', { ascending: true });

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      return res.json({
        success: true,
        data: {
          results: shops || []
        }
      });
    }

    // Default: return empty results
    res.json({
      success: true,
      data: {
        results: []
      }
    });

  } catch (error) {
    logger.error('Error in general search', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '검색 중 오류가 발생했습니다.'
      }
    });
  }
});

// Error handler middleware
router.use((error: any, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error in search routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '검색 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;
