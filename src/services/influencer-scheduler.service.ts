import * as cron from 'node-cron';
import { influencerQualificationService } from './influencer-qualification.service';
import { logger } from '../utils/logger';

/**
 * Influencer Scheduler Service
 * 
 * Handles scheduled tasks for influencer qualification system
 */
class InfluencerSchedulerService {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  /**
   * Start the influencer qualification scheduler
   */
  public startScheduler(): void {
    if (this.isRunning) {
      logger.warn('Influencer scheduler is already running');
      return;
    }

    // Run every 6 hours to check for qualified users
    this.cronJob = cron.schedule('0 */6 * * *', async () => {
      await this.runQualificationCheck();
    }, {
      timezone: 'Asia/Seoul'
    });

    this.cronJob.start();
    this.isRunning = true;

    logger.info('Influencer qualification scheduler started', {
      schedule: 'Every 6 hours',
      timezone: 'Asia/Seoul'
    });
  }

  /**
   * Stop the influencer qualification scheduler
   */
  public stopScheduler(): void {
    if (!this.isRunning || !this.cronJob) {
      logger.warn('Influencer scheduler is not running');
      return;
    }

    this.cronJob.stop();
    this.cronJob = null;
    this.isRunning = false;

    logger.info('Influencer qualification scheduler stopped');
  }

  /**
   * Run manual qualification check
   */
  public async runManualQualificationCheck(): Promise<{
    success: boolean;
    promoted: string[];
    failed: Array<{ userId: string; reason: string }>;
    message: string;
  }> {
    try {
      logger.info('Running manual influencer qualification check');

      const result = await influencerQualificationService.autoPromoteQualifiedUsers();

      logger.info('Manual qualification check completed', {
        promoted: result.promoted.length,
        failed: result.failed.length
      });

      return {
        success: true,
        promoted: result.promoted,
        failed: result.failed,
        message: `Qualification check completed. Promoted: ${result.promoted.length}, Failed: ${result.failed.length}`
      };

    } catch (error) {
      logger.error('Manual qualification check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        promoted: [],
        failed: [],
        message: `Qualification check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get scheduler status
   */
  public getSchedulerStatus(): {
    isRunning: boolean;
    nextRun?: string;
    lastRun?: string;
  } {
    return {
      isRunning: this.isRunning,
      nextRun: undefined, // nextDate() not available on ScheduledTask type
      lastRun: this.getLastRunTime()
    };
  }

  /**
   * Run the qualification check (internal method)
   */
  private async runQualificationCheck(): Promise<void> {
    try {
      logger.info('Starting scheduled influencer qualification check');

      const result = await influencerQualificationService.autoPromoteQualifiedUsers();

      logger.info('Scheduled qualification check completed', {
        promoted: result.promoted.length,
        failed: result.failed.length,
        timestamp: new Date().toISOString()
      });

      // Log any failures for monitoring
      if (result.failed.length > 0) {
        logger.warn('Some users failed qualification check', {
          failedCount: result.failed.length,
          failures: result.failed
        });
      }

    } catch (error) {
      logger.error('Scheduled qualification check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get last run time (placeholder - would need to implement persistence)
   */
  private getLastRunTime(): string | undefined {
    // In a real implementation, this would be stored in database or cache
    // For now, return undefined
    return undefined;
  }
}

export const influencerSchedulerService = new InfluencerSchedulerService();
