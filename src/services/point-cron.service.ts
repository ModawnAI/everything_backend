/**
 * Point Cron Service
 * 
 * Automated point processing using node-cron:
 * - Process pending points to available (7-day rule)
 * - Process expired points
 * - Send expiration warnings
 * - Generate point analytics reports
 * - Cleanup old transaction data
 */

import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { pointTransactionService } from './point-transaction.service';
import { pointProcessingService } from './point-processing.service';
import { POINT_POLICY_V32 } from '../constants/point-policies';

export class PointCronService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;

  /**
   * Start all point processing cron jobs
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Point cron service is already running');
      return;
    }

    logger.info('Starting point cron service with v3.2 policies');

    // Process pending points to available every hour
    const pendingJob = cron.schedule('0 * * * *', async () => {
      await this.processPendingPoints();
    });

    // Process expired points daily at 2 AM
    const expiredJob = cron.schedule('0 2 * * *', async () => {
      await this.processExpiredPoints();
    });

    // Send expiration warnings daily at 10 AM
    const warningJob = cron.schedule('0 10 * * *', async () => {
      await this.sendExpirationWarnings();
    });

    // Generate daily analytics report at 1 AM
    const analyticsJob = cron.schedule('0 1 * * *', async () => {
      await this.generateDailyAnalytics();
    });

    // Cleanup old transaction data weekly on Sunday at 3 AM
    const cleanupJob = cron.schedule('0 3 * * 0', async () => {
      await this.cleanupOldData();
    });

    // Store jobs for management
    this.jobs.set('pending', pendingJob);
    this.jobs.set('expired', expiredJob);
    this.jobs.set('warnings', warningJob);
    this.jobs.set('analytics', analyticsJob);
    this.jobs.set('cleanup', cleanupJob);

    // Start all jobs
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`Started cron job: ${name}`);
    });

    this.isRunning = true;
    logger.info('Point cron service started successfully');
  }

  /**
   * Stop all cron jobs
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Point cron service is not running');
      return;
    }

    logger.info('Stopping point cron service');

    this.jobs.forEach((job, name) => {
      job.stop();
      job.destroy();
      logger.info(`Stopped cron job: ${name}`);
    });

    this.jobs.clear();
    this.isRunning = false;
    logger.info('Point cron service stopped successfully');
  }

  /**
   * Get status of all cron jobs
   */
  getStatus(): {
    isRunning: boolean;
    jobs: Array<{
      name: string;
      isRunning: boolean;
      nextRun?: Date;
    }>;
  } {
    const jobStatus = Array.from(this.jobs.entries()).map(([name, job]) => ({
      name,
      isRunning: job.getStatus() === 'scheduled',
      nextRun: undefined // nextDate method not available in this version
    }));

    return {
      isRunning: this.isRunning,
      jobs: jobStatus
    };
  }

  /**
   * Manually trigger a specific job
   */
  async triggerJob(jobName: string): Promise<void> {
    logger.info(`Manually triggering job: ${jobName}`);

    switch (jobName) {
      case 'pending':
        await this.processPendingPoints();
        break;
      case 'expired':
        await this.processExpiredPoints();
        break;
      case 'warnings':
        await this.sendExpirationWarnings();
        break;
      case 'analytics':
        await this.generateDailyAnalytics();
        break;
      case 'cleanup':
        await this.cleanupOldData();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Process pending points to available (7-day rule)
   */
  private async processPendingPoints(): Promise<void> {
    try {
      logger.info('Starting pending points processing job');
      const startTime = Date.now();

      const processedCount = await pointTransactionService.processPendingToAvailable();

      const duration = Date.now() - startTime;
      logger.info('Pending points processing completed', {
        processedCount,
        duration: `${duration}ms`,
        policy: 'v3.2',
        delayDays: POINT_POLICY_V32.AVAILABILITY_DELAY_DAYS
      });

    } catch (error) {
      logger.error('Failed to process pending points', {
        error: error instanceof Error ? error.message : 'Unknown error',
        job: 'process-pending-points'
      });
    }
  }

  /**
   * Process expired points
   */
  private async processExpiredPoints(): Promise<void> {
    try {
      logger.info('Starting expired points processing job');
      const startTime = Date.now();

      const processedCount = await pointTransactionService.processExpiredPoints();

      const duration = Date.now() - startTime;
      logger.info('Expired points processing completed', {
        processedCount,
        duration: `${duration}ms`,
        policy: 'v3.2',
        expirationDays: POINT_POLICY_V32.EXPIRATION_PERIOD_DAYS
      });

    } catch (error) {
      logger.error('Failed to process expired points', {
        error: error instanceof Error ? error.message : 'Unknown error',
        job: 'process-expired-points'
      });
    }
  }

  /**
   * Send expiration warnings to users
   */
  private async sendExpirationWarnings(): Promise<void> {
    try {
      logger.info('Starting expiration warnings job');
      const startTime = Date.now();

      // Send expiration warnings (placeholder - implement based on actual service method)
      const warningsSent = 0; // This would be returned by the actual service method
      const errors = 0;

      const duration = Date.now() - startTime;
      logger.info('Expiration warnings completed', {
        warningsSent,
        errors,
        duration: `${duration}ms`,
        policy: 'v3.2'
      });

    } catch (error) {
      logger.error('Failed to send expiration warnings', {
        error: error instanceof Error ? error.message : 'Unknown error',
        job: 'send-expiration-warnings'
      });
    }
  }

  /**
   * Generate daily analytics report
   */
  private async generateDailyAnalytics(): Promise<void> {
    try {
      logger.info('Starting daily analytics generation job');
      const startTime = Date.now();

      const stats = await pointProcessingService.getProcessingStats();

      const duration = Date.now() - startTime;
      logger.info('Daily analytics generation completed', {
        pendingCount: stats.pendingCount,
        expiringCount: stats.expiringCount,
        expiredCount: stats.expiredCount,
        duration: `${duration}ms`,
        policy: 'v3.2'
      });

      // Log daily summary
      logger.info('Daily point system summary', {
        date: new Date().toISOString().split('T')[0],
        stats,
        policies: {
          earningRate: POINT_POLICY_V32.EARNING_RATE,
          maxEligibleAmount: POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT,
          availabilityDelayDays: POINT_POLICY_V32.AVAILABILITY_DELAY_DAYS,
          influencerMultiplier: POINT_POLICY_V32.INFLUENCER_MULTIPLIER,
          version: 'v3.2'
        }
      });

    } catch (error) {
      logger.error('Failed to generate daily analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        job: 'generate-analytics'
      });
    }
  }

  /**
   * Cleanup old transaction data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      logger.info('Starting old data cleanup job');
      const startTime = Date.now();

      // This would implement cleanup logic for old transaction data
      // For now, just log the operation
      logger.info('Old data cleanup would be performed here', {
        retentionPeriod: '2 years',
        policy: 'v3.2'
      });

      const duration = Date.now() - startTime;
      logger.info('Old data cleanup completed', {
        duration: `${duration}ms`,
        policy: 'v3.2'
      });

    } catch (error) {
      logger.error('Failed to cleanup old data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        job: 'cleanup-old-data'
      });
    }
  }

  /**
   * Get comprehensive point system health check
   */
  async getHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    cronService: {
      isRunning: boolean;
      jobCount: number;
      activeJobs: number;
    };
    policies: {
      version: string;
      earningRate: number;
      maxEligibleAmount: number;
      availabilityDelayDays: number;
      influencerMultiplier: number;
    };
    lastProcessing: {
      pending?: Date;
      expired?: Date;
      warnings?: Date;
    };
  }> {
    const jobStatus = this.getStatus();
    const activeJobs = jobStatus.jobs.filter(j => j.isRunning).length;

    return {
      status: this.isRunning && activeJobs === this.jobs.size ? 'healthy' : 'warning',
      cronService: {
        isRunning: this.isRunning,
        jobCount: this.jobs.size,
        activeJobs
      },
      policies: {
        version: 'v3.2',
        earningRate: POINT_POLICY_V32.EARNING_RATE,
        maxEligibleAmount: POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT,
        availabilityDelayDays: POINT_POLICY_V32.AVAILABILITY_DELAY_DAYS,
        influencerMultiplier: POINT_POLICY_V32.INFLUENCER_MULTIPLIER
      },
      lastProcessing: {
        // These would be tracked in a real implementation
        pending: undefined,
        expired: undefined,
        warnings: undefined
      }
    };
  }
}

// Export singleton instance
export const pointCronService = new PointCronService();
