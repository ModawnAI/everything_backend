import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './environment';
import { logger } from '../utils/logger';

// Database connection configuration
interface DatabaseConfig {
  client: SupabaseClient;
  healthCheck: () => Promise<boolean>;
  disconnect: () => Promise<void>;
}

// Connection pool settings for production optimization
const CONNECTION_POOL_CONFIG = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'ebeautything-backend',
    },
  },
  db: {
    schema: 'public' as const,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
};

// Retry configuration for connection resilience
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

/**
 * Create and configure Supabase client with optimized settings
 */
function createSupabaseClient(): SupabaseClient {
  // In test environment, create a mock client
  if (config.server.env === 'test') {
    // If running under Jest, let the test file's own mock take precedence
    if (typeof jest !== 'undefined') {
      return {} as any;
    }
    // Factory for a deeply chainable query mock (for non-Jest test runners)
    const createQueryMock = (): Record<string, any> => {
      const queryMock: Record<string, any> = {};
      // Attach all methods as jest.fn returning queryMock or a new queryMock
      ['eq', 'in', 'gte', 'lte', 'order', 'limit', 'single'].forEach(method => {
        queryMock[method] = jest.fn(() => queryMock);
      });
      // For .order().limit() and similar, return a new queryMock for each chain
      queryMock.order = jest.fn(() => createQueryMock());
      queryMock.in = jest.fn(() => createQueryMock());
      queryMock.gte = jest.fn(() => createQueryMock());
      queryMock.lte = jest.fn(() => createQueryMock());
      queryMock.eq = jest.fn(() => createQueryMock());
      queryMock.limit = jest.fn(() => createQueryMock());
      queryMock.single = jest.fn(() => createQueryMock());
      return queryMock;
    };

    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => createQueryMock()),
      insert: jest.fn(() => createQueryMock()),
      update: jest.fn(() => createQueryMock()),
      delete: jest.fn(() => createQueryMock()),
    }));

    const mockClient = {
      from: mockFrom,
      auth: {
        getUser: jest.fn(),
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn()
      },
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(),
          download: jest.fn(),
          remove: jest.fn(),
          list: jest.fn(),
          createSignedUrl: jest.fn(),
          getPublicUrl: jest.fn()
        }))
      },
      rpc: jest.fn()
    };
    
    logger.info('Mock Supabase client created for test environment');
    return mockClient as any;
  }

  if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
    throw new Error('Missing required Supabase configuration');
  }

  const supabaseClient = createClient<any, 'public'>(
    config.database.supabaseUrl,
    config.database.supabaseServiceRoleKey,
    CONNECTION_POOL_CONFIG
  );

  logger.info('Supabase client initialized successfully', {
    url: config.database.supabaseUrl,
    environment: config.server.env,
  });

  return supabaseClient;
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  context: string,
  retryCount = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retryCount >= RETRY_CONFIG.maxRetries) {
      logger.error(`Operation failed after ${RETRY_CONFIG.maxRetries} retries`, {
        context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    const delay = Math.min(
      RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
      RETRY_CONFIG.maxDelay
    );

    logger.warn(`Operation failed, retrying in ${delay}ms`, {
      context,
      retryCount: retryCount + 1,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(operation, context, retryCount + 1);
  }
}

/**
 * Database health check function
 */
async function performHealthCheck(client: SupabaseClient): Promise<boolean> {
  try {
    const healthCheckOperation = async () => {
      // Test basic connectivity with a simple query
      const { error } = await client
        .from('users')
        .select('count')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is acceptable for health check
        throw new Error(`Database health check failed: ${error.message}`);
      }
      return true;
    };
    await retryWithBackoff(healthCheckOperation, 'database-health-check');
    logger.info('Database health check passed');
    return true;
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Connection monitoring utility
 */
class DatabaseMonitor {
  private client: SupabaseClient;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isHealthy = true;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  start(intervalMs = 60000): void {
    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await performHealthCheck(this.client);
      if (this.isHealthy !== isHealthy) {
        this.isHealthy = isHealthy;
        logger.info(`Database health status changed: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      }
    }, intervalMs);
    logger.info('Database monitoring started', { intervalMs });
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Database monitoring stopped');
    }
  }

  isConnectionHealthy(): boolean {
    return this.isHealthy;
  }
}

// Create singleton instance
let databaseInstance: DatabaseConfig | null = null;
let monitor: DatabaseMonitor | null = null;

/**
 * Initialize database connection
 */
export function initializeDatabase(): DatabaseConfig {
  if (databaseInstance) {
    return databaseInstance;
  }
  const client = createSupabaseClient();
  monitor = new DatabaseMonitor(client);
  // Start monitoring in production
  if (config.server.isProduction) {
    monitor.start();
  }
  databaseInstance = {
    client,
    healthCheck: () => performHealthCheck(client),
    disconnect: async () => {
      if (monitor) {
        monitor.stop();
        monitor = null;
      }
      logger.info('Database connection closed');
    },
  };
  return databaseInstance;
}

/**
 * Get database instance (must be initialized first)
 */
export function getDatabase(): DatabaseConfig {
  if (!databaseInstance) {
    // In test environment, create a mock database config
    if (config.server.env === 'test') {
      const mockClient = createSupabaseClient();
      databaseInstance = {
        client: mockClient,
        healthCheck: async () => true,
        disconnect: async () => {},
      };
      return databaseInstance;
    }
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return databaseInstance;
}

/**
 * Get Supabase client directly
 */
export function getSupabaseClient(): SupabaseClient {
  return getDatabase().client;
}

/**
 * Database connection utilities
 */
export const database = {
  initialize: initializeDatabase,
  getInstance: getDatabase,
  getClient: getSupabaseClient,
  // Utility functions for common operations
  async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    return retryWithBackoff(operation, context);
  },
  async isHealthy(): Promise<boolean> {
    try {
      return await getDatabase().healthCheck();
    } catch {
      return false;
    }
  },
  getMonitorStatus(): boolean {
    return monitor?.isConnectionHealthy() ?? false;
  },
};

export default database;