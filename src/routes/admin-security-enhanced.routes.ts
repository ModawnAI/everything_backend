import { Router } from 'express';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { 
  getXSSProtectionStats, 
  getCSRFProtectionStats,
  resetXSSProtectionHistory,
  resetCSRFProtectionHistory
} from '../middleware/xss-csrf-protection.middleware';
import { 
  getSQLInjectionStats, 
  resetSQLInjectionHistory 
} from '../middleware/sql-injection-prevention.middleware';
import { 
  getRPCSecurityStats, 
  resetRPCSecurityHistory 
} from '../middleware/rpc-security.middleware';

const router = Router();

/**
 * Enhanced Security Admin Routes
 * Provides comprehensive security monitoring and management
 */

/**
 * Get comprehensive security statistics
 */
router.get('/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const stats = {
      xss: getXSSProtectionStats(),
      csrf: getCSRFProtectionStats(),
      sqlInjection: getSQLInjectionStats(),
      rpc: getRPCSecurityStats(),
      timestamp: new Date().toISOString()
    };

    logger.info('Security statistics retrieved', {
      adminId: (req as any).user?.id,
      stats: {
        xssViolations: stats.xss.totalViolations,
        csrfViolations: stats.csrf.totalViolations,
        sqlInjectionAttempts: stats.sqlInjection.totalAttempts,
        rpcViolations: stats.rpc.totalViolations
      }
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get security statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security statistics'
    });
  }
});

/**
 * Get XSS protection statistics
 */
router.get('/xss/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const stats = getXSSProtectionStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get XSS protection statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve XSS protection statistics'
    });
  }
});

/**
 * Get CSRF protection statistics
 */
router.get('/csrf/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const stats = getCSRFProtectionStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get CSRF protection statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve CSRF protection statistics'
    });
  }
});

/**
 * Get SQL injection prevention statistics
 */
router.get('/sql-injection/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const stats = getSQLInjectionStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get SQL injection prevention statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve SQL injection prevention statistics'
    });
  }
});

/**
 * Get RPC security statistics
 */
router.get('/rpc/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const stats = getRPCSecurityStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get RPC security statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve RPC security statistics'
    });
  }
});

/**
 * Reset XSS protection history
 */
router.post('/xss/reset', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    resetXSSProtectionHistory();

    logger.info('XSS protection history reset', {
      adminId: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'XSS protection history has been reset'
    });
  } catch (error) {
    logger.error('Failed to reset XSS protection history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to reset XSS protection history'
    });
  }
});

/**
 * Reset CSRF protection history
 */
router.post('/csrf/reset', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    resetCSRFProtectionHistory();

    logger.info('CSRF protection history reset', {
      adminId: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'CSRF protection history has been reset'
    });
  } catch (error) {
    logger.error('Failed to reset CSRF protection history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to reset CSRF protection history'
    });
  }
});

/**
 * Reset SQL injection prevention history
 */
router.post('/sql-injection/reset', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    resetSQLInjectionHistory();

    logger.info('SQL injection prevention history reset', {
      adminId: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'SQL injection prevention history has been reset'
    });
  } catch (error) {
    logger.error('Failed to reset SQL injection prevention history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to reset SQL injection prevention history'
    });
  }
});

/**
 * Reset RPC security history
 */
router.post('/rpc/reset', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    resetRPCSecurityHistory();

    logger.info('RPC security history reset', {
      adminId: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'RPC security history has been reset'
    });
  } catch (error) {
    logger.error('Failed to reset RPC security history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to reset RPC security history'
    });
  }
});

/**
 * Reset all security histories
 */
router.post('/reset-all', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    resetXSSProtectionHistory();
    resetCSRFProtectionHistory();
    resetSQLInjectionHistory();
    resetRPCSecurityHistory();

    logger.info('All security histories reset', {
      adminId: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'All security histories have been reset'
    });
  } catch (error) {
    logger.error('Failed to reset all security histories', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to reset all security histories'
    });
  }
});

/**
 * Get security health status
 */
router.get('/health', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const xssStats = getXSSProtectionStats();
    const csrfStats = getCSRFProtectionStats();
    const sqlStats = getSQLInjectionStats();
    const rpcStats = getRPCSecurityStats();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        xssProtection: {
          status: xssStats.totalViolations < 100 ? 'healthy' : 'warning',
          violations: xssStats.totalViolations,
          blocked: xssStats.blockedViolations
        },
        csrfProtection: {
          status: csrfStats.totalViolations < 50 ? 'healthy' : 'warning',
          violations: csrfStats.totalViolations,
          blocked: csrfStats.blockedViolations
        },
        sqlInjectionPrevention: {
          status: sqlStats.totalAttempts < 200 ? 'healthy' : 'warning',
          attempts: sqlStats.totalAttempts,
          blocked: sqlStats.blockedAttempts
        },
        rpcSecurity: {
          status: rpcStats.totalViolations < 100 ? 'healthy' : 'warning',
          violations: rpcStats.totalViolations,
          blocked: rpcStats.blockedViolations
        }
      }
    };

    // Determine overall health status
    const serviceStatuses = Object.values(health.services).map(s => s.status);
    if (serviceStatuses.includes('warning')) {
      health.status = 'warning';
    }
    if (serviceStatuses.includes('critical')) {
      health.status = 'critical';
    }

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Failed to get security health status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security health status'
    });
  }
});

export default router;
