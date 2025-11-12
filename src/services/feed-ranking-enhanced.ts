/**
 * Enhanced Feed Ranking Service
 *
 * Wraps the existing feed-ranking service with performance monitoring and intelligent caching.
 * Provides optimized methods for large-scale feed operations.
 */

import { feedRankingCache } from './feed-ranking-cache';
import { feedRankingPerformanceMonitor } from './feed-ranking-performance';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

export interface FeedAnalytics {
  totalPosts: number;
  avgEngagementRate: number;
  topCategories: Array<{ category: string; count: number }>;
  engagementTrends: Array<{ date: string; engagement: number }>;
  personalizedScore: number;
  totalLikes?: number;
  avgLikes?: number;
  totalComments?: number;
  avgComments?: number;
  totalViews?: number;
  avgViews?: number;
}

export class EnhancedFeedRankingService {
  private supabase = getSupabaseClient();

  /**
   * Generate personalized feed score with caching and performance monitoring
   */
  async generatePersonalizedFeedScore(userId: string): Promise<FeedAnalytics> {
    const cacheKey = `analytics:user:${userId}`;

    return await feedRankingCache.getOrSet(
      cacheKey,
      async () => {
        return await this.calculateFeedAnalytics(userId);
      },
      {
        ttl: 5 * 60, // 5 minutes
        prefix: 'feed'
      }
    );
  }

  /**
   * Calculate feed analytics with performance tracking
   */
  private async calculateFeedAnalytics(userId: string): Promise<FeedAnalytics> {
    return await feedRankingPerformanceMonitor.trackExecution(
      `calculateFeedAnalytics:${userId}`,
      async () => {
        // Fetch user's posts
        const { data: posts } = await this.supabase
          .from('feed_posts')
          .select('*')
          .eq('author_id', userId);

        if (!posts || posts.length === 0) {
          return this.getEmptyAnalytics();
        }

        // Calculate metrics
        const totalLikes = posts.reduce((sum, p) => sum + (p.like_count || 0), 0);
        const totalComments = posts.reduce((sum, p) => sum + (p.comment_count || 0), 0);
        const totalShares = posts.reduce((sum, p) => sum + (p.share_count || 0), 0);
        const totalViews = posts.reduce((sum, p) => sum + (p.view_count || 0), 0);
        const totalEngagement = totalLikes + totalComments + totalShares;

        const avgEngagementRate = totalViews > 0
          ? (totalEngagement / totalViews) * 100
          : 0;

        const avgLikes = totalLikes / posts.length;
        const avgComments = totalComments / posts.length;
        const avgViews = totalViews / posts.length;

        // Category analysis
        const categoryCount: Record<string, number> = {};
        posts.forEach(post => {
          if (post.category) {
            categoryCount[post.category] = (categoryCount[post.category] || 0) + 1;
          }
        });

        const topCategories = Object.entries(categoryCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([category, count]) => ({ category, count }));

        // Engagement trends (last 7 days)
        const engagementTrends = this.calculateEngagementTrends(posts);

        // Personalized score (0-100)
        const personalizedScore = Math.min(100, Math.round(
          (avgEngagementRate * 50) +  // 50% weight on engagement rate
          (avgLikes / 10) +            // Bonus for likes
          (avgComments / 5) +          // Higher weight on comments
          (posts.length * 2)           // Bonus for posting frequency
        ));

        return {
          totalPosts: posts.length,
          avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
          topCategories,
          engagementTrends,
          personalizedScore,
          totalLikes,
          avgLikes: Math.round(avgLikes * 100) / 100,
          totalComments,
          avgComments: Math.round(avgComments * 100) / 100,
          totalViews,
          avgViews: Math.round(avgViews * 100) / 100
        };
      },
      false
    );
  }

  /**
   * Calculate engagement trends for last 7 days
   */
  private calculateEngagementTrends(posts: any[]): Array<{ date: string; engagement: number }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentPosts = posts.filter(p =>
      new Date(p.created_at) >= sevenDaysAgo
    );

    const dailyEngagement: Record<string, number> = {};

    recentPosts.forEach(post => {
      const date = new Date(post.created_at).toISOString().split('T')[0];
      const engagement = (post.like_count || 0) + (post.comment_count || 0) + (post.share_count || 0);

      dailyEngagement[date] = (dailyEngagement[date] || 0) + engagement;
    });

    return Object.entries(dailyEngagement)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, engagement]) => ({ date, engagement }));
  }

  /**
   * Get empty analytics object
   */
  private getEmptyAnalytics(): FeedAnalytics {
    return {
      totalPosts: 0,
      avgEngagementRate: 0,
      topCategories: [],
      engagementTrends: [],
      personalizedScore: 0,
      totalLikes: 0,
      avgLikes: 0,
      totalComments: 0,
      avgComments: 0,
      totalViews: 0,
      avgViews: 0
    };
  }

  /**
   * Batch calculate analytics for multiple users (optimized)
   */
  async batchGenerateFeedScores(userIds: string[]): Promise<Map<string, FeedAnalytics>> {
    return await feedRankingPerformanceMonitor.trackExecution(
      `batchGenerateFeedScores:${userIds.length}`,
      async () => {
        const results = new Map<string, FeedAnalytics>();

        // Try to get cached results first
        const cacheKeys = userIds.map(id => `analytics:user:${id}`);
        const cachedResults = await feedRankingCache.mget<FeedAnalytics>(cacheKeys, {
          prefix: 'feed'
        });

        // Identify cache misses
        const missingUserIds: string[] = [];
        userIds.forEach((userId, index) => {
          if (cachedResults[index]) {
            results.set(userId, cachedResults[index]!);
          } else {
            missingUserIds.push(userId);
          }
        });

        // Fetch missing analytics
        if (missingUserIds.length > 0) {
          logger.info('Cache miss for batch analytics', {
            totalUsers: userIds.length,
            cachedUsers: results.size,
            missingUsers: missingUserIds.length
          });

          const missingResults = await Promise.all(
            missingUserIds.map(id => this.calculateFeedAnalytics(id))
          );

          // Cache the new results
          const entriesToCache = missingUserIds.map((userId, index) => ({
            key: `analytics:user:${userId}`,
            value: missingResults[index]
          }));

          await feedRankingCache.mset(entriesToCache, {
            ttl: 5 * 60,
            prefix: 'feed'
          });

          // Add to results
          missingUserIds.forEach((userId, index) => {
            results.set(userId, missingResults[index]);
          });
        }

        return results;
      },
      results.size === userIds.length // All cached = cache hit
    );
  }

  /**
   * Invalidate user feed cache (call when user posts new content)
   */
  async invalidateUserFeedCache(userId: string): Promise<void> {
    await feedRankingCache.invalidateUserCache(userId);
    logger.info('User feed cache invalidated', { userId });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): object {
    return feedRankingPerformanceMonitor.getPerformanceReport();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<object> {
    return await feedRankingCache.getStats();
  }

  /**
   * Generate comprehensive health report
   */
  async getHealthReport(): Promise<object> {
    const performanceMetrics = feedRankingPerformanceMonitor.getMetrics();
    const cacheStats = await feedRankingCache.getStats();

    const health = {
      status: 'healthy',
      warnings: [] as string[],
      errors: [] as string[]
    };

    // Check cache health
    if (!feedRankingCache.isConnected()) {
      health.status = 'degraded';
      health.warnings.push('Redis cache is not connected');
    }

    if (cacheStats.hitRate < 0.3) {
      health.warnings.push(`Low cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    }

    // Check performance health
    if (performanceMetrics.avgExecutionTime > 1000) {
      health.status = 'degraded';
      health.warnings.push(`High average execution time: ${performanceMetrics.avgExecutionTime.toFixed(0)}ms`);
    }

    if (performanceMetrics.verySlowQueryCount > 10) {
      health.status = 'unhealthy';
      health.errors.push(`${performanceMetrics.verySlowQueryCount} very slow queries detected`);
    }

    return {
      health,
      performance: performanceMetrics,
      cache: cacheStats,
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton export
export const enhancedFeedRankingService = new EnhancedFeedRankingService();
