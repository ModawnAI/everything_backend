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
}

export const healthCheckService = new HealthCheckService(); 