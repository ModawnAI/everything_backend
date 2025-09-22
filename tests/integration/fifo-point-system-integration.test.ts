/**
 * FIFO Point System Integration Tests
 * 
 * Tests the complete FIFO point usage system integration including:
 * - Point earning and availability
 * - FIFO consumption logic
 * - Balance calculations
 * - Transaction atomicity
 * - Real-world scenarios
 */

import { fifoPointUsageService } from '../../src/services/fifo-point-usage.service';
import { pointTransactionService } from '../../src/services/point-transaction.service';
import { pointService } from '../../src/services/point.service';
import { getSupabaseClient } from '../../src/config/database';
import { POINT_STATUS, POINT_TRANSACTION_TYPES } from '../../src/constants/point-policies';

describe('FIFO Point System Integration', () => {
  const supabase = getSupabaseClient();
  let testUserId: string;
  let testReservationIds: string[] = [];
  let createdTransactionIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    testUserId = crypto.randomUUID();
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `test-fifo-integration-${Date.now()}@example.com`,
        name: 'FIFO Integration Test User',
        phone_number: '+821012345679',
        total_points: 0,
        available_points: 0
      });

    if (userError) {
      throw new Error(`Failed to create test user: ${userError.message}`);
    }

    // Create test reservation IDs
    for (let i = 0; i < 3; i++) {
      testReservationIds.push(crypto.randomUUID());
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      // Delete point transactions
      if (createdTransactionIds.length > 0) {
        await supabase
          .from('point_transactions')
          .delete()
          .in('id', createdTransactionIds);
      }

      // Delete point balance
      await supabase
        .from('point_balances')
        .delete()
        .eq('user_id', testUserId);

      // Delete test user
      await supabase
        .from('users')
        .delete()
        .eq('id', testUserId);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(async () => {
    // Clear any existing transactions for clean test state
    const { data: existingTransactions } = await supabase
      .from('point_transactions')
      .select('id')
      .eq('user_id', testUserId);

    if (existingTransactions && existingTransactions.length > 0) {
      await supabase
        .from('point_transactions')
        .delete()
        .eq('user_id', testUserId);
    }

    // Clear point balance
    await supabase
      .from('point_balances')
      .delete()
      .eq('user_id', testUserId);

    createdTransactionIds = [];
  });

  describe('Complete Point Lifecycle with FIFO', () => {
    it('should handle complete point earning and usage cycle', async () => {
      // Step 1: Earn points from multiple sources at different times
      const now = new Date();
      const pointBatches = [
        {
          amount: 1000,
          availableFrom: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          description: 'Service completion batch 1'
        },
        {
          amount: 1500,
          availableFrom: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          description: 'Service completion batch 2'
        },
        {
          amount: 800,
          availableFrom: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          description: 'Referral bonus'
        }
      ];

      // Create point transactions
      for (const batch of pointBatches) {
        const response = await pointTransactionService.createTransaction({
          userId: testUserId,
          transactionType: 'earned_service',
          amount: batch.amount,
          description: batch.description,
          metadata: {
            source: 'integration_test',
            availableFrom: batch.availableFrom.toISOString()
          }
        });

        // Manually update available_from to simulate different earning dates
        await supabase
          .from('point_transactions')
          .update({
            available_from: batch.availableFrom.toISOString(),
            status: 'available'
          })
          .eq('id', response.id);

        createdTransactionIds.push(response.id);
      }

      // Step 2: Verify total available balance
      const balance = await pointTransactionService.getUserPointBalance(testUserId);
      expect(balance.availableBalance).toBe(3300); // 1000 + 1500 + 800

      // Step 3: Use points in FIFO order (should use oldest first)
      const usage1 = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 1200,
        reservationId: testReservationIds[0],
        description: 'First service payment'
      });

      expect(usage1.success).toBe(true);
      expect(usage1.totalUsed).toBe(1200);
      expect(usage1.transactionsUsed).toHaveLength(2);

      // Should use all 1000 from oldest batch + 200 from second batch
      expect(usage1.transactionsUsed[0].usedAmount).toBe(1000);
      expect(usage1.transactionsUsed[1].usedAmount).toBe(200);
      expect(usage1.remainingBalance).toBe(2100); // 3300 - 1200

      createdTransactionIds.push(usage1.newTransactionId);

      // Step 4: Use more points
      const usage2 = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 1500,
        reservationId: testReservationIds[1],
        description: 'Second service payment'
      });

      expect(usage2.success).toBe(true);
      expect(usage2.totalUsed).toBe(1500);
      expect(usage2.remainingBalance).toBe(600); // 2100 - 1500

      createdTransactionIds.push(usage2.newTransactionId);

      // Step 5: Verify final balance
      const finalBalance = await pointTransactionService.getUserPointBalance(testUserId);
      expect(finalBalance.availableBalance).toBe(600);
      expect(finalBalance.totalUsed).toBe(2700); // 1200 + 1500
    });

    it('should handle concurrent point usage attempts', async () => {
      // Create available points
      const response = await pointTransactionService.createTransaction({
        userId: testUserId,
        transactionType: 'earned_service',
        amount: 1000,
        description: 'Points for concurrency test'
      });

      // Update to available status
      await supabase
        .from('point_transactions')
        .update({ status: 'available' })
        .eq('id', response.id);

      createdTransactionIds.push(response.id);

      // Attempt concurrent usage (this tests database transaction isolation)
      const usagePromises = [
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: 600,
          reservationId: testReservationIds[0],
          description: 'Concurrent usage 1'
        }),
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: 600,
          reservationId: testReservationIds[1],
          description: 'Concurrent usage 2'
        })
      ];

      const results = await Promise.allSettled(usagePromises);

      // One should succeed, one should fail due to insufficient points
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // The successful one should have used 600 points
      const successfulResult = results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>;
      if (successfulResult) {
        expect(successfulResult.value.totalUsed).toBe(600);
        expect(successfulResult.value.remainingBalance).toBe(400);
        createdTransactionIds.push(successfulResult.value.newTransactionId);
      }
    });

    it('should integrate with existing point service deductPoints method', async () => {
      // Create available points
      const response = await pointTransactionService.createTransaction({
        userId: testUserId,
        transactionType: 'earned_service',
        amount: 2000,
        description: 'Points for point service integration'
      });

      // Update to available status
      await supabase
        .from('point_transactions')
        .update({ status: 'available' })
        .eq('id', response.id);

      createdTransactionIds.push(response.id);

      // Use points via the legacy point service (should now use FIFO internally)
      const deductedTransaction = await pointService.deductPoints(
        testUserId,
        800,
        'spent',
        'purchase',
        'Legacy service integration test',
        testReservationIds[0]
      );

      expect(deductedTransaction).toBeDefined();
      expect(deductedTransaction.amount).toBe(-800);
      createdTransactionIds.push(deductedTransaction.id);

      // Verify balance was updated correctly
      const balance = await pointTransactionService.getUserPointBalance(testUserId);
      expect(balance.availableBalance).toBe(1200); // 2000 - 800
      expect(balance.totalUsed).toBe(800);
    });

    it('should handle point expiration correctly', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

      // Create points that are already expired
      const expiredResponse = await pointTransactionService.createTransaction({
        userId: testUserId,
        transactionType: 'earned_service',
        amount: 1000,
        description: 'Expired points'
      });

      // Create valid points
      const validResponse = await pointTransactionService.createTransaction({
        userId: testUserId,
        transactionType: 'earned_service',
        amount: 500,
        description: 'Valid points'
      });

      // Update statuses and expiration
      await supabase
        .from('point_transactions')
        .update({
          status: 'available',
          available_from: pastDate.toISOString(),
          expires_at: pastDate.toISOString() // Already expired
        })
        .eq('id', expiredResponse.id);

      await supabase
        .from('point_transactions')
        .update({ status: 'available' })
        .eq('id', validResponse.id);

      createdTransactionIds.push(expiredResponse.id, validResponse.id);

      // Try to use 600 points (should fail due to insufficient valid points)
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: 600,
          reservationId: testReservationIds[0],
          description: 'Test with expired points'
        })
      ).rejects.toThrow(/Insufficient points/);

      // Use 400 points (should succeed with valid points only)
      const usage = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 400,
        reservationId: testReservationIds[0],
        description: 'Test with valid points only'
      });

      expect(usage.success).toBe(true);
      expect(usage.totalUsed).toBe(400);
      expect(usage.remainingBalance).toBe(100); // 500 - 400
      createdTransactionIds.push(usage.newTransactionId);
    });

    it('should maintain transaction history and audit trail', async () => {
      // Create and use points to generate history
      const earnResponse = await pointTransactionService.createTransaction({
        userId: testUserId,
        transactionType: 'earned_service',
        amount: 1500,
        description: 'Service completion for history test'
      });

      await supabase
        .from('point_transactions')
        .update({ status: 'available' })
        .eq('id', earnResponse.id);

      createdTransactionIds.push(earnResponse.id);

      // Use points multiple times
      const usage1 = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 600,
        reservationId: testReservationIds[0],
        description: 'First usage for history'
      });

      const usage2 = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 400,
        reservationId: testReservationIds[1],
        description: 'Second usage for history'
      });

      createdTransactionIds.push(usage1.newTransactionId, usage2.newTransactionId);

      // Get usage history
      const history = await fifoPointUsageService.getPointUsageHistory(testUserId, 10, 0);

      expect(history.usageHistory).toHaveLength(2);
      expect(history.totalCount).toBe(2);

      // Verify history details
      expect(history.usageHistory[0].amount).toBe(-400); // Most recent first
      expect(history.usageHistory[1].amount).toBe(-600);

      // Verify metadata contains FIFO usage information
      const recentUsage = history.usageHistory[0];
      expect(recentUsage.metadata).toHaveProperty('fifo_usage', true);
      expect(recentUsage.metadata).toHaveProperty('transactions_used');
    });

    it('should handle complex partial usage scenarios', async () => {
      // Create multiple small point batches
      const batches = [
        { amount: 300, description: 'Batch 1' },
        { amount: 250, description: 'Batch 2' },
        { amount: 400, description: 'Batch 3' },
        { amount: 150, description: 'Batch 4' }
      ];

      for (let i = 0; i < batches.length; i++) {
        const response = await pointTransactionService.createTransaction({
          userId: testUserId,
          transactionType: 'earned_service',
          amount: batches[i].amount,
          description: batches[i].description
        });

        // Make available with different dates
        await supabase
          .from('point_transactions')
          .update({
            status: 'available',
            available_from: new Date(Date.now() - (batches.length - i) * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', response.id);

        createdTransactionIds.push(response.id);
      }

      // Use 725 points (should span multiple transactions with partial usage)
      const usage = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 725,
        reservationId: testReservationIds[0],
        description: 'Complex partial usage test'
      });

      expect(usage.success).toBe(true);
      expect(usage.totalUsed).toBe(725);
      expect(usage.transactionsUsed).toHaveLength(3);

      // Should use: 300 (full) + 250 (full) + 175 (partial from 400)
      expect(usage.transactionsUsed[0].usedAmount).toBe(300);
      expect(usage.transactionsUsed[1].usedAmount).toBe(250);
      expect(usage.transactionsUsed[2].usedAmount).toBe(175);
      expect(usage.transactionsUsed[2].remainingAmount).toBe(225); // 400 - 175

      // Remaining balance should be 225 + 150 = 375
      expect(usage.remainingBalance).toBe(375);

      createdTransactionIds.push(usage.newTransactionId);

      // Verify the partially used transaction still exists with reduced amount
      const { data: partialTransaction } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('id', usage.transactionsUsed[2].transactionId)
        .single();

      expect(partialTransaction!.amount).toBe(225);
      expect(partialTransaction!.status).toBe('available');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database transaction failures gracefully', async () => {
      // Try to use points for non-existent user
      const nonExistentUserId = crypto.randomUUID();

      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: nonExistentUserId,
          amountToUse: 100,
          description: 'Non-existent user test'
        })
      ).rejects.toThrow(/User not found/);
    });

    it('should validate business rules correctly', async () => {
      // Test minimum usage amount
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: 0.5, // Below minimum
          description: 'Below minimum test'
        })
      ).rejects.toThrow();

      // Test maximum usage amount
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: 99999999, // Above maximum
          description: 'Above maximum test'
        })
      ).rejects.toThrow();
    });
  });
});

