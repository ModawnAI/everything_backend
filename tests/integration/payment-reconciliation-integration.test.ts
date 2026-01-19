/**
 * Integration Tests for Payment Reconciliation System
 * 
 * Tests for comprehensive payment reconciliation system including:
 * - TossPayments settlement data integration
 * - Transaction matching algorithms
 * - Discrepancy detection and resolution
 * - Reconciliation reporting and audit trails
 * - Automated alerts and manual tools
 */

import { PaymentReconciliationService } from '../../src/services/payment-reconciliation.service';
import { getSupabaseClient } from '../../src/config/database';
import { createTestUser, createTestShop, createTestService, createTestReservation, cleanupTestData } from '../setup-real-db';

// Use real database for integration tests
const supabase = getSupabaseClient();

// TODO: 결제 서비스 변경 후 활성화
describe.skip('Payment Reconciliation Integration Tests', () => {
  let service: PaymentReconciliationService;
  let testUserId: string;
  let testShopId: string;
  let testServiceId: string;
  let testReservationId: string;

  beforeAll(async () => {
    service = new PaymentReconciliationService();
    
    // Create test data
    testUserId = await createTestUser();
    testShopId = await createTestShop(testUserId);
    testServiceId = await createTestService(testShopId);
    testReservationId = await createTestReservation(testUserId, testShopId, testServiceId);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Settlement Data Integration', () => {
    it('should fetch and store settlement data successfully', async () => {
      const date = '2024-01-15';
      
      const result = await service.fetchSettlementData(date);

      expect(result).toBeDefined();
      expect(result.settlementId).toContain('settlement_');
      expect(result.settlementDate).toBe(date);
      expect(result.totalAmount).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.fees).toBeGreaterThan(0);
      expect(result.netAmount).toBe(result.totalAmount - result.fees);
      expect(result.status).toBe('completed');
      expect(result.currency).toBe('KRW');
      expect(result.transactions).toHaveLength(result.totalCount);

      // Verify settlement data was stored in database
      const { data: settlementData, error } = await supabase
        .from('payment_settlements')
        .select('*')
        .eq('id', result.settlementId)
        .single();

      expect(error).toBeNull();
      expect(settlementData).toBeDefined();
      expect(settlementData.settlement_date).toBe(date);
      expect(settlementData.total_amount).toBe(result.totalAmount);
      expect(settlementData.total_count).toBe(result.totalCount);
    });

    it('should store settlement transactions correctly', async () => {
      const date = '2024-01-16';
      
      const result = await service.fetchSettlementData(date);

      // Verify transactions were stored
      const { data: transactions, error } = await supabase
        .from('settlement_transactions')
        .select('*')
        .eq('settlement_id', result.settlementId);

      expect(error).toBeNull();
      expect(transactions).toHaveLength(result.totalCount);

      // Verify transaction structure
      transactions?.forEach(transaction => {
        expect(transaction.transaction_id).toMatch(/^txn_/);
        expect(transaction.payment_id).toMatch(/^payment_/);
        expect(transaction.amount).toBeGreaterThan(0);
        expect(transaction.fees).toBeGreaterThan(0);
        expect(transaction.net_amount).toBe(transaction.amount - transaction.fees);
        expect(['success', 'failed', 'cancelled', 'refunded']).toContain(transaction.status);
        expect(['card', 'bank_transfer']).toContain(transaction.payment_method);
      });
    });

    it('should retrieve settlement data by date range', async () => {
      // Create multiple settlement records
      await service.fetchSettlementData('2024-01-17');
      await service.fetchSettlementData('2024-01-18');
      await service.fetchSettlementData('2024-01-19');

      const result = await service.getSettlementData('2024-01-17', '2024-01-19');

      expect(result).toHaveLength(3);
      result.forEach(settlement => {
        expect(settlement.settlementDate).toMatch(/^2024-01-1[789]$/);
        expect(settlement.totalAmount).toBeGreaterThan(0);
        expect(settlement.transactions).toHaveLength(settlement.totalCount);
      });
    });

    it('should retrieve settlement data by ID', async () => {
      const date = '2024-01-20';
      const settlement = await service.fetchSettlementData(date);

      const result = await service.getSettlementDataById(settlement.settlementId);

      expect(result).toBeDefined();
      expect(result!.settlementId).toBe(settlement.settlementId);
      expect(result!.settlementDate).toBe(date);
      expect(result!.totalAmount).toBe(settlement.totalAmount);
      expect(result!.transactions).toHaveLength(settlement.totalCount);
    });
  });

  describe('Internal Transaction Integration', () => {
    it('should retrieve internal payment transactions', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const result = await service.getInternalTransactions(startDate, endDate);

      expect(Array.isArray(result)).toBe(true);
      
      // Should include our test reservation if it has a payment
      const testPayment = result.find(p => p.reservations?.id === testReservationId);
      if (testPayment) {
        expect(testPayment.amount).toBeGreaterThan(0);
        expect(testPayment.payment_status).toBe('fully_paid');
        expect(testPayment.reservations).toBeDefined();
        expect(testPayment.reservations.user_id).toBe(testUserId);
        expect(testPayment.reservations.shop_id).toBe(testShopId);
        expect(testPayment.reservations.service_id).toBe(testServiceId);
      }
    });

    it('should filter internal transactions by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const result = await service.getInternalTransactions(startDate, endDate);

      result.forEach(payment => {
        const paymentDate = new Date(payment.created_at);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        expect(paymentDate >= start).toBe(true);
        expect(paymentDate <= end).toBe(true);
        expect(payment.payment_status).toBe('fully_paid');
      });
    });
  });

  describe('Reconciliation Record Management', () => {
    let reconciliationId: string;

    it('should create reconciliation record', async () => {
      const settlementId = 'settlement_test_123';
      
      reconciliationId = await service.createReconciliationRecord(settlementId);

      expect(reconciliationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // Verify record was created in database
      const { data: record, error } = await supabase
        .from('reconciliation_records')
        .select('*')
        .eq('id', reconciliationId)
        .single();

      expect(error).toBeNull();
      expect(record).toBeDefined();
      expect(record.settlement_id).toBe(settlementId);
      expect(record.status).toBe('pending');
    });

    it('should retrieve reconciliation record by ID', async () => {
      const result = await service.getReconciliationRecord(reconciliationId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(reconciliationId);
      expect(result!.settlementId).toBe('settlement_test_123');
      expect(result!.status).toBe('pending');
    });

    it('should retrieve reconciliation records by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const result = await service.getReconciliationRecords(startDate, endDate);

      expect(Array.isArray(result)).toBe(true);
      
      // Should include our test record
      const testRecord = result.find(r => r.id === reconciliationId);
      if (testRecord) {
        expect(testRecord.settlementId).toBe('settlement_test_123');
        expect(testRecord.status).toBe('pending');
      }
    });

    it('should update reconciliation record status', async () => {
      const newStatus = 'completed';
      const completedBy = 'admin_test';

      const { error } = await supabase
        .from('reconciliation_records')
        .update({
          status: newStatus,
          completed_by: completedBy,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reconciliationId);

      expect(error).toBeNull();

      // Verify update
      const result = await service.getReconciliationRecord(reconciliationId);
      expect(result!.status).toBe(newStatus);
      expect(result!.completedBy).toBe(completedBy);
      expect(result!.completedAt).toBeDefined();
    });
  });

  describe('Transaction Matching Integration', () => {
    it('should perform transaction matching with real data', async () => {
      // Step 1: Create settlement data
      const settlementDate = '2024-01-21';
      const settlement = await service.fetchSettlementData(settlementDate);

      expect(settlement).toBeDefined();
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.totalAmount).toBeGreaterThan(0);

      // Step 2: Create reconciliation record
      const reconciliationId = await service.createReconciliationRecord(settlement.settlementId);

      expect(reconciliationId).toBeDefined();

      // Step 3: Perform transaction matching
      const matchingResult = await service.performTransactionMatching(settlement.settlementId, reconciliationId);

      expect(matchingResult).toBeDefined();
      expect(matchingResult.matches).toBeDefined();
      expect(matchingResult.unmatchedSettlement).toBeDefined();
      expect(matchingResult.unmatchedInternal).toBeDefined();
      expect(matchingResult.summary).toBeDefined();

      // Verify matching results
      expect(matchingResult.summary.totalSettlement).toBe(settlement.totalCount);
      expect(matchingResult.summary.totalInternal).toBeGreaterThanOrEqual(0);
      expect(matchingResult.summary.matchRate).toBeGreaterThanOrEqual(0);
      expect(matchingResult.summary.matchRate).toBeLessThanOrEqual(100);

      // Verify match types
      const exactMatches = matchingResult.matches.filter(m => m.matchType === 'exact');
      const fuzzyMatches = matchingResult.matches.filter(m => m.matchType === 'fuzzy');
      const manualMatches = matchingResult.matches.filter(m => m.matchType === 'manual');

      expect(exactMatches.length + fuzzyMatches.length + manualMatches.length).toBe(matchingResult.matches.length);

      // Verify match quality
      matchingResult.matches.forEach(match => {
        expect(match.matchScore).toBeGreaterThanOrEqual(0);
        expect(match.matchScore).toBeLessThanOrEqual(100);
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(100);
        expect(match.settlementTransaction).toBeDefined();
        expect(match.internalTransaction).toBeDefined();
        expect(match.discrepancies).toBeDefined();
        expect(Array.isArray(match.discrepancies)).toBe(true);
      });
    });

    it('should handle matching with discrepancies', async () => {
      const settlementDate = '2024-01-22';
      const settlement = await service.fetchSettlementData(settlementDate);

      const reconciliationId = await service.createReconciliationRecord(settlement.settlementId);

      // Perform matching
      const matchingResult = await service.performTransactionMatching(settlement.settlementId, reconciliationId);

      // Check for discrepancies in matches
      const matchesWithDiscrepancies = matchingResult.matches.filter(m => m.discrepancies.length > 0);
      
      if (matchesWithDiscrepancies.length > 0) {
        matchesWithDiscrepancies.forEach(match => {
          expect(match.discrepancies).toBeDefined();
          expect(Array.isArray(match.discrepancies)).toBe(true);
          expect(match.discrepancies.length).toBeGreaterThan(0);
          
          // Verify discrepancy format
          match.discrepancies.forEach(discrepancy => {
            expect(typeof discrepancy).toBe('string');
            expect(discrepancy.length).toBeGreaterThan(0);
          });
        });
      }
    });

    it('should store transaction matches in database', async () => {
      const settlementDate = '2024-01-23';
      const settlement = await service.fetchSettlementData(settlementDate);

      const reconciliationId = await service.createReconciliationRecord(settlement.settlementId);

      // Perform matching
      const matchingResult = await service.performTransactionMatching(settlement.settlementId, reconciliationId);

      // Verify matches were stored in database
      const { data: storedMatches, error } = await supabase
        .from('transaction_matches')
        .select('*')
        .eq('reconciliation_id', reconciliationId);

      expect(error).toBeNull();
      expect(storedMatches).toBeDefined();
      expect(storedMatches!.length).toBe(matchingResult.matches.length);

      // Verify stored match data
      storedMatches?.forEach((storedMatch, index) => {
        const originalMatch = matchingResult.matches[index];
        expect(storedMatch.reconciliation_id).toBe(reconciliationId);
        expect(storedMatch.settlement_transaction_id).toBe(originalMatch.settlementTransaction.transactionId);
        expect(storedMatch.internal_transaction_id).toBe(originalMatch.internalTransaction.id);
        expect(storedMatch.match_score).toBe(originalMatch.matchScore);
        expect(storedMatch.match_type).toBe(originalMatch.matchType);
        expect(storedMatch.confidence).toBe(originalMatch.confidence);
        expect(storedMatch.discrepancies).toEqual(originalMatch.discrepancies);
      });
    });
  });

  describe('End-to-End Reconciliation Workflow', () => {
    it('should complete full reconciliation workflow', async () => {
      // Step 1: Create settlement data
      const settlementDate = '2024-01-21';
      const settlement = await service.fetchSettlementData(settlementDate);

      expect(settlement).toBeDefined();
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.totalAmount).toBeGreaterThan(0);

      // Step 2: Create reconciliation record
      const reconciliationId = await service.createReconciliationRecord(settlement.settlementId);

      expect(reconciliationId).toBeDefined();

      // Step 3: Perform transaction matching
      const matchingResult = await service.performTransactionMatching(settlement.settlementId, reconciliationId);

      expect(matchingResult).toBeDefined();
      expect(matchingResult.summary).toBeDefined();

      // Step 4: Update reconciliation record with matching results
      const { error: updateError } = await supabase
        .from('reconciliation_records')
        .update({
          total_settlement_amount: settlement.totalAmount,
          total_internal_amount: matchingResult.summary.totalInternal * 1000, // Convert to KRW
          discrepancy_amount: Math.abs(settlement.totalAmount - (matchingResult.summary.totalInternal * 1000)),
          discrepancy_count: matchingResult.unmatchedSettlement.length + matchingResult.unmatchedInternal.length,
          matched_transactions: matchingResult.summary.exactMatches + matchingResult.summary.fuzzyMatches + matchingResult.summary.manualMatches,
          unmatched_transactions: matchingResult.summary.unmatched,
          status: 'completed',
          completed_by: 'admin_test',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reconciliationId);

      expect(updateError).toBeNull();

      // Step 5: Verify final reconciliation record
      const finalReconciliation = await service.getReconciliationRecord(reconciliationId);

      expect(finalReconciliation!.status).toBe('completed');
      expect(finalReconciliation!.totalSettlementAmount).toBe(settlement.totalAmount);
      expect(finalReconciliation!.matchedTransactions).toBe(matchingResult.summary.exactMatches + matchingResult.summary.fuzzyMatches + matchingResult.summary.manualMatches);
      expect(finalReconciliation!.unmatchedTransactions).toBe(matchingResult.summary.unmatched);
    });

    it('should handle reconciliation with no discrepancies', async () => {
      const settlementDate = '2024-01-22';
      const settlement = await service.fetchSettlementData(settlementDate);

      const reconciliationId = await service.createReconciliationRecord(settlement.settlementId);

      // Perform matching
      const matchingResult = await service.performTransactionMatching(settlement.settlementId, reconciliationId);

      // Update with perfect match
      const { error: updateError } = await supabase
        .from('reconciliation_records')
        .update({
          total_settlement_amount: settlement.totalAmount,
          total_internal_amount: settlement.totalAmount,
          discrepancy_amount: 0,
          discrepancy_count: 0,
          matched_transactions: matchingResult.summary.exactMatches + matchingResult.summary.fuzzyMatches + matchingResult.summary.manualMatches,
          unmatched_transactions: matchingResult.summary.unmatched,
          status: 'completed',
          completed_by: 'admin_test',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reconciliationId);

      expect(updateError).toBeNull();

      const finalReconciliation = await service.getReconciliationRecord(reconciliationId);

      expect(finalReconciliation!.discrepancyAmount).toBe(0);
      expect(finalReconciliation!.discrepancyCount).toBe(0);
      expect(finalReconciliation!.matchedTransactions).toBe(matchingResult.summary.exactMatches + matchingResult.summary.fuzzyMatches + matchingResult.summary.manualMatches);
      expect(finalReconciliation!.unmatchedTransactions).toBe(matchingResult.summary.unmatched);
    });
  });

  describe('Data Consistency and Validation', () => {
    it('should maintain data consistency across related tables', async () => {
      const settlementDate = '2024-01-23';
      const settlement = await service.fetchSettlementData(settlementDate);

      // Verify settlement and transactions are linked correctly
      const { data: transactions, error: transactionError } = await supabase
        .from('settlement_transactions')
        .select('*')
        .eq('settlement_id', settlement.settlementId);

      expect(transactionError).toBeNull();
      expect(transactions).toHaveLength(settlement.totalCount);

      // Verify transaction amounts match settlement totals
      const totalTransactionAmount = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalTransactionFees = transactions?.reduce((sum, t) => sum + t.fees, 0) || 0;
      const totalTransactionNet = transactions?.reduce((sum, t) => sum + t.net_amount, 0) || 0;

      expect(totalTransactionAmount).toBe(settlement.totalAmount);
      expect(totalTransactionFees).toBe(settlement.fees);
      expect(totalTransactionNet).toBe(settlement.netAmount);
    });

    it('should validate transaction status distribution', async () => {
      const settlementDate = '2024-01-24';
      const settlement = await service.fetchSettlementData(settlementDate);

      const { data: transactions } = await supabase
        .from('settlement_transactions')
        .select('status')
        .eq('settlement_id', settlement.settlementId);

      const statusCounts = transactions?.reduce((counts, t) => {
        counts[t.status] = (counts[t.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>) || {};

      // Verify realistic status distribution
      expect(statusCounts.success || 0).toBeGreaterThan(settlement.totalCount * 0.8); // 80%+ success
      expect(statusCounts.failed || 0).toBeLessThan(settlement.totalCount * 0.2); // <20% failed
    });

    it('should validate payment method distribution', async () => {
      const settlementDate = '2024-01-25';
      const settlement = await service.fetchSettlementData(settlementDate);

      const { data: transactions } = await supabase
        .from('settlement_transactions')
        .select('payment_method')
        .eq('settlement_id', settlement.settlementId);

      const methodCounts = transactions?.reduce((counts, t) => {
        counts[t.payment_method] = (counts[t.payment_method] || 0) + 1;
        return counts;
      }, {} as Record<string, number>) || {};

      // Verify realistic payment method distribution
      expect(methodCounts.card || 0).toBeGreaterThan(settlement.totalCount * 0.7); // 70%+ card
      expect(methodCounts.bank_transfer || 0).toBeLessThan(settlement.totalCount * 0.4); // <40% bank transfer
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid date formats gracefully', async () => {
      const invalidDate = 'invalid-date';
      
      await expect(service.fetchSettlementData(invalidDate)).rejects.toThrow();
    });

    it('should handle non-existent settlement data retrieval', async () => {
      const nonExistentId = 'settlement_non_existent';
      
      const result = await service.getSettlementDataById(nonExistentId);
      
      expect(result).toBeNull();
    });

    it('should handle non-existent reconciliation record retrieval', async () => {
      const nonExistentId = 'reconciliation_non_existent';
      
      const result = await service.getReconciliationRecord(nonExistentId);
      
      expect(result).toBeNull();
    });

    it('should handle empty date ranges', async () => {
      const startDate = '2024-12-01';
      const endDate = '2024-12-31';

      const settlements = await service.getSettlementData(startDate, endDate);
      const reconciliations = await service.getReconciliationRecords(startDate, endDate);

      expect(settlements).toHaveLength(0);
      expect(reconciliations).toHaveLength(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large settlement data efficiently', async () => {
      const startTime = Date.now();
      
      // Create settlement with many transactions
      const settlement = await service.fetchSettlementData('2024-01-26');
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(settlement.totalCount).toBeGreaterThan(10);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent reconciliation operations', async () => {
      const promises = [
        service.fetchSettlementData('2024-01-27'),
        service.fetchSettlementData('2024-01-28'),
        service.fetchSettlementData('2024-01-29')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.settlementId).toBeDefined();
        expect(result.totalAmount).toBeGreaterThan(0);
      });
    });
  });

  describe('Discrepancy Detection and Resolution Integration', () => {
    it('should detect and resolve discrepancies in real reconciliation', async () => {
      // Create test data
      const testUser = await createTestUser();
      const testShop = await createTestShop(testUser.id);
      const testService = await createTestService(testShop.id);
      const testReservation = await createTestReservation(testUser.id, testService.id);

      // Create settlement data with extra transaction
      const settlementData = {
        settlementId: 'settlement_test_3',
        settlementDate: '2024-01-15',
        totalAmount: 200000,
        totalCount: 2,
        fees: 5800,
        netAmount: 194200,
        currency: 'KRW',
        status: 'completed' as const,
        transactions: [
          {
            transactionId: 'txn_test_3_1',
            paymentId: testReservation.payment_id,
            amount: 100000,
            fees: 2900,
            netAmount: 97100,
            status: 'success' as const,
            paymentMethod: 'card',
            processedAt: '2024-01-15T09:30:00Z',
            metadata: {}
          },
          {
            transactionId: 'txn_test_3_2',
            paymentId: 'payment_extra',
            amount: 100000,
            fees: 2900,
            netAmount: 97100,
            status: 'success' as const,
            paymentMethod: 'card',
            processedAt: '2024-01-15T09:35:00Z',
            metadata: {}
          }
        ],
        metadata: {},
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      // Store settlement data
      await service.storeSettlementData(settlementData);

      // Create reconciliation record
      const reconciliation = await service.createReconciliationRecord(
        'settlement_test_3',
        '2024-01-15',
        'Test reconciliation with discrepancies'
      );

      // Perform matching
      const matchingResult = await service.performTransactionMatching(
        'settlement_test_3',
        reconciliation.id
      );

      // Verify matching results
      expect(matchingResult.matches).toHaveLength(1);
      expect(matchingResult.unmatchedSettlement).toHaveLength(1);
      expect(matchingResult.unmatchedInternal).toHaveLength(0);
      expect(matchingResult.summary.matchRate).toBe(50);

      // Detect discrepancies
      const discrepancies = await service.detectDiscrepancies(
        reconciliation.id,
        matchingResult.unmatchedSettlement,
        matchingResult.unmatchedInternal
      );

      // Verify discrepancies
      expect(discrepancies).toHaveLength(1);
      expect(discrepancies[0].type).toBe('missing_transaction');
      expect(discrepancies[0].severity).toBe('high');
      expect(discrepancies[0].status).toBe('open');

      // Get discrepancies
      const storedDiscrepancies = await service.getDiscrepancies(reconciliation.id);
      expect(storedDiscrepancies).toHaveLength(1);
      expect(storedDiscrepancies[0].id).toBe(discrepancies[0].id);

      // Get discrepancy statistics
      const stats = await service.getDiscrepancyStatistics(reconciliation.id);
      expect(stats.total).toBe(1);
      expect(stats.byType.missing_transaction).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.byStatus.open).toBe(1);
      expect(stats.openCount).toBe(1);

      // Resolve discrepancy
      await service.resolveDiscrepancy(
        discrepancies[0].id,
        'Test resolution: Extra settlement transaction found',
        'admin_test'
      );

      // Verify resolution
      const resolvedDiscrepancies = await service.getDiscrepancies(reconciliation.id);
      expect(resolvedDiscrepancies[0].status).toBe('resolved');
      expect(resolvedDiscrepancies[0].resolution).toBe('Test resolution: Extra settlement transaction found');
      expect(resolvedDiscrepancies[0].resolvedBy).toBe('admin_test');
      expect(resolvedDiscrepancies[0].resolvedAt).toBeDefined();

      // Clean up
      await cleanupTestData(testUser.id, testShop.id, testService.id, testReservation.id);
    });

    it('should auto-resolve discrepancies based on business rules', async () => {
      // Create test data
      const testUser = await createTestUser();
      const testShop = await createTestShop(testUser.id);
      const testService = await createTestService(testShop.id);
      const testReservation = await createTestReservation(testUser.id, testService.id);

      // Create settlement data with amount mismatch
      const settlementData = {
        settlementId: 'settlement_test_4',
        settlementDate: '2024-01-15',
        totalAmount: 100050,
        totalCount: 1,
        fees: 2900,
        netAmount: 97150,
        currency: 'KRW',
        status: 'completed' as const,
        transactions: [{
          transactionId: 'txn_test_4',
          paymentId: testReservation.payment_id,
          amount: 100050,
          fees: 2900,
          netAmount: 97150,
          status: 'success' as const,
          paymentMethod: 'card',
          processedAt: '2024-01-15T09:30:00Z',
          metadata: {}
        }],
        metadata: {},
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      // Store settlement data
      await service.storeSettlementData(settlementData);

      // Create reconciliation record
      const reconciliation = await service.createReconciliationRecord(
        'settlement_test_4',
        '2024-01-15',
        'Test reconciliation with auto-resolvable discrepancies'
      );

      // Perform matching
      const matchingResult = await service.performTransactionMatching(
        'settlement_test_4',
        reconciliation.id
      );

      // Verify matching results
      expect(matchingResult.matches).toHaveLength(1);
      expect(matchingResult.unmatchedSettlement).toHaveLength(0);
      expect(matchingResult.unmatchedInternal).toHaveLength(0);
      expect(matchingResult.summary.matchRate).toBe(100);

      // Detect discrepancies
      const discrepancies = await service.detectDiscrepancies(
        reconciliation.id,
        matchingResult.unmatchedSettlement,
        matchingResult.unmatchedInternal
      );

      // Verify discrepancies
      expect(discrepancies).toHaveLength(1);
      expect(discrepancies[0].type).toBe('amount_mismatch');
      expect(discrepancies[0].severity).toBe('low');
      expect(discrepancies[0].status).toBe('open');

      // Auto-resolve discrepancies
      const autoResolution = await service.autoResolveDiscrepancies(reconciliation.id);

      // Verify auto-resolution
      expect(autoResolution.resolved).toBe(1);
      expect(autoResolution.ignored).toBe(0);
      expect(autoResolution.remaining).toBe(0);

      // Verify resolution
      const resolvedDiscrepancies = await service.getDiscrepancies(reconciliation.id);
      expect(resolvedDiscrepancies[0].status).toBe('resolved');
      expect(resolvedDiscrepancies[0].resolution).toContain('Auto-resolved: Small amount difference');
      expect(resolvedDiscrepancies[0].resolvedBy).toBe('system');

      // Clean up
      await cleanupTestData(testUser.id, testShop.id, testService.id, testReservation.id);
    });

    it('should complete full reconciliation workflow with discrepancies', async () => {
      // Create test data
      const testUser = await createTestUser();
      const testShop = await createTestShop(testUser.id);
      const testService = await createTestService(testShop.id);
      const testReservation = await createTestReservation(testUser.id, testService.id);

      // Create settlement data with discrepancies
      const settlementData = {
        settlementId: 'settlement_test_5',
        settlementDate: '2024-01-15',
        totalAmount: 200000,
        totalCount: 2,
        fees: 5800,
        netAmount: 194200,
        currency: 'KRW',
        status: 'completed' as const,
        transactions: [
          {
            transactionId: 'txn_test_5_1',
            paymentId: testReservation.payment_id,
            amount: 100000,
            fees: 2900,
            netAmount: 97100,
            status: 'success' as const,
            paymentMethod: 'card',
            processedAt: '2024-01-15T09:30:00Z',
            metadata: {}
          },
          {
            transactionId: 'txn_test_5_2',
            paymentId: 'payment_extra',
            amount: 100000,
            fees: 2900,
            netAmount: 97100,
            status: 'success' as const,
            paymentMethod: 'card',
            processedAt: '2024-01-15T09:35:00Z',
            metadata: {}
          }
        ],
        metadata: {},
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      // Store settlement data
      await service.storeSettlementData(settlementData);

      // Create reconciliation record
      const reconciliation = await service.createReconciliationRecord(
        'settlement_test_5',
        '2024-01-15',
        'Test full reconciliation workflow with discrepancies'
      );

      // Complete reconciliation
      const result = await service.completeReconciliation(
        reconciliation.id,
        'admin_test',
        true // auto-resolve
      );

      // Verify reconciliation completion
      expect(result.reconciliation).toBeDefined();
      expect(result.discrepancies).toBeDefined();
      expect(result.autoResolution).toBeDefined();

      // Verify reconciliation record was updated
      const updatedReconciliation = await service.getReconciliationRecord(reconciliation.id);
      expect(updatedReconciliation.status).toBe('completed');

      // Verify discrepancies were detected
      expect(result.discrepancies.length).toBeGreaterThan(0);

      // Verify auto-resolution
      expect(result.autoResolution.resolved).toBeGreaterThanOrEqual(0);
      expect(result.autoResolution.ignored).toBeGreaterThanOrEqual(0);
      expect(result.autoResolution.remaining).toBeGreaterThanOrEqual(0);

      // Clean up
      await cleanupTestData(testUser.id, testShop.id, testService.id, testReservation.id);
    });
  });
});
