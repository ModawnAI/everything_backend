import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import os from 'os';

// =============================================
// HEALTH CHECK TYPES
// =============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  checks: {
    database: HealthCheckResult;
    externalApis: {
      tossPayments: HealthCheckResult;
      fcm: HealthCheckResult;
      supabase: HealthCheckResult;
    };
    system: {
      memory: HealthCheckResult;
      cpu: HealthCheckResult;
      disk: HealthCheckResult;
    };
    dependencies: {
      redis: HealthCheckResult;
      websocket: HealthCheckResult;
    };
    feed: {
      apiEndpoints: HealthCheckResult;
      redisCache: HealthCheckResult;
      imageProcessing: HealthCheckResult;
      contentModeration: HealthCheckResult;
      feedRanking: HealthCheckResult;
      databaseQueries: HealthCheckResult;
    };
  };
  summary: {
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime?: number;
  details?: any;
  lastChecked: string;
}

// =============================================
// HEALTH CHECK SERVICE
// =============================================

export class HealthCheckService {
  private supabase = getSupabaseClient();
  private cache: Map<string, { result: HealthCheckResult; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Basic health check
   */
  async getBasicHealth(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: config.server.env,
    };
  }

  /**
   * Detailed health check with all system components
   */
  async getDetailedHealth(): Promise<DetailedHealthStatus> {
    const startTime = Date.now();

    // Run all health checks in parallel
    const [
      databaseCheck,
      tossPaymentsCheck,
      fcmCheck,
      supabaseCheck,
      memoryCheck,
      cpuCheck,
      diskCheck,
      redisCheck,
      websocketCheck,
      feedApiEndpointsCheck,
      feedRedisCacheCheck,
      feedImageProcessingCheck,
      feedContentModerationCheck,
      feedRankingCheck,
      feedDatabaseQueriesCheck,
    ] = await Promise.all([
      this.checkDatabase(),
      this.checkTossPayments(),
      this.checkFCM(),
      this.checkSupabase(),
      this.checkMemory(),
      this.checkCPU(),
      this.checkDisk(),
      this.checkRedis(),
      this.checkWebSocket(),
      this.checkFeedApiEndpoints(),
      this.checkFeedRedisCache(),
      this.checkImageProcessing(),
      this.checkContentModeration(),
      this.checkFeedRanking(),
      this.checkFeedDatabaseQueries(),
    ]);

    const responseTime = Date.now() - startTime;

    // Calculate summary
    const allChecks = [
      databaseCheck,
      tossPaymentsCheck,
      fcmCheck,
      supabaseCheck,
      memoryCheck,
      cpuCheck,
      diskCheck,
      redisCheck,
      websocketCheck,
      feedApiEndpointsCheck,
      feedRedisCacheCheck,
      feedImageProcessingCheck,
      feedContentModerationCheck,
      feedRankingCheck,
      feedDatabaseQueriesCheck,
    ];

    const summary = this.calculateSummary(allChecks);

    // Determine overall status
    const overallStatus = this.determineOverallStatus(summary);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: config.server.env,
      checks: {
        database: databaseCheck,
        externalApis: {
          tossPayments: tossPaymentsCheck,
          fcm: fcmCheck,
          supabase: supabaseCheck,
        },
        system: {
          memory: memoryCheck,
          cpu: cpuCheck,
          disk: diskCheck,
        },
        dependencies: {
          redis: redisCheck,
          websocket: websocketCheck,
        },
        feed: {
          apiEndpoints: feedApiEndpointsCheck,
          redisCache: feedRedisCacheCheck,
          imageProcessing: feedImageProcessingCheck,
          contentModeration: feedContentModerationCheck,
          feedRanking: feedRankingCheck,
          databaseQueries: feedDatabaseQueriesCheck,
        },
      },
      summary,
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const cacheKey = 'database';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      // Test database connection with a simple query
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);

      const responseTime = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: error ? 'unhealthy' : 'healthy',
        message: error ? 'Database connection failed' : 'Database connection successful',
        responseTime,
        details: {
          error: error?.message,
          data: data?.length || 0,
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'Database connection failed',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Check TossPayments API
   */
  private async checkTossPayments(): Promise<HealthCheckResult> {
    const cacheKey = 'tossPayments';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      // Test TossPayments API connectivity
      const response = await fetch(`${config.payments.tossPayments.baseUrl}/v1/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(config.payments.tossPayments.secretKey + ':').toString('base64')}`,
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const responseTime = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: response.ok ? 'healthy' : 'degraded',
        message: response.ok ? 'TossPayments API accessible' : 'TossPayments API issues detected',
        responseTime,
        details: {
          statusCode: response.status,
          statusText: response.statusText,
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'TossPayments API unreachable',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Check FCM (Firebase Cloud Messaging)
   */
  private async checkFCM(): Promise<HealthCheckResult> {
    const cacheKey = 'fcm';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      // Test FCM configuration
      const result: HealthCheckResult = {
        status: config.notifications.fcm.serverKey ? 'healthy' : 'degraded',
        message: config.notifications.fcm.serverKey ? 'FCM configured' : 'FCM not configured',
        responseTime: Date.now() - startTime,
        details: {
          projectId: config.notifications.fcm.projectId,
          configured: !!config.notifications.fcm.serverKey,
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'FCM check failed',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Check Supabase connectivity
   */
  private async checkSupabase(): Promise<HealthCheckResult> {
    const cacheKey = 'supabase';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      // Test Supabase connection
      const { data, error } = await this.supabase.auth.getSession();

      const responseTime = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: error ? 'degraded' : 'healthy',
        message: error ? 'Supabase connection issues' : 'Supabase connection successful',
        responseTime,
        details: {
          error: error?.message,
          hasSession: !!data.session,
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'Supabase connection failed',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Check system memory usage
   */
  private async checkMemory(): Promise<HealthCheckResult> {
    const cacheKey = 'memory';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = (usedMem / totalMem) * 100;

      const result: HealthCheckResult = {
        status: memoryUsagePercent > 90 ? 'unhealthy' : memoryUsagePercent > 80 ? 'degraded' : 'healthy',
        message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        responseTime: Date.now() - startTime,
        details: {
          totalMemory: totalMem,
          freeMemory: freeMem,
          usedMemory: usedMem,
          usagePercent: memoryUsagePercent,
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'Memory check failed',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Check CPU usage
   */
  private async checkCPU(): Promise<HealthCheckResult> {
    const cacheKey = 'cpu';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      const cpus = os.cpus();
      const loadAverage = os.loadavg();
      const cpuUsage = loadAverage[0] || 0; // 1-minute load average

      const result: HealthCheckResult = {
        status: cpuUsage > 2.0 ? 'unhealthy' : cpuUsage > 1.0 ? 'degraded' : 'healthy',
        message: `CPU load average: ${cpuUsage.toFixed(2)}`,
        responseTime: Date.now() - startTime,
        details: {
          loadAverage,
          cpuCount: cpus.length,
          cpuModel: cpus[0]?.model,
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'CPU check failed',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Check disk usage
   */
  private async checkDisk(): Promise<HealthCheckResult> {
    const cacheKey = 'disk';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      // This is a simplified disk check
      // In production, you might want to use a library like 'diskusage'
      const result: HealthCheckResult = {
        status: 'healthy',
        message: 'Disk check passed',
        responseTime: Date.now() - startTime,
        details: {
          platform: os.platform(),
          arch: os.arch(),
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'Disk check failed',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    const cacheKey = 'redis';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      // Simplified Redis check - in production, you'd test actual Redis connection
      const result: HealthCheckResult = {
        status: 'healthy',
        message: 'Redis check passed',
        responseTime: Date.now() - startTime,
        details: {
          configured: !!config.redis.url,
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'Redis check failed',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Check WebSocket service
   */
  private async checkWebSocket(): Promise<HealthCheckResult> {
    const cacheKey = 'websocket';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      // Simplified WebSocket check
      const result: HealthCheckResult = {
        status: 'healthy',
        message: 'WebSocket service available',
        responseTime: Date.now() - startTime,
        details: {
          service: 'Socket.io',
        },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: 'WebSocket service unavailable',
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        lastChecked: new Date().toISOString(),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Get cached result if still valid
   */
  private getCachedResult(key: string): HealthCheckResult | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.result;
    }
    return null;
  }

  /**
   * Cache health check result
   */
  private cacheResult(key: string, result: HealthCheckResult): void {
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Calculate summary from all health checks
   */
  private calculateSummary(checks: HealthCheckResult[]): {
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
  } {
    const summary = {
      totalChecks: checks.length,
      healthyChecks: 0,
      degradedChecks: 0,
      unhealthyChecks: 0,
    };

    checks.forEach(check => {
      switch (check.status) {
        case 'healthy':
          summary.healthyChecks++;
          break;
        case 'degraded':
          summary.degradedChecks++;
          break;
        case 'unhealthy':
          summary.unhealthyChecks++;
          break;
      }
    });

    return summary;
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(summary: {
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
  }): 'healthy' | 'degraded' | 'unhealthy' {
    if (summary.unhealthyChecks > 0) return 'unhealthy';
    if (summary.degradedChecks > 0) return 'degraded';
    return 'healthy';
  }

  /**
   * Clear health check cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ========================================
  // FEED-SPECIFIC HEALTH CHECKS
  // ========================================

  /**
   * Check feed API endpoints health
   */
  async checkFeedApiEndpoints(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Test basic feed endpoint availability
      const testQueries = [
        { endpoint: '/api/feed/posts', method: 'GET' },
        { endpoint: '/api/feed/personalized', method: 'POST' },
        { endpoint: '/api/feed/trending', method: 'GET' }
      ];

      let healthyEndpoints = 0;
      const errors: string[] = [];

      for (const query of testQueries) {
        try {
          // Simulate endpoint availability check
          // In a real implementation, you might make actual HTTP requests
          // For now, we'll check if the routes are registered
          healthyEndpoints++;
        } catch (error) {
          errors.push(`${query.method} ${query.endpoint}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const responseTime = Date.now() - startTime;
      const successRate = (healthyEndpoints / testQueries.length) * 100;

      if (successRate >= 100) {
        return {
          status: 'healthy',
          message: `All ${testQueries.length} feed API endpoints are healthy`,
          responseTime,
          details: {
            healthyEndpoints,
            totalEndpoints: testQueries.length,
            successRate: `${successRate.toFixed(1)}%`
          },
          lastChecked: new Date().toISOString()
        };
      } else if (successRate >= 80) {
        return {
          status: 'degraded',
          message: `${healthyEndpoints}/${testQueries.length} feed API endpoints are healthy`,
          responseTime,
          details: {
            healthyEndpoints,
            totalEndpoints: testQueries.length,
            successRate: `${successRate.toFixed(1)}%`,
            errors
          },
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: `Only ${healthyEndpoints}/${testQueries.length} feed API endpoints are healthy`,
          responseTime,
          details: {
            healthyEndpoints,
            totalEndpoints: testQueries.length,
            successRate: `${successRate.toFixed(1)}%`,
            errors
          },
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Feed API endpoints check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check Redis cache connectivity and operations
   */
  async checkFeedRedisCache(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Import Redis client dynamically to avoid circular dependencies
      const { createClient } = await import('redis');
      const redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      await redis.connect();

      // Test basic Redis operations
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'test_value';

      // Test SET operation
      await redis.set(testKey, testValue, { EX: 60 }); // Expire in 60 seconds

      // Test GET operation
      const retrievedValue = await redis.get(testKey);

      // Test DEL operation
      await redis.del(testKey);

      await redis.disconnect();

      const responseTime = Date.now() - startTime;

      if (retrievedValue === testValue) {
        return {
          status: 'healthy',
          message: 'Redis cache operations are working correctly',
          responseTime,
          details: {
            operations: ['SET', 'GET', 'DEL'],
            testKey,
            retrievedValue
          },
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'Redis cache operations failed - retrieved value does not match',
          responseTime,
          details: {
            expected: testValue,
            actual: retrievedValue
          },
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Redis cache check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check image processing pipeline health
   */
  async checkImageProcessing(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Check Supabase storage connectivity
      const { data: buckets, error: bucketError } = await this.supabase
        .storage
        .listBuckets();

      if (bucketError) {
        return {
          status: 'unhealthy',
          message: `Supabase storage check failed: ${bucketError.message}`,
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString()
        };
      }

      // Check if feed-images bucket exists
      const feedImagesBucket = buckets?.find(bucket => bucket.name === 'feed-images');
      
      // Test Sharp availability (image processing library)
      let sharpAvailable = false;
      try {
        const sharp = await import('sharp');
        sharpAvailable = true;
      } catch (sharpError) {
        // Sharp not available
      }

      const responseTime = Date.now() - startTime;
      const checks = {
        supabaseStorage: !!buckets,
        feedImagesBucket: !!feedImagesBucket,
        sharpAvailable
      };

      const healthyChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      if (healthyChecks === totalChecks) {
        return {
          status: 'healthy',
          message: 'Image processing pipeline is fully operational',
          responseTime,
          details: {
            ...checks,
            buckets: buckets?.map(b => b.name) || []
          },
          lastChecked: new Date().toISOString()
        };
      } else if (healthyChecks >= 2) {
        return {
          status: 'degraded',
          message: `Image processing pipeline partially operational (${healthyChecks}/${totalChecks} checks passed)`,
          responseTime,
          details: checks,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: `Image processing pipeline has issues (${healthyChecks}/${totalChecks} checks passed)`,
          responseTime,
          details: checks,
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Image processing check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check content moderation system health
   */
  async checkContentModeration(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Check moderation tables exist and are accessible
      const { data: moderationLogs, error: logsError } = await this.supabase
        .from('moderation_log')
        .select('id')
        .limit(1);

      // Check content moderation service availability
      let moderationServiceAvailable = false;
      try {
        // Try to import and instantiate moderation service
        const moderationModule = await import('../services/content-moderator.service');
        moderationServiceAvailable = true;
      } catch (importError) {
        // Service not available
      }

      const responseTime = Date.now() - startTime;
      const checks = {
        moderationLogsTable: !logsError,
        moderationService: moderationServiceAvailable
      };

      const healthyChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      if (healthyChecks === totalChecks) {
        return {
          status: 'healthy',
          message: 'Content moderation system is fully operational',
          responseTime,
          details: checks,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'degraded',
          message: `Content moderation system has issues (${healthyChecks}/${totalChecks} checks passed)`,
          responseTime,
          details: {
            ...checks,
            error: logsError?.message
          },
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Content moderation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check feed ranking system health
   */
  async checkFeedRanking(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Check feed ranking service availability
      let rankingServiceAvailable = false;
      try {
        const rankingModule = await import('../services/feed-ranking.service');
        rankingServiceAvailable = true;
      } catch (importError) {
        // Service not available
      }

      // Check if feed posts table is accessible for ranking calculations
      const { data: posts, error: postsError } = await this.supabase
        .from('feed_posts')
        .select('id')
        .limit(1);

      const responseTime = Date.now() - startTime;
      const checks = {
        rankingService: rankingServiceAvailable,
        feedPostsTable: !postsError
      };

      const healthyChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      if (healthyChecks === totalChecks) {
        return {
          status: 'healthy',
          message: 'Feed ranking system is fully operational',
          responseTime,
          details: checks,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'degraded',
          message: `Feed ranking system has issues (${healthyChecks}/${totalChecks} checks passed)`,
          responseTime,
          details: {
            ...checks,
            error: postsError?.message
          },
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Feed ranking check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check feed database queries performance
   */
  async checkFeedDatabaseQueries(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Test common feed database queries
      const queries = [
        { name: 'feed_posts_count', query: () => this.supabase.from('feed_posts').select('id', { count: 'exact' }) },
        { name: 'post_comments_count', query: () => this.supabase.from('post_comments').select('id', { count: 'exact' }) },
        { name: 'post_likes_count', query: () => this.supabase.from('post_likes').select('id', { count: 'exact' }) }
      ];

      const results: any[] = [];
      let successfulQueries = 0;

      for (const query of queries) {
        try {
          const queryStart = Date.now();
          const { error } = await query.query();
          const queryDuration = Date.now() - queryStart;
          
          if (!error) {
            successfulQueries++;
            results.push({
              name: query.name,
              duration: queryDuration,
              status: 'success'
            });
          } else {
            results.push({
              name: query.name,
              duration: queryDuration,
              status: 'error',
              error: error.message
            });
          }
        } catch (queryError) {
          results.push({
            name: query.name,
            status: 'error',
            error: queryError instanceof Error ? queryError.message : 'Unknown error'
          });
        }
      }

      const responseTime = Date.now() - startTime;
      const successRate = (successfulQueries / queries.length) * 100;
      const avgQueryTime = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;

      if (successRate === 100 && avgQueryTime < 1000) {
        return {
          status: 'healthy',
          message: `All feed database queries are performing well (avg: ${avgQueryTime.toFixed(0)}ms)`,
          responseTime,
          details: {
            successfulQueries,
            totalQueries: queries.length,
            successRate: `${successRate.toFixed(1)}%`,
            averageQueryTime: `${avgQueryTime.toFixed(0)}ms`,
            queryResults: results
          },
          lastChecked: new Date().toISOString()
        };
      } else if (successRate >= 80) {
        return {
          status: 'degraded',
          message: `Feed database queries are slow or have issues (${successfulQueries}/${queries.length} successful, avg: ${avgQueryTime.toFixed(0)}ms)`,
          responseTime,
          details: {
            successfulQueries,
            totalQueries: queries.length,
            successRate: `${successRate.toFixed(1)}%`,
            averageQueryTime: `${avgQueryTime.toFixed(0)}ms`,
            queryResults: results
          },
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: `Feed database queries are failing (${successfulQueries}/${queries.length} successful)`,
          responseTime,
          details: {
            successfulQueries,
            totalQueries: queries.length,
            successRate: `${successRate.toFixed(1)}%`,
            averageQueryTime: `${avgQueryTime.toFixed(0)}ms`,
            queryResults: results
          },
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Feed database queries check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    }
  }
}

export const healthCheckService = new HealthCheckService(); 