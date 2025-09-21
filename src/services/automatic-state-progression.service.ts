/**
 * Automatic State Progression Service
 * 
 * Comprehensive system for automated reservation state transitions with:
 * - Scheduled automatic state progression based on time thresholds
 * - Integration with database-level state machine functions
 * - Configurable grace periods and timing rules for different service types
 * - Comprehensive error handling and retry mechanisms
 * - Performance monitoring and metrics collection
 * - Integration with existing no-show detection service
 */

import { getSupabaseClient } from '../config/database';
import { ReservationStatus, Reservation } from '../types/database.types';
import { logger } from '../utils/logger';
import { reservationStateMachine } from './reservation-state-machine.service';
import { noShowDetectionService } from './no-show-detection.service';

// Configuration for automatic state progression
export interface AutoProgressionConfig {
  enabled: boolean;
  gracePeriods: {
    default: number; // minutes
    serviceTypes: Record<string, number>; // service category -> minutes
  };
  completionRules: {
    autoCompleteAfterMinutes: number;
    requiresConfirmation: boolean;
  };
  noShowRules: {
    graceMinutes: number;
    enableAutoDetection: boolean;
  };
  expiryRules: {
    requestedExpiryHours: number;
    enableAutoExpiry: boolean;
  };
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
}

// Processing result interface
export interface ProgressionResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  completedReservations: number;
  noShowReservations: number;
  expiredReservations: number;
  errors: string[];
  processingTimeMs: number;
  timestamp: string;
}

// Metrics interface
export interface ProgressionMetrics {
  dailyProcessed: number;
  dailySuccess: number;
  dailyFailures: number;
  averageProcessingTime: number;
  lastRunTime: string;
  errorRate: number;
}

export class AutomaticStateProgressionService {
  private supabase = getSupabaseClient();
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private metrics: ProgressionMetrics = {
    dailyProcessed: 0,
    dailySuccess: 0,
    dailyFailures: 0,
    averageProcessingTime: 0,
    lastRunTime: '',
    errorRate: 0
  };

  // Default configuration
  private defaultConfig: AutoProgressionConfig = {
    enabled: true,
    gracePeriods: {
      default: 30, // 30 minutes default grace period
      serviceTypes: {
        'nail': 30,
        'hair': 45,
        'massage': 60,
        'facial': 45,
        'waxing': 30,
        'eyebrow': 15,
        'makeup': 60
      }
    },
    completionRules: {
      autoCompleteAfterMinutes: 30,
      requiresConfirmation: false
    },
    noShowRules: {
      graceMinutes: 60,
      enableAutoDetection: true
    },
    expiryRules: {
      requestedExpiryHours: 24,
      enableAutoExpiry: true
    },
    batchSize: 100,
    maxRetries: 3,
    retryDelayMs: 5000
  };

  /**
   * Process all automatic state progressions
   */
  async processAutomaticStateProgressions(): Promise<ProgressionResult> {
    if (this.isRunning) {
      logger.warn('Automatic state progression is already running, skipping...');
      return this.createEmptyResult();
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    logger.info('Starting automatic state progression processing...');

    try {
      const result = await this.runComprehensiveCleanup();
      
      // Update metrics
      this.updateMetrics(result);
      
      // Generate daily metrics if needed
      await this.generateDailyMetricsIfNeeded();

      logger.info('Automatic state progression completed', {
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failureCount: result.failureCount,
        processingTimeMs: result.processingTimeMs
      });

      return result;

    } catch (error) {
      logger.error('Failed to process automatic state progressions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 1,
        completedReservations: 0,
        noShowReservations: 0,
        expiredReservations: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } finally {
      this.isRunning = false;
      this.lastRunTime = new Date();
    }
  }

  /**
   * Run comprehensive cleanup using database functions
   */
  private async runComprehensiveCleanup(): Promise<ProgressionResult> {
    const startTime = Date.now();

    try {
      // Use the comprehensive cleanup function from the database
      const { data: cleanupResult, error: cleanupError } = await this.supabase.rpc(
        'comprehensive_reservation_cleanup'
      );

      if (cleanupError) {
        throw new Error(`Database cleanup failed: ${cleanupError.message}`);
      }

      // Extract results from cleanup
      const noShowData = cleanupResult?.no_show_detection || {};
      const expiredData = cleanupResult?.expired_cleanup || {};

      const noShowCount = noShowData.no_show_count || 0;
      const expiredCount = expiredData.expired_count || 0;
      const totalProcessed = noShowCount + expiredCount;

      // Process automatic completions separately (for confirmed reservations past their time)
      const completionResult = await this.processAutomaticCompletions();

      return {
        totalProcessed: totalProcessed + completionResult.processed,
        successCount: totalProcessed + completionResult.processed,
        failureCount: 0,
        completedReservations: completionResult.processed,
        noShowReservations: noShowCount,
        expiredReservations: expiredCount,
        errors: [],
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Comprehensive cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 1,
        completedReservations: 0,
        noShowReservations: 0,
        expiredReservations: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Process automatic completions for confirmed reservations
   */
  private async processAutomaticCompletions(): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      // Get confirmed reservations that should be auto-completed
      const cutoffTime = new Date(Date.now() - this.defaultConfig.completionRules.autoCompleteAfterMinutes * 60 * 1000);
      
      const { data: reservations, error } = await this.supabase
        .from('reservations')
        .select('id, reservation_datetime, status')
        .eq('status', 'confirmed')
        .lt('reservation_datetime', cutoffTime.toISOString())
        .limit(this.defaultConfig.batchSize);

      if (error) {
        errors.push(`Failed to fetch reservations for auto-completion: ${error.message}`);
        return { processed, errors };
      }

      if (!reservations || reservations.length === 0) {
        return { processed, errors };
      }

      // Process reservations in batches using the state machine
      const reservationIds = reservations.map(r => r.id);
      
      const bulkResult = await reservationStateMachine.bulkTransitionReservations(
        reservationIds,
        'completed',
        'system',
        'system',
        'Automatic completion after service time',
        {
          auto_completed: true,
          completion_time: new Date().toISOString(),
          grace_period_minutes: this.defaultConfig.completionRules.autoCompleteAfterMinutes
        }
      );

      processed = bulkResult.successCount;
      
      if (bulkResult.failures && bulkResult.failures.length > 0) {
        bulkResult.failures.forEach(failure => {
          errors.push(`Failed to auto-complete reservation ${failure.reservation_id}: ${failure.error}`);
        });
      }

    } catch (error) {
      errors.push(`Auto-completion processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { processed, errors };
  }

  /**
   * Process automatic state progressions with retry logic
   */
  async processWithRetry(): Promise<ProgressionResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.defaultConfig.maxRetries; attempt++) {
      try {
        return await this.processAutomaticStateProgressions();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.defaultConfig.maxRetries) {
          logger.warn(`Automatic state progression attempt ${attempt} failed, retrying...`, {
            error: lastError.message,
            nextAttemptIn: this.defaultConfig.retryDelayMs
          });
          
          await this.delay(this.defaultConfig.retryDelayMs);
        }
      }
    }

    // All retries failed
    logger.error('All automatic state progression attempts failed', {
      attempts: this.defaultConfig.maxRetries,
      lastError: lastError?.message
    });

    return {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 1,
      completedReservations: 0,
      noShowReservations: 0,
      expiredReservations: 0,
      errors: [`All ${this.defaultConfig.maxRetries} attempts failed: ${lastError?.message}`],
      processingTimeMs: 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get current processing metrics
   */
  getMetrics(): ProgressionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get processing status
   */
  getStatus(): {
    isRunning: boolean;
    lastRunTime: string | null;
    nextScheduledRun: string | null;
    config: AutoProgressionConfig;
  } {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime?.toISOString() || null,
      nextScheduledRun: null, // This would be set by the scheduler
      config: { ...this.defaultConfig }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoProgressionConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...newConfig };
    logger.info('Automatic state progression configuration updated', { newConfig });
  }

  /**
   * Generate daily metrics using database function
   */
  private async generateDailyMetricsIfNeeded(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const { error } = await this.supabase.rpc('generate_daily_state_metrics', {
        p_metric_date: today
      });

      if (error) {
        logger.error('Failed to generate daily metrics', { error: error.message });
      } else {
        logger.info('Daily state metrics generated successfully', { date: today });
      }
    } catch (error) {
      logger.error('Error generating daily metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(result: ProgressionResult): void {
    this.metrics.dailyProcessed += result.totalProcessed;
    this.metrics.dailySuccess += result.successCount;
    this.metrics.dailyFailures += result.failureCount;
    this.metrics.lastRunTime = result.timestamp;
    
    // Calculate error rate
    const totalOperations = this.metrics.dailySuccess + this.metrics.dailyFailures;
    this.metrics.errorRate = totalOperations > 0 ? (this.metrics.dailyFailures / totalOperations) * 100 : 0;
    
    // Update average processing time (simple moving average)
    if (this.metrics.averageProcessingTime === 0) {
      this.metrics.averageProcessingTime = result.processingTimeMs;
    } else {
      this.metrics.averageProcessingTime = (this.metrics.averageProcessingTime + result.processingTimeMs) / 2;
    }
  }

  /**
   * Create empty result for early returns
   */
  private createEmptyResult(): ProgressionResult {
    return {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      completedReservations: 0,
      noShowReservations: 0,
      expiredReservations: 0,
      errors: [],
      processingTimeMs: 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset daily metrics (called by scheduler at midnight)
   */
  resetDailyMetrics(): void {
    this.metrics.dailyProcessed = 0;
    this.metrics.dailySuccess = 0;
    this.metrics.dailyFailures = 0;
    this.metrics.errorRate = 0;
    logger.info('Daily metrics reset');
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      // Check if we can connect to database
      const { error } = await this.supabase.from('reservations').select('count').limit(1);
      
      if (error) {
        return {
          status: 'unhealthy',
          details: {
            database: 'disconnected',
            error: error.message,
            lastRun: this.lastRunTime?.toISOString() || 'never'
          }
        };
      }

      // Check error rate
      const errorRate = this.metrics.errorRate;
      const status = errorRate > 10 ? 'degraded' : 'healthy';

      return {
        status,
        details: {
          database: 'connected',
          errorRate: `${errorRate.toFixed(2)}%`,
          lastRun: this.lastRunTime?.toISOString() || 'never',
          isRunning: this.isRunning,
          dailyProcessed: this.metrics.dailyProcessed
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          lastRun: this.lastRunTime?.toISOString() || 'never'
        }
      };
    }
  }
}

// Export singleton instance
export const automaticStateProgressionService = new AutomaticStateProgressionService();
