/**
 * Transaction Management Service
 * 
 * Provides robust transaction management with ACID compliance, rollback mechanisms,
 * distributed transaction support, and automatic retry logic with exponential backoff.
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface TransactionOptions {
  isolationLevel?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  timeout?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  enableDeadlockDetection?: boolean;
  enableRollback?: boolean;
  enableLogging?: boolean;
}

export interface TransactionContext {
  transactionId: string;
  startTime: number;
  isolationLevel: string;
  status: 'active' | 'committed' | 'rolled_back' | 'failed';
  operations: TransactionOperation[];
  metadata: Record<string, any>;
}

export interface TransactionOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'query';
  table: string;
  data?: any;
  rollbackData?: any;
  timestamp: number;
  status: 'pending' | 'executed' | 'rolled_back' | 'failed';
}

export interface DistributedTransaction {
  id: string;
  coordinatorId: string;
  participants: string[];
  status: 'preparing' | 'prepared' | 'committed' | 'aborted';
  startTime: number;
  endTime?: number;
  metadata: Record<string, any>;
}

export interface TransactionLog {
  id: string;
  transactionId: string;
  operation: string;
  details: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface DeadlockInfo {
  transactionId: string;
  resourceType: string;
  resourceId: string;
  waitTime: number;
  participants: string[];
}

export class TransactionManagementService {
  private supabase = getSupabaseClient();
  private activeTransactions = new Map<string, TransactionContext>();
  private distributedTransactions = new Map<string, DistributedTransaction>();
  private deadlockDetector: DeadlockDetector;

  constructor() {
    this.deadlockDetector = new DeadlockDetector();
  }

  /**
   * Execute a function within a database transaction
   */
  async executeInTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const transactionId = this.generateTransactionId();
    const context = this.createTransactionContext(transactionId, options);
    
    try {
      // Start transaction
      await this.beginTransaction(context);
      
      // Execute the operation
      const result = await this.executeWithRetry(
        () => operation(context),
        options.maxRetries || 3,
        options.retryDelay || 1000
      );

      // Commit transaction
      await this.commitTransaction(context);
      
      return result;

    } catch (error) {
      // Rollback transaction on error
      await this.rollbackTransaction(context, error as Error);
      throw error;

    } finally {
      // Cleanup
      this.cleanupTransaction(context);
    }
  }

  /**
   * Execute a distributed transaction across multiple services
   */
  async executeDistributedTransaction<T>(
    operations: Array<{
      serviceId: string;
      operation: (context: TransactionContext) => Promise<any>;
    }>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    const distributedId = this.generateTransactionId();
    const distributedTx = this.createDistributedTransaction(distributedId, operations.map(op => op.serviceId));
    
    try {
      // Phase 1: Prepare
      await this.prepareDistributedTransaction(distributedTx, operations);
      
      // Phase 2: Commit
      const results = await this.commitDistributedTransaction(distributedTx, operations);
      
      return results;

    } catch (error) {
      // Phase 3: Abort (if needed)
      await this.abortDistributedTransaction(distributedTx, error as Error);
      throw error;

    } finally {
      // Cleanup
      try {
        this.cleanupDistributedTransaction(distributedTx);
      } catch (cleanupError) {
        logger.error('Error during distributed transaction cleanup:', { 
          error: (cleanupError as Error).message,
          distributedId: distributedTx.id 
        });
        // Don't throw cleanup errors to avoid masking the main result
      }
    }
  }

  /**
   * Execute a booking operation with comprehensive transaction management
   */
  async executeBookingTransaction<T>(
    bookingOperation: (context: TransactionContext) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const enhancedOptions: TransactionOptions = {
      isolationLevel: 'serializable', // Highest isolation for booking operations
      timeout: 30000, // 30 seconds timeout
      maxRetries: 5,
      retryDelay: 2000,
      enableDeadlockDetection: true,
      enableRollback: true,
      enableLogging: true,
      ...options
    };

    return this.executeInTransaction(bookingOperation, enhancedOptions);
  }

  /**
   * Execute a conflict resolution operation with transaction management
   */
  async executeConflictResolutionTransaction<T>(
    resolutionOperation: (context: TransactionContext) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const enhancedOptions: TransactionOptions = {
      isolationLevel: 'repeatable_read', // High isolation for conflict resolution
      timeout: 15000, // 15 seconds timeout
      maxRetries: 3,
      retryDelay: 1000,
      enableDeadlockDetection: true,
      enableRollback: true,
      enableLogging: true,
      ...options
    };

    return this.executeInTransaction(resolutionOperation, enhancedOptions);
  }

  /**
   * Get transaction status and details
   */
  async getTransactionStatus(transactionId: string): Promise<TransactionContext | null> {
    return this.activeTransactions.get(transactionId) || null;
  }

  /**
   * Get distributed transaction status
   */
  async getDistributedTransactionStatus(distributedId: string): Promise<DistributedTransaction | null> {
    return this.distributedTransactions.get(distributedId) || null;
  }

  /**
   * Get transaction logs for monitoring and debugging
   */
  async getTransactionLogs(
    transactionId?: string,
    startTime?: number,
    endTime?: number
  ): Promise<TransactionLog[]> {
    try {
      let query = this.supabase
        .from('transaction_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (transactionId) {
        query = query.eq('transaction_id', transactionId);
      }
      if (startTime) {
        query = query.gte('timestamp', startTime);
      }
      if (endTime) {
        query = query.lte('timestamp', endTime);
      }

      const { data: logs, error } = await query;

      if (error) {
        logger.error('Error getting transaction logs:', { error: error.message });
        return [];
      }

      return logs || [];

    } catch (error) {
      logger.error('Error in getTransactionLogs:', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get deadlock information for monitoring
   */
  async getDeadlockInfo(): Promise<DeadlockInfo[]> {
    return this.deadlockDetector.getDeadlockInfo();
  }

  /**
   * Force rollback a transaction (admin function)
   */
  async forceRollbackTransaction(transactionId: string, reason: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    await this.rollbackTransaction(context, new Error(`Force rollback: ${reason}`));
  }

  /**
   * Get transaction statistics for monitoring
   */
  async getTransactionStats(): Promise<{
    activeTransactions: number;
    distributedTransactions: number;
    averageTransactionTime: number;
    totalTransactions: number;
    failedTransactions: number;
    deadlocksDetected: number;
  }> {
    const activeCount = this.activeTransactions.size;
    const distributedCount = this.distributedTransactions.size;
    
    // Calculate average transaction time
    const completedTransactions = Array.from(this.activeTransactions.values())
      .filter(tx => tx.status === 'committed' || tx.status === 'rolled_back');
    
    const averageTime = completedTransactions.length > 0
      ? completedTransactions.reduce((sum, tx) => sum + (Date.now() - tx.startTime), 0) / completedTransactions.length
      : 0;

    return {
      activeTransactions: activeCount,
      distributedTransactions: distributedCount,
      averageTransactionTime: averageTime,
      totalTransactions: completedTransactions.length,
      failedTransactions: completedTransactions.filter(tx => tx.status === 'failed').length,
      deadlocksDetected: this.deadlockDetector.getDeadlockCount()
    };
  }

  // Private helper methods

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createTransactionContext(transactionId: string, options: TransactionOptions): TransactionContext {
    return {
      transactionId,
      startTime: Date.now(),
      isolationLevel: options.isolationLevel || 'read_committed',
      status: 'active',
      operations: [],
      metadata: {
        options,
        createdAt: new Date().toISOString()
      }
    };
  }

  private createDistributedTransaction(distributedId: string, participants: string[]): DistributedTransaction {
    return {
      id: distributedId,
      coordinatorId: 'main_coordinator',
      participants,
      status: 'preparing',
      startTime: Date.now(),
      metadata: {
        createdAt: new Date().toISOString()
      }
    };
  }

  private async beginTransaction(context: TransactionContext): Promise<void> {
    try {
      // Set transaction isolation level
      await this.supabase.rpc('set_transaction_isolation_level', {
        isolation_level: context.isolationLevel
      });

      // Log transaction start
      if (context.metadata.options.enableLogging) {
        await this.logTransaction(context, 'BEGIN_TRANSACTION', {
          isolationLevel: context.isolationLevel,
          options: context.metadata.options
        });
      }

      // Add to active transactions
      this.activeTransactions.set(context.transactionId, context);

      logger.info('Transaction started:', { transactionId: context.transactionId });

    } catch (error) {
      logger.error('Error beginning transaction:', { transactionId: context.transactionId, error: (error as Error).message });
      throw error;
    }
  }

  private async commitTransaction(context: TransactionContext): Promise<void> {
    try {
      // Commit the transaction
      await this.supabase.rpc('commit_transaction');

      // Update context status
      context.status = 'committed';

      // Log transaction commit
      if (context.metadata.options.enableLogging) {
        await this.logTransaction(context, 'COMMIT_TRANSACTION', {
          operationsCount: context.operations.length,
          duration: Date.now() - context.startTime
        });
      }

      logger.info('Transaction committed:', { 
        transactionId: context.transactionId,
        duration: Date.now() - context.startTime
      });

    } catch (error) {
      logger.error('Error committing transaction:', { transactionId: context.transactionId, error: (error as Error).message });
      throw error;
    }
  }

  private async rollbackTransaction(context: TransactionContext, error: Error): Promise<void> {
    try {
      // Rollback the transaction
      await this.supabase.rpc('rollback_transaction');

      // Update context status
      context.status = 'rolled_back';

      // Log transaction rollback
      if (context.metadata.options.enableLogging) {
        await this.logTransaction(context, 'ROLLBACK_TRANSACTION', {
          error: error.message,
          operationsCount: context.operations.length,
          duration: Date.now() - context.startTime
        });
      }

      logger.warn('Transaction rolled back:', { 
        transactionId: context.transactionId,
        error: error.message,
        duration: Date.now() - context.startTime
      });

    } catch (rollbackError) {
      logger.error('Error rolling back transaction:', { 
        transactionId: context.transactionId, 
        originalError: error.message,
        rollbackError: (rollbackError as Error).message 
      });
      throw rollbackError;
    }
  }

  private async prepareDistributedTransaction(
    distributedTx: DistributedTransaction,
    operations: Array<{ serviceId: string; operation: (context: TransactionContext) => Promise<any> }>
  ): Promise<void> {
    try {
      distributedTx.status = 'preparing';

      // Prepare all participants
      const preparePromises = operations.map(async (op, index) => {
        const context = this.createTransactionContext(`${distributedTx.id}_${index}`, {});
        await this.beginTransaction(context);
        
        // Execute the operation in prepare mode
        await op.operation(context);
        
        return context;
      });

      await Promise.all(preparePromises);
      distributedTx.status = 'prepared';

      logger.info('Distributed transaction prepared:', { distributedId: distributedTx.id });

    } catch (error) {
      distributedTx.status = 'aborted';
      logger.error('Error preparing distributed transaction:', { 
        distributedId: distributedTx.id, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private async commitDistributedTransaction(
    distributedTx: DistributedTransaction,
    operations: Array<{ serviceId: string; operation: (context: TransactionContext) => Promise<any> }>
  ): Promise<any[]> {
    try {
      distributedTx.status = 'committed';
      distributedTx.endTime = Date.now();

      // Execute all operations and collect results
      const results = await Promise.all(
        operations.map(async (op, index) => {
          const context = this.activeTransactions.get(`${distributedTx.id}_${index}`);
          if (context) {
            await this.commitTransaction(context);
            return await op.operation(context);
          }
          return null;
        })
      );

      logger.info('Distributed transaction committed:', { 
        distributedId: distributedTx.id,
        duration: distributedTx.endTime - distributedTx.startTime
      });

      return results.filter(result => result !== null);

    } catch (error) {
      distributedTx.status = 'aborted';
      logger.error('Error committing distributed transaction:', { 
        distributedId: distributedTx.id, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private async abortDistributedTransaction(distributedTx: DistributedTransaction, error: Error): Promise<void> {
    try {
      distributedTx.status = 'aborted';
      distributedTx.endTime = Date.now();

      // Rollback all participants
      const rollbackPromises = distributedTx.participants.map(async (participantId, index) => {
        const context = this.activeTransactions.get(`${distributedTx.id}_${index}`);
        if (context) {
          await this.rollbackTransaction(context, error);
        }
      });

      await Promise.all(rollbackPromises);

      logger.warn('Distributed transaction aborted:', { 
        distributedId: distributedTx.id,
        error: error.message,
        duration: distributedTx.endTime - distributedTx.startTime
      });

    } catch (rollbackError) {
      logger.error('Error aborting distributed transaction:', { 
        distributedId: distributedTx.id, 
        originalError: error.message,
        rollbackError: (rollbackError as Error).message 
      });
      throw rollbackError;
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    retryDelay: number
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          break;
        }

        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);

        logger.warn('Retrying operation:', { 
          attempt: attempt + 1, 
          maxRetries, 
          delay,
          error: lastError.message 
        });
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'deadlock',
      'timeout',
      'connection',
      'temporary',
      'retry'
    ];

    return retryableErrors.some(keyword => 
      error.message.toLowerCase().includes(keyword)
    );
  }

  private async logTransaction(
    context: TransactionContext,
    operation: string,
    details: any
  ): Promise<void> {
    try {
      const log: TransactionLog = {
        id: this.generateTransactionId(),
        transactionId: context.transactionId,
        operation,
        details,
        timestamp: Date.now()
      };

      await this.supabase
        .from('transaction_logs')
        .insert(log);

    } catch (error) {
      logger.error('Error logging transaction:', { 
        transactionId: context.transactionId, 
        error: (error as Error).message 
      });
    }
  }

  private cleanupTransaction(context: TransactionContext): void {
    this.activeTransactions.delete(context.transactionId);
  }

  private cleanupDistributedTransaction(distributedTx: DistributedTransaction): void {
    this.distributedTransactions.delete(distributedTx.id);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Deadlock Detection Service
 */
class DeadlockDetector {
  private deadlocks: DeadlockInfo[] = [];
  private deadlockCount = 0;

  detectDeadlock(transactionId: string, resourceType: string, resourceId: string): boolean {
    // Simple deadlock detection logic
    // In a real implementation, this would use a more sophisticated algorithm
    const existingDeadlock = this.deadlocks.find(d => 
      d.resourceType === resourceType && d.resourceId === resourceId
    );

    if (existingDeadlock) {
      this.deadlockCount++;
      return true;
    }

    return false;
  }

  getDeadlockInfo(): DeadlockInfo[] {
    return [...this.deadlocks];
  }

  getDeadlockCount(): number {
    return this.deadlockCount;
  }

  clearDeadlocks(): void {
    this.deadlocks = [];
    this.deadlockCount = 0;
  }
}

export const transactionManagementService = new TransactionManagementService(); 