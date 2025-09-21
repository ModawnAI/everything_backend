/**
 * IP Blocking Admin Routes
 * 
 * Administrative endpoints for managing IP blocking and monitoring
 */

import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { ipBlockingService } from '../../services/ip-blocking.service';
import { logger } from '../../utils/logger';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateJWT);
router.use(requireAdmin);

/**
 * GET /api/admin/ip-blocks
 * Get all blocked IPs with pagination and filtering
 */
router.get('/ip-blocks', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: errors.array()
        }
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    // Get all blocked IPs (in production, you'd implement pagination)
    const blockedIPs = await ipBlockingService.getAllBlockedIPs();

    // Filter by search term if provided
    const filteredIPs = search 
      ? blockedIPs.filter(block => 
          block.ip.includes(search) || 
          block.reason.toLowerCase().includes(search.toLowerCase())
        )
      : blockedIPs;

    // Simple pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedIPs = filteredIPs.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        blockedIPs: paginatedIPs,
        pagination: {
          page,
          limit,
          total: filteredIPs.length,
          totalPages: Math.ceil(filteredIPs.length / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get blocked IPs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve blocked IPs'
      }
    });
  }
});

/**
 * GET /api/admin/ip-blocks/:ip
 * Get detailed information about a specific IP block
 */
router.get('/ip-blocks/:ip', [
  param('ip').isIP().withMessage('Invalid IP address')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid IP address',
          details: errors.array()
        }
      });
    }

    const ip = req.params.ip;
    
    // Check if IP is currently blocked
    const blockInfo = await ipBlockingService.isIPBlocked(ip);
    
    // Get violation statistics
    const violationStats = await ipBlockingService.getIPViolationStats(ip);

    res.json({
      success: true,
      data: {
        ip,
        isBlocked: !!blockInfo,
        blockInfo,
        violationStats
      }
    });

  } catch (error) {
    logger.error('Failed to get IP block details', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.params.ip,
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve IP block details'
      }
    });
  }
});

/**
 * POST /api/admin/ip-blocks
 * Manually block an IP address
 */
router.post('/ip-blocks', [
  body('ip').isIP().withMessage('Invalid IP address'),
  body('reason').isString().isLength({ min: 1, max: 500 }).withMessage('Reason must be between 1 and 500 characters'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer (minutes)'),
  body('isPermanent').optional().isBoolean().withMessage('isPermanent must be a boolean')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array()
        }
      });
    }

    const { ip, reason, duration, isPermanent } = req.body;
    const adminId = (req as any).user?.id;

    // Check if IP is already blocked
    const existingBlock = await ipBlockingService.isIPBlocked(ip);
    if (existingBlock) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'IP_ALREADY_BLOCKED',
          message: 'IP address is already blocked',
          blockInfo: existingBlock
        }
      });
    }

    // Calculate block duration
    const blockDuration = isPermanent 
      ? 365 * 24 * 60 * 60 * 1000 // 1 year for "permanent"
      : (duration || 60) * 60 * 1000; // Default 1 hour

    // Block the IP
    await ipBlockingService.blockIP(ip, reason, blockDuration, isPermanent);

    logger.info('IP manually blocked by admin', {
      ip,
      reason,
      duration: blockDuration / 1000 / 60, // minutes
      isPermanent,
      adminId
    });

    res.status(201).json({
      success: true,
      message: 'IP address blocked successfully',
      data: {
        ip,
        reason,
        duration: blockDuration / 1000 / 60, // minutes
        isPermanent
      }
    });

  } catch (error) {
    logger.error('Failed to block IP', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.body.ip,
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to block IP address'
      }
    });
  }
});

/**
 * DELETE /api/admin/ip-blocks/:ip
 * Unblock an IP address
 */
router.delete('/ip-blocks/:ip', [
  param('ip').isIP().withMessage('Invalid IP address'),
  body('reason').optional().isString().isLength({ min: 1, max: 500 }).withMessage('Reason must be between 1 and 500 characters')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array()
        }
      });
    }

    const ip = req.params.ip;
    const reason = req.body.reason || 'Manually unblocked by admin';
    const adminId = (req as any).user?.id;

    // Check if IP is currently blocked
    const blockInfo = await ipBlockingService.isIPBlocked(ip);
    if (!blockInfo) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IP_NOT_BLOCKED',
          message: 'IP address is not currently blocked'
        }
      });
    }

    // Unblock the IP
    await ipBlockingService.unblockIP(ip, adminId, reason);

    logger.info('IP manually unblocked by admin', {
      ip,
      reason,
      adminId,
      wasBlockedFor: blockInfo.blockedAt.toISOString()
    });

    res.json({
      success: true,
      message: 'IP address unblocked successfully',
      data: {
        ip,
        reason,
        unblockedBy: adminId
      }
    });

  } catch (error) {
    logger.error('Failed to unblock IP', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.params.ip,
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to unblock IP address'
      }
    });
  }
});

/**
 * GET /api/admin/ip-blocks/:ip/violations
 * Get violation history for a specific IP
 */
router.get('/ip-blocks/:ip/violations', [
  param('ip').isIP().withMessage('Invalid IP address')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid IP address',
          details: errors.array()
        }
      });
    }

    const ip = req.params.ip;
    const violationStats = await ipBlockingService.getIPViolationStats(ip);

    res.json({
      success: true,
      data: {
        ip,
        violationStats
      }
    });

  } catch (error) {
    logger.error('Failed to get IP violations', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.params.ip,
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve IP violations'
      }
    });
  }
});

/**
 * POST /api/admin/ip-blocks/cleanup
 * Manually trigger cleanup of expired blocks and violations
 */
router.post('/ip-blocks/cleanup', async (req: Request, res: Response) => {
  try {
    await ipBlockingService.cleanup();

    logger.info('IP blocking cleanup triggered by admin', {
      adminId: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'IP blocking cleanup completed successfully'
    });

  } catch (error) {
    logger.error('Failed to cleanup IP blocking data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cleanup IP blocking data'
      }
    });
  }
});

export default router;
