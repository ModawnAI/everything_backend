/**
 * Booking Validation Middleware
 * 
 * Middleware to validate booking requests using the comprehensive validation service.
 * Integrates with the API request pipeline to ensure all booking requests are properly validated.
 */

import { Request, Response, NextFunction } from 'express';
import { BookingValidationService, BookingRequest } from '../services/booking-validation.service';
import { logger } from '../utils/logger';

export interface ValidatedBookingRequest extends Request {
  validatedBooking?: BookingRequest | undefined;
  validationResult?: any;
  user?: any;
}

export class BookingValidationMiddleware {
  private validationService: BookingValidationService;

  constructor() {
    this.validationService = new BookingValidationService();
  }

  /**
   * Validate booking request middleware
   */
  validateBookingRequest = async (req: ValidatedBookingRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract booking request from request body
      // v3.1 API compatibility: Map new fields to legacy format for validation
      const services = req.body.services || [];
      const firstService = services.length > 0 ? services[0] : null;

      const bookingRequest: BookingRequest = {
        userId: req.body.userId || req.user?.id,
        shopId: req.body.shopId,
        serviceId: firstService?.serviceId || req.body.serviceId,
        staffId: req.body.staffId,
        date: req.body.reservationDate || req.body.date,
        timeSlot: req.body.reservationTime || req.body.timeSlot,
        quantity: firstService?.quantity || req.body.quantity || 1,
        specialRequests: req.body.specialRequests,
        customerNotes: req.body.customerNotes
      };

      logger.debug('[BOOKING-VALIDATION] Mapped booking request', { bookingRequest });

      // Perform comprehensive validation
      const validationResult = await this.validationService.validateBookingRequest(bookingRequest);

      logger.debug('[BOOKING-VALIDATION] Validation result', {
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });

      // Store validation result in request for controller access
      req.validatedBooking = bookingRequest;
      req.validationResult = validationResult;

      // Check if validation passed
      if (!validationResult.isValid) {
        const criticalErrors = validationResult.errors.filter(error => error.severity === 'critical');
        
        if (criticalErrors.length > 0) {
          // Return validation errors
          res.status(400).json({
            success: false,
            message: 'Booking validation failed',
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            metadata: validationResult.metadata
          });
          return;
        }
      }

      // Log validation warnings if any
      if (validationResult.warnings.length > 0) {
        logger.warn('Booking validation warnings:', {
          userId: bookingRequest.userId,
          shopId: bookingRequest.shopId,
          warnings: validationResult.warnings
        });
      }

      // Continue to next middleware/controller
      next();

    } catch (error) {
      logger.error('Error in booking validation middleware:', { error: (error as Error).message });
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during validation',
        error: 'VALIDATION_ERROR'
      });
    }
  };

  /**
   * Validate booking update request middleware
   */
  validateBookingUpdate = async (req: ValidatedBookingRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bookingId = req.params.id || req.body.bookingId;
      
      if (!bookingId) {
        res.status(400).json({
          success: false,
          message: 'Booking ID is required for updates',
          error: 'MISSING_BOOKING_ID'
        });
        return;
      }

      // For updates, we need to validate the changes
      const updateData = req.body;
      const allowedFields = ['date', 'timeSlot', 'staffId', 'quantity', 'specialRequests', 'customerNotes'];
      
      const invalidFields = Object.keys(updateData).filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid fields in update request',
          error: 'INVALID_FIELDS',
          invalidFields
        });
        return;
      }

      // If date or timeSlot is being updated, validate the new booking request
      if (updateData.date || updateData.timeSlot) {
        // Get the original booking to merge with updates
        const originalBooking = await this.getBookingById(bookingId);
        
        if (!originalBooking) {
          res.status(404).json({
            success: false,
            message: 'Booking not found',
            error: 'BOOKING_NOT_FOUND'
          });
          return;
        }

        const updatedBookingRequest: BookingRequest = {
          userId: originalBooking.user_id,
          shopId: originalBooking.shop_id,
          serviceId: originalBooking.service_id,
          staffId: updateData.staffId || originalBooking.staff_id,
          date: updateData.date || originalBooking.date,
          timeSlot: updateData.timeSlot || originalBooking.time_slot,
          quantity: updateData.quantity || originalBooking.quantity,
          specialRequests: updateData.specialRequests || originalBooking.special_requests,
          customerNotes: updateData.customerNotes || originalBooking.customer_notes
        };

        // Perform validation on the updated booking
        const validationResult = await this.validationService.validateBookingRequest(updatedBookingRequest);

        req.validatedBooking = updatedBookingRequest;
        req.validationResult = validationResult;

        if (!validationResult.isValid) {
          const criticalErrors = validationResult.errors.filter(error => error.severity === 'critical');
          
          if (criticalErrors.length > 0) {
            res.status(400).json({
              success: false,
              message: 'Booking update validation failed',
              errors: validationResult.errors,
              warnings: validationResult.warnings,
              metadata: validationResult.metadata
            });
            return;
          }
        }
      }

      next();

    } catch (error) {
      logger.error('Error in booking update validation middleware:', { error: (error as Error).message });
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during update validation',
        error: 'VALIDATION_ERROR'
      });
    }
  };

  /**
   * Validate bulk booking request middleware
   */
  validateBulkBooking = async (req: ValidatedBookingRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bookings } = req.body;

      if (!Array.isArray(bookings) || bookings.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Bulk booking request must contain an array of bookings',
          error: 'INVALID_BULK_REQUEST'
        });
        return;
      }

      if (bookings.length > 10) {
        res.status(400).json({
          success: false,
          message: 'Bulk booking request cannot exceed 10 bookings',
          error: 'BULK_LIMIT_EXCEEDED',
          details: { maxBookings: 10, requestedBookings: bookings.length }
        });
        return;
      }

      // Validate each booking in the bulk request
      const validationResults = [];
      const allErrors: any[] = [];
      const allWarnings: any[] = [];

      for (let i = 0; i < bookings.length; i++) {
        const booking = bookings[i];
        
        try {
          const bookingRequest: BookingRequest = {
            userId: booking.userId || req.user?.id,
            shopId: booking.shopId,
            serviceId: booking.serviceId,
            staffId: booking.staffId,
            date: booking.date,
            timeSlot: booking.timeSlot,
            quantity: booking.quantity,
            specialRequests: booking.specialRequests,
            customerNotes: booking.customerNotes
          };

          const validationResult = await this.validationService.validateBookingRequest(bookingRequest);
          
          validationResults.push({
            index: i,
            booking: bookingRequest,
            validation: validationResult
          });

          allErrors.push(...validationResult.errors.map(error => ({ ...error, bookingIndex: i })));
          allWarnings.push(...validationResult.warnings.map(warning => ({ ...warning, bookingIndex: i })));

        } catch (error) {
          allErrors.push({
            code: 'VALIDATION_ERROR',
            field: 'system',
            message: `Error validating booking at index ${i}`,
            severity: 'critical',
            bookingIndex: i,
            details: { error: (error as Error).message }
          });
        }
      }

      // Check if any bookings have critical errors
      const criticalErrors = allErrors.filter(error => error.severity === 'critical');
      
      if (criticalErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Bulk booking validation failed',
          errors: allErrors,
          warnings: allWarnings,
          validationResults
        });
        return;
      }

      // Store validation results in request
      if (validationResults.length > 0 && validationResults[0]) {
        req.validatedBooking = validationResults[0].booking;
      }
      req.validationResult = {
        isValid: criticalErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        validationResults
      };

      next();

    } catch (error) {
      logger.error('Error in bulk booking validation middleware:', { error: (error as Error).message });
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during bulk validation',
        error: 'VALIDATION_ERROR'
      });
    }
  };

  /**
   * Get booking by ID helper method
   */
  private async getBookingById(bookingId: string): Promise<any> {
    const { getSupabaseClient } = require('../config/database');
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      logger.error('Error fetching booking:', { error: error.message, bookingId });
      return null;
    }

    return data;
  }
}

// Export middleware instance
export const bookingValidationMiddleware = new BookingValidationMiddleware(); 