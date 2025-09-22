/**
 * FIFO Point Usage Service Unit Tests
 * 
 * Tests the First-In-First-Out point usage logic with real database connections
 * following the established testing rules.
 */

import { fifoPointUsageService } from '../../src/services/fifo-point-usage.service';
import { pointTransactionService } from '../../src/services/point-transaction.service';
import { createClient } from '@supabase/supabase-js';
import { POINT_STATUS, POINT_TRANSACTION_TYPES } from '../../src/constants/point-policies';

describe('FIFOPointUsageService', () => {
  // Create test Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      }
    }
  );
  let testUserId: string;
  let testReservationId: string;
  let createdTransactionIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    testUserId = crypto.randomUUID();
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `test-fifo-${Date.now()}@example.com`,
        name: 'FIFO Test User',
        phone_number: '+821012345678',
        total_points: 0,
        available_points: 0
      });

    if (userError) {
      throw new Error(`Failed to create test user: ${userError.message}`);
    }

    testReservationId = crypto.randomUUID();
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

    createdTransactionIds = [];
  });

  describe('usePointsFIFO', () => {
    it('should use points in FIFO order', async () => {
      // Create multiple point transactions with different available dates
      const now = new Date();
      const olderDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const newerDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      // Create older transaction (should be used first)
      const { data: olderTransaction } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 1000,
          status: 'available',
          available_from: olderDate.toISOString(),
          description: 'Older points'
        })
        .select()
        .single();

      // Create newer transaction (should be used second)
      const { data: newerTransaction } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 1500,
          status: 'available',
          available_from: newerDate.toISOString(),
          description: 'Newer points'
        })
        .select()
        .single();

      createdTransactionIds.push(olderTransaction!.id, newerTransaction!.id);

      // Use 1200 points (should use all 1000 from older + 200 from newer)
      const result = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 1200,
        reservationId: testReservationId,
        description: 'Test FIFO usage'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(1200);
      expect(result.transactionsUsed).toHaveLength(2);

      // Verify FIFO order
      expect(result.transactionsUsed[0].transactionId).toBe(olderTransaction!.id);
      expect(result.transactionsUsed[0].usedAmount).toBe(1000);
      expect(result.transactionsUsed[1].transactionId).toBe(newerTransaction!.id);
      expect(result.transactionsUsed[1].usedAmount).toBe(200);

      // Verify remaining balance
      expect(result.remainingBalance).toBe(1300); // 1500 - 200 = 1300
    });

    it('should handle partial point usage correctly', async () => {
      // Create a single point transaction
      const { data: transaction } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 2000,
          status: 'available',
          available_from: new Date().toISOString(),
          description: 'Test points for partial usage'
        })
        .select()
        .single();

      createdTransactionIds.push(transaction!.id);

      // Use only part of the points
      const result = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 800,
        reservationId: testReservationId,
        description: 'Partial usage test'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(800);
      expect(result.remainingBalance).toBe(1200); // 2000 - 800 = 1200

      // Verify the original transaction was partially used
      const { data: updatedTransaction } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('id', transaction!.id)
        .single();

      expect(updatedTransaction!.amount).toBe(1200); // Reduced from 2000 to 1200
      expect(updatedTransaction!.status).toBe('available'); // Still available
    });

    it('should fail when insufficient points available', async () => {
      // Create insufficient points
      const { data: transaction } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 500,
          status: 'available',
          available_from: new Date().toISOString(),
          description: 'Insufficient points'
        })
        .select()
        .single();

      createdTransactionIds.push(transaction!.id);

      // Try to use more points than available
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: 1000,
          reservationId: testReservationId,
          description: 'Insufficient points test'
        })
      ).rejects.toThrow(/Insufficient points/);
    });

    it('should ignore pending and expired points', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day in future
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

      // Create pending points (not yet available)
      const { data: pendingTransaction } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 1000,
          status: 'pending',
          available_from: futureDate.toISOString(),
          description: 'Pending points'
        })
        .select()
        .single();

      // Create expired points
      const { data: expiredTransaction } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 1000,
          status: 'available',
          available_from: pastDate.toISOString(),
          expires_at: pastDate.toISOString(), // Already expired
          description: 'Expired points'
        })
        .select()
        .single();

      // Create available points
      const { data: availableTransaction } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 500,
          status: 'available',
          available_from: pastDate.toISOString(),
          description: 'Available points'
        })
        .select()
        .single();

      createdTransactionIds.push(
        pendingTransaction!.id,
        expiredTransaction!.id,
        availableTransaction!.id
      );

      // Try to use 600 points (should fail due to insufficient available points)
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: 600,
          reservationId: testReservationId,
          description: 'Test pending/expired exclusion'
        })
      ).rejects.toThrow(/Insufficient points/);

      // Use 400 points (should succeed with available points)
      const result = await fifoPointUsageService.usePointsFIFO({
        userId: testUserId,
        amountToUse: 400,
        reservationId: testReservationId,
        description: 'Test with available points only'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(400);
    });

    it('should validate request parameters', async () => {
      // Test missing user ID
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: '',
          amountToUse: 100,
          description: 'Invalid user ID test'
        })
      ).rejects.toThrow(/User ID is required/);

      // Test negative amount
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: -100,
          description: 'Negative amount test'
        })
      ).rejects.toThrow(/Amount must be positive/);

      // Test zero amount
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: testUserId,
          amountToUse: 0,
          description: 'Zero amount test'
        })
      ).rejects.toThrow(/Amount must be positive/);
    });
  });

  describe('getAvailablePointsFIFO', () => {
    it('should return points in FIFO order', async () => {
      const now = new Date();
      const dates = [
        new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
      ];

      // Create transactions in reverse order
      for (let i = dates.length - 1; i >= 0; i--) {
        const { data: transaction } = await supabase
          .from('point_transactions')
          .insert({
            user_id: testUserId,
            transaction_type: 'earned_service',
            amount: (i + 1) * 100,
            status: 'available',
            available_from: dates[i].toISOString(),
            description: `Points ${i + 1}`
          })
          .select()
          .single();

        createdTransactionIds.push(transaction!.id);
      }

      const availablePoints = await fifoPointUsageService.getAvailablePointsFIFO(testUserId);

      expect(availablePoints).toHaveLength(3);
      
      // Verify FIFO order (oldest first)
      expect(new Date(availablePoints[0].available_from).getTime())
        .toBeLessThan(new Date(availablePoints[1].available_from).getTime());
      expect(new Date(availablePoints[1].available_from).getTime())
        .toBeLessThan(new Date(availablePoints[2].available_from).getTime());
    });

    it('should exclude non-available points', async () => {
      const now = new Date();

      // Create various types of points
      const transactions = [
        { status: 'available', amount: 100, available_from: now },
        { status: 'pending', amount: 200, available_from: now },
        { status: 'used', amount: 300, available_from: now },
        { status: 'expired', amount: 400, available_from: now }
      ];

      for (const tx of transactions) {
        const { data: transaction } = await supabase
          .from('point_transactions')
          .insert({
            user_id: testUserId,
            transaction_type: 'earned_service',
            amount: tx.amount,
            status: tx.status,
            available_from: tx.available_from.toISOString(),
            description: `${tx.status} points`
          })
          .select()
          .single();

        createdTransactionIds.push(transaction!.id);
      }

      const availablePoints = await fifoPointUsageService.getAvailablePointsFIFO(testUserId);

      // Should only return the available points
      expect(availablePoints).toHaveLength(1);
      expect(availablePoints[0].amount).toBe(100);
    });
  });

  describe('calculateUsableAmount', () => {
    it('should calculate correct usable amount', async () => {
      // Create test points
      const { data: transaction1 } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 500,
          status: 'available',
          available_from: new Date().toISOString(),
          description: 'First batch'
        })
        .select()
        .single();

      const { data: transaction2 } = await supabase
        .from('point_transactions')
        .insert({
          user_id: testUserId,
          transaction_type: 'earned_service',
          amount: 300,
          status: 'available',
          available_from: new Date().toISOString(),
          description: 'Second batch'
        })
        .select()
        .single();

      createdTransactionIds.push(transaction1!.id, transaction2!.id);

      // Test exact amount
      const result1 = await fifoPointUsageService.calculateUsableAmount(testUserId, 800);
      expect(result1.canUse).toBe(800);
      expect(result1.insufficient).toBe(false);
      expect(result1.availableBalance).toBe(800);

      // Test partial amount
      const result2 = await fifoPointUsageService.calculateUsableAmount(testUserId, 600);
      expect(result2.canUse).toBe(600);
      expect(result2.insufficient).toBe(false);
      expect(result2.breakdown).toHaveLength(2);

      // Test insufficient amount
      const result3 = await fifoPointUsageService.calculateUsableAmount(testUserId, 1000);
      expect(result3.canUse).toBe(800);
      expect(result3.insufficient).toBe(true);
    });
  });

  describe('getPointUsageHistory', () => {
    it('should return usage history in chronological order', async () => {
      // Create some usage transactions
      const usageTransactions = [];
      for (let i = 0; i < 3; i++) {
        const { data: transaction } = await supabase
          .from('point_transactions')
          .insert({
            user_id: testUserId,
            transaction_type: 'used_service',
            amount: -(i + 1) * 100,
            status: 'used',
            description: `Usage ${i + 1}`
          })
          .select()
          .single();

        usageTransactions.push(transaction!);
        createdTransactionIds.push(transaction!.id);
      }

      const history = await fifoPointUsageService.getPointUsageHistory(testUserId, 10, 0);

      expect(history.usageHistory).toHaveLength(3);
      expect(history.totalCount).toBe(3);

      // Should be in reverse chronological order (newest first)
      expect(new Date(history.usageHistory[0].created_at).getTime())
        .toBeGreaterThanOrEqual(new Date(history.usageHistory[1].created_at).getTime());
    });

    it('should handle pagination correctly', async () => {
      // Create 5 usage transactions
      for (let i = 0; i < 5; i++) {
        const { data: transaction } = await supabase
          .from('point_transactions')
          .insert({
            user_id: testUserId,
            transaction_type: 'used_service',
            amount: -100,
            status: 'used',
            description: `Usage ${i + 1}`
          })
          .select()
          .single();

        createdTransactionIds.push(transaction!.id);
      }

      // Test first page
      const page1 = await fifoPointUsageService.getPointUsageHistory(testUserId, 2, 0);
      expect(page1.usageHistory).toHaveLength(2);
      expect(page1.totalCount).toBe(5);

      // Test second page
      const page2 = await fifoPointUsageService.getPointUsageHistory(testUserId, 2, 2);
      expect(page2.usageHistory).toHaveLength(2);
      expect(page2.totalCount).toBe(5);

      // Test last page
      const page3 = await fifoPointUsageService.getPointUsageHistory(testUserId, 2, 4);
      expect(page3.usageHistory).toHaveLength(1);
      expect(page3.totalCount).toBe(5);
    });
  });
});
