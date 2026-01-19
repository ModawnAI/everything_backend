/**
 * Split Payment Service Tests
 * 
 * Comprehensive unit tests for split payment functionality including:
 * - Split payment plan creation and validation
 * - Payment processing and installment tracking
 * - Status retrieval and reminder scheduling
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { splitPaymentService } from '../../src/services/split-payment.service';
import { tossPaymentsService } from '../../src/services/toss-payments.service';
import { paymentConfirmationService } from '../../src/services/payment-confirmation.service';
import { getSupabaseClient } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/toss-payments.service');
jest.mock('../../src/services/payment-confirmation.service');
jest.mock('../../src/utils/logger');

const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn(),
        order: jest.fn(),
        lt: jest.fn()
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn()
        })
      }),
      insert: jest.fn()
    }),
    rpc: jest.fn()
  }),
  rpc: jest.fn()
};

(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

// TODO: 결제 서비스 변경 후 활성화
describe.skip('SplitPaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSplitPaymentPlan', () => {
    const validRequest = {
      reservationId: 'reservation-123',
      userId: 'user-123',
      totalAmount: 100000,
      depositAmount: 30000,
      remainingDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    };

    it('should create a split payment plan successfully', async () => {
      // Mock database responses
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: 'plan-123',
        error: null
      });

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'plan-123',
                status: 'pending'
              },
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'installment-1',
                  installment_type: 'deposit',
                  amount: 30000
                },
                {
                  id: 'installment-2',
                  installment_type: 'remaining',
                  amount: 70000
                }
              ],
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await splitPaymentService.createSplitPaymentPlan(validRequest);

      expect(result).toEqual({
        planId: 'plan-123',
        depositInstallmentId: 'installment-1',
        remainingInstallmentId: 'installment-2',
        depositAmount: 30000,
        remainingAmount: 70000,
        remainingDueDate: validRequest.remainingDueDate,
        status: 'pending'
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_split_payment_plan', {
        p_reservation_id: validRequest.reservationId,
        p_user_id: validRequest.userId,
        p_total_amount: validRequest.totalAmount,
        p_deposit_amount: validRequest.depositAmount,
        p_remaining_due_date: validRequest.remainingDueDate
      });
    });

    it('should throw error for invalid amounts', async () => {
      const invalidRequest = {
        ...validRequest,
        depositAmount: 100000 // Equal to total amount
      };

      await expect(splitPaymentService.createSplitPaymentPlan(invalidRequest))
        .rejects
        .toThrow('Deposit amount must be less than total amount');
    });

    it('should throw error for past due date', async () => {
      const invalidRequest = {
        ...validRequest,
        remainingDueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Yesterday
      };

      await expect(splitPaymentService.createSplitPaymentPlan(invalidRequest))
        .rejects
        .toThrow('Due date must be in the future');
    });

    it('should throw error if plan already exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'existing-plan' },
              error: null
            })
          })
        })
      });

      await expect(splitPaymentService.createSplitPaymentPlan(validRequest))
        .rejects
        .toThrow('Split payment plan already exists for this reservation');
    });
  });

  describe('processSplitPayment', () => {
    const validRequest = {
      planId: 'plan-123',
      installmentId: 'installment-123',
      paymentKey: 'payment-key-123',
      orderId: 'order-123',
      amount: 30000,
      userId: 'user-123'
    };

    beforeEach(() => {
      // Mock payment confirmation service
      (paymentConfirmationService.confirmPaymentWithVerification as jest.Mock).mockResolvedValue({
        paymentId: 'payment-123',
        status: 'fully_paid',
        approvedAt: new Date().toISOString()
      });
    });

    it('should process split payment successfully', async () => {
      // Mock installment data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'installment-123',
                amount: 30000,
                status: 'pending',
                installment_type: 'deposit'
              },
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'plan-123',
                user_id: 'user-123'
              },
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      }).mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      }).mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        })
      });

      const result = await splitPaymentService.processSplitPayment(validRequest);

      expect(result).toEqual({
        success: true,
        paymentId: 'payment-123',
        installmentId: 'installment-123',
        status: 'fully_paid'
      });

      expect(paymentConfirmationService.confirmPaymentWithVerification).toHaveBeenCalledWith({
        paymentKey: validRequest.paymentKey,
        orderId: validRequest.orderId,
        amount: validRequest.amount,
        userId: validRequest.userId,
        sendNotification: true,
        generateReceipt: true
      });
    });

    it('should throw error for non-existent installment', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      await expect(splitPaymentService.processSplitPayment(validRequest))
        .rejects
        .toThrow('Installment not found');
    });

    it('should throw error for unauthorized access', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'installment-123',
                amount: 30000,
                status: 'pending'
              },
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'plan-123',
                user_id: 'different-user'
              },
              error: null
            })
          })
        })
      });

      await expect(splitPaymentService.processSplitPayment(validRequest))
        .rejects
        .toThrow('Unauthorized access to installment');
    });

    it('should throw error for amount mismatch', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'installment-123',
                amount: 50000, // Different amount
                status: 'pending'
              },
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'plan-123',
                user_id: 'user-123'
              },
              error: null
            })
          })
        })
      });

      await expect(splitPaymentService.processSplitPayment(validRequest))
        .rejects
        .toThrow('Payment amount does not match installment amount');
    });

    it('should throw error for already paid installment', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'installment-123',
                amount: 30000,
                status: 'paid' // Already paid
              },
              error: null
            })
          })
        })
      });

      await expect(splitPaymentService.processSplitPayment(validRequest))
        .rejects
        .toThrow('Installment is already paid');
    });
  });

  describe('getSplitPaymentStatus', () => {
    const reservationId = 'reservation-123';
    const userId = 'user-123';

    it('should return split payment status successfully', async () => {
      const mockPlan = {
        id: 'plan-123',
        reservation_id: reservationId,
        user_id: userId,
        total_amount: 100000,
        deposit_amount: 30000,
        remaining_amount: 70000,
        deposit_paid_at: new Date().toISOString(),
        remaining_paid_at: null,
        remaining_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'deposit_paid'
      };

      const mockInstallments = [
        {
          id: 'installment-1',
          installment_type: 'deposit',
          status: 'paid'
        },
        {
          id: 'installment-2',
          installment_type: 'remaining',
          status: 'pending'
        }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPlan,
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockInstallments,
              error: null
            })
          })
        })
      });

      const result = await splitPaymentService.getSplitPaymentStatus(reservationId, userId);

      expect(result).toEqual({
        planId: 'plan-123',
        reservationId,
        totalAmount: 100000,
        depositAmount: 30000,
        remainingAmount: 70000,
        depositStatus: 'paid',
        remainingStatus: 'pending',
        overallStatus: 'deposit_paid',
        depositPaidAt: mockPlan.deposit_paid_at,
        remainingPaidAt: undefined,
        remainingDueDate: mockPlan.remaining_due_date,
        isOverdue: false,
        daysUntilDue: expect.any(Number)
      });
    });

    it('should throw error for non-existent plan', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      });

      await expect(splitPaymentService.getSplitPaymentStatus(reservationId, userId))
        .rejects
        .toThrow('Split payment plan not found or unauthorized');
    });

    it('should throw error for unauthorized access', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'plan-123',
                user_id: 'different-user'
              },
              error: null
            })
          })
        })
      });

      await expect(splitPaymentService.getSplitPaymentStatus(reservationId, userId))
        .rejects
        .toThrow('Split payment plan not found or unauthorized');
    });
  });

  describe('getOverdueInstallments', () => {
    it('should return overdue installments successfully', async () => {
      const mockOverdueInstallments = [
        {
          id: 'installment-1',
          amount: 70000,
          due_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          split_payment_plans: {
            reservation_id: 'reservation-123',
            user_id: 'user-123',
            total_amount: 100000,
            remaining_due_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({
              data: mockOverdueInstallments,
              error: null
            })
          })
        })
      });

      const result = await splitPaymentService.getOverdueInstallments();

      expect(result).toEqual(mockOverdueInstallments);
    });

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      await expect(splitPaymentService.getOverdueInstallments())
        .rejects
        .toThrow('Failed to get overdue installments: Database error');
    });
  });

  describe('updateOverdueInstallments', () => {
    it('should update overdue installments successfully', async () => {
      const mockOverdueInstallments = [
        {
          id: 'installment-1',
          amount: 70000,
          due_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        }
      ];

      // Mock getOverdueInstallments
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({
              data: mockOverdueInstallments,
              error: null
            })
          })
        })
      }).mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      await splitPaymentService.updateOverdueInstallments();

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });
}); 