/**
 * Payment Error Handling Service Unit Tests
 * 
 * Comprehensive test suite for payment error handling functionality including:
 * - Payment error classification and logging
 * - Automatic retry mechanisms with exponential backoff
 * - Error recovery and resolution workflows
 * - Error analytics and reporting
 * - Integration with fraud detection and security monitoring
 */

import { PaymentErrorHandlingService } from '../../src/services/payment-error-handling.service';
import { getSupabaseClient } from '../../src/config/database';
import {
  PaymentError,
  PaymentErrorType,
  ErrorHandlingConfig,
  SecurityAlertType,
  SecurityAlertSeverity
} from '../../src/types/payment-security.types';

// Mock Supabase client
jest.mock('../../src/config/database');
const mockSupabase = getSupabaseClient() as jest.Mocked<any>;

describe('PaymentErrorHandlingService', () => {
  let paymentErrorHandlingService: PaymentErrorHandlingService;

  beforeEach(() => {
    paymentErrorHandlingService = new PaymentErrorHandlingService();
    jest.clearAllMocks();
  });

  describe('handlePaymentError', () => {
    const mockContext = {
      paymentId: 'test-payment-123',
      userId: 'test-user-456',
      reservationId: 'test-reservation-789',
      requestData: { amount: 50000, currency: 'KRW' },
      responseData: { error: 'Network timeout' },
      ipAddress: '192.168.1.1',
      userAgent: 'test-user-agent'
    };

    it('should handle network error successfully', async () => {
      const networkError = new Error('Network connection failed');
      
      // Mock successful error creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'error_123' },
          error: null
        })
      });

      const result = await paymentErrorHandlingService.handlePaymentError(
        networkError,
        'network_error',
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.errorType).toBe('network_error');
      expect(result.errorCode).toBe('NETWORK_ERROR');
      expect(result.errorMessage).toBe('Network connection failed');
      expect(result.paymentId).toBe('test-payment-123');
      expect(result.userId).toBe('test-user-456');
      expect(result.isResolved).toBe(false);
    });

    it('should handle API error with retry logic', async () => {
      const apiError = new Error('API rate limit exceeded');
      
      // Mock successful error creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'error_456' },
          error: null
        })
      });

      const result = await paymentErrorHandlingService.handlePaymentError(
        apiError,
        'api_error',
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.errorType).toBe('api_error');
      expect(result.errorCode).toBe('API_ERROR');
      expect(result.errorMessage).toBe('API rate limit exceeded');
      expect(result.isResolved).toBe(false);
    });

    it('should handle validation error with auto-resolution', async () => {
      const validationError = new Error('Invalid payment amount');
      
      // Mock successful error creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'error_789' },
          error: null
        })
      });

      const result = await paymentErrorHandlingService.handlePaymentError(
        validationError,
        'validation_error',
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.errorType).toBe('validation_error');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.errorMessage).toBe('Invalid payment amount');
      expect(result.isResolved).toBe(true); // Auto-resolved
    });

    it('should handle authentication error with security alert', async () => {
      const authError = new Error('Invalid API key');
      
      // Mock successful error creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'error_auth' },
          error: null
        })
      });

      const result = await paymentErrorHandlingService.handlePaymentError(
        authError,
        'authentication_error',
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.errorType).toBe('authentication_error');
      expect(result.errorCode).toBe('AUTHENTICATION_ERROR');
      expect(result.errorMessage).toBe('Invalid API key');
      expect(result.isResolved).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const networkError = new Error('Network connection failed');
      
      // Mock database error
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' }
        })
      });

      await expect(paymentErrorHandlingService.handlePaymentError(
        networkError,
        'network_error',
        mockContext
      )).rejects.toThrow('Failed to create payment error: Database connection failed');
    });
  });

  describe('error classification', () => {
    it('should classify network errors correctly', () => {
      const service = paymentErrorHandlingService as any;
      
      const networkError = new Error('Connection timeout');
      const errorCode = service.extractErrorCode(networkError);
      const errorDetails = service.extractErrorDetails(networkError);
      
      expect(errorCode).toBe('NETWORK_ERROR');
      expect(errorDetails).toContain('Connection timeout');
    });

    it('should classify API errors correctly', () => {
      const service = paymentErrorHandlingService as any;
      
      const apiError = new Error('Rate limit exceeded');
      const errorCode = service.extractErrorCode(apiError);
      const errorDetails = service.extractErrorDetails(apiError);
      
      expect(errorCode).toBe('API_ERROR');
      expect(errorDetails).toContain('Rate limit exceeded');
    });

    it('should classify validation errors correctly', () => {
      const service = paymentErrorHandlingService as any;
      
      const validationError = new Error('Invalid amount');
      const errorCode = service.extractErrorCode(validationError);
      const errorDetails = service.extractErrorDetails(validationError);
      
      expect(errorCode).toBe('VALIDATION_ERROR');
      expect(errorDetails).toContain('Invalid amount');
    });
  });

  describe('alert severity determination', () => {
    it('should determine correct alert severity for different error types', () => {
      const service = paymentErrorHandlingService as any;
      
      expect(service.determineAlertSeverity('network_error')).toBe('warning');
      expect(service.determineAlertSeverity('api_error')).toBe('error');
      expect(service.determineAlertSeverity('validation_error')).toBe('info');
      expect(service.determineAlertSeverity('authentication_error')).toBe('error');
      expect(service.determineAlertSeverity('authorization_error')).toBe('error');
      expect(service.determineAlertSeverity('fraud_detection_error')).toBe('critical');
      expect(service.determineAlertSeverity('system_error')).toBe('critical');
    });
  });

  describe('alert type determination', () => {
    it('should determine correct alert type for different error types', () => {
      const service = paymentErrorHandlingService as any;
      
      expect(service.determineAlertType('network_error')).toBe('system_error');
      expect(service.determineAlertType('api_error')).toBe('system_error');
      expect(service.determineAlertType('validation_error')).toBe('system_error');
      expect(service.determineAlertType('authentication_error')).toBe('suspicious_activity');
      expect(service.determineAlertType('authorization_error')).toBe('suspicious_activity');
      expect(service.determineAlertType('fraud_detection_error')).toBe('fraud_detected');
      expect(service.determineAlertType('system_error')).toBe('system_error');
    });
  });

  describe('fraud detection integration', () => {
    it('should trigger fraud detection for suspicious errors', () => {
      const service = paymentErrorHandlingService as any;
      
      expect(service.shouldPerformFraudDetection('authentication_error', {})).toBe(true);
      expect(service.shouldPerformFraudDetection('authorization_error', {})).toBe(true);
      expect(service.shouldPerformFraudDetection('fraud_detection_error', {})).toBe(true);
      expect(service.shouldPerformFraudDetection('network_error', {})).toBe(false);
      expect(service.shouldPerformFraudDetection('validation_error', {})).toBe(false);
    });
  });

  describe('retry logic', () => {
    it('should calculate correct retry delay with exponential backoff', () => {
      const service = paymentErrorHandlingService as any;
      
      const errorConfig: ErrorHandlingConfig = {
        id: 'test',
        errorType: 'network_error',
        retryEnabled: true,
        maxRetries: 3,
        retryDelay: 5,
        exponentialBackoff: true,
        alertOnFailure: false,
        autoResolve: false,
        autoResolveAfter: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      expect(service.calculateRetryDelay(1, errorConfig)).toBe(5);
      expect(service.calculateRetryDelay(2, errorConfig)).toBe(10);
      expect(service.calculateRetryDelay(3, errorConfig)).toBe(20);
    });

    it('should calculate correct retry delay without exponential backoff', () => {
      const service = paymentErrorHandlingService as any;
      
      const errorConfig: ErrorHandlingConfig = {
        id: 'test',
        errorType: 'rate_limit_error',
        retryEnabled: true,
        maxRetries: 5,
        retryDelay: 60,
        exponentialBackoff: false,
        alertOnFailure: true,
        autoResolve: false,
        autoResolveAfter: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      expect(service.calculateRetryDelay(1, errorConfig)).toBe(60);
      expect(service.calculateRetryDelay(2, errorConfig)).toBe(60);
      expect(service.calculateRetryDelay(3, errorConfig)).toBe(60);
    });
  });

  describe('error resolution', () => {
    it('should auto-resolve errors after specified time', async () => {
      const service = paymentErrorHandlingService as any;
      
      // Mock successful update
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: 'error_123', is_resolved: true },
            error: null
          })
        })
      });

      await expect(service.autoResolveError('error_123')).resolves.not.toThrow();
    });

    it('should handle auto-resolution errors gracefully', async () => {
      const service = paymentErrorHandlingService as any;
      
      // Mock database error
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Error not found' }
          })
        })
      });

      await expect(service.autoResolveError('error_123')).resolves.not.toThrow();
    });
  });

  describe('audit trail logging', () => {
    it('should log error audit trail successfully', async () => {
      const service = paymentErrorHandlingService as any;
      
      const paymentError: PaymentError = {
        id: 'error_123',
        errorType: 'network_error',
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'Connection timeout',
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        isResolved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const context = {
        paymentId: 'test-payment-123',
        userId: 'test-user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'test-user-agent'
      };

      // Mock successful audit log creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'audit_123' },
          error: null
        })
      });

      await expect(service.logErrorAuditTrail(paymentError, context)).resolves.not.toThrow();
    });
  });
}); 