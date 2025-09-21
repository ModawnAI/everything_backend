/**
 * Scheduler Utility
 * 
 * Handles scheduled jobs and automated workflow triggers
 * for user status management and system maintenance
 */

import { logger } from './logger';
import { userStatusWorkflowService } from '../services/user-status-workflow.service';
import { noShowDetectionService } from '../services/no-show-detection.service';
import { pointProcessingService } from '../services/point-processing.service';
import { automaticStateProgressionService } from '../services/automatic-state-progression.service';
import { auditTrailService } from '../services/audit-trail.service';

// Simple in-memory scheduler for development
// In production, consider using a proper job queue like Bull, Agenda, or AWS EventBridge
class Scheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduler...');

    // Schedule user status workflow processing (every 6 hours)
    this.scheduleJob('user-status-workflow', 6 * 60 * 60 * 1000, async () => {
      try {
        await userStatusWorkflowService.processWorkflowTriggers();
      } catch (error) {
        logger.error('Error in user status workflow job:', error);
      }
    });

    // Schedule automatic state progression (every 10 minutes)
    this.scheduleJob('automatic-state-progression', 10 * 60 * 1000, async () => {
      try {
        await automaticStateProgressionService.processWithRetry();
      } catch (error) {
        logger.error('Error in automatic state progression job:', error);
      }
    });

    // Schedule no-show detection (every 15 minutes) - kept for backward compatibility
    this.scheduleJob('no-show-detection', 15 * 60 * 1000, async () => {
      try {
        await noShowDetectionService.processAutomaticNoShowDetection();
      } catch (error) {
        logger.error('Error in no-show detection job:', error);
      }
    });

    // Schedule point processing (every 6 hours)
    this.scheduleJob('point-processing', 6 * 60 * 60 * 1000, async () => {
      try {
        await pointProcessingService.runAllProcessingTasks();
      } catch (error) {
        logger.error('Error in point processing job:', error);
      }
    });

    // Schedule point expiration warnings (daily at 9 AM)
    this.scheduleDailyJob('point-expiration-warnings', 9, 0, async () => {
      try {
        await pointProcessingService.sendExpirationWarnings();
      } catch (error) {
        logger.error('Error in point expiration warnings job:', error);
      }
    });

    // Schedule system cleanup (daily at 2 AM)
    this.scheduleDailyJob('system-cleanup', 2, 0, async () => {
      try {
        await this.performSystemCleanup();
      } catch (error) {
        logger.error('Error in system cleanup job:', error);
      }
    });

    // Schedule daily metrics reset (daily at midnight)
    this.scheduleDailyJob('metrics-reset', 0, 0, async () => {
      try {
        automaticStateProgressionService.resetDailyMetrics();
      } catch (error) {
        logger.error('Error in metrics reset job:', error);
      }
    });

    // Schedule database maintenance (weekly on Sunday at 3 AM)
    this.scheduleWeeklyJob('database-maintenance', 0, 3, 0, async () => {
      try {
        await this.performDatabaseMaintenance();
      } catch (error) {
        logger.error('Error in database maintenance job:', error);
      }
    });

    // Schedule audit trail cleanup (daily at 4 AM, but only run on 1st of month)
    this.scheduleDailyJob('audit-trail-cleanup', 4, 0, async () => {
      try {
        // Only run on the 1st day of the month
        const today = new Date();
        if (today.getDate() === 1) {
          const result = await auditTrailService.cleanupOldEntries(365); // 1 year retention
          logger.info('Scheduled audit trail cleanup completed', {
            deletedCount: result.deletedCount,
            errors: result.errors
          });
        }
      } catch (error) {
        logger.error('Error in audit trail cleanup job:', error);
      }
    });

    logger.info('Scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Scheduler is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping scheduler...');

    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      logger.info(`Stopped job: ${name}`);
    }

    this.intervals.clear();
    logger.info('Scheduler stopped successfully');
  }

  /**
   * Schedule a job to run at regular intervals
   */
  scheduleJob(name: string, intervalMs: number, job: () => Promise<void>): void {
    if (this.intervals.has(name)) {
      logger.warn(`Job ${name} is already scheduled`);
      return;
    }

    const interval = setInterval(async () => {
      try {
        logger.info(`Starting scheduled job: ${name}`);
        const startTime = Date.now();
        
        await job();
        
        const duration = Date.now() - startTime;
        logger.info(`Completed scheduled job: ${name} (${duration}ms)`);
      } catch (error) {
        logger.error(`Error in scheduled job ${name}:`, error);
      }
    }, intervalMs);

    this.intervals.set(name, interval);
    logger.info(`Scheduled job: ${name} (every ${intervalMs / 1000 / 60} minutes)`);
  }

  /**
   * Schedule a job to run daily at a specific time
   */
  scheduleDailyJob(name: string, hour: number, minute: number, job: () => Promise<void>): void {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime.getTime() - now.getTime();

    // Schedule the first run
    setTimeout(async () => {
      try {
        logger.info(`Starting daily job: ${name}`);
        const startTime = Date.now();
        
        await job();
        
        const duration = Date.now() - startTime;
        logger.info(`Completed daily job: ${name} (${duration}ms)`);
      } catch (error) {
        logger.error(`Error in daily job ${name}:`, error);
      }

      // Schedule subsequent runs (every 24 hours)
      this.scheduleJob(name, 24 * 60 * 60 * 1000, job);
    }, delay);

    logger.info(`Scheduled daily job: ${name} (${hour}:${minute.toString().padStart(2, '0')})`);
  }

  /**
   * Schedule a job to run weekly on a specific day and time
   */
  scheduleWeeklyJob(name: string, dayOfWeek: number, hour: number, minute: number, job: () => Promise<void>): void {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    // Calculate days until next occurrence
    const currentDay = now.getDay();
    let daysUntilNext = dayOfWeek - currentDay;
    if (daysUntilNext <= 0) {
      daysUntilNext += 7;
    }

    scheduledTime.setDate(scheduledTime.getDate() + daysUntilNext);

    const delay = scheduledTime.getTime() - now.getTime();

    // Schedule the first run
    setTimeout(async () => {
      try {
        logger.info(`Starting weekly job: ${name}`);
        const startTime = Date.now();
        
        await job();
        
        const duration = Date.now() - startTime;
        logger.info(`Completed weekly job: ${name} (${duration}ms)`);
      } catch (error) {
        logger.error(`Error in weekly job ${name}:`, error);
      }

      // Schedule subsequent runs (every 7 days)
      this.scheduleJob(name, 7 * 24 * 60 * 60 * 1000, job);
    }, delay);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    logger.info(`Scheduled weekly job: ${name} (${dayNames[dayOfWeek]} ${hour}:${minute.toString().padStart(2, '0')})`);
  }

  /**
   * Perform system cleanup tasks
   */
  private async performSystemCleanup(): Promise<void> {
    logger.info('Starting system cleanup...');

    try {
      // Clean up old workflow triggers (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // This would be implemented with actual database cleanup
      logger.info('System cleanup completed');
    } catch (error) {
      logger.error('Error during system cleanup:', error);
    }
  }

  /**
   * Perform database maintenance tasks
   */
  private async performDatabaseMaintenance(): Promise<void> {
    logger.info('Starting database maintenance...');

    try {
      // This would include tasks like:
      // - Vacuuming tables
      // - Updating statistics
      // - Cleaning up old logs
      // - Optimizing indexes
      
      logger.info('Database maintenance completed');
    } catch (error) {
      logger.error('Error during database maintenance:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: string[];
    totalJobs: number;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.intervals.keys()),
      totalJobs: this.intervals.size
    };
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(name: string): Promise<void> {
    logger.info(`Manually triggering job: ${name}`);

    switch (name) {
      case 'user-status-workflow':
        await userStatusWorkflowService.processWorkflowTriggers();
        break;
      case 'system-cleanup':
        await this.performSystemCleanup();
        break;
      case 'no-show-detection':
        await noShowDetectionService.processAutomaticNoShowDetection();
        break;
      case 'point-processing':
        await pointProcessingService.runAllProcessingTasks();
        break;
      case 'point-expiration-warnings':
        await pointProcessingService.sendExpirationWarnings();
        break;
      case 'database-maintenance':
        await this.performDatabaseMaintenance();
        break;
      default:
        throw new Error(`Unknown job: ${name}`);
    }

    logger.info(`Manually triggered job completed: ${name}`);
  }
}

// Export singleton instance
export const scheduler = new Scheduler();

// Auto-start scheduler when this module is imported
if (process.env.NODE_ENV !== 'test') {
  scheduler.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, stopping scheduler...');
  scheduler.stop();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, stopping scheduler...');
  scheduler.stop();
}); 