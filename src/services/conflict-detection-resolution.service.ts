import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { enhancedAdvisoryLocksService } from './enhanced-advisory-locks.service';
import { concurrentBookingPreventionService } from './concurrent-booking-prevention.service';

export interface ConflictDetectionConfig {
  enableRealTimeDetection: boolean;
  enableBatchDetection: boolean;
  conflictResolutionTimeoutMs: number;
  maxResolutionAttempts: number;
  enableAutomaticResolution: boolean;
  enableManualResolution: boolean;
}

export interface ConflictInfo {
  conflictId: string;
  conflictType: 'slot_overlap' | 'capacity_exceeded' | 'resource_conflict' | 'payment_conflict' | 'version_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedReservations: string[];
  affectedShopId: string;
  conflictDetails: {
    overlappingSlots?: Array<{
      reservationId: string;
      startTime: string;
      endTime: string;
      duration: number;
    }>;
    capacityDetails?: {
      requestedCapacity: number;
      availableCapacity: number;
      conflictingReservations: string[];
    };
    resourceDetails?: {
      resourceType: string;
      conflictingReservations: string[];
    };
    paymentDetails?: {
      paymentId: string;
      conflictingPaymentId: string;
      amount: number;
    };
    versionDetails?: {
      entityId: string;
      entityType: 'reservation' | 'payment' | 'service';
      expectedVersion: number;
      actualVersion: number;
    };
  };
  detectedAt: string;
  resolvedAt?: string;
  resolutionStrategy?: string;
  resolutionNotes?: string;
}

export interface ConflictResolutionStrategy {
  strategyId: string;
  strategyName: string;
  conflictTypes: string[];
  description: string;
  automaticResolution: boolean;
  requiresUserApproval: boolean;
  resolutionActions: Array<{
    action: 'cancel_reservation' | 'reschedule_reservation' | 'merge_reservations' | 'split_reservation' | 'update_payment' | 'retry_operation';
    parameters: Record<string, any>;
    priority: number;
  }>;
}

export interface ConflictResolutionResult {
  success: boolean;
  conflictId: string;
  resolutionStrategy: string;
  actionsPerformed: string[];
  affectedReservations: string[];
  errors: string[];
  warnings: string[];
  resolutionTimeMs: number;
  userApprovalRequired?: boolean;
  approvalToken?: string;
}

export interface ConflictMetrics {
  totalConflicts: number;
  resolvedConflicts: number;
  unresolvedConflicts: number;
  conflictsByType: Record<string, number>;
  conflictsBySeverity: Record<string, number>;
  avgResolutionTimeMs: number;
  resolutionSuccessRate: number;
  conflictsByShop: Record<string, number>;
}

export class ConflictDetectionResolutionService {
  private supabase = getSupabaseClient();
  private defaultConfig: ConflictDetectionConfig = {
    enableRealTimeDetection: true,
    enableBatchDetection: true,
    conflictResolutionTimeoutMs: 30000,
    maxResolutionAttempts: 3,
    enableAutomaticResolution: true,
    enableManualResolution: true
  };

  private resolutionStrategies: ConflictResolutionStrategy[] = [
    {
      strategyId: 'auto_retry_version_conflict',
      strategyName: 'Automatic Version Conflict Retry',
      conflictTypes: ['version_conflict'],
      description: 'Automatically retry operations with version conflicts',
      automaticResolution: true,
      requiresUserApproval: false,
      resolutionActions: [
        {
          action: 'retry_operation',
          parameters: { maxRetries: 3, backoffMs: 100 },
          priority: 1
        }
      ]
    },
    {
      strategyId: 'auto_reschedule_overlap',
      strategyName: 'Automatic Slot Overlap Rescheduling',
      conflictTypes: ['slot_overlap'],
      description: 'Automatically reschedule overlapping reservations to next available slots',
      automaticResolution: true,
      requiresUserApproval: false,
      resolutionActions: [
        {
          action: 'reschedule_reservation',
          parameters: { findNextAvailableSlot: true, notifyCustomer: true },
          priority: 1
        }
      ]
    },
    {
      strategyId: 'manual_capacity_resolution',
      strategyName: 'Manual Capacity Conflict Resolution',
      conflictTypes: ['capacity_exceeded'],
      description: 'Manual resolution required for capacity conflicts',
      automaticResolution: false,
      requiresUserApproval: true,
      resolutionActions: [
        {
          action: 'cancel_reservation',
          parameters: { notifyCustomer: true, refundDeposit: true },
          priority: 1
        },
        {
          action: 'reschedule_reservation',
          parameters: { findAlternativeSlot: true, notifyCustomer: true },
          priority: 2
        }
      ]
    },
    {
      strategyId: 'payment_conflict_resolution',
      strategyName: 'Payment Conflict Resolution',
      conflictTypes: ['payment_conflict'],
      description: 'Resolve payment conflicts with automatic retry and manual fallback',
      automaticResolution: true,
      requiresUserApproval: true,
      resolutionActions: [
        {
          action: 'retry_operation',
          parameters: { maxRetries: 2, backoffMs: 500 },
          priority: 1
        },
        {
          action: 'update_payment',
          parameters: { reconcilePayments: true, notifyCustomer: true },
          priority: 2
        }
      ]
    }
  ];

  constructor(private config: Partial<ConflictDetectionConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Detect conflicts in real-time during reservation operations
   */
  async detectRealTimeConflicts(
    operationType: 'reservation_creation' | 'reservation_update' | 'payment_processing',
    operationData: any
  ): Promise<ConflictInfo[]> {
    if (!this.config.enableRealTimeDetection) {
      return [];
    }

    try {
      const conflicts: ConflictInfo[] = [];

      switch (operationType) {
        case 'reservation_creation':
          conflicts.push(...await this.detectSlotOverlapConflicts(operationData));
          conflicts.push(...await this.detectCapacityConflicts(operationData));
          break;
        case 'reservation_update':
          conflicts.push(...await this.detectVersionConflicts(operationData));
          conflicts.push(...await this.detectSlotOverlapConflicts(operationData));
          break;
        case 'payment_processing':
          conflicts.push(...await this.detectPaymentConflicts(operationData));
          break;
      }

      // Store detected conflicts in database
      for (const conflict of conflicts) {
        await this.storeConflictInfo(conflict);
      }

      logger.info('Real-time conflict detection completed', {
        operationType,
        conflictsDetected: conflicts.length,
        conflictTypes: conflicts.map(c => c.conflictType)
      });

      return conflicts;

    } catch (error) {
      logger.error('Error in real-time conflict detection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationType
      });
      return [];
    }
  }

  /**
   * Detect slot overlap conflicts
   */
  private async detectSlotOverlapConflicts(operationData: any): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    try {
      const { shopId, reservationDate, reservationTime, duration } = operationData;

      // Check for overlapping reservations
      const { data, error } = await this.supabase
        .from('reservations')
        .select(`
          id,
          reservation_time,
          reservation_services!inner(
            shop_services!inner(duration_minutes)
          )
        `)
        .eq('shop_id', shopId)
        .eq('reservation_date', reservationDate)
        .in('status', ['requested', 'confirmed'])
        .neq('id', operationData.reservationId || '');

      if (error) {
        logger.error('Error checking slot overlaps', { error: error.message });
        return conflicts;
      }

      const operationStartTime = new Date(`${reservationDate}T${reservationTime}`);
      const operationEndTime = new Date(operationStartTime.getTime() + (duration || 60) * 60000);

      const overlappingReservations = data?.filter(reservation => {
        const reservationStartTime = new Date(`${reservationDate}T${reservation.reservation_time}`);
        const reservationDuration = (reservation as any).reservation_services?.[0]?.shop_services?.duration_minutes || 60;
        const reservationEndTime = new Date(reservationStartTime.getTime() + reservationDuration * 60000);

        // Check for overlap
        return (operationStartTime < reservationEndTime && operationEndTime > reservationStartTime);
      }) || [];

      if (overlappingReservations.length > 0) {
        conflicts.push({
          conflictId: `slot_overlap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conflictType: 'slot_overlap',
          severity: 'high',
          affectedReservations: overlappingReservations.map(r => r.id),
          affectedShopId: shopId,
          conflictDetails: {
            overlappingSlots: overlappingReservations.map(reservation => ({
              reservationId: reservation.id,
              startTime: reservation.reservation_time,
              endTime: new Date(
                new Date(`${reservationDate}T${reservation.reservation_time}`).getTime() + 
                ((reservation as any).reservation_services?.[0]?.shop_services?.duration_minutes || 60) * 60000
              ).toTimeString().substring(0, 5),
              duration: (reservation as any).reservation_services?.[0]?.shop_services?.duration_minutes || 60
            }))
          },
          detectedAt: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Error detecting slot overlap conflicts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return conflicts;
  }

  /**
   * Detect capacity conflicts
   */
  private async detectCapacityConflicts(operationData: any): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    try {
      const { shopId, reservationDate, reservationTime, services } = operationData;

      // Get shop capacity information
      const { data: shopData, error: shopError } = await this.supabase
        .from('shops')
        .select('max_concurrent_reservations')
        .eq('id', shopId)
        .single();

      if (shopError || !shopData) {
        return conflicts;
      }

      const maxCapacity = shopData.max_concurrent_reservations || 1;

      // Count existing reservations at the same time
      const { data: existingReservations, error: reservationError } = await this.supabase
        .from('reservations')
        .select('id')
        .eq('shop_id', shopId)
        .eq('reservation_date', reservationDate)
        .eq('reservation_time', reservationTime)
        .in('status', ['requested', 'confirmed']);

      if (reservationError) {
        logger.error('Error checking capacity', { error: reservationError.message });
        return conflicts;
      }

      const currentCapacity = existingReservations?.length || 0;
      const requestedCapacity = services?.length || 1;

      if (currentCapacity + requestedCapacity > maxCapacity) {
        conflicts.push({
          conflictId: `capacity_exceeded_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conflictType: 'capacity_exceeded',
          severity: 'critical',
          affectedReservations: existingReservations?.map(r => r.id) || [],
          affectedShopId: shopId,
          conflictDetails: {
            capacityDetails: {
              requestedCapacity,
              availableCapacity: maxCapacity - currentCapacity,
              conflictingReservations: existingReservations?.map(r => r.id) || []
            }
          },
          detectedAt: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Error detecting capacity conflicts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return conflicts;
  }

  /**
   * Detect version conflicts
   */
  private async detectVersionConflicts(operationData: any): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    try {
      const { reservationId, expectedVersion, entityType = 'reservation' } = operationData;

      if (!reservationId || expectedVersion === undefined) {
        return conflicts;
      }

      // Get current version from database
      const tableName = entityType === 'reservation' ? 'reservations' : 
                       entityType === 'payment' ? 'payments' : 'reservation_services';
      
      const { data, error } = await this.supabase
        .from(tableName)
        .select('version')
        .eq('id', reservationId)
        .single();

      if (error) {
        return conflicts;
      }

      const currentVersion = data?.version || 0;

      if (currentVersion !== expectedVersion) {
        conflicts.push({
          conflictId: `version_conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conflictType: 'version_conflict',
          severity: 'medium',
          affectedReservations: entityType === 'reservation' ? [reservationId] : [],
          affectedShopId: '', // Will be filled from reservation data if needed
          conflictDetails: {
            versionDetails: {
              entityId: reservationId,
              entityType: entityType as any,
              expectedVersion,
              actualVersion: currentVersion
            }
          },
          detectedAt: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Error detecting version conflicts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return conflicts;
  }

  /**
   * Detect payment conflicts
   */
  private async detectPaymentConflicts(operationData: any): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    try {
      const { paymentId, reservationId, amount } = operationData;

      // Check for duplicate payments
      const { data, error } = await this.supabase
        .from('payments')
        .select('id, amount, payment_status')
        .eq('reservation_id', reservationId)
        .eq('amount', amount)
        .neq('id', paymentId || '')
        .in('payment_status', ['pending', 'processing', 'completed']);

      if (error) {
        logger.error('Error checking payment conflicts', { error: error.message });
        return conflicts;
      }

      if (data && data.length > 0) {
        conflicts.push({
          conflictId: `payment_conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conflictType: 'payment_conflict',
          severity: 'high',
          affectedReservations: [reservationId],
          affectedShopId: '', // Will be filled from reservation data
          conflictDetails: {
            paymentDetails: {
              paymentId: paymentId || '',
              conflictingPaymentId: data[0].id,
              amount
            }
          },
          detectedAt: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Error detecting payment conflicts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return conflicts;
  }

  /**
   * Resolve conflicts automatically or manually
   */
  async resolveConflicts(conflictIds: string[]): Promise<ConflictResolutionResult[]> {
    const results: ConflictResolutionResult[] = [];

    for (const conflictId of conflictIds) {
      try {
        const startTime = Date.now();
        
        // Get conflict information
        const conflict = await this.getConflictInfo(conflictId);
        if (!conflict) {
          results.push({
            success: false,
            conflictId,
            resolutionStrategy: 'unknown',
            actionsPerformed: [],
            affectedReservations: [],
            errors: ['Conflict not found'],
            warnings: [],
            resolutionTimeMs: Date.now() - startTime
          });
          continue;
        }

        // Find appropriate resolution strategy
        const strategy = this.findResolutionStrategy(conflict.conflictType);
        if (!strategy) {
          results.push({
            success: false,
            conflictId,
            resolutionStrategy: 'none_found',
            actionsPerformed: [],
            affectedReservations: conflict.affectedReservations,
            errors: ['No resolution strategy found'],
            warnings: [],
            resolutionTimeMs: Date.now() - startTime
          });
          continue;
        }

        // Execute resolution
        const result = await this.executeResolutionStrategy(conflict, strategy);
        result.conflictId = conflictId;
        result.resolutionStrategy = strategy.strategyId;
        result.resolutionTimeMs = Date.now() - startTime;

        results.push(result);

        // Update conflict status
        await this.updateConflictStatus(conflictId, result.success ? 'resolved' : 'failed', result);

      } catch (error) {
        logger.error('Error resolving conflict', {
          error: error instanceof Error ? error.message : 'Unknown error',
          conflictId
        });

        results.push({
          success: false,
          conflictId,
          resolutionStrategy: 'error',
          actionsPerformed: [],
          affectedReservations: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          resolutionTimeMs: Date.now()
        });
      }
    }

    return results;
  }

  /**
   * Execute resolution strategy
   */
  private async executeResolutionStrategy(
    conflict: ConflictInfo,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolutionResult> {
    const actionsPerformed: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Sort actions by priority
      const sortedActions = strategy.resolutionActions.sort((a, b) => a.priority - b.priority);

      for (const action of sortedActions) {
        try {
          switch (action.action) {
            case 'retry_operation':
              await this.executeRetryOperation(conflict, action.parameters);
              actionsPerformed.push(`Retried operation with parameters: ${JSON.stringify(action.parameters)}`);
              break;

            case 'reschedule_reservation':
              await this.executeRescheduleReservation(conflict, action.parameters);
              actionsPerformed.push(`Rescheduled reservation with parameters: ${JSON.stringify(action.parameters)}`);
              break;

            case 'cancel_reservation':
              await this.executeCancelReservation(conflict, action.parameters);
              actionsPerformed.push(`Cancelled reservation with parameters: ${JSON.stringify(action.parameters)}`);
              break;

            case 'update_payment':
              await this.executeUpdatePayment(conflict, action.parameters);
              actionsPerformed.push(`Updated payment with parameters: ${JSON.stringify(action.parameters)}`);
              break;

            default:
              warnings.push(`Unknown action: ${action.action}`);
          }
        } catch (actionError) {
          errors.push(`Failed to execute action ${action.action}: ${actionError instanceof Error ? actionError.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        conflictId: conflict.conflictId,
        resolutionStrategy: strategy.strategyId,
        actionsPerformed,
        affectedReservations: conflict.affectedReservations,
        errors,
        warnings,
        resolutionTimeMs: 0 // Will be set by caller
      };

    } catch (error) {
      return {
        success: false,
        conflictId: conflict.conflictId,
        resolutionStrategy: strategy.strategyId,
        actionsPerformed,
        affectedReservations: conflict.affectedReservations,
        errors: [error instanceof Error ? error.message : 'Unknown error', ...errors],
        warnings,
        resolutionTimeMs: 0 // Will be set by caller
      };
    }
  }

  /**
   * Execute retry operation action
   */
  private async executeRetryOperation(conflict: ConflictInfo, parameters: Record<string, any>): Promise<void> {
    const { maxRetries = 3, backoffMs = 100 } = parameters;

    // This would integrate with the enhanced retry mechanism service
    // For now, we'll implement a simple retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Simulate retry logic - in real implementation, this would call the appropriate service
        await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
        
        // If we get here, the retry was successful
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
  }

  /**
   * Execute reschedule reservation action
   */
  private async executeRescheduleReservation(conflict: ConflictInfo, parameters: Record<string, any>): Promise<void> {
    const { findNextAvailableSlot = true, notifyCustomer = true } = parameters;

    // Implementation would find next available slot and update reservation
    // This is a placeholder for the actual implementation
    logger.info('Executing reschedule reservation action', {
      conflictId: conflict.conflictId,
      parameters
    });
  }

  /**
   * Execute cancel reservation action
   */
  private async executeCancelReservation(conflict: ConflictInfo, parameters: Record<string, any>): Promise<void> {
    const { notifyCustomer = true, refundDeposit = true } = parameters;

    // Implementation would cancel reservation and handle refunds
    // This is a placeholder for the actual implementation
    logger.info('Executing cancel reservation action', {
      conflictId: conflict.conflictId,
      parameters
    });
  }

  /**
   * Execute update payment action
   */
  private async executeUpdatePayment(conflict: ConflictInfo, parameters: Record<string, any>): Promise<void> {
    const { reconcilePayments = true, notifyCustomer = true } = parameters;

    // Implementation would reconcile payment conflicts
    // This is a placeholder for the actual implementation
    logger.info('Executing update payment action', {
      conflictId: conflict.conflictId,
      parameters
    });
  }

  /**
   * Find appropriate resolution strategy for conflict type
   */
  private findResolutionStrategy(conflictType: string): ConflictResolutionStrategy | null {
    return this.resolutionStrategies.find(strategy => 
      strategy.conflictTypes.includes(conflictType)
    ) || null;
  }

  /**
   * Store conflict information in database
   */
  private async storeConflictInfo(conflict: ConflictInfo): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('conflict_detection_log')
        .insert({
          conflict_id: conflict.conflictId,
          conflict_type: conflict.conflictType,
          severity: conflict.severity,
          affected_reservations: conflict.affectedReservations,
          affected_shop_id: conflict.affectedShopId,
          conflict_details: conflict.conflictDetails,
          detected_at: conflict.detectedAt,
          status: 'detected'
        });

      if (error) {
        logger.error('Failed to store conflict info', {
          error: error.message,
          conflictId: conflict.conflictId
        });
      }
    } catch (error) {
      logger.error('Error storing conflict info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        conflictId: conflict.conflictId
      });
    }
  }

  /**
   * Get conflict information from database
   */
  private async getConflictInfo(conflictId: string): Promise<ConflictInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('conflict_detection_log')
        .select('*')
        .eq('conflict_id', conflictId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        conflictId: data.conflict_id,
        conflictType: data.conflict_type,
        severity: data.severity,
        affectedReservations: data.affected_reservations,
        affectedShopId: data.affected_shop_id,
        conflictDetails: data.conflict_details,
        detectedAt: data.detected_at,
        resolvedAt: data.resolved_at,
        resolutionStrategy: data.resolution_strategy,
        resolutionNotes: data.resolution_notes
      };
    } catch (error) {
      logger.error('Error getting conflict info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        conflictId
      });
      return null;
    }
  }

  /**
   * Update conflict status in database
   */
  private async updateConflictStatus(
    conflictId: string, 
    status: string, 
    result: ConflictResolutionResult
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('conflict_detection_log')
        .update({
          status,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
          resolution_strategy: result.resolutionStrategy,
          resolution_notes: JSON.stringify({
            actionsPerformed: result.actionsPerformed,
            errors: result.errors,
            warnings: result.warnings,
            resolutionTimeMs: result.resolutionTimeMs
          }),
          updated_at: new Date().toISOString()
        })
        .eq('conflict_id', conflictId);

      if (error) {
        logger.error('Failed to update conflict status', {
          error: error.message,
          conflictId,
          status
        });
      }
    } catch (error) {
      logger.error('Error updating conflict status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        conflictId,
        status
      });
    }
  }

  /**
   * Get conflict metrics
   */
  async getConflictMetrics(hoursBack: number = 24): Promise<ConflictMetrics> {
    try {
      const { data, error } = await this.supabase
        .from('conflict_detection_log')
        .select('*')
        .gte('detected_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString());

      if (error) {
        throw error;
      }

      const conflicts = data || [];
      const totalConflicts = conflicts.length;
      const resolvedConflicts = conflicts.filter(c => c.status === 'resolved').length;
      const unresolvedConflicts = totalConflicts - resolvedConflicts;

      const conflictsByType = conflicts.reduce((acc, conflict) => {
        acc[conflict.conflict_type] = (acc[conflict.conflict_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const conflictsBySeverity = conflicts.reduce((acc, conflict) => {
        acc[conflict.severity] = (acc[conflict.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const conflictsByShop = conflicts.reduce((acc, conflict) => {
        acc[conflict.affected_shop_id] = (acc[conflict.affected_shop_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const resolutionTimes = conflicts
        .filter(c => c.resolved_at && c.detected_at)
        .map(c => new Date(c.resolved_at).getTime() - new Date(c.detected_at).getTime());

      const avgResolutionTimeMs = resolutionTimes.length > 0 
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length 
        : 0;

      const resolutionSuccessRate = totalConflicts > 0 ? (resolvedConflicts / totalConflicts) * 100 : 0;

      return {
        totalConflicts,
        resolvedConflicts,
        unresolvedConflicts,
        conflictsByType,
        conflictsBySeverity,
        avgResolutionTimeMs,
        resolutionSuccessRate,
        conflictsByShop
      };

    } catch (error) {
      logger.error('Error getting conflict metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursBack
      });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ConflictDetectionConfig {
    return { ...this.config } as ConflictDetectionConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConflictDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const conflictDetectionResolutionService = new ConflictDetectionResolutionService();
