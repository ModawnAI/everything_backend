/**
 * Conflict Resolution Service
 * 
 * Handles comprehensive conflict resolution for booking conflicts, overbooking scenarios,
 * and resource allocation issues with priority-based resolution and compensation logic.
 */

import { getSupabaseClient } from '../config/database';
import { timeSlotService } from './time-slot.service';
import { reservationStateMachine } from './reservation-state-machine.service';
import { monitoringService } from './monitoring.service';
import { logger } from '../utils/logger';
import { Reservation, ReservationStatus, UserRole } from '../types/database.types';

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedReservations: string[]; // Reservation IDs
  shopId: string;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionMethod?: ResolutionMethod;
  compensation?: Compensation;
  metadata: Record<string, any>;
}

export type ConflictType = 
  | 'time_overlap'
  | 'resource_shortage'
  | 'staff_unavailable'
  | 'capacity_exceeded'
  | 'double_booking'
  | 'service_conflict'
  | 'payment_conflict';

export type ResolutionMethod = 
  | 'automatic_reschedule'
  | 'manual_reschedule'
  | 'cancellation'
  | 'compensation'
  | 'priority_override'
  | 'resource_reallocation';

export interface Compensation {
  type: 'refund' | 'discount' | 'free_service' | 'points' | 'voucher';
  amount: number;
  currency: string;
  description: string;
  applied: boolean;
  appliedAt?: string;
}

export interface PriorityScore {
  reservationId: string;
  score: number;
  factors: {
    customerTier: number;
    bookingTime: number;
    paymentStatus: number;
    serviceValue: number;
    loyaltyPoints: number;
  };
  totalScore: number;
}

export interface ConflictResolutionRequest {
  conflictId: string;
  resolutionMethod: ResolutionMethod;
  resolvedBy: string;
  resolvedByRole: UserRole;
  notes?: string;
  compensation?: Compensation;
  affectedReservations: {
    reservationId: string;
    action: 'reschedule' | 'cancel' | 'modify' | 'keep';
    newDateTime?: string;
    newServices?: string[];
  }[];
}

export interface ConflictResolutionResult {
  success: boolean;
  conflictId: string;
  resolutionMethod: ResolutionMethod;
  affectedReservations: string[];
  notifications: {
    user: boolean;
    shop: boolean;
    admin: boolean;
  };
  compensation?: Compensation | undefined;
  errors: string[];
  warnings: string[];
}

export class ConflictResolutionService {
  private supabase = getSupabaseClient();

  // Priority weights for conflict resolution
  private readonly priorityWeights = {
    customerTier: {
      'admin': 100,
      'shop_owner': 90,
      'influencer': 80,
      'user': 50
    },
    paymentStatus: {
      'fully_paid': 100,
      'deposit_paid': 80,
      'pending': 30
    },
    bookingTime: {
      // Earlier bookings get higher priority (in hours before service)
      '24h+': 100,
      '12-24h': 80,
      '6-12h': 60,
      '2-6h': 40,
      '0-2h': 20
    }
  };

  /**
   * Detect conflicts for a specific reservation or shop
   */
  async detectConflicts(
    shopId: string,
    reservationId?: string,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<ConflictDetectionResult> {
    const startTime = Date.now();
    let success = false;

    try {
      const conflicts: Conflict[] = [];
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

      // Input validation
      if (!shopId) {
        const error = new Error('Shop ID is required for conflict detection');
        monitoringService.trackError('VALIDATION_ERROR', error.message, 'detectConflicts', 'high', {
          shopId,
          reservationId,
          dateRange
        });
        throw error;
      }

      // Get reservations for the shop with error handling
      const reservations = await this.getShopReservations(shopId, dateRange);
      
      // Detect time overlaps
      const timeOverlaps = this.detectTimeOverlaps(reservations);
      conflicts.push(...timeOverlaps);

      // Detect resource conflicts
      const resourceConflicts = await this.detectResourceConflicts(shopId, reservations);
      conflicts.push(...resourceConflicts);

      // Detect capacity issues
      const capacityConflicts = await this.detectCapacityConflicts(shopId, reservations);
      conflicts.push(...capacityConflicts);

      // Determine overall severity
      severity = this.calculateOverallSeverity(conflicts);

      // Generate recommendations
      const recommendations = this.generateRecommendations(conflicts, severity);

      success = true;

      // Track conflict detection metrics
      for (const conflict of conflicts) {
        await monitoringService.trackConflict(
          conflict.type,
          shopId,
          false, // Not resolved yet
          undefined,
          {
            severity: conflict.severity,
            affectedReservations: conflict.affectedReservations.length,
            detectedAt: conflict.detectedAt
          }
        );
      }

      // Create alert for critical conflicts
      if (severity === 'critical' && conflicts.length > 0) {
        monitoringService.createAlert({
          type: 'conflict',
          severity: 'critical',
          title: `Critical Conflicts Detected: ${shopId}`,
          description: `Found ${conflicts.length} critical conflicts requiring immediate attention`,
          shopId,
          metadata: {
            conflictCount: conflicts.length,
            conflictTypes: conflicts.map(c => c.type),
            affectedReservations: conflicts.flatMap(c => c.affectedReservations).length
          }
        });
      }

      logger.info('Conflict detection completed:', {
        shopId,
        reservationId,
        conflictCount: conflicts.length,
        severity,
        duration: Date.now() - startTime
      });

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        severity,
        recommendations
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Track error metrics
      monitoringService.trackError(
        'CONFLICT_DETECTION_ERROR',
        errorMessage,
        'detectConflicts',
        'high',
        {
          shopId,
          reservationId,
          dateRange,
          duration: Date.now() - startTime,
          errorStack: error instanceof Error ? error.stack : undefined
        }
      );

      logger.error('Error detecting conflicts:', { 
        shopId, 
        reservationId, 
        error: errorMessage,
        duration: Date.now() - startTime
      });

      // Return safe fallback instead of throwing
      return {
        hasConflicts: false,
        conflicts: [],
        severity: 'low',
        recommendations: ['Unable to detect conflicts due to system error']
      };
    } finally {
      // Track performance metrics
      monitoringService.trackPerformance(
        'detectConflicts',
        Date.now() - startTime,
        success,
        {
          shopId,
          reservationId,
          hasDateRange: !!dateRange
        }
      );
    }
  }

  /**
   * Resolve a specific conflict
   */
  async resolveConflict(request: ConflictResolutionRequest): Promise<ConflictResolutionResult> {
    try {
      // Validate conflict exists
      const conflict = await this.getConflictById(request.conflictId);
      if (!conflict) {
        return {
          success: false,
          conflictId: request.conflictId,
          resolutionMethod: request.resolutionMethod,
          affectedReservations: [],
          notifications: { user: false, shop: false, admin: false },
          errors: ['Conflict not found'],
          warnings: []
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      const affectedReservations: string[] = [];

      // Apply resolution based on method
      switch (request.resolutionMethod) {
        case 'automatic_reschedule':
          await this.handleAutomaticReschedule(request, errors, warnings, affectedReservations);
          break;
        case 'manual_reschedule':
          await this.handleManualReschedule(request, errors, warnings, affectedReservations);
          break;
        case 'cancellation':
          await this.handleCancellation(request, errors, warnings, affectedReservations);
          break;
        case 'compensation':
          await this.handleCompensation(request, errors, warnings, affectedReservations);
          break;
        case 'priority_override':
          await this.handlePriorityOverride(request, errors, warnings, affectedReservations);
          break;
        case 'resource_reallocation':
          await this.handleResourceReallocation(request, errors, warnings, affectedReservations);
          break;
      }

      // Update conflict status
      await this.updateConflictStatus(request.conflictId, 'resolved', request.resolvedBy);

      // Apply compensation if specified
      let compensation: Compensation | undefined;
      if (request.compensation) {
        compensation = await this.applyCompensation(request.compensation, affectedReservations);
      }

      // Send notifications
      const notifications = await this.sendConflictResolutionNotifications(
        conflict,
        request,
        affectedReservations
      );

      return {
        success: errors.length === 0,
        conflictId: request.conflictId,
        resolutionMethod: request.resolutionMethod,
        affectedReservations,
        notifications,
        compensation,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Error resolving conflict:', { request, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Calculate priority scores for conflicting reservations
   */
  async calculatePriorityScores(reservationIds: string[]): Promise<PriorityScore[]> {
    try {
      const scores: PriorityScore[] = [];

      for (const reservationId of reservationIds) {
        const reservation = await this.getReservationById(reservationId);
        if (!reservation) continue;

        const user = await this.getUserById(reservation.user_id);
        if (!user) continue;

        // Calculate customer tier score
        const customerTier = this.priorityWeights.customerTier[user.user_role as keyof typeof this.priorityWeights.customerTier] || 50;

        // Calculate payment status score
        const payment = await this.getPaymentByReservationId(reservationId);
        const paymentStatus = payment ? this.priorityWeights.paymentStatus[payment.payment_status as keyof typeof this.priorityWeights.paymentStatus] || 30 : 30;

        // Calculate booking time score
        const hoursUntilReservation = this.getHoursUntilReservation(
          reservation.reservation_date || '',
          reservation.reservation_time || ''
        );
        const bookingTime = this.calculateBookingTimeScore(hoursUntilReservation);

        // Calculate service value score
        const serviceValue = this.calculateServiceValueScore(reservation.total_amount);

        // Calculate loyalty points score
        const loyaltyPoints = this.calculateLoyaltyScore(user.total_points);

        const totalScore = customerTier + paymentStatus + bookingTime + serviceValue + loyaltyPoints;

        scores.push({
          reservationId,
          score: totalScore,
          factors: {
            customerTier,
            bookingTime,
            paymentStatus,
            serviceValue,
            loyaltyPoints
          },
          totalScore
        });
      }

      // Sort by priority score (highest first)
      return scores.sort((a, b) => b.totalScore - a.totalScore);

    } catch (error) {
      logger.error('Error calculating priority scores:', { reservationIds, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get conflict history for a shop
   */
  async getConflictHistory(
    shopId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Conflict[]> {
    try {
      let query = this.supabase
        .from('conflicts')
        .select('*')
        .eq('shop_id', shopId)
        .order('detected_at', { ascending: false });

      if (startDate) {
        query = query.gte('detected_at', startDate);
      }
      if (endDate) {
        query = query.lte('detected_at', endDate);
      }

      const { data: conflicts, error } = await query;

      if (error) {
        logger.error('Error getting conflict history:', { shopId, error: error.message });
        return [];
      }

      return conflicts || [];

    } catch (error) {
      logger.error('Error in getConflictHistory:', { shopId, error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get conflict statistics for a shop
   */
  async getConflictStats(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalConflicts: number;
    resolvedConflicts: number;
    unresolvedConflicts: number;
    conflictsByType: Record<ConflictType, number>;
    conflictsBySeverity: Record<string, number>;
    averageResolutionTime: number;
    totalCompensationAmount: number;
  }> {
    try {
      const { data: conflicts, error } = await this.supabase
        .from('conflicts')
        .select('*')
        .eq('shop_id', shopId)
        .gte('detected_at', startDate)
        .lte('detected_at', endDate);

      if (error) {
        logger.error('Error getting conflict stats:', { shopId, error: error.message });
        return {
          totalConflicts: 0,
          resolvedConflicts: 0,
          unresolvedConflicts: 0,
          conflictsByType: {} as Record<ConflictType, number>,
          conflictsBySeverity: {},
          averageResolutionTime: 0,
          totalCompensationAmount: 0
        };
      }

      const conflictList = conflicts || [];
      const totalConflicts = conflictList.length;
      const resolvedConflicts = conflictList.filter(c => c.resolved_at).length;
      const unresolvedConflicts = totalConflicts - resolvedConflicts;

      // Calculate conflicts by type
      const conflictsByType: Record<ConflictType, number> = {} as Record<ConflictType, number>;
      conflictList.forEach(conflict => {
        conflictsByType[conflict.type as ConflictType] = (conflictsByType[conflict.type as ConflictType] || 0) + 1;
      });

      // Calculate conflicts by severity
      const conflictsBySeverity: Record<string, number> = {};
      conflictList.forEach(conflict => {
        conflictsBySeverity[conflict.severity] = (conflictsBySeverity[conflict.severity] || 0) + 1;
      });

      // Calculate average resolution time
      const resolvedConflictsWithTime = conflictList.filter(c => c.resolved_at && c.detected_at);
      const averageResolutionTime = resolvedConflictsWithTime.length > 0
        ? resolvedConflictsWithTime.reduce((sum, conflict) => {
            const detectionTime = new Date(conflict.detected_at).getTime();
            const resolutionTime = new Date(conflict.resolved_at!).getTime();
            return sum + (resolutionTime - detectionTime);
          }, 0) / resolvedConflictsWithTime.length
        : 0;

      // Calculate total compensation amount
      const totalCompensationAmount = conflictList.reduce((sum, conflict) => {
        return sum + (conflict.compensation?.amount || 0);
      }, 0);

      return {
        totalConflicts,
        resolvedConflicts,
        unresolvedConflicts,
        conflictsByType,
        conflictsBySeverity,
        averageResolutionTime,
        totalCompensationAmount
      };

    } catch (error) {
      logger.error('Error in getConflictStats:', { shopId, error: (error as Error).message });
      throw error;
    }
  }

  // Private helper methods

  private async getShopReservations(
    shopId: string,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<Reservation[]> {
    let query = this.supabase
      .from('reservations')
      .select('*')
      .eq('shop_id', shopId)
      .in('status', ['requested', 'confirmed']);

    if (dateRange) {
      query = query.gte('reservation_date', dateRange.startDate)
                   .lte('reservation_date', dateRange.endDate);
    }

    const { data: reservations, error } = await query;

    if (error) {
      logger.error('Error getting shop reservations:', { shopId, error: error.message });
      return [];
    }

    return reservations || [];
  }

  private detectTimeOverlaps(reservations: Reservation[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const sortedReservations = reservations.sort((a, b) => {
      const dateA = new Date(`${a.reservation_date}T${a.reservation_time}`);
      const dateB = new Date(`${b.reservation_date}T${b.reservation_time}`);
      return dateA.getTime() - dateB.getTime();
    });

    for (let i = 0; i < sortedReservations.length - 1; i++) {
      const current = sortedReservations[i];
      const next = sortedReservations[i + 1];

      const currentStart = new Date(`${current.reservation_date}T${current.reservation_time}`);
      const currentEnd = new Date(currentStart.getTime() + 60 * 60 * 1000); // Assume 1 hour duration
      const nextStart = new Date(`${next.reservation_date}T${next.reservation_time}`);

      if (currentEnd > nextStart) {
        conflicts.push({
          id: `time_overlap_${current.id}_${next.id}`,
          type: 'time_overlap',
          severity: 'high',
          description: `Time overlap detected between reservations ${current.id} and ${next.id}`,
          affectedReservations: [current.id, next.id],
          shopId: current.shop_id,
          detectedAt: new Date().toISOString(),
          metadata: {
            currentReservation: current,
            nextReservation: next,
            overlapDuration: currentEnd.getTime() - nextStart.getTime()
          }
        });
      }
    }

    return conflicts;
  }

  private async detectResourceConflicts(shopId: string, reservations: Reservation[]): Promise<Conflict[]> {
    // This would check for staff availability, equipment conflicts, etc.
    // For now, return empty array as this requires more complex business logic
    return [];
  }

  private async detectCapacityConflicts(shopId: string, reservations: Reservation[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    try {
      // Get shop capacity configuration
      const shopCapacity = await this.getShopCapacityConfiguration(shopId);
      if (!shopCapacity) {
        // No capacity configuration - assume no conflicts
        return conflicts;
      }

      // Group reservations by time slots to check concurrent capacity
      const reservationsByTimeSlot = this.groupReservationsByTimeSlot(reservations);

      for (const [timeSlot, slotReservations] of reservationsByTimeSlot.entries()) {
        // Check overall shop capacity
        if (slotReservations.length > shopCapacity.maxConcurrentServices) {
          conflicts.push({
            id: `capacity_exceeded_${shopId}_${timeSlot}`,
            type: 'capacity_exceeded',
            severity: 'high',
            description: `Shop capacity exceeded at ${timeSlot}: ${slotReservations.length}/${shopCapacity.maxConcurrentServices} concurrent services`,
            affectedReservations: slotReservations.map(r => r.id),
            shopId,
            detectedAt: new Date().toISOString(),
            metadata: {
              timeSlot,
              currentCapacity: slotReservations.length,
              maxCapacity: shopCapacity.maxConcurrentServices,
              reservations: slotReservations.map(r => ({
                id: r.id,
                status: r.status,
                totalAmount: r.total_amount
              }))
            }
          });
        }

        // Check individual service capacity limits
        for (const [serviceId, serviceCapacityLimit] of Object.entries(shopCapacity.serviceCapacityLimits)) {
          const serviceReservations = slotReservations.filter(reservation => {
            // Check if reservation includes this service
            // This would require joining with reservation_services table
            return true; // Simplified for now
          });

          if (serviceReservations.length > serviceCapacityLimit) {
            conflicts.push({
              id: `service_capacity_exceeded_${serviceId}_${timeSlot}`,
              type: 'capacity_exceeded',
              severity: 'medium',
              description: `Service ${serviceId} capacity exceeded at ${timeSlot}: ${serviceReservations.length}/${serviceCapacityLimit}`,
              affectedReservations: serviceReservations.map(r => r.id),
              shopId,
              detectedAt: new Date().toISOString(),
              metadata: {
                serviceId,
                timeSlot,
                currentCapacity: serviceReservations.length,
                maxCapacity: serviceCapacityLimit
              }
            });
          }
        }
      }

      logger.debug('Capacity conflicts detected:', {
        shopId,
        totalConflicts: conflicts.length,
        conflictsByType: conflicts.reduce((acc, conflict) => {
          acc[conflict.type] = (acc[conflict.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      return conflicts;

    } catch (error) {
      logger.error('Error detecting capacity conflicts:', { shopId, error: (error as Error).message });
      return conflicts;
    }
  }

  private calculateOverallSeverity(conflicts: Conflict[]): 'low' | 'medium' | 'high' | 'critical' {
    if (conflicts.length === 0) return 'low';

    const severityScores = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };

    const totalScore = conflicts.reduce((sum, conflict) => {
      return sum + severityScores[conflict.severity];
    }, 0);

    const averageScore = totalScore / conflicts.length;

    if (averageScore >= 3.5) return 'critical';
    if (averageScore >= 2.5) return 'high';
    if (averageScore >= 1.5) return 'medium';
    return 'low';
  }

  private generateRecommendations(conflicts: Conflict[], severity: string): string[] {
    const recommendations: string[] = [];

    if (conflicts.length === 0) {
      recommendations.push('No conflicts detected. System is running smoothly.');
      return recommendations;
    }

    if (severity === 'critical') {
      recommendations.push('Immediate action required. Consider manual intervention.');
      recommendations.push('Review all affected reservations and contact customers.');
    }

    if (severity === 'high') {
      recommendations.push('High priority conflicts detected. Review and resolve promptly.');
    }

    const timeOverlaps = conflicts.filter(c => c.type === 'time_overlap');
    if (timeOverlaps.length > 0) {
      recommendations.push(`Found ${timeOverlaps.length} time overlap conflicts. Consider rescheduling.`);
    }

    const resourceConflicts = conflicts.filter(c => c.type === 'resource_shortage');
    if (resourceConflicts.length > 0) {
      recommendations.push(`Found ${resourceConflicts.length} resource conflicts. Check staff availability.`);
    }

    return recommendations;
  }

  private async handleAutomaticReschedule(
    request: ConflictResolutionRequest,
    errors: string[],
    warnings: string[],
    affectedReservations: string[]
  ): Promise<void> {
    // Implementation for automatic rescheduling
    // This would use the existing rescheduling service
    warnings.push('Automatic rescheduling not yet implemented');
  }

  private async handleManualReschedule(
    request: ConflictResolutionRequest,
    errors: string[],
    warnings: string[],
    affectedReservations: string[]
  ): Promise<void> {
    // Implementation for manual rescheduling
    warnings.push('Manual rescheduling not yet implemented');
  }

  private async handleCancellation(
    request: ConflictResolutionRequest,
    errors: string[],
    warnings: string[],
    affectedReservations: string[]
  ): Promise<void> {
    // Implementation for cancellation
    warnings.push('Cancellation handling not yet implemented');
  }

  private async handleCompensation(
    request: ConflictResolutionRequest,
    errors: string[],
    warnings: string[],
    affectedReservations: string[]
  ): Promise<void> {
    // Implementation for compensation
    warnings.push('Compensation handling not yet implemented');
  }

  private async handlePriorityOverride(
    request: ConflictResolutionRequest,
    errors: string[],
    warnings: string[],
    affectedReservations: string[]
  ): Promise<void> {
    // Implementation for priority override
    warnings.push('Priority override not yet implemented');
  }

  private async handleResourceReallocation(
    request: ConflictResolutionRequest,
    errors: string[],
    warnings: string[],
    affectedReservations: string[]
  ): Promise<void> {
    // Implementation for resource reallocation
    warnings.push('Resource reallocation not yet implemented');
  }

  private async updateConflictStatus(
    conflictId: string,
    status: 'resolved' | 'pending',
    resolvedBy: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('conflicts')
      .update({
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        resolved_by: status === 'resolved' ? resolvedBy : null
      })
      .eq('id', conflictId);

    if (error) {
      logger.error('Error updating conflict status:', { conflictId, error: error.message });
    }
  }

  private async applyCompensation(
    compensation: Compensation,
    affectedReservations: string[]
  ): Promise<Compensation> {
    // Implementation for applying compensation
    // This would integrate with payment and points systems
    return {
      ...compensation,
      applied: true,
      appliedAt: new Date().toISOString()
    };
  }

  private async sendConflictResolutionNotifications(
    conflict: Conflict,
    request: ConflictResolutionRequest,
    affectedReservations: string[]
  ): Promise<{ user: boolean; shop: boolean; admin: boolean }> {
    // Implementation for sending notifications
    // This would integrate with the notification service
    return {
      user: true,
      shop: true,
      admin: true
    };
  }

  private async getConflictById(conflictId: string): Promise<Conflict | null> {
    const { data: conflict, error } = await this.supabase
      .from('conflicts')
      .select('*')
      .eq('id', conflictId)
      .single();

    if (error) {
      logger.error('Error getting conflict by ID:', { conflictId, error: error.message });
      return null;
    }

    return conflict;
  }

  private async getReservationById(reservationId: string): Promise<Reservation | null> {
    const { data: reservation, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (error) {
      logger.error('Error getting reservation by ID:', { reservationId, error: error.message });
      return null;
    }

    return reservation;
  }

  private async getUserById(userId: string): Promise<any | null> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error getting user by ID:', { userId, error: error.message });
      return null;
    }

    return user;
  }

  private async getPaymentByReservationId(reservationId: string): Promise<any | null> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .single();

    if (error) {
      logger.error('Error getting payment by reservation ID:', { reservationId, error: error.message });
      return null;
    }

    return payment;
  }

  private getHoursUntilReservation(date: string, time: string): number {
    if (!date || !time) return 0;
    const reservationDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    return (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  }

  private calculateBookingTimeScore(hoursUntilReservation: number): number {
    if (hoursUntilReservation >= 24) return this.priorityWeights.bookingTime['24h+'];
    if (hoursUntilReservation >= 12) return this.priorityWeights.bookingTime['12-24h'];
    if (hoursUntilReservation >= 6) return this.priorityWeights.bookingTime['6-12h'];
    if (hoursUntilReservation >= 2) return this.priorityWeights.bookingTime['2-6h'];
    return this.priorityWeights.bookingTime['0-2h'];
  }

  private calculateServiceValueScore(totalAmount: number): number {
    // Higher value services get higher priority
    if (totalAmount >= 100000) return 100; // 100k+ won
    if (totalAmount >= 50000) return 80;   // 50k+ won
    if (totalAmount >= 20000) return 60;   // 20k+ won
    if (totalAmount >= 10000) return 40;   // 10k+ won
    return 20; // Less than 10k won
  }

  private calculateLoyaltyScore(totalPoints: number): number {
    // Higher loyalty points get higher priority
    if (totalPoints >= 50000) return 100;
    if (totalPoints >= 20000) return 80;
    if (totalPoints >= 10000) return 60;
    if (totalPoints >= 5000) return 40;
    return 20;
  }

  /**
   * Get shop capacity configuration
   */
  private async getShopCapacityConfiguration(shopId: string): Promise<{
    maxConcurrentServices: number;
    maxConcurrentCustomers: number;
    serviceCapacityLimits: Record<string, number>;
  } | null> {
    try {
      // For now, return a default configuration
      // In a real implementation, this would query a shop_capacity table
      return {
        maxConcurrentServices: 5,
        maxConcurrentCustomers: 10,
        serviceCapacityLimits: {
          // Default limits - would be loaded from database
        }
      };

    } catch (error) {
      logger.error('Error getting shop capacity configuration:', { shopId, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Group reservations by time slots for capacity analysis
   */
  private groupReservationsByTimeSlot(reservations: Reservation[]): Map<string, Reservation[]> {
    const timeSlotGroups = new Map<string, Reservation[]>();

    for (const reservation of reservations) {
      const timeSlot = `${reservation.reservation_date}T${reservation.reservation_time}`;
      
      if (!timeSlotGroups.has(timeSlot)) {
        timeSlotGroups.set(timeSlot, []);
      }
      
      timeSlotGroups.get(timeSlot)!.push(reservation);
    }

    return timeSlotGroups;
  }
}

export const conflictResolutionService = new ConflictResolutionService(); 