/**
 * Feed Ranking Performance Monitor
 *
 * Tracks and reports performance metrics for feed ranking operations.
 * Monitors execution times, cache hit rates, slow queries, and provides
 * insights for optimization.
 */

import { logger } from '../utils/logger';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  totalCalls: number;
  cacheHits: number;
  cacheMisses: number;
  avgExecutionTime: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  slowQueryCount: number;
  verySlowQueryCount: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  cacheHitRate: number;
  recentExecutionTimes: number[];
}

export interface PerformanceAlert {
  type: 'slow_query' | 'very_slow_query' | 'low_cache_hit_rate' | 'high_avg_time';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export class FeedRankingPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    totalCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgExecutionTime: 0,
    maxExecutionTime: 0,
    minExecutionTime: Infinity,
    slowQueryCount: 0,
    verySlowQueryCount: 0,
    p50ExecutionTime: 0,
    p95ExecutionTime: 0,
    p99ExecutionTime: 0,
    cacheHitRate: 0,
    recentExecutionTimes: []
  };

  private readonly SLOW_QUERY_THRESHOLD_MS = 1000;
  private readonly VERY_SLOW_QUERY_THRESHOLD_MS = 3000;
  private readonly MAX_EXECUTION_TIME_SAMPLES = 100;
  private readonly LOW_CACHE_HIT_RATE_THRESHOLD = 0.5; // 50%
  private readonly HIGH_AVG_TIME_THRESHOLD_MS = 500;

  private alerts: PerformanceAlert[] = [];
  private readonly MAX_ALERTS = 50;

  /**
   * Track execution time of a feed ranking operation
   */
  async trackExecution<T>(
    operation: string,
    fn: () => Promise<T>,
    isCacheHit: boolean = false
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await fn();
      const executionTime = performance.now() - startTime;

      this.recordMetrics(executionTime, isCacheHit);
      this.checkForAlerts(operation, executionTime);

      logger.debug(`Feed ranking operation completed`, {
        operation,
        executionTime: `${executionTime.toFixed(2)}ms`,
        isCacheHit,
        metrics: this.getMetricsSummary()
      });

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;

      logger.error(`Feed ranking operation failed`, {
        operation,
        executionTime: `${executionTime.toFixed(2)}ms`,
        error
      });

      throw error;
    }
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(executionTime: number, isCacheHit: boolean): void {
    this.metrics.totalCalls++;

    if (isCacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    // Update execution time stats
    this.metrics.recentExecutionTimes.push(executionTime);
    if (this.metrics.recentExecutionTimes.length > this.MAX_EXECUTION_TIME_SAMPLES) {
      this.metrics.recentExecutionTimes.shift();
    }

    this.metrics.maxExecutionTime = Math.max(this.metrics.maxExecutionTime, executionTime);
    this.metrics.minExecutionTime = Math.min(this.metrics.minExecutionTime, executionTime);

    // Calculate rolling average
    const sum = this.metrics.recentExecutionTimes.reduce((a, b) => a + b, 0);
    this.metrics.avgExecutionTime = sum / this.metrics.recentExecutionTimes.length;

    // Calculate percentiles
    const sorted = [...this.metrics.recentExecutionTimes].sort((a, b) => a - b);
    this.metrics.p50ExecutionTime = this.calculatePercentile(sorted, 50);
    this.metrics.p95ExecutionTime = this.calculatePercentile(sorted, 95);
    this.metrics.p99ExecutionTime = this.calculatePercentile(sorted, 99);

    // Track slow queries
    if (executionTime > this.SLOW_QUERY_THRESHOLD_MS) {
      this.metrics.slowQueryCount++;
    }

    if (executionTime > this.VERY_SLOW_QUERY_THRESHOLD_MS) {
      this.metrics.verySlowQueryCount++;
    }

    // Calculate cache hit rate
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = totalRequests > 0
      ? this.metrics.cacheHits / totalRequests
      : 0;
  }

  /**
   * Calculate percentile value
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Check for performance alerts
   */
  private checkForAlerts(operation: string, executionTime: number): void {
    // Slow query alert
    if (executionTime > this.SLOW_QUERY_THRESHOLD_MS) {
      this.addAlert({
        type: 'slow_query',
        message: `Slow feed ranking query detected for ${operation}`,
        value: executionTime,
        threshold: this.SLOW_QUERY_THRESHOLD_MS,
        timestamp: new Date()
      });
    }

    // Very slow query alert
    if (executionTime > this.VERY_SLOW_QUERY_THRESHOLD_MS) {
      this.addAlert({
        type: 'very_slow_query',
        message: `Very slow feed ranking query detected for ${operation}`,
        value: executionTime,
        threshold: this.VERY_SLOW_QUERY_THRESHOLD_MS,
        timestamp: new Date()
      });

      logger.warn(`⚠️ Very slow feed ranking query`, {
        operation,
        executionTime: `${executionTime.toFixed(2)}ms`,
        threshold: `${this.VERY_SLOW_QUERY_THRESHOLD_MS}ms`
      });
    }

    // Low cache hit rate alert
    if (
      this.metrics.totalCalls > 20 &&
      this.metrics.cacheHitRate < this.LOW_CACHE_HIT_RATE_THRESHOLD
    ) {
      this.addAlert({
        type: 'low_cache_hit_rate',
        message: `Low cache hit rate for feed ranking`,
        value: this.metrics.cacheHitRate,
        threshold: this.LOW_CACHE_HIT_RATE_THRESHOLD,
        timestamp: new Date()
      });
    }

    // High average time alert
    if (
      this.metrics.recentExecutionTimes.length >= 10 &&
      this.metrics.avgExecutionTime > this.HIGH_AVG_TIME_THRESHOLD_MS
    ) {
      this.addAlert({
        type: 'high_avg_time',
        message: `High average execution time for feed ranking`,
        value: this.metrics.avgExecutionTime,
        threshold: this.HIGH_AVG_TIME_THRESHOLD_MS,
        timestamp: new Date()
      });
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.shift();
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics summary for logging
   */
  getMetricsSummary(): object {
    return {
      totalCalls: this.metrics.totalCalls,
      avgTime: `${this.metrics.avgExecutionTime.toFixed(2)}ms`,
      p95Time: `${this.metrics.p95ExecutionTime.toFixed(2)}ms`,
      cacheHitRate: `${(this.metrics.cacheHitRate * 100).toFixed(1)}%`,
      slowQueries: this.metrics.slowQueryCount
    };
  }

  /**
   * Get recent performance alerts
   */
  getAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get detailed performance report
   */
  getPerformanceReport(): object {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;

    return {
      summary: {
        totalCalls: this.metrics.totalCalls,
        totalRequests,
        cacheHits: this.metrics.cacheHits,
        cacheMisses: this.metrics.cacheMisses,
        cacheHitRate: `${(this.metrics.cacheHitRate * 100).toFixed(2)}%`,
        slowQueries: this.metrics.slowQueryCount,
        verySlowQueries: this.metrics.verySlowQueryCount,
        slowQueryRate: totalRequests > 0
          ? `${((this.metrics.slowQueryCount / totalRequests) * 100).toFixed(2)}%`
          : '0%'
      },
      executionTimes: {
        avg: `${this.metrics.avgExecutionTime.toFixed(2)}ms`,
        min: `${this.metrics.minExecutionTime.toFixed(2)}ms`,
        max: `${this.metrics.maxExecutionTime.toFixed(2)}ms`,
        p50: `${this.metrics.p50ExecutionTime.toFixed(2)}ms`,
        p95: `${this.metrics.p95ExecutionTime.toFixed(2)}ms`,
        p99: `${this.metrics.p99ExecutionTime.toFixed(2)}ms`
      },
      thresholds: {
        slowQuery: `${this.SLOW_QUERY_THRESHOLD_MS}ms`,
        verySlowQuery: `${this.VERY_SLOW_QUERY_THRESHOLD_MS}ms`,
        lowCacheHitRate: `${(this.LOW_CACHE_HIT_RATE_THRESHOLD * 100).toFixed(0)}%`,
        highAvgTime: `${this.HIGH_AVG_TIME_THRESHOLD_MS}ms`
      },
      recentAlerts: this.getAlerts(5),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Cache hit rate recommendations
    if (this.metrics.cacheHitRate < 0.3 && this.metrics.totalCalls > 20) {
      recommendations.push(
        '⚠️ Very low cache hit rate (<30%). Consider increasing cache TTL or reviewing cache keys.'
      );
    } else if (this.metrics.cacheHitRate < 0.5 && this.metrics.totalCalls > 20) {
      recommendations.push(
        '⚠️ Low cache hit rate (<50%). Review caching strategy and consider warming cache.'
      );
    }

    // Execution time recommendations
    if (this.metrics.avgExecutionTime > 1000) {
      recommendations.push(
        '⚠️ High average execution time (>1s). Consider optimizing database queries or adding indexes.'
      );
    } else if (this.metrics.avgExecutionTime > 500) {
      recommendations.push(
        '⚠️ Moderate execution time (>500ms). Monitor for further degradation.'
      );
    }

    // Slow query recommendations
    const slowQueryRate = this.metrics.totalCalls > 0
      ? this.metrics.slowQueryCount / this.metrics.totalCalls
      : 0;

    if (slowQueryRate > 0.2) {
      recommendations.push(
        `⚠️ High slow query rate (${(slowQueryRate * 100).toFixed(0)}%). Review query optimization and consider pagination limits.`
      );
    }

    // Very slow query recommendations
    if (this.metrics.verySlowQueryCount > 5) {
      recommendations.push(
        `🚨 ${this.metrics.verySlowQueryCount} very slow queries (>3s) detected. Immediate optimization required.`
      );
    }

    // p95/p99 recommendations
    if (this.metrics.p95ExecutionTime > 2000) {
      recommendations.push(
        '⚠️ P95 latency is high (>2s). This affects user experience for 5% of requests.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Performance is within acceptable thresholds.');
    }

    return recommendations;
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  resetMetrics(): void {
    this.metrics = {
      totalCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgExecutionTime: 0,
      maxExecutionTime: 0,
      minExecutionTime: Infinity,
      slowQueryCount: 0,
      verySlowQueryCount: 0,
      p50ExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      cacheHitRate: 0,
      recentExecutionTimes: []
    };
    this.alerts = [];

    logger.info('Feed ranking performance metrics reset');
  }

  /**
   * Log performance report to console
   */
  logPerformanceReport(): void {
    const report = this.getPerformanceReport();

    logger.info('📊 Feed Ranking Performance Report', report);

    // Also log in a formatted way for better readability
    console.log('\n' + '='.repeat(60));
    console.log('📊 FEED RANKING PERFORMANCE REPORT');
    console.log('='.repeat(60));
    console.log(JSON.stringify(report, null, 2));
    console.log('='.repeat(60) + '\n');
  }
}

// Singleton instance
export const feedRankingPerformanceMonitor = new FeedRankingPerformanceMonitor();
