/**
 * @swagger
 * tags:
 *   - name: Feed Templates
 *     description: Shop owner feed template management APIs
 *
 *       피드 템플릿 관리 API입니다. 샵 오너가 재사용 가능한 피드 포스트 템플릿을 관리합니다.
 */

/**
 * Feed Template Routes
 *
 * Handles feed template CRUD for shop owners
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { feedTemplateService } from '../services/feed-template.service';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

const router = Router();

// Rate limiter for template operations
const templateLimiter = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many template requests, please try again later'
  }
});

/**
 * Helper to get shop ID for the authenticated shop owner
 */
async function getShopIdForOwner(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * @swagger
 * /api/shop-owner/feed-templates:
 *   get:
 *     summary: Get all templates for the shop
 *     description: Get all feed templates for the authenticated shop owner's shop
 *     tags: [Feed Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not a shop owner
 */
router.get('/',
  authenticateJWT(),
  templateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const shopId = await getShopIdForOwner(userId);
      if (!shopId) {
        res.status(403).json({ success: false, error: 'You must be a shop owner to access templates' });
        return;
      }

      const result = await feedTemplateService.getTemplates(shopId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          templates: result.templates,
          total: result.total
        }
      });

    } catch (error) {
      logger.error('Error fetching feed templates', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/shop-owner/feed-templates/{templateId}:
 *   get:
 *     summary: Get a single template
 *     description: Get details of a specific feed template
 *     tags: [Feed Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *       404:
 *         description: Template not found
 */
router.get('/:templateId',
  authenticateJWT(),
  templateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const shopId = await getShopIdForOwner(userId);
      if (!shopId) {
        res.status(403).json({ success: false, error: 'You must be a shop owner to access templates' });
        return;
      }

      const { templateId } = req.params;
      const result = await feedTemplateService.getTemplate(templateId, shopId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json({
        success: true,
        data: result.template
      });

    } catch (error) {
      logger.error('Error fetching feed template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId: req.params.templateId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/shop-owner/feed-templates:
 *   post:
 *     summary: Create a new template
 *     description: Create a new feed template for the shop
 *     tags: [Feed Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *               category:
 *                 type: string
 *                 enum: [event, promotion, daily, announcement]
 *     responses:
 *       201:
 *         description: Template created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 */
router.post('/',
  authenticateJWT(),
  templateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const shopId = await getShopIdForOwner(userId);
      if (!shopId) {
        res.status(403).json({ success: false, error: 'You must be a shop owner to create templates' });
        return;
      }

      const { name, content, category } = req.body;
      const result = await feedTemplateService.createTemplate(shopId, { name, content, category });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json({
        success: true,
        message: '템플릿이 생성되었습니다.',
        data: result.template
      });

    } catch (error) {
      logger.error('Error creating feed template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/shop-owner/feed-templates/{templateId}:
 *   put:
 *     summary: Update a template
 *     description: Update an existing feed template
 *     tags: [Feed Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
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
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *               category:
 *                 type: string
 *                 enum: [event, promotion, daily, announcement]
 *               is_default:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Template not found
 */
router.put('/:templateId',
  authenticateJWT(),
  templateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const shopId = await getShopIdForOwner(userId);
      if (!shopId) {
        res.status(403).json({ success: false, error: 'You must be a shop owner to update templates' });
        return;
      }

      const { templateId } = req.params;
      const { name, content, category, is_default } = req.body;

      const result = await feedTemplateService.updateTemplate(templateId, shopId, {
        name,
        content,
        category,
        is_default
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        message: '템플릿이 수정되었습니다.',
        data: result.template
      });

    } catch (error) {
      logger.error('Error updating feed template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId: req.params.templateId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/shop-owner/feed-templates/{templateId}:
 *   delete:
 *     summary: Delete a template
 *     description: Delete an existing feed template
 *     tags: [Feed Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Template not found
 */
router.delete('/:templateId',
  authenticateJWT(),
  templateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const shopId = await getShopIdForOwner(userId);
      if (!shopId) {
        res.status(403).json({ success: false, error: 'You must be a shop owner to delete templates' });
        return;
      }

      const { templateId } = req.params;
      const result = await feedTemplateService.deleteTemplate(templateId, shopId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        message: '템플릿이 삭제되었습니다.'
      });

    } catch (error) {
      logger.error('Error deleting feed template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId: req.params.templateId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/shop-owner/feed-templates/default:
 *   get:
 *     summary: Get default template
 *     description: Get the default template for the shop
 *     tags: [Feed Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default template retrieved (may be null)
 *       401:
 *         description: Authentication required
 */
router.get('/default/template',
  authenticateJWT(),
  templateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const shopId = await getShopIdForOwner(userId);
      if (!shopId) {
        res.status(403).json({ success: false, error: 'You must be a shop owner to access templates' });
        return;
      }

      const result = await feedTemplateService.getDefaultTemplate(shopId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        data: result.template || null
      });

    } catch (error) {
      logger.error('Error fetching default template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/shop-owner/feed-templates/category/{category}:
 *   get:
 *     summary: Get templates by category
 *     description: Get all templates in a specific category
 *     tags: [Feed Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [event, promotion, daily, announcement]
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *       400:
 *         description: Invalid category
 */
router.get('/category/:category',
  authenticateJWT(),
  templateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const shopId = await getShopIdForOwner(userId);
      if (!shopId) {
        res.status(403).json({ success: false, error: 'You must be a shop owner to access templates' });
        return;
      }

      const { category } = req.params;
      const validCategories = ['event', 'promotion', 'daily', 'announcement'];

      if (!validCategories.includes(category)) {
        res.status(400).json({ success: false, error: 'Invalid category' });
        return;
      }

      const result = await feedTemplateService.getTemplatesByCategory(
        shopId,
        category as 'event' | 'promotion' | 'daily' | 'announcement'
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          templates: result.templates,
          total: result.total
        }
      });

    } catch (error) {
      logger.error('Error fetching templates by category', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category: req.params.category
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

export default router;
