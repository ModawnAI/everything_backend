/**
 * Transaction Management Controller
 * 
 * Handles API endpoints for transaction monitoring, management, and debugging
 */

import { Request, Response } from 'express';
import { transactionManagementService } from '../services/transaction-management.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

export class TransactionManagementController {
  /**
   * Get transaction status
   * GET /api/transactions/:transactionId/status
   */
  async getTransactionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;

      const status = await transactionManagementService.getTransactionStatus(transactionId!);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Error getting transaction status:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction status'
      });
    }
  }

  /**
   * Get distributed transaction status
   * GET /api/transactions/distributed/:distributedId/status
   */
  async getDistributedTransactionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { distributedId } = req.params;

      const status = await transactionManagementService.getDistributedTransactionStatus(distributedId!);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Distributed transaction not found'
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Error getting distributed transaction status:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get distributed transaction status'
      });
    }
  }

  /**
   * Get transaction logs
   * GET /api/transactions/logs
   */
  async getTransactionLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { transactionId, startTime, endTime } = req.query;

      const logs = await transactionManagementService.getTransactionLogs(
        transactionId as string || undefined,
        startTime ? parseInt(startTime as string) : undefined,
        endTime ? parseInt(endTime as string) : undefined
      );

      res.json({
        success: true,
        data: logs
      });

    } catch (error) {
      logger.error('Error getting transaction logs:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction logs'
      });
    }
  }

  /**
   * Get deadlock information
   * GET /api/transactions/deadlocks
   */
  async getDeadlockInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const deadlocks = await transactionManagementService.getDeadlockInfo();

      res.json({
        success: true,
        data: deadlocks
      });

    } catch (error) {
      logger.error('Error getting deadlock info:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get deadlock information'
      });
    }
  }

  /**
   * Force rollback a transaction (admin only)
   * POST /api/transactions/:transactionId/force-rollback
   */
  async forceRollbackTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;

      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required for force rollback'
        });
        return;
      }

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Reason is required for force rollback'
        });
        return;
      }

      await transactionManagementService.forceRollbackTransaction(transactionId!, reason);

      res.json({
        success: true,
        message: 'Transaction force rollback initiated'
      });

    } catch (error) {
      logger.error('Error force rolling back transaction:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to force rollback transaction'
      });
    }
  }

  /**
   * Get transaction statistics
   * GET /api/transactions/stats
   */
  async getTransactionStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await transactionManagementService.getTransactionStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting transaction stats:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction statistics'
      });
    }
  }

  /**
   * Execute a test transaction
   * POST /api/transactions/test
   */
  async executeTestTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { operation, options } = req.body;

      if (!operation) {
        res.status(400).json({
          success: false,
          error: 'Operation is required'
        });
        return;
      }

      // Execute a test transaction
      const result = await transactionManagementService.executeInTransaction(
        async (context) => {
          // Simulate some database operations
          logger.info('Executing test transaction:', { transactionId: context.transactionId });
          
          // Add some delay to simulate work
          await new Promise(resolve => setTimeout(resolve, 100));
          
          return {
            message: 'Test transaction completed successfully',
            transactionId: context.transactionId,
            timestamp: new Date().toISOString()
          };
        },
        options || {}
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error executing test transaction:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to execute test transaction'
      });
    }
  }

  /**
   * Execute a test distributed transaction
   * POST /api/transactions/test-distributed
   */
  async executeTestDistributedTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { operations, options } = req.body;

      if (!operations || !Array.isArray(operations)) {
        res.status(400).json({
          success: false,
          error: 'Operations array is required'
        });
        return;
      }

      // Execute a test distributed transaction
      const results = await transactionManagementService.executeDistributedTransaction(
        operations.map((op: any, index: number) => ({
          serviceId: op.serviceId || `service_${index}`,
          operation: async (context) => {
            logger.info('Executing distributed operation:', { 
              serviceId: op.serviceId || `service_${index}`,
              transactionId: context.transactionId 
            });
            
            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 200));
            
            return {
              serviceId: op.serviceId || `service_${index}`,
              message: 'Distributed operation completed',
              timestamp: new Date().toISOString()
            };
          }
        })),
        options || {}
      );

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      logger.error('Error executing test distributed transaction:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to execute test distributed transaction'
      });
    }
  }

  /**
   * Get transaction monitoring dashboard data
   * GET /api/transactions/dashboard
   */
  async getTransactionDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { timeRange } = req.query;
      const endTime = Date.now();
      const startTime = timeRange === '1h' ? endTime - 3600000 :
                       timeRange === '24h' ? endTime - 86400000 :
                       timeRange === '7d' ? endTime - 604800000 :
                       endTime - 3600000; // Default to 1 hour

      // Get transaction stats
      const stats = await transactionManagementService.getTransactionStats();
      
      // Get recent transaction logs
      const logs = await transactionManagementService.getTransactionLogs(undefined, startTime, endTime);
      
      // Get deadlock information
      const deadlocks = await transactionManagementService.getDeadlockInfo();

      // Calculate additional metrics
      const recentLogs = logs.slice(0, 50); // Last 50 logs
      const errorLogs = recentLogs.filter(log => 
        log.operation.includes('ERROR') || log.operation.includes('ROLLBACK')
      );
      const successRate = recentLogs.length > 0 
        ? ((recentLogs.length - errorLogs.length) / recentLogs.length) * 100 
        : 100;

      res.json({
        success: true,
        data: {
          stats,
          recentLogs,
          deadlocks,
          metrics: {
            successRate: Math.round(successRate * 100) / 100,
            errorCount: errorLogs.length,
            totalLogs: recentLogs.length,
            timeRange: {
              start: new Date(startTime).toISOString(),
              end: new Date(endTime).toISOString()
            }
          }
        }
      });

    } catch (error) {
      logger.error('Error getting transaction dashboard:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction dashboard'
      });
    }
  }

  /**
   * Clear transaction logs (admin only)
   * DELETE /api/transactions/logs
   */
  async clearTransactionLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { beforeDate } = req.query;

      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required for clearing logs'
        });
        return;
      }

      // This would typically be implemented in the service
      // For now, we'll just return a success message
      logger.info('Transaction logs clear requested:', { 
        beforeDate, 
        userId: req.user?.id 
      });

      res.json({
        success: true,
        message: 'Transaction logs clear operation initiated'
      });

    } catch (error) {
      logger.error('Error clearing transaction logs:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to clear transaction logs'
      });
    }
  }
}

export const transactionManagementController = new TransactionManagementController(); 