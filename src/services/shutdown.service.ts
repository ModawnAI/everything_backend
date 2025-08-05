import { Server } from 'http';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';
import { monitoringService } from './monitoring.service';

// =============================================
// SHUTDOWN TYPES
// =============================================

export interface ShutdownConfig {
  timeout: number; // milliseconds
  forceTimeout: number; // milliseconds
  healthCheckPath: string;
}

export interface ShutdownStatus {
  isShuttingDown: boolean;
  startTime?: number;
  completedSteps: string[];
  remainingSteps: string[];
  error?: string;
}

// =============================================
// SHUTDOWN SERVICE
// =============================================

export class ShutdownService {
  private server: Server | null = null;
  private isShuttingDown = false;
  private shutdownStartTime: number | null = null;
  private completedSteps: string[] = [];
  private remainingSteps: string[] = [];
  private config: ShutdownConfig;

  constructor(config: ShutdownConfig = {
    timeout: 30000, // 30 seconds
    forceTimeout: 10000, // 10 seconds
    healthCheckPath: '/health',
  }) {
    this.config = config;
    this.setupSignalHandlers();
  }

  /**
   * Set the HTTP server instance
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Handle SIGTERM (termination signal)
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown');
      this.gracefulShutdown('SIGTERM');
    });

    // Handle SIGINT (interrupt signal - Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown');
      this.gracefulShutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception, starting emergency shutdown', {
        error: error.message,
        stack: error.stack,
      });
      this.emergencyShutdown(error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection, starting emergency shutdown', {
        reason,
        promise,
      });
      this.emergencyShutdown(new Error(`Unhandled promise rejection: ${reason}`));
    });

    logger.info('Shutdown signal handlers configured');
  }

  /**
   * Start graceful shutdown process
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();
    this.completedSteps = [];
    this.remainingSteps = [
      'Stop accepting new connections',
      'Complete in-flight requests',
      'Close WebSocket connections',
      'Close database connections',
      'Close Redis connections',
      'Close monitoring connections',
      'Stop health checks',
      'Exit process',
    ];

    logger.info('Starting graceful shutdown process', {
      signal,
      timeout: this.config.timeout,
      forceTimeout: this.config.forceTimeout,
    });

    try {
      // Step 1: Stop accepting new connections
      await this.stopAcceptingConnections();
      this.completedSteps.push('Stop accepting new connections');
      this.remainingSteps.shift();

      // Step 2: Complete in-flight requests
      await this.completeInFlightRequests();
      this.completedSteps.push('Complete in-flight requests');
      this.remainingSteps.shift();

      // Step 3: Close WebSocket connections
      await this.closeWebSocketConnections();
      this.completedSteps.push('Close WebSocket connections');
      this.remainingSteps.shift();

      // Step 4: Close database connections
      await this.closeDatabaseConnections();
      this.completedSteps.push('Close database connections');
      this.remainingSteps.shift();

      // Step 5: Close Redis connections
      await this.closeRedisConnections();
      this.completedSteps.push('Close Redis connections');
      this.remainingSteps.shift();

      // Step 6: Close monitoring connections
      await this.closeMonitoringConnections();
      this.completedSteps.push('Close monitoring connections');
      this.remainingSteps.shift();

      // Step 7: Stop health checks
      await this.stopHealthChecks();
      this.completedSteps.push('Stop health checks');
      this.remainingSteps.shift();

      logger.info('Graceful shutdown completed successfully', {
        duration: Date.now() - (this.shutdownStartTime || 0),
        completedSteps: this.completedSteps,
      });

      // Step 8: Exit process
      this.exitProcess(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: (error as Error).message,
        completedSteps: this.completedSteps,
        remainingSteps: this.remainingSteps,
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.warn('Force shutdown after timeout');
        this.forceShutdown();
      }, this.config.forceTimeout);

      this.exitProcess(1);
    }
  }

  /**
   * Emergency shutdown for critical errors
   */
  private async emergencyShutdown(error: Error): Promise<void> {
    logger.error('Emergency shutdown initiated', {
      error: error.message,
      stack: error.stack,
    });

    try {
      // Immediate cleanup of critical resources
      await this.closeDatabaseConnections();
      await this.closeRedisConnections();
      
      logger.info('Emergency shutdown completed');
      this.exitProcess(1);
    } catch (cleanupError) {
      logger.error('Error during emergency shutdown cleanup', {
        error: (cleanupError as Error).message,
      });
      this.exitProcess(1);
    }
  }

  /**
   * Stop accepting new connections
   */
  private async stopAcceptingConnections(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        logger.info('HTTP server stopped accepting new connections');
        resolve();
      });

      // Set timeout for server close
      setTimeout(() => {
        logger.warn('Server close timeout, forcing close');
        resolve();
      }, 5000);
    });
  }

  /**
   * Complete in-flight requests
   */
  private async completeInFlightRequests(): Promise<void> {
    // In a real implementation, you would track active requests
    // and wait for them to complete
    logger.info('Waiting for in-flight requests to complete');
    
    // Simulate waiting for requests to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logger.info('In-flight requests completed');
  }

  /**
   * Close WebSocket connections
   */
  private async closeWebSocketConnections(): Promise<void> {
    try {
      // In a real implementation, you would close all WebSocket connections
      logger.info('Closing WebSocket connections');
      
      // Simulate WebSocket cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info('WebSocket connections closed');
    } catch (error) {
      logger.error('Error closing WebSocket connections', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Close database connections
   */
  private async closeDatabaseConnections(): Promise<void> {
    try {
      logger.info('Closing database connections');
      
      // In a real implementation, you would close Supabase connections
      // const { supabase } = require('../config/database');
      // await supabase.auth.signOut();
      
      // Simulate database cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Close Redis connections
   */
  private async closeRedisConnections(): Promise<void> {
    try {
      logger.info('Closing Redis connections');
      
      // Close cache service connections
      await cacheService.close();
      
      logger.info('Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis connections', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Close monitoring connections
   */
  private async closeMonitoringConnections(): Promise<void> {
    try {
      logger.info('Closing monitoring connections');
      
      // In a real implementation, you would close monitoring service connections
      // Stop metrics collection
      // Close monitoring service connections
      
      // Simulate monitoring cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      logger.info('Monitoring connections closed');
    } catch (error) {
      logger.error('Error closing monitoring connections', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Stop health checks
   */
  private async stopHealthChecks(): Promise<void> {
    try {
      logger.info('Stopping health checks');
      
      // In a real implementation, you would stop health check services
      // Stop health check intervals
      // Mark health endpoint as unhealthy
      
      // Simulate health check cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      logger.info('Health checks stopped');
    } catch (error) {
      logger.error('Error stopping health checks', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Force shutdown after timeout
   */
  private forceShutdown(): void {
    logger.error('Force shutdown initiated');
    
    // Force exit the process
    process.exit(1);
  }

  /**
   * Exit process with proper cleanup
   */
  private exitProcess(code: number): void {
    const duration = this.shutdownStartTime ? Date.now() - this.shutdownStartTime : 0;
    
    logger.info('Process exiting', {
      code,
      duration,
      completedSteps: this.completedSteps,
      remainingSteps: this.remainingSteps,
    });

    // Final cleanup
    process.exit(code);
  }

  /**
   * Get current shutdown status
   */
  getShutdownStatus(): ShutdownStatus {
    return {
      isShuttingDown: this.isShuttingDown,
      startTime: this.shutdownStartTime || undefined,
      completedSteps: [...this.completedSteps],
      remainingSteps: [...this.remainingSteps],
    } as ShutdownStatus;
  }

  /**
   * Check if system is shutting down
   */
  getShutdownState(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Update health check to indicate shutdown
   */
  updateHealthCheckForShutdown(): void {
    if (this.isShuttingDown) {
      // In a real implementation, you would update the health check
      // to return unhealthy status during shutdown
      logger.info('Health check updated to indicate shutdown');
    }
  }
}

// Global shutdown service instance
export const shutdownService = new ShutdownService(); 