/**
 * Refund Cron Service
 * 
 * Automated background processing for refund-related tasks:
 * - No-show refund processing
 * - Expired refund cleanup
 * - Refund audit trail maintenance
 * - Business rule validation updates
 */

import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { refundService } from './refund.service';
import { automatedRefundService } from './automated-refund.service';
import { getSupabaseClient } from '../config/database';

export interface RefundCronJobStatus {
  jobName: string;
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  errorCount: number;
  lastError?: string;
}

export class RefundCronService {
  private supabase = getSupabaseClient();
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobStatus: Map<string, RefundCronJobStatus> = new Map();

  /**
   * Initialize all refund-related cron jobs
   */
  async initializeJobs(): Promise<void> {
    try {
      logger.info('Initializing refund cron jobs');

      // 1. No-show refund processing - every 30 minutes
      this.scheduleJob(
        'no-show-refunds',
        '*/30 * * * *', // Every 30 minutes
        this.processNoShowRefunds.bind(this)
      );

      // 2. Refund audit cleanup - daily at 2 AM
      this.scheduleJob(
        'audit-cleanup',
        '0 2 * * *', // Daily at 2 AM
        this.cleanupAuditLogs.bind(this)
      );

      // 3. Refund queue maintenance - every 15 minutes
      this.scheduleJob(
        'queue-maintenance',
        '*/15 * * * *', // Every 15 minutes
        this.maintainRefundQueue.bind(this)
      );

      // 4. Business rule validation updates - daily at 3 AM
      this.scheduleJob(
        'business-rule-updates',
        '0 3 * * *', // Daily at 3 AM
        this.updateBusinessRules.bind(this)
      );

      // 5. Refund analytics generation - daily at 4 AM
      this.scheduleJob(
        'refund-analytics',
        '0 4 * * *', // Daily at 4 AM
        this.generateRefundAnalytics.bind(this)
      );

      logger.info('Refund cron jobs initialized successfully', {
        jobCount: this.jobs.size
      });

    } catch (error) {
      logger.error('Failed to initialize refund cron jobs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Schedule a cron job with error handling and status tracking
   */
  private scheduleJob(
    jobName: string,
    schedule: string,
    jobFunction: () => Promise<void>
  ): void {
    // Initialize job status
    this.jobStatus.set(jobName, {
      jobName,
      isRunning: false,
      runCount: 0,
      errorCount: 0
    });

    // Create and schedule the job
    const task = cron.schedule(schedule, async () => {
      const status = this.jobStatus.get(jobName)!;
      
      if (status.isRunning) {
        logger.warn(`Refund cron job ${jobName} is already running, skipping`);
        return;
      }

      status.isRunning = true;
      status.lastRun = new Date();
      status.runCount++;

      try {
        logger.info(`Starting refund cron job: ${jobName}`);
        await jobFunction();
        logger.info(`Completed refund cron job: ${jobName}`);
      } catch (error) {
        status.errorCount++;
        status.lastError = error instanceof Error ? error.message : 'Unknown error';
        
        logger.error(`Refund cron job ${jobName} failed`, {
          error: status.lastError,
          runCount: status.runCount,
          errorCount: status.errorCount
        });
      } finally {
        status.isRunning = false;
        this.jobStatus.set(jobName, status);
      }
    });

    this.jobs.set(jobName, task);
    logger.info(`Scheduled refund cron job: ${jobName} with schedule: ${schedule}`);
  }

  /**
   * Process no-show refunds for eligible reservations
   */
  private async processNoShowRefunds(): Promise<void> {
    try {
      logger.info('Processing no-show refunds');

      // Get eligible no-show refunds from queue
      const queue = await refundService.getNoShowRefundQueue(50);
      
      if (queue.length === 0) {
        logger.info('No eligible no-show refunds found');
        return;
      }

      logger.info(`Found ${queue.length} eligible no-show refunds to process`);

      let processedCount = 0;
      let errorCount = 0;

      for (const queueItem of queue) {
        try {
          // Check if still eligible (reservation time + grace period has passed)
          const now = new Date();
          if (now < new Date(queueItem.eligible_for_processing_at)) {
            continue; // Not yet eligible
          }

          // Update queue status to processing
          await this.supabase
            .from('no_show_refund_queue')
            .update({
              processing_status: 'processing',
              updated_at: new Date().toISOString()
            })
            .eq('id', queueItem.id);

          // Process the automated refund
          const result = await automatedRefundService.processAutomatedRefund({
            reservationId: queueItem.reservation_id,
            userId: queueItem.user_id,
            refundType: 'no_show',
            refundReason: 'Automated no-show refund processing',
            triggeredBy: 'system',
            triggerReason: 'No-show detected after grace period'
          });

          if (result.success) {
            // Update queue status to completed
            await this.supabase
              .from('no_show_refund_queue')
              .update({
                processing_status: 'completed',
                processed_at: new Date().toISOString(),
                refund_id: result.refundId,
                updated_at: new Date().toISOString()
              })
              .eq('id', queueItem.id);

            processedCount++;
            
            logger.info('No-show refund processed successfully', {
              reservationId: queueItem.reservation_id,
              refundId: result.refundId,
              refundAmount: result.refundedAmount
            });
          } else {
            throw new Error(result.error || 'Unknown refund processing error');
          }

        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Update queue status to failed
          await this.supabase
            .from('no_show_refund_queue')
            .update({
              processing_status: 'failed',
              error_message: errorMessage,
              retry_count: queueItem.retry_count + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', queueItem.id);

          logger.error('Failed to process no-show refund', {
            reservationId: queueItem.reservation_id,
            error: errorMessage,
            retryCount: queueItem.retry_count + 1
          });
        }
      }

      logger.info('No-show refund processing completed', {
        totalEligible: queue.length,
        processed: processedCount,
        errors: errorCount
      });

    } catch (error) {
      logger.error('Failed to process no-show refunds', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Clean up old audit logs to maintain database performance
   */
  private async cleanupAuditLogs(): Promise<void> {
    try {
      logger.info('Cleaning up old refund audit logs');

      const retentionDays = 90; // Keep logs for 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data: deletedLogs, error } = await this.supabase
        .from('refund_audit_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup audit logs: ${error.message}`);
      }

      const deletedCount = deletedLogs?.length || 0;

      logger.info('Refund audit log cleanup completed', {
        deletedCount,
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      });

    } catch (error) {
      logger.error('Failed to cleanup refund audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Maintain refund queue by handling failed items and retries
   */
  private async maintainRefundQueue(): Promise<void> {
    try {
      logger.info('Maintaining refund queue');

      // 1. Handle failed items that can be retried
      const { data: failedItems, error: failedError } = await this.supabase
        .from('no_show_refund_queue')
        .select('*')
        .eq('processing_status', 'failed')
        .lt('retry_count', 3) // Max 3 retries
        .lt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Wait 30 minutes before retry

      if (failedError) {
        throw new Error(`Failed to fetch failed queue items: ${failedError.message}`);
      }

      if (failedItems && failedItems.length > 0) {
        // Reset failed items to pending for retry
        const { error: resetError } = await this.supabase
          .from('no_show_refund_queue')
          .update({
            processing_status: 'pending',
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .in('id', failedItems.map(item => item.id));

        if (resetError) {
          throw new Error(`Failed to reset failed queue items: ${resetError.message}`);
        }

        logger.info(`Reset ${failedItems.length} failed queue items for retry`);
      }

      // 2. Mark items as skipped if they've exceeded max retries
      const { data: exceededItems, error: exceededError } = await this.supabase
        .from('no_show_refund_queue')
        .select('*')
        .eq('processing_status', 'failed')
        .gte('retry_count', 3);

      if (exceededError) {
        throw new Error(`Failed to fetch exceeded retry items: ${exceededError.message}`);
      }

      if (exceededItems && exceededItems.length > 0) {
        const { error: skipError } = await this.supabase
          .from('no_show_refund_queue')
          .update({
            processing_status: 'skipped',
            updated_at: new Date().toISOString()
          })
          .in('id', exceededItems.map(item => item.id));

        if (skipError) {
          throw new Error(`Failed to skip exceeded retry items: ${skipError.message}`);
        }

        logger.info(`Marked ${exceededItems.length} items as skipped (exceeded max retries)`);
      }

      // 3. Clean up old completed items (older than 30 days)
      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - 30);

      const { data: cleanedItems, error: cleanupError } = await this.supabase
        .from('no_show_refund_queue')
        .delete()
        .in('processing_status', ['completed', 'skipped'])
        .lt('updated_at', cleanupDate.toISOString())
        .select('id');

      if (cleanupError) {
        throw new Error(`Failed to cleanup old queue items: ${cleanupError.message}`);
      }

      const cleanedCount = cleanedItems?.length || 0;

      logger.info('Refund queue maintenance completed', {
        retriedItems: failedItems?.length || 0,
        skippedItems: exceededItems?.length || 0,
        cleanedItems: cleanedCount
      });

    } catch (error) {
      logger.error('Failed to maintain refund queue', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update business rules based on shop performance and policies
   */
  private async updateBusinessRules(): Promise<void> {
    try {
      logger.info('Updating refund business rules');

      // This is a placeholder for business rule updates
      // In a real implementation, this might:
      // 1. Analyze refund patterns by shop
      // 2. Update refund percentages based on performance
      // 3. Adjust time windows based on seasonal patterns
      // 4. Update no-show policies based on historical data

      logger.info('Refund business rules update completed');

    } catch (error) {
      logger.error('Failed to update refund business rules', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate refund analytics and reports
   */
  private async generateRefundAnalytics(): Promise<void> {
    try {
      logger.info('Generating refund analytics');

      // Generate daily refund statistics
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: refundStats, error: statsError } = await this.supabase
        .from('refunds')
        .select('refund_type, refunded_amount, triggered_by')
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString());

      if (statsError) {
        throw new Error(`Failed to fetch refund statistics: ${statsError.message}`);
      }

      if (refundStats && refundStats.length > 0) {
        const analytics = {
          date: yesterday.toISOString().split('T')[0],
          totalRefunds: refundStats.length,
          totalAmount: refundStats.reduce((sum, r) => sum + r.refunded_amount, 0),
          byType: refundStats.reduce((acc: any, r) => {
            acc[r.refund_type] = (acc[r.refund_type] || 0) + 1;
            return acc;
          }, {}),
          byTrigger: refundStats.reduce((acc: any, r) => {
            acc[r.triggered_by] = (acc[r.triggered_by] || 0) + 1;
            return acc;
          }, {}),
          generatedAt: new Date().toISOString()
        };

        logger.info('Daily refund analytics generated', analytics);
      }

    } catch (error) {
      logger.error('Failed to generate refund analytics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get status of all cron jobs
   */
  getJobStatus(): RefundCronJobStatus[] {
    return Array.from(this.jobStatus.values());
  }

  /**
   * Start a specific job manually
   */
  async startJob(jobName: string): Promise<void> {
    const task = this.jobs.get(jobName);
    if (!task) {
      throw new Error(`Job ${jobName} not found`);
    }

    task.start();
    logger.info(`Started refund cron job: ${jobName}`);
  }

  /**
   * Stop a specific job
   */
  async stopJob(jobName: string): Promise<void> {
    const task = this.jobs.get(jobName);
    if (!task) {
      throw new Error(`Job ${jobName} not found`);
    }

    task.stop();
    logger.info(`Stopped refund cron job: ${jobName}`);
  }

  /**
   * Stop all jobs
   */
  async stopAllJobs(): Promise<void> {
    for (const [jobName, task] of this.jobs) {
      task.stop();
      logger.info(`Stopped refund cron job: ${jobName}`);
    }
  }
}

export const refundCronService = new RefundCronService();

