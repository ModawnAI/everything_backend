/**
 * Reservation System Test Configuration
 * 
 * Centralized configuration for reservation system testing including:
 * - Test data constants
 * - Performance thresholds
 * - Load test parameters
 * - Environment-specific settings
 */

export interface ReservationTestConfig {
  // Test data configuration
  testData: {
    userCount: number;
    shopCount: number;
    serviceCount: number;
    reservationCount: number;
    concurrentUsers: number;
  };

  // Performance thresholds
  performance: {
    maxResponseTime: number; // milliseconds
    minSuccessRate: number; // percentage
    maxErrorRate: number; // percentage
    maxConcurrentRequests: number;
    maxMemoryUsage: number; // MB
  };

  // Load testing configuration
  loadTesting: {
    baseLoad: number;
    peakLoad: number;
    duration: number; // seconds
    rampUpTime: number; // seconds
    rampDownTime: number; // seconds
  };

  // Integration testing configuration
  integration: {
    timeout: number; // milliseconds
    retryAttempts: number;
    retryDelay: number; // milliseconds
    cleanupAfterTest: boolean;
  };

  // Database testing configuration
  database: {
    useTransactions: boolean;
    rollbackAfterTest: boolean;
    seedTestData: boolean;
    cleanupTestData: boolean;
  };

  // Monitoring and alerting
  monitoring: {
    enableMetrics: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    alertThresholds: {
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
    };
  };
}

export const DEFAULT_RESERVATION_TEST_CONFIG: ReservationTestConfig = {
  testData: {
    userCount: 100,
    shopCount: 20,
    serviceCount: 50,
    reservationCount: 200,
    concurrentUsers: 10,
  },

  performance: {
    maxResponseTime: 2000, // 2 seconds
    minSuccessRate: 95, // 95%
    maxErrorRate: 5, // 5%
    maxConcurrentRequests: 100,
    maxMemoryUsage: 512, // 512 MB
  },

  loadTesting: {
    baseLoad: 10,
    peakLoad: 50,
    duration: 300, // 5 minutes
    rampUpTime: 60, // 1 minute
    rampDownTime: 60, // 1 minute
  },

  integration: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    cleanupAfterTest: true,
  },

  database: {
    useTransactions: true,
    rollbackAfterTest: true,
    seedTestData: true,
    cleanupTestData: true,
  },

  monitoring: {
    enableMetrics: true,
    logLevel: 'info',
    alertThresholds: {
      responseTime: 1000, // 1 second
      errorRate: 1, // 1%
      memoryUsage: 256, // 256 MB
    },
  },
};

export const PERFORMANCE_TEST_CONFIG: ReservationTestConfig = {
  ...DEFAULT_RESERVATION_TEST_CONFIG,
  testData: {
    ...DEFAULT_RESERVATION_TEST_CONFIG.testData,
    userCount: 1000,
    shopCount: 100,
    serviceCount: 500,
    reservationCount: 2000,
    concurrentUsers: 50,
  },
  performance: {
    ...DEFAULT_RESERVATION_TEST_CONFIG.performance,
    maxResponseTime: 5000, // 5 seconds for performance tests
    maxConcurrentRequests: 500,
  },
  loadTesting: {
    ...DEFAULT_RESERVATION_TEST_CONFIG.loadTesting,
    baseLoad: 50,
    peakLoad: 200,
    duration: 600, // 10 minutes
  },
};

export const LOAD_TEST_CONFIG: ReservationTestConfig = {
  ...DEFAULT_RESERVATION_TEST_CONFIG,
  testData: {
    ...DEFAULT_RESERVATION_TEST_CONFIG.testData,
    userCount: 5000,
    shopCount: 500,
    serviceCount: 2000,
    reservationCount: 10000,
    concurrentUsers: 200,
  },
  performance: {
    ...DEFAULT_RESERVATION_TEST_CONFIG.performance,
    maxResponseTime: 10000, // 10 seconds for load tests
    maxConcurrentRequests: 1000,
    maxMemoryUsage: 1024, // 1 GB
  },
  loadTesting: {
    ...DEFAULT_RESERVATION_TEST_CONFIG.loadTesting,
    baseLoad: 100,
    peakLoad: 500,
    duration: 1800, // 30 minutes
  },
};

export const INTEGRATION_TEST_CONFIG: ReservationTestConfig = {
  ...DEFAULT_RESERVATION_TEST_CONFIG,
  integration: {
    ...DEFAULT_RESERVATION_TEST_CONFIG.integration,
    timeout: 60000, // 60 seconds for integration tests
    retryAttempts: 5,
    retryDelay: 2000, // 2 seconds
  },
  database: {
    ...DEFAULT_RESERVATION_TEST_CONFIG.database,
    useTransactions: true,
    rollbackAfterTest: false, // Keep data for integration tests
    seedTestData: true,
    cleanupTestData: false, // Manual cleanup for integration tests
  },
};

// Environment-specific configurations
export const getTestConfig = (environment: string = 'test'): ReservationTestConfig => {
  switch (environment) {
    case 'performance':
      return PERFORMANCE_TEST_CONFIG;
    case 'load':
      return LOAD_TEST_CONFIG;
    case 'integration':
      return INTEGRATION_TEST_CONFIG;
    case 'ci':
      return {
        ...DEFAULT_RESERVATION_TEST_CONFIG,
        testData: {
          ...DEFAULT_RESERVATION_TEST_CONFIG.testData,
          userCount: 50,
          shopCount: 10,
          serviceCount: 25,
          reservationCount: 100,
          concurrentUsers: 5,
        },
        performance: {
          ...DEFAULT_RESERVATION_TEST_CONFIG.performance,
          maxResponseTime: 5000,
        },
        loadTesting: {
          ...DEFAULT_RESERVATION_TEST_CONFIG.loadTesting,
          baseLoad: 5,
          peakLoad: 20,
          duration: 120, // 2 minutes for CI
        },
      };
    default:
      return DEFAULT_RESERVATION_TEST_CONFIG;
  }
};

// Test data constants
export const TEST_CONSTANTS = {
  // Reservation statuses
  RESERVATION_STATUSES: [
    'requested',
    'confirmed',
    'cancelled_by_user',
    'cancelled_by_shop',
    'no_show',
    'completed',
  ] as const,

  // User statuses
  USER_STATUSES: ['active', 'inactive', 'suspended'] as const,

  // Shop statuses
  SHOP_STATUSES: ['active', 'inactive', 'suspended'] as const,

  // Service categories
  SERVICE_CATEGORIES: [
    'haircut',
    'coloring',
    'perm',
    'treatment',
    'manicure',
    'pedicure',
    'nail_art',
    'facial',
    'skincare',
    'massage',
    'eyebrow',
    'eyelash',
    'makeup',
  ] as const,

  // Time slots
  TIME_SLOTS: [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  ] as const,

  // Business hours
  BUSINESS_HOURS: {
    OPEN: '09:00',
    CLOSE: '21:00',
    LUNCH_START: '12:00',
    LUNCH_END: '13:00',
  },

  // Test timeouts
  TIMEOUTS: {
    SHORT: 5000, // 5 seconds
    MEDIUM: 15000, // 15 seconds
    LONG: 30000, // 30 seconds
    VERY_LONG: 60000, // 60 seconds
  },

  // Retry configurations
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000, // 1 second
    BACKOFF_FACTOR: 2,
  },

  // Database constraints
  DATABASE: {
    MAX_RESERVATIONS_PER_USER_PER_DAY: 5,
    MAX_RESERVATIONS_PER_SHOP_PER_DAY: 100,
    MIN_RESERVATION_ADVANCE_HOURS: 2,
    MAX_RESERVATION_ADVANCE_DAYS: 30,
  },
};

// Test environment utilities
export class TestEnvironmentUtils {
  /**
   * Check if running in CI environment
   */
  static isCI(): boolean {
    return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  }

  /**
   * Check if running in development environment
   */
  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Check if running in test environment
   */
  static isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  /**
   * Get environment-specific test timeout
   */
  static getTestTimeout(): number {
    if (this.isCI()) {
      return TEST_CONSTANTS.TIMEOUTS.VERY_LONG;
    }
    if (this.isTest()) {
      return TEST_CONSTANTS.TIMEOUTS.LONG;
    }
    return TEST_CONSTANTS.TIMEOUTS.MEDIUM;
  }

  /**
   * Get environment-specific concurrent user limit
   */
  static getConcurrentUserLimit(): number {
    if (this.isCI()) {
      return 5;
    }
    if (this.isTest()) {
      return 20;
    }
    return 50;
  }

  /**
   * Check if database transactions should be used
   */
  static shouldUseTransactions(): boolean {
    return !this.isCI(); // Don't use transactions in CI for faster tests
  }

  /**
   * Check if test data should be cleaned up
   */
  static shouldCleanupTestData(): boolean {
    return this.isTest() || this.isCI();
  }
}

export default ReservationTestConfig;
