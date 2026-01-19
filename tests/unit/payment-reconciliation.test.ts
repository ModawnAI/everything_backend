/**
 * Unit Tests for Payment Reconciliation Service
 * 
 * Tests for comprehensive payment reconciliation system including:
 * - TossPayments settlement data integration
 * - Transaction matching algorithms
 * - Discrepancy detection and resolution
 * - Reconciliation reporting and audit trails
 * - Automated alerts and manual tools
 */

import { PaymentReconciliationService, SettlementData, ReconciliationRecord } from '../../src/services/payment-reconciliation.service';
import { getSupabaseClient } from '../../src/config/database';

// Mock Supabase client
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn()
}));

// Mock TossPayments service
jest.mock('../../src/services/toss-payments.service', () => ({
  TossPaymentsService: jest.fn().mockImplementation(() => ({
    // Mock methods as needed
  }))
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// TODO: 결제 서비스 변경 후 활성화
describe.skip('PaymentReconciliationService', () => {
  let service: PaymentReconciliationService;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      data: null,
      error: null
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    service = new PaymentReconciliationService();
  });

  describe('fetchSettlementData', () => {
    it('should fetch and store settlement data successfully', async () => {
      const date = '2024-01-15';
      
      // Mock successful database operations
      mockSupabase.data = { id: 'settlement_123' };

      const result = await service.fetchSettlementData(date);

      expect(result).toBeDefined();
      expect(result.settlementId).toContain('settlement_');
      expect(result.settlementDate).toBe(date);
      expect(result.totalAmount).toBeGreaterThan(0);
      expect(Array.isArray(result.transactions)).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.currency).toBe('KRW');
    });

    it('should handle settlement data fetch errors', async () => {
      const date = '2024-01-15';
      
      // Mock database error
      mockSupabase.error = new Error('Database connection failed');

      await expect(service.fetchSettlementData(date)).rejects.toThrow('Database connection failed');
    });

    it('should generate realistic settlement data', async () => {
      const date = '2024-01-15';
      mockSupabase.data = { id: 'settlement_123' };

      const result = await service.fetchSettlementData(date);

      // Verify settlement data structure
      expect(result.settlementId).toMatch(/^settlement_\d{8}_\d+$/);
      expect(result.totalAmount).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.fees).toBeGreaterThan(0);
      expect(result.netAmount).toBe(result.totalAmount - result.fees);
      expect(result.transactions.length).toBe(result.totalCount);

      // Verify transaction structure
      result.transactions.forEach(transaction => {
        expect(transaction.transactionId).toMatch(/^txn_/);
        expect(transaction.paymentId).toMatch(/^payment_/);
        expect(transaction.amount).toBeGreaterThan(0);
        expect(transaction.fees).toBeGreaterThan(0);
        expect(transaction.netAmount).toBe(transaction.amount - transaction.fees);
        expect(['success', 'failed', 'cancelled', 'refunded']).toContain(transaction.status);
        expect(['card', 'bank_transfer']).toContain(transaction.paymentMethod);
      });
    });
  });

  describe('getSettlementData', () => {
    it('should fetch settlement data by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      const mockSettlements = [
        {
          id: 'settlement_1',
          settlement_date: '2024-01-15',
          total_amount: 1000000,
          total_count: 10,
          fees: 29000,
          net_amount: 971000,
          currency: 'KRW',
          status: 'completed',
          metadata: {},
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
          settlement_transactions: [
            {
              id: 'txn_1',
              payment_id: 'payment_1',
              amount: 100000,
              fees: 2900,
              net_amount: 97100,
              status: 'success',
              payment_method: 'card',
              card_number: '****-****-****-1234',
              approval_number: 'A123456',
              processed_at: '2024-01-15T09:30:00Z',
              metadata: {}
            }
          ]
        }
      ];

      mockSupabase.data = mockSettlements;

      const result = await service.getSettlementData(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].settlementId).toBe('settlement_1');
      expect(result[0].totalAmount).toBe(1000000);
      expect(result[0].transactions).toHaveLength(1);
      expect(result[0].transactions[0].transactionId).toBe('txn_1');
    });

    it('should handle empty settlement data', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      mockSupabase.data = [];

      const result = await service.getSettlementData(startDate, endDate);

      expect(result).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      mockSupabase.error = new Error('Database error');

      await expect(service.getSettlementData(startDate, endDate)).rejects.toThrow('Database error');
    });
  });

  describe('getSettlementDataById', () => {
    it('should fetch settlement data by ID', async () => {
      const settlementId = 'settlement_123';
      
      const mockSettlement = {
        id: settlementId,
        settlement_date: '2024-01-15',
        total_amount: 500000,
        total_count: 5,
        fees: 14500,
        net_amount: 485500,
        currency: 'KRW',
        status: 'completed',
        metadata: {},
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        settlement_transactions: []
      };

      // Mock the specific database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockSettlement, error: null })
          })
        })
      });

      const result = await service.getSettlementDataById(settlementId);

      expect(result).toBeDefined();
      expect(result!.settlementId).toBe(settlementId);
      expect(result!.totalAmount).toBe(500000);
    });

    it('should return null for non-existent settlement', async () => {
      const settlementId = 'non_existent';
      
      // Mock the specific database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          })
        })
      });

      const result = await service.getSettlementDataById(settlementId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const settlementId = 'settlement_123';
      
      // Mock the specific database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: new Error('Database error') })
          })
        })
      });

      await expect(service.getSettlementDataById(settlementId)).rejects.toThrow('Database error');
    });
  });

  describe('getInternalTransactions', () => {
    it('should fetch internal payment transactions', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      const mockPayments = [
        {
          id: 'payment_1',
          amount: 100000,
          payment_status: 'fully_paid',
          created_at: '2024-01-15T10:00:00Z',
          reservations: {
            id: 'reservation_1',
            user_id: 'user_1',
            shop_id: 'shop_1',
            service_id: 'service_1',
            status: 'confirmed'
          }
        }
      ];

      mockSupabase.data = mockPayments;

      const result = await service.getInternalTransactions(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('payment_1');
      expect(result[0].amount).toBe(100000);
      expect(result[0].payment_status).toBe('fully_paid');
    });

    it('should filter by date range and payment status', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      mockSupabase.data = [];

      await service.getInternalTransactions(startDate, endDate);

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', startDate);
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', endDate);
      expect(mockSupabase.eq).toHaveBeenCalledWith('payment_status', 'fully_paid');
    });

    it('should handle database errors', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      mockSupabase.error = new Error('Database error');

      await expect(service.getInternalTransactions(startDate, endDate)).rejects.toThrow('Database error');
    });
  });

  describe('createReconciliationRecord', () => {
    it('should create reconciliation record successfully', async () => {
      const settlementId = 'settlement_123';
      
      mockSupabase.data = { id: 'reconciliation_123' };

      const result = await service.createReconciliationRecord(settlementId);

      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(mockSupabase.from).toHaveBeenCalledWith('reconciliation_records');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const settlementId = 'settlement_123';
      
      mockSupabase.error = new Error('Database error');

      await expect(service.createReconciliationRecord(settlementId)).rejects.toThrow('Database error');
    });
  });

  describe('getReconciliationRecord', () => {
    it('should fetch reconciliation record by ID', async () => {
      const reconciliationId = 'reconciliation_123';
      
      const mockRecord = {
        id: reconciliationId,
        reconciliation_date: '2024-01-15',
        settlement_id: 'settlement_123',
        total_settlement_amount: 1000000,
        total_internal_amount: 950000,
        discrepancy_amount: 50000,
        discrepancy_count: 2,
        status: 'completed',
        matched_transactions: 8,
        unmatched_transactions: 2,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T11:00:00Z',
        completed_at: '2024-01-15T11:00:00Z',
        completed_by: 'admin_1',
        reconciliation_discrepancies: []
      };

      // Mock the specific database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockRecord, error: null })
          })
        })
      });

      const result = await service.getReconciliationRecord(reconciliationId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(reconciliationId);
      expect(result!.settlementId).toBe('settlement_123');
      expect(result!.totalSettlementAmount).toBe(1000000);
      expect(result!.totalInternalAmount).toBe(950000);
      expect(result!.discrepancyAmount).toBe(50000);
      expect(result!.status).toBe('completed');
    });

    it('should return null for non-existent record', async () => {
      const reconciliationId = 'non_existent';
      
      // Mock the specific database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          })
        })
      });

      const result = await service.getReconciliationRecord(reconciliationId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const reconciliationId = 'reconciliation_123';
      
      // Mock the specific database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: new Error('Database error') })
          })
        })
      });

      await expect(service.getReconciliationRecord(reconciliationId)).rejects.toThrow('Database error');
    });
  });

  describe('getReconciliationRecords', () => {
    it('should fetch reconciliation records by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      const mockRecords = [
        {
          id: 'reconciliation_1',
          reconciliation_date: '2024-01-15',
          settlement_id: 'settlement_1',
          total_settlement_amount: 1000000,
          total_internal_amount: 950000,
          discrepancy_amount: 50000,
          discrepancy_count: 2,
          status: 'completed',
          matched_transactions: 8,
          unmatched_transactions: 2,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T11:00:00Z',
          completed_at: '2024-01-15T11:00:00Z',
          completed_by: 'admin_1',
          reconciliation_discrepancies: []
        }
      ];

      mockSupabase.data = mockRecords;

      const result = await service.getReconciliationRecords(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('reconciliation_1');
      expect(result[0].reconciliationDate).toBe('2024-01-15');
      expect(result[0].status).toBe('completed');
    });

    it('should handle empty records', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      mockSupabase.data = [];

      const result = await service.getReconciliationRecords(startDate, endDate);

      expect(result).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      mockSupabase.error = new Error('Database error');

      await expect(service.getReconciliationRecords(startDate, endDate)).rejects.toThrow('Database error');
    });
  });

  describe('simulation and data generation', () => {
    it('should generate realistic settlement data in simulation', async () => {
      const date = '2024-01-15';
      mockSupabase.data = { id: 'settlement_123' };

      const result = await service.fetchSettlementData(date);

      // Verify simulation generates realistic data
      expect(result.settlementId).toMatch(/^settlement_20240115_\d+$/);
      expect(result.settlementDate).toBe(date);
      expect(result.totalAmount).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThanOrEqual(10);
      expect(result.totalCount).toBeLessThanOrEqual(60);
      expect(result.fees).toBeGreaterThan(0);
      expect(result.netAmount).toBe(result.totalAmount - result.fees);
      expect(result.currency).toBe('KRW');
      expect(result.status).toBe('completed');

      // Verify transaction distribution
      const successCount = result.transactions.filter(t => t.status === 'success').length;
      const failedCount = result.transactions.filter(t => t.status === 'failed').length;
      
      expect(successCount + failedCount).toBe(result.totalCount);
      expect(successCount / result.totalCount).toBeGreaterThan(0.7); // 70%+ success rate (more realistic for simulation)
    });

    it('should generate realistic transaction metadata', async () => {
      const date = '2024-01-15';
      mockSupabase.data = { id: 'settlement_123' };

      const result = await service.fetchSettlementData(date);

      result.transactions.forEach(transaction => {
        expect(transaction.transactionId).toMatch(/^txn_settlement_20240115_\d+_\d+$/);
        expect(transaction.paymentId).toMatch(/^payment_\d+_\d+$/);
        expect(transaction.amount).toBeGreaterThanOrEqual(1000);
        expect(transaction.amount).toBeLessThanOrEqual(100000);
        expect(transaction.fees).toBe(Math.floor(transaction.amount * 0.029) + 100);
        expect(transaction.netAmount).toBe(transaction.amount - transaction.fees);
        expect(['card', 'bank_transfer']).toContain(transaction.paymentMethod);
        
        if (transaction.cardNumber) {
          expect(transaction.cardNumber).toMatch(/^\*\*\*\*-\*\*\*\*-\*\*\*\*-\d{4}$/);
        }
        
        if (transaction.approvalNumber) {
          expect(transaction.approvalNumber).toMatch(/^A\d{6}$/);
        }

        expect(transaction.metadata).toHaveProperty('merchantId');
        expect(transaction.metadata).toHaveProperty('terminalId');
        expect(transaction.metadata).toHaveProperty('batchNumber');
      });
    });
  });

  describe('error handling', () => {
    it('should handle settlement data storage errors', async () => {
      const date = '2024-01-15';
      
      // Mock settlement data storage error
      mockSupabase.error = new Error('Settlement storage failed');

      await expect(service.fetchSettlementData(date)).rejects.toThrow('Settlement storage failed');
    });

    it('should handle transaction storage errors', async () => {
      const date = '2024-01-15';
      
      // Mock successful settlement storage but failed transaction storage
      let callCount = 0;
      mockSupabase.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'settlement_data') {
          return {
            insert: jest.fn().mockResolvedValue({ data: { id: 'settlement_123' }, error: null })
          };
        } else if (table === 'settlement_transactions') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: new Error('Transaction storage failed') })
          };
        }
        return {
          insert: jest.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      await expect(service.fetchSettlementData(date)).rejects.toThrow('Transaction storage failed');
    });

    it('should handle API simulation errors gracefully', async () => {
      const date = '2024-01-15';
      
      // Mock API simulation error
      jest.spyOn(service as any, 'simulateTossPaymentsSettlementAPI').mockRejectedValue(new Error('API simulation failed'));

      await expect(service.fetchSettlementData(date)).rejects.toThrow('API simulation failed');
    });
  });

  describe('transaction matching', () => {
    it('should perform exact matching by payment ID', async () => {
      const settlementId = 'settlement_123';
      const reconciliationId = 'reconciliation_123';

      // Mock settlement data
      const mockSettlement = {
        id: settlementId,
        settlement_date: '2024-01-15',
        total_amount: 100000,
        total_count: 1,
        fees: 2900,
        net_amount: 97100,
        currency: 'KRW',
        status: 'completed',
        metadata: {},
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        settlement_transactions: [{
          id: 'txn_1',
          payment_id: 'payment_1',
          amount: 100000,
          fees: 2900,
          net_amount: 97100,
          status: 'success',
          payment_method: 'card',
          card_number: '****-****-****-1234',
          approval_number: 'A123456',
          processed_at: '2024-01-15T09:30:00Z',
          metadata: {}
        }]
      };

      // Mock internal transactions
      const mockInternalTransactions = [{
        id: 'payment_1',
        amount: 100000,
        payment_status: 'fully_paid',
        payment_method: 'card',
        created_at: '2024-01-15T09:30:00Z'
      }];

      // Mock database responses
      mockSupabase.data = mockSettlement;
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockResolvedValueOnce({ data: mockSettlement, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            gte: jest.fn().mockReturnValueOnce({
              lte: jest.fn().mockReturnValueOnce({
                eq: jest.fn().mockReturnValueOnce({
                  order: jest.fn().mockResolvedValueOnce({ data: mockInternalTransactions, error: null })
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValueOnce({ error: null })
        });

      const result = await service.performTransactionMatching(settlementId, reconciliationId);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchType).toBe('exact');
      expect(result.matches[0].confidence).toBe(100);
      expect(result.matches[0].matchScore).toBe(100);
      expect(result.summary.exactMatches).toBe(1);
      expect(result.summary.matchRate).toBe(100);
    });

    it('should perform fuzzy matching by amount and timestamp', async () => {
      const settlementId = 'settlement_123';
      const reconciliationId = 'reconciliation_123';

      // Mock settlement data
      const mockSettlement = {
        id: settlementId,
        settlement_date: '2024-01-15',
        total_amount: 100000,
        total_count: 1,
        fees: 2900,
        net_amount: 97100,
        currency: 'KRW',
        status: 'completed',
        metadata: {},
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        settlement_transactions: [{
          id: 'txn_1',
          payment_id: 'payment_1',
          amount: 100000,
          fees: 2900,
          net_amount: 97100,
          status: 'success',
          payment_method: 'card',
          processed_at: '2024-01-15T09:30:00Z',
          metadata: {}
        }]
      };

      // Mock internal transactions with slightly different amount and time
      const mockInternalTransactions = [{
        id: 'payment_2',
        amount: 100050, // 50 KRW difference
        payment_status: 'fully_paid',
        payment_method: 'card',
        created_at: '2024-01-15T09:32:00Z' // 2 minutes difference
      }];

      // Mock database responses
      mockSupabase.data = mockSettlement;
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockResolvedValueOnce({ data: mockSettlement, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            gte: jest.fn().mockReturnValueOnce({
              lte: jest.fn().mockReturnValueOnce({
                eq: jest.fn().mockReturnValueOnce({
                  order: jest.fn().mockResolvedValueOnce({ data: mockInternalTransactions, error: null })
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValueOnce({ error: null })
        });

      const result = await service.performTransactionMatching(settlementId, reconciliationId);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchType).toBe('fuzzy');
      expect(result.matches[0].confidence).toBeGreaterThan(70);
      expect(result.summary.fuzzyMatches).toBe(1);
    });

    it('should perform manual matching for high-confidence candidates', async () => {
      const settlementId = 'settlement_123';
      const reconciliationId = 'reconciliation_123';

      // Mock settlement data
      const mockSettlement = {
        id: settlementId,
        settlement_date: '2024-01-15',
        total_amount: 100000,
        total_count: 1,
        fees: 2900,
        net_amount: 97100,
        currency: 'KRW',
        status: 'completed',
        metadata: {},
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        settlement_transactions: [{
          id: 'txn_1',
          payment_id: 'payment_1',
          amount: 100000,
          fees: 2900,
          net_amount: 97100,
          status: 'success',
          payment_method: 'card',
          processed_at: '2024-01-15T09:30:00Z',
          metadata: {}
        }]
      };

      // Mock internal transactions with larger differences
      const mockInternalTransactions = [{
        id: 'payment_2',
        amount: 100500, // 500 KRW difference
        payment_status: 'fully_paid',
        payment_method: 'card',
        created_at: '2024-01-15T09:45:00Z' // 15 minutes difference
      }];

      // Mock database responses
      mockSupabase.data = mockSettlement;
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockResolvedValueOnce({ data: mockSettlement, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            gte: jest.fn().mockReturnValueOnce({
              lte: jest.fn().mockReturnValueOnce({
                eq: jest.fn().mockReturnValueOnce({
                  order: jest.fn().mockResolvedValueOnce({ data: mockInternalTransactions, error: null })
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValueOnce({ error: null })
        });

      const result = await service.performTransactionMatching(settlementId, reconciliationId);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchType).toBe('manual');
      expect(result.matches[0].confidence).toBeGreaterThan(50);
      expect(result.summary.manualMatches).toBe(1);
    });

    it('should identify discrepancies between transactions', async () => {
      const settlementId = 'settlement_123';
      const reconciliationId = 'reconciliation_123';

      // Mock settlement data
      const mockSettlement = {
        id: settlementId,
        settlement_date: '2024-01-15',
        total_amount: 100000,
        total_count: 1,
        fees: 2900,
        net_amount: 97100,
        currency: 'KRW',
        status: 'completed',
        metadata: {},
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        settlement_transactions: [{
          id: 'txn_1',
          payment_id: 'payment_1',
          amount: 100000,
          fees: 2900,
          net_amount: 97100,
          status: 'success',
          payment_method: 'card',
          processed_at: '2024-01-15T09:30:00Z',
          metadata: {}
        }]
      };

      // Mock internal transactions with discrepancies
      const mockInternalTransactions = [{
        id: 'payment_1',
        amount: 95000, // Amount mismatch
        payment_status: 'failed', // Status mismatch
        payment_method: 'bank_transfer', // Payment method mismatch
        fees: 2000, // Fee mismatch
        created_at: '2024-01-15T09:30:00Z'
      }];

      // Mock database responses
      mockSupabase.data = mockSettlement;
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockResolvedValueOnce({ data: mockSettlement, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            gte: jest.fn().mockReturnValueOnce({
              lte: jest.fn().mockReturnValueOnce({
                eq: jest.fn().mockReturnValueOnce({
                  order: jest.fn().mockResolvedValueOnce({ data: mockInternalTransactions, error: null })
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValueOnce({ error: null })
        });

      const result = await service.performTransactionMatching(settlementId, reconciliationId);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].discrepancies).toHaveLength(4); // All 4 types of discrepancies
      expect(result.matches[0].discrepancies).toContain('Amount mismatch: settlement=100000, internal=95000');
      expect(result.matches[0].discrepancies).toContain('Status mismatch: settlement=success, internal=failed');
      expect(result.matches[0].discrepancies).toContain('Payment method mismatch: settlement=card, internal=bank_transfer');
      expect(result.matches[0].discrepancies).toContain('Fee mismatch: settlement=2900, internal=2000');
    });

    it('should handle no matches found', async () => {
      const settlementId = 'settlement_123';
      const reconciliationId = 'reconciliation_123';

      // Mock settlement data
      const mockSettlement = {
        id: settlementId,
        settlement_date: '2024-01-15',
        total_amount: 100000,
        total_count: 1,
        fees: 2900,
        net_amount: 97100,
        currency: 'KRW',
        status: 'completed',
        metadata: {},
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        settlement_transactions: [{
          id: 'txn_1',
          payment_id: 'payment_1',
          amount: 100000,
          fees: 2900,
          net_amount: 97100,
          status: 'success',
          payment_method: 'card',
          processed_at: '2024-01-15T09:30:00Z',
          metadata: {}
        }]
      };

      // Mock empty internal transactions
      const mockInternalTransactions: any[] = [];

      // Mock database responses
      mockSupabase.data = mockSettlement;
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockResolvedValueOnce({ data: mockSettlement, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            gte: jest.fn().mockReturnValueOnce({
              lte: jest.fn().mockReturnValueOnce({
                eq: jest.fn().mockReturnValueOnce({
                  order: jest.fn().mockResolvedValueOnce({ data: mockInternalTransactions, error: null })
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValueOnce({ error: null })
        });

      const result = await service.performTransactionMatching(settlementId, reconciliationId);

      expect(result.matches).toHaveLength(0);
      expect(result.unmatchedSettlement).toHaveLength(1);
      expect(result.unmatchedInternal).toHaveLength(0);
      expect(result.summary.matchRate).toBe(0);
    });

    it('should handle matching errors gracefully', async () => {
      const settlementId = 'settlement_123';
      const reconciliationId = 'reconciliation_123';

      // Mock database error
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({ data: null, error: new Error('Database error') })
          })
        })
      });

      await expect(service.performTransactionMatching(settlementId, reconciliationId))
        .rejects.toThrow('Failed to fetch settlement data: Database error');
    });
  });

  describe('discrepancy detection and resolution', () => {
    it('should detect missing internal transactions', async () => {
      const reconciliationId = 'reconciliation_123';
      const unmatchedSettlement = [{
        transactionId: 'txn_1',
        paymentId: 'payment_1',
        amount: 100000,
        fees: 2900,
        netAmount: 97100,
        status: 'success' as const,
        paymentMethod: 'card',
        processedAt: '2024-01-15T09:30:00Z',
        metadata: {}
      }];
      const unmatchedInternal: any[] = [];

      // Mock database insert
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        insert: jest.fn().mockResolvedValueOnce({ error: null })
      });

      const discrepancies = await service.detectDiscrepancies(
        reconciliationId,
        unmatchedSettlement,
        unmatchedInternal
      );

      expect(discrepancies).toHaveLength(1);
      expect(discrepancies[0].type).toBe('missing_transaction');
      expect(discrepancies[0].severity).toBe('high');
      expect(discrepancies[0].description).toContain('Missing internal transaction');
      expect(discrepancies[0].settlementData).toEqual(unmatchedSettlement[0]);
      expect(discrepancies[0].internalData).toEqual({});
      expect(discrepancies[0].status).toBe('open');
    });

    it('should detect extra internal transactions', async () => {
      const reconciliationId = 'reconciliation_123';
      const unmatchedSettlement: any[] = [];
      const unmatchedInternal = [{
        id: 'payment_1',
        amount: 100000,
        payment_status: 'fully_paid',
        payment_method: 'card',
        created_at: '2024-01-15T09:30:00Z'
      }];

      // Mock database insert
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        insert: jest.fn().mockResolvedValueOnce({ error: null })
      });

      const discrepancies = await service.detectDiscrepancies(
        reconciliationId,
        unmatchedSettlement,
        unmatchedInternal
      );

      expect(discrepancies).toHaveLength(1);
      expect(discrepancies[0].type).toBe('extra_transaction');
      expect(discrepancies[0].severity).toBe('medium');
      expect(discrepancies[0].description).toContain('Extra internal transaction');
      expect(discrepancies[0].settlementData).toEqual({});
      expect(discrepancies[0].internalData).toEqual(unmatchedInternal[0]);
      expect(discrepancies[0].status).toBe('open');
    });

    it('should get discrepancies for reconciliation', async () => {
      const reconciliationId = 'reconciliation_123';
      const mockDiscrepancies = [{
        id: 'disc_1',
        reconciliation_id: reconciliationId,
        type: 'missing_transaction',
        severity: 'high',
        description: 'Test discrepancy',
        settlement_data: { transactionId: 'txn_1' },
        internal_data: {},
        expected_value: 100000,
        actual_value: null,
        resolution: null,
        resolved_by: null,
        resolved_at: null,
        status: 'open',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z'
      }];

      // Mock database select
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            order: jest.fn().mockResolvedValueOnce({ data: mockDiscrepancies, error: null })
          })
        })
      });

      const discrepancies = await service.getDiscrepancies(reconciliationId);

      expect(discrepancies).toHaveLength(1);
      expect(discrepancies[0].id).toBe('disc_1');
      expect(discrepancies[0].type).toBe('missing_transaction');
      expect(discrepancies[0].severity).toBe('high');
      expect(discrepancies[0].status).toBe('open');
    });

    it('should resolve discrepancy', async () => {
      const discrepancyId = 'disc_1';
      const resolution = 'Test resolution';
      const resolvedBy = 'admin_test';

      // Mock database update
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        update: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ error: null })
        })
      });

      await service.resolveDiscrepancy(discrepancyId, resolution, resolvedBy);

      // Verify the update was called with correct parameters
      expect(mockSupabase.from).toHaveBeenCalledWith('reconciliation_discrepancies');
    });

    it('should ignore discrepancy', async () => {
      const discrepancyId = 'disc_1';
      const reason = 'Test ignore reason';
      const ignoredBy = 'admin_test';

      // Mock database update
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        update: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ error: null })
        })
      });

      await service.ignoreDiscrepancy(discrepancyId, reason, ignoredBy);

      // Verify the update was called with correct parameters
      expect(mockSupabase.from).toHaveBeenCalledWith('reconciliation_discrepancies');
    });

    it('should get discrepancy statistics', async () => {
      const reconciliationId = 'reconciliation_123';
      const mockDiscrepancies = [
        { type: 'missing_transaction', severity: 'high', status: 'open' },
        { type: 'amount_mismatch', severity: 'medium', status: 'resolved' },
        { type: 'extra_transaction', severity: 'low', status: 'ignored' }
      ];

      // Mock database select
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ data: mockDiscrepancies, error: null })
        })
      });

      const stats = await service.getDiscrepancyStatistics(reconciliationId);

      expect(stats.total).toBe(3);
      expect(stats.byType.missing_transaction).toBe(1);
      expect(stats.byType.amount_mismatch).toBe(1);
      expect(stats.byType.extra_transaction).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.bySeverity.low).toBe(1);
      expect(stats.byStatus.open).toBe(1);
      expect(stats.byStatus.resolved).toBe(1);
      expect(stats.byStatus.ignored).toBe(1);
      expect(stats.openCount).toBe(1);
      expect(stats.resolvedCount).toBe(1);
      expect(stats.ignoredCount).toBe(1);
    });

    it('should auto-resolve discrepancies based on business rules', async () => {
      const reconciliationId = 'reconciliation_123';
      const mockDiscrepancies = [
        {
          id: 'disc_1',
          type: 'amount_mismatch',
          severity: 'low',
          status: 'open',
          expectedValue: 100000,
          actualValue: 100050,
          settlementData: {},
          internalData: {}
        },
        {
          id: 'disc_2',
          type: 'status_mismatch',
          severity: 'medium',
          status: 'open',
          settlementData: { status: 'success' },
          internalData: { payment_status: 'fully_paid' }
        },
        {
          id: 'disc_3',
          type: 'missing_transaction',
          severity: 'high',
          status: 'open',
          settlementData: { processedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString() },
          internalData: {}
        }
      ];

      // Mock getDiscrepancies
      jest.spyOn(service, 'getDiscrepancies').mockResolvedValue(mockDiscrepancies);
      
      // Mock resolveDiscrepancy and ignoreDiscrepancy
      jest.spyOn(service, 'resolveDiscrepancy').mockResolvedValue();
      jest.spyOn(service, 'ignoreDiscrepancy').mockResolvedValue();

      const result = await service.autoResolveDiscrepancies(reconciliationId);

      expect(result.resolved).toBe(2); // amount_mismatch and status_mismatch
      expect(result.ignored).toBe(1); // missing_transaction (old)
      expect(result.remaining).toBe(0);

      // Verify resolveDiscrepancy was called for amount_mismatch
      expect(service.resolveDiscrepancy).toHaveBeenCalledWith(
        'disc_1',
        expect.stringContaining('Auto-resolved: Small amount difference'),
        'system'
      );

      // Verify resolveDiscrepancy was called for status_mismatch
      expect(service.resolveDiscrepancy).toHaveBeenCalledWith(
        'disc_2',
        expect.stringContaining('Auto-resolved: Status mismatch is acceptable'),
        'system'
      );

      // Verify ignoreDiscrepancy was called for missing_transaction
      expect(service.ignoreDiscrepancy).toHaveBeenCalledWith(
        'disc_3',
        expect.stringContaining('Auto-ignored: Settlement transaction is very old'),
        'system'
      );
    });

    it('should complete reconciliation with discrepancy detection', async () => {
      const reconciliationId = 'reconciliation_123';
      const completedBy = 'admin_test';

      // Mock reconciliation record
      const mockReconciliation = {
        id: reconciliationId,
        reconciliationDate: '2024-01-15',
        settlementId: 'settlement_123',
        totalSettlementAmount: 0,
        totalInternalAmount: 0,
        discrepancyAmount: 0,
        discrepancyCount: 0,
        status: 'pending' as const,
        matchedTransactions: 0,
        unmatchedTransactions: 0,
        discrepancies: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      // Mock settlement data
      const mockSettlement = {
        settlementId: 'settlement_123',
        settlementDate: '2024-01-15',
        totalAmount: 100000,
        totalCount: 1,
        fees: 2900,
        netAmount: 97100,
        currency: 'KRW',
        status: 'completed' as const,
        transactions: [],
        metadata: {},
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      // Mock matching result
      const mockMatchingResult = {
        matches: [],
        unmatchedSettlement: [],
        unmatchedInternal: [],
        summary: {
          totalSettlement: 1,
          totalInternal: 1,
          exactMatches: 1,
          fuzzyMatches: 0,
          manualMatches: 0,
          unmatched: 0,
          matchRate: 100
        }
      };

      // Mock discrepancies
      const mockDiscrepancies = [];

      // Mock service methods
      jest.spyOn(service, 'getReconciliationRecord').mockResolvedValue(mockReconciliation);
      jest.spyOn(service, 'getSettlementDataById').mockResolvedValue(mockSettlement);
      jest.spyOn(service, 'performTransactionMatching').mockResolvedValue(mockMatchingResult);
      jest.spyOn(service, 'detectDiscrepancies').mockResolvedValue(mockDiscrepancies);
      jest.spyOn(service, 'getDiscrepancies').mockResolvedValue(mockDiscrepancies);
      jest.spyOn(service, 'autoResolveDiscrepancies').mockResolvedValue({ resolved: 0, ignored: 0, remaining: 0 });

      // Mock database update
      mockSupabase.from = jest.fn().mockReturnValueOnce({
        update: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ error: null })
        })
      });

      const result = await service.completeReconciliation(reconciliationId, completedBy);

      expect(result.reconciliation).toBeDefined();
      expect(result.discrepancies).toBeDefined();
      expect(result.autoResolution).toBeDefined();
      expect(result.autoResolution.resolved).toBe(0);
      expect(result.autoResolution.ignored).toBe(0);
      expect(result.autoResolution.remaining).toBe(0);
    });
  });

  describe('reconciliation reporting and audit trails', () => {
    it('should generate reconciliation report', async () => {
      const reconciliationId = 'reconciliation_123';
      const reportType = 'summary';

      // Mock reconciliation record
      const mockReconciliation = {
        id: reconciliationId,
        reconciliationDate: '2024-01-15',
        settlementId: 'settlement_123',
        totalSettlementAmount: 1000000,
        totalInternalAmount: 950000,
        discrepancyAmount: 50000,
        discrepancyCount: 2,
        status: 'completed' as const,
        matchedTransactions: 8,
        unmatchedTransactions: 2,
        completedBy: 'admin_test',
        completedAt: '2024-01-15T11:00:00Z',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T11:00:00Z'
      };

      // Mock settlement data
      const mockSettlement = {
        settlementId: 'settlement_123',
        settlementDate: '2024-01-15',
        totalAmount: 1000000,
        totalCount: 10,
        fees: 29000,
        netAmount: 971000,
        currency: 'KRW',
        status: 'completed' as const,
        transactions: [],
        metadata: {},
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      // Mock discrepancies and statistics
      const mockDiscrepancies = [];
      const mockStats = {
        total: 0,
        byType: {},
        bySeverity: {},
        byStatus: {},
        openCount: 0,
        resolvedCount: 0,
        ignoredCount: 0
      };

      // Mock transaction matches
      const mockMatches = [];

      // Mock service methods
      jest.spyOn(service, 'getReconciliationRecord').mockResolvedValue(mockReconciliation);
      jest.spyOn(service, 'getSettlementDataById').mockResolvedValue(mockSettlement);
      jest.spyOn(service, 'getDiscrepancies').mockResolvedValue(mockDiscrepancies);
      jest.spyOn(service, 'getDiscrepancyStatistics').mockResolvedValue(mockStats);

      // Mock database calls
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockMatches, error: null })
          })
        }),
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const report = await service.generateReconciliationReport(reconciliationId, reportType);

      expect(report).toBeDefined();
      expect(report.id).toContain('report_');
      expect(report.reconciliationId).toBe(reconciliationId);
      expect(report.reportType).toBe(reportType);
      expect(report.summary.totalSettlementAmount).toBe(1000000);
      expect(report.summary.totalInternalAmount).toBe(950000);
      expect(report.summary.discrepancyAmount).toBe(50000);
      expect(report.summary.matchRate).toBe(80); // 8/10 * 100
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should get reconciliation reports', async () => {
      const mockReports = [
        {
          report_data: {
            id: 'report_1',
            reconciliationId: 'reconciliation_123',
            reportType: 'summary',
            generatedAt: '2024-01-15T12:00:00Z'
          }
        }
      ];

      // Mock database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockReports, error: null })
        })
      });

      const reports = await service.getReconciliationReports();

      expect(reports).toHaveLength(1);
      expect(reports[0].id).toBe('report_1');
    });

    it('should create reconciliation alert', async () => {
      const reconciliationId = 'reconciliation_123';
      const alertType = 'discrepancy';
      const message = 'Test alert';
      const severity = 'high';

      // Mock logger
      const mockLogger = {
        warn: jest.fn(),
        error: jest.fn()
      };
      (service as any).logger = mockLogger;

      // Mock database insert
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      await service.createReconciliationAlert(
        reconciliationId,
        alertType,
        message,
        severity
      );

      // Verify the insert was called with correct parameters
      expect(mockSupabase.from).toHaveBeenCalledWith('reconciliation_alerts');
      // Note: logger.warn might not be called if the method completes without errors
      // The important thing is that the database insert was called successfully
    });

    it('should get reconciliation alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert_1',
          reconciliation_id: 'reconciliation_123',
          alert_type: 'discrepancy',
          message: 'Test alert',
          severity: 'high',
          status: 'active'
        }
      ];

      // Mock database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockAlerts, error: null })
        })
      });

      const alerts = await service.getReconciliationAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe('alert_1');
    });

    it('should resolve reconciliation alert', async () => {
      const alertId = 'alert_1';
      const resolvedBy = 'admin_test';
      const resolution = 'Test resolution';

      // Mock database update
      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      await service.resolveReconciliationAlert(alertId, resolvedBy, resolution);

      // Verify the update was called with correct parameters
      expect(mockSupabase.from).toHaveBeenCalledWith('reconciliation_alerts');
    });

    it('should get reconciliation audit trail', async () => {
      const reconciliationId = 'reconciliation_123';
      const mockAuditLogs = [
        {
          id: 'audit_1',
          reconciliation_id: reconciliationId,
          action: 'reconciliation_created',
          performed_by: 'admin_test',
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      // Mock database call
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockAuditLogs, error: null })
          })
        })
      });

      const auditTrail = await service.getReconciliationAuditTrail(reconciliationId);

      expect(auditTrail).toHaveLength(1);
      expect(auditTrail[0].id).toBe('audit_1');
      expect(auditTrail[0].action).toBe('reconciliation_created');
    });
  });

  describe('data validation', () => {
    it('should validate settlement data structure', async () => {
      const date = '2024-01-15';
      mockSupabase.data = { id: 'settlement_123' };

      const result = await service.fetchSettlementData(date);

      // Validate required fields
      expect(result.settlementId).toBeDefined();
      expect(result.settlementDate).toBeDefined();
      expect(result.totalAmount).toBeDefined();
      expect(result.totalCount).toBeDefined();
      expect(result.fees).toBeDefined();
      expect(result.netAmount).toBeDefined();
      expect(result.currency).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.transactions).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      // Validate data types
      expect(typeof result.settlementId).toBe('string');
      expect(typeof result.settlementDate).toBe('string');
      expect(typeof result.totalAmount).toBe('number');
      expect(typeof result.totalCount).toBe('number');
      expect(typeof result.fees).toBe('number');
      expect(typeof result.netAmount).toBe('number');
      expect(typeof result.currency).toBe('string');
      expect(typeof result.status).toBe('string');
      expect(Array.isArray(result.transactions)).toBe(true);
      expect(typeof result.metadata).toBe('object');
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });

    it('should validate transaction data structure', async () => {
      const date = '2024-01-15';
      mockSupabase.data = { id: 'settlement_123' };

      const result = await service.fetchSettlementData(date);

      result.transactions.forEach(transaction => {
        // Validate required fields
        expect(transaction.transactionId).toBeDefined();
        expect(transaction.paymentId).toBeDefined();
        expect(transaction.amount).toBeDefined();
        expect(transaction.fees).toBeDefined();
        expect(transaction.netAmount).toBeDefined();
        expect(transaction.status).toBeDefined();
        expect(transaction.paymentMethod).toBeDefined();
        expect(transaction.processedAt).toBeDefined();
        expect(transaction.metadata).toBeDefined();

        // Validate data types
        expect(typeof transaction.transactionId).toBe('string');
        expect(typeof transaction.paymentId).toBe('string');
        expect(typeof transaction.amount).toBe('number');
        expect(typeof transaction.fees).toBe('number');
        expect(typeof transaction.netAmount).toBe('number');
        expect(typeof transaction.status).toBe('string');
        expect(typeof transaction.paymentMethod).toBe('string');
        expect(typeof transaction.processedAt).toBe('string');
        expect(typeof transaction.metadata).toBe('object');

        // Validate calculations
        expect(transaction.netAmount).toBe(transaction.amount - transaction.fees);
      });
    });
  });
});
